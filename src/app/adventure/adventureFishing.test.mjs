import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import {
  ELVERSON_FISHING_FLAGS,
  ELVERSON_FISHING_QUEST_ID,
  ELVERSON_FISHING_ROD,
  ELVERSON_FISHING_ROD_ITEM_ID,
  ELVERSON_FISHING_ROD_REWARD_ID,
  ELVERSON_REEF_CATCHES,
  beginElversonFishingTutorial,
  completeElversonFishingLesson,
  deliverElversonFishingCatches,
  getElversonFishingConversationMode,
  getElversonFishingInteraction,
  getElversonFishingItemDefinition,
  getElversonFishingProgress,
  hasElversonFishingRod,
  reconcileElversonAquariumRewards,
  recordElversonFishingCatch,
  recordElversonFishingTutorialCatch,
  rollElversonReefCatch,
} from "./adventureFishing.mjs";
import {
  createInitialAdventureSave,
  normalizeAdventureSave,
  setQuestFlag,
  validateAdventureSave,
} from "./adventureProgression.mjs";
import {
  getOnboardingProgress,
  recordWorldIntroduction,
} from "./adventureOnboarding.mjs";
import { createNewAdventureSession } from "./adventureSession.mjs";
import { createAdventureStorageAdapter } from "./adventureStorage.mjs";
import { canOccupyContinuousPosition } from "./adventureWorld.mjs";

const WORLD_INTRODUCTION_FLAG = "world-introduction-complete";
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const jiti = createJiti(import.meta.url, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});
const { cardsById } = jiti(path.join(projectRoot, "src/data/cards/index.js"));
const {
  encyclopediaCreatureBySlug,
  encyclopediaSlugByCardId,
} = jiti(path.join(projectRoot, "src/data/encyclopedia/index.js"));

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function jsonRoundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}

function introducedSave(profileId = "profile-1") {
  return setQuestFlag(
    createInitialAdventureSave(profileId),
    ELVERSON_FISHING_QUEST_ID,
    WORLD_INTRODUCTION_FLAG,
    true,
  );
}

function pendingIntroductionSave(profileId = "profile-1") {
  return setQuestFlag(
    createInitialAdventureSave(profileId),
    ELVERSON_FISHING_QUEST_ID,
    WORLD_INTRODUCTION_FLAG,
    false,
  );
}

function lessonSave(profileId = "profile-1") {
  const started = beginElversonFishingTutorial(introducedSave(profileId)).save;
  return setQuestFlag(
    started,
    ELVERSON_FISHING_QUEST_ID,
    ELVERSON_FISHING_FLAGS.tutorialComplete,
    true,
  );
}

test("Elverson exposes ten immutable weighted reef catches with deterministic rarity profiles", () => {
  assert.equal(ELVERSON_REEF_CATCHES.length, 10);
  assert.equal(Object.isFrozen(ELVERSON_REEF_CATCHES), true);
  assert.equal(
    new Set(ELVERSON_REEF_CATCHES.map(({ id }) => id)).size,
    ELVERSON_REEF_CATCHES.length,
  );
  assert.equal(
    ELVERSON_REEF_CATCHES.reduce((total, creature) => total + creature.weight, 0),
    100,
  );

  let cumulativeWeight = 0;
  for (let index = 0; index < ELVERSON_REEF_CATCHES.length; index += 1) {
    const creature = ELVERSON_REEF_CATCHES[index];
    assert.equal(Object.isFrozen(creature), true);
    assert.equal(creature.inventoryItemId, `caught-${creature.id}`);
    assert.equal(creature.aquariumItemId, `aquarium-${creature.id}`);
    assert.ok(["fish", "invertebrate"].includes(creature.category));
    assert.ok(["common", "uncommon", "rare", "legendary"].includes(creature.rarity));
    assert.ok(Number.isSafeInteger(creature.requiredReels) && creature.requiredReels > 0);
    assert.ok(Number.isSafeInteger(creature.catchZoneWidth) && creature.catchZoneWidth > 0);
    assert.equal(cardsById[creature.cardId]?.kind, "creature");
    assert.equal(cardsById[creature.cardId]?.category, creature.category);
    const encyclopediaSlug = encyclopediaSlugByCardId[creature.cardId];
    const encyclopediaCreature = encyclopediaCreatureBySlug[encyclopediaSlug];
    assert.ok(encyclopediaCreature, `${creature.cardId} must have an encyclopedia profile`);
    assert.ok(encyclopediaCreature.cardIds.includes(creature.cardId));
    assert.ok(encyclopediaCreature.name.length > 0);
    assert.ok(encyclopediaCreature.tagline.length > 0);
    assert.ok(encyclopediaCreature.intro.length > 0);
    assert.ok(encyclopediaCreature.funFacts.length > 0);

    const middleOfBand = (cumulativeWeight + (creature.weight / 2)) / 100;
    assert.equal(rollElversonReefCatch(middleOfBand), creature);
    cumulativeWeight += creature.weight;

    const nextCreature = ELVERSON_REEF_CATCHES[index + 1];
    if (nextCreature) {
      assert.equal(rollElversonReefCatch(cumulativeWeight / 100), nextCreature);
    }
  }

  for (const invalidRoll of [-0.01, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => rollElversonReefCatch(invalidRoll),
      /finite number from 0 .* to 1/i,
    );
  }
});

