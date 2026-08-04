import { normalizeAdventureSave } from "./adventureProgression.mjs";
import {
  ADVENTURE_OPENING_CONTENT_VERSION,
  ADVENTURE_OPENING_STATUS,
  ELVERSON_PROLOGUE_BEATS,
  ELVERSON_PROLOGUE_BEAT_IDS,
} from "./adventureOpeningContract.mjs";
import {
  ONBOARDING_QUEST_FLAGS,
  SHELLSHORE_ONBOARDING_QUEST_ID,
} from "./adventureOnboarding.mjs";

export const ELVERSON_PROLOGUE_CONTENT_VERSION = ADVENTURE_OPENING_CONTENT_VERSION;
export const ELVERSON_PROLOGUE_HOME_SCENE_ID = "player-home";
export const ELVERSON_PROLOGUE_AQUARIUM_SCENE_ID = "academy-lab";
export const ELVERSON_PROLOGUE_BEST_FRIEND_ID = "player-best-friend";

export { ELVERSON_PROLOGUE_BEATS, ELVERSON_PROLOGUE_BEAT_IDS };

const ELVERSON_PROLOGUE_BEAT_SET = new Set(ELVERSON_PROLOGUE_BEAT_IDS);
const HOME_BEAT_SPEAKERS = Object.freeze({
  [ELVERSON_PROLOGUE_BEATS.breakfast]: Object.freeze({
    trainerId: "player-mom",
    sceneId: ELVERSON_PROLOGUE_HOME_SCENE_ID,
    interactionId: "interaction-elverson-prologue-player-mom",
    mode: "birthdayMorning",
  }),
  [ELVERSON_PROLOGUE_BEATS.permission]: Object.freeze({
    trainerId: "player-dad",
    sceneId: ELVERSON_PROLOGUE_HOME_SCENE_ID,
    interactionId: "interaction-elverson-prologue-player-dad",
    mode: "birthdayMorning",
  }),
  [ELVERSON_PROLOGUE_BEATS.race]: Object.freeze({
    trainerId: ELVERSON_PROLOGUE_BEST_FRIEND_ID,
    sceneId: ELVERSON_PROLOGUE_HOME_SCENE_ID,
    interactionId: "interaction-elverson-prologue-player-best-friend",
    mode: "birthdayMorning",
  }),
});

export const ELVERSON_RIVAL_DEPARTURE_CONVERSATION = Object.freeze({
  trainerId: ELVERSON_PROLOGUE_BEST_FRIEND_ID,
  sceneId: ELVERSON_PROLOGUE_AQUARIUM_SCENE_ID,
  interactionId: "interaction-elverson-rival-aquarium",
  mode: "rivalDeparture",
});

function openingPrefix(completedBeatIds) {
  const prefix = [];
  for (let index = 0; index < ELVERSON_PROLOGUE_BEAT_IDS.length; index += 1) {
    const expectedBeatId = ELVERSON_PROLOGUE_BEAT_IDS[index];
    if (completedBeatIds[index] !== expectedBeatId) break;
    prefix.push(expectedBeatId);
  }
  return prefix;
}

