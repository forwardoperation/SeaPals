import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAutomatedHandLimit,
  createHandLimitChoice,
  resolveHandLimitChoice,
  selectAutomatedHandLimitDiscards,
} from "./handLimitRules.mjs";

test("turn draws create one choice across the old hand and every incoming card", () => {
  const choice = createHandLimitChoice({
    hand: ["h1", "h2", "h3", "h4", "h5", "h6"],
    incomingCards: ["foundation-draw", "pals-draw"],
    handLimit: 7,
  });

  assert.equal(choice.requiredDiscardCount, 1);
  assert.equal(choice.overflowCount, 1);
  assert.equal(choice.needsChoice, true);
  assert.deepEqual(choice.projectedHand, [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "foundation-draw",
    "pals-draw",
  ]);
  assert.deepEqual(
    choice.entries.map(({ key, origin, originIndex, snapshotIndex }) => ({ key, origin, originIndex, snapshotIndex })),
    [
      { key: "hand:0", origin: "hand", originIndex: 0, snapshotIndex: 0 },
      { key: "hand:1", origin: "hand", originIndex: 1, snapshotIndex: 1 },
      { key: "hand:2", origin: "hand", originIndex: 2, snapshotIndex: 2 },
      { key: "hand:3", origin: "hand", originIndex: 3, snapshotIndex: 3 },
      { key: "hand:4", origin: "hand", originIndex: 4, snapshotIndex: 4 },
      { key: "hand:5", origin: "hand", originIndex: 5, snapshotIndex: 5 },
      { key: "incoming:0", origin: "incoming", originIndex: 0, snapshotIndex: 6 },
      { key: "incoming:1", origin: "incoming", originIndex: 1, snapshotIndex: 7 },
    ],
  );
});

test("the player may discard an old card and keep every newly drawn card", () => {
  const choice = createHandLimitChoice({
    hand: ["old-a", "old-b"],
    incomingCards: ["new-draw"],
    handLimit: 2,
  });
  const result = resolveHandLimitChoice(choice, ["hand:0"], ["prior-discard"]);

  assert.deepEqual(result.hand, ["old-b", "new-draw"]);
  assert.deepEqual(result.cardsToDiscard, ["old-a"]);
  assert.deepEqual(result.discardPile, ["old-a", "prior-discard"]);
  assert.deepEqual(result.incomingCardsToHand, ["new-draw"]);
  assert.deepEqual(result.incomingCardsToDiscard, []);
});

test("duplicate card IDs remain independently selectable by occurrence key", () => {
  const choice = createHandLimitChoice({
    hand: ["same-card", "same-card"],
    incomingCards: ["same-card"],
    handLimit: 2,
  });

  assert.deepEqual(choice.entries.map((entry) => entry.key), ["hand:0", "hand:1", "incoming:0"]);
  const result = resolveHandLimitChoice(choice, ["hand:1"]);
  assert.deepEqual(result.hand, ["same-card", "same-card"]);
  assert.deepEqual(result.discardedEntries.map((entry) => entry.key), ["hand:1"]);
  assert.deepEqual(result.keptEntries.map((entry) => entry.key), ["hand:0", "incoming:0"]);
});

test("resolution preserves snapshot order, not selection-click order", () => {
  const choice = createHandLimitChoice({
    hand: ["first", "second"],
    incomingCards: ["third", "fourth"],
    handLimit: 2,
  });
  const result = resolveHandLimitChoice(choice, ["incoming:1", "hand:0"], ["old-discard"]);

  assert.deepEqual(result.hand, ["second", "third"]);
  assert.deepEqual(result.cardsToDiscard, ["first", "fourth"]);
  assert.deepEqual(result.selectedKeys, ["hand:0", "incoming:1"]);
  assert.deepEqual(result.discardPile, ["first", "fourth", "old-discard"]);
});

test("condition reveal can require choices from an already oversized hand", () => {
  const choice = createHandLimitChoice({
    hand: ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
    incomingCards: [],
    handLimit: 7,
  });

  assert.equal(choice.requiredDiscardCount, 2);
  const result = resolveHandLimitChoice(choice, ["hand:1", "hand:7"]);
  assert.deepEqual(result.hand, ["a", "c", "d", "e", "f", "g", "i"]);
  assert.deepEqual(result.cardsToDiscard, ["b", "h"]);
});

test("search, recovery, and Fragment additions allow replacing an existing hand card", () => {
  for (const incomingCard of ["searched-card", "recovered-card", "fragment-card"]) {
    const choice = createHandLimitChoice({
      hand: ["keep-one", "replace-me"],
      incomingCards: [incomingCard],
      handLimit: 2,
    });
    const result = resolveHandLimitChoice(choice, ["hand:1"]);

    assert.deepEqual(result.hand, ["keep-one", incomingCard]);
    assert.deepEqual(result.cardsToDiscard, ["replace-me"]);
    assert.deepEqual(result.incomingCardsToHand, [incomingCard]);
  }
});

