import { CardKind } from "@/data/cards/types";

export const defaultDeckRules = {
  deckSize: 40,
  maxCopiesPerCard: 3,
  minCoralCards: 1,
  requireBaseCoral: true,
};

export function getTournamentDeckRules(tournament) {
  return {
    ...defaultDeckRules,
    deckSize: tournament?.deckSize ?? defaultDeckRules.deckSize,
    maxCopiesPerCard:
      tournament?.maxCopiesPerCard ?? defaultDeckRules.maxCopiesPerCard,
    bannedCardIds: tournament?.bannedCardIds ?? [],
    restrictedCardIds: tournament?.restrictedCardIds ?? [],
  };
}

export function isBaseCoral(card) {
  return card?.kind === CardKind.CORAL && card.stage === 0;
}