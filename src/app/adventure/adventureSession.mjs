import {
  createInitialAdventureSave,
  grantReward,
  normalizeAdventureSave,
  setQuestFlag,
  transitionQuest,
} from "./adventureProgression.mjs";
import {
  SCENES,
  START_STATE,
  canOccupyScenePosition,
} from "./adventureWorld.mjs";
import {
  ADVENTURE_CONTENT,
  getAdventureDock,
  getAdventureEncounter,
  getAdventureRoute,
  getAdventureScene,
  getAdventureStartLocation,
} from "./adventureContent.mjs";
import {
  ADVENTURE_ECOSYSTEM_CHAPTERS,
  getAdventureEcosystemChapterByQuestId,
  getAdventureEcosystemChapterByTownId,
  isAdventureEcosystemChapterQuest,
  recoverAdventureEcosystemChapterFlags,
} from "./adventureEcosystemChapters.mjs";
import {
  recoverTrenchlightExpeditionResume,
} from "./adventureTrenchlightExpedition.mjs";
import {
  CHAMPIONS_WAKE_QUEST_ID,
  getChampionsWakeTournamentRoundAvailability,
} from "./adventureTournamentGate.mjs";

export const SHELLSHORE_QUEST_ID = "quest-shellshore-first-voyage";
export const SHELLSHORE_RESIDENT_ENCOUNTER_IDS = Object.freeze(
  ADVENTURE_CONTENT.encounters
    .filter((encounter) => (
      encounter.questId === SHELLSHORE_QUEST_ID
      && encounter.role === "resident"
    ))
    .map((encounter) => encounter.id),
);

const SCENE_VISIT_FLAGS = Object.freeze({
  "coral-home": "visited-coral-home",
  "deep-home": "visited-deep-home",
});

function withWorld(
  save,
  sceneId,
  position,
  facing,
  {
    townId = save.world.townId,
    lastSafeDockId = save.world.lastSafeDockId,
  } = {},
) {
  return {
    ...save,
    world: {
      ...save.world,
      townId,
      sceneId,
      position: { x: position.x, y: position.y },
      facing,
      lastSafeDockId,
    },
  };
}

function reconcileShellshoreQuest(saveValue) {
  let save = normalizeAdventureSave(saveValue);
  let quest = save.progression.quests[SHELLSHORE_QUEST_ID];
  if (!quest || quest.status === "notStarted") {
    save = transitionQuest(save, SHELLSHORE_QUEST_ID, "active");
    quest = save.progression.quests[SHELLSHORE_QUEST_ID];
  }

  const residentsComplete = SHELLSHORE_RESIDENT_ENCOUNTER_IDS.length > 0
    && SHELLSHORE_RESIDENT_ENCOUNTER_IDS.every((encounterId) => (
      save.progression.completedEncounterIds.includes(encounterId)
    ));
  if (residentsComplete && quest.status === "active") {
    save = transitionQuest(save, SHELLSHORE_QUEST_ID, "readyToTurnIn");
    quest = save.progression.quests[SHELLSHORE_QUEST_ID];
  }
  const safetyReviewed = quest.flags?.["boat-safety-reviewed"] === true;
  if (safetyReviewed && quest.status === "readyToTurnIn") {
    save = transitionQuest(save, SHELLSHORE_QUEST_ID, "complete");
  }
  return save;
}

/** Reconciles chapter gates whose requirements may be completed in any order. */
export function reconcileAdventureProgression(saveValue) {
  let save = reconcileShellshoreQuest(saveValue);
  for (const chapter of ADVENTURE_ECOSYSTEM_CHAPTERS) {
    save = chapter.reconcile(save).save;
  }
  return save;
}

function beginEcosystemChapterAtCurrentScene(saveValue) {
  let save = normalizeAdventureSave(saveValue);
  const scene = SCENES[save.world.sceneId];
  const sceneContent = getAdventureScene(save.world.sceneId);
  if (
    !scene
    || scene.routeId
    || !sceneContent
    || sceneContent.townId !== save.world.townId
  ) {
    return { save, applied: false };
  }

  const chapter = getAdventureEcosystemChapterByTownId(sceneContent.townId);
  if (!chapter) return { save, applied: false };
  const begun = chapter.begin(save);
  const reconciled = chapter.reconcile(begun.save);
  return {
    save: reconciled.save,
    applied: begun.applied || reconciled.applied,
  };
}

