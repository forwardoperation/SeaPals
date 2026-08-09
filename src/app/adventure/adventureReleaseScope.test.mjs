import assert from "node:assert/strict";
import test from "node:test";
import {
  createNewAdventureSession,
  recoverElversonAdventureResume,
} from "./adventureSession.mjs";
import {
  ELVERSON_RELEASE_SCOPE,
  isElversonReleaseLocation,
  isElversonReleaseScene,
  relocateResumeToElversonStart,
} from "./adventureReleaseScope.mjs";
import {
  SCENES,
  START_STATE,
  canOccupyContinuousPosition,
} from "./adventureWorld.mjs";
import {
  ELVERSON_TOWN_LAYOUT_VERSION,
  ELVERSON_TOWN_LAYOUT_VERSION_LEGACY,
  ELVERSON_TOWN_LAYOUT_VERSION_WIDE_SEAWALL,
  ELVERSON_TOWN_SAFE_POSITIONS,
  ELVERSON_TOWN_SAFE_PROMENADE_Y,
} from "./adventureElversonTownLayout.mjs";

test("Elverson release scope retains persisted IDs and exposes no active routes", () => {
  assert.deepEqual(ELVERSON_RELEASE_SCOPE, {
    townId: "shellshore-village",
    startSceneId: "town",
    startDockId: "shellshore-dock",
    sceneIds: [
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
    ],
    routeIds: [],
  });
  assert.equal(Object.isFrozen(ELVERSON_RELEASE_SCOPE), true);
  assert.equal(Object.isFrozen(ELVERSON_RELEASE_SCOPE.sceneIds), true);
  assert.equal(Object.isFrozen(ELVERSON_RELEASE_SCOPE.routeIds), true);

  for (const sceneId of ELVERSON_RELEASE_SCOPE.sceneIds) {
    assert.equal(isElversonReleaseScene(sceneId), true);
  }
  assert.equal(isElversonReleaseScene("sunpatch-cay-town"), false);
  assert.equal(isElversonReleaseScene(null), false);
  assert.equal(isElversonReleaseLocation({
    townId: ELVERSON_RELEASE_SCOPE.townId,
    sceneId: "town",
    lastSafeDockId: ELVERSON_RELEASE_SCOPE.startDockId,
  }), true);
  assert.equal(isElversonReleaseLocation({
    townId: "sunpatch-cay",
    sceneId: "town",
    lastSafeDockId: "sunpatch-dock",
  }), false);
});

function withLegacySkippedOpening(save) {
  return {
    ...save,
    opening: {
      ...save.opening,
      status: "legacySkipped",
      completedBeatIds: [],
    },
  };
}

test("pure release relocation changes only location fields and is idempotent", () => {
  const inventory = { storyItems: { keepsake: 2 } };
  const progression = { quests: { "quest-side-story": { status: "active" } } };
  const unlockedRouteIds = ["route-shellshore-sunpatch"];
  const source = {
    profileId: "release-relocation",
    playtimeSeconds: 321,
    inventory,
    progression,
    world: {
      townId: "sunpatch-cay",
      sceneId: "sunpatch-cay-town",
      position: { x: 8, y: 8 },
      facing: "left",
      lastSafeDockId: "sunpatch-dock",
      unlockedRouteIds,
      completedRouteIds: ["route-shellshore-sunpatch"],
    },
  };
  const start = {
    sceneId: "town",
    position: ELVERSON_TOWN_SAFE_POSITIONS.shellshoreDock,
    facing: "up",
  };

  const relocated = relocateResumeToElversonStart(source, start);
  assert.equal(relocated.relocated, true);
  assert.notEqual(relocated.save, source);
  assert.notEqual(relocated.save.world, source.world);
  assert.equal(relocated.save.inventory, inventory);
  assert.equal(relocated.save.progression, progression);
  assert.equal(relocated.save.world.unlockedRouteIds, unlockedRouteIds);
  assert.deepEqual(relocated.save.world, {
    ...source.world,
    layoutVersion: ELVERSON_TOWN_LAYOUT_VERSION,
    townId: "shellshore-village",
    sceneId: "town",
    position: ELVERSON_TOWN_SAFE_POSITIONS.shellshoreDock,
    facing: "up",
    lastSafeDockId: "shellshore-dock",
  });

  const stable = relocateResumeToElversonStart(relocated.save, start);
  assert.equal(stable.relocated, false);
  assert.equal(stable.save, relocated.save);
});

