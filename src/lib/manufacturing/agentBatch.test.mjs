import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PNG } from "pngjs";
import { createManufacturingManifest, preflightPrintAssets } from "./printPlan.mjs";
import { createManufacturingState, applyManufacturingEvent } from "./workflow.mjs";
import { manufacturingService, normalizedEvent, productionPhase, sha256 } from "./integration.mjs";
import { runJob } from "../../../scripts/manufacturing/agent.mjs";

// Full-size synthetic asset, never rendered or sent to a printer. All sheets
// share its hash so these tests exercise real verified caching with one download.
const bytes = PNG.sync.write(new PNG({ width: 2550, height: 3300 }));
const positions = [75, 1125, 2175].flatMap((y) => [150, 900, 1650].map((x) => ({
  x, y, width: 720, height: 1008,
})));
async function temporary(action) {
  const prefix = path.join(os.tmpdir(), "searealm-agent-batch-");
  const root = await mkdtemp(prefix);
  try { await action(root); }
  finally {
    assert.ok(path.resolve(root).startsWith(prefix));
    await rm(root, { recursive: true, force: true });
  }
}

function fixture(root, { quantity = 3, productId = "starter-kit" } = {}) {
  const manifest = createManufacturingManifest({
    request: { orderId: randomUUID(), orderNumber: "BATCH-TEST", items: [{ productId, quantity }] },
    catalog: [], artworkRelease: "batch-test",
  });
  const release = { releaseId: "batch-test", assets: {} };
  for (const id of preflightPrintAssets(manifest, release).requiredAssetIds)
    release.assets[id] = { path: "private/test.png", sha256: sha256(bytes), width: 2550, height: 3300, positions };
  assert.equal(preflightPrintAssets(manifest, release).ready, true);
  const token = randomUUID();
  let row = {
    order_id: manifest.order.orderId, manifest_text: JSON.stringify(manifest),
    manifest, state: createManufacturingState(manifest), revision: 0, release,
    lease_token: token, leased_until: new Date(Date.now() + 120000).toISOString(),
  };
  const targets = [
    { sheetId: "work-ticket", side: "ticket" },
    ...manifest.sheets.flatMap((sheet) => ["fronts", "backs"].map((side) => ({ sheetId: sheet.sheetId, side }))),
  ];
  const jobs = targets.map((target) => ({ ...target, file: path.join(root, "mock.pdf") }));
  const printed = [], blocked = [];
  let settled = 0, onPrint = async () => {};
  const status = (target) => target.side === "ticket" ? row.state.ticket.ticket : row.state.sheets[target.sheetId][target.side];
  const apply = (type, target, role = "operator") => {
    row.state = applyManufacturingEvent(row.state, manifest, normalizedEvent({
      id: randomUUID(), type, expectedRevision: row.revision, ...target,
    }, role));
    row.revision = row.state.revision;
  };
  const service = manufacturingService({
    from() {
      const query = { select() { return query; }, eq() { return query; }, async single() { return { data: structuredClone(row) }; } };
      return query;
    },
    async rpc(name, args) {
      assert.equal(name, "manufacturing_commit");
      if (args.p_expected !== row.revision) return { error: { code: "P0001", message: "Revision conflict" } };
      assert.equal(args.p_token, token);
      row = { ...row, state: args.p_state, revision: args.p_state.revision, phase: args.p_phase };
      return { data: structuredClone(row) };
    },
  });
  const client = {
    async post(payload) {
      if (payload.action === "event") return service.event(row.order_id, payload.event, "agent", token);
      if (payload.action === "heartbeat") return { renewed: true };
      if (payload.action === "block") { blocked.push(payload.issue); return { blocked: true }; }
      assert.equal(payload.action, "settle");
      settled++;
      const phase = productionPhase(row.state);
      assert.equal(phase, "awaiting_operator");
      return { phase };
    },
    async download() { return bytes; },
  };
  return {
    manifest, targets, printed, blocked, status, apply, settled: () => settled, state: () => row.state,
    onPrint: (callback) => { onPrint = callback; },
    run: () => runJob({
      job: structuredClone(row), root, client, config: {}, siteOrigin: "https://searealm.com",
      render: async () => jobs, prepare: async () => {},
      print: async (_config, target) => {
        assert.equal(status(target), "submitting", "reserve each page before touching the printer");
        printed.push({ sheetId: target.sheetId, side: target.side });
        await onPrint(target);
      },
    }),
  };
}

test("one three-kit request submits all 97 pages without any manual paper confirmations", async () => temporary(async (root) => {
  const f = fixture(root);
  assert.equal(f.manifest.sheets.length, 48);
  assert.equal(f.targets.length, 97);
  await f.run();
  assert.deepEqual(f.printed, f.targets);
  assert.ok(f.targets.every((target) => f.status(target) === "submitted"));
  assert.equal(f.state().events.some((event) => event.type === "confirm_printed"), false);
  assert.equal(f.settled(), 1);
  assert.deepEqual(f.blocked, []);
}));

test("an operator confirming an earlier page during the next print does not interrupt the batch", async () => temporary(async (root) => {
  const f = fixture(root, { productId: "coral-garden", quantity: 1 });
  f.onPrint(async () => {
    if (f.printed.length === 2) f.apply("confirm_printed", f.targets[0]);
  });
  await f.run();
  assert.deepEqual(f.printed, f.targets);
  assert.equal(f.status(f.targets[0]), "confirmed");
  assert.ok(f.targets.slice(1).every((target) => f.status(target) === "submitted"));
  assert.equal(f.settled(), 1);
  assert.deepEqual(f.blocked, []);
}));

test("existing submitted pages are skipped on resume and do not block a later order", async () => temporary(async (root) => {
  const f = fixture(root, { productId: "coral-garden", quantity: 1 });
  for (const target of f.targets.slice(0, 2)) {
    f.apply("submission_started", target, "agent");
    f.apply("submission_succeeded", target, "agent");
  }
  f.apply("confirm_printed", f.targets[0]);
  await f.run();
  assert.deepEqual(f.printed, f.targets.slice(2));
  await f.run();
  assert.deepEqual(f.printed, f.targets.slice(2), "resuming a finished submission must never reprint it");
  assert.equal(f.settled(), 2);
  const later = fixture(root, { productId: "coral-garden", quantity: 1 });
  await later.run();
  assert.deepEqual(later.printed, later.targets);
  assert.deepEqual(later.blocked, []);
}));

test("a real print error still stops later pages and blocks automatic recovery of the uncertain page", async () => temporary(async (root) => {
  const f = fixture(root, { productId: "coral-garden", quantity: 1 });
  f.onPrint(async () => { if (f.printed.length === 2) throw new Error("Printer reports an error"); });
  await assert.rejects(f.run(), /Printer reports an error/);
  assert.equal(f.printed.length, 2);
  assert.equal(f.status(f.targets[0]), "submitted");
  assert.equal(f.status(f.targets[1]), "needs_review");
  assert.ok(f.targets.slice(2).every((target) => f.status(target) === "queued"));
  await assert.rejects(f.run(), /operator review/);
  assert.equal(f.printed.length, 2, "uncertain attempts must not be retried automatically");
  assert.equal(f.settled(), 0);
  assert.equal(f.blocked.length, 2);
}));