import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(
  new URL("../../../supabase/store-orders.sql", import.meta.url),
  "utf8"
);

test("inventory reservation creation is one atomic row-locking RPC", () => {
  assert.match(schema, /create table if not exists public\.store_inventory/);
  assert.match(schema, /create or replace function public\.reserve_store_order_inventory/);
  assert.match(schema, /for update;/);
  assert.match(schema, /order by item\.sku/);
  assert.match(schema, /reserved_quantity = reserved_quantity \+ v_item\.quantity/);
  assert.match(schema, /insert into public\.store_orders/);
  assert.match(schema, /insert into public\.store_order_items/);
  assert.match(schema, /store_inventory_unavailable/);
  assert.match(schema, /p_total_cents\s*<>\s*p_subtotal_cents \+ p_production_cents \+ p_shipping_cents/);
  assert.match(schema, /'production_option_id', p_production_option_id/);
  assert.match(
    schema,
    /returns table \([\s\S]*production_due_date date,[\s\S]*expedited_capacity_state text/
  );
});

test("order snapshots enforce at most eight units per line and per cart", () => {
  const reservationStart = schema.indexOf(
    "create or replace function public.reserve_store_order_inventory"
  );
  const reservationEnd = schema.indexOf(
    "create or replace function public.attach_store_checkout_session",
    reservationStart
  );
  const reservationFunction = schema.slice(reservationStart, reservationEnd);

  assert.match(
    schema,
    /quantity integer not null check \(quantity between 1 and 8\)/
  );
  assert.match(
    schema,
    /drop constraint if exists store_order_items_quantity_check;[\s\S]*add constraint store_order_items_quantity_check[\s\S]*check \(quantity between 1 and 8\)/
  );
  assert.match(reservationFunction, /jsonb_array_length\(p_items\) > 8/);
  assert.match(reservationFunction, /item\.quantity not between 1 and 8/);
  assert.match(
    reservationFunction,
    /select coalesce\(sum\(item\.quantity\), 0\)[\s\S]*\) > 8 then/
  );
  assert.doesNotMatch(reservationFunction, /jsonb_array_length\(p_items\) > 20/);
  assert.doesNotMatch(reservationFunction, /item\.quantity not between 1 and 10/);
});

