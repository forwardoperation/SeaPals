import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVENTURE_CARDINAL_DIRECTIONS,
  ADVENTURE_CARDINAL_VECTORS,
  resolveAdventureMovementInput,
} from "./adventureMovementInput.mjs";

test("every valid overworld direction resolves to one cardinal unit vector", () => {
  const expected = {
    up: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
  };

  assert.deepEqual(ADVENTURE_CARDINAL_DIRECTIONS, ["up", "right", "down", "left"]);
  assert.equal(Object.isFrozen(ADVENTURE_CARDINAL_DIRECTIONS), true);
  assert.equal(Object.isFrozen(ADVENTURE_CARDINAL_VECTORS), true);

  for (const direction of ADVENTURE_CARDINAL_DIRECTIONS) {
    assert.deepEqual(resolveAdventureMovementInput([direction]), {
      direction,
      vector: expected[direction],
    });
    assert.equal(Object.isFrozen(ADVENTURE_CARDINAL_VECTORS[direction]), true);
  }
});

test("the most recently pressed direction wins competing and opposing ties", () => {
  assert.deepEqual(resolveAdventureMovementInput(["up", "right"]), {
    direction: "right",
    vector: { x: 1, y: 0 },
  });
  assert.deepEqual(resolveAdventureMovementInput(["left", "right"]), {
    direction: "right",
    vector: { x: 1, y: 0 },
  });
  assert.deepEqual(resolveAdventureMovementInput(["down", "left", "down"]), {
    direction: "down",
    vector: { x: 0, y: 1 },
  });
});

test("keyboard Maps and touch Sets retain their input order", () => {
  const keyboardDirections = new Map([
    ["KeyW", "up"],
    ["KeyA", "left"],
  ]);
  const touchDirections = new Set(["down", "right"]);

  assert.deepEqual(resolveAdventureMovementInput(keyboardDirections), {
    direction: "left",
    vector: { x: -1, y: 0 },
  });
  assert.deepEqual(resolveAdventureMovementInput(touchDirections), {
    direction: "right",
    vector: { x: 1, y: 0 },
  });
  assert.deepEqual(
    resolveAdventureMovementInput([
      ...keyboardDirections.values(),
      ...touchDirections.values(),
    ]),
    { direction: "right", vector: { x: 1, y: 0 } },
  );
});

test("no held input returns an explicit neutral movement result", () => {
  const expected = { direction: null, vector: { x: 0, y: 0 } };
  assert.deepEqual(resolveAdventureMovementInput(), expected);
  assert.deepEqual(resolveAdventureMovementInput(null), expected);
  assert.deepEqual(resolveAdventureMovementInput([]), expected);
  assert.deepEqual(resolveAdventureMovementInput(new Set()), expected);
  assert.deepEqual(resolveAdventureMovementInput(new Map()), expected);
});

test("movement input rejects malformed collections and unknown directions", () => {
  assert.throws(
    () => resolveAdventureMovementInput("up"),
    /must be an ordered iterable, not a string/,
  );
  assert.throws(
    () => resolveAdventureMovementInput({ direction: "up" }),
    /must be an ordered iterable/,
  );
  assert.throws(
    () => resolveAdventureMovementInput(["up", "north"]),
    /Unknown adventure movement direction: north/,
  );
});

test("callers cannot mutate the shared vector contract through a result", () => {
  const result = resolveAdventureMovementInput(["right"]);
  result.vector.x = 99;
  assert.deepEqual(resolveAdventureMovementInput(["right"]), {
    direction: "right",
    vector: { x: 1, y: 0 },
  });
});
