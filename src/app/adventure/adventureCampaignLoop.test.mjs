import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { reconcileStarterCollection } from "./adventureCollection.mjs";
import {
  ADVENTURE_CONTENT,
  getAdventureDock,
  getAdventureEncounter,
  getAdventureNpc,
  getAdventureRoute,
} from "./adventureContent.mjs";
import {
  createActiveDuelDeckSnapshot,
} from "./adventureDecks.mjs";
import { assertAdventureDuelResultMatchesLaunch } from "./adventureDuel.mjs";
import {
  ADVENTURE_ECOSYSTEM_CHAPTERS,
  hasMetAdventureEcosystemGuide,
} from "./adventureEcosystemChapters.mjs";
import {
  SHELLSHORE_PRACTICE_ENCOUNTER_ID,
  STARTER_DECK_IDS,
  TUTORIAL_CHECKPOINT_IDS,
  commitStarterSelection,
  recordBoatSafetyReview,
  recordPracticeDuelResult,
  recordTutorialCheckpoint,
  recoverOnboardingResume,
} from "./adventureOnboarding.mjs";
import { openAdventurePack } from "./adventurePacks.mjs";
import {
  setQuestFlag,
  validateAdventureSave,
} from "./adventureProgression.mjs";
import {
  SHELLSHORE_QUEST_ID,
  SHELLSHORE_RESIDENT_ENCOUNTER_IDS,
  beginChampionsWakeQuestAtCurrentScene,
  completeAdventureEncounter,
  createNewAdventureSession,
  enterAdventureScene,
  isAdventureEncounterAvailable,
  moveAdventureSession,
  reconcileAdventureProgression,
  recordAdventureDuelResult,
  recoverAdventureResume,
} from "./adventureSession.mjs";
import {
  ADVENTURE_PROFILE_IDS,
  createAdventureStorageAdapter,
} from "./adventureStorage.mjs";
import {
  CHAMPIONS_WAKE_QUEST_ID,
  CHAMPIONS_WAKE_REQUIRED_FIELD_NOTE_IDS,
  CHAMPIONS_WAKE_REQUIRED_TIDE_MARK_IDS,
  CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS,
  CHAMPIONS_WAKE_TOURNAMENT_VICTORY_TARGET,
  getChampionsWakeTournamentAvailability,
  getChampionsWakeTournamentLaunch,
  getChampionsWakeTournamentProgress,
  recordChampionsWakeTournamentResult,
  recoverChampionsWakeTournamentState,
  registerChampionsWakeTournament,
} from "./adventureTournament.mjs";
import {
  autoSteerAdventureRoute,
  boardAdventureRoute,
  dockAdventureRoute,
  getRouteTravelState,
} from "./adventureTravel.mjs";
import {
  TRENCHLIGHT_EXPEDITION_TOOL_IDS,
  TRENCHLIGHT_MISSION_CONTROL_SCENE_ID,
  TRENCHLIGHT_SUB_SCENE_ID,
  advanceTrenchlightExpedition,
  getTrenchlightExpeditionState,
  launchTrenchlightExpedition,
  returnTrenchlightExpeditionToStation,
} from "./adventureTrenchlightExpedition.mjs";
import { createStoryDuelResult } from "../simulator/storyModeContract.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});
const { cardsById } = jiti(path.join(projectRoot, "src/data/cards/index.js"));
const { prebuiltDecks } = jiti(
  path.join(projectRoot, "src/data/tournaments/prebuiltDecks.js"),
);

const CAMPAIGN_ROUTE_IDS = Object.freeze([
  "route-shellshore-sunpatch",
  "route-sunpatch-brackwater",
  "route-brackwater-current",
  "route-current-kelpwatch",
  "route-kelpwatch-trenchlight",
  "route-trenchlight-champions-wake",
]);

const CAMPAIGN_TOWN_IDS = Object.freeze([
  "sunpatch-cay",
  "brackwater-landing",
  "current-commons",
  "kelpwatch-island",
  "trenchlight-station",
]);

