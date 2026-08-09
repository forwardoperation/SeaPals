import {
  grantReward,
  normalizeAdventureSave,
  setQuestFlag,
} from "./adventureProgression.mjs";
import { ELVERSON_TOWN_WEST_COVE } from "./adventureElversonTownLayout.mjs";

export const ELVERSON_FISHING_QUEST_ID = "quest-shellshore-first-voyage";
// These persisted identifiers shipped in the earlier prototype. Keep them so
// existing saves retain their equipment and reward ledger, while presenting
// the item and mechanic as Wyeth's hand net everywhere in the current game.
export const ELVERSON_FISHING_ROD_ITEM_ID = "wyeths-fishing-rod";
export const ELVERSON_FISHING_ROD_REWARD_ID = "reward-elverson-fishing-rod";
export const ELVERSON_HAND_NET_ITEM_ID = ELVERSON_FISHING_ROD_ITEM_ID;
export const ELVERSON_HAND_NET_REWARD_ID = ELVERSON_FISHING_ROD_REWARD_ID;

const ELVERSON_CARD_REWARD_FLAG_PREFIX = "aquarium-card-rewarded";

export const ELVERSON_FISHING_FLAGS = Object.freeze({
  // `lessonComplete` was written by the first fishing release as soon as the
  // rod was granted. Keep the identifier for save compatibility, but never use
  // it to decide whether the player completed the hands-on tutorial.
  lessonComplete: "fishing-lesson-complete",
  tutorialStarted: "fishing-tutorial-started",
  tutorialComplete: "fishing-tutorial-complete",
  totalCaught: "fishing-total-caught",
  totalDelivered: "fishing-total-delivered",
  collectionComplete: "fishing-collection-complete",
});
export const ELVERSON_HAND_NET_FLAGS = ELVERSON_FISHING_FLAGS;

export const ELVERSON_HAND_NET = Object.freeze({
  id: ELVERSON_HAND_NET_ITEM_ID,
  name: "Wyeth's Hand Net",
  description: "A soft, shallow-water hand net from Fisherman Wyeth for small reef fish and invertebrates under twelve inches long.",
  discardable: false,
});
export const ELVERSON_FISHING_ROD = ELVERSON_HAND_NET;

const RARITY_PROFILES = Object.freeze({
  common: Object.freeze({ label: "Common", requiredReels: 2, catchZoneWidth: 34 }),
  uncommon: Object.freeze({ label: "Uncommon", requiredReels: 2, catchZoneWidth: 29 }),
  rare: Object.freeze({ label: "Rare", requiredReels: 3, catchZoneWidth: 24 }),
  legendary: Object.freeze({ label: "Legendary", requiredReels: 3, catchZoneWidth: 20 }),
});

function fishingCreature(definition) {
  const rarity = RARITY_PROFILES[definition.rarity];
  if (!rarity) throw new RangeError(`Unknown fishing rarity: ${definition.rarity}.`);
  return Object.freeze({
    ...definition,
    rarityLabel: rarity.label,
    requiredReels: rarity.requiredReels,
    catchZoneWidth: rarity.catchZoneWidth,
    inventoryItemId: `caught-${definition.id}`,
    aquariumItemId: `aquarium-${definition.id}`,
  });
}

