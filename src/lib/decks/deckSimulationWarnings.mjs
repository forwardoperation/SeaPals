// Decks use arrays in the simulator and card-count records in Reefbound saves.
export function getDeckSimulationWarnings(deck, cardCatalog) {
  const entries = Array.isArray(deck?.cards)
    ? deck.cards
    : Object.entries(deck?.cards ?? {}).map(([cardId, quantity]) => ({ cardId, quantity }));

  return [...new Set(entries.filter(({ quantity }) => quantity > 0).map(({ cardId }) => cardId))]
    .flatMap((cardId) => {
      const card = cardCatalog[cardId];
      return (card?.simulationWarnings ?? []).map((warning) => `${card.name}: ${warning}`);
    });
}
