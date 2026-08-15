import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  deliverMerchantPurchaseNotification,
  MerchantOrderNotificationError,
} from "@/lib/store/merchantOrderEmail.mjs";

const ORDER_NOTIFICATION_TYPE = "merchant_purchase";
const ORDER_NOTIFICATION_LEASE_SECONDS = 300;
const ORDER_NOTIFICATION_SELECT =
  "id, order_number, paid_at, customer_email, customer_name, shipping_address, currency, subtotal_cents, production_option_id, production_option_name, production_max_business_days, production_cents, production_due_date, fulfillment_method, fulfillment_option_id, fulfillment_option_name, pickup_location, shipping_cents, tax_cents, total_cents, payment_livemode, store_order_items(sku, product_name, unit_amount_cents, quantity, line_total_cents)";

function notificationError(message, code, cause) {
  return new MerchantOrderNotificationError(message, { code, cause });
}

function validUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
    ? value
    : null;
}

async function resolvePaidOrderId(supabase, details) {
  const metadataOrderId = validUuid(details?.orderId);
  if (metadataOrderId) return metadataOrderId;

  const references = [
    ["checkout_session_id", details?.checkoutSessionId],
    ["payment_intent_id", details?.paymentIntentId],
    ["charge_id", details?.chargeId],
  ].filter(([, value]) => typeof value === "string" && value.length > 0);

  const results = await Promise.all(
    references.map(([column, value]) =>
      supabase.from("store_orders").select("id").eq(column, value).limit(2)
    )
  );
  if (results.some((result) => result.error)) {
    throw notificationError(
      "The paid order notification reference could not be resolved.",
      "merchant_notification_order_lookup_failed",
      results.find((result) => result.error)?.error
    );
  }

  const orderIds = new Set(
    results
      .flatMap((result) => result.data ?? [])
      .map((row) => validUuid(row?.id))
      .filter(Boolean)
  );
  if (orderIds.size !== 1) {
    throw notificationError(
      "The paid order notification reference is missing or conflicting.",
      orderIds.size > 1
        ? "merchant_notification_order_conflict"
        : "merchant_notification_order_missing"
    );
  }
  return [...orderIds][0];
}

async function claimNotification(supabase, { orderId, claimToken }) {
  const { data, error } = await supabase.rpc("claim_store_order_notification", {
    p_order_id: orderId,
    p_notification_type: ORDER_NOTIFICATION_TYPE,
    p_claim_token: claimToken,
    p_lease_seconds: ORDER_NOTIFICATION_LEASE_SECONDS,
  });
  if (error) {
    throw notificationError(
      "The merchant notification could not be claimed.",
      "merchant_notification_claim_failed",
      error
    );
  }
  return typeof data === "string" ? data : null;
}

async function loadNotificationOrder(supabase, { orderId }) {
  const { data, error } = await supabase
    .from("store_orders")
    .select(ORDER_NOTIFICATION_SELECT)
    .eq("id", orderId)
    .single();
  if (error || !data) {
    throw notificationError(
      "The paid order could not be loaded for merchant notification.",
      "merchant_notification_order_load_failed",
      error
    );
  }
  return data;
}

async function completeNotification(
  supabase,
  { orderId, claimToken, providerMessageId }
) {
  const { data, error } = await supabase.rpc(
    "complete_store_order_notification",
    {
      p_order_id: orderId,
      p_notification_type: ORDER_NOTIFICATION_TYPE,
      p_claim_token: claimToken,
      p_provider_message_id: providerMessageId,
    }
  );
  if (error) {
    throw notificationError(
      "The merchant notification delivery could not be recorded.",
      "merchant_notification_complete_failed",
      error
    );
  }
  return data === true;
}

async function releaseNotification(
  supabase,
  { orderId, claimToken, failureCode }
) {
  const { data, error } = await supabase.rpc(
    "release_store_order_notification",
    {
      p_order_id: orderId,
      p_notification_type: ORDER_NOTIFICATION_TYPE,
      p_claim_token: claimToken,
      p_failure_code: failureCode,
    }
  );
  if (error) {
    throw notificationError(
      "The merchant notification retry could not be released.",
      "merchant_notification_release_failed",
      error
    );
  }
  return data === true;
}

export async function deliverPaidStoreOrderMerchantNotification(
  details,
  { environment = process.env, fetchImpl = globalThis.fetch } = {}
) {
  if (details?.paymentStatus !== "paid") {
    return { status: "not_applicable", delivered: false };
  }

  const supabase = createSupabaseAdmin();
  const orderId = await resolvePaidOrderId(supabase, details);
  return deliverMerchantPurchaseNotification({
    orderId,
    environment,
    fetchImpl,
    claim: (arguments_) => claimNotification(supabase, arguments_),
    loadOrder: (arguments_) => loadNotificationOrder(supabase, arguments_),
    complete: (arguments_) => completeNotification(supabase, arguments_),
    release: (arguments_) => releaseNotification(supabase, arguments_),
  });
}
