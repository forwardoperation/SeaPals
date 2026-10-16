import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const schema = await readFile(new URL("../../../supabase/store-orders.sql", import.meta.url), "utf8");
const migration = await readFile(new URL("../../../supabase/store-preorders.sql", import.meta.url), "utf8");

const catalog = {
  starter: ["starter-kit", "SP-KIT-STARTER", 4400],
  deck: ["coral-garden", "SP-DECK-CORAL-GARDEN", 2200],
  pack: ["deep-dive-pack", "SP-PACK-DEEP", 1000],
  dice: ["accessory-set", "SP-ACC-SET", 1200],
};
function item(key, quantity = 1) {
  const [product_id, sku, unit_amount_cents] = catalog[key];
  return {
    product_id, sku, unit_amount_cents, quantity,
    product_category: ["starter", "deck"].includes(key) ? "expansion-decks" : "dive-packs",
    product_name: product_id,
    deck_id: null,
    line_total_cents: unit_amount_cents * quantity,
  };
}

async function fixture({ legacy = false, manufacturing = false } = {}) {
  const db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;");
  // PGlite provides gen_random_uuid in core, but cannot load Supabase's extension.
  await db.exec(schema.replace("create extension if not exists pgcrypto;", ""));
  await db.query("insert into store_inventory(sku,on_hand_quantity,reserved_quantity) select x,10,0 from unnest($1::text[]) as x", [Object.values(catalog).map(([, sku]) => sku)]);
  if (manufacturing) {
    for (const file of ["manufacturing.sql", "manufacturing-inventory.sql", "manufacturing-dispatch.sql"]) {
      await db.exec(await readFile(new URL(`../../../supabase/${file}`, import.meta.url), "utf8"));
    }
  }
  if (!legacy) await db.exec(migration);
  const rpc = async (name, args) => {
    const entries = Object.entries(args);
    assert.match(name, /^[a-z_][a-z_0-9]*$/);
    const result = await db.query(`select * from ${name}(${entries.map(([key], i) => `${key} => $${i + 1}`).join(",")})`, entries.map(([, value]) => value));
    return result.rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key,
      value instanceof Date ? (key.endsWith("_date") || key.endsWith("_by") ? value.toISOString().slice(0, 10) : value.toISOString()) : value,
    ])));
  };
  const reserve = async (items, options = {}) => {
    const id = options.id ?? randomUUID();
    const subtotal = items.reduce((sum, row) => sum + row.line_total_cents, 0);
    const args = {
      p_order_id: id, p_checkout_request_id: options.requestId ?? randomUUID(),
      p_order_number: `SP-${id}`, p_currency: "usd", p_payment_livemode: true,
      p_subtotal_cents: subtotal, p_production_option_id: options.expedited ? "expedited-production" : "standard-production",
      p_production_option_name: options.expedited ? "Expedited production" : "Standard production",
      p_production_max_business_days: options.expedited ? 1 : 5,
      p_production_cents: options.expedited ? 1000 : 0,
      p_fulfillment_method: "shipping", p_fulfillment_option_id: "standard",
      p_fulfillment_option_name: "Standard Shipping & Handling", p_pickup_location: null,
      p_shipping_cents: 1000, p_total_cents: subtotal + 1000 + (options.expedited ? 1000 : 0),
      p_inventory_reserved_until: new Date(Date.now() + 3600000).toISOString(), p_items: JSON.stringify(items),
    };
    const [row] = await rpc(options.legacy ? "reserve_store_order_inventory" : "reserve_store_order_with_preorders", args);
    return { ...row, args };
  };
  const order = async (id) => (await db.query("select * from store_orders where id=$1", [id])).rows[0];
  const stock = async (key) => (await db.query("select * from store_inventory where sku=$1", [catalog[key][1]])).rows[0];
  const pay = async (row, paidAt = "2026-10-16T14:00:00Z", eventId = `evt_${randomUUID().replaceAll("-", "")}`) => {
    const session = `cs_test_${row.id.replaceAll("-", "")}`;
    await rpc("attach_store_checkout_session", { p_order_id: row.id, p_checkout_session_id: session, p_checkout_url: `https://checkout.stripe.com/c/pay/${session}` });
    return rpc("process_store_payment_event", {
      p_provider_event_id: eventId, p_event_type: "checkout.session.completed", p_event_created_at: paidAt,
      p_order_id: row.id, p_checkout_session_id: session, p_payment_intent_id: `pi_${row.id.replaceAll("-", "")}`,
      p_charge_id: `ch_${row.id.replaceAll("-", "")}`, p_payment_status: "paid", p_customer_email: "test@example.invalid",
      p_customer_name: "SQL Test", p_shipping_address: JSON.stringify({ country: "US" }), p_currency: "usd",
      p_subtotal_cents: row.args.p_subtotal_cents, p_production_option_id: row.args.p_production_option_id,
      p_production_option_name: row.args.p_production_option_name, p_production_max_business_days: row.args.p_production_max_business_days,
      p_production_cents: row.args.p_production_cents, p_shipping_cents: 1000, p_tax_cents: 0, p_total_cents: row.args.p_total_cents,
      p_receipt_url: null, p_receipt_number: null, p_payment_livemode: true,
    });
  };
  return { db, rpc, reserve, order, stock, pay };
}

