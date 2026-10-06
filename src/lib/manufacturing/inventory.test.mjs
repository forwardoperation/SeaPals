import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  createManufacturingManifest,
  productionItemsForPlan,
} from "./printPlan.mjs";
import {
  createManufacturingState,
  applyManufacturingEvent,
  workflowReadiness,
} from "./workflow.mjs";
import { buildPrintingCatalog } from "./boosters.mjs";
import { manufacturingService } from "./integration.mjs";

const catalog = buildPrintingCatalog(
  JSON.parse(
    await readFile(
      new URL("../../data/gallery-set-list.json", import.meta.url),
    ),
  ),
  JSON.parse(
    await readFile(new URL("../../data/gallery-images.json", import.meta.url)),
  ),
);
const request = (quantity = 5) => ({
  orderId: randomUUID(),
  orderNumber: "STOCK-TEST",
  items: [{ productId: "reef-dive-pack", quantity }],
});
test("finished stock supplies three boosters and only the missing two are drawn and printed", () => {
  const r = request(),
    plan = [
      { productId: "reef-dive-pack", quantity: 5, fromStock: 3, toMake: 2 },
    ];
  const m = createManufacturingManifest({
    request: r,
    catalog,
    artworkRelease: "test",
    inventoryPlan: plan,
    randomIndex: () => 0,
  });
  assert.equal(m.packs.length, 2);
  assert.equal(m.sheets.length, 2);
  assert.equal(m.order.items[0].quantity, 5);
  assert.equal(m.holoChecklist.length, 2);
  assert.deepEqual(createManufacturingState(m).stock, {
    "reef-dive-pack": false,
  });
  assert.throws(
    () => productionItemsForPlan(r.items, [{ ...plan[0], toMake: 3 }]),
    /allocation/,
  );
});
test("fully stocked orders need no artwork or draw, and picking stock gates quality check", () => {
  const r = request(2),
    m = createManufacturingManifest({
      request: r,
      catalog: [],
      artworkRelease: "stock-only",
      inventoryPlan: [
        { productId: "reef-dive-pack", quantity: 2, fromStock: 2, toMake: 0 },
      ],
      randomIndex: () => {
        throw new Error("must not draw");
      },
    });
  assert.equal(m.sheets.length, 0);
  assert.equal(m.packs.length, 0);
  let s = createManufacturingState(m);
  assert.equal(workflowReadiness(s).canQualityCheck, false);
  assert.throws(
    () =>
      applyManufacturingEvent(s, m, {
        id: randomUUID(),
        role: "operator",
        actor: "staff",
        expectedRevision: 0,
        type: "quality_checked",
      }),
    /stock picks/,
  );
  s = applyManufacturingEvent(s, m, {
    id: randomUUID(),
    role: "operator",
    actor: "staff",
    expectedRevision: 0,
    type: "stock_picked",
    productId: "reef-dive-pack",
  });
  assert.equal(workflowReadiness(s).canQualityCheck, true);
});

