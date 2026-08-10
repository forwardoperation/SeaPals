import assert from "node:assert/strict";
import test from "node:test";

import {
  ELVERSON_BAITS,
  ELVERSON_BAIT_CREDIT_ITEM_ID,
  ELVERSON_BAIT_SHOP_WELCOME_CREDITS,
  consumeElversonBait,
  getElversonBaitShopState,
  grantElversonBaitDeliveryCredits,
  purchaseElversonBait,
  welcomeToElversonBaitShop,
} from "./adventureBait.mjs";
import { ELVERSON_REEF_CATCHES } from "./adventureFishing.mjs";
import { createInitialAdventureSave, validateAdventureSave } from "./adventureProgression.mjs";

test("Henderson grants one welcome purse and exposes all three bait families", () => {
  const initial = createInitialAdventureSave("bait-shop-profile");
  const before = structuredClone(initial);
  const welcomed = welcomeToElversonBaitShop(initial);

  assert.equal(welcomed.applied, true);
  assert.equal(welcomed.creditsGranted, ELVERSON_BAIT_SHOP_WELCOME_CREDITS);
  assert.equal(welcomed.shop.creditBalance, ELVERSON_BAIT_SHOP_WELCOME_CREDITS);
  assert.deepEqual(welcomed.shop.baits.map(({ id, quantity }) => [id, quantity]), [
    ["bait-kelp-crumble", 0],
    ["bait-plankton-puff", 0],
    ["bait-shellfish-mix", 0],
  ]);
  assert.deepEqual(initial, before, "welcoming must not mutate the source save");

  const repeated = welcomeToElversonBaitShop(welcomed.save);
  assert.equal(repeated.applied, false);
  assert.equal(repeated.creditsGranted, 0);
  assert.deepEqual(repeated.save, welcomed.save);
  assert.equal(validateAdventureSave(repeated.save).valid, true);
});

test("every bait targets known species and the catalog covers the full Elverson catch list", () => {
  const knownSpeciesIds = new Set(ELVERSON_REEF_CATCHES.map(({ id }) => id));
  const coveredSpeciesIds = new Set();

  for (const bait of ELVERSON_BAITS) {
    assert.equal(Object.isFrozen(bait), true);
    assert.equal(Object.isFrozen(bait.speciesIds), true);
    assert.ok(bait.speciesIds.length >= 3);
    assert.ok(bait.attractionRadius >= Math.hypot(12, 8));
    assert.ok(bait.hitboxMultiplier > 1);
    for (const speciesId of bait.speciesIds) {
      assert.equal(knownSpeciesIds.has(speciesId), true, `${bait.id} targets an unknown species`);
      coveredSpeciesIds.add(speciesId);
    }
  }

  assert.deepEqual([...coveredSpeciesIds].sort(), [...knownSpeciesIds].sort());
});

test("bait purchases spend Reef Credits and bait use consumes exactly one pouch", () => {
  const welcomed = welcomeToElversonBaitShop(createInitialAdventureSave("bait-purchase-profile"));
  const bait = ELVERSON_BAITS[0];
  const purchased = purchaseElversonBait(welcomed.save, bait.id);

  assert.equal(purchased.remainingCredits, ELVERSON_BAIT_SHOP_WELCOME_CREDITS - bait.price);
  assert.equal(purchased.quantity, 1);
  assert.equal(purchased.save.inventory.storyItems[bait.id], 1);
  assert.equal(
    purchased.save.inventory.storyItems[ELVERSON_BAIT_CREDIT_ITEM_ID],
    ELVERSON_BAIT_SHOP_WELCOME_CREDITS - bait.price,
  );

  const used = consumeElversonBait(purchased.save, bait.id);
  assert.equal(used.remaining, 0);
  assert.equal(used.save.inventory.storyItems[bait.id], undefined);
  assert.throws(() => consumeElversonBait(used.save, bait.id), /no Kelp Crumble left/i);
  assert.throws(() => purchaseElversonBait(initialWithoutCredits(), bait.id), /costs 3 Reef Credits/i);
  assert.throws(() => purchaseElversonBait(welcomed.save, "bait-not-real"), /unknown Elverson bait/i);
});

function initialWithoutCredits() {
  return createInitialAdventureSave("no-bait-credits-profile");
}

test("aquarium deliveries award rarity-weighted Reef Credits without changing the delivery input", () => {
  const initial = createInitialAdventureSave("bait-delivery-profile");
  const before = structuredClone(initial);
  const reward = grantElversonBaitDeliveryCredits(initial, [
    { creature: { rarity: "common" }, quantity: 2 },
    { creature: { rarity: "rare" }, quantity: 1 },
  ]);

  assert.equal(reward.applied, true);
  assert.equal(reward.creditsGranted, 9);
  assert.equal(getElversonBaitShopState(reward.save).creditBalance, 9);
  assert.deepEqual(initial, before);
  assert.equal(validateAdventureSave(reward.save).valid, true);

  const empty = grantElversonBaitDeliveryCredits(reward.save, []);
  assert.equal(empty.applied, false);
  assert.deepEqual(empty.save, reward.save);
});