const CAMPAIGN_PACK_IDS = Object.freeze([
  "pack-pool-shellshore-discovery",
  "pack-pool-sunpatch-coral",
  "pack-pool-brackwater-murky",
  "pack-pool-current-bluewater",
  "pack-pool-kelpwatch",
  "pack-pool-trenchlight-deep",
]);

const CAMPAIGN_FIELD_NOTE_IDS = Object.freeze([
  "field-note-harbor-basics",
  ...CHAMPIONS_WAKE_REQUIRED_FIELD_NOTE_IDS,
  "field-note-archipelago-reflection",
]);

const CHAMPIONSHIP_ENDING_FLAG_IDS = Object.freeze([
  "championship-ceremony-complete",
  "championship-epilogue-complete",
  "championship-credits-complete",
  "postgame-unlocked",
]);

const CHAMPIONSHIP_REWARD_ID = "reward-tournament-champion";
const CHAMPIONSHIP_CUP_ID = "seapals-championship-cup";

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

function quantityTotal(record) {
  return Object.values(record).reduce((total, quantity) => total + quantity, 0);
}

function starterManifest(starterDeckId) {
  const manifest = prebuiltDecks.find((deck) => deck.id === starterDeckId);
  assert.ok(manifest, `Expected real prebuilt starter deck ${starterDeckId}.`);
  return manifest;
}

/**
 * Mirrors the production load boundary: world/quest recovery, onboarding
 * recovery, starter collection repair, then tournament-owned recovery.
 */
function recoverStoredCampaignSave(saveValue, manifest) {
  const world = recoverAdventureResume(saveValue);
  assert.equal(world.fallback, null);
  const onboarding = recoverOnboardingResume(world.save);
  const collectionSave = onboarding.save.player.starterDeckId
    ? reconcileStarterCollection(onboarding.save, manifest).save
    : onboarding.save;
  const tournament = recoverChampionsWakeTournamentState(collectionSave);
  assert.equal(validateAdventureSave(tournament.save).valid, true);
  return tournament.save;
}

function persistAndResume(adapter, saveValue, checkpointId, manifest) {
  const written = adapter.autosave(saveValue.profileId, saveValue, checkpointId);
  assert.equal(written.ok, true, written.error?.message);
  assert.equal(written.checkpointId, checkpointId);

  const loaded = adapter.loadProfile(saveValue.profileId);
  assert.equal(loaded.ok, true, loaded.error?.message);
  assert.equal(loaded.metadata.checkpointId, checkpointId);
  return recoverStoredCampaignSave(loaded.save, manifest);
}

function victoryResult(encounter, playerDeckSnapshot) {
  const opponent = getAdventureNpc(encounter.opponentId);
  return createStoryDuelResult({
    encounterId: encounter.id,
    opponentId: encounter.opponentId,
    opponentName: opponent?.name ?? encounter.opponentId,
    playerDeckId: playerDeckSnapshot.id,
    playerDeckSnapshot,
    opponentDeckId: encounter.opponentDeckId,
    victoryTarget: encounter.victoryTarget,
    difficulty: encounter.difficulty,
    playerVp: encounter.victoryTarget,
    opponentVp: Math.max(0, encounter.victoryTarget - 4),
    round: 4,
    turn: 8,
    message: `Victory: you reached ${encounter.victoryTarget} VP.`,
  });
}

function defeatResult(encounter, playerDeckSnapshot) {
  const opponent = getAdventureNpc(encounter.opponentId);
  return createStoryDuelResult({
    encounterId: encounter.id,
    opponentId: encounter.opponentId,
    opponentName: opponent?.name ?? encounter.opponentId,
    playerDeckId: playerDeckSnapshot.id,
    playerDeckSnapshot,
    opponentDeckId: encounter.opponentDeckId,
    victoryTarget: encounter.victoryTarget,
    difficulty: encounter.difficulty,
    playerVp: Math.max(0, encounter.victoryTarget - 8),
    opponentVp: encounter.victoryTarget,
    round: 4,
    turn: 8,
    message: `Defeat: your opponent reached ${encounter.victoryTarget} VP.`,
  });
}

