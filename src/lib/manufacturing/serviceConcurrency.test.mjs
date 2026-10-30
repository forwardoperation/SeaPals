import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createManufacturingManifest } from "./printPlan.mjs";
import { createManufacturingState, applyManufacturingEvent } from "./workflow.mjs";
import { manufacturingService, normalizedEvent } from "./integration.mjs";
import { contentHash } from "./boosters.mjs";

function fixture() {
  const token = randomUUID();
  const manifest = createManufacturingManifest({
    request: { orderId: randomUUID(), orderNumber: "CONCURRENT-TEST", items: [
      { productId: "coral-garden", quantity: 1 }, { productId: "dice-pack", quantity: 1 },
    ] }, catalog: [], artworkRelease: "test",
  });
  let row = {
    order_id: manifest.order.orderId, manifest_text: JSON.stringify(manifest),
    state: createManufacturingState(manifest), revision: 0,
    lease_token: token, leased_until: new Date(Date.now() + 120000).toISOString(),
  };
  const target = { sheetId: manifest.sheets[0].sheetId, side: "fronts" };
  const ticket = { sheetId: "work-ticket", side: "ticket" };
  const calls = [];
  let beforeCommit = () => {}, failure;
  const apply = (type, fields = {}, role = "operator") => {
    row.state = applyManufacturingEvent(row.state, manifest, normalizedEvent({
      id: randomUUID(), type, expectedRevision: row.revision, ...fields,
    }, role));
    row.revision = row.state.revision;
  };
  const db = {
    from(table) {
      assert.equal(table, "manufacturing_orders");
      const query = {
        select() { return query; }, eq() { return query; },
        async single() { return { data: structuredClone(row) }; },
      };
      return query;
    },
    async rpc(name, args) {
      assert.equal(name, "manufacturing_commit");
      calls.push(structuredClone(args));
      beforeCommit();
      if (failure) return { error: failure };
      if (args.p_expected !== row.revision)
        return { error: { code: "P0001", message: "Revision conflict" } };
      if (args.p_token !== row.lease_token || new Date(row.leased_until) <= new Date())
        return { error: { code: "P0001", message: "Lease expired" } };
      assert.equal(args.p_state.revision, row.revision + 1);
      row = { ...row, state: args.p_state, revision: args.p_state.revision, phase: args.p_phase };
      return { data: structuredClone(row) };
    },
  };
  const service = manufacturingService(db);
  const input = (type = "submission_started", fields = target) => ({
    id: randomUUID(), type, expectedRevision: row.revision, ...fields,
  });
  return {
    service, token, manifest, target, ticket, apply, input, calls,
    row: () => row,
    beforeCommit: (fn) => { beforeCommit = fn; },
    fail: (error) => { failure = error; },
    send: (event, role = "agent", lease = token) => service.event(row.order_id, event, role, lease),
  };
}

function submittedTicket(f) {
  f.apply("submission_started", f.ticket, "agent");
  f.apply("submission_succeeded", f.ticket, "agent");
}

test("unrelated paper confirmation does not interrupt a pending agent reservation", async () => {
  const f = fixture();
  submittedTicket(f);
  const event = f.input();
  f.apply("confirm_printed", f.ticket);
  const result = await f.send(event);
  assert.equal(result.state.sheets[f.target.sheetId].fronts, "submitting");
  assert.equal(result.state.ticket.ticket, "confirmed");
  assert.equal(result.state.events.at(-1).expectedRevision, event.expectedRevision);
  assert.equal(result.state.events.at(-1).fingerprint, contentHash(normalizedEvent(event, "agent")));
});

