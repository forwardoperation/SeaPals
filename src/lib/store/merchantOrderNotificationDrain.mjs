import {
  deliverMerchantPurchaseNotification,
  MerchantOrderNotificationError,
} from "./merchantOrderEmail.mjs";

const ORDER_NOTIFICATION_TYPE = "merchant_purchase";
const ORDER_NOTIFICATION_LEASE_SECONDS = 300;
const DEFAULT_BATCH_LIMIT = 25;
const MAX_BATCH_LIMIT = 50;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_SELECT =
  "id,order_number,paid_at,customer_email,customer_name,shipping_address,currency,subtotal_cents,production_option_id,production_option_name,production_max_business_days,production_cents,production_due_date,fulfillment_method,fulfillment_option_id,fulfillment_option_name,pickup_location,shipping_cents,tax_cents,total_cents,payment_livemode,store_order_items(sku,product_name,unit_amount_cents,quantity,line_total_cents)";

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function notificationError(message, code, cause) {
  return new MerchantOrderNotificationError(message, { code, cause });
}

function emailAddress(value) {
  const header = safeString(value);
  if (!header || header.length > 500 || /[\r\n]/.test(header)) return null;
  const angleAddress = /<([^<>]+)>$/.exec(header)?.[1]?.trim();
  const address = angleAddress ?? header;
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)
    ? address
    : null;
}

function readConfiguration(environment) {
  const enabled =
    safeString(environment.STORE_ORDER_NOTIFICATION_ENABLED).toLowerCase() ===
    "true";
  const resendKey = safeString(environment.RESEND_API_KEY);
  const sender = emailAddress(environment.EMAIL_FROM);
  const recipient = emailAddress(environment.STORE_ORDER_NOTIFICATION_EMAIL);
  const serviceRoleKey = safeString(environment.SUPABASE_SERVICE_ROLE_KEY);
  let supabaseUrl = null;
  try {
    const parsed = new URL(safeString(environment.NEXT_PUBLIC_SUPABASE_URL));
    if (parsed.protocol === "https:") supabaseUrl = parsed.origin;
  } catch {
    // A fixed configuration error is reported below without echoing the value.
  }

  if (
    !enabled ||
    !/^re_[A-Za-z0-9_-]{8,}$/.test(resendKey) ||
    !sender ||
    !recipient
  ) {
    throw notificationError(
      "Merchant purchase-alert delivery is not configured.",
      "merchant_email_not_configured"
    );
  }
  if (!supabaseUrl || serviceRoleKey.length < 20) {
    throw notificationError(
      "Merchant purchase-alert storage is not configured.",
      "merchant_notification_store_not_configured"
    );
  }

  return { serviceRoleKey, supabaseUrl };
}

async function readJsonResponse(response, code) {
  if (!response?.ok) {
    throw notificationError(
      "The merchant purchase-alert store rejected a request.",
      code
    );
  }
  try {
    return await response.json();
  } catch (error) {
    throw notificationError(
      "The merchant purchase-alert store returned an invalid response.",
      code,
      error
    );
  }
}

function createStoreClient({ fetchImpl, serviceRoleKey, supabaseUrl }) {
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  async function rpc(name, body, errorCode) {
    let response;
    try {
      response = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw notificationError(
        "The merchant purchase-alert store could not be reached.",
        errorCode,
        error
      );
    }
    return readJsonResponse(response, errorCode);
  }

  return {
    async listPending(limit) {
      const rows = await rpc(
        "list_pending_store_order_notifications",
        { p_limit: limit },
        "merchant_notification_list_failed"
      );
      if (!Array.isArray(rows)) {
        throw notificationError(
          "The merchant purchase-alert queue returned an invalid list.",
          "merchant_notification_list_invalid"
        );
      }
      const orderIds = rows.map((row) => safeString(row?.order_id));
      if (orderIds.some((orderId) => !UUID_PATTERN.test(orderId))) {
        throw notificationError(
          "The merchant purchase-alert queue returned an invalid order.",
          "merchant_notification_list_invalid"
        );
      }
      return [...new Set(orderIds)];
    },

    claim({ orderId, claimToken }) {
      return rpc(
        "claim_store_order_notification",
        {
          p_order_id: orderId,
          p_notification_type: ORDER_NOTIFICATION_TYPE,
          p_claim_token: claimToken,
          p_lease_seconds: ORDER_NOTIFICATION_LEASE_SECONDS,
        },
        "merchant_notification_claim_failed"
      );
    },

    async loadOrder({ orderId }) {
      const query = new URLSearchParams({
        select: ORDER_SELECT,
        id: `eq.${orderId}`,
        limit: "2",
      });
      let response;
      try {
        response = await fetchImpl(
          `${supabaseUrl}/rest/v1/store_orders?${query.toString()}`,
          { headers }
        );
      } catch (error) {
        throw notificationError(
          "The paid order could not be loaded for merchant notification.",
          "merchant_notification_order_load_failed",
          error
        );
      }
      const rows = await readJsonResponse(
        response,
        "merchant_notification_order_load_failed"
      );
      if (!Array.isArray(rows) || rows.length !== 1) {
        throw notificationError(
          "The paid order could not be loaded for merchant notification.",
          "merchant_notification_order_load_failed"
        );
      }
      return rows[0];
    },

    complete({ orderId, claimToken, providerMessageId }) {
      return rpc(
        "complete_store_order_notification",
        {
          p_order_id: orderId,
          p_notification_type: ORDER_NOTIFICATION_TYPE,
          p_claim_token: claimToken,
          p_provider_message_id: providerMessageId,
        },
        "merchant_notification_complete_failed"
      );
    },

    release({ orderId, claimToken, failureCode }) {
      return rpc(
        "release_store_order_notification",
        {
          p_order_id: orderId,
          p_notification_type: ORDER_NOTIFICATION_TYPE,
          p_claim_token: claimToken,
          p_failure_code: failureCode,
        },
        "merchant_notification_release_failed"
      );
    },
  };
}

export async function drainMerchantPurchaseNotifications({
  environment = {},
  fetchImpl = globalThis.fetch,
  limit = DEFAULT_BATCH_LIMIT,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw notificationError(
      "Merchant purchase-alert delivery is unavailable.",
      "merchant_notification_transport_unavailable"
    );
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BATCH_LIMIT) {
    throw notificationError(
      "Merchant purchase-alert batch size is invalid.",
      "merchant_notification_limit_invalid"
    );
  }

  const configuration = readConfiguration(environment);
  const store = createStoreClient({ fetchImpl, ...configuration });
  const orderIds = await store.listPending(limit);
  const summary = {
    queued: orderIds.length,
    delivered: 0,
    alreadySent: 0,
    busy: 0,
    failed: 0,
  };
  const failures = [];

  for (const orderId of orderIds) {
    try {
      const result = await deliverMerchantPurchaseNotification({
        orderId,
        environment,
        fetchImpl,
        claim: (arguments_) => store.claim(arguments_),
        loadOrder: (arguments_) => store.loadOrder(arguments_),
        complete: (arguments_) => store.complete(arguments_),
        release: (arguments_) => store.release(arguments_),
      });
      if (result.delivered) summary.delivered += 1;
      else summary.alreadySent += 1;
    } catch (error) {
      if (error?.code === "merchant_notification_busy") {
        summary.busy += 1;
        continue;
      }
      summary.failed += 1;
      failures.push(error);
    }
  }

  if (failures.length) {
    const error = notificationError(
      "One or more merchant purchase alerts could not be delivered.",
      "merchant_notification_drain_partial_failure",
      failures[0]
    );
    error.summary = summary;
    throw error;
  }

  return summary;
}
