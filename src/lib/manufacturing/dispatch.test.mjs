import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { buildPrintingCatalog } from "./boosters.mjs";
import { manufacturingService } from "./integration.mjs";
import { applyManufacturingEvent, createManufacturingState } from "./workflow.mjs";
import { createManufacturingManifest } from "./printPlan.mjs";

const catalog = buildPrintingCatalog(
  JSON.parse(await readFile(new URL("../../data/gallery-set-list.json", import.meta.url))),
  JSON.parse(await readFile(new URL("../../data/gallery-images.json", import.meta.url))),
);
const migration = (name) => readFile(new URL(`../../../supabase/${name}.sql`, import.meta.url), "utf8");
const dispatchSql = await migration("manufacturing-dispatch");
const receivingSql = (await migration("manufacturing-receiving")).replace(/\r\n/g, "\n");
const batchPrintSql = await migration("manufacturing-batch-print");
const legacyMilestone = "if p_event->>'type'='confirm_printed' and p_event->>'side'<>'ticket' then milestone:='in_production'; end if;";
const finishingMilestone = "if p_event->>'role'='operator' and (p_event->>'type'='glued' or\n      (p_event->>'type'='confirm_printed' and p_event->>'side'<>'ticket')) then milestone:='in_production'; end if;";
const commitSignature = "public.manufacturing_commit(uuid,uuid,integer,jsonb,jsonb,text)";

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
        not(key, operator, value) { assert.equal(operator, "is"); assert.equal(value, null); terms.push(`${identifier(key)} is not null`); return q; },
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

