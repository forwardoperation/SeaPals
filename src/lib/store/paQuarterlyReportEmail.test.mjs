import assert from "node:assert/strict";
import test from "node:test";

import {
  PA_QUARTERLY_REPORT_NOTIFICATION_TYPE,
  PA_QUARTERLY_REPORT_STATUSES,
  buildPaQuarterlyReportEmail,
  eligiblePaQuarterlyReportPeriod,
  paQuarterlyReportAdminUrl,
  paQuarterlyReportEmailPayload,
  paQuarterlyReportIdempotencyKey,
  paQuarterlyReportScheduledFor,
  sendPaQuarterlyReportEmail,
} from "./paQuarterlyReportEmail.mjs";
import { paQuarterPeriod } from "./paSalesTaxReturn.mjs";

const PERIOD = paQuarterPeriod("2026-09-30");

const configuredEnvironment = {
  STORE_PA_TAX_REPORT_ENABLED: "true",
  STORE_PA_TAX_REPORT_EMAIL: "tax-owner@seapalstcg.com",
  RESEND_API_KEY: "test-provider-secret",
  EMAIL_FROM: "SeaPals Orders <orders@seapalstcg.com>",
  SITE_URL: "https://seapalstcg.com/private/config/path?secret=ignored",
};

function safeReport(overrides = {}) {
  return {
    period: PERIOD,
    status: PA_QUARTERLY_REPORT_STATUSES.READY,
    issueCount: 0,
    ...overrides,
  };
}

test("a newly closed quarter becomes eligible after one full settlement day", () => {
  assert.equal(
    paQuarterlyReportScheduledFor("2026-09-30"),
    "2026-10-02T13:00:00.000Z"
  );
  assert.equal(
    eligiblePaQuarterlyReportPeriod("2026-10-02T12:59:59.999Z").periodEnd,
    "2026-06-30"
  );
  assert.equal(
    eligiblePaQuarterlyReportPeriod("2026-10-02T13:00:00.000Z").periodEnd,
    "2026-09-30"
  );
});

test("eligibility waits through weekends and the observed New Year's holiday", () => {
  assert.equal(
    paQuarterlyReportScheduledFor("2023-03-31"),
    "2023-04-03T13:00:00.000Z"
  );
  assert.equal(
    eligiblePaQuarterlyReportPeriod("2023-04-03T12:59:59.999Z").periodEnd,
    "2022-12-31",
    "Q1 2023 closed Friday and is not eligible before Monday at 9 AM Eastern"
  );
  assert.equal(
    eligiblePaQuarterlyReportPeriod("2023-04-03T13:00:00.000Z").periodEnd,
    "2023-03-31"
  );

  assert.equal(
    paQuarterlyReportScheduledFor("2022-12-31"),
    "2023-01-03T14:00:00.000Z"
  );
  assert.equal(
    eligiblePaQuarterlyReportPeriod("2023-01-03T13:59:59.999Z").periodEnd,
    "2022-09-30",
    "Q4 waits until Tuesday because January 2 observed the Sunday holiday"
  );
  assert.equal(
    eligiblePaQuarterlyReportPeriod("2023-01-03T14:00:00.000Z").periodEnd,
    "2022-12-31"
  );
});

test("invalid eligibility timestamps fail with a safe domain error", () => {
  assert.throws(
    () => eligiblePaQuarterlyReportPeriod("not-a-time"),
    (error) => error.code === "pa_quarterly_report_time_invalid"
  );
});

test("the report email contains only canonical period, status, issue count, and the authenticated workspace link", () => {
  const email = buildPaQuarterlyReportEmail(
    safeReport({
      status: "needs_attention",
      issueCount: 3,
      grossSalesCents: 987654321,
      salesLicenseId: "87654321",
      entityId: "123456789",
      customerEmail: "private-buyer@example.test",
      orderId: "00000000-0000-4000-8000-000000000099",
      paymentIntentId: "pi_private_123",
      attachment: "private-return.csv",
    }),
    configuredEnvironment
  );

  assert.match(
    email.subject,
    /^Action required: PA sales-tax report ready - Q3 2026 - due October 20, 2026$/
  );
  assert.match(
    email.text,
    /Reporting period: July 1, 2026 through September 30, 2026/
  );
  assert.match(email.text, /Status: Needs attention/);
  assert.match(email.text, /Checks needing review: 3/);
  assert.match(email.text, /has not submitted a return or payment/);
  assert.match(
    email.text,
    /https:\/\/seapalstcg\.com\/admin\/orders\?paPeriodEnd=2026-09-30#pa-sales-tax-filing/
  );
  assert.equal(
    email.adminUrl,
    "https://seapalstcg.com/admin/orders?paPeriodEnd=2026-09-30#pa-sales-tax-filing"
  );
  assert.match(email.text, /Review and download the myPATH CSV/);
  assert.match(email.html, />Review and download myPATH CSV<\/a>/);
  assert.equal(email.status, PA_QUARTERLY_REPORT_STATUSES.NEEDS_ATTENTION);

  for (const privateValue of [
    "987654321",
    "87654321",
    "123456789",
    "private-buyer@example.test",
    "00000000-0000-4000-8000-000000000099",
    "pi_private_123",
    "private-return.csv",
  ]) {
    assert.doesNotMatch(email.text, new RegExp(privateValue));
    assert.doesNotMatch(email.html, new RegExp(privateValue));
  }
  assert.doesNotMatch(email.text, /\$\d/);
  assert.doesNotMatch(email.html, /\$\d/);
});

