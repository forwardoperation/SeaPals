import { normalizeAdventureSave } from "./adventureProgression.mjs";
import {
  TRENCHLIGHT_CORRECT_RESPONSE_ID,
  TRENCHLIGHT_REQUIRED_OBSERVATION_IDS,
  TRENCHLIGHT_RESPONSE_CHOICES,
  getTrenchlightProgress,
  recordTrenchlightObservation,
  submitTrenchlightResponse,
} from "./adventureTrenchlight.mjs";

export const TRENCHLIGHT_SUB_SCENE_ID = "trenchlight-sub-descent";
export const TRENCHLIGHT_MISSION_CONTROL_SCENE_ID = "trenchlight-mission-control";

export const TRENCHLIGHT_SUB_RETURN_LOCATION = Object.freeze({
  townId: "trenchlight-station",
  sceneId: TRENCHLIGHT_MISSION_CONTROL_SCENE_ID,
  position: Object.freeze({ x: 5, y: 6 }),
  facing: "down",
});

const TRENCHLIGHT_SUB_LOCATION = Object.freeze({
  townId: "trenchlight-station",
  sceneId: TRENCHLIGHT_SUB_SCENE_ID,
  position: Object.freeze({ x: 7, y: 8 }),
  facing: "up",
});

export const TRENCHLIGHT_EXPEDITION_TOOL_IDS = Object.freeze({
  lightMeter: "trenchlight-use-light-meter",
  pressureSensor: "trenchlight-read-pressure-sensor",
  marineSnowCamera: "trenchlight-record-marine-snow-camera",
  passiveLowLightCamera: "trenchlight-use-passive-low-light-camera",
  sensorRecovery: TRENCHLIGHT_CORRECT_RESPONSE_ID,
});

function freezeStep(step) {
  return Object.freeze({ ...step });
}

export const TRENCHLIGHT_EXPEDITION_STEPS = Object.freeze([
  freezeStep({
    id: TRENCHLIGHT_REQUIRED_OBSERVATION_IDS[0],
    leg: "survey",
    kind: "observation",
    requiredActionId: TRENCHLIGHT_EXPEDITION_TOOL_IDS.lightMeter,
    title: "Measure fading sunlight",
    instruction: "Ask the expert pilot to hold at each depth mark, then log the calibrated light meter.",
  }),
  freezeStep({
    id: TRENCHLIGHT_REQUIRED_OBSERVATION_IDS[1],
    leg: "survey",
    kind: "observation",
    requiredActionId: TRENCHLIGHT_EXPEDITION_TOOL_IDS.pressureSensor,
    title: "Read the pressure profile",
    instruction: "Read the external pressure sensor at the same marked depths while remaining inside the rated sub.",
  }),
  freezeStep({
    id: TRENCHLIGHT_REQUIRED_OBSERVATION_IDS[2],
    leg: "survey",
    kind: "observation",
    requiredActionId: TRENCHLIGHT_EXPEDITION_TOOL_IDS.marineSnowCamera,
    title: "Record marine snow",
    instruction: "Use the fixed camera to record sinking particles without following or collecting animals.",
  }),
  freezeStep({
    id: TRENCHLIGHT_REQUIRED_OBSERVATION_IDS[3],
    leg: "survey",
    kind: "observation",
    requiredActionId: TRENCHLIGHT_EXPEDITION_TOOL_IDS.passiveLowLightCamera,
    title: "Observe living light",
    instruction: "Dim the bright lamps and use the passive low-light camera without approaching wildlife.",
  }),
  freezeStep({
    id: "trenchlight-sensor-recovery",
    leg: "recovery",
    kind: "response",
    requiredActionId: TRENCHLIGHT_EXPEDITION_TOOL_IDS.sensorRecovery,
    title: "Recover the deployed sensor safely",
    instruction: "Confirm the marked sensor and a habitat-free approach with camera and sonar; let the trained crew lift it and stop if clearance is uncertain.",
  }),
]);

const OBSERVATION_STEPS = TRENCHLIGHT_EXPEDITION_STEPS.filter(
  (step) => step.kind === "observation",
);
const RECOVERY_STEP = TRENCHLIGHT_EXPEDITION_STEPS.find(
  (step) => step.kind === "response",
);

function withLocation(saveValue, location) {
  const save = normalizeAdventureSave(saveValue);
  return normalizeAdventureSave({
    ...save,
    world: {
      ...save.world,
      townId: location.townId,
      sceneId: location.sceneId,
      position: { ...location.position },
      facing: location.facing,
    },
  });
}

function isAtMissionControl(save) {
  return save.world.townId === "trenchlight-station"
    && save.world.sceneId === TRENCHLIGHT_MISSION_CONTROL_SCENE_ID;
}

