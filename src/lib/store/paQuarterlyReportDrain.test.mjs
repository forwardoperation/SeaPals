import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { drainPaQuarterlyReportEmail } from "./paQuarterlyReportDrain.mjs";

const NOW = new Date("2026-10-02T13:00:00.000Z");
const Q4_READY = new Date("2027-01-04T14:00:00.000Z");
const PERIOD_END = "2026-09-30";
const CLAIM_TOKEN = "11111111-1111-4111-8111-111111111111";
const ENVIRONMENT = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/private-path",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-with-enough-entropy",
  STORE_PA_TAX_REPORT_ENABLED: "true",
  STORE_PA_TAX_REPORT_EMAIL: "tax-owner@seapalstcg.com",
  STORE_PA_TAX_REPORT_START_PERIOD_END: PERIOD_END,
  STORE_PA_TAX_REPORT_DELIVERY_CONFIRMED: "true",
  EMAIL_FROM: "SeaPals <maker@seapalstcg.com>",
  RESEND_API_KEY: "re_test_pa_quarterly_report",
  SITE_URL: "https://seapalstcg.com",
});

const REVIEW_ORDER = Object.freeze({
  paid_at: "2026-08-14T18:00:00.000Z",
  refunded_at: null,
  shipping_address: null,
  currency: "usd",
  subtotal_cents: 2200,
  production_cents: 0,
  fulfillment_method: "shipping",
  pickup_location: null,
  shipping_cents: 0,
  tax_cents: 132,
  total_cents: 2332,
  amount_refunded_cents: 0,
  payment_livemode: true,
  has_dispute: false,
  dispute_updated_at: null,
  store_order_items: [{ line_total_cents: 2200 }],
  store_refunds: [],
});

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function snapshotFromPrepare(body) {
  return {
    periodEnd: body.p_period_end,
    dueDate: body.p_due_date,
    scheduledFor: body.p_scheduled_for,
    ready: body.p_ready,
    includedSales: body.p_included_sales,
    excludedSales: body.p_excluded_sales,
    issueCount: body.p_issue_count,
    paGrossSalesCents: body.p_pa_gross_sales_cents,
    paTaxableSalesCents: body.p_pa_taxable_sales_cents,
    stateTaxCents: body.p_state_tax_cents,
    alleghenyTaxCents: body.p_allegheny_tax_cents,
    philadelphiaTaxCents: body.p_philadelphia_tax_cents,
    issueCodeCounts: body.p_issue_code_counts,
    sourceFingerprint: body.p_source_fingerprint,
    payloadSha256: body.p_payload_sha256,
    templateVersion: 1,
  };
}

