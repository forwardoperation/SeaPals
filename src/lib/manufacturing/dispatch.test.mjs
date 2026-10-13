import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { buildPrintingCatalog } from "./boosters.mjs";
import { manufacturingService } from "./integration.mjs";
import { applyManufacturingEvent } from "./workflow.mjs";

const catalog = buildPrintingCatalog(
  JSON.parse(await readFile(new URL("../../data/gallery-set-list.json", import.meta.url))),
  JSON.parse(await readFile(new URL("../../data/gallery-images.json", import.meta.url))),
);
const migration = (name) => readFile(new URL(`../../../supabase/${name}.sql`, import.meta.url), "utf8");
const dispatchSql = await migration("manufacturing-dispatch");

// Exercise the production service and SQL functions without Supabase, artwork
// downloads, printer access, or any buyer notifications being sent.
function serviceClient(db) {
  const identifier = (value) => {
    assert.match(value, /^[a-z_]+$/);
    return value;
  };
  return {
    async rpc(name, args) {
      try {
        const entries = Object.entries(args);
        const result = await db.query(
          `select ${identifier(name)}(${entries.map(([key], i) => `${identifier(key)} => $${i + 1}`).join(",")}) as value`,
          entries.map(([, value]) => value),
        );
        return { data: result.rows[0].value };
      } catch (error) {
        return { error };
      }
    },
    from(table) {
      identifier(table);
      const terms = [], values = [];
      let single = false;
      const q = {
        select() { return q; },
        eq(key, value) {
          values.push(value);
          terms.push(`${identifier(key)}=$${values.length}`);
          return q;
        },
        order() { return q; },
        limit() { return q; },
        single() { single = true; return q; },
        then(resolve, reject) {
          (async () => {
            const rows = (await db.query(`select * from ${table}${terms.length ? " where " + terms.join(" and ") : ""}`, values)).rows;
            if (table === "store_orders")
              for (const row of rows)
                row.store_order_items = (await db.query("select * from store_order_items where order_id=$1", [row.id])).rows;
            return { data: single ? rows[0] : rows };
          })().then(resolve, reject);
        },
      };
      return q;
    },
  };
}

