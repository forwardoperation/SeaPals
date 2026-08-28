import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  AdventureDeckLegalityError,
  AdventureDeckOperationError,
  AdventureDeckValidationError,
  createActiveDuelDeckSnapshot,
  createDuelDeckSnapshot,
  createSavedDeck,
  createUniqueAdventureDeckId,
  deleteSavedDeck,
  duplicateSavedDeck,
  fingerprintDeckCards,
  getDuelDeckSnapshotIdentity,
  getSavedDeck,
  normalizeAdventureDeckCards,
  normalizeAdventureDeckId,
  normalizeAdventureDeckName,
  renameSavedDeck,
  replaceSavedDeckDraft,
  setActiveSavedDeck,
  slugifyAdventureDeckId,
  validateAdventureDeck,
  validateSavedDeck,
} from "./adventureDecks.mjs";
import { reconcileStarterCollection } from "./adventureCollection.mjs";
import { commitStarterSelection, STARTER_DECK_IDS } from "./adventureOnboarding.mjs";
import { createInitialAdventureSave } from "./adventureProgression.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});
const { cardsById } = jiti(path.join(projectRoot, "src/data/cards/index.js"));
const { prebuiltDecks } = jiti(path.join(projectRoot, "src/data/decks/prebuiltDecks.js"));

function syntheticCatalog() {
  return Object.fromEntries(Array.from({ length: 15 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    const id = `card-${number}`;
    return [id, {
      id,
      name: `Card ${number}`,
      kind: index === 0 ? "coral" : "creature",
      stage: index === 0 ? 0 : undefined,
      victoryPoints: index === 0 ? 0 : 1,
    }];
  }));
}

function legalCards() {
  return Object.fromEntries(Object.keys(syntheticCatalog()).map((cardId) => [cardId, 4]));
}

function saveWithOwnedCards() {
  const save = createInitialAdventureSave("deck-domain-profile");
  save.inventory.cards = legalCards();
  return save;
}

function starterManifest(starterDeckId) {
  const manifest = prebuiltDecks.find((deck) => deck.id === starterDeckId);
  assert.ok(manifest);
  return manifest;
}

test("deck id, name, and quantity records have stable canonical normalization", () => {
  assert.equal(normalizeAdventureDeckId("  reef-team  "), "reef-team");
  assert.equal(normalizeAdventureDeckName("  My\n  Reef   Team "), "My Reef Team");
  assert.equal(slugifyAdventureDeckId("  Élise's Reef / Team!  "), "elise-s-reef-team");
  assert.deepEqual(normalizeAdventureDeckCards({ "z-card": 1, "a-card": 2 }), {
    "a-card": 2,
    "z-card": 1,
  });

  assert.throws(
    () => normalizeAdventureDeckId("Not a saved id"),
    (error) => error instanceof AdventureDeckValidationError && /only lowercase/.test(error.message),
  );
  assert.throws(
    () => normalizeAdventureDeckCards({ card: 0 }),
    (error) => error instanceof AdventureDeckValidationError && /positive safe integer/.test(error.message),
  );
});

test("create, read, rename, duplicate, and atomic draft replacement preserve their inputs", () => {
  const initial = saveWithOwnedCards();
  const initialSnapshot = structuredClone(initial);

  const created = createSavedDeck(initial, {
    name: "  Reef Scouts ",
    cards: { "card-01": 1 },
  }, { cardCatalog: syntheticCatalog() });
  assert.deepEqual(initial, initialSnapshot);
  assert.equal(created.deckId, "reef-scouts");
  assert.deepEqual(created.deck, { name: "Reef Scouts", cards: { "card-01": 1 } });
  assert.deepEqual(getSavedDeck(created.save, created.deckId), {
    id: "reef-scouts",
    name: "Reef Scouts",
    cards: { "card-01": 1 },
  });

  const renamed = renameSavedDeck(created.save, created.deckId, "  Current Riders ");
  assert.equal(renamed.save.savedDecks[created.deckId].name, "Current Riders");
  assert.equal(created.save.savedDecks[created.deckId].name, "Reef Scouts");

  const replaced = replaceSavedDeckDraft(renamed.save, created.deckId, {
    name: "Current Riders Draft",
    cards: { "card-02": 2, "card-01": 4 },
  }, syntheticCatalog());
  assert.deepEqual(replaced.deck, {
    name: "Current Riders Draft",
    cards: { "card-01": 4, "card-02": 2 },
  });
  assert.deepEqual(renamed.save.savedDecks[created.deckId].cards, { "card-01": 1 });

  const duplicated = duplicateSavedDeck(replaced.save, created.deckId, {
    cardCatalog: syntheticCatalog(),
  });
  assert.equal(duplicated.deckId, "current-riders-draft-copy");
  assert.equal(duplicated.deck.name, "Current Riders Draft Copy");
  assert.deepEqual(duplicated.deck.cards, replaced.deck.cards);
  assert.notEqual(duplicated.deck.cards, replaced.deck.cards);
  assert.deepEqual(replaced.save.savedDecks[created.deckId], replaced.deck);

  assert.equal(createUniqueAdventureDeckId(duplicated.save, "Current Riders Draft Copy"), "current-riders-draft-copy-2");
});

