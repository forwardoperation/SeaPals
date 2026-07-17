import test from "node:test";
import assert from "node:assert/strict";
import {
  attackCanTargetCard,
  attackDieCanTargetCard,
  attackerHasDisadvantageFromMassive,
  canTargetInAttackSequence,
  createAttackSequence,
  createRegenerateDecision,
  getCloakDefenseBonus,
  getDarknessShroudDefenseBonus,
  getMassiveDefenseMode,
  getRemainingAttackTargets,
  getRovLightsAttackBonus,
  hasExplicitToxicImmunity,
  recordAttackResolution,
  resolveDefenseRoll,
  resolveRegenerateDecision,
  resolveToxicConsumption,
  shouldSelfDiscardAfterConsume,
} from "./combatRules.mjs";

test("Darkness Shroud grants its printed defense bonus only while Abyss is in play", () => {
  const fish = { passives: ["Darkness Shroud: If Abyss is in your play area, gain +2 Defense."] };
  const barrelEye = { passives: [{ name: "Darkness Shroud", text: "If Abyss is in your play area, gain +4 to Defense." }] };
  assert.equal(getDarknessShroudDefenseBonus(fish, []), 0);
  assert.equal(getDarknessShroudDefenseBonus(fish, ["abyss"]), 2);
  assert.equal(getDarknessShroudDefenseBonus(barrelEye, ["abyss"]), 4);
});

test("Cloak keeps creatures targetable and grants a flat three defense", () => {
  const cloakedCreature = { category: "fish", zone: "reef", passives: ["Cloak: This creature blends into the reef."] };
  const similarlyNamedAction = { category: "fish", zone: "deep", passives: [], actions: ["Cloak in Darkness: Stun a coral."] };
  assert.equal(getCloakDefenseBonus(cloakedCreature), 3);
  assert.equal(attackCanTargetCard(cloakedCreature, { attackDice: "D6", target: { categories: ["fish"] } }), true);
  assert.equal(getCloakDefenseBonus(similarlyNamedAction), 0);
});

test("ROV Lights adds two only when an attack targets a Deep creature", () => {
  assert.equal(getRovLightsAttackBonus(true, { zone: "deep" }), 2);
  assert.equal(getRovLightsAttackBonus(true, { zone: "reef" }), 0);
  assert.equal(getRovLightsAttackBonus(false, { zone: "deep" }), 0);
});

test("Transparency rejects attacks with a printed die larger than its limit", () => {
  const peacockSquid = {
    passives: ["Transparency: Attack rolls of more than a D4 cannot target this creature."],
  };
  assert.equal(attackDieCanTargetCard("D4", peacockSquid), true);
  assert.equal(attackDieCanTargetCard("D4+2", peacockSquid), true);
  assert.equal(attackDieCanTargetCard("D6-1", peacockSquid), false);
  assert.equal(attackDieCanTargetCard("D12", peacockSquid), false);
  assert.equal(attackDieCanTargetCard("D8", { passives: [] }), true);
});

test("Deep attacks match the card zone without requiring a synthetic tag", () => {
  const deepAttack = { attackDice: "D6", target: { categories: ["invertebrate"] }, targetZone: "deep" };
  assert.equal(attackCanTargetCard({ category: "invertebrate", zone: "deep", tags: [] }, deepAttack), true);
  assert.equal(attackCanTargetCard({ category: "invertebrate", zone: "reef", tags: ["deep"] }, deepAttack), false);
  assert.equal(attackCanTargetCard({ category: "fish", zone: "deep", tags: [] }, deepAttack), false);
});

test("reef ownership targets do not replace a creature's ecological zone", () => {
  const opponentReefAttack = {
    attackDice: "D6",
    target: { categories: ["fish", "invertebrate"], zone: "opponentReef" },
  };

  assert.equal(attackCanTargetCard({ category: "invertebrate", zone: "reef", tags: [] }, opponentReefAttack), true);
  assert.equal(attackCanTargetCard({ category: "fish", zone: "deep", tags: [] }, opponentReefAttack), true);
  assert.equal(attackCanTargetCard({ category: "predator", zone: "reef", tags: [] }, opponentReefAttack), false);
  assert.equal(attackCanTargetCard(
    { category: "invertebrate", zone: "reef", tags: [] },
    { ...opponentReefAttack, targetZone: "deep" },
  ), false);
  assert.equal(attackCanTargetCard(
    { category: "invertebrate", zone: "deep", tags: [] },
    { ...opponentReefAttack, targetZone: "deep" },
  ), true);
});

