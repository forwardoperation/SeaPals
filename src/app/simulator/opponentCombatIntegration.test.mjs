import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as combat from "./combatRules.mjs";
import * as aiCombat from "./opponentCombatRules.mjs";
import * as actions from "./opponentActionRules.mjs";
import * as strategy from "./opponentPlayRules.mjs";
import { OpponentDifficulty } from "./opponentDifficultyRules.mjs";

const source = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
function simulatorFunction(name, nextName, context) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start + 1);
  assert.ok(start >= 0 && end > start);
  return new Function(...Object.keys(context), `return (${source.slice(start, end).trim()});`)(...Object.values(context));
}

function decide({ difficulty = "hard", cards, attackers, targets, statuses = {}, rp = 4, actionUses = {}, onPlayAttack = null, planOnly = false, planCombatOnly = false, random = () => 0.5 }) {
  const stopAfterSelection = {};
  let captured = null;
  const context = {
    ...combat,
    ...aiCombat,
    ...actions,
    ...strategy,
    OpponentDifficulty,
    opponentDifficulty: difficulty,
    cardsById: cards,
    turn: 3,
    rp: 0,
    creatureStatuses: {},
    resilienceUsedCardIds: [],
    playerHabitats: [],
    reconcileCreatureZone: (entries) => {
      assert.equal(planOnly || planCombatOnly, false, "read-only planning must not allocate random legacy instance IDs");
      return entries;
    },
    getBasicAttackEffect: (card) => card?.attack,
    getSlotActionKey: (slot) => slot.id,
    getSlotTargetInstanceId: (slot) => slot.cardInstanceId,
    getLionfishSlotInstanceId: (_coral, slot) => slot.cardInstanceId,
    getLocallyControlledOrphans: (entries) => entries,
    getInvasiveCreatureTargets: () => [],
    getInvasiveOrphanTargets: () => [],
    getDynamicAttackRepeat: (_card, attack) => attack.repeat ?? 1,
    getCardStartTurnRp: (card) => card?.income ?? 0,
    cardMatchesAttackTarget: (card) => Boolean(card),
    cardIsHiddenByAbyss: () => false,
    cardCanTargetHiddenByAbyss: () => false,
    isCreatureSchool: (card) => Boolean(card?.school),
    assessCurrentOpponentThreat: () => ({ level: "setup" }),
    getDefenseAdjustment: (attack) => ({ flat: attack.defensePenalty ?? 0, ignoresBonuses: Boolean(attack.ignoresBonuses) }),
    getAttackConditionalModifier: () => ({ flat: 0 }),
    getHostedDefenseBonusDice: () => null,
    cardHasAncientResilience: (card) => Boolean(card.resilience),
    cardHasAttackAdvantage: () => false,
    getRolledAttackBonus: () => ({ flat: 0 }),
    coralIsStunned: () => false,
    calculateAttachedCreatureDefenseBonus: (card) => card?.shelter ?? 0,
    getTargetAvoidance: () => null,
    cardHasScatter: () => false,
    getBiteBackAttack: (card) => card.counter,
    formatAttackTargetFamilies: () => "",
    nextGameplayRandom: random,
  };
  const run = simulatorFunction("runOpponentAttackStep", "runOpponentAttack", context);
  const state = {
    corals: [],
    reefCreatures: attackers,
    reefCreatureInstances: attackers.map((cardId, index) => ({ cardId, instanceId: `attacker-${index}` })),
    orphanCreatures: [],
    habitats: [],
    actionUses,
    rp,
  };
  const originalState = structuredClone(state);
  try {
    const result = run(state, [], targets.map((cardId, index) => ({ cardId, instanceId: `target-${index}` })), [], onPlayAttack, [], {
      creatureStatuses: statuses,
      planOnly,
      planCombatOnly,
      captureCombatPlan: (plan) => {
        captured = plan;
        if (!planCombatOnly) throw stopAfterSelection;
      },
    });
    if (planOnly) {
      assert.equal(captured, null);
      assert.deepEqual(state, originalState, "planning must leave the board and RP unchanged");
      return result;
    }
    if (planCombatOnly) {
      assert.deepEqual(state, originalState, "combat planning must leave the board and RP unchanged");
      return { result, captured };
    }
    assert.equal(result, null, "unselected optional combat should pass");
  } catch (error) {
    if (error !== stopAfterSelection) throw error;
  }
  return captured;
}

