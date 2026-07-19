import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialAdventureSave,
  normalizeAdventureSave,
  validateAdventureSave,
} from "./adventureProgression.mjs";
import {
  BRACKWATER_QUEST_ID,
  BRACKWATER_RESIDENT_ENCOUNTER_IDS,
  getBrackwaterProgress,
} from "./adventureBrackwater.mjs";
import {
  CURRENT_QUEST_ID,
  CURRENT_RESIDENT_ENCOUNTER_IDS,
  getCurrentProgress,
} from "./adventureCurrent.mjs";
import {
  KELPWATCH_QUEST_ID,
  KELPWATCH_RESIDENT_ENCOUNTER_IDS,
  getKelpwatchProgress,
} from "./adventureKelpwatch.mjs";
import {
  TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
  TRENCHLIGHT_CORRECT_RESPONSE_ID,
  TRENCHLIGHT_QUEST_ID,
  TRENCHLIGHT_RESIDENT_ENCOUNTER_IDS,
  beginTrenchlightExpedition,
  submitTrenchlightInterpretation,
} from "./adventureTrenchlight.mjs";
import {
  TRENCHLIGHT_EXPEDITION_TOOL_IDS,
  TRENCHLIGHT_MISSION_CONTROL_SCENE_ID,
  TRENCHLIGHT_SUB_RETURN_LOCATION,
  TRENCHLIGHT_SUB_SCENE_ID,
  advanceTrenchlightExpedition,
  getTrenchlightExpeditionState,
  launchTrenchlightExpedition,
  returnTrenchlightExpeditionToStation,
} from "./adventureTrenchlightExpedition.mjs";
import {
  ADVENTURE_ECOSYSTEM_CHAPTERS,
} from "./adventureEcosystemChapters.mjs";
import {
  SUNPATCH_QUEST_ID,
  SUNPATCH_RESIDENT_ENCOUNTER_IDS,
} from "./adventureSunpatch.mjs";
import {
  SCENES,
  canOccupyContinuousPosition,
} from "./adventureWorld.mjs";
import {
  SHELLSHORE_QUEST_ID,
  completeAdventureEncounter,
  createNewAdventureSession,
  enterAdventureScene,
  isAdventureEncounterAvailable,
  moveAdventureSession,
  recordAdventureDuelResult,
  recoverAdventureResume,
} from "./adventureSession.mjs";

const CHAPTER_WORLD_BY_TOWN_ID = Object.freeze({
  "sunpatch-cay": Object.freeze({ sceneId: "sunpatch-cay-town", dockId: "sunpatch-dock" }),
  "brackwater-landing": Object.freeze({ sceneId: "brackwater-landing-town", dockId: "brackwater-dock" }),
  "current-commons": Object.freeze({ sceneId: "current-commons-town", dockId: "current-commons-dock" }),
  "kelpwatch-island": Object.freeze({ sceneId: "kelpwatch-island-town", dockId: "kelpwatch-dock" }),
  "trenchlight-station": Object.freeze({ sceneId: "trenchlight-station-town", dockId: "trenchlight-dock" }),
});

const CHAPTER_REWARD_ID_BY_QUEST_ID = Object.freeze({
  [SUNPATCH_QUEST_ID]: "reward-sunpatch-fieldwork",
  [BRACKWATER_QUEST_ID]: "reward-brackwater-fieldwork",
  [CURRENT_QUEST_ID]: "reward-current-fieldwork",
  [KELPWATCH_QUEST_ID]: "reward-kelpwatch-fieldwork",
  [TRENCHLIGHT_QUEST_ID]: "reward-trenchlight-fieldwork",
});

function completeChapterForRecovery(chapter, profileId) {
  let result = chapter.begin(createInitialAdventureSave(profileId));
  for (const observationId of result.progress.requiredObservationIds) {
    result = chapter.recordObservation(result.save, observationId);
  }
  result = chapter.submitInterpretation(
    result.save,
    result.progress.interpretation.correctChoiceId,
  );
  result = chapter.submitResponse(
    result.save,
    result.progress.response.correctChoiceId,
  );

  const { sceneId, dockId } = CHAPTER_WORLD_BY_TOWN_ID[chapter.townId];
  let save = normalizeAdventureSave({
    ...result.save,
    world: {
      ...result.save.world,
      townId: chapter.townId,
      sceneId,
      position: SCENES[sceneId].spawn,
      lastSafeDockId: dockId,
    },
    progression: {
      ...result.save.progression,
      quests: {
        ...result.save.progression.quests,
        [SHELLSHORE_QUEST_ID]: {
          status: "complete",
          flags: { "boat-safety-reviewed": true },
        },
      },
      completedEncounterIds: [
        ...new Set([
          ...result.save.progression.completedEncounterIds,
          ...result.progress.residentEncounterIds,
        ]),
      ],
    },
  });
  save = chapter.reconcile(save).save;
  assert.equal(chapter.getProgress(save).readyToTurnIn, true);
  return chapter.turnIn(save).save;
}

function atTrenchlightMissionControl(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  return normalizeAdventureSave({
    ...save,
    world: {
      ...save.world,
      townId: "trenchlight-station",
      sceneId: TRENCHLIGHT_MISSION_CONTROL_SCENE_ID,
      position: { ...TRENCHLIGHT_SUB_RETURN_LOCATION.position },
      facing: TRENCHLIGHT_SUB_RETURN_LOCATION.facing,
      lastSafeDockId: "trenchlight-dock",
    },
  });
}

function startedTrenchlightSession(profileId) {
  const session = atTrenchlightMissionControl(createNewAdventureSession(profileId));
  return beginTrenchlightExpedition(session).save;
}

function finishTrenchlightSurvey(saveValue) {
  let save = saveValue;
  for (const actionId of [
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.lightMeter,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.pressureSensor,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.marineSnowCamera,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.passiveLowLightCamera,
  ]) {
    save = advanceTrenchlightExpedition(save, actionId).save;
  }
  return save;
}

