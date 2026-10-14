import test from "node:test";
import assert from "node:assert/strict";
import { createRefreshGuard, printFeedback } from "./printFeedback.mjs";

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

test("accepted Windows submissions remain unchecked until the operator checks paper", () => {
  const result = printFeedback(job(), true, now);
  assert.equal(result.title, "Sent to printers — check paper");
  assert.equal(result.sent, 3);
  assert.equal(result.total, 3);
  assert.equal(result.checked, 0);
  assert.match(result.description, /Windows accepted/);
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
  assert.equal(result.checked, 0);
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
  assert.equal(printFeedback(detail, true, now).title, "All printed pages checked");
  assert.equal(printFeedback(detail, true, now).checked, 3);
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
