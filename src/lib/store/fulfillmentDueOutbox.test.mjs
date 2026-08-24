import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [schema, worker, wrangler, readiness, focusedMigration] =
  await Promise.all([
    "../../../supabase/store-orders.sql",
    "../../../custom-worker.mjs",
    "../../../wrangler.jsonc",
    "../../../scripts/check-store-readiness.mjs",
    "../../../supabase/fulfillment-due-reminders.sql",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));

function normalizedFunctionSource(source, name) {
  const start = source.indexOf(
    `create or replace function public.${name}(`
  );
  const end = source.indexOf("\n$$;", start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 4).replace(/\s+/g, " ").trim();
}

test("the focused Supabase paste is transactional, private, and complete", () => {
  assert.match(focusedMigration, /^--[\s\S]*\nbegin;/);
  assert.match(
    focusedMigration,
    /check_store_inventory_contract_v6\(\)[\s\S]*is distinct from true/
  );
  assert.match(
    focusedMigration,
    /store_order_notifications_notification_type_check[\s\S]*'merchant_purchase'[\s\S]*'merchant_fulfillment_due'/
  );
  for (const name of [
    "claim_store_order_notification",
    "complete_store_order_notification",
    "release_store_order_notification",
    "add_store_business_days",
    "prepare_store_fulfillment_due_notifications",
    "check_store_inventory_contract_v7",
  ]) {
    assert.match(
      focusedMigration,
      new RegExp(`create or replace function public\\.${name}\\(`),
      name
    );
  }
  assert.match(focusedMigration, /notify pgrst, 'reload schema';/);
  assert.match(
    focusedMigration,
    /check_store_inventory_contract_v7\(\) is distinct from true[\s\S]*commit;[\s\S]*fulfillment_reminders_ready/
  );
  assert.doesNotMatch(
    focusedMigration,
    /\b(?:delete|truncate)\s+(?:from\s+)?public\.store_orders|drop\s+table/i
  );
});

test("the focused paste uses the exact reviewed function definitions", () => {
  for (const name of [
    "claim_store_order_notification",
    "complete_store_order_notification",
    "release_store_order_notification",
    "add_store_business_days",
    "prepare_store_fulfillment_due_notifications",
    "check_store_inventory_contract_v7",
  ]) {
    assert.equal(
      normalizedFunctionSource(focusedMigration, name),
      normalizedFunctionSource(schema, name),
      name
    );
  }
});

test("the private outbox accepts one purchase alert and one due reminder per order", () => {
  assert.match(
    schema,
    /store_order_notifications_notification_type_check[\s\S]*'merchant_purchase'[\s\S]*'merchant_fulfillment_due'/
  );
  assert.match(
    schema,
    /create unique index if not exists store_order_notifications_order_type_idx[\s\S]*order_id, notification_type/
  );
  assert.match(
    schema,
    /alter table public\.store_order_notifications[\s\S]*drop constraint if exists store_order_notifications_notification_type_check[\s\S]*add constraint store_order_notifications_notification_type_check/
  );
});

