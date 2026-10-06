import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { buildPrintingCatalog } from "./boosters.mjs";
import { createManufacturingManifest } from "./printPlan.mjs";
import {
  applyManufacturingEvent,
  createManufacturingState,
  workflowReadiness,
} from "./workflow.mjs";
import {
  authenticated,
  normalizedEvent,
  productionPhase,
  requireOrderArtwork,
  manufacturingService,
  sha256,
} from "./integration.mjs";
import {
  buyerMessage,
  drainManufacturingNotifications,
} from "./notifications.mjs";
import { supabaseArtworkStore } from "./storage.mjs";
import {
  runJob,
  printerArguments,
} from "../../../scripts/manufacturing/agent.mjs";
import {
  renderJob,
  staffUrl,
  backPositionForGlue,
} from "../../../scripts/manufacturing/render.mjs";
import {
  buildSourceMap,
  sheetPositions,
} from "../../../scripts/manufacturing/sync-figma.mjs";

const read = async (name) =>
  JSON.parse(
    await readFile(new URL(`../../data/${name}`, import.meta.url), "utf8"),
  );
const setList = await read("gallery-set-list.json"),
  gallery = await read("gallery-images.json"),
  catalog = buildPrintingCatalog(setList, gallery);
const makeManifest = (
  items = [{ productId: "deep-dive-pack", quantity: 1 }],
  id = randomUUID(),
) =>
  createManufacturingManifest({
    request: { orderId: id, orderNumber: "SR-TEST-100", items },
    catalog,
    artworkRelease: "test-v1",
    randomIndex: () => 0,
  });
async function temp(action) {
  const dir = await mkdtemp(
    path.join(os.tmpdir(), "searealm-manufacturing-integration-"),
  );
  try {
    return await action(dir);
  } finally {
    assert.ok(
      path
        .resolve(dir)
        .startsWith(
          path.join(os.tmpdir(), "searealm-manufacturing-integration-"),
        ),
    );
    await rm(dir, { recursive: true, force: true });
  }
}

