import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ELVERSON_REEF_CATCHES } from "./adventureFishing.mjs";
import {
  HAND_NET_ACTIONS,
  HAND_NET_PHASES,
  HAND_NET_SCOOP_PHASES,
  applyHandNetAction,
  createHandNetState,
  tickHandNetState,
} from "./adventureHandNet.mjs";

const handNetSource = readFileSync(new URL("./adventureHandNet.mjs", import.meta.url), "utf8");

function mutableCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function controlledSingleCreature({ reducedMotion = false } = {}) {
  const state = mutableCopy(createHandNetState({
    seed: 19,
    creatureCount: 1,
    requiredCreatureId: "cleaner-wrasse",
    reducedMotion,
  }));
  state.player.position = { x: 6, y: 7.1 };
  state.player.intent = { x: 0, y: 0 };
  state.player.velocity = { x: 0, y: 0 };
  state.player.facing = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
  const atlasLandingLength = Math.hypot(1, -0.1);
  state.net.position = {
    x: 6 + (1 / atlasLandingLength) * state.net.reach,
    y: 7.1 + (-0.1 / atlasLandingLength) * state.net.reach,
  };
  state.creatures[0].position = { ...state.net.position };
  state.creatures[0].heading = { x: 0.15, y: -0.988686 };
  state.creatures[0].turnRemainingMs = 10_000;
  state.creatures[0].alert = 0;
  state.creatures[0].status = "wandering";
  return state;
}

function tickRepeatedly(state, elapsedMs, count) {
  let next = state;
  for (let index = 0; index < count; index += 1) next = tickHandNetState(next, elapsedMs);
  return next;
}

test("seeded school generation is deterministic, frozen, and sourced from Elverson catches", () => {
  const first = createHandNetState({
    seed: 2_024,
    creatureCount: 7,
    requiredCreatureId: "french-angelfish",
  });
  const repeated = createHandNetState({
    seed: 2_024,
    creatureCount: 7,
    requiredCreatureId: "french-angelfish",
  });
  const differentSeed = createHandNetState({ seed: 2_025, creatureCount: 7 });
  const knownSpecies = new Set(ELVERSON_REEF_CATCHES.map(({ id }) => id));

  assert.deepEqual(repeated, first);
  assert.notDeepEqual(differentSeed.creatures, first.creatures);
  assert.equal(first.creatures.length, 7);
  assert.equal(first.creatures[0].speciesId, "french-angelfish");
  assert.equal(first.creatures.every(({ speciesId }) => knownSpecies.has(speciesId)), true);
  assert.equal(first.creatures.every(({ cardId }) => typeof cardId === "string" && cardId.length > 0), true);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.player.position), true);
  assert.equal(Object.isFrozen(first.creatures[0]), true);
});

test("fixed simulation steps make replay independent of UI frame partitioning", () => {
  const initial = applyHandNetAction(
    createHandNetState({ seed: 44, creatureCount: 4 }),
    { type: HAND_NET_ACTIONS.MOVE, x: 0.35, y: -0.2 },
  );
  const oneFrame = tickHandNetState(initial, 1_000);
  const manyFrames = tickRepeatedly(initial, 20, 50);
  const serializedReplay = tickHandNetState(JSON.parse(JSON.stringify(initial)), 1_000);

  assert.deepEqual(manyFrames, oneFrame);
  assert.deepEqual(serializedReplay, oneFrame);
  assert.equal(oneFrame.tickCount, 50);
  assert.equal(oneFrame.simulationTimeMs, 1_000);
});

test("move actions drive the player and forward net without mutating prior state", () => {
  const initial = createHandNetState({ seed: 5, creatureCount: 2 });
  const before = structuredClone(initial);
  const moving = applyHandNetAction(initial, {
    type: HAND_NET_ACTIONS.MOVE,
    x: 1,
    y: -1,
  });
  const advanced = tickHandNetState(moving, 500);

  assert.deepEqual(initial, before);
  assert.notStrictEqual(moving, initial);
  assert.ok(advanced.player.position.x > initial.player.position.x);
  assert.ok(advanced.player.position.y < initial.player.position.y);
  assert.ok(advanced.net.position.x > advanced.player.position.x);
  assert.ok(advanced.net.position.y < advanced.player.position.y);
  assert.ok(Math.hypot(
    advanced.net.position.x - advanced.player.position.x,
    advanced.net.position.y - advanced.player.position.y,
  ) <= advanced.net.reach + 1e-9);
  assert.equal(Object.isFrozen(advanced), true);

  const stopped = applyHandNetAction(advanced, { type: HAND_NET_ACTIONS.STOP });
  const stoppedPosition = stopped.player.position;
  const afterStop = tickHandNetState(stopped, 200);
  assert.deepEqual(afterStop.player.position, stoppedPosition);
});

