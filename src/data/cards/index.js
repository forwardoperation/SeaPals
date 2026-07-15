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
import { habitatCards } from "./environments";
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

export const DESTROYED_TO_LOST_ZONE_RULE =
  "If destroyed, place this card in your Lost Zone.";

const lostZoneOnDestructionCategories = new Set([
  CardCategory.APEX,
  CardCategory.FILTER_FEEDER,
]);

function normalizeCreatureCard(card) {
  if (card.kind !== CardKind.CREATURE) return card;

  const goesToLostZoneWhenDestroyed = lostZoneOnDestructionCategories.has(
    card.category
  );
  const specialRules = card.specialRules ?? [];

  return {
    ...card,
    zone: card.zone ?? CreatureZone.REEF,
    class: card.class ?? creatureClassByCategory[card.category],
    destroyedDestination: goesToLostZoneWhenDestroyed ? "lost-zone" : "discard",
    specialRules:
      goesToLostZoneWhenDestroyed &&
      !specialRules.some((rule) =>
        /if destroyed,? place (?:this card|it) in (?:your|the) lost zone/i.test(
          typeof rule === "string" ? rule : rule?.text ?? ""
        )
      )
        ? [...specialRules, DESTROYED_TO_LOST_ZONE_RULE]
        : specialRules,
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
  ...habitatCards,
  ...supportCards,
  ...conditionCards,
]
  .filter((card) => !card.galleryHidden)
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
