import test from "node:test";
import assert from "node:assert/strict";
import { printStatuses, requiresWorkTicket } from "./printStatus.mjs";
import { printFeedback } from "./printFeedback.mjs";
import { reprintReadiness } from "./sheetRecovery.mjs";
import { finalReceiptNeedsPrintReview } from "./receiving.mjs";
import { previewFixture } from "../../../../scripts/manufacturing/preview.mjs";

const now = Date.parse("2026-10-31T17:00:00Z");
const stock = (ticket = "not_required") => ({
  job_kind: "stock", phase: "awaiting_operator", print_requested_at: "2026-10-31T16:00:00Z",
  manifest: { jobKind: "stock", sheets: [{ sheetId: "one" }] },
  state: { ticket: { ticket }, sheets: { one: { fronts: "submitted", backs: "submitted" } } },
});

test("stock tickets are hidden and excluded from progress across new and historical statuses", () => {
  for (const status of ["queued", "submitting", "submitted", "confirmed", "needs_review", "not_required"]) {
    const detail = stock(status), original = structuredClone(detail);
    assert.equal(requiresWorkTicket(detail), false);
    assert.deepEqual(printStatuses(detail), ["submitted", "submitted"]);
    const feedback = printFeedback(detail, true, now);
    assert.equal(feedback.title, "Sent to printers");
    assert.equal(feedback.total, 2);
    assert.equal(feedback.sent, 2);
    assert.equal(feedback.attention, false);
    assert.deepEqual(detail, original, "UI must not rewrite historical ticket evidence");
    delete detail.job_kind;
    assert.equal(requiresWorkTicket(detail), false, "saved stock manifest also identifies the policy");
  }
});

test("customer work tickets retain their controls, progress and interrupted-attempt handling", () => {
  const detail = stock("submitting");
  detail.job_kind = "order";
  delete detail.manifest.jobKind;
  assert.equal(requiresWorkTicket(detail), true);
  assert.equal(printStatuses(detail).length, 3);
  assert.equal(printFeedback(detail, true, now).attention, true);
  assert.equal(reprintReadiness(detail, now).interrupted, true);
  detail.state.ticket.ticket = "submitted";
  assert.equal(printFeedback(detail, true, now).sent, 3);
  detail.state.ticket.ticket = "not_required";
  assert.equal(requiresWorkTicket(detail), false);
  assert.equal(printStatuses(detail).length, 2);
});

test("obsolete stock tickets cannot block sheet recovery but card attempts and active leases still do", () => {
  const detail = stock("submitting");
  assert.equal(reprintReadiness(detail, now).blocked, false);
  detail.leased_until = new Date(now + 1000).toISOString();
  assert.equal(reprintReadiness(detail, now).active, true);
  assert.equal(reprintReadiness(detail, now).blocked, true);
  detail.leased_until = null;
  detail.state.sheets.one.fronts = "submitting";
  assert.equal(reprintReadiness(detail, now).interrupted, true);
  assert.equal(printFeedback(detail, true, now).attention, true);
  detail.state.sheets.one.fronts = "needs_review";
  assert.equal(printFeedback(detail, true, now).title, "Print outcome needs review");
});

test("receiving checks only required card pages and still blocks a final receipt with outstanding cards", () => {
  const lines = [{ remaining: 1 }];
  for (const ticket of ["queued", "needs_review", "submitting", "not_required"]) {
    const detail = stock(ticket);
    assert.equal(finalReceiptNeedsPrintReview(1, lines, printStatuses(detail)), false);
    assert.equal(printStatuses(detail).includes("submitting"), false);
    detail.state.sheets.one.backs = "queued";
    assert.equal(finalReceiptNeedsPrintReview(1, lines, printStatuses(detail)), true);
    detail.state.sheets.one.backs = "needs_review";
    assert.equal(finalReceiptNeedsPrintReview(1, lines, printStatuses(detail)), true);
  }
});

test("accessory-only stock reports no card pages instead of a phantom work ticket or successful print", () => {
  const detail = stock("queued");
  detail.manifest.sheets = [];
  detail.state.sheets = {};
  const result = printFeedback(detail, true, now);
  assert.equal(result.title, "No card pages required");
  assert.equal(result.total, 0);
  assert.equal(result.sent, 0);
  assert.match(result.description, /quality checks/);
  assert.match(result.description, /scan the finished products/);
  assert.doesNotMatch(result.description, /Windows accepted|work ticket|sheets finish printing/);
  detail.print_requested_at = null;
  assert.equal(printFeedback(detail, true, now).title, "Awaiting Send to printers");
});

test("preview simulates only stock card pages and preserves customer work tickets", async () => {
  const built = await previewFixture({ jobKind: "stock", items: [{ productId: "coral-garden", quantity: 1 }] });
  assert.equal(built.state.ticket.ticket, "not_required");
  assert.equal(built.state.events.some((event) => event.side === "ticket"), false);
  assert.equal(built.state.events.length, built.manifest.sheets.length * 4);
  const accessory = await previewFixture({ jobKind: "stock", items: [{ productId: "dice-pack", quantity: 1 }] });
  assert.equal(accessory.state.events.length, 0);
  assert.equal(printFeedback(accessory, true, now).title, "No card pages required");
  const customer = await previewFixture({ items: [{ productId: "dice-pack", quantity: 1 }] });
  assert.equal(customer.state.ticket.ticket, "submitted");
  assert.equal(customer.state.events.filter((event) => event.side === "ticket").length, 2);
  assert.equal(printFeedback(customer, true, now).total, 1);
});