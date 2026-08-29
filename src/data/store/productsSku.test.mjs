import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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
  "oceanic-dive-pack": "SP-PACK-OCEANIC",
  "reef-dive-pack": "SP-PACK-REEF",
  "deep-dive-pack": "SP-PACK-DEEP",
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
  "oceanic-dive-pack",
  "reef-dive-pack",
  "deep-dive-pack",
  "accessory-set",
]);

const EXPECTED_FUTURE_PRODUCT_IDS = Object.freeze([
  "backpack",
  "card-binder",
  "conditions-deck",
  "custom-t-shirt",
  "dice-pack",
  "plush-toy",
  "reef-point-tokens",
]);

const CANONICAL_SKU_PATTERN = /^SP-[A-Z0-9]+-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

test("the store catalog preserves the exact canonical SKU map", () => {
  const actualSkusByProductId = Object.fromEntries(
    storeProductDefinitions.map(({ id, sku }) => [id, sku])
  );

  assert.equal(storeProductDefinitions.length, 19);
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

test("the catalog remains partitioned into twelve launch products and seven prepared future products", () => {
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

test("launch decks, Dive Packs, and prepared products publish conservative ready-to-mail weights", () => {
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
    "oceanic-dive-pack",
    "reef-dive-pack",
    "deep-dive-pack",
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

test("the three set Dive Packs preserve their approved names, price, and card-product policies", () => {
  const productsById = new Map(
    storeProductDefinitions.map((product) => [product.id, product])
  );
  const expectedDivePacks = Object.freeze({
    "oceanic-dive-pack": {
      name: "Pelagic Rush Dive Pack",
      setName: "Oceanic",
      priceEnvKey: "STORE_PRICE_OCEANIC_DIVE_PACK_CENTS",
      coverCard: "Killer Whale",
      image: "/images/cards/apex/Oceanic/killer-whale.png",
    },
    "reef-dive-pack": {
      name: "Coral Bloom Dive Pack",
      setName: "Reef",
      priceEnvKey: "STORE_PRICE_REEF_DIVE_PACK_CENTS",
      coverCard: "Great White",
      image: "/images/cards/apex/Reef/great-white.png",
    },
    "deep-dive-pack": {
      name: "Abyssal Glow Dive Pack",
      setName: "Deep",
      priceEnvKey: "STORE_PRICE_DEEP_DIVE_PACK_CENTS",
      coverCard: "Colossal Squid",
      image: "/images/cards/apex/Deep/colossal-squid.png",
    },
  });

  for (const [productId, expected] of Object.entries(expectedDivePacks)) {
    const product = productsById.get(productId);

    assert.equal(product?.name, expected.name);
    assert.equal(product?.category, "dive-packs");
    assert.equal(product?.details, `1 ${expected.setName} Set Dive Pack`);
    assert.match(product?.description ?? "", new RegExp(expected.coverCard));
    assert.match(product?.checkoutDescription ?? "", new RegExp(expected.setName));
    assert.equal(product?.defaultPriceCents, 1000);
    assert.equal(product?.priceEnvKey, expected.priceEnvKey);
    assert.equal(product?.taxCodeEnvKey, "STRIPE_GAME_PRODUCT_TAX_CODE");
    assert.equal(product?.madeToOrder, true);
    assert.equal(product?.buildDispatchMaxBusinessDays, 5);
    assert.equal(product?.shippingWeightOunces, 8);
    assert.equal(product?.image, expected.image);
    assert.match(
      product?.image ?? "",
      new RegExp(`/images/cards/apex/${expected.setName}/`, "i"),
      `${productId} must use a matching-set Apex card cover`
    );
    const imageUrl = new URL(`../../../public${expected.image}`, import.meta.url);
    assert.equal(
      existsSync(imageUrl),
      true,
      `${productId} ${expected.coverCard} cover is missing from public/`
    );
  }
});

test("the Starter Kit, Accessories Kit, and prepared components preserve the owner-confirmed contents", () => {
  const productsById = new Map(
    storeProductDefinitions.map((product) => [product.id, product])
  );

  assert.equal(
    productsById.get("dice-pack")?.details,
    "7 dice: one each D4, D6, D8, D10, D12, D20, and D100"
  );
  assert.match(
    productsById.get("dice-pack")?.checkoutDescription ?? "",
    /one each D4, D6, D8, D10, D12, D20, and D100/
  );
  assert.equal(
    productsById.get("reef-point-tokens")?.details,
    "15 Reef Point tokens"
  );
  assert.match(
    productsById.get("reef-point-tokens")?.checkoutDescription ?? "",
    /15 Reef Point/
  );
  assert.deepEqual(productsById.get("accessory-set")?.includedItems, [
    "1 Conditions Deck (18 cards)",
    "7 dice: D4, D6, D8, D10, D12, D20, and D100",
    "15 Reef Point tokens",
  ]);
  assert.equal(productsById.get("accessory-set")?.defaultPriceCents, 1200);
  assert.deepEqual(productsById.get("starter-kit")?.includedItems, [
    "1 Coral Garden 60-card ready-to-play deck",
    "1 Blue Water 60-card ready-to-play deck",
    "1 Conditions Deck (18 cards)",
    "7 dice: D4, D6, D8, D10, D12, D20, and D100",
    "15 Reef Point tokens",
  ]);
  assert.equal(productsById.get("starter-kit")?.defaultPriceCents, 4400);
  assert.equal(productsById.get("conditions-deck")?.cardsIncluded, 18);
  assert.equal(
    productsById.get("conditions-deck")?.details,
    "18 condition cards for SeaPals gameplay"
  );
});
