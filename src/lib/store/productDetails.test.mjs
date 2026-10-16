import assert from "node:assert/strict";
import test from "node:test";
import {
  getStoreProductById,
  getStoreProductOrderState,
  getStoreProductPath,
} from "./productDetails.mjs";

const pack = { id: "deep-dive-pack", available: true, priceConfigured: true };

test("detail routes resolve exact products from the visible server catalog only", () => {
  const catalog = [pack, { id: "starter-kit", available: false }];
  assert.equal(getStoreProductById(catalog, "deep-dive-pack"), pack);
  assert.equal(getStoreProductById(catalog, "starter-kit"), catalog[1]);
  for (const id of ["Deep-Dive-Pack", " deep-dive-pack", "deep-dive-pack/", "dice-pack", "__proto__", null, ["deep-dive-pack"]]) {
    assert.equal(getStoreProductById(catalog, id), null);
  }
  assert.equal(getStoreProductById(null, pack.id), null);
});

test("product paths encode the ID as one route segment", () => {
  assert.equal(getStoreProductPath(pack.id), "/store/deep-dive-pack");
  assert.equal(getStoreProductPath("reef/pack?set=deep#photo"), "/store/reef%2Fpack%3Fset%3Ddeep%23photo");
  assert.throws(() => getStoreProductPath(""), /product ID is required/);
  assert.throws(() => getStoreProductPath(null), /product ID is required/);
});

test("detail ordering preserves preview gates and the shared cart limits", () => {
  const input = { product: pack, checkoutEnabled: true };
  assert.deepEqual(getStoreProductOrderState(input), { canAdd: true, buttonLabel: "Add to cart" });
  assert.deepEqual(getStoreProductOrderState({ ...input, product: { ...pack, preorder: true } }), { canAdd: true, buttonLabel: "Pre-order" });
  assert.deepEqual(getStoreProductOrderState({ ...input, quantityInCart: 1 }), { canAdd: true, buttonLabel: "Add another" });
  for (const state of [{ quantityInCart: 8 }, { cartCount: 8 }]) {
    assert.deepEqual(getStoreProductOrderState({ ...input, ...state }), { canAdd: false, buttonLabel: "Cart limit reached" });
  }
  assert.deepEqual(getStoreProductOrderState({ ...input, checkoutEnabled: false }), { canAdd: false, buttonLabel: "Preview only" });
  assert.deepEqual(getStoreProductOrderState({ ...input, isCheckingOut: true }), { canAdd: false, buttonLabel: "Preparing checkout…" });
  assert.deepEqual(getStoreProductOrderState({ ...input, product: { ...pack, available: false } }), { canAdd: false, buttonLabel: "Unavailable" });
  assert.deepEqual(getStoreProductOrderState({ ...input, product: { ...pack, available: false, priceConfigured: false } }), { canAdd: false, buttonLabel: "Price to confirm" });
  assert.deepEqual(getStoreProductOrderState({ ...input, product: { ...pack, available: false, requiresConfiguration: true } }), { canAdd: false, buttonLabel: "Options coming soon" });
});