test("walk presentation starts predictably, advances locally, and resets when movement stops", () => {
  assert.match(handNetSource, /const WALK_FRAME_DURATION_MS = 110;/);
  assert.match(handNetSource, /const WALK_FRAME_SEQUENCE = Object\.freeze\(\[1, 0, 2, 0\]\);/);

  const initial = createHandNetState({ seed: 15, creatureCount: 1 });
  const idled = tickHandNetState(initial, 1_000);
  assert.equal(idled.presentation.walkElapsedMs, 0);
  assert.equal(idled.presentation.walkFrameIndex, 0);

  const started = applyHandNetAction(idled, { type: HAND_NET_ACTIONS.MOVE, x: 1, y: 0 });
  assert.equal(started.presentation.walkElapsedMs, 0);
  assert.equal(started.presentation.walkFrameIndex, 1, "movement immediately plants the first stepping leg");

  const firstPose = tickHandNetState(started, 100);
  assert.equal(firstPose.presentation.walkElapsedMs, 100);
  assert.equal(firstPose.presentation.walkFrameIndex, 1);
  const secondPose = tickHandNetState(firstPose, 20);
  assert.equal(secondPose.presentation.walkElapsedMs, 120);
  assert.equal(secondPose.presentation.walkFrameIndex, 0, "neutral separates the two planted steps");
  const thirdPose = tickHandNetState(secondPose, 100);
  assert.equal(thirdPose.presentation.walkElapsedMs, 220);
  assert.equal(thirdPose.presentation.walkFrameIndex, 2);
  const oppositeStep = tickHandNetState(thirdPose, 120);
  assert.equal(oppositeStep.presentation.walkElapsedMs, 340);
  assert.equal(oppositeStep.presentation.walkFrameIndex, 0);

  const redirected = applyHandNetAction(thirdPose, { type: HAND_NET_ACTIONS.MOVE, x: 0, y: -1 });
  assert.equal(redirected.presentation.walkElapsedMs, 220, "turning mid-stride preserves cadence");
  assert.equal(redirected.presentation.walkFrameIndex, 2);

  const stopped = applyHandNetAction(redirected, { type: HAND_NET_ACTIONS.STOP });
  assert.equal(stopped.presentation.walkElapsedMs, 0);
  assert.equal(stopped.presentation.walkFrameIndex, 0);
  const restarted = applyHandNetAction(
    tickHandNetState(stopped, 500),
    { type: HAND_NET_ACTIONS.MOVE, x: -1, y: 0 },
  );
  assert.equal(restarted.presentation.walkElapsedMs, 0);
  assert.equal(restarted.presentation.walkFrameIndex, 1);
});

test("creatures wander deterministically and remain inside the shallow-water arena", () => {
  const initial = createHandNetState({ seed: 71, creatureCount: 5 });
  const advanced = tickHandNetState(initial, 2_000);

  assert.equal(
    advanced.creatures.some((creature, index) => (
      creature.position.x !== initial.creatures[index].position.x
      || creature.position.y !== initial.creatures[index].position.y
    )),
    true,
  );
  for (const creature of advanced.creatures) {
    assert.ok(creature.position.x >= 0.45 && creature.position.x <= 11.55);
    assert.ok(creature.position.y >= 0.65 && creature.position.y <= 6.45);
    assert.equal(creature.status, "wandering");
  }
});