async function fixture({ dispatch = true } = {}) {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table store_orders(id uuid primary key,order_number text,payment_status text default 'pending',payment_livemode boolean default true,
      amount_refunded_cents integer default 0,dispute_status text,fulfillment_status text default 'unfulfilled',updated_at timestamptz default now());
    create table store_order_items(order_id uuid references store_orders(id),product_id text,product_name text,quantity integer);
    create table store_refunds(id uuid primary key default gen_random_uuid(),order_id uuid,status text);
    create schema storage; create table storage.objects(bucket_id text);`);
  await db.exec(await migration("manufacturing"));
  await db.exec(await migration("manufacturing-inventory"));
  if (dispatch) {
    await db.exec(dispatchSql);
    await db.exec(dispatchSql);
  }
  const rpc = async (name, args) => (await db.query(
    `select manufacturing_${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`, args,
  )).rows[0].value;
  const order = async ({ quantity = 1, productId = "reef-dive-pack", live = true } = {}) => {
    const id = randomUUID();
    await db.query("insert into store_orders(id,order_number,payment_livemode) values($1,'DISPATCH-TEST',$2)", [id, live]);
    await db.query("insert into store_order_items values($1,$2,'Test product',$3)", [id, productId, quantity]);
    await db.query("update store_orders set payment_status='paid' where id=$1", [id]);
    return id;
  };
  const row = async (id) => (await db.query("select * from manufacturing_orders where order_id=$1", [id])).rows[0];
  const stock = async () => (await db.query("select * from manufacturing_stock order by product_id")).rows;
  const movements = async () => (await db.query("select * from manufacturing_stock_movements order by created_at,id")).rows;
  const s = manufacturingService(serviceClient(db));
  const build = async (items = [{ productId: "dice-pack", quantity: 1 }]) => {
    const id = randomUUID();
    await s.createStock(id, items);
    return id;
  };
  const artwork = async (releaseId = "dispatch-art") => {
    const card = { sha256: "a".repeat(64), path: `manufacturing/sha256/${"a".repeat(64)}.png`, width: 750, height: 1050 };
    const release = {
      releaseId, figmaVersion: "test", catalog,
      assets: {
        ...Object.fromEntries(catalog.map((c) => [c.printingId, card])),
        "standard-back-sheet": { sha256: "b".repeat(64), path: `manufacturing/sha256/${"b".repeat(64)}.png`, width: 2550, height: 3300 },
      },
    };
    await rpc("publish", [releaseId, JSON.stringify(release)]);
    return release;
  };
  const event = async (id, type, fields = {}, role = "operator", token = null) => s.event(id, {
    id: randomUUID(), type, expectedRevision: (await row(id)).revision, ...fields,
  }, role, token);
  return { db, rpc, order, row, stock, movements, s, build, artwork, event };
}

test("customer orders and independent stock builds wait for their own Send to printers click", async () => {
  const f = await fixture();
  try {
    const firstOrder = await f.order(), secondOrder = await f.order(), stockId = await f.build();
    for (const id of [firstOrder, secondOrder, stockId]) {
      assert.equal((await f.row(id)).print_requested_at, null);
      assert.equal((await f.row(id)).manifest_text, null);
    }
    await f.rpc("retry", [firstOrder]);
    await f.rpc("retry", [stockId]);
    assert.equal(await f.s.claim(randomUUID()), null, "Retry preparation does not approve any job");
    const stockBefore = await f.stock(), movementsBefore = await f.movements();
    const sent = await f.s.sendToPrinters(secondOrder);
    assert.ok(sent.print_requested_at);
    assert.equal(sent.manifest, null, "Sending queues preparation without drawing cards in the browser");
    assert.deepEqual(await f.stock(), stockBefore);
    assert.deepEqual(await f.movements(), movementsBefore);
    assert.equal((await f.rpc("claim", [randomUUID(), false])).order_id, secondOrder);
    assert.equal(await f.rpc("claim", [randomUUID(), false]), null);
    await f.s.sendToPrinters(stockId);
    const build = await f.s.claim(randomUUID());
    assert.equal(build.order_id, stockId);
    assert.equal(build.manifest.jobKind, "stock");
    assert.equal((await f.row(firstOrder)).print_requested_at, null);
    assert.equal((await f.db.query("select count(*)::integer as n from store_orders")).rows[0].n, 2);
    assert.equal((await f.db.query("select count(*)::integer as n from manufacturing_notifications")).rows[0].n, 0);
  } finally { await f.db.close(); }
});

test("double clicks preserve the approval, lease, manifest and state even after hold or completion", async () => {
  const f = await fixture();
  try {
    const id = await f.build();
    const [first, second] = await Promise.all([f.s.sendToPrinters(id), f.s.sendToPrinters(id)]);
    assert.deepEqual(first, second);
    const token = randomUUID(), prepared = await f.s.claim(token);
    assert.equal(prepared.order_id, id);
    const leased = await f.row(id);
    await f.s.sendToPrinters(id);
    assert.deepEqual(await f.row(id), leased);
    assert.equal(await f.s.claim(randomUUID()), null, "A repeated send cannot steal an active lease");
    await f.event(id, "submission_started", { side: "ticket" }, "agent", token);
    await f.event(id, "submission_succeeded", { side: "ticket" }, "agent", token);
    await f.event(id, "hold", { reason: "Inspect stock" });
    const held = await f.row(id);
    await f.s.sendToPrinters(id);
    assert.deepEqual(await f.row(id), held, "A repeated send cannot clear a hold");
    await f.event(id, "release_hold");
    await f.event(id, "accessory_picked", { accessoryId: "dice-pack-dice" });
    await f.event(id, "quality_checked");
    await f.event(id, "packed");
    const complete = await f.row(id), inventory = await f.stock(), movements = await f.movements();
    assert.equal(complete.phase, "complete");
    await f.s.sendToPrinters(id);
    assert.deepEqual(await f.row(id), complete, "A repeated send cannot reopen completed work");
    assert.deepEqual(await f.stock(), inventory);
    assert.deepEqual(await f.movements(), movements);
    assert.equal(await f.s.claim(randomUUID()), null);
    await f.db.exec(dispatchSql);
    assert.deepEqual(await f.row(id), complete, "Reapplying the migration preserves the existing approval and completed work");
  } finally { await f.db.close(); }
});

test("saved booster cards and artwork remain identical through duplicate sends, retries and explicit reprints", async () => {
  const f = await fixture();
  try {
    await f.artwork();
    await f.rpc("adjust_stock", [randomUUID(), "reef-dive-pack", 3, "Shelf count"]);
    const id = await f.order({ quantity: 5 });
    await f.s.sendToPrinters(id);
    const token = randomUUID(), prepared = await f.s.claim(token), saved = (await f.row(id)).manifest_text;
    assert.equal(prepared.manifest.packs.length, 2, "Only the shortage draws booster contents");
    assert.deepEqual(prepared.manifest.inventoryPlan, [{ productId: "reef-dive-pack", quantity: 5, fromStock: 3, toMake: 2 }]);
    for (const pack of prepared.manifest.packs) assert.equal(pack.cards.length, 9);
    await f.s.sendToPrinters(id);
    await f.db.query("update manufacturing_orders set leased_until=now()-interval '1 second' where order_id=$1", [id]);
    await f.rpc("retry", [id]);
    await f.artwork("later-art");
    const secondToken = randomUUID(), reclaimed = await f.s.claim(secondToken);
    assert.equal(reclaimed.release_id, "dispatch-art");
    assert.equal((await f.row(id)).manifest_text, saved);
    assert.deepEqual(reclaimed.manifest.packs, prepared.manifest.packs);
    const target = { sheetId: prepared.manifest.sheets[0].sheetId, side: "fronts" };
    await f.event(id, "submission_started", target, "agent", secondToken);
    await f.event(id, "submission_succeeded", target, "agent", secondToken);
    await f.event(id, "confirm_printed", target);
    await f.event(id, "reprint", { ...target, reason: "Smudged front sheet" });
    await f.db.query("update manufacturing_orders set leased_until=now()-interval '1 second' where order_id=$1", [id]);
    const reprint = await f.s.claim(randomUUID());
    assert.deepEqual(reprint.manifest.packs, prepared.manifest.packs);
    assert.equal(reprint.manifest.manifestHash, prepared.manifest.manifestHash);
    assert.equal((await f.row(id)).manifest_text, saved);
    assert.equal(reprint.state.sheets[target.sheetId].fronts, "queued");
  } finally { await f.db.close(); }
});

test("fully stocked approved orders create only a work ticket and keep their reserved stock", async () => {
  const f = await fixture();
  try {
    await f.rpc("adjust_stock", [randomUUID(), "reef-dive-pack", 2, "Shelf count"]);
    const id = await f.order({ quantity: 2 }), inventory = await f.stock(), movements = await f.movements();
    assert.equal(await f.s.claim(randomUUID()), null);
    await f.s.sendToPrinters(id);
    const prepared = await f.s.claim(randomUUID());
    assert.equal(prepared.manifest.sheets.length, 0);
    assert.equal(prepared.manifest.packs.length, 0);
    assert.equal(prepared.state.ticket.ticket, "queued");
    assert.deepEqual(prepared.state.stock, { "reef-dive-pack": false });
    assert.deepEqual(await f.stock(), inventory);
    assert.deepEqual(await f.movements(), movements);
  } finally { await f.db.close(); }
});

test("migration leaves existing jobs unapproved and denies submission from a previously acquired lease", async () => {
  const f = await fixture({ dispatch: false });
  try {
    const id = await f.order({ productId: "dice-pack" }), token = randomUUID();
    const prepared = await f.s.claim(token);
    assert.equal(prepared.order_id, id);
    const legacy = await f.row(id);
    await f.db.exec(dispatchSql);
    assert.deepEqual(await f.row(id), { ...legacy, print_requested_at: null });
    const e = { id: randomUUID(), type: "submission_started", side: "ticket", role: "agent", actor: "local-print-agent", expectedRevision: 0 };
    const next = applyManufacturingEvent(prepared.state, prepared.manifest, e);
    await assert.rejects(f.rpc("commit", [id, token, 0, next, e, "active"]), /Send to printers is required/);
    assert.equal((await f.row(id)).revision, 0);
    await f.db.query("update manufacturing_orders set leased_until=now()-interval '1 second' where order_id=$1", [id]);
    assert.equal(await f.s.claim(randomUUID()), null, "Expired legacy leases cannot be reclaimed before approval");
    await f.s.sendToPrinters(id);
    const resumed = await f.s.claim(randomUUID());
    assert.equal(resumed.manifest.manifestHash, prepared.manifest.manifestHash);
  } finally { await f.db.close(); }
});

test("an in-flight pre-migration print can acknowledge completion without starting another unapproved sheet", async () => {
  const f = await fixture({ dispatch: false });
  try {
    const id = await f.build(), token = randomUUID();
    await f.s.claim(token);
    await f.event(id, "submission_started", { side: "ticket" }, "agent", token);
    await f.db.exec(dispatchSql);
    await f.event(id, "submission_succeeded", { side: "ticket" }, "agent", token);
    assert.equal((await f.row(id)).state.ticket.ticket, "submitted");
    assert.equal((await f.row(id)).print_requested_at, null);
    assert.equal(await f.s.claim(randomUUID()), null);
  } finally { await f.db.close(); }
});

test("approval cannot bypass test-order filtering or claim an unrelated job", async () => {
  const f = await fixture();
  try {
    const testId = await f.order({ live: false }), liveId = await f.order();
    await f.s.sendToPrinters(testId);
    assert.equal(await f.rpc("claim", [randomUUID(), false]), null);
    assert.equal((await f.rpc("claim", [randomUUID(), true])).order_id, testId);
    assert.equal((await f.row(liveId)).print_requested_at, null);
    assert.equal(await f.rpc("claim", [randomUUID(), true]), null);
  } finally { await f.db.close(); }
});

test("approved customer orders retain priority over approved inventory builds", async () => {
  const f = await fixture();
  try {
    const stockId = await f.build(), orderId = await f.order();
    await f.s.sendToPrinters(stockId);
    await f.s.sendToPrinters(orderId);
    assert.equal((await f.rpc("claim", [randomUUID(), false])).order_id, orderId);
    assert.equal((await f.rpc("claim", [randomUUID(), false])).order_id, stockId);
    assert.equal(await f.rpc("claim", [randomUUID(), false]), null);
  } finally { await f.db.close(); }
});

test("a refund after dispatch releases inventory and late printer acknowledgements keep the job blocked", async () => {
  const f = await fixture();
  try {
    await f.rpc("adjust_stock", [randomUUID(), "reef-dive-pack", 2, "Shelf count"]);
    const id = await f.order({ quantity: 2 }), token = randomUUID();
    await f.s.sendToPrinters(id);
    await f.s.claim(token);
    await f.event(id, "submission_started", { side: "ticket" }, "agent", token);
    await f.db.query("insert into store_refunds(order_id,status) values($1,'pending')", [id]);
    const refunded = await f.row(id);
    assert.equal(refunded.phase, "blocked");
    assert.ok(refunded.inventory_released_at);
    await f.s.sendToPrinters(id);
    assert.deepEqual(await f.row(id), refunded, "A duplicate click cannot undo a refund hold");
    await f.event(id, "submission_succeeded", { side: "ticket" }, "agent", token);
    const acknowledged = await f.row(id);
    assert.equal(acknowledged.state.ticket.ticket, "submitted");
    assert.equal(acknowledged.phase, "blocked");
    assert.match(acknowledged.issue, /Refund/);
    const product = (await f.stock()).find((s) => s.product_id === "reef-dive-pack");
    assert.equal(product.on_hand, 2);
    assert.equal(product.reserved, 0);
    assert.equal(await f.s.claim(randomUUID()), null);
  } finally { await f.db.close(); }
});

test("first approval rejects holds, refunded orders, released reservations and completed or received work", async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.s.sendToPrinters("not-an-order"), /ID|required|Invalid/i);
    await assert.rejects(f.s.sendToPrinters(randomUUID()), /not found/);
    const held = await f.build();
    await f.db.query("update manufacturing_orders set state=$2 where order_id=$1", [held, { hold: true }]);
    await assert.rejects(f.s.sendToPrinters(held), /hold/);
    const blocked = await f.build();
    await f.db.query("update manufacturing_orders set phase='blocked',issue='Artwork missing' where order_id=$1", [blocked]);
    await assert.rejects(f.s.sendToPrinters(blocked), /hold/);
    const refunded = await f.order();
    await f.db.query("insert into store_refunds(order_id,status) values($1,'pending')", [refunded]);
    await assert.rejects(f.s.sendToPrinters(refunded), /hold|eligible/);
    const released = await f.order();
    await f.db.query("update manufacturing_orders set inventory_released_at=now() where order_id=$1", [released]);
    await assert.rejects(f.s.sendToPrinters(released), /eligible/);
    const finished = [];
    for (const change of ["phase='complete'", "inventory_posted_at=now()", "inventory_consumed_at=now()", "state='{\"packed\":true}'::jsonb"]) {
      const id = await f.build();
      finished.push(id);
      await f.db.query(`update manufacturing_orders set ${change} where order_id=$1`, [id]);
      await assert.rejects(f.s.sendToPrinters(id), /Completed|reprint/);
    }
    for (const id of [held, blocked, refunded, released, ...finished]) assert.equal((await f.row(id)).print_requested_at, null);
  } finally { await f.db.close(); }
});

test("approval allocates missing finished-stock plans once and exposes no public execution permission", async () => {
  const f = await fixture();
  try {
    await f.rpc("adjust_stock", [randomUUID(), "reef-dive-pack", 3, "Shelf count"]);
    // A paid order inserted before its items arrives with no saved allocation.
    const id = randomUUID();
    await f.db.query("insert into store_orders(id,order_number,payment_status) values($1,'LATE-ITEMS','paid')", [id]);
    await assert.rejects(f.s.sendToPrinters(id), /items.*ready/);
    assert.equal((await f.row(id)).print_requested_at, null);
    await f.db.query("insert into store_order_items values($1,'reef-dive-pack','Reef booster',5)", [id]);
    await f.s.sendToPrinters(id);
    const allocated = await f.row(id), inventory = await f.stock(), movements = await f.movements();
    assert.deepEqual(allocated.inventory_plan, [{ productId: "reef-dive-pack", quantity: 5, fromStock: 3, toMake: 2 }]);
    await f.s.sendToPrinters(id);
    assert.deepEqual(await f.stock(), inventory);
    assert.deepEqual(await f.movements(), movements);
    for (const role of ["anon", "authenticated"]) {
      await f.db.exec(`set role ${role}`);
      await assert.rejects(f.rpc("send_to_printers", [id]), /permission denied/);
      await assert.rejects(f.rpc("claim", [randomUUID(), true]), /permission denied/);
      await assert.rejects(f.rpc("commit", [id, randomUUID(), 0, {}, {}, "active"]), /permission denied/);
      await assert.rejects(f.db.query("update manufacturing_orders set print_requested_at=now() where order_id=$1", [id]), /permission denied/);
      await f.db.exec("reset role");
    }
    assert.equal((await f.db.query("select has_function_privilege('service_role','manufacturing_send_to_printers(uuid)','EXECUTE') as allowed")).rows[0].allowed, true);
  } finally { await f.db.close(); }
});
