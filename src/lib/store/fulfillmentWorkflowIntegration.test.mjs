import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [admin, route, orders, schema, readiness] = await Promise.all(
  [
    "../../app/admin/orders/OrdersDashboard.jsx",
    "../../app/api/admin/store-orders/route.js",
    "./orders.js",
    "../../../supabase/store-orders.sql",
    "../../../scripts/check-store-readiness.mjs",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8"))
);

test("the admin exposes the shipping and pickup production workflows", () => {
  assert.match(admin, /Awaiting production/);
  assert.match(admin, /In production/);
  assert.match(admin, /Packing/);
  assert.match(admin, /Awaiting shipment/);
  assert.match(admin, /Ready for pickup/);
  assert.match(admin, /expanded \? "Close" : "Manage"/);
  assert.match(admin, /Paid & unshipped/);
  assert.match(admin, /Shipping queue/);
  assert.match(admin, /storeFulfillmentStatusLabel\(status\)/);
});

test("the API and order writer share the canonical status validation", () => {
  assert.match(
    route,
    /cleanText\(payload\?\.fulfillmentStatus, 40\)\.toLowerCase\(\)/
  );
  assert.match(route, /isStoreFulfillmentStatus\(fulfillmentStatus\)/);
  assert.match(
    orders,
    /isFulfillmentStatusAllowedForMethod\([\s\S]*fulfillmentStatus/
  );
  assert.match(orders, /isPaidFulfillmentAdvancement\(fulfillmentStatus\)/);
  assert.match(
    orders,
    /\["shipped", "picked_up"\]\.includes\(fulfillmentStatus\)/
  );
});

test("rush production stays actionable until carrier dispatch", () => {
  const completionStatuses =
    /const SHIPPING_PRODUCTION_COMPLETE_STATUSES = new Set\(\[([\s\S]*?)\]\);/.exec(
      admin
    )?.[1] ?? "";

  assert.doesNotMatch(completionStatuses, /awaiting_shipment/);
  assert.match(admin, /Paid rush orders not yet dispatched/);
});

test("the SQL migration accepts and protects both new active states", () => {
  assert.match(
    schema,
    /store_orders_fulfillment_status_check[\s\S]*'in_production'[\s\S]*'awaiting_shipment'/
  );
  assert.match(
    schema,
    /fulfillment_method = 'pickup'[\s\S]*fulfillment_status in \('awaiting_shipment', 'shipped'\)/
  );
  assert.match(
    schema,
    /new\.fulfillment_status in \([\s\S]*'in_production'[\s\S]*'awaiting_shipment'[\s\S]*new\.payment_status <> 'paid'/
  );
  assert.match(
    schema,
    /p_payment_status = 'refunded'[\s\S]*'in_production'[\s\S]*'awaiting_shipment'[\s\S]*then 'cancelled'/
  );
  assert.match(readiness, /check_store_inventory_contract_v6/);
});