test("all live products produce full recipes, including accessories and separate sheet pairs", () => {
  const manifest = makeManifest([
    { productId: "starter-kit", quantity: 1 },
    { productId: "reef-dive-pack", quantity: 2 },
  ]);
  assert.equal(manifest.sheets.length, 18);
  assert.equal(manifest.packs.length, 2);
  assert.deepEqual(
    manifest.accessoryChecklist.map((i) => i.quantity),
    [7, 15],
  );
  const accessories = makeManifest([{ productId: "dice-pack", quantity: 2 }]);
  let state = createManufacturingState(accessories);
  assert.equal(workflowReadiness(state).canQualityCheck, false);
  state = applyManufacturingEvent(
    state,
    accessories,
    normalizedEvent(
      {
        id: randomUUID(),
        type: "accessory_picked",
        accessoryId: "dice-pack-dice",
        expectedRevision: 0,
      },
      "operator",
    ),
  );
  assert.equal(workflowReadiness(state).canQualityCheck, true);
});
test("an incomplete set is held before saving a draw, including when the missing card would not be selected", async () => {
  const orderId = randomUUID(),
    token = randomUUID();
  const assets = Object.fromEntries(
    catalog
      .filter((c) => c.set === "deep" && c.printingId !== "deep-062")
      .map((c) => [
        c.printingId,
        {
          sha256: "a".repeat(64),
          path: `manufacturing/sha256/${"a".repeat(64)}.png`,
          width: 750,
          height: 1050,
        },
      ]),
  );
  assets["standard-back-sheet"] = {
    sha256: "b".repeat(64),
    path: `manufacturing/sha256/${"b".repeat(64)}.png`,
    width: 2550,
    height: 3300,
  };
  const release = {
      releaseId: "test-v1",
      figmaVersion: "test",
      catalog,
      assets,
    },
    calls = [];
  const db = {
    from(table) {
      return {
        select() {
          return {
            eq() {
              return {
                async single() {
                  return {
                    data:
                      table === "store_orders"
                        ? {
                            id: orderId,
                            order_number: "SR-TEST-100",
                            store_order_items: [
                              { product_id: "deep-dive-pack", quantity: 1 },
                            ],
                          }
                        : { manifest_text: JSON.stringify(release) },
                  };
                },
              };
            },
          };
        },
      };
    },
    async rpc(name) {
      calls.push(name);
      return {
        data:
          name === "manufacturing_claim"
            ? {
                order_id: orderId,
                release_id: "test-v1",
                lease_token: token,
                manifest_text: null,
              }
            : true,
      };
    },
  };
  const result = await manufacturingService(db).claim(token);
  assert.equal(result.blocked, true);
  assert.match(result.issue, /No booster draw was created/);
  assert.deepEqual(calls, ["manufacturing_claim", "manufacturing_block"]);
  assets["deep-062"] = { ...assets["deep-061"] };
  assert.doesNotThrow(() =>
    requireOrderArtwork(
      [{ productId: "deep-dive-pack", quantity: 1 }],
      release,
    ),
  );
});
test("reprinting only the work ticket after packing preserves card completion and still queues the ticket", () => {
  const manifest = makeManifest([{ productId: "dice-pack", quantity: 1 }]);
  let state = createManufacturingState(manifest);
  const apply = (type, role = "operator", fields = {}) => {
    state = applyManufacturingEvent(
      state,
      manifest,
      normalizedEvent(
        { id: randomUUID(), type, expectedRevision: state.revision, ...fields },
        role,
      ),
    );
  };
  const target = { sheetId: "work-ticket", side: "ticket" };
  apply("submission_started", "agent", target);
  apply("submission_succeeded", "agent", target);
  apply("accessory_picked", "operator", { accessoryId: "dice-pack-dice" });
  apply("quality_checked");
  apply("packed");
  assert.equal(productionPhase(state), "complete");
  apply("reprint", "operator", { ...target, reason: "Ticket damaged" });
  assert.equal(state.packed, true);
  assert.equal(state.qualityChecked, true);
  assert.equal(productionPhase(state), "queued");
  apply("submission_started", "agent", target);
  apply("submission_uncertain", "agent", target);
  assert.equal(productionPhase(state), "awaiting_operator");
});
test("agent cannot promote itself to staff; QR URLs never contain credentials", () => {
  const event = normalizedEvent(
    {
      id: randomUUID(),
      type: "quality_checked",
      role: "operator",
      actor: "owner",
      expectedRevision: 0,
    },
    "agent",
  );
  assert.equal(event.role, "agent");
  const manifest = makeManifest();
  assert.throws(
    () =>
      applyManufacturingEvent(
        createManufacturingState(manifest),
        manifest,
        event,
      ),
    /Only an operator/,
  );
  const secret = "a".repeat(32),
    env = {
      MANUFACTURING_AGENT_TOKEN: secret,
      STORE_ADMIN_TOKEN: "b".repeat(32),
    };
  assert.equal(
    authenticated(
      new Request("https://searealm.com", {
        headers: { Authorization: `Bearer ${secret}` },
      }),
      env,
      "operator",
    ),
    false,
  );
  assert.equal(
    authenticated(
      new Request("https://searealm.com", {
        headers: { Authorization: `Bearer ${secret}` },
      }),
      env,
      "agent",
    ),
    true,
  );
  const url = staffUrl("https://searealm.com", randomUUID());
  assert.equal(new URL(url).pathname, "/admin/manufacturing");
  assert.deepEqual([...new URL(url).searchParams.keys()], ["order"]);
});
test("work ticket QR decodes to the exact staff order URL", async () => {
  const url = staffUrl("https://searealm.com", randomUUID()),
    png = PNG.sync.read(
      await QRCode.toBuffer(url, {
        width: 600,
        margin: 4,
        errorCorrectionLevel: "M",
      }),
    );
  assert.equal(
    jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data,
    url,
  );
});
test("a crash after printer acceptance cannot print that sheet again automatically", async () =>
  temp(async (root) => {
    const manifest = makeManifest(),
      initial = createManufacturingState(manifest);
    let state = initial,
      printed = 0,
      failAcknowledgement = true;
    const job = {
      order_id: manifest.order.orderId,
      lease_token: randomUUID(),
      manifest,
      state,
      order: {},
      release: { releaseId: "test-v1", assets: {} },
    };
    const client = {
      async post(p) {
        if (p.action === "heartbeat") return { renewed: true };
        if (p.action === "block") return { blocked: true };
        if (p.event?.type === "submission_succeeded" && failAcknowledgement)
          throw new Error("connection lost after printer accepted");
        state = applyManufacturingEvent(
          state,
          manifest,
          normalizedEvent(p.event, "agent"),
        );
        return { state };
      },
    };
    // Use an accessory-only fixture to isolate reservation/recovery from downloads.
    job.manifest = makeManifest(
      [{ productId: "dice-pack", quantity: 1 }],
      manifest.order.orderId,
    );
    job.state = state = createManufacturingState(job.manifest);
    const localClient = {
      ...client,
      async post(p) {
        if (p.action !== "event") return client.post(p);
        if (p.event.type === "submission_succeeded" && failAcknowledgement)
          throw new Error("connection lost after printer accepted");
        state = applyManufacturingEvent(
          state,
          job.manifest,
          normalizedEvent(p.event, "agent"),
        );
        return { state };
      },
    };
    const options = {
      job,
      root,
      client: localClient,
      config: {},
      siteOrigin: "https://searealm.com",
      print: async () => {
        printed++;
      },
      render: async () => [
        { sheetId: "work-ticket", side: "ticket", file: "unused" },
      ],
    };
    await assert.rejects(runJob(options), /connection lost/);
    assert.equal(printed, 1);
    assert.equal(state.ticket.ticket, "submitting");
    failAcknowledgement = false;
    job.state = state;
    await assert.rejects(runJob(options), /operator review/);
    assert.equal(printed, 1);
    assert.equal(state.ticket.ticket, "needs_review");
  }));
