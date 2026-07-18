import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import { normalizeAdventureSave } from "./adventureProgression.mjs";

export const ADVENTURE_PACK_GUARANTEE = "at-least-one-unowned-card-when-eligible";

export class AdventurePackOpeningError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AdventurePackOpeningError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new AdventurePackOpeningError(code, message);
}

function normalizePackId(value) {
  if (typeof value !== "string" || !value.trim()) {
    fail("invalid-pack-id", "packId must be a non-empty string.");
  }
  return value.trim();
}

function randomIndex(length, random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    fail("invalid-random-value", "random must return a finite number from 0 inclusive to 1 exclusive.");
  }
  return Math.floor(value * length);
}

function validatePlayablePool(pool) {
  if (pool.status !== "playable") {
    fail("pack-not-playable", `${pool.name ?? pool.id} is not available to open yet.`);
  }
  if (!Number.isSafeInteger(pool.version) || pool.version <= 0) {
    fail("invalid-pack-pool", `${pool.id} must declare a positive version.`);
  }
  if (!Number.isSafeInteger(pool.cardsPerPack) || pool.cardsPerPack <= 0) {
    fail("invalid-pack-pool", `${pool.id} must declare a positive cardsPerPack value.`);
  }
  if (pool.progressionGuarantee !== ADVENTURE_PACK_GUARANTEE) {
    fail("invalid-pack-pool", `${pool.id} does not declare the supported collection guarantee.`);
  }
  if (!Array.isArray(pool.cardIds)) {
    fail("invalid-pack-pool", `${pool.id} must declare a cardIds array.`);
  }

  const uniqueCardIds = new Set(pool.cardIds);
  if (
    uniqueCardIds.size !== pool.cardIds.length
    || pool.cardIds.some((cardId) => typeof cardId !== "string" || !cardId.trim())
  ) {
    fail("invalid-pack-pool", `${pool.id} must contain unique, non-empty card ids.`);
  }
  if (pool.cardIds.length < pool.cardsPerPack) {
    fail("invalid-pack-pool", `${pool.id} does not contain enough unique cards for one pack.`);
  }
}

/** Returns the canonical content definition for one pack pool. */
export function getAdventurePackPool(packId, content = ADVENTURE_CONTENT) {
  const normalizedPackId = normalizePackId(packId);
  const pool = Array.isArray(content?.packPools)
    ? content.packPools.find((candidate) => candidate?.id === normalizedPackId)
    : null;
  if (!pool) fail("pack-not-found", `Unknown adventure pack ${normalizedPackId}.`);
  return pool;
}

/**
 * Opens exactly one earned pack without mutating the supplied save.
 *
 * Pulls are sampled without replacement. When the player does not own every
 * card in the pool, the first pull is guaranteed to be one of those unowned
 * cards; the remaining pulls stay random across the rest of the pool.
 */
export function openAdventurePack(saveValue, packId, { random = Math.random } = {}) {
  if (typeof random !== "function") {
    fail("invalid-random", "random must be a function.");
  }

  const save = normalizeAdventureSave(saveValue);
  const pool = getAdventurePackPool(packId);
  validatePlayablePool(pool);

  const packCount = save.inventory.unopenedPacks[pool.id] ?? 0;
  if (packCount < 1) {
    fail("pack-unavailable", `No unopened ${pool.name ?? pool.id} is available.`);
  }

  const remainingCardIds = [...pool.cardIds];
  const drawnCardIds = [];
  const unownedCardIds = remainingCardIds.filter(
    (cardId) => (save.inventory.cards[cardId] ?? 0) === 0,
  );

  let guaranteedNewCardId = null;
  if (unownedCardIds.length > 0) {
    guaranteedNewCardId = unownedCardIds[randomIndex(unownedCardIds.length, random)];
    drawnCardIds.push(guaranteedNewCardId);
    remainingCardIds.splice(remainingCardIds.indexOf(guaranteedNewCardId), 1);
  }

  while (drawnCardIds.length < pool.cardsPerPack) {
    const index = randomIndex(remainingCardIds.length, random);
    drawnCardIds.push(remainingCardIds[index]);
    remainingCardIds.splice(index, 1);
  }

  const nextCards = { ...save.inventory.cards };
  for (const cardId of drawnCardIds) {
    const nextQuantity = (nextCards[cardId] ?? 0) + 1;
    if (!Number.isSafeInteger(nextQuantity)) {
      fail("card-quantity-overflow", `Opening ${pool.id} would overflow the owned quantity for ${cardId}.`);
    }
    nextCards[cardId] = nextQuantity;
  }

  const nextUnopenedPacks = { ...save.inventory.unopenedPacks };
  if (packCount === 1) delete nextUnopenedPacks[pool.id];
  else nextUnopenedPacks[pool.id] = packCount - 1;

  const nextSave = normalizeAdventureSave({
    ...save,
    inventory: {
      ...save.inventory,
      cards: nextCards,
      unopenedPacks: nextUnopenedPacks,
    },
  });

  return {
    save: nextSave,
    packId: pool.id,
    cards: drawnCardIds,
    guaranteedNewCardId,
    poolVersion: pool.version,
  };
}
