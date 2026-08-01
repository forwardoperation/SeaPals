import { getPrebuiltDeckById } from "../../data/tournaments/prebuiltDecks.js";

export const DEFAULT_SIMULATOR_DECK_ID = "coral-garden";

export function getValidSimulatorDeck(value) {
  const deckId = typeof value === "string" ? value.trim() : "";
  return deckId ? getPrebuiltDeckById(deckId) : null;
}

export function resolveSimulatorDeckId(value) {
  return getValidSimulatorDeck(value)?.id ?? DEFAULT_SIMULATOR_DECK_ID;
}

export function createSimulatorDeckHref(value) {
  const deck = getValidSimulatorDeck(value);
  return deck ? `/simulator?deck=${encodeURIComponent(deck.id)}` : null;
}