function createFetchHarness({
  orders = [],
  ordersStatus = 200,
  getStatus = "missing",
  existingSnapshot = null,
  getResults = {},
  prepareStatus = "prepared",
  transformSnapshot = (snapshot) => snapshot,
  claimStatus = "claimed",
  resendStatus = 200,
  completeResult = true,
  releaseResult = true,
} = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const body = options.body ? JSON.parse(options.body) : null;
    const call = { url: parsed, options, body };
    calls.push(call);

    if (
      parsed.pathname.endsWith("/get_store_pa_quarterly_report_notification")
    ) {
      const result = getResults[body.p_period_end];
      if (result) return jsonResponse(result);
      return jsonResponse(
        getStatus === "missing"
          ? { status: "missing" }
          : { status: getStatus, snapshot: existingSnapshot }
      );
    }
    if (
      parsed.pathname.endsWith("/list_store_pa_quarterly_report_orders")
    ) {
      return jsonResponse(orders, ordersStatus);
    }
    if (
      parsed.pathname.endsWith(
        "/prepare_store_pa_quarterly_report_notification"
      )
    ) {
      const snapshot = transformSnapshot(snapshotFromPrepare(body), body);
      return jsonResponse({ status: prepareStatus, snapshot });
    }
    if (
      parsed.pathname.endsWith(
        "/claim_store_pa_quarterly_report_notification"
      )
    ) {
      return jsonResponse(claimStatus);
    }
    if (parsed.hostname === "api.resend.com") {
      return resendStatus >= 200 && resendStatus < 300
        ? jsonResponse({ id: "email_pa_q3_2026" }, resendStatus)
        : jsonResponse({ private_provider_detail: "must not escape" }, resendStatus);
    }
    if (
      parsed.pathname.endsWith(
        "/complete_store_pa_quarterly_report_notification"
      )
    ) {
      return jsonResponse(completeResult);
    }
    if (
      parsed.pathname.endsWith(
        "/release_store_pa_quarterly_report_notification"
      )
    ) {
      return jsonResponse(releaseResult);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  return { calls, fetchImpl };
}

function requestName(call) {
  return `${call.url.hostname}${call.url.pathname}`;
}

function expectedSummary(overrides = {}) {
  return {
    eligible: true,
    periodEnd: PERIOD_END,
    delivered: 0,
    alreadySent: 0,
    busy: 0,
    manualReview: 0,
    ...overrides,
  };
}

test("disabled and future-start gates stop before any private request", async () => {
  let calls = 0;
  const noNetwork = async () => {
    calls += 1;
    throw new Error("network access is not expected");
  };

  const disabled = await drainPaQuarterlyReportEmail({
    environment: {
      STORE_PA_TAX_REPORT_ENABLED: "false",
    },
    fetchImpl: noNetwork,
    now: NOW,
    claimToken: CLAIM_TOKEN,
  });
  assert.deepEqual(disabled, {
    eligible: false,
    periodEnd: null,
    delivered: 0,
    alreadySent: 0,
    busy: 0,
    manualReview: 0,
    disabled: true,
  });

  const waiting = await drainPaQuarterlyReportEmail({
    environment: {
      ...ENVIRONMENT,
      STORE_PA_TAX_REPORT_START_PERIOD_END: "2026-12-31",
    },
    fetchImpl: noNetwork,
    now: NOW,
    claimToken: CLAIM_TOKEN,
  });
  assert.deepEqual(waiting, {
    eligible: false,
    periodEnd: null,
    delivered: 0,
    alreadySent: 0,
    busy: 0,
    manualReview: 0,
    waitingForStartPeriod: true,
  });
  assert.equal(calls, 0);
});

test("catch-up processes the earliest missing eligible quarter first", async () => {
  const { calls, fetchImpl } = createFetchHarness();

  const summary = await drainPaQuarterlyReportEmail({
    environment: ENVIRONMENT,
    fetchImpl,
    now: Q4_READY,
    claimToken: CLAIM_TOKEN,
  });

  assert.deepEqual(summary, expectedSummary({ delivered: 1 }));
  const statusCalls = calls.filter(({ url }) =>
    url.pathname.endsWith("/get_store_pa_quarterly_report_notification")
  );
  assert.deepEqual(statusCalls.map(({ body }) => body.p_period_end), [PERIOD_END]);
  assert.equal(
    calls.some(({ body }) => body?.p_period_end === "2026-12-31"),
    false
  );
});

test("catch-up skips a sent quarter and processes the next missing quarter", async () => {
  const { calls, fetchImpl } = createFetchHarness({
    getResults: {
      [PERIOD_END]: { status: "sent" },
    },
  });

  const summary = await drainPaQuarterlyReportEmail({
    environment: ENVIRONMENT,
    fetchImpl,
    now: Q4_READY,
    claimToken: CLAIM_TOKEN,
  });

  assert.deepEqual(
    summary,
    expectedSummary({
      periodEnd: "2026-12-31",
      alreadySent: 1,
      delivered: 1,
    })
  );
  const statusCalls = calls.filter(({ url }) =>
    url.pathname.endsWith("/get_store_pa_quarterly_report_notification")
  );
  assert.deepEqual(statusCalls.map(({ body }) => body.p_period_end), [
    PERIOD_END,
    "2026-12-31",
  ]);
  const ledgerCall = calls.find(({ url }) =>
    url.pathname.endsWith("/list_store_pa_quarterly_report_orders")
  );
  assert.deepEqual(ledgerCall.body, {
    p_period_start: "2026-10-01T04:00:00.000Z",
    p_period_end_exclusive: "2027-01-01T05:00:00.000Z",
  });
});

test("a manual-review quarter blocks later catch-up periods", async () => {
  const { calls, fetchImpl } = createFetchHarness({
    getResults: {
      [PERIOD_END]: { status: "manual" },
    },
  });

  const summary = await drainPaQuarterlyReportEmail({
    environment: ENVIRONMENT,
    fetchImpl,
    now: Q4_READY,
    claimToken: CLAIM_TOKEN,
  });

  assert.deepEqual(summary, expectedSummary({ manualReview: 1 }));
  assert.deepEqual(calls.map(requestName), [
    "example.supabase.co/rest/v1/rpc/get_store_pa_quarterly_report_notification",
  ]);
});

test("an unsettled source ledger retries before freezing a snapshot", async () => {
  const { calls, fetchImpl } = createFetchHarness({ ordersStatus: 400 });

  await assert.rejects(
    drainPaQuarterlyReportEmail({
      environment: ENVIRONMENT,
      fetchImpl,
      now: NOW,
      claimToken: CLAIM_TOKEN,
    }),
    (error) => error.code === "pa_quarterly_report_orders_load_failed"
  );
  assert.deepEqual(calls.map(requestName), [
    "example.supabase.co/rest/v1/rpc/get_store_pa_quarterly_report_notification",
    "example.supabase.co/rest/v1/rpc/list_store_pa_quarterly_report_orders",
  ]);
});

test("a zero-sale quarter is frozen, claimed, emailed, and completed", async () => {
  const { calls, fetchImpl } = createFetchHarness();

  const summary = await drainPaQuarterlyReportEmail({
    environment: ENVIRONMENT,
    fetchImpl,
    now: NOW,
    claimToken: CLAIM_TOKEN,
  });

  assert.deepEqual(summary, expectedSummary({ delivered: 1 }));
  assert.deepEqual(calls.map(requestName), [
    "example.supabase.co/rest/v1/rpc/get_store_pa_quarterly_report_notification",
    "example.supabase.co/rest/v1/rpc/list_store_pa_quarterly_report_orders",
    "example.supabase.co/rest/v1/rpc/prepare_store_pa_quarterly_report_notification",
    "example.supabase.co/rest/v1/rpc/claim_store_pa_quarterly_report_notification",
    "api.resend.com/emails",
    "example.supabase.co/rest/v1/rpc/complete_store_pa_quarterly_report_notification",
  ]);

  assert.deepEqual(calls[0].body, { p_period_end: PERIOD_END });
  assert.deepEqual(calls[1].body, {
    p_period_start: "2026-07-01T04:00:00.000Z",
    p_period_end_exclusive: "2026-10-01T04:00:00.000Z",
  });
  assert.deepEqual(
    {
      periodEnd: calls[2].body.p_period_end,
      dueDate: calls[2].body.p_due_date,
      scheduledFor: calls[2].body.p_scheduled_for,
      ready: calls[2].body.p_ready,
      includedSales: calls[2].body.p_included_sales,
      excludedSales: calls[2].body.p_excluded_sales,
      issueCount: calls[2].body.p_issue_count,
      grossSales: calls[2].body.p_pa_gross_sales_cents,
      taxableSales: calls[2].body.p_pa_taxable_sales_cents,
      stateTax: calls[2].body.p_state_tax_cents,
      alleghenyTax: calls[2].body.p_allegheny_tax_cents,
      philadelphiaTax: calls[2].body.p_philadelphia_tax_cents,
      issueCodes: calls[2].body.p_issue_code_counts,
    },
    {
      periodEnd: PERIOD_END,
      dueDate: "2026-10-20",
      scheduledFor: "2026-10-02T13:00:00.000Z",
      ready: true,
      includedSales: 0,
      excludedSales: 0,
      issueCount: 0,
      grossSales: 0,
      taxableSales: 0,
      stateTax: 0,
      alleghenyTax: 0,
      philadelphiaTax: 0,
      issueCodes: {},
    }
  );
  assert.match(calls[2].body.p_source_fingerprint, /^[a-f0-9]{64}$/);
  assert.match(calls[2].body.p_payload_sha256, /^[a-f0-9]{64}$/);

  assert.deepEqual(calls[3].body, {
    p_period_end: PERIOD_END,
    p_due_date: "2026-10-20",
    p_claim_token: CLAIM_TOKEN,
    p_lease_seconds: 300,
  });
  assert.deepEqual(Object.keys(calls[4].body).sort(), [
    "from",
    "html",
    "subject",
    "text",
    "to",
  ]);
  assert.equal(
    calls[4].options.headers["Idempotency-Key"],
    "seapals-pa_quarterly_report_ready-2026-09-30"
  );
  assert.doesNotMatch(
    JSON.stringify(calls[4].body),
    /gross sales|taxable sales|sales license|tax[_ -]?id|customer (?:name|email|id)|order[_ -]?id|payment[_ -]?id|attachment|\$\d|\b\d+\.\d{2}\b/i
  );
  assert.deepEqual(calls[5].body, {
    p_period_end: PERIOD_END,
    p_claim_token: CLAIM_TOKEN,
    p_provider_message_id: "email_pa_q3_2026",
  });
});

test("sent snapshots and sent, busy, or manual claims do not send", async (t) => {
  const cases = [
    {
      name: "already-sent frozen snapshot",
      getStatus: "sent",
      claimStatus: "claimed",
      orders: [],
      expected: expectedSummary({ alreadySent: 1 }),
      expectedRequests: 1,
    },
    {
      name: "delivery-uncertain frozen snapshot",
      getStatus: "manual",
      claimStatus: "claimed",
      orders: [],
      expected: expectedSummary({ manualReview: 1 }),
      expectedRequests: 1,
    },
    {
      name: "already-sent claim",
      prepareStatus: "prepared",
      claimStatus: "sent",
      orders: [],
      expected: expectedSummary({ alreadySent: 1 }),
      expectedRequests: 4,
    },
    {
      name: "busy claim",
      prepareStatus: "prepared",
      claimStatus: "busy",
      orders: [],
      expected: expectedSummary({ busy: 1 }),
      expectedRequests: 4,
    },
    {
      name: "manual-review claim",
      prepareStatus: "prepared",
      claimStatus: "manual",
      orders: [REVIEW_ORDER],
      expected: expectedSummary({ manualReview: 1 }),
      expectedRequests: 4,
      manual: true,
    },
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const { calls, fetchImpl } = createFetchHarness(scenario);
      const summary = await drainPaQuarterlyReportEmail({
        environment: ENVIRONMENT,
        fetchImpl,
        now: NOW,
        claimToken: CLAIM_TOKEN,
      });

      assert.deepEqual(summary, scenario.expected);
      assert.equal(calls.length, scenario.expectedRequests);
      assert.equal(
        calls.some(({ url }) => url.hostname === "api.resend.com"),
        false
      );
      assert.equal(
        calls.some(({ url }) =>
          url.pathname.endsWith(
            "/complete_store_pa_quarterly_report_notification"
          )
        ),
        false
      );
      if (scenario.manual) {
        assert.equal(calls[2].body.p_ready, false);
        assert.equal(calls[2].body.p_issue_count, 1);
        assert.deepEqual(calls[2].body.p_issue_code_counts, {
          tax_jurisdiction: 1,
        });
      }
    });
  }
});

