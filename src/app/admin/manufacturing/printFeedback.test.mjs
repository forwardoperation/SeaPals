import test from "node:test";
import assert from "node:assert/strict";
import { createRefreshGuard, formatManufacturingMessage, printFeedback } from "./printFeedback.mjs";

const now = Date.parse("2026-10-14T18:25:00Z");
const submittedJob = {
  phase: "awaiting_operator",
  print_requested_at: "2026-10-14T18:24:15Z",
  leased_until: null,
  manifest: { sheets: [{ sheetId: "reef-1" }] },
  state: {
    ticket: { ticket: "submitted" },
    sheets: { "reef-1": { fronts: "submitted", backs: "submitted" } },
  },
};
const job = () => structuredClone(submittedJob);

test("accepted Windows submissions allow finishing without per-page checks or claiming physical completion", () => {
  const detail = job();
  const savedState = structuredClone(detail.state);
  const result = printFeedback(detail, true, now);
  assert.equal(result.title, "Sent to printers");
  assert.equal(result.sent, 3);
  assert.equal(result.total, 3);
  assert.equal(Object.hasOwn(result, "checked"), false);
  assert.match(result.description, /Windows accepted/);
  assert.match(result.description, /No page-by-page confirmations are needed/);
  assert.match(result.description, /Once the sheets finish printing/);
  assert.deepEqual(detail.state, savedState);
  assert.equal(detail.state.qualityChecked, undefined);
  // Turning printing off afterward must not erase already accepted submissions.
  assert.deepEqual(printFeedback(job(), false, now), result);
});

test("queued, claimed, and expired preparation are distinct without claiming physical printing", () => {
  const detail = { phase: "queued" };
  assert.equal(printFeedback(detail, true, now).title, "Awaiting Send to printers");
  detail.print_requested_at = submittedJob.print_requested_at;
  assert.equal(printFeedback(detail, true, now).title, "Waiting for local print helper");
  detail.leased_until = new Date(now + 60_000).toISOString();
  assert.equal(printFeedback(detail, true, now).title, "Preparing card selection and print pages");
  detail.manifest = {};
  assert.equal(printFeedback(detail, true, now).title, "Preparing pages for the printers");
  detail.leased_until = new Date(now - 1).toISOString();
  assert.equal(printFeedback(detail, true, now).title, "Waiting for local print helper");
  assert.equal(printFeedback(detail, false, now).title, "Waiting for printing to be activated");
});

test("partial submissions count accepted jobs while an interrupted attempt requires review", () => {
  const detail = job();
  detail.state.sheets["reef-1"] = { fronts: "submitting", backs: "queued" };
  detail.leased_until = new Date(now + 60_000).toISOString();
  let result = printFeedback(detail, true, now);
  assert.equal(result.title, "Sending pages to printers");
  assert.equal(result.sent, 1);
  assert.match(result.description, /Remaining pages continue automatically/);
  detail.leased_until = new Date(now - 1).toISOString();
  result = printFeedback(detail, true, now);
  assert.equal(result.title, "Interrupted print attempt — check paper");
  assert.equal(result.attention, true);
  detail.state.sheets["reef-1"].fronts = "needs_review";
  assert.equal(printFeedback(detail, true, now).title, "Print outcome needs review");
  detail.state.sheets["reef-1"].fronts = "queued";
  result = printFeedback(detail, true, now);
  assert.equal(result.title, "Waiting to send remaining pages");
  assert.equal(result.sent, 1);
  assert.equal(result.total, 3);
});

test("holds take precedence and finishing pages does not prematurely complete manufacturing", () => {
  const detail = job();
  detail.state.ticket.ticket = "confirmed";
  detail.state.sheets["reef-1"] = { fronts: "confirmed", backs: "confirmed" };
  assert.equal(printFeedback(detail, true, now).title, "Sent to printers");
  assert.equal(printFeedback(detail, true, now).sent, 3);
  detail.state.hold = true;
  assert.equal(printFeedback(detail, true, now).attention, true);
  detail.state.hold = false;
  detail.phase = "complete";
  assert.equal(printFeedback(detail, true, now).title, "Job complete");
});

test("background refresh does not overlap another read", () => {
  const guard = createRefreshGuard();
  const first = guard.begin({ replace: false });
  assert.equal(guard.begin({ replace: false }), null);
  assert.equal(first.signal.aborted, false);
  first.finish();
  assert.ok(guard.begin({ replace: false }));
});

test("packed stock remains awaiting receipt until actual finished inventory is posted", () => {
  const detail = { ...job(), job_kind: "stock", phase: "complete" };
  detail.state.packed = true;
  assert.equal(printFeedback(detail, true, now).title, "Packaged — awaiting stock receipt");
  detail.inventory_posted_at = "2026-10-24T15:00:00Z";
  assert.equal(printFeedback(detail, true, now).title, "Job complete");
  assert.match(printFeedback(detail, true, now).description, /received into finished inventory/);
});

