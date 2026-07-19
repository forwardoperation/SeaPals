import assert from "node:assert/strict";
import test from "node:test";
import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import {
  createInitialAdventureSave,
  normalizeAdventureSave,
} from "./adventureProgression.mjs";
import {
  KELPWATCH_CORRECT_INTERPRETATION_ID,
  KELPWATCH_CORRECT_RESPONSE_ID,
  KELPWATCH_INTERPRETATION_CHOICES,
  KELPWATCH_OBSERVATION_COPY,
  KELPWATCH_QUEST_ID,
  KELPWATCH_REQUIRED_OBSERVATION_IDS,
  KELPWATCH_RESIDENT_ENCOUNTER_IDS,
  KELPWATCH_RESPONSE_CHOICES,
  KELPWATCH_SCIENCE_COPY,
  beginKelpwatchInvestigation,
  getKelpwatchProgress,
  reconcileKelpwatchQuest,
  recordKelpwatchObservation,
  recoverKelpwatchQuestFlags,
  submitKelpwatchInterpretation,
  submitKelpwatchResponse,
  turnInKelpwatchFieldwork,
} from "./adventureKelpwatch.mjs";

function permutations(values) {
  if (values.length < 2) return [values];
  return values.flatMap((value, index) => (
    permutations(values.filter((_, candidateIndex) => candidateIndex !== index))
      .map((tail) => [value, ...tail])
  ));
}

function withCompletedEncounter(saveValue, encounterId) {
  const save = normalizeAdventureSave(saveValue);
  if (save.progression.completedEncounterIds.includes(encounterId)) return save;
  return normalizeAdventureSave({
    ...save,
    progression: {
      ...save.progression,
      completedEncounterIds: [...save.progression.completedEncounterIds, encounterId],
    },
  });
}

function completeObservations(saveValue) {
  return KELPWATCH_REQUIRED_OBSERVATION_IDS.reduce(
    (save, observationId) => recordKelpwatchObservation(save, observationId).save,
    saveValue,
  );
}

function completeDecisions(saveValue) {
  let save = submitKelpwatchInterpretation(
    saveValue,
    KELPWATCH_CORRECT_INTERPRETATION_ID,
  ).save;
  save = submitKelpwatchResponse(save, KELPWATCH_CORRECT_RESPONSE_ID).save;
  return save;
}

function completeResidents(saveValue) {
  return KELPWATCH_RESIDENT_ENCOUNTER_IDS.reduce(withCompletedEncounter, saveValue);
}

function jsonRoundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}

function withKelpwatchQuest(saveValue, questState) {
  const save = normalizeAdventureSave(saveValue);
  return normalizeAdventureSave({
    ...save,
    progression: {
      ...save.progression,
      quests: {
        ...save.progression.quests,
        [KELPWATCH_QUEST_ID]: questState,
      },
    },
  });
}

test("Kelpwatch Island reuses the canonical quest, resident, reward, and Field Note IDs", () => {
  assert.equal(KELPWATCH_QUEST_ID, "quest-kelpwatch-balance");
  assert.deepEqual(KELPWATCH_REQUIRED_OBSERVATION_IDS, [
    "kelp-cover-transect",
    "grazer-abundance-count",
    "predator-evidence-survey",
    "repeat-comparison-site",
  ]);
  assert.deepEqual(KELPWATCH_RESIDENT_ENCOUNTER_IDS, [
    "encounter-kelpwatch-resident-diver",
    "encounter-kelpwatch-resident-ranger",
  ]);
  assert.ok(Object.isFrozen(KELPWATCH_REQUIRED_OBSERVATION_IDS));
  assert.ok(Object.isFrozen(KELPWATCH_RESIDENT_ENCOUNTER_IDS));

  const quest = ADVENTURE_CONTENT.quests.find(({ id }) => id === KELPWATCH_QUEST_ID);
  assert.ok(quest);
  assert.equal(quest.rewardId, "reward-kelpwatch-fieldwork");
  assert.deepEqual(
    KELPWATCH_RESIDENT_ENCOUNTER_IDS.map((encounterId) => (
      ADVENTURE_CONTENT.encounters.find(({ id }) => id === encounterId)?.questId
    )),
    [KELPWATCH_QUEST_ID, KELPWATCH_QUEST_ID],
  );

  const reward = ADVENTURE_CONTENT.rewards.find(
    ({ id }) => id === "reward-kelpwatch-fieldwork",
  );
  assert.deepEqual(reward, {
    id: "reward-kelpwatch-fieldwork",
    grantId: "reward-kelpwatch-fieldwork",
    fieldNoteIds: ["field-note-kelp-food-web"],
  });
  assert.ok(ADVENTURE_CONTENT.fieldNotes.some(
    ({ id }) => id === "field-note-kelp-food-web",
  ));
});

