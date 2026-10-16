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
  "coral-garden",
  "blue-water",
  "darkness-shroud",
  "open-ocean-hunt",
  "murky-water",
  "stinging-fortress",
  "disruption",
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

const EXPECTED_PRODUCT_PHOTOS = Object.freeze({
  "starter-kit": "starter-kit-v2.png",
  "coral-garden": "deck-coral-garden.png",
  "blue-water": "deck-drop-off-v2.png",
  "darkness-shroud": "deck-darkness-shroud.png",
  "open-ocean-hunt": "deck-pelagic-zone.png",
  "murky-water": "deck-murky-water.png",
  "stinging-fortress": "deck-stinging-fortress.png",
  disruption: "deck-disruption.png",
  "oceanic-dive-pack": "dive-pack-oceanic.png",
  "reef-dive-pack": "dive-pack-reef.png",
  "deep-dive-pack": "dive-pack-deep.png",
  "accessory-set": "accessories-dice.png",
});

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

test("retail photo titles and descriptions remain complete without simulator deck copy", () => {
  const productsById = new Map(storeProductDefinitions.map((product) => [product.id, product]));
  for (const productId of storeLaunchProductIds) {
    const product = productsById.get(productId);
    assert.equal(typeof product.description, "string", `${productId} needs a description`);
    assert.ok(product.description.trim().length > 0, `${productId} description is empty`);
  }
  for (const [productId, title] of Object.entries({
    "coral-garden": "Coral Garden", "blue-water": "Drop Off",
    "darkness-shroud": "Darkness Shroud", "open-ocean-hunt": "Pelagic Zone",
    "murky-water": "Murky Water", "stinging-fortress": "Stinging Fortress",
    disruption: "Disruption",
  })) {
    const product = productsById.get(productId);
    assert.equal(product.name, `${title} Deck`);
    assert.equal(product.shortName, title);
    assert.equal(product.imageAlt, `${title} expansion deck box`);
    assert.match(product.checkoutDescription, new RegExp(`^${title} 60-card`));
  }
});

test("the catalog remains partitioned into twelve launch products and seven prepared future products", () => {
  const launchProductIds = new Set(storeLaunchProductIds);
  const futureProductIds = storeProductDefinitions
    .map(({ id }) => id)
    .filter((id) => !launchProductIds.has(id))
    .sort();

  assert.deepEqual(
    [...storeLaunchProductIds].sort(),
    [...EXPECTED_LAUNCH_PRODUCT_IDS].sort()
  );
  assert.equal(launchProductIds.size, 12);
  assert.deepEqual(futureProductIds, EXPECTED_FUTURE_PRODUCT_IDS);

  for (const productId of EXPECTED_FUTURE_PRODUCT_IDS) {
    assert.equal(launchProductIds.has(productId), false);
  }
});

test("Starter Kits and expansion decks are preorders while Dive Packs and accessories retain standard production", () => {
  const productsById = new Map(
    storeProductDefinitions.map((product) => [product.id, product])
  );
  const preorderProductIds = storeProductDefinitions
    .filter((product) => product.preorder)
    .map((product) => product.id);

  assert.deepEqual(preorderProductIds, [
    "starter-kit",
    "coral-garden",
    "blue-water",
    "darkness-shroud",
    "open-ocean-hunt",
    "murky-water",
    "stinging-fortress",
    "disruption",
  ]);

  for (const productId of storeLaunchProductIds) {
    const product = productsById.get(productId);
    if (preorderProductIds.includes(productId)) {
      assert.equal(product.preorder, true);
      assert.equal(product.madeToOrder, undefined);
      assert.equal(product.buildDispatchMaxBusinessDays, undefined);
    } else {
      assert.equal(product.preorder, undefined);
      assert.equal(product.madeToOrder, true);
      assert.equal(product.buildDispatchMaxBusinessDays, 5);
    }
  }
});