test("hand-net interactions appear only at an authored Elverson shallow-water edge", () => {
  const position = { x: 5, y: 17.1 };
  const interaction = getElversonFishingInteraction("town", position, "down");

  assert.equal(interaction?.type, "fishing");
  assert.equal(interaction?.spotId, "west-promenade");
  assert.match(interaction?.interactionId ?? "", /^interaction-elverson-hand-net-/);
  assert.match(interaction?.label ?? "", /Press Enter to ready the hand net/i);
  assert.equal(Object.isFrozen(interaction), true);
  assert.equal(Object.isFrozen(interaction.at), true);
  assert.deepEqual(position, { x: 5, y: 17.1 });

  assert.equal(getElversonFishingInteraction("academy-lab", position, "down"), null);
  assert.equal(getElversonFishingInteraction("town", position, "up"), null);
  assert.equal(getElversonFishingInteraction("town", { x: 5, y: 16.9 }, "down"), null);
  assert.equal(getElversonFishingInteraction("town", { x: 20.4, y: 17.1 }, "down"), null);
  assert.equal(getElversonFishingInteraction("town", { x: Number.NaN, y: 17.1 }, "down"), null);

  const practicePosition = { x: 14.55, y: 21.45 };
  for (const wyethPosition of [{ x: 18.05, y: 20.85 }, { x: 15.65, y: 21.65 }]) {
    assert.equal(canOccupyContinuousPosition(
      "town",
      practicePosition,
      0.22,
      {
        ignoreActorTiles: true,
        dynamicBlockers: [{
          id: "interaction-elverson-fisherman-wyeth",
          position: wyethPosition,
          radius: 0.18,
          collisionRadiusX: 0.28,
          collisionRadiusY: 0.24,
        }],
      },
    ), true);
  }
  assert.equal(
    getElversonFishingInteraction("town", practicePosition, "left")?.spotId,
    "fishing-platform-west",
  );
});

test("Wyeth grants one permanent rod and starts, but does not complete, the hands-on tutorial", () => {
  const initial = pendingIntroductionSave("profile-1");
  assert.throws(
    () => beginElversonFishingTutorial(initial),
    /introduce the aquarium project/i,
  );

  const introduced = introducedSave();
  const before = jsonRoundTrip(introduced);
  const completed = beginElversonFishingTutorial(introduced);

  assert.equal(completed.applied, true);
  assert.equal(completed.rodGranted, true);
  assert.equal(completed.save.inventory.boatItems[ELVERSON_FISHING_ROD_ITEM_ID], 1);
  assert.equal(
    completed.save.progression.quests[ELVERSON_FISHING_QUEST_ID]
      .flags[ELVERSON_FISHING_FLAGS.tutorialStarted],
    true,
  );
  assert.equal(
    completed.save.progression.quests[ELVERSON_FISHING_QUEST_ID]
      .flags[ELVERSON_FISHING_FLAGS.tutorialComplete],
    undefined,
  );
  assert.deepEqual(completed.save.rewardLedger, [ELVERSON_FISHING_ROD_REWARD_ID]);
  assert.equal(hasElversonFishingRod(completed.save), true);
  assert.deepEqual(
    {
      hasRod: getElversonFishingProgress(completed.save).hasRod,
      tutorialStarted: getElversonFishingProgress(completed.save).tutorialStarted,
      tutorialComplete: getElversonFishingProgress(completed.save).tutorialComplete,
      tutorialPending: getElversonFishingProgress(completed.save).tutorialPending,
      canFish: getElversonFishingProgress(completed.save).canFish,
    },
    {
      hasRod: true,
      tutorialStarted: true,
      tutorialComplete: false,
      tutorialPending: true,
      canFish: false,
    },
  );
  assert.deepEqual(introduced, before, "lesson completion must not mutate its input save");

  const repeated = beginElversonFishingTutorial(completed.save);
  assert.equal(repeated.applied, false);
  assert.equal(repeated.rodGranted, false);
  assert.deepEqual(repeated.save, completed.save);
  assert.equal(repeated.save.inventory.boatItems[ELVERSON_FISHING_ROD_ITEM_ID], 1);
  assert.equal(
    repeated.save.rewardLedger.filter((id) => id === ELVERSON_FISHING_ROD_REWARD_ID).length,
    1,
  );
  assert.equal(validateAdventureSave(repeated.save).valid, true);

  const compatibilityAlias = completeElversonFishingLesson(introduced);
  assert.deepEqual(compatibilityAlias.save, completed.save);
});

