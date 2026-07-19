import assert from "node:assert/strict";
import test from "node:test";
import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import {
  createInitialAdventureSave,
  normalizeAdventureSave,
} from "./adventureProgression.mjs";
import {
  CURRENT_CORRECT_INTERPRETATION_ID,
  CURRENT_CORRECT_RESPONSE_ID,
  CURRENT_INTERPRETATION_CHOICES,
  CURRENT_OBSERVATION_COPY,
  CURRENT_QUEST_ID,
  CURRENT_REQUIRED_OBSERVATION_IDS,
  CURRENT_RESIDENT_ENCOUNTER_IDS,
  CURRENT_RESPONSE_CHOICES,
  CURRENT_SCIENCE_COPY,
  beginCurrentInvestigation,
  getCurrentProgress,
  reconcileCurrentQuest,
  recordCurrentObservation,
  recoverCurrentQuestFlags,
  submitCurrentInterpretation,
  submitCurrentResponse,
  turnInCurrentFieldwork,
} from "./adventureCurrent.mjs";

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
  return CURRENT_REQUIRED_OBSERVATION_IDS.reduce(
    (save, observationId) => recordCurrentObservation(save, observationId).save,
    saveValue,
  );
}

function completeDecisions(saveValue) {
  let save = submitCurrentInterpretation(
    saveValue,
    CURRENT_CORRECT_INTERPRETATION_ID,
  ).save;
  save = submitCurrentResponse(save, CURRENT_CORRECT_RESPONSE_ID).save;
  return save;
}

function completeResidents(saveValue) {
  return CURRENT_RESIDENT_ENCOUNTER_IDS.reduce(withCompletedEncounter, saveValue);
}

function jsonRoundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}

function withCurrentQuest(saveValue, questState) {
  const save = normalizeAdventureSave(saveValue);
  return normalizeAdventureSave({
    ...save,
    progression: {
      ...save.progression,
      quests: {
        ...save.progression.quests,
        [CURRENT_QUEST_ID]: questState,
      },
    },
  });
}

test("Current Commons reuses the canonical quest, resident, reward, and Field Note IDs", () => {
  assert.equal(CURRENT_QUEST_ID, "quest-current-ghost-gear");
  assert.deepEqual(CURRENT_REQUIRED_OBSERVATION_IDS, [
    "source-port-loss-report",
    "surface-drifter-track",
    "wildlife-overlap-zone",
    "downstream-gear-accumulation",
  ]);
  assert.deepEqual(CURRENT_RESIDENT_ENCOUNTER_IDS, [
    "encounter-current-resident-navigator",
    "encounter-current-resident-deckhand",
  ]);

  const quest = ADVENTURE_CONTENT.quests.find(({ id }) => id === CURRENT_QUEST_ID);
  assert.ok(quest);
  assert.equal(quest.rewardId, "reward-current-fieldwork");
  assert.deepEqual(
    CURRENT_RESIDENT_ENCOUNTER_IDS.map((encounterId) => (
      ADVENTURE_CONTENT.encounters.find(({ id }) => id === encounterId)?.questId
    )),
    [CURRENT_QUEST_ID, CURRENT_QUEST_ID],
  );

  const reward = ADVENTURE_CONTENT.rewards.find(
    ({ id }) => id === "reward-current-fieldwork",
  );
  assert.deepEqual(reward, {
    id: "reward-current-fieldwork",
    grantId: "reward-current-fieldwork",
    fieldNoteIds: ["field-note-current-connections"],
  });
  assert.ok(ADVENTURE_CONTENT.fieldNotes.some(
    ({ id }) => id === "field-note-current-connections",
  ));
});