function withTrenchlightResumeSentinels(saveValue, suffix) {
  const save = normalizeAdventureSave(saveValue);
  return normalizeAdventureSave({
    ...save,
    playtimeSeconds: 240 + suffix.length,
    inventory: {
      ...save.inventory,
      storyItems: {
        ...save.inventory.storyItems,
        [`trenchlight-resume-keepsake-${suffix}`]: 2,
      },
    },
    progression: {
      ...save.progression,
      quests: {
        ...save.progression.quests,
        [`quest-trenchlight-resume-side-story-${suffix}`]: {
          status: "active",
          flags: { checkpoint: suffix },
        },
      },
    },
  });
}

test("new sessions begin the Shellshore quest in one of three explicit profiles", () => {
  const save = createNewAdventureSession("profile-2");
  assert.equal(save.profileId, "profile-2");
  assert.equal(save.progression.quests[SHELLSHORE_QUEST_ID].status, "active");
  assert.equal(save.world.sceneId, "academy-lab");
  assert.deepEqual(save.world.position, { x: 6, y: 7 });
  assert.equal(save.world.facing, "up");
});

test("scene transitions persist a safe position and a meaningful quest flag", () => {
  const initial = createNewAdventureSession("profile-1");
  const entered = enterAdventureScene(initial, {
    sceneId: "coral-home",
    position: { x: 5, y: 6 },
    facing: "up",
  });

  assert.equal(entered.world.sceneId, "coral-home");
  assert.deepEqual(entered.world.position, { x: 5, y: 6 });
  assert.equal(
    entered.progression.quests[SHELLSHORE_QUEST_ID].flags["visited-coral-home"],
    true,
  );
});

test("entering any registered ecosystem town begins its chapter", () => {
  for (const { sceneId, questId } of [
    { sceneId: "sunpatch-cay-town", questId: SUNPATCH_QUEST_ID },
    { sceneId: "brackwater-landing-town", questId: BRACKWATER_QUEST_ID },
    { sceneId: "current-commons-town", questId: CURRENT_QUEST_ID },
    { sceneId: "kelpwatch-island-town", questId: KELPWATCH_QUEST_ID },
    { sceneId: "trenchlight-station-town", questId: TRENCHLIGHT_QUEST_ID },
  ]) {
    const scene = SCENES[sceneId];
    const entered = enterAdventureScene(createNewAdventureSession("profile-1"), {
      sceneId,
      position: scene.spawn,
      facing: "up",
    });
    assert.equal(entered.progression.quests[questId].status, "active");
  }
});

test("resuming in any registered ecosystem town begins its missing chapter after JSON reload", () => {
  for (const chapter of ADVENTURE_ECOSYSTEM_CHAPTERS) {
    const { sceneId, dockId } = CHAPTER_WORLD_BY_TOWN_ID[chapter.townId];
    const scene = SCENES[sceneId];
    const initial = createInitialAdventureSave("profile-2");
    const loaded = JSON.parse(JSON.stringify({
      ...initial,
      world: {
        ...initial.world,
        townId: chapter.townId,
        sceneId,
        position: scene.spawn,
        lastSafeDockId: dockId,
      },
    }));

    const recovered = recoverAdventureResume(loaded);
    assert.equal(recovered.recovered, true);
    assert.equal(recovered.reason, "quest-state-reconciled");
    assert.equal(
      recovered.save.progression.quests[chapter.questId].status,
      "active",
    );
  }
});

test("resident wins alone never bypass registered ecosystem fieldwork", () => {
  for (const { sceneId, questId, encounterIds } of [
    {
      sceneId: "sunpatch-cay-town",
      questId: SUNPATCH_QUEST_ID,
      encounterIds: SUNPATCH_RESIDENT_ENCOUNTER_IDS,
    },
    {
      sceneId: "brackwater-landing-town",
      questId: BRACKWATER_QUEST_ID,
      encounterIds: BRACKWATER_RESIDENT_ENCOUNTER_IDS,
    },
    {
      sceneId: "current-commons-town",
      questId: CURRENT_QUEST_ID,
      encounterIds: CURRENT_RESIDENT_ENCOUNTER_IDS,
    },
    {
      sceneId: "kelpwatch-island-town",
      questId: KELPWATCH_QUEST_ID,
      encounterIds: KELPWATCH_RESIDENT_ENCOUNTER_IDS,
    },
    {
      sceneId: "trenchlight-station-town",
      questId: TRENCHLIGHT_QUEST_ID,
      encounterIds: TRENCHLIGHT_RESIDENT_ENCOUNTER_IDS,
    },
  ]) {
    let save = enterAdventureScene(createNewAdventureSession("profile-3"), {
      sceneId,
      position: SCENES[sceneId].spawn,
      facing: "up",
    });
    for (const encounterId of encounterIds) {
      save = completeAdventureEncounter(save, { encounterId });
    }
    assert.equal(save.progression.quests[questId].status, "active");
  }
});

test("inconsistent terminal ecosystem saves cannot unlock qualifier encounters", () => {
  for (const { questId, qualifierId } of [
    {
      questId: SUNPATCH_QUEST_ID,
      qualifierId: "encounter-sunpatch-qualifier",
    },
    {
      questId: BRACKWATER_QUEST_ID,
      qualifierId: "encounter-brackwater-qualifier",
    },
    {
      questId: CURRENT_QUEST_ID,
      qualifierId: "encounter-current-qualifier",
    },
    {
      questId: KELPWATCH_QUEST_ID,
      qualifierId: "encounter-kelpwatch-qualifier",
    },
    {
      questId: TRENCHLIGHT_QUEST_ID,
      qualifierId: "encounter-trenchlight-qualifier",
    },
  ]) {
    const initial = createInitialAdventureSave(`corrupt-${questId}`);
    const inconsistent = normalizeAdventureSave({
      ...initial,
      progression: {
        ...initial.progression,
        quests: {
          ...initial.progression.quests,
          [questId]: { status: "complete", flags: {} },
        },
      },
    });

    const recovered = recoverAdventureResume(JSON.parse(JSON.stringify(inconsistent))).save;
    const availability = isAdventureEncounterAvailable(recovered, qualifierId);
    assert.equal(availability.available, false);
    assert.match(availability.reason, /incomplete or inconsistent/i);
  }
});

