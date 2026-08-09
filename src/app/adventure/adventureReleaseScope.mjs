/**
 * The currently playable vertical slice. Persisted IDs intentionally retain
 * their original names so older saves can be opened without a schema migration.
 * Authored scenes outside this set remain in the content archive, but are not
 * valid resume locations for the Elverson release.
 */
export const ELVERSON_RELEASE_SCOPE = Object.freeze({
  townId: "shellshore-village",
  startSceneId: "town",
  startDockId: "shellshore-dock",
  sceneIds: Object.freeze([
    "town",
    "player-bedroom",
    "player-home",
    "academy-lab",
    "aquarium-reef-gallery",
    "aquarium-oceanic-gallery",
    "aquarium-deep-gallery",
    "coral-home",
    "deep-home",
    "elverson-oceanic-home",
    "elverson-hybrid-home",
    "elverson-supply-company",
    "elverson-red-schoolhouse",
    "elverson-marine-research-lab",
  ]),
  routeIds: Object.freeze([]),
});

const ELVERSON_RELEASE_SCENE_IDS = new Set(ELVERSON_RELEASE_SCOPE.sceneIds);

export function isElversonReleaseScene(sceneId) {
  return typeof sceneId === "string" && ELVERSON_RELEASE_SCENE_IDS.has(sceneId);
}

export function isElversonReleaseLocation(world) {
  return Boolean(
    world
    && typeof world === "object"
    && !Array.isArray(world)
    && world.townId === ELVERSON_RELEASE_SCOPE.townId
    && isElversonReleaseScene(world.sceneId)
    && world.lastSafeDockId === ELVERSON_RELEASE_SCOPE.startDockId,
  );
}

function copyPosition(position) {
  return { x: position.x, y: position.y };
}

/**
 * Relocates a save whose scene is outside the active release while preserving
 * every non-location field. The caller supplies the authored start coordinates
 * so map revisions do not duplicate geometry in this release-policy module.
 */
export function relocateResumeToElversonStart(saveValue, startLocation) {
  if (!saveValue || typeof saveValue !== "object" || Array.isArray(saveValue)) {
    throw new TypeError("Adventure resume relocation requires a save object.");
  }
  if (!saveValue.world || typeof saveValue.world !== "object" || Array.isArray(saveValue.world)) {
    throw new TypeError("Adventure resume relocation requires world state.");
  }
  if (isElversonReleaseLocation(saveValue.world)) {
    return { save: saveValue, relocated: false };
  }
  if (
    !startLocation
    || startLocation.sceneId !== ELVERSON_RELEASE_SCOPE.startSceneId
    || !Number.isFinite(startLocation.position?.x)
    || !Number.isFinite(startLocation.position?.y)
    || typeof startLocation.facing !== "string"
  ) {
    throw new TypeError("Elverson resume relocation requires its authored town start.");
  }

  return {
    save: {
      ...saveValue,
      world: {
        ...saveValue.world,
        layoutVersion: ELVERSON_TOWN_LAYOUT_VERSION,
        townId: ELVERSON_RELEASE_SCOPE.townId,
        sceneId: ELVERSON_RELEASE_SCOPE.startSceneId,
        position: copyPosition(startLocation.position),
        facing: startLocation.facing,
        lastSafeDockId: ELVERSON_RELEASE_SCOPE.startDockId,
      },
    },
    relocated: true,
  };
}
import { ELVERSON_TOWN_LAYOUT_VERSION } from "./adventureElversonTownLayout.mjs";
