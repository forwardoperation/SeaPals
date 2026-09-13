import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  getSimulatorV2Lesson,
  getSimulatorV2LessonActionBlock,
} from "./simulatorV2Lessons.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const simulatorSource = readFileSync(path.join(projectRoot, "src/app/simulator/Simulator.jsx"), "utf8");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});
const { cardsById } = jiti(path.join(projectRoot, "src/data/cards/index.js"));
const { CardKind, canCardOccupySlot } = jiti(path.join(projectRoot, "src/data/cards/types.js"));

function sourceSection(startMarker, endMarker) {
  const start = simulatorSource.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = simulatorSource.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return simulatorSource.slice(start, end);
}

function extractFunction(functionName, followingFunctionName) {
  return sourceSection(`function ${functionName}(`, `function ${followingFunctionName}(`);
}

function createProductionInitialGameFactory() {
  return new Function("cardsById", "CardKind", "canCardOccupySlot", "dependencies", [
    "const { createFoundationOpening, createDeck, shuffle, conditionCards, removeOneCard } = dependencies;",
    "const defaultDeckId = 'runtime-integration-deck';",
    "const isFoundationCard = (card) => card?.kind === CardKind.CORAL;",
    "const createScriptedTutorialScenario = () => { throw new Error('Prepared V2 lessons must bypass the legacy scripted scenario.'); };",
    extractFunction("createCoralSlots", "getSlotIdentity"),
    extractFunction("createInitialGameState", "createOpponentStartingCorals"),
    extractFunction("createOpponentStartingCorals", "createScriptedTutorialOpponentCorals"),
    extractFunction("createScriptedTutorialOpponentCorals", "getOnPlayCoralDamage"),
    "return createInitialGameState;",
  ].join("\n"))(cardsById, CardKind, canCardOccupySlot, {
    createFoundationOpening: () => Array.from({ length: 8 }, () => "mustard-hill-coral-base"),
    createDeck: () => Array.from({ length: 8 }, () => "clownfish"),
    shuffle: (cards) => [...cards],
    conditionCards: [cardsById["clear-water"]],
    removeOneCard: (cards, cardId) => {
      const next = [...cards];
      const index = next.indexOf(cardId);
      if (index >= 0) next.splice(index, 1);
      return next;
    },
  });
}