test("decision catalogs expose one supported answer and safe teachable distractors", () => {
  assert.equal(
    KELPWATCH_CORRECT_INTERPRETATION_ID,
    "three-link-food-web-fits-observed-pattern",
  );
  assert.equal(
    KELPWATCH_CORRECT_RESPONSE_ID,
    "monitor-drivers-and-test-bounded-restoration",
  );
  assert.deepEqual(
    KELPWATCH_INTERPRETATION_CHOICES.map(({ id }) => id),
    [
      KELPWATCH_CORRECT_INTERPRETATION_ID,
      "low-kelp-proves-one-species-caused-it",
      "food-web-links-never-affect-kelp",
    ],
  );
  assert.deepEqual(
    KELPWATCH_RESPONSE_CHOICES.map(({ id }) => id),
    [
      KELPWATCH_CORRECT_RESPONSE_ID,
      "remove-one-species-to-reset-forest",
      "wait-without-repeat-monitoring",
    ],
  );

  for (const catalog of [KELPWATCH_INTERPRETATION_CHOICES, KELPWATCH_RESPONSE_CHOICES]) {
    assert.ok(Object.isFrozen(catalog));
    assert.equal(new Set(catalog.map(({ id }) => id)).size, catalog.length);
    for (const choice of catalog) {
      assert.ok(Object.isFrozen(choice));
      assert.ok(choice.label.length > 0);
      assert.ok(choice.detail.length > 0);
    }
  }
});

test("four distinct evidence records build a cautious three-link food-web hypothesis", () => {
  assert.equal(KELPWATCH_REQUIRED_OBSERVATION_IDS.length, 4);
  assert.equal(new Set(KELPWATCH_REQUIRED_OBSERVATION_IDS).size, 4);

  for (const observationId of KELPWATCH_REQUIRED_OBSERVATION_IDS) {
    const observation = KELPWATCH_OBSERVATION_COPY[observationId];
    assert.ok(observation, `Missing evidence copy for ${observationId}.`);
    assert.deepEqual(Object.keys(observation.context), ["site", "timing", "method"]);
    assert.deepEqual(
      Object.keys(observation.measurements),
      ["kelpCoverClue", "grazerClue", "predatorClue", "comparisonClue"],
    );
    assert.ok(Object.values(observation.context).every((value) => value.length > 0));
    assert.ok(Object.values(observation.measurements).every((value) => value.length > 0));
    assert.match(observation.feedback, /kelp|grazer|predator|repeat|comparison/i);
    assert.ok(Object.isFrozen(observation));
    assert.ok(Object.isFrozen(observation.context));
    assert.ok(Object.isFrozen(observation.measurements));
  }

  assert.match(
    KELPWATCH_OBSERVATION_COPY["grazer-abundance-count"].feedback,
    /not a universal instruction to remove grazers/i,
  );
  assert.match(
    KELPWATCH_OBSERVATION_COPY["predator-evidence-survey"].feedback,
    /consistent with a trophic cascade.*does not prove/i,
  );
  assert.match(
    KELPWATCH_OBSERVATION_COPY["predator-evidence-survey"]
      .measurements.comparisonClue,
    /non-detection is not proof of absence/i,
  );
  assert.match(
    KELPWATCH_OBSERVATION_COPY["repeat-comparison-site"].feedback,
    /more credible than a single snapshot.*do not isolate one cause/i,
  );
  assert.match(KELPWATCH_SCIENCE_COPY.interpretation.correct, /association, not proof/i);
});

