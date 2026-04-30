import { CardKind } from "@/data/cards/types";

export const defaultDeckRules = {
  deckSize: 40,
  maxCopiesPerCard: 3,
  minCoralCards: 1,
  minVictoryPoints: 30,
  requireBaseCoral: true,
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
    minVictoryPoints:
      tournament?.minVictoryPoints ??
      tournament?.min_victory_points ??
      defaultDeckRules.minVictoryPoints,
    bannedCardIds: tournament?.bannedCardIds ?? tournament?.banned_card_ids ?? [],
    restrictedCardIds:
      tournament?.restrictedCardIds ?? tournament?.restricted_card_ids ?? [],
  };
}

export function isBaseCoral(card) {
  return card?.kind === CardKind.CORAL && card.stage === 0;
}
