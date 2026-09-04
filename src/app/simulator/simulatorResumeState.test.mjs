import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SIMULATOR_RESUME_SCHEMA_VERSION,
  SIMULATOR_RESUME_STORAGE_KEY,
  clearSimulatorResumeCheckpoint,
  createSimulatorResumeCheckpoint,
  isSimulatorResumeCheckpointStable,
  parseSimulatorResumeCheckpoint,
  readSimulatorResumeCheckpoint,
  writeSimulatorResumeCheckpoint,
} from "./simulatorResumeState.mjs";

const simulatorSource = (await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8"))
  .replaceAll("\r\n", "\n");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

class MemoryStorage {
  constructor(initial = {}, failures = {}) {
    this.values = new Map(Object.entries(initial));
    this.failures = failures;
  }

  getItem(key) {
    if (this.failures.read) throw new Error("read unavailable");
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    if (this.failures.write) throw new Error("quota exceeded");
    this.values.set(key, String(value));
  }

  removeItem(key) {
    if (this.failures.remove) throw new Error("remove unavailable");
    this.values.delete(key);
  }
}

function createDurableGame(overrides = {}) {
  return {
    selectedDeckId: "coral-garden-starter",
    selectedOpponentDeckId: "kelp-forest-starter",
    opponentDifficulty: "medium",
    victoryTarget: 30,
    foundationDeck: ["boulder-star-coral"],
    palsDeck: ["blue-crab"],
    hand: ["remote-search"],
    playerCorals: [{
      id: "player-coral-1",
      cardId: "clubfinger-coral",
      health: 10,
      maxHealth: 10,
      slots: [{
        id: "player-slot-1",
        cardId: "blue-crab",
        cardInstanceId: "player-crab-1",
        hostedCardIds: [],
      }],
    }],
    playerHabitatInstances: [{
      instanceId: "player-habitat-1",
      cardId: "coral-reef",
      currentHealth: 20,
      maxHealth: 20,
    }],
    playerReefCreatureInstances: [{
      instanceId: "player-reef-1",
      cardId: "bottlenose-dolphin",
      hostedCardIds: [],
    }],
    playerOrphanCreatureInstances: [{
      instanceId: "player-orphan-1",
      cardId: "lionfish",
      invasiveOwner: "opponent",
      hostedCardIds: [],
    }],
    opponent: {
      foundationDeck: ["elk-horn-coral"],
      palsDeck: ["mantis-shrimp"],
      hand: [],
      corals: [{
        id: "opponent-coral-1",
        cardId: "boulder-star-coral",
        health: 20,
        maxHealth: 20,
        slots: [],
      }],
      habitats: ["coral-reef"],
      habitatInstances: [{
        instanceId: "opponent-habitat-1",
        cardId: "coral-reef",
        currentHealth: 20,
        maxHealth: 20,
      }],
      reefCreatures: ["mantis-shrimp"],
      reefCreatureInstances: [{
        instanceId: "opponent-reef-1",
        cardId: "mantis-shrimp",
        hostedCardIds: [],
      }],
      orphanCreatures: [{
        instanceId: "opponent-orphan-1",
        cardId: "blue-crab",
        hostedCardIds: [],
      }],
      discardPile: [],
      lostZone: [],
      resilienceUsedCardIds: [],
      actionCooldowns: {},
      actionUses: {},
      creatureStatuses: {},
      conditionDensityUses: {},
      schoolDensityCommitmentsByInstanceId: {},
      rp: 4,
    },
    floatingCardOffsets: { "player-coral-1": { x: 12, y: -4 } },
    ecosystemZoom: 0.82,
    ecosystemOffset: { x: 4, y: 8 },
    opponentEcosystemZoom: 0.75,
    opponentEcosystemOffset: { x: -2, y: 5 },
    playerViewportTouched: true,
    opponentViewportTouched: false,
    mobileBoardView: "player",
    mobileReefSplit: 40,
    discardPile: ["recovery"],
    lostZone: [],
    conditionDeck: ["low-tide"],
    activeConditionId: "sunny-day",
    persistentConditionIds: [],
    conditionDensityUses: {},
    schoolDensityCommitmentsByInstanceId: { "player-crab-1": 1 },
    blueCrabRecycleUsedTurn: null,
    resilienceUsedCardIds: [],
    round: 3,
    gamePhase: "main",
    startingPlayer: "player",
    openingOpponentTurn: false,
    turn: 5,
    rp: 6,
    hasDrawnThisTurn: true,
    turnDrawSelection: { requested: 1, target: 1, shortfall: 0, foundation: 1, pals: 0 },
    turnDrawResult: [{ cardId: "clubfinger-coral", source: "Foundation", discarded: false }],
    usedAttackers: ["player-crab-1"],
    actionCooldowns: { "player-crab-1": 5 },
    usedCreatureActions: ["player-crab-1:recycle"],
    creatureStatuses: {},
    poisonImmunityNextPredatorAttack: false,
    rovLightsActive: true,
    nextOnPlayAttackBonus: null,
    flashingAlarmAttackBonus: null,
    supportLockSourceId: null,
    supportBlockedUntilRound: 0,
    cardsBlockedFromPlayThisTurn: [],
    log: ["A previous action"],
    turnLog: ["Drew one card"],
    gameResult: null,
    ...overrides,
  };
}

test("a versioned checkpoint round-trips every durable board identity and strips transient values", () => {
  const durableGame = createDurableGame();
  durableGame.playerCorals[0].slots[0].hostedCardIds = [null, "blue-crab"];
  durableGame.playerOrphanCreatureInstances[0].hostedCardIds = [null, "mantis-shrimp"];
  const checkpoint = createSimulatorResumeCheckpoint({
    ...durableGame,
    eventOverlay: { type: "faceoff-ready", liveResume() {} },
    pendingEvents: [{ commit() {} }],
    attackContext: { onComplete() {} },
    mobileDrawFlights: [{ id: 1 }],
  }, { now: 1_725_000_000_000 });

  assert.equal(checkpoint.version, SIMULATOR_RESUME_SCHEMA_VERSION);
  assert.equal(checkpoint.savedAt, 1_725_000_000_000);
  assert.equal(checkpoint.state.playerCorals[0].slots[0].cardInstanceId, "player-crab-1");
  assert.deepEqual(checkpoint.state.playerCorals[0].slots[0].hostedCardIds, [null, "blue-crab"]);
  assert.deepEqual(checkpoint.state.playerOrphanCreatureInstances[0].hostedCardIds, [null, "mantis-shrimp"]);
  assert.equal(checkpoint.state.playerOrphanCreatureInstances[0].invasiveOwner, "opponent");
  assert.equal(checkpoint.state.opponent.reefCreatureInstances[0].instanceId, "opponent-reef-1");
  assert.equal("eventOverlay" in checkpoint.state, false);
  assert.equal("pendingEvents" in checkpoint.state, false);
  assert.equal("attackContext" in checkpoint.state, false);
  assert.equal("mobileDrawFlights" in checkpoint.state, false);
  assert.deepEqual(parseSimulatorResumeCheckpoint(JSON.stringify(checkpoint)), checkpoint);
});

test("malformed, completed, unsafe-phase, future-version, and duplicate-instance saves are rejected", () => {
  assert.equal(parseSimulatorResumeCheckpoint("not json"), null);
  assert.equal(parseSimulatorResumeCheckpoint("{}"), null);
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({ gameResult: "Victory" })), null);
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({ gamePhase: "opponent" })), null);
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({ gamePhase: "transition" })), null);
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({ opponent: {} })), null);
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({
    playerCorals: [{ id: "broken-coral", cardId: "blue-crab", health: 10, maxHealth: 10 }],
  })), null);
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({ hand: [42] })), null);
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({ turnDrawResult: {} })), null);
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({ log: {} })), null);
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({ turnLog: {} })), null);
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({ hasDrawnThisTurn: "yes" })), null);
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({
    playerCorals: [{ ...createDurableGame().playerCorals[0], statuses: "stunned" }],
  })), null);
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({
    creatureStatuses: { "player-crab-1": {} },
  })), null);
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({
    opponent: {
      ...createDurableGame().opponent,
      creatureStatuses: { "opponent-reef-1": [{ expiresTurn: 6 }] },
    },
  })), null);
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({
    opponent: { ...createDurableGame().opponent, foundationDeck: "not-an-array" },
  })), null);
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({
    playerReefCreatureInstances: [
      { instanceId: "same", cardId: "blue-crab" },
      { instanceId: "same", cardId: "mantis-shrimp" },
    ],
  })), null);
  const future = createSimulatorResumeCheckpoint(createDurableGame());
  future.version += 1;
  assert.equal(parseSimulatorResumeCheckpoint(future), null);
  const unknownCard = createSimulatorResumeCheckpoint(createDurableGame({ hand: ["retired-card"] }));
  assert.equal(parseSimulatorResumeCheckpoint(unknownCard, {
    isKnownCardId: (cardId) => cardId !== "retired-card",
  }), null);
});