test("an existing prepared snapshot reloads its ledger before another claim", async () => {
  const seed = createFetchHarness({ claimStatus: "busy" });
  await drainPaQuarterlyReportEmail({
    environment: ENVIRONMENT,
    fetchImpl: seed.fetchImpl,
    now: NOW,
    claimToken: CLAIM_TOKEN,
  });
  const frozenSnapshot = snapshotFromPrepare(seed.calls[2].body);

  const retry = createFetchHarness({
    getStatus: "prepared",
    existingSnapshot: frozenSnapshot,
    claimStatus: "busy",
  });
  const summary = await drainPaQuarterlyReportEmail({
    environment: ENVIRONMENT,
    fetchImpl: retry.fetchImpl,
    now: NOW,
    claimToken: CLAIM_TOKEN,
  });

  assert.deepEqual(summary, expectedSummary({ busy: 1 }));
  assert.deepEqual(retry.calls.map(requestName), [
    "example.supabase.co/rest/v1/rpc/get_store_pa_quarterly_report_notification",
    "example.supabase.co/rest/v1/rpc/list_store_pa_quarterly_report_orders",
    "example.supabase.co/rest/v1/rpc/prepare_store_pa_quarterly_report_notification",
    "example.supabase.co/rest/v1/rpc/claim_store_pa_quarterly_report_notification",
  ]);
});

