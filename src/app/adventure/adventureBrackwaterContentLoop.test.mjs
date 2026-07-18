import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVENTURE_CONTENT,
  getAdventureRoute,
  getAdventureSceneInteraction,
} from "./adventureContent.mjs";
import { validateAdventureContent } from "./adventureContentValidation.mjs";
import {
  BRACKWATER_CORRECT_INTERPRETATION_ID,
  BRACKWATER_CORRECT_RESPONSE_ID,
  BRACKWATER_RESIDENT_ENCOUNTER_IDS,
  beginBrackwaterInvestigation,
  recordBrackwaterObservation,
  submitBrackwaterInterpretation,
  submitBrackwaterResponse,
  turnInBrackwaterFieldwork,
} from "./adventureBrackwater.mjs";
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

const ROUTE_ID = "route-sunpatch-brackwater";

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

test("the authored Brackwater content supports travel, fieldwork, resident duels, qualifier reward, and pack opening", () => {
  assert.equal(validateAdventureContent(ADVENTURE_CONTENT).valid, true);
  const route = getAdventureRoute(ROUTE_ID);
  let save = createInitialAdventureSave("profile-brackwater-content-loop");
  save = normalizeAdventureSave({
    ...save,
    world: {
      ...save.world,
      townId: route.fromTownId,
      sceneId: "sunpatch-cay-town",
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
  assert.equal(save.world.townId, "brackwater-landing");

  save = beginBrackwaterInvestigation(save).save;
  const observationInteractions = ADVENTURE_CONTENT.scenes
    .find((scene) => scene.id === "brackwater-landing-town")
    .world.interactions
    .filter((interaction) => interaction.type === "observation");
  assert.equal(observationInteractions.length, 4);
  for (const interaction of observationInteractions) {
    assert.equal(
      getAdventureSceneInteraction("brackwater-landing-town", interaction.id).observationId,
      interaction.observationId,
    );
    save = recordBrackwaterObservation(save, interaction.observationId).save;
  }
  save = submitBrackwaterInterpretation(save, BRACKWATER_CORRECT_INTERPRETATION_ID).save;
  save = submitBrackwaterResponse(save, BRACKWATER_CORRECT_RESPONSE_ID).save;
  for (const encounterId of BRACKWATER_RESIDENT_ENCOUNTER_IDS) {
    save = completeEncounter(save, encounterId);
  }

  const fieldwork = turnInBrackwaterFieldwork(save);
  assert.equal(fieldwork.completed, true);
  assert.deepEqual(fieldwork.fieldNoteIds, ["field-note-estuary-conditions"]);
  save = fieldwork.save;

  const qualifier = ADVENTURE_CONTENT.encounters.find(
    (encounter) => encounter.id === "encounter-brackwater-qualifier",
  );
  assert.ok(qualifier.prerequisites.some((prerequisite) => (
    prerequisite.type === "questStatus"
    && prerequisite.questId === "quest-brackwater-water-clues"
    && prerequisite.status === "complete"
  )));
  save = completeEncounter(save, qualifier.id);
  const qualifierReward = ADVENTURE_CONTENT.rewards.find(
    (reward) => reward.id === qualifier.rewardId,
  );
  save = grantReward(save, qualifierReward).save;
  assert.equal(save.inventory.unopenedPacks["pack-pool-brackwater-murky"], 1);
  assert.ok(save.progression.tideMarkIds.includes("tide-mark-brackwater"));
  assert.ok(save.world.unlockedRouteIds.includes("route-brackwater-current"));

  const opened = openAdventurePack(save, "pack-pool-brackwater-murky", { random: () => 0 });
  assert.equal(opened.cards.length, 4);
  assert.equal(new Set(opened.cards).size, 4);
  assert.ok(opened.guaranteedNewCardId);
  assert.equal(opened.save.inventory.unopenedPacks["pack-pool-brackwater-murky"], undefined);
  assert.equal(validateAdventureSave(opened.save).valid, true);
});