const attacker = (id, dice = "D6", options = {}) => ({ id, name: id, defense: "D4", victoryPoints: 3, cost: { rp: 4 }, attack: { actionName: "Bite", attackDice: dice, actionCost: 1 }, ...options });
const target = (id, options = {}) => ({ id, name: id, defense: "D4", victoryPoints: 2, cost: { rp: 2 }, ...options });

test("actual simulator selection for every level avoids an impossible high-VP defender", () => {
  const cards = { hunter: attacker("hunter", "D4"), armored: target("armored", { defense: "D4+3", victoryPoints: 20 }), fish: target("fish") };
  for (const difficulty of ["easy", "medium", "hard"]) {
    const selected = decide({ difficulty, cards, attackers: ["hunter"], targets: ["armored", "fish"] });
    assert.equal(selected.targetInstanceId, "target-1");
  }
});

test("actual simulator Medium and Hard compare both attackers", () => {
  const cards = { weak: attacker("weak", "D4"), strong: attacker("strong", "D12"), fish: target("fish", { defense: "D6" }) };
  for (const difficulty of ["medium", "hard"]) {
    const selected = decide({ difficulty, cards, attackers: ["weak", "strong"], targets: ["fish"] });
    assert.equal(selected.forcedAttack.cardId, "strong");
  }
});

test("actual defense action statuses change target selection", () => {
  const cards = { hunter: attacker("hunter"), valuable: target("valuable", { victoryPoints: 3 }), exposed: target("exposed") };
  const initial = { cards, attackers: ["hunter"], targets: ["valuable", "exposed"] };
  assert.equal(decide(initial).targetInstanceId, "target-0");
  assert.equal(decide({ ...initial, statuses: { "reef-target-0": [{ type: "defenseBonusDice", dice: "D12" }] } }).targetInstanceId, "target-1");
});

test("actual optional attacks pass suicidal Toxic trades but mandatory On Play still attacks", () => {
  const cards = {
    hunter: attacker("hunter", "D12", { victoryPoints: 10 }),
    toxic: target("toxic", { victoryPoints: 0, cost: { rp: 0 }, passives: [{ effect: { type: "toxicWhenEaten" } }] }),
  };
  assert.equal(decide({ cards, attackers: ["hunter"], targets: ["toxic"] }), null);
  const selected = decide({ cards, attackers: ["hunter"], targets: ["toxic"], onPlayAttack: { cardId: "hunter", reefInstanceId: "attacker-0", attack: cards.hunter.attack } });
  assert.equal(selected.targetInstanceId, "target-0");
});

test("actual attack selection respects once-per-turn action uses", () => {
  const cards = { hunter: attacker("hunter"), fish: target("fish") };
  const key = actions.getOpponentActionUseKey("reef-attacker-0", cards.hunter.attack);
  assert.equal(decide({ cards, attackers: ["hunter"], targets: ["fish"], actionUses: { [key]: 3 } }), null);
});

test("planning-only reports productive affordable unused attackers without resolving or mutating combat", () => {
  const cards = {
    weak: attacker("weak", "D4"),
    strong: attacker("strong", "D12"),
    costly: attacker("costly", "D20", { attack: { actionName: "Bite", attackDice: "D20", actionCost: 9 } }),
    armored: target("armored", { defense: "D4+3" }),
  };
  const result = decide({ cards, attackers: ["weak", "strong", "costly"], targets: ["armored"], planOnly: true });
  assert.equal(result.profitableAttacks.length, 1);
  assert.equal(result.profitableAttacks[0].cardId, "strong");
  assert.equal(result.profitableAttacks[0].actionCost, 1);
  assert.ok(result.profitableAttacks[0].value > 0);
  const key = actions.getOpponentActionUseKey("reef-attacker-1", cards.strong.attack);
  assert.deepEqual(decide({ cards, attackers: ["weak", "strong"], targets: ["armored"], actionUses: { [key]: 3 }, planOnly: true }).profitableAttacks, []);
});

test("Scatter recognizes both printed re-roll wording and the legacy wording", () => {
  const hasScatter = simulatorFunction("cardHasScatter", "getDynamicAttackRepeat", {});
  assert.equal(hasScatter({ passives: ["Scatter: Opponent re-rolls their first successful attack."] }), true);
  assert.equal(hasScatter({ passives: ["Scatter: Opponent rerolls successful attacks."] }), true);
  assert.equal(hasScatter({ passives: [{ text: "Scatter: Opponent re-rolls their first successful attack." }] }), true);
  assert.equal(hasScatter({ passives: ["Massive: Gain advantage on defense."] }), false);
});