test("draw checkpoints require an unresolved plain draw choice", () => {
  assert.ok(createSimulatorResumeCheckpoint(createDurableGame({
    gamePhase: "draw",
    hasDrawnThisTurn: false,
  })));
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({
    gamePhase: "draw",
    hasDrawnThisTurn: true,
  })), null);
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({
    gamePhase: "draw",
    hasDrawnThisTurn: false,
    turnDrawSelection: null,
  })), null);
  for (const invalidSelection of [
    {},
    { requested: 1, target: 1, shortfall: 0, foundation: -1, pals: 0 },
    { requested: 1, target: 1, shortfall: 0, foundation: 2, pals: 0 },
    { requested: 1, target: 1, shortfall: 0, foundation: 0, pals: 0, mode: "support" },
    { requested: 1, target: 0, shortfall: 1, foundation: 0, pals: 0 },
  ]) {
    assert.equal(createSimulatorResumeCheckpoint(createDurableGame({
      gamePhase: "draw",
      hasDrawnThisTurn: false,
      turnDrawSelection: invalidSelection,
    })), null);
  }
  assert.equal(createSimulatorResumeCheckpoint(createDurableGame({
    gamePhase: "main",
    hasDrawnThisTurn: false,
  })), null);
});

test("storage helpers save, read, clear, and fail closed without interrupting gameplay", () => {
  const storage = new MemoryStorage();
  assert.equal(writeSimulatorResumeCheckpoint(storage, createDurableGame(), { now: 1234 }), true);
  assert.equal(readSimulatorResumeCheckpoint(storage).savedAt, 1234);
  assert.equal(clearSimulatorResumeCheckpoint(storage), true);
  assert.equal(readSimulatorResumeCheckpoint(storage), null);

  const malformed = new MemoryStorage({ [SIMULATOR_RESUME_STORAGE_KEY]: "broken" });
  assert.equal(readSimulatorResumeCheckpoint(malformed), null);
  assert.equal(malformed.getItem(SIMULATOR_RESUME_STORAGE_KEY), null);
  assert.equal(readSimulatorResumeCheckpoint(new MemoryStorage({}, { read: true })), null);
  assert.equal(writeSimulatorResumeCheckpoint(new MemoryStorage({}, { write: true }), createDurableGame()), false);
  assert.equal(clearSimulatorResumeCheckpoint(new MemoryStorage({}, { remove: true })), false);
  assert.equal(readSimulatorResumeCheckpoint(null), null);
  assert.equal(writeSimulatorResumeCheckpoint(null, createDurableGame()), false);
  assert.equal(clearSimulatorResumeCheckpoint(null), false);
});

