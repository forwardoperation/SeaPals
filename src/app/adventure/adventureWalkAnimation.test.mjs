import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVENTURE_WALK_ANIMATION_DEFAULTS,
  getAdventureWalkCycleDurationMs,
  hasAdventureWalkDisplacement,
} from "./adventureWalkAnimation.mjs";

test("one complete walk cycle covers one world tile", () => {
  assert.deepEqual(ADVENTURE_WALK_ANIMATION_DEFAULTS, {
    cycleDistance: 1,
    displacementEpsilon: 0.0005,
  });
  assert.equal(Object.isFrozen(ADVENTURE_WALK_ANIMATION_DEFAULTS), true);
  assert.equal(getAdventureWalkCycleDurationMs(4), 250);
  assert.equal(getAdventureWalkCycleDurationMs(0.5), 2000);
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
  assert.equal(getAdventureWalkCycleDurationMs(2, { cycleDistance: 0.5 }), 250);
});

test("walk cadence rejects invalid speeds and distances", () => {
  assert.throws(() => getAdventureWalkCycleDurationMs(0), /walk speed must be a positive finite number/);
  assert.throws(() => getAdventureWalkCycleDurationMs(Number.NaN), /walk speed must be a positive finite number/);
  assert.throws(
    () => getAdventureWalkCycleDurationMs(4, { cycleDistance: -1 }),
    /cycle distance must be a positive finite number/,
  );
});
