import assert from "node:assert/strict";
import test from "node:test";
import {
  ONBOARDING_QUEST_FLAGS,
  SHELLSHORE_ONBOARDING_QUEST_ID,
  SHELLSHORE_PRACTICE_ENCOUNTER_ID,
  SHELLSHORE_TUTORIAL_REWARD_ID,
  STARTER_DECK_IDS,
  TUTORIAL_CHECKPOINT_IDS,
  TUTORIAL_CHECKPOINTS,
  commitStarterSelection,
  getOnboardingProgress,
  previewStarterSelection,
  recordBoatSafetyReview,
  recordPracticeDuelResult,
  recordTutorialCheckpoint,
  recordWorldIntroduction,
  recoverOnboardingResume,
} from "./adventureOnboarding.mjs";
import {
  DEFAULT_ADVENTURE_BEST_FRIEND_NAME,
  DEFAULT_ADVENTURE_PLAYER_NAME,
  createInitialAdventureSave,
  normalizeAdventureSave,
  validateAdventureSave,
} from "./adventureProgression.mjs";
import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import { createNewAdventureSession } from "./adventureSession.mjs";

function chooseStarter(starterDeckId = "coral-garden") {
  return commitStarterSelection(
    createInitialAdventureSave("profile-1"),
    starterDeckId,
  ).save;
}

function finishCheckpoints(saveValue = chooseStarter()) {
  return TUTORIAL_CHECKPOINT_IDS.reduce(
    (save, checkpointId) => recordTutorialCheckpoint(save, checkpointId).save,
    saveValue,
  );
}

test("the live tutorial follows the simulator's real turn order", () => {
  assert.deepEqual(TUTORIAL_CHECKPOINT_IDS, [
    "tutorial-setup",
    "tutorial-collect-rp",
    "tutorial-draw-card",
    "tutorial-build-card",
    "tutorial-attack",
    "tutorial-end-turn",
    "tutorial-earn-vp",
  ]);
  assert.deepEqual(STARTER_DECK_IDS, [
    "coral-garden",
    "murky-water",
    "blue-water",
  ]);

  const tutorial = ADVENTURE_CONTENT.tutorials.find(
    (candidate) => candidate.id === "tutorial-shellshore-live-basics",
  );
  assert.deepEqual(
    tutorial.checkpoints.map((checkpoint) => checkpoint.id),
    TUTORIAL_CHECKPOINT_IDS,
  );
  assert.deepEqual(tutorial.starterDeckIds, STARTER_DECK_IDS);
  assert.equal(tutorial.practiceEncounterId, SHELLSHORE_PRACTICE_ENCOUNTER_ID);
  assert.equal(tutorial.completionRewardId, SHELLSHORE_TUTORIAL_REWARD_ID);
});

test("the world introduction is durable, applies once, and remains pending across reload", () => {
  const pending = createNewAdventureSession("profile-3");
  const flagId = ONBOARDING_QUEST_FLAGS.worldIntroductionComplete;

  assert.equal(
    pending.progression.quests[SHELLSHORE_ONBOARDING_QUEST_ID].flags[flagId],
    false,
  );
  assert.equal(getOnboardingProgress(pending).worldIntroductionComplete, false);
  assert.equal(getOnboardingProgress(pending).needsWorldIntroduction, true);

  const pendingReload = recoverOnboardingResume(normalizeAdventureSave(
    JSON.parse(JSON.stringify(pending)),
  ));
  assert.equal(pendingReload.recovered, false);
  assert.equal(pendingReload.progress.needsWorldIntroduction, true);
  assert.equal(
    pendingReload.save.progression.quests[SHELLSHORE_ONBOARDING_QUEST_ID].flags[flagId],
    false,
  );

  const introduced = recordWorldIntroduction(pendingReload.save);
  assert.equal(introduced.applied, true);
  assert.equal(
    introduced.save.progression.quests[SHELLSHORE_ONBOARDING_QUEST_ID].flags[flagId],
    true,
  );
  assert.equal(getOnboardingProgress(introduced.save).needsWorldIntroduction, false);
  assert.equal(
    pendingReload.save.progression.quests[SHELLSHORE_ONBOARDING_QUEST_ID].flags[flagId],
    false,
    "recording the introduction must not mutate the prior save",
  );

  const completedReload = recoverOnboardingResume(normalizeAdventureSave(
    JSON.parse(JSON.stringify(introduced.save)),
  ));
  assert.equal(completedReload.recovered, false);
  assert.equal(completedReload.progress.worldIntroductionComplete, true);
  assert.equal(completedReload.progress.needsWorldIntroduction, false);

  const repeated = recordWorldIntroduction(completedReload.save);
  assert.equal(repeated.applied, false);
  assert.deepEqual(repeated.save, completedReload.save);
});