test("resume reconciliation loops every ecosystem adapter after storage reload", () => {
  for (const chapter of ADVENTURE_ECOSYSTEM_CHAPTERS) {
    const { sceneId, dockId } = CHAPTER_WORLD_BY_TOWN_ID[chapter.townId];
    let result = chapter.begin(createInitialAdventureSave("profile-1"));
    for (const observationId of result.progress.requiredObservationIds) {
      result = chapter.recordObservation(result.save, observationId);
    }
    result = chapter.submitInterpretation(
      result.save,
      result.progress.interpretation.correctChoiceId,
    );
    result = chapter.submitResponse(
      result.save,
      result.progress.response.correctChoiceId,
    );
    let save = normalizeAdventureSave({
      ...result.save,
      world: {
        ...result.save.world,
        townId: chapter.townId,
        sceneId,
        position: SCENES[sceneId].spawn,
        lastSafeDockId: dockId,
      },
      progression: {
        ...result.save.progression,
        completedEncounterIds: [
          ...result.save.progression.completedEncounterIds,
          ...result.progress.residentEncounterIds,
        ],
      },
    });
    assert.equal(save.progression.quests[chapter.questId].status, "active");

    const recovered = recoverAdventureResume(JSON.parse(JSON.stringify(save)));
    assert.equal(
      recovered.save.progression.quests[chapter.questId].status,
      "readyToTurnIn",
    );
    assert.equal(recovered.reason, "quest-state-reconciled");
  }
});

test("JSON reload resumes active Trenchlight survey and recovery legs in the submersible", () => {
  let survey = launchTrenchlightExpedition(
    startedTrenchlightSession("trenchlight-session-survey-resume"),
  ).save;
  survey = advanceTrenchlightExpedition(
    survey,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.lightMeter,
  ).save;

  let recovery = launchTrenchlightExpedition(
    startedTrenchlightSession("trenchlight-session-recovery-resume"),
  ).save;
  recovery = finishTrenchlightSurvey(recovery);
  recovery = returnTrenchlightExpeditionToStation(recovery).save;
  recovery = submitTrenchlightInterpretation(
    recovery,
    TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
  ).save;
  recovery = launchTrenchlightExpedition(recovery).save;
  recovery = advanceTrenchlightExpedition(
    recovery,
    "trenchlight-grab-sensor-immediately",
  ).save;

  for (const { phase, source } of [
    { phase: "survey", source: survey },
    { phase: "recovery", source: recovery },
  ]) {
    const loaded = JSON.parse(JSON.stringify(
      withTrenchlightResumeSentinels(source, phase),
    ));
    const resumed = recoverAdventureResume(loaded);

    assert.equal(resumed.recovered, false, `${phase} should not be relocated`);
    assert.equal(resumed.reason, null);
    assert.equal(resumed.fallback, null);
    assert.deepEqual(resumed.save, loaded, `${phase} reload should preserve the full save`);
    assert.equal(resumed.save.world.sceneId, TRENCHLIGHT_SUB_SCENE_ID);
    assert.equal(getTrenchlightExpeditionState(resumed.save).phase, phase);
    assert.equal(getTrenchlightExpeditionState(resumed.save).inSub, true);

    const stable = recoverAdventureResume(JSON.parse(JSON.stringify(resumed.save)));
    assert.equal(stable.recovered, false);
    assert.deepEqual(stable.save, resumed.save);
  }
});