test("a quick direct approach raises alert, starts flight, and can end in escape", () => {
  const initial = controlledSingleCreature();
  initial.creatures[0].position = { x: 6, y: 5.7 };
  const approaching = applyHandNetAction(initial, {
    type: HAND_NET_ACTIONS.MOVE,
    x: 0,
    y: -1,
  });
  const alarmed = tickHandNetState(approaching, 700);

  assert.ok(alarmed.creatures[0].alert >= alarmed.settings.alertThreshold);
  assert.ok(["fleeing", "escaped"].includes(alarmed.creatures[0].status));
  assert.equal(alarmed.lastEvent?.type, "creature-fled");

  const stopped = applyHandNetAction(alarmed, { type: HAND_NET_ACTIONS.STOP });
  let escaped = stopped;
  for (let index = 0; index < 10 && escaped.phase === HAND_NET_PHASES.PLAYING; index += 1) {
    escaped = tickHandNetState(escaped, 1_000);
  }
  assert.equal(escaped.phase, HAND_NET_PHASES.ESCAPED);
  assert.equal(escaped.outcome.type, "escaped");
  assert.deepEqual(escaped.outcome.speciesIds, ["cleaner-wrasse"]);
  assert.equal(escaped.creatures[0].status, "escaped");
});

test("a scoop winds up, contacts near the landing frame, recovers, then reports its matching card", () => {
  const initial = controlledSingleCreature();
  initial.creatures[0].position = { ...initial.net.position };
  initial.creatures[0].speed = 0;
  initial.creatures[0].turnRemainingMs = 10_000;
  const before = structuredClone(initial);
  const scooping = applyHandNetAction(initial, { type: HAND_NET_ACTIONS.SCOOP });

  assert.equal(scooping.net.scoopRemainingMs, scooping.settings.scoopAnimationMs);
  assert.equal(scooping.scoopCount, 1);
  assert.equal(scooping.presentation.netImpact, null);
  assert.equal(scooping.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.WINDUP);
  assert.equal(scooping.presentation.scoopElapsedMs, 0);
  assert.equal(scooping.presentation.scoopDurationMs, 700);
  assert.equal(scooping.presentation.scoopProgress, 0);
  assert.equal(scooping.presentation.scoopPhaseProgress, 0);
  assert.equal(scooping.presentation.scoopFrameIndex, 3);
  assert.equal(scooping.presentation.scoopHitboxActive, false);
  assert.equal(scooping.phase, HAND_NET_PHASES.PLAYING);

  const beforeImpact = tickHandNetState(scooping, scooping.settings.scoopContactMs - 20);
  assert.equal(beforeImpact.phase, HAND_NET_PHASES.PLAYING);
  assert.equal(beforeImpact.creatures[0].status, "wandering");
  assert.equal(beforeImpact.outcome, null);
  assert.equal(beforeImpact.presentation.netImpact, null);
  assert.equal(beforeImpact.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.SWING);
  assert.equal(beforeImpact.presentation.scoopFrameIndex, 4);
  assert.equal(beforeImpact.presentation.scoopHitboxActive, false);

  const contacted = tickHandNetState(beforeImpact, 20);
  assert.equal(contacted.phase, HAND_NET_PHASES.PLAYING);
  assert.equal(contacted.outcome, null);
  assert.equal(contacted.creatures[0].status, "caught");
  assert.equal(contacted.net.contactedCreatureId, "hand-net-creature-1");
  assert.equal(contacted.lastEvent.type, "creature-netted");
  assert.equal(contacted.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.IMPACT);
  assert.equal(contacted.presentation.scoopElapsedMs, 440);
  assert.equal(contacted.presentation.scoopFrameIndex, 5);
  assert.equal(contacted.presentation.scoopHitboxActive, true);
  assert.deepEqual(contacted.presentation.netImpact, {
    sequence: 1,
    position: contacted.net.position,
  });
  assert.ok(Object.isFrozen(contacted.presentation.netImpact));
  assert.ok(Object.isFrozen(contacted.presentation.netImpact.position));

  const blockedDuringRecovery = applyHandNetAction(contacted, { type: HAND_NET_ACTIONS.SCOOP });
  assert.strictEqual(blockedDuringRecovery, contacted);
  const recovering = tickHandNetState(
    contacted,
    contacted.settings.scoopRecoveryStartMs - contacted.settings.scoopContactMs,
  );
  assert.equal(recovering.phase, HAND_NET_PHASES.PLAYING);
  assert.equal(recovering.outcome, null);
  assert.equal(recovering.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.RECOVERY);
  assert.equal(recovering.presentation.scoopHitboxActive, false);

  const caught = tickHandNetState(
    recovering,
    recovering.settings.scoopAnimationMs - recovering.settings.scoopRecoveryStartMs,
  );
  assert.equal(caught.phase, HAND_NET_PHASES.CAUGHT);
  assert.equal(caught.outcome.type, "caught");
  assert.equal(caught.outcome.speciesId, "cleaner-wrasse");
  assert.equal(caught.outcome.cardId, "cleaner-wrasse");
  assert.equal(caught.creatures[0].status, "caught");
  assert.equal(caught.net.scoopRemainingMs, 0);
  assert.equal(caught.net.contactedCreatureId, null);
  assert.equal(caught.outcome.atMs, 700);
  assert.equal(caught.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.COMPLETE);
  assert.equal(caught.presentation.scoopElapsedMs, 700);
  assert.equal(caught.presentation.scoopProgress, 1);
  assert.equal(caught.presentation.scoopPhaseProgress, 1);
  assert.equal(caught.presentation.scoopFrameIndex, 6);
  assert.equal(caught.presentation.scoopHitboxActive, false);
  assert.deepEqual(tickHandNetState(scooping, 700), caught);
  assert.deepEqual(initial, before);
  assert.strictEqual(
    applyHandNetAction(caught, { type: HAND_NET_ACTIONS.MOVE, x: 1, y: 0 }),
    caught,
  );
  assert.strictEqual(tickHandNetState(caught, 100), caught);
});

