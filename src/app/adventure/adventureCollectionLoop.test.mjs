import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  normalizeStarterDeckManifest,
  reconcileStarterCollection,
} from "./adventureCollection.mjs";
import { commitStarterSelection } from "./adventureOnboarding.mjs";
import { openAdventurePack } from "./adventurePacks.mjs";
import {
  completeAdventureEncounter,
  createNewAdventureSession,
} from "./adventureSession.mjs";
import { createAdventureStorageAdapter } from "./adventureStorage.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});

const { prebuiltDecks } = jiti(
  path.join(projectRoot, "src/data/decks/prebuiltDecks.js"),
);

const PROFILE_ID = "profile-1";
const STARTER_DECK_ID = "coral-garden";
const MARINA_ENCOUNTER_ID = "encounter-shellshore-marina";
const MARINA_REWARD_ID = "reward-shellshore-marina-first-win";
const SHELLSHORE_PACK_ID = "pack-pool-shellshore-discovery";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function sumQuantities(record) {
  return Object.values(record).reduce((total, quantity) => total + quantity, 0);
}

test("starter collection, Marina reward, pack opening, and reward idempotency survive storage", () => {
  const starterManifest = prebuiltDecks.find((deck) => deck.id === STARTER_DECK_ID);
  assert.ok(starterManifest, `Expected prebuilt starter ${STARTER_DECK_ID}.`);
  const normalizedStarter = normalizeStarterDeckManifest(starterManifest);

  const newProfile = createNewAdventureSession(PROFILE_ID);
  const committed = commitStarterSelection(newProfile, STARTER_DECK_ID).save;
  const initialized = reconcileStarterCollection(committed, starterManifest).save;

  assert.deepEqual(initialized.savedDecks[STARTER_DECK_ID], {
    name: normalizedStarter.name,
    cards: normalizedStarter.cards,
  });
  assert.equal(sumQuantities(initialized.inventory.cards), 60);

  const firstVictory = completeAdventureEncounter(initialized, {
    encounterId: MARINA_ENCOUNTER_ID,
    opponentId: "marina",
  });
  assert.equal(firstVictory.inventory.unopenedPacks[SHELLSHORE_PACK_ID], 1);
  assert.deepEqual(firstVictory.rewardLedger, [MARINA_REWARD_ID]);

  const backend = new MemoryStorage();
  const storage = createAdventureStorageAdapter({
    backend,
    now: () => new Date("2026-07-18T12:00:00.000Z"),
  });
  const victoryCheckpoint = storage.startNewProfile(PROFILE_ID, {
    saveValue: firstVictory,
  });
  assert.equal(victoryCheckpoint.ok, true);
  const afterVictoryReload = storage.loadProfile(PROFILE_ID);
  assert.equal(afterVictoryReload.ok, true);
  assert.equal(afterVictoryReload.save.inventory.unopenedPacks[SHELLSHORE_PACK_ID], 1);

  const quantitiesBeforeOpening = { ...afterVictoryReload.save.inventory.cards };
  const opening = openAdventurePack(afterVictoryReload.save, SHELLSHORE_PACK_ID, {
    random: () => 0,
  });
  assert.equal(opening.cards.length, 4);
  assert.equal(new Set(opening.cards).size, 4);
  assert.equal(opening.save.inventory.unopenedPacks[SHELLSHORE_PACK_ID] ?? 0, 0);
  assert.equal(sumQuantities(opening.save.inventory.cards), 64);
  for (const cardId of opening.cards) {
    assert.equal(
      opening.save.inventory.cards[cardId],
      (quantitiesBeforeOpening[cardId] ?? 0) + 1,
      `${cardId} should increment exactly once`,
    );
  }

  const openingCheckpoint = storage.autosave(
    PROFILE_ID,
    opening.save,
    `pack-opened:${SHELLSHORE_PACK_ID}:v${opening.poolVersion}`,
  );
  assert.equal(openingCheckpoint.ok, true);
  const afterOpeningReload = storage.loadProfile(PROFILE_ID);
  assert.equal(afterOpeningReload.ok, true);
  assert.equal(afterOpeningReload.save.inventory.unopenedPacks[SHELLSHORE_PACK_ID] ?? 0, 0);
  assert.equal(sumQuantities(afterOpeningReload.save.inventory.cards), 64);

  const duplicateVictory = completeAdventureEncounter(afterOpeningReload.save, {
    encounterId: MARINA_ENCOUNTER_ID,
    opponentId: "marina",
  });
  assert.equal(duplicateVictory.inventory.unopenedPacks[SHELLSHORE_PACK_ID] ?? 0, 0);
  assert.deepEqual(duplicateVictory.inventory.cards, opening.save.inventory.cards);
  assert.deepEqual(duplicateVictory.rewardLedger, [MARINA_REWARD_ID]);

  const persisted = storage.autosave(PROFILE_ID, duplicateVictory, "duplicate-marina-result");
  assert.equal(persisted.ok, true);

  const reloaded = storage.loadProfile(PROFILE_ID);
  assert.equal(reloaded.ok, true);
  assert.deepEqual(reloaded.save.savedDecks[STARTER_DECK_ID], {
    name: normalizedStarter.name,
    cards: normalizedStarter.cards,
  });
  assert.equal(reloaded.save.inventory.unopenedPacks[SHELLSHORE_PACK_ID] ?? 0, 0);
  assert.equal(sumQuantities(reloaded.save.inventory.cards), 64);
  for (const cardId of opening.cards) {
    assert.equal(
      reloaded.save.inventory.cards[cardId],
      (quantitiesBeforeOpening[cardId] ?? 0) + 1,
      `${cardId} should retain its single pack increment after reload`,
    );
  }
  assert.deepEqual(reloaded.save.rewardLedger, [MARINA_REWARD_ID]);
});