/** Starts the final chapter as soon as a safe non-route Champion's Wake scene is entered. */
export function beginChampionsWakeQuestAtCurrentScene(saveValue) {
  let save = normalizeAdventureSave(saveValue);
  const scene = SCENES[save.world.sceneId];
  const sceneContent = getAdventureScene(save.world.sceneId);
  if (
    !scene
    || scene.routeId
    || sceneContent?.townId !== "champions-wake"
    || save.world.townId !== "champions-wake"
  ) {
    return { save, applied: false };
  }

  const quest = save.progression.quests[CHAMPIONS_WAKE_QUEST_ID]
    ?? { status: "notStarted", flags: {} };
  if (quest.status !== "notStarted") return { save, applied: false };
  save = transitionQuest(save, CHAMPIONS_WAKE_QUEST_ID, "active");
  return { save, applied: true };
}

function finalizeAdventureResume(result) {
  const chapter = beginEcosystemChapterAtCurrentScene(result.save);
  const championsWake = beginChampionsWakeQuestAtCurrentScene(chapter.save);
  if (!chapter.applied && !championsWake.applied) return result;
  return {
    ...result,
    save: championsWake.save,
    recovered: true,
    reason: result.fallback ? result.reason : "quest-state-reconciled",
  };
}

function reconcileCompletedEncounterRewards(saveValue) {
  let save = normalizeAdventureSave(saveValue);
  let recovered = false;
  for (const encounterId of save.progression.completedEncounterIds) {
    const encounter = ADVENTURE_CONTENT.encounters.find((item) => item.id === encounterId);
    const reward = encounter?.rewardId
      ? ADVENTURE_CONTENT.rewards.find((item) => item.id === encounter.rewardId)
      : null;
    if (!reward) continue;
    const granted = grantReward(save, reward);
    save = granted.save;
    recovered ||= granted.applied;
  }
  return { save, recovered };
}

function reconcileCompletedChapterRewards(saveValue) {
  let save = normalizeAdventureSave(saveValue);
  let recovered = false;

  for (const chapter of ADVENTURE_ECOSYSTEM_CHAPTERS) {
    const progress = chapter.getProgress(save);
    if (!progress.complete || progress.stateConsistent !== true) continue;

    const turnIn = chapter.turnIn(save);
    save = turnIn.save;
    recovered ||= turnIn.applied;

    // A verified reward-ledger write can survive while its non-consumable Field
    // Note is missing. The completed chapter is authoritative evidence that the
    // note was earned, so restore that fact without replaying consumable grants.
    if (!save.fieldNotes.entryIds.includes(chapter.fieldNoteId)) {
      save = normalizeAdventureSave({
        ...save,
        fieldNotes: {
          ...save.fieldNotes,
          entryIds: [...save.fieldNotes.entryIds, chapter.fieldNoteId],
        },
      });
      recovered = true;
    }
  }

  return { save, recovered };
}

function recoverToSafeDockOrStart(save, reason) {
  const dock = getAdventureDock(save.world.lastSafeDockId);
  if (
    dock?.status === "prototype"
    && SCENES[dock.sceneId]
    && canOccupyScenePosition(dock.sceneId, dock.position)
  ) {
    return {
      save: withWorld(save, dock.sceneId, dock.position, dock.facing, {
        townId: dock.townId,
        lastSafeDockId: dock.id,
      }),
      recovered: true,
      reason,
      fallback: "safe-dock",
    };
  }

  const start = getAdventureStartLocation();
  return {
    save: withWorld(save, START_STATE.sceneId, START_STATE.position, START_STATE.facing, {
      townId: start.townId,
      lastSafeDockId: start.dockId,
    }),
    recovered: true,
    reason,
    fallback: "adventure-start",
  };
}

