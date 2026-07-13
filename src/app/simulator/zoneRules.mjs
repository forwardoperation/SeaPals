function requireNonEmptyId(value, label) {
  const id = String(value ?? "").trim();
  if (!id) throw new TypeError(`${label} must be a non-empty string.`);
  return id;
}

/**
 * Returns the personal deck that owns a card. Corals and Creature Schools are
 * Foundation cards; every other playable card belongs to Pals.
 */
export function getPersonalDeckType(card) {
  if (!card) return null;
  return card.kind === "coral" || (card.kind === "creature" && card.tags?.includes("creature-school"))
    ? "foundation"
    : "pals";
}

/**
 * Creates a creature entry whose identity is independent from its array position.
 * Location metadata (coralId, slotId, zone, and so on) may be supplied in extras.
 */
export function createCreatureInstance(cardId, instanceId, extras = {}) {
  const normalizedCardId = requireNonEmptyId(cardId, "cardId");
  const normalizedInstanceId = requireNonEmptyId(instanceId, "instanceId");
  return {
    ...extras,
    instanceId: normalizedInstanceId,
    cardId: normalizedCardId,
    hostedCardIds: [...(extras.hostedCardIds ?? [])],
  };
}

/**
 * Migrates legacy card-id strings and old orphan objects to stable instances.
 * Existing instance IDs are preserved. Callers must provide an ID factory for
 * legacy entries so identity is assigned once at the state boundary.
 */
export function normalizeCreatureInstances(entries = [], createInstanceId) {
  const seen = new Set();
  const instances = entries.map((entry, index) => {
    const legacyString = typeof entry === "string";
    const source = legacyString ? {} : entry ?? {};
    const cardId = legacyString ? entry : source.cardId;
    const instanceId = source.instanceId ?? createInstanceId?.({ cardId, entry, index });
    const instance = createCreatureInstance(cardId, instanceId, source);
    if (seen.has(instance.instanceId)) throw new Error(`Duplicate creature instanceId: ${instance.instanceId}`);
    seen.add(instance.instanceId);
    return instance;
  });
  return instances;
}

export function removeCreatureInstance(instances = [], instanceId) {
  const normalizedInstanceId = requireNonEmptyId(instanceId, "instanceId");
  const removedIndex = instances.findIndex((instance) => instance?.instanceId === normalizedInstanceId);
  if (removedIndex < 0) return { instances, removed: null };
  return {
    instances: [...instances.slice(0, removedIndex), ...instances.slice(removedIndex + 1)],
    removed: instances[removedIndex],
  };
}

export function removeCreatureInstances(instances = [], instanceIds = []) {
  const ids = new Set(instanceIds.map((instanceId) => requireNonEmptyId(instanceId, "instanceId")));
  const removed = instances.filter((instance) => ids.has(instance?.instanceId));
  return {
    instances: instances.filter((instance) => !ids.has(instance?.instanceId)),
    removed,
    missingInstanceIds: [...ids].filter((instanceId) => !removed.some((instance) => instance.instanceId === instanceId)),
  };
}

function isPresentHostedCardId(cardId) {
  return cardId !== null && cardId !== undefined;
}

/**
 * Returns every host tag accepted by a card's special-placement rules. The
 * current card schema stores this rule inside a passive effect, while the
 * direct property keeps the helper useful if card data is normalized later.
 */
export function getSpecialPlacementHostTags(candidateCard) {
  const directPlacement = candidateCard?.specialPlacement;
  const passiveEffects = (candidateCard?.passives ?? []).flatMap((passive) => [
    ...(passive?.effect ? [passive.effect] : []),
    ...(passive?.effects ?? []),
  ]);
  const placements = [directPlacement, ...passiveEffects].filter((effect) => (
    effect?.allowedHostTags
    && (effect === directPlacement || effect.type === "specialPlacement")
  ));

  return [...new Set(placements.flatMap((placement) => placement.allowedHostTags ?? []))];
}

/**
 * Returns how many cards a host may contain. `hostCapacity` is the generic
 * schema name; `clownSlots` is retained for the currently printed Anemone.
 */
export function getHostedCardCapacity(hostCard) {
  const capacity = Number(hostCard?.hostCapacity ?? hostCard?.clownSlots ?? 0);
  return Number.isFinite(capacity) && capacity > 0 ? Math.trunc(capacity) : 0;
}

/**
 * Determines whether a candidate may use a host's special-placement area and
 * whether that host still has capacity. Sparse null slots do not consume it.
 */