test("legacy saves without the world-introduction marker never replay the opening", () => {
  const legacy = createInitialAdventureSave("legacy-profile");
  const flags = legacy.progression.quests[SHELLSHORE_ONBOARDING_QUEST_ID]?.flags ?? {};
  const flagId = ONBOARDING_QUEST_FLAGS.worldIntroductionComplete;

  assert.equal(Object.hasOwn(flags, flagId), false);
  assert.equal(getOnboardingProgress(legacy).worldIntroductionComplete, true);
  assert.equal(getOnboardingProgress(legacy).needsWorldIntroduction, false);

  const recovered = recoverOnboardingResume(JSON.parse(JSON.stringify(legacy)));
  assert.equal(recovered.progress.needsWorldIntroduction, false);
  const recorded = recordWorldIntroduction(recovered.save);
  assert.equal(recorded.applied, false);
  assert.equal(
    Object.hasOwn(
      recorded.save.progression.quests[SHELLSHORE_ONBOARDING_QUEST_ID]?.flags ?? {},
      flagId,
    ),
    false,
  );
});

test("starter preview supports confirmation without changing the save", () => {
  const initial = createInitialAdventureSave("profile-1");
  const preview = previewStarterSelection(initial, "murky-water");

  assert.deepEqual(preview, {
    starterDeckId: "murky-water",
    selectedStarterDeckId: null,
    canCommit: true,
    alreadySelected: false,
    reason: null,
  });
  assert.equal(initial.player.starterDeckId, null);

  const selected = commitStarterSelection(initial, "coral-garden").save;
  assert.deepEqual(previewStarterSelection(selected, "coral-garden"), {
    starterDeckId: "coral-garden",
    selectedStarterDeckId: "coral-garden",
    canCommit: false,
    alreadySelected: true,
    reason: "already-selected",
  });
  assert.equal(
    previewStarterSelection(selected, "blue-water").reason,
    "starter-locked",
  );
});

test("each supported starter commits once and becomes the active deck", () => {
  for (const starterDeckId of STARTER_DECK_IDS) {
    const initial = createInitialAdventureSave("profile-2");
    const selection = commitStarterSelection(initial, starterDeckId);

    assert.equal(selection.applied, true);
    assert.deepEqual(selection.save.player, {
      name: DEFAULT_ADVENTURE_PLAYER_NAME,
      bestFriendName: DEFAULT_ADVENTURE_BEST_FRIEND_NAME,
      starterDeckId,
      activeDeckId: starterDeckId,
    });
    assert.deepEqual(selection.save.tutorial, {
      status: "active",
      completedStepIds: [],
    });
    assert.equal(initial.player.starterDeckId, null);
    assert.equal(validateAdventureSave(selection.save).valid, true);

    const repeated = commitStarterSelection(selection.save, starterDeckId);
    assert.equal(repeated.applied, false);
    assert.deepEqual(repeated.save, selection.save);
  }
});