test("JSON reload returns terminal and impossible Trenchlight sub states to Mission Control", () => {
  const baseNotStarted = createNewAdventureSession(
    "trenchlight-session-not-started-resume",
  );
  const notStarted = normalizeAdventureSave({
    ...baseNotStarted,
    world: {
      ...baseNotStarted.world,
      townId: "trenchlight-station",
      sceneId: TRENCHLIGHT_SUB_SCENE_ID,
      position: { x: 7, y: 8 },
      facing: "up",
      lastSafeDockId: "trenchlight-dock",
    },
  });

  let analysisRequired = launchTrenchlightExpedition(
    startedTrenchlightSession("trenchlight-session-analysis-resume"),
  ).save;
  analysisRequired = finishTrenchlightSurvey(analysisRequired);

  let expeditionComplete = returnTrenchlightExpeditionToStation(
    analysisRequired,
  ).save;
  expeditionComplete = submitTrenchlightInterpretation(
    expeditionComplete,
    TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
  ).save;
  expeditionComplete = launchTrenchlightExpedition(expeditionComplete).save;
  expeditionComplete = advanceTrenchlightExpedition(
    expeditionComplete,
    TRENCHLIGHT_CORRECT_RESPONSE_ID,
  ).save;

  for (const {
    phase,
    source,
    canonicalReason,
    resumedPhase,
  } of [
    {
      phase: "not-started",
      source: notStarted,
      canonicalReason: "quest-state-reconciled",
      resumedPhase: "survey",
    },
    {
      phase: "analysis-required",
      source: analysisRequired,
      canonicalReason: "analysis-required-at-mission-control",
      resumedPhase: "analysis-required",
    },
    {
      phase: "expedition-complete",
      source: expeditionComplete,
      canonicalReason: "expedition-complete",
      resumedPhase: "expedition-complete",
    },
  ]) {
    const suffix = phase.replaceAll("-", "_");
    const loaded = JSON.parse(JSON.stringify(
      withTrenchlightResumeSentinels(source, suffix),
    ));
    const resumed = recoverAdventureResume(loaded);
    const expectedAtMissionControl = normalizeAdventureSave({
      ...loaded,
      world: {
        ...loaded.world,
        townId: TRENCHLIGHT_SUB_RETURN_LOCATION.townId,
        sceneId: TRENCHLIGHT_SUB_RETURN_LOCATION.sceneId,
        position: { ...TRENCHLIGHT_SUB_RETURN_LOCATION.position },
        facing: TRENCHLIGHT_SUB_RETURN_LOCATION.facing,
      },
    });
    const expectedSave = phase === "not-started"
      ? beginTrenchlightExpedition(expectedAtMissionControl).save
      : expectedAtMissionControl;

    assert.equal(resumed.recovered, true);
    assert.equal(resumed.reason, canonicalReason);
    assert.equal(resumed.fallback, null);
    assert.equal(resumed.save.world.townId, TRENCHLIGHT_SUB_RETURN_LOCATION.townId);
    assert.equal(resumed.save.world.sceneId, TRENCHLIGHT_SUB_RETURN_LOCATION.sceneId);
    assert.deepEqual(
      resumed.save.world.position,
      TRENCHLIGHT_SUB_RETURN_LOCATION.position,
    );
    assert.equal(resumed.save.world.facing, TRENCHLIGHT_SUB_RETURN_LOCATION.facing);
    assert.equal(
      canOccupyContinuousPosition(
        TRENCHLIGHT_MISSION_CONTROL_SCENE_ID,
        resumed.save.world.position,
      ),
      true,
      `${phase} should recover to a traversable Mission Control position`,
    );
    assert.equal(getTrenchlightExpeditionState(resumed.save).inSub, false);
    assert.equal(getTrenchlightExpeditionState(resumed.save).phase, resumedPhase);
    assert.deepEqual(
      resumed.save.progression.quests[`quest-trenchlight-resume-side-story-${suffix}`],
      { status: "active", flags: { checkpoint: suffix } },
    );
    assert.equal(
      resumed.save.inventory.storyItems[`trenchlight-resume-keepsake-${suffix}`],
      2,
    );
    assert.equal(resumed.save.playtimeSeconds, 240 + suffix.length);
    assert.deepEqual(
      resumed.save,
      expectedSave,
      `${phase} recovery should change only the expedition location and required chapter start`,
    );

    const stable = recoverAdventureResume(JSON.parse(JSON.stringify(resumed.save)));
    assert.equal(stable.recovered, false, `${phase} recovery should be idempotent`);
    assert.equal(stable.reason, null);
    assert.equal(stable.fallback, null);
    assert.deepEqual(stable.save, resumed.save);
  }
});

test("resume discards malformed persisted Brackwater flags without losing unrelated progress", () => {
  const save = createNewAdventureSession("brackwater-flag-recovery");
  save.progression.quests[BRACKWATER_QUEST_ID] = {
    status: "active",
    flags: {
      "future-chapter-marker": "keep-me",
      "interpretation-corrective-attempts": 1.5,
      "interpretation-last-choice": 7,
      "observed-incoming-tide-channel": "yes",
      "observed-rain-fed-creek-mouth": true,
    },
  };
  save.progression.quests["quest-side-story"] = {
    status: "active",
    flags: { "story-progress": 7 },
  };
  save.inventory.storyItems["keepsake-shell"] = 2;
  save.playtimeSeconds = 42;

  const loaded = JSON.parse(JSON.stringify(save));
  assert.equal(validateAdventureSave(loaded).valid, true);

  const recovered = recoverAdventureResume(loaded);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.reason, "chapter-quest-flags-recovered");
  assert.equal(recovered.fallback, null);
  assert.deepEqual(recovered.recoveryMetadata, {
    chapterQuestRepairs: [{
      questId: BRACKWATER_QUEST_ID,
      discardedFlagIds: [
        "interpretation-corrective-attempts",
        "interpretation-last-choice",
        "observed-incoming-tide-channel",
      ],
    }],
  });
  assert.deepEqual(
    recovered.save.progression.quests[BRACKWATER_QUEST_ID].flags,
    {
      "future-chapter-marker": "keep-me",
      "observed-rain-fed-creek-mouth": true,
    },
  );
  assert.deepEqual(recovered.save.progression.quests["quest-side-story"], {
    status: "active",
    flags: { "story-progress": 7 },
  });
  assert.equal(recovered.save.inventory.storyItems["keepsake-shell"], 2);
  assert.equal(recovered.save.playtimeSeconds, 42);
  assert.deepEqual(
    getBrackwaterProgress(recovered.save).observedObservationIds,
    ["rain-fed-creek-mouth"],
  );

  const stable = recoverAdventureResume(JSON.parse(JSON.stringify(recovered.save)));
  assert.equal(stable.recovered, false);
  assert.equal(stable.reason, null);
  assert.equal(stable.recoveryMetadata, undefined);
  assert.deepEqual(stable.save, recovered.save);
});

