import test from "node:test";
import assert from "node:assert/strict";
import { finalReceiptNeedsPrintReview, normalizeBarcode, receivingLines, scanProduct, removeScan, receiptPayload, readReceiptRetry, receiptWasRejected } from "./receiving.mjs";

const barcodes = [{ barcode: "001234", product_id: "reef-dive-pack" }, { barcode: "REEF", product_id: "reef-dive-pack" }, { barcode: "DEEP", product_id: "deep-dive-pack" }];
const detail = { job_kind: "stock", stock_request: [{ productId: "reef-dive-pack", quantity: 5 }], received_quantities: { "reef-dive-pack": 2 } };

test("existing product barcodes remain strings and preserve leading zeros and case", () => {
  assert.equal(normalizeBarcode(" 001234\r\n"), "001234");
  assert.equal(normalizeBarcode("Reef-1"), "Reef-1");
  for (const value of ["", "\n", "x".repeat(129), "ab\tcd", "reef😀"]) assert.throws(() => normalizeBarcode(value));
});

test("partial receipts show planned, actual received, and remaining products", () => {
  const [line] = receivingLines(detail, [{ product_id: "reef-dive-pack", product_name: "Reef pack" }]);
  assert.deepEqual(line, { productId: "reef-dive-pack", name: "Reef pack", planned: 5, received: 2, remaining: 3 });
  assert.deepEqual(receivingLines({ ...detail, job_kind: "order" }), []);
  assert.equal(receivingLines({ ...detail, received_quantities: undefined, inventory_posted_at: "2026-10-01" })[0].remaining, 0);
});

test("each SKU scan adds one reviewable unit, and multiple barcodes share the product limit", () => {
  const lines = receivingLines(detail);
  let items = scanProduct([], "001234", barcodes, lines).items;
  items = scanProduct(items, "001234", barcodes, lines).items;
  assert.equal(items[0].quantity, 2);
  items = scanProduct(items, "REEF", barcodes, lines).items;
  assert.throws(() => scanProduct(items, "001234", barcodes, lines), /All remaining/);
  items = removeScan(items, "001234");
  assert.equal(items[0].quantity, 1);
  items = removeScan(items, "REEF");
  assert.equal(items.length, 1);
  assert.equal(scanProduct(items, "REEF", barcodes, lines).items.length, 2);
});

test("unmapped and wrong-build barcodes cannot silently receive a different product", () => {
  assert.deepEqual(scanProduct([], "unknown", barcodes, receivingLines(detail)), { unknown: "unknown" });
  assert.throws(() => scanProduct([], "DEEP", barcodes, receivingLines(detail)), /not part/);
});

test("packaging attestation and a nonempty reviewed receipt are required", () => {
  const items = [{ barcode: "001234", productId: "reef-dive-pack", quantity: 2 }];
  assert.throws(() => receiptPayload("stock-1", items, false), /packaged and quality checked/);
  assert.throws(() => receiptPayload("stock-1", [], true), /at least one/);
  assert.deepEqual(receiptPayload("stock-1", items, true), { action: "receive_stock", orderId: "stock-1", items: [{ barcode: "001234", quantity: 2 }], qualityConfirmed: true });
});

test("uncertain receipts reload with the same ID and exact counts for idempotent retry", () => {
  const saved = { id: "receipt-uuid", payload: receiptPayload("stock-1", [{ barcode: "001234", quantity: 2 }], true) };
  assert.deepEqual(readReceiptRetry(JSON.stringify(saved)), saved);
  for (const value of [null, "oops", "{}", JSON.stringify({ ...saved, payload: { ...saved.payload, items: [] } })]) assert.equal(readReceiptRetry(value), null);
  assert.equal(receiptWasRejected({ status: 409 }), true);
  for (const status of [408, 429, 500, 503, undefined]) assert.equal(receiptWasRejected({ status }), false);
  assert.equal(receiptWasRejected({ status: 409 }, false), true);
  for (const status of [400, 401, 403, 404, 422]) {
    assert.equal(receiptWasRejected({ status }, true), true);
    assert.equal(receiptWasRejected({ status }, false), false);
  }
});

test("partial receipts can leave pages outstanding but a final receipt cannot close unresolved printing", () => {
  const lines = receivingLines(detail);
  for (const status of ["queued", "needs_review"]) {
    assert.equal(finalReceiptNeedsPrintReview(2, lines, ["confirmed", status]), false);
    assert.equal(finalReceiptNeedsPrintReview(3, lines, ["confirmed", status]), true);
  }
  assert.equal(finalReceiptNeedsPrintReview(3, lines, ["confirmed", "submitted"]), false);
  assert.equal(finalReceiptNeedsPrintReview(0, [{ remaining: 0 }], ["queued"]), false);
});