test("draft writes enforce ownership and the four-copy limit while allowing incomplete decks", () => {
  const save = saveWithOwnedCards();
  save.inventory.cards["card-01"] = 2;

  const incomplete = createSavedDeck(save, {
    id: "incomplete",
    name: "Incomplete but saved",
    cards: { "card-01": 2 },
  }, { cardCatalog: syntheticCatalog() });
  assert.equal(incomplete.save.savedDecks.incomplete.cards["card-01"], 2);

  for (const cards of [{ "card-01": 3 }, { "card-02": 5 }, { "not-owned": 1 }]) {
    const before = structuredClone(incomplete.save);
    assert.throws(
      () => replaceSavedDeckDraft(incomplete.save, "incomplete", {
        name: "Rejected replacement",
        cards,
      }, syntheticCatalog()),
      AdventureDeckOperationError,
    );
    assert.deepEqual(incomplete.save, before, "a rejected replacement must be atomic");
  }
});

test("Condition cards are rejected from both editable drafts and game validation", () => {
  const catalog = {
    ...syntheticCatalog(),
    "storm-condition": {
      id: "storm-condition",
      name: "Storm Warning",
      kind: "condition",
      victoryPoints: 50,
    },
  };
  let save = saveWithOwnedCards();
  save.inventory.cards["storm-condition"] = 1;
  save = createSavedDeck(save, { id: "draft", name: "Draft", cards: {} }).save;

  assert.throws(
    () => replaceSavedDeckDraft(save, "draft", {
      name: "Condition exploit",
      cards: { "storm-condition": 1 },
    }, catalog),
    (error) => error instanceof AdventureDeckOperationError
      && /separate Condition deck/.test(error.message),
  );

  const validation = validateAdventureDeck(
    { cards: { "storm-condition": 1 } },
    save.inventory.cards,
    catalog,
    { deckSize: 1, maxCopiesPerCard: 4, minPrintedVictoryPoints: 0, requireBaseFoundation: false },
  );
  assert.equal(validation.isValid, false);
  assert.deepEqual(validation.issues.map((issue) => issue.code), ["condition-card"]);
});

test("delete repairs active selection with explicit, starter, sorted, and null fallbacks", () => {
  let save = saveWithOwnedCards();
  save.player.starterDeckId = "starter";
  save = createSavedDeck(save, { id: "starter", name: "Starter", cards: {} }).save;
  save = createSavedDeck(save, { id: "active", name: "Active", cards: {} }).save;
  save = createSavedDeck(save, { id: "backup", name: "Backup", cards: {} }).save;
  save.player.activeDeckId = "active";
  const snapshot = structuredClone(save);

  const explicit = deleteSavedDeck(save, "active", { fallbackDeckId: "backup" });
  assert.equal(explicit.activeDeckId, "backup");
  assert.equal(explicit.save.player.activeDeckId, "backup");
  assert.equal(explicit.save.savedDecks.active, undefined);
  assert.deepEqual(save, snapshot);

  save.player.activeDeckId = "active";
  const starter = deleteSavedDeck(save, "active");
  assert.equal(starter.activeDeckId, "starter");

  const withoutStarter = structuredClone(save);
  withoutStarter.player.starterDeckId = null;
  const sorted = deleteSavedDeck(withoutStarter, "active");
  assert.equal(sorted.activeDeckId, "backup");

  let oneDeck = saveWithOwnedCards();
  oneDeck = createSavedDeck(oneDeck, { id: "only", name: "Only", cards: {} }).save;
  oneDeck.player.activeDeckId = "only";
  const empty = deleteSavedDeck(oneDeck, "only");
  assert.equal(empty.activeDeckId, null);
  assert.deepEqual(empty.save.savedDecks, {});
});

