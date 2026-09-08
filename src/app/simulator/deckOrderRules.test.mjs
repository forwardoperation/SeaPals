import assert from "node:assert/strict";
import test from "node:test";

import { getDeckOrderDestinationIndex, moveDeckOrderItem } from "./deckOrderRules.mjs";

test("moveDeckOrderItem moves one occurrence to an arbitrary destination without mutating input", () => {
  const cards = ["first", "second", "third", "fourth", "fifth"];

  assert.deepEqual(
    moveDeckOrderItem(cards, 1, 4),
    ["first", "third", "fourth", "fifth", "second"],
  );
  assert.deepEqual(
    moveDeckOrderItem(cards, 4, 1),
    ["first", "fifth", "second", "third", "fourth"],
  );
  assert.deepEqual(cards, ["first", "second", "third", "fourth", "fifth"]);
});

test("moveDeckOrderItem reorders duplicate card ids by occurrence rather than value", () => {
  const cards = ["duplicate", "middle", "duplicate", "last"];

  assert.deepEqual(
    moveDeckOrderItem(cards, 2, 0),
    ["duplicate", "duplicate", "middle", "last"],
  );
  assert.deepEqual(cards, ["duplicate", "middle", "duplicate", "last"]);
});

test("moveDeckOrderItem safely ignores same-position and invalid moves", () => {
  const cards = ["first", "second", "third"];

  for (const [fromIndex, toIndex] of [
    [1, 1],
    [-1, 1],
    [3, 1],
    [1, -1],
    [1, 3],
    [Number.NaN, 1],
    [1, Number.NaN],
  ]) {
    assert.deepEqual(moveDeckOrderItem(cards, fromIndex, toIndex), cards);
  }
  assert.deepEqual(cards, ["first", "second", "third"]);
});

test("drop insertion slots resolve correctly on both sides of the dragged row", () => {
  assert.equal(getDeckOrderDestinationIndex(5, 1, 3), 2, "dropping B before D should produce A, C, B, D, E");
  assert.equal(getDeckOrderDestinationIndex(5, 1, 5), 4, "dropping below the list should move B to the end");
  assert.equal(getDeckOrderDestinationIndex(5, 3, 1), 1, "dropping D before B should move it to position two");
  assert.equal(getDeckOrderDestinationIndex(5, 1, 2), 1, "dropping B immediately after itself should be a no-op");
});