export function canHostSpecialPlacement(hostCard, candidateCard, hostedCardIds = []) {
  const allowedHostTags = getSpecialPlacementHostTags(candidateCard);
  const hostTags = new Set(hostCard?.tags ?? []);
  const hostMatches = allowedHostTags.some((tag) => hostTags.has(tag));
  if (!hostMatches) return false;

  const capacity = getHostedCardCapacity(hostCard);
  const occupiedCount = hostedCardIds.filter(isPresentHostedCardId).length;
  return occupiedCount < capacity;
}

/**
 * Immutably fills the first sparse host slot, or appends when none exists.
 * Returns null when the host is full so callers cannot accidentally overfill
 * it after a stale UI selection.
 */
export function addHostedCardId(hostedCardIds = [], hostedCardId, capacity = Infinity) {
  const normalizedHostedCardId = requireNonEmptyId(hostedCardId, "hostedCardId");
  const normalizedCapacity = Number.isFinite(Number(capacity))
    ? Math.max(0, Math.trunc(Number(capacity)))
    : Infinity;
  const occupiedCount = hostedCardIds.filter(isPresentHostedCardId).length;
  if (occupiedCount >= normalizedCapacity) return null;

  const nextHostedCardIds = [...hostedCardIds];
  const sparseIndex = nextHostedCardIds.findIndex((cardId) => !isPresentHostedCardId(cardId));
  if (sparseIndex >= 0) nextHostedCardIds[sparseIndex] = normalizedHostedCardId;
  else nextHostedCardIds.push(normalizedHostedCardId);
  return nextHostedCardIds;
}

/**
 * Performs a complete special-host placement using the capacity printed on
 * the host. Returns the updated IDs, or null when the placement is illegal.
 */
export function placeCardInSpecialHost(hostCard, candidateCard, hostedCardIds = [], hostedCardId = candidateCard?.id) {
  if (!canHostSpecialPlacement(hostCard, candidateCard, hostedCardIds)) return null;
  return addHostedCardId(hostedCardIds, hostedCardId, getHostedCardCapacity(hostCard));
}

function resolveCandidateCard(candidate, cards) {
  if (candidate?.card) return candidate.card;
  return typeof cards === "function" ? cards(candidate?.cardId) : cards?.[candidate?.cardId];
}

function isOceanic(card) {
  return card?.tags?.includes("oceanic") || card?.subtype === "oceanic";
}

function makeSacrificeChoice(kind, candidates) {
  const instanceIds = candidates.map((candidate) => candidate.instanceId);
  return {
    id: `${kind}:${[...instanceIds].sort().join("+")}`,
    kind,
    instanceIds,
    cardIds: candidates.map((candidate) => candidate.cardId),
    candidates,
  };
}

/**
 * Returns every legal additional-cost choice for an Oceanic Apex:
 * one Oceanic Predator, or every distinct pair of Oceanic Fish.
 */
export function getOceanicApexSacrificeChoices(candidates = [], cards = {}) {
  const seen = new Set();
  const eligible = candidates.map((candidate) => {
    const instanceId = requireNonEmptyId(candidate?.instanceId, "candidate.instanceId");
    if (seen.has(instanceId)) throw new Error(`Duplicate creature instanceId: ${instanceId}`);
    seen.add(instanceId);
    return { candidate, card: resolveCandidateCard(candidate, cards) };
  }).filter(({ card }) => isOceanic(card));

  const predators = eligible.filter(({ card }) => card.category === "predator");
  const fish = eligible.filter(({ card }) => card.category === "fish");
  const choices = predators.map(({ candidate }) => makeSacrificeChoice("predator", [candidate]));

  for (let first = 0; first < fish.length; first += 1) {
    for (let second = first + 1; second < fish.length; second += 1) {
      choices.push(makeSacrificeChoice("fish-pair", [fish[first].candidate, fish[second].candidate]));
    }
  }
  return choices;
}

/**
 * Adds cards to a hand in order and routes overflow to the top of discard.
 * This is suitable for opponent search, recovery, and triggered-draw paths.
 */
export function addCardsToHandWithLimit(hand = [], addedCards = [], discardPile = [], handLimit = Infinity) {
  const finiteLimit = Number.isFinite(handLimit);
  const availableSpace = finiteLimit
    ? Math.max(0, Math.trunc(Number(handLimit)) - hand.length)
    : addedCards.length;
  const cardsToHand = addedCards.slice(0, availableSpace);
  const cardsToDiscard = addedCards.slice(availableSpace);
  return {
    hand: [...hand, ...cardsToHand],
    discardPile: [...cardsToDiscard, ...discardPile],
    cardsToHand,
    cardsToDiscard,
  };
}

