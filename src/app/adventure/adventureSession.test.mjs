import assert from "node:assert/strict";
import test from "node:test";
import { createInitialAdventureSave } from "./adventureProgression.mjs";
import {
  SHELLSHORE_QUEST_ID,
  completeAdventureEncounter,
  createNewAdventureSession,
  enterAdventureScene,
  moveAdventureSession,
  recoverAdventureResume,
} from "./adventureSession.mjs";

test("new sessions begin the Shellshore quest in one of three explicit profiles", () => {
  const save = createNewAdventureSession("profile-2");
  assert.equal(save.profileId, "profile-2");
  assert.equal(save.progression.quests[SHELLSHORE_QUEST_ID].status, "active");
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