test("decision catalogs expose one supported answer and safe teachable distractors", () => {
  assert.equal(CURRENT_CORRECT_INTERPRETATION_ID, "currents-connect-report-to-risk-zone");
  assert.equal(CURRENT_CORRECT_RESPONSE_ID, "coordinate-safe-removal-and-prevention");
  assert.deepEqual(
    CURRENT_INTERPRETATION_CHOICES.map(({ id }) => id),
    [
      CURRENT_CORRECT_INTERPRETATION_ID,
      "one-sighting-proves-the-owner",
      "currents-carry-only-water",
    ],
  );
  assert.deepEqual(
    CURRENT_RESPONSE_CHOICES.map(({ id }) => id),
    [
      CURRENT_CORRECT_RESPONSE_ID,
      "cleanup-alone-ends-ghost-gear",
      "leave-hazard-unreported",
    ],
  );

  for (const catalog of [CURRENT_INTERPRETATION_CHOICES, CURRENT_RESPONSE_CHOICES]) {
    assert.ok(Object.isFrozen(catalog));
    assert.equal(new Set(catalog.map(({ id }) => id)).size, catalog.length);
    for (const choice of catalog) {
      assert.ok(Object.isFrozen(choice));
      assert.ok(choice.label.length > 0);
      assert.ok(choice.detail.length > 0);
    }
  }
});

test("four distinct evidence records build a cautious current-and-gear connection", () => {
  assert.equal(CURRENT_REQUIRED_OBSERVATION_IDS.length, 4);
  assert.equal(new Set(CURRENT_REQUIRED_OBSERVATION_IDS).size, 4);

  for (const observationId of CURRENT_REQUIRED_OBSERVATION_IDS) {
    const observation = CURRENT_OBSERVATION_COPY[observationId];
    assert.ok(observation, `Missing evidence copy for ${observationId}.`);
    assert.deepEqual(Object.keys(observation.context), ["site", "timing", "method"]);
    assert.deepEqual(
      Object.keys(observation.measurements),
      ["currentClue", "gearClue", "wildlifeClue"],
    );
    assert.ok(Object.values(observation.context).every((value) => value.length > 0));
    assert.ok(Object.values(observation.measurements).every((value) => value.length > 0));
    assert.match(observation.feedback, /current|drifter|gear|wildlife|report/i);
    assert.ok(Object.isFrozen(observation));
    assert.ok(Object.isFrozen(observation.context));
    assert.ok(Object.isFrozen(observation.measurements));
  }

  assert.match(
    CURRENT_OBSERVATION_COPY["surface-drifter-track"].feedback,
    /likely short-term surface corridor, not an exact destination/i,
  );
  assert.match(
    CURRENT_OBSERVATION_COPY["wildlife-overlap-zone"].feedback,
    /only observes, maps, and reports/i,
  );
  assert.match(
    CURRENT_OBSERVATION_COPY["downstream-gear-accumulation"].feedback,
    /Trained authorized responders assess and remove/i,
  );
  assert.match(CURRENT_SCIENCE_COPY.interpretation.correct, /do not prove one owner/i);
});

test("safety copy keeps the player aboard and reserves removal for trained responders", () => {
  const safeResponse = CURRENT_RESPONSE_CHOICES.find(
    ({ id }) => id === CURRENT_CORRECT_RESPONSE_ID,
  );
  assert.match(safeResponse.detail, /safe distance/i);
  assert.match(safeResponse.detail, /trained authorized responders assess and remove/i);
  assert.match(CURRENT_SCIENCE_COPY.response.correct, /Stay aboard/i);
  assert.match(
    CURRENT_SCIENCE_COPY.response.correct,
    /time, location, gear description, drift direction, and any wildlife/i,
  );
  assert.match(CURRENT_SCIENCE_COPY.response.correct, /mark an avoidance route/i);
  assert.match(
    CURRENT_SCIENCE_COPY.response.correct,
    /Only trained authorized responders assess or remove.*disentangle wildlife/i,
  );
  assert.match(
    CURRENT_SCIENCE_COPY.response.corrective,
    /Do not approach, touch, pull, cut, swim to, or disentangle/i,
  );
  assert.match(CURRENT_SCIENCE_COPY.response.correct, /cleanup is not the only step/i);
});

