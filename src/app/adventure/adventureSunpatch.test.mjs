import assert from "node:assert/strict";
import test from "node:test";
import { createInitialAdventureSave, normalizeAdventureSave } from "./adventureProgression.mjs";
import {
  SUNPATCH_CORRECT_INTERPRETATION_ID,
  SUNPATCH_CORRECT_RESPONSE_ID,
  SUNPATCH_QUEST_ID,
  SUNPATCH_REQUIRED_OBSERVATION_IDS,
  SUNPATCH_RESIDENT_ENCOUNTER_IDS,
  beginSunpatchInvestigation,
  getSunpatchProgress,
  reconcileSunpatchQuest,
  recordSunpatchObservation,
  submitSunpatchInterpretation,
  submitSunpatchResponse,
  turnInSunpatchFieldwork,
} from "./adventureSunpatch.mjs";

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
  let save = submitSunpatchInterpretation(
    saveValue,
    SUNPATCH_CORRECT_INTERPRETATION_ID,
  ).save;
  save = submitSunpatchResponse(save, SUNPATCH_CORRECT_RESPONSE_ID).save;
  return save;
}

function completeResidents(saveValue) {
  return SUNPATCH_RESIDENT_ENCOUNTER_IDS.reduce(withCompletedEncounter, saveValue);
}

test("Sunpatch begins once and reports every authored requirement", () => {
  const initial = createInitialAdventureSave("sunpatch-begin");
  const before = getSunpatchProgress(initial);
  assert.equal(before.status, "notStarted");
  assert.deepEqual(before.missingObservationIds, SUNPATCH_REQUIRED_OBSERVATION_IDS);
  assert.deepEqual(before.missingResidentEncounterIds, SUNPATCH_RESIDENT_ENCOUNTER_IDS);
  assert.ok(before.missingSteps.some((step) => step.id === "interpretation"));
  assert.ok(before.missingSteps.some((step) => step.id === "response"));

  const first = beginSunpatchInvestigation(initial);
  assert.equal(first.applied, true);
  assert.equal(first.progress.status, "active");
  const repeated = beginSunpatchInvestigation(first.save);
  assert.equal(repeated.applied, false);
  assert.deepEqual(repeated.save, first.save);
});

test("all observation orders converge and only the complete requirement set becomes ready", () => {
  for (const order of permutations([...SUNPATCH_REQUIRED_OBSERVATION_IDS])) {
    let save = beginSunpatchInvestigation(
      createInitialAdventureSave(`sunpatch-${order.join("-")}`),
    ).save;
    save = completeDecisions(save);
    save = completeResidents(save);

    for (const [index, observationId] of order.entries()) {
      const result = recordSunpatchObservation(save, observationId);
      save = result.save;
      assert.equal(
        result.progress.status,
        index === order.length - 1 ? "readyToTurnIn" : "active",
      );
    }

    const progress = getSunpatchProgress(save);
    assert.equal(progress.requirementsMet, true);
    assert.equal(progress.readyToTurnIn, true);
    assert.deepEqual(progress.missingSteps, []);
  }
});

test("duplicate observations are idempotent and unknown observations are rejected", () => {
  let save = beginSunpatchInvestigation(createInitialAdventureSave("sunpatch-observe")).save;
  const first = recordSunpatchObservation(save, SUNPATCH_REQUIRED_OBSERVATION_IDS[0]);
  const repeated = recordSunpatchObservation(first.save, SUNPATCH_REQUIRED_OBSERVATION_IDS[0]);
  assert.equal(first.applied, true);
  assert.equal(repeated.applied, false);
  assert.deepEqual(repeated.save, first.save);
  assert.match(first.feedback, /comparison|stress/i);
  assert.throws(
    () => recordSunpatchObservation(save, "mystery-patch"),
    /Unknown Sunpatch observation/,
  );
});

