import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialAdventureSave,
  normalizeAdventureSave,
} from "./adventureProgression.mjs";
import {
  SCENES,
  canOccupyContinuousPosition,
} from "./adventureWorld.mjs";
import {
  SHELLSHORE_QUEST_ID,
  completeAdventureEncounter,
  createNewAdventureSession,
  enterAdventureScene,
  moveAdventureSession,
  recordAdventureDuelResult,
  recoverAdventureResume,
} from "./adventureSession.mjs";

test("new sessions begin the Shellshore quest in one of three explicit profiles", () => {
  const save = createNewAdventureSession("profile-2");
  assert.equal(save.profileId, "profile-2");
  assert.equal(save.progression.quests[SHELLSHORE_QUEST_ID].status, "active");
  assert.equal(save.world.sceneId, "academy-lab");
  assert.deepEqual(save.world.position, { x: 6, y: 7 });
  assert.equal(save.world.facing, "up");
});

test("scene transitions persist a safe position and a meaningful quest flag", () => {
  const initial = createNewAdventureSession("profile-1");
  const entered = enterAdventureScene(initial, {
    sceneId: "coral-home",
    position: { x: 5, y: 6 },
    facing: "up",
  });

  assert.equal(entered.world.sceneId, "coral-home");
  assert.deepEqual(entered.world.position, { x: 5, y: 6 });
  assert.equal(
    entered.progression.quests[SHELLSHORE_QUEST_ID].flags["visited-coral-home"],
    true,
  );
});

test("unsafe writes are rejected and unsafe loaded positions recover to the scene spawn", () => {
  const initial = createNewAdventureSession("profile-1");
  assert.throws(
    () => moveAdventureSession(initial, {
      sceneId: "coral-home",
      position: { x: 0, y: 0 },
      facing: "down",
    }),
    /not safe/,
  );

  const unsafe = {
    ...initial,
    world: {
      ...initial.world,
      sceneId: "deep-home",
      position: { x: 0, y: 0 },
    },
  };
  const recovered = recoverAdventureResume(unsafe);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.reason, "unsafe-position");
  assert.equal(recovered.fallback, "scene-spawn");
  assert.deepEqual(recovered.save.world.position, { x: 5, y: 6 });
});

test("resume recovery rejects positions inside authored interior furniture", () => {
  const initial = createNewAdventureSession("profile-1");
  const academy = SCENES["academy-lab"];
  const furniture = academy.collisionRects.find(
    (rectangle) => rectangle.id === "academy-left-aquarium-workstation",
  );
  const furniturePosition = { x: 4, y: 5 };

  assert.ok(furniture, "academy furniture collision rectangle should be authored");
  assert.equal(academy.tiles[furniturePosition.y][furniturePosition.x], "r");
  assert.equal(canOccupyContinuousPosition(academy.id, furniturePosition), false);

  const recovered = recoverAdventureResume({
    ...initial,
    world: {
      ...initial.world,
      sceneId: academy.id,
      position: furniturePosition,
    },
  });

  assert.equal(recovered.recovered, true);
  assert.equal(recovered.reason, "unsafe-position");
  assert.equal(recovered.fallback, "scene-spawn");
  assert.deepEqual(recovered.save.world.position, academy.spawn);
});

test("all live portals use safe spawns and preserve their authored arrival facing", () => {
  const initial = createNewAdventureSession("profile-1");
  let portalCount = 0;

  for (const sourceScene of Object.values(SCENES)) {
    for (const portal of sourceScene.interactions) {
      if (portal.type !== "enter" && portal.type !== "exit") continue;
      portalCount += 1;

      const targetScene = SCENES[portal.targetScene];
      assert.ok(
        targetScene,
        `${sourceScene.id}/${portal.id} should target a live scene`,
      );
      assert.equal(
        canOccupyContinuousPosition(portal.targetScene, portal.spawn),
        true,
        `${sourceScene.id}/${portal.id} should use a safe target spawn`,
      );
      assert.equal(
        portal.facing,
        portal.type === "enter" ? "up" : "down",
        `${sourceScene.id}/${portal.id} should face into its destination`,
      );

      const entered = enterAdventureScene(initial, {
        sceneId: portal.targetScene,
        position: portal.spawn,
        facing: portal.facing,
      });
      assert.equal(entered.world.sceneId, portal.targetScene);
      assert.deepEqual(entered.world.position, portal.spawn);
      assert.equal(entered.world.facing, portal.facing);
    }
  }

  assert.equal(portalCount, 12, "all Shellshore and Sunpatch entrances and exits should be covered");
});

test("stale scene IDs recover to the authored adventure start", () => {
  const initial = createInitialAdventureSave("profile-3");
  const recovered = recoverAdventureResume({
    ...initial,
    world: { ...initial.world, sceneId: "retired-prototype-map" },
  });

  assert.equal(recovered.recovered, true);
  assert.equal(recovered.reason, "unknown-scene");
  assert.equal(recovered.fallback, "safe-dock");
  assert.equal(recovered.save.world.sceneId, "town");
  assert.deepEqual(recovered.save.world.position, { x: 7, y: 8 });
});

