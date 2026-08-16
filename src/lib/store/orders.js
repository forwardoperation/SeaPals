import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildStoreOrderReservationArguments,
  createInventoryReservationDeadline,
  expeditedCapacityReservationIsUnavailable,
  inventoryReservationIsUnavailable,
  parseStoreOrderReservationResult,
} from "@/lib/store/inventory.mjs";

export class OrderStoreError extends Error {
  constructor(
    message,
    { code = "order_store_error", status = 503, cause } = {}
  ) {
    super(message, { cause });
    this.name = "OrderStoreError";
    this.code = code;
    this.status = status;
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
  checkoutRequestId,
}) {
  const supabase = createSupabaseAdmin();
  const id = globalThis.crypto.randomUUID();
  const orderNumber = createOrderNumber();
  const inventoryReservedUntil = createInventoryReservationDeadline();
  const rpcArguments = buildStoreOrderReservationArguments({
    orderId: id,
    orderNumber,
    quote,
    currency,
    paymentLivemode,
    checkoutRequestId,
    inventoryReservedUntil,
  });
  const { data, error } = await supabase.rpc(
    "reserve_store_order_inventory",
    rpcArguments
  );

  if (error) {
    await releaseOrderInventoryBestEffort(
      supabase,
      id,
      "Order creation did not complete"
    );

    if (expeditedCapacityReservationIsUnavailable(error)) {
      throw new OrderStoreError(
        "Expedited production is full for the next business day. Choose Standard production or try again.",
        {
          code: "expedited_capacity_unavailable",
          status: 409,
          cause: error,
        }
      );
    }

    if (inventoryReservationIsUnavailable(error)) {
      throw new OrderStoreError("One or more items are out of stock.", {
        code: "inventory_unavailable",
        status: 409,
        cause: error,
      });
    }

    throw new OrderStoreError("Inventory could not be reserved.", {
      code: "inventory_reservation_failed",
      cause: error,
    });
  }

  try {
    return parseStoreOrderReservationResult(data, {
      orderId: id,
      orderNumber,
      inventoryReservedUntil,
      productionOptionId: quote.productionOptionId,
    });
  } catch (error) {
    await releaseOrderInventoryBestEffort(
      supabase,
      id,
      "Order creation returned an invalid response"
    );
    throw new OrderStoreError("Inventory could not be reserved.", {
      code: "inventory_reservation_failed",
      cause: error,
    });
  }
}

async function releaseOrderInventoryBestEffort(supabase, orderId, reason) {
  try {
    const { error } = await supabase.rpc(
      "fail_store_order_checkout_and_release_inventory",
      {
        p_order_id: orderId,
        p_reason: String(reason).slice(0, 500),
      }
    );
    if (error) {
      console.error("Store inventory rollback failed", error);
    }
  } catch (error) {
    console.error("Store inventory rollback failed", error);
  }
}

