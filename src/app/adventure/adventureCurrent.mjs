import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import {
  grantReward,
  normalizeAdventureSave,
  setQuestFlag,
  transitionQuest,
} from "./adventureProgression.mjs";

export const CURRENT_QUEST_ID = "quest-current-ghost-gear";

export const CURRENT_REQUIRED_OBSERVATION_IDS = Object.freeze([
  "source-port-loss-report",
  "surface-drifter-track",
  "wildlife-overlap-zone",
  "downstream-gear-accumulation",
]);

export const CURRENT_RESIDENT_ENCOUNTER_IDS = Object.freeze([
  "encounter-current-resident-navigator",
  "encounter-current-resident-deckhand",
]);

const CURRENT_RESIDENT_STEP_LABELS = Object.freeze({
  "encounter-current-resident-navigator": "Win the navigator's resident duel",
  "encounter-current-resident-deckhand": "Win the deckhand's resident duel",
});

export const CURRENT_CORRECT_INTERPRETATION_ID =
  "currents-connect-report-to-risk-zone";
export const CURRENT_CORRECT_RESPONSE_ID =
  "coordinate-safe-removal-and-prevention";

function freezeChoice(id, label, detail) {
  return Object.freeze({ id, label, detail });
}

export const CURRENT_INTERPRETATION_CHOICES = Object.freeze([
  freezeChoice(
    CURRENT_CORRECT_INTERPRETATION_ID,
    "Use the current to connect the loss report with the downstream risk zone",
    "The report, drifter path, wildlife overlap, and repeated downstream accumulation support a connected hazard corridor without proving one owner or source.",
  ),
  freezeChoice(
    "one-sighting-proves-the-owner",
    "Treat one gear sighting as proof of who lost it",
    "Matching location and appearance establish the gear's owner and exact source without another record.",
  ),
  freezeChoice(
    "currents-carry-only-water",
    "Assume currents move water but not drifting material",
    "The down-current accumulation is unrelated because fishing gear cannot travel with moving water.",
  ),
]);

export const CURRENT_RESPONSE_CHOICES = Object.freeze([
  freezeChoice(
    CURRENT_CORRECT_RESPONSE_ID,
    "Coordinate safe removal and prevent the next loss",
    "Keep a safe distance, report and map the hazard, let trained authorized responders assess and remove it, then improve gear checks, marking, retrieval, and loss reporting.",
  ),
  freezeChoice(
    "cleanup-alone-ends-ghost-gear",
    "Schedule a cleanup but skip source prevention",
    "Removing today's accumulation is enough, so gear checks, marking, retrieval, and future loss reports are unnecessary.",
  ),
  freezeChoice(
    "leave-hazard-unreported",
    "Leave the gear unreported and avoid the area",
    "Changing one boat route protects wildlife without documenting the hazard or notifying trained responders.",
  ),
]);

const CURRENT_FIELDWORK_REWARD_ID = "reward-current-fieldwork";
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

function observationFlag(observationId) {
  return `observed-${observationId}`;
}

const CURRENT_REQUIREMENT_FLAG_IDS = Object.freeze([
  ...CURRENT_REQUIRED_OBSERVATION_IDS.map(observationFlag),
  FLAGS.interpretationCorrect,
  FLAGS.responseCorrect,
]);

const CURRENT_BOOLEAN_FLAG_IDS = Object.freeze([
  ...CURRENT_REQUIREMENT_FLAG_IDS,
  FLAGS.interpretationAttempted,
  FLAGS.responseAttempted,
]);

const CURRENT_COUNTER_FLAG_IDS = Object.freeze([
  FLAGS.interpretationCorrectiveAttempts,
  FLAGS.responseCorrectiveAttempts,
]);

const CURRENT_CHOICE_FLAG_IDS = Object.freeze([
  FLAGS.interpretationLastChoice,
  FLAGS.responseLastChoice,
]);

