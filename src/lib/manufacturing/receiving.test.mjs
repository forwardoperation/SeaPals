import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

const reef = "reef-dive-pack";
const deep = "deep-dive-pack";
const reefCode = "0012345678905";
const deepCode = "DEEP-PACK";
const migration = await readFile(new URL("../../../supabase/manufacturing-receiving.sql", import.meta.url), "utf8");

async function fixture({ receiving = true } = {}) {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table store_orders(id uuid primary key,order_number text,payment_status text default 'pending',payment_livemode boolean default true,
      amount_refunded_cents integer default 0,dispute_status text,fulfillment_status text default 'unfulfilled',updated_at timestamptz default now());
    create table store_order_items(order_id uuid references store_orders(id),product_id text,product_name text,quantity integer);
    create table store_refunds(id uuid primary key default gen_random_uuid(),order_id uuid,status text);
    create schema storage; create table storage.objects(bucket_id text);`);
  for (const name of ["manufacturing.sql", "manufacturing-inventory.sql", "manufacturing-dispatch.sql"])
    await db.exec(await readFile(new URL(`../../../supabase/${name}`, import.meta.url), "utf8"));
  if (receiving) {
    await db.exec(migration);
    await db.exec(migration);
  }
  const rpc = async (name, args) => (await db.query(
    `select manufacturing_${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`, args,
  )).rows[0].value;
  const row = async (id) => (await db.query("select * from manufacturing_orders where order_id=$1", [id])).rows[0];
  const stock = async (product = reef) => (await db.query("select * from manufacturing_stock where product_id=$1", [product])).rows[0];
  const count = async (table) => Number((await db.query(`select count(*) as count from ${table}`)).rows[0].count);
  const job = async (quantity = 3, extraItems = []) => {
    const id = randomUUID();
    const items = [{ productId: reef, quantity }, ...extraItems];
    await rpc("create_stock_job", [id, items]);
    const state = { manifestHash: `saved-${id}`, revision: 0, hold: false, qualityChecked: false, packed: false,
      sheets: { first: { fronts: "confirmed", backs: "confirmed", glued: true, cut: true } },
      ticket: { ticket: "submitted" }, holos: {}, stock: {}, accessories: {}, events: [] };
    await db.query("update manufacturing_orders set manifest_text=$2,state=$3,print_requested_at=now(),phase='awaiting_operator' where order_id=$1", [
      id, JSON.stringify({ jobKind: "stock", order: { items }, manifestHash: state.manifestHash }), state,
    ]);
    return id;
  };
  const receive = (id, quantity = 1, operation = randomUUID()) => rpc("receive_stock", [operation, id, [{ barcode: reefCode, quantity }], true]);
  const setState = async (id, change, columns = "") => {
    const current = await row(id);
    const state = { ...current.state, ...change };
    await db.query(`update manufacturing_orders set state=$2 ${columns} where order_id=$1`, [id, state]);
    return state;
  };
  if (receiving) {
    await rpc("set_product_barcode", [reefCode, reef]);
    await rpc("set_product_barcode", [deepCode, deep]);
  }
  return { db, rpc, row, stock, count, job, receive, setState };
}

async function withFixture(fn, options) {
  const f = await fixture(options);
  try { await fn(f); } finally { await f.db.close(); }
}

test("product barcode mappings preserve leading zeros and refuse ambiguous reassignment", async () => withFixture(async ({ rpc, db }) => {
  assert.deepEqual(await rpc("set_product_barcode", [` ${reefCode} `, reef]), { barcode: reefCode, productId: reef });
  await assert.rejects(rpc("set_product_barcode", [reefCode, deep]), /already assigned/);
  await assert.rejects(rpc("set_product_barcode", ["UNKNOWN", "missing-product"]), /Unknown finished product/);
  for (const code of ["", " ", "A\nB", "X".repeat(129)])
    await assert.rejects(rpc("set_product_barcode", [code, reef]), /valid product barcode/);
  const stored = (await db.query("select barcode from manufacturing_product_barcodes where product_id=$1", [reef])).rows;
  assert.deepEqual(stored, [{ barcode: reefCode }]);
}));

test("dispatch and packed events never increase finished stock after receiving migration", async () => withFixture(async ({ rpc, row, stock, job, count }) => {
  const id = await job();
  await rpc("send_to_printers", [id]);
  assert.equal((await stock()).on_hand, 0);
  const m = await row(id);
  const packed = await rpc("commit", [id, null, 0, { ...m.state, revision: 1, packed: true, qualityChecked: true },
    { type: "packed", role: "operator" }, "complete"]);
  assert.equal(packed.phase, "awaiting_operator");
  assert.equal(packed.inventory_posted_at, null);
  assert.equal((await stock()).on_hand, 0);
  assert.equal(await count("manufacturing_stock_movements"), 0);
  assert.equal(await count("manufacturing_notifications"), 0);
}));

test("partial packaged receipts count only good units and leave shortages available for later receipt", async () => withFixture(async ({ receive, row, stock, job, count }) => {
  const id = await job(3);
  const manifest = (await row(id)).manifest_text;
  assert.deepEqual(await receive(id), { recorded: true, duplicate: false, receivedQuantities: { [reef]: 1 }, complete: false });
  assert.equal((await stock()).on_hand, 1);
  const partial = await row(id);
  assert.equal(partial.inventory_posted_at, null);
  assert.equal(partial.revision, 1);
  assert.equal(partial.state.revision, 1);
  assert.equal(partial.state.packed, false);
  await receive(id);
  assert.equal((await stock()).on_hand, 2);
  assert.equal((await row(id)).manifest_text, manifest);
  assert.equal(await count("manufacturing_notifications"), 0);
  assert.equal(await count("manufacturing_stock_movements"), 2);
}));

test("receipt retries are idempotent even after completion and reject changed contents", async () => withFixture(async ({ rpc, receive, job, stock, row, setState }) => {
  const id = await job(2);
  const operation = randomUUID();
  await rpc("receive_stock", [operation, id, [{ barcode: reefCode, quantity: 1 }, { barcode: reefCode, quantity: 1 }], true]);
  await setState(id, { hold: true });
  const duplicate = await receive(id, 2, operation);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.complete, true);
  assert.equal((await stock()).on_hand, 2);
  assert.equal((await row(id)).revision, 1);
  await assert.rejects(receive(id, 1, operation), /Operation ID reused/);
  await assert.rejects(receive(id, 1), /already been received/);
  const other = await job(2);
  await assert.rejects(receive(other, 2, operation), /Operation ID reused/);
}));

test("unknown and wrong-product barcodes reject the entire receipt without a partial posting", async () => withFixture(async ({ rpc, job, stock, count, row }) => {
  const id = await job();
  for (const [barcode, pattern] of [["UNKNOWN", /Unknown product barcode/], [deepCode, /not part of this stock build/]]) {
    await assert.rejects(rpc("receive_stock", [randomUUID(), id, [{ barcode: reefCode, quantity: 1 }, { barcode, quantity: 1 }], true]), pattern);
    assert.equal((await stock()).on_hand, 0);
    assert.equal((await stock(deep)).on_hand, 0);
    assert.deepEqual((await row(id)).received_quantities, {});
    assert.equal(await count("manufacturing_stock_operations"), 0);
  }
}));

test("per-product limits are atomic across multiple barcodes and multiple products", async () => withFixture(async ({ rpc, job, stock, row, count }) => {
  const id = await job(2, [{ productId: deep, quantity: 1 }]);
  await rpc("set_product_barcode", ["REEF-ALTERNATE", reef]);
  await rpc("receive_stock", [randomUUID(), id, [{ barcode: reefCode, quantity: 1 }, { barcode: "REEF-ALTERNATE", quantity: 1 }], true]);
  assert.equal(await count("manufacturing_stock_movements"), 1);
  await assert.rejects(rpc("receive_stock", [randomUUID(), id, [{ barcode: deepCode, quantity: 1 }, { barcode: reefCode, quantity: 1 }], true]), /exceeds/);
  assert.equal((await stock(deep)).on_hand, 0);
  const done = await rpc("receive_stock", [randomUUID(), id, [{ barcode: deepCode, quantity: 1 }], true]);
  assert.deepEqual(done.receivedQuantities, { [reef]: 2, [deep]: 1 });
  assert.equal(done.complete, true);
  assert.equal((await row(id)).phase, "complete");
  assert.ok((await row(id)).inventory_posted_at);
}));

test("attestation and valid quantities are mandatory", async () => withFixture(async ({ rpc, job, stock }) => {
  const id = await job();
  for (const quality of [false, null]) await assert.rejects(rpc("receive_stock", [randomUUID(), id, [{ barcode: reefCode, quantity: 1 }], quality]), /packaged and quality checked/);
  for (const quantity of [0, -1, 1.5, 101, "1", null])
    await assert.rejects(rpc("receive_stock", [randomUUID(), id, [{ barcode: reefCode, quantity }], true]), /whole quantity|at most 100/);
  for (const items of [[], {}, null, [{ barcode: "", quantity: 1 }], [{ quantity: 1 }]])
    await assert.rejects(rpc("receive_stock", [randomUUID(), id, items, true]));
  assert.equal((await stock()).on_hand, 0);
}));

test("receiving rejects active printing, held work, and jobs that were never dispatched", async () => withFixture(async ({ receive, job, setState, db, stock }) => {
  const id = await job();
  await setState(id, { hold: true });
  await assert.rejects(receive(id), /hold/);
  await setState(id, { hold: false }, ",phase='blocked'");
  await assert.rejects(receive(id), /hold/);
  await db.query("update manufacturing_orders set phase='awaiting_operator',leased_until=now()+interval '1 minute' where order_id=$1", [id]);
  await assert.rejects(receive(id), /printer agent is active/);
  await db.query("update manufacturing_orders set leased_until=null where order_id=$1", [id]);
  await setState(id, { ticket: { ticket: "submitting" } });
  await assert.rejects(receive(id), /active print attempt/);
  await setState(id, { ticket: { ticket: "submitted" }, sheets: { first: { fronts: "submitting", backs: "confirmed" } } });
  await assert.rejects(receive(id), /active print attempt/);
  await setState(id, { sheets: {} }, ",print_requested_at=null");
  await assert.rejects(receive(id), /Send this stock build/);
  assert.equal((await stock()).on_hand, 0);
}));

test("partial receipts permit remaining reprints but the final receipt cannot strand queued or uncertain pages", async () => withFixture(async ({ receive, job, setState, stock, row }) => {
  const id = await job(3);
  await setState(id, { sheets: { first: { fronts: "confirmed", backs: "confirmed" }, replacement: { fronts: "queued", backs: "confirmed" } } }, ",phase='queued'");
  await receive(id);
  assert.equal((await row(id)).phase, "queued");
  await assert.rejects(receive(id, 2), /pending or uncertain/);
  await setState(id, { sheets: { replacement: { fronts: "needs_review", backs: "confirmed" } } });
  await assert.rejects(receive(id, 2), /pending or uncertain/);
  await setState(id, { sheets: { replacement: { fronts: "confirmed", backs: "confirmed" } }, ticket: { ticket: "queued" } });
  await assert.rejects(receive(id, 2), /pending or uncertain/);
  await setState(id, { ticket: { ticket: "submitted" } });
  assert.equal((await receive(id, 2)).complete, true);
  assert.equal((await stock()).on_hand, 3);
}));

test("receipt revisions reject stale events and partial reprints never reset received totals", async () => withFixture(async ({ rpc, receive, job, row, stock }) => {
  const id = await job(2);
  const old = await row(id);
  await receive(id);
  await assert.rejects(rpc("commit", [id, null, old.revision, { ...old.state, revision: 1 }, { type: "reprint", role: "operator", side: "fronts" }, "queued"]), /Revision conflict/);
  let m = await row(id);
  await rpc("commit", [id, null, m.revision, { ...m.state, revision: m.revision + 1 }, { type: "reprint", role: "operator", side: "fronts" }, "queued"]);
  assert.deepEqual((await row(id)).received_quantities, { [reef]: 1 });
  assert.equal((await stock()).on_hand, 1);
  await receive(id);
  m = await row(id);
  await assert.rejects(rpc("commit", [id, null, m.revision, { ...m.state, revision: m.revision + 1 }, { type: "reprint", role: "operator", side: "fronts" }, "queued"]), /Finished stock already received/);
}));

test("legacy batch receipts migrate without changing stock and cannot be credited again", async () => withFixture(async ({ db, rpc, job, row, stock }) => {
  const id = await job(3);
  const m = await row(id);
  await rpc("commit", [id, null, 0, { ...m.state, revision: 1, packed: true, qualityChecked: true }, { type: "packed", role: "operator" }, "complete"]);
  const before = await stock();
  assert.equal(before.on_hand, 3);
  await db.exec(migration);
  await db.exec(migration);
  assert.deepEqual((await row(id)).received_quantities, { [reef]: 3 });
  assert.equal((await stock()).on_hand, before.on_hand);
  await rpc("set_product_barcode", [reefCode, reef]);
  await assert.rejects(rpc("receive_stock", [randomUUID(), id, [{ barcode: reefCode, quantity: 1 }], true]), /already been received/);
}, { receiving: false }));

test("customer packing still consumes reserved stock once and cannot receive products for sale", async () => withFixture(async ({ db, rpc, stock, row, receive }) => {
  await rpc("adjust_stock", [randomUUID(), reef, 3, "Opening stock"]);
  const id = randomUUID();
  await db.query("insert into store_orders(id,order_number) values($1,'CUSTOMER')", [id]);
  await db.query("insert into store_order_items values($1,$2,'Reef pack',2)", [id, reef]);
  await db.query("update store_orders set payment_status='paid' where id=$1", [id]);
  assert.equal((await stock()).reserved, 2);
  const state = { revision: 0, manifestHash: "customer", qualityChecked: false, packed: false, hold: false };
  await db.query("update manufacturing_orders set state=$2,manifest_text='{}' where order_id=$1", [id, state]);
  await assert.rejects(receive(id), /independent stock build/);
  let packed = await rpc("commit", [id, null, 0, { ...state, revision: 1, qualityChecked: true, packed: true }, { type: "packed", role: "operator" }, "complete"]);
  packed = await rpc("commit", [id, null, 1, { ...packed.state, revision: 2 }, { type: "packed", role: "operator" }, "complete"]);
  assert.equal((await stock()).on_hand, 1);
  assert.equal((await stock()).reserved, 0);
  assert.ok((await row(id)).inventory_consumed_at);
  assert.equal(packed.phase, "complete");
}));

test("settling unreceived stock cannot mark it complete and receiving APIs remain service-only", async () => withFixture(async ({ db, rpc, job, row }) => {
  const id = await job();
  const token = randomUUID();
  await db.query("update manufacturing_orders set phase='active',lease_token=$2,leased_until=now()+interval '2 minutes' where order_id=$1", [id, token]);
  await rpc("settle", [id, token, 0, "complete"]);
  assert.equal((await row(id)).phase, "awaiting_operator");
  for (const role of ["anon", "authenticated"])
    for (const signature of ["manufacturing_receive_stock(uuid,uuid,jsonb,boolean)", "manufacturing_set_product_barcode(text,text)"])
      assert.equal((await db.query("select has_function_privilege($1,$2,'execute') as allowed", [role, signature])).rows[0].allowed, false);
  assert.equal((await db.query("select has_table_privilege('anon','manufacturing_product_barcodes','select') as allowed")).rows[0].allowed, false);
  assert.equal((await db.query("select has_function_privilege('service_role','manufacturing_receive_stock(uuid,uuid,jsonb,boolean)','execute') as allowed")).rows[0].allowed, true);
}));


test("independent receipt requests cannot credit one remaining unit twice", async () => withFixture(async ({ receive, job, stock, count }) => {
  const id = await job(1);
  const results = await Promise.allSettled([receive(id), receive(id)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected").length, 1);
  assert.equal((await stock()).on_hand, 1);
  assert.equal(await count("manufacturing_stock_movements"), 1);
}));


test("a partial receipt keeps a packed build queued when its work ticket still needs printing", async () => withFixture(async ({ receive, job, setState, row, rpc }) => {
  const id = await job(2);
  await setState(id, { packed: true, qualityChecked: true, ticket: { ticket: "queued" } }, ",phase='queued'");
  await receive(id);
  assert.equal((await row(id)).phase, "queued");
  const claimed = await rpc("claim", [randomUUID(), false]);
  assert.equal(claimed.order_id, id);
  assert.equal(claimed.state.ticket.ticket, "queued");
  assert.deepEqual(claimed.received_quantities, { [reef]: 1 });
}));
