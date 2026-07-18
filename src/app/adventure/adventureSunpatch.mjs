import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import {
  grantReward,
  normalizeAdventureSave,
  setQuestFlag,
  transitionQuest,
} from "./adventureProgression.mjs";

export const SUNPATCH_QUEST_ID = "quest-sunpatch-reef-response";

export const SUNPATCH_REQUIRED_OBSERVATION_IDS = Object.freeze([
  "healthy-comparison",
  "bleached-tissue",
  "described-lesion",
  "algae-covered-skeleton",
]);

export const SUNPATCH_RESIDENT_ENCOUNTER_IDS = Object.freeze([
  "encounter-sunpatch-resident-gardener",
  "encounter-sunpatch-resident-surveyor",
]);

export const SUNPATCH_CORRECT_INTERPRETATION_ID = "stress-lesion-evidence";
export const SUNPATCH_CORRECT_RESPONSE_ID = "monitor-protect-reduce-local-stress";

const SUNPATCH_FIELDWORK_REWARD_ID = "reward-sunpatch-fieldwork";
const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/;
const MAX_CHOICE_ID_LENGTH = 96;

const FLAGS = Object.freeze({
  interpretationAttempted: "interpretation-attempted",
  interpretationCorrect: "interpretation-correct",
  interpretationLastChoice: "interpretation-last-choice",
  interpretationCorrectiveAttempts: "interpretation-corrective-attempts",
  responseAttempted: "response-attempted",
  responseCorrect: "response-correct",
  responseLastChoice: "response-last-choice",
  responseCorrectiveAttempts: "response-corrective-attempts",
});

export const SUNPATCH_OBSERVATION_COPY = Object.freeze({
  "healthy-comparison": Object.freeze({
    title: "Healthy comparison patch",
    feedback: "Pigmented living tissue covers the skeleton in this image. Use this patch as a comparison, not as proof that no stress exists.",
  }),
  "bleached-tissue": Object.freeze({
    title: "Pale tissue patch",
    feedback: "Pale or translucent tissue can still be alive. Bleaching is a stress response, so this observation should be monitored rather than labeled dead by color alone.",
  }),
  "described-lesion": Object.freeze({
    title: "Tissue-loss lesion",
    feedback: "Record the location, shape, edge, and amount of tissue loss. A lesion describes what is visible; a photograph alone cannot establish that disease caused it.",
  }),
  "algae-covered-skeleton": Object.freeze({
    title: "Algae-covered skeleton",
    feedback: "Algae on exposed skeleton shows that tissue was lost in this area earlier. It does not identify the cause or prove that the entire coral colony is dead.",
  }),
});

export const SUNPATCH_SCIENCE_COPY = Object.freeze({
  interpretation: Object.freeze({
    correct: "Good evidence reading. Bleached tissue may still be alive, a lesion is an observation rather than a diagnosis, and algae-covered exposed skeleton shows earlier tissue loss without revealing its cause.",
    corrective: "Describe the evidence before assigning a cause. White appearance alone does not mean a coral is dead or diseased, and visible tissue loss should be recorded as a lesion for expert assessment.",
  }),
  response: Object.freeze({
    correct: "Report repeat images and local condition trends, protect the reef from anchor damage, and reduce supported local sediment or nutrient stress. These steps can support resilience, but they do not replace action on ocean warming.",
    corrective: "Choose actions supported by the observations: keep monitoring, prevent avoidable local damage, and reduce demonstrated local stress. Do not promise an instant cure or diagnose and treat a disease from appearance alone.",
  }),
});

function observationFlag(observationId) {
  return `observed-${observationId}`;
}

function normalizeChoiceId(value, label) {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string identifier.`);
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${label} must not be empty.`);
  if (normalized.length > MAX_CHOICE_ID_LENGTH || !IDENTIFIER_PATTERN.test(normalized)) {
    throw new TypeError(`${label} must be a lowercase identifier using single ., _, :, or - separators.`);
  }
  return normalized;
}

function getQuestState(save) {
  return save.progression.quests[SUNPATCH_QUEST_ID] ?? {
    status: "notStarted",
    flags: {},
  };
}

function requireInvestigationStarted(save) {
  const status = getQuestState(save).status;
  if (status === "notStarted") {
    throw new RangeError("Begin the Sunpatch investigation before recording fieldwork.");
  }
  return status;
}

function getFieldworkReward() {
  const reward = ADVENTURE_CONTENT.rewards.find(
    (candidate) => candidate.id === SUNPATCH_FIELDWORK_REWARD_ID,
  );
  if (!reward) throw new Error(`Adventure content is missing ${SUNPATCH_FIELDWORK_REWARD_ID}.`);
  return reward;
}

function missingStep(id, kind, label) {
  return Object.freeze({ id, kind, label });
}

