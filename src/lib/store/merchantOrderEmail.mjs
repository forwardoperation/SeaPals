const DEFAULT_MERCHANT_EMAIL = "maker@seapalstcg.com";
const DEFAULT_SITE_ORIGIN = "https://seapalstcg.com";
const NOTIFICATION_TYPE = "merchant_purchase";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class MerchantOrderNotificationError extends Error {
  constructor(message, { code = "merchant_notification_failed", cause } = {}) {
    super(message, { cause });
    this.name = "MerchantOrderNotificationError";
    this.code = code;
  }
}

function safeText(value, fallback = "") {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
}

function safeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function htmlLines(lines) {
  return lines
    .filter(Boolean)
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join("");
}

function currencyCode(value) {
  const code = safeText(value, "usd").toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : "USD";
}

function formatMoney(cents, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode(currency),
  }).format(safeInteger(cents) / 100);
}

function formatDate(value) {
  if (!value) return null;
  const raw = safeText(value);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const date = new Date(dateOnly ? `${raw}T12:00:00.000Z` : value);
  if (Number.isNaN(date.valueOf())) return safeText(value) || null;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: dateOnly ? "UTC" : "America/New_York",
  }).format(date);
}

function orderItems(order) {
  const items = Array.isArray(order?.store_order_items)
    ? order.store_order_items
    : [];

  return [...items]
    .map((item) => ({
      name: safeText(item?.product_name, "Unnamed product"),
      sku: safeText(item?.sku, "SKU unavailable"),
      quantity: Math.max(1, safeInteger(item?.quantity, 1)),
      unitAmountCents: safeInteger(item?.unit_amount_cents),
      lineTotalCents: safeInteger(item?.line_total_cents),
    }))
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.sku.localeCompare(right.sku)
    );
}

function addressLines(order) {
  if (safeText(order?.fulfillment_method) === "pickup") return [];

  const shipping = order?.shipping_address;
  const address = shipping?.address ?? shipping ?? {};
  const cityLine = [
    safeText(address?.city),
    safeText(address?.state),
    safeText(address?.postal_code),
  ]
    .filter(Boolean)
    .join(" ");

  return [
    safeText(shipping?.name || order?.customer_name),
    safeText(address?.line1),
    safeText(address?.line2),
    cityLine,
    safeText(address?.country),
    safeText(shipping?.phone),
  ].filter(Boolean);
}

function productionDescription(order) {
  const name = safeText(order?.production_option_name, "Standard production");
  const days = safeInteger(order?.production_max_business_days, 5);
  const window = days === 1 ? "1 business day" : `up to ${days} business days`;
  const amount = formatMoney(order?.production_cents, order?.currency);
  const due = formatDate(order?.production_due_date);
  return `${name} — ${amount} — ${window}${due ? ` — due ${due}` : ""}`;
}

function fulfillmentDescription(order) {
  const pickup = safeText(order?.fulfillment_method) === "pickup";
  const option = safeText(
    order?.fulfillment_option_name,
    pickup ? "Scheduled pickup" : "Shipping"
  );
  if (pickup) {
    const location = safeText(order?.pickup_location, "Elverson, PA");
    const includesLocation = option
      .toLocaleLowerCase("en-US")
      .includes(location.toLocaleLowerCase("en-US"));
    return `${option}${includesLocation ? "" : ` — ${location}`} — free; arrange a pickup time with the customer after the order is ready`;
  }
  return `${option} — ${formatMoney(order?.shipping_cents, order?.currency)}`;
}

function validOrder(order) {
  return (
    order &&
    typeof order === "object" &&
    UUID_PATTERN.test(safeText(order.id)) &&
    safeText(order.order_number) &&
    orderItems(order).length > 0
  );
}

export function merchantPurchaseIdempotencyKey(orderId) {
  const id = safeText(orderId);
  if (!UUID_PATTERN.test(id)) {
    throw new MerchantOrderNotificationError(
      "The merchant notification order reference is invalid.",
      { code: "merchant_notification_order_invalid" }
    );
  }
  return `seapals-${NOTIFICATION_TYPE}-${id}`;
}

export function merchantOrderAdminUrl(orderId, environment = {}) {
  let origin = DEFAULT_SITE_ORIGIN;
  try {
    const configured = new URL(
      safeText(environment.SITE_URL || environment.NEXT_PUBLIC_SITE_URL)
    );
    if (["http:", "https:"].includes(configured.protocol)) {
      origin = configured.origin;
    }
  } catch {
    // The production origin is a safe fallback when configuration is absent.
  }

  const url = new URL("/admin/orders", origin);
  url.searchParams.set("order", safeText(orderId));
  return url.toString();
}

