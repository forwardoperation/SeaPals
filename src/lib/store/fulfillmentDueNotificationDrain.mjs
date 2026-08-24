import {
  deliverFulfillmentDueReminderNotification,
  FULFILLMENT_DUE_NOTIFICATION_TYPE,
  FulfillmentDueReminderError,
} from "./fulfillmentDueReminder.mjs";

const NOTIFICATION_LEASE_SECONDS = 300;
const DEFAULT_BATCH_LIMIT = 25;
const MAX_BATCH_LIMIT = 50;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STORE_TIMEOUT_MS = 30_000;
const ORDER_SELECT =
  "id,order_number,paid_at,production_option_id,production_max_business_days,production_due_date,fulfillment_method,payment_status,fulfillment_status,payment_livemode";

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function reminderError(message, code, cause) {
  return new FulfillmentDueReminderError(message, { code, cause });
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

function isDateOnly(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function normalizeNow(now) {
  const parsed = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(parsed.valueOf())) {
    throw reminderError(
      "The fulfillment-due reminder clock is invalid.",
      "fulfillment_due_notification_now_invalid"
    );
  }
  return parsed.toISOString();
}

function readConfiguration(environment) {
  const orderNotificationsEnabled =
    safeString(environment.STORE_ORDER_NOTIFICATION_ENABLED).toLowerCase() ===
    "true";
  const dueNotificationsEnabled =
    safeString(
      environment.STORE_FULFILLMENT_DUE_NOTIFICATION_ENABLED
    ).toLowerCase() === "true";
  const resendKey = safeString(environment.RESEND_API_KEY);
  const sender = emailAddress(environment.EMAIL_FROM);
  const recipient = emailAddress(environment.STORE_ORDER_NOTIFICATION_EMAIL);
  const serviceRoleKey = safeString(environment.SUPABASE_SERVICE_ROLE_KEY);
  let supabaseUrl = null;
  try {
    const parsed = new URL(safeString(environment.NEXT_PUBLIC_SUPABASE_URL));
    if (parsed.protocol === "https:") supabaseUrl = parsed.origin;
  } catch {
    // Report a fixed configuration error below without echoing the value.
  }

  if (
    !orderNotificationsEnabled ||
    !dueNotificationsEnabled ||
    !/^re_[A-Za-z0-9_-]{8,}$/.test(resendKey) ||
    !sender ||
    !recipient
  ) {
    throw reminderError(
      "Fulfillment-due reminder delivery is not configured.",
      "fulfillment_due_notification_not_configured"
    );
  }
  if (!supabaseUrl || serviceRoleKey.length < 20) {
    throw reminderError(
      "Fulfillment-due reminder storage is not configured.",
      "fulfillment_due_notification_store_not_configured"
    );
  }

  return { serviceRoleKey, supabaseUrl };
}

async function readJsonResponse(response, code) {
  if (!response?.ok) {
    throw reminderError(
      "The fulfillment-due reminder store rejected a request.",
      code
    );
  }
  try {
    return await response.json();
  } catch (error) {
    throw reminderError(
      "The fulfillment-due reminder store returned an invalid response.",
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
        signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw reminderError(
        "The fulfillment-due reminder store could not be reached.",
        errorCode,
        error
      );
    }
    return readJsonResponse(response, errorCode);
  }

  return {
    async prepare({ limit, nowIso }) {
      const rows = await rpc(
        "prepare_store_fulfillment_due_notifications",
        { p_limit: limit, p_now: nowIso },
        "fulfillment_due_notification_prepare_failed"
      );
      if (!Array.isArray(rows)) {
        throw reminderError(
          "The fulfillment-due reminder queue returned an invalid list.",
          "fulfillment_due_notification_prepare_invalid"
        );
      }

      const notifications = rows.map((row) => ({
        orderId: safeString(row?.order_id),
        dueDate: safeString(row?.due_date),
      }));
      if (
        notifications.some(
          ({ orderId, dueDate }) =>
            !UUID_PATTERN.test(orderId) || !isDateOnly(dueDate)
        )
      ) {
        throw reminderError(
          "The fulfillment-due reminder queue returned an invalid order.",
          "fulfillment_due_notification_prepare_invalid"
        );
      }

      const unique = new Map();
      for (const notification of notifications) {
        unique.set(
          `${notification.orderId}:${notification.dueDate}`,
          notification
        );
      }
      return [...unique.values()];
    },

    claim({ orderId, claimToken }) {
      return rpc(
        "claim_store_order_notification",
        {
          p_order_id: orderId,
          p_notification_type: FULFILLMENT_DUE_NOTIFICATION_TYPE,
          p_claim_token: claimToken,
          p_lease_seconds: NOTIFICATION_LEASE_SECONDS,
        },
        "fulfillment_due_notification_claim_failed"
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
          { headers, signal: AbortSignal.timeout(STORE_TIMEOUT_MS) }
        );
      } catch (error) {
        throw reminderError(
          "The order could not be loaded for a fulfillment-due reminder.",
          "fulfillment_due_notification_order_load_failed",
          error
        );
      }
      const rows = await readJsonResponse(
        response,
        "fulfillment_due_notification_order_load_failed"
      );
      if (!Array.isArray(rows) || rows.length !== 1) {
        throw reminderError(
          "The order could not be loaded for a fulfillment-due reminder.",
          "fulfillment_due_notification_order_load_failed"
        );
      }
      return rows[0];
    },

    complete({ orderId, claimToken, providerMessageId }) {
      return rpc(
        "complete_store_order_notification",
        {
          p_order_id: orderId,
          p_notification_type: FULFILLMENT_DUE_NOTIFICATION_TYPE,
          p_claim_token: claimToken,
          p_provider_message_id: providerMessageId,
        },
        "fulfillment_due_notification_complete_failed"
      );
    },

    release({ orderId, claimToken, failureCode }) {
      return rpc(
        "release_store_order_notification",
        {
          p_order_id: orderId,
          p_notification_type: FULFILLMENT_DUE_NOTIFICATION_TYPE,
          p_claim_token: claimToken,
          p_failure_code: failureCode,
        },
        "fulfillment_due_notification_release_failed"
      );
    },
  };
}

