import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import {
  grantReward,
  normalizeAdventureSave,
  setQuestFlag,
  transitionQuest,
} from "./adventureProgression.mjs";

export const TRENCHLIGHT_QUEST_ID = "quest-trenchlight-sensor";

export const TRENCHLIGHT_REQUIRED_OBSERVATION_IDS = Object.freeze([
  "trenchlight-fading-light-profile",
  "trenchlight-pressure-profile",
  "trenchlight-marine-snow-camera",
  "trenchlight-bioluminescence-camera",
]);

export const TRENCHLIGHT_RESIDENT_ENCOUNTER_IDS = Object.freeze([
  "encounter-trenchlight-resident-engineer",
  "encounter-trenchlight-resident-observer",
]);

const TRENCHLIGHT_RESIDENT_STEP_LABELS = Object.freeze({
  "encounter-trenchlight-resident-engineer": "Win the sub engineer's resident duel",
  "encounter-trenchlight-resident-observer": "Win the deep-sea observer's resident duel",
});

export const TRENCHLIGHT_CORRECT_INTERPRETATION_ID =
  "trenchlight-local-evidence-supports-multiple-deep-energy-pathways";
export const TRENCHLIGHT_CORRECT_RESPONSE_ID =
  "trenchlight-recover-sensor-with-clearance-and-abort-criteria";

export const TRENCHLIGHT_EXPEDITION_RULES = Object.freeze({
  pilotControl: "expert-npc",
  playerTools: Object.freeze([
    "light-meter",
    "pressure-sensor",
    "low-light-camera",
    "sonar",
    "sensor-lift-command",
  ]),
  target: "deployed-research-sensor",
  wildlifeCollectionAllowed: false,
  habitatContactAllowed: false,
  abortOnUncertainClearance: true,
});

function freezeChoice(id, label, detail) {
  return Object.freeze({ id, label, detail });
}

export const TRENCHLIGHT_INTERPRETATION_CHOICES = Object.freeze([
  freezeChoice(
    TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
    "Use the local light, food, and instrument evidence",
    "The descent shows deep life adapted to darkness and pressure, with surface-derived marine snow supporting this sampled food web. Chemosynthesis can support communities at confirmed vents or seeps, but none of these four records establishes such a feature on this route.",
  ),
  freezeChoice(
    "trenchlight-every-trench-has-a-vent",
    "Assume every trench contains a hydrothermal vent",
    "Depth and darkness are enough to declare a vent, without local temperature, chemical, or geological evidence.",
  ),
  freezeChoice(
    "trenchlight-all-deep-life-uses-chemosynthesis",
    "Assume all deep life relies on chemosynthesis",
    "Because sunlight does not reach the deep station, sinking surface material cannot support its food web.",
  ),
  freezeChoice(
    "trenchlight-darkness-means-no-life-or-food",
    "Assume darkness means there is no food or life",
    "Without photosynthesis at depth, the marine-snow record and observed animals should be ignored.",
  ),
]);

export const TRENCHLIGHT_RESPONSE_CHOICES = Object.freeze([
  freezeChoice(
    TRENCHLIGHT_CORRECT_RESPONSE_ID,
    "Recover only after a clear approach, with stop criteria",
    "Use camera and sonar to confirm the marked lift point and a habitat-free approach. The expert pilot stabilizes the sub, the trained crew lifts the sensor, and the team aborts if clearance becomes uncertain or contact is likely.",
  ),
  freezeChoice(
    "trenchlight-grab-sensor-immediately",
    "Grab the sensor as soon as it appears",
    "Move the arm before checking whether the sensor, cable, or approach is beside fragile living habitat.",
  ),
  freezeChoice(
    "trenchlight-collect-wildlife-with-sensor",
    "Collect nearby animals for a closer look",
    "Add unplanned wildlife collection to an observational instrument-recovery mission.",
  ),
  freezeChoice(
    "trenchlight-free-pilot-around-obstacle",
    "Take over the sub and squeeze past the habitat",
    "Let the player free-pilot through a narrow approach instead of leaving vehicle control and the abort decision with the trained expedition crew.",
  ),
]);

const TRENCHLIGHT_FIELDWORK_REWARD_ID = "reward-trenchlight-fieldwork";
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