test("the investigation begins once and rejects premature fieldwork", () => {
  const initial = createInitialAdventureSave("current-begin");
  const before = getCurrentProgress(initial);
  assert.equal(before.status, "notStarted");
  assert.equal(before.started, false);
  assert.deepEqual(before.missingObservationIds, CURRENT_REQUIRED_OBSERVATION_IDS);
  assert.deepEqual(before.missingResidentEncounterIds, CURRENT_RESIDENT_ENCOUNTER_IDS);
  assert.equal(before.interpretation.available, false);
  assert.equal(before.response.available, false);
  assert.equal(before.nextAction.id, "begin-current-investigation");
  assert.deepEqual(
    before.missingSteps
      .filter((step) => step.kind === "resident-duel")
      .map((step) => step.label),
    ["Win the navigator's resident duel", "Win the deckhand's resident duel"],
  );

  assert.throws(
    () => recordCurrentObservation(initial, CURRENT_REQUIRED_OBSERVATION_IDS[0]),
    /Begin the Current Commons investigation/,
  );
  assert.throws(
    () => submitCurrentInterpretation(initial, CURRENT_CORRECT_INTERPRETATION_ID),
    /Begin the Current Commons investigation/,
  );

  const first = beginCurrentInvestigation(initial);
  assert.equal(first.applied, true);
  assert.equal(first.progress.status, "active");
  assert.match(first.progress.interpretation.blockedReason, /4 remaining observations/);
  assert.match(first.progress.response.blockedReason, /all four observations/i);
  const repeated = beginCurrentInvestigation(first.save);
  assert.equal(repeated.applied, false);
  assert.deepEqual(repeated.save, first.save);
});

test("observations gate interpretation, which gates response, without premature side effects", () => {
  let save = beginCurrentInvestigation(
    createInitialAdventureSave("current-evidence-order"),
  ).save;
  const before = save;

  assert.throws(
    () => submitCurrentInterpretation(save, CURRENT_CORRECT_INTERPRETATION_ID),
    /Record all four Current Commons observations.*Missing:/,
  );
  assert.throws(
    () => submitCurrentResponse(save, CURRENT_CORRECT_RESPONSE_ID),
    /Record all four Current Commons observations/,
  );
  assert.deepEqual(save, before);
  assert.deepEqual(save.progression.quests[CURRENT_QUEST_ID].flags, {});

  save = completeObservations(save);
  let progress = getCurrentProgress(save);
  assert.equal(progress.observationsComplete, true);
  assert.equal(progress.interpretation.available, true);
  assert.equal(progress.response.available, false);
  assert.throws(
    () => submitCurrentResponse(save, CURRENT_CORRECT_RESPONSE_ID),
    /Reach an evidence-supported interpretation/,
  );

  save = submitCurrentInterpretation(save, CURRENT_CORRECT_INTERPRETATION_ID).save;
  progress = getCurrentProgress(save);
  assert.equal(progress.interpretation.available, false);
  assert.equal(progress.response.available, true);
});

test("every observation order converges only after all evidence and requirements", () => {
  for (const order of permutations([...CURRENT_REQUIRED_OBSERVATION_IDS])) {
    let save = beginCurrentInvestigation(
      createInitialAdventureSave(`current-${order.join("-")}`),
    ).save;
    for (const [index, observationId] of order.entries()) {
      const result = recordCurrentObservation(save, observationId);
      save = result.save;
      assert.equal(result.progress.status, "active");
      assert.equal(result.progress.interpretation.available, index === order.length - 1);
    }
    save = completeDecisions(save);
    save = completeResidents(save);
    const reconciled = reconcileCurrentQuest(save);
    assert.equal(reconciled.progress.requirementsMet, true);
    assert.equal(reconciled.progress.readyToTurnIn, true);
    assert.deepEqual(reconciled.progress.missingSteps, []);
  }
});

test("observation recording is validated and idempotent", () => {
  const save = beginCurrentInvestigation(
    createInitialAdventureSave("current-observe"),
  ).save;
  const observationId = CURRENT_REQUIRED_OBSERVATION_IDS[0];
  const first = recordCurrentObservation(save, observationId);
  const repeated = recordCurrentObservation(first.save, observationId);

  assert.equal(first.applied, true);
  assert.equal(first.evidence, CURRENT_OBSERVATION_COPY[observationId]);
  assert.equal(repeated.applied, false);
  assert.deepEqual(repeated.save, first.save);
  assert.throws(
    () => recordCurrentObservation(save, "mystery-drifter"),
    /Unknown Current Commons observation/,
  );
  assert.throws(
    () => recordCurrentObservation(save, "Invalid Observation"),
    /lowercase identifier/,
  );
});