export function createNewAdventureSession(profileId) {
  const save = transitionQuest(
    createInitialAdventureSave(profileId),
    SHELLSHORE_QUEST_ID,
    "active",
  );
  const academy = SCENES["academy-lab"];
  if (!academy || !canOccupyScenePosition(academy.id, academy.spawn)) return save;
  return withWorld(save, academy.id, academy.spawn, "up");
}

/**
 * Converts a loaded save into a world state that the current scene renderer can
 * safely resume. Schema-valid but stale scene IDs fall back to the academy
 * start; blocked positions fall back to that scene's authored spawn.
 */
export function recoverAdventureResume(saveValue) {
  const normalized = normalizeAdventureSave(saveValue);
  const chapterFlagRecovery = recoverAdventureEcosystemChapterFlags(normalized);
  const recoveryMetadata = chapterFlagRecovery.applied
    ? Object.freeze({
      chapterQuestRepairs: chapterFlagRecovery.repairs,
    })
    : null;
  const finalize = (result) => finalizeAdventureResume({
    ...result,
    recovered: result.recovered || chapterFlagRecovery.applied,
    reason: result.reason ?? (
      chapterFlagRecovery.applied ? "chapter-quest-flags-recovered" : null
    ),
    ...(recoveryMetadata ? { recoveryMetadata } : {}),
  });
  const recoverySafeSave = chapterFlagRecovery.save;
  const priorQuestStatuses = Object.fromEntries(
    [
      SHELLSHORE_QUEST_ID,
      ...ADVENTURE_ECOSYSTEM_CHAPTERS.map(({ questId }) => questId),
    ].map((questId) => [
      questId,
      recoverySafeSave.progression.quests[questId]?.status ?? "notStarted",
    ]),
  );
  const questSave = reconcileAdventureProgression(recoverySafeSave);
  const questReconciled = Object.entries(priorQuestStatuses).some(([questId, status]) => (
    (questSave.progression.quests[questId]?.status ?? "notStarted") !== status
  ));
  const chapterRewardResume = reconcileCompletedChapterRewards(questSave);
  const rewardResume = reconcileCompletedEncounterRewards(chapterRewardResume.save);
  // A submersible save is meaningful only while its scripted survey or
  // recovery leg is active. Let that domain recover terminal or impossible
  // expedition phases to Mission Control before applying generic scene and
  // collision recovery. Valid active legs remain byte-for-byte resumable.
  const expeditionResume = recoverTrenchlightExpeditionResume(rewardResume.save);
  const save = expeditionResume.save;
  const scene = SCENES[save.world.sceneId];
  const sceneContent = getAdventureScene(save.world.sceneId);

  if (!scene) {
    return finalize(recoverToSafeDockOrStart(save, "unknown-scene"));
  }

  const route = scene.routeId ? getAdventureRoute(scene.routeId) : null;
  if (scene.routeId && (
    !route
    || !save.world.unlockedRouteIds.includes(route.id)
    || ![route.fromTownId, route.toTownId].includes(save.world.townId)
  )) {
    return finalize(recoverToSafeDockOrStart(save, "invalid-route-state"));
  }
  if (route) {
    const originSide = save.world.townId === route.fromTownId
      ? "from"
      : save.world.townId === route.toTownId
        ? "to"
        : null;
    const expectedOriginDockId = originSide === "from" ? route.fromDockId : route.toDockId;
    const completed = save.world.completedRouteIds.includes(route.id);
    if (
      !originSide
      || save.world.lastSafeDockId !== expectedOriginDockId
      || (!completed && originSide !== "from")
    ) {
      const fallbackDockId = !completed ? route.fromDockId : expectedOriginDockId;
      return finalize(recoverToSafeDockOrStart({
        ...save,
        world: { ...save.world, lastSafeDockId: fallbackDockId },
      }, "invalid-route-origin"));
    }
  }

  if (!scene.routeId && (!sceneContent || sceneContent.townId !== save.world.townId)) {
    return finalize(recoverToSafeDockOrStart(save, "scene-town-mismatch"));
  }

  if (!canOccupyScenePosition(scene.id, save.world.position)) {
    if (canOccupyScenePosition(scene.id, scene.spawn)) {
      return finalize({
        save: withWorld(save, scene.id, scene.spawn, save.world.facing),
        recovered: true,
        reason: "unsafe-position",
        fallback: "scene-spawn",
      });
    }
    return finalize(recoverToSafeDockOrStart(save, "unsafe-position"));
  }

  return finalize({
    save,
    recovered: questReconciled
      || chapterRewardResume.recovered
      || rewardResume.recovered
      || expeditionResume.recovered,
    reason: questReconciled
      ? "quest-state-reconciled"
      : chapterRewardResume.recovered
        ? "chapter-reward-reconciled"
        : rewardResume.recovered
          ? "encounter-reward-reconciled"
          : expeditionResume.reason,
    fallback: null,
  });
}

