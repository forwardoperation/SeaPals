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
import { getPreparedTutorialFoundationPlacement } from "./tutorialLayoutLesson.mjs";

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

test("Lesson 1 teaches Coral weaknesses on the board without a generic hand over the print", () => {
  const genericCue = sourceSection(
    "function EmbeddedLessonActionCue(",
    "function ProfessorCoachOverlay(",
  );
  assert.match(
    genericCue,
    /help\.target === "coral-weakness"\) return null/,
    "the small printed weakness area needs its own arrow rather than the tap-hand halo",
  );
  assert.match(
    simulatorSource,
    /data-v2-coral-weakness-arrow/,
    "Brain Coral's in-play card should expose a dedicated weakness callout",
  );
  const boardCard = sourceSection("{playerCorals.map((coral) => {", "{guidedFoundationPlacementTarget ? (");
  assert.match(boardCard, /coral\.cardId === "brain-coral-base"[\s\S]*?data-v2-coral-weakness-arrow|data-v2-coral-weakness-arrow[\s\S]*?coral\.cardId === "brain-coral-base"/);
  assert.match(boardCard, /data-v2-coral-weakness-arrow[\s\S]*?role="img"[\s\S]*?aria-label="Brain Coral weakness: Disease"/);
  const weaknessCallout = sourceSection(
    'data-v2-coral-weakness-arrow="true"',
    "{isRpSourceFocusTarget ? (",
  );
  assert.match(weaknessCallout, /data-v2-coral-weakness-pointer="true"/);
  assert.match(
    weaknessCallout,
    /data-v2-coral-weakness-pointer="true"\s+className="[^"]*\bbottom-full\b[^"]*left-1\/2[^"]*h-8 w-10[^"]*-translate-x-1\/2[^"]*"/,
    "the pointer must stop above the highlighted Weakness area instead of covering its icon",
  );
  assert.equal((weaknessCallout.match(/M 20 2 L 20 24 L 13 17 M 20 24 L 27 17/g) ?? []).length, 2);
  assert.match(weaknessCallout, /fill="none"[\s\S]*?stroke="#071827" strokeWidth="9"[\s\S]*?stroke="#fde047" strokeWidth="4"/);
  assert.doesNotMatch(weaknessCallout, /bottom-\[10%\]|left-\[28%\]|M 70 4 C 60 5 50 18 39 48|fill="#fde047"/);
  const cameraFocus = sourceSection(
    "if (!weaknessFocusActive) return undefined;",
    "if (!compactRpSourceZoomActive) return undefined;",
  );
  assert.match(cameraFocus, /playerCorals\.find\(\(coral\) => coral\.cardId === "brain-coral-base"\)/);
  assert.match(cameraFocus, /setInspectedCard\(null\)/, "a previously opened card inspector must clear before the board close-up");
  assert.match(cameraFocus, /commitBoardCamera\("player", \{[\s\S]*?zoom,[\s\S]*?getVisibleAreaFitOffset/);
  assert.match(cameraFocus, /commitBoardCamera\("player", weaknessCameraBeforeRef\.current\)/, "Continue should restore the prior view");
});

