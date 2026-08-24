import { PUBLIC_SUPPORT_EMAIL } from "../siteIdentity.mjs";
import { merchantOrderAdminUrl } from "./merchantOrderEmail.mjs";

const DEFAULT_MERCHANT_EMAIL = PUBLIC_SUPPORT_EMAIL;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PROVIDER_TIMEOUT_MS = 30_000;
const SHIPPING_COMPLETE_STATUSES = new Set([
  "awaiting_shipment",
  "shipped",
  "cancelled",
]);
const PICKUP_COMPLETE_STATUSES = new Set([
  "ready_for_pickup",
  "picked_up",
  "cancelled",
]);

export const FULFILLMENT_DUE_NOTIFICATION_TYPE = "merchant_fulfillment_due";

export class FulfillmentDueReminderError extends Error {
  constructor(
    message,
    { code = "fulfillment_due_notification_failed", cause } = {}
  ) {
    super(message, { cause });
    this.name = "FulfillmentDueReminderError";
    this.code = code;
  }
}

function safeText(value, fallback = "") {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
}

function normalizedDateOnly(value) {
  const normalized = safeText(value);
  if (!DATE_ONLY_PATTERN.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toISOString().slice(0, 10) === normalized ? normalized : null;
}

function easternDateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value: partValue }) => [type, partValue])
  );
  return normalizedDateOnly(`${values.year}-${values.month}-${values.day}`);
}

function easternClock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value: partValue }) => [type, partValue])
  );
  const dateOnly = normalizedDateOnly(
    `${values.year}-${values.month}-${values.day}`
  );
  const hour = Number(values.hour);
  const minute = Number(values.minute);
  if (
    !dateOnly ||
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return { dateOnly, minutes: hour * 60 + minute };
}

function addWeekdays(dateOnly, count) {
  const date = new Date(`${dateOnly}T12:00:00.000Z`);
  let remaining = count;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}

