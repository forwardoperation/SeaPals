const CHECKOUT_REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Catalog names and fulfillment snapshots changed in the preorder rollout.
// Start one fresh request instead of replaying a prior deployment's cart;
// retries within this version retain their original idempotency key.
const CHECKOUT_SNAPSHOT_VERSION = "preorders-v1";

export function normalizeCheckoutRequestId(value) {
  const id = String(value ?? "").trim();
  return CHECKOUT_REQUEST_ID_PATTERN.test(id) ? id.toLowerCase() : null;
}

export function createCheckoutRequestFingerprint({
  fulfillmentOptionId,
  items,
  productionOptionId,
}) {
  const normalizedItems = Array.isArray(items)
    ? items
        .map((item) => ({
          productId: String(item?.productId ?? "").trim(),
          quantity: Number(item?.quantity),
        }))
        .sort((first, second) =>
          first.productId.localeCompare(second.productId)
        )
    : [];

  return JSON.stringify({
    checkoutSnapshotVersion: CHECKOUT_SNAPSHOT_VERSION,
    fulfillmentOptionId: String(fulfillmentOptionId ?? "").trim(),
    items: normalizedItems,
    productionOptionId: String(productionOptionId ?? "").trim(),
  });
}

export function getOrCreateCheckoutRequest(
  previous,
  input,
  createId = () => globalThis.crypto.randomUUID()
) {
  const fingerprint = createCheckoutRequestFingerprint(input);
  const previousId = normalizeCheckoutRequestId(previous?.id);

  if (previousId && previous?.fingerprint === fingerprint) {
    return { id: previousId, fingerprint };
  }

  const id = normalizeCheckoutRequestId(createId());
  if (!id) {
    throw new Error("A secure checkout request ID could not be created.");
  }

  return { id, fingerprint };
}