test("a committed starter cannot be replaced and unknown starters are rejected", () => {
  const selected = chooseStarter("coral-garden");

  assert.throws(
    () => commitStarterSelection(selected, "blue-water"),
    /locked to coral-garden and cannot be replaced/,
  );
  assert.throws(
    () => previewStarterSelection(selected, "darkness-shroud"),
    /Unknown starter deck/,
  );
  assert.equal(selected.player.starterDeckId, "coral-garden");
});

test("checkpoints advance one step at a time and duplicate action events are safe", () => {
  const selected = chooseStarter();
  const setup = recordTutorialCheckpoint(selected, TUTORIAL_CHECKPOINTS.setup);
  assert.equal(setup.advanced, true);
  assert.equal(setup.nextCheckpointId, TUTORIAL_CHECKPOINTS.collectRp);
  assert.equal(setup.save.tutorial.status, "active");

  const repeated = recordTutorialCheckpoint(setup.save, TUTORIAL_CHECKPOINTS.setup);
  assert.equal(repeated.advanced, false);
  assert.deepEqual(repeated.save, setup.save);

  const ready = finishCheckpoints(setup.save);
  assert.equal(ready.tutorial.status, "readyToTurnIn");
  assert.deepEqual(ready.tutorial.completedStepIds, TUTORIAL_CHECKPOINT_IDS);
  assert.deepEqual(getOnboardingProgress(ready), {
    worldIntroductionComplete: true,
    needsWorldIntroduction: false,
    starterDeckId: "coral-garden",
    starterLocked: true,
    needsStarterSelection: false,
    tutorialStatus: "readyToTurnIn",
    completedCheckpointIds: TUTORIAL_CHECKPOINT_IDS,
    nextCheckpointId: null,
    completedCheckpointCount: TUTORIAL_CHECKPOINT_IDS.length,
    checkpointCount: TUTORIAL_CHECKPOINT_IDS.length,
    readyForPracticeDuel: true,
    tutorialComplete: false,
    boatSafetyReviewed: false,
    needsBoatSafetyReview: false,
  });
});

test("checkpoint validation prevents skips and starting without a starter", () => {
  const initial = createInitialAdventureSave("profile-1");
  assert.throws(
    () => recordTutorialCheckpoint(initial, TUTORIAL_CHECKPOINTS.setup),
    /Unknown starter deck/,
  );

  const selected = chooseStarter();
  assert.throws(
    () => recordTutorialCheckpoint(selected, TUTORIAL_CHECKPOINTS.draw),
    /cannot be recorded before tutorial-setup/,
  );
  assert.throws(
    () => recordTutorialCheckpoint(selected, "tutorial-capture-animal"),
    /Unknown tutorial checkpoint/,
  );
});

test("practice losses and exits preserve progress and expose retry behavior", () => {
  const ready = finishCheckpoints();
  const lost = recordPracticeDuelResult(ready, "lost");
  const exited = recordPracticeDuelResult(ready, "exited");

  assert.equal(lost.retryAvailable, true);
  assert.equal(exited.retryAvailable, false);
  assert.equal(lost.rewardApplied, false);
  assert.equal(exited.rewardApplied, false);
  assert.deepEqual(lost.save, ready);
  assert.deepEqual(exited.save, ready);
  assert.throws(
    () => recordPracticeDuelResult(ready, "draw"),
    /Unknown practice duel outcome/,
  );
});

test("the practice duel cannot award progression before guided actions finish", () => {
  const selected = chooseStarter();
  assert.throws(
    () => recordPracticeDuelResult(selected, "won"),
    /cannot complete before tutorial checkpoint tutorial-setup/,
  );
  assert.deepEqual(selected.rewardLedger, []);
  assert.deepEqual(selected.fieldNotes.entryIds, []);
});