test("new holo jobs say to pull finished cards and legacy jobs retain sticker instructions", () => {
  const detail = job();
  assert.match(printFeedback(detail, true, now).description, /applying holo stickers/);
  detail.manifest.holoHandling = "pull-finished";
  assert.match(printFeedback(detail, true, now).description, /pulling the listed finished holo cards/);
});

test("replaced selection ignores an older response even when fetch ignores abort", async () => {
  const guard = createRefreshGuard();
  const visible = [];
  let resolveOld;
  const old = guard.begin();
  const pending = new Promise((resolve) => { resolveOld = resolve; }).then((value) => {
    if (old.isCurrent()) visible.push(value);
    old.finish();
  });
  const current = guard.begin();
  assert.equal(old.signal.aborted, true);
  visible.push("new selection");
  resolveOld("old selection");
  await pending;
  assert.deepEqual(visible, ["new selection"]);
  assert.equal(current.isCurrent(), true);
});

test("mutation, token change, or logout invalidation rejects late success and failure", async () => {
  for (const outcome of ["success", "failure"]) {
    const guard = createRefreshGuard();
    const read = guard.begin();
    let resolve;
    const pending = new Promise((done) => { resolve = done; });
    const applied = [];
    const result = pending.then(() => {
      if (read.isCurrent()) applied.push(outcome);
    });
    guard.invalidate();
    resolve();
    await result;
    assert.equal(read.signal.aborted, true);
    assert.deepEqual(applied, []);
    assert.ok(guard.begin({ replace: false }));
  }
});


test("persisted blocked issues use Drop Off sheet names only for complete legacy asset tokens", () => {
  const issue = "Artwork is incomplete: sheet-blue-water-1, sheet-blue-water-7. Keep sheet-blue-water-8, sheet-blue-water-10, prefix-sheet-blue-water-1 and sheet-blue-water-1-extra unchanged.";
  const expected = "Artwork is incomplete: sheets-drop-off-1, sheets-drop-off-7. Keep sheet-blue-water-8, sheet-blue-water-10, prefix-sheet-blue-water-1 and sheet-blue-water-1-extra unchanged.";
  const detail = Object.freeze({ phase: "blocked", issue });
  assert.equal(printFeedback(detail, true, now).description, expected);
  assert.equal(formatManufacturingMessage(issue), expected);
  assert.equal(detail.issue, issue);
  assert.equal(formatManufacturingMessage("Printer is offline."), "Printer is offline.");
});


test("mixed legacy and new submissions keep batch progress without requesting paper checks", () => {
  const detail = job();
  detail.state.ticket.ticket = "confirmed";
  detail.state.sheets["reef-1"] = { fronts: "submitted", backs: "queued" };
  detail.leased_until = new Date(now + 60_000).toISOString();
  const progress = printFeedback(detail, true, now);
  assert.equal(progress.title, "Sending remaining pages to printers");
  assert.equal(progress.sent, 2);
  assert.equal(progress.total, 3);
  assert.equal(progress.attention, false);
  detail.state.sheets["reef-1"].backs = "submitted";
  const sent = printFeedback(detail, true, now);
  assert.equal(sent.title, "Sent to printers");
  assert.equal(sent.sent, 3);
  assert.notEqual(sent.title, "Job complete");
});

test("missing or invalid leases cannot leave interrupted print attempts looking active", () => {
  const detail = job();
  detail.state.sheets["reef-1"].fronts = "submitting";
  for (const leasedUntil of [null, undefined, "invalid", new Date(now).toISOString()]) {
    detail.leased_until = leasedUntil;
    const result = printFeedback(detail, true, now);
    assert.equal(result.title, "Interrupted print attempt — check paper");
    assert.equal(result.attention, true);
  }
  detail.state.sheets["reef-1"].fronts = "needs_review";
  assert.match(printFeedback(detail, true, now).description, /Page printed successfully/);
  assert.match(printFeedback(detail, true, now).description, /missing or damaged/);
});

test("stock-only orders with a work ticket do not request card assembly or page checks", () => {
  const detail = job();
  detail.manifest.sheets = [];
  detail.state.sheets = {};
  const result = printFeedback(detail, true, now);
  assert.equal(result.title, "Sent to printers");
  assert.equal(result.total, 1);
  assert.equal(result.sent, 1);
  assert.match(result.description, /Once the work ticket prints/);
  assert.doesNotMatch(result.description, /gluing|cutting|Paper checked/);
});
