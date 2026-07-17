import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  STARTER_DECK_IDS,
  commitStarterSelection,
  recordPracticeDuelResult,
  recordTutorialCheckpoint,
} from "./adventureOnboarding.mjs";
import { createInitialAdventureSave } from "./adventureProgression.mjs";
import {
  addResourceWithinCap,
  calculateRpBankCap,
  calculateVictoryPoints,
  createSeededRandom,
  determineVictoryResult,
  drawWithHandLimit,
  resolveOpposedRoll,
} from "../simulator/gameRules.mjs";
import { attackCanTargetCard } from "../simulator/combatRules.mjs";
import { createStoryDuelResult } from "../simulator/storyModeContract.mjs";
import {
  SIMULATOR_TUTORIAL_ACTION_TYPES,
  createSimulatorTutorialContract,
  createSimulatorTutorialEvent,
  createSimulatorTutorialProgress,
  observeSimulatorTutorialEvent,
} from "../simulator/tutorialContract.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});

const { cardsById } = jiti(path.join(projectRoot, "src/data/cards/index.js"));
const { canCardOccupySlot } = jiti(path.join(projectRoot, "src/data/cards/types.js"));
const { prebuiltDecks } = jiti(path.join(projectRoot, "src/data/tournaments/prebuiltDecks.js"));

const VICTORY_TARGET = 10;
const PROFESSOR_DECK = prebuiltDecks.find((candidate) => candidate.id === "coral-garden");
const OPPONENT_TARGET = cardsById["arrow-crab"];

// These are deterministic, human-readable build plans rather than a second
// implementation of the Simulator AI. They exercise the same card records and
// exported rule/contract helpers used by Simulator.jsx. A component/browser
// match remains a separate end-to-end gate.
const STARTER_BUILD_PLANS = Object.freeze({
  "coral-garden": Object.freeze({
    foundations: Object.freeze([
      "boulder-star-coral-base",
      "boulder-star-coral-base",
    ]),
    creatures: Object.freeze([
      "frogfish",
      "french-angelfish",
      "french-angelfish",
      "french-angelfish",
    ]),
    habitats: Object.freeze([]),
    attackCardId: "frogfish",
    playOrder: Object.freeze([
      "boulder-star-coral-base",
      "boulder-star-coral-base",
      "frogfish",
      "french-angelfish",
      "french-angelfish",
      "french-angelfish",
    ]),
  }),
  "murky-water": Object.freeze({
    foundations: Object.freeze([
      "brain-coral-base",
      "brain-coral-base",
      "brain-coral-base",
      "brain-coral-base",
    ]),
    creatures: Object.freeze([
      "spanish-hogfish",
      "fairy-parrotfish",
      "sea-urchin",
      "emerald-crab",
      "octopus",
    ]),
    habitats: Object.freeze(["coral-reef"]),
    attackCardId: "spanish-hogfish",
    playOrder: Object.freeze([
      "brain-coral-base",
      "brain-coral-base",
      "brain-coral-base",
      "brain-coral-base",
      "spanish-hogfish",
      "fairy-parrotfish",
      "sea-urchin",
      "emerald-crab",
      "coral-reef",
      "octopus",
    ]),
  }),
  "blue-water": Object.freeze({
    foundations: Object.freeze([
      "boulder-star-coral-base",
      "boulder-star-coral-base",
      "boulder-star-coral-base",
    ]),
    creatures: Object.freeze([
      "frogfish",
      "fairy-parrotfish",
      "fairy-parrotfish",
      "picasso-triggerfish",
      "picasso-triggerfish",
    ]),
    habitats: Object.freeze([]),
    attackCardId: "frogfish",
    playOrder: Object.freeze([
      "boulder-star-coral-base",
      "boulder-star-coral-base",
      "boulder-star-coral-base",
      "frogfish",
      "fairy-parrotfish",
      "fairy-parrotfish",
      "picasso-triggerfish",
      "picasso-triggerfish",
    ]),
  }),
});

function expandDeck(deck) {
  return deck.cards.flatMap((entry) => (
    Array.from({ length: entry.quantity }, () => entry.cardId)
  ));
}

