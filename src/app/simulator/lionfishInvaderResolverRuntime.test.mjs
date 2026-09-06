import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const resolverStart = simulatorSource.indexOf("function resolveHostTurnLionfishInvaders({");
const resolverEnd = simulatorSource.indexOf("function createDeck(", resolverStart);

assert.notEqual(resolverStart, -1, "missing Lionfish resolver");
assert.notEqual(resolverEnd, -1, "missing Lionfish resolver end marker");

const resolverSource = simulatorSource.slice(resolverStart, resolverEnd);

function createRuntimeResolver({ regenerate = false } = {}) {
  const invader = {
    cardId: "lionfish",
    controller: "player",
    instanceId: "player-lionfish-in-opponent-reef",
    location: "slot",
    coralId: "opponent-coral",
    slotId: "invader-slot",
  };
  const targetCard = {
    id: "target-fish",
    name: "Target Fish",
    category: "fish",
    cost: { rp: 2 },
    defense: { dice: "D4" },
    victoryPoints: 1,
  };
  const target = {
    cardId: targetCard.id,
    card: targetCard,
    category: "fish",
    controller: "opponent",
    physicalController: "opponent",
    instanceId: "opponent-target-fish",
    location: "slot",
    coralId: "opponent-coral",
    slotId: "target-slot",
  };
  const dependencies = {
    cloneLionfishTurnControllerState: (state) => structuredClone(state),
    collectTriggerableHostTurnLionfishInvaders: () => [invader],
    collectHostTurnLionfishInvaders: () => [invader],
    getLionfishStateOrphans: (state, controller) => (
      controller === "player" ? state.orphanCreatureInstances : state.orphanCreatures
    ) ?? [],
    hasAnyLionfishInvaderTarget: () => true,
    getLionfishOwnedFishTargets: (_states, controller) => controller === "opponent" ? [target] : [],
    resolveLionfishInvaderCoin: () => "heads",
    getLionfishInvaderTargetController: () => "opponent",
    selectLionfishInvaderTarget: (candidates) => candidates[0] ?? null,
    isCreatureSchool: () => false,
    rollDie: () => ({ total: 1 }),
    applyDamage: () => ({ destroyed: false, remainingHealth: 10 }),
    removeLionfishBoardEntry: () => ({ removed: true, hostedCardIds: [] }),
    routeLionfishDestroyedCard: () => {},
    destroyedCardGoesToLostZone: () => false,
    triggerFlashingAlarm: (value) => value,
    getTargetAvoidance: () => null,
    resolveOpposedRoll: () => ({
      resolved: true,
      attack: { total: 1 },
      defense: { total: 2 },
    }),
    getHostedTargetSlotId: () => "hosted-target",
    getOrphanHostedTargetSlotId: () => "orphan-hosted-target",
    getSlotActionKey: (slot) => slot?.id ?? "target-slot",
    hasDefenseAdvantage: () => false,
    attackerHasDisadvantageFromMassive: () => false,
    createCombatResolutionRandom: () => () => 0,
    coralIsStunned: () => false,
    calculateAttachedCreatureDefenseBonus: () => 0,
    getHostedDefenseBonusDice: () => null,
    getCloakDefenseBonus: () => 0,
    getDarknessShroudDefenseBonus: () => 0,
    cardHasAncientResilience: () => false,
    createRegenerateDecision: () => ({ available: regenerate }),
    resolveRegenerateDecision: () => ({ keepDefender: true, rpCost: 1 }),
    resolveToxicConsumption: () => ({ triggered: false, discardAttacker: false }),
    shouldSelfDiscardAfterConsume: () => false,
    cardsById: {
      coral: { id: "coral", name: "Coral" },
      lionfish: { id: "lionfish", name: "Lionfish" },
      [targetCard.id]: targetCard,
    },
  };
  const names = Object.keys(dependencies);
  const factory = new Function(...names, `"use strict"; ${resolverSource}; return resolveHostTurnLionfishInvaders;`);
  return factory(...names.map((name) => dependencies[name]));
}

function createStates() {
  return {
    playerState: {
      corals: [],
      reefCreatureInstances: [],
      orphanCreatureInstances: [],
      discardPile: [],
      lostZone: [],
      creatureStatuses: {},
      resilienceUsedCardIds: [],
      rp: 0,
      flashingAlarmAttackBonus: 0,
      poisonImmunityNextPredatorAttack: false,
    },
    opponentState: {
      corals: [{
        id: "opponent-coral",
        cardId: "coral",
        slots: [
          { id: "invader-slot", cardId: "lionfish", cardInstanceId: "player-lionfish-in-opponent-reef" },
          { id: "target-slot", cardId: "target-fish", cardInstanceId: "opponent-target-fish" },
        ],
      }],
      habitats: [],
      reefCreatureInstances: [],
      reefCreatures: [],
      orphanCreatures: [],
      discardPile: [],
      lostZone: [],
      creatureStatuses: {},
      resilienceUsedCardIds: [],
      rp: 2,
      flashingAlarmAttackBonus: 0,
      poisonImmunityNextPredatorAttack: false,
    },
  };
}

test("ordinary Lionfish combat constructs a result when the defender wins", () => {
  const resolveLionfish = createRuntimeResolver();
  const result = resolveLionfish({
    ...createStates(),
    hostController: "opponent",
    forcedPlans: [{ coinResult: "heads" }],
    combatRollPackets: [{ attack: 1, defense: 2 }],
  });

  assert.equal(result.triggeredCount, 1);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].attackerWins, false);
  assert.equal(result.events[0].rpSpend, null);
});

test("ordinary Lionfish combat keeps Regenerate spend data available to the result event", () => {
  const resolveLionfish = createRuntimeResolver({ regenerate: true });
  const result = resolveLionfish({
    ...createStates(),
    hostController: "opponent",
    forcedPlans: [{ coinResult: "heads" }],
    combatRollPackets: [{ attack: 3, defense: 1 }],
  });

  assert.equal(result.triggeredCount, 1);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].attackerWins, true);
  assert.equal(result.events[0].rpSpend.amount, 1);
  assert.equal(result.events[0].rpSpend.owner, "opponent");
});