/**
 * Records a validated Simulator-shaped result and then crosses the canonical
 * first-victory/reward boundary. The Simulator rules engine is intentionally
 * not executed here; match balance and human play remain separate release QA.
 */
function completeAuthoredDuel(saveValue, encounterId) {
  const encounter = getAdventureEncounter(encounterId);
  assert.ok(encounter, `Expected authored encounter ${encounterId}.`);
  assert.deepEqual(isAdventureEncounterAvailable(saveValue, encounterId), {
    available: true,
    reason: null,
  });

  const snapshot = createActiveDuelDeckSnapshot(saveValue, cardsById);
  const result = victoryResult(encounter, snapshot);
  assertAdventureDuelResultMatchesLaunch(result, {
    encounterId: encounter.id,
    opponentId: encounter.opponentId,
    opponentDeckId: encounter.opponentDeckId,
    victoryTarget: encounter.victoryTarget,
    playerDeckSnapshot: snapshot,
  });
  const recorded = recordAdventureDuelResult(saveValue, result);
  return completeAdventureEncounter(recorded.save, {
    encounterId: encounter.id,
    opponentId: encounter.opponentId,
  });
}

function recordAcademyPracticeVictory(saveValue) {
  const encounter = getAdventureEncounter(SHELLSHORE_PRACTICE_ENCOUNTER_ID);
  assert.ok(encounter);
  const snapshot = createActiveDuelDeckSnapshot(saveValue, cardsById);
  const result = victoryResult(encounter, snapshot);
  assertAdventureDuelResultMatchesLaunch(result, {
    encounterId: encounter.id,
    opponentId: encounter.opponentId,
    opponentDeckId: encounter.opponentDeckId,
    victoryTarget: encounter.victoryTarget,
    playerDeckSnapshot: snapshot,
  });
  const recorded = recordAdventureDuelResult(saveValue, result);
  return recordPracticeDuelResult(recorded.save, "won").save;
}

function openAllEarnedPacks(saveValue, openedPackIds) {
  let save = saveValue;
  const pending = Object.entries(save.inventory.unopenedPacks);
  for (const [packId, quantity] of pending) {
    for (let index = 0; index < quantity; index += 1) {
      const opened = openAdventurePack(save, packId, { random: () => 0 });
      assert.equal(opened.cards.length, 4);
      save = opened.save;
      openedPackIds.push(packId);
    }
  }
  assert.deepEqual(save.inventory.unopenedPacks, {});
  return save;
}

function completeAcademyAndShellshore(saveValue, openedPackIds) {
  let save = saveValue;
  for (const checkpointId of TUTORIAL_CHECKPOINT_IDS) {
    const checkpoint = recordTutorialCheckpoint(save, checkpointId);
    assert.equal(checkpoint.advanced, true);
    save = checkpoint.save;
  }
  save = recordAcademyPracticeVictory(save);

  // The production UI explicitly reconciles after this acknowledgement. Keep
  // that boundary visible so a later refactor cannot strand a ready quest.
  const reviewed = recordBoatSafetyReview(save);
  assert.equal(reviewed.applied, true);
  save = reconcileAdventureProgression(reviewed.save);

  const shellshoreDock = getAdventureDock("shellshore-dock");
  save = enterAdventureScene(save, {
    sceneId: shellshoreDock.sceneId,
    position: shellshoreDock.position,
    facing: shellshoreDock.facing,
  });
  for (const encounterId of SHELLSHORE_RESIDENT_ENCOUNTER_IDS) {
    save = completeAuthoredDuel(save, encounterId);
  }
  save = reconcileAdventureProgression(save);
  assert.equal(save.progression.quests[SHELLSHORE_QUEST_ID].status, "complete");
  save = openAllEarnedPacks(save, openedPackIds);
  return save;
}

