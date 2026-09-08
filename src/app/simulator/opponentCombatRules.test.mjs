import assert from "node:assert/strict";
import test from "node:test";
import { estimateOpponentCombatOutcome, getCombatDieOutcomes, scoreOpponentCombatOutcome, selectOpponentCombatPlan } from "./opponentCombatRules.mjs";

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("dice distributions clamp every negative-modifier face, not the mean", () => {
  assert.deepEqual(getCombatDieOutcomes("D4-3"), [
    { total: 0, probability: 0.75 },
    { total: 1, probability: 0.25 },
  ]);
  near(getCombatDieOutcomes("D6", { advantage: true }).reduce((sum, roll) => sum + roll.probability * roll.total, 0), 161 / 36);
  assert.deepEqual(getCombatDieOutcomes("D4", { advantage: true, disadvantage: true }), getCombatDieOutcomes("D4"));
});

test("opposed combat honors defender-wins-ties and truly impossible/guaranteed attacks", () => {
  near(estimateOpponentCombatOutcome({ attackDice: "D6", defenseDice: "D6" }).winProbability, 15 / 36);
  assert.equal(estimateOpponentCombatOutcome({ attackDice: "D4", defenseDice: "D4+3" }).winProbability, 0);
  assert.equal(estimateOpponentCombatOutcome({ attackDice: "D4+4", defenseDice: "D4" }).winProbability, 1);
});

test("defensive Shelter and dice bonuses affect actual success probability", () => {
  const exposed = estimateOpponentCombatOutcome({ attackDice: "D6", defenseDice: "D4" });
  const protectedTarget = estimateOpponentCombatOutcome({ attackDice: "D6", defenseDice: "D4", defenseFlat: 2, defenseBonusDice: ["D4"] });
  near(exposed.winProbability, 14 / 24);
  near(protectedTarget.winProbability, 4 / 96);
});

test("attack bonuses at a roll threshold are evaluated per face", () => {
  const outcome = estimateOpponentCombatOutcome({ attackDice: "D4", defenseDice: "D4", attackRollBonus: (roll) => roll >= 3 ? 4 : 0 });
  near(outcome.winProbability, 9 / 16);
});

test("conditional attack bonus dice preserve their distribution", () => {
  const outcome = estimateOpponentCombatOutcome({ attackDice: "D4", attackBonusDice: ["D4"], defenseDice: "D4" });
  let wins = 0;
  for (let attack = 1; attack <= 4; attack += 1) {
    for (let bonus = 1; bonus <= 4; bonus += 1) {
      for (let defense = 1; defense <= 4; defense += 1) wins += attack + bonus > defense ? 1 : 0;
    }
  }
  near(outcome.winProbability, wins / 64);
});

test("Scatter retries against the original defense, not a new opposed roll", () => {
  const outcome = estimateOpponentCombatOutcome({ attackDice: "D4", defenseDice: "D4", scatter: true });
  near(outcome.winProbability, 14 / 64);
  assert.notEqual(outcome.winProbability, (6 / 16) ** 2);
});

test("avoidance halves success without triggering Bite Back on avoided attacks", () => {
  const inputs = { attackDice: "D4", defenseDice: "D4", counterAttackDice: "D6", attackerDefenseDice: "D4" };
  const ordinary = estimateOpponentCombatOutcome(inputs);
  const evasive = estimateOpponentCombatOutcome({ ...inputs, avoidanceProbability: 0.5 });
  near(evasive.winProbability, ordinary.winProbability / 2);
  near(evasive.counterLossProbability, ordinary.counterLossProbability / 2);
});

test("school damage uses all faces and caps overkill at remaining health", () => {
  const outcome = estimateOpponentCombatOutcome({ attackDice: "D4", attackDisadvantage: true, schoolHealth: 20 });
  near(outcome.removalProbability, 9 / 16);
  near(outcome.expectedDamage, 250 / 16);
  assert.equal(outcome.consumeProbability, 0);
});

