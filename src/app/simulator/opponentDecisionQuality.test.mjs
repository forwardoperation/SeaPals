import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getHardOpponentAttackRiskPenalty,
  scoreAutomatedAttackTargetOutcome,
  selectHardOpponentAttackPlan,
  selectProductiveOpponentSearchTargets,
} from "./opponentPlayRules.mjs";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

test("productive search targets exclude the source card regardless of deck order", () => {
  const options = {
    sourceCardId: "remote-search",
    amount: 1,
    scoreCandidate: () => 1,
  };

  assert.deepEqual(
    selectProductiveOpponentSearchTargets(
      ["remote-search", "coral-heal", "remote-search"],
      options,
    ),
    ["coral-heal"],
  );
  assert.deepEqual(
    selectProductiveOpponentSearchTargets(
      ["coral-heal", "remote-search"],
      options,
    ),
    ["coral-heal"],
  );
});

test("a search with only copies of its source has no productive targets", () => {
  assert.deepEqual(
    selectProductiveOpponentSearchTargets(
      ["remote-search", "remote-search", "remote-search"],
      {
        sourceCardId: "remote-search",
        amount: 1,
        scoreCandidate: () => 100,
      },
    ),
    [],
  );
});

test("productive search targets use a stable descending score and honor amount", () => {
  const scores = {
    recovery: 4,
    "coral-heal": 9,
    "poison-heal": 9,
    spearfishing: 2,
  };

  assert.deepEqual(
    selectProductiveOpponentSearchTargets(
      ["recovery", "coral-heal", "poison-heal", "spearfishing"],
      {
        sourceCardId: "remote-search",
        amount: 2,
        scoreCandidate: (cardId) => scores[cardId],
      },
    ),
    ["coral-heal", "poison-heal"],
    "equal scores should keep their original deck order",
  );
});

test("Hard search can reject currently wasteful matches before ranking", () => {
  assert.deepEqual(
    selectProductiveOpponentSearchTargets(
      ["coral-heal", "recovery", "restocking"],
      {
        sourceCardId: "remote-search",
        amount: 1,
        isCandidateProductive: (cardId) => cardId !== "coral-heal",
        scoreCandidate: (cardId) => cardId === "coral-heal" ? 100 : 50,
      },
    ),
    ["recovery"],
  );
});

const exposedToxicRisk = {
  targetIsToxic: true,
  attackerHasToxicProtection: false,
  attackerSelfDiscardsAfterConsume: false,
  attackerRetentionValue: 60,
  consumeSuccessProbability: 0.75,
  targetAvoidanceProbability: 0,
  actionOpportunityValue: 20,
};

test("Toxic creates a positive finite expected attacker-loss penalty", () => {
  const penalty = getHardOpponentAttackRiskPenalty(exposedToxicRisk);

  assert.ok(Number.isFinite(penalty));
  assert.ok(penalty > 0);
});

test("Toxic protection removes Toxic risk and inevitable self-discard adds no extra Toxic risk", () => {
  assert.equal(
    getHardOpponentAttackRiskPenalty({
      ...exposedToxicRisk,
      attackerHasToxicProtection: true,
    }),
    0,
    "card immunity and an active Poison Heal share the protection input",
  );
  const selfDiscardPenalty = getHardOpponentAttackRiskPenalty({
    ...exposedToxicRisk,
    attackerSelfDiscardsAfterConsume: true,
  });
  const selfDiscardWithoutToxic = getHardOpponentAttackRiskPenalty({
    ...exposedToxicRisk,
    targetIsToxic: false,
    attackerSelfDiscardsAfterConsume: true,
  });
  assert.equal(
    selfDiscardPenalty,
    selfDiscardWithoutToxic,
    "Toxic adds no attacker-loss risk when consuming already discards the attacker",
  );
});

test("target avoidance contributes an action-opportunity penalty without Toxic", () => {
  const penalty = getHardOpponentAttackRiskPenalty({
    targetIsToxic: false,
    attackerHasToxicProtection: false,
    attackerSelfDiscardsAfterConsume: false,
    attackerRetentionValue: 60,
    consumeSuccessProbability: 0.75,
    targetAvoidanceProbability: 0.5,
    actionOpportunityValue: 20,
  });

  assert.ok(Number.isFinite(penalty));
  assert.ok(penalty > 0);
});

