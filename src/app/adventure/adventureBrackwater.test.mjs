import assert from "node:assert/strict";
import test from "node:test";
import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import { createInitialAdventureSave, normalizeAdventureSave } from "./adventureProgression.mjs";
import {
  BRACKWATER_CORRECT_INTERPRETATION_ID,
  BRACKWATER_CORRECT_RESPONSE_ID,
  BRACKWATER_INTERPRETATION_CHOICES,
  BRACKWATER_OBSERVATION_COPY,
  BRACKWATER_QUEST_ID,
  BRACKWATER_REQUIRED_OBSERVATION_IDS,
  BRACKWATER_RESIDENT_ENCOUNTER_IDS,
  BRACKWATER_RESPONSE_CHOICES,
  beginBrackwaterInvestigation,
  getBrackwaterProgress,
  reconcileBrackwaterQuest,
  recordBrackwaterObservation,
  submitBrackwaterInterpretation,
  submitBrackwaterResponse,
  turnInBrackwaterFieldwork,
} from "./adventureBrackwater.mjs";

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

function completeDecisions(saveValue) {
  let save = submitBrackwaterInterpretation(
    saveValue,
    BRACKWATER_CORRECT_INTERPRETATION_ID,
  ).save;
  save = submitBrackwaterResponse(save, BRACKWATER_CORRECT_RESPONSE_ID).save;
  return save;
}

function completeObservations(saveValue) {
  return BRACKWATER_REQUIRED_OBSERVATION_IDS.reduce(
    (save, observationId) => recordBrackwaterObservation(save, observationId).save,
    saveValue,
  );
}

function completeResidents(saveValue) {
  return BRACKWATER_RESIDENT_ENCOUNTER_IDS.reduce(withCompletedEncounter, saveValue);
}

function jsonRoundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}

function withBrackwaterQuest(saveValue, questState) {
  const save = normalizeAdventureSave(saveValue);
  return normalizeAdventureSave({
    ...save,
    progression: {
      ...save.progression,
      quests: {
        ...save.progression.quests,
        [BRACKWATER_QUEST_ID]: questState,
      },
    },
  });
}

test("Brackwater reuses the authored quest, resident, reward, and Field Note identifiers", () => {
  const quest = ADVENTURE_CONTENT.quests.find(({ id }) => id === BRACKWATER_QUEST_ID);
  assert.ok(quest);
  assert.equal(quest.rewardId, "reward-brackwater-fieldwork");

  assert.deepEqual(
    BRACKWATER_RESIDENT_ENCOUNTER_IDS.map((encounterId) => (
      ADVENTURE_CONTENT.encounters.find(({ id }) => id === encounterId)?.questId
    )),
    [BRACKWATER_QUEST_ID, BRACKWATER_QUEST_ID],
  );

  const reward = ADVENTURE_CONTENT.rewards.find(
    ({ id }) => id === "reward-brackwater-fieldwork",
  );
  assert.deepEqual(reward, {
    id: "reward-brackwater-fieldwork",
    grantId: "reward-brackwater-fieldwork",
    fieldNoteIds: ["field-note-estuary-conditions"],
  });
  assert.ok(ADVENTURE_CONTENT.fieldNotes.some(
    ({ id }) => id === "field-note-estuary-conditions",
  ));
});

test("decision catalogs expose one evidence-supported choice and two teachable distractors", () => {
  assert.deepEqual(
    BRACKWATER_INTERPRETATION_CHOICES.map(({ id }) => id),
    [
      BRACKWATER_CORRECT_INTERPRETATION_ID,
      "all-murky-water-is-polluted",
      "every-reading-is-natural",
    ],
  );
  assert.deepEqual(
    BRACKWATER_RESPONSE_CHOICES.map(({ id }) => id),
    [
      BRACKWATER_CORRECT_RESPONSE_ID,
      "dredge-the-whole-estuary",
      "ignore-every-change",
    ],
  );

  for (const catalog of [
    BRACKWATER_INTERPRETATION_CHOICES,
    BRACKWATER_RESPONSE_CHOICES,
  ]) {
    assert.ok(Object.isFrozen(catalog));
    assert.equal(new Set(catalog.map(({ id }) => id)).size, catalog.length);
    for (const choice of catalog) {
      assert.ok(Object.isFrozen(choice));
      assert.ok(choice.label.length > 0);
      assert.ok(choice.detail.length > 0);
    }
  }
});