/** The ten reef creatures currently found around Elverson, ordered by catch roll. */
export const ELVERSON_REEF_CATCHES = Object.freeze([
  fishingCreature({
    id: "white-grunt",
    cardId: "white-grunt",
    category: "fish",
    rarity: "common",
    weight: 18,
    note: "White grunts shelter in schools and make low sounds with their teeth.",
  }),
  fishingCreature({
    id: "cleaner-wrasse",
    cardId: "cleaner-wrasse",
    category: "fish",
    rarity: "common",
    weight: 16,
    note: "Cleaner wrasses run reef stations where other fish stop for parasite removal.",
  }),
  fishingCreature({
    id: "clownfish",
    cardId: "clownfish",
    category: "fish",
    rarity: "common",
    weight: 14,
    note: "Clownfish live among anemone tentacles behind a protective mucus coat.",
  }),
  fishingCreature({
    id: "emerald-crab",
    cardId: "emerald-crab",
    category: "invertebrate",
    rarity: "common",
    weight: 12,
    note: "Emerald crabs pick algae and leftovers from reef crevices after dark.",
  }),
  fishingCreature({
    id: "blue-tang",
    cardId: "blue-tang",
    category: "fish",
    rarity: "uncommon",
    weight: 10,
    note: "Blue tangs graze algae and can tuck their flat bodies into narrow shelter.",
  }),
  fishingCreature({
    id: "sea-urchin",
    cardId: "sea-urchin",
    category: "invertebrate",
    rarity: "uncommon",
    weight: 8,
    note: "Sea urchins use tube feet and spines while grazing along the reef.",
  }),
  fishingCreature({
    id: "fairy-parrotfish",
    cardId: "fairy-parrotfish",
    category: "fish",
    rarity: "uncommon",
    weight: 8,
    note: "Fairy parrotfish scrape algae with beak-like teeth and help make reef sand.",
  }),
  fishingCreature({
    id: "blue-crab",
    cardId: "blue-crab",
    category: "invertebrate",
    rarity: "rare",
    weight: 6,
    note: "Blue crabs swim with paddle-shaped back legs and recycle reef leftovers.",
  }),
  fishingCreature({
    id: "spanish-hogfish",
    cardId: "spanish-hogfish",
    category: "fish",
    rarity: "rare",
    weight: 5,
    note: "Spanish hogfish use their long snouts to search the reef for small prey.",
  }),
  fishingCreature({
    id: "french-angelfish",
    cardId: "french-angelfish",
    category: "fish",
    rarity: "legendary",
    weight: 3,
    note: "French angelfish often cruise the reef in bonded pairs.",
  }),
]);

export const ELVERSON_REEF_CATCHES_BY_ID = Object.freeze(Object.fromEntries(
  ELVERSON_REEF_CATCHES.map((creature) => [creature.id, creature]),
));

const TOTAL_CATCH_WEIGHT = ELVERSON_REEF_CATCHES.reduce(
  (total, creature) => total + creature.weight,
  0,
);

if (TOTAL_CATCH_WEIGHT !== 100) {
  throw new Error(`Elverson fishing weights must total 100; received ${TOTAL_CATCH_WEIGHT}.`);
}

/** Maps a deterministic roll in [0, 1) to the weighted Elverson catch table. */
export function rollElversonReefCatch(randomValue) {
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new RangeError("Fishing randomValue must be a finite number from 0 (inclusive) to 1 (exclusive).");
  }
  const roll = randomValue * TOTAL_CATCH_WEIGHT;
  let cursor = 0;
  for (const creature of ELVERSON_REEF_CATCHES) {
    cursor += creature.weight;
    if (roll < cursor) return creature;
  }
  return ELVERSON_REEF_CATCHES.at(-1);
}

const EDGE_EPSILON = 1e-9;

function pointInsideBounds(position, rectangle) {
  return position.x >= rectangle.left - EDGE_EPSILON
    && position.x <= rectangle.right + EDGE_EPSILON
    && position.y >= rectangle.top - EDGE_EPSILON
    && position.y <= rectangle.bottom + EDGE_EPSILON;
}

/**
 * Returns a virtual interaction only while the player's feet are in the
 * authored west-cove shallows. Facing never substitutes for actually wading.
 */
export function getElversonHandNetInteraction(sceneId, position, _facing) {
  if (sceneId !== "town" || !position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return null;
  }
  if (!pointInsideBounds(position, ELVERSON_TOWN_WEST_COVE.shallows)) return null;

  return Object.freeze({
    type: "fishing",
    interactionId: "interaction-elverson-hand-net-west-cove-shallows",
    spotId: "west-cove-shallows",
    at: Object.freeze({ x: position.x, y: position.y }),
    label: "Your feet are in the shallows. Press Enter to ready the hand net.",
  });
}