async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create table store_orders(id uuid primary key,order_number text,payment_status text default 'pending',payment_livemode boolean default true,
      amount_refunded_cents integer default 0,dispute_status text,fulfillment_status text default 'unfulfilled',updated_at timestamptz default now());
    create table store_order_items(order_id uuid references store_orders(id),product_id text,product_name text,quantity integer);
    create table store_refunds(id uuid primary key default gen_random_uuid(),order_id uuid,status text);
    create table store_inventory(sku text primary key,on_hand_quantity integer,reserved_quantity integer);
    insert into store_inventory values('SP-PACK-REEF',10,0);
    create schema storage;create table storage.objects(bucket_id text);`);
  for (const name of [
    "manufacturing.sql",
    "manufacturing-inventory.sql",
    "manufacturing-inventory.sql",
  ])
    await db.exec(
      await readFile(
        new URL(`../../../supabase/${name}`, import.meta.url),
        "utf8",
      ),
    );
  const rpc = async (name, args) =>
    (
      await db.query(
        `select manufacturing_${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`,
        args,
      )
    ).rows[0].value;
  const stock = async () =>
    (
      await db.query(
        "select * from manufacturing_stock where product_id='reef-dive-pack'",
      )
    ).rows[0];
  const order = async (qty, live = true) => {
    const id = randomUUID();
    await db.query(
      "insert into store_orders(id,order_number,payment_livemode) values($1,'ORDER-TEST',$2)",
      [id, live],
    );
    await db.query(
      "insert into store_order_items values($1,'reef-dive-pack','Reef Booster',$2)",
      [id, qty],
    );
    await db.query(
      "update store_orders set payment_status='paid' where id=$1",
      [id],
    );
    return id;
  };
  const row = async (id) =>
    (
      await db.query("select * from manufacturing_orders where order_id=$1", [
        id,
      ])
    ).rows[0];
  return { db, rpc, stock, order, row };
}

// Exercise the real service/RPC boundary against PostgreSQL without external I/O.
function serviceClient(db) {
  const identifier = (s) => {
    assert.match(s, /^[a-z_]+$/);
    return s;
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
      const terms = [],
        values = [];
      let single = false;
      const q = {
        select() {
          return q;
        },
        eq(key, value) {
          values.push(value);
          terms.push(`${identifier(key)}=$${values.length}`);
          return q;
        },
        order() {
          return q;
        },
        limit() {
          return q;
        },
        single() {
          single = true;
          return q;
        },
        then(resolve, reject) {
          (async () => {
            let rows = (
              await db.query(
                `select * from ${table}${terms.length ? " where " + terms.join(" and ") : ""}`,
                values,
              )
            ).rows;
            if (table === "store_orders")
              for (const r of rows)
                r.store_order_items = (
                  await db.query(
                    "select * from store_order_items where order_id=$1",
                    [r.id],
                  )
                ).rows;
            return { data: single ? rows[0] : rows };
          })().then(resolve, reject);
        },
      };
      return q;
    },
  };
}

test("the service prepares stock-only orders and independent accessory builds with no artwork or fake purchases", async () => {
  const { db, rpc, order } = await fixture();
  try {
    const s = manufacturingService(serviceClient(db));
    await rpc("adjust_stock", [
      randomUUID(),
      "reef-dive-pack",
      2,
      "Opening count",
    ]);
    const id = await order(2),
      job = await s.claim(randomUUID());
    assert.equal(job.order_id, id);
    assert.equal(job.manifest.packs.length, 0);
    assert.equal(job.manifest.sheets.length, 0);
    assert.equal(job.manifest.inventoryPlan[0].fromStock, 2);
    assert.equal(job.release.releaseId, "stock-only");
    const stockId = randomUUID();
    await s.createStock(stockId, [{ productId: "dice-pack", quantity: 2 }]);
    const built = await s.claim(randomUUID());
    assert.equal(built.order_id, stockId);
    assert.equal(built.manifest.jobKind, "stock");
    assert.equal(built.manifest.accessoryChecklist[0].quantity, 14);
    assert.equal(built.order.customer_email, undefined);
    assert.equal(
      (await s.detail(stockId)).order.fulfillment_method,
      "inventory",
    );
    assert.equal(
      (await db.query("select count(*)::integer as n from store_orders"))
        .rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});

test("database inventory: duplicate receipts, competing reservations, partial shortages, cancellation and test isolation", async () => {
  const { db, rpc, stock, order, row } = await fixture();
  try {
    const receipt = randomUUID();
    await rpc("adjust_stock", [
      receipt,
      "reef-dive-pack",
      3,
      "Opening shelf count",
    ]);
    await rpc("adjust_stock", [
      receipt,
      "reef-dive-pack",
      3,
      "Opening shelf count",
    ]);
    await assert.rejects(
      rpc("adjust_stock", [
        receipt,
        "reef-dive-pack",
        4,
        "Opening shelf count",
      ]),
      /reused/,
    );
    const a = await order(5),
      b = await order(2);
    assert.deepEqual((await row(a)).inventory_plan, [
      { productId: "reef-dive-pack", quantity: 5, fromStock: 3, toMake: 2 },
    ]);
    assert.equal((await row(b)).inventory_plan[0].fromStock, 0);
    assert.equal((await stock()).reserved, 3);
    await db.query(
      "update store_orders set payment_status='paid' where id=$1",
      [a],
    );
    assert.equal((await stock()).reserved, 3);
    await assert.rejects(
      rpc("adjust_stock", [randomUUID(), "reef-dive-pack", -1, "Damage"]),
      /reserved/,
    );
    await db.query(
      "update store_orders set fulfillment_status='cancelled' where id=$1",
      [a],
    );
    assert.equal((await stock()).reserved, 0);
    assert.equal((await stock()).on_hand, 3);
    await db.query(
      "update store_orders set amount_refunded_cents=100 where id=$1",
      [a],
    );
    assert.equal((await stock()).reserved, 0);
    await assert.rejects(rpc("retry", [a]), /eligible|review/);
    const testOrder = await order(2, false);
    assert.equal((await row(testOrder)).inventory_plan[0].fromStock, 0);
    assert.deepEqual((await db.query("select * from store_inventory")).rows, [
      { sku: "SP-PACK-REEF", on_hand_quantity: 10, reserved_quantity: 0 },
    ]);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        db.query("select * from manufacturing_stock"),
        /permission denied/,
      );
      await db.exec("reset role");
    }
  } finally {
    await db.close();
  }
});

test("stock-only paid order can claim without artwork; packing consumes once and refund does not invent a return", async () => {
  const { db, rpc, stock, order, row } = await fixture();
  try {
    await rpc("adjust_stock", [
      randomUUID(),
      "reef-dive-pack",
      4,
      "Opening count",
    ]);
    const id = await order(2),
      token = randomUUID(),
      claimed = await rpc("claim", [token, false]);
    assert.equal(claimed.order_id, id);
    assert.equal(claimed.release_id, null);
    const m = createManufacturingManifest({
      request: { ...request(2), orderId: id, orderNumber: "ORDER-TEST" },
      catalog: [],
      artworkRelease: "stock-only",
      inventoryPlan: claimed.inventory_plan,
    });
    let state = createManufacturingState(m);
    await rpc("save_manifest", [id, token, JSON.stringify(m), state]);
    for (const type of ["stock_picked", "quality_checked", "packed"]) {
      const e = {
        id: randomUUID(),
        type,
        productId: "reef-dive-pack",
        role: "operator",
        actor: "staff",
        expectedRevision: state.revision,
      };
      const next = applyManufacturingEvent(state, m, e);
      await rpc("commit", [
        id,
        null,
        state.revision,
        next,
        e,
        type === "packed" ? "complete" : "awaiting_operator",
      ]);
      state = next;
    }
    assert.equal((await stock()).on_hand, 2);
    assert.equal((await stock()).reserved, 0);
    const e = {
      id: randomUUID(),
      type: "packed",
      role: "operator",
      actor: "staff",
      expectedRevision: state.revision,
    };
    const next = applyManufacturingEvent(state, m, e);
    await rpc("commit", [id, null, state.revision, next, e, "complete"]);
    assert.equal((await stock()).on_hand, 2);
    state=next;
    await rpc("publish",["new-art",JSON.stringify({releaseId:"new-art"})]);
    const reprint={id:randomUUID(),type:"reprint",side:"ticket",reason:"Damaged ticket",role:"operator",actor:"staff",expectedRevision:state.revision};
    const ticketState=applyManufacturingEvent(state,m,reprint);
    await rpc("commit",[id,null,state.revision,ticketState,reprint,"queued"]);
    assert.equal((await rpc("claim",[randomUUID(),false])).release_id,null,"A stock-only manifest must stay independent of later artwork releases");
    await db.query(
      "insert into store_refunds(order_id,status) values($1,'pending')",
      [id],
    );
    assert.equal((await stock()).on_hand, 2);
    assert.equal((await row(id)).phase, "blocked");
    assert.equal(
      (
        await db.query("select milestone from manufacturing_notifications")
      ).rows.some((x) => x.milestone === "in_production"),
      false,
    );
  } finally {
    await db.close();
  }
});

test("independent stock builds are received once after finishing and have no customer or buyer notifications", async () => {
  const { db, rpc, stock, row } = await fixture();
  try {
    const id = randomUUID(),
      items = [{ productId: "reef-dive-pack", quantity: 2 }],
      token = randomUUID();
    await rpc("create_stock_job", [id, items]);
    await rpc("create_stock_job", [id, items]);
    await assert.rejects(
      rpc("create_stock_job", [
        id,
        [{ productId: "reef-dive-pack", quantity: 1 }],
      ]),
      /reused/,
    );
    assert.equal((await stock()).on_hand, 0);
    assert.equal((await db.query("select * from store_orders")).rows.length, 0);
    const claimed = await rpc("claim", [token, false]);
    assert.equal(claimed.job_kind, "stock");
    await rpc("publish", ["test", JSON.stringify({ releaseId: "test" })]);
    // Pin the release before saving the draw, as a job created with artwork does.
    await db.query(
      "update manufacturing_orders set release_id='test' where order_id=$1",
      [id],
    );
    const m = createManufacturingManifest({
      request: { orderId: id, orderNumber: claimed.display_number, items },
      catalog,
      artworkRelease: "test",
      jobKind: "stock",
      randomIndex: () => 0,
    });
    let state = createManufacturingState(m);
    await rpc("save_manifest", [id, token, JSON.stringify(m), state]);
    async function event(type, fields = {}) {
      const e = {
          id: randomUUID(),
          type,
          role: "operator",
          actor: "staff",
          expectedRevision: state.revision,
          ...fields,
        },
        next = applyManufacturingEvent(state, m, e);
      await rpc("commit", [
        id,
        null,
        state.revision,
        next,
        e,
        type === "packed" ? "complete" : "active",
      ]);
      state = next;
    }
    await assert.rejects(event("packed"), /Quality check/);
    for (const sheet of m.sheets) {
      for (const side of ["fronts", "backs"]) {
        for (const type of [
          "submission_started",
          "submission_succeeded",
          "confirm_printed",
        ])
          await event(type, { sheetId: sheet.sheetId, side });
      }
      await event("glued", { sheetId: sheet.sheetId });
      await event("cut", { sheetId: sheet.sheetId });
    }
    for (const h of m.holoChecklist)
      await event("holo_applied", { holoId: h.id });
    await event("quality_checked");
    assert.equal((await stock()).on_hand, 0);
    await event("packed");
    await event("packed");
    assert.equal((await stock()).on_hand, 2);
    assert.ok((await row(id)).inventory_posted_at);
    await assert.rejects(
      event("reprint", {
        sheetId: m.sheets[0].sheetId,
        side: "fronts",
        reason: "Damaged",
      }),
      /already received/,
    );
    assert.equal(
      (await db.query("select * from manufacturing_notifications")).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select * from manufacturing_stock_movements where job_id=$1",
          [id],
        )
      ).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});

test("pending refund releases a reservation before packing, and a late stock receipt does not reroll a saved allocation", async () => {
  const { db, rpc, stock, order, row } = await fixture();
  try {
    await rpc("adjust_stock", [
      randomUUID(),
      "reef-dive-pack",
      2,
      "Opening count",
    ]);
    const id = await order(3),
      original = (await row(id)).inventory_plan;
    await rpc("adjust_stock", [
      randomUUID(),
      "reef-dive-pack",
      5,
      "Another finished batch",
    ]);
    await rpc("allocate_stock", [id]);
    assert.deepEqual((await row(id)).inventory_plan, original);
    await db.exec(await readFile(new URL("../../../supabase/manufacturing-inventory.sql",import.meta.url),"utf8"));
    assert.equal((await stock()).on_hand,7,"Rerunning the migration does not reset physical stock");
    assert.equal((await stock()).reserved,2);
    await rpc("publish",["test",JSON.stringify({releaseId:"test"})]);
    const token=randomUUID(),claimed=await rpc("claim",[token,false]);
    const manifest=createManufacturingManifest({request:{...request(3),orderId:id,orderNumber:"ORDER-TEST"},catalog,artworkRelease:"test",inventoryPlan:claimed.inventory_plan});
    let state=createManufacturingState(manifest);
    await rpc("save_manifest",[id,token,JSON.stringify(manifest),state]);
    const started={id:randomUUID(),type:"submission_started",side:"ticket",role:"agent",actor:"local-print-agent",expectedRevision:0};
    state=applyManufacturingEvent(state,manifest,started);
    await rpc("commit",[id,token,0,state,started,"active"]);
    await db.query(
      "insert into store_refunds(order_id,status) values($1,'requires_action')",
      [id],
    );
    assert.equal((await stock()).reserved, 0);
    assert.equal((await stock()).on_hand, 7);
    const ack={...started,id:randomUUID(),type:"submission_succeeded",expectedRevision:1};
    state=applyManufacturingEvent(state,manifest,ack);
    await rpc("commit",[id,token,1,state,ack,"queued"]);
    assert.equal((await row(id)).phase,"blocked","Late printer acknowledgements cannot undo a refund hold");
    assert.match((await row(id)).issue,/Refund/);
    await db.query(
      "update store_refunds set status='succeeded' where order_id=$1",
      [id],
    );
    assert.equal((await stock()).reserved, 0);
  } finally {
    await db.close();
  }
});