test("science and safety copy reject a one-species instant fix", () => {
  const boundedResponse = KELPWATCH_RESPONSE_CHOICES.find(
    ({ id }) => id === KELPWATCH_CORRECT_RESPONSE_ID,
  );
  assert.match(boundedResponse.detail, /permitted experts/i);
  assert.match(boundedResponse.detail, /small, reversible, monitored response/i);
  assert.match(
    KELPWATCH_SCIENCE_COPY.response.correct,
    /temperature, nutrients, storms, substrate, recruitment, harvest, disease/i,
  );
  assert.match(
    KELPWATCH_SCIENCE_COPY.response.correct,
    /removing one species or adding one predator is not an instant or universal/i,
  );
  assert.match(
    KELPWATCH_SCIENCE_COPY.response.corrective,
    /reserve any organism handling or restoration for permitted experts/i,
  );
  assert.match(
    KELPWATCH_OBSERVATION_COPY["grazer-abundance-count"].context.method,
    /do not touch, feed, move, or remove/i,
  );

  const exportedCopy = JSON.stringify({
    observations: KELPWATCH_OBSERVATION_COPY,
    interpretationChoices: KELPWATCH_INTERPRETATION_CHOICES,
    responseChoices: KELPWATCH_RESPONSE_CHOICES,
    science: KELPWATCH_SCIENCE_COPY,
  });
  assert.doesNotMatch(
    exportedCopy,
    /ghost gear|drifter|entangling gear|navigator|deckhand|kelpwatchs|Kelpwatch Commons/i,
  );
});

test("the investigation begins once and rejects premature fieldwork", () => {
  const initial = createInitialAdventureSave("kelpwatch-begin");
  const before = getKelpwatchProgress(initial);
  assert.equal(before.status, "notStarted");
  assert.equal(before.started, false);
  assert.deepEqual(before.missingObservationIds, KELPWATCH_REQUIRED_OBSERVATION_IDS);
  assert.deepEqual(before.missingResidentEncounterIds, KELPWATCH_RESIDENT_ENCOUNTER_IDS);
  assert.equal(before.interpretation.available, false);
  assert.equal(before.response.available, false);
  assert.equal(before.nextAction.id, "begin-kelpwatch-investigation");
  assert.deepEqual(
    before.missingSteps
      .filter((step) => step.kind === "resident-duel")
      .map((step) => step.label),
    ["Win the diver's resident duel", "Win the ranger's resident duel"],
  );

  assert.throws(
    () => recordKelpwatchObservation(initial, KELPWATCH_REQUIRED_OBSERVATION_IDS[0]),
    /Begin the Kelpwatch Island investigation/,
  );
  assert.throws(
    () => submitKelpwatchInterpretation(initial, KELPWATCH_CORRECT_INTERPRETATION_ID),
    /Begin the Kelpwatch Island investigation/,
  );

  const first = beginKelpwatchInvestigation(initial);
  assert.equal(first.applied, true);
  assert.equal(first.progress.status, "active");
  assert.match(first.progress.interpretation.blockedReason, /4 remaining observations/);
  assert.match(first.progress.response.blockedReason, /all four observations/i);
  const repeated = beginKelpwatchInvestigation(first.save);
  assert.equal(repeated.applied, false);
  assert.deepEqual(repeated.save, first.save);
});

