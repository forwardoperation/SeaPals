import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVENTURE_ACTOR_ANIMATION_MODES,
  ADVENTURE_NPC_IDLE_WALK_CYCLE_DURATION_MS,
  ADVENTURE_NPC_WALK_CYCLE_DISTANCE,
  ADVENTURE_WALK_FRAME_REGISTRATIONS,
  ADVENTURE_WALK_ANIMATION_DEFAULTS,
  getAdventureActorAnimationMode,
  getAdventureIdleWalkDelayMs,
  getAdventureWalkCycleDurationMs,
  getAdventureWalkFrameRegistration,
  hasAdventureWalkDisplacement,
  isAdventurePlayerWalking,
} from "./adventureWalkAnimation.mjs";

test("one complete walk cycle covers one world tile without flashing through poses", () => {
  assert.deepEqual(ADVENTURE_WALK_ANIMATION_DEFAULTS, {
    cycleDistance: 1,
    minimumCycleDurationMs: 480,
    displacementEpsilon: 0.0005,
  });
  assert.equal(Object.isFrozen(ADVENTURE_WALK_ANIMATION_DEFAULTS), true);
  assert.equal(getAdventureWalkCycleDurationMs(4), 480);
  assert.equal(getAdventureWalkCycleDurationMs(0.5), 2000);
});

test("player walking follows intent immediately and stops in inactive modes", () => {
  assert.equal(isAdventurePlayerWalking({ isMoving: true }), true);
  assert.equal(isAdventurePlayerWalking({ isMoving: true, movementPaused: true }), false);
  assert.equal(isAdventurePlayerWalking({ isMoving: true, boatMode: true }), false);
  assert.equal(isAdventurePlayerWalking({ isMoving: false }), false);
});

test("only opted-in stationary residents use the presentation-only walk", () => {
  assert.equal(
    getAdventureActorAnimationMode(),
    ADVENTURE_ACTOR_ANIMATION_MODES.STILL,
  );
  assert.equal(
    getAdventureActorAnimationMode({ isMoving: true }),
    ADVENTURE_ACTOR_ANIMATION_MODES.WALKING,
  );
  assert.equal(
    getAdventureActorAnimationMode({ isMoving: false }),
    ADVENTURE_ACTOR_ANIMATION_MODES.STILL,
  );
  assert.equal(
    getAdventureActorAnimationMode({ idleWalk: true }),
    ADVENTURE_ACTOR_ANIMATION_MODES.IDLE_WALKING,
  );
  assert.equal(
    getAdventureActorAnimationMode({ isMoving: true, idleWalk: true }),
    ADVENTURE_ACTOR_ANIMATION_MODES.WALKING,
  );
  assert.deepEqual(ADVENTURE_ACTOR_ANIMATION_MODES, {
    STILL: "still",
    WALKING: "walking",
    IDLE_WALKING: "idle-walking",
  });
});

test("resident animation stops during conversations, pauses, hidden tabs, and reduced motion", () => {
  for (const inactiveState of [
    { isMoving: true, idleWalk: true, isEngaged: true },
    { isMoving: true, idleWalk: true, movementPaused: true },
    { isMoving: true, idleWalk: true, pageVisible: false },
    { isMoving: true, idleWalk: true, reducedMotion: true },
  ]) {
    assert.equal(
      getAdventureActorAnimationMode(inactiveState),
      ADVENTURE_ACTOR_ANIMATION_MODES.STILL,
    );
  }
});

test("idle resident cycles use a deterministic staggered phase", () => {
  assert.equal(ADVENTURE_NPC_IDLE_WALK_CYCLE_DURATION_MS, 3200);
  const georgeDelay = getAdventureIdleWalkDelayMs("interaction-coral-home-marina");
  const calvinDelay = getAdventureIdleWalkDelayMs("interaction-deep-home-dorian");
  assert.equal(georgeDelay, getAdventureIdleWalkDelayMs("interaction-coral-home-marina"));
  assert.notEqual(georgeDelay, calvinDelay);
  assert.ok(georgeDelay <= 0 && georgeDelay > -ADVENTURE_NPC_IDLE_WALK_CYCLE_DURATION_MS);
  assert.ok(calvinDelay <= 0 && calvinDelay > -ADVENTURE_NPC_IDLE_WALK_CYCLE_DURATION_MS);
  assert.throws(
    () => getAdventureIdleWalkDelayMs("resident", { cycleDurationMs: 0 }),
    /idle walk cycle duration must be a positive finite number/,
  );
});

