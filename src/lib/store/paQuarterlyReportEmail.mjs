import { CANONICAL_SITE_ORIGIN } from "../siteIdentity.mjs";
import { paQuarterPeriod } from "./paSalesTaxReturn.mjs";

const PA_TIME_ZONE = "America/New_York";
const REPORT_READY_HOUR = 9;
const PROVIDER_TIMEOUT_MS = 30_000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const QUARTER_END_MONTH_DAYS = ["03-31", "06-30", "09-30", "12-31"];

export const PA_QUARTERLY_REPORT_NOTIFICATION_TYPE =
  "pa_quarterly_report_ready";

export const PA_QUARTERLY_REPORT_STATUSES = Object.freeze({
  READY: "ready",
  NEEDS_ATTENTION: "needs_attention",
});

export class PaQuarterlyReportEmailError extends Error {
  constructor(
    message,
    { code = "pa_quarterly_report_email_failed", cause } = {}
  ) {
    super(message, { cause });
    this.name = "PaQuarterlyReportEmailError";
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
  const date = new Date(`${normalized}T12:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toISOString().slice(0, 10) === normalized ? normalized : null;
}

function dateOnlyFromUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

function utcDateFromDateOnly(dateOnly) {
  return new Date(`${dateOnly}T12:00:00.000Z`);
}

function isWeekend(date) {
  return date.getUTCDay() === 0 || date.getUTCDay() === 6;
}

function isNewYearsDayOrObserved(date) {
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  if (month === 0 && day === 1) return true;

  if (month === 0 && day === 2) {
    const newYearsDay = new Date(Date.UTC(date.getUTCFullYear(), 0, 1, 12));
    return newYearsDay.getUTCDay() === 0;
  }

  if (month === 11 && day === 31) {
    const nextNewYearsDay = new Date(
      Date.UTC(date.getUTCFullYear() + 1, 0, 1, 12)
    );
    return nextNewYearsDay.getUTCDay() === 6;
  }

  return false;
}

function isBusinessDay(date) {
  return !isWeekend(date) && !isNewYearsDayOrObserved(date);
}

function reportReadyBusinessDate(dateOnly) {
  const date = utcDateFromDateOnly(dateOnly);
  // Leave a full calendar day after quarter close for the signed Stripe
  // webhook and the independent reservation reconciler to settle the final
  // transactions. If that second day is not a business day, roll forward.
  date.setUTCDate(date.getUTCDate() + 2);
  while (!isBusinessDay(date)) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return dateOnlyFromUtcDate(date);
}

function easternClock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new PaQuarterlyReportEmailError(
      "The Pennsylvania report eligibility time is invalid.",
      { code: "pa_quarterly_report_time_invalid" }
    );
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PA_TIME_ZONE,
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
    !Number.isInteger(minute)
  ) {
    throw new PaQuarterlyReportEmailError(
      "The Pennsylvania report eligibility time is invalid.",
      { code: "pa_quarterly_report_time_invalid" }
    );
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    dateOnly,
    minutes: hour * 60 + minute,
  };
}

function previousQuarterEndForMonth(year, month) {
  const currentQuarterIndex = Math.floor((month - 1) / 3);
  if (currentQuarterIndex === 0) return `${year - 1}-12-31`;
  return `${year}-${QUARTER_END_MONTH_DAYS[currentQuarterIndex - 1]}`;
}

function previousQuarterEnd(period) {
  const zeroBasedIndex = period.year * 4 + (period.quarter - 1) - 1;
  const year = Math.floor(zeroBasedIndex / 4);
  const quarterIndex = ((zeroBasedIndex % 4) + 4) % 4;
  return `${year}-${QUARTER_END_MONTH_DAYS[quarterIndex]}`;
}

function canonicalPeriod(periodOrEnd) {
  const periodEnd =
    typeof periodOrEnd === "string"
      ? periodOrEnd
      : safeText(periodOrEnd?.periodEnd);
  try {
    return paQuarterPeriod(periodEnd);
  } catch (cause) {
    throw new PaQuarterlyReportEmailError(
      "The Pennsylvania quarterly report period is invalid.",
      { code: "pa_quarterly_report_period_invalid", cause }
    );
  }
}

function easternLocalHourIso(dateOnly, hour) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new PaQuarterlyReportEmailError(
      "The Pennsylvania quarterly report schedule is invalid.",
      { code: "pa_quarterly_report_schedule_invalid" }
    );
  }

  const desiredUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    hour
  );
  let instant = desiredUtc;

  for (let pass = 0; pass < 3; pass += 1) {
    const represented = easternClock(new Date(instant));
    const [year, month, day] = represented.dateOnly.split("-").map(Number);
    const representedUtc = Date.UTC(
      year,
      month - 1,
      day,
      Math.floor(represented.minutes / 60),
      represented.minutes % 60
    );
    instant += desiredUtc - representedUtc;
  }

  return new Date(instant).toISOString();
}

export function paQuarterlyReportScheduledFor(periodOrEnd) {
  const period = canonicalPeriod(periodOrEnd);
  const readyDate = reportReadyBusinessDate(period.periodEnd);
  return easternLocalHourIso(readyDate, REPORT_READY_HOUR);
}

/**
 * Returns the newest closed Pennsylvania calendar quarter whose report-ready
 * window has opened. The new quarter becomes eligible at 9:00 AM Eastern on
 * the first business day on or after the second calendar day following its
 * period end.
 */
export function eligiblePaQuarterlyReportPeriod(now = new Date()) {
  const instant = new Date(now);
  const clock = easternClock(now);
  let period = canonicalPeriod(
    previousQuarterEndForMonth(clock.year, clock.month)
  );
  const ready =
    instant.valueOf() >= Date.parse(paQuarterlyReportScheduledFor(period));

  if (!ready) period = canonicalPeriod(previousQuarterEnd(period));
  return period;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateOnly) {
  const normalized = normalizedDateOnly(dateOnly);
  if (!normalized) {
    throw new PaQuarterlyReportEmailError(
      "The Pennsylvania quarterly report date is invalid.",
      { code: "pa_quarterly_report_period_invalid" }
    );
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${normalized}T12:00:00.000Z`));
}

