import { cardsById } from "@/data/cards";
import { getDeckStats } from "./deckStats";
import {
  getTournamentDeckRules,
  isBaseFoundation,
  isFoundation,
} from "./deckRules";

export function validateGameDeck(deck, rulesProfile) {
  const rules = getTournamentDeckRules(rulesProfile);
  const errors = [];
  const warnings = [];

  if (!deck) {
    return {
      isValid: false,
      errors: ["Deck is missing."],
      warnings,
    };
  }

  if (!Array.isArray(deck.cards)) {
    errors.push("Deck cards must be an array.");
    return { isValid: false, errors, warnings };
  }

  let totalCards = 0;
  let foundationCount = 0;
  let hasBaseFoundation = false;

  for (const entry of deck.cards) {
    const quantity = Number(entry.quantity);
    const card = cardsById[entry.cardId];

    if (!card) {
      errors.push(`Unknown card id: ${entry.cardId}`);
      continue;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      errors.push(`${entry.cardId} must have a positive whole quantity.`);
      continue;
    }

    totalCards += quantity;

    if (quantity > rules.maxCopiesPerCard) {
      errors.push(
        `${card.name} exceeds the max copy limit of ${rules.maxCopiesPerCard}.`
      );
    }

    if (rules.bannedCardIds.includes(entry.cardId)) {
      errors.push(`${card.name} is banned in this tournament.`);
    }

    if (rules.restrictedCardIds.includes(entry.cardId) && quantity > 1) {
      errors.push(`${card.name} is restricted to 1 copy.`);
    }

    if (isFoundation(card)) {
      foundationCount += quantity;
    }

    if (isBaseFoundation(card)) {
      hasBaseFoundation = true;
    }
  }

  if (totalCards !== rules.deckSize) {
    errors.push(`Deck must contain exactly ${rules.deckSize} cards.`);
  }

  if (foundationCount < rules.minFoundationCards) {
    errors.push(
      `Deck must contain at least ${rules.minFoundationCards} foundation card.`
    );
  }

  if (rules.requireBaseFoundation && !hasBaseFoundation) {
    errors.push("Deck must contain at least one base foundation.");
  }

  const stats = getDeckStats(deck);

  if (stats.totalVictoryPoints < rules.minVictoryPoints) {
    errors.push(
      `Deck must include at least ${rules.minVictoryPoints} total victory points. Current total: ${stats.totalVictoryPoints}.`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateDeck(deck, tournament) {
  const gameValidation = validateGameDeck(deck, tournament);
  if (!deck) return gameValidation;

  const submissionErrors = [];

  if (!deck.name && !deck.deckName) {
    submissionErrors.push("Deck name is required.");
  }

  if (!deck.playerName) {
    submissionErrors.push("Player name is required.");
  }

  const errors = [...submissionErrors, ...gameValidation.errors];

  return {
    ...gameValidation,
    isValid: errors.length === 0,
    errors,
  };
}
