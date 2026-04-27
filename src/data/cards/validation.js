export function validateCards(cards) {
  const ids = new Set();

  for (const card of cards) {
    if (!card.id) throw new Error("Card missing id");
    if (ids.has(card.id)) throw new Error(`Duplicate card id: ${card.id}`);
    ids.add(card.id);

    if (!card.name) throw new Error(`${card.id} missing name`);
    if (!card.kind) throw new Error(`${card.id} missing kind`);
    if (!card.category) throw new Error(`${card.id} missing category`);
    if (!card.image) throw new Error(`${card.id} missing image`);

    if (card.kind !== "support" && card.cost == null) {
      throw new Error(`${card.id} missing cost`);
    }

    if (card.kind === "coral" && typeof card.health !== "number") {
      throw new Error(`${card.id} coral missing health`);
    }
  }

  return true;
}