import test from "node:test";
import assert from "node:assert/strict";
import { reprintReadiness, sheetDisplayLabel } from "./sheetRecovery.mjs";

const now = Date.parse("2026-10-26T20:00:00Z");
const detail = () => ({
  phase: "awaiting_operator", leased_until: null,
  state: { ticket: { ticket: "submitted" }, sheets: {
    first: { fronts: "submitted", backs: "submitted" },
    second: { fronts: "submitted", backs: "submitted" },
  } },
});

test("a live lease blocks a reprint even between individual page submissions", () => {
  const job = detail();
  job.leased_until = new Date(now + 1).toISOString();
  const readiness = reprintReadiness(job, now);
  assert.equal(readiness.active, true);
  assert.equal(readiness.blocked, true);
  assert.equal(readiness.interrupted, false);
  assert.match(readiness.message, /Wait for the current print attempt/);
  // Expiry is a time boundary, not a permanently sticky phase or flag.
  job.phase = "active";
  assert.equal(reprintReadiness(job, now + 1).blocked, false);
});

test("any interrupted side requires reconciliation before a different sheet is reprinted", () => {
  for (const target of ["fronts", "backs", "ticket"]) {
    const job = detail();
    job.leased_until = new Date(now - 1).toISOString();
    if (target === "ticket") job.state.ticket.ticket = "submitting";
    else job.state.sheets.second[target] = "submitting";
    const readiness = reprintReadiness(job, now);
    assert.equal(readiness.active, false);
    assert.equal(readiness.interrupted, true);
    assert.equal(readiness.blocked, true);
    assert.match(readiness.message, /Review interrupted attempt/);
    if (target === "ticket") job.state.ticket.ticket = "needs_review";
    else job.state.sheets.second[target] = "needs_review";
    assert.equal(reprintReadiness(job, now).blocked, false);
  }
});

test("missing, expired, or invalid lease timestamps cannot leave settled pages locked", () => {
  for (const leased_until of [undefined, null, "", "invalid", new Date(now).toISOString()]) {
    const job = { ...detail(), leased_until };
    assert.deepEqual(reprintReadiness(job, now), {
      active: false, interrupted: false, blocked: false, message: "",
    });
  }
  assert.equal(reprintReadiness(null, now).blocked, false);
});

test("Drop Off sheet labels distinguish duplicate deck units without changing identities", () => {
  const sheets = [1, 2].flatMap((unit) => Array.from({ length: 7 }, (_, index) => ({
    sheetId: `STOCK-long-immutable-id-blue-water-${unit}-${index + 1}`,
    productId: "blue-water", unit,
    fronts: { assetId: `sheet-blue-water-${index + 1}` },
  })));
  const manifest = { sheets }, before = structuredClone(manifest);
  assert.equal(sheetDisplayLabel(manifest, sheets[0].sheetId), "Sheet 1 of 14 · sheets-drop-off-1");
  assert.equal(sheetDisplayLabel(manifest, sheets[7].sheetId), "Sheet 8 of 14 · sheets-drop-off-1");
  assert.equal(sheetDisplayLabel(manifest, sheets[13].sheetId), "Sheet 14 of 14 · sheets-drop-off-7");
  assert.deepEqual(manifest, before);
});

test("booster and ticket recovery labels do not depend on private asset names", () => {
  const manifest = { sheets: [{ sheetId: "saved-reef-pack-id", set: "reef" }] };
  assert.equal(sheetDisplayLabel(manifest, "saved-reef-pack-id"), "Sheet 1 of 1");
  assert.equal(sheetDisplayLabel(manifest, "work-ticket"), "Work ticket");
  assert.equal(sheetDisplayLabel(manifest, "unknown-saved-sheet"), "unknown-saved-sheet");
});