export function moveAdventureSession(saveValue, { sceneId, position, facing }) {
  const save = normalizeAdventureSave(saveValue);
  const scene = SCENES[sceneId];
  const sceneContent = getAdventureScene(sceneId);
  if (!scene) throw new RangeError(`Unknown adventure scene: ${sceneId}`);
  if (!canOccupyScenePosition(sceneId, position)) {
    throw new RangeError(`Adventure position is not safe in scene ${sceneId}.`);
  }
  return normalizeAdventureSave(withWorld(save, sceneId, position, facing, {
    townId: scene.routeId ? save.world.townId : (sceneContent?.townId ?? save.world.townId),
  }));
}

export function enterAdventureScene(saveValue, { sceneId, position, facing }) {
  let save = moveAdventureSession(saveValue, { sceneId, position, facing });
  const visitFlag = SCENE_VISIT_FLAGS[sceneId];
  if (visitFlag) save = setQuestFlag(save, SHELLSHORE_QUEST_ID, visitFlag, true);
  save = beginEcosystemChapterAtCurrentScene(save).save;
  return beginChampionsWakeQuestAtCurrentScene(save).save;
}

export function isAdventureEncounterAvailable(saveValue, encounterId) {
  const save = reconcileAdventureProgression(saveValue);
  const encounter = getAdventureEncounter(encounterId);
  if (!encounter) return { available: false, reason: "Unknown encounter." };
  if (encounter.role === "tournament") {
    if (save.progression.tournament.status === "complete") {
      const postgameUnlocked = save.progression.quests[CHAMPIONS_WAKE_QUEST_ID]
        ?.flags?.["postgame-unlocked"] === true;
      if (!postgameUnlocked) {
        return {
          available: false,
          reason: "Complete the Championship Ceremony and reflection before opening practice rematches.",
        };
      }
      return {
        available: true,
        reason: null,
        practiceOnly: true,
      };
    }
    const tournamentRound = getChampionsWakeTournamentRoundAvailability(save, encounterId);
    if (!tournamentRound.available) {
      const reason = tournamentRound.reason === "registration-required"
        ? "Register a legal deck for the tournament before entering this round."
        : tournamentRound.reason === "round-not-active"
          ? "Complete the current tournament round first."
          : tournamentRound.reason === "invalid-locked-deck"
            ? "The registered deck snapshot could not be verified. Register again."
            : "The active Champion's Wake tournament quest is required.";
      return { available: false, reason };
    }
  }
  const quest = encounter.questId
    ? save.progression.quests[encounter.questId] ?? { status: "notStarted", flags: {} }
    : null;
  if (quest?.status === "notStarted") {
    return { available: false, reason: "Begin this town's investigation first." };
  }
  for (const prerequisite of encounter.prerequisites ?? []) {
    if (prerequisite.type === "questStatus") {
      const status = save.progression.quests[prerequisite.questId]?.status ?? "notStarted";
      if (status !== prerequisite.status) {
        return { available: false, reason: "Finish the town fieldwork before this challenge." };
      }
      const chapter = getAdventureEcosystemChapterByQuestId(prerequisite.questId);
      if (
        chapter
        && prerequisite.status === "complete"
        && chapter.getProgress(save).complete !== true
      ) {
        return {
          available: false,
          reason: "The saved fieldwork is incomplete or inconsistent. Return to the town scientist.",
        };
      }
    }
    if (prerequisite.type === "encounterComplete"
      && !save.progression.completedEncounterIds.includes(prerequisite.encounterId)) {
      return { available: false, reason: "Win the required earlier challenge first." };
    }
  }
  return { available: true, reason: null };
}