test("a persisted prepare conflict stops before claim or email delivery", async () => {
  const { calls, fetchImpl } = createFetchHarness({
    prepareStatus: "manual",
    transformSnapshot(snapshot) {
      return { ...snapshot, sourceFingerprint: "f".repeat(64) };
    },
  });

  const summary = await drainPaQuarterlyReportEmail({
    environment: ENVIRONMENT,
    fetchImpl,
    now: NOW,
    claimToken: CLAIM_TOKEN,
  });

  assert.deepEqual(summary, expectedSummary({ manualReview: 1 }));
  assert.deepEqual(calls.map(requestName), [
    "example.supabase.co/rest/v1/rpc/get_store_pa_quarterly_report_notification",
    "example.supabase.co/rest/v1/rpc/list_store_pa_quarterly_report_orders",
    "example.supabase.co/rest/v1/rpc/prepare_store_pa_quarterly_report_notification",
  ]);
});

test("a frozen payload hash mismatch fails before claim or delivery", async () => {
  const { calls, fetchImpl } = createFetchHarness({
    transformSnapshot(snapshot) {
      const first = snapshot.payloadSha256[0] === "0" ? "1" : "0";
      return {
        ...snapshot,
        payloadSha256: `${first}${snapshot.payloadSha256.slice(1)}`,
      };
    },
  });

  await assert.rejects(
    drainPaQuarterlyReportEmail({
      environment: ENVIRONMENT,
      fetchImpl,
      now: NOW,
      claimToken: CLAIM_TOKEN,
    }),
    (error) => {
      assert.equal(error.code, "pa_quarterly_report_payload_drift");
      assert.doesNotMatch(error.message, /[a-f0-9]{64}/);
      return true;
    }
  );
  assert.deepEqual(calls.map(requestName), [
    "example.supabase.co/rest/v1/rpc/get_store_pa_quarterly_report_notification",
    "example.supabase.co/rest/v1/rpc/list_store_pa_quarterly_report_orders",
    "example.supabase.co/rest/v1/rpc/prepare_store_pa_quarterly_report_notification",
  ]);
});