test("Wyeth teaches fishing after Easterling's introduction even when the player skips the starter decks", () => {
  const session = createNewAdventureSession("skip-starter-decks");
  assert.equal(getElversonFishingConversationMode(session), "guidance");

  const introduced = recordWorldIntroduction(session).save;
  const onboarding = getOnboardingProgress(introduced);

  assert.equal(onboarding.needsWorldIntroduction, false);
  assert.equal(onboarding.needsStarterSelection, true);
  assert.equal(introduced.player.starterDeckId, null);
  assert.equal(getElversonFishingConversationMode(introduced), "fishingLesson");

  const lesson = beginElversonFishingTutorial(introduced);
  const fishing = getElversonFishingProgress(lesson.save);

  assert.equal(lesson.applied, true);
  assert.equal(lesson.rodGranted, true);
  assert.equal(fishing.hasRod, true);
  assert.equal(fishing.tutorialStarted, true);
  assert.equal(fishing.tutorialComplete, false);
  assert.equal(fishing.canFish, false);
  assert.equal(getElversonFishingConversationMode(lesson.save), "fishingPractice");

  const caught = recordElversonFishingTutorialCatch(
    lesson.save,
    ELVERSON_REEF_CATCHES[0].id,
  );
  assert.equal(getElversonFishingConversationMode(caught.save), "fishingGuidance");
});

test("legacy introductions and partially missing rod rewards reconcile without duplication", () => {
  const legacy = createInitialAdventureSave("legacy-profile");
  const legacyLesson = completeElversonFishingLesson(legacy);
  assert.equal(legacyLesson.applied, true);
  assert.equal(legacyLesson.save.inventory.boatItems[ELVERSON_FISHING_ROD_ITEM_ID], 1);

  const missingRod = {
    ...legacyLesson.save,
    inventory: {
      ...legacyLesson.save.inventory,
      boatItems: { ...legacyLesson.save.inventory.boatItems },
    },
  };
  delete missingRod.inventory.boatItems[ELVERSON_FISHING_ROD_ITEM_ID];
  const restoredRod = completeElversonFishingLesson(missingRod);
  assert.equal(restoredRod.applied, true);
  assert.equal(restoredRod.rodGranted, true);
  assert.equal(restoredRod.save.inventory.boatItems[ELVERSON_FISHING_ROD_ITEM_ID], 1);
  assert.equal(
    restoredRod.save.rewardLedger.filter((id) => id === ELVERSON_FISHING_ROD_REWARD_ID).length,
    1,
  );

  const missingLedger = {
    ...restoredRod.save,
    rewardLedger: restoredRod.save.rewardLedger.filter((id) => id !== ELVERSON_FISHING_ROD_REWARD_ID),
  };
  const restoredLedger = completeElversonFishingLesson(missingLedger);
  assert.equal(restoredLedger.applied, true);
  assert.equal(restoredLedger.rodGranted, false);
  assert.equal(restoredLedger.save.inventory.boatItems[ELVERSON_FISHING_ROD_ITEM_ID], 1);
  assert.equal(
    restoredLedger.save.rewardLedger.filter((id) => id === ELVERSON_FISHING_ROD_REWARD_ID).length,
    1,
  );
  assert.equal(validateAdventureSave(restoredLedger.save).valid, true);

  const completed = recordElversonFishingTutorialCatch(restoredLedger.save, "white-grunt").save;
  const completedWithoutRod = {
    ...completed,
    inventory: {
      ...completed.inventory,
      boatItems: { ...completed.inventory.boatItems },
    },
  };
  delete completedWithoutRod.inventory.boatItems[ELVERSON_FISHING_ROD_ITEM_ID];
  assert.equal(getElversonFishingProgress(completedWithoutRod).tutorialComplete, true);
  assert.equal(getElversonFishingProgress(completedWithoutRod).canFish, false);

  const completedRepair = beginElversonFishingTutorial(completedWithoutRod);
  assert.equal(completedRepair.rodGranted, true);
  assert.equal(completedRepair.save.inventory.boatItems[ELVERSON_FISHING_ROD_ITEM_ID], 1);
  assert.equal(getElversonFishingProgress(completedRepair.save).tutorialComplete, true);
  assert.equal(getElversonFishingProgress(completedRepair.save).canFish, true);
});