test("an empty scoop completes recovery, records the miss, cools down, and can remount impact", () => {
  const standard = controlledSingleCreature();
  standard.creatures[0].position = { x: standard.net.position.x + 1.5, y: standard.net.position.y };
  standard.creatures[0].speed = 0;
  const started = applyHandNetAction(standard, { type: HAND_NET_ACTIONS.SCOOP });
  const beforeImpact = tickHandNetState(started, started.settings.scoopContactMs - 20);
  const impact = tickHandNetState(beforeImpact, 20);
  const recovery = tickHandNetState(
    impact,
    impact.settings.scoopRecoveryStartMs - impact.settings.scoopContactMs,
  );
  const almostFinished = tickHandNetState(
    recovery,
    recovery.settings.scoopAnimationMs - recovery.settings.scoopRecoveryStartMs - 20,
  );
  const missed = tickHandNetState(almostFinished, 20);

  assert.equal(beforeImpact.presentation.netImpact, null);
  assert.equal(impact.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.IMPACT);
  assert.equal(impact.presentation.scoopHitboxActive, true);
  assert.deepEqual(impact.presentation.netImpact, {
    sequence: 1,
    position: impact.net.position,
  });
  const lateArrival = mutableCopy(impact);
  lateArrival.creatures[0].position = { ...lateArrival.net.position };
  const afterContact = tickHandNetState(lateArrival, 20);
  assert.equal(afterContact.net.contactedCreatureId, null);
  assert.equal(afterContact.creatures[0].status, "wandering");
  assert.equal(afterContact.presentation.scoopHitboxActive, false);
  assert.equal(recovery.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.RECOVERY);
  assert.equal(recovery.presentation.scoopHitboxActive, false);
  assert.equal(almostFinished.net.scoopRemainingMs, 20);
  assert.equal(missed.net.scoopRemainingMs, 0);
  assert.equal(missed.net.cooldownRemainingMs, missed.settings.cooldownMs);
  assert.equal(missed.missCount, 1);
  assert.equal(missed.lastEvent.type, "scoop-missed");
  assert.ok(missed.creatures[0].alert > 0);
  assert.equal(missed.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.COMPLETE);
  assert.equal(missed.presentation.scoopProgress, 1);

  const blockedRepeat = applyHandNetAction(missed, { type: HAND_NET_ACTIONS.SCOOP });
  assert.strictEqual(blockedRepeat, missed);

  const firstImpact = impact.presentation.netImpact;
  const readyAgain = tickHandNetState(missed, missed.settings.cooldownMs);
  assert.equal(readyAgain.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.IDLE);
  const repeated = applyHandNetAction(readyAgain, { type: HAND_NET_ACTIONS.SCOOP });
  assert.equal(repeated.scoopCount, 2);
  assert.equal(repeated.presentation.netImpact, null);
  assert.equal(repeated.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.WINDUP);
  const repeatedImpact = tickHandNetState(repeated, repeated.settings.scoopContactMs);
  assert.deepEqual(repeatedImpact.presentation.netImpact, {
    sequence: 2,
    position: readyAgain.net.position,
  });
  assert.notStrictEqual(repeatedImpact.presentation.netImpact, firstImpact);
  assert.deepEqual(impact.presentation.netImpact, firstImpact);
});