test("correction retries persist, repeat safely, and cannot undo a correct decision", () => {
  let save = beginCurrentInvestigation(
    createInitialAdventureSave("current-retry"),
  ).save;
  save = completeObservations(save);

  const wrongInterpretation = submitCurrentInterpretation(
    save,
    "one-sighting-proves-the-owner",
  );
  save = wrongInterpretation.save;
  assert.equal(wrongInterpretation.correct, false);
  assert.equal(wrongInterpretation.retryable, true);
  assert.equal(wrongInterpretation.progress.interpretation.correctiveAttempts, 1);
  assert.match(wrongInterpretation.feedback, /without proving ownership/i);

  const repeatedWrong = submitCurrentInterpretation(
    save,
    "one-sighting-proves-the-owner",
  );
  assert.equal(repeatedWrong.applied, false);
  assert.equal(repeatedWrong.progress.interpretation.correctiveAttempts, 1);
  assert.deepEqual(repeatedWrong.save, save);

  save = submitCurrentInterpretation(save, "currents-carry-only-water").save;
  assert.equal(getCurrentProgress(save).interpretation.correctiveAttempts, 2);
  save = submitCurrentInterpretation(save, CURRENT_CORRECT_INTERPRETATION_ID).save;
  assert.equal(getCurrentProgress(save).interpretation.correctiveAttempts, 2);

  const ignoredAfterCorrect = submitCurrentInterpretation(
    save,
    "one-sighting-proves-the-owner",
  );
  assert.equal(ignoredAfterCorrect.applied, false);
  assert.equal(ignoredAfterCorrect.correct, true);
  assert.equal(
    ignoredAfterCorrect.progress.interpretation.lastChoiceId,
    CURRENT_CORRECT_INTERPRETATION_ID,
  );
  assert.deepEqual(ignoredAfterCorrect.save, save);

  const wrongResponse = submitCurrentResponse(save, "cleanup-alone-ends-ghost-gear");
  save = wrongResponse.save;
  assert.equal(wrongResponse.correct, false);
  assert.equal(wrongResponse.progress.response.correctiveAttempts, 1);
  assert.match(wrongResponse.feedback, /Do not approach, touch, pull, cut/i);
  const repeatedWrongResponse = submitCurrentResponse(
    save,
    "cleanup-alone-ends-ghost-gear",
  );
  assert.equal(repeatedWrongResponse.applied, false);
  assert.equal(repeatedWrongResponse.progress.response.correctiveAttempts, 1);
  assert.deepEqual(repeatedWrongResponse.save, save);

  const correctResponse = submitCurrentResponse(save, CURRENT_CORRECT_RESPONSE_ID);
  assert.equal(correctResponse.correct, true);
  assert.equal(correctResponse.retryable, false);
  assert.equal(correctResponse.progress.response.correctiveAttempts, 1);
  assert.match(correctResponse.feedback, /Only trained authorized responders/i);

  assert.throws(
    () => submitCurrentInterpretation(save, "invented-interpretation"),
    /Unknown Current Commons interpretation choice/,
  );
  assert.throws(
    () => submitCurrentResponse(save, "invented-response"),
    /Unknown Current Commons response choice/,
  );
});

test("readiness requires both resident wins as well as evidence and decisions", () => {
  let save = beginCurrentInvestigation(
    createInitialAdventureSave("current-residents"),
  ).save;
  save = completeObservations(save);
  save = completeDecisions(save);
  save = withCompletedEncounter(save, CURRENT_RESIDENT_ENCOUNTER_IDS[0]);

  let reconciled = reconcileCurrentQuest(save);
  assert.equal(reconciled.progress.status, "active");
  assert.deepEqual(reconciled.progress.missingResidentEncounterIds, [
    CURRENT_RESIDENT_ENCOUNTER_IDS[1],
  ]);

  save = withCompletedEncounter(reconciled.save, CURRENT_RESIDENT_ENCOUNTER_IDS[1]);
  reconciled = reconcileCurrentQuest(save);
  assert.equal(reconciled.applied, true);
  assert.equal(reconciled.progress.status, "readyToTurnIn");
  assert.equal(reconcileCurrentQuest(reconciled.save).applied, false);
});

