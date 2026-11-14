export const COLLECTION_KEY = "searealm.collection.v1";
export const CARDS_PER_PACK = 3;

export function createCollection(starterCards = []) {
  return {
    version: 1,
    cards: Object.fromEntries(starterCards.map(({ cardId, quantity }) => [cardId, quantity])),
    packs: {},
  };
}

export function readCollection(raw, starterCards) {
  if (raw == null) return createCollection(starterCards);
  const value = JSON.parse(raw);
  if (!value || value.version !== 1 || !value.cards || !value.packs
      || typeof value.cards !== "object" || Array.isArray(value.cards)
      || typeof value.packs !== "object" || Array.isArray(value.packs)
      || Object.values(value.cards).some((n) => !Number.isSafeInteger(n) || n < 0)
      || Object.values(value.packs).some((pack) => !pack || typeof pack.label !== "string"
        || (pack.cardIds !== null && (!Array.isArray(pack.cardIds) || pack.cardIds.length !== CARDS_PER_PACK
          || pack.cardIds.some((id) => typeof id !== "string"))))) {
    throw new Error("Your collection could not be read. Your saved data has been kept.");
  }
  return value;
}

// Free, device-local rewards only. This save is deliberately NOT a purchase
// entitlement and must never be imported as paid ownership by a future server.
export function grantPack(collection, rewardId, label) {
  if (!rewardId || typeof rewardId !== "string" || Object.hasOwn(collection.packs, rewardId)) return collection;
  return { ...collection, packs: { ...collection.packs, [rewardId]: { label, cardIds: null } } };
}

export function openPack(collection, rewardId, eligibleCardIds, random) {
  const pack = collection.packs[rewardId];
  if (!pack) throw new Error("This pack has not been earned yet.");
  if (pack.cardIds) return collection;
  const remaining = [...new Set(eligibleCardIds)];
  if (remaining.length < CARDS_PER_PACK) throw new Error("This pack does not have enough cards.");
  const choose = (pool) => {
    const roll = random();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error("The pack could not be opened. Please try again.");
    return pool[Math.floor(roll * pool.length)];
  };
  const cardIds = [];
  const unowned = remaining.filter((id) => !(collection.cards[id] > 0));
  if (unowned.length) cardIds.push(choose(unowned));
  while (cardIds.length < CARDS_PER_PACK) cardIds.push(choose(remaining.filter((id) => !cardIds.includes(id))));
  const cards = { ...collection.cards };
  for (const id of cardIds) {
    const count = (cards[id] ?? 0) + 1;
    if (!Number.isSafeInteger(count)) throw new Error("This collection is full.");
    cards[id] = count;
  }
  return { ...collection, cards, packs: { ...collection.packs, [rewardId]: { ...pack, cardIds } } };
}

export function deviceRandom() {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}
