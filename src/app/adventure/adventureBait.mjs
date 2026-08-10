import { normalizeAdventureSave } from "./adventureProgression.mjs";

export const ELVERSON_BAIT_CREDIT_ITEM_ID = "elverson-reef-credit";
export const ELVERSON_BAIT_SHOP_WELCOME_REWARD_ID = "reward-elverson-bait-shop-welcome";
export const ELVERSON_BAIT_SHOP_WELCOME_CREDITS = 12;

const DELIVERY_CREDITS_BY_RARITY = Object.freeze({
  common: 2,
  uncommon: 3,
  rare: 5,
  legendary: 8,
});

function bait(definition) {
  return Object.freeze({
    durationMs: 9_000,
    attractionRadius: 16,
    hitboxMultiplier: 3,
    approachSpeedMultiplier: 0.72,
    ...definition,
    speciesIds: Object.freeze([...definition.speciesIds]),
  });
}

/** Habitat-safe bait sold by Henderson in Elverson. */
export const ELVERSON_BAITS = Object.freeze([
  bait({
    id: "bait-kelp-crumble",
    name: "Kelp Crumble",
    shortName: "Kelp",
    price: 3,
    color: "#73c96b",
    description: "A plant-based pouch for reef grazers. Blue tangs, parrotfish, and urchins are most likely to investigate.",
    targetLabel: "Grazers",
    speciesIds: ["blue-tang", "sea-urchin", "fairy-parrotfish", "emerald-crab"],
    hitboxMultiplier: 3.15,
  }),
  bait({
    id: "bait-plankton-puff",
    name: "Plankton Puff",
    shortName: "Plankton",
    price: 4,
    color: "#f3a6a1",
    description: "A tiny drifting cloud for small schooling reef fish such as grunts, wrasses, and clownfish.",
    targetLabel: "Small reef fish",
    speciesIds: ["white-grunt", "cleaner-wrasse", "clownfish"],
  }),
  bait({
    id: "bait-shellfish-mix",
    name: "Shellfish Mix",
    shortName: "Shellfish",
    price: 5,
    color: "#efb766",
    description: "A savory bottom-feeding blend for crabs and curious reef foragers.",
    targetLabel: "Crabs & foragers",
    speciesIds: ["white-grunt", "emerald-crab", "blue-crab", "spanish-hogfish", "french-angelfish"],
    durationMs: 10_500,
    hitboxMultiplier: 3.35,
    approachSpeedMultiplier: 0.66,
  }),
]);

export const ELVERSON_BAITS_BY_ID = Object.freeze(Object.fromEntries(
  ELVERSON_BAITS.map((entry) => [entry.id, entry]),
));

function quantityFor(items, itemId) {
  return Number.isSafeInteger(items[itemId]) ? items[itemId] : 0;
}

function requireSafeSum(left, right, label) {
  const sum = left + right;
  if (!Number.isSafeInteger(sum) || sum < 0) {
    throw new RangeError(`${label} would exceed the largest safe inventory count.`);
  }
  return sum;
}

function saveWithStoryItems(save, storyItems) {
  return {
    ...save,
    inventory: {
      ...save.inventory,
      storyItems,
    },
  };
}

export function getElversonBaitItemDefinition(itemId) {
  if (itemId === ELVERSON_BAIT_CREDIT_ITEM_ID) {
    return Object.freeze({
      id: itemId,
      name: "Reef Credit",
      description: "Aquarium fieldwork credit accepted at Elverson Bait & Tackle.",
      kind: "currency",
      discardable: false,
    });
  }
  const definition = ELVERSON_BAITS_BY_ID[itemId];
  return definition
    ? Object.freeze({ ...definition, kind: "bait", discardable: false })
    : null;
}

export function getElversonBaitShopState(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  return Object.freeze({
    creditBalance: quantityFor(save.inventory.storyItems, ELVERSON_BAIT_CREDIT_ITEM_ID),
    baits: Object.freeze(ELVERSON_BAITS.map((entry) => Object.freeze({
      ...entry,
      quantity: quantityFor(save.inventory.storyItems, entry.id),
    }))),
  });
}

