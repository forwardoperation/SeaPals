import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export class OrderStoreError extends Error {
  constructor(message, { code = "order_store_error", cause } = {}) {
    super(message, { cause });
    this.name = "OrderStoreError";
    this.code = code;
  }
}

function createOrderNumber(now = new Date()) {
  const date = now.toISOString().slice(2, 10).replaceAll("-", "");
  const suffix = globalThis.crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 6)
    .toUpperCase();
  return `SP-${date}-${suffix}`;
}

export async function createPendingStoreOrder({
  quote,
  currency,
  paymentLivemode,
}) {
  const supabase = createSupabaseAdmin();
  const id = globalThis.crypto.randomUUID();
  const orderNumber = createOrderNumber();
  const order = {
    id,
    order_number: orderNumber,
    currency,
    payment_livemode: Boolean(paymentLivemode),
    subtotal_cents: quote.subtotalCents,
    fulfillment_method: quote.fulfillmentMethod,
    fulfillment_option_id: quote.fulfillmentOptionId,
    fulfillment_option_name: quote.fulfillmentOptionName,
    pickup_location: quote.pickupLocation,
    shipping_cents: quote.shippingCents,
    tax_cents: 0,
    total_cents: quote.totalCents,
    payment_status: "pending",
    fulfillment_status: "unfulfilled",
  };

  const { error: orderError } = await supabase.from("store_orders").insert(order);
  if (orderError) {
    throw new OrderStoreError("The order ledger is not ready.", {
      code: "order_insert_failed",
      cause: orderError,
    });
  }

  const items = quote.items.map((item) => ({
    order_id: id,
    product_id: item.productId,
    product_category: item.category || "uncategorized",
    sku: item.sku,
    deck_id: item.deckId || null,
    product_name: item.name,
    unit_amount_cents: item.unitAmountCents,
    quantity: item.quantity,
    line_total_cents: item.lineTotalCents,
  }));

  const { error: itemsError } = await supabase
    .from("store_order_items")
    .insert(items);

  if (itemsError) {
    await supabase.from("store_orders").delete().eq("id", id);
    throw new OrderStoreError("The order items could not be saved.", {
      code: "order_items_insert_failed",
      cause: itemsError,
    });
  }

  return { id, orderNumber };
}

export async function attachCheckoutSessionToOrder(orderId, sessionId) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("store_orders")
    .update({ checkout_session_id: sessionId })
    .eq("id", orderId);

  if (error) {
    throw new OrderStoreError("The checkout reference could not be saved.", {
      code: "checkout_session_update_failed",
      cause: error,
    });
  }
}

export async function markStoreOrderCheckoutFailed(orderId, reason) {
  const supabase = createSupabaseAdmin();
  const note = String(reason ?? "Checkout session creation failed.").slice(0, 500);

  await supabase
    .from("store_orders")
    .update({ payment_status: "failed", internal_notes: note })
    .eq("id", orderId)
    .eq("payment_status", "pending");
}

export async function processStorePaymentEvent(details) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("process_store_payment_event", {
    p_provider_event_id: details.providerEventId,
    p_event_type: details.eventType,
    p_event_created_at: details.eventCreatedAt,
    p_order_id: details.orderId,
    p_checkout_session_id: details.checkoutSessionId,
    p_payment_intent_id: details.paymentIntentId,
    p_charge_id: details.chargeId,
    p_payment_status: details.paymentStatus,
    p_customer_email: details.customerEmail,
    p_customer_name: details.customerName,
    p_shipping_address: details.shippingAddress,
    p_currency: details.currency,
    p_subtotal_cents: details.subtotalCents,
    p_shipping_cents: details.shippingCents,
    p_tax_cents: details.taxCents,
    p_total_cents: details.totalCents,
    p_amount_refunded_cents: details.amountRefundedCents ?? null,
    p_receipt_url: details.receiptUrl,
    p_receipt_number: details.receiptNumber,
    p_payment_livemode: details.paymentLivemode,
    p_fulfillment_method: details.fulfillmentMethod ?? null,
    p_fulfillment_option_id: details.fulfillmentOptionId ?? null,
    p_fulfillment_option_name: details.fulfillmentOptionName ?? null,
    p_pickup_location: details.pickupLocation ?? null,
    p_stripe_shipping_rate_id: details.stripeShippingRateId ?? null,
  });

  if (error) {
    throw new OrderStoreError("The payment event could not be recorded.", {
      code: "payment_event_failed",
      cause: error,
    });
  }

  return { processed: Boolean(data) };
}

