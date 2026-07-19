import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVENTURE_CONTENT,
  getAdventureRoute,
  getAdventureSceneInteraction,
} from "./adventureContent.mjs";
import { validateAdventureContent } from "./adventureContentValidation.mjs";
import {
  KELPWATCH_CORRECT_INTERPRETATION_ID,
  KELPWATCH_CORRECT_RESPONSE_ID,
  KELPWATCH_REQUIRED_OBSERVATION_IDS,
  KELPWATCH_RESIDENT_ENCOUNTER_IDS,
  beginKelpwatchInvestigation,
  getKelpwatchProgress,
  recordKelpwatchObservation,
  submitKelpwatchInterpretation,
  submitKelpwatchResponse,
  turnInKelpwatchFieldwork,
} from "./adventureKelpwatch.mjs";
import { openAdventurePack } from "./adventurePacks.mjs";
import {
  createInitialAdventureSave,
  normalizeAdventureSave,
  validateAdventureSave,
} from "./adventureProgression.mjs";
import {
  completeAdventureEncounter,
  isAdventureEncounterAvailable,
  recoverAdventureResume,
} from "./adventureSession.mjs";
import {
  autoSteerAdventureRoute,
  boardAdventureRoute,
  dockAdventureRoute,
  getRouteTravelState,
} from "./adventureTravel.mjs";

const ROUTE_ID = "route-current-kelpwatch";
const QUALIFIER_ID = "encounter-kelpwatch-qualifier";
const PACK_ID = "pack-pool-kelpwatch";

function jsonRoundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}

