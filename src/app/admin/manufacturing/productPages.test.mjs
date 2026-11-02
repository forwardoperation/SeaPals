import test from "node:test";
import assert from "node:assert/strict";
import { pageReprintBlockedReason, pageReprintButtonLabel, pageReprintSelectionError, pageReprintWasRejected, productPageCount, readPageReprintRetry, selectedPageTargets } from "./productPages.mjs";

const job = { orderId: "00000000-0000-4000-8000-000000000001", printRequestedAt: "2026-11-01T12:00:00Z", phase: "awaiting_operator", pages: [
  { sheetId: "one", unit: 1, frontsStatus: "submitted", backsStatus: "confirmed" },
  { sheetId: "two", unit: 1, frontsStatus: "submitted", backsStatus: "confirmed" },
  { sheetId: "three", unit: 2, frontsStatus: "needs_review", backsStatus: "confirmed" },
] };

test("only products with multiple fixed sheets expand, including kit contents", () => {
  assert.equal(productPageCount("coral-garden"), 7);
  assert.equal(productPageCount("blue-water"), 7);
  assert.equal(productPageCount("starter-kit"), 16);
  assert.equal(productPageCount("conditions-deck"), 2);
  assert.equal(productPageCount("reef-dive-pack"), 0);
  assert.equal(productPageCount("dice-pack"), 0);
});

test("page selection retains saved sheet identities and order across repeated product copies", () => {
  assert.deepEqual(selectedPageTargets(job.pages, ["three", "one"], "backs"), [{ sheetId: "one", side: "backs" }, { sheetId: "three", side: "backs" }]);
  assert.deepEqual(selectedPageTargets(job.pages, ["one", "one"], "both"), [{ sheetId: "one", side: "fronts" }, { sheetId: "one", side: "backs" }]);
  assert.deepEqual(selectedPageTargets(job.pages, [], "fronts"), []);
  assert.throws(() => selectedPageTargets(job.pages, ["missing"], "fronts"), /changed/);
  assert.throws(() => selectedPageTargets(job.pages, ["one"], "ticket"), /Choose/);
});

test("reprint label counts each physical side once", () => {
  assert.equal(pageReprintButtonLabel([]), "Select pages to reprint");
  assert.equal(pageReprintButtonLabel(selectedPageTargets(job.pages, ["one"], "fronts")), "Reprint 1 front");
  assert.equal(pageReprintButtonLabel(selectedPageTargets(job.pages, ["one", "three"], "backs")), "Reprint 2 backs");
  assert.equal(pageReprintButtonLabel(selectedPageTargets(job.pages, ["one", "three"], "both")), "Reprint 4 pages");
});

test("the request limit counts front and back separately and matches saved retry validation", () => {
  const pages = Array.from({ length: 1001 }, (_, index) => ({ sheetId: `sheet_${index}` }));
  const ids = pages.map((page) => page.sheetId);
  const bothAtLimit = selectedPageTargets(pages, ids.slice(0, 500), "both");
  assert.equal(bothAtLimit.length, 1000);
  assert.equal(pageReprintSelectionError(bothAtLimit), "");
  assert.equal(pageReprintSelectionError(selectedPageTargets(pages, ids.slice(0, 1000), "fronts")), "");
  assert.match(pageReprintSelectionError(selectedPageTargets(pages, ids.slice(0, 501), "both")), /1,000 print sides/);
  const saved = { id: "00000000-0000-4000-8000-000000000002", orderId: job.orderId, revision: 7, productId: "coral-garden", targets: bothAtLimit, reason: "Missing pages" };
  const read = (targets) => readPageReprintRetry(JSON.stringify({ ...saved, targets }), saved.productId);
  assert.deepEqual(read(bothAtLimit), saved);
  assert.equal(read(selectedPageTargets(pages, ids, "fronts")), null);
  assert.ok(read([{ sheetId: "a".repeat(200), side: "backs" }]));
  for (const sheetId of ["a".repeat(201), "bad/id", "has spaces", "", "snowman-☃"]) {
    assert.equal(read([{ sheetId, side: "fronts" }]), null);
  }
  assert.equal(read([null]), null);
});

test("active attempts, queued work, receipts and job-wide server guards block new requests", () => {
  const now = Date.parse("2026-11-02T13:00:00Z");
  assert.equal(pageReprintBlockedReason(job, now), "");
  for (const patch of [{ hold: true }, { phase: "blocked" }, { received: true }, { printRequestedAt: null }, { leasedUntil: "2026-11-02T14:00:00Z" }]) assert.ok(pageReprintBlockedReason({ ...job, ...patch }, now));
  for (const status of ["queued", "submitting"]) assert.ok(pageReprintBlockedReason({ ...job, pages: [{ ...job.pages[0], frontsStatus: status }] }, now));
  assert.equal(pageReprintBlockedReason({ ...job, reprintBlockedReason: "Another product in this job is printing." }, now), "Another product in this job is printing.");
});

test("ambiguous reprint retries preserve the original revision, reason, UUID and exact sides", () => {
  const saved = { id: "00000000-0000-4000-8000-000000000002", orderId: job.orderId, revision: 7, productId: "coral-garden", targets: selectedPageTargets(job.pages, ["one", "three"], "both"), reason: "Blank fronts" };
  assert.deepEqual(readPageReprintRetry(JSON.stringify(saved), "coral-garden"), saved);
  assert.equal(readPageReprintRetry(JSON.stringify(saved), "blue-water"), null);
  for (const patch of [{ id: "bad" }, { revision: -1 }, { targets: [] }, { targets: [{ sheetId: "one", side: "ticket" }] }, { reason: " " }, { targets: [saved.targets[0], saved.targets[0]] }]) assert.equal(readPageReprintRetry(JSON.stringify({ ...saved, ...patch }), "coral-garden"), null);
  for (const status of [undefined, 408, 429, 500, 503]) assert.equal(pageReprintWasRejected({ status }, true), false);
  assert.equal(pageReprintWasRejected({ status: 401 }, false), false);
  assert.equal(pageReprintWasRejected({ status: 409 }, false), true);
  assert.equal(pageReprintWasRejected({ status: 401 }, true), true);
});
