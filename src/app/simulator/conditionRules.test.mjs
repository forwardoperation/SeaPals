import test from "node:test";
import assert from "node:assert/strict";
import {
  consumeSchoolDensityConditionDiscount,
  drawConditionCard,
  getEffectiveSchoolDensityRequirement,
  getSchoolDensityConditionDiscount,
  KRILL_BLOOM_CONDITION_ID,
  SARDINE_RUN_CONDITION_ID,
} from "./conditionRules.mjs";

const oceanicPredator = { category: "predator", zone: "ocean", schoolDensityRequirement: 40 };
const reefPredator = { category: "predator", zone: "reef", schoolDensityRequirement: 40 };
const oceanicApex = { category: "apex", zone: "ocean", schoolDensityRequirement: 90 };
const filterFeeder = { category: "filter-feeder", zone: "ocean", schoolDensityRequirement: 180 };

test("Condition draws preserve the existing deck order without reshuffling or mutating it", () => {
  const conditionDeck = Object.freeze(["red-tide", SARDINE_RUN_CONDITION_ID, "clear-water"]);
  const result = drawConditionCard({
    conditionDeck,
    conditionIds: ["red-tide", "clear-water", SARDINE_RUN_CONDITION_ID],
    random: () => assert.fail("A nonempty Condition Deck must not be shuffled"),
  });

  assert.deepEqual(result, {
    conditionId: "red-tide",
    conditionDeck: [SARDINE_RUN_CONDITION_ID, "clear-water"],
  });
  assert.equal(conditionDeck.length, 3);
});

test("an exhausted Condition Deck reshuffles all expired ordinary Conditions", () => {
  const conditionIds = Object.freeze(["red-tide", "clear-water", "undertow", SARDINE_RUN_CONDITION_ID, KRILL_BLOOM_CONDITION_ID]);
  const persistentConditionIds = Object.freeze([SARDINE_RUN_CONDITION_ID, KRILL_BLOOM_CONDITION_ID]);
  const result = drawConditionCard({
    conditionIds,
    persistentConditionIds,
    random: () => 0,
  });

  assert.deepEqual(result, {
    conditionId: "clear-water",
    conditionDeck: ["undertow", "red-tide"],
  });
  assert.equal(new Set([result.conditionId, ...result.conditionDeck]).size, 3);
});

test("persistent Conditions stay aside through multiple deck cycles without refreshing used benefits", () => {
  const conditionIds = [SARDINE_RUN_CONDITION_ID, KRILL_BLOOM_CONDITION_ID, "red-tide", "clear-water"];
  let conditionDeck = [...conditionIds];
  const persistentConditionIds = [];
  let usedByCondition = {};
  const draws = [];

  for (let draw = 0; draw < 10; draw += 1) {
    const result = drawConditionCard({ conditionDeck, conditionIds, persistentConditionIds, random: () => 0 });
    conditionDeck = result.conditionDeck;
    draws.push(result.conditionId);
    if ([SARDINE_RUN_CONDITION_ID, KRILL_BLOOM_CONDITION_ID].includes(result.conditionId)) {
      persistentConditionIds.push(result.conditionId);
      const qualifyingCard = result.conditionId === SARDINE_RUN_CONDITION_ID ? oceanicPredator : filterFeeder;
      usedByCondition = consumeSchoolDensityConditionDiscount(qualifyingCard, persistentConditionIds, usedByCondition).usedByCondition;
    }
  }

  assert.deepEqual(draws.slice(0, 4), conditionIds);
  for (let start = 4; start < draws.length; start += 2) {
    assert.deepEqual([...draws.slice(start, start + 2)].sort(), ["clear-water", "red-tide"]);
  }
  assert.deepEqual(persistentConditionIds, [SARDINE_RUN_CONDITION_ID, KRILL_BLOOM_CONDITION_ID]);
  assert.equal(getSchoolDensityConditionDiscount(oceanicPredator, persistentConditionIds, usedByCondition), null);
  assert.equal(getSchoolDensityConditionDiscount(filterFeeder, persistentConditionIds, usedByCondition), null);
});

