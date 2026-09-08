import { parseDieExpression } from "./gameRules.mjs";

const probability = (value) => Math.max(0, Math.min(1, Number(value) || 0));

function mergeOutcomes(outcomes) {
  const weights = new Map();
  for (const { total, probability: weight } of outcomes) {
    weights.set(total, (weights.get(total) ?? 0) + weight);
  }
  return [...weights].map(([total, weight]) => ({ total, probability: weight }));
}

/** Enumerates the same clamped dice totals as rollDie, without consuming RNG. */
export function getCombatDieOutcomes(expression, { advantage = false, disadvantage = false } = {}) {
  const die = parseDieExpression(expression);
  if (!die) return [];
  const outcomes = [];
  for (let face = 1; face <= die.sides; face += 1) {
    // Probabilities of the maximum/minimum of two independent fair dice.
    const weight = advantage && !disadvantage
      ? (2 * face - 1) / die.sides ** 2
      : disadvantage && !advantage
        ? (2 * (die.sides - face) + 1) / die.sides ** 2
        : 1 / die.sides;
    outcomes.push({ total: Math.max(0, face + die.modifier), probability: weight });
  }
  return mergeOutcomes(outcomes);
}

function addBonusDice(outcomes, dice = []) {
  return dice.reduce((current, expression) => {
    const bonus = getCombatDieOutcomes(expression);
    if (!bonus.length) return current;
    return mergeOutcomes(current.flatMap((base) => bonus.map((roll) => ({
      total: base.total + roll.total,
      probability: base.probability * roll.probability,
    }))));
  }, outcomes);
}

/** Exact opposed-roll odds, including defender-wins-ties and Scatter's fixed defense. */
export function estimateOpponentCombatOutcome({
  attackDice,
  attackAdvantage = false,
  attackDisadvantage = false,
  attackFlat = 0,
  attackBonusDice = [],
  attackRollBonus = () => 0,
  defenseDice,
  defenseAdvantage = false,
  defenseFlat = 0,
  defenseBonusDice = [],
  avoidanceProbability = 0,
  scatter = false,
  schoolHealth = null,
  targetSurvives = false,
  counterAttackDice = null,
  attackerDefenseDice = null,
} = {}) {
  const attack = addBonusDice(getCombatDieOutcomes(attackDice, {
    advantage: attackAdvantage,
    disadvantage: attackDisadvantage,
  }).map((roll) => ({ ...roll, total: roll.total + attackFlat + Number(attackRollBonus(roll.total) || 0) })), attackBonusDice);
  const reachesCombat = 1 - probability(avoidanceProbability);
  if (!attack.length) return { resolved: false, winProbability: 0, removalProbability: 0, consumeProbability: 0, counterLossProbability: 0, expectedDamage: 0 };
  if (schoolHealth !== null) {
    const health = Math.max(1, Number(schoolHealth) || 1);
    return {
      resolved: true,
      winProbability: reachesCombat,
      removalProbability: reachesCombat * attack.reduce((sum, roll) => sum + (roll.total * 10 >= health ? roll.probability : 0), 0),
      consumeProbability: 0,
      counterLossProbability: 0,
      expectedDamage: reachesCombat * attack.reduce((sum, roll) => sum + Math.min(health, Math.max(0, roll.total * 10)) * roll.probability, 0),
    };
  }
  // The resolver clamps the primary defense plus flat effects before bonus dice.
  const defense = addBonusDice(getCombatDieOutcomes(defenseDice, { advantage: defenseAdvantage })
    .map((roll) => ({ ...roll, total: Math.max(0, roll.total + defenseFlat) })), defenseBonusDice);
  if (!defense.length) return { resolved: false, winProbability: 0, removalProbability: 0, consumeProbability: 0, counterLossProbability: 0, expectedDamage: 0 };
  const opposedWin = defense.reduce((sum, defender) => {
    const beatsDefense = attack.reduce((wins, attacker) => wins + (attacker.total > defender.total ? attacker.probability : 0), 0);
    // Scatter rerolls only a successful attack and retains the original defense.
    return sum + defender.probability * (scatter ? beatsDefense ** 2 : beatsDefense);
  }, 0);
  const winProbability = reachesCombat * probability(opposedWin);
  const counterAttack = getCombatDieOutcomes(counterAttackDice);
  const attackerDefense = getCombatDieOutcomes(attackerDefenseDice);
  const counterWins = counterAttack.reduce((sum, roll) => sum + roll.probability * attackerDefense.reduce((wins, defenseRoll) => wins + (roll.total > defenseRoll.total ? defenseRoll.probability : 0), 0), 0);
  return {
    resolved: true,
    winProbability,
    removalProbability: targetSurvives ? 0 : winProbability,
    consumeProbability: targetSurvives ? 0 : winProbability,
    counterLossProbability: reachesCombat * (1 - probability(opposedWin)) * counterWins,
    expectedDamage: 0,
  };
}

export function scoreOpponentCombatOutcome({
  outcome,
  targetValue = 0,
  survivalBreakValue = 0,
  schoolMaxHealth = null,
  attackerRetentionValue = 0,
  attackRiskPenalty = 0,
} = {}) {
  if (!outcome?.resolved) return -Infinity;
  const progressValue = schoolMaxHealth !== null
    ? outcome.expectedDamage / Math.max(1, Number(schoolMaxHealth) || 1) * targetValue * 0.6
    : outcome.winProbability * survivalBreakValue;
  return outcome.removalProbability * targetValue
    + progressValue
    - attackRiskPenalty
    - outcome.counterLossProbability * attackerRetentionValue;
}

/**
 * Easy finds a sensible target for its first productive attacker; Medium compares
 * immediate trades; Hard also values the other distinct targets in a paid sequence.
 * A mandatory On Play or already-paid attack always resolves even at negative value.
 */
export function selectOpponentCombatPlan(attackers = [], getLegalTargets = () => [], {
  difficulty = "medium",
  evaluatePair = () => ({ value: 0 }),
  getRepeatCount = () => 1,
  getActionCost = () => 0,
  mandatory = false,
} = {}) {
  let bestPlan = null;
  for (const attacker of attackers) {
    const targets = getLegalTargets(attacker) ?? [];
    const evaluations = targets.map((target) => ({ target, ...evaluatePair(attacker, target) }))
      .filter((entry) => Number.isFinite(entry.value))
      .sort((a, b) => b.value - a.value);
    for (const first of evaluations) {
      let value = first.value;
      if (difficulty === "hard") {
        let survival = probability(first.survivalProbability ?? 1);
        const remaining = evaluations.filter((entry) => entry !== first)
          .slice(0, Math.max(0, getRepeatCount(attacker) - 1));
        for (const next of remaining) {
          value += survival * next.value;
          survival *= probability(next.survivalProbability ?? 1);
        }
      }
      value -= mandatory ? 0 : Math.max(0, Number(getActionCost(attacker)) || 0);
      if ((!bestPlan || value > bestPlan.value) && (mandatory || value > 0)) {
        bestPlan = { attacker, target: first.target, value };
      }
    }
    if (difficulty === "easy" && bestPlan) return bestPlan;
  }
  return bestPlan;
}
