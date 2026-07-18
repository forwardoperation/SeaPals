import assert from "node:assert/strict";
import test from "node:test";
import {
  STORY_DUEL_CONTRACT_VERSION,
  createStoryDuelConfig,
  createStoryDuelResult,
  isStoryDuelVpTargetVictory,
  normalizeStoryPlayerDeckSnapshot,
} from "./storyModeContract.mjs";

const BASE_RESULT = {
  encounterId: "shellshore:marina",
  opponentId: "marina",
  opponentName: "Marina",
  playerDeckId: "coral-garden",
  opponentDeckId: "coral-garden",
  victoryTarget: 10,
  difficulty: "easy",
  playerVp: 10,
  opponentVp: 7,
  round: 4,
  turn: 8,
  message: "Victory: you reached the 10 VP target.",
};

const SNAPSHOT = {
  id: "reef-lab-custom",
  name: "Reef Lab Custom",
  cards: [
    { cardId: "white-grunt", quantity: 2 },
    { cardId: "mustard-hill-coral-base", quantity: 4 },
  ],
  fingerprint: "deck-v1-a1b2c3d4e5f60718",
};

test("story duel config exposes a serializable versioned encounter contract", () => {
  const config = createStoryDuelConfig(BASE_RESULT);

  assert.deepEqual(config, {
    contractVersion: STORY_DUEL_CONTRACT_VERSION,
    encounterId: "shellshore:marina",
    opponent: {
      id: "marina",
      name: "Marina",
      deckId: "coral-garden",
      difficulty: "easy",
    },
    playerDeckId: "coral-garden",
    victoryTarget: 10,
  });
  assert.equal(JSON.parse(JSON.stringify(config)).encounterId, "shellshore:marina");
  assert.equal(Object.isFrozen(config), true);
  assert.equal(Object.isFrozen(config.opponent), true);
});

test("story duel config accepts a canonical immutable player deck snapshot", () => {
  const mutableSnapshot = structuredClone(SNAPSHOT);
  const config = createStoryDuelConfig({
    ...BASE_RESULT,
    playerDeckId: undefined,
    playerDeckSnapshot: mutableSnapshot,
  });

  assert.equal(config.playerDeckId, SNAPSHOT.id);
  assert.deepEqual(config.playerDeckSnapshot, {
    ...SNAPSHOT,
    cards: [
      { cardId: "mustard-hill-coral-base", quantity: 4 },
      { cardId: "white-grunt", quantity: 2 },
    ],
  });
  assert.equal(Object.isFrozen(config.playerDeckSnapshot), true);
  assert.equal(Object.isFrozen(config.playerDeckSnapshot.cards), true);
  assert.equal(Object.isFrozen(config.playerDeckSnapshot.cards[0]), true);

  mutableSnapshot.name = "Mutated after launch";
  mutableSnapshot.cards[0].quantity = 99;
  mutableSnapshot.cards.push({ cardId: "late-card", quantity: 1 });
  assert.equal(config.playerDeckSnapshot.name, SNAPSHOT.name);
  assert.equal(config.playerDeckSnapshot.cards.length, 2);
  assert.equal(config.playerDeckSnapshot.cards[1].quantity, 2);
});

test("story duel snapshot identity must agree with the legacy player deck id", () => {
  assert.throws(
    () => createStoryDuelConfig({
      ...BASE_RESULT,
      playerDeckId: "another-deck",
      playerDeckSnapshot: SNAPSHOT,
    }),
    /does not match snapshot id/,
  );
  assert.throws(
    () => normalizeStoryPlayerDeckSnapshot({
      ...SNAPSHOT,
      cards: [SNAPSHOT.cards[0], SNAPSHOT.cards[0]],
    }),
    /duplicate card id "white-grunt"/,
  );
  assert.throws(
    () => normalizeStoryPlayerDeckSnapshot({
      ...SNAPSHOT,
      cards: [{ cardId: "white-grunt", quantity: 0 }],
    }),
    /quantity must be a positive safe integer/,
  );
  assert.throws(
    () => normalizeStoryPlayerDeckSnapshot({
      ...SNAPSHOT,
      fingerprint: "not-canonical",
    }),
    /canonical deck-v1-<16 lowercase hex> format/,
  );
});

