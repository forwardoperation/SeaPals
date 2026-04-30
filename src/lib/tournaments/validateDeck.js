import { CardKind } from "@/data/cards/types";
import { cardsById } from "@/data/cards";
import { getDeckStats } from "./deckStats";
import { getTournamentDeckRules, isBaseCoral } from "./deckRules";

export function validateDeck(deck, tournament) {
  const rules = getTournamentDeckRules(tournament);
  const errors = [];
  const warnings = [];

  if (!deck) {
    return {
      isValid: false,
      errors: ["Deck is missing."],
      warnings,
    };
  }

  if (!deck.name && !deck.deckName) {
    errors.push("Deck name is required.");
  }

  if (!deck.playerName) {
    errors.push("Player name is required.");
  }

  if (!Array.isArray(deck.cards)) {
    errors.push("Deck cards must be an array.");
    return { isValid: false, errors, warnings };
  }

  let totalCards = 0;
  let coralCount = 0;
  let hasBaseCoral = false;

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

    if (card.kind === CardKind.CORAL) {
      coralCount += quantity;
    }

    if (isBaseCoral(card)) {
      hasBaseCoral = true;
    }
  }

  if (totalCards !== rules.deckSize) {
    errors.push(`Deck must contain exactly ${rules.deckSize} cards.`);
  }

  if (coralCount < rules.minCoralCards) {
    errors.push(`Deck must contain at least ${rules.minCoralCards} coral card.`);
  }

  if (rules.requireBaseCoral && !hasBaseCoral) {
    errors.push("Deck must contain at least one base coral.");
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