function sailFirstVoyage(saveValue, routeId) {
  const route = getAdventureRoute(routeId);
  assert.ok(route, `Expected authored route ${routeId}.`);
  const originDock = getAdventureDock(route.fromDockId);
  assert.ok(originDock);
  let save = enterAdventureScene(saveValue, {
    sceneId: originDock.sceneId,
    position: originDock.position,
    facing: originDock.facing,
  });

  const travel = getRouteTravelState(save, route.id);
  assert.equal(travel.runtimeReady, true);
  assert.equal(travel.unlocked, true);
  assert.equal(travel.completed, false);
  assert.equal(travel.canBoardManual, true, travel.blockedReason);
  assert.equal(travel.canAutoSteer, false);
  save = boardAdventureRoute(save, {
    routeId: route.id,
    originDockId: route.fromDockId,
    mode: "manual",
  });
  assert.equal(save.world.sceneId, route.sceneId);

  const arrival = route.toSpawn?.position ?? route.toSpawn;
  assert.ok(Number.isFinite(arrival?.x) && Number.isFinite(arrival?.y));
  save = moveAdventureSession(save, {
    sceneId: route.sceneId,
    position: { x: arrival.x, y: arrival.y },
    facing: route.toSpawn?.facing ?? "left",
  });
  save = dockAdventureRoute(save, {
    routeId: route.id,
    destinationDockId: route.toDockId,
    mode: "manual",
  });
  assert.equal(save.world.townId, route.toTownId);
  assert.ok(save.world.completedRouteIds.includes(route.id));

  const chapter = ADVENTURE_ECOSYSTEM_CHAPTERS.find(
    (candidate) => candidate.townId === route.toTownId,
  );
  if (chapter) save = chapter.begin(save).save;
  else save = beginChampionsWakeQuestAtCurrentScene(save).save;
  return save;
}

function meetChapterTeam(saveValue, chapter) {
  let save = setQuestFlag(
    saveValue,
    chapter.questId,
    chapter.guideMetFlagId,
    true,
  );
  save = setQuestFlag(
    save,
    chapter.questId,
    chapter.ui.fieldPartnerMetFlagId,
    true,
  );
  assert.equal(hasMetAdventureEcosystemGuide(chapter, save), true);
  return save;
}

function completeChapterDuelsAndTurnIn(saveValue, chapter, openedPackIds) {
  let save = saveValue;
  const residentIds = chapter.getProgress(save).residentEncounterIds;
  for (const encounterId of residentIds) {
    save = completeAuthoredDuel(save, encounterId);
  }
  assert.equal(chapter.getProgress(save).readyToTurnIn, true);

  const turnedIn = chapter.turnIn(save);
  assert.equal(turnedIn.completed, true);
  assert.equal(turnedIn.rewardApplied, true);
  save = turnedIn.save;
  assert.ok(save.fieldNotes.entryIds.includes(chapter.fieldNoteId));

  const qualifier = ADVENTURE_CONTENT.encounters.find((encounter) => (
    encounter.questId === chapter.questId && encounter.role === "qualifier"
  ));
  assert.ok(qualifier, `Expected qualifier for ${chapter.questId}.`);
  save = completeAuthoredDuel(save, qualifier.id);
  assert.equal(chapter.getProgress(save).complete, true);
  save = openAllEarnedPacks(save, openedPackIds);
  return save;
}

function completeStandardChapter(saveValue, chapter, openedPackIds) {
  let save = meetChapterTeam(saveValue, chapter);
  const initialProgress = chapter.getProgress(save);
  for (const observationId of initialProgress.requiredObservationIds) {
    const observation = chapter.recordObservation(save, observationId);
    assert.equal(observation.applied, true);
    save = observation.save;
  }

  let progress = chapter.getProgress(save);
  const interpretation = chapter.submitInterpretation(
    save,
    progress.interpretation.correctChoiceId,
  );
  assert.equal(interpretation.correct, true);
  save = interpretation.save;
  progress = chapter.getProgress(save);
  const response = chapter.submitResponse(
    save,
    progress.response.correctChoiceId,
  );
  assert.equal(response.correct, true);
  save = response.save;
  return completeChapterDuelsAndTurnIn(save, chapter, openedPackIds);
}