test("SQL preorders persist item policy and mixed-cart holiday scheduling without replenishing ATP", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.rpc("check_store_inventory_contract_v8", {}))[0].check_store_inventory_contract_v8, true);
    const r = await f.reserve([item("starter"), item("pack")]);
    assert.equal(r.fulfillment_type, "mixed");
    assert.equal(r.preorder_campaign_id, "christmas-2026");
    assert.equal(r.preorder_delivery_by, "2026-12-24");
    assert.equal(r.preorder_fulfillment_date, "2026-12-11");
    assert.equal(r.preorder_delivery_guaranteed, null);
    assert.equal((await f.stock("starter")).reserved_quantity, 1);
    assert.equal((await f.stock("pack")).reserved_quantity, 1);
    const items = (await f.db.query("select product_id,fulfillment_type,preorder_campaign_id from store_order_items where order_id=$1 order by product_id", [r.id])).rows;
    assert.deepEqual(items, [
      { product_id: "deep-dive-pack", fulfillment_type: "regular", preorder_campaign_id: null },
      { product_id: "starter-kit", fulfillment_type: "preorder", preorder_campaign_id: "christmas-2026" },
    ]);
    await f.pay(r);
    assert.equal((await f.order(r.id)).preorder_delivery_guaranteed, true);
    assert.equal((await f.stock("starter")).on_hand_quantity, 9);
    assert.equal((await f.stock("starter")).reserved_quantity, 0);
    assert.equal((await f.stock("pack")).on_hand_quantity, 9);
    assert.deepEqual(await f.rpc("prepare_store_fulfillment_due_notifications", { p_limit: 25, p_now: "2026-10-22T14:00:00Z" }), []);
    assert.deepEqual(await f.rpc("prepare_store_fulfillment_due_notifications", { p_limit: 25, p_now: "2026-12-10T13:59:00Z" }), []);
    assert.deepEqual(await f.rpc("prepare_store_fulfillment_due_notifications", { p_limit: 25, p_now: "2026-12-10T14:00:00Z" }), [{ order_id: r.id, due_date: "2026-12-11" }]);
    await f.db.exec(migration);
    assert.equal((await f.stock("starter")).on_hand_quantity, 9);
    assert.equal((await f.order(r.id)).preorder_delivery_guaranteed, true);
  } finally { await f.db.close(); }
});