test("resume recovery relocates archived-world saves without rewriting their progress", () => {
  const initial = withLegacySkippedOpening(createNewAdventureSession("release-resume"));
  const archived = JSON.parse(JSON.stringify({
    ...initial,
    playtimeSeconds: 777,
    inventory: {
      ...initial.inventory,
      storyItems: {
        ...initial.inventory.storyItems,
        "archived-world-keepsake": 3,
      },
    },
    world: {
      ...initial.world,
      townId: "sunpatch-cay",
      sceneId: "sunpatch-cay-town",
      position: { x: 7, y: 8 },
      facing: "left",
      lastSafeDockId: "sunpatch-dock",
      unlockedRouteIds: ["route-shellshore-sunpatch"],
      completedRouteIds: ["route-shellshore-sunpatch"],
    },
    progression: {
      ...initial.progression,
      quests: {
        ...initial.progression.quests,
        "quest-archived-side-story": {
          status: "active",
          flags: { checkpoint: "keep" },
        },
      },
    },
  }));

  const recovered = recoverElversonAdventureResume(archived);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.reason, "outside-active-release");
  assert.equal(recovered.fallback, "elverson-start");
  assert.deepEqual(recovered.save.world, {
    ...archived.world,
    townId: ELVERSON_RELEASE_SCOPE.townId,
    sceneId: START_STATE.sceneId,
    position: { ...START_STATE.position },
    facing: START_STATE.facing,
    lastSafeDockId: ELVERSON_RELEASE_SCOPE.startDockId,
  });
  assert.equal(recovered.save.playtimeSeconds, 777);
  assert.equal(recovered.save.inventory.storyItems["archived-world-keepsake"], 3);
  assert.deepEqual(
    recovered.save.progression.quests["quest-archived-side-story"],
    { status: "active", flags: { checkpoint: "keep" } },
  );

  const stable = recoverElversonAdventureResume(JSON.parse(JSON.stringify(recovered.save)));
  assert.equal(stable.recovered, false);
  assert.equal(stable.reason, null);
  assert.equal(stable.fallback, null);
  assert.deepEqual(stable.save, recovered.save);
});

test("release recovery cannot follow stale or mismatched saves to an archived safe dock", () => {
  const initial = withLegacySkippedOpening(createNewAdventureSession("release-stale-dock"));
  for (const worldPatch of [
    {
      townId: "sunpatch-cay",
      sceneId: "town",
      position: { x: 14, y: 10 },
      lastSafeDockId: "sunpatch-dock",
    },
    {
      townId: "sunpatch-cay",
      sceneId: "retired-scene",
      position: { x: 7, y: 8 },
      lastSafeDockId: "sunpatch-dock",
    },
    {
      townId: ELVERSON_RELEASE_SCOPE.townId,
      sceneId: "academy-lab",
      position: { x: 6, y: 7 },
      lastSafeDockId: "sunpatch-dock",
    },
  ]) {
    const recovered = recoverElversonAdventureResume({
      ...initial,
      world: { ...initial.world, ...worldPatch },
    });
    assert.equal(recovered.recovered, true);
    assert.equal(recovered.reason, "outside-active-release");
    assert.equal(recovered.fallback, "elverson-start");
    assert.equal(recovered.save.world.townId, ELVERSON_RELEASE_SCOPE.townId);
    assert.equal(recovered.save.world.sceneId, START_STATE.sceneId);
    assert.deepEqual(recovered.save.world.position, START_STATE.position);
    assert.equal(recovered.save.world.lastSafeDockId, ELVERSON_RELEASE_SCOPE.startDockId);
  }
});

test("release recovery moves a blocked legacy Elverson position to a safe spawn without losing progress", () => {
  const initial = withLegacySkippedOpening(createNewAdventureSession("release-blocked-elverson-resume"));
  // Old flat-map builds could persist the player beyond the end of the public
  // pier. The layered map must recover that now-water position safely.
  const legacyPosition = { x: 5, y: 20 };
  assert.equal(canOccupyContinuousPosition("town", legacyPosition), false);

  const legacy = JSON.parse(JSON.stringify({
    ...initial,
    playtimeSeconds: 912,
    inventory: {
      ...initial.inventory,
      storyItems: {
        ...initial.inventory.storyItems,
        "elverson-keepsake": 4,
      },
    },
    world: {
      ...initial.world,
      townId: ELVERSON_RELEASE_SCOPE.townId,
      sceneId: "town",
      position: legacyPosition,
      facing: "right",
      lastSafeDockId: ELVERSON_RELEASE_SCOPE.startDockId,
    },
    progression: {
      ...initial.progression,
      quests: {
        ...initial.progression.quests,
        "quest-elverson-side-story": {
          status: "active",
          flags: { checkpoint: "preserve" },
        },
      },
    },
  }));

  const recovered = recoverElversonAdventureResume(legacy);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.reason, "unsafe-position");
  assert.equal(recovered.fallback, "scene-spawn");
  assert.equal(recovered.save.world.sceneId, "town");
  assert.deepEqual(recovered.save.world.position, SCENES.town.spawn);
  assert.equal(
    canOccupyContinuousPosition("town", recovered.save.world.position),
    true,
  );
  assert.equal(recovered.save.world.facing, "right");
  assert.equal(recovered.save.playtimeSeconds, 912);
  assert.deepEqual(recovered.save.inventory, legacy.inventory);
  assert.deepEqual(recovered.save.progression, legacy.progression);

  const stable = recoverElversonAdventureResume(JSON.parse(JSON.stringify(recovered.save)));
  assert.equal(stable.recovered, false);
  assert.equal(stable.reason, null);
  assert.equal(stable.fallback, null);
  assert.deepEqual(stable.save, recovered.save);
});

