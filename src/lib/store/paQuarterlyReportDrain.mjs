import {
  eligiblePaQuarterlyReportPeriod,
  paQuarterlyReportEmailPayload,
  paQuarterlyReportScheduledFor,
  sendPaQuarterlyReportEmail,
} from "./paQuarterlyReportEmail.mjs";
import {
  paQuarterPeriod,
  reconcilePaSalesTaxPeriod,
} from "./paSalesTaxReturn.mjs";

const REPORT_LEASE_SECONDS = 300;
const REQUEST_TIMEOUT_MS = 30_000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class PaQuarterlyReportDrainError extends Error {
  constructor(message, { code = "pa_quarterly_report_failed", cause } = {}) {
    super(message, { cause });
    this.name = "PaQuarterlyReportDrainError";
    this.code = code;
  }
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeErrorCode(value, fallback = "pa_quarterly_report_failed") {
  const code = safeString(value);
  return /^[A-Za-z0-9_-]{1,100}$/.test(code) ? code : fallback;
}

function nonNegativeInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new PaQuarterlyReportDrainError(
      `The persisted quarterly report ${label} is invalid.`,
      { code: "pa_quarterly_report_snapshot_invalid" }
    );
  }
  return number;
}

function stableJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(",")}}`;
}

async function sha256(value) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new PaQuarterlyReportDrainError(
      "Quarterly report hashing is unavailable.",
      { code: "pa_quarterly_report_hash_unavailable" }
    );
  }
  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(stableJson(value))
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function configuredStartPeriod(environment) {
  const value = safeString(environment.STORE_PA_TAX_REPORT_START_PERIOD_END);
  try {
    return paQuarterPeriod(value).periodEnd;
  } catch (cause) {
    throw new PaQuarterlyReportDrainError(
      "The Pennsylvania quarterly report start period is not configured.",
      { code: "pa_quarterly_report_start_period_invalid", cause }
    );
  }
}

function nextQuarterPeriod(period) {
  const nextQuarter = period.quarter === 4 ? 1 : period.quarter + 1;
  const nextYear = period.quarter === 4 ? period.year + 1 : period.year;
  const monthDay = ["03-31", "06-30", "09-30", "12-31"][nextQuarter - 1];
  return paQuarterPeriod(`${nextYear}-${monthDay}`);
}

function eligiblePeriodsFrom(startPeriodEnd, latestPeriod) {
  let period = paQuarterPeriod(startPeriodEnd);
  if (period.periodEnd > latestPeriod.periodEnd) return [];

  const periods = [];
  while (period.periodEnd <= latestPeriod.periodEnd) {
    periods.push(period);
    if (period.periodEnd === latestPeriod.periodEnd) break;
    period = nextQuarterPeriod(period);
  }
  return periods;
}

function readConfiguration(environment) {
  if (
    safeString(environment.STORE_PA_TAX_REPORT_DELIVERY_CONFIRMED).toLowerCase() !==
    "true"
  ) {
    throw new PaQuarterlyReportDrainError(
      "Pennsylvania quarterly report delivery is not confirmed.",
      { code: "pa_quarterly_report_delivery_not_confirmed" }
    );
  }

  const serviceRoleKey = safeString(environment.SUPABASE_SERVICE_ROLE_KEY);
  let supabaseUrl = null;
  try {
    const candidate = new URL(
      safeString(environment.NEXT_PUBLIC_SUPABASE_URL)
    );
    if (candidate.protocol === "https:") supabaseUrl = candidate.origin;
  } catch {
    // A fixed configuration error is reported below without echoing secrets.
  }
  if (!supabaseUrl || serviceRoleKey.length < 20) {
    throw new PaQuarterlyReportDrainError(
      "Pennsylvania quarterly report storage is not configured.",
      { code: "pa_quarterly_report_store_not_configured" }
    );
  }

  return {
    serviceRoleKey,
    startPeriodEnd: configuredStartPeriod(environment),
    supabaseUrl,
  };
}

async function responseJson(response, code) {
  if (!response?.ok) {
    throw new PaQuarterlyReportDrainError(
      "The Pennsylvania quarterly report store rejected a request.",
      { code }
    );
  }
  try {
    return await response.json();
  } catch (cause) {
    throw new PaQuarterlyReportDrainError(
      "The Pennsylvania quarterly report store returned an invalid response.",
      { code, cause }
    );
  }
}

function createStore({ fetchImpl, serviceRoleKey, supabaseUrl }) {
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  async function rpc(name, body, code) {
    let response;
    try {
      response = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      throw new PaQuarterlyReportDrainError(
        "The Pennsylvania quarterly report store could not be reached.",
        { code, cause }
      );
    }
    return responseJson(response, code);
  }

  return {
    get(periodEnd) {
      return rpc(
        "get_store_pa_quarterly_report_notification",
        { p_period_end: periodEnd },
        "pa_quarterly_report_status_failed"
      );
    },
    loadOrders(period) {
      return rpc(
        "list_store_pa_quarterly_report_orders",
        {
          p_period_start: period.startIso,
          p_period_end_exclusive: period.endExclusiveIso,
        },
        "pa_quarterly_report_orders_load_failed"
      );
    },
    prepare(snapshot) {
      return rpc(
        "prepare_store_pa_quarterly_report_notification",
        {
          p_period_end: snapshot.periodEnd,
          p_due_date: snapshot.dueDate,
          p_scheduled_for: snapshot.scheduledFor,
          p_ready: snapshot.ready,
          p_included_sales: snapshot.includedSales,
          p_excluded_sales: snapshot.excludedSales,
          p_issue_count: snapshot.issueCount,
          p_pa_gross_sales_cents: snapshot.paGrossSalesCents,
          p_pa_taxable_sales_cents: snapshot.paTaxableSalesCents,
          p_state_tax_cents: snapshot.stateTaxCents,
          p_allegheny_tax_cents: snapshot.alleghenyTaxCents,
          p_philadelphia_tax_cents: snapshot.philadelphiaTaxCents,
          p_issue_code_counts: snapshot.issueCodeCounts,
          p_source_fingerprint: snapshot.sourceFingerprint,
          p_payload_sha256: snapshot.payloadSha256,
        },
        "pa_quarterly_report_prepare_failed"
      );
    },
    claim({ periodEnd, dueDate, claimToken }) {
      return rpc(
        "claim_store_pa_quarterly_report_notification",
        {
          p_period_end: periodEnd,
          p_due_date: dueDate,
          p_claim_token: claimToken,
          p_lease_seconds: REPORT_LEASE_SECONDS,
        },
        "pa_quarterly_report_claim_failed"
      );
    },
    complete({ periodEnd, claimToken, providerMessageId }) {
      return rpc(
        "complete_store_pa_quarterly_report_notification",
        {
          p_period_end: periodEnd,
          p_claim_token: claimToken,
          p_provider_message_id: providerMessageId,
        },
        "pa_quarterly_report_complete_failed"
      );
    },
    release({ periodEnd, claimToken, failureCode }) {
      return rpc(
        "release_store_pa_quarterly_report_notification",
        {
          p_period_end: periodEnd,
          p_claim_token: claimToken,
          p_failure_code: failureCode,
        },
        "pa_quarterly_report_release_failed"
      );
    },
  };
}

function issueCodeCounts(issues) {
  const counts = {};
  for (const issue of Array.isArray(issues) ? issues : []) {
    const code = safeErrorCode(issue?.code, "unknown");
    counts[code] = (counts[code] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) =>
      left.localeCompare(right, "en-US")
    )
  );
}

function rowForCode(reconciliation, code) {
  return (
    (Array.isArray(reconciliation?.rows) ? reconciliation.rows : []).find(
      (row) => safeString(row?.code) === code
    ) ?? {}
  );
}

function emailReport(snapshot) {
  return {
    period: paQuarterPeriod(snapshot.periodEnd),
    status: snapshot.ready ? "ready" : "needs_attention",
    issueCount: snapshot.issueCount,
  };
}

async function currentSnapshot({ orders, period, reconciliation, environment }) {
  const state = rowForCode(reconciliation, "00");
  const allegheny = rowForCode(reconciliation, "02");
  const philadelphia = rowForCode(reconciliation, "51");
  const snapshot = {
    periodEnd: period.periodEnd,
    dueDate: period.dueDate,
    scheduledFor: paQuarterlyReportScheduledFor(period),
    ready: reconciliation.ready === true,
    includedSales: nonNegativeInteger(
      reconciliation?.summary?.includedSales,
      "included-sale count"
    ),
    excludedSales: nonNegativeInteger(
      reconciliation?.summary?.excludedSales,
      "excluded-sale count"
    ),
    issueCount: nonNegativeInteger(
      reconciliation?.summary?.issueCount,
      "issue count"
    ),
    paGrossSalesCents: nonNegativeInteger(
      reconciliation?.summary?.paGrossSalesCents,
      "gross-sales amount"
    ),
    paTaxableSalesCents: nonNegativeInteger(
      reconciliation?.summary?.paTaxableSalesCents,
      "taxable-sales amount"
    ),
    stateTaxCents: nonNegativeInteger(
      state?.actualSalesTaxCollectedCents ?? 0,
      "state-tax amount"
    ),
    alleghenyTaxCents: nonNegativeInteger(
      allegheny?.actualSalesTaxCollectedCents ?? 0,
      "Allegheny-tax amount"
    ),
    philadelphiaTaxCents: nonNegativeInteger(
      philadelphia?.actualSalesTaxCollectedCents ?? 0,
      "Philadelphia-tax amount"
    ),
    issueCodeCounts: issueCodeCounts(reconciliation?.issues),
    sourceFingerprint: await sha256(orders),
  };
  snapshot.payloadSha256 = await sha256(
    paQuarterlyReportEmailPayload(emailReport(snapshot), environment)
  );
  return snapshot;
}

function preparedSnapshot(value) {
  const input = value?.snapshot;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PaQuarterlyReportDrainError(
      "The quarterly report outbox returned an invalid snapshot.",
      { code: "pa_quarterly_report_snapshot_invalid" }
    );
  }

  const period = paQuarterPeriod(safeString(input.periodEnd));
  const expectedSchedule = paQuarterlyReportScheduledFor(period);
  const persistedScheduleMs = Date.parse(safeString(input.scheduledFor));
  if (
    safeString(input.dueDate) !== period.dueDate ||
    !Number.isFinite(persistedScheduleMs) ||
    persistedScheduleMs !== Date.parse(expectedSchedule) ||
    typeof input.ready !== "boolean" ||
    !SHA256_PATTERN.test(safeString(input.sourceFingerprint)) ||
    !SHA256_PATTERN.test(safeString(input.payloadSha256)) ||
    Number(input.templateVersion) !== 1
  ) {
    throw new PaQuarterlyReportDrainError(
      "The quarterly report outbox returned an invalid snapshot.",
      { code: "pa_quarterly_report_snapshot_invalid" }
    );
  }

  const issueCodes = input.issueCodeCounts;
  if (!issueCodes || typeof issueCodes !== "object" || Array.isArray(issueCodes)) {
    throw new PaQuarterlyReportDrainError(
      "The quarterly report issue summary is invalid.",
      { code: "pa_quarterly_report_snapshot_invalid" }
    );
  }
  for (const [code, count] of Object.entries(issueCodes)) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(code)) {
      throw new PaQuarterlyReportDrainError(
        "The quarterly report issue summary is invalid.",
        { code: "pa_quarterly_report_snapshot_invalid" }
      );
    }
    nonNegativeInteger(count, "issue-code count");
  }

  const snapshot = {
    periodEnd: period.periodEnd,
    dueDate: period.dueDate,
    scheduledFor: expectedSchedule,
    ready: input.ready,
    includedSales: nonNegativeInteger(input.includedSales, "included-sale count"),
    excludedSales: nonNegativeInteger(input.excludedSales, "excluded-sale count"),
    issueCount: nonNegativeInteger(input.issueCount, "issue count"),
    paGrossSalesCents: nonNegativeInteger(
      input.paGrossSalesCents,
      "gross-sales amount"
    ),
    paTaxableSalesCents: nonNegativeInteger(
      input.paTaxableSalesCents,
      "taxable-sales amount"
    ),
    stateTaxCents: nonNegativeInteger(input.stateTaxCents, "state-tax amount"),
    alleghenyTaxCents: nonNegativeInteger(
      input.alleghenyTaxCents,
      "Allegheny-tax amount"
    ),
    philadelphiaTaxCents: nonNegativeInteger(
      input.philadelphiaTaxCents,
      "Philadelphia-tax amount"
    ),
    issueCodeCounts: issueCodes,
    sourceFingerprint: safeString(input.sourceFingerprint),
    payloadSha256: safeString(input.payloadSha256),
  };
  if ((snapshot.ready && snapshot.issueCount !== 0) || (!snapshot.ready && snapshot.issueCount === 0)) {
    throw new PaQuarterlyReportDrainError(
      "The quarterly report readiness state is invalid.",
      { code: "pa_quarterly_report_snapshot_invalid" }
    );
  }
  return snapshot;
}

function baseSummary(periodEnd = null) {
  return {
    eligible: Boolean(periodEnd),
    periodEnd,
    delivered: 0,
    alreadySent: 0,
    busy: 0,
    manualReview: 0,
  };
}

export async function drainPaQuarterlyReportEmail({
  environment = {},
  fetchImpl = globalThis.fetch,
  now = new Date(),
  claimToken = globalThis.crypto?.randomUUID?.(),
} = {}) {
  if (
    safeString(environment.STORE_PA_TAX_REPORT_ENABLED).toLowerCase() !== "true"
  ) {
    return { ...baseSummary(), disabled: true };
  }
  if (typeof fetchImpl !== "function" || !UUID_PATTERN.test(claimToken ?? "")) {
    throw new PaQuarterlyReportDrainError(
      "Pennsylvania quarterly report delivery is unavailable.",
      { code: "pa_quarterly_report_transport_unavailable" }
    );
  }

  const configuration = readConfiguration(environment);
  const latestPeriod = eligiblePaQuarterlyReportPeriod(now);
  const periods = eligiblePeriodsFrom(
    configuration.startPeriodEnd,
    latestPeriod
  );
  if (periods.length === 0) {
    return { ...baseSummary(), waitingForStartPeriod: true };
  }
  const summary = baseSummary();
  summary.eligible = true;
  const store = createStore({ fetchImpl, ...configuration });
  let claimed = false;
  let claimedPeriodEnd = null;

  try {
    for (const period of periods) {
      summary.periodEnd = period.periodEnd;
      let prepared = await store.get(period.periodEnd);
      let preparedStatus = safeString(prepared?.status);
      if (preparedStatus === "sent") {
        summary.alreadySent = 1;
        continue;
      }
      if (preparedStatus === "manual") {
        summary.manualReview = 1;
        return summary;
      }
      if (!["missing", "prepared"].includes(preparedStatus)) {
        throw new PaQuarterlyReportDrainError(
          "The quarterly report status is invalid.",
          { code: "pa_quarterly_report_status_invalid" }
        );
      }

      const orders = await store.loadOrders(period);
      if (!Array.isArray(orders) || orders.length > 5000) {
        throw new PaQuarterlyReportDrainError(
          "The quarterly report order ledger is invalid.",
          { code: "pa_quarterly_report_orders_invalid" }
        );
      }
      const reconciliation = reconcilePaSalesTaxPeriod(
        orders,
        period.periodEnd
      );
      const candidate = await currentSnapshot({
        orders,
        period,
        reconciliation,
        environment,
      });
      prepared = await store.prepare(candidate);
      preparedStatus = safeString(prepared?.status);
      if (preparedStatus === "sent") {
        summary.alreadySent = 1;
        continue;
      }
      if (preparedStatus === "manual") {
        summary.manualReview = 1;
        return summary;
      }
      if (preparedStatus !== "prepared") {
        throw new PaQuarterlyReportDrainError(
          "The quarterly report could not be frozen for delivery.",
          { code: "pa_quarterly_report_prepare_conflict" }
        );
      }
      const snapshot = preparedSnapshot(prepared);

      const payloadHash = await sha256(
        paQuarterlyReportEmailPayload(emailReport(snapshot), environment)
      );
      if (payloadHash !== snapshot.payloadSha256) {
        throw new PaQuarterlyReportDrainError(
          "The frozen quarterly report email payload has changed.",
          { code: "pa_quarterly_report_payload_drift" }
        );
      }

      const claimStatus = safeString(
        await store.claim({
          periodEnd: snapshot.periodEnd,
          dueDate: snapshot.dueDate,
          claimToken,
        })
      );
      if (claimStatus === "sent") {
        summary.alreadySent = 1;
        continue;
      }
      if (claimStatus === "busy") {
        summary.busy = 1;
        return summary;
      }
      if (claimStatus === "manual") {
        summary.manualReview = 1;
        return summary;
      }
      if (claimStatus !== "claimed") {
        throw new PaQuarterlyReportDrainError(
          "The quarterly report delivery claim is unavailable.",
          { code: "pa_quarterly_report_claim_conflict" }
        );
      }
      claimed = true;
      claimedPeriodEnd = snapshot.periodEnd;

      const delivery = await sendPaQuarterlyReportEmail({
        report: emailReport(snapshot),
        environment,
        fetchImpl,
      });
      const completed = await store.complete({
        periodEnd: snapshot.periodEnd,
        claimToken,
        providerMessageId: delivery.providerMessageId,
      });
      if (completed !== true) {
        // Do not release after provider acceptance. The short lease allows a
        // same-payload retry inside the provider's 24-hour deduplication window.
        claimed = false;
        claimedPeriodEnd = null;
        throw new PaQuarterlyReportDrainError(
          "The quarterly report delivery could not be confirmed.",
          { code: "pa_quarterly_report_completion_conflict" }
        );
      }

      claimed = false;
      claimedPeriodEnd = null;
      summary.delivered = 1;
      return summary;
    }
    return summary;
  } catch (error) {
    if (claimed) {
      try {
        await store.release({
          periodEnd: claimedPeriodEnd,
          claimToken,
          failureCode: safeErrorCode(error?.code),
        });
      } catch {
        // The bounded lease remains the final retry path when release fails.
      }
    }
    throw error;
  }
}
