import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVENTURE_OPENING_CONTENT_VERSION,
  ADVENTURE_OPENING_STATUS,
  createInitialAdventureSave,
  setQuestFlag,
} from "./adventureProgression.mjs";
import {
  ONBOARDING_QUEST_FLAGS,
  SHELLSHORE_ONBOARDING_QUEST_ID,
} from "./adventureOnboarding.mjs";
import {
  ELVERSON_PROLOGUE_BEATS,
  ELVERSON_PROLOGUE_BEAT_IDS,
  ELVERSON_PROLOGUE_BEDROOM_SCENE_ID,
  ELVERSON_PROLOGUE_CONTENT_VERSION,
  ELVERSON_PROLOGUE_HOME_SCENE_ID,
  beginElversonPrologue,
  getElversonPrologueProgress,
  recordElversonPrologueBeat,
  recoverElversonPrologueResume,
} from "./adventureElversonPrologue.mjs";

function saveWithOpening(status, completedBeatIds = []) {
  const save = createInitialAdventureSave("profile-1");
  save.opening = {
    contentVersion: ADVENTURE_OPENING_CONTENT_VERSION,
    status,
    completedBeatIds: [...completedBeatIds],
  };
  return save;
}

test("fresh progress shares the schema contract and begins exactly once", () => {
  const fresh = createInitialAdventureSave("profile-1");
  const progress = getElversonPrologueProgress(fresh);

  assert.equal(ELVERSON_PROLOGUE_CONTENT_VERSION, ADVENTURE_OPENING_CONTENT_VERSION);
  assert.equal(Object.isFrozen(ELVERSON_PROLOGUE_BEATS), true);
  assert.equal(Object.isFrozen(ELVERSON_PROLOGUE_BEAT_IDS), true);
  assert.equal(progress.status, ADVENTURE_OPENING_STATUS.NOT_STARTED);
  assert.equal(progress.complete, false);
  assert.equal(progress.nextBeatId, ELVERSON_PROLOGUE_BEATS.breakfast);
  assert.equal(progress.needsHomeSequence, true);
  assert.equal(ELVERSON_PROLOGUE_BEDROOM_SCENE_ID, "player-bedroom");
  assert.equal(progress.homeConversation.sceneId, ELVERSON_PROLOGUE_HOME_SCENE_ID);
  assert.equal(progress.homeConversation.trainerId, "player-mom");

  const untouched = recoverElversonPrologueResume(fresh);
  assert.equal(untouched.recovered, false);
  assert.deepEqual(untouched.reasons, []);
  assert.equal(untouched.save.opening.status, ADVENTURE_OPENING_STATUS.NOT_STARTED);

  const begun = beginElversonPrologue(fresh);
  assert.equal(begun.applied, true);
  assert.equal(begun.save.opening.status, ADVENTURE_OPENING_STATUS.ACTIVE);
  assert.deepEqual(begun.save.opening.completedBeatIds, []);

  const repeated = beginElversonPrologue(begun.save);
  assert.equal(repeated.applied, false);
  assert.deepEqual(repeated.save, begun.save);
});

test("beginning leaves an active ordered prefix untouched", () => {
  const interrupted = saveWithOpening(
    ADVENTURE_OPENING_STATUS.ACTIVE,
    [ELVERSON_PROLOGUE_BEATS.breakfast],
  );

  const begun = beginElversonPrologue(interrupted);
  assert.equal(begun.applied, false);
  assert.deepEqual(begun.save.opening.completedBeatIds, [ELVERSON_PROLOGUE_BEATS.breakfast]);
  assert.equal(begun.progress.nextBeatId, ELVERSON_PROLOGUE_BEATS.permission);
});