test("cross-town scenes use the last safe dock and stale docks use the global start", () => {
  const initial = createInitialAdventureSave("profile-3");
  const mismatch = recoverAdventureResume({
    ...initial,
    world: {
      ...initial.world,
      townId: "sunpatch-cay",
      sceneId: "coral-home",
      position: { x: 5, y: 6 },
    },
  });
  assert.equal(mismatch.reason, "scene-town-mismatch");
  assert.equal(mismatch.fallback, "safe-dock");
  assert.equal(mismatch.save.world.townId, "shellshore-village");

  const global = recoverAdventureResume({
    ...initial,
    world: {
      ...initial.world,
      sceneId: "missing-scene",
      lastSafeDockId: "retired-dock",
    },
  });
  assert.equal(global.fallback, "adventure-start");
  assert.equal(global.save.world.lastSafeDockId, "shellshore-dock");
  assert.equal(global.save.world.sceneId, "town");
});

test("an impossible reverse first voyage recovers to the authored Shellshore origin", () => {
  const initial = createInitialAdventureSave("profile-3");
  initial.world = {
    ...initial.world,
    townId: "sunpatch-cay",
    sceneId: "shellshore-sunpatch-sea",
    position: { x: 14, y: 5 },
    facing: "left",
    lastSafeDockId: "sunpatch-dock",
    unlockedRouteIds: ["route-shellshore-sunpatch"],
    completedRouteIds: [],
  };
  initial.progression.quests[SHELLSHORE_QUEST_ID] = {
    status: "complete",
    flags: { "boat-safety-reviewed": true },
  };

  const recovered = recoverAdventureResume(initial);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.reason, "invalid-route-origin");
  assert.equal(recovered.fallback, "safe-dock");
  assert.equal(recovered.save.world.townId, "shellshore-village");
  assert.equal(recovered.save.world.sceneId, "town");
  assert.equal(recovered.save.world.lastSafeDockId, "shellshore-dock");
  assert.deepEqual(recovered.save.world.position, { x: 7, y: 8 });
});

test("resume reconciles legacy encounter progress with the Shellshore quest", () => {
  const oneWin = createInitialAdventureSave("profile-1");
  oneWin.progression.completedEncounterIds = ["encounter-shellshore-marina"];
  const active = recoverAdventureResume(oneWin);
  assert.equal(active.recovered, true);
  assert.equal(active.reason, "quest-state-reconciled");
  assert.equal(active.save.progression.quests[SHELLSHORE_QUEST_ID].status, "active");

  const bothWins = createInitialAdventureSave("profile-2");
  bothWins.progression.completedEncounterIds = [
    "encounter-shellshore-marina",
    "encounter-shellshore-dorian",
  ];
  const ready = recoverAdventureResume(bothWins);
  assert.equal(ready.recovered, true);
  assert.equal(ready.save.progression.quests[SHELLSHORE_QUEST_ID].status, "readyToTurnIn");
});

test("completing an encounter repairs a missing Shellshore quest before advancing it", () => {
  const legacy = createInitialAdventureSave("profile-3");
  legacy.progression.completedEncounterIds = ["encounter-shellshore-marina"];
  const completed = completeAdventureEncounter(legacy, {
    encounterId: "encounter-shellshore-dorian",
    opponentId: "dorian",
    chapterEncounterIds: [
      "encounter-shellshore-marina",
      "encounter-shellshore-dorian",
    ],
  });

  assert.equal(
    completed.progression.quests[SHELLSHORE_QUEST_ID].status,
    "readyToTurnIn",
  );
});

test("Marina's first victory grants one discovery pack exactly once across callbacks, reloads, and rematches", () => {
  const encounterIds = ["encounter-shellshore-marina", "encounter-shellshore-dorian"];
  const marinaVictory = {
    encounterId: "encounter-shellshore-marina",
    opponentId: "marina",
    chapterEncounterIds: encounterIds,
  };
  let save = createNewAdventureSession("profile-1");

  save = completeAdventureEncounter(save, marinaVictory);
  assert.equal(
    save.inventory.unopenedPacks["pack-pool-shellshore-discovery"],
    1,
  );
  assert.deepEqual(save.rewardLedger, ["reward-shellshore-marina-first-win"]);

  // A duplicate victory callback must not replay the encounter reward.
  save = completeAdventureEncounter(save, marinaVictory);
  assert.equal(
    save.inventory.unopenedPacks["pack-pool-shellshore-discovery"],
    1,
  );
  assert.deepEqual(save.rewardLedger, ["reward-shellshore-marina-first-win"]);

  // Persisting and normalizing the save preserves the ledger guard for a rematch.
  save = normalizeAdventureSave(JSON.parse(JSON.stringify(save)));
  save = completeAdventureEncounter(save, marinaVictory);
  assert.equal(
    save.inventory.unopenedPacks["pack-pool-shellshore-discovery"],
    1,
  );
  assert.deepEqual(save.rewardLedger, ["reward-shellshore-marina-first-win"]);
});

