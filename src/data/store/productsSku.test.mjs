import assert from "node:assert/strict";
import test from "node:test";

import {
  storeLaunchProductIds,
  storeProductDefinitions,
} from "./products.js";

const EXPECTED_SKUS_BY_PRODUCT_ID = Object.freeze({
  "starter-kit": "SP-KIT-STARTER",
  "blue-water": "SP-DECK-BLUE-WATER",
  disruption: "SP-DECK-DISRUPTION",
  "coral-garden": "SP-DECK-CORAL-GARDEN",
  "darkness-shroud": "SP-DECK-DARKNESS-SHROUD",
  "open-ocean-hunt": "SP-DECK-OPEN-OCEAN-HUNT",
  "murky-water": "SP-DECK-MURKY-WATER",
  "stinging-fortress": "SP-DECK-STINGING-FORTRESS",
  "accessory-set": "SP-ACC-SET",
  "reef-point-tokens": "SP-ACC-REEF-POINTS",
  "dice-pack": "SP-ACC-DICE-PACK",
  "conditions-deck": "SP-ACC-CONDITIONS-DECK",
  "custom-t-shirt": "SP-MERCH-CUSTOM-TSHIRT",
  "card-binder": "SP-MERCH-CARD-BINDER",
  backpack: "SP-MERCH-BACKPACK",
  "plush-toy": "SP-MERCH-PLUSH-TOY",
});

const EXPECTED_LAUNCH_PRODUCT_IDS = Object.freeze([
  "starter-kit",
  "blue-water",
  "disruption",
  "coral-garden",
  "darkness-shroud",
  "open-ocean-hunt",
  "murky-water",
  "stinging-fortress",
  "accessory-set",
  "conditions-deck",
  "dice-pack",
  "reef-point-tokens",
]);

const EXPECTED_FUTURE_PRODUCT_IDS = Object.freeze([
  "backpack",
  "card-binder",
  "custom-t-shirt",
  "plush-toy",
]);

const CANONICAL_SKU_PATTERN = /^SP-[A-Z0-9]+-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

test("the store catalog preserves the exact canonical SKU map", () => {
  const actualSkusByProductId = Object.fromEntries(
    storeProductDefinitions.map(({ id, sku }) => [id, sku])
  );

  assert.equal(storeProductDefinitions.length, 16);
  assert.deepEqual(actualSkusByProductId, EXPECTED_SKUS_BY_PRODUCT_ID);
});

test("all canonical product IDs and SKUs are unique and well formed", () => {
  const productIds = storeProductDefinitions.map(({ id }) => id);
  const skus = storeProductDefinitions.map(({ sku }) => sku);

  assert.equal(new Set(productIds).size, productIds.length);
  assert.equal(new Set(skus).size, skus.length);

  for (const sku of skus) {
    assert.match(sku, CANONICAL_SKU_PATTERN);
    assert.ok(sku.length <= 100, `${sku} exceeds the 100-character limit`);
  }
});

test("the catalog remains partitioned into twelve launch and four future products", () => {
  const launchProductIds = new Set(storeLaunchProductIds);
  const futureProductIds = storeProductDefinitions
    .map(({ id }) => id)
    .filter((id) => !launchProductIds.has(id))
    .sort();

  assert.deepEqual(storeLaunchProductIds, EXPECTED_LAUNCH_PRODUCT_IDS);
  assert.equal(launchProductIds.size, 12);
  assert.deepEqual(futureProductIds, EXPECTED_FUTURE_PRODUCT_IDS);

  for (const productId of EXPECTED_FUTURE_PRODUCT_IDS) {
    assert.equal(launchProductIds.has(productId), false);
  }
});

test("all launch products publish the confirmed five-business-day standard production window", () => {
  const productsById = new Map(
    storeProductDefinitions.map((product) => [product.id, product])
  );

  for (const productId of storeLaunchProductIds) {
    assert.equal(productsById.get(productId)?.madeToOrder, true);
    assert.equal(
      productsById.get(productId)?.buildDispatchMaxBusinessDays,
      5
    );
  }
});

test("launch products publish conservative ready-to-mail weights", () => {
  const productsById = new Map(
    storeProductDefinitions.map((product) => [product.id, product])
  );

  assert.equal(productsById.get("starter-kit")?.shippingWeightOunces, 16);

  for (const productId of [
    "blue-water",
    "disruption",
    "coral-garden",
    "darkness-shroud",
    "open-ocean-hunt",
    "murky-water",
    "stinging-fortress",
  ]) {
    assert.equal(productsById.get(productId)?.shippingWeightOunces, 8);
  }

  for (const productId of [
    "accessory-set",
    "conditions-deck",
    "dice-pack",
    "reef-point-tokens",
  ]) {
    assert.equal(productsById.get(productId)?.shippingWeightOunces, 16);
  }
});
