import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import { validateAdventureContent } from "./adventureContentValidation.mjs";
import {
  ADVENTURE_PACK_GUARANTEE,
  AdventurePackOpeningError,
  getAdventurePackPool,
  openAdventurePack,
} from "./adventurePacks.mjs";
import {
  createInitialAdventureSave,
  grantReward,
  validateAdventureSave,
} from "./adventureProgression.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});
const { cardsById } = jiti(path.join(projectRoot, "src/data/cards/index.js"));

const PACK_ID = "pack-pool-shellshore-discovery";
const MARINA_REWARD_ID = "reward-shellshore-marina-first-win";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function grantShellshorePacks(save, quantity = 1) {
  return grantReward(save, {
    grantId: `test-shellshore-pack-${quantity}`,
    packs: { [PACK_ID]: quantity },
  }).save;
}

test("every playable pack is versioned and every permanent card id resolves", () => {
  const pool = getAdventurePackPool(PACK_ID);
  const playablePools = ADVENTURE_CONTENT.packPools.filter((candidate) => candidate.status === "playable");
  const shellshore = ADVENTURE_CONTENT.towns.find((town) => town.id === "shellshore-village");
  const marina = ADVENTURE_CONTENT.encounters.find(
    (encounter) => encounter.id === "encounter-shellshore-marina",
  );
  const reward = ADVENTURE_CONTENT.rewards.find((candidate) => candidate.id === MARINA_REWARD_ID);

  assert.equal(shellshore.packPoolId, PACK_ID);
  assert.equal(pool.status, "playable");
  assert.equal(pool.version, 1);
  assert.equal(pool.cardsPerPack, 4);
  assert.equal(pool.progressionGuarantee, ADVENTURE_PACK_GUARANTEE);
  assert.ok(pool.cardIds.length >= pool.cardsPerPack);
  assert.equal(new Set(pool.cardIds).size, pool.cardIds.length);
  assert.deepEqual(pool.cardIds.filter((cardId) => !cardsById[cardId]), []);
  for (const playablePool of playablePools) {
    assert.ok(Number.isSafeInteger(playablePool.version) && playablePool.version > 0);
    assert.ok(playablePool.cardIds.length >= playablePool.cardsPerPack);
    assert.deepEqual(
      playablePool.cardIds.filter((cardId) => !cardsById[cardId]),
      [],
      `${playablePool.id} contains unresolved permanent card ids`,
    );
    assert.deepEqual(
      playablePool.cardIds.filter((cardId) => cardsById[cardId]?.kind === "condition"),
      [],
      `${playablePool.id} must not award condition cards that custom decks cannot use`,
    );
  }
  assert.equal(marina.rewardId, MARINA_REWARD_ID);
  assert.deepEqual(reward.packs, { [PACK_ID]: 1 });
});

test("content validation protects playable pack version, size, uniqueness, and guarantee metadata", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  const pool = invalid.packPools.find((candidate) => candidate.id === PACK_ID);
  pool.version = 0;
  pool.cardsPerPack = pool.cardIds.length + 1;
  pool.progressionGuarantee = "sometimes-new";
  pool.cardIds[1] = pool.cardIds[0];

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /version must be a positive safe integer/.test(error)));
  assert.ok(result.errors.some((error) => /progressionGuarantee must be at-least-one-unowned/.test(error)));
  assert.ok(result.errors.some((error) => /duplicate card id/.test(error)));
  assert.ok(result.errors.some((error) => /at least cardsPerPack unique cards/.test(error)));
});

test("opening a pack is deterministic, nonmutating, and adds four unique cards atomically", () => {
  const initial = createInitialAdventureSave("profile-pack-test");
  initial.inventory.cards.nudibranch = 2;
  initial.inventory.cards["sea-urchin"] = 1;
  const save = grantShellshorePacks(initial);
  const before = clone(save);
  let randomCalls = 0;
  const random = () => {
    randomCalls += 1;
    return 0;
  };

  const opened = openAdventurePack(save, PACK_ID, { random });

  assert.deepEqual(opened.cards, [
    "cleaner-shrimp",
    "nudibranch",
    "sea-urchin",
    "emerald-crab",
  ]);
  assert.equal(opened.guaranteedNewCardId, "cleaner-shrimp");
  assert.equal(opened.packId, PACK_ID);
  assert.equal(opened.poolVersion, 1);
  assert.equal(randomCalls, 4);
  assert.equal(new Set(opened.cards).size, 4);
  assert.equal(opened.save.inventory.cards.nudibranch, 3);
  assert.equal(opened.save.inventory.cards["sea-urchin"], 2);
  assert.equal(opened.save.inventory.cards["cleaner-shrimp"], 1);
  assert.equal(opened.save.inventory.cards["emerald-crab"], 1);
  assert.equal(opened.save.inventory.unopenedPacks[PACK_ID], undefined);
  assert.equal(validateAdventureSave(opened.save).valid, true);
  assert.deepEqual(save, before);

  const replayed = openAdventurePack(save, PACK_ID, { random: () => 0 });
  assert.deepEqual(replayed, opened);
});

test("the new-card guarantee becomes optional only after the whole pool is owned", () => {
  const pool = getAdventurePackPool(PACK_ID);
  const initial = createInitialAdventureSave("profile-owned-pool");
  initial.inventory.cards = Object.fromEntries(pool.cardIds.map((cardId) => [cardId, 1]));
  const save = grantShellshorePacks(initial);

  const opened = openAdventurePack(save, PACK_ID, { random: () => 0 });

  assert.equal(opened.guaranteedNewCardId, null);
  assert.deepEqual(opened.cards, pool.cardIds.slice(0, pool.cardsPerPack));
  assert.equal(new Set(opened.cards).size, pool.cardsPerPack);
});