test("expedited production atomically caps each New York business-day bucket at ten orders", () => {
  assert.match(schema, /add column if not exists production_due_date date/);
  assert.match(
    schema,
    /add column if not exists expedited_capacity_state text/
  );
  assert.match(
    schema,
    /store_orders_expedited_capacity_active_idx[\s\S]*production_due_date, expedited_capacity_state[\s\S]*'reserved', 'committed'/
  );
  assert.match(
    schema,
    /v_local_order_date := \(now\(\) at time zone 'America\/New_York'\)::date/
  );
  assert.match(
    schema,
    /extract\(isodow from v_local_order_date\)[\s\S]*when 5 then 3[\s\S]*when 6 then 2[\s\S]*else 1/
  );
  assert.match(
    schema,
    /pg_advisory_xact_lock\([\s\S]*hashtext\('store_expedited_capacity'\)[\s\S]*v_production_due_date - date '2000-01-01'/
  );
  assert.match(
    schema,
    /expedited_capacity_state in \('reserved', 'committed'\)[\s\S]*v_active_expedited_count >= 10[\s\S]*store_expedited_capacity_unavailable/
  );

  const replayLookup = schema.indexOf(
    "where orders.checkout_request_id = p_checkout_request_id"
  );
  const dueDateComputation = schema.indexOf(
    "v_local_order_date := (now() at time zone 'America/New_York')::date"
  );
  const snapshotStart = schema.indexOf(
    "v_request_snapshot := jsonb_build_object("
  );
  const replayLock = schema.indexOf(
    "-- Serialize identical HTTP request IDs",
    snapshotStart
  );
  assert.ok(replayLookup >= 0);
  assert.ok(dueDateComputation > replayLookup);
  assert.ok(snapshotStart >= 0 && replayLock > snapshotStart);
  assert.doesNotMatch(
    schema.slice(snapshotStart, replayLock),
    /production_due_date|expedited_capacity_state/
  );
});

test("expedited capacity releases only terminal unpaid reservations and never reopens committed slots", () => {
  assert.match(
    schema,
    /set inventory_state = 'released',[\s\S]*expedited_capacity_state = case[\s\S]*when expedited_capacity_state = 'reserved' then 'released'/
  );
  assert.match(
    schema,
    /expedited_capacity_state = case[\s\S]*'partially_refunded',[\s\S]*'refunded',[\s\S]*'disputed'[\s\S]*expedited_capacity_state = 'reserved' then 'committed'[\s\S]*p_payment_status = 'failed'[\s\S]*then 'released'/
  );
  assert.match(
    schema,
    /new\.production_due_date is distinct from old\.production_due_date[\s\S]*Order production option snapshots are immutable/
  );
  assert.match(
    schema,
    /old\.expedited_capacity_state = 'reserved'[\s\S]*new\.expedited_capacity_state in \('committed', 'released'\)[\s\S]*forward-only/
  );
});

test("paid and terminal failed events atomically finalize inventory once", () => {
  assert.match(
    schema,
    /on_hand_quantity = on_hand_quantity - v_item\.quantity,[\s\S]*reserved_quantity = reserved_quantity - v_item\.quantity/
  );
  assert.match(
    schema,
    /p_event_type = 'payment_intent\.payment_failed'[\s\S]*p_payment_status = 'pending'/
  );
  assert.match(
    schema,
    /p_event_type in \([\s\S]*'checkout\.session\.async_payment_failed',[\s\S]*'checkout\.session\.expired'[\s\S]*p_payment_status = 'failed'/
  );
  assert.match(
    schema,
    /p_payment_status in \([\s\S]*'paid',[\s\S]*'partially_refunded',[\s\S]*'refunded',[\s\S]*'disputed'[\s\S]*inventory_state in \('reserved', 'committed'\)/
  );
  assert.match(schema, /on conflict \(provider_event_id\) do nothing/);
  assert.match(
    schema,
    /p_subtotal_cents \+ p_production_cents \+ p_shipping_cents \+ p_tax_cents/
  );
});

test("checkout rollback callers use the SQL release-reason allowlist exactly", () => {
  const ordersSource = readFileSync(
    new URL("./orders.js", import.meta.url),
    "utf8"
  );
  const checkoutRouteSource = readFileSync(
    new URL("../../app/api/store/checkout/route.js", import.meta.url),
    "utf8"
  );
  const allowedReasons = [
    "Checkout session creation failed",
    "Stripe session expired after attach failure",
    "Order creation did not complete",
    "Order creation returned an invalid response",
  ];

  for (const reason of allowedReasons) {
    assert.match(schema, new RegExp(`'${reason}'`));
    assert.match(`${ordersSource}\n${checkoutRouteSource}`, new RegExp(`"${reason}"`));
    assert.doesNotMatch(
      `${ordersSource}\n${checkoutRouteSource}`,
      new RegExp(`"${reason}\\."`)
    );
  }
});

test("daily expedited capacity failures become a specific 409 checkout response", () => {
  const ordersSource = readFileSync(
    new URL("./orders.js", import.meta.url),
    "utf8"
  );
  const checkoutRouteSource = readFileSync(
    new URL("../../app/api/store/checkout/route.js", import.meta.url),
    "utf8"
  );

  assert.match(ordersSource, /expeditedCapacityReservationIsUnavailable\(error\)/);
  assert.match(
    ordersSource,
    /code: "expedited_capacity_unavailable",[\s\S]*status: 409/
  );
  assert.match(
    checkoutRouteSource,
    /error\.code === "expedited_capacity_unavailable"[\s\S]*Expedited production is full for the next business day\. Choose Standard production or try again\./
  );
});

test("inventory data and mutating RPCs are service-role only", () => {
  assert.match(schema, /alter table public\.store_inventory enable row level security/);
  assert.match(
    schema,
    /create policy "Store inventory is private"[\s\S]*using \(false\) with check \(false\)/
  );
  assert.match(
    schema,
    /revoke all on function public\.reserve_store_order_inventory\([\s\S]*from public, anon, authenticated/
  );
  assert.match(
    schema,
    /grant execute on function public\.reserve_store_order_inventory\([\s\S]*to service_role/
  );
  assert.match(schema, /revoke all on public\.store_order_items from service_role/);
  assert.match(schema, /grant select on public\.store_order_items to service_role/);
});

test("the readiness probe validates the complete inventory contract without writes", () => {
  assert.match(
    schema,
    /drop function if exists public\.check_store_inventory_contract\(\)/
  );
  assert.match(
    schema,
    /create or replace function public\.check_store_inventory_contract_v4\(\)/
  );
  assert.doesNotMatch(
    schema,
    /create or replace function public\.check_store_inventory_contract\(\)/
  );
  assert.match(schema, /language sql[\s\S]*stable[\s\S]*security definer/);
  assert.match(schema, /to_regclass\('public\.store_inventory'\)/);
  assert.match(schema, /to_regprocedure\([\s\S]*reserve_store_order_inventory/);
  assert.match(
    schema,
    /functions\.proargnames::text\[\] @> array\[[\s\S]*'production_due_date',[\s\S]*'expedited_capacity_state'/
  );
  assert.match(schema, /to_regprocedure\([\s\S]*process_store_payment_event/);
  assert.match(schema, /production_max_business_days/);
  assert.match(schema, /'production_due_date'/);
  assert.match(schema, /'expedited_capacity_state'/);
  assert.match(
    schema,
    /to_regclass\(\s*'public\.store_orders_expedited_capacity_active_idx'\s*\)/
  );
  assert.match(
    schema,
    /revoke all on function public\.check_store_inventory_contract_v4\(\)\s*from public, anon, authenticated/
  );
  assert.match(
    schema,
    /grant execute on function public\.check_store_inventory_contract_v4\(\)\s*to service_role/
  );
  assert.match(schema, /Order production option snapshots are immutable/);
});
