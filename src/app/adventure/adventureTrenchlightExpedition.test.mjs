import test from "node:test";
import assert from "node:assert/strict";

import { createInitialAdventureSave, normalizeAdventureSave } from "./adventureProgression.mjs";
import {
  TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
  TRENCHLIGHT_CORRECT_RESPONSE_ID,
  TRENCHLIGHT_REQUIRED_OBSERVATION_IDS,
  beginTrenchlightExpedition,
  getTrenchlightProgress,
  submitTrenchlightInterpretation,
} from "./adventureTrenchlight.mjs";
import {
  TRENCHLIGHT_EXPEDITION_STEPS,
  TRENCHLIGHT_EXPEDITION_TOOL_IDS,
  TRENCHLIGHT_MISSION_CONTROL_SCENE_ID,
  TRENCHLIGHT_SUB_SCENE_ID,
  advanceTrenchlightExpedition,
  getTrenchlightExpeditionState,
  launchTrenchlightExpedition,
  recoverTrenchlightExpeditionResume,
  returnTrenchlightExpeditionToStation,
} from "./adventureTrenchlightExpedition.mjs";

function atMissionControl(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  return normalizeAdventureSave({
    ...save,
    world: {
      ...save.world,
      townId: "trenchlight-station",
      sceneId: TRENCHLIGHT_MISSION_CONTROL_SCENE_ID,
      position: { x: 5, y: 6 },
      facing: "down",
    },
  });
}

function startedSave() {
  const initial = atMissionControl(createInitialAdventureSave("trenchlight-expedition-test"));
  return beginTrenchlightExpedition(initial).save;
}

function finishSurvey(saveValue) {
  let save = saveValue;
  const tools = [
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.lightMeter,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.pressureSensor,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.marineSnowCamera,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.passiveLowLightCamera,
  ];
  for (const toolId of tools) {
    save = advanceTrenchlightExpedition(save, toolId).save;
  }
  return save;
}

test("the expedition exposes one ordered survey leg and one gated recovery leg", () => {
  assert.deepEqual(
    TRENCHLIGHT_EXPEDITION_STEPS.map(({ id, leg }) => [id, leg]),
    [
      ...TRENCHLIGHT_REQUIRED_OBSERVATION_IDS.map((id) => [id, "survey"]),
      ["trenchlight-sensor-recovery", "recovery"],
    ],
  );

  const launched = launchTrenchlightExpedition(startedSave());
  assert.equal(launched.leg, "survey");
  assert.equal(launched.save.world.sceneId, TRENCHLIGHT_SUB_SCENE_ID);
  assert.equal(launched.state.currentStep.id, TRENCHLIGHT_REQUIRED_OBSERVATION_IDS[0]);
});

test("survey tools are ordered, retryable, immutable on error, and assisted mode is derived", () => {
  const launched = launchTrenchlightExpedition(startedSave()).save;
  const snapshot = structuredClone(launched);

  const earlyPressure = advanceTrenchlightExpedition(
    launched,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.pressureSensor,
    { assistedMode: true },
  );
  assert.equal(earlyPressure.applied, false);
  assert.equal(earlyPressure.correct, false);
  assert.equal(earlyPressure.retryable, true);
  assert.deepEqual(earlyPressure.save, snapshot);
  assert.equal(
    earlyPressure.state.assistance.highlightedActionId,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.lightMeter,
  );
  assert.equal(JSON.stringify(earlyPressure.save).includes("assisted"), false);

  const first = advanceTrenchlightExpedition(
    launched,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.lightMeter,
  );
  assert.equal(first.correct, true);
  assert.equal(first.state.currentStep.id, TRENCHLIGHT_REQUIRED_OBSERVATION_IDS[1]);
});

test("survey progress resumes after reload and returns to Mission Control for interpretation", () => {
  let save = launchTrenchlightExpedition(startedSave()).save;
  save = advanceTrenchlightExpedition(
    save,
    TRENCHLIGHT_EXPEDITION_TOOL_IDS.lightMeter,
  ).save;
  save = JSON.parse(JSON.stringify(save));

  assert.equal(
    getTrenchlightExpeditionState(save).currentStep.id,
    TRENCHLIGHT_REQUIRED_OBSERVATION_IDS[1],
  );
  const finished = finishSurvey(save);
  const finishedState = getTrenchlightExpeditionState(finished);
  assert.equal(finishedState.phase, "analysis-required");
  assert.equal(finishedState.requiresStationReturn, true);
  assert.throws(() => launchTrenchlightExpedition(finished), /Mission Control|launch/i);

  const returned = returnTrenchlightExpeditionToStation(finished);
  assert.equal(returned.save.world.sceneId, TRENCHLIGHT_MISSION_CONTROL_SCENE_ID);
  assert.deepEqual(
    getTrenchlightProgress(returned.save).observedObservationIds,
    TRENCHLIGHT_REQUIRED_OBSERVATION_IDS,
  );
});

test("the interpretation gates a second launch and unsafe recovery choices remain retryable", () => {
  let save = finishSurvey(launchTrenchlightExpedition(startedSave()).save);
  save = returnTrenchlightExpeditionToStation(save).save;
  assert.throws(() => launchTrenchlightExpedition(save), /Interpret/i);

  save = submitTrenchlightInterpretation(
    save,
    TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
  ).save;
  const recoveryLaunch = launchTrenchlightExpedition(save);
  assert.equal(recoveryLaunch.leg, "recovery");

  const unsafe = advanceTrenchlightExpedition(
    recoveryLaunch.save,
    "trenchlight-grab-sensor-immediately",
  );
  assert.equal(unsafe.correct, false);
  assert.equal(unsafe.retryable, true);
  assert.equal(unsafe.state.phase, "recovery");
  assert.equal(unsafe.state.progress.response.correctiveAttempts, 1);

  const safe = advanceTrenchlightExpedition(unsafe.save, TRENCHLIGHT_CORRECT_RESPONSE_ID);
  assert.equal(safe.correct, true);
  assert.equal(safe.shouldReturnToStation, true);
  assert.equal(safe.state.phase, "expedition-complete");
  assert.equal(returnTrenchlightExpeditionToStation(safe.save).save.world.sceneId, TRENCHLIGHT_MISSION_CONTROL_SCENE_ID);
});

test("resume recovery preserves valid legs and moves impossible sub states to a safe station location", () => {
  const surveySave = launchTrenchlightExpedition(startedSave()).save;
  const valid = recoverTrenchlightExpeditionResume(JSON.parse(JSON.stringify(surveySave)));
  assert.equal(valid.recovered, false);
  assert.equal(valid.save.world.sceneId, TRENCHLIGHT_SUB_SCENE_ID);

  const impossible = normalizeAdventureSave({
    ...createInitialAdventureSave("trenchlight-impossible-resume"),
    world: {
      ...createInitialAdventureSave("trenchlight-impossible-resume").world,
      townId: "trenchlight-station",
      sceneId: TRENCHLIGHT_SUB_SCENE_ID,
      position: { x: 7, y: 8 },
      facing: "up",
    },
  });
  const recovered = recoverTrenchlightExpeditionResume(impossible);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.reason, "expedition-not-started");
  assert.equal(recovered.save.world.sceneId, TRENCHLIGHT_MISSION_CONTROL_SCENE_ID);
});
