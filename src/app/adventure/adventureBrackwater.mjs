import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import {
  grantReward,
  normalizeAdventureSave,
  setQuestFlag,
  transitionQuest,
} from "./adventureProgression.mjs";

export const BRACKWATER_QUEST_ID = "quest-brackwater-water-clues";

export const BRACKWATER_REQUIRED_OBSERVATION_IDS = Object.freeze([
  "incoming-tide-channel",
  "rain-fed-creek-mouth",
  "mangrove-low-tide",
  "repeat-runoff-low-oxygen",
]);

export const BRACKWATER_RESIDENT_ENCOUNTER_IDS = Object.freeze([
  "encounter-brackwater-resident-naturalist",
  "encounter-brackwater-resident-harbormaster",
]);

const BRACKWATER_RESIDENT_STEP_LABELS = Object.freeze({
  "encounter-brackwater-resident-naturalist": "Win the mangrove naturalist's resident duel",
  "encounter-brackwater-resident-harbormaster": "Win the harbormaster's resident duel",
});

export const BRACKWATER_CORRECT_INTERPRETATION_ID =
  "natural-variation-plus-supported-runoff-pattern";
export const BRACKWATER_CORRECT_RESPONSE_ID =
  "trace-source-reduce-runoff-keep-monitoring";

function freezeChoice(id, label, detail) {
  return Object.freeze({ id, label, detail });
}

export const BRACKWATER_INTERPRETATION_CHOICES = Object.freeze([
  freezeChoice(
    BRACKWATER_CORRECT_INTERPRETATION_ID,
    "Separate normal estuary variation from the repeated runoff-side pattern",
    "Tide, rainfall, location, and muddy habitat explain some variation; repeated unusual turbidity and low oxygen beside a possible source warrant investigation.",
  ),
  freezeChoice(
    "all-murky-water-is-polluted",
    "Treat every cloudy station as polluted",
    "Murky water alone proves that harmful runoff reached every part of the estuary.",
  ),
  freezeChoice(
    "every-reading-is-natural",
    "Treat every change as normal estuary variation",
    "Tides and rain vary naturally, so repeated low oxygen beside a drainage outlet can be ignored.",
  ),
]);

export const BRACKWATER_RESPONSE_CHOICES = Object.freeze([
  freezeChoice(
    BRACKWATER_CORRECT_RESPONSE_ID,
    "Trace the source, reduce confirmed inputs, and keep monitoring",
    "Test the supported runoff pathway, address confirmed nutrient or organic inputs, and compare more tides and rain events.",
  ),
  freezeChoice(
    "dredge-the-whole-estuary",
    "Dredge every naturally cloudy area",
    "Remove muddy nursery habitat because clear water is always healthier water.",
  ),
  freezeChoice(
    "ignore-every-change",
    "Take no action because estuaries naturally vary",
    "Natural variation means a repeated low-oxygen pattern near a possible source never needs investigation.",
  ),
]);

const BRACKWATER_FIELDWORK_REWARD_ID = "reward-brackwater-fieldwork";
const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/;
const MAX_CHOICE_ID_LENGTH = 96;
const MAX_CORRECTIVE_ATTEMPTS = Number.MAX_SAFE_INTEGER;

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

const BRACKWATER_BOOLEAN_FLAG_IDS = Object.freeze([
  ...BRACKWATER_REQUIRED_OBSERVATION_IDS.map(observationFlag),
  FLAGS.interpretationAttempted,
  FLAGS.interpretationCorrect,
  FLAGS.responseAttempted,
  FLAGS.responseCorrect,
]);

const BRACKWATER_COUNTER_FLAG_IDS = Object.freeze([
  FLAGS.interpretationCorrectiveAttempts,
  FLAGS.responseCorrectiveAttempts,
]);

const BRACKWATER_CHOICE_FLAG_IDS = Object.freeze([
  FLAGS.interpretationLastChoice,
  FLAGS.responseLastChoice,
]);

function freezeEvidence({ title, site, tide, rainfall, measurements, feedback }) {
  return Object.freeze({
    title,
    context: Object.freeze({ site, tide, rainfall }),
    measurements: Object.freeze({ ...measurements }),
    feedback,
  });
}