export async function attachCheckoutSessionToOrder(orderId, session) {
  const sessionId = session?.id;
  const checkoutUrl = session?.url;
  if (
    typeof sessionId !== "string" ||
    !/^cs_[A-Za-z0-9_]+$/.test(sessionId) ||
    typeof checkoutUrl !== "string"
  ) {
    throw new OrderStoreError("The checkout reference was invalid.", {
      code: "checkout_session_update_failed",
    });
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc(
    "attach_store_checkout_session",
    {
      p_order_id: orderId,
      p_checkout_session_id: sessionId,
      p_checkout_url: checkoutUrl,
    }
  );

  if (error || data !== true) {
    throw new OrderStoreError("The checkout reference could not be saved.", {
      code: "checkout_session_update_failed",
      cause: error,
    });
  }
}

export async function markStoreOrderCheckoutFailed(orderId, reason) {
  const supabase = createSupabaseAdmin();
  const note = String(reason ?? "Checkout session creation failed").slice(0, 500);
  const { data, error } = await supabase.rpc(
    "fail_store_order_checkout_and_release_inventory",
    {
      p_order_id: orderId,
      p_reason: note,
    }
  );

  if (error) {
    throw new OrderStoreError(
      "The checkout failure could not release its inventory.",
      {
        code: "inventory_release_failed",
        cause: error,
      }
    );
  }

  return Boolean(data);
}

export async function storePaymentEventReferencesKnownOrder(details) {
  const references = [
    ["id", details?.orderId],
    ["checkout_session_id", details?.checkoutSessionId],
    ["payment_intent_id", details?.paymentIntentId],
    ["charge_id", details?.chargeId],
  ].filter(([, value]) => Boolean(value));

  if (!references.length) return false;

  const supabase = createSupabaseAdmin();
  const results = await Promise.all(
    references.map(([column, value]) =>
      supabase.from("store_orders").select("id").eq(column, value).limit(1)
    )
  );

  for (const { error } of results) {
    if (error) {
      throw new OrderStoreError(
        "Payment event ownership could not be checked.",
        {
          code: "payment_event_ownership_check_failed",
          cause: error,
        }
      );
    }
  }

  return results.some(({ data }) => Array.isArray(data) && data.length > 0);
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
    p_production_option_id: details.productionOptionId ?? null,
    p_production_option_name: details.productionOptionName ?? null,
    p_production_max_business_days:
      details.productionMaxBusinessDays ?? null,
    p_production_cents: details.productionCents ?? null,
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

export async function processStoreRefundEvent(details) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("process_store_refund_event", {
    p_provider_event_id: details.providerEventId,
    p_event_type: details.eventType,
    p_event_created_at: details.eventCreatedAt,
    p_order_id: details.orderId,
    p_refund_id: details.refundId,
    p_refund_status: details.refundStatus,
    p_refund_pending_reason: details.refundPendingReason ?? null,
    p_refund_failure_reason: details.refundFailureReason ?? null,
    p_amount_cents: details.amountCents,
    p_currency: details.currency,
    p_refund_created_at: details.refundCreatedAt ?? null,
    p_payment_intent_id: details.paymentIntentId,
    p_charge_id: details.chargeId,
    p_payment_livemode: details.paymentLivemode,
  });

  if (error) {
    throw new OrderStoreError("The refund event could not be recorded.", {
      code: "refund_event_failed",
      cause: error,
    });
  }

  return { processed: Boolean(data) };
}

export async function processStoreDisputeEvent(details) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("process_store_dispute_event", {
    p_provider_event_id: details.providerEventId,
    p_event_type: details.eventType,
    p_event_created_at: details.eventCreatedAt,
    p_order_id: details.orderId,
    p_dispute_id: details.disputeId,
    p_dispute_status: details.disputeStatus,
    p_amount_cents: details.amountCents,
    p_currency: details.currency,
    p_payment_intent_id: details.paymentIntentId,
    p_charge_id: details.chargeId,
    p_payment_livemode: details.paymentLivemode,
  });

  if (error) {
    throw new OrderStoreError("The dispute event could not be recorded.", {
      code: "dispute_event_failed",
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
      "id, order_number, created_at, updated_at, paid_at, refunded_at, shipped_at, customer_email, customer_name, shipping_address, currency, subtotal_cents, production_option_id, production_option_name, production_max_business_days, production_cents, production_due_date, expedited_capacity_state, fulfillment_method, fulfillment_option_id, fulfillment_option_name, pickup_location, stripe_shipping_rate_id, shipping_cents, tax_cents, total_cents, amount_refunded_cents, payment_status, fulfillment_status, inventory_state, inventory_reserved_until, inventory_committed_at, inventory_released_at, inventory_release_reason, receipt_url, receipt_number, checkout_session_id, payment_intent_id, charge_id, payment_livemode, dispute_id, dispute_status, dispute_updated_at, tracking_number, tracking_url, internal_notes, store_order_items(id, sku, product_id, product_category, deck_id, product_name, unit_amount_cents, quantity, line_total_cents), store_refunds(id, provider_refund_id, amount_cents, currency, status, pending_reason, failure_reason, provider_created_at, provider_updated_at)"
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
