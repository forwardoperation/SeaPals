import { CardKind, CreatureSubtype } from "@/data/cards/types";

export const defaultDeckRules = {
  deckSize: 60,
  maxCopiesPerCard: 4,
  minFoundationCards: 1,
  minVictoryPoints: 30,
  requireBaseFoundation: true,
};

export function getDeckRules(rulesProfile) {
  return {
    ...defaultDeckRules,
    deckSize: rulesProfile?.deckSize ?? defaultDeckRules.deckSize,
    maxCopiesPerCard:
      rulesProfile?.maxCopiesPerCard ??
      defaultDeckRules.maxCopiesPerCard,
    minFoundationCards:
      rulesProfile?.minFoundationCards ??
      defaultDeckRules.minFoundationCards,
    minVictoryPoints:
      rulesProfile?.minVictoryPoints ??
      defaultDeckRules.minVictoryPoints,
    requireBaseFoundation:
      rulesProfile?.requireBaseFoundation ??
      defaultDeckRules.requireBaseFoundation,
    bannedCardIds: rulesProfile?.bannedCardIds ?? [],
    restrictedCardIds: rulesProfile?.restrictedCardIds ?? [],
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
