import assert from "node:assert/strict";
import test from "node:test";
import {
  createCheckoutRequestFingerprint,
  getOrCreateCheckoutRequest,
  normalizeCheckoutRequestId,
} from "./checkoutRequest.mjs";

const firstId = "00000000-0000-4000-8000-000000000001";
const secondId = "00000000-0000-4000-8000-000000000002";
const input = {
  fulfillmentOptionId: "standard",
  items: [{ productId: "starter-kit", quantity: 1 }],
  productionOptionId: "standard-production",
};

test("ambiguous retries reuse the request ID for the same cart and fulfillment", () => {
  const first = getOrCreateCheckoutRequest(null, input, () => firstId);
  const retry = getOrCreateCheckoutRequest(first, input, () => secondId);

  assert.equal(first.id, firstId);
  assert.deepEqual(retry, first);
});

test("quantity, product, fulfillment, or production changes invalidate the request ID", () => {
  const previous = getOrCreateCheckoutRequest(null, input, () => firstId);
  const variants = [
    { ...input, items: [{ productId: "starter-kit", quantity: 2 }] },
    { ...input, items: [{ productId: "card-binder", quantity: 1 }] },
    { ...input, fulfillmentOptionId: "priority" },
    { ...input, productionOptionId: "expedited-production" },
  ];

  for (const variant of variants) {
    const next = getOrCreateCheckoutRequest(previous, variant, () => secondId);
    assert.equal(next.id, secondId);
  }
});

test("fingerprints are stable across item ordering and request IDs require UUIDs", () => {
  const ordered = {
    fulfillmentOptionId: "standard",
    productionOptionId: "standard-production",
    items: [
      { productId: "starter-kit", quantity: 1 },
      { productId: "card-binder", quantity: 2 },
    ],
  };
  const reversed = { ...ordered, items: [...ordered.items].reverse() };

  assert.equal(
    createCheckoutRequestFingerprint(ordered),
    createCheckoutRequestFingerprint(reversed)
  );
  assert.equal(normalizeCheckoutRequestId(firstId.toUpperCase()), firstId);
  assert.equal(normalizeCheckoutRequestId("not-a-uuid"), null);
});