function getPhase(progress) {
  if (!progress.started) return "not-started";
  if (!progress.observationsComplete) return "survey";
  if (!progress.interpretation.correct) return "analysis-required";
  if (!progress.response.correct) return "recovery";
  return "expedition-complete";
}

export function getTrenchlightExpeditionState(saveValue, { assistedMode = false } = {}) {
  const save = normalizeAdventureSave(saveValue);
  const progress = getTrenchlightProgress(save);
  const phase = getPhase(progress);
  const inSub = save.world.townId === "trenchlight-station"
    && save.world.sceneId === TRENCHLIGHT_SUB_SCENE_ID;
  const currentStep = phase === "survey"
    ? OBSERVATION_STEPS.find((step) => progress.missingObservationIds.includes(step.id)) ?? null
    : phase === "recovery"
      ? RECOVERY_STEP
      : null;
  const completedStepIds = [
    ...progress.observedObservationIds,
    ...(progress.response.correct ? [RECOVERY_STEP.id] : []),
  ];
  const requiresStationReturn = inSub
    && (phase === "analysis-required" || phase === "expedition-complete");
  const canLaunch = isAtMissionControl(save)
    && (phase === "survey" || phase === "recovery");
  const assistEnabled = assistedMode === true;

  return Object.freeze({
    questId: progress.questId,
    phase,
    leg: phase === "survey" ? "survey" : phase === "recovery" ? "recovery" : null,
    inSub,
    canLaunch,
    requiresStationReturn,
    currentStep,
    completedStepIds: Object.freeze(completedStepIds),
    progress,
    assistance: Object.freeze({
      enabled: assistEnabled,
      highlightedActionId: assistEnabled ? currentStep?.requiredActionId ?? null : null,
      instruction: assistEnabled ? currentStep?.instruction ?? null : null,
    }),
  });
}

export function launchTrenchlightExpedition(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const before = getTrenchlightExpeditionState(save);
  if (!before.canLaunch) {
    throw new RangeError(
      before.phase === "not-started"
        ? "Begin the Trenchlight expedition with Dr. Hana Okoye before launch."
        : before.phase === "analysis-required"
          ? "Interpret the survey records in Mission Control before launching the recovery leg."
          : "The Trenchlight submersible can launch only from Mission Control during an open expedition leg.",
    );
  }

  const nextSave = withLocation(save, TRENCHLIGHT_SUB_LOCATION);
  return {
    save: nextSave,
    applied: true,
    leg: before.leg,
    state: getTrenchlightExpeditionState(nextSave),
  };
}

export function advanceTrenchlightExpedition(
  saveValue,
  actionId,
  { assistedMode = false } = {},
) {
  const save = normalizeAdventureSave(saveValue);
  const before = getTrenchlightExpeditionState(save, { assistedMode });
  if (!before.inSub || !before.currentStep) {
    throw new RangeError("There is no active Trenchlight expedition step in the submersible.");
  }

  const knownRecoveryChoice = before.currentStep.kind === "response"
    && TRENCHLIGHT_RESPONSE_CHOICES.some((choice) => choice.id === actionId);
  if (actionId !== before.currentStep.requiredActionId && !knownRecoveryChoice) {
    return {
      save,
      applied: false,
      correct: false,
      retryable: true,
      shouldReturnToStation: false,
      feedback: `Use ${before.currentStep.title.toLowerCase()} before moving to the next expedition step.`,
      state: before,
    };
  }

  const result = before.currentStep.kind === "observation"
    ? recordTrenchlightObservation(save, before.currentStep.id)
    : submitTrenchlightResponse(save, actionId);
  const state = getTrenchlightExpeditionState(result.save, { assistedMode });
  const shouldReturnToStation = state.requiresStationReturn;

  return {
    save: result.save,
    applied: result.applied,
    correct: result.correct ?? true,
    retryable: result.retryable ?? false,
    shouldReturnToStation,
    feedback: result.feedback,
    state,
  };
}

export function returnTrenchlightExpeditionToStation(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const before = getTrenchlightExpeditionState(save);
  if (!before.inSub) {
    return { save, applied: false, state: before };
  }

  const nextSave = withLocation(save, TRENCHLIGHT_SUB_RETURN_LOCATION);
  return {
    save: nextSave,
    applied: true,
    state: getTrenchlightExpeditionState(nextSave),
  };
}

export function recoverTrenchlightExpeditionResume(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const before = getTrenchlightExpeditionState(save);
  if (!before.inSub || before.phase === "survey" || before.phase === "recovery") {
    return {
      save,
      recovered: false,
      reason: null,
      state: before,
    };
  }

  const returned = returnTrenchlightExpeditionToStation(save);
  return {
    save: returned.save,
    recovered: true,
    reason: before.phase === "analysis-required"
      ? "analysis-required-at-mission-control"
      : before.phase === "expedition-complete"
        ? "expedition-complete"
        : "expedition-not-started",
    state: returned.state,
  };
}