export async function listStoreOrders({ limit = 250 } = {}) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("store_orders")
    .select(
      "id, order_number, created_at, updated_at, paid_at, refunded_at, shipped_at, customer_email, customer_name, shipping_address, currency, subtotal_cents, fulfillment_method, fulfillment_option_id, fulfillment_option_name, pickup_location, stripe_shipping_rate_id, shipping_cents, tax_cents, total_cents, amount_refunded_cents, payment_status, fulfillment_status, receipt_url, receipt_number, checkout_session_id, payment_intent_id, charge_id, payment_livemode, tracking_number, tracking_url, internal_notes, store_order_items(id, sku, product_id, product_category, deck_id, product_name, unit_amount_cents, quantity, line_total_cents)"
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 250, 1), 500));

  if (error) {
    throw new OrderStoreError("Orders could not be loaded.", {
      code: "orders_load_failed",
      cause: error,
    });
  }

  return data ?? [];
}

export async function updateStoreOrderFulfillment({
  id,
  fulfillmentStatus,
  trackingNumber,
  trackingUrl,
  internalNotes,
}) {
  const supabase = createSupabaseAdmin();
  const { data: existingOrder, error: existingOrderError } = await supabase
    .from("store_orders")
    .select("fulfillment_method, fulfillment_status, shipped_at")
    .eq("id", id)
    .single();

  if (existingOrderError || !existingOrder) {
    throw new OrderStoreError("The order could not be loaded.", {
      code: "order_load_failed",
      cause: existingOrderError,
    });
  }

  const pickupOrder = existingOrder.fulfillment_method === "pickup";
  if (
    (pickupOrder && fulfillmentStatus === "shipped") ||
    (!pickupOrder && ["ready_for_pickup", "picked_up"].includes(fulfillmentStatus))
  ) {
    throw new OrderStoreError("That fulfillment status does not match the order method.", {
      code: "invalid_fulfillment_status",
    });
  }

  if (pickupOrder && (trackingNumber || trackingUrl)) {
    throw new OrderStoreError("Pickup orders cannot have shipping tracking.", {
      code: "pickup_tracking_not_allowed",
    });
  }

  const update = {
    fulfillment_status: fulfillmentStatus,
    tracking_number: trackingNumber || null,
    tracking_url: trackingUrl || null,
    internal_notes: internalNotes || null,
    shipped_at:
      ["shipped", "picked_up"].includes(fulfillmentStatus)
        ? existingOrder.fulfillment_status === fulfillmentStatus &&
          existingOrder.shipped_at
          ? existingOrder.shipped_at
          : new Date().toISOString()
        : null,
  };

  let query = supabase
    .from("store_orders")
    .update(update)
    .eq("id", id);

  if (
    ["packing", "ready_for_pickup", "picked_up", "shipped"].includes(
      fulfillmentStatus
    )
  ) {
    // Non-paid orders may retain an already-saved terminal status for staff
    // notes, but they cannot transition into packing or shipped.
    query = query.or(
      `payment_status.eq.paid,fulfillment_status.eq.${fulfillmentStatus}`
    );
  }

  const { data, error } = await query
    .select(
      "id, fulfillment_status, tracking_number, tracking_url, internal_notes, shipped_at, updated_at"
    )
    .single();

  if (error) {
    throw new OrderStoreError("The fulfillment update could not be saved.", {
      code: "fulfillment_update_failed",
      cause: error,
    });
  }

  return data;
}
