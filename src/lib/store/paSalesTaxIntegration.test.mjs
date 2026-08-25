import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [ordersSource, routeSource, dashboardSource, runbook] = await Promise.all([
  readFile(new URL("./orders.js", import.meta.url), "utf8"),
  readFile(
    new URL("../../app/api/admin/store-orders/route.js", import.meta.url),
    "utf8"
  ),
  readFile(
    new URL("../../app/admin/orders/OrdersDashboard.jsx", import.meta.url),
    "utf8"
  ),
  readFile(new URL("../../../docs/pa-automatic-filing.md", import.meta.url), "utf8"),
]);

test("the PA filing query is authorized, period-scoped, completeness-safe, and paginated", () => {
  assert.ok(
    routeSource.indexOf("if (!isAuthorized(request))") <
      routeSource.indexOf('searchParams.get("paPeriodEnd")')
  );
  assert.match(routeSource, /listStoreOrdersForPaTaxPeriod/);
  assert.match(ordersSource, /const pageSize = 500/);
  assert.match(ordersSource, /\.range\(offset, offset \+ pageSize - 1\)/);
  assert.doesNotMatch(ordersSource, /\.eq\("payment_livemode", true\)/);
  assert.match(ordersSource, /\.order\("id", \{ ascending: true \}\)/);
  assert.match(ordersSource, /\.gte\("paid_at", period\.startIso\)/);
  assert.match(ordersSource, /\.lt\("paid_at", period\.endExclusiveIso\)/);
  assert.match(
    ordersSource,
    /refunded_at\.not\.is\.null,dispute_id\.not\.is\.null/
  );
  const taxSelect = ordersSource.slice(
    ordersSource.indexOf("const STORE_ORDER_PA_TAX_SELECT"),
    ordersSource.indexOf("export class OrderStoreError")
  );
  assert.doesNotMatch(taxSelect, /customer_email|customer_name|receipt_url/);
  assert.match(ordersSource, /Do not send\s+\/\/ recipient name|Do not send/);
});

test("the private dashboard keeps identifiers client-side and preserves the owner submission boundary", () => {
  assert.match(dashboardSource, /Pennsylvania quarterly filing/);
  assert.match(dashboardSource, /buildPaSalesTaxReturnCsv/);
  assert.match(dashboardSource, /Download myPATH return CSV/);
  assert.match(dashboardSource, /paPeriodClosed/);
  assert.match(dashboardSource, /paAttestationsComplete/);
  assert.match(dashboardSource, /never\s+stores your license number or FEIN/);
  const filingRequest = dashboardSource.slice(
    dashboardSource.indexOf("async function loadPaFilingPeriod"),
    dashboardSource.indexOf("function exportPaReconciliationCsv")
  );
  assert.doesNotMatch(filingRequest, /paEntityId|paAccountNumber|body:/);
  assert.match(runbook, /myPATH does not\s+support automation/);
  assert.match(runbook, /validation is not filing/i);
});

test("the quarterly email deep link selects its exact CSV period without carrying credentials", () => {
  assert.match(
    dashboardSource,
    /new URLSearchParams\([\s\S]*window\.location\.search[\s\S]*\.get\("paPeriodEnd"\)/
  );
  assert.match(
    dashboardSource,
    /const period = paQuarterPeriod\(requestedPeriodEnd\);[\s\S]*setPaPeriodEnd\(period\.periodEnd\)/
  );
  assert.match(dashboardSource, /selected from the secure email link/);
  assert.match(
    dashboardSource,
    /document\.getElementById\("pa-sales-tax-filing"\)[\s\S]*scrollIntoView\(\{ block: "start" \}\)[\s\S]*focus\(\{ preventScroll: true \}\)/
  );
  assert.doesNotMatch(
    dashboardSource,
    /searchParams\.get\("(?:adminToken|token|paAccountNumber|paEntityId)"\)/
  );
  assert.match(
    runbook,
    /\/admin\/orders\?paPeriodEnd=YYYY-MM-DD#pa-sales-tax-filing/
  );
});