export function buildMerchantPurchaseEmail(order, environment = {}) {
  if (!validOrder(order)) {
    throw new MerchantOrderNotificationError(
      "The paid order could not be prepared for merchant notification.",
      { code: "merchant_notification_order_invalid" }
    );
  }

  const items = orderItems(order);
  const pickup = safeText(order.fulfillment_method) === "pickup";
  const rush =
    safeText(order.production_option_id) === "expedited-production" ||
    (safeInteger(order.production_max_business_days) === 1 &&
      safeInteger(order.production_cents) > 0);
  const mode = order.payment_livemode === true ? "LIVE" : "TEST";
  const subjectFlags = [mode === "TEST" ? "[TEST]" : "", rush ? "[RUSH]" : ""]
    .filter(Boolean)
    .join(" ");
  const subject = `${subjectFlags ? `${subjectFlags} ` : ""}New SeaPals order ${safeText(
    order.order_number
  )} — ${formatMoney(order.total_cents, order.currency)}`;
  const adminUrl = merchantOrderAdminUrl(order.id, environment);
  const customerLines = [
    `Name: ${safeText(order.customer_name, "Not supplied")}`,
    `Email: ${safeText(order.customer_email, "Not supplied")}`,
  ];
  const shippingLines = addressLines(order);
  const itemText = items.map(
    (item) =>
      `- ${item.quantity} × ${item.name} (${item.sku}) — ${formatMoney(
        item.unitAmountCents,
        order.currency
      )} each — ${formatMoney(item.lineTotalCents, order.currency)}`
  );
  const totals = [
    `Products: ${formatMoney(order.subtotal_cents, order.currency)}`,
    `Production: ${formatMoney(order.production_cents, order.currency)}`,
    `${pickup ? "Scheduled pickup" : "Shipping & handling"}: ${formatMoney(
      order.shipping_cents,
      order.currency
    )}`,
    `Tax: ${formatMoney(order.tax_cents, order.currency)}`,
    `Total paid: ${formatMoney(order.total_cents, order.currency)}`,
  ];

  const text = [
    rush ? "RUSH ORDER — one-business-day production" : "New paid SeaPals order",
    "",
    `Order: ${safeText(order.order_number)}`,
    `Mode: ${mode}`,
    `Paid: ${formatDate(order.paid_at) || "Confirmed by Stripe"}`,
    "",
    "Customer",
    ...customerLines,
    "",
    "Items",
    ...itemText,
    "",
    `Production: ${productionDescription(order)}`,
    `Fulfillment: ${fulfillmentDescription(order)}`,
    ...(shippingLines.length ? ["", "Ship to", ...shippingLines] : []),
    "",
    "Totals",
    ...totals,
    "",
    `Open the private order workspace: ${adminUrl}`,
  ].join("\n");

  const htmlItems = items
    .map(
      (item) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #dbeafe">${item.quantity} × ${escapeHtml(
          item.name
        )}<br><small>${escapeHtml(item.sku)}</small></td>
        <td style="padding:8px;border-bottom:1px solid #dbeafe;text-align:right">${escapeHtml(
          formatMoney(item.lineTotalCents, order.currency)
        )}</td>
      </tr>`
    )
    .join("");
  const htmlTotals = totals
    .map((line) => {
      const separator = line.indexOf(":");
      const label = separator >= 0 ? line.slice(0, separator) : line;
      const amount = separator >= 0 ? line.slice(separator + 1).trim() : "";
      return `<tr><td style="padding:4px 8px">${escapeHtml(
        label
      )}</td><td style="padding:4px 8px;text-align:right">${escapeHtml(
        amount
      )}</td></tr>`;
    })
    .join("");
  const html = `<!doctype html>
  <html><body style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
    <div style="max-width:680px;margin:0 auto">
      <h1 style="color:${rush ? "#b91c1c" : "#075985"}">${
        rush ? "RUSH order paid" : "New order paid"
      }</h1>
      <p><strong>Order ${escapeHtml(order.order_number)}</strong> · ${escapeHtml(
        mode
      )} · ${escapeHtml(formatMoney(order.total_cents, order.currency))}</p>
      <h2>Customer</h2>${htmlLines(customerLines)}
      <h2>Items</h2>
      <table style="width:100%;border-collapse:collapse">${htmlItems}</table>
      <h2>Production and fulfillment</h2>
      <p><strong>Production:</strong> ${escapeHtml(productionDescription(order))}</p>
      <p><strong>Fulfillment:</strong> ${escapeHtml(fulfillmentDescription(order))}</p>
      ${
        shippingLines.length
          ? `<h3>Ship to</h3>${htmlLines(shippingLines)}`
          : ""
      }
      <h2>Totals</h2>
      <table style="width:100%;border-collapse:collapse">${htmlTotals}</table>
      <p style="margin-top:24px"><a href="${escapeHtml(
        adminUrl
      )}" style="display:inline-block;background:#0369a1;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Open private order workspace</a></p>
    </div>
  </body></html>`;

  return { subject, text, html, adminUrl, rush, pickup };
}

function headerValue(value, name) {
  const normalized = safeText(value);
  if (!normalized || normalized.length > 500 || /[\r\n]/.test(normalized)) {
    throw new MerchantOrderNotificationError(
      `Merchant notification ${name} is not configured.`,
      { code: "merchant_email_not_configured" }
    );
  }
  return normalized;
}

function replyToAddress(value) {
  const normalized = safeText(value);
  if (
    !normalized ||
    normalized.length > 254 ||
    /[\s\r\n]/.test(normalized) ||
    !/^[^@]+@[^@]+\.[^@]+$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export async function sendMerchantPurchaseEmail({
  order,
  environment = {},
  fetchImpl = globalThis.fetch,
}) {
  if (
    safeText(environment.STORE_ORDER_NOTIFICATION_ENABLED).toLowerCase() !==
    "true"
  ) {
    throw new MerchantOrderNotificationError(
      "Merchant order notifications are not enabled.",
      { code: "merchant_email_not_enabled" }
    );
  }
  const apiKey = headerValue(environment.RESEND_API_KEY, "provider");
  const from = headerValue(environment.EMAIL_FROM, "sender");
  const to = headerValue(
    environment.STORE_ORDER_NOTIFICATION_EMAIL || DEFAULT_MERCHANT_EMAIL,
    "recipient"
  );
  if (typeof fetchImpl !== "function") {
    throw new MerchantOrderNotificationError(
      "Merchant notification delivery is unavailable.",
      { code: "merchant_email_transport_unavailable" }
    );
  }

  const email = buildMerchantPurchaseEmail(order, environment);
  const idempotencyKey = merchantPurchaseIdempotencyKey(order.id);
  const replyTo = replyToAddress(order.customer_email);
  let response;
  try {
    response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to,
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    });
  } catch (error) {
    throw new MerchantOrderNotificationError(
      "The merchant notification provider could not be reached.",
      { code: "resend_network_error", cause: error }
    );
  }

  if (!response?.ok) {
    const status = Number(response?.status);
    throw new MerchantOrderNotificationError(
      "The merchant notification provider rejected the request.",
      {
        code: Number.isInteger(status)
          ? `resend_http_${status}`
          : "resend_http_error",
      }
    );
  }

  let providerMessageId = null;
  try {
    const result = await response.json();
    providerMessageId = safeText(result?.id).slice(0, 255) || null;
  } catch {
    // Any 2xx means the provider accepted the idempotent request. A provider
    // message id is helpful for support, but is not required to mark it sent.
  }

  return { providerMessageId, idempotencyKey };
}

export async function deliverMerchantPurchaseNotification({
  orderId,
  environment = {},
  fetchImpl = globalThis.fetch,
  claim,
  loadOrder,
  complete,
  release,
  claimToken = globalThis.crypto.randomUUID(),
}) {
  const status = await claim({ orderId, claimToken });
  if (status === "sent") return { status: "sent", delivered: false };
  if (status === "busy") {
    throw new MerchantOrderNotificationError(
      "The merchant notification is already being delivered.",
      { code: "merchant_notification_busy" }
    );
  }
  if (status !== "claimed") {
    throw new MerchantOrderNotificationError(
      "The paid order notification is not queued.",
      { code: "merchant_notification_missing" }
    );
  }

  try {
    const order = await loadOrder({ orderId });
    const delivery = await sendMerchantPurchaseEmail({
      order,
      environment,
      fetchImpl,
    });
    const completed = await complete({
      orderId,
      claimToken,
      providerMessageId: delivery.providerMessageId,
    });
    if (!completed) {
      throw new MerchantOrderNotificationError(
        "The merchant notification delivery could not be confirmed.",
        { code: "merchant_notification_completion_conflict" }
      );
    }
    return { status: "sent", delivered: true };
  } catch (error) {
    const code = safeText(error?.code, "merchant_notification_failed").slice(
      0,
      100
    );
    try {
      await release({ orderId, claimToken, failureCode: code });
    } catch {
      // If release fails, the short database lease expires so a webhook retry
      // can safely claim the same outbox row later.
    }
    throw error;
  }
}