test("every in-flight interaction keeps the previous known-good checkpoint untouched", () => {
  const base = {
    resumeCheckpointReady: true,
    resumeDecisionResolved: true,
    resumePromptOpen: false,
    gameResult: null,
    startingPlayer: "player",
    gamePhase: "main",
    hasDrawnThisTurn: true,
    turnDrawSelection: null,
    modal: null,
  };
  assert.equal(isSimulatorResumeCheckpointStable(base), true);
  const blockers = {
    resumeCheckpointReady: false,
    resumeDecisionResolved: false,
    resumePromptOpen: true,
    gameResult: "Defeat",
    startingPlayer: null,
    gamePhase: "opponent",
    modal: "discard",
    opponentThinking: true,
    eventOverlay: { type: "condition-reveal" },
    pendingEvents: [{}],
    compactTurnSequence: {},
    compactRpFlights: [{}],
    opponentPlacementFlight: {},
    compactOpponentCardReader: {},
    compactOpponentPlaybackLocked: true,
    combatResultCheckpoint: {},
    consumedAttackFlight: {},
    cardCoinFlip: {},
    faceoffRolling: true,
    playingCardId: "blue-crab",
    pendingCreatureAction: {},
    attackContext: {},
    searchContext: {},
    mobileDrawFlights: [{}],
    mobileHandDrag: {},
    floatingCardDrag: {},
    draggingCoralId: "coral",
    slotDragStart: {},
    coralDragStart: {},
    setupOpeningHandVisibleCount: 2,
    roundFlash: true,
    reefDividerDragging: true,
    isPanning: true,
    isOpponentPanning: true,
    simulatorExitConfirmationOpen: true,
  };
  for (const [key, value] of Object.entries(blockers)) {
    assert.equal(
      isSimulatorResumeCheckpointStable({ ...base, [key]: value }),
      false,
      `${key} must block a new checkpoint`,
    );
  }
  assert.equal(isSimulatorResumeCheckpointStable({ ...base, faceoffLocked: true }), true);
  assert.equal(isSimulatorResumeCheckpointStable({ ...base, faceoffPreview: { attack: 4 } }), true);
  assert.equal(
    isSimulatorResumeCheckpointStable({
      ...base,
      eventOverlay: {
        type: "utility-result",
        sourceCardId: "crevalle-jack",
        title: "Player's Crevalle Jack gained RP",
        message: "Crevalle Jack's On Play ability gained 1 RP.",
        success: true,
      },
    }),
    true,
    "a display-only result must not roll a completed play back on refresh",
  );
  assert.equal(
    isSimulatorResumeCheckpointStable({
      ...base,
      eventOverlay: {
        type: "utility-result",
        title: "Continue the turn",
        continueToEndTurn: true,
      },
    }),
    false,
    "an overlay whose Continue button advances gameplay must remain checkpoint-blocking",
  );
  assert.equal(
    isSimulatorResumeCheckpointStable({
      ...base,
      eventOverlay: {
        type: "utility-result",
        title: "Pending state",
        playerStateAfter: { rp: 4 },
      },
    }),
    false,
    "an overlay carrying deferred state must remain checkpoint-blocking",
  );

  const storage = new MemoryStorage();
  writeSimulatorResumeCheckpoint(storage, createDurableGame(), { now: 10 });
  const knownGood = storage.getItem(SIMULATOR_RESUME_STORAGE_KEY);
  if (isSimulatorResumeCheckpointStable({ ...base, eventOverlay: {} })) {
    writeSimulatorResumeCheckpoint(storage, createDurableGame({ rp: 99 }), { now: 20 });
  }
  assert.equal(storage.getItem(SIMULATOR_RESUME_STORAGE_KEY), knownGood);
});