test("prepared V2 lessons hydrate authored player, Habitat, and opponent state through the production initializer", () => {
  const createInitialGameState = createProductionInitialGameFactory();
  const seed = {
    foundationDeck: ["brain-coral-stage-2"],
    palsDeck: ["flounder"],
    hand: ["coral-heal"],
    conditionDeck: ["clear-water"],
    playerTableau: [{
      foundationCardId: "brain-coral-base",
      placements: [{ cardId: "sea-urchin", slotClass: "invertebrate" }],
      health: 7,
      maxHealth: 12,
      statuses: [{ type: "stunned", sourceCardId: "crown-of-thorns" }],
      rpPenaltyNextTurn: 2,
      playedTurn: 4,
      stageEnteredTurn: 3,
    }],
    playerHabitats: [{
      cardId: "open-ocean",
      instanceId: "prepared-open-ocean",
      currentHealth: 25,
      maxHealth: 40,
    }],
    opponentTableau: [{
      foundationCardId: "mustard-hill-coral-base",
      placements: [{ cardId: "porcupine-fish", slotClass: "fish" }],
    }],
    opponent: {
      foundationDeck: [],
      palsDeck: ["blue-whale"],
      hand: ["coral-gardener"],
      habitats: ["coral-reef"],
      habitatInstances: [{ instanceId: "opponent-habitat", cardId: "coral-reef", currentHealth: 40, maxHealth: 40 }],
      reefCreatures: ["halfbeak"],
      reefCreatureInstances: [{ instanceId: "opponent-halfbeak", cardId: "halfbeak" }],
      orphanCreatures: [{ instanceId: "opponent-orphan", cardId: "sea-urchin", hostedCardIds: [] }],
      rp: 0,
    },
    rp: 8,
    gamePhase: "main",
    round: 3,
    turn: 2,
    startingPlayer: "player",
    hasDrawnThisTurn: true,
    activeConditionId: "clear-water",
    opponentTurnMode: "play",
  };

  const prepared = createInitialGameState("player-deck", "opponent-deck", () => 0.5, {
    preparedLesson: { seed },
  });

  assert.equal(prepared.scriptedTutorialScenario, null);
  for (const key of ["foundationDeck", "palsDeck", "hand", "conditionDeck"]) {
    assert.deepEqual(prepared[key], seed[key]);
    assert.notEqual(prepared[key], seed[key], `${key} must be copied into mutable game state`);
  }
  for (const key of ["rp", "gamePhase", "round", "turn", "startingPlayer", "hasDrawnThisTurn", "activeConditionId", "opponentTurnMode"]) {
    assert.equal(prepared[key], seed[key]);
  }

  assert.equal(prepared.playerCorals.length, 1);
  const [playerFoundation] = prepared.playerCorals;
  assert.deepEqual(
    {
      cardId: playerFoundation.cardId,
      health: playerFoundation.health,
      maxHealth: playerFoundation.maxHealth,
      statuses: playerFoundation.statuses,
      rpPenaltyNextTurn: playerFoundation.rpPenaltyNextTurn,
      playedTurn: playerFoundation.playedTurn,
      stageEnteredTurn: playerFoundation.stageEnteredTurn,
    },
    {
      cardId: "brain-coral-base",
      health: 7,
      maxHealth: 12,
      statuses: [{ type: "stunned", sourceCardId: "crown-of-thorns" }],
      rpPenaltyNextTurn: 2,
      playedTurn: 4,
      stageEnteredTurn: 3,
    },
  );
  assert.equal(playerFoundation.name, cardsById["brain-coral-base"].name);
  assert.equal(playerFoundation.image, cardsById["brain-coral-base"].image);
  assert.ok(Number.isFinite(playerFoundation.x) && Number.isFinite(playerFoundation.y));
  assert.equal(playerFoundation.slots.find((slot) => slot.cardId === "sea-urchin")?.cardInstanceId?.startsWith("tutorial-player-"), true);

  assert.deepEqual(prepared.playerHabitatInstances, [{
    instanceId: "prepared-open-ocean",
    cardId: "open-ocean",
    currentHealth: 25,
    maxHealth: 40,
  }]);
  assert.deepEqual(prepared.opponent.foundationDeck, []);
  assert.deepEqual(prepared.opponent.palsDeck, ["blue-whale"]);
  assert.deepEqual(prepared.opponent.hand, ["coral-gardener"]);
  assert.deepEqual(prepared.opponent.habitats, ["coral-reef"]);
  assert.deepEqual(prepared.opponent.habitatInstances, seed.opponent.habitatInstances);
  assert.deepEqual(prepared.opponent.reefCreatures, ["halfbeak"]);
  assert.deepEqual(prepared.opponent.reefCreatureInstances, seed.opponent.reefCreatureInstances);
  assert.deepEqual(prepared.opponent.orphanCreatures, seed.opponent.orphanCreatures);
  assert.equal(prepared.opponent.rp, 0, "an authored zero-RP opponent bank must not fall back to three");
  assert.equal(prepared.opponent.corals[0].slots.some((slot) => slot.cardId === "porcupine-fish"), true);

  for (const key of ["foundationDeck", "palsDeck", "hand", "habitats", "habitatInstances", "reefCreatures", "reefCreatureInstances", "orphanCreatures"]) {
    assert.notEqual(prepared.opponent[key], seed.opponent[key], `opponent ${key} must have its own mutable array`);
  }
});

test("prepared Habitat hydration rejects missing or non-Habitat cards", () => {
  const createInitialGameState = createProductionInitialGameFactory();
  const baseSeed = {
    foundationDeck: [],
    palsDeck: [],
    hand: [],
    conditionDeck: ["clear-water"],
    playerTableau: [],
    opponentTableau: [],
    opponent: {},
  };

  for (const cardId of ["missing-habitat", "sea-urchin"]) {
    assert.throws(
      () => createInitialGameState("player-deck", "opponent-deck", () => 0.5, {
        preparedLesson: { seed: { ...baseSeed, playerHabitats: [cardId] } },
      }),
      new RegExp(`Unknown prepared lesson Habitat: ${cardId}`),
    );
  }
});

