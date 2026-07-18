import { normalizeAdventureSave } from "./adventureProgression.mjs";

export const ADVENTURE_DECK_RULES = Object.freeze({
  deckSize: 60,
  maxCopiesPerCard: 4,
  minPrintedVictoryPoints: 30,
  requireBaseFoundation: true,
});

const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/;
const FINGERPRINT_PATTERN = /^deck-v1-[0-9a-f]{16}$/;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_DECK_NAME_LENGTH = 80;
const FNV_64_OFFSET = 0xcbf29ce484222325n;
const FNV_64_PRIME = 0x100000001b3n;
const UINT_64_MASK = 0xffffffffffffffffn;

export class AdventureDeckValidationError extends TypeError {
  constructor(message) {
    super(message);
    this.name = "AdventureDeckValidationError";
  }
}

export class AdventureDeckOperationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AdventureDeckOperationError";
  }
}

export class AdventureDeckLegalityError extends AdventureDeckOperationError {
  constructor(message, validation) {
    super(message);
    this.name = "AdventureDeckLegalityError";
    this.validation = validation;
    this.errors = [...(validation?.errors ?? [])];
  }
}

function fail(path, message) {
  throw new AdventureDeckValidationError(`${path} ${message}`);
}

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireRecord(value, path) {
  if (!isRecord(value)) fail(path, "must be a plain object.");
  return value;
}

/** Canonicalizes and validates a persisted deck identifier. */
export function normalizeAdventureDeckId(value, path = "deckId") {
  if (typeof value !== "string") fail(path, "must be a string identifier.");

  const normalized = value.trim();
  if (!normalized) fail(path, "must not be empty.");
  if (normalized.length > MAX_IDENTIFIER_LENGTH) {
    fail(path, `must be at most ${MAX_IDENTIFIER_LENGTH} characters.`);
  }
  if (!IDENTIFIER_PATTERN.test(normalized)) {
    fail(path, "must contain only lowercase letters, numbers, and single separators (., _, :, or -).");
  }
  return normalized;
}

/** Trims and collapses whitespace while preserving the player's capitalization. */
export function normalizeAdventureDeckName(value, path = "deckName") {
  if (typeof value !== "string") fail(path, "must be a string.");

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) fail(path, "must not be empty.");
  if (normalized.length > MAX_DECK_NAME_LENGTH) {
    fail(path, `must be at most ${MAX_DECK_NAME_LENGTH} characters.`);
  }
  return normalized;
}

/** Converts an arbitrary player-facing label into a valid deck-id stem. */
export function slugifyAdventureDeckId(value) {
  if (typeof value !== "string") fail("deckName", "must be a string.");

  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_IDENTIFIER_LENGTH)
    .replace(/-+$/g, "");

  return slug || "deck";
}

/** Canonical quantity-record representation used by adventure saves. */
export function normalizeAdventureDeckCards(value, path = "deck.cards") {
  const record = requireRecord(value, path);
  const entries = [];

  for (const [rawCardId, quantity] of Object.entries(record)) {
    const cardId = normalizeAdventureDeckId(rawCardId, `${path} key`);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      fail(`${path}.${cardId}`, "must be a positive safe integer.");
    }
    entries.push([cardId, quantity]);
  }

  entries.sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

function normalizeDeckRules(value = {}) {
  const rules = requireRecord(value, "rules");
  const normalized = {
    deckSize: value.deckSize ?? ADVENTURE_DECK_RULES.deckSize,
    maxCopiesPerCard: value.maxCopiesPerCard ?? ADVENTURE_DECK_RULES.maxCopiesPerCard,
    minPrintedVictoryPoints:
      value.minPrintedVictoryPoints
      ?? value.minVictoryPoints
      ?? ADVENTURE_DECK_RULES.minPrintedVictoryPoints,
    requireBaseFoundation:
      value.requireBaseFoundation ?? ADVENTURE_DECK_RULES.requireBaseFoundation,
  };

  for (const key of ["deckSize", "maxCopiesPerCard", "minPrintedVictoryPoints"]) {
    if (!Number.isSafeInteger(normalized[key]) || normalized[key] < 0) {
      fail(`rules.${key}`, "must be a non-negative safe integer.");
    }
  }
  if (normalized.deckSize === 0) fail("rules.deckSize", "must be greater than zero.");
  if (normalized.maxCopiesPerCard === 0) {
    fail("rules.maxCopiesPerCard", "must be greater than zero.");
  }
  if (typeof normalized.requireBaseFoundation !== "boolean") {
    fail("rules.requireBaseFoundation", "must be a boolean.");
  }

  return normalized;
}