export async function drainFulfillmentDueNotifications({
  environment = {},
  fetchImpl = globalThis.fetch,
  limit = DEFAULT_BATCH_LIMIT,
  now = new Date(),
  currentTime = now,
} = {}) {
  if (
    safeString(
      environment.STORE_FULFILLMENT_DUE_NOTIFICATION_ENABLED
    ).toLowerCase() !== "true"
  ) {
    return {
      queued: 0,
      delivered: 0,
      alreadySent: 0,
      busy: 0,
      stale: 0,
      failed: 0,
      disabled: true,
    };
  }
  if (typeof fetchImpl !== "function") {
    throw reminderError(
      "Fulfillment-due reminder delivery is unavailable.",
      "fulfillment_due_notification_transport_unavailable"
    );
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BATCH_LIMIT) {
    throw reminderError(
      "Fulfillment-due reminder batch size is invalid.",
      "fulfillment_due_notification_limit_invalid"
    );
  }

  const nowIso = normalizeNow(now);
  const configuration = readConfiguration(environment);
  const store = createStoreClient({ fetchImpl, ...configuration });
  const notifications = await store.prepare({ limit, nowIso });
  const summary = {
    queued: notifications.length,
    delivered: 0,
    alreadySent: 0,
    busy: 0,
    stale: 0,
    failed: 0,
  };
  const failures = [];

  for (const { orderId, dueDate } of notifications) {
    try {
      const result = await deliverFulfillmentDueReminderNotification({
        orderId,
        dueDate,
        environment,
        fetchImpl,
        claim: (arguments_) => store.claim(arguments_),
        loadOrder: (arguments_) => store.loadOrder(arguments_),
        complete: (arguments_) => store.complete(arguments_),
        release: (arguments_) => store.release(arguments_),
        now: currentTime,
      });
      if (result?.delivered) summary.delivered += 1;
      else if (result?.status === "stale") summary.stale += 1;
      else summary.alreadySent += 1;
    } catch (error) {
      if (
        error?.code === "fulfillment_due_notification_busy" ||
        error?.code === "merchant_notification_busy"
      ) {
        summary.busy += 1;
        continue;
      }
      summary.failed += 1;
      failures.push(error);
    }
  }

  if (failures.length) {
    const error = reminderError(
      "One or more fulfillment-due reminders could not be delivered.",
      "fulfillment_due_notification_drain_partial_failure",
      failures[0]
    );
    error.summary = summary;
    throw error;
  }

  return summary;
}