test("all twelve public products use the corresponding product photo assets", () => {
  assert.deepEqual(
    Object.keys(EXPECTED_PRODUCT_PHOTOS).sort(),
    [...storeLaunchProductIds].sort()
  );
  const productsById = new Map(
    storeProductDefinitions.map((product) => [product.id, product])
  );

  for (const [productId, filename] of Object.entries(EXPECTED_PRODUCT_PHOTOS)) {
    const product = productsById.get(productId);
    const expectedImage = `/images/store/product-photos/${filename}`;
    assert.equal(product.image, expectedImage, productId);
    assert.ok(product.imageAlt?.length > 0, `${productId} needs image alt text`);
    assert.ok(
      existsSync(new URL(`../../../public${expectedImage}`, import.meta.url)),
      `${productId} product photo is missing from public/`
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

test("the three Dive Packs use their simple set names and packaging while preserving prices and policies", () => {
  const productsById = new Map(
    storeProductDefinitions.map((product) => [product.id, product])
  );
  const expectedDivePacks = Object.freeze({
    "oceanic-dive-pack": {
      name: "Oceanic Dive Pack",
      setName: "Oceanic",
      priceEnvKey: "STORE_PRICE_OCEANIC_DIVE_PACK_CENTS",
      image: "/images/store/product-photos/dive-pack-oceanic.png",
    },
    "reef-dive-pack": {
      name: "Reef Dive Pack",
      setName: "Reef",
      priceEnvKey: "STORE_PRICE_REEF_DIVE_PACK_CENTS",
      image: "/images/store/product-photos/dive-pack-reef.png",
    },
    "deep-dive-pack": {
      name: "Deep Dive Pack",
      setName: "Deep",
      priceEnvKey: "STORE_PRICE_DEEP_DIVE_PACK_CENTS",
      image: "/images/store/product-photos/dive-pack-deep.png",
    },
  });

  for (const [productId, expected] of Object.entries(expectedDivePacks)) {
    const product = productsById.get(productId);

    assert.equal(product?.name, expected.name);
    assert.equal(product?.shortName, expected.name);
    assert.equal(product?.productLabel, expected.name);
    assert.equal(product?.category, "dive-packs");
    assert.equal(product?.details, `1 ${expected.name}`);
    assert.match(product?.description ?? "", new RegExp(expected.name));
    assert.equal(
      product?.checkoutDescription,
      `One ${expected.name} featuring cards from the SeaRealm ${expected.setName} Set.`
    );
    assert.doesNotMatch(
      [product?.name, product?.shortName, product?.description, product?.checkoutDescription].join(" "),
      /Pelagic Rush|Coral Bloom|Abyssal Glow|Killer Whale/
    );
    assert.equal(product?.defaultPriceCents, 1000);
    assert.equal(product?.priceEnvKey, expected.priceEnvKey);
    assert.equal(product?.taxCodeEnvKey, "STRIPE_GAME_PRODUCT_TAX_CODE");
    assert.equal(product?.madeToOrder, true);
    assert.equal(product?.buildDispatchMaxBusinessDays, 5);
    assert.equal(product?.shippingWeightOunces, 8);
    assert.equal(product?.image, expected.image);
    const imageUrl = new URL(`../../../public${expected.image}`, import.meta.url);
    assert.equal(
      existsSync(imageUrl),
      true,
      `${productId} packaging photo is missing from public/`
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
    "1 Drop Off 60-card ready-to-play deck",
    "1 Conditions Deck (18 cards)",
    "7 dice: D4, D6, D8, D10, D12, D20, and D100",
    "15 Reef Point tokens",
  ]);
  assert.equal(productsById.get("starter-kit")?.defaultPriceCents, 4400);
  assert.equal(productsById.get("conditions-deck")?.cardsIncluded, 18);
  assert.equal(
    productsById.get("conditions-deck")?.details,
    "18 condition cards for SeaRealm gameplay"
  );
});
