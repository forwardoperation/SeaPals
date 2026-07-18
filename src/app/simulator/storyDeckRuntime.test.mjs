import assert from "node:assert/strict";
import test from "node:test";
import {
  StoryDeckSnapshotResolutionError,
  expandResolvedStoryDeckCards,
  fingerprintResolvedStoryDeckCards,
  resolveStoryPlayerDeckSnapshot,
} from "./storyDeckRuntime.mjs";

const CARD_CATALOG = {
  "mustard-hill-coral-base": { id: "mustard-hill-coral-base", kind: "foundation" },
  "white-grunt": { id: "white-grunt", kind: "pals" },
};

function createSnapshot() {
  const cards = [
    { cardId: "white-grunt", quantity: 2 },
    { cardId: "mustard-hill-coral-base", quantity: 4 },
  ];
  return {
    id: "reef-lab-custom",
    name: "Reef Lab Custom",
    cards,
    fingerprint: fingerprintResolvedStoryDeckCards(cards),
  };
}

test("story runtime captures a deeply immutable deck before duel launch", () => {
  const editorSnapshot = createSnapshot();
  const runtimeSnapshot = resolveStoryPlayerDeckSnapshot(editorSnapshot, CARD_CATALOG);

  editorSnapshot.name = "Changed in the deck builder";
  editorSnapshot.cards[0].quantity = 50;
  editorSnapshot.cards.push({ cardId: "another-card", quantity: 1 });

  assert.equal(runtimeSnapshot.name, "Reef Lab Custom");
  assert.deepEqual(runtimeSnapshot.cards, [
    { cardId: "mustard-hill-coral-base", quantity: 4 },
    { cardId: "white-grunt", quantity: 2 },
  ]);
  assert.equal(Object.isFrozen(runtimeSnapshot), true);
  assert.equal(Object.isFrozen(runtimeSnapshot.cards), true);
  assert.equal(Object.isFrozen(runtimeSnapshot.cards[0]), true);
});

test("story runtime fails clearly before launch when a snapshot card is unresolved", () => {
  assert.throws(
    () => resolveStoryPlayerDeckSnapshot({
      ...createSnapshot(),
      cards: [
        { cardId: "missing-predator", quantity: 2 },
        { cardId: "missing-coral", quantity: 4 },
      ],
    }, CARD_CATALOG),
    (error) => {
      assert.equal(error instanceof StoryDeckSnapshotResolutionError, true);
      assert.match(error.message, /reef-lab-custom/);
      assert.match(error.message, /missing-coral, missing-predator/);
      return true;
    },
  );
});

test("story runtime rejects an identity mismatch before constructing game state", () => {
  assert.throws(
    () => resolveStoryPlayerDeckSnapshot(createSnapshot(), CARD_CATALOG, "different-deck"),
    (error) => {
      assert.equal(error instanceof StoryDeckSnapshotResolutionError, true);
      assert.match(error.message, /different-deck/);
      assert.match(error.message, /reef-lab-custom/);
      return true;
    },
  );
});

test("story runtime rejects a formatted fingerprint that does not match the cards", () => {
  assert.throws(
    () => resolveStoryPlayerDeckSnapshot({
      ...createSnapshot(),
      fingerprint: "deck-v1-a1b2c3d4e5f60718",
    }, CARD_CATALOG),
    (error) => {
      assert.equal(error instanceof StoryDeckSnapshotResolutionError, true);
      assert.match(error.message, /fingerprint does not match/i);
      return true;
    },
  );
});

test("story runtime expands the immutable snapshot into simulator deck halves", () => {
  const snapshot = resolveStoryPlayerDeckSnapshot(createSnapshot(), CARD_CATALOG);
  const isFoundationCard = (card) => card.kind === "foundation";

  assert.deepEqual(
    expandResolvedStoryDeckCards(snapshot, "foundation", CARD_CATALOG, isFoundationCard),
    Array.from({ length: 4 }, () => "mustard-hill-coral-base"),
  );
  assert.deepEqual(
    expandResolvedStoryDeckCards(snapshot, "pals", CARD_CATALOG, isFoundationCard),
    ["white-grunt", "white-grunt"],
  );
});