test("no eligible Conditions leaves the next reveal empty", () => {
  for (const conditionIds of [[], [SARDINE_RUN_CONDITION_ID, KRILL_BLOOM_CONDITION_ID]]) {
    assert.deepEqual(drawConditionCard({
      conditionIds,
      persistentConditionIds: [SARDINE_RUN_CONDITION_ID, KRILL_BLOOM_CONDITION_ID],
      random: () => assert.fail("An empty recycle pool must not consume randomness"),
    }), { conditionId: null, conditionDeck: [] });
  }
});

test("Sardine Run reduces only the next Oceanic Predator by 30 School Density", () => {
  assert.deepEqual(getEffectiveSchoolDensityRequirement(oceanicPredator, [SARDINE_RUN_CONDITION_ID]), {
    printedRequirement: 40,
    effectiveRequirement: 10,
    discount: { conditionId: SARDINE_RUN_CONDITION_ID, amount: 30, label: "Sardine Run!" },
  });
  assert.equal(getSchoolDensityConditionDiscount(reefPredator, [SARDINE_RUN_CONDITION_ID]), null);
  assert.equal(getSchoolDensityConditionDiscount(oceanicApex, [SARDINE_RUN_CONDITION_ID]), null);
});

test("Krill Bloom reduces the next Filter Feeder by 150 School Density", () => {
  assert.deepEqual(getEffectiveSchoolDensityRequirement(filterFeeder, [KRILL_BLOOM_CONDITION_ID]), {
    printedRequirement: 180,
    effectiveRequirement: 30,
    discount: { conditionId: KRILL_BLOOM_CONDITION_ID, amount: 150, label: "Krill Bloom" },
  });
});

test("School Density events recognize the normalized creature class and subtype fields", () => {
  const classOnlyFilterFeeder = { class: "filter_feeder", schoolDensityRequirement: 150 };
  const subtypeOnlyOceanicPredator = { category: "predator", subtype: "oceanic", schoolDensityRequirement: 30 };

  assert.equal(
    getEffectiveSchoolDensityRequirement(classOnlyFilterFeeder, [KRILL_BLOOM_CONDITION_ID]).effectiveRequirement,
    0,
  );
  assert.equal(
    getEffectiveSchoolDensityRequirement(subtypeOnlyOceanicPredator, [SARDINE_RUN_CONDITION_ID]).effectiveRequirement,
    0,
  );
});

test("condition discounts clamp at zero and are consumed only by a qualifying play", () => {
  const cheapPredator = { ...oceanicPredator, schoolDensityRequirement: 20 };
  assert.equal(getEffectiveSchoolDensityRequirement(cheapPredator, [SARDINE_RUN_CONDITION_ID]).effectiveRequirement, 0);
  const ignored = consumeSchoolDensityConditionDiscount(reefPredator, [SARDINE_RUN_CONDITION_ID], {});
  assert.deepEqual(ignored.usedByCondition, {});
  const consumed = consumeSchoolDensityConditionDiscount(oceanicPredator, [SARDINE_RUN_CONDITION_ID], ignored.usedByCondition);
  assert.equal(consumed.usedByCondition[SARDINE_RUN_CONDITION_ID], true);
  assert.equal(getSchoolDensityConditionDiscount(oceanicPredator, [SARDINE_RUN_CONDITION_ID], consumed.usedByCondition), null);
});

test("each condition tracks its once-per-player usage independently", () => {
  const afterSardine = consumeSchoolDensityConditionDiscount(oceanicPredator, [SARDINE_RUN_CONDITION_ID, KRILL_BLOOM_CONDITION_ID], {}).usedByCondition;
  assert.equal(afterSardine[SARDINE_RUN_CONDITION_ID], true);
  assert.equal(afterSardine[KRILL_BLOOM_CONDITION_ID], undefined);
  assert.equal(getSchoolDensityConditionDiscount(filterFeeder, [SARDINE_RUN_CONDITION_ID, KRILL_BLOOM_CONDITION_ID], afterSardine)?.conditionId, KRILL_BLOOM_CONDITION_ID);
});
