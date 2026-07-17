import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import {
  grantReward,
  normalizeAdventureSave,
  setQuestFlag,
} from "./adventureProgression.mjs";

export const SHELLSHORE_ONBOARDING_QUEST_ID = "quest-shellshore-first-voyage";
export const SHELLSHORE_PRACTICE_ENCOUNTER_ID = "encounter-shellshore-mentor-practice";
export const SHELLSHORE_TUTORIAL_REWARD_ID = "reward-shellshore-tutorial";

export const STARTER_DECK_IDS = Object.freeze([
  "coral-garden",
  "murky-water",
  "blue-water",
]);

export const TUTORIAL_CHECKPOINTS = Object.freeze({
  setup: "tutorial-setup",
  collectRp: "tutorial-collect-rp",
  draw: "tutorial-draw-card",
  build: "tutorial-build-card",
  attack: "tutorial-attack",
  endTurn: "tutorial-end-turn",
  earnVp: "tutorial-earn-vp",
});

export const TUTORIAL_CHECKPOINT_IDS = Object.freeze(
  Object.values(TUTORIAL_CHECKPOINTS),
);

export const PRACTICE_DUEL_OUTCOMES = Object.freeze([
  "won",
  "lost",
  "exited",
]);

export const ONBOARDING_QUEST_FLAGS = Object.freeze({
  tutorialComplete: "live-tutorial-complete",
  boatSafetyReviewed: "boat-safety-reviewed",
});

const STARTER_DECK_ID_SET = new Set(STARTER_DECK_IDS);
const TUTORIAL_CHECKPOINT_ID_SET = new Set(TUTORIAL_CHECKPOINT_IDS);
const PRACTICE_DUEL_OUTCOME_SET = new Set(PRACTICE_DUEL_OUTCOMES);

function requireStarterDeckId(starterDeckId) {
  if (!STARTER_DECK_ID_SET.has(starterDeckId)) {
    throw new RangeError(
      `Unknown starter deck: ${String(starterDeckId)}. Choose ${STARTER_DECK_IDS.join(", ")}.`,
    );
  }
  return starterDeckId;
}

function requireTutorialCheckpointId(checkpointId) {
  if (!TUTORIAL_CHECKPOINT_ID_SET.has(checkpointId)) {
    throw new RangeError(`Unknown tutorial checkpoint: ${String(checkpointId)}.`);
  }
  return checkpointId;
}

function requirePracticeDuelOutcome(outcome) {
  if (!PRACTICE_DUEL_OUTCOME_SET.has(outcome)) {
    throw new RangeError(
      `Unknown practice duel outcome: ${String(outcome)}. Expected won, lost, or exited.`,
    );
  }
  return outcome;
}

function orderedCheckpointPrefix(completedStepIds) {
  const completed = new Set(completedStepIds);
  const prefix = [];
  for (const checkpointId of TUTORIAL_CHECKPOINT_IDS) {
    if (!completed.has(checkpointId)) break;
    prefix.push(checkpointId);
  }
  return prefix;
}