test("beats are forward-only and every duplicate callback is idempotent", () => {
  let save = beginElversonPrologue(createInitialAdventureSave("profile-1")).save;

  assert.throws(
    () => recordElversonPrologueBeat(save, ELVERSON_PROLOGUE_BEATS.permission),
    /cannot be recorded before elverson-opening-breakfast/,
  );
  assert.throws(
    () => recordElversonPrologueBeat(save, "elverson-opening-unknown"),
    /Unknown Elverson opening beat/,
  );

  for (let index = 0; index < ELVERSON_PROLOGUE_BEAT_IDS.length; index += 1) {
    const beatId = ELVERSON_PROLOGUE_BEAT_IDS[index];
    assert.equal(getElversonPrologueProgress(save).nextBeatId, beatId);

    const recorded = recordElversonPrologueBeat(save, beatId);
    assert.equal(recorded.applied, true);
    assert.deepEqual(
      recorded.save.opening.completedBeatIds,
      ELVERSON_PROLOGUE_BEAT_IDS.slice(0, index + 1),
    );
    assert.equal(
      recorded.save.opening.status,
      index === ELVERSON_PROLOGUE_BEAT_IDS.length - 1
        ? ADVENTURE_OPENING_STATUS.COMPLETE
        : ADVENTURE_OPENING_STATUS.ACTIVE,
    );

    const duplicate = recordElversonPrologueBeat(recorded.save, beatId);
    assert.equal(duplicate.applied, false);
    assert.deepEqual(duplicate.save, recorded.save);
    save = recorded.save;
  }

  const complete = getElversonPrologueProgress(save);
  assert.equal(complete.complete, true);
  assert.equal(complete.nextBeatId, null);
  assert.equal(complete.needsRivalDeparture, false);
  assert.equal(complete.friendVisibleInAquarium, false);
});

test("progress exposes the home sequence, dock speech, aquarium handoff, and rival departure boundaries", () => {
  let save = beginElversonPrologue(createInitialAdventureSave("profile-1")).save;
  save = recordElversonPrologueBeat(save, ELVERSON_PROLOGUE_BEATS.breakfast).save;
  assert.equal(getElversonPrologueProgress(save).homeConversation.trainerId, "player-dad");
  save = recordElversonPrologueBeat(save, ELVERSON_PROLOGUE_BEATS.permission).save;
  const exteriorArrival = getElversonPrologueProgress(save);
  assert.equal(exteriorArrival.homeConversation.trainerId, "player-best-friend");
  assert.equal(exteriorArrival.homeConversation.sceneId, "town");
  assert.equal(exteriorArrival.needsHomeSequence, false);
  assert.equal(exteriorArrival.needsBestFriendArrival, true);
  save = recordElversonPrologueBeat(save, ELVERSON_PROLOGUE_BEATS.race).save;

  const aquariumBound = getElversonPrologueProgress(save);
  assert.equal(aquariumBound.homeConversation, null);
  assert.equal(aquariumBound.readyForDockSpeech, true);
  assert.equal(aquariumBound.needsBestFriendArrival, false);
  assert.equal(aquariumBound.readyForAquariumRace, true);
  assert.equal(aquariumBound.friendVisibleInAquarium, false);

  save = recordElversonPrologueBeat(save, ELVERSON_PROLOGUE_BEATS.challenge).save;
  const registrationOpen = getElversonPrologueProgress(save);
  assert.equal(registrationOpen.readyForDockSpeech, false);
  assert.equal(registrationOpen.friendVisibleInAquarium, true);

  for (const beatId of [
    ELVERSON_PROLOGUE_BEATS.starter,
    ELVERSON_PROLOGUE_BEATS.tutorial,
  ]) {
    save = recordElversonPrologueBeat(save, beatId).save;
  }
  const departure = getElversonPrologueProgress(save);
  assert.equal(departure.needsRivalDeparture, true);
  assert.equal(departure.friendVisibleInAquarium, true);
});

test("legacySkipped profiles never begin, record, recover, or reveal the new opening", () => {
  const legacy = saveWithOpening(
    ADVENTURE_OPENING_STATUS.LEGACY_SKIPPED,
    [],
  );
  legacy.player.starterDeckId = "coral-garden";
  legacy.tutorial.status = "complete";

  const progress = getElversonPrologueProgress(legacy);
  assert.equal(progress.legacySkipped, true);
  assert.equal(progress.complete, true);
  assert.deepEqual(progress.completedBeatIds, []);
  assert.equal(progress.nextBeatId, null);
  assert.equal(progress.needsHomeSequence, false);
  assert.equal(progress.friendVisibleInAquarium, false);

  const begun = beginElversonPrologue(legacy);
  assert.equal(begun.applied, false);
  const recorded = recordElversonPrologueBeat(legacy, ELVERSON_PROLOGUE_BEATS.challenge);
  assert.equal(recorded.applied, false);
  const recovered = recoverElversonPrologueResume(legacy);
  assert.equal(recovered.recovered, false);
  assert.deepEqual(recovered.reasons, []);
  assert.deepEqual(recovered.save, begun.save);
  assert.deepEqual(recovered.save, recorded.save);
});

