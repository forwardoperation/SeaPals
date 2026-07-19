import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVENTURE_CONTENT,
  getAdventureRoute,
  getAdventureSceneInteraction,
} from "./adventureContent.mjs";
import { validateAdventureContent } from "./adventureContentValidation.mjs";
import {
  TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
  TRENCHLIGHT_CORRECT_RESPONSE_ID,
  TRENCHLIGHT_REQUIRED_OBSERVATION_IDS,
  TRENCHLIGHT_RESIDENT_ENCOUNTER_IDS,
  beginTrenchlightExpedition,
  getTrenchlightProgress,
  submitTrenchlightInterpretation,
  turnInTrenchlightFieldwork,
} from "./adventureTrenchlight.mjs";
import {
  TRENCHLIGHT_EXPEDITION_TOOL_IDS,
  TRENCHLIGHT_MISSION_CONTROL_SCENE_ID,
  TRENCHLIGHT_SUB_SCENE_ID,
  advanceTrenchlightExpedition,
  getTrenchlightExpeditionState,
  launchTrenchlightExpedition,
  returnTrenchlightExpeditionToStation,
} from "./adventureTrenchlightExpedition.mjs";
import { openAdventurePack } from "./adventurePacks.mjs";
import {
  createInitialAdventureSave,
  normalizeAdventureSave,
  validateAdventureSave,
} from "./adventureProgression.mjs";
import {
  completeAdventureEncounter,
  enterAdventureScene,
  isAdventureEncounterAvailable,
  recoverAdventureResume,
} from "./adventureSession.mjs";
import {
  autoSteerAdventureRoute,
  boardAdventureRoute,
  dockAdventureRoute,
  getRouteTravelState,
} from "./adventureTravel.mjs";

const ROUTE_ID = "route-kelpwatch-trenchlight";
const QUALIFIER_ID = "encounter-trenchlight-qualifier";
const PACK_ID = "pack-pool-trenchlight-deep";
const FIELD_NOTE_ID = "field-note-deep-adaptations";

function jsonRoundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}

