import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as boardEvaluation from "./opponentBoardEvaluation.mjs";
import * as strategy from "./opponentPlayRules.mjs";
import * as difficultyRules from "./opponentDifficultyRules.mjs";
import * as conditions from "./conditionRules.mjs";
import { getResourceGainFromActions } from "./gameRules.mjs";
import { evaluateHabitatComposition, getHabitatRequirementError } from "./habitatRules.mjs";
import { createSchoolDensityBucketState, getEcosystemSchoolDensityCommitted } from "./schoolDensityRules.mjs";
import { canHostSpecialPlacement, getRequiredOceanicPredatorCount, placeCardInSpecialHost } from "./zoneRules.mjs";

const source = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  assert.ok(start >= 0 && end > start, `Missing simulator decision block: ${startText}`);
  return source.slice(start, end);
}

const sharedFunctions = [
  sourceBetween("function getCardStartTurnRp(", "function conditionPreventsCoralIncome("),
  sourceBetween("function getCompositionRequirementError(", "function createCoralId("),
  sourceBetween("function createCoralSlots(", "function removeLastCard("),
].join("\n");
const playCostFunctions = sourceBetween("    const findUpgradeTarget =", "    const getOpponentSchoolDensityState =");
const decisionCode = sourceBetween("    const getPermanentPlayMetrics =", "    if (!playable) {");

const CardKind = { CORAL: "coral", CREATURE: "creature", HABITAT: "habitat", SUPPORT: "support" };
const CardCategory = { FISH: "fish", PREDATOR: "predator", APEX: "apex", INVERTEBRATE: "invertebrate" };
const CreatureZone = { REEF: "reef", OCEAN: "ocean" };
const isCreatureSchool = (card) => Boolean(card?.tags?.includes("creature-school"));
const isFoundationCard = (card) => card?.kind === "coral" || isCreatureSchool(card);

// Execute the simulator's actual metrics, cost, filtering, and selection code.
// Only the surrounding React state and unrelated combat phase are substituted.
function decide({ cards, hand, playable = hand, corals = [], reefCreatures = [], habitats = [], rp = 10, difficulty = "hard", victoryTarget = 30, schoolDensityConditionIds = [] }) {
  const state = {
    hand: [...hand], corals, reefCreatures, habitats, rp,
    reefCreatureInstances: reefCreatures.map((cardId, index) => ({ cardId, instanceId: `ocean-${index}` })),
    orphanCreatures: [], schoolDensityCommitmentsByInstanceId: {}, conditionDensityUses: {},
  };
  const context = {
    ...boardEvaluation,
    ...strategy,
    ...difficultyRules,
    ...conditions,
    CardKind, CardCategory, CreatureZone,
    cardsById: cards,
    next: state,
    playableCards: [...playable],
    opponentDifficulty: difficulty,
    victoryTarget,
    turn: 4,
    activeCondition: null,
    schoolDensityConditionIds,
    playerCorals: [], playerOrphanCreatures: [], playerReefCreatures: [],
    threatProfile: { level: "setup" },
    isFoundationCard,
    isCreatureSchool,
    getResourceGainFromActions,
    getRequiredOceanicPredatorCount,
    getHabitatRequirementError,
    evaluateHabitatComposition,
    canHostSpecialPlacement,
    placeCardInSpecialHost,
    getSlotCardIds: (slot) => [slot.cardId, ...(slot.hostedCardIds ?? [])].filter(Boolean),
    coralIsStunned: (foundation) => Boolean(foundation.stunned),
    getCardPlayCost: (card) => Number(card.cost?.rp ?? 0),
    getOpposingPlayCostModifier: () => 0,
    getConditionPlayRestriction: () => "",
    cardUsesOpponentReef: () => false,
    canCardOccupySlot: (card, slot) => (slot.accepts ?? []).includes(card.class),
    getOnPlayAttackEffect: (card) => card?.onPlayAttack ?? null,
    getBasicAttackEffect: (card) => card?.attack ?? null,
    opponentAttackHasLegalTarget: (_card, attack) => Boolean(attack),
    getAttackRpReserve: () => 0,
    cardHasSymbiosis: (card) => card?.onPlay?.some((action) => action.id === "symbiosis"),
    getOpponentDensityFreedByRequiredSacrifices: () => 0,
    getOpponentSchoolDensityState: (next) => createSchoolDensityBucketState(next.corals,
      getEcosystemSchoolDensityCommitted({
        foundations: next.corals,
        reefCreatureInstances: next.reefCreatureInstances,
        orphanCreatureInstances: next.orphanCreatures,
        commitmentsByInstanceId: next.schoolDensityCommitmentsByInstanceId,
      }, cards, "opponent"), cards),
  };
  return new Function(...Object.keys(context), `
    ${sharedFunctions}
    ${playCostFunctions}
    ${decisionCode}
    return {
      choice: playable,
      metrics: Object.fromEntries(playableCards.map((id) => [id, getPermanentPlayMetrics(id)])),
      scores: Object.fromEntries(playableCards.map((id) => [id, scoreOpponentPlay(id)])),
    };
  `)(...Object.values(context));
}

