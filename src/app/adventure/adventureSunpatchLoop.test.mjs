import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVENTURE_CONTENT,
  getAdventureEncounter,
} from "./adventureContent.mjs";
import { openAdventurePack } from "./adventurePacks.mjs";
import {
  createInitialAdventureSave,
  grantReward,
  migrateAdventureSave,
  normalizeAdventureSave,
} from "./adventureProgression.mjs";
import {
  completeAdventureEncounter,
  isAdventureEncounterAvailable,
  recoverAdventureResume,
} from "./adventureSession.mjs";
import {
  SUNPATCH_CORRECT_INTERPRETATION_ID,
  SUNPATCH_CORRECT_RESPONSE_ID,
  SUNPATCH_REQUIRED_OBSERVATION_IDS,
  SUNPATCH_RESIDENT_ENCOUNTER_IDS,
  beginSunpatchInvestigation,
  getSunpatchProgress,
  recordSunpatchObservation,
  submitSunpatchInterpretation,
  submitSunpatchResponse,
  turnInSunpatchFieldwork,
} from "./adventureSunpatch.mjs";
import {
  autoSteerAdventureRoute,
  boardAdventureRoute,
  buildAdventureWorldMapModel,
  dockAdventureRoute,
} from "./adventureTravel.mjs";

const ROUTE_ID = "route-shellshore-sunpatch";
const SHELLSHORE_DOCK_ID = "shellshore-dock";
const SUNPATCH_DOCK_ID = "sunpatch-dock";
const QUALIFIER_ID = "encounter-sunpatch-qualifier";
const PACK_ID = "pack-pool-sunpatch-coral";

function contentById(collection, id) {
  const value = collection.find((candidate) => candidate.id === id);
  assert.ok(value, `Expected authored content ${id}.`);
  return value;
}

function readyAtShellshoreDock() {
  let save = createInitialAdventureSave("profile-1");
  save = grantReward(
    save,
    contentById(ADVENTURE_CONTENT.rewards, "reward-shellshore-tutorial"),
  ).save;
  save.progression.quests["quest-shellshore-first-voyage"] = {
    status: "complete",
    flags: { "boat-safety-reviewed": true },
  };
  return normalizeAdventureSave(save);
}

test("the authored Phase 4 loop survives travel, retries, rewards, pack opening, reload, and return travel", () => {
  let save = readyAtShellshoreDock();

  save = boardAdventureRoute(save, {
    routeId: ROUTE_ID,
    originDockId: SHELLSHORE_DOCK_ID,
  });
  const midRouteReload = recoverAdventureResume(JSON.parse(JSON.stringify(save)));
  assert.equal(midRouteReload.recovered, false);
  assert.equal(midRouteReload.save.world.sceneId, "shellshore-sunpatch-sea");

  save = dockAdventureRoute(normalizeAdventureSave({
    ...midRouteReload.save,
    world: {
      ...midRouteReload.save.world,
      position: { x: 14, y: 5 },
      facing: "left",
    },
  }), {
    routeId: ROUTE_ID,
    destinationDockId: SUNPATCH_DOCK_ID,
  });
  assert.equal(save.world.townId, "sunpatch-cay");
  assert.deepEqual(save.world.completedRouteIds, [ROUTE_ID]);

  save = beginSunpatchInvestigation(save).save;
  assert.equal(isAdventureEncounterAvailable(save, QUALIFIER_ID).available, false);

  for (const observationId of SUNPATCH_REQUIRED_OBSERVATION_IDS) {
    save = recordSunpatchObservation(save, observationId).save;
  }
  const wrongInterpretation = submitSunpatchInterpretation(save, "all-white-coral-is-dead");
  assert.equal(wrongInterpretation.correct, false);
  save = submitSunpatchInterpretation(
    wrongInterpretation.save,
    SUNPATCH_CORRECT_INTERPRETATION_ID,
  ).save;
  const wrongResponse = submitSunpatchResponse(save, "replace-every-pale-coral");
  assert.equal(wrongResponse.correct, false);
  save = submitSunpatchResponse(wrongResponse.save, SUNPATCH_CORRECT_RESPONSE_ID).save;

  for (const encounterId of SUNPATCH_RESIDENT_ENCOUNTER_IDS) {
    const encounter = getAdventureEncounter(encounterId);
    save = completeAdventureEncounter(save, {
      encounterId,
      opponentId: encounter.opponentId,
    });
  }
  assert.equal(getSunpatchProgress(save).status, "readyToTurnIn");

  save = turnInSunpatchFieldwork(save).save;
  assert.equal(getSunpatchProgress(save).status, "complete");
  assert.ok(save.fieldNotes.entryIds.includes("field-note-coral-observations"));
  assert.equal(isAdventureEncounterAvailable(save, QUALIFIER_ID).available, true);

  save = completeAdventureEncounter(save, {
    encounterId: QUALIFIER_ID,
    opponentId: "sunpatch-leader",
  });
  assert.ok(save.progression.tideMarkIds.includes("tide-mark-sunpatch"));
  assert.ok(save.world.unlockedRouteIds.includes("route-sunpatch-brackwater"));
  assert.equal(save.inventory.unopenedPacks[PACK_ID], 1);
  assert.equal(
    save.rewardLedger.filter((rewardId) => rewardId === "reward-sunpatch-qualifier").length,
    1,
  );

  const worldMap = buildAdventureWorldMapModel(save);
  const nextRoute = worldMap.routes.find((route) => route.routeId === "route-sunpatch-brackwater");
  assert.equal(nextRoute.unlocked, true);
  assert.equal(nextRoute.runtimeReady, false);
  assert.equal(nextRoute.canBoardManualNow, false);

  const opened = openAdventurePack(save, PACK_ID, { random: () => 0 });
  assert.equal(opened.cards.length, 4);
  assert.equal(opened.save.inventory.unopenedPacks[PACK_ID] ?? 0, 0);
  save = completeAdventureEncounter(opened.save, {
    encounterId: QUALIFIER_ID,
    opponentId: "sunpatch-leader",
  });
  assert.equal(save.inventory.unopenedPacks[PACK_ID] ?? 0, 0);
  assert.equal(
    save.rewardLedger.filter((rewardId) => rewardId === "reward-sunpatch-qualifier").length,
    1,
  );

  const reloaded = recoverAdventureResume(
    migrateAdventureSave(JSON.parse(JSON.stringify(save))),
  );
  assert.equal(reloaded.recovered, false);
  assert.ok(reloaded.save.progression.tideMarkIds.includes("tide-mark-sunpatch"));
  assert.deepEqual(reloaded.save.world.completedRouteIds, [ROUTE_ID]);

  const returnedToShellshore = autoSteerAdventureRoute(reloaded.save, {
    routeId: ROUTE_ID,
    destinationDockId: SHELLSHORE_DOCK_ID,
  });
  assert.equal(returnedToShellshore.world.townId, "shellshore-village");
  const returnedToSunpatch = autoSteerAdventureRoute(returnedToShellshore, {
    routeId: ROUTE_ID,
    destinationDockId: SUNPATCH_DOCK_ID,
  });
  assert.equal(returnedToSunpatch.world.townId, "sunpatch-cay");
  assert.deepEqual(returnedToSunpatch.world.completedRouteIds, [ROUTE_ID]);
});