test("holding an in-flight job retains its lease until the outcome is recorded", () => {
  const manifest = makeManifest();
  let s = createManufacturingState(manifest);
  s = applyManufacturingEvent(
    s,
    manifest,
    normalizedEvent(
      {
        id: randomUUID(),
        type: "submission_started",
        expectedRevision: 0,
        sheetId: "work-ticket",
        side: "ticket",
      },
      "agent",
    ),
  );
  s = applyManufacturingEvent(
    s,
    manifest,
    normalizedEvent(
      { id: randomUUID(), type: "hold", expectedRevision: 1 },
      "operator",
    ),
  );
  assert.equal(productionPhase(s, true), "active");
  s = applyManufacturingEvent(
    s,
    manifest,
    normalizedEvent(
      {
        id: randomUUID(),
        type: "submission_succeeded",
        expectedRevision: 2,
        sheetId: "work-ticket",
        side: "ticket",
      },
      "agent",
    ),
  );
  assert.equal(productionPhase(s, true), "blocked");
});
test("a resumed job with no queued pages releases its claim without printing again", async () =>
  temp(async (root) => {
    const manifest = makeManifest([{ productId: "dice-pack", quantity: 1 }]);
    let state = createManufacturingState(manifest);
    for (const type of ["submission_started", "submission_succeeded"])
      state = applyManufacturingEvent(
        state,
        manifest,
        normalizedEvent(
          {
            id: randomUUID(),
            type,
            expectedRevision: state.revision,
            sheetId: "work-ticket",
            side: "ticket",
          },
          "agent",
        ),
      );
    let settled = 0;
    const client = {
      async post(p) {
        assert.equal(p.action, "settle");
        settled++;
        return { phase: "awaiting_operator" };
      },
    };
    const job = {
      order_id: manifest.order.orderId,
      lease_token: randomUUID(),
      manifest,
      state,
      release: { releaseId: "test-v1", assets: {} },
    };
    await runJob({
      job,
      client,
      root,
      config: {},
      siteOrigin: "https://searealm.com",
      render: async () => [
        { sheetId: "work-ticket", side: "ticket", file: "unused" },
      ],
      print: async () =>
        assert.fail("A submitted ticket must not be printed twice"),
    });
    assert.equal(settled, 1);
  }));