test("all four observations pair salinity, turbidity, and dissolved oxygen with context", () => {
  assert.equal(BRACKWATER_REQUIRED_OBSERVATION_IDS.length, 4);
  assert.equal(new Set(BRACKWATER_REQUIRED_OBSERVATION_IDS).size, 4);

  for (const observationId of BRACKWATER_REQUIRED_OBSERVATION_IDS) {
    const observation = BRACKWATER_OBSERVATION_COPY[observationId];
    assert.ok(observation, `Missing evidence copy for ${observationId}.`);
    assert.deepEqual(Object.keys(observation.context), ["site", "tide", "rainfall"]);
    assert.deepEqual(
      Object.keys(observation.measurements),
      ["salinity", "turbidity", "dissolvedOxygen"],
    );
    assert.ok(Object.values(observation.context).every((value) => value.length > 0));
    assert.ok(Object.values(observation.measurements).every((value) => value.length > 0));
    assert.match(observation.feedback, /salinity|saltier|oxygen|murky|turbidity/i);
    assert.ok(Object.isFrozen(observation));
    assert.ok(Object.isFrozen(observation.context));
    assert.ok(Object.isFrozen(observation.measurements));
  }

  assert.match(
    BRACKWATER_OBSERVATION_COPY["repeat-runoff-low-oxygen"].feedback,
    /more than a single murky sample.*repeat.*runoff/i,
  );
});

test("Brackwater begins once, reports every requirement, and rejects premature fieldwork", () => {
  const initial = createInitialAdventureSave("brackwater-begin");
  const before = getBrackwaterProgress(initial);
  assert.equal(before.status, "notStarted");
  assert.equal(before.started, false);
  assert.deepEqual(before.missingObservationIds, BRACKWATER_REQUIRED_OBSERVATION_IDS);
  assert.deepEqual(before.missingResidentEncounterIds, BRACKWATER_RESIDENT_ENCOUNTER_IDS);
  assert.ok(before.missingSteps.some((step) => step.id === "interpretation"));
  assert.ok(before.missingSteps.some((step) => step.id === "response"));
  assert.deepEqual(
    before.missingSteps
      .filter((step) => step.kind === "resident-duel")
      .map((step) => step.label),
    [
      "Win the mangrove naturalist's resident duel",
      "Win the harbormaster's resident duel",
    ],
  );
  assert.equal(before.interpretation.available, false);
  assert.equal(before.response.available, false);
  assert.equal(before.nextAction.id, "begin-brackwater-investigation");

  assert.throws(
    () => recordBrackwaterObservation(initial, BRACKWATER_REQUIRED_OBSERVATION_IDS[0]),
    /Begin the Brackwater investigation/,
  );
  assert.throws(
    () => submitBrackwaterInterpretation(initial, BRACKWATER_CORRECT_INTERPRETATION_ID),
    /Begin the Brackwater investigation/,
  );

  const first = beginBrackwaterInvestigation(initial);
  assert.equal(first.applied, true);
  assert.equal(first.progress.status, "active");
  assert.match(first.progress.interpretation.blockedReason, /4 remaining observations/);
  assert.match(first.progress.response.blockedReason, /all four observations/i);
  const repeated = beginBrackwaterInvestigation(first.save);
  assert.equal(repeated.applied, false);
  assert.deepEqual(repeated.save, first.save);
});

