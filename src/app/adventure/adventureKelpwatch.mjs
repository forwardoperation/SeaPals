import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import {
  grantReward,
  normalizeAdventureSave,
  setQuestFlag,
  transitionQuest,
} from "./adventureProgression.mjs";

export const KELPWATCH_QUEST_ID = "quest-kelpwatch-balance";

export const KELPWATCH_REQUIRED_OBSERVATION_IDS = Object.freeze([
  "kelp-cover-transect",
  "grazer-abundance-count",
  "predator-evidence-survey",
  "repeat-comparison-site",
]);

export const KELPWATCH_RESIDENT_ENCOUNTER_IDS = Object.freeze([
  "encounter-kelpwatch-resident-diver",
  "encounter-kelpwatch-resident-ranger",
]);

const KELPWATCH_RESIDENT_STEP_LABELS = Object.freeze({
  "encounter-kelpwatch-resident-diver": "Win the diver's resident duel",
  "encounter-kelpwatch-resident-ranger": "Win the ranger's resident duel",
});

export const KELPWATCH_CORRECT_INTERPRETATION_ID =
  "three-link-food-web-fits-observed-pattern";
export const KELPWATCH_CORRECT_RESPONSE_ID =
  "monitor-drivers-and-test-bounded-restoration";

function freezeChoice(id, label, detail) {
  return Object.freeze({ id, label, detail });
}

export const KELPWATCH_INTERPRETATION_CHOICES = Object.freeze([
  freezeChoice(
    KELPWATCH_CORRECT_INTERPRETATION_ID,
    "Use the observations to build a three-link food-web hypothesis",
    "The repeated pattern fits a pathway in which predators can limit grazers and grazers consume kelp, while other environmental drivers may also affect every link.",
  ),
  freezeChoice(
    "low-kelp-proves-one-species-caused-it",
    "Treat low kelp cover as proof that one species caused it",
    "One site's kelp cover identifies a single biological cause without matched counts, repeat visits, or environmental evidence.",
  ),
  freezeChoice(
    "food-web-links-never-affect-kelp",
    "Treat predators, grazers, and kelp as unrelated",
    "Changes in predator or grazer abundance cannot influence kelp cover, so the three observations should never be compared.",
  ),
]);

export const KELPWATCH_RESPONSE_CHOICES = Object.freeze([
  freezeChoice(
    KELPWATCH_CORRECT_RESPONSE_ID,
    "Monitor several drivers and test a bounded restoration response",
    "Repeat the matched surveys, assess physical and biological drivers, then let permitted experts test a small, reversible, monitored response with clear success and stop criteria.",
  ),
  freezeChoice(
    "remove-one-species-to-reset-forest",
    "Remove one species to restore the forest immediately",
    "Eliminating a grazer or adding one predator will always reset every kelp forest, regardless of temperature, storms, habitat, or local food-web structure.",
  ),
  freezeChoice(
    "wait-without-repeat-monitoring",
    "Wait without repeating the survey",
    "The first pattern is enough to predict what will happen, so comparison sites and follow-up measurements are unnecessary.",
  ),
]);

const KELPWATCH_FIELDWORK_REWARD_ID = "reward-kelpwatch-fieldwork";
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

const KELPWATCH_REQUIREMENT_FLAG_IDS = Object.freeze([
  ...KELPWATCH_REQUIRED_OBSERVATION_IDS.map(observationFlag),
  FLAGS.interpretationCorrect,
  FLAGS.responseCorrect,
]);

const KELPWATCH_BOOLEAN_FLAG_IDS = Object.freeze([
  ...KELPWATCH_REQUIREMENT_FLAG_IDS,
  FLAGS.interpretationAttempted,
  FLAGS.responseAttempted,
]);

const KELPWATCH_COUNTER_FLAG_IDS = Object.freeze([
  FLAGS.interpretationCorrectiveAttempts,
  FLAGS.responseCorrectiveAttempts,
]);