/** Grants Henderson's one-time fieldwork-credit welcome purse. */
export function welcomeToElversonBaitShop(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  if (save.rewardLedger.includes(ELVERSON_BAIT_SHOP_WELCOME_REWARD_ID)) {
    return {
      save,
      applied: false,
      creditsGranted: 0,
      shop: getElversonBaitShopState(save),
    };
  }

  const storyItems = { ...save.inventory.storyItems };
  storyItems[ELVERSON_BAIT_CREDIT_ITEM_ID] = requireSafeSum(
    quantityFor(storyItems, ELVERSON_BAIT_CREDIT_ITEM_ID),
    ELVERSON_BAIT_SHOP_WELCOME_CREDITS,
    "Henderson's welcome credits",
  );
  const next = {
    ...saveWithStoryItems(save, storyItems),
    rewardLedger: [...save.rewardLedger, ELVERSON_BAIT_SHOP_WELCOME_REWARD_ID],
  };
  return {
    save: next,
    applied: true,
    creditsGranted: ELVERSON_BAIT_SHOP_WELCOME_CREDITS,
    shop: getElversonBaitShopState(next),
  };
}

/** Buys one bait pouch with Reef Credits. */
export function purchaseElversonBait(saveValue, baitId) {
  const save = normalizeAdventureSave(saveValue);
  const definition = ELVERSON_BAITS_BY_ID[baitId];
  if (!definition) throw new RangeError(`Unknown Elverson bait: ${String(baitId)}.`);

  const storyItems = { ...save.inventory.storyItems };
  const credits = quantityFor(storyItems, ELVERSON_BAIT_CREDIT_ITEM_ID);
  if (credits < definition.price) {
    throw new RangeError(`${definition.name} costs ${definition.price} Reef Credits; only ${credits} are available.`);
  }
  const nextCredits = credits - definition.price;
  if (nextCredits === 0) delete storyItems[ELVERSON_BAIT_CREDIT_ITEM_ID];
  else storyItems[ELVERSON_BAIT_CREDIT_ITEM_ID] = nextCredits;
  storyItems[definition.id] = requireSafeSum(
    quantityFor(storyItems, definition.id),
    1,
    `${definition.name} quantity`,
  );
  const next = saveWithStoryItems(save, storyItems);
  return {
    save: next,
    applied: true,
    bait: definition,
    remainingCredits: nextCredits,
    quantity: storyItems[definition.id],
    shop: getElversonBaitShopState(next),
  };
}

/** Removes one pouch immediately before the placement animation begins. */
export function consumeElversonBait(saveValue, baitId) {
  const save = normalizeAdventureSave(saveValue);
  const definition = ELVERSON_BAITS_BY_ID[baitId];
  if (!definition) throw new RangeError(`Unknown Elverson bait: ${String(baitId)}.`);
  const storyItems = { ...save.inventory.storyItems };
  const quantity = quantityFor(storyItems, definition.id);
  if (quantity <= 0) throw new RangeError(`There is no ${definition.name} left in the bait bag.`);
  const remaining = quantity - 1;
  if (remaining === 0) delete storyItems[definition.id];
  else storyItems[definition.id] = remaining;
  const next = saveWithStoryItems(save, storyItems);
  return {
    save: next,
    applied: true,
    bait: definition,
    remaining,
    shop: getElversonBaitShopState(next),
  };
}

export function getElversonDeliveryCreditValue(rarity) {
  const value = DELIVERY_CREDITS_BY_RARITY[rarity];
  if (!value) throw new RangeError(`Unknown Elverson catch rarity: ${String(rarity)}.`);
  return value;
}

/** Awards shop currency for catches transferred to the aquarium care team. */
export function grantElversonBaitDeliveryCredits(saveValue, deliveredSpecies) {
  const save = normalizeAdventureSave(saveValue);
  if (!Array.isArray(deliveredSpecies)) throw new TypeError("Delivered species must be an array.");
  let creditsGranted = 0;
  for (const delivery of deliveredSpecies) {
    if (!delivery || !Number.isSafeInteger(delivery.quantity) || delivery.quantity <= 0) {
      throw new TypeError("Each delivered species entry requires a positive safe quantity.");
    }
    creditsGranted = requireSafeSum(
      creditsGranted,
      getElversonDeliveryCreditValue(delivery.creature?.rarity) * delivery.quantity,
      "Delivery credit reward",
    );
  }
  if (creditsGranted === 0) return { save, applied: false, creditsGranted: 0 };

  const storyItems = { ...save.inventory.storyItems };
  storyItems[ELVERSON_BAIT_CREDIT_ITEM_ID] = requireSafeSum(
    quantityFor(storyItems, ELVERSON_BAIT_CREDIT_ITEM_ID),
    creditsGranted,
    "Reef Credit balance",
  );
  return {
    save: saveWithStoryItems(save, storyItems),
    applied: true,
    creditsGranted,
  };
}