test("reduced-motion mode slows simulation movement while keeping catch outcomes playable", () => {
  const standard = createHandNetState({ seed: 333, creatureCount: 1 });
  const reduced = createHandNetState({ seed: 333, creatureCount: 1, reducedMotion: true });
  const standardAdvanced = tickHandNetState(standard, 500);
  const reducedAdvanced = tickHandNetState(reduced, 500);
  const standardTravel = Math.hypot(
    standardAdvanced.creatures[0].position.x - standard.creatures[0].position.x,
    standardAdvanced.creatures[0].position.y - standard.creatures[0].position.y,
  );
  const reducedTravel = Math.hypot(
    reducedAdvanced.creatures[0].position.x - reduced.creatures[0].position.x,
    reducedAdvanced.creatures[0].position.y - reduced.creatures[0].position.y,
  );

  assert.equal(reduced.presentation.waveMotion, false);
  assert.ok(reduced.presentation.motionScale < standard.presentation.motionScale);
  assert.ok(reducedTravel < standardTravel);

  const controlled = controlledSingleCreature({ reducedMotion: true });
  controlled.creatures[0].position = { ...controlled.net.position };
  controlled.creatures[0].speed = 0;
  const caught = tickHandNetState(
    applyHandNetAction(controlled, { type: HAND_NET_ACTIONS.SCOOP }),
    controlled.settings.scoopAnimationMs,
  );
  assert.equal(caught.phase, HAND_NET_PHASES.CAUGHT);
  assert.equal(controlled.settings.scoopAnimationMs, standard.settings.scoopAnimationMs);
  assert.equal(controlled.settings.scoopContactMs, standard.settings.scoopContactMs);
});

test("public functions reject malformed options, actions, state, and elapsed time", () => {
  for (const seed of [-1, UINT32_MAX_PLUS_ONE(), 1.5, Number.NaN]) {
    assert.throws(() => createHandNetState({ seed }), /unsigned 32-bit integer/);
  }
  for (const creatureCount of [0, 9, 1.5]) {
    assert.throws(() => createHandNetState({ creatureCount }), /creatureCount/);
  }
  assert.throws(
    () => createHandNetState({ requiredCreatureId: "imaginary-fish" }),
    /Unknown required hand-net creature/,
  );
  assert.throws(() => createHandNetState({ reducedMotion: 1 }), /reducedMotion must be boolean/);

  const state = createHandNetState({ seed: 1, creatureCount: 1 });
  assert.throws(() => applyHandNetAction(state, null), /action requires a type/);
  assert.throws(() => applyHandNetAction(state, { type: "jump" }), /Unknown hand-net action/);
  assert.throws(
    () => applyHandNetAction(state, { type: HAND_NET_ACTIONS.MOVE, x: 2, y: 0 }),
    /between -1 and 1/,
  );
  assert.throws(
    () => applyHandNetAction(state, { type: HAND_NET_ACTIONS.MOVE, x: Number.NaN, y: 0 }),
    /move x must be finite/,
  );
  assert.throws(() => tickHandNetState({}, 20), /state must use version/);
  assert.throws(() => tickHandNetState(state, -1), /elapsedMs must stay between/);
  assert.throws(() => tickHandNetState(state, 10_001), /elapsedMs must stay between/);
  assert.throws(() => tickHandNetState(state, Number.NaN), /elapsedMs must be finite/);
});

function UINT32_MAX_PLUS_ONE() {
  return 0x1_0000_0000;
}