function normalizedReportStatus(value) {
  const status = safeText(value).toLowerCase();
  if (["ready", "ready_for_review"].includes(status)) {
    return {
      code: PA_QUARTERLY_REPORT_STATUSES.READY,
      label: "Ready for review",
      needsAttention: false,
    };
  }
  if (["needs_attention", "review_required"].includes(status)) {
    return {
      code: PA_QUARTERLY_REPORT_STATUSES.NEEDS_ATTENTION,
      label: "Needs attention",
      needsAttention: true,
    };
  }
  throw new PaQuarterlyReportEmailError(
    "The Pennsylvania quarterly report status is invalid.",
    { code: "pa_quarterly_report_status_invalid" }
  );
}

function requiredIssueCount(value) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new PaQuarterlyReportEmailError(
      "The Pennsylvania quarterly report issue count is invalid.",
      { code: "pa_quarterly_report_issue_count_invalid" }
    );
  }
  return count;
}

function configuredOrigin(environment = {}) {
  try {
    const configured = new URL(
      safeText(environment.SITE_URL || environment.NEXT_PUBLIC_SITE_URL)
    );
    if (["http:", "https:"].includes(configured.protocol)) {
      return configured.origin;
    }
  } catch {
    // Use the canonical production origin when configuration is absent.
  }
  return CANONICAL_SITE_ORIGIN;
}

export function paQuarterlyReportAdminUrl(periodOrEnd, environment = {}) {
  const period = canonicalPeriod(periodOrEnd);
  const url = new URL("/admin/orders", configuredOrigin(environment));
  url.searchParams.set("paPeriodEnd", period.periodEnd);
  url.hash = "pa-sales-tax-filing";
  return url.toString();
}

export function paQuarterlyReportIdempotencyKey(periodOrEnd) {
  const period = canonicalPeriod(periodOrEnd);
  return `seapals-${PA_QUARTERLY_REPORT_NOTIFICATION_TYPE}-${period.periodEnd}`;
}

