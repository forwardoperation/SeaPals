import assert from "node:assert/strict";
import test from "node:test";
import {
  SCENES,
  START_STATE,
  getInteraction,
  getTile,
  isInBounds,
  isWalkable,
  movePlayer,
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
  assert.deepEqual(movePlayer("town", { x: 3, y: 5 }, "up"), { x: 3, y: 5 });
  assert.deepEqual(movePlayer("town", { x: 6, y: 4 }, "left"), { x: 6, y: 4 });
  assert.deepEqual(movePlayer("coral-home", { x: 3, y: 5 }, "up"), { x: 3, y: 5 });
  assert.deepEqual(movePlayer("coral-home", { x: 5, y: 6 }, "down"), { x: 5, y: 6 });
  assert.deepEqual(movePlayer("coral-home", { x: 5, y: 3 }, "up"), { x: 5, y: 3 });
});

test("town doors enter the two homes only when the player faces them", () => {
  assert.deepEqual(getInteraction("town", { x: 3, y: 5 }, "up"), {
    type: "enter",
    targetScene: "coral-home",
    spawn: { x: 5, y: 6 },
  });
  assert.deepEqual(getInteraction("town", { x: 12, y: 5 }, "up"), {
    type: "enter",
    targetScene: "deep-home",
    spawn: { x: 5, y: 6 },
  });
  assert.equal(getInteraction("town", { x: 3, y: 5 }, "left"), null);
  assert.equal(getInteraction("town", { x: 3, y: 6 }, "up"), null);
});

test("interior exits return the player outside the matching town door", () => {
  assert.deepEqual(getInteraction("coral-home", { x: 5, y: 6 }, "down"), {
    type: "exit",
    targetScene: "town",
    spawn: { x: 3, y: 5 },
  });
  assert.deepEqual(getInteraction("deep-home", { x: 5, y: 6 }, "down"), {
    type: "exit",
    targetScene: "town",
    spawn: { x: 12, y: 5 },
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