const KELPWATCH_CHOICE_FLAG_IDS = Object.freeze([
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

export const KELPWATCH_OBSERVATION_COPY = Object.freeze({
  "kelp-cover-transect": freezeEvidence({
    title: "Kelp-cover photo transect",
    site: "Marked cove transect beside the Kelpwatch research pier",
    timing: "Photographed at the same tide window as the paired survey",
    method: "Score kelp at fixed photo points without collecting or disturbing organisms",
    measurements: {
      kelpCoverClue: "The marked cove has less canopy cover than the paired comparison cove",
      grazerClue: "Grazer abundance is counted on a separate matched belt transect",
      predatorClue: "Kelp cover alone does not establish predator abundance or causation",
      comparisonClue: "Fixed points allow the same area and method to be revisited",
    },
    feedback: "Kelp is a habitat-forming producer, so canopy cover is one end of the food-web pattern. A fixed photo transect makes change measurable, but low cover by itself cannot identify whether grazers, heat, storms, nutrients, disease, recruitment, or several drivers are responsible.",
  }),
  "grazer-abundance-count": freezeEvidence({
    title: "Grazer-abundance belt count",
    site: "The same marked cove used for the kelp-cover transect",
    timing: "Counted immediately after the fixed-point photographs",
    method: "Count visible grazers along a fixed belt; do not touch, feed, move, or remove them",
    measurements: {
      kelpCoverClue: "The high-grazer belt overlaps the cove's lower kelp cover",
      grazerClue: "Visible urchins and other large grazers are more abundant here than at the comparison cove",
      predatorClue: "The count does not show why grazer abundance differs between sites",
      comparisonClue: "The same belt length, visibility notes, and counting rules are used at both coves",
    },
    feedback: "Grazers form the middle link: they consume kelp, and their abundance can respond to predators as well as recruitment, disease, harvest, shelter, and water conditions. The overlap with lower kelp cover supports a food-web hypothesis, not a universal instruction to remove grazers.",
  }),
  "predator-evidence-survey": freezeEvidence({
    title: "Predator-evidence survey",
    site: "Matched observation lanes at the marked and comparison coves",
    timing: "Repeated during the same daylight and tide windows",
    method: "Review timed visual counts and remote-camera records without approaching wildlife",
    measurements: {
      kelpCoverClue: "More kelp cover occurs at the cove with more repeated predator evidence",
      grazerClue: "That cove also has fewer visible grazers in the matched belts",
      predatorClue: "Predatory fish and invertebrate evidence is less frequent at the low-kelp cove",
      comparisonClue: "No sighting is treated as a complete census, and non-detection is not proof of absence",
    },
    feedback: "Predators are the third link. The matched pattern is consistent with a trophic cascade: predators can limit grazers, which consume kelp. Observation alone does not prove the direction or strength of that pathway at every site.",
  }),
  "repeat-comparison-site": freezeEvidence({
    title: "Repeat and comparison-site check",
    site: "Original marked cove plus a nearby cove with similar depth and exposure",
    timing: "A second survey window after the first matched visit",
    method: "Repeat the same photo, belt-count, camera, tide, and visibility protocol at both sites",
    measurements: {
      kelpCoverClue: "The lower-kelp and higher-kelp contrast appears again on the repeat visit",
      grazerClue: "The higher-grazer and lower-grazer contrast also repeats",
      predatorClue: "Predator evidence remains a relative pattern rather than a complete population estimate",
      comparisonClue: "Temperature, nutrients, storm damage, substrate, and visibility are logged for competing explanations",
    },
    feedback: "A repeat visit and matched comparison make the three-link pattern more credible than a single snapshot. They still do not isolate one cause, so the town should keep monitoring physical conditions and food-web changes before and during any bounded restoration test.",
  }),
});

export const KELPWATCH_SCIENCE_COPY = Object.freeze({
  interpretation: Object.freeze({
    correct: "That is the supported three-link hypothesis: predators can limit grazers, grazers consume kelp, and the matched sites repeatedly pair more predator evidence with fewer grazers and more kelp cover. The observations show an association, not proof that one species or pathway caused every difference; temperature, storms, nutrients, disease, recruitment, habitat structure, and human activity may also matter.",
    corrective: "Compare all four records: kelp cover, grazer abundance, predator evidence, and the repeat comparison. A trophic cascade is a testable food-web explanation, but one low-kelp site or one species count cannot establish a single cause or a universal pattern.",
  }),
  response: Object.freeze({
    correct: "Repeat the standardized surveys across sites and seasons, and track temperature, nutrients, storms, substrate, recruitment, harvest, disease, predators, grazers, and kelp. If the evidence supports action, permitted ecologists can test a small, site-specific, reversible restoration step with a comparison site, success measures, and stop criteria. Protecting food-web function may help, but removing one species or adding one predator is not an instant or universal kelp-forest fix.",
    corrective: "Do not promise that removing a grazer, adding a predator, or waiting after one survey will restore the forest. Monitor all three food-web links and competing environmental drivers, compare sites through time, and reserve any organism handling or restoration for permitted experts using a bounded, measured test.",
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
    throw new TypeError(`Kelpwatch Island quest flag ${flagId} must be a boolean.`);
  }
  return value;
}

function readCounterFlag(flags, flagId) {
  const value = flags[flagId];
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(
      `Kelpwatch Island quest flag ${flagId} must be a non-negative safe integer.`,
    );
  }
  return value;
}

function readChoiceFlag(flags, flagId) {
  const value = flags[flagId];
  if (value === undefined) return null;
  return normalizeChoiceId(value, `Kelpwatch Island quest flag ${flagId}`);
}

function getQuestState(save) {
  return save.progression.quests[KELPWATCH_QUEST_ID] ?? {
    status: "notStarted",
    flags: {},
  };
}

/**
 * Repairs persisted Kelpwatch Island flags whose generic JSON-scalar shape is
 * valid but whose chapter-specific type is not. Runtime chapter operations are
 * intentionally strict; use this only at the save-storage recovery boundary.
 */
export function recoverKelpwatchQuestFlags(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const quest = save.progression.quests[KELPWATCH_QUEST_ID];
  if (!quest) {
    return { save, applied: false, discardedFlagIds: Object.freeze([]) };
  }

  const invalidFlagIds = [];
  for (const flagId of KELPWATCH_BOOLEAN_FLAG_IDS) {
    const value = quest.flags[flagId];
    if (value !== undefined && typeof value !== "boolean") invalidFlagIds.push(flagId);
  }
  for (const flagId of KELPWATCH_COUNTER_FLAG_IDS) {
    const value = quest.flags[flagId];
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
      invalidFlagIds.push(flagId);
    }
  }
  for (const flagId of KELPWATCH_CHOICE_FLAG_IDS) {
    const value = quest.flags[flagId];
    if (value === undefined) continue;
    try {
      normalizeChoiceId(value, `Kelpwatch Island quest flag ${flagId}`);
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
  ) && discardedFlagIds.some((flagId) => KELPWATCH_REQUIREMENT_FLAG_IDS.includes(flagId));
  return {
    save: normalizeAdventureSave({
      ...save,
      progression: {
        ...save.progression,
        quests: {
          ...save.progression.quests,
          [KELPWATCH_QUEST_ID]: {
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
    throw new RangeError("Begin the Kelpwatch Island investigation before continuing fieldwork.");
  }
  return status;
}

function requireEveryObservation(save, nextAction = "interpreting the evidence") {
  const flags = getQuestState(save).flags;
  const missingIds = KELPWATCH_REQUIRED_OBSERVATION_IDS.filter(
    (observationId) => !readBooleanFlag(flags, observationFlag(observationId)),
  );
  if (missingIds.length === 0) return;

  const missingTitles = missingIds.map(
    (observationId) => KELPWATCH_OBSERVATION_COPY[observationId].title,
  );
  throw new RangeError(
    `Record all four Kelpwatch Island observations before ${nextAction}. Missing: ${missingTitles.join(", ")}.`,
  );
}

function requireCorrectInterpretation(save) {
  const flags = getQuestState(save).flags;
  if (!readBooleanFlag(flags, FLAGS.interpretationCorrect)) {
    throw new RangeError(
      "Reach an evidence-supported interpretation before choosing the Kelpwatch Island response.",
    );
  }
}

function getFieldworkReward() {
  const reward = ADVENTURE_CONTENT.rewards.find(
    (candidate) => candidate.id === KELPWATCH_FIELDWORK_REWARD_ID,
  );
  if (!reward) {
    throw new Error(`Adventure content is missing ${KELPWATCH_FIELDWORK_REWARD_ID}.`);
  }
  return reward;
}

function missingStep(id, kind, label) {
  return Object.freeze({ id, kind, label });
}

export function getKelpwatchProgress(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const quest = getQuestState(save);
  const flags = quest.flags;
  const observedObservationIds = KELPWATCH_REQUIRED_OBSERVATION_IDS.filter(
    (observationId) => readBooleanFlag(flags, observationFlag(observationId)),
  );
  const missingObservationIds = KELPWATCH_REQUIRED_OBSERVATION_IDS.filter(
    (observationId) => !observedObservationIds.includes(observationId),
  );
  const completedResidentEncounterIds = KELPWATCH_RESIDENT_ENCOUNTER_IDS.filter(
    (encounterId) => save.progression.completedEncounterIds.includes(encounterId),
  );
  const missingResidentEncounterIds = KELPWATCH_RESIDENT_ENCOUNTER_IDS.filter(
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
      KELPWATCH_OBSERVATION_COPY[observationId].title,
    )),
    ...(!interpretationCorrect
      ? [missingStep("interpretation", "decision", "Build a supported three-link kelp food-web hypothesis")]
      : []),
    ...(!responseCorrect
      ? [missingStep("response", "decision", "Choose bounded monitoring and restoration")]
      : []),
    ...missingResidentEncounterIds.map((encounterId) => missingStep(
      encounterId,
      "resident-duel",
      KELPWATCH_RESIDENT_STEP_LABELS[encounterId],
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
    "begin-kelpwatch-investigation",
    "quest",
    "Begin the Kelpwatch food-web investigation",
  );

  return Object.freeze({
    questId: KELPWATCH_QUEST_ID,
    status: quest.status,
    started,
    complete: quest.status === "complete" && requirementsMet,
    readyToTurnIn: quest.status === "readyToTurnIn" && requirementsMet,
    stateConsistent: terminalStatusConsistent,
    requirementsMet,
    requiredObservationIds: KELPWATCH_REQUIRED_OBSERVATION_IDS,
    observedObservationIds: Object.freeze(observedObservationIds),
    missingObservationIds: Object.freeze(missingObservationIds),
    observationsComplete,
    residentEncounterIds: KELPWATCH_RESIDENT_ENCOUNTER_IDS,
    completedResidentEncounterIds: Object.freeze(completedResidentEncounterIds),
    missingResidentEncounterIds: Object.freeze(missingResidentEncounterIds),
    residentDuelsComplete,
    interpretation: Object.freeze({
      available: interpretationAvailable,
      blockedReason: !started
        ? "Begin the Kelpwatch food-web investigation first."
        : !fieldworkOpen && !interpretationCorrect
          ? "This investigation is no longer open for a new interpretation."
          : !observationsComplete
            ? `Record ${missingObservationIds.length} remaining observation${missingObservationIds.length === 1 ? "" : "s"} before interpreting the evidence.`
            : null,
      attempted: interpretationAttempted,
      correct: interpretationCorrect,
      correctChoiceId: KELPWATCH_CORRECT_INTERPRETATION_ID,
      lastChoiceId: interpretationChoiceId,
      correctiveAttempts: interpretationCorrectiveAttempts,
      feedback: interpretationChoiceId === null
        ? "Compare kelp cover, grazer abundance, predator evidence, and the repeat site before building a food-web explanation."
        : interpretationChoiceId === KELPWATCH_CORRECT_INTERPRETATION_ID
          ? KELPWATCH_SCIENCE_COPY.interpretation.correct
          : KELPWATCH_SCIENCE_COPY.interpretation.corrective,
    }),
    response: Object.freeze({
      available: responseAvailable,
      blockedReason: !started
        ? "Begin the Kelpwatch food-web investigation first."
        : !fieldworkOpen && !responseCorrect
          ? "This investigation is no longer open for a new response."
          : !observationsComplete
            ? "Record all four observations before choosing a response."
            : !interpretationCorrect
              ? "Reach an evidence-supported interpretation before choosing a response."
              : null,
      attempted: responseAttempted,
      correct: responseCorrect,
      correctChoiceId: KELPWATCH_CORRECT_RESPONSE_ID,
      lastChoiceId: responseChoiceId,
      correctiveAttempts: responseCorrectiveAttempts,
      feedback: responseChoiceId === null
        ? "Choose a response that repeats matched monitoring, checks multiple drivers, and lets permitted experts test only bounded restoration steps."
        : responseChoiceId === KELPWATCH_CORRECT_RESPONSE_ID
          ? KELPWATCH_SCIENCE_COPY.response.correct
          : KELPWATCH_SCIENCE_COPY.response.corrective,
    }),
    missingSteps: Object.freeze(missingSteps),
    nextStep: missingSteps[0] ?? null,
    nextAction: !started ? beginStep : missingSteps[0] ?? null,
  });
}

export function beginKelpwatchInvestigation(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const status = getQuestState(save).status;
  if (status !== "notStarted") {
    return { save, applied: false, progress: getKelpwatchProgress(save) };
  }

  const nextSave = transitionQuest(save, KELPWATCH_QUEST_ID, "active");
  return { save: nextSave, applied: true, progress: getKelpwatchProgress(nextSave) };
}

export function reconcileKelpwatchQuest(saveValue) {
  let save = normalizeAdventureSave(saveValue);
  const before = getKelpwatchProgress(save);
  if (before.status === "active" && before.requirementsMet) {
    save = transitionQuest(save, KELPWATCH_QUEST_ID, "readyToTurnIn");
  }
  const progress = getKelpwatchProgress(save);
  return {
    save,
    applied: before.status !== progress.status,
    progress,
  };
}

export function recordKelpwatchObservation(saveValue, observationIdValue) {
  let save = normalizeAdventureSave(saveValue);
  const status = requireInvestigationStarted(save);
  const observationId = normalizeChoiceId(observationIdValue, "observationId");
  if (!KELPWATCH_REQUIRED_OBSERVATION_IDS.includes(observationId)) {
    throw new RangeError(`Unknown Kelpwatch Island observation: ${observationId}.`);
  }

  const flagId = observationFlag(observationId);
  const alreadyRecorded = readBooleanFlag(getQuestState(save).flags, flagId);
  if (status !== "active" && !alreadyRecorded) {
    throw new RangeError("Terminal Kelpwatch Island fieldwork cannot accept new observations.");
  }
  if (!alreadyRecorded) save = setQuestFlag(save, KELPWATCH_QUEST_ID, flagId, true);
  const reconciled = reconcileKelpwatchQuest(save);
  return {
    save: reconciled.save,
    applied: !alreadyRecorded,
    observationId,
    evidence: KELPWATCH_OBSERVATION_COPY[observationId],
    feedback: KELPWATCH_OBSERVATION_COPY[observationId].feedback,
    progress: reconciled.progress,
  };
}

function submitDecision(saveValue, choiceIdValue, decision) {
  let save = normalizeAdventureSave(saveValue);
  const status = requireInvestigationStarted(save);
  const choiceId = normalizeChoiceId(choiceIdValue, `${decision.id}ChoiceId`);
  if (!decision.choices.some((choice) => choice.id === choiceId)) {
    throw new RangeError(`Unknown Kelpwatch Island ${decision.id} choice: ${choiceId}.`);
  }
  decision.requirePrerequisite(save);

  const quest = getQuestState(save);
  const wasCorrect = readBooleanFlag(quest.flags, decision.correctFlag);
  const attempted = readBooleanFlag(quest.flags, decision.attemptedFlag);
  const lastChoiceId = readChoiceFlag(quest.flags, decision.lastChoiceFlag);
  const correct = choiceId === decision.correctChoiceId;

  if (wasCorrect) {
    const reconciled = reconcileKelpwatchQuest(save);
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

  if (status !== "active") {
    throw new RangeError("Terminal Kelpwatch Island fieldwork cannot accept new decisions.");
  }

  if (!correct && attempted && lastChoiceId === choiceId) {
    const reconciled = reconcileKelpwatchQuest(save);
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

  save = setQuestFlag(save, KELPWATCH_QUEST_ID, decision.attemptedFlag, true);
  save = setQuestFlag(save, KELPWATCH_QUEST_ID, decision.lastChoiceFlag, choiceId);
  if (correct) {
    save = setQuestFlag(save, KELPWATCH_QUEST_ID, decision.correctFlag, true);
  } else {
    const priorAttempts = readCounterFlag(
      getQuestState(save).flags,
      decision.correctiveAttemptsFlag,
    );
    if (priorAttempts === MAX_CORRECTIVE_ATTEMPTS) {
      throw new RangeError(
        `Kelpwatch Island ${decision.id} corrective-attempt count cannot increase.`,
      );
    }
    save = setQuestFlag(
      save,
      KELPWATCH_QUEST_ID,
      decision.correctiveAttemptsFlag,
      priorAttempts + 1,
    );
  }

  const reconciled = reconcileKelpwatchQuest(save);
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

export function submitKelpwatchInterpretation(saveValue, choiceId) {
  return submitDecision(saveValue, choiceId, {
    id: "interpretation",
    correctChoiceId: KELPWATCH_CORRECT_INTERPRETATION_ID,
    attemptedFlag: FLAGS.interpretationAttempted,
    correctFlag: FLAGS.interpretationCorrect,
    lastChoiceFlag: FLAGS.interpretationLastChoice,
    correctiveAttemptsFlag: FLAGS.interpretationCorrectiveAttempts,
    choices: KELPWATCH_INTERPRETATION_CHOICES,
    requirePrerequisite: requireEveryObservation,
    copy: KELPWATCH_SCIENCE_COPY.interpretation,
  });
}

export function submitKelpwatchResponse(saveValue, choiceId) {
  return submitDecision(saveValue, choiceId, {
    id: "response",
    correctChoiceId: KELPWATCH_CORRECT_RESPONSE_ID,
    attemptedFlag: FLAGS.responseAttempted,
    correctFlag: FLAGS.responseCorrect,
    lastChoiceFlag: FLAGS.responseLastChoice,
    correctiveAttemptsFlag: FLAGS.responseCorrectiveAttempts,
    choices: KELPWATCH_RESPONSE_CHOICES,
    requirePrerequisite(save) {
      requireEveryObservation(save, "choosing the Kelpwatch Island response");
      requireCorrectInterpretation(save);
    },
    copy: KELPWATCH_SCIENCE_COPY.response,
  });
}

export function turnInKelpwatchFieldwork(saveValue) {
  const reconciled = reconcileKelpwatchQuest(saveValue);
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
        ? `Kelpwatch Island fieldwork is not ready to turn in. Missing: ${labels.join(", ")}.`
        : "Kelpwatch Island fieldwork is not ready to turn in.",
    );
  }

  const completedNow = status === "readyToTurnIn";
  if (completedNow) save = transitionQuest(save, KELPWATCH_QUEST_ID, "complete");
  const fieldworkReward = getFieldworkReward();
  const reward = grantReward(save, fieldworkReward);

  return {
    save: reward.save,
    applied: completedNow || reward.applied,
    completed: completedNow,
    rewardApplied: reward.applied,
    fieldNoteIds: Object.freeze([...(fieldworkReward.fieldNoteIds ?? [])]),
    progress: getKelpwatchProgress(reward.save),
  };
}
