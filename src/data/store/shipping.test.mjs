import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveStoreShippingRateTier,
  STORE_BASE_SHIPPING_MAX_WEIGHT_OUNCES,
  STORE_MAX_SHIPPING_WEIGHT_OUNCES,
  storeShippingOptionDefinitions,
} from "./shipping.js";

test("the confirmed shipping definitions cover the Dive Pack discount and one through eight pounds", () => {
  const definitionsById = new Map(
    storeShippingOptionDefinitions.map((option) => [option.id, option])
  );

  assert.equal(STORE_BASE_SHIPPING_MAX_WEIGHT_OUNCES, 16);
  assert.equal(STORE_MAX_SHIPPING_WEIGHT_OUNCES, 128);
  assert.deepEqual(
    definitionsById.get("standard").rateTiers.map((tier) => [
      tier.id,
      tier.maxWeightOunces,
      tier.defaultAmountCents,
      tier.amountEnvKey,
    ]),
    [
      [
        "dive-pack-base",
        16,
        500,
        "STORE_DIVE_PACK_ONLY_STANDARD_SHIPPING_CENTS",
      ],
      ["base", 16, 1000, "STORE_STANDARD_SHIPPING_CENTS"],
      ["large", 128, 2000, "STORE_LARGE_STANDARD_SHIPPING_CENTS"],
    ]
  );
  assert.deepEqual(
    definitionsById.get("priority").rateTiers.map((tier) => [
      tier.id,
      tier.maxWeightOunces,
      tier.defaultAmountCents,
      tier.amountEnvKey,
    ]),
    [
      [
        "dive-pack-base",
        16,
        1000,
        "STORE_DIVE_PACK_ONLY_PRIORITY_SHIPPING_CENTS",
      ],
      ["base", 16, 1500, "STORE_PRIORITY_SHIPPING_CENTS"],
      ["large", 128, 3500, "STORE_LARGE_PRIORITY_SHIPPING_CENTS"],
    ]
  );
});

test("Dive Pack-only base rates do not discount mixed or heavier carts", () => {
  const configuredStandard = {
    id: "standard",
    rateTiers: [
      { id: "dive-pack-base", amountCents: 500 },
      { id: "base", amountCents: 1000 },
      { id: "large", amountCents: 2000 },
    ],
  };

  assert.deepEqual(
    resolveStoreShippingRateTier(configuredStandard, 16, {
      productCategories: ["dive-packs", "dive-packs"],
    }),
    {
      id: "dive-pack-base",
      maxWeightOunces: 16,
      amountCents: 500,
    }
  );
  assert.deepEqual(
    resolveStoreShippingRateTier(configuredStandard, 16, {
      productCategories: ["dive-packs", "expansion-decks"],
    }),
    {
      id: "base",
      maxWeightOunces: 16,
      amountCents: 1000,
    }
  );
  assert.deepEqual(
    resolveStoreShippingRateTier(configuredStandard, 24, {
      productCategories: ["dive-packs", "dive-packs", "dive-packs"],
    }),
    {
      id: "large",
      maxWeightOunces: 128,
      amountCents: 2000,
    }
  );
});

test("rate resolution uses configured cents without allowing configured thresholds", () => {
  const configuredStandard = {
    id: "standard",
    amountCents: 1100,
    rateTiers: [
      { id: "base", maxWeightOunces: 999, amountCents: 1200 },
      { id: "large", maxWeightOunces: 999, amountCents: 2300 },
    ],
  };

  assert.deepEqual(resolveStoreShippingRateTier(configuredStandard, 16), {
    id: "base",
    maxWeightOunces: 16,
    amountCents: 1200,
  });
  assert.deepEqual(resolveStoreShippingRateTier(configuredStandard, 17), {
    id: "large",
    maxWeightOunces: 128,
    amountCents: 2300,
  });
  assert.equal(resolveStoreShippingRateTier(configuredStandard, 129), null);
});

test("scheduled pickup always resolves to zero dollars", () => {
  assert.deepEqual(
    resolveStoreShippingRateTier(
      {
        id: "pickup-elverson-pa",
        amountCents: 9999,
        rateTiers: [{ id: "large", amountCents: 9999 }],
      },
      128
    ),
    {
      id: "pickup",
      maxWeightOunces: null,
      amountCents: 0,
    }
  );
});