test("release recovery migrates the retired aquarium exit onto the new aquarium platform", () => {
  const initial = withLegacySkippedOpening(createNewAdventureSession("release-aquarium-exit-resume"));
  const legacyExit = { x: 16, y: 17 };
  assert.equal(canOccupyContinuousPosition("town", legacyExit), false);

  const stranded = {
    ...initial,
    playtimeSeconds: 321,
    world: {
      ...initial.world,
      layoutVersion: ELVERSON_TOWN_LAYOUT_VERSION_LEGACY,
      townId: ELVERSON_RELEASE_SCOPE.townId,
      sceneId: "town",
      position: legacyExit,
      facing: "down",
      lastSafeDockId: ELVERSON_RELEASE_SCOPE.startDockId,
    },
  };

  const recovered = recoverElversonAdventureResume(stranded);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.reason, "elverson-layout-aquarium-exterior");
  assert.equal(recovered.layoutMigrationReason, "aquarium-exterior");
  assert.deepEqual(recovered.save.world.position, ELVERSON_TOWN_SAFE_POSITIONS.aquariumExterior);
  assert.equal(recovered.save.world.layoutVersion, ELVERSON_TOWN_LAYOUT_VERSION);
  assert.equal(canOccupyContinuousPosition("town", recovered.save.world.position), true);
  assert.equal(recovered.save.world.facing, "down");
  assert.equal(recovered.save.playtimeSeconds, 321);

  const stable = recoverElversonAdventureResume(JSON.parse(JSON.stringify(recovered.save)));
  assert.equal(stable.recovered, false);
  assert.equal(stable.reason, null);
  assert.equal(stable.fallback, null);
  assert.deepEqual(stable.save, recovered.save);
});

test("release recovery moves an epoch-2 retired seawall save onto the promenade", () => {
  const initial = withLegacySkippedOpening(createNewAdventureSession("release-seawall-resume"));
  const retiredSeawallPosition = { x: 15, y: 17.15 };
  assert.equal(canOccupyContinuousPosition("town", retiredSeawallPosition), false);

  const stranded = {
    ...initial,
    playtimeSeconds: 654,
    inventory: {
      ...initial.inventory,
      storyItems: { "elverson-keepsake": 2 },
    },
    world: {
      ...initial.world,
      layoutVersion: ELVERSON_TOWN_LAYOUT_VERSION_WIDE_SEAWALL,
      townId: ELVERSON_RELEASE_SCOPE.townId,
      sceneId: "town",
      position: retiredSeawallPosition,
      facing: "left",
      lastSafeDockId: ELVERSON_RELEASE_SCOPE.startDockId,
    },
  };

  const recovered = recoverElversonAdventureResume(stranded);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.reason, "elverson-layout-seawall-promenade");
  assert.equal(recovered.layoutMigrationReason, "seawall-promenade");
  assert.equal(recovered.fallback, null);
  assert.equal(recovered.save.world.layoutVersion, ELVERSON_TOWN_LAYOUT_VERSION);
  assert.deepEqual(recovered.save.world.position, {
    x: retiredSeawallPosition.x,
    y: ELVERSON_TOWN_SAFE_PROMENADE_Y,
  });
  assert.equal(canOccupyContinuousPosition("town", recovered.save.world.position), true);
  assert.equal(recovered.save.world.facing, "left");
  assert.equal(recovered.save.playtimeSeconds, 654);
  assert.deepEqual(recovered.save.inventory, stranded.inventory);

  const stable = recoverElversonAdventureResume(JSON.parse(JSON.stringify(recovered.save)));
  assert.equal(stable.recovered, false);
  assert.equal(stable.reason, null);
  assert.equal(stable.fallback, null);
  assert.deepEqual(stable.save, recovered.save);
});