test("turn-in grants exactly the Current Field Note and remains idempotent", () => {
  const initial = createInitialAdventureSave("current-turn-in");
  assert.throws(() => turnInCurrentFieldwork(initial), /not ready to turn in/i);

  let save = beginCurrentInvestigation(initial).save;
  save = completeObservations(save);
  save = completeDecisions(save);
  save = completeResidents(save);

  const first = turnInCurrentFieldwork(save);
  assert.equal(first.applied, true);
  assert.equal(first.completed, true);
  assert.equal(first.rewardApplied, true);
  assert.equal(first.progress.status, "complete");
  assert.deepEqual(first.fieldNoteIds, ["field-note-current-connections"]);
  assert.deepEqual(first.save.fieldNotes.entryIds, ["field-note-current-connections"]);
  assert.deepEqual(first.save.rewardLedger, ["reward-current-fieldwork"]);
  assert.deepEqual(first.save.progression.tideMarkIds, []);
  assert.deepEqual(first.save.world.unlockedRouteIds, []);

  const repeated = turnInCurrentFieldwork(first.save);
  assert.equal(repeated.applied, false);
  assert.equal(repeated.completed, false);
  assert.equal(repeated.rewardApplied, false);
  assert.deepEqual(repeated.save, first.save);
});

test("fabricated terminal states cannot bypass evidence or append missing work", () => {
  const begun = beginCurrentInvestigation(
    createInitialAdventureSave("current-fabricated-terminal"),
  ).save;
  const fabricatedReady = withCurrentQuest(begun, {
    status: "readyToTurnIn",
    flags: {},
  });
  const readyProgress = getCurrentProgress(fabricatedReady);
  assert.equal(readyProgress.requirementsMet, false);
  assert.equal(readyProgress.readyToTurnIn, false);
  assert.equal(readyProgress.stateConsistent, false);
  assert.throws(
    () => turnInCurrentFieldwork(fabricatedReady),
    /not ready to turn in.*Source-port gear-loss report/i,
  );

  const fabricatedComplete = withCurrentQuest(begun, {
    status: "complete",
    flags: {},
  });
  assert.equal(getCurrentProgress(fabricatedComplete).complete, false);
  assert.equal(getCurrentProgress(fabricatedComplete).stateConsistent, false);
  assert.throws(
    () => recordCurrentObservation(
      fabricatedComplete,
      CURRENT_REQUIRED_OBSERVATION_IDS[0],
    ),
    /Completed Current Commons fieldwork cannot accept new observations/,
  );

  const evidenceFlags = Object.fromEntries(
    CURRENT_REQUIRED_OBSERVATION_IDS.map((observationId) => [
      `observed-${observationId}`,
      true,
    ]),
  );
  const completeWithoutDecisions = withCurrentQuest(begun, {
    status: "complete",
    flags: evidenceFlags,
  });
  assert.throws(
    () => submitCurrentInterpretation(
      completeWithoutDecisions,
      "one-sighting-proves-the-owner",
    ),
    /Completed Current Commons fieldwork cannot accept new decisions/,
  );
});

test("turn-in recovers an interrupted reward write without duplication", () => {
  let save = beginCurrentInvestigation(
    createInitialAdventureSave("current-reward-recovery"),
  ).save;
  save = completeObservations(save);
  save = completeDecisions(save);
  save = completeResidents(save);
  const completed = turnInCurrentFieldwork(save).save;
  const interruptedRewardWrite = normalizeAdventureSave({
    ...completed,
    fieldNotes: { entryIds: [] },
    rewardLedger: [],
  });

  const recovered = turnInCurrentFieldwork(interruptedRewardWrite);
  assert.equal(recovered.applied, true);
  assert.equal(recovered.completed, false);
  assert.equal(recovered.rewardApplied, true);
  assert.deepEqual(recovered.save.fieldNotes.entryIds, ["field-note-current-connections"]);
  assert.deepEqual(recovered.save.rewardLedger, ["reward-current-fieldwork"]);
  assert.equal(turnInCurrentFieldwork(recovered.save).applied, false);
});

