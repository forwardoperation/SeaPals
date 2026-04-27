import { apexCards } from "./creatures/apex";
import { fishCards } from "./creatures/fish";
import { predatorCards } from "./creatures/predators";
import { invertebrateCards } from "./creatures/invertebrates";
import { filterFeederCards } from "./creatures/filterFeeders";
import { coralCards } from "./coral";
import { supportCards } from "./support";
import { structureCards } from "./structures";
import { conditionCards } from "./conditions";
import { validateCards } from "./validation";

export const allCards = [
  ...coralCards,
  ...fishCards,
  ...apexCards,
  ...predatorCards,
  ...invertebrateCards,
  ...filterFeederCards,
  ...structureCards,
  ...supportCards,
  ...conditionCards,
].sort((a, b) => a.sortOrder - b.sortOrder);

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