test("SQL reservation retries, conflicting policy, capacity exhaustion, and release remain atomic", async () => {
  const f = await fixture();
  try {
    const first = await f.reserve([item("deck", 8)]);
    const [retry] = await f.rpc("reserve_store_order_with_preorders", first.args);
    assert.equal(retry.id, first.id);
    assert.equal(retry.created, false);
    assert.equal((await f.stock("deck")).reserved_quantity, 8);
    await assert.rejects(f.rpc("reserve_store_order_with_preorders", { ...first.args, p_shipping_cents: 1100, p_total_cents: first.args.p_total_cents + 100 }), /store_checkout_request_conflict/);
    const results = await Promise.allSettled([f.reserve([item("deck", 2)]), f.reserve([item("deck", 2)])]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.match(results.find((r) => r.status === "rejected").reason.message, /store_inventory_unavailable/);
    assert.equal((await f.stock("deck")).reserved_quantity, 10);
    await f.rpc("fail_store_order_checkout_and_release_inventory", { p_order_id: first.id, p_reason: "Checkout session creation failed" });
    assert.equal((await f.stock("deck")).reserved_quantity, 2);
    await f.rpc("fail_store_order_checkout_and_release_inventory", { p_order_id: first.id, p_reason: "Checkout session creation failed" });
    assert.equal((await f.stock("deck")).reserved_quantity, 2);
    await assert.rejects(f.rpc("reserve_store_order_with_preorders", first.args), /store_checkout_request_closed/);
    await assert.rejects(f.reserve([{ ...item("starter"), fulfillment_type: "regular" }]), /Invalid store preorder item policy/);
    await assert.rejects(f.reserve([{ ...item("starter"), preorder_fulfillment_date: "2026-10-23" }]), /Invalid store preorder item policy/);
    await assert.rejects(f.reserve([{ ...item("starter"), preorder_cutoff_at: "2026-12-12T05:00:00Z" }]), /Invalid store preorder item policy/);
    await assert.rejects(f.reserve([{ ...item("starter"), preorder_delivery_by: "2026-12-25" }]), /Invalid store preorder item policy/);
    await assert.rejects(f.reserve([item("starter")], { expedited: true }), /store_preorder_expedited_unavailable/);
    assert.equal((await f.stock("starter")).reserved_quantity, 0);
  } finally { await f.db.close(); }
});

test("SQL only grants Christmas delivery for payment before cutoff; regular packs keep the weekday schedule", async () => {
  const f = await fixture();
  try {
    const early = await f.reserve([item("deck")]);
    const late = await f.reserve([item("starter")]);
    const regular = await f.reserve([item("pack"), item("dice")]);
    await f.pay(early, "2026-12-11T04:59:59Z");
    await f.pay(late, "2026-12-11T05:00:00Z");
    await f.pay(regular, "2026-10-16T14:00:00Z");
    assert.equal((await f.order(early.id)).preorder_delivery_guaranteed, true);
    assert.equal((await f.order(late.id)).preorder_delivery_guaranteed, false);
    assert.equal((await f.order(regular.id)).fulfillment_type, "regular");
    assert.equal((await f.order(regular.id)).preorder_delivery_guaranteed, null);
    assert.deepEqual(await f.rpc("prepare_store_fulfillment_due_notifications", { p_limit: 25, p_now: "2026-10-22T14:00:00Z" }), [{ order_id: regular.id, due_date: "2026-10-23" }]);
    await f.db.query("update store_order_notifications set sent_at=now() where order_id=$1", [regular.id]);
    assert.deepEqual(await f.rpc("prepare_store_fulfillment_due_notifications", { p_limit: 25, p_now: "2026-12-11T14:00:00Z" }), [{ order_id: early.id, due_date: "2026-12-11" }]);
    await assert.rejects(f.db.query("update store_orders set preorder_delivery_by='2026-12-23' where id=$1", [early.id]), /preorder snapshots are immutable/);
    await assert.rejects(f.db.query("update store_orders set preorder_delivery_guaranteed=false where id=$1", [early.id]), /delivery promise is immutable/);
  } finally { await f.db.close(); }
});

test("SQL full preorder refunds cancel fulfillment and retain paid ATP; duplicate events do not change quantities", async () => {
  const f = await fixture();
  try {
    const r = await f.reserve([item("starter"), item("pack")]);
    await f.pay(r);
    const refund = {
      p_provider_event_id: "evt_refund_preorder", p_event_type: "refund.created", p_event_created_at: "2026-10-17T14:00:00Z",
      p_order_id: r.id, p_refund_id: "re_preorder", p_refund_status: "succeeded", p_refund_pending_reason: null,
      p_refund_failure_reason: null, p_amount_cents: r.args.p_total_cents, p_currency: "usd", p_refund_created_at: "2026-10-17T14:00:00Z",
      p_payment_intent_id: `pi_${r.id.replaceAll("-", "")}`, p_charge_id: `ch_${r.id.replaceAll("-", "")}`, p_payment_livemode: true,
    };
    await f.rpc("process_store_refund_event", refund);
    await f.rpc("process_store_refund_event", refund);
    const order = await f.order(r.id);
    assert.equal(order.payment_status, "refunded");
    assert.equal(order.fulfillment_status, "cancelled");
    assert.equal(order.inventory_state, "committed");
    assert.equal(order.preorder_delivery_guaranteed, true);
    assert.equal((await f.stock("starter")).on_hand_quantity, 9);
    assert.equal((await f.stock("starter")).reserved_quantity, 0);
    assert.deepEqual(await f.rpc("prepare_store_fulfillment_due_notifications", { p_limit: 25, p_now: "2026-12-10T14:00:00Z" }), []);
  } finally { await f.db.close(); }
});

test("SQL migration upgrades explicit legacy preorder markers and preserves ordinary historical orders", async () => {
  const f = await fixture({ legacy: true });
  try {
    const ordinary = await f.reserve([item("starter")], { legacy: true });
    const marked = await f.reserve([{ ...item("deck"), product_name: "Coral Garden Deck (pre-order)" }, item("pack")], { legacy: true });
    await f.pay(marked);
    await f.db.query("insert into store_order_notifications(order_id,notification_type) values($1,'merchant_fulfillment_due')", [marked.id]);
    await f.db.exec(migration);
    await f.db.exec(migration);
    assert.equal((await f.order(ordinary.id)).fulfillment_type, "regular");
    assert.equal((await f.order(marked.id)).fulfillment_type, "mixed");
    assert.equal((await f.order(marked.id)).preorder_delivery_guaranteed, true);
    assert.equal((await f.stock("deck")).on_hand_quantity, 9);
    assert.equal((await f.stock("starter")).reserved_quantity, 1);
    assert.deepEqual(await f.rpc("prepare_store_fulfillment_due_notifications", { p_limit: 25, p_now: "2026-10-22T14:00:00Z" }), []);
    assert.deepEqual(await f.rpc("prepare_store_fulfillment_due_notifications", { p_limit: 25, p_now: "2026-12-10T13:59:00Z" }), []);
    assert.deepEqual(await f.rpc("prepare_store_fulfillment_due_notifications", { p_limit: 25, p_now: "2026-12-10T14:00:00Z" }), [{ order_id: marked.id, due_date: "2026-12-11" }]);
    // The live old backend can finish/retry during the migration/deploy gap.
    const [retry] = await f.rpc("reserve_store_order_inventory", ordinary.args);
    assert.equal(retry.id, ordinary.id);
    assert.equal((await f.order(ordinary.id)).fulfillment_type, "regular");
    const oldAppNewOrder = await f.reserve([item("starter"), item("dice")], { legacy: true });
    assert.equal((await f.order(oldAppNewOrder.id)).fulfillment_type, "mixed");
    assert.equal((await f.db.query("select fulfillment_type from store_order_items where order_id=$1 and product_id='starter-kit'", [oldAppNewOrder.id])).rows[0].fulfillment_type, "preorder");
    const oldRegular = await f.reserve([item("pack")], { legacy: true });
    assert.equal((await f.order(oldRegular.id)).fulfillment_type, "regular");
    await assert.rejects(f.reserve([item("starter")], { legacy: true, expedited: true }), /store_preorder_expedited_unavailable/);
  } finally { await f.db.close(); }
});

test("SQL expired preorder reservations need verification, remain bounded and release once", async () => {
  const f = await fixture();
  try {
    const r = await f.reserve([item("starter"), item("pack")]);
    await f.db.query("update store_orders set inventory_reserved_until=now()-interval '1 minute' where id=$1", [r.id]);
    assert.deepEqual(await f.rpc("list_overdue_store_inventory_reservations", { p_limit: 10 }), [{ order_id: r.id }]);
    assert.equal((await f.stock("starter")).reserved_quantity, 1);
    const [claim] = await f.rpc("claim_overdue_store_inventory_reservation", { p_order_id: r.id, p_claim_token: randomUUID(), p_lease_seconds: 180 });
    assert.equal(claim.claim_status, "claimed");
    assert.equal((await f.stock("starter")).reserved_quantity, 1);
    await assert.rejects(f.rpc("fail_store_order_checkout_and_release_inventory", { p_order_id: r.id, p_reason: "Clock expired" }), /verified terminal reason/);
    await f.rpc("fail_store_order_checkout_and_release_inventory", { p_order_id: r.id, p_reason: "Stripe-confirmed terminal unpaid" });
    await f.rpc("fail_store_order_checkout_and_release_inventory", { p_order_id: r.id, p_reason: "Stripe-confirmed terminal unpaid" });
    assert.equal((await f.stock("starter")).on_hand_quantity, 10);
    assert.equal((await f.stock("starter")).reserved_quantity, 0);
    assert.equal((await f.stock("pack")).reserved_quantity, 0);
    assert.equal((await f.order(r.id)).inventory_state, "released");
    assert.equal((await f.order(r.id)).preorder_delivery_guaranteed, null);
    await f.db.exec("set role anon");
    await assert.rejects(f.rpc("reserve_store_order_with_preorders", r.args), /permission denied/);
    await f.db.exec("reset role");
    await f.db.exec("set role service_role");
    const [ready] = await f.rpc("check_store_inventory_contract_v8", {});
    assert.equal(ready.check_store_inventory_contract_v8, true);
    await f.reserve([item("pack")]);
    await f.db.exec("reset role");
  } finally { await f.db.close(); }
});

test("SQL retargets completed legacy reminders once while preserving purchase and real holiday notifications", async () => {
  const f = await fixture({ legacy: true });
  try {
    const sent = await f.reserve([{ ...item("starter"), product_name: "Starter Kit (pre-order)" }], { legacy: true });
    const pending = await f.reserve([{ ...item("deck"), product_name: "Deck (pre-order)" }], { legacy: true });
    const holiday = await f.reserve([{ ...item("deck"), product_name: "Deck (pre-order)" }], { legacy: true });
    const regular = await f.reserve([item("pack")], { legacy: true });
    for (const row of [sent, pending, holiday, regular]) await f.pay(row);
    await f.db.query("insert into store_order_notifications(order_id,notification_type,sent_at,provider_message_id) values ($1,'merchant_fulfillment_due','2026-10-22T14:00:00Z',null), ($2,'merchant_fulfillment_due',null,null), ($3,'merchant_fulfillment_due','2026-12-10T14:00:00Z','holiday_email'), ($4,'merchant_fulfillment_due','2026-10-22T14:00:00Z','regular_email')", [sent.id, pending.id, holiday.id, regular.id]);
    await f.db.query("update store_order_notifications set sent_at='2026-10-16T14:01:00Z',provider_message_id='purchase_email' where order_id=$1 and notification_type='merchant_purchase'", [sent.id]);
    await f.db.exec(migration);
    await f.db.exec(migration);
    const notifications = (await f.db.query("select order_id,notification_type,sent_at,provider_message_id,last_error_code from store_order_notifications")).rows;
    const row = (id, type = "merchant_fulfillment_due") => notifications.find((n) => n.order_id === id && n.notification_type === type);
    assert.equal(row(sent.id).sent_at, null);
    assert.equal(row(sent.id).last_error_code, "preorder_schedule_reset");
    assert.equal(row(sent.id, "merchant_purchase").provider_message_id, "purchase_email");
    assert.ok(row(sent.id, "merchant_purchase").sent_at);
    assert.equal(row(holiday.id).provider_message_id, "holiday_email");
    assert.ok(row(holiday.id).sent_at);
    assert.equal(row(regular.id).provider_message_id, "regular_email");
    assert.ok(row(regular.id).sent_at);
    assert.deepEqual(await f.rpc("prepare_store_fulfillment_due_notifications", { p_limit: 25, p_now: "2026-10-22T14:00:00Z" }), []);
    const queued = await f.rpc("prepare_store_fulfillment_due_notifications", { p_limit: 25, p_now: "2026-12-10T14:00:00Z" });
    assert.deepEqual(queued.map((n) => n.order_id).sort(), [sent.id, pending.id].sort());
    assert.ok(queued.every((n) => n.due_date === "2026-12-11"));
    await f.db.query("update store_order_notifications set sent_at='2026-12-10T14:01:00Z',provider_message_id='new_holiday_email' where order_id=any($1::uuid[]) and notification_type='merchant_fulfillment_due'", [[sent.id, pending.id]]);
    await f.db.exec(migration);
    assert.deepEqual(await f.rpc("prepare_store_fulfillment_due_notifications", { p_limit: 25, p_now: "2026-12-10T14:02:00Z" }), []);
  } finally { await f.db.close(); }
});

test("SQL preorders preserve physical stock reservations and the explicit manufacturing dispatch gate", async () => {
  const f = await fixture({ manufacturing: true });
  try {
    await f.db.exec("update manufacturing_stock set on_hand=3 where product_id='starter-kit'");
    const r = await f.reserve([item("starter")]);
    await f.pay(r);
    const [job] = (await f.db.query("select * from manufacturing_orders where order_id=$1", [r.id])).rows;
    assert.equal(job.phase, "queued");
    assert.equal(job.print_requested_at, null);
    assert.equal((await f.rpc("manufacturing_claim", { p_token: randomUUID(), p_allow_test: false }))[0].manufacturing_claim, null);
    const [stock] = (await f.db.query("select on_hand,reserved from manufacturing_stock where product_id='starter-kit'")).rows;
    assert.equal(stock.on_hand, 3);
    assert.equal(stock.reserved, 1);
    assert.equal((await f.order(r.id)).preorder_delivery_guaranteed, true);
    assert.equal((await f.stock("starter")).on_hand_quantity, 9);
    await f.rpc("process_store_refund_event", {
      p_provider_event_id: "evt_refund_stock_preorder", p_event_type: "refund.created", p_event_created_at: "2026-10-17T14:00:00Z",
      p_order_id: r.id, p_refund_id: "re_stock_preorder", p_refund_status: "succeeded", p_refund_pending_reason: null,
      p_refund_failure_reason: null, p_amount_cents: r.args.p_total_cents, p_currency: "usd", p_refund_created_at: "2026-10-17T14:00:00Z",
      p_payment_intent_id: `pi_${r.id.replaceAll("-", "")}`, p_charge_id: `ch_${r.id.replaceAll("-", "")}`, p_payment_livemode: true,
    });
    const [released] = (await f.db.query("select on_hand,reserved from manufacturing_stock where product_id='starter-kit'")).rows;
    assert.equal(released.on_hand, 3);
    assert.equal(released.reserved, 0);
    assert.equal((await f.stock("starter")).on_hand_quantity, 9);
  } finally { await f.db.close(); }
});
