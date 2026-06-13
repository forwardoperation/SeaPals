import { CardKind, CreatureSubtype } from "@/data/cards/types";

export const defaultDeckRules = {
  deckSize: 60,
  maxCopiesPerCard: 4,
  minFoundationCards: 1,
  minVictoryPoints: 30,
  requireBaseFoundation: true,
};

export function getTournamentDeckRules(tournament) {
  return {
    ...defaultDeckRules,
    deckSize:
      tournament?.deckSize ??
      tournament?.deck_size ??
      defaultDeckRules.deckSize,
    maxCopiesPerCard:
      tournament?.maxCopiesPerCard ??
      tournament?.max_copies_per_card ??
      defaultDeckRules.maxCopiesPerCard,
    minFoundationCards:
      tournament?.minFoundationCards ??
      tournament?.min_foundation_cards ??
      tournament?.minCoralCards ??
      tournament?.min_coral_cards ??
      defaultDeckRules.minFoundationCards,
    minVictoryPoints:
      tournament?.minVictoryPoints ??
      tournament?.min_victory_points ??
      defaultDeckRules.minVictoryPoints,
    requireBaseFoundation:
      tournament?.requireBaseFoundation ??
      tournament?.require_base_foundation ??
      tournament?.requireBaseCoral ??
      tournament?.require_base_coral ??
      defaultDeckRules.requireBaseFoundation,
    bannedCardIds: tournament?.bannedCardIds ?? tournament?.banned_card_ids ?? [],
    restrictedCardIds:
      tournament?.restrictedCardIds ?? tournament?.restricted_card_ids ?? [],
  };
}

export function isBaseCoral(card) {
  return card?.kind === CardKind.CORAL && card.stage === 0;
}

export function isCreatureSchool(card) {
  return (
    card?.kind === CardKind.CREATURE &&
    card.subtype === CreatureSubtype.BAITBALL
  );
}

export function isFoundation(card) {
  return card?.kind === CardKind.CORAL || isCreatureSchool(card);
}

export function isBaseFoundation(card) {
  return isFoundation(card) && card.stage === 0;
}
