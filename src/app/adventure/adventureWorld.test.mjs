import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTINUOUS_MOVEMENT_DEFAULTS,
  SCENES,
  START_STATE,
  canOccupyContinuousPosition,
  getContinuousInteraction,
  getInteraction,
  getTile,
  isInBounds,
  isWalkable,
  movePlayer,
  movePlayerContinuous,
} from "./adventureWorld.mjs";

test("world exposes the requested town and interior dimensions", () => {
  assert.deepEqual(Object.keys(SCENES), ["town", "coral-home", "deep-home"]);
  assert.equal(SCENES.town.width, 16);
  assert.equal(SCENES.town.height, 10);
  assert.equal(SCENES["coral-home"].width, 12);
  assert.equal(SCENES["coral-home"].height, 8);
  assert.equal(SCENES["deep-home"].width, 12);
  assert.equal(SCENES["deep-home"].height, 8);
  assert.ok(Object.values(SCENES).every((scene) => scene.tiles.every((row) => row.length === scene.width)));
});

test("start state places the player near the bottom-center town path", () => {
  assert.deepEqual(START_STATE, {
    sceneId: "town",
    position: { x: 7, y: 8 },
    facing: "up",
  });
  assert.equal(isWalkable(START_STATE.sceneId, START_STATE.position), true);
});

test("movement advances over walkable tiles and respects map bounds", () => {
  assert.deepEqual(movePlayer("town", { x: 7, y: 8 }, "up"), { x: 7, y: 7 });
  assert.deepEqual(movePlayer("town", { x: 7, y: 8 }, "down"), { x: 7, y: 8 });
  assert.equal(isInBounds("town", { x: 15, y: 9 }), true);
  assert.equal(isInBounds("town", { x: 16, y: 9 }), false);
  assert.equal(getTile("town", { x: -1, y: 0 }), null);
});

test("movement cannot cross buildings, doors, furniture, exits, or trainers", () => {
  assert.deepEqual(movePlayer("town", { x: 5, y: 4 }, "up"), { x: 5, y: 4 });
  assert.deepEqual(movePlayer("town", { x: 6, y: 4 }, "right"), { x: 6, y: 4 });
  assert.deepEqual(movePlayer("coral-home", { x: 4, y: 5 }, "left"), { x: 4, y: 5 });
  assert.deepEqual(movePlayer("coral-home", { x: 5, y: 6 }, "down"), { x: 5, y: 6 });
  assert.deepEqual(movePlayer("coral-home", { x: 5, y: 3 }, "up"), { x: 5, y: 3 });
  assert.equal(isWalkable("coral-home", { x: 6, y: 1 }), false);
  assert.equal(isWalkable("deep-home", { x: 6, y: 1 }), false);
});

test("town doors enter the two homes only when the player faces them", () => {
  assert.deepEqual(getInteraction("town", { x: 5, y: 4 }, "up"), {
    type: "enter",
    targetScene: "coral-home",
    spawn: { x: 5, y: 6 },
  });
  assert.deepEqual(getInteraction("town", { x: 11, y: 4 }, "up"), {
    type: "enter",
    targetScene: "deep-home",
    spawn: { x: 5, y: 6 },
  });
  assert.equal(getInteraction("town", { x: 5, y: 4 }, "left"), null);
  assert.equal(getInteraction("town", { x: 5, y: 5 }, "up"), null);
});

test("interior exits return the player outside the matching town door", () => {
  assert.deepEqual(getInteraction("coral-home", { x: 5, y: 6 }, "down"), {
    type: "exit",
    targetScene: "town",
    spawn: { x: 5, y: 4 },
  });
  assert.deepEqual(getInteraction("deep-home", { x: 5, y: 6 }, "down"), {
    type: "exit",
    targetScene: "town",
    spawn: { x: 11, y: 4 },
  });
});

test("facing an adjacent trainer yields the matching trainer interaction", () => {
  assert.deepEqual(getInteraction("coral-home", { x: 5, y: 3 }, "up"), {
    type: "trainer",
    trainerId: "marina",
  });
  assert.deepEqual(getInteraction("deep-home", { x: 4, y: 2 }, "right"), {
    type: "trainer",
    trainerId: "dorian",
  });
  assert.equal(getInteraction("deep-home", { x: 5, y: 4 }, "up"), null);
});

