import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVENTURE_SCENE_TRANSITION_DURATIONS_MS,
  ADVENTURE_SCENE_TRANSITION_PHASES,
  advanceAdventureSceneTransition,
  createAdventureSceneTransition,
  getAdventureDoorStepVector,
  getAdventureSceneTransitionDurationMs,
} from "./adventureSceneTransition.mjs";

const TRANSITION_INPUT = Object.freeze({
  sourceSceneId: "town",
  targetSceneId: "coral-home",
  interactionId: "interaction-elverson-enter-park-home",
  type: "enter",
  departureDirection: "up",
  arrivalDirection: "up",
});

test("scene transitions begin in a frozen departing phase", () => {
  const transition = createAdventureSceneTransition(TRANSITION_INPUT);

  assert.deepEqual(transition, {
    phase: "departing",
    ...TRANSITION_INPUT,
    direction: "up",
  });
  assert.equal(Object.isFrozen(transition), true);
  assert.equal(ADVENTURE_SCENE_TRANSITION_PHASES.departing, "departing");
  assert.equal(Object.isFrozen(ADVENTURE_SCENE_TRANSITION_PHASES), true);
});

test("a completed departure advances to a frozen arrival without losing its identity", () => {
  const departing = createAdventureSceneTransition(TRANSITION_INPUT);
  const arriving = advanceAdventureSceneTransition(departing);

  assert.deepEqual(arriving, {
    ...departing,
    phase: "arriving",
    direction: "up",
  });
  assert.notEqual(arriving, departing);
  assert.equal(Object.isFrozen(arriving), true);
  assert.equal(departing.phase, "departing");
});

test("arrival facing can be resolved when the destination scene is committed", () => {
  const departing = createAdventureSceneTransition({
    ...TRANSITION_INPUT,
    arrivalDirection: "down",
  });
  const arriving = advanceAdventureSceneTransition(departing, { arrivalDirection: "left" });

  assert.equal(arriving.departureDirection, "up");
  assert.equal(arriving.arrivalDirection, "left");
  assert.equal(arriving.direction, "left");
});

test("transition timings distinguish departure and arrival and collapse for reduced motion", () => {
  assert.deepEqual(ADVENTURE_SCENE_TRANSITION_DURATIONS_MS, {
    departing: 220,
    arriving: 280,
  });
  assert.equal(Object.isFrozen(ADVENTURE_SCENE_TRANSITION_DURATIONS_MS), true);
  assert.equal(getAdventureSceneTransitionDurationMs("departing"), 220);
  assert.equal(getAdventureSceneTransitionDurationMs("arriving"), 280);
  assert.equal(
    getAdventureSceneTransitionDurationMs("departing", { reducedMotion: true }),
    0,
  );
  assert.equal(
    getAdventureSceneTransitionDurationMs("arriving", { reducedMotion: true }),
    0,
  );
});

test("doorway directions map to frozen cardinal unit vectors", () => {
  assert.deepEqual(getAdventureDoorStepVector("up"), { x: 0, y: -1 });
  assert.deepEqual(getAdventureDoorStepVector("right"), { x: 1, y: 0 });
  assert.deepEqual(getAdventureDoorStepVector("down"), { x: 0, y: 1 });
  assert.deepEqual(getAdventureDoorStepVector("left"), { x: -1, y: 0 });
  assert.equal(Object.isFrozen(getAdventureDoorStepVector("left")), true);
});

test("transition creation rejects missing identity fields and invalid directions", () => {
  for (const field of ["sourceSceneId", "targetSceneId", "interactionId", "type"]) {
    assert.throws(
      () => createAdventureSceneTransition({ ...TRANSITION_INPUT, [field]: "  " }),
      new RegExp(`${field} must be a non-empty string`),
    );
  }

  assert.throws(
    () => createAdventureSceneTransition({ ...TRANSITION_INPUT, departureDirection: "north" }),
    /departureDirection must be up, right, down, or left/,
  );
  assert.throws(
    () => createAdventureSceneTransition({ ...TRANSITION_INPUT, arrivalDirection: undefined }),
    /arrivalDirection must be up, right, down, or left/,
  );
});

test("transition advancement and timing reject invalid state", () => {
  const departing = createAdventureSceneTransition(TRANSITION_INPUT);
  const arriving = advanceAdventureSceneTransition(departing);

  assert.throws(
    () => advanceAdventureSceneTransition(arriving),
    /Only a departing adventure scene transition can begin arriving/,
  );
  assert.throws(
    () => advanceAdventureSceneTransition(departing, { arrivalDirection: "north" }),
    /arrivalDirection must be up, right, down, or left/,
  );
  assert.throws(
    () => getAdventureSceneTransitionDurationMs("complete"),
    /Unknown adventure scene-transition phase/,
  );
  assert.throws(
    () => getAdventureSceneTransitionDurationMs("departing", { reducedMotion: "yes" }),
    /reducedMotion must be a boolean/,
  );
  assert.throws(
    () => getAdventureDoorStepVector("north"),
    /must be up, right, down, or left/,
  );
});