function normalizeCardCatalog(value) {
  if (Array.isArray(value)) {
    const catalog = {};
    for (let index = 0; index < value.length; index += 1) {
      const card = requireRecord(value[index], `cardCatalog[${index}]`);
      const cardId = normalizeAdventureDeckId(card.id, `cardCatalog[${index}].id`);
      if (Object.hasOwn(catalog, cardId)) {
        fail(`cardCatalog[${index}].id`, `duplicates card identifier "${cardId}".`);
      }
      catalog[cardId] = card;
    }
    return catalog;
  }

  const record = requireRecord(value, "cardCatalog");
  const catalog = {};
  for (const [rawCardId, cardValue] of Object.entries(record)) {
    const cardId = normalizeAdventureDeckId(rawCardId, "cardCatalog key");
    const card = requireRecord(cardValue, `cardCatalog.${cardId}`);
    if (card.id !== undefined && normalizeAdventureDeckId(card.id, `cardCatalog.${cardId}.id`) !== cardId) {
      fail(`cardCatalog.${cardId}.id`, `must match catalog key "${cardId}".`);
    }
    catalog[cardId] = card;
  }
  return catalog;
}

function getPrintedVictoryPoints(card) {
  const rawValue = card?.victoryPoints?.value ?? card?.victoryPoints ?? card?.vp ?? 0;
  const value = Number(rawValue);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function isBaseFoundation(card) {
  if (card?.isBaseFoundation === true) return true;

  const stage = card?.stage;
  const isBaseStage = stage === 0 || stage === "base";
  if (!isBaseStage) return false;

  return card?.kind === "coral"
    || (card?.kind === "creature" && card?.subtype === "baitball");
}

function createIssue(code, message, details = {}) {
  return { code, message, ...details };
}

function validationResult(issues, summary, cards) {
  return {
    isValid: issues.length === 0,
    errors: issues.map((issue) => issue.message),
    issues,
    summary,
    cards,
  };
}

function invalidDeckShapeResult(error, rules) {
  const issue = createIssue("invalid-deck", error.message);
  return validationResult([issue], {
    totalCards: 0,
    totalPrintedVictoryPoints: 0,
    baseFoundationCount: 0,
    ownedQuantityValid: false,
    rules,
  }, {});
}

/**
 * Validates a deck against both the permanent collection and game rules.
 * The deck may be a saved-deck object (`{ name, cards }`) or just `{ cards }`.
 */
export function validateAdventureDeck(deckValue, ownedCardsValue, cardCatalogValue, rulesValue = {}) {
  const rules = normalizeDeckRules(rulesValue);
  let cards;
  try {
    const deck = requireRecord(deckValue, "deck");
    cards = normalizeAdventureDeckCards(deck.cards, "deck.cards");
  } catch (error) {
    if (error instanceof AdventureDeckValidationError) {
      return invalidDeckShapeResult(error, rules);
    }
    throw error;
  }

  const ownedCards = normalizeAdventureDeckCards(ownedCardsValue, "ownedCards");
  const cardCatalog = normalizeCardCatalog(cardCatalogValue);
  const issues = [];
  let totalCards = 0;
  let totalPrintedVictoryPoints = 0;
  let baseFoundationCount = 0;
  let ownedQuantityValid = true;

  for (const [cardId, quantity] of Object.entries(cards)) {
    const card = cardCatalog[cardId];
    const ownedQuantity = ownedCards[cardId] ?? 0;

    totalCards += quantity;

    if (!card) {
      issues.push(createIssue(
        "unknown-card",
        `Unknown card id: ${cardId}.`,
        { cardId },
      ));
    } else {
      totalPrintedVictoryPoints += getPrintedVictoryPoints(card) * quantity;
      if (isBaseFoundation(card)) baseFoundationCount += quantity;
      if (card.kind === "condition") {
        issues.push(createIssue(
          "condition-card",
          `${card.name ?? cardId} belongs in the separate Condition deck and cannot be added to a personal deck.`,
          { cardId },
        ));
      }
    }

    if (quantity > ownedQuantity) {
      ownedQuantityValid = false;
      issues.push(createIssue(
        "insufficient-owned-quantity",
        `${card?.name ?? cardId} uses ${quantity} copies, but only ${ownedQuantity} are owned.`,
        { cardId, quantity, ownedQuantity },
      ));
    }

    if (quantity > rules.maxCopiesPerCard) {
      issues.push(createIssue(
        "copy-limit",
        `${card?.name ?? cardId} exceeds the max copy limit of ${rules.maxCopiesPerCard}.`,
        { cardId, quantity, limit: rules.maxCopiesPerCard },
      ));
    }
  }

  if (totalCards !== rules.deckSize) {
    issues.push(createIssue(
      "deck-size",
      `Deck must contain exactly ${rules.deckSize} cards. Current total: ${totalCards}.`,
      { current: totalCards, required: rules.deckSize },
    ));
  }

  if (rules.requireBaseFoundation && baseFoundationCount === 0) {
    issues.push(createIssue(
      "base-foundation",
      "Deck must contain at least one base foundation.",
    ));
  }

  if (totalPrintedVictoryPoints < rules.minPrintedVictoryPoints) {
    issues.push(createIssue(
      "printed-vp",
      `Deck must include at least ${rules.minPrintedVictoryPoints} total printed victory points. Current total: ${totalPrintedVictoryPoints}.`,
      { current: totalPrintedVictoryPoints, required: rules.minPrintedVictoryPoints },
    ));
  }

  return validationResult(issues, {
    totalCards,
    totalPrintedVictoryPoints,
    baseFoundationCount,
    ownedQuantityValid,
    rules,
  }, cards);
}

function requireSavedDeck(save, deckId) {
  const deck = save.savedDecks[deckId];
  if (!deck) throw new AdventureDeckOperationError(`Saved deck "${deckId}" does not exist.`);
  return deck;
}

function assertDraftCardsAllowed(cards, ownedCards, cardCatalogValue) {
  const cardIds = Object.keys(cards);
  const cardCatalog = cardIds.length > 0
    ? normalizeCardCatalog(cardCatalogValue)
    : {};

  for (const [cardId, quantity] of Object.entries(cards)) {
    const ownedQuantity = ownedCards[cardId] ?? 0;
    const card = cardCatalog[cardId];
    if (!card) {
      throw new AdventureDeckOperationError(`Unknown card id: ${cardId}.`);
    }
    if (card.kind === "condition") {
      throw new AdventureDeckOperationError(
        `${card.name ?? cardId} belongs in the separate Condition deck and cannot be added to a personal deck.`,
      );
    }
    if (quantity > ADVENTURE_DECK_RULES.maxCopiesPerCard) {
      throw new AdventureDeckOperationError(
        `${cardId} exceeds the max copy limit of ${ADVENTURE_DECK_RULES.maxCopiesPerCard}.`,
      );
    }
    if (quantity > ownedQuantity) {
      throw new AdventureDeckOperationError(
        `${cardId} uses ${quantity} copies, but only ${ownedQuantity} are owned.`,
      );
    }
  }
}

function withSavedDeck(save, deckId, deck) {
  return normalizeAdventureSave({
    ...save,
    savedDecks: {
      ...save.savedDecks,
      [deckId]: deck,
    },
  });
}

/** Returns a unique, stable persisted id derived from a player-facing name. */
export function createUniqueAdventureDeckId(saveValue, nameValue) {
  const save = normalizeAdventureSave(saveValue);
  const name = normalizeAdventureDeckName(nameValue);
  const base = slugifyAdventureDeckId(name);

  if (!Object.hasOwn(save.savedDecks, base)) return base;

  for (let suffix = 2; suffix < Number.MAX_SAFE_INTEGER; suffix += 1) {
    const suffixText = `-${suffix}`;
    const candidateBase = base
      .slice(0, MAX_IDENTIFIER_LENGTH - suffixText.length)
      .replace(/[-._:]+$/g, "");
    const candidate = `${candidateBase || "deck"}${suffixText}`;
    if (!Object.hasOwn(save.savedDecks, candidate)) return candidate;
  }

  throw new AdventureDeckOperationError("Could not allocate a unique deck identifier.");
}

/** Creates an empty or partially built saved deck without requiring game legality. */
export function createSavedDeck(saveValue, deckValue, options = {}) {
  const save = normalizeAdventureSave(saveValue);
  const deck = requireRecord(deckValue, "deck");
  const settings = requireRecord(options, "options");
  const name = normalizeAdventureDeckName(deck.name, "deck.name");
  const deckId = deck.id === undefined
    ? createUniqueAdventureDeckId(save, name)
    : normalizeAdventureDeckId(deck.id, "deck.id");
  const cards = normalizeAdventureDeckCards(deck.cards ?? {}, "deck.cards");

  if (Object.hasOwn(save.savedDecks, deckId)) {
    throw new AdventureDeckOperationError(`Saved deck "${deckId}" already exists.`);
  }
  assertDraftCardsAllowed(cards, save.inventory.cards, settings.cardCatalog);

  let nextSave = withSavedDeck(save, deckId, { name, cards });
  let validation = null;
  if (settings.setActive === true) {
    if (!settings.cardCatalog) {
      throw new AdventureDeckOperationError(
        "Creating an active deck requires a cardCatalog so game legality can be checked.",
      );
    }
    const activeResult = setActiveSavedDeck(
      nextSave,
      deckId,
      settings.cardCatalog,
      settings.rules,
    );
    nextSave = activeResult.save;
    validation = activeResult.validation;
  } else if (settings.setActive !== undefined && settings.setActive !== false) {
    fail("options.setActive", "must be a boolean.");
  }

  return {
    save: nextSave,
    deckId,
    deck: { name, cards },
    validation,
  };
}

/** Returns an independent canonical deck object, including its persisted id. */
export function getSavedDeck(saveValue, deckIdValue) {
  const save = normalizeAdventureSave(saveValue);
  const deckId = normalizeAdventureDeckId(deckIdValue);
  const deck = requireSavedDeck(save, deckId);
  return { id: deckId, name: deck.name, cards: { ...deck.cards } };
}

/** Renames a saved deck while preserving its exact card draft. */
export function renameSavedDeck(saveValue, deckIdValue, nameValue) {
  const save = normalizeAdventureSave(saveValue);
  const deckId = normalizeAdventureDeckId(deckIdValue);
  const deck = requireSavedDeck(save, deckId);
  const name = normalizeAdventureDeckName(nameValue);
  const nextSave = withSavedDeck(save, deckId, { ...deck, name });

  return { save: nextSave, deckId, deck: { ...nextSave.savedDecks[deckId] } };
}

/**
 * Atomically replaces name and quantities for an editable draft. Incomplete
 * decks are valid drafts, but imaginary ownership and more than four copies
 * are rejected before any save transition is produced.
 */
export function replaceSavedDeckDraft(saveValue, deckIdValue, deckValue, cardCatalog) {
  const save = normalizeAdventureSave(saveValue);
  const deckId = normalizeAdventureDeckId(deckIdValue);
  requireSavedDeck(save, deckId);
  const deck = requireRecord(deckValue, "deck");
  const name = normalizeAdventureDeckName(deck.name, "deck.name");
  const cards = normalizeAdventureDeckCards(deck.cards, "deck.cards");

  assertDraftCardsAllowed(cards, save.inventory.cards, cardCatalog);
  const nextSave = withSavedDeck(save, deckId, { name, cards });
  return { save: nextSave, deckId, deck: { name, cards } };
}

function generatedCopyName(name) {
  const suffix = " Copy";
  const base = name.slice(0, MAX_DECK_NAME_LENGTH - suffix.length).trimEnd();
  return `${base}${suffix}`;
}

/** Duplicates a saved draft under a new unique identity. */
export function duplicateSavedDeck(saveValue, sourceDeckIdValue, options = {}) {
  const save = normalizeAdventureSave(saveValue);
  const sourceDeckId = normalizeAdventureDeckId(sourceDeckIdValue, "sourceDeckId");
  const sourceDeck = requireSavedDeck(save, sourceDeckId);
  const settings = requireRecord(options, "options");
  const name = settings.name === undefined
    ? generatedCopyName(sourceDeck.name)
    : normalizeAdventureDeckName(settings.name, "options.name");
  const deckId = settings.id === undefined
    ? createUniqueAdventureDeckId(save, name)
    : normalizeAdventureDeckId(settings.id, "options.id");

  if (Object.hasOwn(save.savedDecks, deckId)) {
    throw new AdventureDeckOperationError(`Saved deck "${deckId}" already exists.`);
  }
  assertDraftCardsAllowed(sourceDeck.cards, save.inventory.cards, settings.cardCatalog);

  const cards = { ...sourceDeck.cards };
  const nextSave = withSavedDeck(save, deckId, { name, cards });
  return { save: nextSave, deckId, sourceDeckId, deck: { name, cards } };
}

function chooseActiveFallback(save, remainingDecks, fallbackDeckIdValue) {
  if (fallbackDeckIdValue !== undefined && fallbackDeckIdValue !== null) {
    const fallbackDeckId = normalizeAdventureDeckId(fallbackDeckIdValue, "options.fallbackDeckId");
    if (!Object.hasOwn(remainingDecks, fallbackDeckId)) {
      throw new AdventureDeckOperationError(
        `Fallback deck "${fallbackDeckId}" does not exist after deletion.`,
      );
    }
    return fallbackDeckId;
  }

  const starterDeckId = save.player.starterDeckId;
  if (starterDeckId && Object.hasOwn(remainingDecks, starterDeckId)) return starterDeckId;
  return Object.keys(remainingDecks).sort((left, right) => left.localeCompare(right))[0] ?? null;
}

/** Deletes a deck and guarantees that activeDeckId is either valid or null. */
export function deleteSavedDeck(saveValue, deckIdValue, options = {}) {
  const save = normalizeAdventureSave(saveValue);
  const deckId = normalizeAdventureDeckId(deckIdValue);
  const settings = requireRecord(options, "options");
  const deletedDeck = requireSavedDeck(save, deckId);
  const remainingDecks = Object.fromEntries(
    Object.entries(save.savedDecks).filter(([candidateId]) => candidateId !== deckId),
  );

  const currentActiveId = save.player.activeDeckId;
  const activeDeckId = currentActiveId && Object.hasOwn(remainingDecks, currentActiveId)
    ? currentActiveId
    : chooseActiveFallback(save, remainingDecks, settings.fallbackDeckId);

  const nextSave = normalizeAdventureSave({
    ...save,
    player: { ...save.player, activeDeckId },
    savedDecks: remainingDecks,
  });

  return {
    save: nextSave,
    deckId,
    deletedDeck: { name: deletedDeck.name, cards: { ...deletedDeck.cards } },
    activeDeckId,
  };
}

/** Validates one persisted deck against the player's current collection. */
export function validateSavedDeck(saveValue, deckIdValue, cardCatalog, rules = {}) {
  const save = normalizeAdventureSave(saveValue);
  const deckId = normalizeAdventureDeckId(deckIdValue);
  const deck = save.savedDecks[deckId];

  if (!deck) {
    const normalizedRules = normalizeDeckRules(rules);
    const issue = createIssue("missing-deck", `Saved deck "${deckId}" does not exist.`, { deckId });
    return {
      deckId,
      ...validationResult([issue], {
        totalCards: 0,
        totalPrintedVictoryPoints: 0,
        baseFoundationCount: 0,
        ownedQuantityValid: false,
        rules: normalizedRules,
      }, {}),
    };
  }

  return {
    deckId,
    ...validateAdventureDeck(deck, save.inventory.cards, cardCatalog, rules),
  };
}

/** Makes a legal saved deck active; invalid drafts remain saved but cannot launch. */
export function setActiveSavedDeck(saveValue, deckIdValue, cardCatalog, rules = {}) {
  const save = normalizeAdventureSave(saveValue);
  const deckId = normalizeAdventureDeckId(deckIdValue);
  requireSavedDeck(save, deckId);
  const validation = validateSavedDeck(save, deckId, cardCatalog, rules);

  if (!validation.isValid) {
    throw new AdventureDeckLegalityError(
      `Saved deck "${deckId}" cannot be activated: ${validation.errors.join(" ")}`,
      validation,
    );
  }

  const nextSave = normalizeAdventureSave({
    ...save,
    player: { ...save.player, activeDeckId: deckId },
  });
  return {
    save: nextSave,
    deckId,
    deck: { name: save.savedDecks[deckId].name, cards: { ...save.savedDecks[deckId].cards } },
    validation,
  };
}

function normalizeFingerprintCards(value) {
  if (!Array.isArray(value)) return normalizeAdventureDeckCards(value, "cards");

  const record = {};
  for (let index = 0; index < value.length; index += 1) {
    const entry = requireRecord(value[index], `cards[${index}]`);
    const cardId = normalizeAdventureDeckId(entry.cardId, `cards[${index}].cardId`);
    if (!Number.isSafeInteger(entry.quantity) || entry.quantity <= 0) {
      fail(`cards[${index}].quantity`, "must be a positive safe integer.");
    }
    if (Object.hasOwn(record, cardId)) {
      fail(`cards[${index}].cardId`, `duplicates card identifier "${cardId}".`);
    }
    record[cardId] = entry.quantity;
  }
  return normalizeAdventureDeckCards(record, "cards");
}

function fnv1a64(value) {
  let hash = FNV_64_OFFSET;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * FNV_64_PRIME) & UINT_64_MASK;
  }
  return hash.toString(16).padStart(16, "0");
}