test("artwork adapter rejects a public bucket and does not hide credential errors by creating another", async () => {
  await assert.rejects(
    supabaseArtworkStore({
      storage: { getBucket: async () => ({ data: { public: true } }) },
    }),
    /private bucket/,
  );
  await assert.rejects(
    supabaseArtworkStore({
      storage: {
        getBucket: async () => ({
          error: { statusCode: 401, message: "Unauthorized" },
        }),
      },
    }),
    /unavailable/,
  );
});
test("renderer makes exact Letter pages, enforces checksums, and uses argument-safe printer calls", async () =>
  temp(async (dir) => {
    const manifest = makeManifest(),
      assets = {},
      assetFiles = {};
    const ids = [
      ...manifest.packs[0].cards.map((c) => c.printingId),
      "standard-back-sheet",
    ];
    for (const id of ids) {
      const png = new PNG({
        width: id === "standard-back-sheet" ? 2550 : 750,
        height: id === "standard-back-sheet" ? 3300 : 1050,
      });
      for (let i = 0; i < png.data.length; i += 4) {
        png.data[i] = 50;
        png.data[i + 1] = 140;
        png.data[i + 2] = 180;
        png.data[i + 3] = 255;
      }
      const bytes = PNG.sync.write(png);
      assetFiles[id] = path.join(dir, `${id}.png`);
      await writeFile(assetFiles[id], bytes);
      assets[id] = {
        path: `private/${id}`,
        sha256: sha256(bytes),
        width: png.width,
        height: png.height,
      };
    }
    const jobs = await renderJob({
      manifest,
      release: { releaseId: "test-v1", assets },
      order: {},
      assetFiles,
      outputDir: dir,
      siteOrigin: "https://searealm.com",
    });
    assert.equal(jobs.length, 3);
    for (const job of jobs) {
      const pdf = await PDFDocument.load(await readFile(job.file));
      for (const page of pdf.getPages())
        assert.deepEqual(page.getSize(), { width: 612, height: 792 });
    }
    const args = printerArguments(
      {
        fronts: {
          printerName: "Printer & other",
          printSettings: "noscale,simplex,color,paper=letter",
        },
      },
      jobs[1],
    );
    assert.equal(args[1], "Printer & other");
    assert.equal(args.at(-1), jobs[1].file);
    await writeFile(assetFiles[ids[0]], "tampered");
    await assert.rejects(
      renderJob({
        manifest,
        release: { releaseId: "test-v1", assets },
        order: {},
        assetFiles,
        outputDir: dir,
        siteOrigin: "https://searealm.com",
      }),
      /checksum/,
    );
  }));
