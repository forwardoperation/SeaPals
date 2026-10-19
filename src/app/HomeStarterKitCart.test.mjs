import assert from "node:assert/strict";
import test from "node:test";
import { STORE_MAX_CART_QUANTITY, STORE_MAX_PER_PRODUCT_QUANTITY } from "../lib/store/cart.mjs";
import {
  HOME_STARTER_KIT_CART_STORAGE_KEY,
  addHomeStarterKitToCart,
  countHomeStarterKitCart,
  readHomeStarterKitCart,
} from "./HomeStarterKitCart.mjs";

const kit = { id: "starter-kit", name: "Starter Kit", available: true, priceConfigured: true, preorder: true };
const products = [kit, { id: "reef-pack", available: true }, { id: "unavailable", available: false },
  ...Array.from({ length: Math.ceil(STORE_MAX_CART_QUANTITY / STORE_MAX_PER_PRODUCT_QUANTITY) },
    (_, index) => ({ id: `other-${index}`, available: true }))];

function savedCart(value) {
  let raw = typeof value === "string" ? value : JSON.stringify(value);
  let writes = 0;
  return {
    getItem(key) { assert.equal(key, HOME_STARTER_KIT_CART_STORAGE_KEY); return raw; },
    setItem(key, next) { assert.equal(key, HOME_STARTER_KIT_CART_STORAGE_KEY); raw = next; writes += 1; },
    snapshot() { return { raw, writes }; },
  };
}
function add(storage, overrides = {}) {
  return addHomeStarterKitToCart({ storage, products, product: kit, checkoutEnabled: true, ...overrides });
}

test("reads the current cart and both existing legacy formats without losing other products", () => {
  const items = [{ productId: "reef-pack", quantity: 2 }, { productId: "starter-kit", quantity: 1 }];
  for (const saved of [{ items }, items, { "reef-pack": 2, "starter-kit": 1 }]) {
    assert.deepEqual(readHomeStarterKitCart(JSON.stringify(saved), products), { "reef-pack": 2, "starter-kit": 1 });
  }
});

test("malformed storage does not crash, while malformed rows preserve valid saved items", () => {
  for (const raw of [null, "", "{broken", "null", "false", "42", '"string"']) {
    assert.deepEqual(readHomeStarterKitCart(raw, products), {});
  }
  const items = [null, { productId: "unknown", quantity: 2 }, { productId: "unavailable", quantity: 3 },
    { productId: "reef-pack", quantity: -1 }, { productId: "starter-kit", quantity: "NaN" },
    { productId: "reef-pack", quantity: 2 }];
  assert.deepEqual(readHomeStarterKitCart(JSON.stringify({ items }), products), { "reef-pack": 2 });
});

test("normalizes duplicate and fractional quantities within the store quantity limits", () => {
  const items = [{ productId: "reef-pack", quantity: 2.8 }, { productId: "reef-pack", quantity: 3 },
    { productId: "starter-kit", quantity: 99 }];
  const cart = readHomeStarterKitCart(JSON.stringify({ items }), products);
  const kitQuantity = Math.min(STORE_MAX_PER_PRODUCT_QUANTITY, STORE_MAX_CART_QUANTITY - 5);
  assert.deepEqual(cart, { "reef-pack": 5, "starter-kit": kitQuantity });
  assert.equal(countHomeStarterKitCart(cart), 5 + kitQuantity);
});

test("each click preserves other products and adds exactly one in the existing storage schema", () => {
  const storage = savedCart({ items: [{ productId: "reef-pack", quantity: 2 }] });
  const first = add(storage);
  assert.equal(first.added, true);
  assert.equal(first.notice, "Starter Kit added. 1 in your cart.");
  assert.deepEqual(JSON.parse(storage.snapshot().raw), { items: [
    { productId: "reef-pack", quantity: 2 }, { productId: "starter-kit", quantity: 1 },
  ] });
  const second = add(storage);
  assert.equal(second.cart["starter-kit"], 2);
  assert.equal(second.cart["reef-pack"], 2);
  assert.equal(storage.snapshot().writes, 2);
});

test("reads the latest cart on every add and reports the applicable product or total limit", () => {
  const kitStorage = savedCart({ items: [{ productId: kit.id, quantity: STORE_MAX_PER_PRODUCT_QUANTITY - 1 }] });
  assert.equal(add(kitStorage).added, true);
  const kitBefore = kitStorage.snapshot();
  const kitBlocked = add(kitStorage);
  assert.equal(kitBlocked.added, false);
  assert.match(kitBlocked.notice, new RegExp(`up to ${STORE_MAX_PER_PRODUCT_QUANTITY} of this kit`));
  assert.deepEqual(kitStorage.snapshot(), kitBefore);

  let remaining = STORE_MAX_CART_QUANTITY - 1;
  const items = [];
  for (const product of products.filter((entry) => entry.available && entry.id !== kit.id)) {
    const quantity = Math.min(STORE_MAX_PER_PRODUCT_QUANTITY, remaining);
    if (quantity > 0) items.push({ productId: product.id, quantity });
    remaining -= quantity;
  }
  assert.equal(remaining, 0);
  const storage = savedCart({ items });
  assert.equal(add(storage).added, true);
  const before = storage.snapshot();
  const blocked = add(storage);
  assert.equal(blocked.added, false);
  assert.match(blocked.notice, new RegExp(`${STORE_MAX_CART_QUANTITY}-item limit`));
  assert.deepEqual(storage.snapshot(), before);
});

test("closed checkout, unavailable kits, and kits missing from the visible catalog never write", () => {
  for (const overrides of [
    { checkoutEnabled: false },
    { product: { ...kit, available: false } },
    { products: products.filter((product) => product.id !== kit.id) },
    { products: products.map((product) => ({ ...product, available: false })) },
  ]) {
    const storage = savedCart({ items: [{ productId: "reef-pack", quantity: 2 }] });
    const before = storage.snapshot();
    assert.equal(add(storage, overrides).added, false);
    assert.deepEqual(storage.snapshot(), before);
  }
});

test("storage failures do not return a success result or alter an existing saved cart", () => {
  const storage = savedCart({ items: [{ productId: "reef-pack", quantity: 2 }] });
  const before = storage.snapshot();
  assert.throws(() => add({ ...storage, setItem() { throw new Error("Storage is blocked"); } }), /Storage is blocked/);
  assert.deepEqual(storage.snapshot(), before);
  assert.throws(() => add({ getItem() { throw new Error("Storage is blocked"); } }), /Storage is blocked/);
});
