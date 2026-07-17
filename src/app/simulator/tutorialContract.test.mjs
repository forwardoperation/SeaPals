import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SIMULATOR_TUTORIAL_CHECKPOINTS,
  SIMULATOR_TUTORIAL_ACTION_TYPES,
  SIMULATOR_TUTORIAL_CONTRACT_VERSION,
  SIMULATOR_TUTORIAL_LIFECYCLE_TYPES,
  createSimulatorTutorialContract,
  createSimulatorTutorialEvent,
  createSimulatorTutorialProgress,
  getSimulatorTutorialCurrentCheckpoint,
  observeSimulatorTutorialEvent,
  restartSimulatorTutorialProgress,
} from "./tutorialContract.mjs";

const CHECKPOINT_IDS = [
  "tutorial-setup",
  "tutorial-collect-rp",
  "tutorial-draw-card",
  "tutorial-build-card",
  "tutorial-attack",
  "tutorial-end-turn",
  "tutorial-earn-vp",
];

const ACTION_TYPES = [
  "match-ready",
  "rp-collected",
  "card-drawn",
  "card-built",
  "attack-resolved",
  "turn-ended",
  "vp-earned",
];

function event(contract, sequence, actionType, details = {}, overrides = {}) {
  return createSimulatorTutorialEvent({
    eventId: `${contract.id}:${sequence}`,
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

test("default tutorial contract matches the canonical adventure checkpoint order", () => {
  const contract = createSimulatorTutorialContract({});
  assert.equal(contract.contractVersion, SIMULATOR_TUTORIAL_CONTRACT_VERSION);
  assert.deepEqual(contract.checkpoints.map((checkpoint) => checkpoint.id), CHECKPOINT_IDS);
  assert.deepEqual(contract.checkpoints.map((checkpoint) => checkpoint.actionType), ACTION_TYPES);
  assert.deepEqual(DEFAULT_SIMULATOR_TUTORIAL_CHECKPOINTS.map((checkpoint) => checkpoint.id), CHECKPOINT_IDS);
  assert.equal(Object.isFrozen(contract), true);
  assert.deepEqual(JSON.parse(JSON.stringify(contract)), contract);
});

test("content-shaped checkpoints receive serializable default evidence requirements", () => {
  const contract = createSimulatorTutorialContract({
    id: "tutorial-content-shape",
    checkpoints: DEFAULT_SIMULATOR_TUTORIAL_CHECKPOINTS,
  });
  const collection = contract.checkpoints[1];
  const draw = contract.checkpoints[2];
  assert.equal(collection.actionType, SIMULATOR_TUTORIAL_ACTION_TYPES.RP_COLLECTED);
  assert.ok(collection.requirements.some((requirement) => requirement.path === "details.collected"));
  assert.equal(draw.actionType, SIMULATOR_TUTORIAL_ACTION_TYPES.CARD_DRAWN);
  assert.ok(draw.requirements.some((requirement) => requirement.path === "details.count"));
});

test("observer accepts only the current ordered checkpoint with actual action evidence", () => {
  const contract = createSimulatorTutorialContract({});
  let progress = createSimulatorTutorialProgress(contract);

  const prematureDraw = observeSimulatorTutorialEvent(
    contract,
    progress,
    event(contract, 1, SIMULATOR_TUTORIAL_ACTION_TYPES.CARD_DRAWN, { count: 1 }, { phase: "draw" }),
  );
  assert.equal(prematureDraw.checkpointEvent, null);
  assert.equal(prematureDraw.progress.nextCheckpointId, "tutorial-setup");
  progress = prematureDraw.progress;

  const rejectedSetupEvidence = observeSimulatorTutorialEvent(
    contract,
    progress,
    event(contract, 2, SIMULATOR_TUTORIAL_ACTION_TYPES.MATCH_READY, { foundationCount: 0 }, { phase: "setup" }),
  );
  assert.equal(rejectedSetupEvidence.checkpointEvent, null);
  progress = rejectedSetupEvidence.progress;

  const setup = observeSimulatorTutorialEvent(
    contract,
    progress,
    event(contract, 3, SIMULATOR_TUTORIAL_ACTION_TYPES.MATCH_READY, { foundationCount: 1 }, { phase: "setup" }),
  );
  assert.equal(setup.checkpointEvent.checkpointId, "tutorial-setup");
  assert.equal(setup.progress.nextCheckpointId, "tutorial-collect-rp");

  const drawBeforeCollection = observeSimulatorTutorialEvent(
    contract,
    setup.progress,
    event(contract, 4, SIMULATOR_TUTORIAL_ACTION_TYPES.CARD_DRAWN, { count: 1 }, { phase: "draw" }),
  );
  assert.equal(drawBeforeCollection.checkpointEvent, null);
  assert.equal(drawBeforeCollection.progress.nextCheckpointId, "tutorial-collect-rp");

  const collection = observeSimulatorTutorialEvent(
    contract,
    drawBeforeCollection.progress,
    event(contract, 5, SIMULATOR_TUTORIAL_ACTION_TYPES.RP_COLLECTED, { collected: 1 }, { phase: "draw" }),
  );
  assert.equal(collection.checkpointEvent.checkpointId, "tutorial-collect-rp");
  assert.equal(collection.progress.nextCheckpointId, "tutorial-draw-card");
});

test("a complete real-action sequence advances all seven checkpoints", () => {
  const contract = createSimulatorTutorialContract({});
  let progress = createSimulatorTutorialProgress(contract);
  const sequence = [
    [SIMULATOR_TUTORIAL_ACTION_TYPES.MATCH_READY, { foundationCount: 1 }, { phase: "setup" }],
    [SIMULATOR_TUTORIAL_ACTION_TYPES.RP_COLLECTED, { collected: 2 }, { phase: "draw" }],
    [SIMULATOR_TUTORIAL_ACTION_TYPES.CARD_DRAWN, { count: 1 }, { phase: "draw" }],
    [SIMULATOR_TUTORIAL_ACTION_TYPES.CARD_BUILT, { cardId: "brain-coral-base", cost: 1 }, { phase: "main" }],
    [SIMULATOR_TUTORIAL_ACTION_TYPES.ATTACK_RESOLVED, { accepted: true, outcome: "defended" }, { phase: "main" }],
    [SIMULATOR_TUTORIAL_ACTION_TYPES.TURN_ENDED, { actionCount: 2 }, { phase: "main" }],
    [SIMULATOR_TUTORIAL_ACTION_TYPES.VP_EARNED, { from: 1, to: 2, delta: 1 }, { phase: "main", turn: 2 }],
  ];

  sequence.forEach(([actionType, details, overrides], index) => {
    const observation = observeSimulatorTutorialEvent(contract, progress, event(contract, index + 1, actionType, details, overrides));
    assert.equal(observation.checkpointEvent.checkpointId, CHECKPOINT_IDS[index]);
    progress = observation.progress;
  });

  assert.equal(progress.status, "complete");
  assert.equal(progress.nextCheckpointId, null);
  assert.deepEqual(progress.completedCheckpointIds, CHECKPOINT_IDS);
  assert.equal(getSimulatorTutorialCurrentCheckpoint(contract, progress), null);
});

test("an actual early VP gain is deferred until the ordered end-turn checkpoint", () => {
  const contract = createSimulatorTutorialContract({});
  let progress = createSimulatorTutorialProgress(contract);
  const throughBuild = [
    [SIMULATOR_TUTORIAL_ACTION_TYPES.MATCH_READY, { foundationCount: 1 }, { phase: "setup" }],
    [SIMULATOR_TUTORIAL_ACTION_TYPES.RP_COLLECTED, { collected: 2 }, { phase: "draw" }],
    [SIMULATOR_TUTORIAL_ACTION_TYPES.CARD_DRAWN, { count: 1 }, { phase: "draw" }],
    [SIMULATOR_TUTORIAL_ACTION_TYPES.CARD_BUILT, { cardId: "reef-fish", cost: 1 }, { phase: "main" }],
  ];
  throughBuild.forEach(([actionType, details, overrides], index) => {
    progress = observeSimulatorTutorialEvent(contract, progress, event(contract, index + 1, actionType, details, overrides)).progress;
  });

  const earlyVp = observeSimulatorTutorialEvent(
    contract,
    progress,
    event(contract, 5, SIMULATOR_TUTORIAL_ACTION_TYPES.VP_EARNED, { from: 0, to: 1, delta: 1 }),
  );
  assert.equal(earlyVp.checkpointEvent, null);
  assert.equal(earlyVp.progress.deferredCheckpointEvents["tutorial-earn-vp"].details.delta, 1);

  const attack = observeSimulatorTutorialEvent(
    contract,
    earlyVp.progress,
    event(contract, 6, SIMULATOR_TUTORIAL_ACTION_TYPES.ATTACK_RESOLVED, { accepted: true, outcome: "defended" }),
  );
  const ended = observeSimulatorTutorialEvent(
    contract,
    attack.progress,
    event(contract, 7, SIMULATOR_TUTORIAL_ACTION_TYPES.TURN_ENDED, { actionCount: 2 }),
  );
  assert.deepEqual(ended.checkpointEvents.map((checkpointEvent) => checkpointEvent.checkpointId), [
    "tutorial-end-turn",
    "tutorial-earn-vp",
  ]);
  assert.equal(ended.progress.status, "complete");
  assert.deepEqual(ended.progress.deferredCheckpointEvents, {});
});

test("duplicate events are idempotent and restart clears observations but preserves resume progress", () => {
  const contract = createSimulatorTutorialContract({});
  const initial = createSimulatorTutorialProgress(contract);
  const setupEvent = event(contract, 1, SIMULATOR_TUTORIAL_ACTION_TYPES.MATCH_READY, { foundationCount: 1 }, { phase: "setup" });
  const setup = observeSimulatorTutorialEvent(contract, initial, setupEvent);
  const duplicate = observeSimulatorTutorialEvent(contract, setup.progress, setupEvent);
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.reason, "duplicate-event");
  assert.equal(duplicate.progress, setup.progress);

  const restarted = restartSimulatorTutorialProgress(contract, setup.progress);
  assert.equal(restarted.attempt, 2);
  assert.deepEqual(restarted.completedCheckpointIds, ["tutorial-setup"]);
  assert.deepEqual(restarted.observedEventIds, []);
  assert.equal(restarted.nextCheckpointId, "tutorial-collect-rp");
});

test("duel lifecycle events preserve checkpoint safety across defeat and exit", () => {
  const contract = createSimulatorTutorialContract({});
  const initial = createSimulatorTutorialProgress(contract);
  const defeat = observeSimulatorTutorialEvent(contract, initial, event(
    contract,
    1,
    SIMULATOR_TUTORIAL_LIFECYCLE_TYPES.DUEL_FINISHED,
    { outcome: "defeat" },
    { actor: "system", phase: "result" },
  ));
  assert.equal(defeat.progress.lastDuelOutcome, "defeat");
  assert.equal(defeat.progress.nextCheckpointId, "tutorial-setup");

  const exited = observeSimulatorTutorialEvent(contract, defeat.progress, event(
    contract,
    2,
    SIMULATOR_TUTORIAL_LIFECYCLE_TYPES.DUEL_EXITED,
    { reason: "player-exit" },
    { actor: "system", phase: "result" },
  ));
  assert.equal(exited.progress.status, "exited");
  assert.deepEqual(exited.progress.completedCheckpointIds, []);
});

test("invalid contracts and events fail before they can corrupt progress", () => {
  assert.throws(
    () => createSimulatorTutorialContract({ checkpoints: [{ id: "bad", actionType: "invented", instruction: "No" }] }),
    /unsupported/,
  );
  assert.throws(
    () => createSimulatorTutorialEvent({ eventId: "event-1", tutorialId: "tutorial", actionType: "invented", phase: "main", round: 1, turn: 1 }),
    /Unsupported tutorial event type/,
  );
  assert.throws(
    () => createSimulatorTutorialEvent({ eventId: "event-1", tutorialId: "tutorial", actionType: "card-drawn", phase: "draw", round: 1, turn: 1, details: { count: Number.NaN } }),
    /non-finite/,
  );
});
