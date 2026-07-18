import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  STARTER_DECK_CARD_COUNT,
  StarterCollectionReconciliationError,
  StarterDeckManifestValidationError,
  normalizeStarterDeckManifest,
  reconcileStarterCollection,
} from "./adventureCollection.mjs";
import { commitStarterSelection, STARTER_DECK_IDS } from "./adventureOnboarding.mjs";
import { createInitialAdventureSave, normalizeAdventureSave } from "./adventureProgression.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});

const { prebuiltDecks } = jiti(path.join(projectRoot, "src/data/tournaments/prebuiltDecks.js"));

function starterManifest(starterDeckId) {
  const deck = prebuiltDecks.find((candidate) => candidate.id === starterDeckId);
  assert.ok(deck, `Expected the ${starterDeckId} prebuilt deck to exist.`);
  return deck;
}

function selectedStarterSave(starterDeckId) {
  return commitStarterSelection(
    createInitialAdventureSave(`profile-${starterDeckId}`),
    starterDeckId,
  ).save;
}

function sumQuantities(record) {
  return Object.values(record).reduce((total, quantity) => total + quantity, 0);
}

test("every selectable starter initializes exact 60-card ownership and an active saved deck", () => {
  for (const starterDeckId of STARTER_DECK_IDS) {
    const initial = selectedStarterSave(starterDeckId);
    const snapshot = structuredClone(initial);
    const deck = normalizeStarterDeckManifest(starterManifest(starterDeckId));

    const result = reconcileStarterCollection(initial, starterManifest(starterDeckId));

    assert.equal(result.applied, true);
    assert.equal(result.starterDeckId, starterDeckId);
    assert.deepEqual(result.save.inventory.cards, deck.cards);
    assert.equal(sumQuantities(result.save.inventory.cards), STARTER_DECK_CARD_COUNT);
    assert.deepEqual(result.save.savedDecks[starterDeckId], {
      name: deck.name,
      cards: deck.cards,
    });
    assert.equal(sumQuantities(result.save.savedDecks[starterDeckId].cards), STARTER_DECK_CARD_COUNT);
    assert.equal(result.save.player.activeDeckId, starterDeckId);
    assert.deepEqual(initial, snapshot, "starter collection initialization must not mutate its input save");
  }
});

test("legacy Phase 2 saves are repaired without reducing earned cards or disturbing unrelated state", () => {
  const deckManifest = starterManifest("coral-garden");
  const deck = normalizeStarterDeckManifest(deckManifest);
  const [repairCardId, excessCardId] = Object.keys(deck.cards).filter((cardId) => deck.cards[cardId] > 1);
  assert.ok(repairCardId);
  assert.ok(excessCardId);

  const legacy = selectedStarterSave("coral-garden");
  legacy.player.activeDeckId = "expedition-deck";
  legacy.world.sceneId = "professor-lab";
  legacy.world.position = { x: 4.5, y: 8.25 };
  legacy.progression.completedEncounterIds = ["encounter-shellshore-marina"];
  legacy.inventory.cards = {
    [repairCardId]: 1,
    [excessCardId]: deck.cards[excessCardId] + 5,
    "pack-earned-card": 3,
  };
  legacy.inventory.unopenedPacks = { "pack-shellshore": 2 };
  legacy.inventory.storyItems = { "professor-field-note": 1 };
  legacy.inventory.boatItems = { "reef-safe-anchor": 1 };
  legacy.savedDecks = {
    "coral-garden": { name: "Broken starter", cards: { "white-grunt": 1 } },
    "expedition-deck": { name: "Expedition Deck", cards: { "pack-earned-card": 3 } },
  };
  legacy.fieldNotes.entryIds = ["field-note-shellshore-harbor"];
  legacy.settings.highContrast = true;
  legacy.playtimeSeconds = 987;
  legacy.rewardLedger = ["reward-shellshore-tutorial"];
  const normalizedLegacy = normalizeAdventureSave(legacy);
  const untouchedBefore = {
    world: normalizedLegacy.world,
    progression: normalizedLegacy.progression,
    unopenedPacks: normalizedLegacy.inventory.unopenedPacks,
    storyItems: normalizedLegacy.inventory.storyItems,
    boatItems: normalizedLegacy.inventory.boatItems,
    otherDeck: normalizedLegacy.savedDecks["expedition-deck"],
    tutorial: normalizedLegacy.tutorial,
    fieldNotes: normalizedLegacy.fieldNotes,
    settings: normalizedLegacy.settings,
    playtimeSeconds: normalizedLegacy.playtimeSeconds,
    rewardLedger: normalizedLegacy.rewardLedger,
  };

  const result = reconcileStarterCollection(normalizedLegacy, deckManifest);

  assert.equal(result.save.inventory.cards[repairCardId], deck.cards[repairCardId]);
  assert.equal(result.save.inventory.cards[excessCardId], deck.cards[excessCardId] + 5);
  assert.equal(result.save.inventory.cards["pack-earned-card"], 3);
  assert.equal(result.grantedCards[repairCardId], deck.cards[repairCardId] - 1);
  assert.deepEqual(result.save.savedDecks["coral-garden"], {
    name: deck.name,
    cards: deck.cards,
  });
  assert.equal(
    result.save.player.activeDeckId,
    "expedition-deck",
    "repair must preserve a later saved active-deck choice",
  );
  assert.deepEqual({
    world: result.save.world,
    progression: result.save.progression,
    unopenedPacks: result.save.inventory.unopenedPacks,
    storyItems: result.save.inventory.storyItems,
    boatItems: result.save.inventory.boatItems,
    otherDeck: result.save.savedDecks["expedition-deck"],
    tutorial: result.save.tutorial,
    fieldNotes: result.save.fieldNotes,
    settings: result.save.settings,
    playtimeSeconds: result.save.playtimeSeconds,
    rewardLedger: result.save.rewardLedger,
  }, untouchedBefore);
});

