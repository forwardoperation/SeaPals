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

test("Elverson release scope retains persisted IDs and exposes no active routes", () => {
  assert.deepEqual(ELVERSON_RELEASE_SCOPE, {
    townId: "shellshore-village",
    startSceneId: "town",
    startDockId: "shellshore-dock",
    sceneIds: ["town", "academy-lab", "coral-home", "deep-home"],
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
    position: { x: 14, y: 17 },
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
    townId: "shellshore-village",
    sceneId: "town",
    position: { x: 14, y: 17 },
    facing: "up",
    lastSafeDockId: "shellshore-dock",
  });

  const stable = relocateResumeToElversonStart(relocated.save, start);
  assert.equal(stable.relocated, false);
  assert.equal(stable.save, relocated.save);
});

test("resume recovery relocates archived-world saves without rewriting their progress", () => {
  const initial = createNewAdventureSession("release-resume");
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
  const initial = createNewAdventureSession("release-stale-dock");
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
  const initial = createNewAdventureSession("release-blocked-elverson-resume");
  const legacyPosition = { x: 7, y: 8 };
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
