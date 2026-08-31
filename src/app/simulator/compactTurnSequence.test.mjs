import assert from "node:assert/strict";
import test from "node:test";

import {
  CompactTurnStage,
  allocateCollectedRpSources,
  createCompactTurnStages,
  getCompactConditionBannerDuration,
} from "./compactTurnSequence.mjs";

test("a new player round presents turn, condition, then RP in order", () => {
  assert.deepEqual(
    createCompactTurnStages({
      turnLabel: "Your Turn",
      condition: { id: "current-condition" },
      includeCondition: true,
      includeRp: true,
    }).map((stage) => stage.kind),
    [CompactTurnStage.TURN, CompactTurnStage.CONDITION, CompactTurnStage.RP],
  );
});

test("same-round handoffs omit the already-revealed condition", () => {
  assert.deepEqual(
    createCompactTurnStages({
      turnLabel: "Your Turn",
      condition: { id: "current-condition" },
      includeCondition: false,
      includeRp: true,
    }).map((stage) => stage.kind),
    [CompactTurnStage.TURN, CompactTurnStage.RP],
  );
});

test("a preceding transition can suppress a duplicate turn banner", () => {
  assert.deepEqual(
    createCompactTurnStages({
      condition: { id: "new-condition" },
      includeCondition: true,
      includeRp: true,
    }).map((stage) => stage.kind),
    [CompactTurnStage.CONDITION, CompactTurnStage.RP],
  );
});

test("RP allocation emits one coin per accepted point and never animates cap overflow", () => {
  assert.deepEqual(
    allocateCollectedRpSources([
      { key: "round-supply", amount: 1 },
      { key: "foundation:coral-1", amount: 2 },
      { key: "slot:school-1", amount: 1 },
    ], 2),
    [
      { sourceKey: "round-supply", sourceIndex: 0 },
      { sourceKey: "foundation:coral-1", sourceIndex: 0 },
    ],
  );
});

test("missing source allocation falls back to the round supply without hanging", () => {
  assert.equal(allocateCollectedRpSources([], 3).length, 3);
  assert.ok(allocateCollectedRpSources([], 3).every((coin) => coin.sourceKey === "round-supply"));
  assert.deepEqual(allocateCollectedRpSources([{ key: "foundation:a", amount: 4 }], 0), []);
});

test("condition banners stay readable longer as their rules text grows", () => {
  assert.equal(getCompactConditionBannerDuration(""), 2200);
  assert.ok(getCompactConditionBannerDuration("A short condition.") >= 2200);
  assert.ok(
    getCompactConditionBannerDuration("A much longer condition that explains an ongoing rule and how both players must resolve it before continuing the round.")
      > getCompactConditionBannerDuration("A short condition."),
  );
  assert.equal(getCompactConditionBannerDuration("x".repeat(1000)), 3800);
});