function completeTrenchlightChapter(
  saveValue,
  chapter,
  openedPackIds,
  persistMidExpedition,
) {
  let save = meetChapterTeam(saveValue, chapter);
  save = enterAdventureScene(save, {
    sceneId: TRENCHLIGHT_MISSION_CONTROL_SCENE_ID,
    position: { x: 5, y: 6 },
    facing: "up",
  });
  save = launchTrenchlightExpedition(save).save;
  assert.equal(save.world.sceneId, TRENCHLIGHT_SUB_SCENE_ID);

  const surveyActions = [
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.lightMeter,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.pressureSensor,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.marineSnowCamera,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.passiveLowLightCamera,
  ];
  for (const actionId of surveyActions.slice(0, 2)) {
    save = advanceTrenchlightExpedition(save, actionId).save;
  }
  save = persistMidExpedition(save);
  assert.equal(getTrenchlightExpeditionState(save).phase, "survey");
  assert.equal(save.world.sceneId, TRENCHLIGHT_SUB_SCENE_ID);

  for (const actionId of surveyActions.slice(2)) {
    save = advanceTrenchlightExpedition(save, actionId).save;
  }
  assert.equal(getTrenchlightExpeditionState(save).phase, "analysis-required");
  save = returnTrenchlightExpeditionToStation(save).save;
  const progress = chapter.getProgress(save);
  save = chapter.submitInterpretation(
    save,
    progress.interpretation.correctChoiceId,
  ).save;

  save = launchTrenchlightExpedition(save).save;
  save = advanceTrenchlightExpedition(
    save,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.sensorRecovery,
  ).save;
  const expedition = getTrenchlightExpeditionState(save);
  assert.equal(expedition.phase, "expedition-complete");
  assert.equal(expedition.progress.habitatDisturbed, false);
  save = returnTrenchlightExpeditionToStation(save).save;
  return completeChapterDuelsAndTurnIn(save, chapter, openedPackIds);
}

function tournamentResultForLaunch(launch) {
  const encounter = getAdventureEncounter(launch.encounterId);
  assert.ok(encounter);
  return victoryResult(encounter, launch.playerDeckSnapshot);
}

function completeTournamentAndEnding(saveValue, adapter, manifest) {
  let save = saveValue;
  const availability = getChampionsWakeTournamentAvailability(save);
  assert.equal(availability.available, true, availability.reason);
  assert.deepEqual(availability.missingTideMarkIds, []);
  assert.deepEqual(availability.missingFieldNoteIds, []);

  const registration = registerChampionsWakeTournament(
    availability.save,
    cardsById,
  );
  assert.equal(registration.registered, true);
  assert.equal(registration.lockedDeckSnapshot.id, save.player.starterDeckId);
  assert.equal(
    registration.lockedDeckSnapshot.cards.reduce(
      (total, entry) => total + entry.quantity,
      0,
    ),
    60,
  );
  const lockedFingerprint = registration.lockedDeckSnapshot.fingerprint;
  save = persistAndResume(
    adapter,
    registration.save,
    `champions-wake:registered:${lockedFingerprint}`,
    manifest,
  );

  const lossLaunch = getChampionsWakeTournamentLaunch(save);
  assert.equal(lossLaunch.encounterId, CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[0]);
  const lossEncounter = getAdventureEncounter(lossLaunch.encounterId);
  assert.ok(lossEncounter);
  const loss = recordChampionsWakeTournamentResult(
    save,
    defeatResult(lossEncounter, lossLaunch.playerDeckSnapshot),
  );
  assert.equal(loss.applied, true);
  assert.equal(loss.attemptRecorded, true);
  assert.equal(loss.roundAdvanced, false);
  assert.equal(loss.tournamentComplete, false);
  assert.equal(loss.rewardApplied, false);
  assert.equal(loss.activeRoundId, lossLaunch.encounterId);
  assert.deepEqual(loss.save.progression.tournament.completedRoundIds, []);
  assert.equal(loss.save.inventory.storyItems[CHAMPIONSHIP_CUP_ID] ?? 0, 0);
  assert.equal(loss.save.rewardLedger.includes(CHAMPIONSHIP_REWARD_ID), false);
  assert.equal(
    loss.save.fieldNotes.entryIds.includes("field-note-archipelago-reflection"),
    false,
  );
  save = persistAndResume(
    adapter,
    loss.save,
    "champions-wake:quarterfinal-defeat",
    manifest,
  );
  const lossRecord = save.progression.encounterResults[lossLaunch.encounterId];
  assert.equal(lossRecord.attempts, 1);
  assert.equal(lossRecord.latest.outcome, "defeat");
  assert.equal(lossRecord.firstVictory, null);
  assert.deepEqual(getChampionsWakeTournamentLaunch(save), lossLaunch);

  for (const [index, encounterId] of CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.entries()) {
    assert.deepEqual(isAdventureEncounterAvailable(save, encounterId), {
      available: true,
      reason: null,
    });
    const launch = getChampionsWakeTournamentLaunch(save);
    assert.equal(launch.encounterId, encounterId);
    assert.equal(launch.victoryTarget, CHAMPIONS_WAKE_TOURNAMENT_VICTORY_TARGET);
    assert.equal(launch.playerDeckSnapshot.fingerprint, lockedFingerprint);
    const recorded = recordChampionsWakeTournamentResult(
      save,
      tournamentResultForLaunch(launch),
    );
    assert.equal(recorded.applied, true);
    assert.equal(recorded.roundAdvanced, true);
    assert.equal(recorded.tournamentComplete, index === 2);
    save = persistAndResume(
      adapter,
      recorded.save,
      `champions-wake:round-${index + 1}-victory`,
      manifest,
    );
  }

  assert.equal(getChampionsWakeTournamentProgress(save).complete, true);
  for (const flagId of CHAMPIONSHIP_ENDING_FLAG_IDS) {
    save = setQuestFlag(save, CHAMPIONS_WAKE_QUEST_ID, flagId, true);
    save = persistAndResume(
      adapter,
      save,
      `champions-wake:${flagId}`,
      manifest,
    );
  }
  for (const encounterId of CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS) {
    assert.deepEqual(isAdventureEncounterAvailable(save, encounterId), {
      available: true,
      reason: null,
      practiceOnly: true,
    });
  }
  return save;
}