test("resume discards malformed persisted Current Commons flags without losing unrelated progress", () => {
  const save = createNewAdventureSession("current-flag-recovery");
  save.progression.quests[CURRENT_QUEST_ID] = {
    status: "active",
    flags: {
      "future-current-marker": "keep-me",
      "response-corrective-attempts": -1,
      "response-last-choice": 7,
      "observed-surface-drifter-track": "yes",
      "observed-source-port-loss-report": true,
    },
  };
  save.progression.quests["quest-side-story"] = {
    status: "active",
    flags: { "story-progress": 8 },
  };
  save.inventory.storyItems["current-keepsake"] = 1;
  save.playtimeSeconds = 84;

  const loaded = JSON.parse(JSON.stringify(save));
  assert.equal(validateAdventureSave(loaded).valid, true);

  const recovered = recoverAdventureResume(loaded);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.reason, "chapter-quest-flags-recovered");
  assert.equal(recovered.fallback, null);
  assert.deepEqual(recovered.recoveryMetadata, {
    chapterQuestRepairs: [{
      questId: CURRENT_QUEST_ID,
      discardedFlagIds: [
        "observed-surface-drifter-track",
        "response-corrective-attempts",
        "response-last-choice",
      ],
    }],
  });
  assert.deepEqual(
    recovered.save.progression.quests[CURRENT_QUEST_ID].flags,
    {
      "future-current-marker": "keep-me",
      "observed-source-port-loss-report": true,
    },
  );
  assert.deepEqual(recovered.save.progression.quests["quest-side-story"], {
    status: "active",
    flags: { "story-progress": 8 },
  });
  assert.equal(recovered.save.inventory.storyItems["current-keepsake"], 1);
  assert.equal(recovered.save.playtimeSeconds, 84);
  assert.deepEqual(
    getCurrentProgress(recovered.save).observedObservationIds,
    ["source-port-loss-report"],
  );

  const stable = recoverAdventureResume(JSON.parse(JSON.stringify(recovered.save)));
  assert.equal(stable.recovered, false);
  assert.equal(stable.reason, null);
  assert.equal(stable.recoveryMetadata, undefined);
  assert.deepEqual(stable.save, recovered.save);
});

test("resume discards malformed persisted Kelpwatch flags without losing unrelated progress", () => {
  const save = createNewAdventureSession("kelpwatch-flag-recovery");
  save.progression.quests[KELPWATCH_QUEST_ID] = {
    status: "active",
    flags: {
      "future-kelpwatch-marker": "keep-me",
      "interpretation-corrective-attempts": 1.5,
      "interpretation-last-choice": 7,
      "observed-predator-evidence-survey": "yes",
      "observed-kelp-cover-transect": true,
    },
  };
  save.progression.quests["quest-side-story"] = {
    status: "active",
    flags: { "story-progress": 9 },
  };
  save.inventory.storyItems["kelpwatch-keepsake"] = 1;
  save.playtimeSeconds = 126;

  const loaded = JSON.parse(JSON.stringify(save));
  assert.equal(validateAdventureSave(loaded).valid, true);

  const recovered = recoverAdventureResume(loaded);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.reason, "chapter-quest-flags-recovered");
  assert.equal(recovered.fallback, null);
  assert.deepEqual(recovered.recoveryMetadata, {
    chapterQuestRepairs: [{
      questId: KELPWATCH_QUEST_ID,
      discardedFlagIds: [
        "interpretation-corrective-attempts",
        "interpretation-last-choice",
        "observed-predator-evidence-survey",
      ],
    }],
  });
  assert.deepEqual(
    recovered.save.progression.quests[KELPWATCH_QUEST_ID].flags,
    {
      "future-kelpwatch-marker": "keep-me",
      "observed-kelp-cover-transect": true,
    },
  );
  assert.deepEqual(recovered.save.progression.quests["quest-side-story"], {
    status: "active",
    flags: { "story-progress": 9 },
  });
  assert.equal(recovered.save.inventory.storyItems["kelpwatch-keepsake"], 1);
  assert.equal(recovered.save.playtimeSeconds, 126);
  assert.deepEqual(
    getKelpwatchProgress(recovered.save).observedObservationIds,
    ["kelp-cover-transect"],
  );

  const stable = recoverAdventureResume(JSON.parse(JSON.stringify(recovered.save)));
  assert.equal(stable.recovered, false);
  assert.equal(stable.reason, null);
  assert.equal(stable.recoveryMetadata, undefined);
  assert.deepEqual(stable.save, recovered.save);
});

test("resume reopens terminal chapters when recovery discards a required typed flag", () => {
  for (const questId of [BRACKWATER_QUEST_ID, CURRENT_QUEST_ID, KELPWATCH_QUEST_ID]) {
    const chapter = ADVENTURE_ECOSYSTEM_CHAPTERS.find(
      (candidate) => candidate.questId === questId,
    );
    for (const terminalStatus of ["readyToTurnIn", "complete"]) {
      const completed = completeChapterForRecovery(
        chapter,
        `terminal-reopen-${questId}-${terminalStatus.toLowerCase()}`,
      );
      const quest = completed.progression.quests[questId];
      const terminalSave = terminalStatus === "readyToTurnIn"
        ? { ...completed, fieldNotes: { entryIds: [] }, rewardLedger: [] }
        : completed;
      const malformed = normalizeAdventureSave({
        ...terminalSave,
        progression: {
          ...terminalSave.progression,
          quests: {
            ...terminalSave.progression.quests,
            [questId]: {
              ...quest,
              status: terminalStatus,
              flags: { ...quest.flags, "response-correct": "yes" },
            },
          },
        },
      });

      const recovered = recoverAdventureResume(JSON.parse(JSON.stringify(malformed)));
      const progress = chapter.getProgress(recovered.save);
      assert.equal(recovered.recovered, true);
      assert.equal(recovered.reason, "chapter-quest-flags-recovered");
      assert.deepEqual(recovered.recoveryMetadata, {
        chapterQuestRepairs: [{
          questId,
          discardedFlagIds: ["response-correct"],
        }],
      });
      assert.equal(progress.status, "active");
      assert.equal(progress.stateConsistent, true);
      assert.equal(progress.response.correct, false);
      assert.equal(progress.response.available, true);

      const corrected = chapter.submitResponse(
        recovered.save,
        progress.response.correctChoiceId,
      );
      assert.equal(corrected.correct, true);
      assert.equal(corrected.progress.readyToTurnIn, true);
      const turnedIn = chapter.turnIn(corrected.save);
      assert.equal(turnedIn.progress.complete, true);
      assert.equal(turnedIn.rewardApplied, terminalStatus === "readyToTurnIn");
      assert.deepEqual(turnedIn.save.fieldNotes.entryIds, [chapter.fieldNoteId]);
      assert.deepEqual(turnedIn.save.rewardLedger, [
        CHAPTER_REWARD_ID_BY_QUEST_ID[questId],
      ]);
    }
  }
});