test("no-limit and no-overflow resolutions append incoming cards without a prompt", () => {
  for (const handLimit of [Infinity, undefined, Number.NaN]) {
    const choice = createHandLimitChoice({
      hand: ["h1"],
      incomingCards: ["a", "b"],
      handLimit,
    });
    assert.equal(choice.requiredDiscardCount, 0);
    assert.equal(choice.needsChoice, false);
    assert.deepEqual(resolveHandLimitChoice(choice, []).hand, ["h1", "a", "b"]);
  }

  const exact = createHandLimitChoice({ hand: ["h1"], incomingCards: ["a"], handLimit: 2 });
  assert.equal(exact.requiredDiscardCount, 0);
  assert.deepEqual(resolveHandLimitChoice(exact, [], ["old"]).discardPile, ["old"]);
});

test("finite hand limits are truncated and cannot be negative", () => {
  const fractional = createHandLimitChoice({ hand: ["a", "b", "c"], handLimit: 2.9 });
  assert.equal(fractional.handLimit, 2);
  assert.equal(fractional.requiredDiscardCount, 1);

  const negative = createHandLimitChoice({ hand: ["a", "b"], handLimit: -4 });
  assert.equal(negative.handLimit, 0);
  assert.equal(negative.requiredDiscardCount, 2);
});

test("resolution requires the exact number of valid unique occurrence keys", () => {
  const choice = createHandLimitChoice({
    hand: ["a", "b"],
    incomingCards: ["c", "d"],
    handLimit: 2,
  });

  assert.throws(() => resolveHandLimitChoice(choice, ["hand:0"]), /exactly 2 cards/i);
  assert.throws(() => resolveHandLimitChoice(choice, ["hand:0", "hand:1", "incoming:0"]), /exactly 2 cards/i);
  assert.throws(() => resolveHandLimitChoice(choice, ["hand:0", "hand:0"]), /only once/i);
  assert.throws(() => resolveHandLimitChoice(choice, ["hand:0", "missing:9"]), /unknown hand-limit entry key/i);
  assert.throws(() => resolveHandLimitChoice(choice, new Set(["hand:0", "hand:1"])), /selectedKeys must be an array/i);
});

test("choice creation and resolution reject malformed lists and forged choices", () => {
  assert.throws(() => createHandLimitChoice({ hand: "not-an-array" }), /hand must be an array/i);
  assert.throws(() => createHandLimitChoice({ incomingCards: "not-an-array" }), /incomingCards must be an array/i);
  assert.throws(() => resolveHandLimitChoice(null, []), /choice/i);
  assert.throws(
    () => resolveHandLimitChoice({
      requiredDiscardCount: 1,
      entries: [
        { key: "duplicate", cardId: "a" },
        { key: "duplicate", cardId: "b" },
      ],
    }, ["duplicate"]),
    /duplicate entry key/i,
  );
});

test("automated selection discards the lowest keep scores first", () => {
  const choice = createHandLimitChoice({
    hand: ["valuable", "weak", "medium"],
    incomingCards: ["new-weak"],
    handLimit: 2,
  });
  const scores = {
    valuable: 100,
    weak: 1,
    medium: 50,
    "new-weak": 2,
  };

  assert.deepEqual(
    selectAutomatedHandLimitDiscards(choice, (cardId) => scores[cardId]),
    ["hand:1", "incoming:0"],
  );
});

test("automated selection uses a stable tail-first tie break", () => {
  const choice = createHandLimitChoice({
    hand: ["old-a", "old-b"],
    incomingCards: ["new-a", "new-b"],
    handLimit: 2,
  });

  assert.deepEqual(
    selectAutomatedHandLimitDiscards(choice),
    ["incoming:1", "incoming:0"],
  );
  assert.deepEqual(
    selectAutomatedHandLimitDiscards(choice, () => Number.NaN),
    ["incoming:1", "incoming:0"],
  );
  assert.throws(() => selectAutomatedHandLimitDiscards(choice, "score"), /getKeepScore must be a function/i);
});

test("automated scoring receives duplicate-safe entry metadata", () => {
  const choice = createHandLimitChoice({
    hand: ["duplicate"],
    incomingCards: ["duplicate"],
    handLimit: 1,
  });
  const visited = [];
  const selected = selectAutomatedHandLimitDiscards(choice, (cardId, entry) => {
    visited.push({ cardId, key: entry.key, origin: entry.origin });
    return entry.origin === "incoming" ? 100 : 0;
  });

  assert.deepEqual(visited, [
    { cardId: "duplicate", key: "hand:0", origin: "hand" },
    { cardId: "duplicate", key: "incoming:0", origin: "incoming" },
  ]);
  assert.deepEqual(selected, ["hand:0"]);
});

test("automated convenience applies the same deterministic choice without mutation", () => {
  const hand = ["best", "worst"];
  const incomingCards = ["middle"];
  const discardPile = ["old"];
  const result = applyAutomatedHandLimit({
    hand,
    incomingCards,
    handLimit: 2,
    discardPile,
    getKeepScore: (cardId) => ({ best: 10, middle: 5, worst: 0 })[cardId],
  });

  assert.deepEqual(result.hand, ["best", "middle"]);
  assert.deepEqual(result.cardsToDiscard, ["worst"]);
  assert.deepEqual(result.discardPile, ["worst", "old"]);
  assert.equal(result.choice.requiredDiscardCount, 1);
  assert.deepEqual(hand, ["best", "worst"]);
  assert.deepEqual(incomingCards, ["middle"]);
  assert.deepEqual(discardPile, ["old"]);
});