test("an email failure releases the claim with a safe failure code", async () => {
  const { calls, fetchImpl } = createFetchHarness({ resendStatus: 503 });

  await assert.rejects(
    drainPaQuarterlyReportEmail({
      environment: ENVIRONMENT,
      fetchImpl,
      now: NOW,
      claimToken: CLAIM_TOKEN,
    }),
    (error) => {
      assert.equal(error.code, "resend_http_503");
      assert.doesNotMatch(error.message, /private_provider_detail|503/);
      return true;
    }
  );

  assert.deepEqual(calls.map(requestName), [
    "example.supabase.co/rest/v1/rpc/get_store_pa_quarterly_report_notification",
    "example.supabase.co/rest/v1/rpc/list_store_pa_quarterly_report_orders",
    "example.supabase.co/rest/v1/rpc/prepare_store_pa_quarterly_report_notification",
    "example.supabase.co/rest/v1/rpc/claim_store_pa_quarterly_report_notification",
    "api.resend.com/emails",
    "example.supabase.co/rest/v1/rpc/release_store_pa_quarterly_report_notification",
  ]);
  assert.deepEqual(calls.at(-1).body, {
    p_period_end: PERIOD_END,
    p_claim_token: CLAIM_TOKEN,
    p_failure_code: "resend_http_503",
  });
});

test("a completion conflict after provider acceptance does not release", async () => {
  const { calls, fetchImpl } = createFetchHarness({ completeResult: false });

  await assert.rejects(
    drainPaQuarterlyReportEmail({
      environment: ENVIRONMENT,
      fetchImpl,
      now: NOW,
      claimToken: CLAIM_TOKEN,
    }),
    (error) => {
      assert.equal(error.code, "pa_quarterly_report_completion_conflict");
      return true;
    }
  );

  assert.equal(
    calls.filter(({ url }) => url.hostname === "api.resend.com").length,
    1
  );
  assert.equal(
    calls.some(({ url }) =>
      url.pathname.endsWith(
        "/release_store_pa_quarterly_report_notification"
      )
    ),
    false
  );
  assert.equal(
    calls.at(-1).url.pathname,
    "/rest/v1/rpc/complete_store_pa_quarterly_report_notification"
  );
});