function assertCompleteCampaign(save, starterDeckId, openedPackIds) {
  assert.equal(validateAdventureSave(save).valid, true);
  assert.equal(save.player.starterDeckId, starterDeckId);
  assert.equal(save.player.activeDeckId, starterDeckId);
  assert.equal(quantityTotal(save.savedDecks[starterDeckId].cards), 60);
  assert.equal(quantityTotal(save.inventory.cards), 84);
  assert.deepEqual(save.inventory.unopenedPacks, {});
  assert.deepEqual(openedPackIds, CAMPAIGN_PACK_IDS);
  assert.deepEqual(save.world.completedRouteIds, CAMPAIGN_ROUTE_IDS);
  assert.deepEqual(save.progression.tideMarkIds, CHAMPIONS_WAKE_REQUIRED_TIDE_MARK_IDS);
  assert.deepEqual(save.fieldNotes.entryIds, CAMPAIGN_FIELD_NOTE_IDS);
  assert.equal(save.inventory.storyItems[CHAMPIONSHIP_CUP_ID], 1);
  assert.equal(
    save.rewardLedger.filter((rewardId) => rewardId === CHAMPIONSHIP_REWARD_ID).length,
    1,
  );
  assert.equal(new Set(save.rewardLedger).size, save.rewardLedger.length);
  assert.equal(save.progression.tournament.status, "complete");
  assert.equal(save.progression.tournament.lockedDeckSnapshot.id, starterDeckId);
  assert.deepEqual(
    save.progression.tournament.completedRoundIds,
    CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS,
  );
  for (const flagId of CHAMPIONSHIP_ENDING_FLAG_IDS) {
    assert.equal(
      save.progression.quests[CHAMPIONS_WAKE_QUEST_ID].flags[flagId],
      true,
    );
  }

  const encounterResults = Object.entries(save.progression.encounterResults);
  assert.equal(encounterResults.length, 21);
  for (const [encounterId, record] of encounterResults) {
    assert.equal(
      record.attempts,
      encounterId === CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[0] ? 2 : 1,
    );
    assert.equal(record.firstVictory?.outcome, "victory");
  }
  for (const encounterId of CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS) {
    assert.equal(
      save.progression.encounterResults[encounterId].firstVictory.targetVp,
      CHAMPIONS_WAKE_TOURNAMENT_VICTORY_TARGET,
    );
  }
}