test("observations gate interpretation, which gates response, without premature side effects", () => {
  let save = beginKelpwatchInvestigation(
    createInitialAdventureSave("kelpwatch-evidence-order"),
  ).save;
  const before = save;

  assert.throws(
    () => submitKelpwatchInterpretation(save, KELPWATCH_CORRECT_INTERPRETATION_ID),
    /Record all four Kelpwatch Island observations.*Missing:/,
  );
  assert.throws(
    () => submitKelpwatchResponse(save, KELPWATCH_CORRECT_RESPONSE_ID),
    /Record all four Kelpwatch Island observations/,
  );
  assert.deepEqual(save, before);
  assert.deepEqual(save.progression.quests[KELPWATCH_QUEST_ID].flags, {});

  save = completeObservations(save);
  let progress = getKelpwatchProgress(save);
  assert.equal(progress.observationsComplete, true);
  assert.equal(progress.interpretation.available, true);
  assert.equal(progress.response.available, false);
  assert.throws(
    () => submitKelpwatchResponse(save, KELPWATCH_CORRECT_RESPONSE_ID),
    /Reach an evidence-supported interpretation/,
  );

  save = submitKelpwatchInterpretation(save, KELPWATCH_CORRECT_INTERPRETATION_ID).save;
  progress = getKelpwatchProgress(save);
  assert.equal(progress.interpretation.available, false);
  assert.equal(progress.response.available, true);
});

test("every observation order converges only after all evidence and requirements", () => {
  for (const order of permutations([...KELPWATCH_REQUIRED_OBSERVATION_IDS])) {
    let save = beginKelpwatchInvestigation(
      createInitialAdventureSave(`kelpwatch-${order.join("-")}`),
    ).save;
    for (const [index, observationId] of order.entries()) {
      const result = recordKelpwatchObservation(save, observationId);
      save = result.save;
      assert.equal(result.progress.status, "active");
      assert.equal(result.progress.interpretation.available, index === order.length - 1);
    }
    save = completeDecisions(save);
    save = completeResidents(save);
    const reconciled = reconcileKelpwatchQuest(save);
    assert.equal(reconciled.progress.requirementsMet, true);
    assert.equal(reconciled.progress.readyToTurnIn, true);
    assert.deepEqual(reconciled.progress.missingSteps, []);
  }
});

test("observation recording is validated and idempotent", () => {
  const save = beginKelpwatchInvestigation(
    createInitialAdventureSave("kelpwatch-observe"),
  ).save;
  const observationId = KELPWATCH_REQUIRED_OBSERVATION_IDS[0];
  const first = recordKelpwatchObservation(save, observationId);
  const repeated = recordKelpwatchObservation(first.save, observationId);

  assert.equal(first.applied, true);
  assert.equal(first.evidence, KELPWATCH_OBSERVATION_COPY[observationId]);
  assert.equal(repeated.applied, false);
  assert.deepEqual(repeated.save, first.save);
  assert.throws(
    () => recordKelpwatchObservation(save, "mystery-transect"),
    /Unknown Kelpwatch Island observation/,
  );
  assert.throws(
    () => recordKelpwatchObservation(save, "Invalid Observation"),
    /lowercase identifier/,
  );
});