function listsEqual(left, right) {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function appendMissingIdentifiers(values, requiredValues) {
  const result = [...values];
  const known = new Set(result);
  for (const identifier of requiredValues) {
    if (known.has(identifier)) continue;
    known.add(identifier);
    result.push(identifier);
  }
  return result;
}

function getTutorialReward() {
  const reward = ADVENTURE_CONTENT.rewards.find(
    (candidate) => candidate.id === SHELLSHORE_TUTORIAL_REWARD_ID,
  );
  if (!reward) {
    throw new Error(`Adventure content is missing ${SHELLSHORE_TUTORIAL_REWARD_ID}.`);
  }
  return reward;
}

function hasCompletionMarker(save) {
  return save.tutorial.status === "complete"
    || save.progression.completedEncounterIds.includes(SHELLSHORE_PRACTICE_ENCOUNTER_ID)
    || save.rewardLedger.includes(getTutorialReward().grantId);
}

function withTutorialCompletion(saveValue) {
  let save = normalizeAdventureSave(saveValue);
  const completedEncounterIds = save.progression.completedEncounterIds.includes(
    SHELLSHORE_PRACTICE_ENCOUNTER_ID,
  )
    ? save.progression.completedEncounterIds
    : [...save.progression.completedEncounterIds, SHELLSHORE_PRACTICE_ENCOUNTER_ID];

  save = {
    ...save,
    progression: {
      ...save.progression,
      completedEncounterIds,
    },
    tutorial: {
      status: "complete",
      completedStepIds: [...TUTORIAL_CHECKPOINT_IDS],
    },
  };
  save = setQuestFlag(
    save,
    SHELLSHORE_ONBOARDING_QUEST_ID,
    ONBOARDING_QUEST_FLAGS.tutorialComplete,
    true,
  );

  return grantReward(save, getTutorialReward());
}

/**
 * Repairs only set-like, non-consumable facts from this known one-time reward.
 * Cards, packs, and quantities remain ledger-owned so recovery cannot duplicate
 * spendable inventory if a write was interrupted.
 */
function reconcileTutorialRewardFacts(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const reward = getTutorialReward();
  const unlockedRouteIds = appendMissingIdentifiers(
    save.world.unlockedRouteIds,
    reward.routeIds ?? [],
  );
  const fieldNoteIds = appendMissingIdentifiers(
    save.fieldNotes.entryIds,
    reward.fieldNoteIds ?? [],
  );
  const repaired = !listsEqual(unlockedRouteIds, save.world.unlockedRouteIds)
    || !listsEqual(fieldNoteIds, save.fieldNotes.entryIds);

  if (!repaired) return { save, repaired: false };
  return {
    repaired: true,
    save: {
      ...save,
      world: { ...save.world, unlockedRouteIds },
      fieldNotes: { ...save.fieldNotes, entryIds: fieldNoteIds },
    },
  };
}

/**
 * Produces a non-mutating decision for a confirmation screen. A committed
 * starter is permanent; selecting the same starter again is a safe no-op.
 */
export function previewStarterSelection(saveValue, starterDeckIdValue) {
  const save = normalizeAdventureSave(saveValue);
  const starterDeckId = requireStarterDeckId(starterDeckIdValue);
  const selectedStarterDeckId = save.player.starterDeckId;
  const alreadySelected = selectedStarterDeckId === starterDeckId;
  const locked = selectedStarterDeckId !== null;

  return {
    starterDeckId,
    selectedStarterDeckId,
    canCommit: !locked,
    alreadySelected,
    reason: !locked
      ? null
      : alreadySelected
        ? "already-selected"
        : "starter-locked",
  };
}

/** Permanently commits one starter after the caller has shown confirmation. */
export function commitStarterSelection(saveValue, starterDeckIdValue) {
  const save = normalizeAdventureSave(saveValue);
  const starterDeckId = requireStarterDeckId(starterDeckIdValue);
  const selectedStarterDeckId = save.player.starterDeckId;

  if (selectedStarterDeckId === starterDeckId) {
    return { save, applied: false };
  }
  if (selectedStarterDeckId !== null) {
    throw new RangeError(
      `Starter deck is locked to ${selectedStarterDeckId} and cannot be replaced.`,
    );
  }

  return {
    applied: true,
    save: {
      ...save,
      player: {
        ...save.player,
        starterDeckId,
        activeDeckId: starterDeckId,
      },
      tutorial: {
        status: "active",
        completedStepIds: [],
      },
    },
  };
}

/** Returns the next resume point without changing the supplied save. */
export function getOnboardingProgress(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const starterLocked = STARTER_DECK_ID_SET.has(save.player.starterDeckId);
  const completedCheckpointIds = orderedCheckpointPrefix(save.tutorial.completedStepIds);
  const questFlags = save.progression.quests[SHELLSHORE_ONBOARDING_QUEST_ID]?.flags ?? {};
  const tutorialComplete = save.tutorial.status === "complete";
  const boatSafetyReviewed = questFlags[ONBOARDING_QUEST_FLAGS.boatSafetyReviewed] === true;
  const nextCheckpointId = starterLocked
    && completedCheckpointIds.length < TUTORIAL_CHECKPOINT_IDS.length
    ? TUTORIAL_CHECKPOINT_IDS[completedCheckpointIds.length]
    : null;

  return {
    starterDeckId: starterLocked
      ? save.player.starterDeckId
      : null,
    starterLocked,
    needsStarterSelection: !starterLocked,
    tutorialStatus: save.tutorial.status,
    completedCheckpointIds,
    nextCheckpointId,
    completedCheckpointCount: completedCheckpointIds.length,
    checkpointCount: TUTORIAL_CHECKPOINT_IDS.length,
    readyForPracticeDuel: starterLocked
      && completedCheckpointIds.length === TUTORIAL_CHECKPOINT_IDS.length
      && save.tutorial.status !== "complete",
    tutorialComplete,
    boatSafetyReviewed,
    needsBoatSafetyReview: tutorialComplete && !boatSafetyReviewed,
  };
}

/**
 * Records one validated simulator action. Checkpoints are forward-only, while
 * duplicate action events are harmless so React retries cannot skip progress.
 */
export function recordTutorialCheckpoint(saveValue, checkpointIdValue) {
  const save = normalizeAdventureSave(saveValue);
  const checkpointId = requireTutorialCheckpointId(checkpointIdValue);
  requireStarterDeckId(save.player.starterDeckId);

  const completedStepIds = orderedCheckpointPrefix(save.tutorial.completedStepIds);
  if (completedStepIds.includes(checkpointId)) {
    return {
      save,
      advanced: false,
      nextCheckpointId: completedStepIds.length < TUTORIAL_CHECKPOINT_IDS.length
        ? TUTORIAL_CHECKPOINT_IDS[completedStepIds.length]
        : null,
    };
  }
  if (save.tutorial.status === "complete") {
    throw new RangeError("The live tutorial is already complete.");
  }

  const expectedCheckpointId = TUTORIAL_CHECKPOINT_IDS[completedStepIds.length];
  if (checkpointId !== expectedCheckpointId) {
    throw new RangeError(
      `Tutorial checkpoint ${checkpointId} cannot be recorded before ${expectedCheckpointId}.`,
    );
  }

  const nextCompletedStepIds = [...completedStepIds, checkpointId];
  const nextCheckpointId = TUTORIAL_CHECKPOINT_IDS[nextCompletedStepIds.length] ?? null;
  return {
    advanced: true,
    nextCheckpointId,
    save: {
      ...save,
      tutorial: {
        status: nextCheckpointId === null ? "readyToTurnIn" : "active",
        completedStepIds: nextCompletedStepIds,
      },
    },
  };
}

/**
 * Resolves the friendly practice duel. Loss and exit preserve the exact resume
 * point. A win atomically completes onboarding and applies its one-time reward.
 */
export function recordPracticeDuelResult(saveValue, outcomeValue) {
  const save = normalizeAdventureSave(saveValue);
  const outcome = requirePracticeDuelOutcome(outcomeValue);
  requireStarterDeckId(save.player.starterDeckId);

  if (outcome !== "won") {
    return {
      save,
      outcome,
      completed: false,
      rewardApplied: false,
      retryAvailable: outcome === "lost",
    };
  }

  const wasComplete = hasCompletionMarker(save);
  const checkpointPrefix = orderedCheckpointPrefix(save.tutorial.completedStepIds);
  if (!wasComplete && checkpointPrefix.length !== TUTORIAL_CHECKPOINT_IDS.length) {
    throw new RangeError(
      `Practice duel cannot complete before tutorial checkpoint ${TUTORIAL_CHECKPOINT_IDS[checkpointPrefix.length]}.`,
    );
  }

  const result = withTutorialCompletion(save);
  return {
    save: result.save,
    outcome,
    completed: !wasComplete,
    rewardApplied: result.applied,
    retryAvailable: false,
  };
}

/** Marks the awarded safety note as reviewed only after an explicit UI acknowledgement. */
export function recordBoatSafetyReview(saveValue) {
  let save = normalizeAdventureSave(saveValue);
  const flags = save.progression.quests[SHELLSHORE_ONBOARDING_QUEST_ID]?.flags ?? {};
  if (flags[ONBOARDING_QUEST_FLAGS.boatSafetyReviewed] === true) {
    return { save, applied: false };
  }
  const reward = getTutorialReward();
  const awardedFieldNoteIds = reward.fieldNoteIds ?? [];
  if (!hasCompletionMarker(save) || !awardedFieldNoteIds.every((fieldNoteId) => save.fieldNotes.entryIds.includes(fieldNoteId))) {
    throw new RangeError("Boat safety cannot be reviewed before the Harbor Field Note is awarded.");
  }
  save = setQuestFlag(
    save,
    SHELLSHORE_ONBOARDING_QUEST_ID,
    ONBOARDING_QUEST_FLAGS.boatSafetyReviewed,
    true,
  );
  return { save, applied: true };
}

/**
 * Repairs schema-valid interrupted onboarding writes and returns a deterministic
 * resume checkpoint. Reward-ledger entries are authoritative and never removed.
 */
export function recoverOnboardingResume(saveValue) {
  let save = normalizeAdventureSave(saveValue);
  const reasons = [];
  const starterIsValid = STARTER_DECK_ID_SET.has(save.player.starterDeckId);

  if (save.player.starterDeckId !== null && !starterIsValid) {
    const staleStarterDeckId = save.player.starterDeckId;
    save = {
      ...save,
      player: {
        ...save.player,
        starterDeckId: null,
        activeDeckId: save.player.activeDeckId === staleStarterDeckId
          ? null
          : save.player.activeDeckId,
      },
    };
    reasons.push("invalid-starter-cleared");
  }

  if (save.player.starterDeckId === null) {
    if (save.tutorial.status !== "notStarted" || save.tutorial.completedStepIds.length > 0) {
      save = {
        ...save,
        tutorial: { status: "notStarted", completedStepIds: [] },
      };
      reasons.push("tutorial-reset-without-starter");
    }
    return {
      save,
      recovered: reasons.length > 0,
      reasons,
      progress: getOnboardingProgress(save),
    };
  }

  if (save.player.activeDeckId === null) {
    save = {
      ...save,
      player: { ...save.player, activeDeckId: save.player.starterDeckId },
    };
    reasons.push("active-deck-restored");
  }

  if (hasCompletionMarker(save)) {
    const encounterWasComplete = save.progression.completedEncounterIds.includes(
      SHELLSHORE_PRACTICE_ENCOUNTER_ID,
    );
    const flags = save.progression.quests[SHELLSHORE_ONBOARDING_QUEST_ID]?.flags ?? {};
    const tutorialFlagWasComplete = flags[ONBOARDING_QUEST_FLAGS.tutorialComplete] === true;
    const checkpointsWereComplete = save.tutorial.status === "complete"
      && listsEqual(save.tutorial.completedStepIds, TUTORIAL_CHECKPOINT_IDS);
    const rewardWasApplied = save.rewardLedger.includes(getTutorialReward().grantId);
    const completion = withTutorialCompletion(save);
    const rewardFacts = reconcileTutorialRewardFacts(completion.save);
    save = rewardFacts.save;

    if (!checkpointsWereComplete) reasons.push("tutorial-completion-restored");
    if (!encounterWasComplete) reasons.push("practice-encounter-restored");
    if (!tutorialFlagWasComplete) reasons.push("tutorial-flags-restored");
    if (!rewardWasApplied && completion.applied) reasons.push("tutorial-reward-restored");
    if (rewardFacts.repaired) reasons.push("tutorial-reward-payload-restored");
  } else {
    const checkpointPrefix = orderedCheckpointPrefix(save.tutorial.completedStepIds);
    if (!listsEqual(save.tutorial.completedStepIds, checkpointPrefix)) {
      save = {
        ...save,
        tutorial: { ...save.tutorial, completedStepIds: checkpointPrefix },
      };
      reasons.push("checkpoint-order-restored");
    }

    const expectedStatus = checkpointPrefix.length === TUTORIAL_CHECKPOINT_IDS.length
      ? "readyToTurnIn"
      : "active";
    if (save.tutorial.status !== expectedStatus) {
      save = {
        ...save,
        tutorial: { ...save.tutorial, status: expectedStatus },
      };
      reasons.push("tutorial-status-restored");
    }
  }

  return {
    save,
    recovered: reasons.length > 0,
    reasons,
    progress: getOnboardingProgress(save),
  };
}