export const BRACKWATER_OBSERVATION_COPY = Object.freeze({
  "incoming-tide-channel": freezeEvidence({
    title: "Incoming-tide channel",
    site: "Channel nearest the estuary mouth",
    tide: "Incoming tide",
    rainfall: "No substantial rain for three days",
    measurements: {
      salinity: "Higher than the upstream stations",
      turbidity: "Moderate and near this station's usual range",
      dissolvedOxygen: "Near this station's daytime baseline",
    },
    feedback: "The incoming tide carries saltier ocean water into the channel. These salinity, turbidity, and oxygen readings fit this place and tide, so cloudiness here is not evidence of pollution by itself.",
  }),
  "rain-fed-creek-mouth": freezeEvidence({
    title: "Creek mouth after rain",
    site: "Freshwater creek entering the estuary",
    tide: "Outgoing tide",
    rainfall: "Heavy rain during the previous night",
    measurements: {
      salinity: "Lower than the channel reading",
      turbidity: "Higher than before the rain",
      dissolvedOxygen: "Near the creek station's rainy-day baseline",
    },
    feedback: "Rain adds freshwater and can carry or stir sediment, so lower salinity and higher turbidity are expected clues here. Oxygen remains near the site's comparison range; one cloudy reading does not establish pollution.",
  }),
  "mangrove-low-tide": freezeEvidence({
    title: "Mangrove nursery at low tide",
    site: "Shallow mangrove edge over a muddy bottom",
    tide: "Low tide with a light breeze",
    rainfall: "No substantial rain for three days",
    measurements: {
      salinity: "Between the creek and channel readings",
      turbidity: "High after shallow water stirred the muddy bottom",
      dissolvedOxygen: "Lower than the open channel but near this site's daytime baseline",
    },
    feedback: "A shallow muddy nursery can be naturally murky, especially when low water and wind stir sediment. Compare its salinity and oxygen with this site's own tide and time-of-day history instead of treating channel water as the only normal pattern.",
  }),
  "repeat-runoff-low-oxygen": freezeEvidence({
    title: "Repeated runoff-side pattern",
    site: "Drainage outlet beside a developed shoreline",
    tide: "Low tide on repeated morning checks",
    rainfall: "The same pattern follows several rain events",
    measurements: {
      salinity: "Below this station's dry-weather baseline",
      turbidity: "Repeatedly above this station's usual rain-event range",
      dissolvedOxygen: "Repeatedly below this station's morning baseline",
    },
    feedback: "This is more than a single murky sample: the unusual turbidity and low oxygen repeat together after rain beside a possible source. The pattern supports tracing runoff and checking nutrient or organic inputs without labeling the whole estuary polluted.",
  }),
});