test("repeated attacks resolve separately against distinct target instances", () => {
  const first = recordAttackResolution(createAttackSequence(3), {
    targetInstanceId: "fish-instance-1",
    resolution: { attackerWins: true, attackTotal: 5, defenseTotal: 2 },
  });
  assert.equal(first.accepted, true);
  assert.equal(first.sequence.complete, false);

  const duplicate = recordAttackResolution(first.sequence, {
    targetInstanceId: "fish-instance-1",
    resolution: { attackerWins: false, attackTotal: 1, defenseTotal: 4 },
  });
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.sequence.resolutions.length, 1);

  const second = recordAttackResolution(first.sequence, {
    targetInstanceId: "fish-instance-2",
    resolution: { attackerWins: false, attackTotal: 1, defenseTotal: 4 },
  });
  const third = recordAttackResolution(second.sequence, {
    targetInstanceId: "fish-instance-3",
    resolution: { attackerWins: true, attackTotal: 6, defenseTotal: 3 },
  });
  assert.equal(third.sequence.complete, true);
  assert.deepEqual(third.sequence.resolutions.map((entry) => entry.attackNumber), [1, 2, 3]);
  assert.deepEqual(third.sequence.resolutions.map((entry) => entry.resolution.attackerWins), [true, false, true]);
});

test("remaining repeated-attack targets exclude only used instance IDs", () => {
  const first = recordAttackResolution(createAttackSequence(2), {
    targetInstanceId: "copy-a",
    resolution: { attackerWins: true },
  }).sequence;
  assert.equal(canTargetInAttackSequence(first, "copy-a"), false);
  assert.equal(canTargetInAttackSequence(first, "copy-b"), true);
  assert.deepEqual(
    getRemainingAttackTargets(first, [
      { instanceId: "copy-a", cardId: "same-card" },
      { instanceId: "copy-b", cardId: "same-card" },
    ]),
    [{ instanceId: "copy-b", cardId: "same-card" }],
  );
});

test("Massive preserves its two printed defensive modes", () => {
  const school = { passives: ["Massive: All attacks have disadvantage."] };
  const whale = { passives: ["Massive: Have advantage on defensive dice rolls."] };
  assert.equal(getMassiveDefenseMode(school), "attackDisadvantage");
  assert.equal(attackerHasDisadvantageFromMassive(school), true);
  assert.equal(getMassiveDefenseMode(whale), "defenseAdvantage");
});

test("defensive advantage rolls twice and Massive uses the higher defense roll", () => {
  const randomValues = [0, 0.99];
  const result = resolveDefenseRoll("D6", {
    targetCard: { passives: ["Massive: Have advantage on defensive dice rolls."] },
    flatModifier: 2,
    random: () => randomValues.shift(),
  });
  assert.equal(result.hasAdvantage, true);
  assert.deepEqual(result.rolls.map((roll) => roll.total), [1, 6]);
  assert.equal(result.total, 8);
});

test("effects that ignore defensive bonuses suppress status and Massive advantage", () => {
  let rolls = 0;
  const result = resolveDefenseRoll("D6", {
    targetCard: { passives: ["Massive: Have advantage on defensive dice rolls."] },
    statuses: [{ type: "defenseAdvantage" }],
    ignoreDefensiveBonuses: true,
    flatModifier: 4,
    random: () => {
      rolls += 1;
      return 0.5;
    },
  });
  assert.equal(rolls, 1);
  assert.equal(result.hasAdvantage, false);
  assert.equal(result.total, 4);
});

const crownOfThorns = {
  id: "crown-of-thorns",
  passives: [{ name: "Toxic", effect: { type: "toxicWhenEaten" } }],
};

test("Toxic applies to any consuming attacker, not only Predators", () => {
  const result = resolveToxicConsumption(
    {
      attackerCard: { id: "reef-fish", category: "fish" },
      toxicSourceCard: crownOfThorns,
      consumed: true,
    },
    () => 0,
  );
  assert.equal(result.triggered, true);
  assert.equal(result.coinResult, "tails");
  assert.equal(result.discardAttacker, true);
});

test("Toxic does not trigger when an attack does not consume its target", () => {
  const result = resolveToxicConsumption(
    { attackerCard: { category: "predator" }, toxicSourceCard: crownOfThorns, consumed: false },
    () => 0,
  );
  assert.equal(result.triggered, false);
  assert.equal(result.coinResult, null);
});