test("game validation reports ownership, size, copy, base Foundation, unknown card, and printed VP", () => {
  const catalog = syntheticCatalog();
  const cards = legalCards();
  const valid = validateAdventureDeck({ cards }, cards, catalog);

  assert.equal(valid.isValid, true);
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.summary.totalCards, 60);
  assert.equal(valid.summary.totalPrintedVictoryPoints, 56);
  assert.equal(valid.summary.baseFoundationCount, 4);
  assert.equal(valid.summary.ownedQuantityValid, true);

  const invalidCards = {
    ...cards,
    "card-01": 5,
    "card-02": 1,
    "unknown-card": 1,
  };
  const owned = { ...cards, "card-01": 4, "unknown-card": 1 };
  const invalid = validateAdventureDeck({ cards: invalidCards }, owned, catalog);
  const codes = invalid.issues.map((issue) => issue.code);
  assert.equal(invalid.isValid, false);
  assert.ok(codes.includes("copy-limit"));
  assert.ok(codes.includes("insufficient-owned-quantity"));
  assert.ok(codes.includes("unknown-card"));
  assert.ok(codes.includes("deck-size"));

  const noBaseLowVpCatalog = Object.fromEntries(Object.entries(catalog).map(([id, card]) => [id, {
    ...card,
    kind: "creature",
    stage: undefined,
    victoryPoints: 0,
  }]));
  const noBaseLowVp = validateAdventureDeck({ cards }, cards, noBaseLowVpCatalog);
  assert.deepEqual(
    noBaseLowVp.issues.map((issue) => issue.code),
    ["base-foundation", "printed-vp"],
  );
});

test("activation rejects invalid drafts and accepts an owned legal saved deck", () => {
  const catalog = syntheticCatalog();
  let save = saveWithOwnedCards();
  save = createSavedDeck(save, {
    id: "draft",
    name: "Draft",
    cards: { "card-01": 1 },
  }, { cardCatalog: catalog }).save;
  save = createSavedDeck(save, {
    id: "legal",
    name: "Legal",
    cards: legalCards(),
  }, { cardCatalog: catalog }).save;

  const invalid = validateSavedDeck(save, "draft", catalog);
  assert.equal(invalid.isValid, false);
  assert.ok(invalid.issues.some((issue) => issue.code === "deck-size"));
  assert.throws(
    () => setActiveSavedDeck(save, "draft", catalog),
    (error) => error instanceof AdventureDeckLegalityError
      && error.validation.deckId === "draft",
  );
  assert.equal(save.player.activeDeckId, null);

  const active = setActiveSavedDeck(save, "legal", catalog);
  assert.equal(active.save.player.activeDeckId, "legal");
  assert.deepEqual(active.deck, save.savedDecks.legal);
  assert.equal(active.validation.isValid, true);
  assert.equal(save.player.activeDeckId, null);
});

test("duel snapshots are canonical, deeply frozen, deterministic, and isolated from later edits", () => {
  const catalog = syntheticCatalog();
  const reversedCards = Object.fromEntries(Object.entries(legalCards()).reverse());
  let save = saveWithOwnedCards();
  save = createSavedDeck(save, {
    id: "reef-team",
    name: "Reef Team",
    cards: reversedCards,
  }, { cardCatalog: catalog }).save;
  save = setActiveSavedDeck(save, "reef-team", catalog).save;

  const first = createDuelDeckSnapshot(save, "reef-team", catalog);
  const active = createActiveDuelDeckSnapshot(save, catalog);
  assert.deepEqual(first, active);
  assert.deepEqual(Object.keys(first), ["id", "name", "cards", "fingerprint"]);
  assert.deepEqual(first.cards.map((entry) => entry.cardId), Object.keys(legalCards()).sort());
  assert.match(first.fingerprint, /^deck-v1-[0-9a-f]{16}$/);
  assert.equal(first.fingerprint, fingerprintDeckCards(reversedCards));
  assert.equal(first.fingerprint, fingerprintDeckCards(first.cards));
  assert.equal(getDuelDeckSnapshotIdentity(first), `reef-team@${first.fingerprint}`);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.cards), true);
  assert.equal(first.cards.every(Object.isFrozen), true);

  const edited = replaceSavedDeckDraft(save, "reef-team", {
    name: "Changed after launch",
    cards: { ...legalCards(), "card-15": 3 },
  }, catalog);
  assert.equal(first.name, "Reef Team");
  assert.equal(first.cards.find((entry) => entry.cardId === "card-15").quantity, 4);
  assert.notEqual(
    fingerprintDeckCards(edited.save.savedDecks["reef-team"].cards),
    first.fingerprint,
  );

  assert.throws(() => {
    first.cards[0].quantity = 1;
  }, TypeError);
});

test("all three real starter collections satisfy the adventure game-facing validator", () => {
  for (const starterDeckId of STARTER_DECK_IDS) {
    const selected = commitStarterSelection(
      createInitialAdventureSave(`deck-domain-${starterDeckId}`),
      starterDeckId,
    ).save;
    const reconciled = reconcileStarterCollection(selected, starterManifest(starterDeckId)).save;
    const validation = validateSavedDeck(reconciled, starterDeckId, cardsById);
    assert.equal(validation.isValid, true, `${starterDeckId}: ${validation.errors.join(" ")}`);

    const snapshot = createActiveDuelDeckSnapshot(reconciled, cardsById);
    assert.equal(snapshot.id, starterDeckId);
    assert.equal(snapshot.cards.reduce((total, entry) => total + entry.quantity, 0), 60);
  }
});