export const getElversonFishingInteraction = getElversonHandNetInteraction;

function fishingRodReward() {
  return {
    grantId: ELVERSON_FISHING_ROD_REWARD_ID,
    cards: {},
    packs: {},
    storyItems: {},
    boatItems: { [ELVERSON_FISHING_ROD_ITEM_ID]: 1 },
    tideMarkIds: [],
    routeIds: [],
    fieldNoteIds: [],
  };
}

export function hasElversonFishingRod(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  return (save.inventory.boatItems[ELVERSON_FISHING_ROD_ITEM_ID] ?? 0) > 0;
}

export const hasElversonHandNet = hasElversonFishingRod;

/** Grants/reconciles Wyeth's permanent hand net and records that the tutorial began. */
export function beginElversonFishingTutorial(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const quest = save.progression.quests[ELVERSON_FISHING_QUEST_ID];
  // New profiles carry an explicit false marker until Easterling's opening.
  // Legacy profiles predate that marker and onboarding already treats them as
  // introduced, so only an explicit false value should block Wyeth's lesson.
  if (quest?.flags?.["world-introduction-complete"] === false) {
    throw new RangeError("Mr. Easterling must introduce the aquarium project before Wyeth begins the hand-net lesson.");
  }
  const existingRodCount = save.inventory.boatItems[ELVERSON_FISHING_ROD_ITEM_ID] ?? 0;
  const rewardRecorded = save.rewardLedger.includes(ELVERSON_FISHING_ROD_REWARD_ID);
  let reconciled;
  let rodGranted = false;
  if (existingRodCount === 0 && !rewardRecorded) {
    const granted = grantReward(save, fishingRodReward());
    reconciled = granted.save;
    rodGranted = granted.applied;
  } else {
    reconciled = {
      ...save,
      inventory: {
        ...save.inventory,
        boatItems: {
          ...save.inventory.boatItems,
          [ELVERSON_FISHING_ROD_ITEM_ID]: 1,
        },
      },
      rewardLedger: rewardRecorded
        ? save.rewardLedger
        : [...save.rewardLedger, ELVERSON_FISHING_ROD_REWARD_ID],
    };
    rodGranted = existingRodCount === 0;
  }
  const tutorialWasStarted = reconciled.progression.quests[ELVERSON_FISHING_QUEST_ID]
    ?.flags?.[ELVERSON_FISHING_FLAGS.tutorialStarted] === true;
  const tutorialSave = tutorialWasStarted
    ? reconciled
    : setQuestFlag(
        reconciled,
        ELVERSON_FISHING_QUEST_ID,
        ELVERSON_FISHING_FLAGS.tutorialStarted,
        true,
      );
  return {
    save: tutorialSave,
    applied: existingRodCount !== 1 || !rewardRecorded || !tutorialWasStarted,
    handNetGranted: rodGranted,
    rodGranted,
  };
}

/**
 * Compatibility alias for callers from the first fishing release. Despite the
 * historical name, this now begins the lesson; only a successful tutorial
 * catch can complete it.
 */
export function completeElversonFishingLesson(saveValue) {
  return beginElversonFishingTutorial(saveValue);
}

export const beginElversonHandNetTutorial = beginElversonFishingTutorial;
export const completeElversonHandNetLesson = completeElversonFishingLesson;

function quantityFor(items, itemId) {
  return Number.isSafeInteger(items[itemId]) ? items[itemId] : 0;
}

function matchingCardRewardFlagId(creatureId) {
  return `${ELVERSON_CARD_REWARD_FLAG_PREFIX}-${creatureId}`;
}

