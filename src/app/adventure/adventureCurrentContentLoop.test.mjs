import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVENTURE_CONTENT,
  getAdventureRoute,
  getAdventureSceneInteraction,
} from "./adventureContent.mjs";
import { validateAdventureContent } from "./adventureContentValidation.mjs";
import {
  CURRENT_CORRECT_INTERPRETATION_ID,
  CURRENT_CORRECT_RESPONSE_ID,
  CURRENT_REQUIRED_OBSERVATION_IDS,
  CURRENT_RESIDENT_ENCOUNTER_IDS,
  beginCurrentInvestigation,
  recordCurrentObservation,
  submitCurrentInterpretation,
  submitCurrentResponse,
  turnInCurrentFieldwork,
} from "./adventureCurrent.mjs";
import { openAdventurePack } from "./adventurePacks.mjs";
import {
  createInitialAdventureSave,
  grantReward,
  normalizeAdventureSave,
  validateAdventureSave,
} from "./adventureProgression.mjs";
import {
  boardAdventureRoute,
  dockAdventureRoute,
  getRouteTravelState,
} from "./adventureTravel.mjs";

const ROUTE_ID = "route-brackwater-current";

function completeEncounter(saveValue, encounterId) {
  const save = normalizeAdventureSave(saveValue);
  return normalizeAdventureSave({
    ...save,
    progression: {
      ...save.progression,
      completedEncounterIds: [...new Set([
        ...save.progression.completedEncounterIds,
        encounterId,
      ])],
    },
  });
}

test("the authored Current Commons content supports travel, evidence, resident duels, qualifier reward, and pack opening", () => {
  assert.equal(validateAdventureContent(ADVENTURE_CONTENT).valid, true);
  const route = getAdventureRoute(ROUTE_ID);
  let save = createInitialAdventureSave("profile-current-content-loop");
  save = normalizeAdventureSave({
    ...save,
    world: {
      ...save.world,
      townId: route.fromTownId,
      sceneId: "brackwater-landing-town",
      position: { x: 8, y: 8 },
      facing: "up",
      lastSafeDockId: route.fromDockId,
      unlockedRouteIds: [ROUTE_ID],
    },
  });

  assert.equal(getRouteTravelState(save, ROUTE_ID).runtimeReady, true);
  save = boardAdventureRoute(save, {
    routeId: ROUTE_ID,
    originDockId: route.fromDockId,
  });
  save = normalizeAdventureSave({
    ...save,
    world: { ...save.world, position: { x: 14, y: 5 }, facing: "right" },
  });
  save = dockAdventureRoute(save, {
    routeId: ROUTE_ID,
    destinationDockId: route.toDockId,
  });
  assert.equal(save.world.townId, "current-commons");

  save = beginCurrentInvestigation(save).save;
  const observationInteractions = ADVENTURE_CONTENT.scenes
    .find((scene) => scene.id === "current-commons-town")
    .world.interactions
    .filter((interaction) => interaction.type === "observation");
  assert.deepEqual(
    observationInteractions.map((interaction) => interaction.observationId),
    CURRENT_REQUIRED_OBSERVATION_IDS,
  );
  for (const interaction of observationInteractions) {
    assert.equal(
      getAdventureSceneInteraction("current-commons-town", interaction.id).observationId,
      interaction.observationId,
    );
    save = recordCurrentObservation(save, interaction.observationId).save;
  }
  save = submitCurrentInterpretation(save, CURRENT_CORRECT_INTERPRETATION_ID).save;
  save = submitCurrentResponse(save, CURRENT_CORRECT_RESPONSE_ID).save;
  for (const encounterId of CURRENT_RESIDENT_ENCOUNTER_IDS) {
    save = completeEncounter(save, encounterId);
  }

  const fieldwork = turnInCurrentFieldwork(save);
  assert.equal(fieldwork.completed, true);
  assert.deepEqual(fieldwork.fieldNoteIds, ["field-note-current-connections"]);
  save = fieldwork.save;

  const qualifier = ADVENTURE_CONTENT.encounters.find(
    (encounter) => encounter.id === "encounter-current-qualifier",
  );
  assert.ok(qualifier.prerequisites.some((prerequisite) => (
    prerequisite.type === "questStatus"
    && prerequisite.questId === "quest-current-ghost-gear"
    && prerequisite.status === "complete"
  )));
  save = completeEncounter(save, qualifier.id);
  const qualifierReward = ADVENTURE_CONTENT.rewards.find(
    (reward) => reward.id === qualifier.rewardId,
  );
  save = grantReward(save, qualifierReward).save;
  assert.equal(save.inventory.unopenedPacks["pack-pool-current-bluewater"], 1);
  assert.ok(save.progression.tideMarkIds.includes("tide-mark-current"));
  assert.ok(save.world.unlockedRouteIds.includes("route-current-kelpwatch"));

  const opened = openAdventurePack(save, "pack-pool-current-bluewater", { random: () => 0 });
  assert.equal(opened.cards.length, 4);
  assert.equal(new Set(opened.cards).size, 4);
  assert.ok(opened.guaranteedNewCardId);
  assert.equal(opened.save.inventory.unopenedPacks["pack-pool-current-bluewater"], undefined);
  assert.equal(validateAdventureSave(opened.save).valid, true);
});
