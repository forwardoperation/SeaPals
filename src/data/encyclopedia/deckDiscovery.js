import {
  storeLaunchProductIds,
  storeProductDefinitions,
} from "../store/products.js";
import { prebuiltDecks } from "../decks/prebuiltDecks.js";

function currentStoreProducts(products, launchProductIds) {
  const launchIds = new Set(launchProductIds);
  return products.filter((product) => launchIds.has(product.id));
}

function productHref(productId) {
  return `/store?product=${encodeURIComponent(productId)}`;
}

export function getCreatureDisplayGrammar(creature) {
  const isPlural = creature?.grammaticalNumber === "plural";
  return {
    demonstrative: isPlural ? "these" : "this",
    seaPalReference: isPlural ? "these SeaPals" : "this SeaPal",
  };
}

/**
 * Finds the current ready-to-play decks that contain any exact card ID owned by
 * an encyclopedia creature. Search aliases are deliberately not used here.
 */
export function getCreatureDeckDiscovery(
  creature,
  {
    decks = prebuiltDecks,
    products = storeProductDefinitions,
    launchProductIds = storeLaunchProductIds,
  } = {}
) {
  const creatureCardIds = new Set(
    Array.isArray(creature?.cardIds) ? creature.cardIds : []
  );
  const currentProducts = currentStoreProducts(products, launchProductIds);
  const productByDeckId = new Map();

  for (const product of currentProducts) {
    if (!product.deckId) continue;
    if (productByDeckId.has(product.deckId)) {
      throw new Error(
        `Multiple current store products reference deck ${product.deckId}.`
      );
    }
    productByDeckId.set(product.deckId, product);
  }

  const matchingDecks = [];

  for (const deck of decks) {
    const product = productByDeckId.get(deck.id);
    if (!product) continue;

    const matchedCards = [];
    let copies = 0;

    for (const deckCard of deck.cards ?? []) {
      if (!creatureCardIds.has(deckCard.cardId)) continue;

      const quantity = Number(deckCard.quantity);
      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new Error(
          `Deck ${deck.id} has an invalid quantity for ${deckCard.cardId}.`
        );
      }

      matchedCards.push({ cardId: deckCard.cardId, quantity });
      copies += quantity;
    }

    if (copies === 0) continue;

    matchingDecks.push({
      deckId: deck.id,
      deckName: deck.name,
      productId: product.id,
      productName: product.name,
      copies,
      matchedCards,
      simulatorHref: `/simulator?deck=${encodeURIComponent(deck.id)}`,
      storeHref: productHref(product.id),
      deckListHref: `/decks#${encodeURIComponent(deck.id)}`,
    });
  }

  const matchingDeckIds = new Set(
    matchingDecks.map((deckMatch) => deckMatch.deckId)
  );
  const bundles = currentProducts
    .filter(
      (product) =>
        Array.isArray(product.includedDeckIds) &&
        product.includedDeckIds.some((deckId) => matchingDeckIds.has(deckId))
    )
    .map((product) => ({
      productId: product.id,
      productName: product.name,
      matchingDeckIds: product.includedDeckIds.filter((deckId) =>
        matchingDeckIds.has(deckId)
      ),
      storeHref: productHref(product.id),
    }));

  return { decks: matchingDecks, bundles };
}