function matchingCardRewardState(flags, creature, aquariumQuantity) {
  const flagId = matchingCardRewardFlagId(creature.id);
  const value = flags[flagId];
  if (value === undefined) {
    return { flagId, quantity: 0, valid: true, stored: false, value };
  }
  if (!Number.isSafeInteger(value) || value < 0 || value > aquariumQuantity) {
    // Quest flags deliberately accept generic JSON scalars. Rendering must not
    // crash when one reward counter is malformed, and save recovery must avoid
    // duplicating cards whose prior grant can no longer be proven. Treat the
    // delivered aquarium quantity as already settled, then persist that safe
    // bound during reconciliation.
    return {
      flagId,
      quantity: aquariumQuantity,
      valid: false,
      stored: true,
      value,
    };
  }
  return { flagId, quantity: value, valid: true, stored: true, value };
}

export function getElversonFishingProgress(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const flags = save.progression.quests[ELVERSON_FISHING_QUEST_ID]?.flags ?? {};
  const creatures = ELVERSON_REEF_CATCHES.map((creature) => {
    const held = quantityFor(save.inventory.storyItems, creature.inventoryItemId);
    const aquarium = quantityFor(save.inventory.storyItems, creature.aquariumItemId);
    const matchingCardsAwarded = matchingCardRewardState(flags, creature, aquarium).quantity;
    return Object.freeze({
      ...creature,
      held,
      aquarium,
      matchingCardsAwarded,
      matchingCardsPending: Math.max(0, aquarium - matchingCardsAwarded),
      discovered: held + aquarium > 0,
    });
  });
  const heldCount = creatures.reduce((total, creature) => total + creature.held, 0);
  const aquariumCount = creatures.reduce((total, creature) => total + creature.aquarium, 0);
  const discoveredCount = creatures.filter((creature) => creature.discovered).length;
  const aquariumSpeciesCount = creatures.filter((creature) => creature.aquarium > 0).length;
  const hasRod = (save.inventory.boatItems[ELVERSON_FISHING_ROD_ITEM_ID] ?? 0) > 0;
  const tutorialStarted = flags[ELVERSON_FISHING_FLAGS.tutorialStarted] === true;
  // Do not infer this from the legacy lesson flag or catch counters. The first
  // release allowed both to be written without finishing the guided lesson.
  const tutorialComplete = flags[ELVERSON_FISHING_FLAGS.tutorialComplete] === true;
  const matchingCardsAwarded = creatures.reduce(
    (total, creature) => total + creature.matchingCardsAwarded,
    0,
  );
  const matchingCardsPending = creatures.reduce(
    (total, creature) => total + creature.matchingCardsPending,
    0,
  );
  return Object.freeze({
    hasHandNet: hasRod,
    hasRod,
    tutorialStarted,
    tutorialComplete,
    tutorialPending: hasRod && !tutorialComplete,
    canFish: hasRod && tutorialComplete,
    canCatchWithHandNet: hasRod && tutorialComplete,
    // Transitional read alias for UI callers; unlike the legacy raw flag, this
    // represents genuine hands-on completion.
    lessonComplete: tutorialComplete,
    heldCount,
    aquariumCount,
    discoveredCount,
    aquariumSpeciesCount,
    collectionComplete: aquariumSpeciesCount === ELVERSON_REEF_CATCHES.length,
    matchingCardsAwarded,
    matchingCardsPending,
    creatures: Object.freeze(creatures),
  });
}

export const getElversonHandNetProgress = getElversonFishingProgress;

/**
 * Resolves Wyeth's conversation independently from starter-deck onboarding.
 * Easterling's introduction is the only story prerequisite; choosing or even
 * previewing a starter deck must never swallow the hands-on fishing lesson.
 */
export function getElversonFishingConversationMode(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const flags = save.progression.quests[ELVERSON_FISHING_QUEST_ID]?.flags ?? {};
  if (flags["world-introduction-complete"] === false) return "guidance";

  const progress = getElversonFishingProgress(save);
  if (progress.canFish) return "fishingGuidance";
  if (progress.hasRod || progress.tutorialStarted) return "fishingPractice";
  return "fishingLesson";
}

