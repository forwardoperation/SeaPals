import {
  createInitialAdventureSave,
  normalizeAdventureSave,
  setQuestFlag,
  transitionQuest,
} from "./adventureProgression.mjs";
import {
  SCENES,
  START_STATE,
  canOccupyContinuousPosition,
} from "./adventureWorld.mjs";
import {
  ADVENTURE_CONTENT,
  getAdventureDock,
  getAdventureScene,
  getAdventureStartLocation,
} from "./adventureContent.mjs";

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
  }
  return save;
}

function recoverToSafeDockOrStart(save, reason) {
  const dock = getAdventureDock(save.world.lastSafeDockId);
  if (
    dock?.status === "prototype"
    && SCENES[dock.sceneId]
    && canOccupyContinuousPosition(dock.sceneId, dock.position)
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
  if (!academy || !canOccupyContinuousPosition(academy.id, academy.spawn)) return save;
  return withWorld(save, academy.id, academy.spawn, "up");
}

/**
 * Converts a loaded save into a world state that the current scene renderer can
 * safely resume. Schema-valid but stale scene IDs fall back to the academy
 * start; blocked positions fall back to that scene's authored spawn.
 */
export function recoverAdventureResume(saveValue) {
  const normalized = normalizeAdventureSave(saveValue);
  const priorQuestStatus = normalized.progression.quests[SHELLSHORE_QUEST_ID]?.status ?? "notStarted";
  const save = reconcileShellshoreQuest(normalized);
  const questReconciled = save.progression.quests[SHELLSHORE_QUEST_ID]?.status !== priorQuestStatus;
  const scene = SCENES[save.world.sceneId];
  const sceneContent = getAdventureScene(save.world.sceneId);

  if (!scene) {
    return recoverToSafeDockOrStart(save, "unknown-scene");
  }

  if (!sceneContent || sceneContent.townId !== save.world.townId) {
    return recoverToSafeDockOrStart(save, "scene-town-mismatch");
  }

  if (!canOccupyContinuousPosition(scene.id, save.world.position)) {
    if (canOccupyContinuousPosition(scene.id, scene.spawn)) {
      return {
        save: withWorld(save, scene.id, scene.spawn, save.world.facing),
        recovered: true,
        reason: "unsafe-position",
        fallback: "scene-spawn",
      };
    }
    return recoverToSafeDockOrStart(save, "unsafe-position");
  }

  return {
    save,
    recovered: questReconciled,
    reason: questReconciled ? "quest-state-reconciled" : null,
    fallback: null,
  };
}

export function moveAdventureSession(saveValue, { sceneId, position, facing }) {
  const save = normalizeAdventureSave(saveValue);
  const scene = SCENES[sceneId];
  const sceneContent = getAdventureScene(sceneId);
  if (!scene) throw new RangeError(`Unknown adventure scene: ${sceneId}`);
  if (!canOccupyContinuousPosition(sceneId, position)) {
    throw new RangeError(`Adventure position is not safe in scene ${sceneId}.`);
  }
  return normalizeAdventureSave(withWorld(save, sceneId, position, facing, {
    townId: sceneContent?.townId ?? save.world.townId,
  }));
}

export function enterAdventureScene(saveValue, { sceneId, position, facing }) {
  let save = moveAdventureSession(saveValue, { sceneId, position, facing });
  const visitFlag = SCENE_VISIT_FLAGS[sceneId];
  if (visitFlag) save = setQuestFlag(save, SHELLSHORE_QUEST_ID, visitFlag, true);
  return save;
}

export function completeAdventureEncounter(
  saveValue,
  { encounterId, opponentId = null, chapterEncounterIds = [] },
) {
  let save = reconcileShellshoreQuest(saveValue);
  if (!save.progression.completedEncounterIds.includes(encounterId)) {
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
      SHELLSHORE_QUEST_ID,
      `defeated-${opponentId}`,
      true,
    );
  }

  const quest = save.progression.quests[SHELLSHORE_QUEST_ID];
  const chapterComplete = chapterEncounterIds.length > 0
    && chapterEncounterIds.every((id) => save.progression.completedEncounterIds.includes(id));
  if (chapterComplete && quest?.status === "active") {
    save = transitionQuest(save, SHELLSHORE_QUEST_ID, "readyToTurnIn");
  }

  return save;
}

export function getCompletedEncounterIds(saveValue) {
  return new Set(normalizeAdventureSave(saveValue).progression.completedEncounterIds);
}
