import { createHash, randomInt, randomUUID } from "node:crypto";

export const BOOSTER_POLICY = Object.freeze({
  version: "searealm-booster-v1",
  commons: 5,
  uncommons: 3,
  premium: 1,
  holoBasisPoints: 2500,
  allowPrerelease: true,
  duplicatePolicy: "no-repeated-card-id-within-pack",
});

const SET_ALIASES = Object.freeze({
  reef: "reef",
  deep: "deep",
  oceanic: "ocean",
  ocean: "ocean",
});
const RARITIES = new Set(["Common", "Uncommon", "Rare", "Holo Rare"]);

export function contentHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function normalizeBoosterSet(value) {
  const set = SET_ALIASES[String(value).trim().toLowerCase()];
  if (!set) throw new Error(`Unknown booster set: ${value}`);
  return set;
}

export function printingId(set, number) {
  if (!Number.isSafeInteger(number) || number < 1)
    throw new Error("Invalid collector number.");
  return `${normalizeBoosterSet(set)}-${String(number).padStart(3, "0")}`;
}

// Set membership and rarity are explicit catalog data. Gameplay zone, public
// visibility, and prerelease stamps must never silently alter a pack's pool.
export function buildPrintingCatalog(setList, gallery = { cards: [] }) {
  const previews = new Map(gallery.cards.map((card) => [card.cardId, card]));
  const seenSets = new Set();
  const seenPrintings = new Set();
  const printings = [];
  for (const set of setList.sets ?? []) {
    const setId = normalizeBoosterSet(set.zone);
    if (seenSets.has(setId)) throw new Error(`Duplicate set: ${setId}`);
    seenSets.add(setId);
    const seenCards = new Set();
    for (const card of set.cards ?? []) {
      if (!card.cardId || seenCards.has(card.cardId))
        throw new Error(`Missing or duplicate card in ${setId}.`);
      seenCards.add(card.cardId);
      if (!card.printings?.length)
        throw new Error(`No printings for ${card.cardId}.`);
      for (const printing of card.printings) {
        const id = printingId(setId, printing.number);
        if (seenPrintings.has(id) || !RARITIES.has(printing.rarity)) {
          throw new Error(`Invalid or duplicate printing: ${id}`);
        }
        seenPrintings.add(id);
        const preview = previews.get(card.cardId);
        printings.push({
          printingId: id,
          set: setId,
          cardId: card.cardId,
          name: card.name,
          collectorNumber: printing.number,
          setTotal: set.totalPrintings,
          rarity: printing.rarity,
          prerelease: preview?.prerelease ?? null,
          requiresHoloSticker: printing.rarity === "Holo Rare",
        });
      }
    }
  }
  if (seenSets.size !== 3)
    throw new Error("All three set catalogs are required.");
  return printings.sort((a, b) => a.printingId.localeCompare(b.printingId));
}

function draw(pool, count, usedCards, randomIndex) {
  const available = pool.filter((card) => !usedCards.has(card.cardId));
  const result = [];
  for (let i = 0; i < count; i++) {
    if (!available.length)
      throw new Error("Insufficient distinct cards for the requested recipe.");
    const index = randomIndex(available.length);
    if (
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= available.length
    ) {
      throw new Error("Random source returned an invalid index.");
    }
    const selected = available[index];
    result.push({ ...selected });
    usedCards.add(selected.cardId);
    for (let j = available.length - 1; j >= 0; j--) {
      if (available[j].cardId === selected.cardId) available.splice(j, 1);
    }
  }
  return result;
}

export function validateBoosterPool(catalog, set, policy = BOOSTER_POLICY) {
  const setId = normalizeBoosterSet(set);
  if (
    !Number.isSafeInteger(policy.holoBasisPoints) ||
    policy.holoBasisPoints < 0 ||
    policy.holoBasisPoints > 10000
  ) {
    throw new Error(
      "Holo probability must be between 0 and 10000 basis points.",
    );
  }
  if (policy.commons !== 5 || policy.uncommons !== 3 || policy.premium !== 1)
    throw new Error(
      "A booster must contain 5 commons, 3 uncommons, and 1 premium.",
    );
  if (policy.allowPrerelease !== true)
    throw new Error("The approved policy includes prerelease cards.");
  const pool = catalog.filter((card) => card.set === setId);
  const premium = pool.filter(
    (card) =>
      (card.rarity === "Rare" && policy.holoBasisPoints < 10000) ||
      (card.rarity === "Holo Rare" && policy.holoBasisPoints > 0),
  );
  for (const rarity of ["Rare", "Holo Rare"]) {
    const required =
      rarity === "Rare"
        ? policy.holoBasisPoints < 10000
        : policy.holoBasisPoints > 0;
    if (required && !premium.some((card) => card.rarity === rarity))
      throw new Error(`${setId} has no ${rarity} pool.`);
  }
  // Validate every possible premium outcome before drawing anything. A missing
  // asset or exhausted pool must not bias the odds by causing a reroll.
  for (const card of premium) {
    for (const [rarity, count] of [
      ["Common", policy.commons],
      ["Uncommon", policy.uncommons],
    ]) {
      const ids = new Set(
        pool
          .filter(
            (candidate) =>
              candidate.rarity === rarity && candidate.cardId !== card.cardId,
          )
          .map((candidate) => candidate.cardId),
      );
      if (ids.size < count)
        throw new Error(
          `${setId} cannot fill ${rarity} slots after ${card.cardId}.`,
        );
    }
  }
  const commonIds = new Set(
    pool.filter((card) => card.rarity === "Common").map((card) => card.cardId),
  );
  if (
    pool.some(
      (card) => card.rarity === "Uncommon" && commonIds.has(card.cardId),
    )
  ) {
    throw new Error(
      "A card cannot occupy both common and uncommon pools in the same release.",
    );
  }
  return pool;
}

export function generateBooster({
  catalog,
  set,
  packId = randomUUID(),
  policy = BOOSTER_POLICY,
  randomIndex = randomInt,
}) {
  const pool = validateBoosterPool(catalog, set, policy);
  const roll = randomIndex(10000);
  if (!Number.isSafeInteger(roll) || roll < 0 || roll >= 10000)
    throw new Error("Invalid premium roll.");
  const rarity = roll < policy.holoBasisPoints ? "Holo Rare" : "Rare";
  const used = new Set();
  // Choose premium first, so a Deep uncommon with a holo printing cannot use
  // both slots. Keep the premium in a fixed sheet position for sticker work.
  const premium = draw(
    pool.filter((card) => card.rarity === rarity),
    1,
    used,
    randomIndex,
  );
  const uncommons = draw(
    pool.filter((card) => card.rarity === "Uncommon"),
    3,
    used,
    randomIndex,
  );
  const commons = draw(
    pool.filter((card) => card.rarity === "Common"),
    5,
    used,
    randomIndex,
  );
  return {
    packId,
    set: normalizeBoosterSet(set),
    policy: { ...policy },
    cards: [...commons, ...uncommons, ...premium].map((card, index) => ({
      ...card,
      slot: index + 1,
      row: Math.floor(index / 3) + 1,
      column: (index % 3) + 1,
    })),
  };
}