const TRENCHLIGHT_REQUIREMENT_FLAG_IDS = Object.freeze([
  ...TRENCHLIGHT_REQUIRED_OBSERVATION_IDS.map(observationFlag),
  FLAGS.interpretationCorrect,
  FLAGS.responseCorrect,
]);

const TRENCHLIGHT_BOOLEAN_FLAG_IDS = Object.freeze([
  ...TRENCHLIGHT_REQUIREMENT_FLAG_IDS,
  FLAGS.interpretationAttempted,
  FLAGS.responseAttempted,
]);

const TRENCHLIGHT_COUNTER_FLAG_IDS = Object.freeze([
  FLAGS.interpretationCorrectiveAttempts,
  FLAGS.responseCorrectiveAttempts,
]);

const TRENCHLIGHT_CHOICE_FLAG_IDS = Object.freeze([
  FLAGS.interpretationLastChoice,
  FLAGS.responseLastChoice,
]);

function freezeEvidence({ title, station, depthBand, method, measurements, feedback }) {
  return Object.freeze({
    title,
    context: Object.freeze({ station, depthBand, method }),
    measurements: Object.freeze({ ...measurements }),
    feedback,
  });
}

export const TRENCHLIGHT_OBSERVATION_COPY = Object.freeze({
  "trenchlight-fading-light-profile": freezeEvidence({
    title: "Fading-light descent profile",
    station: "Fixed depth marks along the NPC-piloted descent line",
    depthBand: "Surface reference through 1,050 meters",
    method: "Log the calibrated light meter at marked depths while the expert pilot holds position",
    measurements: {
      lightClue: "Sunlight dwindles below about 200 meters; the meter detects no sunlight at the 1,050-meter station",
      pressureClue: "Pressure rises throughout the same descent and is logged separately",
      foodClue: "No sunlight at depth means photosynthesis does not occur there, not that all food or life disappears",
      adaptationClue: "Darkness is the setting in which the later low-light observations must be interpreted",
      ventClue: "Depth and darkness alone do not establish a hydrothermal vent",
    },
    feedback: "Light decreases rapidly as the sub descends. Below roughly 1,000 meters, sunlight is absent, so photosynthesis cannot happen at the station. That does not make the habitat lifeless: material can arrive from above, and organisms have adaptations for dark water.",
  }),
  "trenchlight-pressure-profile": freezeEvidence({
    title: "Rising-pressure instrument profile",
    station: "The same fixed stations used for the light profile",
    depthBand: "Surface reference through 1,050 meters",
    method: "Read the sub's external pressure sensor; remain inside the pressure-rated vehicle",
    measurements: {
      lightClue: "Light and pressure change together during descent but are different physical measurements",
      pressureClue: "Water pressure increases by about one atmosphere for every 10 meters of depth",
      foodClue: "Pressure does not identify whether food comes from sinking material or local chemical production",
      adaptationClue: "Deep organisms must function under pressure that would harm unprotected surface organisms",
      ventClue: "High pressure is common across deep habitats and is not evidence of a vent",
    },
    feedback: "The pressure record follows the expected increase with depth. The sub protects its occupants; deep-sea organisms have their own adaptations. High pressure is a general deep-ocean condition, not a sign that this trench contains a vent.",
  }),
  "trenchlight-marine-snow-camera": freezeEvidence({
    title: "Marine-snow camera record",
    station: "Midwater camera transect above the sensor site",
    depthBand: "700 to 1,050 meters",
    method: "Record sinking particles with the fixed camera without chasing, touching, feeding, or collecting animals",
    measurements: {
      lightClue: "Particles remain visible on the low-light camera after sunlight has disappeared",
      pressureClue: "The particles pass through several pressure readings as they sink",
      foodClue: "Organic particles derived mostly from surface waters descend toward the trench and can feed deep animals",
      adaptationClue: "Several observed animals filter particles or scavenge settled material",
      ventClue: "This surface-linked food pathway does not require a local vent",
    },
    feedback: "Marine snow is mostly biological debris from upper waters. It can provide a major energy pathway for animals in dark deep water, and currents can change where and how much arrives. Chemosynthetic food webs exist at confirmed vents and seeps, but they are not the only deep-ocean pathway.",
  }),
  "trenchlight-bioluminescence-camera": freezeEvidence({
    title: "Bioluminescence camera observation",
    station: "Dark-water observation stop before the sensor approach",
    depthBand: "1,000 to 1,050 meters",
    method: "Use the passive low-light camera and keep bright lamps off; do not approach or collect the animals",
    measurements: {
      lightClue: "Brief points of living light appear where the ambient-light meter reads no sunlight",
      pressureClue: "The flashes occur at the deep station's high-pressure reading",
      foodClue: "A light display does not reveal an organism's complete food or energy pathway",
      adaptationClue: "Bioluminescence may help with finding food, reproduction, or defense; this sighting alone cannot assign one function",
      ventClue: "Bioluminescence is not proof of a vent or chemosynthesis",
    },
    feedback: "Bioluminescence is light made by a living organism. It can serve several functions in dark water, including feeding, reproduction, and defense, but a brief camera record cannot tell which function applies here. Bright lights and collection are unnecessary for this observation.",
  }),
});