test("fieldwork enforces observations, then interpretation, then response without side effects", () => {
  let save = beginBrackwaterInvestigation(
    createInitialAdventureSave("brackwater-evidence-order"),
  ).save;
  const before = save;

  assert.throws(
    () => submitBrackwaterInterpretation(save, BRACKWATER_CORRECT_INTERPRETATION_ID),
    /Record all four Brackwater observations.*Missing:/,
  );
  assert.throws(
    () => submitBrackwaterResponse(save, BRACKWATER_CORRECT_RESPONSE_ID),
    /Record all four Brackwater observations/,
  );
  assert.deepEqual(save, before);
  assert.deepEqual(save.progression.quests[BRACKWATER_QUEST_ID].flags, {});

  save = completeObservations(save);
  let progress = getBrackwaterProgress(save);
  assert.equal(progress.observationsComplete, true);
  assert.equal(progress.interpretation.available, true);
  assert.equal(progress.interpretation.blockedReason, null);
  assert.equal(progress.response.available, false);
  assert.match(progress.response.blockedReason, /evidence-supported interpretation/);
  assert.throws(
    () => submitBrackwaterResponse(save, BRACKWATER_CORRECT_RESPONSE_ID),
    /Reach an evidence-supported interpretation/,
  );

  save = submitBrackwaterInterpretation(
    save,
    BRACKWATER_CORRECT_INTERPRETATION_ID,
  ).save;
  progress = getBrackwaterProgress(save);
  assert.equal(progress.interpretation.available, false);
  assert.equal(progress.response.available, true);
  assert.equal(progress.response.blockedReason, null);
});

test("all observation orders converge and only the full requirement set becomes ready", () => {
  for (const order of permutations([...BRACKWATER_REQUIRED_OBSERVATION_IDS])) {
    let save = beginBrackwaterInvestigation(
      createInitialAdventureSave(`brackwater-${order.join("-")}`),
    ).save;

    for (const [index, observationId] of order.entries()) {
      const result = recordBrackwaterObservation(save, observationId);
      save = result.save;
      assert.equal(result.progress.status, "active");
      assert.equal(
        result.progress.interpretation.available,
        index === order.length - 1,
      );
    }

    save = completeDecisions(save);
    save = completeResidents(save);
    const reconciled = reconcileBrackwaterQuest(save);
    save = reconciled.save;
    const progress = getBrackwaterProgress(save);
    assert.equal(progress.requirementsMet, true);
    assert.equal(progress.readyToTurnIn, true);
    assert.deepEqual(progress.missingSteps, []);
  }
});

test("duplicate observations are idempotent and invalid observations are rejected", () => {
  const save = beginBrackwaterInvestigation(
    createInitialAdventureSave("brackwater-observe"),
  ).save;
  const observationId = BRACKWATER_REQUIRED_OBSERVATION_IDS[0];
  const first = recordBrackwaterObservation(save, observationId);
  const repeated = recordBrackwaterObservation(first.save, observationId);

  assert.equal(first.applied, true);
  assert.equal(first.observationId, observationId);
  assert.equal(first.evidence, BRACKWATER_OBSERVATION_COPY[observationId]);
  assert.equal(repeated.applied, false);
  assert.deepEqual(repeated.save, first.save);
  assert.throws(
    () => recordBrackwaterObservation(save, "mystery-water"),
    /Unknown Brackwater observation/,
  );
  assert.throws(
    () => recordBrackwaterObservation(save, "Invalid Observation"),
    /lowercase identifier/,
  );
});