function requirePlanCardsInDeck(deck, plan) {
  const remaining = expandDeck(deck);
  for (const cardId of [...plan.foundations, ...plan.creatures, ...plan.habitats]) {
    const index = remaining.indexOf(cardId);
    assert.notEqual(index, -1, `${deck.id} is missing planned copy of ${cardId}`);
    remaining.splice(index, 1);
  }
}

function createFoundationSlots(plan) {
  return plan.foundations.flatMap((cardId, foundationIndex) => {
    const card = cardsById[cardId];
    assert.equal(card.kind, "coral", `${cardId} must be a Coral foundation`);
    assert.equal(Number(card.stage), 0, `${cardId} must be a base foundation`);
    return (card.slots ?? []).flatMap((slot, slotGroupIndex) => (
      Array.from({ length: slot.count ?? 1 }, (_, copyIndex) => ({
        ...slot,
        id: `${foundationIndex}:${slotGroupIndex}:${copyIndex}`,
        occupiedBy: null,
      }))
    ));
  });
}

function placeCreatures(plan) {
  const slots = createFoundationSlots(plan);
  for (const cardId of plan.creatures) {
    const card = cardsById[cardId];
    const slot = slots.find((candidate) => (
      candidate.occupiedBy === null && canCardOccupySlot(card, candidate)
    ));
    assert.ok(slot, `${cardId} needs a legal open slot in its ${plan.attackCardId} build plan`);
    slot.occupiedBy = cardId;
  }
  return slots;
}

function getAttack(card) {
  const abilities = [...(card.onPlay ?? []), ...(card.actions ?? [])];
  for (const ability of abilities) {
    const effects = [
      ...(ability.effects ?? []),
      ...(ability.effect ? [ability.effect] : []),
    ];
    const attack = effects.find((effect) => effect?.type === "attack");
    if (attack) return attack;
  }
  return null;
}

function assertPlanRequirements(plan) {
  const expectedCards = [...plan.foundations, ...plan.creatures, ...plan.habitats].sort();
  assert.deepEqual([...plan.playOrder].sort(), expectedCards, "play order must include every planned card exactly once");

  const cardsInPlay = [];
  for (const cardId of plan.playOrder) {
    const card = cardsById[cardId];
    const coralCount = cardsInPlay.filter((candidate) => candidate.kind === "coral").length;
    const fishCount = cardsInPlay.filter((candidate) => candidate.category === "fish").length;
    const invertebrateCount = cardsInPlay.filter((candidate) => candidate.category === "invertebrate").length;
    const cardIdsInPlay = new Set(cardsInPlay.map((candidate) => candidate.id));

    for (const requirement of card.playRequirements ?? []) {
      if (typeof requirement === "string") continue;
      if (requirement.type === "cardInPlay") {
        assert.equal(cardIdsInPlay.has(requirement.cardId), true, `${cardId} requires ${requirement.cardId}`);
      } else if (requirement.type === "ecosystemComposition") {
        assert.ok(coralCount >= Number(requirement.minimumCorals ?? 0), `${cardId} needs enough Corals`);
        assert.ok(fishCount >= Number(requirement.minimumFish ?? 0), `${cardId} needs enough Fish`);
        assert.ok(invertebrateCount >= Number(requirement.minimumInvertebrates ?? 0), `${cardId} needs enough Invertebrates`);
      } else {
        assert.fail(`${cardId} has an unsupported smoke-plan requirement: ${requirement.type}`);
      }
    }
    cardsInPlay.push(card);
  }
}

function getStartTurnIncome(cardsInPlay) {
  return cardsInPlay.reduce((total, card) => total + (card.passives ?? []).reduce((cardTotal, passive) => (
    cardTotal + (passive?.effect?.type === "gainResource" && passive.effect.resource === "rp"
      ? Number(passive.effect.amount ?? 0)
      : 0)
  ), 0), 0);
}