test("invalid scene, position, and direction inputs fail clearly", () => {
  assert.throws(() => movePlayer("missing", { x: 0, y: 0 }, "up"), /Unknown adventure scene/);
  assert.throws(() => movePlayer("town", { x: 1.5, y: 2 }, "up"), /integer x and y/);
  assert.throws(() => movePlayer("town", { x: 7, y: 8 }, "north"), /Unknown movement direction/);
});

test("fractional player positions use a circular collision radius", () => {
  assert.equal(canOccupyContinuousPosition("town", { x: 7.35, y: 7.6 }), true);
  assert.equal(canOccupyContinuousPosition("town", { x: 5, y: 3 }), false);
  assert.equal(canOccupyContinuousPosition("town", { x: 5, y: 3.7 }), false);
  assert.equal(canOccupyContinuousPosition("town", { x: 5, y: 3.73 }), true);
  assert.equal(canOccupyContinuousPosition("town", { x: -0.4, y: 5 }), false);
  assert.equal(CONTINUOUS_MOVEMENT_DEFAULTS.radius, 0.22);
});

test("continuous movement scales with elapsed milliseconds and normalizes diagonals", () => {
  const straight = movePlayerContinuous("town", { x: 7, y: 8 }, { x: 0, y: -1 }, 125);
  assert.equal(straight.x, 7);
  assert.ok(Math.abs(straight.y - 7.5) < 1e-9);

  const start = { x: 6, y: 6 };
  const diagonal = movePlayerContinuous("coral-home", start, { x: 1, y: -1 }, 100);
  assert.ok(Math.abs(Math.hypot(diagonal.x - start.x, diagonal.y - start.y) - 0.4) < 1e-9);
});

test("continuous movement substeps prevent tunneling through a blocked exit", () => {
  const result = movePlayerContinuous("coral-home", { x: 5, y: 6 }, { x: 0, y: 1 }, 1000);
  assert.ok(result.y >= 6.19 && result.y <= 6.3, `expected to stop before exit, received y=${result.y}`);
  assert.equal(canOccupyContinuousPosition("coral-home", result), true);
});

test("axis-separated collision slides along furniture instead of stopping both axes", () => {
  const result = movePlayerContinuous("coral-home", { x: 4, y: 5 }, { x: -1, y: -1 }, 250);
  assert.ok(result.x >= 3.7, `expected furniture to block leftward travel, received x=${result.x}`);
  assert.ok(result.y < 4.4, `expected vertical slide, received y=${result.y}`);
  assert.equal(canOccupyContinuousPosition("coral-home", result), true);
});

test("continuous interactions allow small offsets but enforce facing and range", () => {
  assert.deepEqual(getContinuousInteraction("town", { x: 5.3, y: 4.15 }, "up"), {
    type: "enter",
    targetScene: "coral-home",
    spawn: { x: 5, y: 6 },
  });
  assert.equal(getContinuousInteraction("town", { x: 5.3, y: 4.15 }, "right"), null);
  assert.equal(getContinuousInteraction("town", { x: 5, y: 4.5 }, "up"), null);
  assert.deepEqual(getContinuousInteraction("deep-home", { x: 5.4, y: 3.1 }, "up"), {
    type: "trainer",
    trainerId: "dorian",
  });
});

test("continuous helpers reject invalid numeric inputs without changing grid APIs", () => {
  assert.deepEqual(movePlayer("town", { x: 7, y: 8 }, "up"), { x: 7, y: 7 });
  assert.deepEqual(movePlayerContinuous("town", { x: 7.25, y: 8 }, { x: 0, y: 0 }, 16), { x: 7.25, y: 8 });
  assert.throws(
    () => movePlayerContinuous("town", { x: 7, y: 8 }, { x: 0, y: -1 }, -1),
    /Elapsed time must be a non-negative finite number/,
  );
  assert.throws(
    () => canOccupyContinuousPosition("town", { x: Number.NaN, y: 8 }),
    /finite x and y/,
  );
});
