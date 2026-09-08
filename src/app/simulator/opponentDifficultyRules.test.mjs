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

test("all levels recognize direct value while hard can prefer its stronger tactical score", () => {
  const choices = ["simple", "balanced", "finisher"];
  const mediumScores = { simple: 1, balanced: 8, finisher: 5 };
  const hardScores = { simple: 1, balanced: 8, finisher: 50 };
  assert.equal(selectOpponentChoice(choices, "easy", { mediumScore: (id) => mediumScores[id] }), "balanced");
  assert.equal(selectOpponentChoice(choices, "easy", { easyScore: (id) => id === "simple" ? 5 : 0, mediumScore: (id) => mediumScores[id] }), "simple");
  assert.equal(selectOpponentChoice(choices, "medium", { mediumScore: (id) => mediumScores[id] }), "balanced");
  assert.equal(selectOpponentChoice(choices, "hard", { mediumScore: (id) => mediumScores[id], hardScore: (id) => hardScores[id] }), "finisher");
});

test("easy spends its smaller optional action budget on useful choices", () => {
  assert.deepEqual(orderOpponentChoices(["a", "b", "c"], "easy", (id) => ({ a: 1, b: 9, c: 4 })[id]), ["b", "c", "a"]);
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
  assert.equal(chooseOpponentPreferredDeck({ difficulty: "medium", round: 1, coralCount: 1, emptySlotCount: 0, foundationCardsInHand: 0, creaturesInHand: 2 }), "foundationDeck");
});

test("choice scores are evaluated once, reject invalid values, and retain stable ties", () => {
  for (const difficulty of Object.values(OpponentDifficulty)) {
    const choices = ["invalid", "valuable", "tied", "negative"];
    const calls = [];
    const score = (id) => {
      calls.push(id);
      return { invalid: NaN, valuable: 4, tied: 4, negative: -1 }[id];
    };
    assert.equal(selectOpponentChoice(choices, difficulty, { mediumScore: score }), "valuable");
    assert.deepEqual(calls, choices);
    calls.length = 0;
    assert.deepEqual(orderOpponentChoices(choices, difficulty, score), ["valuable", "tied", "negative", "invalid"]);
    assert.deepEqual(calls, choices);
    assert.deepEqual(choices, ["invalid", "valuable", "tied", "negative"]);
  }
  assert.equal(selectOpponentChoice(["a", "b"], "hard", { hardScore: (id) => id === "b" ? 1 : 0 }), "b");
  assert.equal(selectOpponentChoice([], "hard"), null);
  assert.equal(selectOpponentChoice(["a", "b"], "medium"), "a");
});

test("all levels draw missing foundations and creatures instead of following round parity", () => {
  for (const difficulty of Object.values(OpponentDifficulty)) {
    assert.equal(chooseOpponentPreferredDeck({ difficulty, round: 1, coralCount: 0, foundationCardsInHand: 1, usableFoundationCardsInHand: 0, creaturesInHand: 2 }), "foundationDeck", `${difficulty}: locked upgrade does not create a reef`);
    assert.equal(chooseOpponentPreferredDeck({ difficulty, round: 1, coralCount: 3, emptySlotCount: 2, creaturesInHand: 1, placementBlockedCreaturesInHand: 1 }), "foundationDeck", `${difficulty}: unsuitable slots do not house its creature`);
    assert.equal(chooseOpponentPreferredDeck({ difficulty, round: 2, coralCount: 3, emptySlotCount: 2, creaturesInHand: 0 }), "palsDeck", `${difficulty}: fill existing reef space`);
    assert.equal(chooseOpponentPreferredDeck({ difficulty, round: 2, coralCount: 0, foundationCardsInHand: 2, usableFoundationCardsInHand: 2, creaturesInHand: 0 }), "palsDeck", `${difficulty}: foundation supply is already in hand`);
  }
});

test("medium and hard recognize a density bottleneck and avoid excess foundations", () => {
  for (const difficulty of [OpponentDifficulty.MEDIUM, OpponentDifficulty.HARD]) {
    assert.equal(chooseOpponentPreferredDeck({ difficulty, round: 1, coralCount: 3, emptySlotCount: 3, creaturesInHand: 2, densityBlockedCreaturesInHand: 2 }), "foundationDeck");
    assert.equal(chooseOpponentPreferredDeck({ difficulty, round: 2, coralCount: 3, emptySlotCount: 3, foundationCardsInHand: 3, creaturesInHand: 2 }), "palsDeck");
  }
});

test("hard distinguishes deployed combat from a missing attack in hand", () => {
  const situation = { difficulty: "hard", round: 2, coralCount: 3, emptySlotCount: 3, foundationCardsInHand: 1, creaturesInHand: 3, visibleAttackTargetCount: 2 };
  assert.equal(chooseOpponentPreferredDeck(situation), "palsDeck");
  assert.equal(chooseOpponentPreferredDeck({ ...situation, deployedLegalAttackCount: 1 }), "foundationDeck");
});

test("hard draws toward an attack when public targets are exposed but its creature hand has no legal attack", () => {
  assert.equal(chooseOpponentPreferredDeck({
    difficulty: "hard",
    round: 2,
    coralCount: 2,
    emptySlotCount: 3,
    foundationCardsInHand: 2,
    creaturesInHand: 3,
    targetableAttackCardsInHand: 0,
    legalAttackCardsInHand: 0,
    placementBlockedAttackCardsInHand: 0,
    visibleAttackTargetCount: 2,
    threatLevel: "setup",
  }), "palsDeck");
});

test("hard does not force another combat draw when its hand already contains a legal attack line", () => {
  assert.equal(chooseOpponentPreferredDeck({
    difficulty: "hard",
    round: 2,
    coralCount: 2,
    emptySlotCount: 3,
    foundationCardsInHand: 2,
    creaturesInHand: 3,
    targetableAttackCardsInHand: 1,
    legalAttackCardsInHand: 1,
    placementBlockedAttackCardsInHand: 0,
    visibleAttackTargetCount: 2,
    threatLevel: "setup",
  }), "foundationDeck");
});

test("hard draws a Foundation when its targetable attacker needs a more capable slot", () => {
  assert.equal(chooseOpponentPreferredDeck({
    difficulty: "hard",
    round: 3,
    coralCount: 2,
    emptySlotCount: 2,
    foundationCardsInHand: 0,
    creaturesInHand: 1,
    targetableAttackCardsInHand: 1,
    legalAttackCardsInHand: 0,
    placementBlockedAttackCardsInHand: 1,
    visibleAttackTargetCount: 1,
    threatLevel: "setup",
  }), "foundationDeck");
});

test("hard keeps seeking the required slot when an unrelated Foundation is already in hand", () => {
  assert.equal(chooseOpponentPreferredDeck({
    difficulty: "hard",
    round: 2,
    coralCount: 2,
    emptySlotCount: 2,
    foundationCardsInHand: 1,
    creaturesInHand: 1,
    targetableAttackCardsInHand: 1,
    legalAttackCardsInHand: 0,
    placementBlockedAttackCardsInHand: 1,
    visibleAttackTargetCount: 1,
    threatLevel: "setup",
  }), "foundationDeck");
});

test("thinking pace remains bounded and increases with difficulty", () => {
  assert.equal(scaleOpponentThinkingDelay(1000, "easy"), 700);
  assert.equal(scaleOpponentThinkingDelay(1000, "medium"), 1000);
  assert.equal(scaleOpponentThinkingDelay(1000, "hard"), 1250);
  assert.equal(scaleOpponentThinkingDelay(0, "easy"), 250);
});