function fundBuildPlan(plan) {
  const cardsInPlay = [];
  let rp = 3;
  let collectionCount = 0;

  for (const cardId of plan.playOrder) {
    const card = cardsById[cardId];
    const cost = Number(card.cost?.rp ?? card.rp ?? 0);
    let guard = 0;
    while (rp < cost) {
      const income = getStartTurnIncome(cardsInPlay);
      assert.ok(income > 0, `${cardId} cannot be funded from the current ecosystem`);
      const cap = calculateRpBankCap(cardsInPlay);
      const nextRp = addResourceWithinCap(rp, income, cap);
      assert.ok(nextRp > rp, `${cardId} costs ${cost} RP but the ${cap} RP bank cannot reach it`);
      rp = nextRp;
      collectionCount += 1;
      guard += 1;
      assert.ok(guard < 20, `${cardId} funding did not converge`);
    }
    rp -= cost;
    cardsInPlay.push(card);
  }

  return { cardsInPlay, collectionCount, rp };
}

function event(contract, sequence, actionType, details, overrides = {}) {
  return createSimulatorTutorialEvent({
    eventId: `${contract.id}:smoke:${sequence}`,
    tutorialId: contract.id,
    actionType,
    actor: "player",
    phase: "main",
    round: 1,
    turn: 1,
    details,
    ...overrides,
  });
}

function applyTutorialObservation(contract, progress, save, tutorialEvent) {
  const observation = observeSimulatorTutorialEvent(contract, progress, tutorialEvent);
  let nextSave = save;
  for (const checkpointEvent of observation.checkpointEvents) {
    nextSave = recordTutorialCheckpoint(nextSave, checkpointEvent.checkpointId).save;
  }
  return { progress: observation.progress, save: nextSave };
}