test("Simulator starts an embedded lesson from the hydrated board and scores its seeded permanents", () => {
  const initialization = sourceSection(
    "const tutorialVpRef = useRef({",
    "const [bubbleBursts, setBubbleBursts] = useState([]);",
  );

  assert.match(initialization, /player:\s*getEcosystemVictoryPoints\([\s\S]*?initialGame\.playerCorals \?\? \[\][\s\S]*?initialGame\.playerHabitatInstances[\s\S]*?initialGame\.playerReefCreatureInstances/);
  assert.match(initialization, /const \[playerCorals, setPlayerCorals\] = useState\(initialGame\.playerCorals \?\? \[\]\)/);
  assert.match(initialization, /const \[playerHabitatInstances, setPlayerHabitatInstances\] = useState\(initialGame\.playerHabitatInstances \?\? \[\]\)/);
  assert.match(initialization, /const \[playerReefCreatureInstances, setPlayerReefCreatureInstances\] = useState\(initialGame\.playerReefCreatureInstances \?\? \[\]\)/);
  assert.match(initialization, /const \[playerOrphanCreatureInstances, setPlayerOrphanCreatureInstances\] = useState\(initialGame\.playerOrphanCreatureInstances \?\? \[\]\)/);

  const turnInitialization = sourceSection(
    "const [activeConditionId, setActiveConditionId]",
    "const [turnDrawSelection, setTurnDrawSelection]",
  );
  assert.match(turnInitialization, /useState\(initialGame\.activeConditionId \?\? null\)/);
  assert.match(turnInitialization, /useState\(initialGame\.round \?\? 0\)/);
  assert.match(turnInitialization, /useState\(initialGame\.gamePhase \?\? "setup"\)/);
  assert.match(turnInitialization, /useState\(initialGame\.startingPlayer \?\? null\)/);
  assert.match(turnInitialization, /useState\(initialGame\.turn \?\? 1\)/);
  assert.match(turnInitialization, /useState\(initialGame\.rp \?\? 3\)/);
  assert.match(turnInitialization, /useState\(initialGame\.hasDrawnThisTurn \?\? false\)/);
});

test("a resolved Support emits the lesson event only after its committed game updates", () => {
  const supportEvent = sourceSection(
    "function applyExplicitSupportLock(card)",
    "function chooseScientistJes(mode)",
  );
  assert.match(supportEvent, /SIMULATOR_TUTORIAL_ACTION_TYPES\.SUPPORT_PLAYED/);
  assert.match(supportEvent, /accepted:\s*true/);
  assert.match(supportEvent, /cardId:\s*card\.id/);
  assert.match(supportEvent, /supportCardId:\s*card\.id/);
  assert.match(supportEvent, /cardName:\s*card\.name/);
  assert.match(supportEvent, /locksFurtherSupports:\s*supportExplicitlyLocksFurtherSupports\(card\)/);
  assert.match(supportEvent, /\}, \{ phase: "main" \}\)/);

  const searchedSupport = sourceSection(
    "function completeSupportSearch(cardId)",
    "function toggleSupportSearchCard(cardId)",
  );
  const supportCommitIndex = searchedSupport.indexOf("applyExplicitSupportLock(supportCard)");
  assert.ok(searchedSupport.indexOf("setHand(") < supportCommitIndex);
  assert.ok(searchedSupport.indexOf("setDiscardPile(") < supportCommitIndex);
  assert.ok(searchedSupport.indexOf("setRp(") < supportCommitIndex);

  const statusClear = sourceSection(
    "function completeCoralStatusClear(coralId)",
    "function toggleRestockCard(candidateIndex)",
  );
  assert.ok(statusClear.indexOf("statuses: []") < statusClear.indexOf("spendResolvedSupport(supportCard)"));
  const resolvedSupport = sourceSection(
    "function spendResolvedSupport(supportCard)",
    "function chooseInspectionDeck(deckType)",
  );
  assert.ok(resolvedSupport.indexOf("setHand(") < resolvedSupport.indexOf("applyExplicitSupportLock(supportCard)"));
  assert.ok(resolvedSupport.indexOf("setDiscardPile(") < resolvedSupport.indexOf("applyExplicitSupportLock(supportCard)"));
  assert.ok(resolvedSupport.indexOf("setRp(") < resolvedSupport.indexOf("applyExplicitSupportLock(supportCard)"));
});