/**
 * Resolves simultaneous foundation-destruction waves in rules order:
 * destroyed cards enter discard, then each printed recovery trigger resolves,
 * and hand-limit overflow returns to the top of discard.
 */
export function resolveDestructionRecoveryWaves(
  destructionWaves = [],
  initialHand = [],
  initialDiscard = [],
  handLimit = Infinity,
  getRecovery = () => null,
) {
  let hand = initialHand;
  let discardPile = initialDiscard;
  const triggers = [];
  const removeOne = (cards, cardId) => {
    const index = cards.indexOf(cardId);
    return index < 0 ? cards : [...cards.slice(0, index), ...cards.slice(index + 1)];
  };

  destructionWaves.forEach((wave) => {
    discardPile = [...wave.map((foundation) => foundation.cardId), ...discardPile];
    wave.forEach((foundation) => {
      const recovery = getRecovery(foundation, discardPile);
      if (!recovery) return;
      const recoveredIds = recovery.recoveredIds ?? [];
      recoveredIds.forEach((cardId) => { discardPile = removeOne(discardPile, cardId); });
      const handResult = addCardsToHandWithLimit(hand, recoveredIds, discardPile, handLimit);
      hand = handResult.hand;
      discardPile = handResult.discardPile;
      triggers.push({
        sourceCardId: foundation.cardId,
        targetCardId: recovery.targetCardId,
        cardsToHand: handResult.cardsToHand,
        cardsToDiscard: handResult.cardsToDiscard,
      });
    });
  });

  return { hand, discardPile, triggers };
}

/**
 * Moves one primary slotted creature (and anything it hosts) from one
 * Foundation to a compatible empty slot on another Foundation. Slot identity
 * and layout stay with each Foundation; creature identity travels with the
 * card so action cooldowns cannot jump to a different creature.
 */
export function moveSlottedCreatureBetweenFoundations(
  foundations = [],
  { sourceFoundationId, sourceSlotId, destinationFoundationId, destinationSlotId } = {},
  canOccupy = () => false,
) {
  const fail = (error) => ({ moved: false, error, foundations });
  if (!sourceFoundationId || !sourceSlotId || !destinationFoundationId || !destinationSlotId) {
    return fail("Choose both a source creature and a destination slot.");
  }
  if (sourceFoundationId === destinationFoundationId) {
    return fail("Jointed Structure moves creatures between two different corals.");
  }
  const sourceFoundation = foundations.find((foundation) => foundation?.id === sourceFoundationId);
  const destinationFoundation = foundations.find((foundation) => foundation?.id === destinationFoundationId);
  if (!sourceFoundation || !destinationFoundation) return fail("One of the selected corals is no longer in play.");
  const sourceSlot = sourceFoundation.slots?.find((slot) => slot?.id === sourceSlotId);
  const destinationSlot = destinationFoundation.slots?.find((slot) => slot?.id === destinationSlotId);
  if (!sourceSlot?.cardId) return fail("The selected source slot no longer contains a creature.");
  if (!destinationSlot) return fail("The selected destination slot no longer exists.");
  if (destinationSlot.cardId) return fail("The selected destination slot is already occupied.");
  if (!canOccupy(sourceSlot.cardId, destinationSlot)) return fail("That creature is not compatible with the selected destination slot.");

  const movedCard = {
    cardId: sourceSlot.cardId,
    cardInstanceId: sourceSlot.cardInstanceId,
    hostedCardIds: [...(sourceSlot.hostedCardIds ?? [])],
  };
  const nextFoundations = foundations.map((foundation) => {
    if (foundation.id === sourceFoundationId) {
      return {
        ...foundation,
        slots: foundation.slots.map((slot) => slot.id === sourceSlotId
          ? { ...slot, cardId: null, cardInstanceId: null, hostedCardIds: [] }
          : slot),
      };
    }
    if (foundation.id === destinationFoundationId) {
      return {
        ...foundation,
        slots: foundation.slots.map((slot) => slot.id === destinationSlotId
          ? { ...slot, ...movedCard }
          : slot),
      };
    }
    return foundation;
  });
  return {
    moved: true,
    foundations: nextFoundations,
    cardId: movedCard.cardId,
    cardInstanceId: movedCard.cardInstanceId,
    sourceFoundationId,
    sourceSlotId,
    destinationFoundationId,
    destinationSlotId,
  };
}
