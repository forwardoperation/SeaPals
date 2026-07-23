function normalizeHandLimit(handLimit) {
  const numericLimit = Number(handLimit);
  return Number.isFinite(numericLimit)
    ? Math.max(0, Math.trunc(numericLimit))
    : Infinity;
}

function assertCardList(cards, label) {
  if (!Array.isArray(cards)) {
    throw new TypeError(`${label} must be an array.`);
  }
}

function createEntry(cardId, origin, originIndex, snapshotIndex) {
  return Object.freeze({
    key: `${origin}:${originIndex}`,
    cardId,
    origin,
    originIndex,
    snapshotIndex,
  });
}

function validateChoice(choice) {
  if (!choice || !Array.isArray(choice.entries)) {
    throw new TypeError("A hand-limit choice with snapshot entries is required.");
  }

  const requiredDiscardCount = Number(choice.requiredDiscardCount);
  if (!Number.isInteger(requiredDiscardCount) || requiredDiscardCount < 0 || requiredDiscardCount > choice.entries.length) {
    throw new TypeError("The hand-limit choice has an invalid required discard count.");
  }

  const keys = new Set();
  choice.entries.forEach((entry, index) => {
    if (!entry || typeof entry.key !== "string" || entry.key.length === 0) {
      throw new TypeError(`Hand-limit entry ${index} has an invalid key.`);
    }
    if (keys.has(entry.key)) {
      throw new TypeError(`Hand-limit choice contains duplicate entry key "${entry.key}".`);
    }
    keys.add(entry.key);
  });

  return requiredDiscardCount;
}

/**
 * Creates an immutable, occurrence-based snapshot of the hand after an effect
 * adds cards. Entry keys identify physical occurrences, so duplicate card IDs
 * remain independently selectable.
 */
export function createHandLimitChoice({
  hand = [],
  incomingCards = [],
  handLimit = Infinity,
} = {}) {
  assertCardList(hand, "hand");
  assertCardList(incomingCards, "incomingCards");

  const normalizedLimit = normalizeHandLimit(handLimit);
  const entries = Object.freeze([
    ...hand.map((cardId, index) => createEntry(cardId, "hand", index, index)),
    ...incomingCards.map((cardId, index) => createEntry(cardId, "incoming", index, hand.length + index)),
  ]);
  const requiredDiscardCount = Number.isFinite(normalizedLimit)
    ? Math.max(0, entries.length - normalizedLimit)
    : 0;

  return Object.freeze({
    handLimit: normalizedLimit,
    handSizeBefore: hand.length,
    incomingCount: incomingCards.length,
    projectedHandSize: entries.length,
    requiredDiscardCount,
    overflowCount: requiredDiscardCount,
    needsChoice: requiredDiscardCount > 0,
    entries,
    projectedHand: Object.freeze(entries.map((entry) => entry.cardId)),
  });
}

/**
 * Applies an exact set of occurrence keys to a hand-limit snapshot.
 * Both the kept hand and newly discarded cards retain snapshot order,
 * independent of the order in which the UI supplied selectedKeys.
 */
export function resolveHandLimitChoice(choice, selectedKeys = [], discardPile = []) {
  const requiredDiscardCount = validateChoice(choice);
  if (!Array.isArray(selectedKeys)) {
    throw new TypeError("selectedKeys must be an array.");
  }
  assertCardList(discardPile, "discardPile");

  const uniqueSelectedKeys = new Set(selectedKeys);
  if (uniqueSelectedKeys.size !== selectedKeys.length) {
    throw new RangeError("Each hand-limit entry may be selected only once.");
  }

  const validKeys = new Set(choice.entries.map((entry) => entry.key));
  const invalidKey = selectedKeys.find((key) => !validKeys.has(key));
  if (invalidKey !== undefined) {
    throw new RangeError(`Unknown hand-limit entry key "${String(invalidKey)}".`);
  }

  if (selectedKeys.length !== requiredDiscardCount) {
    throw new RangeError(`Choose exactly ${requiredDiscardCount} card${requiredDiscardCount === 1 ? "" : "s"} to discard.`);
  }

  const keptEntries = [];
  const discardedEntries = [];
  choice.entries.forEach((entry) => {
    if (uniqueSelectedKeys.has(entry.key)) discardedEntries.push(entry);
    else keptEntries.push(entry);
  });

  return {
    hand: keptEntries.map((entry) => entry.cardId),
    discardPile: [...discardedEntries.map((entry) => entry.cardId), ...discardPile],
    cardsToDiscard: discardedEntries.map((entry) => entry.cardId),
    keptEntries,
    discardedEntries,
    selectedKeys: discardedEntries.map((entry) => entry.key),
    incomingCardsToHand: keptEntries.filter((entry) => entry.origin === "incoming").map((entry) => entry.cardId),
    incomingCardsToDiscard: discardedEntries.filter((entry) => entry.origin === "incoming").map((entry) => entry.cardId),
  };
}

/**
 * Selects the cards an automated player should discard. Lower keep scores are
 * discarded first. Equal scores discard later snapshot entries first, which
 * gives a stable tail-discard fallback without using randomness.
 */
export function selectAutomatedHandLimitDiscards(choice, getKeepScore = () => 0) {
  const requiredDiscardCount = validateChoice(choice);
  if (typeof getKeepScore !== "function") {
    throw new TypeError("getKeepScore must be a function.");
  }
  if (!requiredDiscardCount) return [];

  return choice.entries
    .map((entry) => {
      const numericScore = Number(getKeepScore(entry.cardId, entry));
      return {
        entry,
        score: Number.isNaN(numericScore) ? 0 : numericScore,
      };
    })
    .sort((left, right) => left.score - right.score || right.entry.snapshotIndex - left.entry.snapshotIndex)
    .slice(0, requiredDiscardCount)
    .map(({ entry }) => entry.key);
}

export function applyAutomatedHandLimit({
  hand = [],
  incomingCards = [],
  handLimit = Infinity,
  discardPile = [],
  getKeepScore = () => 0,
} = {}) {
  const choice = createHandLimitChoice({ hand, incomingCards, handLimit });
  const selectedKeys = selectAutomatedHandLimitDiscards(choice, getKeepScore);
  return {
    choice,
    ...resolveHandLimitChoice(choice, selectedKeys, discardPile),
  };
}