test("a successful printer acknowledgement survives a staff event between read and commit", async () => {
  const f = fixture();
  submittedTicket(f);
  f.apply("submission_started", f.target, "agent");
  const event = f.input("submission_succeeded");
  f.beforeCommit(() => {
    f.beforeCommit(() => {});
    f.apply("confirm_printed", f.ticket);
  });
  const result = await f.send(event);
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls[0].p_event, f.calls[1].p_event);
  assert.equal(result.state.sheets[f.target.sheetId].fronts, "submitted");
  assert.equal(result.state.events.filter((entry) => entry.id === event.id).length, 1);
  const revision = result.state.revision;
  const repeated = await f.send(event);
  assert.equal(repeated.state.revision, revision);
  assert.equal(f.calls.length, 2, "lost-response retry must not commit or submit twice");
  await assert.rejects(f.send({ ...event, expectedRevision: revision }), /reused for a different action/);
});

test("printer failure acknowledgement survives unrelated progress and remains needs_review", async () => {
  const f = fixture();
  submittedTicket(f);
  f.apply("submission_started", f.target, "agent");
  const event = f.input("submission_uncertain");
  f.apply("confirm_printed", f.ticket);
  const result = await f.send(event);
  assert.equal(result.state.sheets[f.target.sheetId].fronts, "needs_review");
  assert.equal(result.state.sheets[f.manifest.sheets[1].sheetId].fronts, "queued");
});

test("hold, reprint, uncertainty and other agent events remain conflicts", async () => {
  for (const change of [
    (f) => f.apply("hold"),
    (f) => f.apply("reprint", { ...f.ticket, reason: "Damaged paper" }),
    (f) => f.apply("submission_uncertain", f.ticket),
    (f) => f.apply("submission_started", { sheetId: f.manifest.sheets[1].sheetId, side: "backs" }, "agent"),
  ]) {
    const f = fixture();
    submittedTicket(f);
    const event = f.input();
    change(f);
    await assert.rejects(f.send(event), /Production state changed/);
    assert.equal(f.calls.length, 0);
    assert.equal(f.row().state.sheets[f.target.sheetId].fronts, "queued");
  }
});

test("same-target confirmation cannot be rebased into an uncertain print state", async () => {
  const f = fixture();
  submittedTicket(f);
  const event = f.input("submission_uncertain", f.ticket);
  f.apply("confirm_printed", f.ticket);
  await assert.rejects(f.send(event), /Production state changed/);
  assert.equal(f.row().state.ticket.ticket, "confirmed");
  assert.equal(f.calls.length, 0);
});

test("staff updates, future revisions and incomplete histories keep strict revision checks", async () => {
  const operator = fixture();
  submittedTicket(operator);
  const event = operator.input("confirm_printed", operator.ticket);
  operator.apply("accessory_picked", { accessoryId: "dice-pack-dice" });
  await assert.rejects(operator.send(event, "operator"), /Production state changed/);
  assert.equal(operator.calls.length, 0);
  const future = fixture();
  await assert.rejects(future.send({ ...future.input(), expectedRevision: 5 }), /Production state changed/);
  const incomplete = fixture();
  submittedTicket(incomplete);
  const pending = incomplete.input();
  incomplete.apply("confirm_printed", incomplete.ticket);
  incomplete.row().state.events.pop();
  await assert.rejects(incomplete.send(pending), /Production state changed/);
  assert.equal(incomplete.calls.length, 0);
});

test("concurrent staff progress has a bounded retry budget and retains the original event", async () => {
  const f = fixture();
  const event = f.input();
  f.beforeCommit(() => f.apply("accessory_picked", { accessoryId: "dice-pack-dice" }));
  await assert.rejects(f.send(event), /Revision conflict/);
  assert.equal(f.calls.length, 3);
  assert.ok(f.calls.every((call) => JSON.stringify(call.p_event) === JSON.stringify(f.calls[0].p_event)));
  assert.equal(f.row().state.sheets[f.target.sheetId].fronts, "queued");
});

