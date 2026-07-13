const CORAL_REEF_CARD_ID = "coral-reef";

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
 * Evaluates Coral Reef's composition using physical cards currently in play.
 * Creature Schools do not satisfy Coral Reef's Coral or creature counts.
 */
export function evaluateCoralReefComposition(cardsInPlay = [], cardLookup) {
  const cards = cardsInPlay.map((cardRef) => resolveCard(cardRef, cardLookup)).filter(Boolean);
  const counts = cards.reduce((result, card) => {
    const creatureSchool = card.tags?.includes("creature-school");
    if (card.kind === "coral") result.corals += 1;
    if (!creatureSchool && (card.category === "fish" || card.class === "fish")) result.fish += 1;
    if (!creatureSchool && (card.category === "invertebrate" || card.class === "invertebrate")) result.invertebrates += 1;
    return result;
  }, { corals: 0, fish: 0, invertebrates: 0 });
  const required = { corals: 4, fish: 2, invertebrates: 2 };
  const missing = {
    corals: Math.max(0, required.corals - counts.corals),
    fish: Math.max(0, required.fish - counts.fish),
    invertebrates: Math.max(0, required.invertebrates - counts.invertebrates),
  };
  return {
    valid: missing.corals === 0 && missing.fish === 0 && missing.invertebrates === 0,
    counts,
    required,
    missing,
  };
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
  const composition = evaluateCoralReefComposition(cardsInPlay, cardLookup);
  const events = [];
  const survivingHabitats = [];
  const destroyedHabitats = [];

  habitats.forEach((habitat) => {
    const card = resolveCard(habitat.cardId, habitatLookup);
    const maintenance = card?.maintenance;
    const shouldDeteriorate = habitat.cardId === CORAL_REEF_CARD_ID
      && maintenance?.timing === "endOfTurn"
      && maintenance.whileRequirementUnmet
      && !composition.valid;

    if (!shouldDeteriorate) {
      survivingHabitats.push(habitat);
      return;
    }

    const previousHealth = Math.max(0, Number(habitat.currentHealth) || 0);
    const requestedDamage = Math.max(0, Number(maintenance.damage) || 10);
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
    };
    events.push(event);

    if (event.destroyed) destroyedHabitats.push(updated);
    else survivingHabitats.push(updated);
  });

  return {
    habitats: survivingHabitats,
    events,
    destroyedHabitats,
    composition,
  };
}