test("Resilience and affordable Regenerate aren't valued as immediate removals", () => {
  const shielded = estimateOpponentCombatOutcome({ attackDice: "D6", defenseDice: "D4", targetSurvives: true });
  assert.ok(shielded.winProbability > 0);
  assert.equal(shielded.removalProbability, 0);
  assert.equal(shielded.consumeProbability, 0, "survival also prevents Toxic/self-discard consumption risk");
  assert.ok(scoreOpponentCombatOutcome({ outcome: shielded, targetValue: 100, survivalBreakValue: 20 }) < 20);
});

test("Bite Back can turn a high-value attacker into a losing trade", () => {
  const outcome = estimateOpponentCombatOutcome({ attackDice: "D4", defenseDice: "D8", counterAttackDice: "D6", attackerDefenseDice: "D4" });
  const value = scoreOpponentCombatOutcome({ outcome, targetValue: 40, attackerRetentionValue: 200 });
  assert.ok(value < 0);
});

function plan(attackers, difficulty, options = {}) {
  return selectOpponentCombatPlan(attackers, (attacker) => attacker.targets, {
    difficulty,
    evaluatePair: (_attacker, target) => target,
    getRepeatCount: (attacker) => attacker.repeat ?? 1,
    getActionCost: (attacker) => attacker.cost ?? 0,
    ...options,
  });
}

test("Easy uses a logical target instead of hitting the first protected card", () => {
  const impossible = { id: "sheltered", value: 0 };
  const exposed = { id: "exposed", value: 20 };
  const attacker = { targets: [impossible, exposed] };
  assert.equal(plan([attacker], "easy").target, exposed);
  assert.equal(plan([{ targets: [exposed, impossible] }], "easy").target, exposed);
});

test("all levels skip an unproductive attacker and can preserve RP by passing", () => {
  for (const difficulty of ["easy", "medium", "hard"]) {
    const futile = { targets: [{ value: 0 }], cost: 8 };
    const productive = { targets: [{ value: 25 }], cost: 8 };
    assert.equal(plan([futile, productive], difficulty).attacker, productive);
    assert.equal(plan([futile], difficulty), null);
    assert.equal(plan([{ targets: [{ value: -60 }] }], difficulty), null);
  }
});

test("Medium compares real attacker-target pairs, keeping Easy's simpler attacker choice", () => {
  const smallAttack = { targets: [{ id: "fish", value: 10 }] };
  const strongAttack = { targets: [{ id: "income-engine", value: 70 }] };
  assert.equal(plan([smallAttack, strongAttack], "easy").attacker, smallAttack);
  assert.equal(plan([smallAttack, strongAttack], "medium").attacker, strongAttack);
  assert.equal(plan([strongAttack, smallAttack], "medium").attacker, strongAttack);
});

test("Hard recognizes paid repeat attacks across distinct targets", () => {
  const powerful = { targets: [{ value: 50 }], cost: 8 };
  const repeated = { targets: [{ value: 35 }, { value: 35 }], repeat: 2, cost: 8 };
  assert.equal(plan([powerful, repeated], "medium").attacker, powerful);
  assert.equal(plan([powerful, repeated], "hard").attacker, repeated);
  assert.equal(plan([powerful, { ...repeated, targets: [{ value: 35 }] }], "hard").attacker, powerful, "one legal target must not be counted twice");
});

test("Hard postpones a self-discarding consume until the end of a repeat sequence", () => {
  const toxic = { id: "consume-and-discard", value: 40, survivalProbability: 0 };
  const safe = { id: "safe", value: 30, survivalProbability: 1 };
  const selected = plan([{ targets: [toxic, safe], repeat: 2 }], "hard");
  assert.equal(selected.target, safe);
  assert.equal(selected.value, 70);
});

test("On Play and paid continuations resolve even when every remaining target is bad", () => {
  for (const difficulty of ["easy", "medium", "hard"]) {
    const attacker = { targets: [{ id: "suicidal", value: -50 }], cost: 100 };
    const selected = plan([attacker], difficulty, { mandatory: true });
    assert.equal(selected.target.id, "suicidal");
    assert.equal(selected.value, -50, "a prepaid action isn't priced a second time");
  }
});