test("boat safety cannot be acknowledged before its Field Note is awarded", () => {
  const selected = chooseStarter();

  assert.throws(
    () => recordBoatSafetyReview(selected),
    /before the Harbor Field Note is awarded/,
  );
  assert.equal(
    selected.progression.quests[SHELLSHORE_ONBOARDING_QUEST_ID]?.flags[
      ONBOARDING_QUEST_FLAGS.boatSafetyReviewed
    ],
    undefined,
  );
});

test("a practice win grants first learnings before explicit safety review", () => {
  const ready = finishCheckpoints(chooseStarter("blue-water"));
  const result = recordPracticeDuelResult(ready, "won");
  const save = result.save;
  const flags = save.progression.quests[SHELLSHORE_ONBOARDING_QUEST_ID].flags;

  assert.equal(result.completed, true);
  assert.equal(result.rewardApplied, true);
  assert.equal(result.retryAvailable, false);
  assert.deepEqual(save.tutorial, {
    status: "complete",
    completedStepIds: TUTORIAL_CHECKPOINT_IDS,
  });
  assert.equal(
    save.progression.completedEncounterIds.includes(SHELLSHORE_PRACTICE_ENCOUNTER_ID),
    true,
  );
  assert.equal(flags[ONBOARDING_QUEST_FLAGS.tutorialComplete], true);
  assert.equal(flags[ONBOARDING_QUEST_FLAGS.boatSafetyReviewed], undefined);
  assert.deepEqual(save.fieldNotes.entryIds, ["field-note-harbor-basics"]);
  assert.deepEqual(save.world.unlockedRouteIds, ["route-shellshore-sunpatch"]);
  assert.deepEqual(save.rewardLedger, [SHELLSHORE_TUTORIAL_REWARD_ID]);
  assert.equal(getOnboardingProgress(save).boatSafetyReviewed, false);
  assert.equal(getOnboardingProgress(save).needsBoatSafetyReview, true);
  assert.equal(validateAdventureSave(save).valid, true);
  assert.equal(ready.tutorial.status, "readyToTurnIn");

  const reviewed = recordBoatSafetyReview(save);
  assert.equal(reviewed.applied, true);
  assert.equal(
    reviewed.save.progression.quests[SHELLSHORE_ONBOARDING_QUEST_ID].flags[
      ONBOARDING_QUEST_FLAGS.boatSafetyReviewed
    ],
    true,
  );
  assert.equal(getOnboardingProgress(reviewed.save).boatSafetyReviewed, true);
  assert.equal(getOnboardingProgress(reviewed.save).needsBoatSafetyReview, false);

  const repeated = recordBoatSafetyReview(reviewed.save);
  assert.equal(repeated.applied, false);
  assert.deepEqual(repeated.save, reviewed.save);
});

test("replaying a completed tutorial cannot duplicate its encounter or reward", () => {
  const first = recordPracticeDuelResult(finishCheckpoints(), "won");
  const replay = recordPracticeDuelResult(first.save, "won");

  assert.equal(replay.completed, false);
  assert.equal(replay.rewardApplied, false);
  assert.deepEqual(replay.save, first.save);
  assert.deepEqual(replay.save.rewardLedger, [SHELLSHORE_TUTORIAL_REWARD_ID]);
  assert.deepEqual(replay.save.fieldNotes.entryIds, ["field-note-harbor-basics"]);
  assert.equal(
    replay.save.progression.completedEncounterIds.filter(
      (id) => id === SHELLSHORE_PRACTICE_ENCOUNTER_ID,
    ).length,
    1,
  );
});

test("resume repairs interrupted starter and checkpoint writes deterministically", () => {
  const interrupted = chooseStarter("murky-water");
  interrupted.player.activeDeckId = null;
  interrupted.tutorial.status = "readyToTurnIn";
  interrupted.tutorial.completedStepIds = [
    TUTORIAL_CHECKPOINTS.setup,
    TUTORIAL_CHECKPOINTS.draw,
    TUTORIAL_CHECKPOINTS.attack,
  ];

  const recovered = recoverOnboardingResume(interrupted);
  assert.equal(recovered.recovered, true);
  assert.deepEqual(recovered.reasons, [
    "active-deck-restored",
    "checkpoint-order-restored",
    "tutorial-status-restored",
  ]);
  assert.equal(recovered.save.player.activeDeckId, "murky-water");
  assert.deepEqual(recovered.save.tutorial, {
    status: "active",
    completedStepIds: [TUTORIAL_CHECKPOINTS.setup],
  });
  assert.equal(recovered.progress.nextCheckpointId, TUTORIAL_CHECKPOINTS.collectRp);
});

