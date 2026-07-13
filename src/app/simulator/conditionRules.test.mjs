import test from "node:test";
import assert from "node:assert/strict";
import {
  consumeSchoolDensityConditionDiscount,
  getEffectiveSchoolDensityRequirement,
  getSchoolDensityConditionDiscount,
  KRILL_BLOOM_CONDITION_ID,
  SARDINE_RUN_CONDITION_ID,
} from "./conditionRules.mjs";

const oceanicPredator = { category: "predator", zone: "ocean", schoolDensityRequirement: 40 };
const reefPredator = { category: "predator", zone: "reef", schoolDensityRequirement: 40 };
const oceanicApex = { category: "apex", zone: "ocean", schoolDensityRequirement: 90 };
const filterFeeder = { category: "filter-feeder", zone: "ocean", schoolDensityRequirement: 180 };

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
