import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVENTURE_ACTOR_ANIMATION_MODES,
  ADVENTURE_WALK_FRAME_REGISTRATIONS,
  ADVENTURE_WALK_ANIMATION_DEFAULTS,
  getAdventureActorAnimationMode,
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

test("stationary residents walk in place while patrols follow real movement", () => {
  assert.equal(
    getAdventureActorAnimationMode({ hasPatrol: false }),
    ADVENTURE_ACTOR_ANIMATION_MODES.STEPPING_IN_PLACE,
  );
  assert.equal(
    getAdventureActorAnimationMode({ hasPatrol: true, isMoving: true }),
    ADVENTURE_ACTOR_ANIMATION_MODES.WALKING,
  );
  assert.equal(
    getAdventureActorAnimationMode({ hasPatrol: false, isMoving: true }),
    ADVENTURE_ACTOR_ANIMATION_MODES.WALKING,
  );
  assert.equal(
    getAdventureActorAnimationMode({ hasPatrol: true, isMoving: false }),
    ADVENTURE_ACTOR_ANIMATION_MODES.STILL,
  );
});

test("resident animation stops during conversations, pauses, hidden tabs, and reduced motion", () => {
  const stationaryResident = { hasPatrol: false };
  for (const inactiveState of [
    { isEngaged: true },
    { movementPaused: true },
    { pageVisible: false },
    { reducedMotion: true },
  ]) {
    assert.equal(
      getAdventureActorAnimationMode({ ...stationaryResident, ...inactiveState }),
      ADVENTURE_ACTOR_ANIMATION_MODES.STILL,
    );
  }
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
  assert.equal(getAdventureWalkCycleDurationMs(2, { cycleDistance: 0.5 }), 480);
  assert.equal(
    getAdventureWalkCycleDurationMs(2, {
      cycleDistance: 0.5,
      minimumCycleDurationMs: 100,
    }),
    250,
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
