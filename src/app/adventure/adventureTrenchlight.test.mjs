import assert from "node:assert/strict";
import test from "node:test";
import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import {
  createInitialAdventureSave,
  normalizeAdventureSave,
} from "./adventureProgression.mjs";
import {
  TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
  TRENCHLIGHT_CORRECT_RESPONSE_ID,
  TRENCHLIGHT_EXPEDITION_RULES,
  TRENCHLIGHT_INTERPRETATION_CHOICES,
  TRENCHLIGHT_OBSERVATION_COPY,
  TRENCHLIGHT_QUEST_ID,
  TRENCHLIGHT_REQUIRED_OBSERVATION_IDS,
  TRENCHLIGHT_RESIDENT_ENCOUNTER_IDS,
  TRENCHLIGHT_RESPONSE_CHOICES,
  TRENCHLIGHT_SCIENCE_COPY,
  beginTrenchlightExpedition,
  getTrenchlightProgress,
  reconcileTrenchlightQuest,
  recordTrenchlightObservation,
  recoverTrenchlightQuestFlags,
  submitTrenchlightInterpretation,
  submitTrenchlightResponse,
  turnInTrenchlightFieldwork,
} from "./adventureTrenchlight.mjs";

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
  return TRENCHLIGHT_REQUIRED_OBSERVATION_IDS.reduce(
    (save, observationId) => recordTrenchlightObservation(save, observationId).save,
    saveValue,
  );
}

function completeDecisions(saveValue) {
  let save = submitTrenchlightInterpretation(
    saveValue,
    TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
  ).save;
  save = submitTrenchlightResponse(save, TRENCHLIGHT_CORRECT_RESPONSE_ID).save;
  return save;
}

function completeResidents(saveValue) {
  return TRENCHLIGHT_RESIDENT_ENCOUNTER_IDS.reduce(withCompletedEncounter, saveValue);
}

function withTrenchlightQuest(saveValue, questState) {
  const save = normalizeAdventureSave(saveValue);
  return normalizeAdventureSave({
    ...save,
    progression: {
      ...save.progression,
      quests: {
        ...save.progression.quests,
        [TRENCHLIGHT_QUEST_ID]: questState,
      },
    },
  });
}

function jsonRoundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}

test("Trenchlight reuses canonical content IDs and bounds the sub expedition", () => {
  assert.equal(TRENCHLIGHT_QUEST_ID, "quest-trenchlight-sensor");
  assert.deepEqual(TRENCHLIGHT_REQUIRED_OBSERVATION_IDS, [
    "trenchlight-fading-light-profile",
    "trenchlight-pressure-profile",
    "trenchlight-marine-snow-camera",
    "trenchlight-bioluminescence-camera",
  ]);
  assert.deepEqual(TRENCHLIGHT_RESIDENT_ENCOUNTER_IDS, [
    "encounter-trenchlight-resident-engineer",
    "encounter-trenchlight-resident-observer",
  ]);
  assert.deepEqual(TRENCHLIGHT_EXPEDITION_RULES, {
    pilotControl: "expert-npc",
    playerTools: [
      "light-meter",
      "pressure-sensor",
      "low-light-camera",
      "sonar",
      "sensor-lift-command",
    ],
    target: "deployed-research-sensor",
    wildlifeCollectionAllowed: false,
    habitatContactAllowed: false,
    abortOnUncertainClearance: true,
  });
  assert.ok(Object.isFrozen(TRENCHLIGHT_EXPEDITION_RULES));
  assert.ok(Object.isFrozen(TRENCHLIGHT_EXPEDITION_RULES.playerTools));

  const quest = ADVENTURE_CONTENT.quests.find(({ id }) => id === TRENCHLIGHT_QUEST_ID);
  assert.ok(quest);
  assert.equal(quest.rewardId, "reward-trenchlight-fieldwork");
  assert.deepEqual(
    TRENCHLIGHT_RESIDENT_ENCOUNTER_IDS.map((encounterId) => (
      ADVENTURE_CONTENT.encounters.find(({ id }) => id === encounterId)?.questId
    )),
    [TRENCHLIGHT_QUEST_ID, TRENCHLIGHT_QUEST_ID],
  );
  const reward = ADVENTURE_CONTENT.rewards.find(
    ({ id }) => id === "reward-trenchlight-fieldwork",
  );
  assert.deepEqual(reward?.fieldNoteIds, ["field-note-deep-adaptations"]);
  assert.ok(ADVENTURE_CONTENT.fieldNotes.some(
    ({ id }) => id === "field-note-deep-adaptations",
  ));
});

