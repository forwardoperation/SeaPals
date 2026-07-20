import assert from "node:assert/strict";
import test from "node:test";

import { movePlayerContinuous } from "./adventureWorld.mjs";

const PLAYER_RADIUS = 0.22;

function distance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function movementOptions(dynamicBlockers, overrides = {}) {
  return {
    radius: PLAYER_RADIUS,
    speed: 4,
    maxStepDistance: 0.05,
    dynamicBlockers,
    ...overrides,
  };
}

test("an actor already overlapping a dynamic blocker can move steadily out of it", () => {
  const start = { x: 5, y: 5 };
  const blocker = { id: "resident", position: { x: 5.3, y: 5 }, radius: 0.33 };
  const moved = movePlayerContinuous(
    "coral-home",
    start,
    { x: -1, y: 0 },
    100,
    movementOptions([blocker]),
  );

  assert.ok(moved.x < start.x, `expected an escape step, received x=${moved.x}`);
  assert.ok(distance(moved, blocker.position) > distance(start, blocker.position));
  assert.ok(distance(moved, blocker.position) >= PLAYER_RADIUS + blocker.radius);
});

test("overlap recovery cannot approach or jump through the blocker", () => {
  const start = { x: 5, y: 5 };
  const blocker = { id: "resident", position: { x: 5.3, y: 5 }, radius: 0.33 };
  const approached = movePlayerContinuous(
    "coral-home",
    start,
    { x: 1, y: 0 },
    100,
    movementOptions([blocker]),
  );
  const jumped = movePlayerContinuous(
    "coral-home",
    start,
    { x: 1, y: 0 },
    100,
    movementOptions([blocker], { speed: 20, maxStepDistance: 3 }),
  );

  assert.deepEqual(approached, start);
  assert.deepEqual(jumped, start);
});

test("normal swept collision resumes immediately after separation", () => {
  const blocker = { id: "resident", position: { x: 5.3, y: 5 }, radius: 0.33 };
  const escaped = movePlayerContinuous(
    "coral-home",
    { x: 5, y: 5 },
    { x: -1, y: 0 },
    100,
    movementOptions([blocker]),
  );
  const returned = movePlayerContinuous(
    "coral-home",
    escaped,
    { x: 1, y: 0 },
    200,
    movementOptions([blocker]),
  );

  assert.ok(returned.x > escaped.x);
  assert.ok(distance(returned, blocker.position) >= PLAYER_RADIUS + blocker.radius - 1e-9);
  assert.ok(returned.x <= 4.75 + 1e-9, `expected blocker boundary at x=4.75, received ${returned.x}`);
});

test("an escape step must increase separation from every overlapping blocker", () => {
  const start = { x: 5, y: 5 };
  const blockers = [
    { id: "east", position: { x: 5.25, y: 5 }, radius: 0.33 },
    { id: "west", position: { x: 4.75, y: 5 }, radius: 0.33 },
  ];
  const blockedLeft = movePlayerContinuous(
    "coral-home",
    start,
    { x: -1, y: 0 },
    100,
    movementOptions(blockers),
  );
  const escapedUp = movePlayerContinuous(
    "coral-home",
    start,
    { x: 0, y: -1 },
    100,
    movementOptions(blockers),
  );

  assert.deepEqual(blockedLeft, start);
  assert.ok(escapedUp.y < start.y);
  for (const blocker of blockers) {
    assert.ok(distance(escapedUp, blocker.position) > distance(start, blocker.position));
  }
});

test("static walls still stop movement while the actor escapes a live blocker", () => {
  const start = { x: 5, y: 6 };
  const blocker = { id: "resident", position: { x: 5, y: 5.7 }, radius: 0.33 };
  const moved = movePlayerContinuous(
    "coral-home",
    start,
    { x: 0, y: 1 },
    300,
    movementOptions([blocker], { maxStepDistance: 0.02 }),
  );

  assert.ok(moved.y > 6.2, `expected movement away from blocker, received y=${moved.y}`);
  assert.ok(moved.y <= 6.28 + 1e-9, `exit wall should stop the player, received y=${moved.y}`);
});