test("resume restores missing completed-chapter rewards and Field Notes exactly once", () => {
  for (const chapter of ADVENTURE_ECOSYSTEM_CHAPTERS) {
    const completed = completeChapterForRecovery(
      chapter,
      `chapter-reward-recovery-${chapter.questId}`,
    );
    const interrupted = normalizeAdventureSave({
      ...completed,
      fieldNotes: { entryIds: [] },
      rewardLedger: [],
    });

    const recovered = recoverAdventureResume(JSON.parse(JSON.stringify(interrupted)));
    assert.equal(recovered.recovered, true);
    assert.equal(recovered.reason, "chapter-reward-reconciled");
    assert.equal(chapter.getProgress(recovered.save).complete, true);
    assert.deepEqual(recovered.save.fieldNotes.entryIds, [chapter.fieldNoteId]);
    assert.deepEqual(recovered.save.rewardLedger, [
      CHAPTER_REWARD_ID_BY_QUEST_ID[chapter.questId],
    ]);

    const stable = recoverAdventureResume(JSON.parse(JSON.stringify(recovered.save)));
    assert.equal(stable.recovered, false);
    assert.equal(stable.reason, null);
    assert.deepEqual(stable.save, recovered.save);
  }

  const currentChapter = ADVENTURE_ECOSYSTEM_CHAPTERS.find(
    (chapter) => chapter.questId === CURRENT_QUEST_ID,
  );
  const completedCurrent = completeChapterForRecovery(
    currentChapter,
    "chapter-note-recovery-ledger-survived",
  );
  const ledgerSurvived = normalizeAdventureSave({
    ...completedCurrent,
    fieldNotes: { entryIds: [] },
  });
  const noteRecovered = recoverAdventureResume(ledgerSurvived);
  assert.equal(noteRecovered.recovered, true);
  assert.equal(noteRecovered.reason, "chapter-reward-reconciled");
  assert.deepEqual(noteRecovered.save.fieldNotes.entryIds, [currentChapter.fieldNoteId]);
  assert.deepEqual(noteRecovered.save.rewardLedger, [
    CHAPTER_REWARD_ID_BY_QUEST_ID[CURRENT_QUEST_ID],
  ]);
});

test("unsafe writes are rejected and unsafe loaded positions recover to the scene spawn", () => {
  const initial = createNewAdventureSession("profile-1");
  assert.throws(
    () => moveAdventureSession(initial, {
      sceneId: "coral-home",
      position: { x: 0, y: 0 },
      facing: "down",
    }),
    /not safe/,
  );

  const unsafe = {
    ...initial,
    world: {
      ...initial.world,
      sceneId: "deep-home",
      position: { x: 0, y: 0 },
    },
  };
  const recovered = recoverAdventureResume(unsafe);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.reason, "unsafe-position");
  assert.equal(recovered.fallback, "scene-spawn");
  assert.deepEqual(recovered.save.world.position, { x: 5, y: 6 });
});

test("resume recovery rejects positions inside authored interior furniture", () => {
  const initial = createNewAdventureSession("profile-1");
  const academy = SCENES["academy-lab"];
  const furniture = academy.collisionRects.find(
    (rectangle) => rectangle.id === "academy-left-aquarium-workstation",
  );
  const furniturePosition = { x: 4, y: 5 };

  assert.ok(furniture, "academy furniture collision rectangle should be authored");
  assert.equal(academy.tiles[furniturePosition.y][furniturePosition.x], "r");
  assert.equal(canOccupyContinuousPosition(academy.id, furniturePosition), false);

  const recovered = recoverAdventureResume({
    ...initial,
    world: {
      ...initial.world,
      sceneId: academy.id,
      position: furniturePosition,
    },
  });

  assert.equal(recovered.recovered, true);
  assert.equal(recovered.reason, "unsafe-position");
  assert.equal(recovered.fallback, "scene-spawn");
  assert.deepEqual(recovered.save.world.position, academy.spawn);
});

test("all live portals use safe spawns and preserve their authored arrival facing", () => {
  const initial = createNewAdventureSession("profile-1");
  let portalCount = 0;

  for (const sourceScene of Object.values(SCENES)) {
    for (const portal of sourceScene.interactions) {
      if (portal.type !== "enter" && portal.type !== "exit") continue;
      portalCount += 1;

      const targetScene = SCENES[portal.targetScene];
      assert.ok(
        targetScene,
        `${sourceScene.id}/${portal.id} should target a live scene`,
      );
      assert.equal(
        canOccupyContinuousPosition(portal.targetScene, portal.spawn),
        true,
        `${sourceScene.id}/${portal.id} should use a safe target spawn`,
      );
      assert.equal(
        portal.facing,
        portal.type === "enter" ? "up" : "down",
        `${sourceScene.id}/${portal.id} should face into its destination`,
      );

      const entered = enterAdventureScene(initial, {
        sceneId: portal.targetScene,
        position: portal.spawn,
        facing: portal.facing,
      });
      assert.equal(entered.world.sceneId, portal.targetScene);
      assert.deepEqual(entered.world.position, portal.spawn);
      assert.equal(entered.world.facing, portal.facing);
    }
  }

  assert.equal(
    portalCount,
    43,
    "all live Shellshore, Sunpatch, Brackwater, Current Commons, Kelpwatch, Trenchlight, and Champion's Wake entrances and exits should be covered",
  );
});

test("stale scene IDs recover to the authored adventure start", () => {
  const initial = createInitialAdventureSave("profile-3");
  const recovered = recoverAdventureResume({
    ...initial,
    world: { ...initial.world, sceneId: "retired-prototype-map" },
  });

  assert.equal(recovered.recovered, true);
  assert.equal(recovered.reason, "unknown-scene");
  assert.equal(recovered.fallback, "safe-dock");
  assert.equal(recovered.save.world.sceneId, "town");
  assert.deepEqual(recovered.save.world.position, { x: 7, y: 8 });
});