test("correction retries persist, repeat safely, and cannot undo a correct decision", () => {
  let save = beginKelpwatchInvestigation(
    createInitialAdventureSave("kelpwatch-retry"),
  ).save;
  save = completeObservations(save);

  const wrongInterpretation = submitKelpwatchInterpretation(
    save,
    "low-kelp-proves-one-species-caused-it",
  );
  save = wrongInterpretation.save;
  assert.equal(wrongInterpretation.correct, false);
  assert.equal(wrongInterpretation.retryable, true);
  assert.equal(wrongInterpretation.progress.interpretation.correctiveAttempts, 1);
  assert.match(wrongInterpretation.feedback, /cannot establish a single cause/i);

  const repeatedWrong = submitKelpwatchInterpretation(
    save,
    "low-kelp-proves-one-species-caused-it",
  );
  assert.equal(repeatedWrong.applied, false);
  assert.equal(repeatedWrong.progress.interpretation.correctiveAttempts, 1);
  assert.deepEqual(repeatedWrong.save, save);

  save = submitKelpwatchInterpretation(save, "food-web-links-never-affect-kelp").save;
  assert.equal(getKelpwatchProgress(save).interpretation.correctiveAttempts, 2);
  save = submitKelpwatchInterpretation(save, KELPWATCH_CORRECT_INTERPRETATION_ID).save;
  assert.equal(getKelpwatchProgress(save).interpretation.correctiveAttempts, 2);

  const ignoredAfterCorrect = submitKelpwatchInterpretation(
    save,
    "low-kelp-proves-one-species-caused-it",
  );
  assert.equal(ignoredAfterCorrect.applied, false);
  assert.equal(ignoredAfterCorrect.correct, true);
  assert.equal(
    ignoredAfterCorrect.progress.interpretation.lastChoiceId,
    KELPWATCH_CORRECT_INTERPRETATION_ID,
  );
  assert.deepEqual(ignoredAfterCorrect.save, save);

  const wrongResponse = submitKelpwatchResponse(save, "remove-one-species-to-reset-forest");
  save = wrongResponse.save;
  assert.equal(wrongResponse.correct, false);
  assert.equal(wrongResponse.progress.response.correctiveAttempts, 1);
  assert.match(wrongResponse.feedback, /Do not promise that removing a grazer/i);
  const repeatedWrongResponse = submitKelpwatchResponse(
    save,
    "remove-one-species-to-reset-forest",
  );
  assert.equal(repeatedWrongResponse.applied, false);
  assert.equal(repeatedWrongResponse.progress.response.correctiveAttempts, 1);
  assert.deepEqual(repeatedWrongResponse.save, save);

  const correctResponse = submitKelpwatchResponse(save, KELPWATCH_CORRECT_RESPONSE_ID);
  assert.equal(correctResponse.correct, true);
  assert.equal(correctResponse.retryable, false);
  assert.equal(correctResponse.progress.response.correctiveAttempts, 1);
  assert.match(correctResponse.feedback, /permitted ecologists can test a small/i);

  assert.throws(
    () => submitKelpwatchInterpretation(save, "invented-interpretation"),
    /Unknown Kelpwatch Island interpretation choice/,
  );
  assert.throws(
    () => submitKelpwatchResponse(save, "invented-response"),
    /Unknown Kelpwatch Island response choice/,
  );
});

test("readiness requires both resident wins as well as evidence and decisions", () => {
  let save = beginKelpwatchInvestigation(
    createInitialAdventureSave("kelpwatch-residents"),
  ).save;
  save = completeObservations(save);
  save = completeDecisions(save);
  save = withCompletedEncounter(save, KELPWATCH_RESIDENT_ENCOUNTER_IDS[0]);

  let reconciled = reconcileKelpwatchQuest(save);
  assert.equal(reconciled.progress.status, "active");
  assert.deepEqual(reconciled.progress.missingResidentEncounterIds, [
    KELPWATCH_RESIDENT_ENCOUNTER_IDS[1],
  ]);

  save = withCompletedEncounter(reconciled.save, KELPWATCH_RESIDENT_ENCOUNTER_IDS[1]);
  reconciled = reconcileKelpwatchQuest(save);
  assert.equal(reconciled.applied, true);
  assert.equal(reconciled.progress.status, "readyToTurnIn");
  assert.equal(reconcileKelpwatchQuest(reconciled.save).applied, false);
});