export const getElversonHandNetConversationMode = getElversonFishingConversationMode;

function addElversonFishingCatch(save, creatureId) {
  const progress = getElversonFishingProgress(save);
  const creature = ELVERSON_REEF_CATCHES_BY_ID[creatureId];
  if (!creature) throw new RangeError(`Unknown Elverson fishing creature: ${String(creatureId)}.`);

  const previousQuantity = quantityFor(save.inventory.storyItems, creature.inventoryItemId);
  const caught = {
    ...save,
    inventory: {
      ...save.inventory,
      storyItems: {
        ...save.inventory.storyItems,
        [creature.inventoryItemId]: previousQuantity + 1,
      },
    },
  };
  const rawPreviousTotal = save.progression.quests[ELVERSON_FISHING_QUEST_ID]
    ?.flags?.[ELVERSON_FISHING_FLAGS.totalCaught];
  if (rawPreviousTotal !== undefined && (!Number.isSafeInteger(rawPreviousTotal) || rawPreviousTotal < 0)) {
    throw new RangeError("The saved fishing catch total must be a non-negative safe integer.");
  }
  const previousTotal = rawPreviousTotal ?? 0;
  if (!Number.isSafeInteger(previousTotal + 1)) {
    throw new RangeError("The fishing catch total would exceed the largest safe inventory count.");
  }
  const next = setQuestFlag(
    caught,
    ELVERSON_FISHING_QUEST_ID,
    ELVERSON_FISHING_FLAGS.totalCaught,
    previousTotal + 1,
  );
  return {
    save: next,
    creature,
    firstDiscovery: !progress.creatures.find((entry) => entry.id === creature.id)?.discovered,
    quantity: previousQuantity + 1,
    progress: getElversonFishingProgress(next),
  };
}

/**
 * Records the lesson's first successful catch and unlocks normal fishing in
 * one immutable save mutation. Repeated completion calls are safe no-ops.
 */
export function recordElversonFishingTutorialCatch(saveValue, creatureId) {
  const save = normalizeAdventureSave(saveValue);
  const creature = ELVERSON_REEF_CATCHES_BY_ID[creatureId];
  if (!creature) throw new RangeError(`Unknown Elverson fishing creature: ${String(creatureId)}.`);
  const progress = getElversonFishingProgress(save);
  if (!progress.hasRod) {
    throw new RangeError("Receive Fisherman Wyeth's hand net before completing the hand-net tutorial.");
  }
  if (!progress.tutorialStarted) {
    throw new RangeError("Begin Fisherman Wyeth's hands-on hand-net tutorial before recording its catch.");
  }
  if (progress.tutorialComplete) {
    return {
      save,
      applied: false,
      tutorialCompletedNow: false,
      creature,
      firstDiscovery: false,
      quantity: progress.creatures.find((entry) => entry.id === creature.id)?.held ?? 0,
      progress,
    };
  }

  const caught = addElversonFishingCatch(save, creatureId);
  let next = setQuestFlag(
    caught.save,
    ELVERSON_FISHING_QUEST_ID,
    ELVERSON_FISHING_FLAGS.tutorialComplete,
    true,
  );
  // Continue writing the historical flag for readers outside this module, but
  // never trust it when loading because older builds wrote it too early.
  next = setQuestFlag(
    next,
    ELVERSON_FISHING_QUEST_ID,
    ELVERSON_FISHING_FLAGS.lessonComplete,
    true,
  );
  return {
    ...caught,
    save: next,
    applied: true,
    tutorialCompletedNow: true,
    progress: getElversonFishingProgress(next),
  };
}