async function fixture({ dispatch = true, receiving = false } = {}) {
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
  if (receiving) {
    assert.ok(receivingSql.includes(finishingMilestone));
    // Start from the installed legacy predicate, then exercise the focused upgrade.
    await db.exec(receivingSql.replace(finishingMilestone, legacyMilestone));
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
    assert.equal(prepared.state.ticket.ticket, "not_required");
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
    await assert.rejects(f.event(id, "reprint", { ...target, reason: "Smudged front sheet" }), /print helper to finish/);
    await f.db.query("update manufacturing_orders set leased_until=now()-interval '1 second' where order_id=$1", [id]);
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
    const prepared = await f.s.claim(token);
    // Preserve a ticket attempt made by the old helper before the new policy.
    const legacy = { ...prepared.state, revision: 1, ticket: { ticket: "submitting" } };
    await f.db.query("update manufacturing_orders set state=$2,revision=1 where order_id=$1", [id, legacy]);
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

test("batch migration changes only the installed milestone predicate and preserves grants and active jobs", async () => {
  const f = await fixture({ receiving: true });
  try {
    const id = await f.order({ productId: "dice-pack" }), token = randomUUID();
    await f.s.sendToPrinters(id);
    await f.s.claim(token);
    const functionInfo = async () => (await f.db.query(
      "select pg_get_functiondef(oid) as definition,proowner,proacl,prosecdef,proconfig from pg_proc where oid=$1::regprocedure",
      [commitSignature],
    )).rows[0];
    const original = await functionInfo();
    await f.db.exec(original.definition.replace("  select * into o from store_orders", "  -- Preserve unrelated installed changes.\n  select * into o from store_orders"));
    const before = await functionInfo(), job = await f.row(id);
    await f.db.exec(batchPrintSql);
    const upgraded = await functionInfo();
    assert.deepEqual(upgraded, { ...before, definition: before.definition.replace(legacyMilestone, finishingMilestone) });
    await f.db.exec(batchPrintSql);
    assert.deepEqual(await functionInfo(), upgraded, "Reapplying does not redefine or alter the function");
    assert.deepEqual(await f.row(id), job, "Migration does not change saved state, approval, manifest, or live lease");
    for (const role of ["anon", "authenticated"]) {
      await f.db.exec(`set role ${role}`);
      await assert.rejects(f.rpc("commit", [id, token, 0, {}, {}, "active"]), /permission denied/);
      await f.db.exec("reset role");
    }
    assert.equal((await f.db.query("select has_function_privilege('service_role',$1,'EXECUTE') as allowed", [commitSignature])).rows[0].allowed, true);
    for (const unexpected of ["if false then milestone:='in_production'; end if;", legacyMilestone + "\n    " + legacyMilestone]) {
      const definition = upgraded.definition.replace(finishingMilestone, unexpected);
      await f.db.exec(definition);
      await assert.rejects(f.db.exec(batchPrintSql), /Unexpected manufacturing_commit milestone predicate/);
      await f.db.exec("rollback");
      assert.equal((await functionInfo()).definition, definition, "An unfamiliar or ambiguous predicate is not overwritten");
    }
    await f.db.exec(receivingSql.replace(/\n/g, "\r\n"));
    const canonical = await functionInfo();
    await f.db.exec(batchPrintSql.replace(/\r?\n/g, "\r\n"));
    assert.deepEqual(await functionInfo(), canonical, "The updated receiving baseline is recognized without rewriting Windows line endings");
  } finally { await f.db.close(); }
});

test("all queued sheets submit under one lease without Paper checked and gluing queues in-production once", async () => {
  const f = await fixture({ receiving: true });
  try {
    await f.db.exec(batchPrintSql);
    await f.artwork();
    const id = await f.order({ quantity: 2 }), token = randomUUID();
    await f.s.sendToPrinters(id);
    const prepared = await f.s.claim(token);
    assert.equal(prepared.manifest.sheets.length, 2);
    const targets = [{ side: "ticket" }, ...prepared.manifest.sheets.flatMap(({ sheetId }) => [
      { sheetId, side: "fronts" }, { sheetId, side: "backs" },
    ])];
    for (const [i, target] of targets.entries()) {
      await f.event(id, "submission_started", target, "agent", token);
      const submitting = await f.row(id);
      assert.equal(submitting.phase, "active");
      assert.equal(submitting.lease_token, token);
      await f.event(id, "submission_succeeded", target, "agent", token);
      const submitted = await f.row(id), hasQueuedPages = i < targets.length - 1;
      assert.equal(submitted.phase, hasQueuedPages ? "active" : "awaiting_operator");
      assert.equal(submitted.lease_token, hasQueuedPages ? token : null);
      assert.equal(await f.rpc("heartbeat", [id, token]), hasQueuedPages);
      assert.equal(await f.s.claim(randomUUID()), null, "A submitted job cannot be duplicated by another claim");
    }
    const printed = await f.row(id);
    assert.equal(printed.state.ticket.ticket, "submitted");
    for (const sheet of Object.values(printed.state.sheets)) {
      assert.equal(sheet.fronts, "submitted");
      assert.equal(sheet.backs, "submitted");
    }
    const status = async () => (await f.db.query("select fulfillment_status from store_orders where id=$1", [id])).rows[0].fulfillment_status;
    const notices = async () => (await f.db.query("select milestone,status from manufacturing_notifications where order_id=$1 order by milestone", [id])).rows;
    assert.equal(await status(), "unfulfilled", "Spool acceptance is not physical production evidence");
    assert.deepEqual(await notices(), []);
    const first = prepared.manifest.sheets[0].sheetId;
    await assert.rejects(f.event(id, "glued", { sheetId: first }, "agent", token), /Only an operator/);
    await f.event(id, "glued", { sheetId: first });
    assert.equal(await status(), "in_production");
    assert.deepEqual(await notices(), [{ milestone: "in_production", status: "pending" }]);
    for (const { sheetId } of prepared.manifest.sheets) {
      if (sheetId !== first) await f.event(id, "glued", { sheetId });
      await f.event(id, "cut", { sheetId });
    }
    for (const holo of prepared.manifest.holoChecklist)
      await f.event(id, prepared.manifest.holoHandling === "pull-finished" ? "holo_pulled" : "holo_applied", { holoId: holo.id });
    await f.event(id, "quality_checked");
    assert.equal(await status(), "packing");
    await f.event(id, "confirm_printed", { sheetId: first, side: "fronts" });
    assert.equal(await status(), "packing", "A legacy confirmation cannot downgrade fulfillment");
    assert.deepEqual(await notices(), [{ milestone: "in_production", status: "pending" }, { milestone: "packing", status: "pending" }]);
    await f.event(id, "packed");
    assert.equal((await f.row(id)).phase, "complete");
  } finally { await f.db.close(); }
});

test("legacy paper confirmation still starts production, while tickets and stock builds do not notify buyers", async () => {
  const f = await fixture({ receiving: true });
  try {
    await f.db.exec(batchPrintSql);
    await f.artwork();
    const id = await f.order(), token = randomUUID();
    await f.s.sendToPrinters(id);
    const prepared = await f.s.claim(token);
    for (const type of ["submission_started", "submission_succeeded"])
      await f.event(id, type, { side: "ticket" }, "agent", token);
    await f.event(id, "confirm_printed", { side: "ticket" });
    assert.equal((await f.db.query("select fulfillment_status from store_orders where id=$1", [id])).rows[0].fulfillment_status, "unfulfilled");
    assert.equal((await f.db.query("select count(*)::integer as n from manufacturing_notifications")).rows[0].n, 0);
    const target = { sheetId: prepared.manifest.sheets[0].sheetId, side: "fronts" };
    for (const type of ["submission_started", "submission_succeeded"])
      await f.event(id, type, target, "agent", token);
    await f.event(id, "confirm_printed", target);
    assert.equal((await f.db.query("select fulfillment_status from store_orders where id=$1", [id])).rows[0].fulfillment_status, "in_production");
    const notices = (await f.db.query("select * from manufacturing_notifications")).rows;
    assert.equal(notices.length, 1);
    const stockId = await f.build([{ productId: "reef-dive-pack", quantity: 1 }]), stockToken = randomUUID();
    await f.s.sendToPrinters(stockId);
    const stock = await f.s.claim(stockToken);
    assert.equal(stock.order_id, stockId);
    const inventory = await f.stock(), movements = await f.movements();
    const sheetId = stock.manifest.sheets[0].sheetId;
    assert.equal(stock.state.ticket.ticket, "not_required");
    for (const print of [{ sheetId, side: "fronts" }, { sheetId, side: "backs" }])
      for (const type of ["submission_started", "submission_succeeded"])
        await f.event(stockId, type, print, "agent", stockToken);
    await f.event(stockId, "glued", { sheetId });
    assert.deepEqual((await f.db.query("select * from manufacturing_notifications")).rows, notices);
    assert.deepEqual(await f.stock(), inventory, "Gluing is not a finished-product receipt");
    assert.deepEqual(await f.movements(), movements);
    assert.equal((await f.row(stockId)).inventory_posted_at, null);
  } finally { await f.db.close(); }
});

test("legacy stock ticket retirement releases its lease without printing or changing inventory", async () => {
  const f = await fixture();
  try {
    for (const status of ["queued", "submitting", "needs_review"]) {
      const id = await f.build(), token = randomUUID();
      await f.s.sendToPrinters(id);
      const prepared = await f.s.claim(token);
      const legacy = { ...prepared.state, ticket: { ticket: status } };
      await f.db.query("update manufacturing_orders set state=$2 where order_id=$1", [id, legacy]);
      const inventory = await f.stock(), movements = await f.movements();
      const retired = await f.event(id, "stock_ticket_skipped", { sheetId: "work-ticket", side: "ticket" }, "agent", token);
      assert.equal(retired.state.ticket.ticket, "not_required");
      const saved = await f.row(id);
      assert.equal(saved.phase, "awaiting_operator");
      assert.equal(saved.lease_token, null);
      assert.equal(saved.state.events.at(-1).previousTicketStatus, status);
      assert.equal(saved.manifest_text, JSON.stringify(prepared.manifest));
      assert.deepEqual(await f.stock(), inventory);
      assert.deepEqual(await f.movements(), movements);
    }
    assert.equal((await f.db.query("select count(*)::integer as n from manufacturing_notifications")).rows[0].n, 0);
  } finally { await f.db.close(); }
});


// Selected page recovery remains one existing-job transaction; no new stock job,
// inventory receipt, catalog lookup, or booster draw is created.
async function pageReprintFixture() {
  const f = await fixture({ receiving: true });
  await f.artwork();
  const items = [{ productId: "coral-garden", quantity: 1 }, { productId: "starter-kit", quantity: 1 }, { productId: "reef-dive-pack", quantity: 1 }];
  const id = await f.build(items), r = await f.row(id);
  const manifest = createManufacturingManifest({ request: { orderId: id, orderNumber: r.display_number, items },
    catalog, artworkRelease: r.release_id, jobKind: "stock", randomIndex: () => 0 });
  const state = createManufacturingState(manifest);
  for (const page of Object.values(state.sheets)) Object.assign(page, { fronts: "confirmed", backs: "confirmed", glued: true, cut: true });
  for (const key of Object.keys(state.holos)) state.holos[key] = true;
  state.qualityChecked = true;
  await f.db.query("update manufacturing_orders set manifest_text=$2,state=$3,phase='awaiting_operator',print_requested_at=now() where order_id=$1", [id, JSON.stringify(manifest), state]);
  const pages = manifest.sheets.filter(s => s.productId === "coral-garden");
  const input = { id: randomUUID(), type: "reprint", expectedRevision: 0, productId: "coral-garden", reason: "Replace damaged pages",
    targets: [{ sheetId: pages[1].sheetId, side: "fronts" }, { sheetId: pages[4].sheetId, side: "fronts" }, { sheetId: pages[4].sheetId, side: "backs" }] };
  return { ...f, id, manifest, state, pages, input };
}

test("selected page reprints commit once, preserve the saved draw, and never credit inventory", async () => {
  const f = await pageReprintFixture();
  try {
    const before = await f.row(f.id), stock = await f.stock(), movements = await f.movements();
    const result = await f.s.event(f.id, f.input, "operator");
    assert.equal(result.revision, 1);
    assert.equal(result.state.events.length, 1);
    assert.equal(result.state.events[0].type, "reprint");
    assert.equal(result.state.events[0].side, "fronts", "existing SQL received-stock guard sees a real non-ticket side");
    assert.equal(result.phase, "queued");
    for (const [id, page] of Object.entries(result.state.sheets)) {
      for (const side of ["fronts", "backs"])
        assert.equal(page[side], f.input.targets.some(t => t.sheetId === id && t.side === side) ? "queued" : "confirmed");
      const changed = f.input.targets.some(t => t.sheetId === id);
      assert.equal(page.glued, !changed); assert.equal(page.cut, !changed);
    }
    assert.equal(result.state.qualityChecked, false);
    assert.deepEqual(result.manifest, f.manifest);
    assert.deepEqual(result.manifest.packs, f.manifest.packs);
    assert.equal((await f.row(f.id)).manifest_text, before.manifest_text);
    assert.deepEqual(await f.stock(), stock); assert.deepEqual(await f.movements(), movements);
    assert.deepEqual(result.received_quantities, before.received_quantities);
    assert.equal(Number((await f.db.query("select count(*) as n from manufacturing_notifications")).rows[0].n), 0);
    await f.db.query("update manufacturing_orders set phase='active',lease_token=$2,leased_until=now()+interval '2 minutes' where order_id=$1", [f.id, randomUUID()]);
    const retry = await f.s.event(f.id, f.input, "operator");
    assert.equal(retry.revision, 1); assert.equal(retry.state.events.length, 1);
    await assert.rejects(f.s.event(f.id, { ...f.input, reason: "Different request" }, "operator"), /reused for a different/);
  } finally { await f.db.close(); }
});

test("invalid or cross-product page selections fail atomically", async () => {
  const f = await pageReprintFixture();
  try {
    const before = await f.row(f.id), other = f.manifest.sheets.find(s => s.productId === "starter-kit");
    for (const update of [
      { targets: [] }, { targets: [...f.input.targets, f.input.targets[0]] },
      { targets: [...f.input.targets, { sheetId: "missing", side: "fronts" }] },
      { targets: [{ sheetId: other.sheetId, side: "fronts" }] },
      { targets: [{ sheetId: f.pages[0].sheetId, side: "ticket" }] },
      { productId: "reef-dive-pack" }, { reason: "" }, { expectedRevision: 9 },
    ]) {
      await assert.rejects(f.s.event(f.id, { ...f.input, ...update }, "operator"));
      assert.deepEqual(await f.row(f.id), before);
    }
    await assert.rejects(f.s.event(f.id, f.input, "agent", randomUUID()), /Only staff/);
    assert.deepEqual(await f.row(f.id), before);
  } finally { await f.db.close(); }
});

test("page reprints reject live leases, unfinished queues, unrequested work and received stock", async () => {
  const f = await pageReprintFixture();
  try {
    const before = await f.row(f.id);
    for (const patch of [
      { phase: "active", leased_until: new Date(Date.now() + 120000).toISOString() },
      { phase: "active" }, { print_requested_at: null }, { inventory_posted_at: new Date().toISOString() },
      { received_quantities: { "coral-garden": 1 } },
      { state: { ...f.state, hold: true } },
      ...["queued", "submitting"].map(status => ({ state: { ...f.state, sheets: { ...f.state.sheets,
        [f.manifest.sheets[0].sheetId]: { ...f.state.sheets[f.manifest.sheets[0].sheetId], fronts: status } } } })),
    ]) {
      const entries = Object.entries(patch);
      await f.db.query("update manufacturing_orders set " + entries.map(([k], i) => k + "=$" + (i + 2)).join(",") + " where order_id=$1", [f.id, ...entries.map(([,v]) => v)]);
      const changed = await f.row(f.id);
      await assert.rejects(f.s.event(f.id, f.input, "operator"));
      assert.deepEqual(await f.row(f.id), changed, "rejected request cannot mutate the job");
      await f.db.query("update manufacturing_orders set state=$2,phase=$3,leased_until=$4,print_requested_at=$5,inventory_posted_at=$6,received_quantities=$7 where order_id=$1",
        [f.id, before.state, before.phase, before.leased_until, before.print_requested_at, before.inventory_posted_at, before.received_quantities]);
    }
    const next = await f.s.event(f.id, f.input, "operator");
    await f.db.query("update manufacturing_orders set state=$2,revision=0,inventory_posted_at=now() where order_id=$1", [f.id, before.state]);
    await assert.rejects(f.rpc("commit", [f.id, null, 0, next.state, next.state.events[0], "queued"]), /Finished stock already received/);
    assert.equal((await f.row(f.id)).revision, 0, "SQL still protects received stock for the batch form");
  } finally { await f.db.close(); }
});

test("product page history is read-only, product-scoped and exposes saved page statuses", async () => {
  const f = await pageReprintFixture();
  try {
    const before = await f.row(f.id), products = await f.s.productPages("coral-garden");
    assert.equal(products.historyLimit, 100); assert.equal(products.jobs.length, 1);
    const job = products.jobs[0];
    assert.equal(job.orderId, f.id); assert.equal(job.manifestHash, f.manifest.manifestHash);
    assert.equal(job.pages.length, 7); assert.equal(job.reprintBlockedReason, "");
    assert.equal(job.pages[0].label, "Coral Garden \u00b7 Page 1");
    const kit = (await f.s.productPages("starter-kit")).jobs[0];
    assert.ok(kit.pages.some(page => page.label === "Drop Off \u00b7 Page 1"));
    assert.ok(kit.pages.some(page => page.label === "Conditions \u00b7 Page 2"));
    assert.ok(job.pages.every(p => p.frontsStatus === "confirmed" && p.backsStatus === "confirmed"));
    assert.deepEqual(job.pages.map(p => p.sheetId), f.pages.map(p => p.sheetId));
    assert.equal(job.manifest, undefined); assert.equal(job.state, undefined); assert.equal(job.lease_token, undefined);
    await assert.rejects(f.s.productPages("reef-dive-pack"), /multiple print pages/);
    assert.deepEqual(await f.row(f.id), before);
    const pending = structuredClone(f.state); pending.sheets[f.manifest.sheets[0].sheetId].fronts = "queued";
    await f.db.query("update manufacturing_orders set state=$2 where order_id=$1", [f.id, pending]);
    assert.match((await f.s.productPages("coral-garden")).jobs[0].reprintBlockedReason, /current print queue/,
      "pending pages in another product block a selected-only reprint");
  } finally { await f.db.close(); }
});


test("lost batch commit acknowledgements require the same request ID and retry without another queue mutation", async () => {
  const f = await pageReprintFixture();
  try {
    const client = serviceClient(f.db), rpc = client.rpc.bind(client), from = client.from.bind(client);
    let loseReply = true, loseRead = false;
    client.from = table => {
      const query = from(table);
      if (loseRead && table === "manufacturing_orders") {
        loseRead = false;
        query.then = (resolve, reject) => Promise.reject(new TypeError("Read connection interrupted")).then(resolve, reject);
      }
      return query;
    };
    client.rpc = async (name, args) => {
      const result = await rpc(name, args);
      if (name === "manufacturing_commit" && loseReply) { loseReply = false; throw new TypeError("Connection interrupted"); }
      return result;
    };
    const s = manufacturingService(client);
    await assert.rejects(s.event(f.id, f.input, "operator"), error => error.status === 503);
    assert.equal((await f.row(f.id)).revision, 1, "commit can succeed before its response is lost");
    loseRead = true;
    await assert.rejects(s.event(f.id, f.input, "operator"), error => error.status === 503,
      "a retry read failure remains unknown and must retain the same request ID");
    assert.equal((await f.row(f.id)).revision, 1);
    const retry = await s.event(f.id, f.input, "operator");
    assert.equal(retry.revision, 1); assert.equal(retry.state.events.length, 1);
  } finally { await f.db.close(); }
});