test("turn-in grants exactly the Kelpwatch Field Note and remains idempotent", () => {
  const initial = createInitialAdventureSave("kelpwatch-turn-in");
  assert.throws(() => turnInKelpwatchFieldwork(initial), /not ready to turn in/i);

  let save = beginKelpwatchInvestigation(initial).save;
  save = completeObservations(save);
  save = completeDecisions(save);
  save = completeResidents(save);

  const first = turnInKelpwatchFieldwork(save);
  assert.equal(first.applied, true);
  assert.equal(first.completed, true);
  assert.equal(first.rewardApplied, true);
  assert.equal(first.progress.status, "complete");
  assert.deepEqual(first.fieldNoteIds, ["field-note-kelp-food-web"]);
  assert.deepEqual(first.save.fieldNotes.entryIds, ["field-note-kelp-food-web"]);
  assert.deepEqual(first.save.rewardLedger, ["reward-kelpwatch-fieldwork"]);
  assert.deepEqual(first.save.progression.tideMarkIds, []);
  assert.deepEqual(first.save.world.unlockedRouteIds, []);

  const repeated = turnInKelpwatchFieldwork(first.save);
  assert.equal(repeated.applied, false);
  assert.equal(repeated.completed, false);
  assert.equal(repeated.rewardApplied, false);
  assert.deepEqual(repeated.save, first.save);
});

test("fabricated terminal states cannot bypass evidence or append missing work", () => {
  const begun = beginKelpwatchInvestigation(
    createInitialAdventureSave("kelpwatch-fabricated-terminal"),
  ).save;
  const fabricatedReady = withKelpwatchQuest(begun, {
    status: "readyToTurnIn",
    flags: {},
  });
  const readyProgress = getKelpwatchProgress(fabricatedReady);
  assert.equal(readyProgress.requirementsMet, false);
  assert.equal(readyProgress.readyToTurnIn, false);
  assert.equal(readyProgress.stateConsistent, false);
  assert.equal(recoverKelpwatchQuestFlags(fabricatedReady).applied, false);
  assert.throws(
    () => turnInKelpwatchFieldwork(fabricatedReady),
    /not ready to turn in.*Kelp-cover photo transect/i,
  );
  assert.throws(
    () => recordKelpwatchObservation(
      fabricatedReady,
      KELPWATCH_REQUIRED_OBSERVATION_IDS[0],
    ),
    /Terminal Kelpwatch Island fieldwork cannot accept new observations/,
  );

  const fabricatedComplete = withKelpwatchQuest(begun, {
    status: "complete",
    flags: {},
  });
  assert.equal(getKelpwatchProgress(fabricatedComplete).complete, false);
  assert.equal(getKelpwatchProgress(fabricatedComplete).stateConsistent, false);
  assert.throws(
    () => recordKelpwatchObservation(
      fabricatedComplete,
      KELPWATCH_REQUIRED_OBSERVATION_IDS[0],
    ),
    /Terminal Kelpwatch Island fieldwork cannot accept new observations/,
  );

  const evidenceFlags = Object.fromEntries(
    KELPWATCH_REQUIRED_OBSERVATION_IDS.map((observationId) => [
      `observed-${observationId}`,
      true,
    ]),
  );
  const completeWithoutDecisions = withKelpwatchQuest(begun, {
    status: "complete",
    flags: evidenceFlags,
  });
  assert.throws(
    () => submitKelpwatchInterpretation(
      completeWithoutDecisions,
      "low-kelp-proves-one-species-caused-it",
    ),
    /Terminal Kelpwatch Island fieldwork cannot accept new decisions/,
  );
});

test("turn-in recovers an interrupted reward write without duplication", () => {
  let save = beginKelpwatchInvestigation(
    createInitialAdventureSave("kelpwatch-reward-recovery"),
  ).save;
  save = completeObservations(save);
  save = completeDecisions(save);
  save = completeResidents(save);
  const completed = turnInKelpwatchFieldwork(save).save;
  const interruptedRewardWrite = normalizeAdventureSave({
    ...completed,
    fieldNotes: { entryIds: [] },
    rewardLedger: [],
  });

  const recovered = turnInKelpwatchFieldwork(interruptedRewardWrite);
  assert.equal(recovered.applied, true);
  assert.equal(recovered.completed, false);
  assert.equal(recovered.rewardApplied, true);
  assert.deepEqual(recovered.save.fieldNotes.entryIds, ["field-note-kelp-food-web"]);
  assert.deepEqual(recovered.save.rewardLedger, ["reward-kelpwatch-fieldwork"]);
  assert.equal(turnInKelpwatchFieldwork(recovered.save).applied, false);
});