test("Black Swallower self-discards only after consuming its printed prey", () => {
  const attackerCard = { id: "black-swallower", selfDiscardAfterConsumeCategories: ["apex", "predator"] };
  assert.equal(shouldSelfDiscardAfterConsume({ attackerCard, defenderCard: { category: "apex" }, consumed: true }), true);
  assert.equal(shouldSelfDiscardAfterConsume({ attackerCard, defenderCard: { category: "predator" }, consumed: true }), true);
  assert.equal(shouldSelfDiscardAfterConsume({ attackerCard, defenderCard: { category: "filter-feeder" }, consumed: true }), false);
  assert.equal(shouldSelfDiscardAfterConsume({ attackerCard, defenderCard: { category: "apex" }, consumed: false }), false);
});

test("pre-attack Toxic avoidance is not also Toxic when consumed", () => {
  const blueSeaDragon = {
    id: "blue-sea-dragon",
    passives: ["Toxic: If targeted, your opponent flips a coin. If tails, the attack fails."],
  };
  const result = resolveToxicConsumption(
    { attackerCard: { category: "predator" }, toxicSourceCard: blueSeaDragon, consumed: true },
    () => 0,
  );
  assert.equal(result.triggered, false);
  assert.equal(result.discardAttacker, false);
});

test("a Toxic Immunity passive does not make its own card Toxic", () => {
  const giantTriton = {
    category: "invertebrate",
    passives: [{ name: "Toxic Immunity", text: "Immune to Crown of Thorns toxic effect." }],
  };
  const result = resolveToxicConsumption(
    { attackerCard: { category: "fish" }, toxicSourceCard: giantTriton, consumed: true },
    () => 0,
  );
  assert.equal(result.triggered, false);
});

test("explicit source immunity protects only against its declared Toxic source", () => {
  const giantTriton = {
    passives: [{ effect: { type: "ignoreEffect", sourceCardId: "crown-of-thorns", ignoredEffectType: "toxicWhenEaten" } }],
  };
  assert.equal(hasExplicitToxicImmunity(giantTriton, crownOfThorns), true);
  assert.equal(hasExplicitToxicImmunity(giantTriton, { ...crownOfThorns, id: "porcupinefish" }), false);

  const protectedResult = resolveToxicConsumption(
    { attackerCard: giantTriton, toxicSourceCard: crownOfThorns, consumed: true },
    () => 0,
  );
  assert.equal(protectedResult.protectionSource, "cardImmunity");
  assert.equal(protectedResult.discardAttacker, false);
});

test("Poison Heal protects the next attack regardless of creature class", () => {
  const predatorResult = resolveToxicConsumption(
    {
      attackerCard: { category: "predator" },
      toxicSourceCard: crownOfThorns,
      consumed: true,
      poisonHealActive: true,
    },
    () => 0,
  );
  assert.equal(predatorResult.protectionSource, "poisonHeal");
  assert.equal(predatorResult.discardAttacker, false);

  const fishResult = resolveToxicConsumption(
    {
      attackerCard: { category: "fish" },
      toxicSourceCard: crownOfThorns,
      consumed: true,
      poisonHealActive: true,
    },
    () => 0,
  );
  assert.equal(fishResult.protectionSource, "poisonHeal");
  assert.equal(fishResult.discardAttacker, false);
});

test("Regenerate creates an optional pending decision and spends RP only when chosen", () => {
  const decision = createRegenerateDecision({
    defenderCard: { id: "brittlestar", passives: ["Regenerate: If successfully attacked, you may spend 1RP to keep this card on your reef."] },
    defenderWasDefeated: true,
    controllerRp: 2,
  });
  assert.equal(decision.available, true);
  assert.equal(decision.pending, true);
  assert.deepEqual(resolveRegenerateDecision(decision, "discard"), {
    resolved: true,
    error: "",
    keepDefender: false,
    rpCost: 0,
  });
  assert.deepEqual(resolveRegenerateDecision(decision, "regenerate"), {
    resolved: true,
    error: "",
    keepDefender: true,
    rpCost: 1,
  });
});

test("Regenerate is unavailable without RP or after another survival effect", () => {
  const card = { id: "brittlestar", passives: ["Regenerate: If successfully attacked, you may spend 1RP to keep this card on your reef."] };
  assert.equal(createRegenerateDecision({ defenderCard: card, defenderWasDefeated: true, controllerRp: 0 }).available, false);
  assert.equal(createRegenerateDecision({ defenderCard: card, defenderWasDefeated: true, controllerRp: 2, survivalAlreadyApplied: true }).available, false);
});