test("wrong interpretation and response attempts persist corrective flags and remain retryable", () => {
  let save = beginSunpatchInvestigation(createInitialAdventureSave("sunpatch-retry")).save;

  const wrongInterpretation = submitSunpatchInterpretation(save, "all-white-coral-is-dead");
  save = wrongInterpretation.save;
  assert.equal(wrongInterpretation.correct, false);
  assert.equal(wrongInterpretation.retryable, true);
  assert.equal(wrongInterpretation.progress.status, "active");
  assert.equal(wrongInterpretation.progress.interpretation.correctiveAttempts, 1);
  assert.equal(wrongInterpretation.progress.interpretation.lastChoiceId, "all-white-coral-is-dead");
  assert.match(wrongInterpretation.feedback, /White appearance alone.*dead or diseased/i);

  const secondWrongInterpretation = submitSunpatchInterpretation(save, "visible-damage-proves-disease");
  save = secondWrongInterpretation.save;
  assert.equal(secondWrongInterpretation.progress.interpretation.correctiveAttempts, 2);

  const correctInterpretation = submitSunpatchInterpretation(
    save,
    SUNPATCH_CORRECT_INTERPRETATION_ID,
  );
  save = correctInterpretation.save;
  assert.equal(correctInterpretation.correct, true);
  assert.equal(correctInterpretation.retryable, false);
  assert.equal(correctInterpretation.progress.interpretation.correct, true);
  assert.equal(correctInterpretation.progress.interpretation.correctiveAttempts, 2);
  assert.match(correctInterpretation.feedback, /lesion is an observation rather than a diagnosis/i);

  const ignoredAfterCorrect = submitSunpatchInterpretation(save, "all-white-coral-is-dead");
  assert.equal(ignoredAfterCorrect.applied, false);
  assert.equal(ignoredAfterCorrect.correct, true);
  assert.equal(ignoredAfterCorrect.retryable, false);
  assert.equal(ignoredAfterCorrect.progress.interpretation.lastChoiceId, SUNPATCH_CORRECT_INTERPRETATION_ID);
  assert.equal(ignoredAfterCorrect.progress.interpretation.correctiveAttempts, 2);
  assert.deepEqual(ignoredAfterCorrect.save, save);

  const wrongResponse = submitSunpatchResponse(save, "replace-every-pale-coral");
  save = wrongResponse.save;
  assert.equal(wrongResponse.correct, false);
  assert.equal(wrongResponse.retryable, true);
  assert.equal(wrongResponse.progress.response.correctiveAttempts, 1);
  assert.match(wrongResponse.feedback, /Do not promise an instant cure/i);

  const correctResponse = submitSunpatchResponse(save, SUNPATCH_CORRECT_RESPONSE_ID);
  assert.equal(correctResponse.correct, true);
  assert.equal(correctResponse.progress.response.correct, true);
  assert.equal(correctResponse.progress.response.correctiveAttempts, 1);
  assert.match(correctResponse.feedback, /do not replace action on ocean warming/i);
});

test("readiness requires both resident victories in addition to evidence and decisions", () => {
  let save = beginSunpatchInvestigation(createInitialAdventureSave("sunpatch-residents")).save;
  for (const observationId of SUNPATCH_REQUIRED_OBSERVATION_IDS) {
    save = recordSunpatchObservation(save, observationId).save;
  }
  save = completeDecisions(save);
  save = withCompletedEncounter(save, SUNPATCH_RESIDENT_ENCOUNTER_IDS[0]);
  let reconciled = reconcileSunpatchQuest(save);
  assert.equal(reconciled.progress.status, "active");
  assert.deepEqual(reconciled.progress.missingResidentEncounterIds, [
    SUNPATCH_RESIDENT_ENCOUNTER_IDS[1],
  ]);

  save = withCompletedEncounter(reconciled.save, SUNPATCH_RESIDENT_ENCOUNTER_IDS[1]);
  reconciled = reconcileSunpatchQuest(save);
  assert.equal(reconciled.applied, true);
  assert.equal(reconciled.progress.status, "readyToTurnIn");
  assert.equal(reconcileSunpatchQuest(reconciled.save).applied, false);
});

test("fieldwork turn-in requires readiness and grants the authored note exactly once", () => {
  const initial = createInitialAdventureSave("sunpatch-turn-in");
  assert.throws(
    () => turnInSunpatchFieldwork(initial),
    /not ready to turn in/i,
  );

  let save = beginSunpatchInvestigation(initial).save;
  for (const observationId of SUNPATCH_REQUIRED_OBSERVATION_IDS) {
    save = recordSunpatchObservation(save, observationId).save;
  }
  save = completeDecisions(save);
  save = completeResidents(save);

  const first = turnInSunpatchFieldwork(save);
  assert.equal(first.applied, true);
  assert.equal(first.completed, true);
  assert.equal(first.rewardApplied, true);
  assert.equal(first.progress.status, "complete");
  assert.deepEqual(first.fieldNoteIds, ["field-note-coral-observations"]);
  assert.ok(first.save.fieldNotes.entryIds.includes("field-note-coral-observations"));
  assert.equal(
    first.save.rewardLedger.filter((id) => id === "reward-sunpatch-fieldwork").length,
    1,
  );

  const repeated = turnInSunpatchFieldwork(first.save);
  assert.equal(repeated.applied, false);
  assert.equal(repeated.completed, false);
  assert.equal(repeated.rewardApplied, false);
  assert.deepEqual(repeated.save, first.save);
  assert.equal(repeated.progress.status, "complete");
});

test("the persisted quest flags expose retry history without storing unsupported values", () => {
  let save = beginSunpatchInvestigation(createInitialAdventureSave("sunpatch-flags")).save;
  save = submitSunpatchInterpretation(save, "color-alone-is-a-diagnosis").save;
  save = submitSunpatchResponse(save, "instant-coral-cure").save;
  const flags = save.progression.quests[SUNPATCH_QUEST_ID].flags;

  assert.deepEqual(flags, {
    "interpretation-attempted": true,
    "interpretation-corrective-attempts": 1,
    "interpretation-last-choice": "color-alone-is-a-diagnosis",
    "response-attempted": true,
    "response-corrective-attempts": 1,
    "response-last-choice": "instant-coral-cure",
  });
  assert.equal(normalizeAdventureSave(save).progression.quests[SUNPATCH_QUEST_ID].status, "active");
});