test("legacy lesson flags and catch history never masquerade as hands-on tutorial completion", () => {
  const rodSave = beginElversonFishingTutorial(introducedSave("legacy-lesson-profile")).save;
  const legacy = normalizeAdventureSave({
    ...rodSave,
    progression: {
      ...rodSave.progression,
      quests: {
        ...rodSave.progression.quests,
        [ELVERSON_FISHING_QUEST_ID]: {
          ...rodSave.progression.quests[ELVERSON_FISHING_QUEST_ID],
          flags: {
            [WORLD_INTRODUCTION_FLAG]: true,
            [ELVERSON_FISHING_FLAGS.lessonComplete]: true,
            [ELVERSON_FISHING_FLAGS.totalCaught]: 3,
            [ELVERSON_FISHING_FLAGS.totalDelivered]: 1,
          },
        },
      },
    },
    inventory: {
      ...rodSave.inventory,
      storyItems: {
        "caught-white-grunt": 2,
        "aquarium-blue-crab": 1,
      },
    },
  });

  const legacyProgress = getElversonFishingProgress(legacy);
  assert.equal(legacyProgress.hasRod, true);
  assert.equal(legacyProgress.tutorialStarted, false);
  assert.equal(legacyProgress.tutorialComplete, false);
  assert.equal(legacyProgress.lessonComplete, false);
  assert.equal(legacyProgress.tutorialPending, true);
  assert.equal(legacyProgress.canFish, false);
  assert.throws(
    () => recordElversonFishingCatch(legacy, "white-grunt"),
    /hands-on tutorial/i,
  );

  const resumed = beginElversonFishingTutorial(legacy);
  assert.equal(resumed.rodGranted, false);
  assert.equal(resumed.save.inventory.boatItems[ELVERSON_FISHING_ROD_ITEM_ID], 1);
  assert.equal(resumed.save.rewardLedger.filter((id) => id === ELVERSON_FISHING_ROD_REWARD_ID).length, 1);
  assert.equal(getElversonFishingProgress(resumed.save).tutorialStarted, true);
  assert.equal(getElversonFishingProgress(resumed.save).canFish, false);
});

test("the first successful tutorial catch completes the lesson atomically and only once", () => {
  const introduced = introducedSave("tutorial-catch-profile");
  assert.throws(
    () => recordElversonFishingTutorialCatch(introduced, "white-grunt"),
    /receive .* hand net/i,
  );

  const started = beginElversonFishingTutorial(introduced).save;
  const before = jsonRoundTrip(started);
  assert.throws(
    () => recordElversonFishingCatch(started, "white-grunt"),
    /hands-on tutorial/i,
  );

  const completed = recordElversonFishingTutorialCatch(started, "white-grunt");
  assert.equal(completed.applied, true);
  assert.equal(completed.tutorialCompletedNow, true);
  assert.equal(completed.firstDiscovery, true);
  assert.equal(completed.quantity, 1);
  assert.equal(completed.save.inventory.storyItems["caught-white-grunt"], 1);
  assert.equal(
    completed.save.progression.quests[ELVERSON_FISHING_QUEST_ID]
      .flags[ELVERSON_FISHING_FLAGS.totalCaught],
    1,
  );
  assert.equal(
    completed.save.progression.quests[ELVERSON_FISHING_QUEST_ID]
      .flags[ELVERSON_FISHING_FLAGS.tutorialComplete],
    true,
  );
  assert.equal(completed.progress.tutorialComplete, true);
  assert.equal(completed.progress.tutorialPending, false);
  assert.equal(completed.progress.canFish, true);
  assert.deepEqual(started, before, "tutorial completion must not mutate its input save");

  const repeated = recordElversonFishingTutorialCatch(completed.save, "white-grunt");
  assert.equal(repeated.applied, false);
  assert.equal(repeated.tutorialCompletedNow, false);
  assert.equal(repeated.quantity, 1);
  assert.deepEqual(repeated.save, completed.save);
  assert.equal(repeated.progress.heldCount, 1);
  assert.equal(
    repeated.save.progression.quests[ELVERSON_FISHING_QUEST_ID]
      .flags[ELVERSON_FISHING_FLAGS.totalCaught],
    1,
  );
  assert.equal(validateAdventureSave(repeated.save).valid, true);
});