/** Adds one successfully landed creature after the guided tutorial is complete. */
export function recordElversonFishingCatch(saveValue, creatureId) {
  const save = normalizeAdventureSave(saveValue);
  const progress = getElversonFishingProgress(save);
  if (!progress.canFish) {
    throw new RangeError("Complete Fisherman Wyeth's hands-on tutorial and receive the hand net before recording a catch.");
  }
  return addElversonFishingCatch(save, creatureId);
}

export const recordElversonHandNetTutorialCatch = recordElversonFishingTutorialCatch;
export const recordElversonHandNetCatch = recordElversonFishingCatch;

/**
 * Grants every matching card owed for creatures already recorded in the
 * aquarium. Per-species counters make this safe for duplicate deliveries and
 * also repair saves created before aquarium card rewards existed.
 */
export function reconcileElversonAquariumRewards(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const quest = save.progression.quests[ELVERSON_FISHING_QUEST_ID]
    ?? { status: "notStarted", flags: {} };
  const nextCards = { ...save.inventory.cards };
  const nextFlags = { ...quest.flags };
  const awardedCards = [];
  const repairedRewardFlags = [];

  for (const creature of ELVERSON_REEF_CATCHES) {
    const aquariumQuantity = quantityFor(save.inventory.storyItems, creature.aquariumItemId);
    const rewardState = matchingCardRewardState(quest.flags, creature, aquariumQuantity);
    const rewardedQuantity = rewardState.quantity;
    if (!rewardState.valid) {
      nextFlags[rewardState.flagId] = aquariumQuantity;
      repairedRewardFlags.push(Object.freeze({
        creature,
        previousValue: rewardState.value,
        quantity: aquariumQuantity,
      }));
    }
    const quantity = aquariumQuantity - rewardedQuantity;
    if (quantity === 0) continue;

    const existingCards = quantityFor(nextCards, creature.cardId);
    if (!Number.isSafeInteger(existingCards + quantity)) {
      throw new RangeError(`The ${creature.cardId} matching-card reward would exceed the largest safe inventory count.`);
    }
    nextCards[creature.cardId] = existingCards + quantity;
    nextFlags[matchingCardRewardFlagId(creature.id)] = aquariumQuantity;
    awardedCards.push(Object.freeze({
      creature,
      cardId: creature.cardId,
      quantity,
    }));
  }

  const next = awardedCards.length > 0 || repairedRewardFlags.length > 0
    ? {
        ...save,
        progression: {
          ...save.progression,
          quests: {
            ...save.progression.quests,
            [ELVERSON_FISHING_QUEST_ID]: { ...quest, flags: nextFlags },
          },
        },
        inventory: { ...save.inventory, cards: nextCards },
      }
    : save;

  return {
    save: next,
    applied: awardedCards.length > 0 || repairedRewardFlags.length > 0,
    awardedCards: Object.freeze(awardedCards),
    awardedCardCount: awardedCards.reduce((total, reward) => total + reward.quantity, 0),
    repairedRewardFlags: Object.freeze(repairedRewardFlags),
    progress: getElversonFishingProgress(next),
  };
}

function mergeAwardedCardRewards(...rewardGroups) {
  const quantities = new Map();
  for (const rewards of rewardGroups) {
    for (const reward of rewards) {
      quantities.set(reward.cardId, (quantities.get(reward.cardId) ?? 0) + reward.quantity);
    }
  }
  return Object.freeze(ELVERSON_REEF_CATCHES
    .filter((creature) => quantities.has(creature.cardId))
    .map((creature) => Object.freeze({
      creature,
      cardId: creature.cardId,
      quantity: quantities.get(creature.cardId),
    })));
}