/** Stable composition fingerprint; deck id and display name are intentionally excluded. */
export function fingerprintDeckCards(cardsValue) {
  const cards = normalizeFingerprintCards(cardsValue);
  const canonical = Object.entries(cards)
    .map(([cardId, quantity]) => `${cardId}:${quantity}`)
    .join("\n");
  return `deck-v1-${fnv1a64(canonical)}`;
}

/**
 * Produces the exact immutable adventure-to-simulator deck boundary shape.
 * Later saved-deck edits cannot alter any nested snapshot value.
 */
export function createDuelDeckSnapshot(saveValue, deckIdValue, cardCatalog, rules = {}) {
  const save = normalizeAdventureSave(saveValue);
  const deckId = normalizeAdventureDeckId(deckIdValue);
  const deck = requireSavedDeck(save, deckId);
  const validation = validateSavedDeck(save, deckId, cardCatalog, rules);

  if (!validation.isValid) {
    throw new AdventureDeckLegalityError(
      `Saved deck "${deckId}" cannot launch a duel: ${validation.errors.join(" ")}`,
      validation,
    );
  }

  const cards = Object.freeze(Object.entries(validation.cards).map(([cardId, quantity]) => (
    Object.freeze({ cardId, quantity })
  )));
  return Object.freeze({
    id: deckId,
    name: deck.name,
    cards,
    fingerprint: fingerprintDeckCards(validation.cards),
  });
}

/** Creates a duel snapshot from the currently active saved deck. */
export function createActiveDuelDeckSnapshot(saveValue, cardCatalog, rules = {}) {
  const save = normalizeAdventureSave(saveValue);
  if (save.player.activeDeckId === null) {
    throw new AdventureDeckOperationError("No active saved deck is selected.");
  }
  return createDuelDeckSnapshot(save, save.player.activeDeckId, cardCatalog, rules);
}

/** Stable result/log identity without adding fields to the simulator snapshot contract. */
export function getDuelDeckSnapshotIdentity(snapshotValue) {
  const snapshot = requireRecord(snapshotValue, "snapshot");
  const deckId = normalizeAdventureDeckId(snapshot.id, "snapshot.id");
  if (typeof snapshot.fingerprint !== "string" || !FINGERPRINT_PATTERN.test(snapshot.fingerprint)) {
    fail("snapshot.fingerprint", "must use the deck-v1 64-bit hexadecimal format.");
  }
  return `${deckId}@${snapshot.fingerprint}`;
}