test("Lesson 1 teaches Brain Coral's Photosynthesis before the RP flight", () => {
  const cameraFocus = sourceSection(
    "if (!compactRpSourceZoomActive) return undefined;",
    "if (!playerLayoutSignature || playerViewportTouched || tutorialBoardCardFocusActive) return undefined;",
  );
  const boardCard = sourceSection("{playerCorals.map((coral) => {", "{guidedFoundationPlacementTarget ? (");

  assert.match(cameraFocus, /rpSourceCameraBeforeRef\.current = playerCameraRef\.current/);
  assert.match(cameraFocus, /Math\.min\(2\.15/);
  assert.match(cameraFocus, /commitBoardCamera\("player", rpSourceCameraBeforeRef\.current\)/);
  assert.match(boardCard, /data-v2-coral-rp-source-arrow="true"/);
  assert.match(boardCard, /aria-label="Brain Coral Photosynthesis: collect 1 RP at the start of your turn\."/);
  assert.match(boardCard, /Photosynthesis · \+1 RP/);
  const rpSourceCallout = sourceSection(
    'data-v2-coral-rp-source-arrow="true"',
    "<CoralUpgradeCelebration",
  );
  assert.match(rpSourceCallout, /data-v2-coral-rp-source-pointer="true"/);
  assert.match(rpSourceCallout, /left-1\/2[\s\S]*?-translate-x-1\/2/);
  assert.equal((rpSourceCallout.match(/M 28 2 L 28 44 L 18 34 M 28 44 L 38 34/g) ?? []).length, 2);
  assert.match(rpSourceCallout, /fill="none"[\s\S]*?stroke="#071827" strokeWidth="9"[\s\S]*?stroke="#fde047" strokeWidth="4"/);
  assert.doesNotMatch(rpSourceCallout, /right-\[8%\]|fill="#fde047"|M 31 40 L 42 59 L 53 40/);
  assert.match(simulatorSource, /const tutorialBoardCardFocusActive = weaknessFocusActive \|\| compactRpSourcePresentationActive/);
});

function createProductionInitialGameFactory() {
  return new Function("cardsById", "CardKind", "canCardOccupySlot", "getPreparedTutorialFoundationPlacement", "dependencies", [
    "const { createFoundationOpening, createDeck, shuffle, conditionCards, removeOneCard } = dependencies;",
    "const defaultDeckId = 'runtime-integration-deck';",
    "const isFoundationCard = (card) => card?.kind === CardKind.CORAL;",
    "const createScriptedTutorialScenario = () => { throw new Error('Prepared V2 lessons must bypass the legacy scripted scenario.'); };",
    extractFunction("createCoralSlots", "getSlotIdentity"),
    extractFunction("createInitialGameState", "createOpponentStartingCorals"),
    extractFunction("createOpponentStartingCorals", "createScriptedTutorialOpponentCorals"),
    extractFunction("createScriptedTutorialOpponentCorals", "getOnPlayCoralDamage"),
    "return createInitialGameState;",
  ].join("\n"))(cardsById, CardKind, canCardOccupySlot, getPreparedTutorialFoundationPlacement, {
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

test("Lesson 2 enters the opponent-turn pipeline only after the player's opening attack", () => {
  const lesson = getSimulatorV2Lesson("first-attack");
  assert.equal(lesson.autoEndOpeningTurn, true);
  assert.equal(lesson.checkpoints[0]?.id, "tutorial-attack");
  assert.equal(lesson.checkpoints[1]?.id, "v2-pass-to-counterattack");

  const automaticOpening = sourceSection(
    "tutorialRuntime?.lessonStarted === true",
    "if (!embeddedLesson || !tutorialCurrentCheckpoint) return;",
  );

  assert.match(automaticOpening, /embeddedLesson\?\.autoEndOpeningTurn === true/);
  assert.match(automaticOpening, /tutorialCurrentCheckpoint\?\.id === "v2-pass-to-counterattack"/);
  assert.doesNotMatch(
    automaticOpening,
    /tutorialCurrentCheckpoint\?\.id === "tutorial-attack"/,
    "starting Lesson 2 must leave the player in control until the opening attack resolves",
  );
  assert.match(automaticOpening, /gamePhase === "main"/);
  assert.match(automaticOpening, /eventOverlay/);
  assert.match(automaticOpening, /!combatResultCheckpoint/);
  assert.match(automaticOpening, /!consumedAttackFlight/);
  assert.match(automaticOpening, /modal/);
  assert.match(automaticOpening, /gameResult/);
  assert.match(automaticOpening, /autoEndedEmbeddedOpeningTurnRef\.current/);
  assert.match(automaticOpening, /window\.queueMicrotask/);
  assert.ok(
    automaticOpening.indexOf("autoEndedEmbeddedOpeningTurnRef.current = true")
      < automaticOpening.indexOf("endTurn();"),
    "the per-mount guard is committed before the automatic turn request",
  );

  const endTurnFlow = extractFunction("endTurn", "resolveOpponentTurn");
  assert.match(endTurnFlow, /SIMULATOR_TUTORIAL_ACTION_TYPES\.TURN_ENDED/);
  assert.match(endTurnFlow, /beginCompactTurnSequence\(/);
  assert.match(endTurnFlow, /continueAfterPresentedEvent\(opponentTurnEvent, \[\]\)/);
});

test("Lesson 2 explains both dice and the defender's tie advantage before the opening faceoff", () => {
  const openingFaceoff = sourceSection(
    "const lessonTwoOpeningFaceoff = Boolean(",
    "const scriptedScavengeInteraction =",
  );

  assert.match(openingFaceoff, /embeddedLesson\?\.id === "first-attack"/);
  assert.match(openingFaceoff, /tutorialCurrentCheckpoint\?\.id === "tutorial-attack"/);
  assert.match(openingFaceoff, /eventOverlay\?\.type === "faceoff-ready"/);
  assert.match(openingFaceoff, /Porcupine Fish uses Crunch.s D4 attack die/);
  assert.match(openingFaceoff, /Sea Urchin uses its printed D6 defense die/);
  assert.match(openingFaceoff, /a tie goes to Sea Urchin as the defender/);
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

test("embedded lesson slot targets gate click, drag, highlighting, and repair stale placements", () => {
  const slotGate = extractFunction("getEmbeddedLessonPlacementBlock", "createConsumedAttackFlightPlan");
  assert.match(slotGate, /getEmbeddedLessonBlock\("place-card"/);
  assert.match(slotGate, /foundationCardId:\s*coral\.cardId/);
  assert.match(slotGate, /slotClass/);
  assert.match(slotGate, /slotOrdinal/);

  const placementCommit = extractFunction("placeCardToSlot", "placeCoralInEcosystem");
  const blockIndex = placementCommit.indexOf("getEmbeddedLessonPlacementBlock(slot, cardId)");
  assert.ok(blockIndex >= 0, "the authoritative placement handler checks the V2 target");
  assert.ok(blockIndex < placementCommit.indexOf("getPlayError(card)"));
  assert.ok(blockIndex < placementCommit.indexOf("setPlayerCorals(nextPlayerCorals)"));

  const mobileDrop = extractFunction("resolveMobileHandDrop", "handleMobileHandDragStart");
  assert.ok(
    [...mobileDrop.matchAll(/getEmbeddedLessonPlacementBlock\(/g)].length >= 2,
    "direct and nearby mobile drops use the same V2 placement target",
  );
  assert.match(simulatorSource, /const embeddedLessonPlacementAllowed = !activePlacementCardId[\s\S]*?getEmbeddedLessonPlacementBlock\(slot, activePlacementCardId\)[\s\S]*?const validTarget = Boolean\([\s\S]*?embeddedLessonPlacementAllowed/);
  assert.match(simulatorSource, /embeddedLessonDragCardIds\.filter[\s\S]*?!getEmbeddedLessonPlacementBlock\(slot, cardId\)[\s\S]*?data-v2-lesson-drop-cards/);
  assert.match(simulatorSource, /useLayoutEffect\(\(\) => \{[\s\S]*?repairSimulatorV2LessonPlacementConflict\([\s\S]*?foundations:\s*current/);
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
    "function completeCreatureRecovery(cardId, sourceElement = null)",
  );
  assert.match(beginAbility, /getEmbeddedLessonBlock\("utility", \{[\s\S]*?cardId:\s*sourceCard\.id,[\s\S]*?actionId:\s*action\.id \?\? null,[\s\S]*?actionName/);

  const completeRecovery = sourceSection(
    "function completeCreatureRecovery(cardId, sourceElement = null)",
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

test("Lesson 2 Scavenge flies the recovered card from discard without opening the utility result", () => {
  const completeRecovery = sourceSection(
    "function completeCreatureRecovery(cardId, sourceElement = null)",
    "function completeCreatureActionSearch(cardId)",
  );

  assert.match(
    completeRecovery,
    /const animateTutorialRecovery = Boolean\([\s\S]*?embeddedLesson\?\.id === "first-attack"[\s\S]*?tutorialCurrentCheckpoint\?\.id === "v2-recover-sea-urchin"[\s\S]*?expectedTutorialTarget === cardId[\s\S]*?destinationZone === "hand"[\s\S]*?handResult\?\.cardsToHand\.length[\s\S]*?\);/,
    "the presentation override must remain scoped to the authored successful hand recovery",
  );
  assert.match(
    completeRecovery,
    /if \(animateTutorialRecovery\) \{[\s\S]*?startMobileDrawFlights\([\s\S]*?\[\{ cardId, source: "discard", discarded: false \}\][\s\S]*?kind: "discard-recovery"[\s\S]*?sourceZone: "discard"[\s\S]*?sourceElement,[\s\S]*?focusOnComplete: false[\s\S]*?setEventOverlay\(null\);[\s\S]*?\} else \{[\s\S]*?setEventOverlay\(\{ type: "utility-result"/,
    "the tutorial recovery should use the discard flight while an ordinary recovery keeps its result overlay",
  );
  assert.match(
    simulatorSource,
    /onClick=\{\(event\) => completeCreatureRecovery\(cardId, event\.currentTarget\.querySelector\("img"\) \?\? event\.currentTarget\)\}/,
    "the visible recovery choice supplies initial geometry before its overlay closes",
  );
  assert.match(
    completeRecovery,
    /if \(!recoveryFlightStarted\) \{[\s\S]*?setMobileDrawAnnouncement\(/,
    "the recovered-card announcement must survive when compact flight geometry is unavailable",
  );
  assert.equal(
    (completeRecovery.match(/type: "utility-result"/g) ?? []).length,
    1,
    "the utility result belongs only to the ordinary recovery branch",
  );
});