test("the rod and live or delivered creatures resolve to non-discardable inventory definitions", () => {
  assert.equal(ELVERSON_FISHING_ROD.discardable, false);
  assert.deepEqual(
    getElversonFishingItemDefinition(ELVERSON_FISHING_ROD_ITEM_ID),
    ELVERSON_FISHING_ROD,
  );

  const creature = ELVERSON_REEF_CATCHES[0];
  const caught = getElversonFishingItemDefinition(creature.inventoryItemId);
  const aquarium = getElversonFishingItemDefinition(creature.aquariumItemId);
  assert.equal(caught?.creature, creature);
  assert.equal(caught?.location, "creel");
  assert.equal(caught?.discardable, false);
  assert.equal(aquarium?.creature, creature);
  assert.equal(aquarium?.location, "aquarium");
  assert.equal(aquarium?.discardable, false);
  assert.equal(getElversonFishingItemDefinition("ordinary-shell"), null);
});

test("successful normal catches require the completed hands-on tutorial, increment safely, and preserve their input saves", () => {
  const introduced = introducedSave();
  assert.throws(
    () => recordElversonFishingCatch(introduced, "white-grunt"),
    /hands-on tutorial/i,
  );

  const taught = lessonSave();
  const before = jsonRoundTrip(taught);
  assert.throws(
    () => recordElversonFishingCatch(taught, "not-an-elverson-creature"),
    /unknown Elverson fishing creature/i,
  );
  assert.deepEqual(taught, before);

  const first = recordElversonFishingCatch(taught, "white-grunt");
  assert.equal(first.creature.id, "white-grunt");
  assert.equal(first.firstDiscovery, true);
  assert.equal(first.quantity, 1);
  assert.equal(first.progress.heldCount, 1);
  assert.equal(first.progress.aquariumCount, 0);
  assert.equal(first.progress.discoveredCount, 1);
  assert.equal(first.progress.aquariumSpeciesCount, 0);
  assert.equal(first.save.inventory.storyItems["caught-white-grunt"], 1);
  assert.equal(
    first.save.progression.quests[ELVERSON_FISHING_QUEST_ID]
      .flags[ELVERSON_FISHING_FLAGS.totalCaught],
    1,
  );

  const second = recordElversonFishingCatch(first.save, "white-grunt");
  assert.equal(second.firstDiscovery, false);
  assert.equal(second.quantity, 2);
  assert.equal(second.progress.heldCount, 2);
  assert.equal(second.progress.discoveredCount, 1);
  assert.equal(second.save.inventory.storyItems["caught-white-grunt"], 2);
  assert.equal(
    second.save.progression.quests[ELVERSON_FISHING_QUEST_ID]
      .flags[ELVERSON_FISHING_FLAGS.totalCaught],
    2,
  );
  assert.equal(second.save.inventory.boatItems[ELVERSON_FISHING_ROD_ITEM_ID], 1);
  assert.deepEqual(taught, before, "catch recording must not mutate the lesson save");
  assert.equal(validateAdventureSave(second.save).valid, true);

  const overflow = normalizeAdventureSave({
    ...taught,
    inventory: {
      ...taught.inventory,
      storyItems: { "caught-white-grunt": Number.MAX_SAFE_INTEGER },
    },
  });
  const overflowBefore = jsonRoundTrip(overflow);
  assert.throws(
    () => recordElversonFishingCatch(overflow, "white-grunt"),
    /positive safe integer/i,
  );
  assert.deepEqual(overflow, overflowBefore);
});