function previousWeekday(dateOnly) {
  const date = new Date(`${dateOnly}T12:00:00.000Z`);
  do {
    date.setUTCDate(date.getUTCDate() - 1);
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return date.toISOString().slice(0, 10);
}

function requiredDueDate(value) {
  const dueDate = normalizedDateOnly(value);
  if (!dueDate) {
    throw new FulfillmentDueReminderError(
      "The fulfillment reminder due date is invalid.",
      { code: "fulfillment_due_notification_due_date_invalid" }
    );
  }
  return dueDate;
}

function requiredOrderId(value) {
  const orderId = safeText(value);
  if (!UUID_PATTERN.test(orderId)) {
    throw new FulfillmentDueReminderError(
      "The fulfillment reminder order reference is invalid.",
      { code: "fulfillment_due_notification_order_invalid" }
    );
  }
  return orderId;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDueDate(value) {
  const dueDate = requiredDueDate(value);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${dueDate}T12:00:00.000Z`));
}

function fulfillmentMethod(order) {
  return safeText(order?.fulfillment_method).toLowerCase();
}

function fulfillmentStatus(order) {
  return safeText(order?.fulfillment_status, "unfulfilled").toLowerCase();
}

function requiredAction(method) {
  return method === "pickup"
    ? "Ready for pickup"
    : "Awaiting shipment (ready to ship)";
}

function validReminderOrder(order) {
  return Boolean(
    order &&
      typeof order === "object" &&
      UUID_PATTERN.test(safeText(order.id)) &&
      safeText(order.order_number) &&
      ["shipping", "pickup"].includes(fulfillmentMethod(order))
  );
}

export function fulfillmentDueDateForOrder(order) {
  const productionOption = safeText(order?.production_option_id).toLowerCase();
  if (productionOption === "standard-production") {
    const businessDays = Number(order?.production_max_business_days);
    const paidDate = easternDateOnly(order?.paid_at);
    if (
      !paidDate ||
      !Number.isSafeInteger(businessDays) ||
      businessDays < 1 ||
      businessDays > 30
    ) {
      return null;
    }
    return addWeekdays(paidDate, businessDays);
  }
  return normalizedDateOnly(order?.production_due_date);
}

/**
 * Rechecks mutable order state immediately before delivery. This function is
 * intentionally pure so the scheduled drainer and tests can use the same
 * eligibility contract without any provider or database access.
 */
export function isFulfillmentDueReminderEligible(order, dueDate) {
  const expectedDueDate = normalizedDateOnly(dueDate);
  if (!expectedDueDate || !validReminderOrder(order)) return false;
  if (fulfillmentDueDateForOrder(order) !== expectedDueDate) {
    return false;
  }
  if (safeText(order.payment_status).toLowerCase() !== "paid") return false;
  if (order.payment_livemode !== true) return false;

  const method = fulfillmentMethod(order);
  const status = fulfillmentStatus(order);
  if (method === "pickup") return !PICKUP_COMPLETE_STATUSES.has(status);
  return !SHIPPING_COMPLETE_STATUSES.has(status);
}

export function isFulfillmentDueReminderInWindow(dueDate, now = new Date()) {
  const normalizedDueDate = normalizedDateOnly(dueDate);
  const clock = easternClock(now);
  if (!normalizedDueDate || !clock) return false;

  const reminderDate = previousWeekday(normalizedDueDate);
  if (clock.dateOnly < reminderDate || clock.dateOnly > normalizedDueDate) {
    return false;
  }
  return clock.dateOnly > reminderDate || clock.minutes >= 9 * 60;
}

export function fulfillmentDueReminderIdempotencyKey(orderId, dueDate) {
  const id = requiredOrderId(orderId);
  const date = requiredDueDate(dueDate);
  return `seapals-${FULFILLMENT_DUE_NOTIFICATION_TYPE}-${id}-${date}`;
}

export function buildFulfillmentDueReminderEmail(
  order,
  dueDate,
  environment = {}
) {
  if (!validReminderOrder(order)) {
    throw new FulfillmentDueReminderError(
      "The order could not be prepared for a fulfillment reminder.",
      { code: "fulfillment_due_notification_order_invalid" }
    );
  }

  const normalizedDueDate = requiredDueDate(dueDate);
  const dueDateLabel = formatDueDate(normalizedDueDate);
  const method = fulfillmentMethod(order);
  const pickup = method === "pickup";
  const action = requiredAction(method);
  const orderNumber = safeText(order.order_number);
  const adminUrl = merchantOrderAdminUrl(order.id, environment);
  const testPrefix = order.payment_livemode === true ? "" : "[TEST] ";
  const subject = `${testPrefix}SeaPals order ${orderNumber} is due ${dueDateLabel}`
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);

  const text = [
    "SeaPals fulfillment reminder",
    "",
    `Order: ${orderNumber}`,
    `Due date: ${dueDateLabel}`,
    `Required action: ${action}`,
    "",
    `Open the private order workspace: ${adminUrl}`,
  ].join("\n");

  const html = `<!doctype html>
  <html><body style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
    <div style="max-width:680px;margin:0 auto">
      <h1 style="color:#b45309">Fulfillment due reminder</h1>
      <p>Order <strong>${escapeHtml(orderNumber)}</strong> is approaching its fulfillment date and still needs attention.</p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 8px;font-weight:bold">Due date</td><td style="padding:6px 8px">${escapeHtml(
          dueDateLabel
        )}</td></tr>
        <tr><td style="padding:6px 8px;font-weight:bold">Required action</td><td style="padding:6px 8px">${escapeHtml(
          action
        )}</td></tr>
      </table>
      <p style="margin-top:24px"><a href="${escapeHtml(
        adminUrl
      )}" style="display:inline-block;background:#0369a1;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Open private order workspace</a></p>
    </div>
  </body></html>`;

  return {
    subject,
    text,
    html,
    adminUrl,
    action,
    pickup,
    dueDate: normalizedDueDate,
  };
}

function headerValue(value, name) {
  const normalized = safeText(value);
  if (!normalized || normalized.length > 500 || /[\r\n]/.test(normalized)) {
    throw new FulfillmentDueReminderError(
      `Fulfillment reminder ${name} is not configured.`,
      { code: "fulfillment_due_email_not_configured" }
    );
  }
  return normalized;
}

function notificationsEnabled(environment) {
  return (
    safeText(environment.STORE_ORDER_NOTIFICATION_ENABLED).toLowerCase() ===
      "true" &&
    safeText(
      environment.STORE_FULFILLMENT_DUE_NOTIFICATION_ENABLED
    ).toLowerCase() === "true"
  );
}

export async function sendFulfillmentDueReminderEmail({
  order,
  dueDate,
  environment = {},
  fetchImpl = globalThis.fetch,
}) {
  if (!notificationsEnabled(environment)) {
    throw new FulfillmentDueReminderError(
      "Fulfillment due reminders are not enabled.",
      { code: "fulfillment_due_email_not_enabled" }
    );
  }

  const apiKey = headerValue(environment.RESEND_API_KEY, "provider");
  const from = headerValue(environment.EMAIL_FROM, "sender");
  const to = headerValue(
    environment.STORE_ORDER_NOTIFICATION_EMAIL || DEFAULT_MERCHANT_EMAIL,
    "recipient"
  );
  if (typeof fetchImpl !== "function") {
    throw new FulfillmentDueReminderError(
      "Fulfillment reminder delivery is unavailable.",
      { code: "fulfillment_due_email_transport_unavailable" }
    );
  }

  const email = buildFulfillmentDueReminderEmail(order, dueDate, environment);
  const idempotencyKey = fulfillmentDueReminderIdempotencyKey(
    order.id,
    dueDate
  );
  let response;
  try {
    response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      body: JSON.stringify({
        from,
        to,
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    });
  } catch (error) {
    throw new FulfillmentDueReminderError(
      "The fulfillment reminder provider could not be reached.",
      { code: "resend_network_error", cause: error }
    );
  }

  if (!response?.ok) {
    const status = Number(response?.status);
    throw new FulfillmentDueReminderError(
      "The fulfillment reminder provider rejected the request.",
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
    // A 2xx response confirms that Resend accepted the idempotent request.
  }

  return { providerMessageId, idempotencyKey };
}

export async function deliverFulfillmentDueReminderNotification({
  orderId,
  dueDate,
  environment = {},
  fetchImpl = globalThis.fetch,
  claim,
  loadOrder,
  complete,
  release,
  now = new Date(),
  claimToken = globalThis.crypto.randomUUID(),
}) {
  const id = requiredOrderId(orderId);
  const date = requiredDueDate(dueDate);
  const status = await claim({ orderId: id, dueDate: date, claimToken });
  if (status === "sent") return { status: "sent", delivered: false };
  if (status === "busy") {
    throw new FulfillmentDueReminderError(
      "The fulfillment reminder is already being delivered.",
      { code: "fulfillment_due_notification_busy" }
    );
  }
  if (status !== "claimed") {
    throw new FulfillmentDueReminderError(
      "The fulfillment due reminder is not queued.",
      { code: "fulfillment_due_notification_missing" }
    );
  }

  try {
    const order = await loadOrder({ orderId: id, dueDate: date });
    const matchesClaimedOrder = safeText(order?.id) === id;
    const deliveryTime = typeof now === "function" ? now() : now;
    if (
      !matchesClaimedOrder ||
      !isFulfillmentDueReminderEligible(order, date) ||
      !isFulfillmentDueReminderInWindow(date, deliveryTime)
    ) {
      const completed = await complete({
        orderId: id,
        dueDate: date,
        claimToken,
        providerMessageId: null,
      });
      if (!completed) {
        throw new FulfillmentDueReminderError(
          "The stale fulfillment reminder could not be completed.",
          { code: "fulfillment_due_notification_completion_conflict" }
        );
      }
      return { status: "stale", delivered: false };
    }

    const delivery = await sendFulfillmentDueReminderEmail({
      order,
      dueDate: date,
      environment,
      fetchImpl,
    });
    const completed = await complete({
      orderId: id,
      dueDate: date,
      claimToken,
      providerMessageId: delivery.providerMessageId,
    });
    if (!completed) {
      throw new FulfillmentDueReminderError(
        "The fulfillment reminder delivery could not be confirmed.",
        { code: "fulfillment_due_notification_completion_conflict" }
      );
    }
    return { status: "sent", delivered: true };
  } catch (error) {
    const code = safeText(
      error?.code,
      "fulfillment_due_notification_failed"
    ).slice(0, 100);
    try {
      await release({
        orderId: id,
        dueDate: date,
        claimToken,
        failureCode: code,
      });
    } catch {
      // A failed release remains retryable when the bounded claim lease expires.
    }
    throw error;
  }
}
