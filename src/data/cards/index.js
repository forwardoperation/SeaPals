import { apexCards } from "./creatures/apex";
import { fishCards } from "./creatures/fish";
import { predatorCards } from "./creatures/predators";
import { invertebrateCards } from "./creatures/invertebrates";
import { deepCreatureCards } from "./creatures/deep";
import {
  oceanicBaitballCards,
  oceanicCreatureCards,
} from "./creatures/oceanic";
import { coralCards } from "./coral";
import { deepCoralCards } from "./deepCoral";
import { supportCards } from "./support";
import { environmentCards } from "./environments";
import { conditionCards } from "./conditions";
import { validateCards } from "./validation";
import { CardCategory, CardKind, CreatureClass, CreatureZone } from "./types";

const creatureClassByCategory = {
  [CardCategory.APEX]: CreatureClass.APEX,
  [CardCategory.FISH]: CreatureClass.FISH,
  [CardCategory.FILTER_FEEDER]: CreatureClass.FILTER_FEEDER,
  [CardCategory.INVERTEBRATE]: CreatureClass.INVERTEBRATE,
  [CardCategory.PREDATOR]: CreatureClass.PREDATOR,
};

function normalizeCreatureCard(card) {
  if (card.kind !== CardKind.CREATURE) return card;

  return {
    ...card,
    zone: card.zone ?? CreatureZone.REEF,
    class: card.class ?? creatureClassByCategory[card.category],
  };
}

export const allCards = [
  ...coralCards,
  ...fishCards,
  ...deepCoralCards,
  ...apexCards,
  ...predatorCards,
  ...invertebrateCards,
  ...oceanicBaitballCards,
  ...oceanicCreatureCards,
  ...deepCreatureCards,
  ...environmentCards,
  ...supportCards,
  ...conditionCards,
]
  .map(normalizeCreatureCard)
  .sort((a, b) => a.sortOrder - b.sortOrder);

validateCards(allCards);

export const cardsById = Object.fromEntries(
  allCards.map((card) => [card.id, card])
);

export function getCardById(id) {
  return cardsById[id] ?? null;
}

export function getCardsByCategory(category) {
  return allCards.filter((card) => card.category === category);
}

export function getCardsByKind(kind) {
  return allCards.filter((card) => card.kind === kind);
}