function freezeEvidence({ title, site, timing, method, measurements, feedback }) {
  return Object.freeze({
    title,
    context: Object.freeze({ site, timing, method }),
    measurements: Object.freeze({ ...measurements }),
    feedback,
  });
}

export const CURRENT_OBSERVATION_COPY = Object.freeze({
  "source-port-loss-report": freezeEvidence({
    title: "Source-port gear-loss report",
    site: "Working harbor up-current of Current Commons",
    timing: "Filed before the latest drifter release",
    method: "Review the marked loss report; do not search for or handle gear",
    measurements: {
      currentClue: "The reported loss site lies up-current of the commons",
      gearClue: "The report describes marked trap line and a missing buoy",
      wildlifeClue: "No animal interaction was reported at the source port",
    },
    feedback: "A dated gear-loss report provides a possible source area and material description. It is a clue to compare with current and sighting evidence, not proof that every downstream item belongs to one person.",
  }),
  "surface-drifter-track": freezeEvidence({
    title: "Surface-drifter track",
    site: "Marked open-ocean survey lane west of the commons",
    timing: "Timed positions recorded through one tide and wind period",
    method: "Plot the instrument's transmitted positions from aboard the survey boat",
    measurements: {
      currentClue: "Successive positions trace the surface flow toward the commons",
      gearClue: "Floating line or buoys could follow a similar surface pathway",
      wildlifeClue: "The track continues toward a mapped feeding corridor",
    },
    feedback: "The drifter supplies a likely short-term surface corridor, not an exact destination. It supports a possible transport route for floating gear during these conditions, while deeper or later currents may differ and still need monitoring.",
  }),
  "wildlife-overlap-zone": freezeEvidence({
    title: "Wildlife-overlap watch",
    site: "Feeding and travel corridor down-current of the survey lane",
    timing: "Repeated watches during the current field period",
    method: "Observe and document from a safe distance; remain aboard",
    measurements: {
      currentClue: "The plotted surface pathway crosses this corridor",
      gearClue: "Observers logged unattended line and buoy material nearby",
      wildlifeClue: "Fish, turtles, and marine mammals use the same water corridor",
    },
    feedback: "Wildlife use overlaps the projected gear pathway, so entanglement and ghost-fishing risk deserves a trained response. The player only observes, maps, and reports; approaching gear or wildlife is not part of the fieldwork.",
  }),
  "downstream-gear-accumulation": freezeEvidence({
    title: "Downstream gear accumulation",
    site: "Navigation marker beyond the wildlife corridor",
    timing: "Multiple reports after similar current conditions",
    method: "Review responder imagery and mark an avoidance boundary",
    measurements: {
      currentClue: "Accumulations recur down-current of the reported loss area",
      gearClue: "Responder images show unattended trap line that can keep fishing",
      wildlifeClue: "The gear creates entanglement and navigation hazards in shared habitat",
    },
    feedback: "Repeated downstream accumulation, rather than one sighting alone, strengthens the current-connection pattern. Trained authorized responders assess and remove dangerous gear; prevention at likely source areas is also needed to reduce recurrence.",
  }),
});

export const CURRENT_SCIENCE_COPY = Object.freeze({
  interpretation: Object.freeze({
    correct: "That conclusion follows the evidence. The loss report suggests a possible up-current source, the drifter shows a transport direction, and the wildlife and accumulation records locate downstream risk. Together they support a connection, but they do not prove one owner or a single source.",
    corrective: "Compare all four records as a sequence: possible source, measured surface flow, wildlife overlap, and repeated downstream accumulation. Current evidence can support a transport connection without proving ownership from one sighting.",
  }),
  response: Object.freeze({
    correct: "Stay aboard and at a safe, legal distance. Record the time, location, gear description, drift direction, and any wildlife; report the hazard and mark an avoidance route. Only trained authorized responders assess or remove entangling gear or disentangle wildlife. Pair that response with gear checks, secure marking, prompt loss reports, retrieval planning, and proper disposal so cleanup is not the only step.",
    corrective: "A safe response must address today's hazard and future losses. Do not approach, touch, pull, cut, swim to, or disentangle gear or animals; record the time, location, gear description, drift direction, and any wildlife, keep clear, notify trained authorized responders, and add source-prevention practices.",
  }),
});