test("automatic attacks prefer easier enemy targets and harder friendly targets", () => {
  const easyResolution = 0.8;
  const hardResolution = 0.2;
  const targetValue = 100;

  assert.ok(
    scoreAutomatedAttackTargetOutcome({
      targetValue,
      resolutionProbability: easyResolution,
    })
      > scoreAutomatedAttackTargetOutcome({
        targetValue,
        resolutionProbability: hardResolution,
      }),
    "an enemy target should be more attractive when the attack is likelier to land",
  );
  assert.ok(
    scoreAutomatedAttackTargetOutcome({
      targetValue,
      targetBelongsToAttacker: true,
      resolutionProbability: hardResolution,
    })
      > scoreAutomatedAttackTargetOutcome({
        targetValue,
        targetBelongsToAttacker: true,
        resolutionProbability: easyResolution,
      }),
    "a forced friendly attack should minimize expected friendly loss",
  );
});

function chooseTarget(targets, riskOverrides = {}) {
  const attacker = { id: "attacker" };
  return selectHardOpponentAttackPlan(
    [attacker],
    () => targets,
    {
      scorePair: (_candidateAttacker, target) => target.strategicValue
        - getHardOpponentAttackRiskPenalty({
          ...exposedToxicRisk,
          targetIsToxic: target.isToxic,
          ...riskOverrides,
        }),
    },
  );
}

test("Hard prefers a comparable safe target over an exposed Toxic target", () => {
  const safe = { id: "clownfish", strategicValue: 50, isToxic: false };
  // Porcupine Fish currently earns five extra base points for its Crunch
  // action, so this preserves the exact regression rather than relying on a tie.
  const toxic = { id: "porcupine-fish", strategicValue: 55, isToxic: true };

  assert.equal(chooseTarget([toxic, safe]).target, safe);
});

test("a finite risk penalty still permits a strategically superior Toxic target", () => {
  const toxicPenalty = getHardOpponentAttackRiskPenalty(exposedToxicRisk);
  const safe = { id: "safe-fish", strategicValue: 50, isToxic: false };
  const valuableToxic = {
    id: "valuable-toxic-fish",
    strategicValue: 51 + toxicPenalty,
    isToxic: true,
  };

  assert.ok(Number.isFinite(toxicPenalty));
  assert.equal(chooseTarget([safe, valuableToxic]).target, valuableToxic);
});

test("an exposed Toxic card remains selectable when it is the only legal target", () => {
  const onlyTarget = {
    id: "porcupine-fish",
    strategicValue: 1,
    isToxic: true,
  };

  assert.equal(chooseTarget([onlyTarget]).target, onlyTarget);
});

test("opponent support eligibility and resolution share one productive search choice", () => {
  const supportStart = simulatorSource.indexOf("const scoreSupport = (cardId) =>");
  const supportEnd = simulatorSource.indexOf("function runOpponentAttackStep", supportStart);
  const supportSource = simulatorSource.slice(supportStart, supportEnd);

  assert.ok(supportStart >= 0 && supportEnd > supportStart);
  assert.match(supportSource, /selectProductiveOpponentSearchTargets\(matchingCards/);
  assert.match(supportSource, /supportIsImmediatelyUseful/);
  assert.match(supportSource, /isCandidateProductive:/);
  assert.match(supportSource, /const hasSearchTarget = searchCandidates\.length > 0/);
  assert.match(supportSource, /const candidates = searchCandidates/);
});

test("both ordinary Hard attacks and automatic Lionfish attacks price target hazards", () => {
  const riskCalls = simulatorSource.match(/getHardOpponentAttackRiskPenalty\(\{/g) ?? [];

  assert.equal(riskCalls.length, 2);
  assert.match(simulatorSource, /targetIsToxic: isToxicWhenConsumed\(entry\.card\)/);
  assert.match(simulatorSource, /targetIsToxic: isToxicWhenConsumed\(candidate\.card\)/);
  assert.match(simulatorSource, /scoreAutomatedAttackTargetOutcome\(\{/);
});