test("Easterling moves every held catch into the aquarium and repeated delivery is a no-op", () => {
  let save = lessonSave();
  save = recordElversonFishingCatch(save, "white-grunt").save;
  save = recordElversonFishingCatch(save, "white-grunt").save;
  save = recordElversonFishingCatch(save, "sea-urchin").save;
  const beforeDelivery = jsonRoundTrip(save);

  const delivered = deliverElversonFishingCatches(save);
  assert.equal(delivered.applied, true);
  assert.equal(delivered.deliveredCount, 3);
  assert.deepEqual(
    delivered.deliveredSpecies.map(({ creature, quantity }) => [creature.id, quantity]),
    [["white-grunt", 2], ["sea-urchin", 1]],
  );
  assert.equal(delivered.save.inventory.storyItems["caught-white-grunt"], undefined);
  assert.equal(delivered.save.inventory.storyItems["caught-sea-urchin"], undefined);
  assert.equal(delivered.save.inventory.storyItems["aquarium-white-grunt"], 2);
  assert.equal(delivered.save.inventory.storyItems["aquarium-sea-urchin"], 1);
  assert.equal(delivered.save.inventory.cards["white-grunt"], 2);
  assert.equal(delivered.save.inventory.cards["sea-urchin"], 1);
  assert.equal(delivered.awardedCardCount, 3);
  assert.deepEqual(
    delivered.awardedCards.map(({ cardId, quantity }) => [cardId, quantity]),
    [["white-grunt", 2], ["sea-urchin", 1]],
  );
  assert.equal(delivered.progress.heldCount, 0);
  assert.equal(delivered.progress.aquariumCount, 3);
  assert.equal(delivered.progress.discoveredCount, 2);
  assert.equal(delivered.progress.aquariumSpeciesCount, 2);
  assert.equal(delivered.progress.matchingCardsAwarded, 3);
  assert.equal(delivered.progress.matchingCardsPending, 0);
  assert.equal(
    delivered.save.progression.quests[ELVERSON_FISHING_QUEST_ID]
      .flags[ELVERSON_FISHING_FLAGS.totalDelivered],
    3,
  );
  assert.deepEqual(save, beforeDelivery, "delivery must not mutate its input save");

  const repeated = deliverElversonFishingCatches(delivered.save);
  assert.equal(repeated.applied, false);
  assert.equal(repeated.deliveredCount, 0);
  assert.equal(repeated.collectionCompletedNow, false);
  assert.equal(repeated.awardedCardCount, 0);
  assert.deepEqual(repeated.awardedCards, []);
  assert.deepEqual(repeated.deliveredSpecies, []);
  assert.deepEqual(repeated.save, delivered.save);
  assert.equal(repeated.save.inventory.boatItems[ELVERSON_FISHING_ROD_ITEM_ID], 1);
});

test("delivering all ten species marks the Elverson aquarium collection complete once", () => {
  let save = lessonSave();
  for (const creature of ELVERSON_REEF_CATCHES) {
    save = recordElversonFishingCatch(save, creature.id).save;
  }

  const delivered = deliverElversonFishingCatches(save);
  assert.equal(delivered.deliveredCount, ELVERSON_REEF_CATCHES.length);
  assert.equal(delivered.collectionCompletedNow, true);
  assert.equal(delivered.progress.collectionComplete, true);
  assert.equal(delivered.progress.aquariumSpeciesCount, ELVERSON_REEF_CATCHES.length);
  assert.equal(delivered.progress.aquariumCount, ELVERSON_REEF_CATCHES.length);
  assert.equal(delivered.awardedCardCount, ELVERSON_REEF_CATCHES.length);
  for (const creature of ELVERSON_REEF_CATCHES) {
    assert.equal(delivered.save.inventory.cards[creature.cardId], 1);
    assert.equal(
      delivered.progress.creatures.find(({ id }) => id === creature.id)?.matchingCardsAwarded,
      1,
    );
  }
  assert.equal(
    delivered.save.progression.quests[ELVERSON_FISHING_QUEST_ID]
      .flags[ELVERSON_FISHING_FLAGS.collectionComplete],
    true,
  );
  assert.equal(
    delivered.save.progression.quests[ELVERSON_FISHING_QUEST_ID]
      .flags[ELVERSON_FISHING_FLAGS.totalCaught],
    ELVERSON_REEF_CATCHES.length,
  );
  assert.equal(
    delivered.save.progression.quests[ELVERSON_FISHING_QUEST_ID]
      .flags[ELVERSON_FISHING_FLAGS.totalDelivered],
    ELVERSON_REEF_CATCHES.length,
  );
  assert.equal(validateAdventureSave(delivered.save).valid, true);

  const repeatCatch = recordElversonFishingCatch(delivered.save, "white-grunt");
  const repeatDelivery = deliverElversonFishingCatches(repeatCatch.save);
  assert.equal(repeatDelivery.applied, true);
  assert.equal(repeatDelivery.collectionCompletedNow, false);
  assert.equal(repeatDelivery.progress.collectionComplete, true);
  assert.equal(repeatDelivery.awardedCardCount, 1);
});

test("older aquarium deliveries reconcile matching cards without using existing card ownership", () => {
  const base = lessonSave("legacy-aquarium-rewards");
  const legacy = normalizeAdventureSave({
    ...base,
    inventory: {
      ...base.inventory,
      cards: { "white-grunt": 4 },
      storyItems: {
        ...base.inventory.storyItems,
        "aquarium-white-grunt": 2,
        "aquarium-sea-urchin": 1,
      },
    },
  });
  const before = jsonRoundTrip(legacy);

  const recovered = reconcileElversonAquariumRewards(legacy);
  assert.equal(recovered.applied, true);
  assert.equal(recovered.awardedCardCount, 3);
  assert.equal(recovered.save.inventory.cards["white-grunt"], 6);
  assert.equal(recovered.save.inventory.cards["sea-urchin"], 1);
  assert.equal(recovered.progress.matchingCardsAwarded, 3);
  assert.equal(recovered.progress.matchingCardsPending, 0);
  assert.deepEqual(legacy, before, "reward reconciliation must not mutate the older save");

  const repeated = reconcileElversonAquariumRewards(recovered.save);
  assert.equal(repeated.applied, false);
  assert.equal(repeated.awardedCardCount, 0);
  assert.deepEqual(repeated.awardedCards, []);
  assert.deepEqual(repeated.save, recovered.save);
});