function normalizeChoiceId(value, label) {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string identifier.`);
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${label} must not be empty.`);
  if (normalized.length > MAX_CHOICE_ID_LENGTH || !IDENTIFIER_PATTERN.test(normalized)) {
    throw new TypeError(
      `${label} must be a lowercase identifier using single ., _, :, or - separators.`,
    );
  }
  return normalized;
}

function readBooleanFlag(flags, flagId) {
  const value = flags[flagId];
  if (value === undefined) return false;
  if (typeof value !== "boolean") {
    throw new TypeError(`Current Commons quest flag ${flagId} must be a boolean.`);
  }
  return value;
}

function readCounterFlag(flags, flagId) {
  const value = flags[flagId];
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(
      `Current Commons quest flag ${flagId} must be a non-negative safe integer.`,
    );
  }
  return value;
}

function readChoiceFlag(flags, flagId) {
  const value = flags[flagId];
  if (value === undefined) return null;
  return normalizeChoiceId(value, `Current Commons quest flag ${flagId}`);
}

function getQuestState(save) {
  return save.progression.quests[CURRENT_QUEST_ID] ?? {
    status: "notStarted",
    flags: {},
  };
}

/**
 * Repairs persisted Current Commons flags whose generic JSON-scalar shape is
 * valid but whose chapter-specific type is not. Runtime chapter operations are
 * intentionally strict; use this only at the save-storage recovery boundary.
 */