test("cross-town scenes use the last safe dock and stale docks use the global start", () => {
  const initial = createInitialAdventureSave("profile-3");
  const mismatch = recoverAdventureResume({
    ...initial,
    world: {
      ...initial.world,
      townId: "sunpatch-cay",
      sceneId: "coral-home",
      position: { x: 5, y: 6 },
    },
  });
  assert.equal(mismatch.reason, "scene-town-mismatch");
  assert.equal(mismatch.fallback, "safe-dock");
  assert.equal(mismatch.save.world.townId, "shellshore-village");

  const global = recoverAdventureResume({
    ...initial,
    world: {
      ...initial.world,
      sceneId: "missing-scene",
      lastSafeDockId: "retired-dock",
    },
  });
  assert.equal(global.fallback, "adventure-start");
  assert.equal(global.save.world.lastSafeDockId, "shellshore-dock");
  assert.equal(global.save.world.sceneId, "town");
});

test("an impossible reverse first voyage recovers to the authored Shellshore origin", () => {
  const initial = createInitialAdventureSave("profile-3");
  initial.world = {
    ...initial.world,
    townId: "sunpatch-cay",
    sceneId: "shellshore-sunpatch-sea",
    position: { x: 14, y: 5 },
    facing: "left",
    lastSafeDockId: "sunpatch-dock",
    unlockedRouteIds: ["route-shellshore-sunpatch"],
    completedRouteIds: [],
  };
  initial.progression.quests[SHELLSHORE_QUEST_ID] = {
    status: "complete",
    flags: { "boat-safety-reviewed": true },
  };

  const recovered = recoverAdventureResume(initial);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.reason, "invalid-route-origin");
  assert.equal(recovered.fallback, "safe-dock");
  assert.equal(recovered.save.world.townId, "shellshore-village");
  assert.equal(recovered.save.world.sceneId, "town");
  assert.equal(recovered.save.world.lastSafeDockId, "shellshore-dock");
  assert.deepEqual(recovered.save.world.position, { x: 7, y: 8 });
});

test("resume reconciles legacy encounter progress with the Shellshore quest", () => {
  const oneWin = createInitialAdventureSave("profile-1");
  oneWin.progression.completedEncounterIds = ["encounter-shellshore-marina"];
  const active = recoverAdventureResume(oneWin);
  assert.equal(active.recovered, true);
  assert.equal(active.reason, "quest-state-reconciled");
  assert.equal(active.save.progression.quests[SHELLSHORE_QUEST_ID].status, "active");

  const bothWins = createInitialAdventureSave("profile-2");
  bothWins.progression.completedEncounterIds = [
    "encounter-shellshore-marina",
    "encounter-shellshore-dorian",
  ];
  const ready = recoverAdventureResume(bothWins);
  assert.equal(ready.recovered, true);
  assert.equal(ready.save.progression.quests[SHELLSHORE_QUEST_ID].status, "readyToTurnIn");
});

test("completing an encounter repairs a missing Shellshore quest before advancing it", () => {
  const legacy = createInitialAdventureSave("profile-3");
  legacy.progression.completedEncounterIds = ["encounter-shellshore-marina"];
  const completed = completeAdventureEncounter(legacy, {
    encounterId: "encounter-shellshore-dorian",
    opponentId: "dorian",
    chapterEncounterIds: [
      "encounter-shellshore-marina",
      "encounter-shellshore-dorian",
    ],
  });

  assert.equal(
    completed.progression.quests[SHELLSHORE_QUEST_ID].status,
    "readyToTurnIn",
  );
});

test("Marina's first victory grants one discovery pack exactly once across callbacks, reloads, and rematches", () => {
  const encounterIds = ["encounter-shellshore-marina", "encounter-shellshore-dorian"];
  const marinaVictory = {
    encounterId: "encounter-shellshore-marina",
    opponentId: "marina",
    chapterEncounterIds: encounterIds,
  };
  let save = createNewAdventureSession("profile-1");

  save = completeAdventureEncounter(save, marinaVictory);
  assert.equal(
    save.inventory.unopenedPacks["pack-pool-shellshore-discovery"],
    1,
  );
  assert.deepEqual(save.rewardLedger, ["reward-shellshore-marina-first-win"]);

  // A duplicate victory callback must not replay the encounter reward.
  save = completeAdventureEncounter(save, marinaVictory);
  assert.equal(
    save.inventory.unopenedPacks["pack-pool-shellshore-discovery"],
    1,
  );
  assert.deepEqual(save.rewardLedger, ["reward-shellshore-marina-first-win"]);

  // Persisting and normalizing the save preserves the ledger guard for a rematch.
  save = normalizeAdventureSave(JSON.parse(JSON.stringify(save)));
  save = completeAdventureEncounter(save, marinaVictory);
  assert.equal(
    save.inventory.unopenedPacks["pack-pool-shellshore-discovery"],
    1,
  );
  assert.deepEqual(save.rewardLedger, ["reward-shellshore-marina-first-win"]);
});

test("resume repairs a pre-collection save with Marina already defeated", () => {
  const legacy = createNewAdventureSession("profile-3");
  legacy.progression.completedEncounterIds = ["encounter-shellshore-marina"];

  const recovery = recoverAdventureResume(legacy);
  const repaired = recovery.save;

  assert.equal(recovery.recovered, true);
  assert.equal(recovery.reason, "encounter-reward-reconciled");
  assert.equal(repaired.inventory.unopenedPacks["pack-pool-shellshore-discovery"], 1);
  assert.deepEqual(repaired.rewardLedger, ["reward-shellshore-marina-first-win"]);

  const secondRecovery = recoverAdventureResume(repaired);
  assert.equal(secondRecovery.recovered, false);
  assert.equal(secondRecovery.save.inventory.unopenedPacks["pack-pool-shellshore-discovery"], 1);
});

