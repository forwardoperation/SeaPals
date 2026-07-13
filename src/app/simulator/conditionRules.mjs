export const SARDINE_RUN_CONDITION_ID = "sardine-run";
export const KRILL_BLOOM_CONDITION_ID = "krill-ball";

function normalizeConditionIds(conditionIds = []) {
  return new Set(conditionIds.filter(Boolean));
}

function isOceanicPredator(card) {
  const oceanic = card?.zone === "ocean" || card?.subtype === "oceanic" || card?.tags?.includes("oceanic");
  return oceanic && card?.category === "predator";
}

function isFilterFeeder(card) {
  return card?.category === "filter-feeder" || ["filter-feeder", "filter_feeder"].includes(card?.class);
}

export function getSchoolDensityConditionDiscount(card, activeConditionIds = [], usedByCondition = {}) {
  const active = normalizeConditionIds(activeConditionIds);
  if (active.has(SARDINE_RUN_CONDITION_ID) && !usedByCondition[SARDINE_RUN_CONDITION_ID] && isOceanicPredator(card)) {
    return { conditionId: SARDINE_RUN_CONDITION_ID, amount: 30, label: "Sardine Run!" };
  }
  if (active.has(KRILL_BLOOM_CONDITION_ID) && !usedByCondition[KRILL_BLOOM_CONDITION_ID] && isFilterFeeder(card)) {
    return { conditionId: KRILL_BLOOM_CONDITION_ID, amount: 150, label: "Krill Bloom" };
  }
  return null;
}

export function getEffectiveSchoolDensityRequirement(card, activeConditionIds = [], usedByCondition = {}) {
  const printedRequirement = Math.max(0, Number(card?.schoolDensityRequirement ?? 0));
  const discount = getSchoolDensityConditionDiscount(card, activeConditionIds, usedByCondition);
  return {
    printedRequirement,
    effectiveRequirement: Math.max(0, printedRequirement - Number(discount?.amount ?? 0)),
    discount,
  };
}

export function consumeSchoolDensityConditionDiscount(card, activeConditionIds = [], usedByCondition = {}) {
  const discount = getSchoolDensityConditionDiscount(card, activeConditionIds, usedByCondition);
  return discount
    ? { usedByCondition: { ...usedByCondition, [discount.conditionId]: true }, discount }
    : { usedByCondition: { ...usedByCondition }, discount: null };
}