test("cosmetic board-stat flights save the canonical completed play before a refresh", () => {
  const stableBoundary = {
    resumeCheckpointReady: true,
    resumeDecisionResolved: true,
    resumePromptOpen: false,
    gameResult: null,
    startingPlayer: "player",
    gamePhase: "main",
    hasDrawnThisTurn: true,
    turnDrawSelection: null,
    modal: null,
    boardStatPresentationActive: true,
    boardStatFlights: [{ id: "vp-flight", kind: "vp", amount: 1 }],
  };
  assert.equal(
    isSimulatorResumeCheckpointStable(stableBoundary),
    true,
    "cosmetic score flights must not leave the last durable checkpoint stuck before the completed card play",
  );

  const beforePlay = createDurableGame({ hand: ["market-squid"], rp: 6 });
  const completedPlay = createDurableGame({
    hand: [],
    rp: 4,
    playerReefCreatureInstances: [
      ...beforePlay.playerReefCreatureInstances,
      {
        instanceId: "player-market-squid-1",
        cardId: "market-squid",
        hostedCardIds: [],
        schoolDensityRequirementAtPlay: 20,
      },
    ],
    schoolDensityCommitmentsByInstanceId: {
      ...beforePlay.schoolDensityCommitmentsByInstanceId,
      "player-market-squid-1": 20,
    },
    boardStatPresentationActive: true,
    boardStatFlights: [{ id: "sd-flight", kind: "sd", amount: 10 }],
    presentedBoardStats: {
      player: { committed: 0, capacity: 30, vp: 1 },
      opponent: null,
    },
  });

  const storage = new MemoryStorage();
  assert.equal(writeSimulatorResumeCheckpoint(storage, beforePlay, { now: 10 }), true);
  if (isSimulatorResumeCheckpointStable(stableBoundary)) {
    assert.equal(writeSimulatorResumeCheckpoint(storage, completedPlay, { now: 20 }), true);
  }

  const restored = readSimulatorResumeCheckpoint(storage);
  assert.equal(restored.savedAt, 20);
  assert.equal(restored.state.rp, 4);
  assert.deepEqual(restored.state.hand, []);
  assert.equal(restored.state.playerReefCreatureInstances.at(-1).instanceId, "player-market-squid-1");
  assert.equal(restored.state.schoolDensityCommitmentsByInstanceId["player-market-squid-1"], 20);
  assert.equal("boardStatFlights" in restored.state, false);
  assert.equal("boardStatPresentationActive" in restored.state, false);
  assert.equal("presentedBoardStats" in restored.state, false);
});