test("Dorian's victory does not grant a booster pack", () => {
  const save = completeAdventureEncounter(createNewAdventureSession("profile-2"), {
    encounterId: "encounter-shellshore-dorian",
    opponentId: "dorian",
    chapterEncounterIds: [
      "encounter-shellshore-marina",
      "encounter-shellshore-dorian",
    ],
  });

  assert.deepEqual(save.inventory.unopenedPacks, {});
  assert.deepEqual(save.rewardLedger, []);
});

test("encounter wins are idempotent and advance the basic quest only after both trainers", () => {
  const encounterIds = ["encounter-shellshore-marina", "encounter-shellshore-dorian"];
  let save = createNewAdventureSession("profile-1");
  save = completeAdventureEncounter(save, {
    encounterId: encounterIds[0],
    opponentId: "marina",
    chapterEncounterIds: encounterIds,
  });
  save = completeAdventureEncounter(save, {
    encounterId: encounterIds[0],
    opponentId: "marina",
    chapterEncounterIds: encounterIds,
  });
  assert.deepEqual(save.progression.completedEncounterIds, [encounterIds[0]]);
  assert.equal(save.progression.quests[SHELLSHORE_QUEST_ID].status, "active");

  save = completeAdventureEncounter(save, {
    encounterId: encounterIds[1],
    opponentId: "dorian",
    chapterEncounterIds: encounterIds,
  });
  assert.deepEqual(save.progression.completedEncounterIds, encounterIds);
  assert.equal(save.progression.quests[SHELLSHORE_QUEST_ID].status, "readyToTurnIn");
});

test("duel attempts persist latest and immutable first-win deck provenance", () => {
  const encounterId = "encounter-shellshore-marina";
  const baseResult = {
    encounterId,
    outcome: "defeat",
    completionReason: "vp-target",
    playerDeckId: "harbor-custom",
    playerDeckFingerprint: "deck-v1-0123456789abcdef",
    opponent: { id: "marina" },
    scores: { playerVp: 5, opponentVp: 10, targetVp: 10 },
    round: 3,
    turn: 6,
  };
  let save = createNewAdventureSession("profile-1");

  const defeat = recordAdventureDuelResult(save, baseResult);
  save = defeat.save;
  assert.equal(defeat.firstVictory, false);
  assert.equal(save.progression.encounterResults[encounterId].attempts, 1);
  assert.equal(save.progression.encounterResults[encounterId].firstVictory, null);

  const victoryResult = {
    ...baseResult,
    outcome: "victory",
    scores: { playerVp: 11, opponentVp: 7, targetVp: 10 },
    round: 5,
    turn: 9,
  };
  const victory = recordAdventureDuelResult(save, victoryResult);
  save = normalizeAdventureSave(JSON.parse(JSON.stringify(victory.save)));
  assert.equal(victory.firstVictory, true);
  assert.equal(save.progression.encounterResults[encounterId].attempts, 2);
  assert.deepEqual(
    save.progression.encounterResults[encounterId].firstVictory,
    save.progression.encounterResults[encounterId].latest,
  );

  const rematch = recordAdventureDuelResult(save, {
    ...victoryResult,
    playerDeckId: "later-deck",
    playerDeckFingerprint: "deck-v1-fedcba9876543210",
    scores: { playerVp: 10, opponentVp: 2, targetVp: 10 },
  });
  const record = rematch.save.progression.encounterResults[encounterId];
  assert.equal(rematch.firstVictory, false);
  assert.equal(record.attempts, 3);
  assert.equal(record.latest.playerDeckId, "later-deck");
  assert.equal(record.firstVictory.playerDeckId, "harbor-custom");
  assert.equal(record.firstVictory.playerDeckFingerprint, "deck-v1-0123456789abcdef");
});

test("entering Champion's Wake activates the final quest exactly once", () => {
  const initial = createNewAdventureSession("profile-1");
  const scene = SCENES["champions-wake-town"];
  const entered = enterAdventureScene(initial, {
    sceneId: scene.id,
    position: scene.spawn,
    facing: "up",
  });

  assert.equal(entered.world.townId, "champions-wake");
  assert.equal(entered.progression.quests["quest-champions-wake"].status, "active");
  assert.deepEqual(
    enterAdventureScene(entered, {
      sceneId: scene.id,
      position: scene.spawn,
      facing: "up",
    }).progression.quests["quest-champions-wake"],
    entered.progression.quests["quest-champions-wake"],
  );
});

test("a completed bracket keeps rematches closed until the ending unlocks postgame practice", () => {
  const initial = createNewAdventureSession("profile-2");
  const beforeCredits = normalizeAdventureSave({
    ...initial,
    progression: {
      ...initial.progression,
      quests: {
        ...initial.progression.quests,
        "quest-champions-wake": {
          status: "complete",
          flags: {},
        },
      },
      tournament: {
        ...initial.progression.tournament,
        status: "complete",
        activeRoundId: null,
        completedRoundIds: [
          "encounter-tournament-quarterfinal",
          "encounter-tournament-semifinal",
          "encounter-tournament-final",
        ],
      },
    },
  });

  for (const encounterId of beforeCredits.progression.tournament.completedRoundIds) {
    const availability = isAdventureEncounterAvailable(beforeCredits, encounterId);
    assert.equal(availability.available, false);
    assert.match(availability.reason, /ceremony.*reflection.*practice/i);
  }

  const completed = normalizeAdventureSave({
    ...beforeCredits,
    progression: {
      ...beforeCredits.progression,
      quests: {
        ...beforeCredits.progression.quests,
        "quest-champions-wake": {
          ...beforeCredits.progression.quests["quest-champions-wake"],
          flags: { "postgame-unlocked": true },
        },
      },
    },
  });
  for (const encounterId of completed.progression.tournament.completedRoundIds) {
    assert.deepEqual(isAdventureEncounterAvailable(completed, encounterId), {
      available: true,
      reason: null,
      practiceOnly: true,
    });
  }
});
