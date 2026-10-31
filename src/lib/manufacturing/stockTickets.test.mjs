import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createManufacturingManifest } from "./printPlan.mjs";
import { createManufacturingState, applyManufacturingEvent } from "./workflow.mjs";
import { normalizedEvent, productionPhase } from "./integration.mjs";
import { renderJob } from "../../../scripts/manufacturing/render.mjs";

const manifestFor = (jobKind = "stock") => createManufacturingManifest({
  jobKind, request: { orderId: randomUUID(), orderNumber: "TICKET-POLICY", items: [{ productId: "dice-pack", quantity: 1 }] },
  catalog: [], artworkRelease: "ticket-test",
});
const eventFor = (state, type, role = "agent", extra = {}) => normalizedEvent({
  id: randomUUID(), type, expectedRevision: state.revision, sheetId: "work-ticket", side: "ticket", ...extra,
}, role);

test("new stock builds have no paper ticket requirement and cannot submit or reprint one", () => {
  const manifest = manifestFor(), state = createManufacturingState(manifest);
  assert.equal(state.ticket.ticket, "not_required");
  assert.equal(productionPhase(state), "awaiting_operator");
  for (const [type, role] of [["submission_started", "agent"], ["reprint", "operator"]])
    assert.throws(() => applyManufacturingEvent(state, manifest, eventFor(state, type, role, { reason: "old ticket" })), /do not print work tickets/);
  const customer = manifestFor("order"), customerState = createManufacturingState(customer);
  assert.equal(customerState.ticket.ticket, "queued");
  assert.equal(applyManufacturingEvent(customerState, customer, eventFor(customerState, "submission_started")).ticket.ticket, "submitting");
});

test("retiring a legacy stock ticket records its prior outcome and is idempotent without rewriting card contents", () => {
  const manifest = manifestFor(), originalManifest = JSON.stringify(manifest);
  for (const previous of ["queued", "submitting", "needs_review"]) {
    const state = createManufacturingState(manifest); state.ticket.ticket = previous;
    const event = eventFor(state, "stock_ticket_skipped");
    const next = applyManufacturingEvent(state, manifest, event);
    assert.equal(next.ticket.ticket, "not_required");
    assert.equal(next.events[0].previousTicketStatus, previous);
    assert.equal(next.events[0].type, "stock_ticket_skipped");
    assert.equal(next.events.some((e) => e.type === "submission_succeeded" || e.type === "confirm_printed"), false);
    assert.deepEqual(next.sheets, state.sheets);
    assert.equal(next.manifestHash, state.manifestHash);
    assert.equal(JSON.stringify(manifest), originalManifest);
    assert.equal(applyManufacturingEvent(next, manifest, event), next);
  }
});

test("ticket retirement cannot bypass customer printing, card review, holds or operator permissions", () => {
  for (const jobKind of ["stock", "order"]) {
    const manifest = manifestFor(jobKind), state = createManufacturingState(manifest);
    state.ticket.ticket = "queued";
    if (jobKind === "order") assert.throws(() => applyManufacturingEvent(state, manifest, eventFor(state, "stock_ticket_skipped")), /pending stock-build ticket/);
    assert.throws(() => applyManufacturingEvent(state, manifest, eventFor(state, "stock_ticket_skipped", "operator")), /pending stock-build ticket/);
    assert.throws(() => applyManufacturingEvent(state, manifest, eventFor(state, "stock_ticket_skipped", "agent", { side: "fronts" })), /pending stock-build ticket/);
    assert.throws(() => applyManufacturingEvent({ ...state, hold: true }, manifest, eventFor(state, "stock_ticket_skipped")), /on hold/);
  }
});

test("stock rendering omits tickets even with a cached old PDF while customer orders retain theirs", async () => {
  const prefix = path.join(os.tmpdir(), "searealm-stock-ticket-"), directory = await mkdtemp(prefix);
  try {
    const args = { release: { releaseId: "ticket-test", assets: {} }, assetFiles: {}, outputDir: directory, siteOrigin: "https://searealm.com" };
    assert.deepEqual(await renderJob({ ...args, manifest: manifestFor() }), []);
    assert.deepEqual(await readdir(directory), []);
    const customerJobs = await renderJob({ ...args, manifest: manifestFor("order") });
    assert.deepEqual(customerJobs.map((j) => j.side), ["ticket"]);
    const file = customerJobs[0].file, saved = await readFile(file);
    assert.deepEqual(await renderJob({ ...args, manifest: manifestFor() }), []);
    assert.deepEqual(await readFile(file), saved, "historical ticket evidence must not be deleted or overwritten");
  } finally {
    assert.ok(path.resolve(directory).startsWith(prefix));
    await rm(directory, { recursive: true, force: true });
  }
});