test("the authored Kelpwatch release supports its voyage, full investigation, one-time rewards, pack, save, and revisit", () => {
  assert.equal(validateAdventureContent(ADVENTURE_CONTENT).valid, true);
  const route = getAdventureRoute(ROUTE_ID);
  assert.ok(route);

  let save = createInitialAdventureSave("profile-kelpwatch-content-loop");
  save = normalizeAdventureSave({
    ...save,
    world: {
      ...save.world,
      townId: route.fromTownId,
      sceneId: "current-commons-town",
      position: { x: 8, y: 8 },
      facing: "up",
      lastSafeDockId: route.fromDockId,
      unlockedRouteIds: [ROUTE_ID],
    },
  });

  const initialTravelState = getRouteTravelState(save, ROUTE_ID);
  assert.equal(initialTravelState.routeId, ROUTE_ID);
  assert.equal(initialTravelState.unlocked, true);
  assert.equal(initialTravelState.completed, false);
  assert.equal(initialTravelState.active, false);
  assert.equal(initialTravelState.runtimeReady, true);
  assert.equal(initialTravelState.endpointSide, "from");
  assert.equal(initialTravelState.originDockId, "current-kelpwatch-dock");
  assert.equal(initialTravelState.destinationDockId, "kelpwatch-dock");
  assert.equal(initialTravelState.canBoardManual, true);
  assert.equal(initialTravelState.canAutoSteer, false);
  assert.deepEqual(initialTravelState.availableModes, ["manual"]);
  save = boardAdventureRoute(save, {
    routeId: ROUTE_ID,
    originDockId: route.fromDockId,
  });
  assert.equal(save.world.sceneId, "current-kelpwatch-sea");
  save = normalizeAdventureSave({
    ...save,
    world: { ...save.world, position: { x: 14, y: 5 }, facing: "right" },
  });
  save = dockAdventureRoute(save, {
    routeId: ROUTE_ID,
    destinationDockId: route.toDockId,
  });
  assert.equal(save.world.townId, "kelpwatch-island");
  assert.equal(save.world.sceneId, "kelpwatch-island-town");
  assert.equal(save.world.lastSafeDockId, "kelpwatch-dock");
  assert.deepEqual(save.world.completedRouteIds, [ROUTE_ID]);

  save = beginKelpwatchInvestigation(save).save;
  const observationInteractions = ADVENTURE_CONTENT.scenes
    .find((scene) => scene.id === "kelpwatch-island-town")
    .world.interactions
    .filter((interaction) => interaction.type === "observation");
  assert.deepEqual(
    observationInteractions.map((interaction) => interaction.observationId),
    KELPWATCH_REQUIRED_OBSERVATION_IDS,
  );
  for (const interaction of observationInteractions) {
    assert.equal(
      getAdventureSceneInteraction("kelpwatch-island-town", interaction.id).observationId,
      interaction.observationId,
    );
    save = recordKelpwatchObservation(save, interaction.observationId).save;
  }
  save = submitKelpwatchInterpretation(
    save,
    KELPWATCH_CORRECT_INTERPRETATION_ID,
  ).save;
  save = submitKelpwatchResponse(save, KELPWATCH_CORRECT_RESPONSE_ID).save;

  for (const encounterId of KELPWATCH_RESIDENT_ENCOUNTER_IDS) {
    save = completeAdventureEncounter(save, { encounterId });
  }
  assert.equal(getKelpwatchProgress(save).readyToTurnIn, true);

  const fieldwork = turnInKelpwatchFieldwork(save);
  assert.equal(fieldwork.completed, true);
  assert.equal(fieldwork.rewardApplied, true);
  assert.deepEqual(fieldwork.fieldNoteIds, ["field-note-kelp-food-web"]);
  save = fieldwork.save;
  assert.deepEqual(save.fieldNotes.entryIds, ["field-note-kelp-food-web"]);
  assert.deepEqual(save.rewardLedger, ["reward-kelpwatch-fieldwork"]);

  const repeatedFieldwork = turnInKelpwatchFieldwork(save);
  assert.equal(repeatedFieldwork.applied, false);
  assert.equal(repeatedFieldwork.rewardApplied, false);
  assert.deepEqual(repeatedFieldwork.save, save);

  const qualifier = ADVENTURE_CONTENT.encounters.find(
    (encounter) => encounter.id === QUALIFIER_ID,
  );
  assert.deepEqual(qualifier.prerequisites, [{
    type: "questStatus",
    questId: "quest-kelpwatch-balance",
    status: "complete",
  }]);
  assert.deepEqual(isAdventureEncounterAvailable(save, QUALIFIER_ID), {
    available: true,
    reason: null,
  });

  save = completeAdventureEncounter(save, {
    encounterId: QUALIFIER_ID,
    opponentId: "kelpwatch-leader",
  });
  assert.equal(save.inventory.unopenedPacks[PACK_ID], 1);
  assert.ok(save.progression.tideMarkIds.includes("tide-mark-kelpwatch"));
  assert.ok(save.world.unlockedRouteIds.includes("route-kelpwatch-trenchlight"));
  assert.ok(save.rewardLedger.includes("reward-kelpwatch-qualifier"));

  const afterFirstQualifier = jsonRoundTrip(save);
  save = completeAdventureEncounter(save, {
    encounterId: QUALIFIER_ID,
    opponentId: "kelpwatch-leader",
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
  assert.equal(getKelpwatchProgress(recovered.save).complete, true);
  save = recovered.save;

  save = autoSteerAdventureRoute(save, {
    routeId: ROUTE_ID,
    destinationDockId: route.fromDockId,
  });
  assert.equal(save.world.townId, "current-commons");
  assert.equal(save.world.sceneId, "current-commons-town");
  assert.equal(save.world.lastSafeDockId, "current-kelpwatch-dock");

  save = autoSteerAdventureRoute(jsonRoundTrip(save), {
    routeId: ROUTE_ID,
    destinationDockId: route.toDockId,
  });
  assert.equal(save.world.townId, "kelpwatch-island");
  assert.equal(save.world.sceneId, "kelpwatch-island-town");
  assert.deepEqual(save.world.completedRouteIds, [ROUTE_ID]);
  assert.equal(getKelpwatchProgress(save).complete, true);
  assert.equal(validateAdventureSave(save).valid, true);
});