export function recoverCurrentQuestFlags(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const quest = save.progression.quests[CURRENT_QUEST_ID];
  if (!quest) {
    return { save, applied: false, discardedFlagIds: Object.freeze([]) };
  }

  const invalidFlagIds = [];
  for (const flagId of CURRENT_BOOLEAN_FLAG_IDS) {
    const value = quest.flags[flagId];
    if (value !== undefined && typeof value !== "boolean") invalidFlagIds.push(flagId);
  }
  for (const flagId of CURRENT_COUNTER_FLAG_IDS) {
    const value = quest.flags[flagId];
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
      invalidFlagIds.push(flagId);
    }
  }
  for (const flagId of CURRENT_CHOICE_FLAG_IDS) {
    const value = quest.flags[flagId];
    if (value === undefined) continue;
    try {
      normalizeChoiceId(value, `Current Commons quest flag ${flagId}`);
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
  const terminalRequirementWasDiscarded = (
    quest.status === "readyToTurnIn" || quest.status === "complete"
  ) && discardedFlagIds.some((flagId) => CURRENT_REQUIREMENT_FLAG_IDS.includes(flagId));
  return {
    save: normalizeAdventureSave({
      ...save,
      progression: {
        ...save.progression,
        quests: {
          ...save.progression.quests,
          [CURRENT_QUEST_ID]: {
            ...quest,
            status: terminalRequirementWasDiscarded ? "active" : quest.status,
            flags,
          },
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
    throw new RangeError("Begin the Current Commons investigation before continuing fieldwork.");
  }
  return status;
}

function requireEveryObservation(save, nextAction = "interpreting the evidence") {
  const flags = getQuestState(save).flags;
  const missingIds = CURRENT_REQUIRED_OBSERVATION_IDS.filter(
    (observationId) => !readBooleanFlag(flags, observationFlag(observationId)),
  );
  if (missingIds.length === 0) return;

  const missingTitles = missingIds.map(
    (observationId) => CURRENT_OBSERVATION_COPY[observationId].title,
  );
  throw new RangeError(
    `Record all four Current Commons observations before ${nextAction}. Missing: ${missingTitles.join(", ")}.`,
  );
}

function requireCorrectInterpretation(save) {
  const flags = getQuestState(save).flags;
  if (!readBooleanFlag(flags, FLAGS.interpretationCorrect)) {
    throw new RangeError(
      "Reach an evidence-supported interpretation before choosing the Current Commons response.",
    );
  }
}

function getFieldworkReward() {
  const reward = ADVENTURE_CONTENT.rewards.find(
    (candidate) => candidate.id === CURRENT_FIELDWORK_REWARD_ID,
  );
  if (!reward) {
    throw new Error(`Adventure content is missing ${CURRENT_FIELDWORK_REWARD_ID}.`);
  }
  return reward;
}

function missingStep(id, kind, label) {
  return Object.freeze({ id, kind, label });
}

export function getCurrentProgress(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const quest = getQuestState(save);
  const flags = quest.flags;
  const observedObservationIds = CURRENT_REQUIRED_OBSERVATION_IDS.filter(
    (observationId) => readBooleanFlag(flags, observationFlag(observationId)),
  );
  const missingObservationIds = CURRENT_REQUIRED_OBSERVATION_IDS.filter(
    (observationId) => !observedObservationIds.includes(observationId),
  );
  const completedResidentEncounterIds = CURRENT_RESIDENT_ENCOUNTER_IDS.filter(
    (encounterId) => save.progression.completedEncounterIds.includes(encounterId),
  );
  const missingResidentEncounterIds = CURRENT_RESIDENT_ENCOUNTER_IDS.filter(
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
  const requirementsMet = observationsComplete
    && residentDuelsComplete
    && interpretationCorrect
    && responseCorrect;

  const missingSteps = [
    ...missingObservationIds.map((observationId) => missingStep(
      observationId,
      "observation",
      CURRENT_OBSERVATION_COPY[observationId].title,
    )),
    ...(!interpretationCorrect
      ? [missingStep("interpretation", "decision", "Connect current evidence to the wildlife risk zone")]
      : []),
    ...(!responseCorrect
      ? [missingStep("response", "decision", "Choose safe removal coordination and source prevention")]
      : []),
    ...missingResidentEncounterIds.map((encounterId) => missingStep(
      encounterId,
      "resident-duel",
      CURRENT_RESIDENT_STEP_LABELS[encounterId],
    )),
  ];

  const interpretationChoiceId = readChoiceFlag(flags, FLAGS.interpretationLastChoice);
  const responseChoiceId = readChoiceFlag(flags, FLAGS.responseLastChoice);
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
    "begin-current-investigation",
    "quest",
    "Begin the Currents and Ghost Gear investigation",
  );

  return Object.freeze({
    questId: CURRENT_QUEST_ID,
    status: quest.status,
    started,
    complete: quest.status === "complete" && requirementsMet,
    readyToTurnIn: quest.status === "readyToTurnIn" && requirementsMet,
    stateConsistent: terminalStatusConsistent,
    requirementsMet,
    requiredObservationIds: CURRENT_REQUIRED_OBSERVATION_IDS,
    observedObservationIds: Object.freeze(observedObservationIds),
    missingObservationIds: Object.freeze(missingObservationIds),
    observationsComplete,
    residentEncounterIds: CURRENT_RESIDENT_ENCOUNTER_IDS,
    completedResidentEncounterIds: Object.freeze(completedResidentEncounterIds),
    missingResidentEncounterIds: Object.freeze(missingResidentEncounterIds),
    residentDuelsComplete,
    interpretation: Object.freeze({
      available: interpretationAvailable,
      blockedReason: !started
        ? "Begin the Currents and Ghost Gear investigation first."
        : !fieldworkOpen && !interpretationCorrect
          ? "This investigation is no longer open for a new interpretation."
          : !observationsComplete
            ? `Record ${missingObservationIds.length} remaining observation${missingObservationIds.length === 1 ? "" : "s"} before interpreting the evidence.`
            : null,
      attempted: interpretationAttempted,
      correct: interpretationCorrect,
      correctChoiceId: CURRENT_CORRECT_INTERPRETATION_ID,
      lastChoiceId: interpretationChoiceId,
      correctiveAttempts: interpretationCorrectiveAttempts,
      feedback: interpretationChoiceId === null
        ? "Compare the possible source, measured current, wildlife overlap, and repeated accumulation before drawing a connection."
        : interpretationChoiceId === CURRENT_CORRECT_INTERPRETATION_ID
          ? CURRENT_SCIENCE_COPY.interpretation.correct
          : CURRENT_SCIENCE_COPY.interpretation.corrective,
    }),
    response: Object.freeze({
      available: responseAvailable,
      blockedReason: !started
        ? "Begin the Currents and Ghost Gear investigation first."
        : !fieldworkOpen && !responseCorrect
          ? "This investigation is no longer open for a new response."
          : !observationsComplete
            ? "Record all four observations before choosing a response."
            : !interpretationCorrect
              ? "Reach an evidence-supported interpretation before choosing a response."
              : null,
      attempted: responseAttempted,
      correct: responseCorrect,
      correctChoiceId: CURRENT_CORRECT_RESPONSE_ID,
      lastChoiceId: responseChoiceId,
      correctiveAttempts: responseCorrectiveAttempts,
      feedback: responseChoiceId === null
        ? "Choose a response that keeps the player clear of entangling gear, coordinates trained removal, and reduces future losses."
        : responseChoiceId === CURRENT_CORRECT_RESPONSE_ID
          ? CURRENT_SCIENCE_COPY.response.correct
          : CURRENT_SCIENCE_COPY.response.corrective,
    }),
    missingSteps: Object.freeze(missingSteps),
    nextStep: missingSteps[0] ?? null,
    nextAction: !started ? beginStep : missingSteps[0] ?? null,
  });
}

export function beginCurrentInvestigation(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const status = getQuestState(save).status;
  if (status !== "notStarted") {
    return { save, applied: false, progress: getCurrentProgress(save) };
  }

  const nextSave = transitionQuest(save, CURRENT_QUEST_ID, "active");
  return { save: nextSave, applied: true, progress: getCurrentProgress(nextSave) };
}

export function reconcileCurrentQuest(saveValue) {
  let save = normalizeAdventureSave(saveValue);
  const before = getCurrentProgress(save);
  if (before.status === "active" && before.requirementsMet) {
    save = transitionQuest(save, CURRENT_QUEST_ID, "readyToTurnIn");
  }
  const progress = getCurrentProgress(save);
  return {
    save,
    applied: before.status !== progress.status,
    progress,
  };
}

export function recordCurrentObservation(saveValue, observationIdValue) {
  let save = normalizeAdventureSave(saveValue);
  const status = requireInvestigationStarted(save);
  const observationId = normalizeChoiceId(observationIdValue, "observationId");
  if (!CURRENT_REQUIRED_OBSERVATION_IDS.includes(observationId)) {
    throw new RangeError(`Unknown Current Commons observation: ${observationId}.`);
  }

  const flagId = observationFlag(observationId);
  const alreadyRecorded = readBooleanFlag(getQuestState(save).flags, flagId);
  if (status === "complete" && !alreadyRecorded) {
    throw new RangeError("Completed Current Commons fieldwork cannot accept new observations.");
  }
  if (!alreadyRecorded) save = setQuestFlag(save, CURRENT_QUEST_ID, flagId, true);
  const reconciled = reconcileCurrentQuest(save);
  return {
    save: reconciled.save,
    applied: !alreadyRecorded,
    observationId,
    evidence: CURRENT_OBSERVATION_COPY[observationId],
    feedback: CURRENT_OBSERVATION_COPY[observationId].feedback,
    progress: reconciled.progress,
  };
}

function submitDecision(saveValue, choiceIdValue, decision) {
  let save = normalizeAdventureSave(saveValue);
  const status = requireInvestigationStarted(save);
  const choiceId = normalizeChoiceId(choiceIdValue, `${decision.id}ChoiceId`);
  if (!decision.choices.some((choice) => choice.id === choiceId)) {
    throw new RangeError(`Unknown Current Commons ${decision.id} choice: ${choiceId}.`);
  }
  decision.requirePrerequisite(save);

  const quest = getQuestState(save);
  const wasCorrect = readBooleanFlag(quest.flags, decision.correctFlag);
  const attempted = readBooleanFlag(quest.flags, decision.attemptedFlag);
  const lastChoiceId = readChoiceFlag(quest.flags, decision.lastChoiceFlag);
  const correct = choiceId === decision.correctChoiceId;

  if (wasCorrect) {
    const reconciled = reconcileCurrentQuest(save);
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
    throw new RangeError("Completed Current Commons fieldwork cannot accept new decisions.");
  }

  if (!correct && attempted && lastChoiceId === choiceId) {
    const reconciled = reconcileCurrentQuest(save);
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

  save = setQuestFlag(save, CURRENT_QUEST_ID, decision.attemptedFlag, true);
  save = setQuestFlag(save, CURRENT_QUEST_ID, decision.lastChoiceFlag, choiceId);
  if (correct) {
    save = setQuestFlag(save, CURRENT_QUEST_ID, decision.correctFlag, true);
  } else {
    const priorAttempts = readCounterFlag(
      getQuestState(save).flags,
      decision.correctiveAttemptsFlag,
    );
    if (priorAttempts === MAX_CORRECTIVE_ATTEMPTS) {
      throw new RangeError(
        `Current Commons ${decision.id} corrective-attempt count cannot increase.`,
      );
    }
    save = setQuestFlag(
      save,
      CURRENT_QUEST_ID,
      decision.correctiveAttemptsFlag,
      priorAttempts + 1,
    );
  }

  const reconciled = reconcileCurrentQuest(save);
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

export function submitCurrentInterpretation(saveValue, choiceId) {
  return submitDecision(saveValue, choiceId, {
    id: "interpretation",
    correctChoiceId: CURRENT_CORRECT_INTERPRETATION_ID,
    attemptedFlag: FLAGS.interpretationAttempted,
    correctFlag: FLAGS.interpretationCorrect,
    lastChoiceFlag: FLAGS.interpretationLastChoice,
    correctiveAttemptsFlag: FLAGS.interpretationCorrectiveAttempts,
    choices: CURRENT_INTERPRETATION_CHOICES,
    requirePrerequisite: requireEveryObservation,
    copy: CURRENT_SCIENCE_COPY.interpretation,
  });
}

export function submitCurrentResponse(saveValue, choiceId) {
  return submitDecision(saveValue, choiceId, {
    id: "response",
    correctChoiceId: CURRENT_CORRECT_RESPONSE_ID,
    attemptedFlag: FLAGS.responseAttempted,
    correctFlag: FLAGS.responseCorrect,
    lastChoiceFlag: FLAGS.responseLastChoice,
    correctiveAttemptsFlag: FLAGS.responseCorrectiveAttempts,
    choices: CURRENT_RESPONSE_CHOICES,
    requirePrerequisite(save) {
      requireEveryObservation(save, "choosing the Current Commons response");
      requireCorrectInterpretation(save);
    },
    copy: CURRENT_SCIENCE_COPY.response,
  });
}

export function turnInCurrentFieldwork(saveValue) {
  const reconciled = reconcileCurrentQuest(saveValue);
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
        ? `Current Commons fieldwork is not ready to turn in. Missing: ${labels.join(", ")}.`
        : "Current Commons fieldwork is not ready to turn in.",
    );
  }

  const completedNow = status === "readyToTurnIn";
  if (completedNow) save = transitionQuest(save, CURRENT_QUEST_ID, "complete");
  const fieldworkReward = getFieldworkReward();
  const reward = grantReward(save, fieldworkReward);

  return {
    save: reward.save,
    applied: completedNow || reward.applied,
    completed: completedNow,
    rewardApplied: reward.applied,
    fieldNoteIds: Object.freeze([...(fieldworkReward.fieldNoteIds ?? [])]),
    progress: getCurrentProgress(reward.save),
  };
}