test("due preparation covers Standard and expedited live orders in Eastern business time", () => {
  const start = schema.indexOf(
    "create or replace function public.prepare_store_fulfillment_due_notifications"
  );
  const end = schema.indexOf(
    "drop function if exists public.list_overdue_store_inventory_reservations",
    start
  );
  const source = schema.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(source, /p_limit integer default 25/);
  assert.match(source, /p_now timestamptz default now\(\)/);
  assert.match(source, /payment_status = 'paid'/);
  assert.match(source, /payment_livemode is true/);
  assert.doesNotMatch(source, /and orders\.paid_at is not null/);
  assert.match(source, /production_option_id = 'expedited-production'[\s\S]*production_due_date/);
  assert.match(
    source,
    /add_store_business_days\([\s\S]*paid_at at time zone 'America\/New_York'[\s\S]*production_max_business_days/
  );
  assert.match(source, /time '09:00'/);
  assert.match(source, /v_local_date between windows\.reminder_date and windows\.due_date/);
  assert.equal(
    source.match(/v_local_time >= time '09:00'/g)?.length,
    1,
    "only newly queued rows are restricted to the creation window"
  );
  assert.match(
    source,
    /return query[\s\S]*notifications\.sent_at is null[\s\S]*deadlines\.pending_due_date is not null/
  );
  assert.match(
    source,
    /extract\(isodow from deadlines\.due_date\)::integer[\s\S]*then 3/
  );
});

test("readiness milestones and stale-row cleanup are encoded without copying PII", () => {
  const prepareStart = schema.indexOf(
    "create or replace function public.prepare_store_fulfillment_due_notifications"
  );
  const prepareEnd = schema.indexOf(
    "drop function if exists public.list_overdue_store_inventory_reservations",
    prepareStart
  );
  const source = schema.slice(prepareStart, prepareEnd);
  const tableStart = schema.indexOf(
    "create table if not exists public.store_order_notifications"
  );
  const tableEnd = schema.indexOf(
    "create index if not exists store_orders_created_at_idx",
    tableStart
  );
  const table = schema.slice(tableStart, tableEnd);

  assert.match(source, /fulfillment_method = 'shipping'[\s\S]*'awaiting_shipment'[\s\S]*'shipped'/);
  assert.match(source, /fulfillment_method = 'pickup'[\s\S]*'ready_for_pickup'[\s\S]*'picked_up'/);
  assert.match(source, /fulfillment_status <> 'cancelled'/);
  assert.match(source, /notification_type = 'merchant_fulfillment_due'[\s\S]*sent_at is null/);
  assert.doesNotMatch(table, /customer_email|customer_name|shipping_address/);
});

test("all outbox mutations validate and protect the due-reminder type", () => {
  for (const name of ["claim", "complete", "release"]) {
    const start = schema.indexOf(
      `create or replace function public.${name}_store_order_notification`
    );
    assert.ok(start >= 0, name);
    assert.match(
      schema.slice(start, start + 2500),
      /p_notification_type is null or p_notification_type not in \([\s\S]*'merchant_purchase'[\s\S]*'merchant_fulfillment_due'/,
      name
    );
  }
  assert.match(
    schema,
    /revoke all on function public\.prepare_store_fulfillment_due_notifications\([\s\S]*from public, anon, authenticated/
  );
  assert.match(
    schema,
    /grant execute on function public\.prepare_store_fulfillment_due_notifications\([\s\S]*to service_role/
  );
});

test("v7 readiness proves that the due-reminder contract is installed", () => {
  assert.ok(
    schema.indexOf("drop function if exists public.check_store_inventory_contract_v7()") <
      schema.indexOf("drop function if exists public.check_store_inventory_contract_v6()")
  );
  assert.match(
    schema,
    /check_store_inventory_contract_v7\([\s\S]*check_store_inventory_contract_v6\(\)[\s\S]*prepare_store_fulfillment_due_notifications[\s\S]*merchant_fulfillment_due/
  );
  assert.match(readiness, /check_store_inventory_contract_v7/);
});

test("the five-minute Worker runs and safely reports the reminder drain", () => {
  assert.match(
    worker,
    /import \{ drainFulfillmentDueNotifications \} from "\.\/src\/lib\/store\/fulfillmentDueNotificationDrain\.mjs"/
  );
  assert.match(
    worker,
    /drainFulfillmentDueNotifications\(\{[\s\S]*environment,[\s\S]*new Date\(controller\.scheduledTime\)[\s\S]*currentTime: \(\) => new Date\(\)/
  );
  assert.match(worker, /Store fulfillment reminder cron completed/);
  assert.match(worker, /Store fulfillment reminder cron failed/);
  assert.match(worker, /Promise\.allSettled/);
  assert.match(wrangler, /"crons": \["\*\/5 \* \* \* \*"\]/);
  assert.match(
    wrangler,
    /"STORE_FULFILLMENT_DUE_NOTIFICATION_ENABLED": "true"/
  );
});
