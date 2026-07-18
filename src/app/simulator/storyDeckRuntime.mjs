import { normalizeStoryPlayerDeckSnapshot } from "./storyModeContract.mjs";

const FNV_64_OFFSET = 0xcbf29ce484222325n;
const FNV_64_PRIME = 0x100000001b3n;
const UINT_64_MASK = 0xffffffffffffffffn;

export class StoryDeckSnapshotResolutionError extends Error {
  constructor(message) {
    super(message);
    this.name = "StoryDeckSnapshotResolutionError";
  }
}

function requireCardCatalog(cardCatalog) {
  if (!cardCatalog || typeof cardCatalog !== "object" || Array.isArray(cardCatalog)) {
    throw new TypeError("Story deck card catalog must be an object keyed by card id.");
  }
  return cardCatalog;
}

/** Recomputes the canonical composition identity at the simulator boundary. */
export function fingerprintResolvedStoryDeckCards(cardsValue) {
  if (!Array.isArray(cardsValue) || cardsValue.length === 0) {
    throw new TypeError("Story deck fingerprinting requires a non-empty cards array.");
  }
  const canonical = cardsValue
    .map((entry) => `${entry.cardId}:${entry.quantity}`)
    .sort((left, right) => left.localeCompare(right))
    .join("\n");
  let hash = FNV_64_OFFSET;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= BigInt(canonical.charCodeAt(index));
    hash = (hash * FNV_64_PRIME) & UINT_64_MASK;
  }
  return `deck-v1-${hash.toString(16).padStart(16, "0")}`;
}

/**
 * Captures the immutable player-deck manifest used for one story duel. The
 * caller may freely mutate its original editor/save objects after this point;
 * the simulator owns this canonical clone for the lifetime of the match.
 */
export function resolveStoryPlayerDeckSnapshot(snapshotValue, cardCatalogValue, expectedDeckId = null) {
  const snapshot = normalizeStoryPlayerDeckSnapshot(snapshotValue);
  const cardCatalog = requireCardCatalog(cardCatalogValue);
  const normalizedExpectedDeckId = String(expectedDeckId ?? "").trim();
  if (normalizedExpectedDeckId && normalizedExpectedDeckId !== snapshot.id) {
    throw new StoryDeckSnapshotResolutionError(
      `Story player deck id "${normalizedExpectedDeckId}" does not match snapshot id "${snapshot.id}".`,
    );
  }
  const unresolvedCardIds = snapshot.cards
    .map((entry) => entry.cardId)
    .filter((cardId) => !Object.hasOwn(cardCatalog, cardId) || !cardCatalog[cardId]);

  if (unresolvedCardIds.length > 0) {
    throw new StoryDeckSnapshotResolutionError(
      `Story player deck "${snapshot.id}" cannot launch because these card ids are unresolved: ${unresolvedCardIds.join(", ")}.`,
    );
  }
  const computedFingerprint = fingerprintResolvedStoryDeckCards(snapshot.cards);
  if (computedFingerprint !== snapshot.fingerprint) {
    throw new StoryDeckSnapshotResolutionError(
      `Story player deck "${snapshot.id}" fingerprint does not match its card composition.`,
    );
  }

  return snapshot;
}

/**
 * Expands one half of an already resolved snapshot into the card-id list used
 * by the simulator's existing shuffle/opening-hand logic.
 */
export function expandResolvedStoryDeckCards(
  snapshot,
  deckType,
  cardCatalogValue,
  isFoundationCard,
) {
  const cardCatalog = requireCardCatalog(cardCatalogValue);
  if (deckType !== "foundation" && deckType !== "pals") {
    throw new TypeError('Story deck type must be either "foundation" or "pals".');
  }
  if (typeof isFoundationCard !== "function") {
    throw new TypeError("Story deck expansion requires an isFoundationCard function.");
  }

  return snapshot.cards.flatMap((entry) => {
    const card = cardCatalog[entry.cardId];
    if (!card) {
      throw new StoryDeckSnapshotResolutionError(
        `Story player deck "${snapshot.id}" cannot launch because card id "${entry.cardId}" is unresolved.`,
      );
    }
    const belongsInDeck = deckType === "foundation"
      ? isFoundationCard(card)
      : !isFoundationCard(card);
    return belongsInDeck
      ? Array.from({ length: entry.quantity }, () => entry.cardId)
      : [];
  });
}