test("wrong interpretation and response choices persist corrective retry flags", () => {
  let save = beginBrackwaterInvestigation(
    createInitialAdventureSave("brackwater-retry"),
  ).save;
  save = completeObservations(save);

  const wrongInterpretation = submitBrackwaterInterpretation(
    save,
    "all-murky-water-is-polluted",
  );
  save = wrongInterpretation.save;
  assert.equal(wrongInterpretation.correct, false);
  assert.equal(wrongInterpretation.retryable, true);
  assert.equal(wrongInterpretation.progress.status, "active");
  assert.equal(wrongInterpretation.progress.interpretation.correctiveAttempts, 1);
  assert.equal(
    wrongInterpretation.progress.interpretation.lastChoiceId,
    "all-murky-water-is-polluted",
  );
  assert.match(wrongInterpretation.feedback, /water color alone/i);

  const repeatedWrongInterpretation = submitBrackwaterInterpretation(
    save,
    "all-murky-water-is-polluted",
  );
  assert.equal(repeatedWrongInterpretation.applied, false);
  assert.equal(repeatedWrongInterpretation.correct, false);
  assert.equal(repeatedWrongInterpretation.retryable, true);
  assert.equal(repeatedWrongInterpretation.progress.interpretation.correctiveAttempts, 1);
  assert.deepEqual(repeatedWrongInterpretation.save, save);

  const secondWrongInterpretation = submitBrackwaterInterpretation(
    save,
    "every-reading-is-natural",
  );
  save = secondWrongInterpretation.save;
  assert.equal(secondWrongInterpretation.progress.interpretation.correctiveAttempts, 2);

  const correctInterpretation = submitBrackwaterInterpretation(
    save,
    BRACKWATER_CORRECT_INTERPRETATION_ID,
  );
  save = correctInterpretation.save;
  assert.equal(correctInterpretation.correct, true);
  assert.equal(correctInterpretation.retryable, false);
  assert.equal(correctInterpretation.progress.interpretation.correctiveAttempts, 2);
  assert.match(correctInterpretation.feedback, /murky water alone/i);

  const ignoredAfterCorrect = submitBrackwaterInterpretation(
    save,
    "all-murky-water-is-polluted",
  );
  assert.equal(ignoredAfterCorrect.applied, false);
  assert.equal(ignoredAfterCorrect.correct, true);
  assert.equal(ignoredAfterCorrect.retryable, false);
  assert.equal(
    ignoredAfterCorrect.progress.interpretation.lastChoiceId,
    BRACKWATER_CORRECT_INTERPRETATION_ID,
  );
  assert.equal(ignoredAfterCorrect.progress.interpretation.correctiveAttempts, 2);
  assert.deepEqual(ignoredAfterCorrect.save, save);

  const wrongResponse = submitBrackwaterResponse(save, "dredge-the-whole-estuary");
  save = wrongResponse.save;
  assert.equal(wrongResponse.correct, false);
  assert.equal(wrongResponse.retryable, true);
  assert.equal(wrongResponse.progress.response.correctiveAttempts, 1);
  assert.match(wrongResponse.feedback, /Do not clear, dredge, or treat the whole estuary/i);

  const repeatedWrongResponse = submitBrackwaterResponse(
    save,
    "dredge-the-whole-estuary",
  );
  assert.equal(repeatedWrongResponse.applied, false);
  assert.equal(repeatedWrongResponse.correct, false);
  assert.equal(repeatedWrongResponse.progress.response.correctiveAttempts, 1);
  assert.deepEqual(repeatedWrongResponse.save, save);

  const correctResponse = submitBrackwaterResponse(save, BRACKWATER_CORRECT_RESPONSE_ID);
  assert.equal(correctResponse.correct, true);
  assert.equal(correctResponse.retryable, false);
  assert.equal(correctResponse.progress.response.correctiveAttempts, 1);
  assert.match(correctResponse.feedback, /protecting the naturally muddy mangrove nursery/i);

  assert.throws(
    () => submitBrackwaterInterpretation(save, "invented-interpretation"),
    /Unknown Brackwater interpretation choice/,
  );
  assert.throws(
    () => submitBrackwaterResponse(save, "invented-response"),
    /Unknown Brackwater response choice/,
  );
});

test("readiness requires both resident wins as well as evidence and decisions", () => {
  let save = beginBrackwaterInvestigation(
    createInitialAdventureSave("brackwater-residents"),
  ).save;
  for (const observationId of BRACKWATER_REQUIRED_OBSERVATION_IDS) {
    save = recordBrackwaterObservation(save, observationId).save;
  }
  save = completeDecisions(save);
  save = withCompletedEncounter(save, BRACKWATER_RESIDENT_ENCOUNTER_IDS[0]);

  let reconciled = reconcileBrackwaterQuest(save);
  assert.equal(reconciled.progress.status, "active");
  assert.deepEqual(reconciled.progress.missingResidentEncounterIds, [
    BRACKWATER_RESIDENT_ENCOUNTER_IDS[1],
  ]);

  save = withCompletedEncounter(reconciled.save, BRACKWATER_RESIDENT_ENCOUNTER_IDS[1]);
  reconciled = reconcileBrackwaterQuest(save);
  assert.equal(reconciled.applied, true);
  assert.equal(reconciled.progress.status, "readyToTurnIn");
  assert.equal(reconcileBrackwaterQuest(reconciled.save).applied, false);
});

