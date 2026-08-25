import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [schema, environmentExample] = await Promise.all([
  "../../../supabase/pa-quarterly-report-email.sql",
  "../../../.env.example",
].map((path) => readFile(new URL(path, import.meta.url), "utf8")));

const compactSchema = schema.replace(/\s+/g, " ").trim();

function functionSource(name) {
  const start = schema.indexOf(`create or replace function public.${name}(`);
  const end = schema.indexOf("\n$$;", start);

  assert.ok(start >= 0, `${name} is declared`);
  assert.ok(end > start, `${name} has a complete SQL body`);
  return schema.slice(start, end + 4);
}

const tableStart = schema.indexOf(
  "create table if not exists public.store_pa_quarterly_report_notifications"
);
const tableEnd = schema.indexOf(
  "create or replace function public.prepare_store_pa_quarterly_report_notification",
  tableStart
);
assert.ok(tableStart >= 0 && tableEnd > tableStart);
const outboxTable = schema.slice(tableStart, tableEnd);

test("the PA report outbox is a separate once-per-quarter frozen snapshot", () => {
  assert.match(
    outboxTable,
    /create table if not exists public\.store_pa_quarterly_report_notifications\s*\([\s\S]*period_end date primary key/
  );
  assert.match(
    outboxTable,
    /check \(to_char\(period_end, 'MM-DD'\) in \('03-31', '06-30', '09-30', '12-31'\)\)/
  );

  for (const column of [
    "ready",
    "included_sales",
    "excluded_sales",
    "issue_count",
    "pa_gross_sales_cents",
    "pa_taxable_sales_cents",
    "state_tax_cents",
    "allegheny_tax_cents",
    "philadelphia_tax_cents",
    "issue_code_counts",
    "template_version",
    "source_fingerprint",
    "payload_sha256",
    "snapshot_conflict_at",
  ]) {
    assert.match(outboxTable, new RegExp(`\\b${column}\\b`), column);
  }
  assert.match(outboxTable, /source_fingerprint ~ '\^\[a-f0-9\]\{64\}\$'/);
  assert.match(outboxTable, /payload_sha256 ~ '\^\[a-f0-9\]\{64\}\$'/);

  const prepare = functionSource(
    "prepare_store_pa_quarterly_report_notification"
  );
  assert.match(
    prepare,
    /insert into public\.store_pa_quarterly_report_notifications[\s\S]*on conflict \(period_end\) do nothing/
  );
  assert.doesNotMatch(prepare, /on conflict[\s\S]*do update/);
  assert.match(
    prepare,
    /if v_existing\.due_date is distinct from p_due_date[\s\S]*v_existing\.payload_sha256 is distinct from p_payload_sha256 then[\s\S]*set snapshot_conflict_at = coalesce\([\s\S]*notifications\.snapshot_conflict_at,[\s\S]*now\(\)[\s\S]*last_error_code = 'pa_quarterly_report_snapshot_conflict'/
  );
  const conflictUpdateStart = prepare.indexOf(
    "update public.store_pa_quarterly_report_notifications as notifications"
  );
  const conflictUpdateEnd = prepare.indexOf(
    "returning notifications.* into v_existing",
    conflictUpdateStart
  );
  assert.ok(conflictUpdateStart >= 0 && conflictUpdateEnd > conflictUpdateStart);
  const conflictUpdate = prepare.slice(conflictUpdateStart, conflictUpdateEnd);
  for (const frozenColumn of [
    "due_date",
    "scheduled_for",
    "ready",
    "included_sales",
    "excluded_sales",
    "issue_count",
    "pa_gross_sales_cents",
    "pa_taxable_sales_cents",
    "state_tax_cents",
    "allegheny_tax_cents",
    "philadelphia_tax_cents",
    "issue_code_counts",
    "source_fingerprint",
    "payload_sha256",
  ]) {
    assert.doesNotMatch(conflictUpdate, new RegExp(`\\b${frozenColumn}\\s*=`));
  }
  assert.match(
    prepare,
    /when v_existing\.snapshot_conflict_at is not null then 'manual'/
  );
  assert.match(
    prepare,
    /'sourceFingerprint', v_existing\.source_fingerprint[\s\S]*'payloadSha256', v_existing\.payload_sha256/
  );
});

test("the durable outbox stores aggregates and delivery state, never commerce or identity data", () => {
  const columnNames = [...outboxTable.matchAll(
    /^  ([a-z][a-z0-9_]*)\s+(?:date|timestamptz|boolean|integer|jsonb|text|uuid)\b/gim
  )].map((match) => match[1]);

  assert.ok(columnNames.length > 0);
  for (const forbidden of [
    /customer|recipient|email|phone|address|street|full_name/,
    /(?:tax_.*(?:id|account|license|registration)|sales_license|fein|ein|ssn)/,
    /bank|routing|account_number/,
    /order/,
    /payment|stripe|checkout_session|payment_intent/,
  ]) {
    assert.deepEqual(
      columnNames.filter((column) => forbidden.test(column)),
      [],
      `forbidden outbox columns matching ${forbidden}`
    );
  }

  assert.ok(columnNames.includes("provider_message_id"));
  assert.doesNotMatch(outboxTable, /references\s+public\.store_orders/i);
});

test("prepare, get, list, claim, complete, release, and contract-check RPCs are installed", () => {
  const rpcNames = [
    "prepare_store_pa_quarterly_report_notification",
    "get_store_pa_quarterly_report_notification",
    "list_store_pa_quarterly_report_orders",
    "claim_store_pa_quarterly_report_notification",
    "complete_store_pa_quarterly_report_notification",
    "release_store_pa_quarterly_report_notification",
    "check_store_pa_quarterly_report_contract_v1",
  ];

  for (const name of rpcNames) {
    assert.match(
      schema,
      new RegExp(`create or replace function public\\.${name}\\(`),
      name
    );
  }

  const contract = functionSource(
    "check_store_pa_quarterly_report_contract_v1"
  );
  assert.match(
    contract,
    /to_regclass\('public\.store_pa_quarterly_report_notifications'\)/
  );
  for (const name of rpcNames.slice(0, -1)) {
    assert.match(contract, new RegExp(`to_regprocedure\\([\\s\\S]*${name}`), name);
  }
  assert.match(contract, /relations\.relrowsecurity is true/);
  assert.match(contract, /has_table_privilege\([\s\S]*'service_role'[\s\S]*'SELECT'/);
  assert.match(
    contract,
    /has_function_privilege\('anon', v_function, 'EXECUTE'\)[\s\S]*not has_function_privilege\('service_role', v_function, 'EXECUTE'\)/
  );
});

test("claiming stops automatic retries after the 23-hour delivery ambiguity boundary", () => {
  const claim = functionSource(
    "claim_store_pa_quarterly_report_notification"
  );

  assert.match(
    claim,
    /delivery_uncertain_at is not null[\s\S]*first_attempt_at < now\(\) - interval '23 hours'[\s\S]*delivery_uncertain_at = coalesce\(delivery_uncertain_at, now\(\)\)[\s\S]*return 'manual'/
  );
  assert.match(
    claim,
    /snapshot_conflict_at is not null[\s\S]*claim_token = null[\s\S]*return 'manual'/
  );
  assert.ok(
    claim.indexOf("return 'manual'") < claim.indexOf("return 'busy'"),
    "the ambiguity guard runs before a new lease can be issued"
  );
  assert.match(
    claim,
    /p_lease_seconds integer default 300[\s\S]*p_lease_seconds not between 30 and 900/
  );
});

test("the order-list RPC exposes only locality fields from an address", () => {
  const list = functionSource("list_store_pa_quarterly_report_orders");
  const projectionStart = list.indexOf("'shipping_address', case");
  const projectionEnd = list.indexOf("'currency', orders.currency", projectionStart);

  assert.ok(projectionStart >= 0 && projectionEnd > projectionStart);
  const addressProjection = list.slice(projectionStart, projectionEnd);
  const outputKeys = [...addressProjection.matchAll(
    /(?:jsonb_build_object\(\s*|,\s*)'([a-z_]+)'\s*,/g
  )].map((match) => match[1]);

  assert.deepEqual(outputKeys, [
    "address",
    "city",
    "state",
    "postal_code",
    "country",
  ]);
  assert.doesNotMatch(
    list,
    /customer_(?:email|name|phone)|billing_address|address_line|line1|line2/
  );
  assert.match(list, /'has_dispute', orders\.dispute_id is not null/);
  assert.doesNotMatch(list, /'(?:id|order_number|dispute_id)'\s*,/);
  assert.match(
    list,
    /now\(\) < p_period_end_exclusive \+ interval '24 hours'[\s\S]*source settlement window is open/
  );
  assert.match(
    list,
    /inventory_state = 'reserved'[\s\S]*created_at >= p_period_start - interval '24 hours'[\s\S]*created_at < p_period_end_exclusive[\s\S]*source ledger is not settled/
  );
  assert.doesNotMatch(addressProjection, /else\s+orders\.shipping_address\b/);
});

test("the outbox and every RPC are private and service-role scoped", () => {
  assert.match(
    compactSchema,
    /alter table public\.store_pa_quarterly_report_notifications enable row level security;/
  );
  assert.match(
    compactSchema,
    /create policy store_pa_quarterly_report_notifications_private on public\.store_pa_quarterly_report_notifications for all using \(false\) with check \(false\);/
  );
  assert.match(
    compactSchema,
    /revoke all on public\.store_pa_quarterly_report_notifications from public, anon, authenticated, service_role;/
  );

  for (const name of [
    "prepare_store_pa_quarterly_report_notification",
    "get_store_pa_quarterly_report_notification",
    "list_store_pa_quarterly_report_orders",
    "claim_store_pa_quarterly_report_notification",
    "complete_store_pa_quarterly_report_notification",
    "release_store_pa_quarterly_report_notification",
    "check_store_pa_quarterly_report_contract_v1",
  ]) {
    assert.match(
      compactSchema,
      new RegExp(
        `revoke all on function public\\.${name}\\([^;]*\\) from public, anon, authenticated;`
      ),
      `${name} public execute revoked`
    );
    assert.match(
      compactSchema,
      new RegExp(
        `grant execute on function public\\.${name}\\([^;]*\\) to service_role;`
      ),
      `${name} service-role execute granted`
    );
  }
});

test("the example environment uses dedicated quarterly-report controls", () => {
  const expected = [
    "STORE_PA_TAX_REPORT_ENABLED=false",
    "STORE_PA_TAX_REPORT_EMAIL=",
    "STORE_PA_TAX_REPORT_START_PERIOD_END=2026-09-30",
    "STORE_PA_TAX_REPORT_DELIVERY_CONFIRMED=false",
  ];

  for (const setting of expected) {
    assert.equal(
      environmentExample.split(setting).length - 1,
      1,
      `${setting.split("=")[0]} is declared exactly once`
    );
  }
  assert.match(
    environmentExample,
    /STORE_PA_TAX_REPORT_ENABLED=false[\s\S]*STORE_PA_TAX_REPORT_EMAIL=[\s\S]*STORE_PA_TAX_REPORT_START_PERIOD_END=2026-09-30[\s\S]*STORE_PA_TAX_REPORT_DELIVERY_CONFIRMED=false/
  );
});
