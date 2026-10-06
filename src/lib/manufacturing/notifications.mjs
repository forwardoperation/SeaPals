const MESSAGES = {
  in_production: [
    "Your cards are in production",
    "We have started printing your cards. We will assemble, finish, and check them before packing.",
  ],
  packing: [
    "Your cards passed their quality check",
    "Your cards have been picked or made and checked, including any holo finishing. Your order is being packed.",
  ],
  ready_for_pickup: [
    "Your order is ready for pickup",
    "Your order is packed and ready for pickup.",
  ],
  shipped: [
    "Your order has shipped",
    "Your order has been handed over for shipping.",
  ],
};
export function buyerMessage(order, milestone, sender) {
  if (
    !MESSAGES[milestone] ||
    /[\r\n]/.test(order.customer_email ?? "") ||
    !/^\S+@\S+\.\S+$/.test(order.customer_email ?? "")
  )
    throw new Error("Invalid notification recipient or milestone.");
  const [title, description] = MESSAGES[milestone];
  const lines = [`Sea Realm order ${order.order_number}`, "", description];
  if (milestone === "shipped") {
    if (order.tracking_number)
      lines.push(`Tracking number: ${order.tracking_number}`);
    try {
      const url = new URL(order.tracking_url);
      if (url.protocol === "https:")
        lines.push(`Track your shipment: ${url.href}`);
    } catch {}
  }
  if (milestone === "ready_for_pickup" && order.pickup_location)
    lines.push(`Pickup: ${order.pickup_location}`);
  lines.push("", "Thank you for supporting Sea Realm.");
  return {
    from: sender,
    to: [order.customer_email],
    subject: `${order.order_number}: ${title}`,
    text: lines.join("\n"),
  };
}
export function shouldSendMilestone(order, milestone, state) {
  if (
    order.payment_status !== "paid" ||
    !order.payment_livemode ||
    Number(order.amount_refunded_cents) > 0 ||
    state?.hold ||
    ["on_hold", "cancelled"].includes(order.fulfillment_status)
  )
    return false;
  if (
    [
      "needs_response",
      "under_review",
      "lost",
      "warning_needs_response",
      "warning_under_review",
    ].includes(order.dispute_status)
  )
    return false;
  // Avoid obsolete 'printing' emails when several milestones finish before cron.
  const allowed = {
    in_production: ["in_production"],
    packing: ["packing", "awaiting_shipment"],
    ready_for_pickup: ["ready_for_pickup"],
    shipped: ["shipped"],
  };
  return allowed[milestone]?.includes(order.fulfillment_status) ?? false;
}
export async function drainManufacturingNotifications({
  environment,
  fetchImpl = fetch,
}) {
  if (environment.MANUFACTURING_BUYER_NOTIFICATIONS_ENABLED !== "true")
    return { disabled: true };
  if (
    !environment.RESEND_API_KEY ||
    !environment.EMAIL_FROM ||
    !environment.SUPABASE_SERVICE_ROLE_KEY
  )
    throw new Error("Manufacturing buyer email is not configured.");
  const base = new URL(environment.NEXT_PUBLIC_SUPABASE_URL);
  if (base.protocol !== "https:")
    throw new Error("Secure database URL required.");
  const token = crypto.randomUUID(),
    headers = {
      apikey: environment.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${environment.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    };
  async function db(route, payload) {
    const r = await fetchImpl(new URL(`/rest/v1/${route}`, base), {
      headers,
      ...(payload ? { method: "POST", body: JSON.stringify(payload) } : {}),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok)
      throw new Error("Manufacturing notification database request failed.");
    return r.json();
  }
  const rpc = (name, args) => db(`rpc/manufacturing_${name}`, args);
  const pending = await rpc("claim_notifications", { p_token: token });
  const summary = { sent: 0, skipped: 0, failed: 0 };
  for (const item of pending) {
    try {
      const [orders, manufacturing, refunds] = await Promise.all([
        db(
          `store_orders?id=eq.${encodeURIComponent(item.order_id)}&select=order_number,customer_email,payment_status,payment_livemode,amount_refunded_cents,dispute_status,fulfillment_status,pickup_location,tracking_number,tracking_url`,
        ),
        db(
          `manufacturing_orders?order_id=eq.${encodeURIComponent(item.order_id)}&select=state`,
        ),
        db(
          `store_refunds?order_id=eq.${encodeURIComponent(item.order_id)}&status=in.(pending,requires_action,succeeded)&select=id&limit=1`,
        ),
      ]);
      const order = orders[0];
      if (
        !order ||
        refunds.length ||
        !shouldSendMilestone(order, item.milestone, manufacturing[0]?.state)
      ) {
        // A saved payload means a prior send may have been accepted. Preserve
        // that ambiguity if a refund/hold overtook the retry.
        await rpc("finish_notification", {
          p_id: item.id,
          p_token: token,
          p_status: item.payload ? "review" : "skipped",
        });
        if (item.payload) summary.failed++;
        else summary.skipped++;
        continue;
      }
      const payload = await rpc("notification_payload", {
        p_id: item.id,
        p_token: token,
        p_payload: buyerMessage(order, item.milestone, environment.EMAIL_FROM),
      });
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${environment.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `manufacturing/${item.id}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error("Buyer email delivery not accepted.");
      // A 2xx is accepted even if the provider response body is lost.
      await rpc("finish_notification", {
        p_id: item.id,
        p_token: token,
        p_status: "sent",
      });
      summary.sent++;
    } catch {
      summary.failed++;
      // Leave the lease to expire. Retry the identical saved payload/key; the
      // database moves ambiguous attempts to review before the provider key expires.
    }
  }
  return summary;
}