test("fieldwork turn-in grants exactly the authored Field Note and remains idempotent", () => {
  const initial = createInitialAdventureSave("brackwater-turn-in");
  assert.throws(
    () => turnInBrackwaterFieldwork(initial),
    /not ready to turn in/i,
  );

  let save = beginBrackwaterInvestigation(initial).save;
  for (const observationId of BRACKWATER_REQUIRED_OBSERVATION_IDS) {
    save = recordBrackwaterObservation(save, observationId).save;
  }
  save = completeDecisions(save);
  save = completeResidents(save);

  const first = turnInBrackwaterFieldwork(save);
  assert.equal(first.applied, true);
  assert.equal(first.completed, true);
  assert.equal(first.rewardApplied, true);
  assert.equal(first.progress.status, "complete");
  assert.deepEqual(first.fieldNoteIds, ["field-note-estuary-conditions"]);
  assert.deepEqual(first.save.fieldNotes.entryIds, ["field-note-estuary-conditions"]);
  assert.deepEqual(first.save.rewardLedger, ["reward-brackwater-fieldwork"]);
  assert.deepEqual(first.save.progression.tideMarkIds, []);
  assert.deepEqual(first.save.world.unlockedRouteIds, []);

  const repeated = turnInBrackwaterFieldwork(first.save);
  assert.equal(repeated.applied, false);
  assert.equal(repeated.completed, false);
  assert.equal(repeated.rewardApplied, false);
  assert.deepEqual(repeated.save, first.save);
  assert.equal(repeated.progress.status, "complete");
});

test("turn-in verifies evidence instead of trusting a fabricated ready status", () => {
  const begun = beginBrackwaterInvestigation(
    createInitialAdventureSave("brackwater-fabricated-ready"),
  ).save;
  const fabricated = withBrackwaterQuest(begun, {
    status: "readyToTurnIn",
    flags: {},
  });

  const fabricatedProgress = getBrackwaterProgress(fabricated);
  assert.equal(fabricatedProgress.requirementsMet, false);
  assert.equal(fabricatedProgress.readyToTurnIn, false);
  assert.equal(fabricatedProgress.stateConsistent, false);
  assert.throws(
    () => turnInBrackwaterFieldwork(fabricated),
    /not ready to turn in.*Incoming-tide channel/i,
  );
  assert.deepEqual(fabricated.rewardLedger, []);
  assert.deepEqual(fabricated.fieldNotes.entryIds, []);
});

test("a fabricated completed status cannot be used to append missing fieldwork", () => {
  const begun = beginBrackwaterInvestigation(
    createInitialAdventureSave("brackwater-fabricated-complete"),
  ).save;
  const fabricatedWithoutEvidence = withBrackwaterQuest(begun, {
    status: "complete",
    flags: {},
  });
  assert.throws(
    () => recordBrackwaterObservation(
      fabricatedWithoutEvidence,
      BRACKWATER_REQUIRED_OBSERVATION_IDS[0],
    ),
    /Completed Brackwater fieldwork cannot accept new observations/,
  );

  const observationFlags = Object.fromEntries(
    BRACKWATER_REQUIRED_OBSERVATION_IDS.map((observationId) => [
      `observed-${observationId}`,
      true,
    ]),
  );
  const fabricatedWithoutDecision = withBrackwaterQuest(begun, {
    status: "complete",
    flags: observationFlags,
  });
  assert.throws(
    () => submitBrackwaterInterpretation(
      fabricatedWithoutDecision,
      "all-murky-water-is-polluted",
    ),
    /Completed Brackwater fieldwork cannot accept new decisions/,
  );
});

test("turn-in can recover a missing reward after a completed quest without duplicating it", () => {
  let save = beginBrackwaterInvestigation(
    createInitialAdventureSave("brackwater-reward-recovery"),
  ).save;
  save = completeObservations(save);
  save = completeDecisions(save);
  save = completeResidents(save);
  const completed = turnInBrackwaterFieldwork(save).save;
  const interruptedRewardWrite = normalizeAdventureSave({
    ...completed,
    fieldNotes: { entryIds: [] },
    rewardLedger: [],
  });

  const recovered = turnInBrackwaterFieldwork(interruptedRewardWrite);
  assert.equal(recovered.applied, true);
  assert.equal(recovered.completed, false);
  assert.equal(recovered.rewardApplied, true);
  assert.deepEqual(recovered.save.fieldNotes.entryIds, ["field-note-estuary-conditions"]);
  assert.deepEqual(recovered.save.rewardLedger, ["reward-brackwater-fieldwork"]);
  assert.equal(turnInBrackwaterFieldwork(recovered.save).applied, false);
});

