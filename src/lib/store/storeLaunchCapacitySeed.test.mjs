import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  storeLaunchProductIds,
  storeProductDefinitions,
} from "../../data/store/products.js";

const seedSql = readFileSync(
  new URL("../../../supabase/store-launch-capacity.sql", import.meta.url),
  "utf8"
);

const EXPECTED_LAUNCH_SKUS_BY_PRODUCT_ID = Object.freeze([
  ["starter-kit", "SP-KIT-STARTER"],
  ["blue-water", "SP-DECK-BLUE-WATER"],
  ["disruption", "SP-DECK-DISRUPTION"],
  ["coral-garden", "SP-DECK-CORAL-GARDEN"],
  ["darkness-shroud", "SP-DECK-DARKNESS-SHROUD"],
  ["open-ocean-hunt", "SP-DECK-OPEN-OCEAN-HUNT"],
  ["murky-water", "SP-DECK-MURKY-WATER"],
  ["stinging-fortress", "SP-DECK-STINGING-FORTRESS"],
  ["accessory-set", "SP-ACC-SET"],
  ["conditions-deck", "SP-ACC-CONDITIONS-DECK"],
  ["dice-pack", "SP-ACC-DICE-PACK"],
  ["reef-point-tokens", "SP-ACC-REEF-POINTS"],
]);

function stripLineComments(sql) {
  return sql.replace(/^\s*--.*$/gm, "");
}

function parseSeedRows(sql) {
  return [...sql.matchAll(/\(\s*'([^']+)'\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g)]
    .map(([, sku, onHandQuantity, reservedQuantity]) => ({
      sku,
      onHandQuantity: Number(onHandQuantity),
      reservedQuantity: Number(reservedQuantity),
    }));
}

test("the launch-capacity seed matches the exact twelve canonical catalog SKUs", () => {
  const definitionsById = new Map(
    storeProductDefinitions.map((definition) => [definition.id, definition])
  );
  const expectedProductIds = EXPECTED_LAUNCH_SKUS_BY_PRODUCT_ID.map(
    ([productId]) => productId
  );
  const expectedSkus = EXPECTED_LAUNCH_SKUS_BY_PRODUCT_ID.map(([, sku]) => sku);
  const catalogSkus = EXPECTED_LAUNCH_SKUS_BY_PRODUCT_ID.map(
    ([productId]) => definitionsById.get(productId)?.sku
  );
  const seedRows = parseSeedRows(seedSql);

  assert.deepEqual(storeLaunchProductIds, expectedProductIds);
  assert.deepEqual(catalogSkus, expectedSkus);
  assert.deepEqual(seedRows.map(({ sku }) => sku), expectedSkus);
  assert.equal(new Set(seedRows.map(({ sku }) => sku)).size, 12);
  assert.equal(seedRows.length, 12);

  for (const row of seedRows) {
    assert.equal(row.onHandQuantity, 10, `${row.sku} must start with capacity 10`);
    assert.equal(row.reservedQuantity, 0, `${row.sku} must start unreserved`);
  }
});

test("the launch-capacity seed cannot replenish or overwrite an existing SKU", () => {
  const executableSql = stripLineComments(seedSql);

  assert.match(
    executableSql,
    /insert\s+into\s+public\.store_inventory\s*\(\s*sku\s*,\s*on_hand_quantity\s*,\s*reserved_quantity\s*\)/i
  );
  assert.match(
    executableSql,
    /on\s+conflict\s*\(\s*sku\s*\)\s+do\s+nothing\s*;/i
  );
  assert.doesNotMatch(executableSql, /\bdo\s+update\b/i);
  assert.doesNotMatch(executableSql, /\bupdate\s+public\.store_inventory\b/i);
  assert.equal(
    executableSql.match(/\binsert\s+into\s+public\.store_inventory\b/gi)?.length,
    1
  );
});

test("the seed records its checkout-disabled cutover and capacity limitations", () => {
  assert.match(seedSql, /after supabase\/store-orders\.sql/i);
  assert.match(seedSql, /checkout-disabled production cutover/i);
  assert.match(seedSql, /owner approved[^]*capacity of 10/i);
  assert.match(seedSql, /do not validate shared materials[^]*production labor[^]*dispatch window/i);
  assert.match(seedSql, /future merchandise SKUs are[^]*excluded/i);
});