export const BRACKWATER_SCIENCE_COPY = Object.freeze({
  interpretation: Object.freeze({
    correct: "Good evidence reading. Salinity and turbidity can change naturally with location, tide, rainfall, and a muddy bottom. The repeated high-turbidity and low-oxygen pattern beside the drainage outlet is the supported reason to investigate runoff, not murky water alone.",
    corrective: "Do not decide from water color alone. Compare salinity, turbidity, and dissolved oxygen across sites and repeated tide and rainfall conditions. Expected estuary variation can coexist with a specific runoff pattern that deserves investigation.",
  }),
  response: Object.freeze({
    correct: "Trace and test the supported runoff source, reduce confirmed nutrient or organic inputs, and keep measuring through more tides and rain events. This targets the concerning pattern while protecting the naturally muddy mangrove nursery.",
    corrective: "Choose a response tied to the repeated measurements. Do not clear, dredge, or treat the whole estuary merely because it looks murky, and do not ignore repeated low oxygen near a possible runoff source.",
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

function readBooleanFlag(flags, flagId) {
  const value = flags[flagId];
  if (value === undefined) return false;
  if (typeof value !== "boolean") {
    throw new TypeError(`Brackwater quest flag ${flagId} must be a boolean.`);
  }
  return value;
}

function readCounterFlag(flags, flagId) {
  const value = flags[flagId];
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(
      `Brackwater quest flag ${flagId} must be a non-negative safe integer.`,
    );
  }
  return value;
}

function readChoiceFlag(flags, flagId) {
  const value = flags[flagId];
  if (value === undefined) return null;
  return normalizeChoiceId(value, `Brackwater quest flag ${flagId}`);
}

function getQuestState(save) {
  return save.progression.quests[BRACKWATER_QUEST_ID] ?? {
    status: "notStarted",
    flags: {},
  };
}

/**
 * Repairs only persisted Brackwater flags whose generic JSON-scalar shape is
 * valid but whose chapter-specific type is not. Runtime chapter operations
 * remain strict and continue to throw on malformed flags; callers should use
 * this function only while recovering a save at the storage boundary.
 */
export function recoverBrackwaterQuestFlags(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const quest = save.progression.quests[BRACKWATER_QUEST_ID];
  if (!quest) {
    return { save, applied: false, discardedFlagIds: Object.freeze([]) };
  }

  const invalidFlagIds = [];
  for (const flagId of BRACKWATER_BOOLEAN_FLAG_IDS) {
    const value = quest.flags[flagId];
    if (value !== undefined && typeof value !== "boolean") invalidFlagIds.push(flagId);
  }
  for (const flagId of BRACKWATER_COUNTER_FLAG_IDS) {
    const value = quest.flags[flagId];
    if (
      value !== undefined
      && (!Number.isSafeInteger(value) || value < 0)
    ) {
      invalidFlagIds.push(flagId);
    }
  }
  for (const flagId of BRACKWATER_CHOICE_FLAG_IDS) {
    const value = quest.flags[flagId];
    if (value === undefined) continue;
    try {
      normalizeChoiceId(value, `Brackwater quest flag ${flagId}`);
    } catch {
      invalidFlagIds.push(flagId);
    }
  }

  invalidFlagIds.sort((left, right) => left.localeCompare(right));
  const discardedFlagIds = Object.freeze(invalidFlagIds);
  if (discardedFlagIds.length === 0) {
    return { save, applied: false, discardedFlagIds };
  }

  const flags = { ...quest.flags };
  for (const flagId of discardedFlagIds) delete flags[flagId];

  return {
    save: normalizeAdventureSave({
      ...save,
      progression: {
        ...save.progression,
        quests: {
          ...save.progression.quests,
          [BRACKWATER_QUEST_ID]: { ...quest, flags },
        },
      },
    }),
    applied: true,
    discardedFlagIds,
  };
}

function requireInvestigationStarted(save) {
  const status = getQuestState(save).status;
  if (status === "notStarted") {
    throw new RangeError("Begin the Brackwater investigation before continuing fieldwork.");
  }
  return status;
}

function requireEveryObservation(save, nextAction = "interpreting the evidence") {
  const flags = getQuestState(save).flags;
  const missingIds = BRACKWATER_REQUIRED_OBSERVATION_IDS.filter(
    (observationId) => !readBooleanFlag(flags, observationFlag(observationId)),
  );
  if (missingIds.length === 0) return;

  const missingTitles = missingIds.map(
    (observationId) => BRACKWATER_OBSERVATION_COPY[observationId].title,
  );
  throw new RangeError(
    `Record all four Brackwater observations before ${nextAction}. Missing: ${missingTitles.join(", ")}.`,
  );
}

function requireCorrectInterpretation(save) {
  const flags = getQuestState(save).flags;
  if (!readBooleanFlag(flags, FLAGS.interpretationCorrect)) {
    throw new RangeError(
      "Reach an evidence-supported interpretation before choosing the Brackwater response.",
    );
  }
}

function getFieldworkReward() {
  const reward = ADVENTURE_CONTENT.rewards.find(
    (candidate) => candidate.id === BRACKWATER_FIELDWORK_REWARD_ID,
  );
  if (!reward) {
    throw new Error(`Adventure content is missing ${BRACKWATER_FIELDWORK_REWARD_ID}.`);
  }
  return reward;
}

function missingStep(id, kind, label) {
  return Object.freeze({ id, kind, label });
}

export function getBrackwaterProgress(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const quest = getQuestState(save);
  const flags = quest.flags;
  const observedObservationIds = BRACKWATER_REQUIRED_OBSERVATION_IDS.filter(
    (observationId) => readBooleanFlag(flags, observationFlag(observationId)),
  );
  const missingObservationIds = BRACKWATER_REQUIRED_OBSERVATION_IDS.filter(
    (observationId) => !observedObservationIds.includes(observationId),
  );
  const completedResidentEncounterIds = BRACKWATER_RESIDENT_ENCOUNTER_IDS.filter(
    (encounterId) => save.progression.completedEncounterIds.includes(encounterId),
  );
  const missingResidentEncounterIds = BRACKWATER_RESIDENT_ENCOUNTER_IDS.filter(
    (encounterId) => !completedResidentEncounterIds.includes(encounterId),
  );
  const observationsComplete = missingObservationIds.length === 0;
  const residentDuelsComplete = missingResidentEncounterIds.length === 0;
  const interpretationAttempted = readBooleanFlag(flags, FLAGS.interpretationAttempted);
  const interpretationCorrect = readBooleanFlag(flags, FLAGS.interpretationCorrect);
  const interpretationCorrectiveAttempts = readCounterFlag(
    flags,
    FLAGS.interpretationCorrectiveAttempts,
  );
  const responseAttempted = readBooleanFlag(flags, FLAGS.responseAttempted);
  const responseCorrect = readBooleanFlag(flags, FLAGS.responseCorrect);
  const responseCorrectiveAttempts = readCounterFlag(
    flags,
    FLAGS.responseCorrectiveAttempts,
  );
  const requirementsMet = missingObservationIds.length === 0
    && missingResidentEncounterIds.length === 0
    && interpretationCorrect
    && responseCorrect;

  const missingSteps = [
    ...missingObservationIds.map((observationId) => missingStep(
      observationId,
      "observation",
      BRACKWATER_OBSERVATION_COPY[observationId].title,
    )),
    ...(!interpretationCorrect
      ? [missingStep("interpretation", "decision", "Interpret the estuary evidence")]
      : []),
    ...(!responseCorrect
      ? [missingStep("response", "decision", "Choose an evidence-supported runoff response")]
      : []),
    ...missingResidentEncounterIds.map((encounterId) => missingStep(
      encounterId,
      "resident-duel",
      BRACKWATER_RESIDENT_STEP_LABELS[encounterId],
    )),
  ];

  const interpretationChoiceId = readChoiceFlag(
    flags,
    FLAGS.interpretationLastChoice,
  );
  const responseChoiceId = readChoiceFlag(
    flags,
    FLAGS.responseLastChoice,
  );
  const started = quest.status !== "notStarted";
  const fieldworkOpen = quest.status === "active";
  const interpretationAvailable = fieldworkOpen
    && observationsComplete
    && !interpretationCorrect;
  const responseAvailable = fieldworkOpen && interpretationCorrect && !responseCorrect;
  const terminalStatusConsistent = (
    quest.status !== "readyToTurnIn" && quest.status !== "complete"
  ) || requirementsMet;
  const beginStep = missingStep(
    "begin-brackwater-investigation",
    "quest",
    "Begin the Water Clues investigation",
  );

  return Object.freeze({
    questId: BRACKWATER_QUEST_ID,
    status: quest.status,
    started,
    complete: quest.status === "complete" && requirementsMet,
    readyToTurnIn: quest.status === "readyToTurnIn" && requirementsMet,
    stateConsistent: terminalStatusConsistent,
    requirementsMet,
    requiredObservationIds: BRACKWATER_REQUIRED_OBSERVATION_IDS,
    observedObservationIds: Object.freeze(observedObservationIds),
    missingObservationIds: Object.freeze(missingObservationIds),
    observationsComplete,
    residentEncounterIds: BRACKWATER_RESIDENT_ENCOUNTER_IDS,
    completedResidentEncounterIds: Object.freeze(completedResidentEncounterIds),
    missingResidentEncounterIds: Object.freeze(missingResidentEncounterIds),
    residentDuelsComplete,
    interpretation: Object.freeze({
      available: interpretationAvailable,
      blockedReason: !started
        ? "Begin the Water Clues investigation first."
        : !fieldworkOpen && !interpretationCorrect
          ? "This investigation is no longer open for a new interpretation."
        : !observationsComplete
          ? `Record ${missingObservationIds.length} remaining observation${missingObservationIds.length === 1 ? "" : "s"} before interpreting the evidence.`
          : null,
      attempted: interpretationAttempted,
      correct: interpretationCorrect,
      correctChoiceId: BRACKWATER_CORRECT_INTERPRETATION_ID,
      lastChoiceId: interpretationChoiceId,
      correctiveAttempts: interpretationCorrectiveAttempts,
      feedback: interpretationChoiceId === null
        ? "Compare all three measurements across locations, tides, and rainfall before assigning a cause."
        : interpretationChoiceId === BRACKWATER_CORRECT_INTERPRETATION_ID
          ? BRACKWATER_SCIENCE_COPY.interpretation.correct
          : BRACKWATER_SCIENCE_COPY.interpretation.corrective,
    }),
    response: Object.freeze({
      available: responseAvailable,
      blockedReason: !started
        ? "Begin the Water Clues investigation first."
        : !fieldworkOpen && !responseCorrect
          ? "This investigation is no longer open for a new response."
        : !observationsComplete
          ? "Record all four observations before choosing a response."
          : !interpretationCorrect
            ? "Reach an evidence-supported interpretation before choosing a response."
            : null,
      attempted: responseAttempted,
      correct: responseCorrect,
      correctChoiceId: BRACKWATER_CORRECT_RESPONSE_ID,
      lastChoiceId: responseChoiceId,
      correctiveAttempts: responseCorrectiveAttempts,
      feedback: responseChoiceId === null
        ? "Choose a response that targets the supported source while preserving normal estuary and mangrove conditions."
        : responseChoiceId === BRACKWATER_CORRECT_RESPONSE_ID
          ? BRACKWATER_SCIENCE_COPY.response.correct
          : BRACKWATER_SCIENCE_COPY.response.corrective,
    }),
    missingSteps: Object.freeze(missingSteps),
    nextStep: missingSteps[0] ?? null,
    nextAction: !started ? beginStep : missingSteps[0] ?? null,
  });
}

export function beginBrackwaterInvestigation(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const status = getQuestState(save).status;
  if (status !== "notStarted") {
    return { save, applied: false, progress: getBrackwaterProgress(save) };
  }

  const nextSave = transitionQuest(save, BRACKWATER_QUEST_ID, "active");
  return { save: nextSave, applied: true, progress: getBrackwaterProgress(nextSave) };
}

export function reconcileBrackwaterQuest(saveValue) {
  let save = normalizeAdventureSave(saveValue);
  const before = getBrackwaterProgress(save);
  if (before.status === "active" && before.requirementsMet) {
    save = transitionQuest(save, BRACKWATER_QUEST_ID, "readyToTurnIn");
  }
  const progress = getBrackwaterProgress(save);
  return {
    save,
    applied: before.status !== progress.status,
    progress,
  };
}

export function recordBrackwaterObservation(saveValue, observationIdValue) {
  let save = normalizeAdventureSave(saveValue);
  const status = requireInvestigationStarted(save);
  const observationId = normalizeChoiceId(observationIdValue, "observationId");
  if (!BRACKWATER_REQUIRED_OBSERVATION_IDS.includes(observationId)) {
    throw new RangeError(`Unknown Brackwater observation: ${observationId}.`);
  }

  const flagId = observationFlag(observationId);
  const alreadyRecorded = readBooleanFlag(getQuestState(save).flags, flagId);
  if (status === "complete" && !alreadyRecorded) {
    throw new RangeError("Completed Brackwater fieldwork cannot accept new observations.");
  }
  if (!alreadyRecorded) save = setQuestFlag(save, BRACKWATER_QUEST_ID, flagId, true);
  const reconciled = reconcileBrackwaterQuest(save);
  return {
    save: reconciled.save,
    applied: !alreadyRecorded,
    observationId,
    evidence: BRACKWATER_OBSERVATION_COPY[observationId],
    feedback: BRACKWATER_OBSERVATION_COPY[observationId].feedback,
    progress: reconciled.progress,
  };
}

function submitDecision(saveValue, choiceIdValue, decision) {
  let save = normalizeAdventureSave(saveValue);
  const status = requireInvestigationStarted(save);
  const choiceId = normalizeChoiceId(choiceIdValue, `${decision.id}ChoiceId`);
  if (!decision.choices.some((choice) => choice.id === choiceId)) {
    throw new RangeError(`Unknown Brackwater ${decision.id} choice: ${choiceId}.`);
  }
  decision.requirePrerequisite(save);

  const quest = getQuestState(save);
  const wasCorrect = readBooleanFlag(quest.flags, decision.correctFlag);
  const attempted = readBooleanFlag(quest.flags, decision.attemptedFlag);
  const lastChoiceId = readChoiceFlag(
    quest.flags,
    decision.lastChoiceFlag,
  );
  const correct = choiceId === decision.correctChoiceId;

  if (wasCorrect) {
    const reconciled = reconcileBrackwaterQuest(save);
    return {
      save: reconciled.save,
      applied: false,
      correct: true,
      retryable: false,
      choiceId: lastChoiceId ?? decision.correctChoiceId,
      feedback: decision.copy.correct,
      progress: reconciled.progress,
    };
  }

  if (status === "complete") {
    throw new RangeError("Completed Brackwater fieldwork cannot accept new decisions.");
  }

  if (!correct && attempted && lastChoiceId === choiceId) {
    const reconciled = reconcileBrackwaterQuest(save);
    return {
      save: reconciled.save,
      applied: false,
      correct: false,
      retryable: true,
      choiceId,
      feedback: decision.copy.corrective,
      progress: reconciled.progress,
    };
  }

  save = setQuestFlag(save, BRACKWATER_QUEST_ID, decision.attemptedFlag, true);
  save = setQuestFlag(save, BRACKWATER_QUEST_ID, decision.lastChoiceFlag, choiceId);
  if (correct) {
    save = setQuestFlag(save, BRACKWATER_QUEST_ID, decision.correctFlag, true);
  } else {
    const priorAttempts = readCounterFlag(
      getQuestState(save).flags,
      decision.correctiveAttemptsFlag,
    );
    if (priorAttempts === MAX_CORRECTIVE_ATTEMPTS) {
      throw new RangeError(`Brackwater ${decision.id} corrective-attempt count cannot increase.`);
    }
    save = setQuestFlag(
      save,
      BRACKWATER_QUEST_ID,
      decision.correctiveAttemptsFlag,
      priorAttempts + 1,
    );
  }

  const reconciled = reconcileBrackwaterQuest(save);
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

export function submitBrackwaterInterpretation(saveValue, choiceId) {
  return submitDecision(saveValue, choiceId, {
    id: "interpretation",
    correctChoiceId: BRACKWATER_CORRECT_INTERPRETATION_ID,
    attemptedFlag: FLAGS.interpretationAttempted,
    correctFlag: FLAGS.interpretationCorrect,
    lastChoiceFlag: FLAGS.interpretationLastChoice,
    correctiveAttemptsFlag: FLAGS.interpretationCorrectiveAttempts,
    choices: BRACKWATER_INTERPRETATION_CHOICES,
    requirePrerequisite: requireEveryObservation,
    copy: BRACKWATER_SCIENCE_COPY.interpretation,
  });
}

export function submitBrackwaterResponse(saveValue, choiceId) {
  return submitDecision(saveValue, choiceId, {
    id: "response",
    correctChoiceId: BRACKWATER_CORRECT_RESPONSE_ID,
    attemptedFlag: FLAGS.responseAttempted,
    correctFlag: FLAGS.responseCorrect,
    lastChoiceFlag: FLAGS.responseLastChoice,
    correctiveAttemptsFlag: FLAGS.responseCorrectiveAttempts,
    choices: BRACKWATER_RESPONSE_CHOICES,
    requirePrerequisite(save) {
      requireEveryObservation(save, "choosing the Brackwater response");
      requireCorrectInterpretation(save);
    },
    copy: BRACKWATER_SCIENCE_COPY.response,
  });
}

export function turnInBrackwaterFieldwork(saveValue) {
  const reconciled = reconcileBrackwaterQuest(saveValue);
  let save = reconciled.save;
  const status = getQuestState(save).status;

  if (
    status === "notStarted"
    || status === "active"
    || !reconciled.progress.requirementsMet
  ) {
    const labels = reconciled.progress.missingSteps.map((step) => step.label);
    throw new RangeError(
      labels.length
        ? `Brackwater fieldwork is not ready to turn in. Missing: ${labels.join(", ")}.`
        : "Brackwater fieldwork is not ready to turn in.",
    );
  }

  const completedNow = status === "readyToTurnIn";
  if (completedNow) save = transitionQuest(save, BRACKWATER_QUEST_ID, "complete");
  const fieldworkReward = getFieldworkReward();
  const reward = grantReward(save, fieldworkReward);

  return {
    save: reward.save,
    applied: completedNow || reward.applied,
    completed: completedNow,
    rewardApplied: reward.applied,
    fieldNoteIds: Object.freeze([...(fieldworkReward.fieldNoteIds ?? [])]),
    progress: getBrackwaterProgress(reward.save),
  };
}