test("schema-valid malformed reward counters render safely and reconcile without ambiguous duplicate cards", () => {
  const rewardFlagId = "aquarium-card-rewarded-white-grunt";
  for (const [index, invalidValue] of [null, -1, 1.5, "unknown", 3].entries()) {
    const base = lessonSave(`malformed-reward-${index}`);
    let malformed = normalizeAdventureSave({
      ...base,
      inventory: {
        ...base.inventory,
        cards: { "white-grunt": 7 },
        storyItems: {
          ...base.inventory.storyItems,
          "aquarium-white-grunt": 2,
        },
      },
    });
    malformed = setQuestFlag(
      malformed,
      ELVERSON_FISHING_QUEST_ID,
      rewardFlagId,
      invalidValue,
    );

    const readable = getElversonFishingProgress(malformed);
    assert.equal(readable.matchingCardsPending, 0);
    assert.equal(readable.matchingCardsAwarded, 2);

    const recovered = reconcileElversonAquariumRewards(malformed);
    assert.equal(recovered.applied, true);
    assert.equal(recovered.awardedCardCount, 0);
    assert.equal(recovered.repairedRewardFlags.length, 1);
    assert.equal(recovered.save.inventory.cards["white-grunt"], 7);
    assert.equal(
      recovered.save.progression.quests[ELVERSON_FISHING_QUEST_ID].flags[rewardFlagId],
      2,
    );
    assert.equal(getElversonFishingProgress(recovered.save).matchingCardsPending, 0);

    const repeated = reconcileElversonAquariumRewards(recovered.save);
    assert.equal(repeated.applied, false);
    assert.equal(repeated.repairedRewardFlags.length, 0);
    assert.deepEqual(repeated.save, recovered.save);
  }
});

test("an ahead reward counter is repaired before delivery so the newly delivered creature still earns its card", () => {
  const rewardFlagId = "aquarium-card-rewarded-white-grunt";
  const base = lessonSave("ahead-counter-delivery");
  let malformed = normalizeAdventureSave({
    ...base,
    inventory: {
      ...base.inventory,
      cards: { "white-grunt": 5 },
      storyItems: {
        ...base.inventory.storyItems,
        "aquarium-white-grunt": 1,
        "caught-white-grunt": 1,
      },
    },
  });
  malformed = setQuestFlag(
    malformed,
    ELVERSON_FISHING_QUEST_ID,
    rewardFlagId,
    2,
  );

  const delivered = deliverElversonFishingCatches(malformed);
  assert.equal(delivered.deliveredCount, 1);
  assert.equal(delivered.awardedCardCount, 1);
  assert.deepEqual(
    delivered.awardedCards.map(({ cardId, quantity }) => [cardId, quantity]),
    [["white-grunt", 1]],
  );
  assert.equal(delivered.repairedRewardFlags.length, 1);
  assert.equal(delivered.save.inventory.cards["white-grunt"], 6);
  assert.equal(delivered.save.inventory.storyItems["aquarium-white-grunt"], 2);
  assert.equal(delivered.save.inventory.storyItems["caught-white-grunt"], undefined);
  assert.equal(
    delivered.save.progression.quests[ELVERSON_FISHING_QUEST_ID].flags[rewardFlagId],
    2,
  );
});

test("a pre-reward complete Elverson aquarium receives every owed card without granting the campaign title", () => {
  const base = lessonSave("legacy-complete-aquarium");
  const storyItems = { ...base.inventory.storyItems };
  for (const creature of ELVERSON_REEF_CATCHES) storyItems[creature.aquariumItemId] = 1;
  const legacy = normalizeAdventureSave({
    ...base,
    inventory: { ...base.inventory, storyItems },
  });

  const recovered = reconcileElversonAquariumRewards(legacy);
  assert.equal(recovered.awardedCardCount, ELVERSON_REEF_CATCHES.length);
  assert.equal(recovered.progress.collectionComplete, true);
  assert.equal(recovered.save.inventory.storyItems["master-of-the-sea"], undefined);
  assert.equal(
    recovered.save.rewardLedger.some((rewardId) => rewardId.includes("master-of-the-sea")),
    false,
  );

  const repeated = reconcileElversonAquariumRewards(recovered.save);
  assert.equal(repeated.applied, false);
  assert.deepEqual(repeated.save, recovered.save);
});