test("runtime reads are strict while save-boundary recovery discards only bad typed flags", () => {
  const begun = beginKelpwatchInvestigation(
    createInitialAdventureSave("kelpwatch-domain-flags"),
  ).save;
  const malformed = withKelpwatchQuest(begun, {
    status: "active",
    flags: {
      "observed-kelp-cover-transect": "yes",
      "interpretation-corrective-attempts": -1,
      "response-last-choice": "Bad Choice",
      "future-compatible-flag": "kept",
    },
  });
  assert.throws(
    () => getKelpwatchProgress(malformed),
    /observed-kelp-cover-transect must be a boolean/,
  );

  const recovered = recoverKelpwatchQuestFlags(malformed);
  assert.equal(recovered.applied, true);
  assert.deepEqual(recovered.discardedFlagIds, [
    "interpretation-corrective-attempts",
    "observed-kelp-cover-transect",
    "response-last-choice",
  ]);
  assert.deepEqual(recovered.save.progression.quests[KELPWATCH_QUEST_ID].flags, {
    "future-compatible-flag": "kept",
  });
  assert.equal(getKelpwatchProgress(recovered.save).status, "active");
  assert.equal(recoverKelpwatchQuestFlags(recovered.save).applied, false);

  const unknownCompatibleChoice = withKelpwatchQuest(begun, {
    status: "active",
    flags: { "interpretation-last-choice": "retired-choice" },
  });
  assert.equal(
    getKelpwatchProgress(unknownCompatibleChoice).interpretation.lastChoiceId,
    "retired-choice",
  );
});

test("terminal flag recovery reopens required work but preserves valid terminal progress", () => {
  for (const terminalStatus of ["readyToTurnIn", "complete"]) {
    let save = beginKelpwatchInvestigation(
      createInitialAdventureSave(`kelpwatch-terminal-${terminalStatus.toLowerCase()}`),
    ).save;
    save = completeObservations(save);
    save = completeDecisions(save);
    save = completeResidents(save);
    save = reconcileKelpwatchQuest(save).save;

    const validFlags = save.progression.quests[KELPWATCH_QUEST_ID].flags;
    const malformed = withKelpwatchQuest(save, {
      status: terminalStatus,
      flags: {
        ...validFlags,
        "response-correct": "yes",
        "response-corrective-attempts": -1,
        "future-compatible-flag": "kept",
      },
    });
    assert.throws(
      () => getKelpwatchProgress(malformed),
      /response-correct must be a boolean/,
    );

    const recovered = recoverKelpwatchQuestFlags(malformed);
    assert.equal(recovered.applied, true);
    assert.deepEqual(recovered.discardedFlagIds, [
      "response-correct",
      "response-corrective-attempts",
    ]);
    assert.equal(
      recovered.save.progression.quests[KELPWATCH_QUEST_ID].flags["future-compatible-flag"],
      "kept",
    );
    assert.equal(recovered.save.progression.quests[KELPWATCH_QUEST_ID].status, "active");
    assert.equal(getKelpwatchProgress(recovered.save).response.available, true);

    const corrected = submitKelpwatchResponse(
      recovered.save,
      KELPWATCH_CORRECT_RESPONSE_ID,
    );
    assert.equal(corrected.progress.readyToTurnIn, true);
    assert.equal(turnInKelpwatchFieldwork(corrected.save).progress.complete, true);
  }

  let complete = beginKelpwatchInvestigation(
    createInitialAdventureSave("kelpwatch-terminal-optional"),
  ).save;
  complete = completeObservations(complete);
  complete = completeDecisions(complete);
  complete = completeResidents(complete);
  complete = turnInKelpwatchFieldwork(complete).save;
  const completeFlags = complete.progression.quests[KELPWATCH_QUEST_ID].flags;
  const malformedOptional = withKelpwatchQuest(complete, {
    status: "complete",
    flags: {
      ...completeFlags,
      "response-last-choice": "Bad Choice",
    },
  });
  const optionalRecovery = recoverKelpwatchQuestFlags(malformedOptional);
  assert.deepEqual(optionalRecovery.discardedFlagIds, ["response-last-choice"]);
  assert.equal(
    optionalRecovery.save.progression.quests[KELPWATCH_QUEST_ID].status,
    "complete",
  );
  assert.equal(getKelpwatchProgress(optionalRecovery.save).complete, true);
  assert.equal(turnInKelpwatchFieldwork(optionalRecovery.save).applied, false);
});