test("story duel victory result is deterministic and contains progression-safe facts", () => {
  const first = createStoryDuelResult(BASE_RESULT);
  const second = createStoryDuelResult({ ...BASE_RESULT });

  assert.deepEqual(first, second);
  assert.equal(first.outcome, "victory");
  assert.equal(first.winner, "player");
  assert.equal(first.completionReason, "vp-target");
  assert.deepEqual(first.scores, { playerVp: 10, opponentVp: 7, targetVp: 10 });
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.scores), true);
  assert.equal(isStoryDuelVpTargetVictory(first), true);
  assert.equal(isStoryDuelVpTargetVictory(first, {
    encounterId: BASE_RESULT.encounterId,
    victoryTarget: BASE_RESULT.victoryTarget,
  }), true);
});

test("story duel result reports the exact immutable player deck identity", () => {
  const result = createStoryDuelResult({
    ...BASE_RESULT,
    playerDeckId: SNAPSHOT.id,
    playerDeckSnapshot: SNAPSHOT,
  });

  assert.equal(result.playerDeckId, SNAPSHOT.id);
  assert.equal(result.playerDeckFingerprint, SNAPSHOT.fingerprint);
  assert.equal("playerDeckSnapshot" in result, false);
});

test("tutorial target victory excludes non-VP wins and incomplete score facts", () => {
  const deckDepletionVictory = createStoryDuelResult({
    ...BASE_RESULT,
    playerVp: 8,
    opponentVp: 5,
    message: "Victory: the opponent could not complete a required draw from its empty personal decks.",
  });

  assert.equal(deckDepletionVictory.outcome, "victory");
  assert.equal(deckDepletionVictory.completionReason, "deck-depletion");
  assert.equal(isStoryDuelVpTargetVictory(deckDepletionVictory), false);
  assert.equal(isStoryDuelVpTargetVictory({
    ...deckDepletionVictory,
    completionReason: "vp-target",
    scores: { playerVp: 9, opponentVp: 5, targetVp: 10 },
  }), false);
  assert.equal(isStoryDuelVpTargetVictory({
    ...deckDepletionVictory,
    scores: { playerVp: 10, opponentVp: 5, targetVp: 10 },
  }), false);
  assert.equal(isStoryDuelVpTargetVictory(null), false);
});

test("tutorial target victory is bound to the expected academy encounter and target", () => {
  const result = createStoryDuelResult(BASE_RESULT);
  assert.equal(isStoryDuelVpTargetVictory(result, {
    encounterId: "another-encounter",
    victoryTarget: 10,
  }), false);
  assert.equal(isStoryDuelVpTargetVictory(result, {
    encounterId: BASE_RESULT.encounterId,
    victoryTarget: 1,
  }), false);
  assert.equal(isStoryDuelVpTargetVictory({
    ...result,
    scores: { ...result.scores, playerVp: 1, targetVp: 1 },
  }, {
    encounterId: BASE_RESULT.encounterId,
    victoryTarget: 10,
  }), false);
  assert.equal(isStoryDuelVpTargetVictory(result, { victoryTarget: 0 }), false);
});

test("story duel defeat reports deck depletion without granting reward policy", () => {
  const result = createStoryDuelResult({
    ...BASE_RESULT,
    playerVp: 8,
    opponentVp: 5,
    message: "Defeat: you were required to draw two cards, but both personal decks were empty.",
  });

  assert.equal(result.outcome, "defeat");
  assert.equal(result.winner, "opponent");
  assert.equal(result.completionReason, "deck-depletion");
  assert.equal("reward" in result, false);
  assert.equal("firstWin" in result, false);
});

test("story duel contract rejects incomplete or unresolved results", () => {
  assert.throws(
    () => createStoryDuelConfig({ ...BASE_RESULT, encounterId: "" }),
    /Encounter id is required/,
  );
  assert.throws(
    () => createStoryDuelResult({ ...BASE_RESULT, message: "The match is still running." }),
    /must begin with Victory: or Defeat:/,
  );
  assert.throws(
    () => createStoryDuelResult({ ...BASE_RESULT, playerVp: -1 }),
    /Player VP must be a non-negative/,
  );
});