test("pending and completed fishing tutorials survive reloads and preserve normal fishing gates", () => {
  const backend = new MemoryStorage();
  const adapter = createAdventureStorageAdapter({
    backend,
    now: () => "2026-07-31T16:00:00.000Z",
  });

  const pending = beginElversonFishingTutorial(introducedSave()).save;
  const pendingManual = adapter.manualSave("profile-1", pending);
  assert.equal(pendingManual.ok, true);

  const pendingReload = adapter.loadProfile("profile-1");
  assert.equal(pendingReload.ok, true);
  assert.equal(getElversonFishingProgress(pendingReload.save).tutorialStarted, true);
  assert.equal(getElversonFishingProgress(pendingReload.save).tutorialPending, true);
  assert.equal(getElversonFishingProgress(pendingReload.save).canFish, false);
  assert.throws(
    () => recordElversonFishingCatch(pendingReload.save, "white-grunt"),
    /hands-on tutorial/i,
  );

  const tutorialCatch = recordElversonFishingTutorialCatch(pendingReload.save, "white-grunt").save;
  const tutorialAutosave = adapter.autosave(
    "profile-1",
    tutorialCatch,
    "fishing-tutorial-complete:white-grunt",
  );
  assert.equal(tutorialAutosave.ok, true);
  assert.equal(tutorialAutosave.checkpointId, "fishing-tutorial-complete:white-grunt");

  const tutorialReload = adapter.loadProfile("profile-1");
  assert.equal(getElversonFishingProgress(tutorialReload.save).tutorialComplete, true);
  assert.equal(getElversonFishingProgress(tutorialReload.save).tutorialPending, false);
  assert.equal(getElversonFishingProgress(tutorialReload.save).canFish, true);

  let save = deliverElversonFishingCatches(tutorialReload.save).save;
  save = recordElversonFishingCatch(save, "blue-crab").save;
  const completedManual = adapter.manualSave("profile-1", save);
  assert.equal(completedManual.ok, true);

  const loaded = adapter.loadProfile("profile-1");
  assert.equal(loaded.ok, true);
  assert.equal(loaded.status, "ready");
  assert.deepEqual(loaded.save, normalizeAdventureSave(save));
  assert.deepEqual(normalizeAdventureSave(jsonRoundTrip(loaded.save)), loaded.save);
  assert.equal(hasElversonFishingRod(loaded.save), true);
  assert.equal(loaded.save.inventory.storyItems["aquarium-white-grunt"], 1);
  assert.equal(loaded.save.inventory.storyItems["caught-blue-crab"], 1);
  assert.equal(loaded.save.inventory.cards["white-grunt"], 1);
  assert.equal(
    loaded.save.progression.quests[ELVERSON_FISHING_QUEST_ID]
      .flags[ELVERSON_FISHING_FLAGS.totalCaught],
    2,
  );
  assert.equal(
    loaded.save.progression.quests[ELVERSON_FISHING_QUEST_ID]
      .flags[ELVERSON_FISHING_FLAGS.totalDelivered],
    1,
  );

  const next = recordElversonFishingCatch(loaded.save, "blue-crab").save;
  const autosave = adapter.autosave("profile-1", next, "fishing-catch:blue-crab");
  assert.equal(autosave.ok, true);
  assert.equal(autosave.checkpointId, "fishing-catch:blue-crab");

  const resumed = adapter.loadProfile("profile-1");
  assert.equal(resumed.ok, true);
  assert.equal(resumed.save.inventory.boatItems[ELVERSON_FISHING_ROD_ITEM_ID], 1);
  assert.equal(resumed.save.inventory.storyItems["aquarium-white-grunt"], 1);
  assert.equal(resumed.save.inventory.storyItems["caught-blue-crab"], 2);
  assert.equal(resumed.save.inventory.cards["white-grunt"], 1);
  assert.equal(getElversonFishingProgress(resumed.save).heldCount, 2);
  assert.equal(getElversonFishingProgress(resumed.save).aquariumCount, 1);
  assert.equal(
    resumed.save.progression.quests[ELVERSON_FISHING_QUEST_ID]
      .flags[ELVERSON_FISHING_FLAGS.totalCaught],
    3,
  );
  assert.equal(validateAdventureSave(resumed.save).valid, true);
});