test("corrective-attempt counters reject malformed values and safe-integer overflow", () => {
  const begun = beginKelpwatchInvestigation(
    createInitialAdventureSave("kelpwatch-counter-guard"),
  ).save;
  const malformedCounter = withKelpwatchQuest(begun, {
    status: "active",
    flags: { "response-corrective-attempts": 1.5 },
  });
  assert.throws(
    () => getKelpwatchProgress(malformedCounter),
    /response-corrective-attempts must be a non-negative safe integer/,
  );

  let evidenceReady = completeObservations(begun);
  evidenceReady = withKelpwatchQuest(evidenceReady, {
    status: "active",
    flags: {
      ...evidenceReady.progression.quests[KELPWATCH_QUEST_ID].flags,
      "interpretation-attempted": true,
      "interpretation-corrective-attempts": Number.MAX_SAFE_INTEGER,
      "interpretation-last-choice": "low-kelp-proves-one-species-caused-it",
    },
  });
  assert.throws(
    () => submitKelpwatchInterpretation(evidenceReady, "food-web-links-never-affect-kelp"),
    /corrective-attempt count cannot increase/,
  );
});

test("progress, correction history, and completion survive canonical JSON round trips", () => {
  let save = beginKelpwatchInvestigation(
    createInitialAdventureSave("kelpwatch-serialization"),
  ).save;
  save = recordKelpwatchObservation(save, KELPWATCH_REQUIRED_OBSERVATION_IDS[2]).save;

  const partialReload = normalizeAdventureSave(jsonRoundTrip(save));
  assert.deepEqual(partialReload, save);
  assert.deepEqual(
    jsonRoundTrip(getKelpwatchProgress(partialReload)),
    jsonRoundTrip(getKelpwatchProgress(save)),
  );

  save = completeObservations(partialReload);
  save = submitKelpwatchInterpretation(
    save,
    "low-kelp-proves-one-species-caused-it",
  ).save;
  save = submitKelpwatchInterpretation(save, KELPWATCH_CORRECT_INTERPRETATION_ID).save;
  save = submitKelpwatchResponse(save, "wait-without-repeat-monitoring").save;
  const reloaded = normalizeAdventureSave(jsonRoundTrip(save));
  assert.deepEqual(reloaded, save);
  assert.equal(getKelpwatchProgress(reloaded).interpretation.correctiveAttempts, 1);
  assert.equal(getKelpwatchProgress(reloaded).response.correctiveAttempts, 1);

  save = submitKelpwatchResponse(reloaded, KELPWATCH_CORRECT_RESPONSE_ID).save;
  save = completeResidents(save);
  const completed = turnInKelpwatchFieldwork(normalizeAdventureSave(jsonRoundTrip(save)));
  assert.equal(completed.progress.complete, true);
  assert.deepEqual(normalizeAdventureSave(jsonRoundTrip(completed.save)), completed.save);
});
