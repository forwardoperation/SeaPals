import { normalizeAdventureSave } from "./adventureProgression.mjs";

export const STARTER_DECK_CARD_COUNT = 60;

const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_DECK_NAME_LENGTH = 80;

export class StarterDeckManifestValidationError extends TypeError {
  constructor(message) {
    super(message);
    this.name = "StarterDeckManifestValidationError";
  }
}

export class StarterCollectionReconciliationError extends Error {
  constructor(message) {
    super(message);
    this.name = "StarterCollectionReconciliationError";
  }
}

function failManifest(path, message) {
  throw new StarterDeckManifestValidationError(`${path} ${message}`);
}

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeIdentifier(value, path) {
  if (typeof value !== "string") failManifest(path, "must be a string identifier.");

  const normalized = value.trim();
  if (!normalized) failManifest(path, "must not be empty.");
  if (normalized.length > MAX_IDENTIFIER_LENGTH) {
    failManifest(path, `must be at most ${MAX_IDENTIFIER_LENGTH} characters.`);
  }
  if (!IDENTIFIER_PATTERN.test(normalized)) {
    failManifest(path, "must contain only lowercase letters, numbers, and single separators (., _, :, or -).");
  }
  return normalized;
}

function normalizeDeckName(value, path) {
  if (typeof value !== "string") failManifest(path, "must be a string.");

  const normalized = value.trim();
  if (!normalized) failManifest(path, "must not be empty.");
  if (normalized.length > MAX_DECK_NAME_LENGTH) {
    failManifest(path, `must be at most ${MAX_DECK_NAME_LENGTH} characters.`);
  }
  return normalized;
}

/**
 * Converts a prebuilt deck manifest into the quantity-record shape used by an
 * adventure save. Starter manifests are deliberately stricter than arbitrary
 * saved decks: every entry must be unique and the deck must contain 60 cards.
 */
export function normalizeStarterDeckManifest(value) {
  if (!isRecord(value)) failManifest("starterDeck", "must be a plain object.");

  const id = normalizeIdentifier(value.id, "starterDeck.id");
  const name = normalizeDeckName(value.name, "starterDeck.name");
  if (!Array.isArray(value.cards)) failManifest("starterDeck.cards", "must be an array.");

  const quantities = {};
  let totalCards = 0;

  for (let index = 0; index < value.cards.length; index += 1) {
    const path = `starterDeck.cards[${index}]`;
    const entry = value.cards[index];
    if (!isRecord(entry)) failManifest(path, "must be a plain object.");

    const cardId = normalizeIdentifier(entry.cardId, `${path}.cardId`);
    if (!Number.isSafeInteger(entry.quantity) || entry.quantity <= 0) {
      failManifest(`${path}.quantity`, "must be a positive safe integer.");
    }
    if (Object.hasOwn(quantities, cardId)) {
      failManifest(`${path}.cardId`, `duplicates card identifier \"${cardId}\".`);
    }
    if (!Number.isSafeInteger(totalCards + entry.quantity)) {
      failManifest("starterDeck.cards", "has a quantity total outside the safe integer range.");
    }

    quantities[cardId] = entry.quantity;
    totalCards += entry.quantity;
  }

  if (totalCards !== STARTER_DECK_CARD_COUNT) {
    failManifest(
      "starterDeck.cards",
      `must contain exactly ${STARTER_DECK_CARD_COUNT} cards; received ${totalCards}.`,
    );
  }

  const cards = Object.fromEntries(
    Object.entries(quantities).sort(([left], [right]) => left.localeCompare(right)),
  );

  return { id, name, cards, totalCards };
}

function quantityRecordsEqual(left, right) {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  if (leftEntries.length !== rightEntries.length) return false;

  return leftEntries.every(([cardId, quantity]) => right[cardId] === quantity);
}

/**
 * Grants or repairs the collection backing a committed starter choice.
 *
 * Existing quantities are treated as earned inventory, so reconciliation only
 * raises a card count to the starter requirement and never lowers it. The
 * starter's saved deck is canonicalized to its exact 60-card manifest while
 * all other collection, deck, progression, world, and settings data survives.
 */
export function reconcileStarterCollection(saveValue, deckManifest) {
  const save = normalizeAdventureSave(saveValue);
  const deck = normalizeStarterDeckManifest(deckManifest);

  if (save.player.starterDeckId === null) {
    throw new StarterCollectionReconciliationError(
      "A starter deck must be selected before its collection can be initialized.",
    );
  }
  if (save.player.starterDeckId !== deck.id) {
    throw new StarterCollectionReconciliationError(
      `Selected starter \"${save.player.starterDeckId}\" does not match manifest \"${deck.id}\".`,
    );
  }

  const cards = { ...save.inventory.cards };
  const grantedCards = {};
  for (const [cardId, requiredQuantity] of Object.entries(deck.cards)) {
    const ownedQuantity = cards[cardId] ?? 0;
    if (ownedQuantity < requiredQuantity) {
      cards[cardId] = requiredQuantity;
      grantedCards[cardId] = requiredQuantity - ownedQuantity;
    }
  }

  const existingStarterDeck = save.savedDecks[deck.id];
  const starterDeckNeedsRepair =
    existingStarterDeck?.name !== deck.name ||
    !existingStarterDeck ||
    !quantityRecordsEqual(existingStarterDeck.cards, deck.cards);
  // Initial starter selection already points at the starter. On later resumes,
  // preserve an explicitly selected saved deck so collection repair never
  // silently undoes a future deck-builder choice.
  const activeDeckId = save.player.activeDeckId;
  const activeDeckExists = activeDeckId === deck.id || Boolean(save.savedDecks[activeDeckId]);
  const reconciledActiveDeckId = activeDeckExists ? activeDeckId : deck.id;
  const activeDeckNeedsRepair = activeDeckId !== reconciledActiveDeckId;
  const applied =
    Object.keys(grantedCards).length > 0 ||
    starterDeckNeedsRepair ||
    activeDeckNeedsRepair;

  const reconciledSave = normalizeAdventureSave({
    ...save,
    player: {
      ...save.player,
      activeDeckId: reconciledActiveDeckId,
    },
    inventory: {
      ...save.inventory,
      cards,
    },
    savedDecks: {
      ...save.savedDecks,
      [deck.id]: {
        name: deck.name,
        cards: deck.cards,
      },
    },
  });

  return {
    save: reconciledSave,
    applied,
    starterDeckId: deck.id,
    grantedCards,
  };
}
