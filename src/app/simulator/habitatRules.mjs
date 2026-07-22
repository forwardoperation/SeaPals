const CORAL_REEF_CARD_ID = "coral-reef";
const ABYSS_CARD_ID = "abyss";
const OPEN_OCEAN_CARD_ID = "open-ocean";

/**
 * Printed minimum ecosystem composition for the three persistent Habitats.
 * The matcher names are intentionally data-only so callers can surface the
 * same counts and deficits that the maintenance resolver uses.
 */
export const HABITAT_COMPOSITION_REQUIREMENTS = Object.freeze({
  [CORAL_REEF_CARD_ID]: Object.freeze({
    corals: 4,
    fish: 2,
    invertebrates: 2,
  }),
  [ABYSS_CARD_ID]: Object.freeze({
    corals: 4,
    fish: 2,
    invertebrates: 2,
  }),
  [OPEN_OCEAN_CARD_ID]: Object.freeze({
    creatureSchools: 4,
    fish: 2,
    invertebrates: 2,
  }),
});

const DEFAULT_HABITAT_MAINTENANCE_DAMAGE = 10;

function normalizeLookup(lookup) {
  if (typeof lookup === "function") return lookup;
  if (lookup instanceof Map) return (cardId) => lookup.get(cardId);
  if (lookup && typeof lookup === "object") return (cardId) => lookup[cardId];
  return () => undefined;
}

function resolveCard(cardRef, lookup) {
  if (!cardRef) return null;
  if (typeof cardRef === "object" && (cardRef.kind || cardRef.category || cardRef.class)) {
    return cardRef;
  }

  const cardId = typeof cardRef === "string" ? cardRef : cardRef.cardId ?? cardRef.id;
  return normalizeLookup(lookup)(cardId) ?? null;
}

function requireInstanceId(instanceId) {
  const normalized = String(instanceId ?? "").trim();
  if (!normalized) throw new TypeError("A stable Habitat instanceId is required.");
  return normalized;
}

function cardZone(card) {
  const zone = String(card?.zone ?? card?.creatureZone ?? card?.habitatZone ?? "").toLowerCase();
  if (zone) return zone;

  // Reef cards predate the explicit zone field and are normalized to Reef in
  // the aggregate card registry. Preserve that convention for raw card data
  // and focused rules tests passed directly to this module.
  if (card?.kind === "coral" || card?.kind === "creature") return "reef";
  return "";
}

function isCreatureSchool(card) {
  return card?.kind === "creature" && card.tags?.includes("creature-school");
}

function isCreatureClass(card, category) {
  return card?.kind === "creature"
    && (card.category === category || card.class === category);
}

function emptyCompositionCounts(habitatId) {
  return Object.fromEntries(
    Object.keys(HABITAT_COMPOSITION_REQUIREMENTS[habitatId] ?? {})
      .map((key) => [key, 0]),
  );
}

function countCardForHabitat(counts, habitatId, card) {
  if (!card) return counts;
  const zone = cardZone(card);
  const creatureSchool = isCreatureSchool(card);

  if (habitatId === CORAL_REEF_CARD_ID || habitatId === ABYSS_CARD_ID) {
    const requiredZone = habitatId === CORAL_REEF_CARD_ID ? "reef" : "deep";
    if (zone !== requiredZone) return counts;
    if (card.kind === "coral") counts.corals += 1;
    if (!creatureSchool && isCreatureClass(card, "fish")) counts.fish += 1;
    if (!creatureSchool && isCreatureClass(card, "invertebrate")) counts.invertebrates += 1;
    return counts;
  }

  if (habitatId === OPEN_OCEAN_CARD_ID) {
    if (creatureSchool) counts.creatureSchools += 1;
    if (zone !== "ocean" || creatureSchool) return counts;
    if (isCreatureClass(card, "fish")) counts.fish += 1;
    if (isCreatureClass(card, "invertebrate")) counts.invertebrates += 1;
  }

  return counts;
}

/**
 * Evaluates printed Habitat prerequisites that are still authored as text.
 * Alternative requirements must be resolved before strict single-Habitat
 * rules so "Open Ocean or Coral Reef" is not mistaken for Open Ocean only.
 */