test("evidence covers the four deep-ocean observations without overclaiming", () => {
  assert.deepEqual(Object.keys(TRENCHLIGHT_OBSERVATION_COPY), [
    ...TRENCHLIGHT_REQUIRED_OBSERVATION_IDS,
  ]);
  for (const observationId of TRENCHLIGHT_REQUIRED_OBSERVATION_IDS) {
    const observation = TRENCHLIGHT_OBSERVATION_COPY[observationId];
    assert.ok(Object.isFrozen(observation));
    assert.deepEqual(Object.keys(observation.context), ["station", "depthBand", "method"]);
    assert.deepEqual(Object.keys(observation.measurements), [
      "lightClue",
      "pressureClue",
      "foodClue",
      "adaptationClue",
      "ventClue",
    ]);
    assert.ok(observation.feedback.length > 120);
  }

  const allCopy = JSON.stringify({
    observations: TRENCHLIGHT_OBSERVATION_COPY,
    interpretationChoices: TRENCHLIGHT_INTERPRETATION_CHOICES,
    responseChoices: TRENCHLIGHT_RESPONSE_CHOICES,
    science: TRENCHLIGHT_SCIENCE_COPY,
  });
  assert.match(allCopy, /one atmosphere for every 10 meters/i);
  assert.match(allCopy, /marine snow/i);
  assert.match(allCopy, /surface-derived|surface waters|surface production/i);
  assert.match(allCopy, /bioluminescence/i);
  assert.match(allCopy, /feeding, reproduction, and defense/i);
  assert.match(allCopy, /not every trench has one/i);
  assert.match(allCopy, /hydrothermal vents and cold seeps/i);
  assert.match(allCopy, /expert pilot/i);
  assert.match(allCopy, /abort|stop/i);
  assert.match(allCopy, /No wildlife is collected/i);
  const supportedCopy = JSON.stringify({
    observations: TRENCHLIGHT_OBSERVATION_COPY,
    interpretation: TRENCHLIGHT_INTERPRETATION_CHOICES[0],
    response: TRENCHLIGHT_RESPONSE_CHOICES[0],
    science: TRENCHLIGHT_SCIENCE_COPY,
  });
  assert.doesNotMatch(supportedCopy, /every trench (contains|has) a vent\.?"/i);
  assert.doesNotMatch(supportedCopy, /all deep life (depends|relies) on chemosynthesis\.?"/i);
});

test("decision catalogs expose one supported answer and explicit misconceptions", () => {
  assert.equal(
    TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
    "trenchlight-local-evidence-supports-multiple-deep-energy-pathways",
  );
  assert.equal(
    TRENCHLIGHT_CORRECT_RESPONSE_ID,
    "trenchlight-recover-sensor-with-clearance-and-abort-criteria",
  );
  assert.deepEqual(
    TRENCHLIGHT_INTERPRETATION_CHOICES.map(({ id }) => id),
    [
      TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
      "trenchlight-every-trench-has-a-vent",
      "trenchlight-all-deep-life-uses-chemosynthesis",
      "trenchlight-darkness-means-no-life-or-food",
    ],
  );
  assert.deepEqual(
    TRENCHLIGHT_RESPONSE_CHOICES.map(({ id }) => id),
    [
      TRENCHLIGHT_CORRECT_RESPONSE_ID,
      "trenchlight-grab-sensor-immediately",
      "trenchlight-collect-wildlife-with-sensor",
      "trenchlight-free-pilot-around-obstacle",
    ],
  );
  for (const catalog of [
    TRENCHLIGHT_INTERPRETATION_CHOICES,
    TRENCHLIGHT_RESPONSE_CHOICES,
  ]) {
    assert.ok(Object.isFrozen(catalog));
    assert.ok(catalog.every((choice) => Object.isFrozen(choice)));
    assert.ok(catalog.every(({ id, label, detail }) => id && label && detail));
  }
});

test("the expedition starts once and observations gate both decisions", () => {
  const initial = createInitialAdventureSave("trenchlight-begin");
  const before = getTrenchlightProgress(initial);
  assert.equal(before.status, "notStarted");
  assert.equal(before.started, false);
  assert.equal(before.sensorRecovered, false);
  assert.equal(before.habitatDisturbed, false);
  assert.equal(before.nextAction.id, "begin-trenchlight-expedition");
  assert.throws(
    () => recordTrenchlightObservation(initial, TRENCHLIGHT_REQUIRED_OBSERVATION_IDS[0]),
    /Begin the NPC-piloted Trenchlight expedition/,
  );

  const begun = beginTrenchlightExpedition(initial);
  assert.equal(begun.applied, true);
  assert.equal(begun.progress.status, "active");
  assert.match(begun.progress.interpretation.blockedReason, /4 remaining observations/);
  assert.match(begun.progress.response.blockedReason, /all four observations/i);
  assert.equal(beginTrenchlightExpedition(begun.save).applied, false);
  assert.throws(
    () => submitTrenchlightInterpretation(
      begun.save,
      TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
    ),
    /Record all four Trenchlight observations.*Missing:/,
  );
  assert.throws(
    () => submitTrenchlightResponse(begun.save, TRENCHLIGHT_CORRECT_RESPONSE_ID),
    /Record all four Trenchlight observations/,
  );

  const observed = completeObservations(begun.save);
  assert.equal(getTrenchlightProgress(observed).interpretation.available, true);
  assert.throws(
    () => submitTrenchlightResponse(observed, TRENCHLIGHT_CORRECT_RESPONSE_ID),
    /Reach an evidence-supported deep-ocean interpretation/,
  );
});

test("every observation order converges without premature readiness", () => {
  for (const [orderIndex, order] of permutations([
    ...TRENCHLIGHT_REQUIRED_OBSERVATION_IDS,
  ]).entries()) {
    let save = beginTrenchlightExpedition(
      createInitialAdventureSave(`trenchlight-order-${orderIndex}`),
    ).save;
    for (const [index, observationId] of order.entries()) {
      const result = recordTrenchlightObservation(save, observationId);
      save = result.save;
      assert.equal(result.progress.status, "active");
      assert.equal(result.progress.interpretation.available, index === order.length - 1);
    }
    save = completeDecisions(save);
    assert.equal(getTrenchlightProgress(save).sensorRecovered, true);
    assert.equal(getTrenchlightProgress(save).readyToTurnIn, false);
    save = completeResidents(save);
    const reconciled = reconcileTrenchlightQuest(save);
    assert.equal(reconciled.progress.requirementsMet, true);
    assert.equal(reconciled.progress.readyToTurnIn, true);
  }
});

test("observation recording is validated, idempotent, and immutable", () => {
  const initial = beginTrenchlightExpedition(
    createInitialAdventureSave("trenchlight-observation"),
  ).save;
  const snapshot = jsonRoundTrip(initial);
  const observationId = TRENCHLIGHT_REQUIRED_OBSERVATION_IDS[0];
  const first = recordTrenchlightObservation(initial, observationId);
  const repeated = recordTrenchlightObservation(first.save, observationId);

  assert.equal(first.applied, true);
  assert.equal(first.evidence, TRENCHLIGHT_OBSERVATION_COPY[observationId]);
  assert.equal(repeated.applied, false);
  assert.deepEqual(repeated.save, first.save);
  assert.deepEqual(initial, snapshot);
  assert.throws(
    () => recordTrenchlightObservation(initial, "trenchlight-mystery-reading"),
    /Unknown Trenchlight observation/,
  );
  assert.throws(
    () => recordTrenchlightObservation(initial, "Invalid Observation"),
    /lowercase identifier/,
  );
});

test("corrective retries teach the misconception and unsafe recovery choices", () => {
  let save = beginTrenchlightExpedition(
    createInitialAdventureSave("trenchlight-corrections"),
  ).save;
  save = completeObservations(save);

  let result = submitTrenchlightInterpretation(
    save,
    "trenchlight-every-trench-has-a-vent",
  );
  save = result.save;
  assert.equal(result.correct, false);
  assert.equal(result.retryable, true);
  assert.equal(result.progress.interpretation.correctiveAttempts, 1);
  assert.match(result.feedback, /not a vent/i);
  const repeated = submitTrenchlightInterpretation(
    save,
    "trenchlight-every-trench-has-a-vent",
  );
  assert.equal(repeated.applied, false);
  assert.equal(repeated.progress.interpretation.correctiveAttempts, 1);

  save = submitTrenchlightInterpretation(
    save,
    "trenchlight-all-deep-life-uses-chemosynthesis",
  ).save;
  assert.equal(getTrenchlightProgress(save).interpretation.correctiveAttempts, 2);
  save = submitTrenchlightInterpretation(
    save,
    TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
  ).save;
  const ignored = submitTrenchlightInterpretation(
    save,
    "trenchlight-darkness-means-no-life-or-food",
  );
  assert.equal(ignored.applied, false);
  assert.equal(ignored.correct, true);
  assert.deepEqual(ignored.save, save);

  result = submitTrenchlightResponse(save, "trenchlight-grab-sensor-immediately");
  save = result.save;
  assert.equal(result.correct, false);
  assert.equal(result.progress.sensorRecovered, false);
  assert.equal(result.progress.habitatDisturbed, false);
  assert.match(result.feedback, /Do not rush the arm/i);
  save = submitTrenchlightResponse(save, "trenchlight-collect-wildlife-with-sensor").save;
  assert.equal(getTrenchlightProgress(save).response.correctiveAttempts, 2);

  const correct = submitTrenchlightResponse(save, TRENCHLIGHT_CORRECT_RESPONSE_ID);
  assert.equal(correct.correct, true);
  assert.equal(correct.retryable, false);
  assert.equal(correct.progress.sensorRecovered, true);
  assert.equal(correct.progress.habitatDisturbed, false);
  assert.match(correct.feedback, /expert pilot holds position/i);
});

test("readiness requires both resident wins after safe sensor recovery", () => {
  let save = beginTrenchlightExpedition(
    createInitialAdventureSave("trenchlight-residents"),
  ).save;
  save = completeDecisions(completeObservations(save));
  save = withCompletedEncounter(save, TRENCHLIGHT_RESIDENT_ENCOUNTER_IDS[0]);

  let result = reconcileTrenchlightQuest(save);
  assert.equal(result.progress.status, "active");
  assert.equal(result.progress.sensorRecovered, true);
  assert.deepEqual(result.progress.missingResidentEncounterIds, [
    TRENCHLIGHT_RESIDENT_ENCOUNTER_IDS[1],
  ]);

  save = withCompletedEncounter(result.save, TRENCHLIGHT_RESIDENT_ENCOUNTER_IDS[1]);
  result = reconcileTrenchlightQuest(save);
  assert.equal(result.applied, true);
  assert.equal(result.progress.readyToTurnIn, true);
  assert.deepEqual(result.progress.missingSteps, []);
  assert.equal(reconcileTrenchlightQuest(result.save).applied, false);
});

test("turn-in grants exactly the deep-adaptations Field Note once", () => {
  const initial = createInitialAdventureSave("trenchlight-turn-in");
  assert.throws(() => turnInTrenchlightFieldwork(initial), /not ready to turn in/i);

  let save = beginTrenchlightExpedition(initial).save;
  save = completeResidents(completeDecisions(completeObservations(save)));
  const first = turnInTrenchlightFieldwork(save);
  assert.equal(first.applied, true);
  assert.equal(first.completed, true);
  assert.equal(first.rewardApplied, true);
  assert.equal(first.progress.complete, true);
  assert.equal(first.progress.sensorRecovered, true);
  assert.deepEqual(first.fieldNoteIds, ["field-note-deep-adaptations"]);
  assert.deepEqual(first.save.fieldNotes.entryIds, ["field-note-deep-adaptations"]);
  assert.deepEqual(first.save.rewardLedger, ["reward-trenchlight-fieldwork"]);
  assert.deepEqual(first.save.progression.tideMarkIds, []);

  const repeated = turnInTrenchlightFieldwork(first.save);
  assert.equal(repeated.applied, false);
  assert.equal(repeated.completed, false);
  assert.equal(repeated.rewardApplied, false);
  assert.deepEqual(repeated.save, first.save);
});

test("fabricated terminal states cannot bypass evidence, recovery, or residents", () => {
  const begun = beginTrenchlightExpedition(
    createInitialAdventureSave("trenchlight-fabricated-terminal"),
  ).save;
  const fabricatedReady = withTrenchlightQuest(begun, {
    status: "readyToTurnIn",
    flags: {},
  });
  const progress = getTrenchlightProgress(fabricatedReady);
  assert.equal(progress.requirementsMet, false);
  assert.equal(progress.readyToTurnIn, false);
  assert.equal(progress.stateConsistent, false);
  assert.equal(progress.sensorRecovered, false);
  assert.throws(
    () => turnInTrenchlightFieldwork(fabricatedReady),
    /not ready to turn in.*Fading-light descent profile/i,
  );
  assert.throws(
    () => recordTrenchlightObservation(
      fabricatedReady,
      TRENCHLIGHT_REQUIRED_OBSERVATION_IDS[0],
    ),
    /Terminal Trenchlight fieldwork/,
  );

  const fabricatedComplete = withTrenchlightQuest(begun, {
    status: "complete",
    flags: {},
  });
  assert.equal(getTrenchlightProgress(fabricatedComplete).complete, false);
  assert.throws(
    () => submitTrenchlightInterpretation(
      fabricatedComplete,
      TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
    ),
    /Record all four Trenchlight observations/,
  );
});

test("turn-in recovers an interrupted reward write without duplication", () => {
  let save = beginTrenchlightExpedition(
    createInitialAdventureSave("trenchlight-reward-recovery"),
  ).save;
  save = completeResidents(completeDecisions(completeObservations(save)));
  const completed = turnInTrenchlightFieldwork(save).save;
  const interrupted = normalizeAdventureSave({
    ...completed,
    fieldNotes: { entryIds: [] },
    rewardLedger: [],
  });

  const recovered = turnInTrenchlightFieldwork(interrupted);
  assert.equal(recovered.applied, true);
  assert.equal(recovered.completed, false);
  assert.equal(recovered.rewardApplied, true);
  assert.deepEqual(recovered.save.fieldNotes.entryIds, ["field-note-deep-adaptations"]);
  assert.deepEqual(recovered.save.rewardLedger, ["reward-trenchlight-fieldwork"]);
  assert.equal(turnInTrenchlightFieldwork(recovered.save).applied, false);
});

test("save-boundary recovery discards only malformed typed flags", () => {
  const begun = beginTrenchlightExpedition(
    createInitialAdventureSave("trenchlight-malformed-flags"),
  ).save;
  const malformed = withTrenchlightQuest(begun, {
    status: "active",
    flags: {
      "observed-trenchlight-fading-light-profile": "yes",
      "interpretation-corrective-attempts": -1,
      "response-last-choice": "Bad Choice",
      "future-compatible-flag": "kept",
    },
  });
  assert.throws(
    () => getTrenchlightProgress(malformed),
    /observed-trenchlight-fading-light-profile must be a boolean/,
  );

  const recovered = recoverTrenchlightQuestFlags(malformed);
  assert.equal(recovered.applied, true);
  assert.deepEqual(recovered.discardedFlagIds, [
    "interpretation-corrective-attempts",
    "observed-trenchlight-fading-light-profile",
    "response-last-choice",
  ]);
  assert.deepEqual(recovered.save.progression.quests[TRENCHLIGHT_QUEST_ID].flags, {
    "future-compatible-flag": "kept",
  });
  assert.equal(getTrenchlightProgress(recovered.save).status, "active");
  assert.equal(recoverTrenchlightQuestFlags(recovered.save).applied, false);
});

test("terminal recovery reopens required work but preserves optional progress", () => {
  let save = beginTrenchlightExpedition(
    createInitialAdventureSave("trenchlight-terminal-recovery"),
  ).save;
  save = completeResidents(completeDecisions(completeObservations(save)));
  save = turnInTrenchlightFieldwork(save).save;
  const validFlags = save.progression.quests[TRENCHLIGHT_QUEST_ID].flags;
  const malformedRequired = withTrenchlightQuest(save, {
    status: "complete",
    flags: {
      ...validFlags,
      "response-correct": "yes",
      "future-compatible-flag": "kept",
    },
  });
  const reopened = recoverTrenchlightQuestFlags(malformedRequired);
  assert.deepEqual(reopened.discardedFlagIds, ["response-correct"]);
  assert.equal(reopened.save.progression.quests[TRENCHLIGHT_QUEST_ID].status, "active");
  assert.equal(getTrenchlightProgress(reopened.save).response.available, true);
  assert.equal(getTrenchlightProgress(reopened.save).sensorRecovered, false);

  const malformedOptional = withTrenchlightQuest(save, {
    status: "complete",
    flags: {
      ...validFlags,
      "response-last-choice": "Bad Choice",
    },
  });
  const preserved = recoverTrenchlightQuestFlags(malformedOptional);
  assert.deepEqual(preserved.discardedFlagIds, ["response-last-choice"]);
  assert.equal(preserved.save.progression.quests[TRENCHLIGHT_QUEST_ID].status, "complete");
  assert.equal(getTrenchlightProgress(preserved.save).complete, true);
});

test("corrective counters reject malformed values and safe-integer overflow", () => {
  const begun = beginTrenchlightExpedition(
    createInitialAdventureSave("trenchlight-counter-guard"),
  ).save;
  const malformed = withTrenchlightQuest(begun, {
    status: "active",
    flags: { "response-corrective-attempts": 1.5 },
  });
  assert.throws(
    () => getTrenchlightProgress(malformed),
    /response-corrective-attempts must be a non-negative safe integer/,
  );

  let evidenceReady = completeObservations(begun);
  evidenceReady = withTrenchlightQuest(evidenceReady, {
    status: "active",
    flags: {
      ...evidenceReady.progression.quests[TRENCHLIGHT_QUEST_ID].flags,
      "interpretation-attempted": true,
      "interpretation-corrective-attempts": Number.MAX_SAFE_INTEGER,
      "interpretation-last-choice": "trenchlight-every-trench-has-a-vent",
    },
  });
  assert.throws(
    () => submitTrenchlightInterpretation(
      evidenceReady,
      "trenchlight-all-deep-life-uses-chemosynthesis",
    ),
    /corrective-attempt count cannot increase/,
  );
});

test("partial, corrective, and completed progress survive JSON round trips", () => {
  let save = beginTrenchlightExpedition(
    createInitialAdventureSave("trenchlight-serialization"),
  ).save;
  save = recordTrenchlightObservation(
    save,
    TRENCHLIGHT_REQUIRED_OBSERVATION_IDS[2],
  ).save;
  const partialReload = normalizeAdventureSave(jsonRoundTrip(save));
  assert.deepEqual(partialReload, save);
  assert.deepEqual(
    jsonRoundTrip(getTrenchlightProgress(partialReload)),
    jsonRoundTrip(getTrenchlightProgress(save)),
  );

  save = completeObservations(partialReload);
  save = submitTrenchlightInterpretation(
    save,
    "trenchlight-every-trench-has-a-vent",
  ).save;
  save = submitTrenchlightInterpretation(
    save,
    TRENCHLIGHT_CORRECT_INTERPRETATION_ID,
  ).save;
  save = submitTrenchlightResponse(save, "trenchlight-grab-sensor-immediately").save;
  const correctedReload = normalizeAdventureSave(jsonRoundTrip(save));
  assert.equal(getTrenchlightProgress(correctedReload).interpretation.correctiveAttempts, 1);
  assert.equal(getTrenchlightProgress(correctedReload).response.correctiveAttempts, 1);

  save = submitTrenchlightResponse(
    correctedReload,
    TRENCHLIGHT_CORRECT_RESPONSE_ID,
  ).save;
  save = completeResidents(save);
  const completed = turnInTrenchlightFieldwork(
    normalizeAdventureSave(jsonRoundTrip(save)),
  );
  assert.equal(completed.progress.complete, true);
  assert.equal(completed.progress.sensorRecovered, true);
  assert.deepEqual(normalizeAdventureSave(jsonRoundTrip(completed.save)), completed.save);
});