test("starter collection reconciliation is idempotent", () => {
  const manifest = starterManifest("murky-water");
  const first = reconcileStarterCollection(selectedStarterSave("murky-water"), manifest);
  const second = reconcileStarterCollection(first.save, manifest);

  assert.equal(first.applied, true);
  assert.equal(second.applied, false);
  assert.deepEqual(second.grantedCards, {});
  assert.deepEqual(second.save, first.save);
});

test("reconciliation repairs an active deck id that has no saved deck", () => {
  const save = selectedStarterSave("blue-water");
  save.player.activeDeckId = "missing-custom-deck";

  const result = reconcileStarterCollection(save, starterManifest("blue-water"));

  assert.equal(result.save.player.activeDeckId, "blue-water");
  assert.ok(result.save.savedDecks["blue-water"]);
});

test("reconciliation requires the committed starter to match the manifest", () => {
  assert.throws(
    () => reconcileStarterCollection(
      createInitialAdventureSave("profile-no-starter"),
      starterManifest("blue-water"),
    ),
    (error) => error instanceof StarterCollectionReconciliationError && /must be selected/.test(error.message),
  );

  assert.throws(
    () => reconcileStarterCollection(
      selectedStarterSave("coral-garden"),
      starterManifest("blue-water"),
    ),
    (error) => error instanceof StarterCollectionReconciliationError && /does not match/.test(error.message),
  );
});

test("starter manifest validation rejects ambiguous or non-60-card decks", () => {
  const valid = starterManifest("blue-water");

  const invalidCases = [
    { value: null, message: /must be a plain object/ },
    { value: { ...valid, id: "" }, message: /starterDeck\.id must not be empty/ },
    { value: { ...valid, name: "  " }, message: /starterDeck\.name must not be empty/ },
    { value: { ...valid, cards: {} }, message: /starterDeck\.cards must be an array/ },
    {
      value: { ...valid, cards: [...valid.cards, { ...valid.cards[0] }] },
      message: /duplicates card identifier/,
    },
    {
      value: { ...valid, cards: valid.cards.map((card, index) => (
        index === 0 ? { ...card, quantity: 0 } : card
      )) },
      message: /quantity must be a positive safe integer/,
    },
    {
      value: { ...valid, cards: valid.cards.slice(1) },
      message: /must contain exactly 60 cards/,
    },
  ];

  for (const { value, message } of invalidCases) {
    assert.throws(
      () => normalizeStarterDeckManifest(value),
      (error) => error instanceof StarterDeckManifestValidationError && message.test(error.message),
    );
  }
});