test("victory waits for readable card feedback after the stat-token sequence", () => {
  const victoryCheck = sourceSection(
    simulatorSource,
    "useEffect(() => {\n    if ([\"setup\", \"opponent\", \"transition\"].includes(gamePhase)",
    "useEffect(() => {\n    if (!isStoryMode || storyResultRecordedRef.current || !gameResult)",
  );
  assert.match(victoryCheck, /const eventRequiresResolution = Boolean\(eventOverlay\)/);
  assert.match(
    victoryCheck,
    /boardStatPresentationActive \|\| eventRequiresResolution/,
    "Victory must wait first for score flights and then for any readable result overlay",
  );
});

test("Simulator gates normal V2 hydration, restores durable state, and derives only the mandatory draw UI", () => {
  assert.match(simulatorSource, /const simulatorResumeEnabled = Boolean\(previewExperience && !isStoryMode && !tutorialRuntime\)/);
  const hydration = sourceSection(
    simulatorSource,
    "useEffect(() => {\n    if (!simulatorResumeEnabled) return;\n    let checkpoint = readSimulatorResumeCheckpoint",
    "const opponentDifficultyProfile",
  );
  assert.match(hydration, /setResumeCheckpoint\(checkpoint\)/);
  assert.match(hydration, /resumeDecisionResolvedRef\.current = !checkpoint/);
  assert.match(hydration, /setResumeCheckpointReady\(true\)/);
  assert.match(simulatorSource, /window\.addEventListener\("pagehide", saveCheckpoint\)/);
  assert.match(simulatorSource, /document\.addEventListener\("visibilitychange", saveWhenHidden\)/);
  assert.match(simulatorSource, /const resumeHydrationPending = simulatorResumeEnabled && !resumeCheckpointReady/);
  assert.match(simulatorSource, /aria-hidden=\{resumeHydrationPending \|\| resumeCheckpoint \? "true" : undefined\}[\s\S]*?inert=\{resumeHydrationPending \|\| Boolean\(resumeCheckpoint\) \|\| undefined\}/);
  assert.match(simulatorSource, /aria-hidden=\{inspectedCardData \|\| resumeCheckpoint \|\| resumeHydrationPending \? "true" : undefined\}/);
  assert.match(simulatorSource, /inert=\{inspectedCardData \|\| resumeCheckpoint \|\| resumeHydrationPending \|\| undefined\}/);

  const restore = sourceSection(
    simulatorSource,
    "function restoreSimulatorResumeCheckpoint(",
    "function restartGame(",
  );
  assert.match(restore, /setPlayerCorals\(saved\.playerCorals\)/);
  assert.match(restore, /setPlayerHabitatInstances\(saved\.playerHabitatInstances\)/);
  assert.match(restore, /setPlayerReefCreatureInstances\(saved\.playerReefCreatureInstances\)/);
  assert.match(restore, /setPlayerOrphanCreatureInstances\(saved\.playerOrphanCreatureInstances\)/);
  assert.match(restore, /setOpponentState\(\(current\) => reconcileOpponentInstances\(current, saved\.opponent\)\)/);
  assert.match(restore, /saved\.gamePhase === "draw"[\s\S]*?\? "turn-draw"[\s\S]*?: null/);
  assert.match(restore, /setEventOverlay\(null\)/);
  assert.match(restore, /pendingEventsRef\.current = \[\]/);
  assert.match(restore, /setAttackContext\(null\)/);
  assert.match(restore, /setSearchContext\(null\)/);
  assert.match(restore, /setHasDrawnThisTurn\(Boolean\(saved\.hasDrawnThisTurn\)\)/);
  assert.match(restore, /resolveResumeDecision\(\)/);
  assert.doesNotMatch(restore, /restartGame\(/);
  assert.doesNotMatch(simulatorSource, /useEffect\(\(\) => \{\n\s*setHasDrawnThisTurn\(false\);\n\s*\}, \[turn\]\)/);
});

test("the resume prompt is mandatory, accessible, and blocks the underlying V2 board", () => {
  assert.match(simulatorSource, /resumeCheckpointReady && resumeCheckpoint \? \(/);
  assert.match(simulatorSource, /role="dialog" aria-modal="true" aria-labelledby="simulator-resume-title" aria-describedby="simulator-resume-description"/);
  assert.match(simulatorSource, /id="simulator-resume-title"[\s\S]*?Resume your previous game\?/);
  assert.match(simulatorSource, /autoFocus onClick=\{\(\) => restoreSimulatorResumeCheckpoint\(resumeCheckpoint\)\}[\s\S]*?Resume Game/);
  assert.match(simulatorSource, /onClick=\{startNewGameFromResumePrompt\}[\s\S]*?Start New Game/);
  assert.match(simulatorSource, /boardInteractionOverlayActive =[\s\S]*?Boolean\(resumeCheckpoint\)/);
  assert.match(simulatorSource, /aria-hidden=\{resumeHydrationPending \|\| resumeCheckpoint \? "true" : undefined\}/);
  assert.match(simulatorSource, /inert=\{resumeHydrationPending \|\| Boolean\(resumeCheckpoint\) \|\| undefined\}/);
});

test("decline, replacement games, completed games, and confirmed quit clear the save at the right boundary", () => {
  const decline = sourceSection(
    simulatorSource,
    "function startNewGameFromResumePrompt()",
    "function restoreSimulatorResumeCheckpoint(",
  );
  assert.match(decline, /clearSimulatorResumeCheckpoint\(window\.localStorage\)/);
  assert.match(decline, /resolveResumeDecision\(\)/);

  const restart = sourceSection(simulatorSource, "function restartGame(", "function restartStoryGame(");
  assert.ok(
    restart.indexOf("clearSimulatorResumeCheckpoint(window.localStorage)")
      < restart.indexOf("createInitialGameState("),
    "a replacement match must clear the old save before creating a new game",
  );

  const quit = sourceSection(simulatorSource, "function confirmSimulatorExit()", "function confirmTutorialExit()");
  assert.ok(
    quit.indexOf("resumeSaveSuppressedRef.current = true")
      < quit.indexOf("clearSimulatorResumeCheckpoint(window.localStorage)"),
    "confirmed quit must suppress pagehide writes before clearing",
  );
  assert.ok(
    quit.indexOf("clearSimulatorResumeCheckpoint(window.localStorage)")
      < quit.indexOf('window.location.assign("/")'),
    "confirmed quit must clear before navigation",
  );
  assert.match(
    simulatorSource,
    /if \(!simulatorResumeEnabled \|\| !resumeCheckpointReady \|\| !gameResult\) return;\n\s*resumeSaveSuppressedRef\.current = true;\n\s*clearSimulatorResumeCheckpoint\(window\.localStorage\);/,
  );
  assert.match(simulatorSource, /const saveCheckpoint = \(\) => \{\n\s*if \(resumeSaveSuppressedRef\.current\) return;/);
});