test("resume repairs a pre-collection save with Marina already defeated", () => {
  const legacy = createNewAdventureSession("profile-3");
  legacy.progression.completedEncounterIds = ["encounter-shellshore-marina"];

  const recovery = recoverAdventureResume(legacy);
  const repaired = recovery.save;

  assert.equal(recovery.recovered, true);
  assert.equal(recovery.reason, "encounter-reward-reconciled");
  assert.equal(repaired.inventory.unopenedPacks["pack-pool-shellshore-discovery"], 1);
  assert.deepEqual(repaired.rewardLedger, ["reward-shellshore-marina-first-win"]);

  const secondRecovery = recoverAdventureResume(repaired);
  assert.equal(secondRecovery.recovered, false);
  assert.equal(secondRecovery.save.inventory.unopenedPacks["pack-pool-shellshore-discovery"], 1);
});

test("Dorian's victory does not grant a booster pack", () => {
  const save = completeAdventureEncounter(createNewAdventureSession("profile-2"), {
    encounterId: "encounter-shellshore-dorian",
    opponentId: "dorian",
    chapterEncounterIds: [
      "encounter-shellshore-marina",
      "encounter-shellshore-dorian",
    ],
  });

  assert.deepEqual(save.inventory.unopenedPacks, {});
  assert.deepEqual(save.rewardLedger, []);
});

test("encounter wins are idempotent and advance the basic quest only after both trainers", () => {
  const encounterIds = ["encounter-shellshore-marina", "encounter-shellshore-dorian"];
  let save = createNewAdventureSession("profile-1");
  save = completeAdventureEncounter(save, {
    encounterId: encounterIds[0],
    opponentId: "marina",
    chapterEncounterIds: encounterIds,
  });
  save = completeAdventureEncounter(save, {
    encounterId: encounterIds[0],
    opponentId: "marina",
    chapterEncounterIds: encounterIds,
  });
  assert.deepEqual(save.progression.completedEncounterIds, [encounterIds[0]]);
  assert.equal(save.progression.quests[SHELLSHORE_QUEST_ID].status, "active");

  save = completeAdventureEncounter(save, {
    encounterId: encounterIds[1],
    opponentId: "dorian",
    chapterEncounterIds: encounterIds,
  });
  assert.deepEqual(save.progression.completedEncounterIds, encounterIds);
  assert.equal(save.progression.quests[SHELLSHORE_QUEST_ID].status, "readyToTurnIn");
});

test("duel attempts persist latest and immutable first-win deck provenance", () => {
  const encounterId = "encounter-shellshore-marina";
  const baseResult = {
    encounterId,
    outcome: "defeat",
    completionReason: "vp-target",
    playerDeckId: "harbor-custom",
    playerDeckFingerprint: "deck-v1-0123456789abcdef",
    opponent: { id: "marina" },
    scores: { playerVp: 5, opponentVp: 10, targetVp: 10 },
    round: 3,
    turn: 6,
  };
  let save = createNewAdventureSession("profile-1");

  const defeat = recordAdventureDuelResult(save, baseResult);
  save = defeat.save;
  assert.equal(defeat.firstVictory, false);
  assert.equal(save.progression.encounterResults[encounterId].attempts, 1);
  assert.equal(save.progression.encounterResults[encounterId].firstVictory, null);

  const victoryResult = {
    ...baseResult,
    outcome: "victory",
    scores: { playerVp: 11, opponentVp: 7, targetVp: 10 },
    round: 5,
    turn: 9,
  };
  const victory = recordAdventureDuelResult(save, victoryResult);
  save = normalizeAdventureSave(JSON.parse(JSON.stringify(victory.save)));
  assert.equal(victory.firstVictory, true);
  assert.equal(save.progression.encounterResults[encounterId].attempts, 2);
  assert.deepEqual(
    save.progression.encounterResults[encounterId].firstVictory,
    save.progression.encounterResults[encounterId].latest,
  );

  const rematch = recordAdventureDuelResult(save, {
    ...victoryResult,
    playerDeckId: "later-deck",
    playerDeckFingerprint: "deck-v1-fedcba9876543210",
    scores: { playerVp: 10, opponentVp: 2, targetVp: 10 },
  });
  const record = rematch.save.progression.encounterResults[encounterId];
  assert.equal(rematch.firstVictory, false);
  assert.equal(record.attempts, 3);
  assert.equal(record.latest.playerDeckId, "later-deck");
  assert.equal(record.firstVictory.playerDeckId, "harbor-custom");
  assert.equal(record.firstVictory.playerDeckFingerprint, "deck-v1-0123456789abcdef");
});