test("the order ledger uses the PII-minimized Supabase RPC projection", async () => {
  const { calls, fetchImpl } = createFetchHarness({ prepareStatus: "sent" });
  await drainPaQuarterlyReportEmail({
    environment: ENVIRONMENT,
    fetchImpl,
    now: NOW,
    claimToken: CLAIM_TOKEN,
  });

  assert.equal(
    calls[0].url.toString(),
    "https://example.supabase.co/rest/v1/rpc/get_store_pa_quarterly_report_notification"
  );
  assert.deepEqual(calls[0].body, { p_period_end: PERIOD_END });
  const loadCall = calls[1];
  assert.equal(
    loadCall.url.toString(),
    "https://example.supabase.co/rest/v1/rpc/list_store_pa_quarterly_report_orders"
  );
  assert.equal(loadCall.options.method, "POST");
  assert.equal(loadCall.url.search, "");
  assert.deepEqual(Object.keys(loadCall.body).sort(), [
    "p_period_end_exclusive",
    "p_period_start",
  ]);
  assert.doesNotMatch(
    JSON.stringify(loadCall.body),
    /customer|email|name|phone|address|payment|order|receipt|tracking/i
  );

  const sql = readFileSync(
    new URL("../../../supabase/pa-quarterly-report-email.sql", import.meta.url),
    "utf8"
  );
  const start = sql.indexOf(
    "create or replace function public.list_store_pa_quarterly_report_orders"
  );
  const end = sql.indexOf(
    "create or replace function public.claim_store_pa_quarterly_report_notification",
    start
  );
  assert.ok(start >= 0 && end > start);
  const projection = sql.slice(start, end);
  assert.match(
    projection,
    /inventory_state = 'reserved'[\s\S]*created_at >= p_period_start - interval '24 hours'[\s\S]*created_at < p_period_end_exclusive[\s\S]*source ledger is not settled/
  );
  assert.match(projection, /'has_dispute', orders\.dispute_id is not null/);
  assert.doesNotMatch(projection, /'(?:id|order_number|dispute_id)'\s*,/);
  assert.match(projection, /'city'.*'state'.*'postal_code'.*'country'/s);
  assert.match(
    projection,
    /jsonb_build_object\('line_total_cents', items\.line_total_cents\)/
  );
  assert.doesNotMatch(
    projection,
    /customer_email|customer_name|phone|line1|line2|receipt_url|tracking_|internal_notes|payment_intent|charge_id|provider_refund_id/i
  );
  assert.doesNotMatch(projection, /select\s+(orders\.)?\*/i);
});

test("the custom worker keeps one shared five-minute cron", () => {
  const worker = readFileSync(
    new URL("../../../custom-worker.mjs", import.meta.url),
    "utf8"
  );
  const wrangler = readFileSync(
    new URL("../../../wrangler.jsonc", import.meta.url),
    "utf8"
  );

  assert.match(
    worker,
    /import \{ drainPaQuarterlyReportEmail \} from "\.\/src\/lib\/store\/paQuarterlyReportDrain\.mjs"/
  );
  assert.match(worker, /export const STORE_NOTIFICATION_CRON = "\*\/5 \* \* \* \*"/);
  assert.match(worker, /async scheduled\(controller, environment\)/);
  assert.match(worker, /controller\?\.cron !== STORE_NOTIFICATION_CRON/);
  assert.match(worker, /controller\?\.noRetry\?\.\(\)/);
  assert.match(worker, /Promise\.allSettled/);
  assert.match(
    worker,
    /drainPaQuarterlyReportEmail\(\{\s*environment,\s*now: new Date\(controller\.scheduledTime\),\s*\}\)/
  );
  assert.equal(
    (worker.match(/drainPaQuarterlyReportEmail\(\{/g) ?? []).length,
    1
  );

  const cronBlocks = [...wrangler.matchAll(/"crons"\s*:\s*\[([^\]]*)\]/g)];
  assert.equal(cronBlocks.length, 1);
  assert.deepEqual(
    [...cronBlocks[0][1].matchAll(/"([^"]+)"/g)].map((match) => match[1]),
    ["*/5 * * * *"]
  );
  assert.match(wrangler, /"main": "custom-worker\.mjs"/);
});