test("committing an opponent faceoff emits an opponent-scoped attack lesson event with stable identities", () => {
  const opponentAttackEvents = sourceSection(
    "function buildOpponentAttackEventSequence(",
    "function preserveOpponentNormalActionsAfterOnPlay(",
  );
  assert.match(opponentAttackEvents, /type:\s*step\.noLegalTarget \? "opponent-impact" : "faceoff-result"/);
  assert.match(opponentAttackEvents, /attackerCardId:\s*step\.attackerCardId/);
  assert.match(opponentAttackEvents, /targetInstanceId:\s*step\.targetInstanceId \?\? null/);
  assert.match(opponentAttackEvents, /combatAttackerOwner:\s*"opponent"/);
  assert.match(opponentAttackEvents, /combatDefenderOwner:\s*"player"/);

  const commitEvent = sourceSection(
    "function commitEventState(event)",
    "function continueAfterPresentedEvent(event, remainingEvents = [])",
  );
  assert.match(commitEvent, /if \(embeddedLesson && event\?\.type === "faceoff-result" && event\.combatAttackerOwner === "opponent"\)/);
  assert.match(commitEvent, /SIMULATOR_TUTORIAL_ACTION_TYPES\.ATTACK_RESOLVED/);
  assert.match(commitEvent, /attackerCardId:\s*event\.attackerCardId \?\? event\.sourceCardId \?\? null/);
  assert.match(commitEvent, /defenderCardId:\s*event\.defenderCardId \?\? null/);
  assert.match(commitEvent, /targetInstanceId:\s*event\.targetInstanceId \?\? null/);
  assert.match(commitEvent, /outcome:\s*event\.combatOutcome \?\? null/);
  assert.match(commitEvent, /discardedCardId:\s*event\.combatDiscardCue\?\.cardId \?\? null/);
  assert.match(commitEvent, /destinationZone:\s*event\.combatDiscardCue\?\.destinationZone \?\? null/);
  assert.match(commitEvent, /attackerWins:\s*Boolean\(event\.attackerWins\)/);
  assert.match(commitEvent, /resolvedCount:\s*event\.attackNumber \?\? 1/);
  assert.match(commitEvent, /requiredCount:\s*event\.attackCount \?\? 1/);
  assert.match(commitEvent, /\}, \{ actor: "opponent", phase: "opponent" \}\)/);
});

test("resolving a player attack reports the defender identity required by lesson checkpoints", () => {
  const completion = sourceSection(
    "function completePlayerAttackStep(",
    "function getAttackSequenceContinuationMessage(",
  );
  assert.match(completion, /defenderCardId\s*=\s*null/);
  assert.match(completion, /attackerCardId:\s*attackContext\?\.attackerCardId \?\? null,[\s\S]*?defenderCardId,[\s\S]*?targetInstanceId/);

  const attackResolution = sourceSection(
    "function resolvePlayerAttack(",
    "function applyPlayerOnPlayDeckDiscard(",
  );
  const completedSteps = attackResolution.match(/completePlayerAttackStep\([\s\S]*?\);/g) ?? [];
  assert.equal(completedSteps.length, 5, "every player attack resolution path should complete through one telemetry helper");
  for (const completedStep of completedSteps) {
    assert.match(completedStep, /defenderCardId:\s*targetEntry\.card\.id/);
  }
});

test("embedded lesson wiring follows the live checkpoint for layout, draws, and defeat coaching", () => {
  const lessonBlock = sourceSection(
    "function getEmbeddedLessonBlock(action, details = {})",
    "function notifyTutorialCallback(name, ...args)",
  );
  assert.match(lessonBlock, /layoutLessonProgress:\s*tutorialLayoutProgress/);
  assert.match(simulatorSource, /discardPileCardIds:\s*discardPile/);
  assert.ok(
    [...simulatorSource.matchAll(/getSimulatorV2ExpectedDraw\(embeddedLesson, tutorialCurrentCheckpoint\)/g)].length >= 3,
    "desktop adjustment, draw confirmation, and the mobile tray use the active authored draw checkpoint",
  );
});