test("domain flags reject malformed generic save scalars and counter overflow", () => {
  const begun = beginBrackwaterInvestigation(
    createInitialAdventureSave("brackwater-domain-flags"),
  ).save;
  const malformedObservation = withBrackwaterQuest(begun, {
    status: "active",
    flags: { "observed-incoming-tide-channel": "yes" },
  });
  assert.throws(
    () => getBrackwaterProgress(malformedObservation),
    /observed-incoming-tide-channel must be a boolean/,
  );

  const malformedCounter = withBrackwaterQuest(begun, {
    status: "active",
    flags: { "interpretation-corrective-attempts": 1.5 },
  });
  assert.throws(
    () => getBrackwaterProgress(malformedCounter),
    /interpretation-corrective-attempts must be a non-negative safe integer/,
  );

  const unknownPersistedChoice = withBrackwaterQuest(begun, {
    status: "active",
    flags: { "interpretation-last-choice": "retired-choice" },
  });
  const compatibleProgress = getBrackwaterProgress(unknownPersistedChoice);
  assert.equal(compatibleProgress.interpretation.lastChoiceId, "retired-choice");
  assert.match(compatibleProgress.interpretation.feedback, /water color alone/);

  let evidenceReady = completeObservations(begun);
  evidenceReady = withBrackwaterQuest(evidenceReady, {
    status: "active",
    flags: {
      ...evidenceReady.progression.quests[BRACKWATER_QUEST_ID].flags,
      "interpretation-attempted": true,
      "interpretation-corrective-attempts": Number.MAX_SAFE_INTEGER,
      "interpretation-last-choice": "all-murky-water-is-polluted",
    },
  });
  assert.throws(
    () => submitBrackwaterInterpretation(evidenceReady, "every-reading-is-natural"),
    /corrective-attempt count cannot increase/,
  );
});

test("Brackwater progress and retry history survive canonical JSON round trips", () => {
  let save = beginBrackwaterInvestigation(
    createInitialAdventureSave("brackwater-serialization"),
  ).save;
  save = recordBrackwaterObservation(
    save,
    BRACKWATER_REQUIRED_OBSERVATION_IDS[2],
  ).save;

  const partialReload = normalizeAdventureSave(jsonRoundTrip(save));
  assert.deepEqual(partialReload, save);
  assert.deepEqual(
    jsonRoundTrip(getBrackwaterProgress(partialReload)),
    jsonRoundTrip(getBrackwaterProgress(save)),
  );

  save = completeObservations(partialReload);
  save = submitBrackwaterInterpretation(save, "all-murky-water-is-polluted").save;
  save = submitBrackwaterInterpretation(
    save,
    BRACKWATER_CORRECT_INTERPRETATION_ID,
  ).save;
  save = submitBrackwaterResponse(save, "ignore-every-change").save;

  const reloaded = normalizeAdventureSave(jsonRoundTrip(save));
  assert.deepEqual(reloaded, save);
  assert.deepEqual(
    jsonRoundTrip(getBrackwaterProgress(reloaded)),
    jsonRoundTrip(getBrackwaterProgress(save)),
  );
  assert.deepEqual(reloaded.progression.quests[BRACKWATER_QUEST_ID].flags, {
    "interpretation-correct": true,
    "interpretation-attempted": true,
    "interpretation-corrective-attempts": 1,
    "interpretation-last-choice": BRACKWATER_CORRECT_INTERPRETATION_ID,
    "observed-incoming-tide-channel": true,
    "observed-mangrove-low-tide": true,
    "observed-rain-fed-creek-mouth": true,
    "observed-repeat-runoff-low-oxygen": true,
    "response-attempted": true,
    "response-corrective-attempts": 1,
    "response-last-choice": "ignore-every-change",
  });

  save = completeDecisions(reloaded);
  save = completeResidents(save);
  for (const observationId of BRACKWATER_REQUIRED_OBSERVATION_IDS) {
    save = recordBrackwaterObservation(save, observationId).save;
  }
  const completed = turnInBrackwaterFieldwork(
    normalizeAdventureSave(jsonRoundTrip(save)),
  );
  assert.equal(completed.progress.complete, true);
  assert.deepEqual(
    normalizeAdventureSave(jsonRoundTrip(completed.save)),
    completed.save,
  );
});