function coral(id, { vp = 0, income = 1, cost = 2, stage = 0, nextCardId, slots = [] } = {}) {
  return {
    id, name: id, kind: "coral", stage, victoryPoints: vp, cost: { rp: cost }, slots,
    passives: [`Collect ${income} RP at the start of your turn.`],
    ...(nextCardId ? { upgrade: { canUpgrade: true, nextCardId, cost: { rp: 2 } } } : {}),
  };
}
function fish(id, { vp = 2, cost = 2, density = 0, ...rest } = {}) {
  return {
    id, name: id, kind: "creature", category: "fish", class: "fish", zone: "ocean",
    victoryPoints: vp, cost: { rp: cost }, schoolDensityRequirement: density,
    tags: ["oceanic"], ...rest,
  };
}
function foundation(cardId, id = cardId, slots = []) {
  return { id, cardId, slots, playedTurn: 1, stageEnteredTurn: 1, health: 60, maxHealth: 60 };
}

test("actual permanent metrics price an upgrade at its net VP, income, and upgrade cost", () => {
  const cards = { base: coral("base", { vp: 4, income: 2, nextCardId: "upgrade" }), upgrade: coral("upgrade", { vp: 5, income: 3, cost: 9, stage: 1 }) };
  const result = decide({ cards, hand: ["upgrade"], corals: [foundation("base")], victoryTarget: 8 });
  assert.equal(result.metrics.upgrade.vpGain, 1);
  assert.equal(result.metrics.upgrade.incomeGain, 1);
  assert.equal(result.metrics.upgrade.cost, 2);
  assert.equal(result.metrics.upgrade.projectedVp, 5);
  assert.equal(result.metrics.upgrade.reachesVictory, false);
});

test("actual permanent selection takes a real win over a falsely winning upgrade on every level", () => {
  const cards = { base: coral("base", { vp: 4, nextCardId: "upgrade" }), upgrade: coral("upgrade", { vp: 5, stage: 1 }), finisher: fish("finisher", { vp: 3 }) };
  for (const difficulty of ["easy", "medium", "hard"]) {
    const result = decide({ cards, hand: ["upgrade", "finisher"], corals: [foundation("base")], victoryTarget: 7, difficulty });
    assert.equal(result.choice, "finisher", difficulty);
    assert.equal(result.metrics.upgrade.reachesVictory, false, difficulty);
    assert.equal(result.metrics.finisher.reachesVictory, true, difficulty);
  }
});

test("actual scoring plays the first free habitat for its passives and holds a duplicate", () => {
  const cards = { abyss: { id: "abyss", name: "Abyss", kind: "habitat", cost: { rp: 0 }, victoryPoints: 0 } };
  for (const difficulty of ["easy", "medium", "hard"]) {
    assert.equal(decide({ cards, hand: ["abyss"], difficulty }).choice, "abyss", difficulty);
    assert.equal(decide({ cards, hand: ["abyss"], habitats: ["abyss"], difficulty }).choice, null, difficulty);
  }
});