function runSequence({ maxAttackSteps = Infinity, continuation = null, planCombatOnly = false } = {}) {
  const calls = [];
  const attack = { attackDice: "D6", actionName: "Group Hunt", actionCost: 2, repeat: 3 };
  const forcedAttack = { cardId: "tuna", reefInstanceId: "original-tuna", attack };
  const context = {
    rp: 10,
    creatureStatuses: {},
    resilienceUsedCardIds: [],
    blueCrabRecycleUsedTurn: null,
    playerHabitats: [],
    activeCondition: null,
    turn: 3,
    cardsById: { tuna: { id: "tuna" } },
    normalizeProjectedOpponentState: (state) => state,
    reconcileOpponentInstances: (_old, state) => state,
    reconcileCreatureZone: (entries) => entries,
    reconcileFoundationHealthToFixedPoint: (corals, _reef, orphans) => ({ corals, orphans }),
    getEcosystemRpCap: () => 20,
    getDynamicAttackRepeat: () => 3,
    getBasicAttackEffect: () => attack,
    runOpponentAttackStep: (_opponent, corals, reef, orphans, forced, excluded, controller) => {
      calls.push({ forced, prepaid: controller.actionCostAlreadyPaid, excluded: [...excluded], remaining: controller.remainingAttacks, planCombatOnly: controller.planCombatOnly });
      controller.captureCombatPlan({ forcedAttack });
      return { corals, reefCreatureInstances: reef, orphanCreatures: orphans, attackerCardId: "tuna", targetInstanceId: `target-${calls.length}`, actionCost: 2, opponentAttackActionKey: calls.length === 1 ? "original-tuna:group-hunt" : null, summary: "Attack resolved." };
    },
  };
  const run = simulatorFunction("runOpponentAttack", "buildOpponentAttackEventSequence", context);
  const result = run({ corals: [], reefCreatureInstances: [], orphanCreatures: [], habitats: [] }, [], [], [], null, continuation, { maxAttackSteps, planCombatOnly });
  return { calls, result, forcedAttack };
}

test("live opponent planning propagates a pure plan-only pass before combat rolls", () => {
  const plannedSequence = runSequence({ planCombatOnly: true });
  assert.equal(plannedSequence.calls.length, 1);
  assert.equal(plannedSequence.calls[0].planCombatOnly, true);
  assert.equal(plannedSequence.result.targetInstanceId, "target-1");
  assert.equal(plannedSequence.result.steps, undefined, "planning returns before aggregating a resolved combat sequence");

  let randomCalls = 0;
  const cards = { hunter: attacker("hunter", "D6"), fish: target("fish", { defense: "D6" }) };
  const { result, captured } = decide({
    cards,
    attackers: ["hunter"],
    targets: ["fish"],
    planCombatOnly: true,
    random: () => {
      randomCalls += 1;
      return 0.5;
    },
  });
  assert.equal(captured.attackDice, "D6");
  assert.equal(captured.defenseDice, "D6");
  assert.equal(result.attackerCardId, "hunter");
  assert.equal(result.defenderCardId, "fish");
  assert.equal(result.attackerWins, undefined, "planning returns before attack and defense resolution");
  assert.equal(randomCalls, 0, "planning must not advance the gameplay random stream");
});

test("actual repeated attack controller locks attacker, pays once, and excludes used targets", () => {
  const { calls, result, forcedAttack } = runSequence();
  assert.equal(calls.length, 3);
  assert.equal(calls[0].forced, null);
  assert.deepEqual(calls[1].forced, forcedAttack);
  assert.deepEqual(calls[2].forced, forcedAttack);
  assert.deepEqual(calls.map((call) => call.prepaid), [false, true, true]);
  assert.deepEqual(calls[2].excluded, ["target-1", "target-2"]);
  assert.equal(result.actionCost, 2);
  assert.equal(result.opponentAttackActionKey, "original-tuna:group-hunt");
});

test("live-roll continuation retains original attacker and remaining paid attacks", () => {
  const initial = runSequence({ maxAttackSteps: 1 });
  assert.equal(initial.calls.length, 1);
  assert.equal(initial.result.nextContinuation.remainingAttacks, 2);
  const resumed = runSequence({ continuation: initial.result.nextContinuation });
  assert.equal(resumed.calls.length, 2);
  assert.deepEqual(resumed.calls[0].forced, initial.forcedAttack);
  assert.ok(resumed.calls.every((call) => call.prepaid));
  assert.deepEqual(resumed.calls.map((call) => call.remaining), [2, 1]);
  assert.deepEqual(resumed.calls[0].excluded, ["target-1"]);
});