export function getSunpatchProgress(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const quest = getQuestState(save);
  const flags = quest.flags;
  const observedObservationIds = SUNPATCH_REQUIRED_OBSERVATION_IDS.filter(
    (observationId) => flags[observationFlag(observationId)] === true,
  );
  const missingObservationIds = SUNPATCH_REQUIRED_OBSERVATION_IDS.filter(
    (observationId) => !observedObservationIds.includes(observationId),
  );
  const completedResidentEncounterIds = SUNPATCH_RESIDENT_ENCOUNTER_IDS.filter(
    (encounterId) => save.progression.completedEncounterIds.includes(encounterId),
  );
  const missingResidentEncounterIds = SUNPATCH_RESIDENT_ENCOUNTER_IDS.filter(
    (encounterId) => !completedResidentEncounterIds.includes(encounterId),
  );
  const interpretationCorrect = flags[FLAGS.interpretationCorrect] === true;
  const responseCorrect = flags[FLAGS.responseCorrect] === true;
  const requirementsMet = missingObservationIds.length === 0
    && missingResidentEncounterIds.length === 0
    && interpretationCorrect
    && responseCorrect;
  const terminalStatusConsistent = (
    quest.status !== "readyToTurnIn" && quest.status !== "complete"
  ) || requirementsMet;

  const missingSteps = [
    ...missingObservationIds.map((observationId) => missingStep(
      observationId,
      "observation",
      SUNPATCH_OBSERVATION_COPY[observationId].title,
    )),
    ...(!interpretationCorrect
      ? [missingStep("interpretation", "decision", "Interpret the reef evidence")]
      : []),
    ...(!responseCorrect
      ? [missingStep("response", "decision", "Choose an evidence-supported response")]
      : []),
    ...missingResidentEncounterIds.map((encounterId, index) => missingStep(
      encounterId,
      "resident-duel",
      index === 0 ? "Complete the remaining resident duel" : "Complete both resident duels",
    )),
  ];

  const interpretationChoiceId = flags[FLAGS.interpretationLastChoice] ?? null;
  const responseChoiceId = flags[FLAGS.responseLastChoice] ?? null;

  return Object.freeze({
    questId: SUNPATCH_QUEST_ID,
    status: quest.status,
    started: quest.status !== "notStarted",
    complete: quest.status === "complete" && requirementsMet,
    readyToTurnIn: quest.status === "readyToTurnIn" && requirementsMet,
    stateConsistent: terminalStatusConsistent,
    requirementsMet,
    requiredObservationIds: SUNPATCH_REQUIRED_OBSERVATION_IDS,
    observedObservationIds: Object.freeze(observedObservationIds),
    missingObservationIds: Object.freeze(missingObservationIds),
    residentEncounterIds: SUNPATCH_RESIDENT_ENCOUNTER_IDS,
    completedResidentEncounterIds: Object.freeze(completedResidentEncounterIds),
    missingResidentEncounterIds: Object.freeze(missingResidentEncounterIds),
    interpretation: Object.freeze({
      attempted: flags[FLAGS.interpretationAttempted] === true,
      correct: interpretationCorrect,
      correctChoiceId: SUNPATCH_CORRECT_INTERPRETATION_ID,
      lastChoiceId: interpretationChoiceId,
      correctiveAttempts: flags[FLAGS.interpretationCorrectiveAttempts] ?? 0,
      feedback: interpretationChoiceId === null
        ? "Compare living tissue, color change, tissue loss, and algae-covered skeleton before drawing a conclusion."
        : interpretationChoiceId === SUNPATCH_CORRECT_INTERPRETATION_ID
          ? SUNPATCH_SCIENCE_COPY.interpretation.correct
          : SUNPATCH_SCIENCE_COPY.interpretation.corrective,
    }),
    response: Object.freeze({
      attempted: flags[FLAGS.responseAttempted] === true,
      correct: responseCorrect,
      correctChoiceId: SUNPATCH_CORRECT_RESPONSE_ID,
      lastChoiceId: responseChoiceId,
      correctiveAttempts: flags[FLAGS.responseCorrectiveAttempts] ?? 0,
      feedback: responseChoiceId === null
        ? "Choose a response tied to the observations and honest about what local action can and cannot change."
        : responseChoiceId === SUNPATCH_CORRECT_RESPONSE_ID
          ? SUNPATCH_SCIENCE_COPY.response.correct
          : SUNPATCH_SCIENCE_COPY.response.corrective,
    }),
    missingSteps: Object.freeze(missingSteps),
    nextStep: missingSteps[0] ?? null,
  });
}

export function beginSunpatchInvestigation(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const status = getQuestState(save).status;
  if (status !== "notStarted") {
    return { save, applied: false, progress: getSunpatchProgress(save) };
  }

  const nextSave = transitionQuest(save, SUNPATCH_QUEST_ID, "active");
  return { save: nextSave, applied: true, progress: getSunpatchProgress(nextSave) };
}

export function reconcileSunpatchQuest(saveValue) {
  let save = normalizeAdventureSave(saveValue);
  const before = getSunpatchProgress(save);
  if (before.status === "active" && before.requirementsMet) {
    save = transitionQuest(save, SUNPATCH_QUEST_ID, "readyToTurnIn");
  }
  const progress = getSunpatchProgress(save);
  return {
    save,
    applied: before.status !== progress.status,
    progress,
  };
}