test("opening rejects unavailable packs without changing the save", () => {
  const noPackSave = createInitialAdventureSave("profile-no-pack");
  const noPackBefore = clone(noPackSave);
  assert.throws(
    () => openAdventurePack(noPackSave, PACK_ID, { random: () => 0 }),
    (error) => error instanceof AdventurePackOpeningError && error.code === "pack-unavailable",
  );
  assert.deepEqual(noPackSave, noPackBefore);
});

test("the playable Sunpatch Coral Pack contains the intended twelve-card reef pool", () => {
  const pool = getAdventurePackPool("pack-pool-sunpatch-coral");

  assert.equal(pool.status, "playable");
  assert.equal(pool.cardsPerPack, 4);
  assert.deepEqual(pool.cardIds, [
    "boulder-star-coral-base",
    "elkhorn-coral-base",
    "clubfinger-coral-base",
    "lettuce-coral-base",
    "mustard-hill-coral-base",
    "coral-reef",
    "coral-gardener",
    "coral-heal",
    "coral-cement",
    "cleaner-shrimp",
    "emerald-crab",
    "spectacled-parrotfish",
  ]);
  assert.deepEqual(pool.cardIds.filter((cardId) => !cardsById[cardId]), []);
});

test("the playable Brackwater Discovery Pack contains twelve permanent estuary-strategy cards", () => {
  const pool = getAdventurePackPool("pack-pool-brackwater-murky");

  assert.equal(pool.status, "playable");
  assert.equal(pool.cardsPerPack, 4);
  assert.deepEqual(pool.cardIds, [
    "leather-starfish",
    "oysters",
    "blue-crab",
    "white-grunt",
    "bull-shark",
    "octopus",
    "arrow-crab",
    "emerald-crab",
    "robotic-survey",
    "scientist-jes",
    "recovery",
    "remote-search",
  ]);
  assert.deepEqual(pool.cardIds.filter((cardId) => !cardsById[cardId]), []);
});

test("the playable Current Commons Blue Water Pack contains twelve permanent open-ocean cards", () => {
  const pool = getAdventurePackPool("pack-pool-current-bluewater");

  assert.equal(pool.status, "playable");
  assert.equal(pool.cardsPerPack, 4);
  assert.deepEqual(pool.cardIds, [
    "blue-sea-dragon",
    "krill-bloom-base",
    "anchovy-ball-base",
    "herring-ball-base",
    "bluefin-tuna-juvenile",
    "frigate-tuna",
    "flying-fish",
    "market-squid",
    "mahi-mahi",
    "wahoo",
    "sailfish",
    "open-ocean",
  ]);
  assert.deepEqual(pool.cardIds.filter((cardId) => !cardsById[cardId]), []);
});

test("the playable Kelpwatch Food-Web Pack contains twelve permanent food-web cards", () => {
  const packId = "pack-pool-kelpwatch";
  const pool = getAdventurePackPool(packId);

  assert.deepEqual({
    name: pool.name,
    version: pool.version,
    status: pool.status,
    purchaseMode: pool.purchaseMode,
    cardsPerPack: pool.cardsPerPack,
    progressionGuarantee: pool.progressionGuarantee,
  }, {
    name: "Kelpwatch Food-Web Pack",
    version: 1,
    status: "playable",
    purchaseMode: "earned-only",
    cardsPerPack: 4,
    progressionGuarantee: ADVENTURE_PACK_GUARANTEE,
  });
  assert.deepEqual(pool.cardIds, [
    "sea-urchin",
    "anemone",
    "clownfish",
    "giant-triton",
    "crown-of-thorns",
    "cleaner-shrimp",
    "cleaner-wrasse",
    "octopus",
    "fairy-parrotfish",
    "goliath-grouper",
    "reef-shark",
    "marine-sanctuary",
  ]);
  assert.equal(new Set(pool.cardIds).size, 12);
  assert.deepEqual(pool.cardIds.filter((cardId) => !cardsById[cardId]), []);
  assert.deepEqual(
    pool.cardIds.filter((cardId) => cardsById[cardId].kind === "condition"),
    [],
  );
  assert.equal(pool.cardIds.filter((cardId) => cardsById[cardId].kind === "creature").length, 11);
  assert.equal(pool.cardIds.filter((cardId) => cardsById[cardId].kind === "habitat").length, 1);

  const awarded = grantReward(createInitialAdventureSave("kelpwatch-pack"), {
    grantId: "test-kelpwatch-pack",
    packs: { [packId]: 1 },
  }).save;
  const opened = openAdventurePack(awarded, packId, { random: () => 0 });
  assert.equal(opened.cards.length, 4);
  assert.equal(new Set(opened.cards).size, 4);
  assert.ok(opened.guaranteedNewCardId);
  assert.equal(opened.save.inventory.unopenedPacks[packId], undefined);
  assert.equal(validateAdventureSave(opened.save).valid, true);
});

test("an invalid injected random value fails atomically", () => {
  const save = grantShellshorePacks(createInitialAdventureSave("profile-bad-random"));
  const before = clone(save);

  assert.throws(
    () => openAdventurePack(save, PACK_ID, { random: () => 1 }),
    (error) => error instanceof AdventurePackOpeningError && error.code === "invalid-random-value",
  );
  assert.deepEqual(save, before);
});
