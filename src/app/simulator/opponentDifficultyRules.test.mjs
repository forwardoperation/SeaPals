import test from "node:test";
import assert from "node:assert/strict";
import {
  OpponentDifficulty,
  chooseOpponentPreferredDeck,
  getOpponentDifficultyProfile,
  limitOpponentOptionalActions,
  normalizeOpponentDifficulty,
  orderOpponentChoices,
  scaleOpponentThinkingDelay,
  selectOpponentChoice,
} from "./opponentDifficultyRules.mjs";

test("unknown opponent difficulty safely falls back to medium", () => {
  assert.equal(normalizeOpponentDifficulty("impossible"), OpponentDifficulty.MEDIUM);
  assert.equal(getOpponentDifficultyProfile().label, "Medium");
});

test("easy uses the first legal choice while medium and hard use their scores", () => {
  const choices = ["simple", "balanced", "finisher"];
  const mediumScores = { simple: 1, balanced: 8, finisher: 5 };
  const hardScores = { simple: 1, balanced: 8, finisher: 50 };
  assert.equal(selectOpponentChoice(choices, "easy", { mediumScore: (id) => mediumScores[id] }), "simple");
  assert.equal(selectOpponentChoice(choices, "medium", { mediumScore: (id) => mediumScores[id] }), "balanced");
  assert.equal(selectOpponentChoice(choices, "hard", { mediumScore: (id) => mediumScores[id], hardScore: (id) => hardScores[id] }), "finisher");
});

test("easy preserves hand order and limits optional action volume", () => {
  assert.deepEqual(orderOpponentChoices(["a", "b", "c"], "easy", (id) => ({ a: 1, b: 9, c: 4 })[id]), ["a", "b", "c"]);
  assert.deepEqual(orderOpponentChoices(["a", "b", "c"], "medium", (id) => ({ a: 1, b: 9, c: 4 })[id]), ["b", "c", "a"]);
  assert.equal(limitOpponentOptionalActions(7, "easy", "support"), 1);
  assert.equal(limitOpponentOptionalActions(7, "easy", "utility"), 1);
  assert.equal(limitOpponentOptionalActions(7, "medium", "support"), 7);
  assert.equal(limitOpponentOptionalActions(7, "hard", "utility"), 7);
});

test("hard strategically chooses a deck without inspecting its top card", () => {
  assert.equal(chooseOpponentPreferredDeck({ difficulty: "hard", round: 1, coralCount: 1, emptySlotCount: 0, foundationCardsInHand: 0, creaturesInHand: 2 }), "foundationDeck");
  assert.equal(chooseOpponentPreferredDeck({ difficulty: "hard", round: 2, coralCount: 2, emptySlotCount: 4, foundationCardsInHand: 1, creaturesInHand: 0 }), "palsDeck");
  assert.equal(chooseOpponentPreferredDeck({ difficulty: "hard", round: 8, coralCount: 3, emptySlotCount: 2, foundationCardsInHand: 3, creaturesInHand: 0, threatLevel: "critical" }), "palsDeck");
  assert.equal(chooseOpponentPreferredDeck({ difficulty: "medium", round: 1, coralCount: 1, emptySlotCount: 0, foundationCardsInHand: 0, creaturesInHand: 2 }), "palsDeck");
});

test("thinking pace remains bounded and increases with difficulty", () => {
  assert.equal(scaleOpponentThinkingDelay(1000, "easy"), 700);
  assert.equal(scaleOpponentThinkingDelay(1000, "medium"), 1000);
  assert.equal(scaleOpponentThinkingDelay(1000, "hard"), 1250);
  assert.equal(scaleOpponentThinkingDelay(0, "easy"), 250);
});
