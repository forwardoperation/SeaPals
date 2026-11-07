export const SARDINE_RUN_CONDITION_ID = "sardine-run";
export const KRILL_BLOOM_CONDITION_ID = "krill-ball";

function normalizeConditionIds(conditionIds = []) {
  return new Set(conditionIds.filter(Boolean));
}

export function drawConditionCard({
  conditionDeck = [],
  conditionIds = [],
  persistentConditionIds = [],
  random = Math.random,
} = {}) {
  let source = conditionDeck;
  if (!source.length) {
    const persistent = normalizeConditionIds(persistentConditionIds);
    // At the next reveal, the previous ordinary Condition has expired. With
    // an empty deck, every configured card except those set aside is eligible.
    source = [...normalizeConditionIds(conditionIds)].filter((id) => !persistent.has(id));
    for (let index = source.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [source[index], source[swapIndex]] = [source[swapIndex], source[index]];
    }
  }
  return {
    conditionId: source[0] ?? null,
    conditionDeck: source.slice(1),
  };
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