export function completeAdventureEncounter(
  saveValue,
  { encounterId, opponentId = null, chapterEncounterIds = [] },
) {
  let save = reconcileAdventureProgression(saveValue);
  const encounter = getAdventureEncounter(encounterId);
  if (!encounter) throw new RangeError(`Unknown adventure encounter: ${encounterId}.`);
  const firstVictory = !save.progression.completedEncounterIds.includes(encounterId);
  if (firstVictory) {
    save = {
      ...save,
      progression: {
        ...save.progression,
        completedEncounterIds: [
          ...save.progression.completedEncounterIds,
          encounterId,
        ],
      },
    };
  }

  if (opponentId) {
    save = setQuestFlag(
      save,
      encounter.questId ?? SHELLSHORE_QUEST_ID,
      `defeated-${opponentId}`,
      true,
    );
  }

  const requiredEncounterIds = chapterEncounterIds.length
    ? chapterEncounterIds
    : ADVENTURE_CONTENT.encounters
      .filter((candidate) => candidate.questId === encounter.questId && candidate.role === "resident")
      .map((candidate) => candidate.id);
  const chapterComplete = requiredEncounterIds.length > 0
    && requiredEncounterIds.every((id) => save.progression.completedEncounterIds.includes(id));
  if (chapterComplete && !isAdventureEcosystemChapterQuest(encounter.questId)) {
    const quest = save.progression.quests[encounter.questId];
    if (quest?.status === "active") save = transitionQuest(save, encounter.questId, "readyToTurnIn");
  }

  // Encounter rewards are authored in content and the reward ledger is the
  // source of truth for first-win delivery. Calling this on every confirmed
  // victory also repairs an older save that recorded the win before its reward
  // existed; duplicate callbacks and later rematches remain no-ops.
  const reward = encounter?.rewardId
    ? ADVENTURE_CONTENT.rewards.find((item) => item.id === encounter.rewardId)
    : null;
  if (reward) save = grantReward(save, reward).save;

  return reconcileAdventureProgression(save);
}

/**
 * Persists the canonical, serializable evidence for a completed duel attempt.
 * The latest attempt may change on a rematch, while firstVictory remains the
 * immutable deck/result provenance for the encounter's one-time clear.
 */
export function recordAdventureDuelResult(saveValue, resultValue) {
  const save = normalizeAdventureSave(saveValue);
  if (!resultValue || typeof resultValue !== "object" || Array.isArray(resultValue)) {
    throw new TypeError("Adventure duel result must be an object.");
  }

  const encounterId = String(resultValue.encounterId ?? "").trim();
  const summary = {
    outcome: resultValue.outcome,
    completionReason: resultValue.completionReason,
    playerDeckId: resultValue.playerDeckId,
    playerDeckFingerprint: resultValue.playerDeckFingerprint,
    opponentId: resultValue.opponent?.id,
    playerVp: resultValue.scores?.playerVp,
    opponentVp: resultValue.scores?.opponentVp,
    targetVp: resultValue.scores?.targetVp,
    round: resultValue.round,
    turn: resultValue.turn,
  };
  const previous = save.progression.encounterResults[encounterId] ?? null;
  const firstVictory = previous?.firstVictory
    ?? (summary.outcome === "victory" ? summary : null);
  const nextSave = normalizeAdventureSave({
    ...save,
    progression: {
      ...save.progression,
      encounterResults: {
        ...save.progression.encounterResults,
        [encounterId]: {
          attempts: (previous?.attempts ?? 0) + 1,
          latest: summary,
          firstVictory,
        },
      },
    },
  });

  return {
    save: nextSave,
    encounterId,
    attempts: nextSave.progression.encounterResults[encounterId].attempts,
    firstVictory: !previous?.firstVictory && summary.outcome === "victory",
  };
}

export function getCompletedEncounterIds(saveValue) {
  return new Set(normalizeAdventureSave(saveValue).progression.completedEncounterIds);
}