function runStarterTableauContractSmoke(starterDeckId) {
  const deck = prebuiltDecks.find((candidate) => candidate.id === starterDeckId);
  const plan = STARTER_BUILD_PLANS[starterDeckId];
  assert.ok(deck, `Missing starter deck ${starterDeckId}`);
  assert.ok(plan, `Missing deterministic practice plan ${starterDeckId}`);
  requirePlanCardsInDeck(deck, plan);
  const slots = placeCreatures(plan);
  assertPlanRequirements(plan);
  const fundedPlan = fundBuildPlan(plan);
  assert.ok(fundedPlan.collectionCount > 0, `${starterDeckId} plan should exercise RP collection`);

  const inPlayCardIds = fundedPlan.cardsInPlay.map((card) => card.id);
  const playerVp = calculateVictoryPoints(
    inPlayCardIds.map((cardId) => cardsById[cardId]),
    inPlayCardIds,
  );
  assert.ok(playerVp >= VICTORY_TARGET, `${starterDeckId} plan stops at ${playerVp} VP`);

  const firstFoundation = cardsById[plan.foundations[0]];
  const startTurnIncome = getStartTurnIncome([firstFoundation]);
  const collectedRp = addResourceWithinCap(0, startTurnIncome, 8);
  assert.ok(collectedRp >= 1, `${firstFoundation.id} must fund the collection lesson`);

  const drawn = drawWithHandLimit([plan.attackCardId], 0, 1, 8);
  assert.deepEqual(drawn.cardsToHand, [plan.attackCardId]);
  assert.deepEqual(drawn.cardsToDiscard, []);

  const attackCard = cardsById[plan.attackCardId];
  const attack = getAttack(attackCard);
  assert.ok(attack?.attackDice, `${plan.attackCardId} must expose a structured attack`);
  assert.ok(
    PROFESSOR_DECK?.cards.some((entry) => entry.cardId === OPPONENT_TARGET?.id),
    "The legal target card type must be included in Professor Current's deck",
  );
  assert.ok(OPPONENT_TARGET?.defense?.dice, "The deterministic opponent target needs defense dice");
  assert.equal(
    attackCanTargetCard(OPPONENT_TARGET, attack),
    true,
    `${plan.attackCardId} must be able to target a card type in Professor Current's deck`,
  );
  const combat = resolveOpposedRoll(
    attack.attackDice,
    OPPONENT_TARGET.defense.dice,
    createSeededRandom(0x5ea5a1),
  );
  assert.equal(combat.resolved, true);

  const contract = createSimulatorTutorialContract({});
  let progress = createSimulatorTutorialProgress(contract);
  let save = commitStarterSelection(
    createInitialAdventureSave("profile-1"),
    starterDeckId,
  ).save;
  const earlyVp = calculateVictoryPoints([attackCard], [attackCard.id]);
  const events = [
    event(contract, 1, SIMULATOR_TUTORIAL_ACTION_TYPES.MATCH_READY, {
      foundationCount: 1,
      accepted: true,
    }, { phase: "setup", round: 0 }),
    event(contract, 2, SIMULATOR_TUTORIAL_ACTION_TYPES.RP_COLLECTED, {
      collected: collectedRp,
      bankBefore: 0,
      bankAfter: collectedRp,
      cap: 8,
    }, { phase: "draw" }),
    event(contract, 3, SIMULATOR_TUTORIAL_ACTION_TYPES.CARD_DRAWN, {
      count: drawn.drawnCards.length,
      toHandCount: drawn.cardsToHand.length,
      discardedCount: drawn.cardsToDiscard.length,
      accepted: true,
    }, { phase: "draw" }),
    event(contract, 4, SIMULATOR_TUTORIAL_ACTION_TYPES.CARD_BUILT, {
      cardId: attackCard.id,
      placement: "coral-slot",
      cost: Number(attackCard.cost?.rp ?? 0),
      accepted: slots.some((slot) => slot.occupiedBy === attackCard.id),
    }),
    event(contract, 5, SIMULATOR_TUTORIAL_ACTION_TYPES.VP_EARNED, {
      from: 0,
      to: earlyVp,
      delta: earlyVp,
    }),
    event(contract, 6, SIMULATOR_TUTORIAL_ACTION_TYPES.ATTACK_RESOLVED, {
      accepted: combat.resolved,
      attackerCardId: attackCard.id,
      targetCardId: OPPONENT_TARGET.id,
      attackTotal: combat.attack.total,
      defenseTotal: combat.defense.total,
      outcome: combat.attackerWins ? "consumed" : "defended",
    }),
    event(contract, 7, SIMULATOR_TUTORIAL_ACTION_TYPES.TURN_ENDED, {
      actionCount: 2,
      playerVp: earlyVp,
      accepted: true,
    }),
  ];

  for (const tutorialEvent of events) {
    ({ progress, save } = applyTutorialObservation(contract, progress, save, tutorialEvent));
  }
  assert.equal(progress.status, "complete");
  assert.equal(save.tutorial.status, "readyToTurnIn");

  const victory = determineVictoryResult(playerVp, 0, VICTORY_TARGET);
  assert.equal(victory?.winner, "player");
  const storyResult = createStoryDuelResult({
    encounterId: "encounter-shellshore-mentor-practice",
    opponentId: "academy-mentor",
    opponentName: "Professor Marlow Current",
    playerDeckId: starterDeckId,
    opponentDeckId: "coral-garden",
    victoryTarget: VICTORY_TARGET,
    difficulty: "easy",
    playerVp,
    opponentVp: 0,
    round: fundedPlan.collectionCount,
    turn: fundedPlan.collectionCount,
    message: victory.message,
  });
  assert.equal(storyResult.outcome, "victory");
  assert.equal(storyResult.completionReason, "vp-target");

  const adventureOutcome = storyResult.outcome === "victory" ? "won" : "lost";
  const completion = recordPracticeDuelResult(save, adventureOutcome);
  return { completion, playerVp, storyResult };
}

test("all starter tableaux can reach 10 VP and satisfy tutorial and reward contracts", () => {
  assert.deepEqual(Object.keys(STARTER_BUILD_PLANS), STARTER_DECK_IDS);

  for (const starterDeckId of STARTER_DECK_IDS) {
    const { completion, playerVp, storyResult } = runStarterTableauContractSmoke(starterDeckId);

    assert.ok(playerVp >= VICTORY_TARGET);
    assert.equal(storyResult.playerDeckId, starterDeckId);
    assert.equal(completion.completed, true);
    assert.equal(completion.rewardApplied, true);
    assert.deepEqual(completion.save.rewardLedger, ["reward-shellshore-tutorial"]);
    assert.deepEqual(completion.save.fieldNotes.entryIds, ["field-note-harbor-basics"]);
    assert.deepEqual(completion.save.world.unlockedRouteIds, ["route-shellshore-sunpatch"]);
  }
});
