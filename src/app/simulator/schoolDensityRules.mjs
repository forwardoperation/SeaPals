function toNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function resolveCard(cardLookup, cardId) {
  return typeof cardLookup === "function" ? cardLookup(cardId) : cardLookup?.[cardId];
}

function belongsToController(entry, controller) {
  const invasiveOwner = entry?.invasiveOwner;
  return !invasiveOwner || !controller || invasiveOwner === controller;
}

function getRequirementAtPlay(entry, card, commitmentsByInstanceId = {}, instanceId = entry?.instanceId) {
  if (instanceId && Object.prototype.hasOwnProperty.call(commitmentsByInstanceId, instanceId)) {
    return toNonNegativeNumber(commitmentsByInstanceId[instanceId]);
  }
  if (entry && Object.prototype.hasOwnProperty.call(entry, "schoolDensityRequirementAtPlay")) {
    return toNonNegativeNumber(entry.schoolDensityRequirementAtPlay);
  }
  return toNonNegativeNumber(card?.schoolDensityRequirement);
}

function collectHostedRequirements(hostedCardIds, storedRequirements, cardLookup) {
  return (hostedCardIds ?? []).flatMap((cardId, index) => {
    if (!cardId) return [];
    const storedRequirement = storedRequirements?.[index];
    return [storedRequirement == null
      ? toNonNegativeNumber(resolveCard(cardLookup, cardId)?.schoolDensityRequirement)
      : toNonNegativeNumber(storedRequirement)];
  });
}

function collectFoundationRequirements(
  foundations,
  requirements,
  cardLookup,
  commitmentsByInstanceId,
  controller,
  invasiveOnly = false,
) {
  (foundations ?? []).forEach((foundation) => {
    (foundation?.slots ?? []).forEach((slot) => {
      if (invasiveOnly) {
        if (!controller || slot?.invasiveOwner !== controller) return;
      } else if (!belongsToController(slot, controller)) return;
      if (slot.cardId) {
        requirements.push(getRequirementAtPlay(
          slot,
          resolveCard(cardLookup, slot.cardId),
          commitmentsByInstanceId,
          slot.cardInstanceId,
        ));
      }
      requirements.push(...collectHostedRequirements(
        slot.hostedCardIds,
        slot.hostedSchoolDensityRequirements,
        cardLookup,
      ));
    });
  });
}

/**
 * School Density is committed capacity. Each creature's effective requirement
 * occupies capacity while that stable creature instance remains in play.
 */
export function getEcosystemSchoolDensityCommitted(
  {
    foundations = [],
    invasiveFoundations = [],
    reefCreatureInstances = [],
    orphanCreatureInstances = [],
    invasiveOrphanCreatureInstances = [],
    commitmentsByInstanceId = {},
  } = {},
  cardLookup = {},
  controller = null,
) {
  const requirements = [];

  collectFoundationRequirements(
    foundations,
    requirements,
    cardLookup,
    commitmentsByInstanceId,
    controller,
  );
  collectFoundationRequirements(
    invasiveFoundations,
    requirements,
    cardLookup,
    commitmentsByInstanceId,
    controller,
    true,
  );

  [
    ...(reefCreatureInstances ?? []),
    ...(orphanCreatureInstances ?? []),
    ...(invasiveOrphanCreatureInstances ?? []).filter((entry) => (
      controller && entry?.invasiveOwner === controller
    )),
  ].forEach((entry) => {
    if (!entry?.cardId || !belongsToController(entry, controller)) return;
    requirements.push(getRequirementAtPlay(
      entry,
      resolveCard(cardLookup, entry.cardId),
      commitmentsByInstanceId,
    ));
    requirements.push(...collectHostedRequirements(
      entry.hostedCardIds,
      entry.hostedSchoolDensityRequirements,
      cardLookup,
    ));
  });

  return requirements.reduce((total, requirement) => total + requirement, 0);
}

export function getSchoolDensityCapacity(foundations = [], cardLookup = {}) {
  return (foundations ?? []).reduce(
    (total, foundation) => total + toNonNegativeNumber(
      resolveCard(cardLookup, foundation?.cardId)?.schoolDensity,
    ),
    0,
  );
}

/**
 * Builds the visual bucket model in Foundation play order. Each Creature
 * School contributes a segment; current demand fills the earliest segment
 * before flowing into the next one.
 */
export function createSchoolDensityBucketState(
  foundations = [],
  committed = 0,
  cardLookup = {},
) {
  const normalizedCommitted = toNonNegativeNumber(committed);
  let remainingCommitment = normalizedCommitted;
  const buckets = (foundations ?? []).flatMap((foundation) => {
    const capacity = toNonNegativeNumber(resolveCard(cardLookup, foundation?.cardId)?.schoolDensity);
    if (!capacity) return [];
    const used = Math.min(capacity, remainingCommitment);
    remainingCommitment = Math.max(0, remainingCommitment - used);
    return [{
      foundationId: foundation.id,
      cardId: foundation.cardId,
      capacity,
      used,
      available: capacity - used,
      fillPercent: capacity ? (used / capacity) * 100 : 0,
      full: used >= capacity,
    }];
  });
  const capacity = buckets.reduce((total, bucket) => total + bucket.capacity, 0);

  return {
    capacity,
    committed: normalizedCommitted,
    available: Math.max(0, capacity - normalizedCommitted),
    coveredCommitment: Math.min(capacity, normalizedCommitted),
    overCapacity: Math.max(0, normalizedCommitted - capacity),
    buckets,
    byFoundationId: Object.fromEntries(buckets.map((bucket) => [bucket.foundationId, bucket])),
  };
}
