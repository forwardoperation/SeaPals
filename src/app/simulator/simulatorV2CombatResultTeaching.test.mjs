import assert from "node:assert/strict";
import test from "node:test";
import {
  SIMULATOR_V2_COMBAT_TEACHING_STEP_COUNT,
  buildSimulatorV2CombatResultTeachingSteps,
  shouldTeachSimulatorV2CombatResult,
} from "./simulatorV2CombatResultTeaching.mjs";
import {
  SIMULATOR_V2_LESSON_CONCEPTS,
  getSimulatorV2Lesson,
} from "./simulatorV2Lessons.mjs";

const breakdown = {
  attack: {
    cardId: "porcupine-fish",
    actionName: "Crunch",
    total: 3,
    contributors: [{ id: "attack-roll", kind: "roll", label: "Attack roll", value: 3, detail: "D4" }],
  },
  defense: {
    cardId: "sea-urchin",
    total: 5,
    contributors: [{ id: "defense-roll", kind: "roll", label: "Defense roll", value: 5, detail: "D6" }],
  },
};

test("the first opposed result teaches the actual rolls, dice, comparison, and consequence", () => {
  const steps = buildSimulatorV2CombatResultTeachingSteps({
    breakdown,
    attackName: "Porcupine Fish",
    defenseName: "Sea Urchin",
    consequences: [
      { id: "bite-back", label: "Bite Back", detail: "dealt 10 damage" },
      { id: "defender-stays", label: "Sea Urchin", detail: "stays in play" },
    ],
  });

  assert.equal(steps.length, SIMULATOR_V2_COMBAT_TEACHING_STEP_COUNT);
  assert.deepEqual(steps.map(({ focus }) => focus), ["attack", "defense", "outcome"]);
  assert.match(steps[0].message, /Crunch.*rolled 3.*D4.*four-sided die/i);
  assert.match(steps[1].message, /Sea Urchin.*5.*D6.*six-sided die/i);
  assert.match(steps[2].message, /attacker must finish higher.*ties favor the defender/i);
  assert.match(steps[2].message, /3 is lower than 5.*attack is blocked.*Sea Urchin stays in play/i);
});

test("a tied faceoff explains that Defense holds", () => {
  const tied = {
    attack: {
      ...breakdown.attack,
      total: 4,
      contributors: [{ ...breakdown.attack.contributors[0], value: 4 }],
    },
    defense: {
      ...breakdown.defense,
      total: 4,
      contributors: [{ ...breakdown.defense.contributors[0], value: 4 }],
    },
  };
  const outcome = buildSimulatorV2CombatResultTeachingSteps({
    breakdown: tied,
    attackName: "Porcupine Fish",
    defenseName: "Sea Urchin",
  })[2];
  assert.match(outcome.message, /both totals are 4.*defense holds the tie/i);
});

test("combat teaching appears only when an embedded lesson still needs the attacking concept", () => {
  const firstAttack = getSimulatorV2Lesson("first-attack");
  const underAttack = getSimulatorV2Lesson("under-attack");
  const base = { eventType: "faceoff-result", breakdown, alreadyExplained: false };

  assert.equal(shouldTeachSimulatorV2CombatResult({ ...base, lesson: firstAttack }), true);
  assert.equal(shouldTeachSimulatorV2CombatResult({ ...base, lesson: underAttack }), true, "a direct Lesson 3 start still needs the prerequisite");
  assert.equal(shouldTeachSimulatorV2CombatResult({ ...base, lesson: null }), false);
  assert.equal(shouldTeachSimulatorV2CombatResult({ ...base, lesson: getSimulatorV2Lesson("first-reef") }), false);
  assert.equal(shouldTeachSimulatorV2CombatResult({ ...base, lesson: firstAttack, alreadyExplained: true }), false);
  assert.equal(shouldTeachSimulatorV2CombatResult({
    ...base,
    lesson: underAttack,
    previouslyTaughtConcepts: [SIMULATOR_V2_LESSON_CONCEPTS.ATTACKING],
  }), false);
  assert.equal(shouldTeachSimulatorV2CombatResult({
    ...base,
    lesson: firstAttack,
    eventType: "attack-evaded",
  }), false);
  assert.equal(shouldTeachSimulatorV2CombatResult({
    ...base,
    lesson: firstAttack,
    breakdown: { attack: breakdown.attack, defense: null },
  }), false);
});