test("actual density projection rewards a school upgrade that unlocks a fish this turn", () => {
  const cards = {
    base: { ...coral("base", { nextCardId: "upgrade" }), schoolDensity: 20 },
    upgrade: { ...coral("upgrade", { stage: 1 }), schoolDensity: 100 },
    fish: fish("fish", { density: 70 }),
  };
  const result = decide({ cards, hand: ["upgrade", "fish"], playable: ["upgrade"], corals: [foundation("base")] });
  assert.equal(result.metrics.upgrade.schoolDensityGain, 80);
  assert.equal(result.metrics.upgrade.unlocksCards, 1);
  assert.equal(result.metrics.upgrade.affordableUnlocks, 1);
});

test("actual composition projection does not promise density consumed by its current fish", () => {
  const cards = {
    base: { ...coral("base"), schoolDensity: 100 },
    existing: fish("existing", { density: 0 }),
    setup: fish("setup", { density: 70 }),
    predator: fish("predator", { density: 90, category: "predator", class: "predator", playRequirements: ["Requires 2 Oceanic Fish in your ecosystem."] }),
  };
  const result = decide({ cards, hand: ["setup", "predator"], playable: ["setup"], corals: [foundation("base")], reefCreatures: ["existing"] });
  assert.equal(result.metrics.setup.unlocksCards, 0, "the second fish leaves only 30 density for a 90-density predator");
  assert.equal(result.metrics.setup.affordableUnlocks, 0);
});

test("actual VP projection includes Symbiosis's free Clownfish when choosing a win", () => {
  const cards = {
    base: coral("base", { vp: 27 }),
    anemone: fish("anemone", { vp: 1, category: "invertebrate", class: "invertebrate", zone: "reef", tags: ["anemone"], clownSlots: 2, onPlay: [{ id: "symbiosis" }] }),
    clownfish: fish("clownfish", { vp: 2, zone: "reef", tags: ["clownfish"], passives: [{ effect: { type: "specialPlacement", allowedHostTags: ["anemone"] } }] }),
  };
  const corals = [foundation("base", "base", [{ id: "slot", cardId: null, accepts: ["invertebrate", "fish"] }])];
  for (const difficulty of ["easy", "medium", "hard"]) {
    const result = decide({ cards, hand: ["clownfish", "anemone"], corals, difficulty });
    assert.equal(result.metrics.anemone.projectedVp, 30, difficulty);
    assert.equal(result.metrics.anemone.reachesVictory, true, difficulty);
    assert.equal(result.choice, "anemone", difficulty);
  }
});

test("actual density projection spends the one-use discount before valuing the next predator", () => {
  const cards = {
    base: { ...coral("base"), schoolDensity: 150 },
    setup: fish("setup", { density: 80, category: "predator", class: "predator" }),
    follower: fish("follower", { density: 120, category: "predator", class: "predator", playRequirements: ["Requires 1 Oceanic Predator in your ecosystem."] }),
  };
  const scenario = { cards, hand: ["setup", "follower"], playable: ["setup"], corals: [foundation("base")], schoolDensityConditionIds: ["sardine-run"] };
  assert.equal(decide(scenario).metrics.setup.unlocksCards, 0, "the first predator spends the discount and leaves 100 density for a 120-density follower");
  assert.equal(decide({ ...scenario, cards: { ...cards, base: { ...cards.base, schoolDensity: 170 } } }).metrics.setup.unlocksCards, 1,
    "another 20 density makes the followup legal without reusing the discount");
});

test("actual permanent metrics remove an Apex's sacrificed predator before checking victory", () => {
  const cards = {
    predator: fish("predator", { vp: 7, category: "predator", class: "predator" }),
    apex: fish("apex", { vp: 8, category: "apex", class: "apex", specialRules: ["Discard one Oceanic Predator or two Oceanic Fish."] }),
  };
  const result = decide({ cards, hand: ["apex"], reefCreatures: ["predator"], victoryTarget: 10 });
  assert.equal(result.metrics.apex.currentVp, 7);
  assert.equal(result.metrics.apex.projectedVp, 8);
  assert.equal(result.metrics.apex.vpGain, 1);
  assert.equal(result.metrics.apex.reachesVictory, false);
});