test("ready status uses neutral review wording and canonicalizes the supplied period metadata", () => {
  const email = buildPaQuarterlyReportEmail(
    safeReport({
      period: { ...PERIOD, label: "Private label", dueDate: "2099-01-01" },
      status: "ready_for_review",
    }),
    configuredEnvironment
  );

  assert.equal(email.status, PA_QUARTERLY_REPORT_STATUSES.READY);
  assert.match(email.subject, /^PA sales-tax report ready - Q3 2026/);
  assert.match(email.text, /Status: Ready for review/);
  assert.match(email.text, /No automated reconciliation checks/);
  assert.doesNotMatch(email.text, /Private label|2099-01-01/);
});

test("admin URLs select only the canonical quarter and discard configured paths or credentials", () => {
  assert.equal(
    paQuarterlyReportAdminUrl(PERIOD, configuredEnvironment),
    "https://seapalstcg.com/admin/orders?paPeriodEnd=2026-09-30#pa-sales-tax-filing"
  );
  assert.equal(
    paQuarterlyReportAdminUrl("2026-09-30", {
      SITE_URL: "javascript:alert(1)",
    }),
    "https://seapalstcg.com/admin/orders?paPeriodEnd=2026-09-30#pa-sales-tax-filing"
  );
  assert.throws(
    () => paQuarterlyReportAdminUrl("2026-09-31", configuredEnvironment),
    (error) => error.code === "pa_quarterly_report_period_invalid"
  );
});

test("Resend idempotency is deterministic per canonical period", () => {
  assert.equal(
    PA_QUARTERLY_REPORT_NOTIFICATION_TYPE,
    "pa_quarterly_report_ready"
  );
  const key = paQuarterlyReportIdempotencyKey(PERIOD);
  assert.equal(
    key,
    "seapals-pa_quarterly_report_ready-2026-09-30"
  );
  assert.equal(paQuarterlyReportIdempotencyKey("2026-09-30"), key);
  assert.notEqual(key, paQuarterlyReportIdempotencyKey("2026-12-31"));
  assert.throws(
    () => paQuarterlyReportIdempotencyKey("2026-08-31"),
    (error) => error.code === "pa_quarterly_report_period_invalid"
  );
});

test("the canonical provider payload is privacy-safe and is the exact body sent to Resend", async () => {
  let request;
  const report = safeReport({
    grossSalesCents: 987654321,
    salesLicenseId: "87654321",
    customerEmail: "private-buyer@example.test",
  });
  const payload = paQuarterlyReportEmailPayload(
    report,
    configuredEnvironment
  );
  const result = await sendPaQuarterlyReportEmail({
    report,
    environment: configuredEnvironment,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "email_pa_quarter_123" }),
      };
    },
  });

  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.method, "POST");
  assert.equal(
    request.options.headers.Authorization,
    "Bearer test-provider-secret"
  );
  assert.equal(
    request.options.headers["Idempotency-Key"],
    paQuarterlyReportIdempotencyKey(PERIOD)
  );
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body, payload);
  assert.deepEqual(Object.keys(body).sort(), [
    "from",
    "html",
    "subject",
    "text",
    "to",
  ]);
  assert.equal(body.from, "SeaPals Orders <orders@seapalstcg.com>");
  assert.equal(body.to, "tax-owner@seapalstcg.com");
  assert.doesNotMatch(
    request.options.body,
    /987654321|87654321|private-buyer@example\.test|test-provider-secret/
  );
  assert.deepEqual(result, {
    providerMessageId: "email_pa_quarter_123",
    idempotencyKey: paQuarterlyReportIdempotencyKey(PERIOD),
  });
});

test("delivery requires the independent PA tax report gate", async () => {
  await assert.rejects(
    sendPaQuarterlyReportEmail({
      report: safeReport(),
      environment: {
        ...configuredEnvironment,
        STORE_PA_TAX_REPORT_ENABLED: "false",
      },
      fetchImpl: async () => {
        throw new Error("must not send");
      },
    }),
    (error) => error.code === "pa_quarterly_report_email_not_enabled"
  );
});

test("tax report delivery never falls back to order-notification gates or recipients", async () => {
  await assert.rejects(
    sendPaQuarterlyReportEmail({
      report: safeReport(),
      environment: {
        ...configuredEnvironment,
        STORE_PA_TAX_REPORT_EMAIL: "",
        STORE_ORDER_NOTIFICATION_ENABLED: "true",
        STORE_ORDER_NOTIFICATION_EMAIL: "orders-only@seapalstcg.com",
      },
      fetchImpl: async () => {
        throw new Error("must not send");
      },
    }),
    (error) => error.code === "pa_quarterly_report_email_not_configured"
  );

  await assert.rejects(
    sendPaQuarterlyReportEmail({
      report: safeReport(),
      environment: {
        ...configuredEnvironment,
        STORE_PA_TAX_REPORT_ENABLED: "",
        STORE_ORDER_NOTIFICATION_ENABLED: "true",
      },
      fetchImpl: async () => {
        throw new Error("must not send");
      },
    }),
    (error) => error.code === "pa_quarterly_report_email_not_enabled"
  );
});

test("provider rejection exposes only a retry-safe code and never reads response content", async () => {
  let responseBodyRead = false;
  await assert.rejects(
    sendPaQuarterlyReportEmail({
      report: safeReport(),
      environment: configuredEnvironment,
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        text: async () => {
          responseBodyRead = true;
          return "private-buyer@example.test provider detail";
        },
      }),
    }),
    (error) =>
      error.code === "resend_http_503" &&
      !error.message.includes("private-buyer@example.test")
  );
  assert.equal(responseBodyRead, false);
});