function arraysEqual(left, right) {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function withOpening(save, opening) {
  return normalizeAdventureSave({
    ...save,
    opening,
  });
}

function ensurePrefixThrough(prefix, beatId) {
  const requiredIndex = ELVERSON_PROLOGUE_BEAT_IDS.indexOf(beatId);
  if (requiredIndex < 0) throw new RangeError(`Unknown Elverson opening beat: ${String(beatId)}.`);
  return prefix.length > requiredIndex
    ? prefix
    : ELVERSON_PROLOGUE_BEAT_IDS.slice(0, requiredIndex + 1);
}

function hasWorldIntroductionEvidence(save) {
  return save.progression.quests[SHELLSHORE_ONBOARDING_QUEST_ID]
    ?.flags?.[ONBOARDING_QUEST_FLAGS.worldIntroductionComplete] === true;
}

function hasTutorialCompletionEvidence(save) {
  return save.tutorial.status === "complete";
}

export function getElversonPrologueProgress(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const opening = save.opening;
  const legacySkipped = opening.status === ADVENTURE_OPENING_STATUS.LEGACY_SKIPPED;
  const completedBeatIds = legacySkipped
    ? []
    : openingPrefix(opening.completedBeatIds);
  const finalBeatRecorded = completedBeatIds.length === ELVERSON_PROLOGUE_BEAT_IDS.length;
  const complete = legacySkipped || finalBeatRecorded;
  const nextBeatId = complete
    ? null
    : ELVERSON_PROLOGUE_BEAT_IDS[completedBeatIds.length] ?? null;
  const homeConversation = HOME_BEAT_SPEAKERS[nextBeatId] ?? null;
  const raceComplete = completedBeatIds.includes(ELVERSON_PROLOGUE_BEATS.race);
  const rivalDeparted = legacySkipped || finalBeatRecorded;

  return Object.freeze({
    contentVersion: opening.contentVersion,
    status: opening.status,
    legacySkipped,
    complete,
    completedBeatIds: Object.freeze([...completedBeatIds]),
    nextBeatId,
    homeConversation,
    needsHomeSequence: Boolean(homeConversation),
    readyForAquariumRace: !complete
      && nextBeatId === ELVERSON_PROLOGUE_BEATS.challenge,
    aquariumChallengeAccepted: completedBeatIds.includes(ELVERSON_PROLOGUE_BEATS.challenge),
    starterRecorded: completedBeatIds.includes(ELVERSON_PROLOGUE_BEATS.starter),
    tutorialRecorded: completedBeatIds.includes(ELVERSON_PROLOGUE_BEATS.tutorial),
    needsRivalDeparture: !complete
      && nextBeatId === ELVERSON_PROLOGUE_BEATS.rivalDeparture,
    friendVisibleInAquarium: !legacySkipped && raceComplete && !rivalDeparted,
  });
}

/** Starts only a genuinely new schema-v3 profile. Historical saves are legacySkipped. */
export function beginElversonPrologue(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const progress = getElversonPrologueProgress(save);
  if (progress.legacySkipped || progress.complete) {
    return { save, applied: false, progress };
  }
  if (save.opening.status === ADVENTURE_OPENING_STATUS.ACTIVE) {
    return { save, applied: false, progress };
  }
  const nextSave = withOpening(save, {
    ...save.opening,
    status: ADVENTURE_OPENING_STATUS.ACTIVE,
    completedBeatIds: [...progress.completedBeatIds],
  });
  return { save: nextSave, applied: true, progress: getElversonPrologueProgress(nextSave) };
}

/** Records one ordered story boundary. Duplicate callbacks are harmless. */
export function recordElversonPrologueBeat(saveValue, beatId) {
  const save = normalizeAdventureSave(saveValue);
  if (!ELVERSON_PROLOGUE_BEAT_SET.has(beatId)) {
    throw new RangeError(`Unknown Elverson opening beat: ${String(beatId)}.`);
  }
  const progress = getElversonPrologueProgress(save);
  if (progress.legacySkipped) return { save, applied: false, progress };
  if (progress.completedBeatIds.includes(beatId)) return { save, applied: false, progress };
  if (progress.complete) {
    throw new RangeError("The Elverson opening is already complete.");
  }
  if (progress.nextBeatId !== beatId) {
    throw new RangeError(
      `Elverson opening beat ${beatId} cannot be recorded before ${progress.nextBeatId}.`,
    );
  }

  const completedBeatIds = [...progress.completedBeatIds, beatId];
  const completed = beatId === ELVERSON_PROLOGUE_BEATS.rivalDeparture;
  const nextSave = withOpening(save, {
    contentVersion: ELVERSON_PROLOGUE_CONTENT_VERSION,
    status: completed
      ? ADVENTURE_OPENING_STATUS.COMPLETE
      : ADVENTURE_OPENING_STATUS.ACTIVE,
    completedBeatIds,
  });
  return {
    save: nextSave,
    applied: true,
    progress: getElversonPrologueProgress(nextSave),
  };
}

/**
 * Repairs interrupted coupled writes from authoritative onboarding evidence.
 * It never replays the birthday sequence for a migrated legacy profile.
 */
export function recoverElversonPrologueResume(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  if (save.opening.status === ADVENTURE_OPENING_STATUS.LEGACY_SKIPPED) {
    return {
      save,
      recovered: false,
      reasons: [],
      progress: getElversonPrologueProgress(save),
    };
  }

  const reasons = [];
  let completedBeatIds = openingPrefix(save.opening.completedBeatIds);
  if (!arraysEqual(completedBeatIds, save.opening.completedBeatIds)) {
    reasons.push("opening-beat-order-restored");
  }

  if (hasWorldIntroductionEvidence(save)) {
    const next = ensurePrefixThrough(completedBeatIds, ELVERSON_PROLOGUE_BEATS.challenge);
    if (!arraysEqual(next, completedBeatIds)) reasons.push("aquarium-challenge-restored");
    completedBeatIds = next;
  }
  const hasStarterEvidence = save.player.starterDeckId !== null;
  if (hasStarterEvidence) {
    const next = ensurePrefixThrough(completedBeatIds, ELVERSON_PROLOGUE_BEATS.starter);
    if (!arraysEqual(next, completedBeatIds)) reasons.push("starter-opening-beat-restored");
    completedBeatIds = next;
  }
  if (hasStarterEvidence && hasTutorialCompletionEvidence(save)) {
    const next = ensurePrefixThrough(completedBeatIds, ELVERSON_PROLOGUE_BEATS.tutorial);
    if (!arraysEqual(next, completedBeatIds)) reasons.push("tutorial-opening-beat-restored");
    completedBeatIds = next;
  }

  const finalBeatRecorded = completedBeatIds.length === ELVERSON_PROLOGUE_BEAT_IDS.length;
  const openingHadStarted = save.opening.status !== ADVENTURE_OPENING_STATUS.NOT_STARTED
    || completedBeatIds.length > 0;
  const status = finalBeatRecorded
    ? ADVENTURE_OPENING_STATUS.COMPLETE
    : openingHadStarted
      ? ADVENTURE_OPENING_STATUS.ACTIVE
      : ADVENTURE_OPENING_STATUS.NOT_STARTED;
  if (save.opening.status !== status) reasons.push("opening-status-restored");
  if (!reasons.length) {
    return {
      save,
      recovered: false,
      reasons,
      progress: getElversonPrologueProgress(save),
    };
  }

  const nextSave = withOpening(save, {
    contentVersion: ELVERSON_PROLOGUE_CONTENT_VERSION,
    status,
    completedBeatIds,
  });
  return {
    save: nextSave,
    recovered: true,
    reasons,
    progress: getElversonPrologueProgress(nextSave),
  };
}