test("every authored sprite profile registers all three walk frames for every facing", () => {
  const facingNames = ["down", "left", "right", "up"];
  assert.equal(Object.keys(ADVENTURE_WALK_FRAME_REGISTRATIONS).length, 12);

  for (const [profile, facingRegistrations] of Object.entries(ADVENTURE_WALK_FRAME_REGISTRATIONS)) {
    assert.deepEqual(Object.keys(facingRegistrations), facingNames, `${profile} should define every facing`);
    for (const facing of facingNames) {
      const { frameA, neutral, frameB } = facingRegistrations[facing];
      assert.ok(frameA >= 0 && frameA < neutral, `${profile}/${facing} frame A should precede neutral`);
      assert.ok(neutral < frameB && frameB <= 100, `${profile}/${facing} frame B should follow neutral`);
    }
  }
});

test("frame registration calibrates the most uneven sheets and safely falls back", () => {
  assert.deepEqual(
    getAdventureWalkFrameRegistration({ profile: "ivy", facing: "down" }),
    { frameA: 13.4, neutral: 49.6, frameB: 83.4 },
  );
  assert.deepEqual(
    getAdventureWalkFrameRegistration({ profile: "academy-mentor", facing: "right" }),
    { frameA: 3.9, neutral: 48.2, frameB: 93.8 },
  );
  assert.equal(
    getAdventureWalkFrameRegistration({ profile: "missing-sheet", facing: "left" }),
    ADVENTURE_WALK_FRAME_REGISTRATIONS.player.left,
  );
  assert.equal(
    getAdventureWalkFrameRegistration({ profile: "town-adult", facing: "diagonal" }),
    ADVENTURE_WALK_FRAME_REGISTRATIONS["town-adult"].down,
  );
});

test("walk displacement helper distinguishes blocked frames from real travel", () => {
  const start = { x: 4, y: 5 };
  const moved = { x: 4.08, y: 5 };
  assert.equal(hasAdventureWalkDisplacement(start, moved), true);
  assert.equal(hasAdventureWalkDisplacement(moved, moved), false);
  assert.equal(hasAdventureWalkDisplacement(start, { x: 4.0005, y: 5 }), false);
});

test("walk displacement rejects malformed positions and thresholds", () => {
  assert.throws(
    () => hasAdventureWalkDisplacement({ x: 0, y: 0 }, { x: Number.NaN, y: 0 }),
    /next walk position requires finite x and y/,
  );
  assert.throws(
    () => hasAdventureWalkDisplacement({ x: 0, y: 0 }, { x: 1, y: 0 }, { epsilon: -1 }),
    /epsilon must be a non-negative finite number/,
  );
});

test("walk cadence supports an explicitly measured cycle distance", () => {
  assert.equal(ADVENTURE_NPC_WALK_CYCLE_DISTANCE, 0.5);
  assert.equal(getAdventureWalkCycleDurationMs(2, { cycleDistance: 0.5 }), 480);
  assert.equal(
    getAdventureWalkCycleDurationMs(2, {
      cycleDistance: 0.5,
      minimumCycleDurationMs: 100,
    }),
    250,
  );
  assert.equal(getAdventureWalkCycleDurationMs(0.5), 2000);
  assert.equal(
    getAdventureWalkCycleDurationMs(0.5, {
      cycleDistance: ADVENTURE_NPC_WALK_CYCLE_DISTANCE,
    }),
    1000,
  );
});

test("walk cadence rejects invalid speeds and distances", () => {
  assert.throws(() => getAdventureWalkCycleDurationMs(0), /walk speed must be a positive finite number/);
  assert.throws(() => getAdventureWalkCycleDurationMs(Number.NaN), /walk speed must be a positive finite number/);
  assert.throws(
    () => getAdventureWalkCycleDurationMs(4, { cycleDistance: -1 }),
    /cycle distance must be a positive finite number/,
  );
  assert.throws(
    () => getAdventureWalkCycleDurationMs(4, { minimumCycleDurationMs: 0 }),
    /minimum walk cycle duration must be a positive finite number/,
  );
});