test("the authored Trenchlight release supports its voyage, guided expedition, one-time rewards, pack, save, and revisit", () => {
  assert.equal(validateAdventureContent(ADVENTURE_CONTENT).valid, true);
  const route = getAdventureRoute(ROUTE_ID);
  assert.ok(route);

  let save = createInitialAdventureSave("profile-trenchlight-content-loop");
  save = normalizeAdventureSave({
    ...save,
    world: {
      ...save.world,
      townId: route.fromTownId,
      sceneId: "kelpwatch-island-town",
      position: { x: 8, y: 8 },
      facing: "up",
      lastSafeDockId: route.fromDockId,
      unlockedRouteIds: [ROUTE_ID],
    },
  });

  const initialTravelState = getRouteTravelState(save, ROUTE_ID);
  assert.equal(initialTravelState.runtimeReady, true);
  assert.equal(initialTravelState.endpointSide, "from");
  assert.equal(initialTravelState.originDockId, "kelpwatch-trenchlight-dock");
  assert.equal(initialTravelState.destinationDockId, "trenchlight-dock");
  assert.equal(initialTravelState.canBoardManual, true);
  assert.equal(initialTravelState.canAutoSteer, false);

  save = boardAdventureRoute(save, {
    routeId: ROUTE_ID,
    originDockId: route.fromDockId,
  });
  assert.equal(save.world.sceneId, "kelpwatch-trenchlight-sea");
  save = normalizeAdventureSave({
    ...save,
    world: { ...save.world, position: { x: 14, y: 5 }, facing: "right" },
  });
  save = dockAdventureRoute(save, {
    routeId: ROUTE_ID,
    destinationDockId: route.toDockId,
  });
  assert.equal(save.world.townId, "trenchlight-station");
  assert.equal(save.world.sceneId, "trenchlight-station-town");
  assert.equal(save.world.lastSafeDockId, "trenchlight-dock");
  assert.deepEqual(save.world.completedRouteIds, [ROUTE_ID]);

  save = beginTrenchlightExpedition(save).save;
  save = enterAdventureScene(save, {
    sceneId: TRENCHLIGHT_MISSION_CONTROL_SCENE_ID,
    position: { x: 5, y: 6 },
    facing: "up",
  });
  save = launchTrenchlightExpedition(save).save;
  assert.equal(save.world.sceneId, TRENCHLIGHT_SUB_SCENE_ID);

  const subObservationInteractions = ADVENTURE_CONTENT.scenes
    .find((scene) => scene.id === TRENCHLIGHT_SUB_SCENE_ID)
    .world.interactions
    .filter((interaction) => interaction.type === "observation");
  assert.deepEqual(
    subObservationInteractions.map((interaction) => interaction.observationId),
    TRENCHLIGHT_REQUIRED_OBSERVATION_IDS,
  );
  for (const interaction of subObservationInteractions) {
    assert.equal(
      getAdventureSceneInteraction(TRENCHLIGHT_SUB_SCENE_ID, interaction.id).observationId,
      interaction.observationId,
    );
  }

  const surveyTools = [
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.lightMeter,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.pressureSensor,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.marineSnowCamera,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.passiveLowLightCamera,
  ];
  for (const toolId of surveyTools.slice(0, 2)) {
    save = advanceTrenchlightExpedition(save, toolId).save;
  }

  const partialReload = recoverAdventureResume(jsonRoundTrip(save));
  assert.equal(partialReload.fallback, null);
  assert.equal(partialReload.save.world.sceneId, TRENCHLIGHT_SUB_SCENE_ID);
  assert.equal(
    getTrenchlightExpeditionState(partialReload.save).currentStep.id,
    TRENCHLIGHT_REQUIRED_OBSERVATION_IDS[2],
  );
  save = partialReload.save;

  for (const toolId of surveyTools.slice(2)) {
    save = advanceTrenchlightExpedition(save, toolId).save;
  }
  assert.equal(getTrenchlightExpeditionState(save).phase, "analysis-required");
  save = returnTrenchlightExpeditionToStation(save).save;
  assert.equal(save.world.sceneId, TRENCHLIGHT_MISSION_CONTROL_SCENE_ID);

  save = submitTrenchlightInterpretation(
    save,
    TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
  ).save;
  save = launchTrenchlightExpedition(save).save;
  assert.equal(getTrenchlightExpeditionState(save).leg, "recovery");

  const unsafeRecovery = advanceTrenchlightExpedition(
    save,
    "trenchlight-grab-sensor-immediately",
  );
  assert.equal(unsafeRecovery.correct, false);
  assert.equal(unsafeRecovery.retryable, true);
  assert.equal(unsafeRecovery.state.progress.habitatDisturbed, false);
  save = advanceTrenchlightExpedition(
    unsafeRecovery.save,
    TRENCHLIGHT_CORRECT_RESPONSE_ID,
  ).save;
  assert.equal(getTrenchlightExpeditionState(save).phase, "expedition-complete");
  save = returnTrenchlightExpeditionToStation(save).save;

  for (const encounterId of TRENCHLIGHT_RESIDENT_ENCOUNTER_IDS) {
    assert.deepEqual(isAdventureEncounterAvailable(save, encounterId), {
      available: true,
      reason: null,
    });
    save = completeAdventureEncounter(save, { encounterId });
  }
  assert.equal(getTrenchlightProgress(save).readyToTurnIn, true);

  const fieldwork = turnInTrenchlightFieldwork(save);
  assert.equal(fieldwork.completed, true);
  assert.equal(fieldwork.rewardApplied, true);
  assert.deepEqual(fieldwork.fieldNoteIds, [FIELD_NOTE_ID]);
  save = fieldwork.save;
  assert.deepEqual(save.fieldNotes.entryIds, [FIELD_NOTE_ID]);
  assert.deepEqual(save.rewardLedger, ["reward-trenchlight-fieldwork"]);

  const repeatedFieldwork = turnInTrenchlightFieldwork(save);
  assert.equal(repeatedFieldwork.applied, false);
  assert.equal(repeatedFieldwork.rewardApplied, false);
  assert.deepEqual(repeatedFieldwork.save, save);

  assert.deepEqual(isAdventureEncounterAvailable(save, QUALIFIER_ID), {
    available: true,
    reason: null,
  });
  save = completeAdventureEncounter(save, {
    encounterId: QUALIFIER_ID,
    opponentId: "trenchlight-leader",
  });
  assert.equal(save.inventory.unopenedPacks[PACK_ID], 1);
  assert.ok(save.progression.tideMarkIds.includes("tide-mark-trenchlight"));
  assert.ok(save.world.unlockedRouteIds.includes("route-trenchlight-champions-wake"));
  assert.ok(save.rewardLedger.includes("reward-trenchlight-qualifier"));

  const afterFirstQualifier = jsonRoundTrip(save);
  save = completeAdventureEncounter(save, {
    encounterId: QUALIFIER_ID,
    opponentId: "trenchlight-leader",
  });
  assert.deepEqual(save, afterFirstQualifier, "qualifier rematches must not duplicate rewards");

  const opened = openAdventurePack(save, PACK_ID, { random: () => 0 });
  assert.equal(opened.cards.length, 4);
  assert.equal(new Set(opened.cards).size, 4);
  assert.ok(opened.guaranteedNewCardId);
  assert.equal(opened.save.inventory.unopenedPacks[PACK_ID], undefined);
  save = opened.save;
  assert.equal(validateAdventureSave(save).valid, true);

  const recovered = recoverAdventureResume(jsonRoundTrip(save));
  assert.equal(recovered.fallback, null);
  assert.equal(getTrenchlightProgress(recovered.save).complete, true);
  assert.equal(recovered.save.fieldNotes.entryIds.filter((id) => id === FIELD_NOTE_ID).length, 1);
  assert.equal(recovered.save.rewardLedger.filter((id) => id === "reward-trenchlight-qualifier").length, 1);
  save = enterAdventureScene(recovered.save, {
    sceneId: "trenchlight-station-town",
    position: { x: 7, y: 8 },
    facing: "down",
  });

  save = autoSteerAdventureRoute(save, {
    routeId: ROUTE_ID,
    destinationDockId: route.fromDockId,
  });
  assert.equal(save.world.townId, "kelpwatch-island");
  assert.equal(save.world.sceneId, "kelpwatch-island-town");
  assert.equal(save.world.lastSafeDockId, "kelpwatch-trenchlight-dock");

  save = autoSteerAdventureRoute(jsonRoundTrip(save), {
    routeId: ROUTE_ID,
    destinationDockId: route.toDockId,
  });
  assert.equal(save.world.townId, "trenchlight-station");
  assert.equal(save.world.sceneId, "trenchlight-station-town");
  assert.equal(save.world.lastSafeDockId, "trenchlight-dock");
  assert.deepEqual(save.world.completedRouteIds, [ROUTE_ID]);
  assert.equal(getTrenchlightProgress(save).complete, true);
  assert.equal(validateAdventureSave(save).valid, true);
});