export function getHabitatRequirementError(card, habitatIds = []) {
  const rules = [...(card?.playRequirements ?? []), ...(card?.specialRules ?? [])]
    .map((rule) => typeof rule === "string" ? rule : rule?.text ?? "");
  const habitats = new Set(habitatIds);
  const hasOpenOcean = habitats.has("open-ocean");
  const hasAbyss = habitats.has("abyss");
  const hasCoralReef = habitats.has("coral-reef");

  if (rules.some((rule) => /open ocean or coral reef/i.test(rule)) && !hasOpenOcean && !hasCoralReef) {
    return `${card.name} requires Open Ocean or Coral Reef in your ecosystem.`;
  }
  if (rules.some((rule) => /open ocean or abyss/i.test(rule)) && !hasOpenOcean && !hasAbyss) {
    return `${card.name} requires Open Ocean or Abyss in your ecosystem.`;
  }
  if (rules.some((rule) => /requires? open ocean(?!\s+or\b)|only be played if open ocean(?!\s+or\b)/i.test(rule)) && !hasOpenOcean) {
    return `${card.name} requires Open Ocean in your ecosystem.`;
  }
  if (rules.some((rule) => /requires? abyss(?!\s+or\b)|only be played if abyss(?!\s+or\b)/i.test(rule)) && !hasAbyss) {
    return `${card.name} requires Abyss in your ecosystem.`;
  }
  return "";
}

/**
 * Creates one physical Habitat card in play. Callers own instance ID generation;
 * requiring the ID here prevents duplicate card IDs from becoming identity.
 */
export function createHabitatInstance(cardRef, instanceId, cardLookup) {
  const card = resolveCard(cardRef, cardLookup);
  const cardId = typeof cardRef === "string" ? cardRef : cardRef?.cardId ?? cardRef?.id;
  if (!cardId || !card) throw new TypeError("A known Habitat card is required.");
  if (card.kind && card.kind !== "habitat") throw new TypeError(`${cardId} is not a Habitat card.`);

  const maxHealth = Math.max(0, Number(card.health) || 0);
  return {
    instanceId: requireInstanceId(instanceId),
    cardId,
    currentHealth: maxHealth,
    maxHealth,
  };
}

/** Adds an already-created Habitat without mutating the existing zone. */
export function addHabitatInstance(habitats = [], habitat) {
  if (!habitat?.cardId) throw new TypeError("A Habitat instance with a cardId is required.");
  const instanceId = requireInstanceId(habitat.instanceId);
  if (habitats.some((entry) => entry.instanceId === instanceId)) {
    throw new Error(`Habitat instanceId ${instanceId} is already in play.`);
  }
  return [...habitats, { ...habitat, instanceId }];
}

/** Removes exactly one physical Habitat copy and returns it for zone movement. */
export function removeHabitatInstance(habitats = [], instanceId) {
  const targetId = requireInstanceId(instanceId);
  const index = habitats.findIndex((habitat) => habitat.instanceId === targetId);
  if (index < 0) return { habitats: [...habitats], removed: null };
  return {
    habitats: [...habitats.slice(0, index), ...habitats.slice(index + 1)],
    removed: { ...habitats[index] },
  };
}

/** Applies damage to one Habitat copy while preserving all other copies. */
export function damageHabitatInstance(habitats = [], instanceId, damage) {
  const targetId = requireInstanceId(instanceId);
  const requestedDamage = Math.max(0, Number(damage) || 0);
  let result = null;
  const nextHabitats = habitats.map((habitat) => {
    if (habitat.instanceId !== targetId) return habitat;
    const previousHealth = Math.max(0, Number(habitat.currentHealth) || 0);
    const appliedDamage = Math.min(previousHealth, requestedDamage);
    const currentHealth = previousHealth - appliedDamage;
    const updated = { ...habitat, currentHealth };
    result = {
      instanceId: habitat.instanceId,
      cardId: habitat.cardId,
      previousHealth,
      currentHealth,
      appliedDamage,
      destroyed: currentHealth === 0,
    };
    return updated;
  });
  return { habitats: nextHabitats, result };
}