export function buildPaQuarterlyReportEmail(report, environment = {}) {
  const period = canonicalPeriod(report?.period);
  const status = normalizedReportStatus(report?.status);
  const issueCount = requiredIssueCount(report?.issueCount);
  const adminUrl = paQuarterlyReportAdminUrl(period, environment);
  const startDateLabel = formatDate(period.startDate);
  const periodEndLabel = formatDate(period.periodEnd);
  const dueDateLabel = formatDate(period.dueDate);
  const subject = `${
    status.needsAttention ? "Action required: " : ""
  }PA sales-tax report ready - ${period.label} - due ${dueDateLabel}`;
  const reviewLine = status.needsAttention
    ? "Review the flagged checks in the authenticated tax workspace before filing."
    : "No automated reconciliation checks are currently flagged.";

  const text = [
    "Pennsylvania sales-tax report ready",
    "",
    `Reporting period: ${startDateLabel} through ${periodEndLabel}`,
    `Filing and payment due: ${dueDateLabel}`,
    `Status: ${status.label}`,
    `Checks needing review: ${issueCount}`,
    "",
    reviewLine,
    "",
    "This is a preparation notice only. This system has not submitted a return or payment. Open the secure CSV workspace, reconcile the selected quarter, enter the identifiers that remain only in your browser, complete the review confirmations, and download the myPATH return CSV. Then upload it to myPATH, submit the return, complete any required payment by the due date, and retain the confirmation with your private tax records. A return is required even when there were no taxable transactions.",
    "",
    `Review and download the myPATH CSV: ${adminUrl}`,
  ].join("\n");

  const html = `<!doctype html>
  <html><body style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
    <div style="max-width:680px;margin:0 auto">
      <h1 style="color:${status.needsAttention ? "#b45309" : "#075985"}">Pennsylvania sales-tax report ready</h1>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 8px;font-weight:bold">Reporting period</td><td style="padding:6px 8px">${escapeHtml(
          `${startDateLabel} through ${periodEndLabel}`
        )}</td></tr>
        <tr><td style="padding:6px 8px;font-weight:bold">Filing and payment due</td><td style="padding:6px 8px">${escapeHtml(
          dueDateLabel
        )}</td></tr>
        <tr><td style="padding:6px 8px;font-weight:bold">Status</td><td style="padding:6px 8px">${escapeHtml(
          status.label
        )}</td></tr>
        <tr><td style="padding:6px 8px;font-weight:bold">Checks needing review</td><td style="padding:6px 8px">${issueCount}</td></tr>
      </table>
      <p>${escapeHtml(reviewLine)}</p>
      <p><strong>Preparation notice only:</strong> this system has not submitted a return or payment. Open the secure CSV workspace, reconcile the selected quarter, enter the identifiers that remain only in your browser, complete the review confirmations, and download the myPATH return CSV. Then upload it to myPATH, submit the return, complete any required payment by the due date, and retain the confirmation with your private tax records. A return is required even when there were no taxable transactions.</p>
      <p style="margin-top:24px"><a href="${escapeHtml(
        adminUrl
      )}" style="display:inline-block;background:#0369a1;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Review and download myPATH CSV</a></p>
    </div>
  </body></html>`;

  return {
    subject,
    text,
    html,
    adminUrl,
    period,
    status: status.code,
    issueCount,
  };
}

function headerValue(value, name) {
  const normalized = safeText(value);
  if (!normalized || normalized.length > 500 || /[\r\n]/.test(normalized)) {
    throw new PaQuarterlyReportEmailError(
      `Pennsylvania quarterly report email ${name} is not configured.`,
      { code: "pa_quarterly_report_email_not_configured" }
    );
  }
  return normalized;
}

export function paQuarterlyReportEmailPayload(report, environment = {}) {
  const from = headerValue(environment.EMAIL_FROM, "sender");
  const to = headerValue(environment.STORE_PA_TAX_REPORT_EMAIL, "recipient");
  const email = buildPaQuarterlyReportEmail(report, environment);
  return Object.freeze({
    from,
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}

export async function sendPaQuarterlyReportEmail({
  report,
  environment = {},
  fetchImpl = globalThis.fetch,
}) {
  if (
    safeText(environment.STORE_PA_TAX_REPORT_ENABLED).toLowerCase() !==
    "true"
  ) {
    throw new PaQuarterlyReportEmailError(
      "Pennsylvania quarterly report emails are not enabled.",
      { code: "pa_quarterly_report_email_not_enabled" }
    );
  }

  const apiKey = headerValue(environment.RESEND_API_KEY, "provider");
  if (typeof fetchImpl !== "function") {
    throw new PaQuarterlyReportEmailError(
      "Pennsylvania quarterly report email delivery is unavailable.",
      { code: "pa_quarterly_report_email_transport_unavailable" }
    );
  }

  const payload = paQuarterlyReportEmailPayload(report, environment);
  const idempotencyKey = paQuarterlyReportIdempotencyKey(report?.period);
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
      body: JSON.stringify(payload),
    });
  } catch (cause) {
    throw new PaQuarterlyReportEmailError(
      "The quarterly report email provider could not be reached.",
      { code: "resend_network_error", cause }
    );
  }

  if (!response?.ok) {
    const status = Number(response?.status);
    throw new PaQuarterlyReportEmailError(
      "The quarterly report email provider rejected the request.",
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
