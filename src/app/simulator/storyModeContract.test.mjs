import assert from "node:assert/strict";
import test from "node:test";
import {
  STORY_DUEL_CONTRACT_VERSION,
  createStoryDuelConfig,
  createStoryDuelResult,
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