test("the schema rejects unknown, reordered, and gapped persisted beats", () => {
  const cases = [
    [ELVERSON_PROLOGUE_BEATS.permission],
    [ELVERSON_PROLOGUE_BEATS.breakfast, ELVERSON_PROLOGUE_BEATS.race],
    [ELVERSON_PROLOGUE_BEATS.breakfast, "elverson-opening-unknown"],
  ];

  for (const completedBeatIds of cases) {
    const save = saveWithOpening(ADVENTURE_OPENING_STATUS.ACTIVE, completedBeatIds);
    assert.throws(
      () => getElversonPrologueProgress(save),
      /must be an exact ordered prefix/,
    );
  }
});

test("recovery advances only to authoritative challenge, starter, and tutorial evidence", () => {
  let save = saveWithOpening(
    ADVENTURE_OPENING_STATUS.ACTIVE,
    [ELVERSON_PROLOGUE_BEATS.breakfast],
  );
  save = setQuestFlag(
    save,
    SHELLSHORE_ONBOARDING_QUEST_ID,
    ONBOARDING_QUEST_FLAGS.worldIntroductionComplete,
    true,
  );
  save.player.starterDeckId = "coral-garden";
  save.tutorial.status = "complete";
  save.inventory.storyItems["birthday-keepsake"] = 1;

  const recovered = recoverElversonPrologueResume(save);
  assert.equal(recovered.recovered, true);
  assert.deepEqual(recovered.reasons, [
    "aquarium-challenge-restored",
    "starter-opening-beat-restored",
    "tutorial-opening-beat-restored",
  ]);
  assert.deepEqual(
    recovered.save.opening.completedBeatIds,
    ELVERSON_PROLOGUE_BEAT_IDS.slice(0, -1),
  );
  assert.equal(recovered.save.opening.status, ADVENTURE_OPENING_STATUS.ACTIVE);
  assert.equal(recovered.progress.nextBeatId, ELVERSON_PROLOGUE_BEATS.rivalDeparture);
  assert.equal(recovered.progress.needsRivalDeparture, true);
  assert.equal(recovered.save.inventory.storyItems["birthday-keepsake"], 1);

  const stable = recoverElversonPrologueResume(recovered.save);
  assert.equal(stable.recovered, false);
  assert.deepEqual(stable.save, recovered.save);
});

test("terminal and skipped opening states cannot become replayable", () => {
  const inconsistentStates = [
    saveWithOpening(
      ADVENTURE_OPENING_STATUS.COMPLETE,
      ELVERSON_PROLOGUE_BEAT_IDS.slice(0, -1),
    ),
    saveWithOpening(
      ADVENTURE_OPENING_STATUS.ACTIVE,
      ELVERSON_PROLOGUE_BEAT_IDS,
    ),
    saveWithOpening(
      ADVENTURE_OPENING_STATUS.LEGACY_SKIPPED,
      [ELVERSON_PROLOGUE_BEATS.breakfast],
    ),
  ];
  for (const save of inconsistentStates) {
    assert.throws(
      () => recoverElversonPrologueResume(save),
      /must describe one coherent opening checkpoint/,
    );
  }

  const complete = saveWithOpening(
    ADVENTURE_OPENING_STATUS.COMPLETE,
    ELVERSON_PROLOGUE_BEAT_IDS,
  );
  const stable = recoverElversonPrologueResume(complete);
  assert.equal(stable.recovered, false);
  assert.equal(stable.progress.complete, true);
  assert.equal(stable.progress.nextBeatId, null);
});

test("tutorial evidence without a starter never fabricates starter or tutorial beats", () => {
  const save = saveWithOpening(ADVENTURE_OPENING_STATUS.ACTIVE, []);
  save.tutorial.status = "complete";

  const recovered = recoverElversonPrologueResume(save);
  assert.equal(recovered.recovered, false);
  assert.deepEqual(recovered.save.opening.completedBeatIds, []);
  assert.equal(recovered.progress.nextBeatId, ELVERSON_PROLOGUE_BEATS.breakfast);
});
