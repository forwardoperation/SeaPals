import assert from "node:assert/strict";
import test from "node:test";
import {
  START_STATE,
  canOccupyContinuousPosition,
  getDoorwayTransition,
  movePlayerContinuous,
} from "./adventureWorld.mjs";

const POSITION_EPSILON = 1e-8;

function walkAxisRoute(points) {
  return points.slice(1).reduce((position, target) => {
    const rawDelta = { x: target.x - position.x, y: target.y - position.y };
    const delta = {
      x: Math.abs(rawDelta.x) < POSITION_EPSILON ? 0 : rawDelta.x,
      y: Math.abs(rawDelta.y) < POSITION_EPSILON ? 0 : rawDelta.y,
    };
    assert.ok(delta.x === 0 || delta.y === 0, "town regression routes must stay axis-aligned");
    const distance = Math.hypot(delta.x, delta.y);
    const movement = { x: Math.sign(delta.x), y: Math.sign(delta.y) };
    const next = movePlayerContinuous("town", position, movement, (distance / 4) * 1000);

    assert.ok(
      Math.hypot(next.x - target.x, next.y - target.y) < POSITION_EPSILON,
      `expected continuous movement to reach (${target.x}, ${target.y}), stopped at (${next.x}, ${next.y})`,
    );
    assert.equal(canOccupyContinuousPosition("town", next), true);
    return next;
  }, points[0]);
}

test("continuous town routes connect the bottom spawn to all three doorways", () => {
  const routes = [
    {
      waypoints: [START_STATE.position, { x: 8, y: 8 }, { x: 8, y: 1.8 }],
      interactionId: "interaction-town-enter-academy",
    },
    {
      waypoints: [START_STATE.position, { x: 5, y: 8 }, { x: 5, y: 3.8 }],
      interactionId: "interaction-town-enter-coral-home",
    },
    {
      waypoints: [START_STATE.position, { x: 11, y: 8 }, { x: 11, y: 3.8 }],
      interactionId: "interaction-town-enter-deep-home",
    },
  ];

  for (const { waypoints, interactionId } of routes) {
    const doorwayApproach = walkAxisRoute(waypoints);
    assert.equal(getDoorwayTransition("town", doorwayApproach, "up")?.interactionId, interactionId);
  }
});

test("the town paths connect around the central sign and between both homes", () => {
  const blockedBySign = movePlayerContinuous("town", { x: 8, y: 4 }, { x: 1, y: 0 }, 500);
  assert.ok(blockedBySign.x < 8.5, `expected the sign to remain solid, received x=${blockedBySign.x}`);

  // The lower edge of the sign is visible sand. It connects the left home,
  // central academy path, and right home without forcing a trip to the dock.
  walkAxisRoute([
    { x: 5, y: 3.8 },
    { x: 5, y: 5 },
    { x: 8, y: 5 },
    { x: 11, y: 5 },
    { x: 11, y: 3.8 },
  ]);

  // Both visible sides of the sign remain reachable by walking around its
  // bottom edge, even though walking straight through the artwork is blocked.
  walkAxisRoute([
    { x: 8, y: 4 },
    { x: 8, y: 5 },
    { x: 10, y: 5 },
    { x: 10, y: 4 },
  ]);

  // Returning from the academy can leave the sprite slightly left of the
  // path center. That offset must still fit beside the sign's tight collider.
  walkAxisRoute([
    { x: 7.7, y: 4 },
    { x: 7.7, y: 5 },
  ]);
});

test("town traversal still treats building footprints and border foliage as solid", () => {
  const solidArtwork = [
    ["coral-home building", { x: 5, y: 2 }],
    ["deep-home building", { x: 11, y: 2 }],
    ["central sign", { x: 9, y: 4 }],
    ["left foliage", { x: 1, y: 5 }],
    ["right foliage", { x: 15, y: 7 }],
    ["bottom foliage", { x: 7, y: 9 }],
  ];

  for (const [label, position] of solidArtwork) {
    assert.equal(canOccupyContinuousPosition("town", position), false, `${label} should be solid`);
  }
});
