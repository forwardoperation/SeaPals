import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(
  new URL("../../../supabase/store-orders.sql", import.meta.url),
  "utf8"
);
const webhook = readFileSync(
  new URL("../../app/api/store/webhook/route.js", import.meta.url),
  "utf8"
);
const serverNotification = readFileSync(
  new URL("./merchantOrderNotification.js", import.meta.url),
  "utf8"
);

test("paid reconciliation atomically creates one merchant-purchase outbox row", () => {
  assert.match(
    schema,
    /create table if not exists public\.store_order_notifications/
  );
  assert.match(
    schema,
    /store_order_notifications_order_type_idx[\s\S]*order_id, notification_type/
  );
  assert.match(
    schema,
    /if p_payment_status = 'paid' then[\s\S]*insert into public\.store_order_notifications[\s\S]*orders\.payment_status = 'paid'[\s\S]*on conflict \(order_id, notification_type\) do nothing/
  );

  const paymentFunctionStart = schema.indexOf(
    "create or replace function public.process_store_payment_event"
  );
  const paymentFunctionEnd = schema.indexOf(
    "create or replace function public.process_store_refund_event",
    paymentFunctionStart
  );
  const paymentFunction = schema.slice(paymentFunctionStart, paymentFunctionEnd);
  const orderUpdate = paymentFunction.lastIndexOf("update public.store_orders");
  const enqueue = paymentFunction.indexOf(
    "insert into public.store_order_notifications",
    orderUpdate
  );
  const eventComplete = paymentFunction.indexOf(
    "update public.store_payment_events",
    enqueue
  );
  assert.ok(orderUpdate >= 0 && enqueue > orderUpdate && eventComplete > enqueue);
});

test("a duplicate paid webhook repairs a missing outbox row before returning idempotently", () => {
  assert.match(
    schema,
    /if v_inserted = 0 then[\s\S]*p_payment_status = 'paid'[\s\S]*insert into public\.store_order_notifications[\s\S]*events\.provider_event_id = p_provider_event_id[\s\S]*return false/
  );
});

test("outbox delivery uses a bounded lease and token-checked completion or release", () => {
  assert.match(
    schema,
    /create or replace function public\.claim_store_order_notification\([\s\S]*p_lease_seconds integer default 300[\s\S]*between 30 and 900/
  );
  assert.match(
    schema,
    /claimed_until > now\(\)[\s\S]*claim_token <> p_claim_token[\s\S]*return 'busy'/
  );
  assert.match(
    schema,
    /make_interval\(secs => p_lease_seconds\)[\s\S]*attempt_count = attempt_count \+ 1/
  );
  assert.match(
    schema,
    /create or replace function public\.complete_store_order_notification\([\s\S]*sent_at = coalesce\(sent_at, now\(\)\)[\s\S]*claim_token = p_claim_token/
  );
  assert.match(
    schema,
    /create or replace function public\.release_store_order_notification\([\s\S]*last_error_code = v_failure_code[\s\S]*claim_token = p_claim_token/
  );
});

test("notification outbox and mutation RPCs are private and service-role scoped", () => {
  assert.match(
    schema,
    /alter table public\.store_order_notifications enable row level security/
  );
  assert.match(
    schema,
    /create policy "Store order notifications are private"[\s\S]*using \(false\) with check \(false\)/
  );
  assert.match(
    schema,
    /revoke all on public\.store_order_notifications from service_role/
  );
  for (const name of ["claim", "complete", "release"]) {
    assert.match(
      schema,
      new RegExp(
        `revoke all on function public\\.${name}_store_order_notification\\([\\s\\S]*from public, anon, authenticated`
      )
    );
    assert.match(
      schema,
      new RegExp(
        `grant execute on function public\\.${name}_store_order_notification\\([\\s\\S]*to service_role`
      )
    );
  }
});

test("v5 readiness contract detects the outbox table, drainer, and all RPCs", () => {
  assert.match(
    schema,
    /create or replace function public\.check_store_inventory_contract_v5\(\)/
  );
  assert.match(schema, /to_regclass\('public\.store_order_notifications'\)/);
  for (const column of [
    "order_id",
    "notification_type",
    "attempt_count",
    "claim_token",
    "claimed_until",
    "sent_at",
    "last_error_code",
  ]) {
    assert.match(schema, new RegExp(`'${column}'`));
  }
  for (const name of ["claim", "complete", "release"]) {
    assert.match(
      schema,
      new RegExp(`to_regprocedure\\([\\s\\S]*${name}_store_order_notification`)
    );
  }
  assert.match(
    schema,
    /to_regprocedure\([\s\S]*list_pending_store_order_notifications/
  );
});

test("the scheduled drainer keeps paid-transition alerts eligible after later lifecycle changes", () => {
  const listFunctionStart = schema.indexOf(
    "create or replace function public.list_pending_store_order_notifications"
  );
  const listFunctionEnd = schema.indexOf(
    "create or replace function public.add_store_business_days",
    listFunctionStart
  );
  const listFunction = schema.slice(listFunctionStart, listFunctionEnd);

  assert.match(
    listFunction,
    /create or replace function public\.list_pending_store_order_notifications\([\s\S]*p_limit integer default 25[\s\S]*p_limit not between 1 and 50/
  );
  assert.match(
    listFunction,
    /notifications\.notification_type = 'merchant_purchase'[\s\S]*notifications\.sent_at is null[\s\S]*notifications\.claimed_until <= now\(\)/
  );
  assert.doesNotMatch(listFunction, /join public\.store_orders/);
  assert.doesNotMatch(listFunction, /orders\.payment_status/);
  assert.match(
    schema,
    /revoke all on function public\.list_pending_store_order_notifications\(integer\)[\s\S]*from public, anon, authenticated/
  );
  assert.match(
    schema,
    /grant execute on function public\.list_pending_store_order_notifications\(integer\)[\s\S]*to service_role/
  );
});

test("the signed webhook retries paid notification delivery after ledger idempotency", () => {
  const processIndex = webhook.indexOf("processStorePaymentEvent(details)");
  const notifyIndex = webhook.indexOf(
    "deliverPaidStoreOrderMerchantNotification(details)"
  );
  assert.ok(processIndex >= 0 && notifyIndex > processIndex);
  assert.match(serverNotification, /details\?\.paymentStatus !== "paid"/);
  assert.match(serverNotification, /claim_store_order_notification/);
  assert.match(serverNotification, /complete_store_order_notification/);
  assert.match(serverNotification, /release_store_order_notification/);
});

test("webhook diagnostics log only safe codes, not provider errors or customer data", () => {
  assert.match(webhook, /console\.error\("Store payment webhook failed", safeErrorCode\(error\)\)/);
  assert.doesNotMatch(
    webhook,
    /console\.error\("Store payment webhook failed",\s*error\s*\)/
  );
});
