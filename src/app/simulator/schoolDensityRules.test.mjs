import test from "node:test";
import assert from "node:assert/strict";
import {
  createSchoolDensityBucketState,
  getEcosystemSchoolDensityCommitted,
  getSchoolDensityCapacity,
} from "./schoolDensityRules.mjs";

const cards = {
  "school-20": { id: "school-20", schoolDensity: 20 },
  "school-60": { id: "school-60", schoolDensity: 60 },
  "fish-10": { id: "fish-10", schoolDensityRequirement: 10 },
  "fish-40": { id: "fish-40", schoolDensityRequirement: 40 },
  whale: { id: "whale", schoolDensityRequirement: 180 },
};

test("School Density commitments add while each creature remains in play", () => {
  const committed = getEcosystemSchoolDensityCommitted({
    reefCreatureInstances: [
      { instanceId: "fish-a", cardId: "fish-10" },
      { instanceId: "fish-b", cardId: "fish-40" },
      { instanceId: "fish-c", cardId: "fish-40" },
    ],
  }, cards, "player");

  assert.equal(committed, 90);
});

test("stored effective requirements preserve one-time Condition reductions", () => {
  const committed = getEcosystemSchoolDensityCommitted({
    reefCreatureInstances: [{
      instanceId: "whale-a",
      cardId: "whale",
    }],
    commitmentsByInstanceId: { "whale-a": 30 },
  }, cards, "player");

  assert.equal(committed, 30);
});

test("removing a creature instance frees its committed School Density", () => {
  const state = {
    reefCreatureInstances: [
      { instanceId: "fish-a", cardId: "fish-10" },
      { instanceId: "fish-b", cardId: "fish-40" },
    ],
    commitmentsByInstanceId: { "fish-a": 10, "fish-b": 35 },
  };

  assert.equal(getEcosystemSchoolDensityCommitted(state, cards, "player"), 45);
  assert.equal(getEcosystemSchoolDensityCommitted({
    ...state,
    reefCreatureInstances: state.reefCreatureInstances.slice(1),
  }, cards, "player"), 35);
});

test("density commitments cover slotted, hosted, and orphaned creatures but ignore foreign invaders", () => {
  const committed = getEcosystemSchoolDensityCommitted({
    foundations: [{
      id: "foundation",
      cardId: "school-20",
      slots: [{
        cardId: "fish-10",
        schoolDensityRequirementAtPlay: 10,
        hostedCardIds: ["fish-40"],
        hostedSchoolDensityRequirements: [35],
      }],
    }],
    orphanCreatureInstances: [
      { instanceId: "orphan", cardId: "fish-40" },
      { instanceId: "foreign", cardId: "whale", invasiveOwner: "opponent" },
    ],
  }, cards, "player");

  assert.equal(committed, 85);
});

test("invasive creatures commit Density to their owner while living on a rival reef", () => {
  const committed = getEcosystemSchoolDensityCommitted({
    foundations: [],
    invasiveFoundations: [{
      id: "rival-foundation",
      slots: [
        {
          cardId: "fish-40",
          cardInstanceId: "player-invader",
          invasiveOwner: "player",
        },
        {
          cardId: "whale",
          cardInstanceId: "opponent-local",
        },
      ],
    }],
    commitmentsByInstanceId: { "player-invader": 35 },
  }, cards, "player");

  assert.equal(committed, 35);
});

test("bucket state fills Creature Schools in play order and reports overflow", () => {
  const foundations = [
    { id: "first", cardId: "school-20" },
    { id: "second", cardId: "school-60" },
  ];
  const state = createSchoolDensityBucketState(foundations, 55, cards);

  assert.equal(getSchoolDensityCapacity(foundations, cards), 80);
  assert.deepEqual(state.buckets.map(({ foundationId, used, capacity, full }) => ({
    foundationId,
    used,
    capacity,
    full,
  })), [
    { foundationId: "first", used: 20, capacity: 20, full: true },
    { foundationId: "second", used: 35, capacity: 60, full: false },
  ]);
  assert.equal(state.coveredCommitment, 55);
  assert.equal(state.overCapacity, 0);
  assert.equal(state.available, 25);

  const overflow = createSchoolDensityBucketState(foundations, 95, cards);
  assert.equal(overflow.coveredCommitment, 80);
  assert.equal(overflow.overCapacity, 15);
  assert.equal(overflow.available, 0);
});

test("upgrading a Creature School makes its visual bucket taller", () => {
  const base = createSchoolDensityBucketState([{ id: "school", cardId: "school-20" }], 20, cards);
  const upgraded = createSchoolDensityBucketState([{ id: "school", cardId: "school-60" }], 20, cards);

  assert.equal(base.byFoundationId.school.fillPercent, 100);
  assert.ok(Math.abs(upgraded.byFoundationId.school.fillPercent - (100 / 3)) < 0.0001);
  assert.equal(upgraded.byFoundationId.school.available, 40);
});