/** Moves every current catch from the player inventory into Easterling's aquarium record. */
export function deliverElversonFishingCatches(saveValue) {
  const normalized = normalizeAdventureSave(saveValue);
  // Settle or safely repair the pre-delivery ledger first. Otherwise an
  // overlarge legacy counter can become numerically valid after aquarium
  // inventory increases and silently swallow the newly earned card.
  const priorRewards = reconcileElversonAquariumRewards(normalized);
  const save = priorRewards.save;
  const progress = getElversonFishingProgress(save);
  if (progress.heldCount === 0) {
    return {
      save,
      applied: priorRewards.applied,
      deliveredCount: 0,
      deliveredSpecies: [],
      collectionCompletedNow: false,
      awardedCards: priorRewards.awardedCards,
      awardedCardCount: priorRewards.awardedCardCount,
      repairedRewardFlags: priorRewards.repairedRewardFlags,
      progress: priorRewards.progress,
    };
  }

  const storyItems = { ...save.inventory.storyItems };
  const deliveredSpecies = [];
  for (const creature of progress.creatures) {
    if (creature.held <= 0) continue;
    delete storyItems[creature.inventoryItemId];
    storyItems[creature.aquariumItemId] = quantityFor(storyItems, creature.aquariumItemId) + creature.held;
    deliveredSpecies.push(Object.freeze({ creature, quantity: creature.held }));
  }
  let next = {
    ...save,
    inventory: { ...save.inventory, storyItems },
  };
  const rawPreviousDelivered = save.progression.quests[ELVERSON_FISHING_QUEST_ID]
    ?.flags?.[ELVERSON_FISHING_FLAGS.totalDelivered];
  if (rawPreviousDelivered !== undefined && (!Number.isSafeInteger(rawPreviousDelivered) || rawPreviousDelivered < 0)) {
    throw new RangeError("The saved fishing delivery total must be a non-negative safe integer.");
  }
  const previousDelivered = rawPreviousDelivered ?? 0;
  if (!Number.isSafeInteger(previousDelivered + progress.heldCount)) {
    throw new RangeError("The fishing delivery total would exceed the largest safe inventory count.");
  }
  next = setQuestFlag(
    next,
    ELVERSON_FISHING_QUEST_ID,
    ELVERSON_FISHING_FLAGS.totalDelivered,
    previousDelivered + progress.heldCount,
  );
  const nextProgress = getElversonFishingProgress(next);
  const collectionCompletedNow = !progress.collectionComplete && nextProgress.collectionComplete;
  if (nextProgress.collectionComplete) {
    next = setQuestFlag(
      next,
      ELVERSON_FISHING_QUEST_ID,
      ELVERSON_FISHING_FLAGS.collectionComplete,
      true,
    );
  }
  const deliveryRewards = reconcileElversonAquariumRewards(next);
  next = deliveryRewards.save;
  const awardedCards = mergeAwardedCardRewards(
    priorRewards.awardedCards,
    deliveryRewards.awardedCards,
  );
  const repairedRewardFlags = Object.freeze([
    ...priorRewards.repairedRewardFlags,
    ...deliveryRewards.repairedRewardFlags,
  ]);
  return {
    save: next,
    applied: true,
    deliveredCount: progress.heldCount,
    deliveredSpecies: Object.freeze(deliveredSpecies),
    collectionCompletedNow,
    awardedCards,
    awardedCardCount: awardedCards.reduce((total, reward) => total + reward.quantity, 0),
    repairedRewardFlags,
    progress: getElversonFishingProgress(next),
  };
}

export const deliverElversonHandNetCatches = deliverElversonFishingCatches;

export function getElversonFishingItemDefinition(itemId) {
  if (itemId === ELVERSON_HAND_NET_ITEM_ID) return ELVERSON_HAND_NET;
  const creature = ELVERSON_REEF_CATCHES.find((entry) => (
    entry.inventoryItemId === itemId || entry.aquariumItemId === itemId
  ));
  if (!creature) return null;
  return Object.freeze({
    id: itemId,
    name: creature.id
      .split("-")
      .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
      .join(" "),
    creature,
    location: itemId === creature.aquariumItemId ? "aquarium" : "creel",
    discardable: false,
  });
}

export const getElversonHandNetItemDefinition = getElversonFishingItemDefinition;
