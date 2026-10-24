// Product barcodes identify a SKU, not a unique pack. Keep the reviewable count
// separate from the saved receipt request so a network retry cannot add it twice.
export const RECEIPT_RETRY_KEY = "seapals-manufacturing-receipt-retry";

export function normalizeBarcode(value) {
  const barcode = String(value ?? "").trim();
  if (!barcode || barcode.length > 128 || !/^[\x20-\x7e]+$/.test(barcode))
    throw new Error("Scan or enter a product barcode using 1–128 printable characters.");
  return barcode;
}

export function receivingLines(detail, stock = []) {
  if (detail?.job_kind !== "stock") return [];
  const plan = detail.inventory_plan ?? detail.manifest?.inventoryPlan ??
    detail.stock_request?.map((item) => ({ ...item, toMake: item.quantity })) ?? [];
  return plan.map((item) => {
    const planned = item.toMake ?? item.quantity ?? 0;
    const received = detail.received_quantities?.[item.productId] ??
      (detail.inventory_posted_at ? planned : 0);
    return {
      productId: item.productId,
      name: stock.find((product) => product.product_id === item.productId)?.product_name ?? item.productId,
      planned,
      received,
      remaining: Math.max(0, planned - received),
    };
  });
}

export function scanProduct(pending, value, barcodes, lines) {
  const barcode = normalizeBarcode(value);
  const mapping = barcodes.find((item) => item.barcode === barcode);
  if (!mapping) return { unknown: barcode };
  const line = lines.find((item) => item.productId === mapping.product_id);
  if (!line) throw new Error("This product is not part of the selected stock build.");
  const staged = pending.filter((item) => item.productId === mapping.product_id)
    .reduce((total, item) => total + item.quantity, 0);
  if (staged >= line.remaining)
    throw new Error(`All remaining ${line.name} units are already in this receipt. Remove a scan if needed.`);
  const existing = pending.find((item) => item.barcode === barcode);
  return { items: existing
    ? pending.map((item) => item.barcode === barcode ? { ...item, quantity: item.quantity + 1 } : item)
    : [...pending, { barcode, productId: mapping.product_id, quantity: 1 }] };
}

export function removeScan(pending, barcode) {
  return pending.map((item) => item.barcode === barcode ? { ...item, quantity: item.quantity - 1 } : item)
    .filter((item) => item.quantity > 0);
}

export function receiptPayload(orderId, items, qualityConfirmed) {
  if (!qualityConfirmed) throw new Error("Confirm that these products are packaged and quality checked.");
  if (!items.length) throw new Error("Scan at least one packaged product.");
  return { action: "receive_stock", orderId, items: items.map(({ barcode, quantity }) => ({ barcode, quantity })), qualityConfirmed: true };
}

export function readReceiptRetry(value) {
  try {
    const saved = JSON.parse(value);
    if (!saved?.id || saved.payload?.action !== "receive_stock" || !saved.payload.orderId ||
      !saved.payload.qualityConfirmed || !Array.isArray(saved.payload.items) || !saved.payload.items.length)
      return null;
    if (saved.payload.items.some((item) => !item.barcode || !Number.isSafeInteger(item.quantity) || item.quantity < 1))
      return null;
    return saved;
  } catch { return null; }
}

export function receiptWasRejected(error, isFirstAttempt = true) {
  // The receiving API reserves 409 for a rolled-back validation rejection;
  // its SQL first checks the saved receipt ID and returns success for a duplicate.
  // An auth failure on a retry says nothing about the earlier request's outcome.
  return error?.status === 409 || (isFirstAttempt && [400, 401, 403, 404, 422].includes(error?.status));
}

export function finalReceiptNeedsPrintReview(count, lines, statuses) {
  return count > 0 && count === lines.reduce((total, line) => total + line.remaining, 0) &&
    statuses.some((status) => ["queued", "needs_review"].includes(status));
}