test("back placement aligns asymmetric Conditions gaps after gluing with printed faces outward", () => {
  for (const x of [195, 918.333, 1641.667]) {
    const front = { x, y: 138, width: 720, height: 1008 },
      back = backPositionForGlue(front);
    assert.ok(Math.abs(2550 - back.x - back.width - front.x) < 0.001);
    assert.equal(back.y, front.y);
    assert.equal(back.width, front.width);
    assert.equal(back.height, front.height);
  }
  assert.equal(
    backPositionForGlue({ x: 1641.667, width: 720 }).x,
    188.33300000000008,
  );
});
test("Figma source mappings include prerelease, distinct holo art, and explicit missing nodes", async () => {
  const holo = JSON.parse(
    await readFile(
      new URL(
        "../../../scripts/manufacturing/figma-holo-sources.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const source = buildSourceMap(setList, gallery, holo);
  assert.equal(source.catalog.length, 228);
  assert.ok(source.catalog.some((c) => c.prerelease));
  assert.equal(
    source.sources.filter((s) => s.id === "standard-back-sheet").length,
    1,
  );
  assert.ok(
    source.sources
      .filter(
        (s) =>
          source.catalog.find((c) => c.printingId === s.id)
            ?.requiresHoloSticker,
      )
      .every((s) => s.nodeId),
  );
  assert.equal(source.missing.length, 11);
  const positions = sheetPositions({
    absoluteBoundingBox: { x: 100, y: 200 },
    children: [
      {
        name: "card_backs",
        children: Array.from({ length: 9 }, (_, i) => ({
          absoluteBoundingBox: {
            x: 295 + (i % 3) * 723.333,
            y: 338 + Math.floor(i / 3) * 1011.333,
            width: 720,
            height: 1008,
          },
        })),
      },
    ],
  });
  assert.equal(positions[1].x, 918.333);
  assert.notEqual(positions[1].x, 915);
});

test("real PostgreSQL migration: paid trigger, single claim, immutable draw, CAS, refund stop, permissions, notification expiry", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create table store_orders(id uuid primary key,order_number text,payment_status text default 'pending',payment_livemode boolean default true,amount_refunded_cents integer default 0,dispute_status text,fulfillment_status text default 'unfulfilled',updated_at timestamptz default now());
      create table store_refunds(id uuid primary key default gen_random_uuid(),order_id uuid,status text);`);
    await db.exec(`create schema storage;create table storage.objects(bucket_id text);alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;
      create policy broad_existing_policy on storage.objects for select to authenticated using(true);
      insert into storage.objects values('searealm-manufacturing-private'),('other-bucket');`);
    await db.exec(
      await readFile(
        new URL("../../../supabase/manufacturing.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL("../../../supabase/manufacturing.sql", import.meta.url),
        "utf8",
      ),
    );
    const query = (sql, values = []) => db.query(sql, values),
      orderId = randomUUID(),
      token = randomUUID();
    await query("select manufacturing_publish($1,$2)", [
      "test-v1",
      JSON.stringify({ releaseId: "test-v1" }),
    ]);
    await query(
      "insert into store_orders(id,order_number) values($1,'SR-TEST-100')",
      [orderId],
    );
    assert.equal(
      (await query("select * from manufacturing_orders")).rows.length,
      0,
    );
    await query("update store_orders set payment_status='paid' where id=$1", [
      orderId,
    ]);
    await query("update store_orders set payment_status='paid' where id=$1", [
      orderId,
    ]);
    assert.equal(
      (await query("select * from manufacturing_orders")).rows.length,
      1,
    );
    assert.ok(
      (await query("select manufacturing_claim($1) as job", [token])).rows[0]
        .job,
    );
    assert.equal(
      (await query("select manufacturing_claim($1) as job", [randomUUID()]))
        .rows[0].job,
      null,
    );
    const manifest = makeManifest(undefined, orderId);
    let state = createManufacturingState(manifest);
    await query("select manufacturing_save_manifest($1,$2,$3,$4)", [
      orderId,
      token,
      JSON.stringify(manifest),
      JSON.stringify(state),
    ]);
    const second = makeManifest(undefined, orderId);
    const saved = (
      await query("select manufacturing_save_manifest($1,$2,$3,$4) as job", [
        orderId,
        token,
        JSON.stringify(second),
        JSON.stringify(createManufacturingState(second)),
      ])
    ).rows[0].job;
    assert.equal(
      JSON.parse(saved.manifest_text).manifestHash,
      manifest.manifestHash,
    );
    const target = { sheetId: manifest.sheets[0].sheetId, side: "fronts" };
    async function commit(type, role = "agent", extra = {}) {
      const event = normalizedEvent(
          {
            id: randomUUID(),
            type,
            expectedRevision: state.revision,
            ...target,
            ...extra,
          },
          role,
        ),
        next = applyManufacturingEvent(state, manifest, event);
      const result = await query(
        "select manufacturing_commit($1,$2,$3,$4,$5,$6) as job",
        [
          orderId,
          token,
          state.revision,
          JSON.stringify(next),
          JSON.stringify(event),
          productionPhase(next, true),
        ],
      );
      state = next;
      return result;
    }
    await commit("submission_started");
    await commit("submission_succeeded");
    await commit("confirm_printed", "operator");
    assert.equal(
      (await query("select milestone from manufacturing_notifications")).rows[0]
        .milestone,
      "in_production",
    );
    assert.equal(
      (await query("select fulfillment_status from store_orders")).rows[0]
        .fulfillment_status,
      "in_production",
    );
    await assert.rejects(
      query("select manufacturing_commit($1,$2,0,$3,$4,'active')", [
        orderId,
        token,
        JSON.stringify(state),
        JSON.stringify({ role: "agent", type: "submission_started" }),
      ]),
      /Revision conflict/,
    );
    await query(
      "insert into store_refunds(order_id,status) values($1,'pending')",
      [orderId],
    );
    await assert.rejects(
      commit("submission_started", "agent", { side: "backs" }),
      /not eligible/,
    );
    await query(
      "update manufacturing_orders set leased_until=now()-interval '1 second'",
    );
    const recovery = (
      await query("select manufacturing_claim($1) as job", [randomUUID()])
    ).rows[0].job;
    assert.ok(recovery, "Active work remains recoverable after a refund");
    await assert.rejects(
      commit("submission_started", "agent", { side: "backs" }),
      /Lease expired/,
    );
    await query(
      "update manufacturing_notifications set first_attempt_at=now()-interval '24 hours'",
    );
    assert.deepEqual(
      (
        await query("select manufacturing_claim_notifications($1) as jobs", [
          randomUUID(),
        ])
      ).rows[0].jobs,
      [],
    );
    assert.equal(
      (await query("select status from manufacturing_notifications")).rows[0]
        .status,
      "review",
    );
    await db.exec("set role authenticated");
    assert.deepEqual(
      (await query("select bucket_id from storage.objects")).rows,
      [{ bucket_id: "other-bucket" }],
    );
    await assert.rejects(
      query("select * from manufacturing_orders"),
      /permission denied/,
    );
    await assert.rejects(
      query("select manufacturing_claim($1)", [randomUUID()]),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
test("buyer delivery is deduplicated with immutable payload, no card spoilers, and 2xx body-loss acceptance", async () => {
  const order = {
    order_number: "SR-100",
    customer_email: "buyer@example.test",
    payment_status: "paid",
    payment_livemode: true,
    amount_refunded_cents: 0,
    fulfillment_status: "in_production",
  };
  const email = buyerMessage(
    order,
    "in_production",
    "Sea Realm <maker@example.test>",
  );
  assert.ok(!JSON.stringify(email).includes("Holo Rare"));
  const calls = [],
    id = randomUUID(),
    orderId = randomUUID();
  const fetchImpl = async (url, init) => {
    calls.push([String(url), init]);
    const u = String(url);
    if (u.includes("claim_notifications"))
      return Response.json([
        { id, order_id: orderId, milestone: "in_production" },
      ]);
    if (u.includes("store_orders?")) return Response.json([order]);
    if (u.includes("manufacturing_orders?"))
      return Response.json([{ state: { hold: false } }]);
    if (u.includes("store_refunds?")) return Response.json([]);
    if (u.includes("notification_payload")) return Response.json(email);
    if (u.includes("api.resend.com"))
      return new Response("unreadable", { status: 202 });
    if (u.includes("finish_notification")) return Response.json(true);
    throw new Error("unexpected request");
  };
  assert.deepEqual(
    await drainManufacturingNotifications({
      environment: {
        MANUFACTURING_BUYER_NOTIFICATIONS_ENABLED: "true",
        RESEND_API_KEY: "test",
        EMAIL_FROM: email.from,
        SUPABASE_SERVICE_ROLE_KEY: "test",
        NEXT_PUBLIC_SUPABASE_URL: "https://db.example.test",
      },
      fetchImpl,
    }),
    { sent: 1, skipped: 0, failed: 0 },
  );
  const sent = calls.find(([url]) => url.includes("api.resend.com"));
  assert.equal(sent[1].headers["Idempotency-Key"], `manufacturing/${id}`);
  assert.equal(JSON.parse(calls.at(-1)[1].body).p_status, "sent");
});