export const TRENCHLIGHT_SCIENCE_COPY = Object.freeze({
  interpretation: Object.freeze({
    correct: "That reading matches the local evidence. The descent records darkness, rising pressure, surface-derived marine snow, and organisms with varied light-producing adaptations. Those four records do not establish a vent on this route. Chemosynthesis can support communities at confirmed hydrothermal vents and cold seeps, but not every trench has one and much deep-ocean life uses food ultimately linked to surface photosynthesis.",
    corrective: "Use all four records and keep the claim local. Darkness and pressure define deep conditions, not a vent. Marine snow connects this site to surface production, while bioluminescence is an adaptation with several possible functions. A vent or chemosynthetic community needs its own temperature, chemical, and habitat evidence.",
  }),
  response: Object.freeze({
    correct: "The expert pilot holds position while the team confirms the sensor's marked lift point and a clear approach with camera and sonar. Trained crew recover only the deployed instrument, record the site's metadata, and stop if the cable is entangled, living habitat is attached, visibility is inadequate, or contact becomes likely. No wildlife is collected and the player never free-pilots the sub.",
    corrective: "Do not rush the arm, collect wildlife, or steer through fragile habitat. Recheck the sensor and approach with camera and sonar, keep the trained pilot in control, and abort for a later expert plan whenever clearance or the sensor's condition is uncertain.",
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
    throw new TypeError(`Trenchlight Station quest flag ${flagId} must be a boolean.`);
  }
  return value;
}

function readCounterFlag(flags, flagId) {
  const value = flags[flagId];
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(
      `Trenchlight Station quest flag ${flagId} must be a non-negative safe integer.`,
    );
  }
  return value;
}

function readChoiceFlag(flags, flagId) {
  const value = flags[flagId];
  if (value === undefined) return null;
  return normalizeChoiceId(value, `Trenchlight Station quest flag ${flagId}`);
}

function getQuestState(save) {
  return save.progression.quests[TRENCHLIGHT_QUEST_ID] ?? {
    status: "notStarted",
    flags: {},
  };
}

export function recoverTrenchlightQuestFlags(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const quest = save.progression.quests[TRENCHLIGHT_QUEST_ID];
  if (!quest) {
    return { save, applied: false, discardedFlagIds: Object.freeze([]) };
  }

  const invalidFlagIds = [];
  for (const flagId of TRENCHLIGHT_BOOLEAN_FLAG_IDS) {
    const value = quest.flags[flagId];
    if (value !== undefined && typeof value !== "boolean") invalidFlagIds.push(flagId);
  }
  for (const flagId of TRENCHLIGHT_COUNTER_FLAG_IDS) {
    const value = quest.flags[flagId];
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
      invalidFlagIds.push(flagId);
    }
  }
  for (const flagId of TRENCHLIGHT_CHOICE_FLAG_IDS) {
    const value = quest.flags[flagId];
    if (value === undefined) continue;
    try {
      normalizeChoiceId(value, `Trenchlight Station quest flag ${flagId}`);
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
  ) && discardedFlagIds.some((flagId) => TRENCHLIGHT_REQUIREMENT_FLAG_IDS.includes(flagId));

  return {
    save: normalizeAdventureSave({
      ...save,
      progression: {
        ...save.progression,
        quests: {
          ...save.progression.quests,
          [TRENCHLIGHT_QUEST_ID]: {
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

function requireExpeditionStarted(save) {
  const status = getQuestState(save).status;
  if (status === "notStarted") {
    throw new RangeError("Begin the NPC-piloted Trenchlight expedition before continuing fieldwork.");
  }
  return status;
}

function requireEveryObservation(save, nextAction = "interpreting the evidence") {
  const flags = getQuestState(save).flags;
  const missingIds = TRENCHLIGHT_REQUIRED_OBSERVATION_IDS.filter(
    (observationId) => !readBooleanFlag(flags, observationFlag(observationId)),
  );
  if (missingIds.length === 0) return;

  const missingTitles = missingIds.map(
    (observationId) => TRENCHLIGHT_OBSERVATION_COPY[observationId].title,
  );
  throw new RangeError(
    `Record all four Trenchlight observations before ${nextAction}. Missing: ${missingTitles.join(", ")}.`,
  );
}

function requireCorrectInterpretation(save) {
  const flags = getQuestState(save).flags;
  if (!readBooleanFlag(flags, FLAGS.interpretationCorrect)) {
    throw new RangeError(
      "Reach an evidence-supported deep-ocean interpretation before choosing the sensor response.",
    );
  }
}

function getFieldworkReward() {
  const reward = ADVENTURE_CONTENT.rewards.find(
    (candidate) => candidate.id === TRENCHLIGHT_FIELDWORK_REWARD_ID,
  );
  if (!reward) {
    throw new Error(`Adventure content is missing ${TRENCHLIGHT_FIELDWORK_REWARD_ID}.`);
  }
  return reward;
}

function missingStep(id, kind, label) {
  return Object.freeze({ id, kind, label });
}

export function getTrenchlightProgress(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const quest = getQuestState(save);
  const flags = quest.flags;
  const observedObservationIds = TRENCHLIGHT_REQUIRED_OBSERVATION_IDS.filter(
    (observationId) => readBooleanFlag(flags, observationFlag(observationId)),
  );
  const missingObservationIds = TRENCHLIGHT_REQUIRED_OBSERVATION_IDS.filter(
    (observationId) => !observedObservationIds.includes(observationId),
  );
  const completedResidentEncounterIds = TRENCHLIGHT_RESIDENT_ENCOUNTER_IDS.filter(
    (encounterId) => save.progression.completedEncounterIds.includes(encounterId),
  );
  const missingResidentEncounterIds = TRENCHLIGHT_RESIDENT_ENCOUNTER_IDS.filter(
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
      TRENCHLIGHT_OBSERVATION_COPY[observationId].title,
    )),
    ...(!interpretationCorrect
      ? [missingStep("trenchlight-interpretation", "decision", "Explain the local deep-ocean evidence without assuming a vent")]
      : []),
    ...(!responseCorrect
      ? [missingStep("trenchlight-sensor-response", "decision", "Choose a cleared, abortable sensor recovery")]
      : []),
    ...missingResidentEncounterIds.map((encounterId) => missingStep(
      encounterId,
      "resident-duel",
      TRENCHLIGHT_RESIDENT_STEP_LABELS[encounterId],
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
    "begin-trenchlight-expedition",
    "quest",
    "Begin the NPC-piloted Trenchlight sensor expedition",
  );

  return Object.freeze({
    questId: TRENCHLIGHT_QUEST_ID,
    status: quest.status,
    started,
    complete: quest.status === "complete" && requirementsMet,
    readyToTurnIn: quest.status === "readyToTurnIn" && requirementsMet,
    stateConsistent: terminalStatusConsistent,
    requirementsMet,
    expeditionRules: TRENCHLIGHT_EXPEDITION_RULES,
    requiredObservationIds: TRENCHLIGHT_REQUIRED_OBSERVATION_IDS,
    observedObservationIds: Object.freeze(observedObservationIds),
    missingObservationIds: Object.freeze(missingObservationIds),
    observationsComplete,
    residentEncounterIds: TRENCHLIGHT_RESIDENT_ENCOUNTER_IDS,
    completedResidentEncounterIds: Object.freeze(completedResidentEncounterIds),
    missingResidentEncounterIds: Object.freeze(missingResidentEncounterIds),
    residentDuelsComplete,
    sensorRecovered: responseCorrect,
    habitatDisturbed: false,
    interpretation: Object.freeze({
      available: interpretationAvailable,
      blockedReason: !started
        ? "Begin the NPC-piloted Trenchlight expedition first."
        : !fieldworkOpen && !interpretationCorrect
          ? "This expedition is no longer open for a new interpretation."
          : !observationsComplete
            ? `Record ${missingObservationIds.length} remaining observation${missingObservationIds.length === 1 ? "" : "s"} before interpreting the evidence.`
            : null,
      attempted: interpretationAttempted,
      correct: interpretationCorrect,
      correctChoiceId: TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
      lastChoiceId: interpretationChoiceId,
      correctiveAttempts: interpretationCorrectiveAttempts,
      feedback: interpretationChoiceId === null
        ? "Compare the light, pressure, marine-snow, and bioluminescence records before explaining this local deep-ocean food web."
        : interpretationChoiceId === TRENCHLIGHT_CORRECT_INTERPRETATION_ID
          ? TRENCHLIGHT_SCIENCE_COPY.interpretation.correct
          : TRENCHLIGHT_SCIENCE_COPY.interpretation.corrective,
    }),
    response: Object.freeze({
      available: responseAvailable,
      blockedReason: !started
        ? "Begin the NPC-piloted Trenchlight expedition first."
        : !fieldworkOpen && !responseCorrect
          ? "This expedition is no longer open for a new sensor response."
          : !observationsComplete
            ? "Record all four observations before choosing a sensor response."
            : !interpretationCorrect
              ? "Reach an evidence-supported interpretation before choosing a sensor response."
              : null,
      attempted: responseAttempted,
      correct: responseCorrect,
      correctChoiceId: TRENCHLIGHT_CORRECT_RESPONSE_ID,
      lastChoiceId: responseChoiceId,
      correctiveAttempts: responseCorrectiveAttempts,
      feedback: responseChoiceId === null
        ? "Choose a recovery that verifies clearance, keeps the expert pilot in control, and stops instead of contacting habitat."
        : responseChoiceId === TRENCHLIGHT_CORRECT_RESPONSE_ID
          ? TRENCHLIGHT_SCIENCE_COPY.response.correct
          : TRENCHLIGHT_SCIENCE_COPY.response.corrective,
    }),
    missingSteps: Object.freeze(missingSteps),
    nextStep: missingSteps[0] ?? null,
    nextAction: !started ? beginStep : missingSteps[0] ?? null,
  });
}

export function beginTrenchlightExpedition(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const status = getQuestState(save).status;
  if (status !== "notStarted") {
    return { save, applied: false, progress: getTrenchlightProgress(save) };
  }

  const nextSave = transitionQuest(save, TRENCHLIGHT_QUEST_ID, "active");
  return { save: nextSave, applied: true, progress: getTrenchlightProgress(nextSave) };
}

export function reconcileTrenchlightQuest(saveValue) {
  let save = normalizeAdventureSave(saveValue);
  const before = getTrenchlightProgress(save);
  if (before.status === "active" && before.requirementsMet) {
    save = transitionQuest(save, TRENCHLIGHT_QUEST_ID, "readyToTurnIn");
  }
  const progress = getTrenchlightProgress(save);
  return {
    save,
    applied: before.status !== progress.status,
    progress,
  };
}

export function recordTrenchlightObservation(saveValue, observationIdValue) {
  let save = normalizeAdventureSave(saveValue);
  const status = requireExpeditionStarted(save);
  const observationId = normalizeChoiceId(observationIdValue, "observationId");
  if (!TRENCHLIGHT_REQUIRED_OBSERVATION_IDS.includes(observationId)) {
    throw new RangeError(`Unknown Trenchlight observation: ${observationId}.`);
  }

  const flagId = observationFlag(observationId);
  const alreadyRecorded = readBooleanFlag(getQuestState(save).flags, flagId);
  if (status !== "active" && !alreadyRecorded) {
    throw new RangeError("Terminal Trenchlight fieldwork cannot accept new observations.");
  }
  if (!alreadyRecorded) save = setQuestFlag(save, TRENCHLIGHT_QUEST_ID, flagId, true);
  const reconciled = reconcileTrenchlightQuest(save);
  return {
    save: reconciled.save,
    applied: !alreadyRecorded,
    observationId,
    evidence: TRENCHLIGHT_OBSERVATION_COPY[observationId],
    feedback: TRENCHLIGHT_OBSERVATION_COPY[observationId].feedback,
    progress: reconciled.progress,
  };
}

function submitDecision(saveValue, choiceIdValue, decision) {
  let save = normalizeAdventureSave(saveValue);
  const status = requireExpeditionStarted(save);
  const choiceId = normalizeChoiceId(choiceIdValue, `${decision.id}ChoiceId`);
  if (!decision.choices.some((choice) => choice.id === choiceId)) {
    throw new RangeError(`Unknown Trenchlight ${decision.id} choice: ${choiceId}.`);
  }
  decision.requirePrerequisite(save);

  const quest = getQuestState(save);
  const wasCorrect = readBooleanFlag(quest.flags, decision.correctFlag);
  const attempted = readBooleanFlag(quest.flags, decision.attemptedFlag);
  const lastChoiceId = readChoiceFlag(quest.flags, decision.lastChoiceFlag);
  const correct = choiceId === decision.correctChoiceId;

  if (wasCorrect) {
    const reconciled = reconcileTrenchlightQuest(save);
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
    throw new RangeError("Terminal Trenchlight fieldwork cannot accept new decisions.");
  }

  if (!correct && attempted && lastChoiceId === choiceId) {
    const reconciled = reconcileTrenchlightQuest(save);
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

  save = setQuestFlag(save, TRENCHLIGHT_QUEST_ID, decision.attemptedFlag, true);
  save = setQuestFlag(save, TRENCHLIGHT_QUEST_ID, decision.lastChoiceFlag, choiceId);
  if (correct) {
    save = setQuestFlag(save, TRENCHLIGHT_QUEST_ID, decision.correctFlag, true);
  } else {
    const priorAttempts = readCounterFlag(
      getQuestState(save).flags,
      decision.correctiveAttemptsFlag,
    );
    if (priorAttempts === MAX_CORRECTIVE_ATTEMPTS) {
      throw new RangeError(
        `Trenchlight ${decision.id} corrective-attempt count cannot increase.`,
      );
    }
    save = setQuestFlag(
      save,
      TRENCHLIGHT_QUEST_ID,
      decision.correctiveAttemptsFlag,
      priorAttempts + 1,
    );
  }

  const reconciled = reconcileTrenchlightQuest(save);
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

export function submitTrenchlightInterpretation(saveValue, choiceId) {
  return submitDecision(saveValue, choiceId, {
    id: "interpretation",
    correctChoiceId: TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
    attemptedFlag: FLAGS.interpretationAttempted,
    correctFlag: FLAGS.interpretationCorrect,
    lastChoiceFlag: FLAGS.interpretationLastChoice,
    correctiveAttemptsFlag: FLAGS.interpretationCorrectiveAttempts,
    choices: TRENCHLIGHT_INTERPRETATION_CHOICES,
    requirePrerequisite: requireEveryObservation,
    copy: TRENCHLIGHT_SCIENCE_COPY.interpretation,
  });
}

export function submitTrenchlightResponse(saveValue, choiceId) {
  return submitDecision(saveValue, choiceId, {
    id: "response",
    correctChoiceId: TRENCHLIGHT_CORRECT_RESPONSE_ID,
    attemptedFlag: FLAGS.responseAttempted,
    correctFlag: FLAGS.responseCorrect,
    lastChoiceFlag: FLAGS.responseLastChoice,
    correctiveAttemptsFlag: FLAGS.responseCorrectiveAttempts,
    choices: TRENCHLIGHT_RESPONSE_CHOICES,
    requirePrerequisite(save) {
      requireEveryObservation(save, "choosing the Trenchlight sensor response");
      requireCorrectInterpretation(save);
    },
    copy: TRENCHLIGHT_SCIENCE_COPY.response,
  });
}

export function turnInTrenchlightFieldwork(saveValue) {
  const reconciled = reconcileTrenchlightQuest(saveValue);
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
        ? `Trenchlight fieldwork is not ready to turn in. Missing: ${labels.join(", ")}.`
        : "Trenchlight fieldwork is not ready to turn in.",
    );
  }

  const completedNow = status === "readyToTurnIn";
  if (completedNow) save = transitionQuest(save, TRENCHLIGHT_QUEST_ID, "complete");
  const fieldworkReward = getFieldworkReward();
  const reward = grantReward(save, fieldworkReward);

  return {
    save: reward.save,
    applied: completedNow || reward.applied,
    completed: completedNow,
    rewardApplied: reward.applied,
    fieldNoteIds: Object.freeze([...(fieldworkReward.fieldNoteIds ?? [])]),
    progress: getTrenchlightProgress(reward.save),
  };
}