test("lease, storage and unknown acknowledgement failures are never retried", async () => {
  for (const failure of [
    { code: "P0001", message: "Lease expired" },
    { code: "08006", message: "connection lost" },
  ]) {
    const f = fixture();
    f.fail(failure);
    await assert.rejects(f.send(f.input()));
    assert.equal(f.calls.length, 1);
    assert.equal(f.row().state.sheets[f.target.sheetId].fronts, "queued");
  }
  const invalid = fixture();
  await assert.rejects(invalid.send(invalid.input(), "agent", randomUUID()), /Lease expired/);
  assert.equal(invalid.calls.length, 1);
});
// Receiving deliberately increments the state revision without adding a workflow
// event. Model that storage operation without pretending it was staff progress.
function partialReceipt(f) {
  f.row().received_quantities = { "coral-garden": 1 };
  f.row().revision++;
  f.row().state.revision++;
}

test("a partial receipt before a reprint request does not prevent safe later staff progress", async () => {
  const f = fixture();
  submittedTicket(f);
  f.apply("submission_started", f.target, "agent");
  f.apply("submission_succeeded", f.target, "agent");
  partialReceipt(f);
  f.apply("reprint", { ...f.target, reason: "Replace a damaged sheet from an unfinished product" });
  const event = f.input();
  f.apply("confirm_printed", f.ticket);
  const result = await f.send(event);
  assert.equal(result.state.sheets[f.target.sheetId].fronts, "submitting");
  assert.equal(result.state.events.length, result.state.revision - 1);
  assert.equal(result.state.events.at(-1).expectedRevision, event.expectedRevision);
  assert.equal(result.state.events.at(-1).appliedRevision, result.state.revision);
});

test("any unrecorded revision after the requested revision prevents rebasing", async () => {
  for (const receiptAfterProgress of [false, true]) {
    const f = fixture();
    submittedTicket(f);
    const event = f.input();
    if (!receiptAfterProgress) partialReceipt(f);
    f.apply("confirm_printed", f.ticket);
    if (receiptAfterProgress) partialReceipt(f);
    await assert.rejects(f.send(event), /Production state changed/);
    assert.equal(f.calls.length, 0);
    assert.equal(f.row().state.sheets[f.target.sheetId].fronts, "queued");
  }
});

test("historical staff events without appliedRevision still prove a contiguous suffix", async () => {
  const f = fixture();
  submittedTicket(f);
  partialReceipt(f);
  const event = f.input();
  f.apply("confirm_printed", f.ticket);
  for (const recorded of f.row().state.events) delete recorded.appliedRevision;
  const result = await f.send(event);
  assert.equal(result.state.sheets[f.target.sheetId].fronts, "submitting");
  assert.equal(result.state.events.at(-1).appliedRevision, result.state.revision);
});

test("repeated rebases record actual revisions while every original event stays idempotent", async () => {
  const f = fixture();
  submittedTicket(f);
  const start = f.input();
  f.apply("confirm_printed", f.ticket);
  await f.send(start);
  const succeeded = f.input("submission_succeeded");
  f.apply("accessory_picked", { accessoryId: "dice-pack-dice" });
  await f.send(succeeded);
  const nextTarget = { sheetId: f.manifest.sheets[1].sheetId, side: "fronts" };
  const nextStart = f.input("submission_started", nextTarget);
  f.apply("confirm_printed", f.target);
  f.beforeCommit(() => {
    f.beforeCommit(() => {});
    f.apply("accessory_picked", { accessoryId: "dice-pack-dice" });
  });
  const result = await f.send(nextStart);
  assert.equal(result.state.sheets[nextTarget.sheetId].fronts, "submitting");
  const commits = f.calls.length;
  for (const event of [start, succeeded, nextStart]) {
    const recorded = result.state.events.find((entry) => entry.id === event.id);
    assert.equal(recorded.expectedRevision, event.expectedRevision);
    assert.ok(recorded.appliedRevision > event.expectedRevision + 1);
    assert.equal(recorded.fingerprint, contentHash(normalizedEvent(event, "agent")));
    const repeated = await f.send(event);
    assert.equal(repeated.state.revision, result.state.revision);
    assert.equal(repeated.state.events.filter((entry) => entry.id === event.id).length, 1);
  }
  assert.equal(f.calls.length, commits);
  assert.deepEqual(f.calls.at(-1).p_event, f.calls.at(-2).p_event);
});