test("runtime reads are strict while save-boundary recovery discards only bad typed flags", () => {
  const begun = beginCurrentInvestigation(
    createInitialAdventureSave("current-domain-flags"),
  ).save;
  const malformed = withCurrentQuest(begun, {
    status: "active",
    flags: {
      "observed-source-port-loss-report": "yes",
      "interpretation-corrective-attempts": -1,
      "response-last-choice": "Bad Choice",
      "future-compatible-flag": "kept",
    },
  });
  assert.throws(
    () => getCurrentProgress(malformed),
    /observed-source-port-loss-report must be a boolean/,
  );

  const recovered = recoverCurrentQuestFlags(malformed);
  assert.equal(recovered.applied, true);
  assert.deepEqual(recovered.discardedFlagIds, [
    "interpretation-corrective-attempts",
    "observed-source-port-loss-report",
    "response-last-choice",
  ]);
  assert.deepEqual(recovered.save.progression.quests[CURRENT_QUEST_ID].flags, {
    "future-compatible-flag": "kept",
  });
  assert.equal(getCurrentProgress(recovered.save).status, "active");
  assert.equal(recoverCurrentQuestFlags(recovered.save).applied, false);

  const unknownCompatibleChoice = withCurrentQuest(begun, {
    status: "active",
    flags: { "interpretation-last-choice": "retired-choice" },
  });
  assert.equal(
    getCurrentProgress(unknownCompatibleChoice).interpretation.lastChoiceId,
    "retired-choice",
  );
});

test("corrective-attempt counters reject malformed values and safe-integer overflow", () => {
  const begun = beginCurrentInvestigation(
    createInitialAdventureSave("current-counter-guard"),
  ).save;
  const malformedCounter = withCurrentQuest(begun, {
    status: "active",
    flags: { "response-corrective-attempts": 1.5 },
  });
  assert.throws(
    () => getCurrentProgress(malformedCounter),
    /response-corrective-attempts must be a non-negative safe integer/,
  );

  let evidenceReady = completeObservations(begun);
  evidenceReady = withCurrentQuest(evidenceReady, {
    status: "active",
    flags: {
      ...evidenceReady.progression.quests[CURRENT_QUEST_ID].flags,
      "interpretation-attempted": true,
      "interpretation-corrective-attempts": Number.MAX_SAFE_INTEGER,
      "interpretation-last-choice": "one-sighting-proves-the-owner",
    },
  });
  assert.throws(
    () => submitCurrentInterpretation(evidenceReady, "currents-carry-only-water"),
    /corrective-attempt count cannot increase/,
  );
});

test("progress, correction history, and completion survive canonical JSON round trips", () => {
  let save = beginCurrentInvestigation(
    createInitialAdventureSave("current-serialization"),
  ).save;
  save = recordCurrentObservation(save, CURRENT_REQUIRED_OBSERVATION_IDS[2]).save;

  const partialReload = normalizeAdventureSave(jsonRoundTrip(save));
  assert.deepEqual(partialReload, save);
  assert.deepEqual(
    jsonRoundTrip(getCurrentProgress(partialReload)),
    jsonRoundTrip(getCurrentProgress(save)),
  );

  save = completeObservations(partialReload);
  save = submitCurrentInterpretation(save, "one-sighting-proves-the-owner").save;
  save = submitCurrentInterpretation(save, CURRENT_CORRECT_INTERPRETATION_ID).save;
  save = submitCurrentResponse(save, "leave-hazard-unreported").save;
  const reloaded = normalizeAdventureSave(jsonRoundTrip(save));
  assert.deepEqual(reloaded, save);
  assert.equal(getCurrentProgress(reloaded).interpretation.correctiveAttempts, 1);
  assert.equal(getCurrentProgress(reloaded).response.correctiveAttempts, 1);

  save = submitCurrentResponse(reloaded, CURRENT_CORRECT_RESPONSE_ID).save;
  save = completeResidents(save);
  const completed = turnInCurrentFieldwork(normalizeAdventureSave(jsonRoundTrip(save)));
  assert.equal(completed.progress.complete, true);
  assert.deepEqual(normalizeAdventureSave(jsonRoundTrip(completed.save)), completed.save);
});