test("each embedded lesson chooses observation or a real opponent turn from its own seed", () => {
  const endTurn = sourceSection(
    "function endTurn()",
    "function resolveOpponentTurn({",
  );
  assert.match(endTurn, /const opponentTurnMode = embeddedLesson\?\.seed\?\.opponentTurnMode \?\? scriptedTutorialScenario\?\.opponentTurnMode/);
  assert.match(endTurn, /const thinkingDelay = opponentTurnMode === "observe"/);

  const opponentTurn = sourceSection(
    "function resolveOpponentTurn({",
    "function cancelOpeningCoinFlip()",
  );
  assert.match(opponentTurn, /\(embeddedLesson\?\.seed\?\.opponentTurnMode \?\? scriptedTutorialScenario\?\.opponentTurnMode\) === "observe"/);
  assert.match(opponentTurn, /queueEvents\(\[\{[\s\S]*?title:\s*"Your Turn"[\s\S]*?advanceRoundAfterClose:\s*true/);
  assert.match(opponentTurn, /if \([\s\S]*?=== "observe"\)[\s\S]*?return;[\s\S]*?const turnEvents = \[\]/);
});

test("round collection reports the Condition and which Corals were blocked or produced RP", () => {
  const startRound = sourceSection(
    "function startRound(nextRound,",
    "function beginOpeningOpponentTurn()",
  );

  assert.match(startRound, /const blockedFoundationCount = playerCoralsAtTurnStart\.filter\([\s\S]*?conditionPreventsCoralIncome/);
  assert.match(startRound, /const producingFoundationCount = playerCoralsAtTurnStart\.filter\([\s\S]*?!coralIsStunned[\s\S]*?!conditionPreventsCoralIncome[\s\S]*?getCardStartTurnRp/);
  assert.match(startRound, /details:\s*\{[\s\S]*?conditionId:\s*condition\?\.id \?\? null,[\s\S]*?blockedFoundationCount,[\s\S]*?producingFoundationCount/);
  assert.match(startRound, /emitTutorialEvent\([\s\S]*?SIMULATOR_TUTORIAL_ACTION_TYPES\.RP_COLLECTED,[\s\S]*?tutorialRpEvent\.details/);
});

test("Blue Crab Scavenge is gated to its authored lesson step and emits committed recovery evidence", () => {
  const lesson = getSimulatorV2Lesson("first-attack");
  const checkpoint = lesson.contract.checkpoints.find(({ id }) => id === "v2-recover-sea-urchin");
  assert.ok(checkpoint);

  const gate = (details) => getSimulatorV2LessonActionBlock({
    lesson,
    checkpoint,
    action: "utility",
    gamePhase: "main",
    ...details,
  });
  assert.equal(gate({ cardId: "blue-crab", actionId: "scavenge", actionName: "Scavenge" }), "");
  assert.match(gate({ cardId: "porcupine-fish", actionId: "scavenge", actionName: "Scavenge" }), /highlighted lesson step/);
  assert.match(gate({ cardId: "blue-crab", actionId: "invented", actionName: "Scavenge" }), /highlighted lesson step/);
  assert.match(gate({ cardId: "blue-crab", actionId: "scavenge", actionName: "Search" }), /highlighted lesson step/);

  const beginAbility = sourceSection(
    "function beginCreatureUtilityAction(action)",
    "function completeCreatureRecovery(cardId)",
  );
  assert.match(beginAbility, /getEmbeddedLessonBlock\("utility", \{[\s\S]*?cardId:\s*sourceCard\.id,[\s\S]*?actionId:\s*action\.id \?\? null,[\s\S]*?actionName/);

  const completeRecovery = sourceSection(
    "function completeCreatureRecovery(cardId)",
    "function completeCreatureActionSearch(cardId)",
  );
  assert.match(completeRecovery, /abilityRecoveryTargets\?\.\[tutorialCurrentCheckpoint\?\.id\]/);
  assert.match(completeRecovery, /if \(expectedTutorialTarget && cardId !== expectedTutorialTarget\) return;/);
  const eventIndex = completeRecovery.indexOf("SIMULATOR_TUTORIAL_ACTION_TYPES.ABILITY_RESOLVED");
  assert.ok(eventIndex > completeRecovery.indexOf("setDiscardPile("));
  assert.ok(eventIndex > completeRecovery.indexOf("setHand("));
  assert.ok(eventIndex > completeRecovery.indexOf("setRp("));
  assert.match(completeRecovery, /sourceCardId:\s*sourceCard\.id/);
  assert.match(completeRecovery, /actionId:\s*pendingAction\.action\?\.id \?\? null/);
  assert.match(completeRecovery, /actionName:\s*pendingAction\.actionName \?\? getActionName\(pendingAction\.action\)/);
  assert.match(completeRecovery, /targetCardId:\s*cardId/);
  assert.match(completeRecovery, /recoveredCardId:\s*cardId/);
  assert.match(completeRecovery, /fromZone:\s*"discard"/);
  assert.match(completeRecovery, /destinationZone,/);
  assert.match(completeRecovery, /accepted:\s*true/);
  assert.match(completeRecovery, /\}, \{ phase: "main" \}\)/);
});
