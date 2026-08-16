import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(
  new URL("../../../supabase/store-orders.sql", import.meta.url),
  "utf8"
);
const webhookRoute = readFileSync(
  new URL("../../app/api/store/webhook/route.js", import.meta.url),
  "utf8"
);
const ordersSource = readFileSync(new URL("./orders.js", import.meta.url), "utf8");
const operations = readFileSync(
  new URL("../../../docs/store-inventory-operations.md", import.meta.url),
  "utf8"
);

function sqlFunction(name, nextMarker) {
  const start = schema.indexOf(`create or replace function public.${name}`);
  const end = schema.indexOf(nextMarker, start);
  assert.ok(start >= 0, `${name} must exist`);
  assert.ok(end > start, `${name} must have a stable end marker`);
  return schema.slice(start, end);
}

test("Refund objects have a private lifecycle ledger and service-role-only RPC", () => {
  assert.match(schema, /create table if not exists public\.store_refunds/);
  assert.match(
    schema,
    /status in \([\s\S]*'pending',[\s\S]*'requires_action',[\s\S]*'succeeded',[\s\S]*'failed',[\s\S]*'canceled'/
  );
  assert.match(schema, /alter table public\.store_refunds enable row level security/);
  assert.match(
    schema,
    /create policy "Store refunds are private"[\s\S]*using \(false\) with check \(false\)/
  );
  assert.match(
    schema,
    /revoke all on function public\.process_store_refund_event\([\s\S]*from public, anon, authenticated/
  );
  assert.match(
    schema,
    /grant execute on function public\.process_store_refund_event\([\s\S]*to service_role/
  );
  assert.match(
    schema,
    /check_store_inventory_contract_v5\([\s\S]*to_regclass\('public\.store_refunds'\)[\s\S]*process_store_refund_event/
  );
  assert.match(schema, /add column if not exists refund_lifecycle_started_at/);
});

test("only succeeded refunds change the refunded total and failures reverse prior success", () => {
  const refundFunction = sqlFunction(
    "process_store_refund_event",
    "drop function if exists public.process_store_dispute_event"
  );

  assert.match(
    refundFunction,
    /v_previous_status = 'succeeded'[\s\S]*p_refund_status <> 'succeeded'[\s\S]*v_refund_delta := -p_amount_cents/
  );
  assert.match(
    refundFunction,
    /coalesce\(v_previous_status, ''\) <> 'succeeded'[\s\S]*p_refund_status = 'succeeded'[\s\S]*v_refund_delta := p_amount_cents/
  );
  assert.match(
    refundFunction,
    /p_refund_created_at < v_order\.refund_lifecycle_started_at[\s\S]*p_refund_status <> 'succeeded'[\s\S]*v_refund_delta := -p_amount_cents/
  );
  assert.match(
    refundFunction,
    /amount_refunded_cents = v_refunded_total[\s\S]*when v_refunded_total = total_cents[\s\S]*then 'refunded'/
  );
  assert.match(
    refundFunction,
    /payment_status in \('disputed', 'chargeback'\) then payment_status/
  );
  assert.match(
    refundFunction,
    /refunds\.status in \([\s\S]*'pending',[\s\S]*'requires_action',[\s\S]*'failed',[\s\S]*'canceled'/
  );
  assert.match(
    refundFunction,
    /p_amount_cents > v_order\.total_cents[\s\S]*larger than the order total/
  );
  assert.doesNotMatch(
    refundFunction,
    /on_hand_quantity = on_hand_quantity \+/
  );
});

test("the webhook uses Refund events as authority and ignores charge.refunded snapshots", () => {
  for (const eventType of ["refund.created", "refund.updated", "refund.failed"]) {
    assert.match(webhookRoute, new RegExp(`"${eventType.replace(".", "\\.")}"`));
    assert.match(operations, new RegExp(`\`${eventType.replace(".", "\\.")}\``));
  }

  assert.match(
    webhookRoute,
    /event\.type === "charge\.refunded"[\s\S]*received: true, ignored: true/
  );
  assert.match(webhookRoute, /processStoreRefundEvent\(details\)/);
  assert.match(ordersSource, /supabase\.rpc\("process_store_refund_event"/);
  assert.match(operations, /Charge snapshot[\s\S]*must never mark an order refunded/);
});

test("closed disputes resolve to won or chargeback without restocking", () => {
  const disputeFunction = sqlFunction(
    "process_store_dispute_event",
    "alter table public.store_orders enable row level security"
  );

  assert.match(webhookRoute, /"charge\.dispute\.closed"/);
  assert.match(
    disputeFunction,
    /p_dispute_status = 'lost' then 'chargeback'/
  );
  assert.match(
    disputeFunction,
    /when amount_refunded_cents = total_cents[\s\S]*then 'refunded'[\s\S]*when amount_refunded_cents > 0 then 'partially_refunded'[\s\S]*else 'paid'/
  );
  assert.doesNotMatch(
    disputeFunction,
    /on_hand_quantity = on_hand_quantity \+/
  );
  assert.match(operations, /late win[\s\S]*never restarts/i);
});