export function recordSunpatchObservation(saveValue, observationIdValue) {
  let save = normalizeAdventureSave(saveValue);
  requireInvestigationStarted(save);
  const observationId = normalizeChoiceId(observationIdValue, "observationId");
  if (!SUNPATCH_REQUIRED_OBSERVATION_IDS.includes(observationId)) {
    throw new RangeError(`Unknown Sunpatch observation: ${observationId}.`);
  }

  const flagId = observationFlag(observationId);
  const alreadyRecorded = getQuestState(save).flags[flagId] === true;
  if (!alreadyRecorded) save = setQuestFlag(save, SUNPATCH_QUEST_ID, flagId, true);
  const reconciled = reconcileSunpatchQuest(save);
  return {
    save: reconciled.save,
    applied: !alreadyRecorded,
    observationId,
    feedback: SUNPATCH_OBSERVATION_COPY[observationId].feedback,
    progress: reconciled.progress,
  };
}

function submitDecision(saveValue, choiceIdValue, decision) {
  let save = normalizeAdventureSave(saveValue);
  requireInvestigationStarted(save);
  const choiceId = normalizeChoiceId(choiceIdValue, `${decision.id}ChoiceId`);
  const quest = getQuestState(save);
  const wasCorrect = quest.flags[decision.correctFlag] === true;
  const correct = choiceId === decision.correctChoiceId;

  if (wasCorrect) {
    const reconciled = reconcileSunpatchQuest(save);
    return {
      save: reconciled.save,
      applied: false,
      correct: true,
      retryable: false,
      choiceId: quest.flags[decision.lastChoiceFlag] ?? decision.correctChoiceId,
      feedback: decision.copy.correct,
      progress: reconciled.progress,
    };
  }

  save = setQuestFlag(save, SUNPATCH_QUEST_ID, decision.attemptedFlag, true);
  save = setQuestFlag(save, SUNPATCH_QUEST_ID, decision.lastChoiceFlag, choiceId);
  if (correct) {
    save = setQuestFlag(save, SUNPATCH_QUEST_ID, decision.correctFlag, true);
  } else {
    const priorAttempts = getQuestState(save).flags[decision.correctiveAttemptsFlag] ?? 0;
    save = setQuestFlag(
      save,
      SUNPATCH_QUEST_ID,
      decision.correctiveAttemptsFlag,
      priorAttempts + 1,
    );
  }

  const reconciled = reconcileSunpatchQuest(save);
  return {
    save: reconciled.save,
    applied: correct ? !wasCorrect : true,
    correct,
    retryable: !correct,
    choiceId,
    feedback: correct ? decision.copy.correct : decision.copy.corrective,
    progress: reconciled.progress,
  };
}

export function submitSunpatchInterpretation(saveValue, choiceId) {
  return submitDecision(saveValue, choiceId, {
    id: "interpretation",
    correctChoiceId: SUNPATCH_CORRECT_INTERPRETATION_ID,
    attemptedFlag: FLAGS.interpretationAttempted,
    correctFlag: FLAGS.interpretationCorrect,
    lastChoiceFlag: FLAGS.interpretationLastChoice,
    correctiveAttemptsFlag: FLAGS.interpretationCorrectiveAttempts,
    copy: SUNPATCH_SCIENCE_COPY.interpretation,
  });
}

export function submitSunpatchResponse(saveValue, choiceId) {
  return submitDecision(saveValue, choiceId, {
    id: "response",
    correctChoiceId: SUNPATCH_CORRECT_RESPONSE_ID,
    attemptedFlag: FLAGS.responseAttempted,
    correctFlag: FLAGS.responseCorrect,
    lastChoiceFlag: FLAGS.responseLastChoice,
    correctiveAttemptsFlag: FLAGS.responseCorrectiveAttempts,
    copy: SUNPATCH_SCIENCE_COPY.response,
  });
}

export function turnInSunpatchFieldwork(saveValue) {
  const reconciled = reconcileSunpatchQuest(saveValue);
  let save = reconciled.save;
  const status = getQuestState(save).status;

  if (status === "notStarted" || status === "active") {
    const labels = reconciled.progress.missingSteps.map((step) => step.label);
    throw new RangeError(
      labels.length
        ? `Sunpatch fieldwork is not ready to turn in. Missing: ${labels.join(", ")}.`
        : "Sunpatch fieldwork is not ready to turn in.",
    );
  }

  const completedNow = status === "readyToTurnIn";
  if (completedNow) save = transitionQuest(save, SUNPATCH_QUEST_ID, "complete");
  const reward = grantReward(save, getFieldworkReward());

  return {
    save: reward.save,
    applied: completedNow || reward.applied,
    completed: completedNow,
    rewardApplied: reward.applied,
    fieldNoteIds: Object.freeze([...(getFieldworkReward().fieldNoteIds ?? [])]),
    progress: getSunpatchProgress(reward.save),
  };
}
