import { cardsById } from "@/data/cards";

export function getDeckStats(deck) {
  const stats = {
    totalCards: 0,
    byKind: {},
    byCategory: {},
    byTag: {},
    averageRpCost: 0,
    totalVictoryPoints: 0,
  };

  let totalRp = 0;
  let rpCardCount = 0;

  for (const entry of deck.cards ?? []) {
    const card = cardsById[entry.cardId];
    const quantity = Number(entry.quantity);

    if (!card || !Number.isInteger(quantity)) continue;

    stats.totalCards += quantity;

    stats.byKind[card.kind] = (stats.byKind[card.kind] ?? 0) + quantity;
    stats.byCategory[card.category] =
      (stats.byCategory[card.category] ?? 0) + quantity;

    for (const tag of card.tags ?? []) {
      stats.byTag[tag] = (stats.byTag[tag] ?? 0) + quantity;
    }

    if (card.cost?.rp != null) {
      totalRp += card.cost.rp * quantity;
      rpCardCount += quantity;
    }

    if (card.victoryPoints != null) {
      stats.totalVictoryPoints += card.victoryPoints * quantity;
    }
  }

  stats.averageRpCost = rpCardCount ? totalRp / rpCardCount : 0;

  return stats;
}