assert.deepEqual(
  ADVENTURE_ECOSYSTEM_CHAPTERS.map((chapter) => chapter.townId),
  CAMPAIGN_TOWN_IDS,
  "The campaign acceptance loop must fail visibly if authored chapter order changes.",
);

for (const [starterIndex, starterDeckId] of STARTER_DECK_IDS.entries()) {
  test(`a fresh ${starterDeckId} profile reaches Champion's Wake postgame without seeded progression`, () => {
    const profileId = ADVENTURE_PROFILE_IDS[starterIndex];
    const manifest = starterManifest(starterDeckId);
    const adapter = createAdventureStorageAdapter({
      backend: new MemoryStorage(),
      now: () => new Date("2026-07-19T12:00:00.000Z"),
    });
    const openedPackIds = [];

    let save = createNewAdventureSession(profileId);
    assert.equal(save.world.sceneId, "town");
    assert.deepEqual(save.world.position, { x: 16, y: 15.85 });
    assert.equal(save.world.facing, "up");
    const created = adapter.startNewProfile(profileId, { saveValue: save });
    assert.equal(created.ok, true, created.error?.message);
    save = recoverStoredCampaignSave(adapter.loadProfile(profileId).save, manifest);

    save = commitStarterSelection(save, starterDeckId).save;
    save = reconcileStarterCollection(save, manifest).save;
    save = persistAndResume(
      adapter,
      save,
      `starter-selected:${starterDeckId}`,
      manifest,
    );
    assert.equal(quantityTotal(save.inventory.cards), 60);

    save = completeAcademyAndShellshore(save, openedPackIds);
    save = persistAndResume(
      adapter,
      save,
      "shellshore:first-voyage-ready",
      manifest,
    );

    for (const [chapterIndex, chapter] of ADVENTURE_ECOSYSTEM_CHAPTERS.entries()) {
      save = sailFirstVoyage(save, CAMPAIGN_ROUTE_IDS[chapterIndex]);
      save = persistAndResume(
        adapter,
        save,
        `arrived:${chapter.townId}`,
        manifest,
      );
      save = chapter.townId === "trenchlight-station"
        ? completeTrenchlightChapter(
            save,
            chapter,
            openedPackIds,
            (partialSave) => persistAndResume(
              adapter,
              partialSave,
              "trenchlight:mid-survey",
              manifest,
            ),
          )
        : completeStandardChapter(save, chapter, openedPackIds);
      save = persistAndResume(
        adapter,
        save,
        `chapter-complete:${chapter.townId}`,
        manifest,
      );
    }

    save = sailFirstVoyage(save, CAMPAIGN_ROUTE_IDS.at(-1));
    save = persistAndResume(
      adapter,
      save,
      "arrived:champions-wake",
      manifest,
    );
    assert.equal(save.world.townId, "champions-wake");
    assert.equal(save.progression.quests[CHAMPIONS_WAKE_QUEST_ID].status, "active");

    save = completeTournamentAndEnding(save, adapter, manifest);
    assertCompleteCampaign(save, starterDeckId, openedPackIds);

    // Completed-route travel remains usable after the ending. This is a state
    // contract only; responsive postgame navigation is covered in UI/browser QA.
    const finalRoute = getAdventureRoute(CAMPAIGN_ROUTE_IDS.at(-1));
    save = autoSteerAdventureRoute(save, {
      routeId: finalRoute.id,
      destinationDockId: finalRoute.fromDockId,
    });
    save = persistAndResume(
      adapter,
      save,
      "postgame:return-to-trenchlight",
      manifest,
    );
    assert.equal(save.world.townId, "trenchlight-station");
    assertCompleteCampaign(save, starterDeckId, openedPackIds);
  });
}