test("resume repairs an interrupted completion through the reward ledger", () => {
  const interrupted = chooseStarter();
  interrupted.tutorial.status = "complete";

  const recovered = recoverOnboardingResume(interrupted);
  const flags = recovered.save.progression.quests[SHELLSHORE_ONBOARDING_QUEST_ID].flags;

  assert.equal(recovered.recovered, true);
  assert.deepEqual(recovered.reasons, [
    "tutorial-completion-restored",
    "practice-encounter-restored",
    "tutorial-flags-restored",
    "tutorial-reward-restored",
  ]);
  assert.equal(recovered.progress.tutorialComplete, true);
  assert.equal(recovered.progress.boatSafetyReviewed, false);
  assert.equal(recovered.progress.needsBoatSafetyReview, true);
  assert.deepEqual(recovered.save.rewardLedger, [SHELLSHORE_TUTORIAL_REWARD_ID]);
  assert.deepEqual(recovered.save.fieldNotes.entryIds, ["field-note-harbor-basics"]);
  assert.equal(flags[ONBOARDING_QUEST_FLAGS.boatSafetyReviewed], undefined);

  const stable = recoverOnboardingResume(
    JSON.parse(JSON.stringify(recovered.save)),
  );
  assert.equal(stable.recovered, false);
  assert.deepEqual(stable.save, recovered.save);
});

test("resume restores non-consumable tutorial facts when the reward ledger survived alone", () => {
  const completed = recordPracticeDuelResult(finishCheckpoints(), "won").save;
  completed.world.unlockedRouteIds = [];
  completed.fieldNotes.entryIds = [];

  const recovered = recoverOnboardingResume(completed);

  assert.equal(recovered.recovered, true);
  assert.deepEqual(recovered.reasons, ["tutorial-reward-payload-restored"]);
  assert.deepEqual(recovered.save.rewardLedger, [SHELLSHORE_TUTORIAL_REWARD_ID]);
  assert.deepEqual(recovered.save.world.unlockedRouteIds, ["route-shellshore-sunpatch"]);
  assert.deepEqual(recovered.save.fieldNotes.entryIds, ["field-note-harbor-basics"]);
  assert.equal(recovered.progress.needsBoatSafetyReview, true);

  const reviewed = recordBoatSafetyReview(recovered.save);
  assert.equal(reviewed.applied, true);
  assert.equal(getOnboardingProgress(reviewed.save).boatSafetyReviewed, true);
});

test("resume sends invalid or missing starter state back to a safe choice", () => {
  const invalid = chooseStarter();
  invalid.player.starterDeckId = "retired-starter";
  invalid.player.activeDeckId = "retired-starter";
  invalid.tutorial.completedStepIds = [TUTORIAL_CHECKPOINTS.setup];

  const recovered = recoverOnboardingResume(invalid);
  assert.equal(recovered.save.player.starterDeckId, null);
  assert.equal(recovered.save.player.activeDeckId, null);
  assert.deepEqual(recovered.save.tutorial, {
    status: "notStarted",
    completedStepIds: [],
  });
  assert.deepEqual(recovered.reasons, [
    "invalid-starter-cleared",
    "tutorial-reset-without-starter",
  ]);
  assert.equal(recovered.progress.starterLocked, false);
  assert.equal(recovered.progress.needsStarterSelection, true);
  assert.equal(recovered.progress.nextCheckpointId, null);
});