/**
 * Evaluates one Habitat's printed minimum ecosystem composition. Cards from a
 * different habitat zone do not count, and Creature Schools are only counted
 * by Open Ocean's dedicated Creature School requirement rather than as Fish.
 * Unknown Habitats have no composition rule and therefore remain valid.
 */
export function evaluateHabitatComposition(
  habitatRef,
  cardsInPlay = [],
  cardLookup,
) {
  const habitatId = typeof habitatRef === "string"
    ? habitatRef
    : habitatRef?.cardId ?? habitatRef?.id ?? "";
  const required = HABITAT_COMPOSITION_REQUIREMENTS[habitatId] ?? {};
  const counts = cardsInPlay
    .map((cardRef) => resolveCard(cardRef, cardLookup))
    .filter(Boolean)
    .reduce(
      (result, card) => countCardForHabitat(result, habitatId, card),
      emptyCompositionCounts(habitatId),
    );
  const missing = Object.fromEntries(
    Object.entries(required).map(([key, amount]) => [
      key,
      Math.max(0, Number(amount) - Number(counts[key] ?? 0)),
    ]),
  );

  return {
    habitatId,
    valid: Object.values(missing).every((amount) => amount === 0),
    counts,
    required: { ...required },
    missing,
  };
}

/** Backward-compatible Coral Reef-specific evaluator. */
export function evaluateCoralReefComposition(cardsInPlay = [], cardLookup) {
  const { habitatId: _habitatId, ...composition } = evaluateHabitatComposition(
    CORAL_REEF_CARD_ID,
    cardsInPlay,
    cardLookup,
  );
  return composition;
}

/**
 * Resolves every Habitat's end-of-turn maintenance independently. Destroyed
 * instances are removed from the returned in-play array and reported so the
 * caller can move their card IDs to the appropriate discard/Lost zone.
 */
export function resolveEndOfTurnHabitatMaintenance(
  habitats = [],
  { cardsInPlay = [], cardLookup, habitatLookup = cardLookup } = {},
) {
  const compositions = {};
  const getComposition = (habitatId) => {
    if (!compositions[habitatId]) {
      compositions[habitatId] = evaluateHabitatComposition(
        habitatId,
        cardsInPlay,
        cardLookup,
      );
    }
    return compositions[habitatId];
  };
  const events = [];
  const survivingHabitats = [];
  const destroyedHabitats = [];

  habitats.forEach((habitat) => {
    const card = resolveCard(habitat.cardId, habitatLookup);
    const hasCompositionRequirement = Boolean(
      HABITAT_COMPOSITION_REQUIREMENTS[habitat.cardId],
    );
    const composition = hasCompositionRequirement
      ? getComposition(habitat.cardId)
      : null;
    const shouldDeteriorate = hasCompositionRequirement && !composition.valid;

    if (!shouldDeteriorate) {
      survivingHabitats.push(habitat);
      return;
    }

    const previousHealth = Math.max(0, Number(habitat.currentHealth) || 0);
    const requestedDamage = Math.max(
      0,
      Number(card?.maintenance?.damage) || DEFAULT_HABITAT_MAINTENANCE_DAMAGE,
    );
    const appliedDamage = Math.min(previousHealth, requestedDamage);
    const currentHealth = previousHealth - appliedDamage;
    const updated = { ...habitat, currentHealth };
    const event = {
      instanceId: habitat.instanceId,
      cardId: habitat.cardId,
      previousHealth,
      currentHealth,
      appliedDamage,
      destroyed: currentHealth === 0,
      reason: "composition-requirement-unmet",
      composition,
    };
    events.push(event);

    if (event.destroyed) destroyedHabitats.push(updated);
    else survivingHabitats.push(updated);
  });

  return {
    habitats: survivingHabitats,
    events,
    destroyedHabitats,
    compositions,
    // Preserve the original Coral Reef-only return field for callers that
    // predate the generic per-Habitat composition map.
    composition: compositions[CORAL_REEF_CARD_ID]
      ?? evaluateCoralReefComposition(cardsInPlay, cardLookup),
  };
}
