import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVENTURE_CONTENT,
  ADVENTURE_STARTER_DECK_IDS,
  REQUIRED_DIALOGUE_BEATS,
  REQUIRED_ECOSYSTEM_NPC_ROLES,
  REQUIRED_TUTORIAL_ACTION_TYPES,
  REQUIRED_TUTORIAL_CHECKPOINT_IDS,
  getAdventureDock,
  getAdventureFieldNote,
  getAdventureRoute,
  getAdventureStartLocation,
  getAdventureStarterDeck,
  getRuntimeAdventureScenes,
  resolveAdventureInteraction,
  resolveAdventureNpc,
  resolveAdventureTutorial,
} from "./adventureContent.mjs";
import { assertValidAdventureContent, validateAdventureContent } from "./adventureContentValidation.mjs";
import { createInitialAdventureSave, grantReward, validateAdventureSave } from "./adventureProgression.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const ELVERSON_REQUESTED_RESIDENT_NAMES = Object.freeze([
  "Fisherman Wyeth",
  "Teacher Caroline",
  "Ivy",
  "Rosie",
  "George",
  "Henry",
  "Explorer Jordan",
  "Sam",
  "Marine Biologist Jonah",
  "Finn",
  "Jack",
  "Oliver",
  "Eloise",
  "Edith",
  "Ellis",
  "Luke",
  "Micah",
  "Karah",
  "Calvin",
  "Landon",
  "Henderson",
  "Charlotte",
  "Eli",
  "William",
  "Emilio",
  "Programmer Harlan",
]);

test("launch adventure content is internally valid and JSON serializable", () => {
  assert.equal(validateAdventureContent(ADVENTURE_CONTENT).valid, true);
  assert.doesNotThrow(() => assertValidAdventureContent(ADVENTURE_CONTENT));
  assert.deepEqual(JSON.parse(JSON.stringify(ADVENTURE_CONTENT)), ADVENTURE_CONTENT);
});

test("all seven settlements are islands or floating towns reached through the route plan", () => {
  assert.equal(ADVENTURE_CONTENT.towns.length, 7);
  assert.ok(ADVENTURE_CONTENT.towns.every((town) => ["island", "floating"].includes(town.settlementType)));
  assert.ok(ADVENTURE_CONTENT.towns.every((town) => town.dockId));
  assert.equal(ADVENTURE_CONTENT.routes.length, 6);
  assert.ok(ADVENTURE_CONTENT.routes.every((route) => route.manualPilotRequiredFirstTime && route.autoSteerAfterFirstCompletion));
});

test("five ecosystem chapters include the complete learning and NPC planning contract", () => {
  const ecosystemTowns = ADVENTURE_CONTENT.towns.filter((town) => town.chapterType === "ecosystem");
  assert.equal(ecosystemTowns.length, 5);
  for (const town of ecosystemTowns) {
    assert.ok(REQUIRED_ECOSYSTEM_NPC_ROLES.every((roleId) => town.plannedNpcRoleIds.includes(roleId)));
    assert.equal(town.encounterPlan.resident, 2);
    assert.equal(town.encounterPlan.qualifier, 1);
    const encounters = town.encounterIds.map((encounterId) => (
      ADVENTURE_CONTENT.encounters.find((encounter) => encounter.id === encounterId)
    ));
    assert.equal(encounters.filter((encounter) => encounter?.role === "resident").length, 2);
    const qualifier = encounters.find((encounter) => encounter?.role === "qualifier");
    assert.ok(qualifier);
    assert.ok(qualifier.prerequisites.some((prerequisite) => (
      prerequisite.type === "questStatus"
      && prerequisite.questId === qualifier.questId
      && prerequisite.status === "complete"
    )));
    const quest = ADVENTURE_CONTENT.quests.find((candidate) => candidate.townId === town.id);
    assert.ok(quest.learning.evidence.length >= 2);
    for (const field of ["concept", "misconception", "decision", "consequence", "debrief", "callback"]) {
      assert.ok(quest.learning[field]);
    }
  }
});

test("dialogue plans follow the complete learning sequence", () => {
  for (const dialogue of ADVENTURE_CONTENT.dialogues) {
    assert.deepEqual(dialogue.beats.map((beat) => beat.id), REQUIRED_DIALOGUE_BEATS);
  }
});

test("each route unlock requires completion of the prior town's quest", () => {
  for (const route of ADVENTURE_CONTENT.routes) {
    const priorTown = ADVENTURE_CONTENT.towns.find((town) => town.id === route.fromTownId);
    const destination = ADVENTURE_CONTENT.towns.find((town) => town.id === route.toTownId);
    const unlockRule = ADVENTURE_CONTENT.unlockRules.find((rule) => rule.id === destination.unlockRuleId);
    assert.ok(priorTown.questIds.every((questId) => unlockRule.questIds.includes(questId)));
  }
});

test("Champion's Wake contains exactly three 30 VP tournament rounds", () => {
  const tournamentEncounters = ADVENTURE_CONTENT.encounters.filter((encounter) => encounter.role === "tournament");
  assert.equal(tournamentEncounters.length, 3);
  assert.ok(tournamentEncounters.every((encounter) => encounter.victoryTarget === 30));
});

test("content rewards satisfy the progression grant contract and are idempotent", () => {
  let save = createInitialAdventureSave("profile-content-test");
  for (const reward of ADVENTURE_CONTENT.rewards) {
    const first = grantReward(save, reward);
    assert.equal(first.applied, true);
    const repeated = grantReward(first.save, reward);
    assert.equal(repeated.applied, false);
    assert.deepEqual(repeated.save, first.save);
    save = first.save;
  }
  assert.equal(validateAdventureSave(save).valid, true);
});

test("the initial save location references launch content", () => {
  const save = createInitialAdventureSave("profile-content-test");
  assert.ok(ADVENTURE_CONTENT.towns.some((town) => town.id === save.world.townId));
  assert.ok(ADVENTURE_CONTENT.scenes.some((scene) => scene.id === save.world.sceneId && scene.townId === save.world.townId));
});

test("Elverson launches from its authored town while dormant later-world scenes remain valid content", () => {
  const runtimeScenes = getRuntimeAdventureScenes();
  assert.deepEqual(runtimeScenes.map((scene) => scene.id), [
    "town",
    "coral-home",
    "deep-home",
    "academy-lab",
    "shellshore-sunpatch-sea",
    "sunpatch-cay-town",
    "sunpatch-field-station",
    "sunpatch-garden-home",
    "sunpatch-tide-hall",
    "sunpatch-brackwater-sea",
    "brackwater-landing-town",
    "brackwater-water-lab",
    "brackwater-mangrove-home",
    "brackwater-tide-hall",
    "brackwater-current-sea",
    "current-commons-town",
    "current-navigation-lab",
    "current-navigator-home",
    "current-tide-hall",
    "current-kelpwatch-sea",
    "kelpwatch-island-town",
    "kelpwatch-ecology-lab",
    "kelpwatch-diver-home",
    "kelpwatch-tide-hall",
    "kelpwatch-trenchlight-sea",
    "trenchlight-station-town",
    "trenchlight-mission-control",
    "trenchlight-engineer-workshop",
    "trenchlight-tide-hall",
    "trenchlight-sub-descent",
    "trenchlight-champions-wake-sea",
    "champions-wake-town",
    "champions-wake-registration-hall",
    "champions-wake-arena",
    "champions-wake-reflection-pavilion",
  ]);
  assert.ok(runtimeScenes.every((scene) => scene.world.tiles.length > 0));
  assert.deepEqual(getAdventureStartLocation(), {
    townId: "shellshore-village",
    dockId: "shellshore-dock",
    sceneId: "town",
    position: { x: 14, y: 10 },
    facing: "down",
  });
  assert.deepEqual(getAdventureDock("shellshore-dock"), {
    id: "shellshore-dock",
    townId: "shellshore-village",
    sceneId: "town",
    status: "prototype",
    position: { x: 14, y: 10 },
    facing: "down",
  });
});

test("the dormant first outbound route remains valid without an active Elverson boarding interaction", () => {
  const route = getAdventureRoute("route-shellshore-sunpatch");
  const routeScene = getRuntimeAdventureScenes().find((scene) => scene.id === route.sceneId);

  assert.deepEqual(route, {
    id: "route-shellshore-sunpatch",
    fromTownId: "shellshore-village",
    toTownId: "sunpatch-cay",
    sceneId: "shellshore-sunpatch-sea",
    fromDockId: "shellshore-dock",
    toDockId: "sunpatch-dock",
    fromSpawn: { x: 1, y: 5, facing: "right" },
    toSpawn: { x: 14, y: 5, facing: "left" },
    manualPilotRequiredFirstTime: true,
    autoSteerAfterFirstCompletion: true,
  });
  assert.equal(routeScene.kind, "route");
  assert.equal(routeScene.world.worldKind, "route");
  assert.equal(routeScene.world.theme, "shellshore-sunpatch-route");
  assert.deepEqual(routeScene.world.movement, {
    mode: "boat",
    speed: 3.2,
    radius: 0.28,
    maxStepDistance: 0.08,
  });
  assert.equal(routeScene.world.tiles.length, 10);
  assert.ok(routeScene.world.tiles.every((row) => row.length === 16));
  assert.deepEqual(
    [...new Set(routeScene.world.tiles.join(""))].sort(),
    ["H", "b", "k", "o"],
  );
  assert.deepEqual(routeScene.world.interactions, [
    {
      id: "interaction-route-dock-shellshore",
      type: "dock",
      endpoint: "from",
      at: { x: 0, y: 5 },
      routeId: route.id,
      dockId: "shellshore-dock",
      targetScene: "town",
      spawn: { x: 14, y: 10 },
      facing: "down",
    },
    {
      id: "interaction-route-dock-sunpatch",
      type: "dock",
      endpoint: "to",
      at: { x: 15, y: 5 },
      routeId: route.id,
      dockId: "sunpatch-dock",
      targetScene: "sunpatch-cay-town",
      spawn: { x: 7, y: 8 },
      facing: "up",
    },
  ]);

  const sunpatchBoard = resolveAdventureInteraction("sunpatch-cay-town", "interaction-sunpatch-board-shellshore-route");
  assert.equal(resolveAdventureInteraction("town", "interaction-shellshore-board-boat"), null);
  assert.deepEqual(
    (({ targetSceneContent, ...interaction }) => interaction)(sunpatchBoard),
    {
      id: "interaction-sunpatch-board-shellshore-route",
      type: "board",
      at: { x: 7, y: 9 },
      routeId: route.id,
      dockId: "sunpatch-dock",
      targetScene: route.sceneId,
      spawn: { x: 14, y: 5 },
      facing: "left",
    },
  );
  assert.ok(sunpatchBoard.targetSceneContent === routeScene);
});

test("the Sunpatch-Brackwater route uses a separate Sunpatch dock and an exact live boat lane", () => {
  const route = getAdventureRoute("route-sunpatch-brackwater");
  const routeScene = getRuntimeAdventureScenes().find((scene) => scene.id === route.sceneId);

  assert.deepEqual(route, {
    id: "route-sunpatch-brackwater",
    fromTownId: "sunpatch-cay",
    toTownId: "brackwater-landing",
    sceneId: "sunpatch-brackwater-sea",
    fromDockId: "sunpatch-brackwater-dock",
    toDockId: "brackwater-dock",
    fromSpawn: { x: 1, y: 5, facing: "right" },
    toSpawn: { x: 14, y: 5, facing: "left" },
    manualPilotRequiredFirstTime: true,
    autoSteerAfterFirstCompletion: true,
  });
  assert.equal(routeScene.world.theme, "sunpatch-brackwater-route");
  assert.equal(routeScene.world.artPath, "/images/adventure/sunpatch-brackwater-route.png");
  assert.equal(routeScene.world.tiles.length, 10);
  assert.ok(routeScene.world.tiles.every((row) => row.length === 16));
  assert.deepEqual(routeScene.world.spawn, { x: 1, y: 5 });
  assert.deepEqual(
    routeScene.world.interactions.map(({ id, endpoint, at, dockId, targetScene, spawn, facing }) => ({ id, endpoint, at, dockId, targetScene, spawn, facing })),
    [
      {
        id: "interaction-route-dock-sunpatch-brackwater",
        endpoint: "from",
        at: { x: 0, y: 5 },
        dockId: "sunpatch-brackwater-dock",
        targetScene: "sunpatch-cay-town",
        spawn: { x: 8, y: 8 },
        facing: "up",
      },
      {
        id: "interaction-route-dock-brackwater",
        endpoint: "to",
        at: { x: 15, y: 5 },
        dockId: "brackwater-dock",
        targetScene: "brackwater-landing-town",
        spawn: { x: 7, y: 8 },
        facing: "up",
      },
    ],
  );

  assert.deepEqual(getAdventureDock("sunpatch-brackwater-dock"), {
    id: "sunpatch-brackwater-dock",
    townId: "sunpatch-cay",
    sceneId: "sunpatch-cay-town",
    status: "prototype",
    position: { x: 8, y: 8 },
    facing: "up",
  });
  assert.notEqual(route.fromDockId, getAdventureDock("sunpatch-dock").id);
  assert.equal(
    resolveAdventureInteraction("sunpatch-cay-town", "interaction-sunpatch-board-brackwater-route").targetSceneContent.id,
    route.sceneId,
  );
  assert.equal(
    resolveAdventureInteraction("brackwater-landing-town", "interaction-brackwater-board-sunpatch-route").targetSceneContent.id,
    route.sceneId,
  );
});

test("the Brackwater-Current route uses a separate Brackwater dock and an exact live boat lane", () => {
  const route = getAdventureRoute("route-brackwater-current");
  const routeScene = getRuntimeAdventureScenes().find((scene) => scene.id === route.sceneId);

  assert.deepEqual(route, {
    id: "route-brackwater-current",
    fromTownId: "brackwater-landing",
    toTownId: "current-commons",
    sceneId: "brackwater-current-sea",
    fromDockId: "brackwater-current-dock",
    toDockId: "current-commons-dock",
    fromSpawn: { x: 1, y: 5, facing: "right" },
    toSpawn: { x: 14, y: 5, facing: "left" },
    manualPilotRequiredFirstTime: true,
    autoSteerAfterFirstCompletion: true,
  });
  assert.equal(routeScene.world.theme, "brackwater-current-route");
  assert.equal(routeScene.world.artPath, "/images/adventure/brackwater-current-route.png");
  assert.equal(routeScene.world.tiles.length, 10);
  assert.ok(routeScene.world.tiles.every((row) => row.length === 16));
  assert.deepEqual(routeScene.world.tiles, [
    "kkkkkkkkkkkkkkkk",
    "kkkokokooobooook",
    "kkkobooooooooook",
    "kkooooooobooookk",
    "kkooooooooooookk",
    "HooooooooooooooH",
    "kkokooooooooookk",
    "kkoooboooooobook",
    "kkkokookooooookk",
    "kkkkkkkkkkkkkkkk",
  ]);
  assert.deepEqual([...new Set(routeScene.world.tiles.join(""))].sort(), ["H", "b", "k", "o"]);
  assert.deepEqual(routeScene.world.spawn, { x: 1, y: 5 });
  assert.deepEqual(
    routeScene.world.interactions.map(({ id, endpoint, at, dockId, targetScene, spawn, facing }) => ({ id, endpoint, at, dockId, targetScene, spawn, facing })),
    [
      {
        id: "interaction-route-dock-brackwater-current",
        endpoint: "from",
        at: { x: 0, y: 5 },
        dockId: "brackwater-current-dock",
        targetScene: "brackwater-landing-town",
        spawn: { x: 8, y: 8 },
        facing: "up",
      },
      {
        id: "interaction-route-dock-current-commons",
        endpoint: "to",
        at: { x: 15, y: 5 },
        dockId: "current-commons-dock",
        targetScene: "current-commons-town",
        spawn: { x: 7, y: 8 },
        facing: "up",
      },
    ],
  );

  assert.deepEqual(getAdventureDock("brackwater-current-dock"), {
    id: "brackwater-current-dock",
    townId: "brackwater-landing",
    sceneId: "brackwater-landing-town",
    status: "prototype",
    position: { x: 8, y: 8 },
    facing: "up",
  });
  assert.notEqual(route.fromDockId, getAdventureDock("brackwater-dock").id);
  assert.equal(
    resolveAdventureInteraction("brackwater-landing-town", "interaction-brackwater-board-current-route").targetSceneContent.id,
    route.sceneId,
  );
  assert.equal(
    resolveAdventureInteraction("current-commons-town", "interaction-current-board-brackwater-route").targetSceneContent.id,
    route.sceneId,
  );
});

test("Sunpatch Cay exposes its dock, three interiors, and four reef observation stations", () => {
  const scenes = getRuntimeAdventureScenes();
  const town = scenes.find((scene) => scene.id === "sunpatch-cay-town");
  const interiorIds = ["sunpatch-field-station", "sunpatch-garden-home", "sunpatch-tide-hall"];

  assert.equal(town.world.tiles.length, 10);
  assert.ok(town.world.tiles.every((row) => row.length === 16));
  assert.deepEqual(getAdventureDock("sunpatch-dock"), {
    id: "sunpatch-dock",
    townId: "sunpatch-cay",
    sceneId: "sunpatch-cay-town",
    status: "prototype",
    position: { x: 7, y: 8 },
    facing: "up",
  });
  assert.deepEqual(
    town.world.interactions
      .filter((interaction) => interaction.type === "enter")
      .map(({ id, at, targetScene, spawn, facing }) => ({ id, at, targetScene, spawn, facing })),
    [
      { id: "interaction-sunpatch-enter-garden-home", at: { x: 3, y: 2 }, targetScene: "sunpatch-garden-home", spawn: { x: 5, y: 6 }, facing: "up" },
      { id: "interaction-sunpatch-enter-field-station", at: { x: 8, y: 2 }, targetScene: "sunpatch-field-station", spawn: { x: 5, y: 6 }, facing: "up" },
      { id: "interaction-sunpatch-enter-tide-hall", at: { x: 13, y: 2 }, targetScene: "sunpatch-tide-hall", spawn: { x: 5, y: 6 }, facing: "up" },
    ],
  );
  assert.deepEqual(
    town.world.interactions
      .filter((interaction) => interaction.type === "observation")
      .map(({ id, at, observationId }) => ({ id, at, observationId })),
    [
      { id: "interaction-sunpatch-observe-healthy", at: { x: 3, y: 4 }, observationId: "healthy-comparison" },
      { id: "interaction-sunpatch-observe-bleached", at: { x: 12, y: 4 }, observationId: "bleached-tissue" },
      { id: "interaction-sunpatch-observe-lesion", at: { x: 3, y: 7 }, observationId: "described-lesion" },
      { id: "interaction-sunpatch-observe-algae", at: { x: 12, y: 7 }, observationId: "algae-covered-skeleton" },
    ],
  );

  for (const sceneId of interiorIds) {
    const scene = scenes.find((candidate) => candidate.id === sceneId);
    assert.equal(scene.world.tiles.length, 8);
    assert.ok(scene.world.tiles.every((row) => row.length === 12));
    const exit = scene.world.interactions.find((interaction) => interaction.type === "exit");
    assert.equal(exit.targetScene, town.id);
    assert.equal(exit.facing, "down");
  }

  const fieldStation = scenes.find((scene) => scene.id === "sunpatch-field-station");
  assert.deepEqual(
    fieldStation.world.interactions
      .filter((interaction) => ["interpretation", "response"].includes(interaction.type))
      .map(({ id, type, at, choiceSetId }) => ({ id, type, at, choiceSetId })),
    [
      { id: "interaction-sunpatch-interpret-evidence", type: "interpretation", at: { x: 3, y: 2 }, choiceSetId: "sunpatch-reef-interpretation" },
      { id: "interaction-sunpatch-choose-response", type: "response", at: { x: 8, y: 2 }, choiceSetId: "sunpatch-reef-response" },
    ],
  );
});

test("five Sunpatch NPCs provide role-specific conversations and correctly scoped duels", () => {
  const npcs = ADVENTURE_CONTENT.npcs.filter((npc) => npc.townId === "sunpatch-cay");
  assert.deepEqual(npcs.map((npc) => npc.id), [
    "sunpatch-tavi",
    "sunpatch-mira",
    "sunpatch-gardener",
    "sunpatch-surveyor",
    "sunpatch-leader",
  ]);
  assert.deepEqual(npcs.map((npc) => npc.roleId), REQUIRED_ECOSYSTEM_NPC_ROLES);

  for (const npc of npcs) {
    const resolved = resolveAdventureNpc(npc.id);
    assert.ok(resolved.conversation.lines.intro.length >= 2);
    assert.match(resolved.conversation.lines.intro[0], /welcome|hello|thank you/i);
    assert.ok(resolved.conversation.lines.return.length >= 1);
  }
  assert.equal(resolveAdventureNpc("sunpatch-tavi").encounter, null);
  assert.equal(resolveAdventureNpc("sunpatch-mira").encounter, null);
  assert.match(
    resolveAdventureNpc("sunpatch-mira").conversation.lines.debrief.join(" "),
    /bleaching.*living tissue.*lesion.*algae-covered skeleton/i,
  );
  assert.match(
    resolveAdventureNpc("sunpatch-surveyor").conversation.lines.victory.join(" "),
    /no-anchor.*does not remove the warming threat/i,
  );

  const encounter = (id) => ADVENTURE_CONTENT.encounters.find((candidate) => candidate.id === id);
  assert.deepEqual(
    ["opponentDeckId", "difficulty", "victoryTarget"].map((field) => encounter("encounter-sunpatch-resident-surveyor")[field]),
    ["stinging-fortress", "easy-medium", 10],
  );
  assert.deepEqual(
    ["opponentDeckId", "difficulty", "victoryTarget"].map((field) => encounter("encounter-sunpatch-qualifier")[field]),
    ["coral-garden", "medium", 10],
  );
  assert.deepEqual(encounter("encounter-sunpatch-exhibition"), {
    id: "encounter-sunpatch-exhibition",
    townId: "sunpatch-cay",
    questId: "quest-sunpatch-reef-response",
    role: "exhibition",
    opponentId: "sunpatch-leader",
    opponentDeckId: "coral-garden",
    victoryTarget: 30,
    difficulty: "medium",
    rewardId: null,
    prerequisites: [{ type: "encounterComplete", encounterId: "encounter-sunpatch-qualifier" }],
  });
});

test("Brackwater Landing exposes a floating town, three interiors, and four exact water stations", () => {
  const runtimeScenes = getRuntimeAdventureScenes();
  const town = runtimeScenes.find((scene) => scene.id === "brackwater-landing-town");
  const expectedArt = new Map([
    ["brackwater-landing-town", "/images/adventure/brackwater-landing.png"],
    ["brackwater-water-lab", "/images/adventure/brackwater-water-lab.png"],
    ["brackwater-mangrove-home", "/images/adventure/brackwater-mangrove-home.png"],
    ["brackwater-tide-hall", "/images/adventure/brackwater-tide-hall.png"],
  ]);

  assert.equal(town.world.tiles.length, 10);
  assert.ok(town.world.tiles.every((row) => row.length === 16));
  assert.deepEqual(getAdventureDock("brackwater-dock"), {
    id: "brackwater-dock",
    townId: "brackwater-landing",
    sceneId: "brackwater-landing-town",
    status: "prototype",
    position: { x: 7, y: 8 },
    facing: "up",
  });
  assert.deepEqual(
    town.world.interactions
      .filter((interaction) => interaction.type === "enter")
      .map(({ at, targetScene }) => ({ at, targetScene })),
    [
      { at: { x: 3, y: 2 }, targetScene: "brackwater-mangrove-home" },
      { at: { x: 8, y: 2 }, targetScene: "brackwater-water-lab" },
      { at: { x: 13, y: 2 }, targetScene: "brackwater-tide-hall" },
    ],
  );
  assert.deepEqual(
    town.world.interactions
      .filter((interaction) => interaction.type === "observation")
      .map(({ at, observationId }) => ({ at, observationId })),
    [
      { at: { x: 3, y: 4 }, observationId: "incoming-tide-channel" },
      { at: { x: 12, y: 4 }, observationId: "rain-fed-creek-mouth" },
      { at: { x: 3, y: 7 }, observationId: "mangrove-low-tide" },
      { at: { x: 12, y: 7 }, observationId: "repeat-runoff-low-oxygen" },
    ],
  );

  for (const [sceneId, artPath] of expectedArt) {
    const scene = runtimeScenes.find((candidate) => candidate.id === sceneId);
    assert.equal(scene.world.artPath, artPath);
    if (sceneId === town.id) continue;
    assert.equal(scene.world.tiles.length, 8);
    assert.ok(scene.world.tiles.every((row) => row.length === 12));
    const exit = scene.world.interactions.find((interaction) => interaction.type === "exit");
    assert.equal(exit.targetScene, town.id);
    assert.equal(exit.facing, "down");
  }

  const lab = runtimeScenes.find((scene) => scene.id === "brackwater-water-lab");
  assert.deepEqual(
    lab.world.interactions
      .filter((interaction) => ["interpretation", "response"].includes(interaction.type))
      .map(({ type, at, choiceSetId }) => ({ type, at, choiceSetId })),
    [
      { type: "interpretation", at: { x: 3, y: 2 }, choiceSetId: "brackwater-water-interpretation" },
      { type: "response", at: { x: 8, y: 2 }, choiceSetId: "brackwater-runoff-response" },
    ],
  );
});

test("Current Commons exposes a floating flotilla, three interiors, and four exact current-and-gear stations", () => {
  const runtimeScenes = getRuntimeAdventureScenes();
  const town = runtimeScenes.find((scene) => scene.id === "current-commons-town");
  const expectedArt = new Map([
    ["current-commons-town", "/images/adventure/current-commons.png"],
    ["current-navigation-lab", "/images/adventure/current-navigation-lab.png"],
    ["current-navigator-home", "/images/adventure/current-navigator-home.png"],
    ["current-tide-hall", "/images/adventure/current-tide-hall.png"],
  ]);

  assert.equal(town.world.tiles.length, 10);
  assert.ok(town.world.tiles.every((row) => row.length === 16));
  assert.deepEqual(getAdventureDock("current-commons-dock"), {
    id: "current-commons-dock",
    townId: "current-commons",
    sceneId: "current-commons-town",
    status: "prototype",
    position: { x: 7, y: 8 },
    facing: "up",
  });
  assert.deepEqual(
    town.world.interactions
      .filter((interaction) => interaction.type === "enter")
      .map(({ at, targetScene }) => ({ at, targetScene })),
    [
      { at: { x: 3, y: 2 }, targetScene: "current-navigator-home" },
      { at: { x: 8, y: 2 }, targetScene: "current-navigation-lab" },
      { at: { x: 12, y: 2 }, targetScene: "current-tide-hall" },
    ],
  );
  assert.deepEqual(
    town.world.interactions
      .filter((interaction) => interaction.type === "observation")
      .map(({ at, questId, observationId }) => ({ at, questId, observationId })),
    [
      { at: { x: 4, y: 4 }, questId: "quest-current-ghost-gear", observationId: "source-port-loss-report" },
      { at: { x: 11, y: 4 }, questId: "quest-current-ghost-gear", observationId: "surface-drifter-track" },
      { at: { x: 4, y: 6 }, questId: "quest-current-ghost-gear", observationId: "wildlife-overlap-zone" },
      { at: { x: 11, y: 6 }, questId: "quest-current-ghost-gear", observationId: "downstream-gear-accumulation" },
    ],
  );
  assert.deepEqual(town.world.collisionRects, [
    { id: "current-report-station", left: 3.1, top: 3.55, right: 5.45, bottom: 5.05 },
    { id: "current-drifter-station", left: 9.65, top: 3.55, right: 12.15, bottom: 5.1 },
    { id: "current-wildlife-station", left: 3.25, top: 5.25, right: 5.7, bottom: 6.65 },
    { id: "current-accumulation-station", left: 9.55, top: 5.25, right: 12.15, bottom: 6.85 },
  ]);
  assert.deepEqual(
    town.world.interactions.find(({ id }) => id === "interaction-current-deckhand").at,
    { x: 13, y: 5 },
  );

  for (const [sceneId, artPath] of expectedArt) {
    const scene = runtimeScenes.find((candidate) => candidate.id === sceneId);
    assert.equal(scene.world.artPath, artPath);
    if (sceneId === town.id) continue;
    assert.equal(scene.world.tiles.length, 8);
    assert.ok(scene.world.tiles.every((row) => row.length === 12));
    const exit = scene.world.interactions.find((interaction) => interaction.type === "exit");
    assert.equal(exit.targetScene, town.id);
    assert.equal(exit.facing, "down");
  }

  const lab = runtimeScenes.find((scene) => scene.id === "current-navigation-lab");
  assert.deepEqual(
    lab.world.interactions
      .filter((interaction) => ["interpretation", "response"].includes(interaction.type))
      .map(({ type, at, questId, choiceSetId }) => ({ type, at, questId, choiceSetId })),
    [
      { type: "interpretation", at: { x: 3, y: 2 }, questId: "quest-current-ghost-gear", choiceSetId: "current-connection-interpretation" },
      { type: "response", at: { x: 8, y: 2 }, questId: "quest-current-ghost-gear", choiceSetId: "current-gear-response" },
    ],
  );

  const expectedInteriorCollisions = new Map([
    ["current-navigation-lab", [
      { id: "current-lab-left-console", left: 0.5, top: 1.7, right: 3.18, bottom: 5.45 },
      { id: "current-lab-rear-stage", left: 3.6, top: 1.6, right: 7.4, bottom: 2.72 },
      { id: "current-lab-right-console", left: 7.75, top: 1.7, right: 10.5, bottom: 5.45 },
    ]],
    ["current-navigator-home", [
      { id: "current-home-left-chart-table", left: 0.5, top: 1.5, right: 3.18, bottom: 4 },
      { id: "current-home-upper-right-plant", left: 7.1, top: 2.15, right: 7.72, bottom: 3.1 },
      { id: "current-home-upper-right-gear", left: 8, top: 1.5, right: 10.5, bottom: 3.7 },
      { id: "current-home-lower-left-berth", left: 0.5, top: 3.95, right: 2.2, bottom: 6.05 },
      { id: "current-home-lower-right-crate", left: 9.88, top: 3.85, right: 10.5, bottom: 5.32 },
    ]],
    ["current-tide-hall", [
      { id: "current-hall-left-display", left: 0.5, top: 1.5, right: 3.68, bottom: 2.75 },
      { id: "current-hall-rear-stage", left: 3.92, top: 1.5, right: 7.16, bottom: 2.86 },
      { id: "current-hall-right-display", left: 7.45, top: 1.5, right: 10.5, bottom: 2.75 },
      { id: "current-hall-left-bench", left: 0.5, top: 2.73, right: 1.35, bottom: 4.32 },
      { id: "current-hall-right-bench", left: 9.82, top: 2.73, right: 10.5, bottom: 4.32 },
      { id: "current-hall-lower-left-cabinet", left: 0.5, top: 4.88, right: 2.95, bottom: 6.28 },
      { id: "current-hall-lower-left-planter", left: 2.75, top: 5.86, right: 4.36, bottom: 6.34 },
      { id: "current-hall-lower-right-planter", left: 6.6, top: 5.88, right: 8.35, bottom: 6.34 },
      { id: "current-hall-lower-right-cabinet", left: 8.2, top: 4.88, right: 10.5, bottom: 6.26 },
    ]],
  ]);
  for (const [sceneId, rectangles] of expectedInteriorCollisions) {
    assert.deepEqual(
      runtimeScenes.find((scene) => scene.id === sceneId).world.collisionRects,
      rectangles,
      `${sceneId} collision geometry should remain aligned with its final raster`,
    );
  }
});

test("the Current-Kelpwatch route uses a separate Current dock and an open exact boat corridor", () => {
  const route = getAdventureRoute("route-current-kelpwatch");
  const routeScene = getRuntimeAdventureScenes().find((scene) => scene.id === route.sceneId);

  assert.deepEqual(route, {
    id: "route-current-kelpwatch",
    fromTownId: "current-commons",
    toTownId: "kelpwatch-island",
    sceneId: "current-kelpwatch-sea",
    fromDockId: "current-kelpwatch-dock",
    toDockId: "kelpwatch-dock",
    fromSpawn: { x: 1, y: 5, facing: "right" },
    toSpawn: { x: 14, y: 5, facing: "left" },
    manualPilotRequiredFirstTime: true,
    autoSteerAfterFirstCompletion: true,
  });
  assert.notEqual(route.fromDockId, "current-commons-dock");
  assert.deepEqual(getAdventureDock("current-kelpwatch-dock"), {
    id: "current-kelpwatch-dock",
    townId: "current-commons",
    sceneId: "current-commons-town",
    status: "prototype",
    position: { x: 8, y: 8 },
    facing: "up",
  });
  assert.deepEqual(getAdventureDock("kelpwatch-dock"), {
    id: "kelpwatch-dock",
    townId: "kelpwatch-island",
    sceneId: "kelpwatch-island-town",
    status: "prototype",
    position: { x: 7, y: 8 },
    facing: "up",
  });
  assert.equal(routeScene.world.theme, "current-kelpwatch-route");
  assert.equal(routeScene.world.artPath, "/images/adventure/current-kelpwatch-route.png");
  assert.deepEqual(routeScene.world.movement, {
    mode: "boat",
    speed: 3.2,
    radius: 0.28,
    maxStepDistance: 0.08,
  });
  assert.equal(routeScene.world.tiles.length, 10);
  assert.ok(routeScene.world.tiles.every((row) => row.length === 16));
  assert.equal(routeScene.world.tiles[5], "HooooooooooooooH");
  assert.deepEqual(routeScene.world.spawn, { x: 1, y: 5 });
  assert.deepEqual(
    routeScene.world.interactions.map(({ endpoint, at, dockId, targetScene, spawn, facing }) => ({
      endpoint,
      at,
      dockId,
      targetScene,
      spawn,
      facing,
    })),
    [
      {
        endpoint: "from",
        at: { x: 0, y: 5 },
        dockId: "current-kelpwatch-dock",
        targetScene: "current-commons-town",
        spawn: { x: 8, y: 8 },
        facing: "up",
      },
      {
        endpoint: "to",
        at: { x: 15, y: 5 },
        dockId: "kelpwatch-dock",
        targetScene: "kelpwatch-island-town",
        spawn: { x: 7, y: 8 },
        facing: "up",
      },
    ],
  );
  const board = resolveAdventureInteraction(
    "current-commons-town",
    "interaction-current-board-kelpwatch-route",
  );
  assert.deepEqual(
    (({ id, type, at, routeId, dockId, targetScene, spawn, facing, label }) => ({
      id,
      type,
      at,
      routeId,
      dockId,
      targetScene,
      spawn,
      facing,
      label,
    }))(board),
    {
      id: "interaction-current-board-kelpwatch-route",
      type: "board",
      at: { x: 8, y: 9 },
      routeId: "route-current-kelpwatch",
      dockId: "current-kelpwatch-dock",
      targetScene: "current-kelpwatch-sea",
      spawn: { x: 1, y: 5 },
      facing: "right",
      label: "Pilot to Kelpwatch Island",
    },
  );
  assert.equal(board.targetSceneContent.id, "current-kelpwatch-sea");
});

test("Kelpwatch exposes three buildings, four survey stations, and art-aligned corridors", () => {
  const runtimeScenes = getRuntimeAdventureScenes();
  const town = runtimeScenes.find((scene) => scene.id === "kelpwatch-island-town");
  const expectedArt = new Map([
    ["kelpwatch-island-town", "/images/adventure/kelpwatch-island.png"],
    ["kelpwatch-ecology-lab", "/images/adventure/kelpwatch-ecology-lab.png"],
    ["kelpwatch-diver-home", "/images/adventure/kelpwatch-diver-home.png"],
    ["kelpwatch-tide-hall", "/images/adventure/kelpwatch-tide-hall.png"],
  ]);

  assert.equal(town.world.tiles.length, 10);
  assert.ok(town.world.tiles.every((row) => row.length === 16));
  assert.deepEqual(town.world.spawn, { x: 7, y: 8 });
  assert.deepEqual(
    town.world.interactions
      .filter(({ type }) => type === "enter")
      .map(({ at, targetScene, spawn, facing }) => ({ at, targetScene, spawn, facing })),
    [
      { at: { x: 3, y: 2 }, targetScene: "kelpwatch-diver-home", spawn: { x: 5, y: 6 }, facing: "up" },
      { at: { x: 8, y: 2 }, targetScene: "kelpwatch-ecology-lab", spawn: { x: 5, y: 6 }, facing: "up" },
      { at: { x: 12, y: 2 }, targetScene: "kelpwatch-tide-hall", spawn: { x: 5, y: 6 }, facing: "up" },
    ],
  );
  assert.deepEqual(
    town.world.interactions
      .filter(({ type }) => type === "observation")
      .map(({ at, questId, observationId }) => ({ at, questId, observationId })),
    [
      { at: { x: 4, y: 4 }, questId: "quest-kelpwatch-balance", observationId: "kelp-cover-transect" },
      { at: { x: 10, y: 4 }, questId: "quest-kelpwatch-balance", observationId: "grazer-abundance-count" },
      { at: { x: 4, y: 6 }, questId: "quest-kelpwatch-balance", observationId: "predator-evidence-survey" },
      { at: { x: 10, y: 6 }, questId: "quest-kelpwatch-balance", observationId: "repeat-comparison-site" },
    ],
  );
  assert.deepEqual(town.world.collisionRects, [
    { id: "kelpwatch-canopy-station", left: 3.4, top: 2.8, right: 5.75, bottom: 4.35 },
    { id: "kelpwatch-grazer-station", left: 8.7, top: 2.85, right: 11.35, bottom: 4.4 },
    { id: "kelpwatch-predator-station", left: 3, top: 4.9, right: 5.75, bottom: 6.9 },
    { id: "kelpwatch-repeat-station", left: 9.55, top: 4.95, right: 12.4, bottom: 6.9 },
  ]);

  for (const [sceneId, artPath] of expectedArt) {
    const scene = runtimeScenes.find((candidate) => candidate.id === sceneId);
    assert.equal(scene.world.artPath, artPath);
    if (sceneId === town.id) continue;
    assert.equal(scene.world.tiles.length, 8);
    assert.ok(scene.world.tiles.every((row) => row.length === 12));
    assert.deepEqual(scene.world.spawn, { x: 5, y: 6 });
    const exit = scene.world.interactions.find(({ type }) => type === "exit");
    assert.equal(exit.targetScene, town.id);
    assert.equal(exit.at.x, 5);
    assert.equal(exit.at.y, 7);
    assert.equal(exit.facing, "down");
  }

  const lab = runtimeScenes.find((scene) => scene.id === "kelpwatch-ecology-lab");
  assert.deepEqual(
    lab.world.interactions
      .filter(({ type }) => ["interpretation", "response"].includes(type))
      .map(({ type, at, questId, choiceSetId }) => ({ type, at, questId, choiceSetId })),
    [
      { type: "interpretation", at: { x: 3, y: 4 }, questId: "quest-kelpwatch-balance", choiceSetId: "kelpwatch-food-web-interpretation" },
      { type: "response", at: { x: 8, y: 4 }, questId: "quest-kelpwatch-balance", choiceSetId: "kelpwatch-restoration-response" },
    ],
  );
  assert.deepEqual(lab.world.collisionRects, [
    { id: "kelpwatch-lab-upper-left", left: 0.5, top: 0.9, right: 3.15, bottom: 3.25 },
    { id: "kelpwatch-lab-rear-stage", left: 3.55, top: 1, right: 7.45, bottom: 3.1 },
    { id: "kelpwatch-lab-upper-right", left: 7.75, top: 0.9, right: 10.5, bottom: 3.25 },
    { id: "kelpwatch-lab-lower-left", left: 0.5, top: 3.35, right: 3.25, bottom: 5.35 },
    { id: "kelpwatch-lab-lower-right", left: 7.3, top: 3.3, right: 10.5, bottom: 5.45 },
    { id: "kelpwatch-lab-bottom-left", left: 0.5, top: 5.65, right: 4.15, bottom: 7 },
    { id: "kelpwatch-lab-bottom-right", left: 7, top: 5.65, right: 10.5, bottom: 7 },
  ]);
  assert.deepEqual(
    runtimeScenes
      .find((scene) => scene.id === "kelpwatch-diver-home")
      .world.interactions.find(({ id }) => id === "interaction-kelpwatch-diver").at,
    { x: 5, y: 4 },
  );
});

test("five Kelpwatch NPCs cover every ecosystem role with scoped conversations and duels", () => {
  const npcs = ADVENTURE_CONTENT.npcs.filter((npc) => npc.townId === "kelpwatch-island");
  assert.deepEqual(npcs.map(({ id, name, roleId }) => ({ id, name, roleId })), [
    { id: "kelpwatch-guide", name: "Ari", roleId: "local-guide" },
    { id: "kelpwatch-ecologist", name: "Dr. Mina Park", roleId: "field-partner" },
    { id: "kelpwatch-diver", name: "Niko", roleId: "resident" },
    { id: "kelpwatch-ranger", name: "Rosa", roleId: "town-challenger" },
    { id: "kelpwatch-leader", name: "Tala", roleId: "reflection-character" },
  ]);
  assert.deepEqual(npcs.map((npc) => npc.roleId), REQUIRED_ECOSYSTEM_NPC_ROLES);
  for (const npc of npcs) {
    const resolved = resolveAdventureNpc(npc.id);
    assert.ok(resolved.conversation.lines.intro.length >= 2);
    assert.match(resolved.conversation.lines.intro[0], /welcome|hello|thank you/i);
  }
  assert.equal(resolveAdventureNpc("kelpwatch-guide").encounter, null);
  assert.equal(resolveAdventureNpc("kelpwatch-ecologist").encounter, null);
  assert.equal(resolveAdventureNpc("kelpwatch-diver").encounter.id, "encounter-kelpwatch-resident-diver");
  assert.equal(resolveAdventureNpc("kelpwatch-ranger").encounter.id, "encounter-kelpwatch-resident-ranger");
  assert.equal(resolveAdventureNpc("kelpwatch-leader").encounter.id, "encounter-kelpwatch-qualifier");
});

test("Kelpwatch rewards bind the completed Field Note, permanent pack, Tide Mark, and next route once", () => {
  const fieldNote = getAdventureFieldNote("field-note-kelp-food-web");
  assert.equal(fieldNote.status, "prototype");
  assert.ok(fieldNote.observations.length >= 4);
  assert.ok(fieldNote.checklist.length >= 4);
  assert.ok(fieldNote.sourceUrls.length >= 3);
  assert.ok(fieldNote.sourceUrls.every((sourceUrl) => sourceUrl.startsWith("https://")));

  const fieldwork = ADVENTURE_CONTENT.rewards.find(({ id }) => id === "reward-kelpwatch-fieldwork");
  const qualifier = ADVENTURE_CONTENT.rewards.find(({ id }) => id === "reward-kelpwatch-qualifier");
  assert.deepEqual(fieldwork.fieldNoteIds, ["field-note-kelp-food-web"]);
  assert.deepEqual(qualifier.packs, { "pack-pool-kelpwatch": 1 });
  assert.deepEqual(qualifier.tideMarkIds, ["tide-mark-kelpwatch"]);
  assert.deepEqual(qualifier.routeIds, ["route-kelpwatch-trenchlight"]);

  const first = grantReward(createInitialAdventureSave("kelpwatch-reward"), qualifier);
  const repeated = grantReward(first.save, qualifier);
  assert.equal(first.applied, true);
  assert.equal(repeated.applied, false);
  assert.deepEqual(repeated.save, first.save);
});

test("five Brackwater NPCs cover every ecosystem role with scoped conversations and duels", () => {
  const npcs = ADVENTURE_CONTENT.npcs.filter((npc) => npc.townId === "brackwater-landing");
  assert.deepEqual(npcs.map((npc) => npc.id), [
    "brackwater-rhea",
    "brackwater-scientist",
    "brackwater-naturalist",
    "brackwater-harbormaster",
    "brackwater-leader",
  ]);
  assert.deepEqual(npcs.map((npc) => npc.roleId), REQUIRED_ECOSYSTEM_NPC_ROLES);

  for (const npc of npcs) {
    const resolved = resolveAdventureNpc(npc.id);
    assert.ok(resolved.conversation.lines.intro.length >= 2);
    assert.match(resolved.conversation.lines.intro[0], /welcome|hello|thank you/i);
  }
  assert.equal(resolveAdventureNpc("brackwater-rhea").encounter, null);
  assert.equal(resolveAdventureNpc("brackwater-scientist").encounter, null);
  assert.equal(resolveAdventureNpc("brackwater-naturalist").encounter.id, "encounter-brackwater-resident-naturalist");
  assert.equal(resolveAdventureNpc("brackwater-harbormaster").encounter.id, "encounter-brackwater-resident-harbormaster");
  assert.equal(resolveAdventureNpc("brackwater-leader").encounter.id, "encounter-brackwater-qualifier");
  assert.match(
    resolveAdventureNpc("brackwater-scientist").conversation.lines.debrief.join(" "),
    /expected estuary variation.*high-turbidity.*low-oxygen.*drainage outlet/i,
  );
});

test("five Current Commons NPCs cover every ecosystem role with cautious dialogue and scoped duels", () => {
  const npcs = ADVENTURE_CONTENT.npcs.filter((npc) => npc.townId === "current-commons");
  assert.deepEqual(npcs.map((npc) => npc.id), [
    "current-guide",
    "current-analyst",
    "current-navigator",
    "current-deckhand",
    "current-leader",
  ]);
  assert.deepEqual(npcs.map((npc) => npc.roleId), REQUIRED_ECOSYSTEM_NPC_ROLES);

  for (const npc of npcs) {
    const resolved = resolveAdventureNpc(npc.id);
    assert.ok(resolved.conversation.lines.intro.length >= 2);
    assert.match(resolved.conversation.lines.intro[0], /welcome|hello|thank you/i);
    assert.ok(resolved.conversation.lines.return.length >= 1);
  }
  assert.equal(resolveAdventureNpc("current-guide").encounter, null);
  assert.equal(resolveAdventureNpc("current-analyst").encounter, null);
  assert.equal(resolveAdventureNpc("current-navigator").encounter.id, "encounter-current-resident-navigator");
  assert.equal(resolveAdventureNpc("current-deckhand").encounter.id, "encounter-current-resident-deckhand");
  assert.equal(resolveAdventureNpc("current-leader").encounter.id, "encounter-current-qualifier");
  assert.match(
    resolveAdventureNpc("current-analyst").conversation.lines.debrief.join(" "),
    /risk corridor.*does not prove ownership/i,
  );
  assert.match(
    resolveAdventureNpc("current-deckhand").conversation.lines.victory.join(" "),
    /trained and authorized crews.*report it rather than pull/i,
  );
});

test("Changing Estuary Water is a complete sourced evidence-comparison Field Note", () => {
  const fieldNote = getAdventureFieldNote("field-note-estuary-conditions");
  assert.equal(fieldNote.status, "prototype");
  assert.equal(fieldNote.observations.length, 5);
  assert.equal(fieldNote.checklist.length, 4);
  assert.deepEqual(fieldNote.glossary.map((entry) => entry.term), [
    "Estuary",
    "Salinity",
    "Turbidity",
    "Dissolved oxygen",
    "Runoff",
  ]);
  assert.equal(fieldNote.sourceUrls.length, 3);
  assert.ok(fieldNote.sourceUrls.every((sourceUrl) => sourceUrl.startsWith("https://")));
  assert.match(fieldNote.summary, /place, tide, rainfall, time, and bottom type.*expected variation.*source tracing/i);
});

test("Connected by Currents is a complete sourced, uncertainty-aware ghost-gear Field Note", () => {
  const fieldNote = getAdventureFieldNote("field-note-current-connections");
  assert.equal(fieldNote.status, "prototype");
  assert.equal(fieldNote.observations.length, 5);
  assert.equal(fieldNote.checklist.length, 5);
  assert.deepEqual(fieldNote.glossary.map((entry) => entry.term), [
    "Surface current",
    "Drifter",
    "Ghost gear",
    "Accumulation",
    "Search corridor",
  ]);
  assert.equal(fieldNote.sourceUrls.length, 5);
  assert.ok(fieldNote.sourceUrls.every((sourceUrl) => sourceUrl.startsWith("https://")));
  assert.match(fieldNote.summary, /likely short-term paths.*do not prove.*owned.*exact destination/i);
  assert.match(fieldNote.checklist.join(" "), /stay aboard.*trained and authorized responders.*prevention/i);
});

test("Reading a Reef is a complete evidence-first Field Note with science sources", () => {
  const fieldNote = getAdventureFieldNote("field-note-coral-observations");
  assert.equal(fieldNote.title, "Reading a Reef");
  assert.equal(fieldNote.status, "prototype");
  assert.equal(fieldNote.observations.length, 5);
  assert.equal(fieldNote.checklist.length, 4);
  assert.deepEqual(fieldNote.glossary.map((entry) => entry.term), [
    "Bleaching",
    "Lesion",
    "Substrate",
    "Resilience",
  ]);
  assert.equal(fieldNote.sourceUrls.length, 4);
  assert.ok(fieldNote.sourceUrls.every((sourceUrl) => sourceUrl.startsWith("https://")));
  assert.match(fieldNote.summary, /different observations.*evidence before naming a cause.*instant cure/i);
});

test("Elverson's three active interiors define validated art-aligned furniture collision rectangles", () => {
  const runtimeScenes = getRuntimeAdventureScenes();
  const expectedRectangleCounts = new Map([
    ["coral-home", 5],
    ["deep-home", 4],
    ["academy-lab", 8],
  ]);

  for (const [sceneId, expectedCount] of expectedRectangleCounts) {
    const scene = runtimeScenes.find((candidate) => candidate.id === sceneId);
    assert.equal(scene.world.collisionRects.length, expectedCount);
    assert.equal(new Set(scene.world.collisionRects.map((rect) => rect.id)).size, expectedCount);
    assert.ok(scene.world.collisionRects.every((rect) => (
      rect.left < rect.right
      && rect.top < rect.bottom
      && rect.left >= -0.5
      && rect.top >= -0.5
      && rect.right <= scene.world.tiles[0].length - 0.5
      && rect.bottom <= scene.world.tiles.length - 0.5
    )));
  }
});

test("Elverson town uses layered object bases and an explicit dry-land allowlist", () => {
  const town = getRuntimeAdventureScenes().find((scene) => scene.id === "town");
  assert.equal(town.world.artPath, "/images/adventure/elverson-ground-v2.png");
  assert.deepEqual(
    town.world.walkableRegions.map(({ id }) => id),
    ["mainland", "central-pier", "fishing-connector", "fishing-platform", "aquarium-apron"],
  );

  const objectIds = new Set(town.world.layeredObjects.map(({ id }) => id));
  for (const objectId of [
    "park-fountain",
    "park-bench-north",
    "park-bench-south",
    "main-planter-west",
    "main-planter-east",
    "tree-park-east",
    "lamp-park-south",
    "aquarium-workshop",
  ]) {
    assert.equal(objectIds.has(objectId), true, `${objectId} must be a layered object`);
  }

  const collisionIds = new Set(town.world.collisionRects.map(({ id }) => id));
  for (const collisionId of [
    "park-fountain:basin",
    "park-bench-north:feet",
    "park-bench-south:feet",
    "tree-park-east:trunk",
    "lamp-park-south:base",
    "main-planter-west:box",
    "main-planter-east:box",
    "aquarium-workshop:foundation-left",
    "aquarium-workshop:foundation-right",
  ]) {
    assert.equal(collisionIds.has(collisionId), true, `${collisionId} must be solid`);
  }
  assert.deepEqual(
    town.world.layeredObjects.flatMap(({ collisionRects }) => collisionRects),
    town.world.collisionRects,
    "world collision must be derived from the reusable objects' base hitboxes",
  );

  const regionContains = (position) => town.world.walkableRegions.some((region) => (
    position.x >= region.left
    && position.x <= region.right
    && position.y >= region.top
    && position.y <= region.bottom
  ));
  assert.equal(regionContains({ x: 14, y: 17.7 }), true, "central pier stays walkable");
  assert.equal(regionContains({ x: 11, y: 16.5 }), true, "fishing platform stays walkable");
  assert.equal(regionContains({ x: 8, y: 16.5 }), false, "open water is outside the allowlist");
  assert.equal(regionContains({ x: 14, y: 18.35 }), false, "water past the pier is outside the allowlist");

  const aquariumExit = getRuntimeAdventureScenes()
    .find((scene) => scene.id === "academy-lab")
    .world.interactions.find((interaction) => interaction.id === "interaction-academy-exit");
  assert.deepEqual(aquariumExit.spawn, { x: 16, y: 15.85 });
  assert.equal(aquariumExit.doorwayHalfWidth, 0.5);
});

test("Elverson exposes exactly its aquarium workshop and two homes through valid portals", () => {
  const validFacings = new Set(["up", "down", "left", "right"]);
  const elversonSceneIds = new Set(["town", "coral-home", "deep-home", "academy-lab"]);
  const portals = getRuntimeAdventureScenes()
    .filter((scene) => elversonSceneIds.has(scene.id))
    .flatMap((scene) => (
    scene.world.interactions.filter((interaction) => ["enter", "exit"].includes(interaction.type))
    ));
  const townEntries = portals.filter((portal) => portal.type === "enter");

  assert.deepEqual(
    townEntries.map((portal) => portal.targetScene).sort(),
    ["academy-lab", "coral-home", "deep-home"],
  );
  assert.ok(portals.every((portal) => validFacings.has(portal.facing)));
});

test("Elverson contains the exact requested resident roster once plus Mr. Easterling", () => {
  const elversonNpcs = ADVENTURE_CONTENT.npcs.filter((npc) => npc.townId === "shellshore-village");
  const mentor = elversonNpcs.find((npc) => npc.id === "academy-mentor");
  const residents = elversonNpcs.filter((npc) => npc.id !== "academy-mentor");

  assert.equal(mentor.name, "Mr. Easterling");
  assert.equal(mentor.title, "Aquarium Project Lead");
  assert.equal(elversonNpcs.length, ELVERSON_REQUESTED_RESIDENT_NAMES.length + 1);
  assert.deepEqual(
    residents.map((npc) => npc.name).sort(),
    [...ELVERSON_REQUESTED_RESIDENT_NAMES].sort(),
  );
  assert.equal(residents.filter((npc) => npc.name === "Henry").length, 1);
  assert.equal(new Set(elversonNpcs.map((npc) => npc.id)).size, elversonNpcs.length);
});

test("every Elverson resident cross-resolves through one conversation and one scene interaction", () => {
  const elversonNpcs = ADVENTURE_CONTENT.npcs.filter((npc) => npc.townId === "shellshore-village");

  for (const npc of elversonNpcs) {
    const resolved = resolveAdventureNpc(npc.id);
    const scene = ADVENTURE_CONTENT.scenes.find((candidate) => candidate.id === npc.sceneId);
    const matchingInteractions = scene.world.interactions.filter((interaction) => interaction.npcId === npc.id);
    assert.ok(resolved.conversation, `${npc.name} must resolve an authored conversation.`);
    assert.equal(resolved.conversation.npcId, npc.id);
    assert.equal(matchingInteractions.length, 1, `${npc.name} must appear exactly once in ${npc.sceneId}.`);
    assert.equal(matchingInteractions[0].conversationId, npc.conversationId);
    assert.equal(matchingInteractions[0].type, npc.encounterId ? "trainer" : "npc");
    if (npc.encounterId) assert.equal(resolved.encounter.opponentId, npc.id);
  }
});

test("Elverson doors, challengers, mentor, conversations, and encounters cross-resolve", () => {
  const door = resolveAdventureInteraction("town", "interaction-elverson-enter-park-home");
  assert.equal(door.targetSceneContent.id, "coral-home");
  assert.deepEqual(door.spawn, { x: 5, y: 6 });

  const rosieInteraction = resolveAdventureInteraction("coral-home", "interaction-coral-home-marina");
  assert.equal(rosieInteraction.npc.name, "Rosie");
  assert.equal(rosieInteraction.npc.conversation.lines.intro.length, 2);
  assert.equal(rosieInteraction.npc.encounter.opponentDeckId, "coral-garden");
  assert.equal(rosieInteraction.npc.encounter.victoryTarget, 10);

  const george = ADVENTURE_CONTENT.npcs.find((npc) => (
    npc.townId === "shellshore-village" && npc.name === "George"
  ));
  const resolvedGeorge = resolveAdventureNpc(george.id);
  assert.equal(resolvedGeorge.sceneId, "deep-home");
  assert.equal(resolvedGeorge.conversation.lines.rematch.length, 2);
  assert.equal(resolvedGeorge.encounter.opponentDeckId, "darkness-shroud");
  assert.equal(resolvedGeorge.encounter.difficulty, "medium");

  const aquariumDoor = resolveAdventureInteraction("town", "interaction-elverson-enter-aquarium");
  assert.deepEqual(aquariumDoor.at, { x: 16, y: 15.1 });
  assert.equal(aquariumDoor.targetSceneContent.id, "academy-lab");
  assert.deepEqual(aquariumDoor.spawn, { x: 6, y: 7 });
  const chestnutDoor = resolveAdventureInteraction("town", "interaction-elverson-enter-chestnut-home");
  assert.deepEqual(chestnutDoor.at, { x: 18, y: 3 });

  const mentorInteraction = resolveAdventureInteraction("academy-lab", "interaction-academy-mentor");
  assert.equal(mentorInteraction.npc.name, "Mr. Easterling");
  assert.equal(mentorInteraction.npc.roleId, "mentor");
  assert.equal(mentorInteraction.npc.conversation.lines.boatSafety.length, 2);
  assert.equal(mentorInteraction.npc.conversation.lines.tutorialIntro.length, 3);
  const worldIntroduction = mentorInteraction.npc.conversation.lines.worldIntroduction;
  assert.equal(worldIntroduction.length, 6);
  assert.match(worldIntroduction.join(" "), /aquarium here has been my lifelong dream/i);
  assert.match(
    worldIntroduction.join(" "),
    /catch certain fish and creatures responsibly.*bring the creatures you catch back to me.*right care.*aquarium exhibits.*their habitats/i,
  );
  assert.match(
    worldIntroduction.join(" "),
    /SeaPals matches let us model those real relationships.*playable ecosystem.*food, shelter, water conditions/i,
  );
  assert.match(mentorInteraction.npc.conversation.lines.intro.join(" "), /Elverson.*aquarium.*exhibit/i);
  assert.match(mentorInteraction.npc.conversation.lines.starterPresentation.join(" "), /aquarium lesson/i);
  assert.match(mentorInteraction.npc.conversation.lines.starterConfirmed.join(" "), /aquarium project/i);
  assert.doesNotMatch(
    [
      ...mentorInteraction.npc.conversation.lines.starterPresentation,
      ...mentorInteraction.npc.conversation.lines.starterConfirmed,
    ].join(" "),
    /voyage/i,
  );
  assert.match(mentorInteraction.npc.conversation.lines.tutorialIntro.join(" "), /RP economy.*26 VP.*Coral Reef.*School Density.*Filter Feeder.*Apex predator/i);
  assert.match(mentorInteraction.npc.conversation.lines.practiceRetry.join(" "), /sound plan.*Coral Reef.*Creature Schools.*Filter Feeders.*Apex predator.*26 VP/i);
  assert.match(mentorInteraction.npc.conversation.lines.victory.join(" "), /Coral Reef habitat.*School Density.*Filter Feeder.*Apex predator.*26 VP/i);
  assert.equal(mentorInteraction.npc.encounter.id, "encounter-shellshore-mentor-practice");
  assert.equal(mentorInteraction.npc.encounter.victoryTarget, 26);
});

test("starter previews, the live tutorial, and first Field Note form one canonical introduction", () => {
  assert.deepEqual(ADVENTURE_CONTENT.starterDecks.map((starter) => starter.id), ADVENTURE_STARTER_DECK_IDS);
  for (const starterDeckId of ADVENTURE_STARTER_DECK_IDS) {
    const starter = getAdventureStarterDeck(starterDeckId);
    assert.equal(starter.deckId, starterDeckId);
    assert.equal(starter.strengths.length, 3);
    assert.deepEqual(Object.keys(starter.metrics), ["offense", "defense", "economy", "consistency", "tempo"]);
    assert.ok(Object.values(starter.metrics).every((metric) => metric >= 1 && metric <= 5));
  }

  const tutorial = resolveAdventureTutorial("tutorial-shellshore-live-basics");
  assert.equal(tutorial.sceneId, "academy-lab");
  assert.equal(tutorial.mentor.name, "Mr. Easterling");
  assert.equal(tutorial.practiceEncounter.id, "encounter-shellshore-mentor-practice");
  assert.equal(tutorial.victoryTarget, 26);
  assert.equal(tutorial.practiceEncounter.victoryTarget, 26);
  assert.deepEqual(tutorial.starterDecks.map((starter) => starter.id), ADVENTURE_STARTER_DECK_IDS);
  assert.deepEqual(tutorial.checkpoints.map((checkpoint) => checkpoint.actionType), REQUIRED_TUTORIAL_ACTION_TYPES);
  assert.deepEqual(tutorial.checkpoints.map((checkpoint) => checkpoint.id), REQUIRED_TUTORIAL_CHECKPOINT_IDS);
  assert.equal(tutorial.fieldNote.id, "field-note-harbor-basics");

  const fieldNote = getAdventureFieldNote("field-note-harbor-basics");
  const starterTown = ADVENTURE_CONTENT.towns.find((town) => town.id === "shellshore-village");
  const starterQuest = ADVENTURE_CONTENT.quests.find((quest) => quest.id === "quest-shellshore-first-voyage");
  const discoveryPack = ADVENTURE_CONTENT.packPools.find((pack) => pack.id === "pack-pool-shellshore-discovery");
  assert.equal(starterTown.name, "Elverson");
  assert.equal(starterQuest.title, "Elverson's First Exhibit");
  assert.equal(discoveryPack.name, "Elverson Discovery Pack");
  assert.equal(fieldNote.title, "Elverson Shore & Aquarium Planning");
  assert.equal(fieldNote.status, "prototype");
  assert.equal(fieldNote.observations.length, 3);
  assert.equal(fieldNote.safetyChecklist.length, 3);
  assert.ok(fieldNote.glossary.some((entry) => entry.term === "Ecosystem"));
});

test("validation reports duplicate, broken-reference, and missing-learning failures", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  invalid.towns.push({ ...invalid.towns[0] });
  invalid.towns[1].startSceneId = "missing-scene";
  delete invalid.quests[1].learning.callback;
  invalid.encounters.find((encounter) => encounter.role === "tournament").victoryTarget = 10;

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /duplicate id shellshore-village/.test(error)));
  assert.ok(result.errors.some((error) => /unknown id missing-scene/.test(error)));
  assert.ok(result.errors.some((error) => /learning\.callback is required/.test(error)));
  assert.ok(result.errors.some((error) => /tournament matches must use 30 VP/.test(error)));
});

test("content validation enforces progression reward and quest-state contracts", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  invalid.rewards.find((reward) => reward.id === "reward-sunpatch-qualifier")
    .packs["pack-pool-sunpatch-coral"] = 0;
  invalid.quests[0].stateSequence = ["complete"];

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /reward-sunpatch-qualifier.*positive safe integer/.test(error)));
  assert.ok(result.errors.some((error) => /stateSequence must exactly match notStarted -> active -> readyToTurnIn -> complete/.test(error)));
});

test("content validation rejects missing resident, learning-sequence, and qualifier gates", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  const town = invalid.towns.find((candidate) => candidate.id === "sunpatch-cay");
  town.encounterIds = town.encounterIds.filter((encounterId) => !encounterId.includes("resident-gardener"));
  invalid.dialogues[0].beats.splice(2, 1);
  invalid.encounters.find((encounter) => encounter.id === "encounter-sunpatch-qualifier").prerequisites = [];

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /exactly two resident duels and one qualifier/.test(error)));
  assert.ok(result.errors.some((error) => /beats must exactly follow/.test(error)));
  assert.ok(result.errors.some((error) => /learning quest to be complete/.test(error)));
});

test("malformed top-level collections return validation errors instead of throwing", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  invalid.towns = { unexpected: true };

  let result;
  assert.doesNotThrow(() => {
    result = validateAdventureContent(invalid);
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /towns must be an array/.test(error)));
});

test("content validation rejects broken Elverson runtime cross-references", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  invalid.scenes.find((scene) => scene.id === "town").world.interactions[0].targetScene = "missing-home";
  invalid.scenes.find((scene) => scene.id === "coral-home").world.interactions[0].conversationId = "missing-conversation";
  invalid.docks.find((dock) => dock.id === "shellshore-dock").sceneId = "sunpatch-cay-town";
  const george = invalid.npcs.find((npc) => npc.name === "George");
  const rosie = invalid.npcs.find((npc) => npc.name === "Rosie");
  george.encounterId = rosie.encounterId;
  invalid.conversations.find((conversation) => conversation.npcId === rosie.id).lines.victory = [];

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /targetScene references unknown id missing-home/.test(error)));
  assert.ok(result.errors.some((error) => /conversationId references unknown id missing-conversation/.test(error)));
  assert.ok(result.errors.some((error) => /shellshore-dock.*sceneId must belong to the dock town/.test(error)));
  assert.ok(result.errors.some((error) => new RegExp(`${george.id}.*encounterId must resolve to an encounter`).test(error)));
  assert.ok(result.errors.some((error) => /lines\.victory must contain/.test(error)));
});

test("content validation rejects malformed, duplicate, and out-of-bounds collision rectangles", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  invalid.scenes.find((scene) => scene.id === "town").world.collisionRects = { unexpected: true };

  const coralRects = invalid.scenes.find((scene) => scene.id === "coral-home").world.collisionRects;
  coralRects.push({ ...coralRects[0] });
  coralRects.push({ id: "", left: 3, top: 3, right: 4, bottom: 4 });
  coralRects.push({ id: "coral-empty-width", left: 4, top: 4, right: 4, bottom: 5 });
  coralRects.push({ id: "coral-non-finite", left: 4, top: Number.NaN, right: 5, bottom: 6 });

  const deepRects = invalid.scenes.find((scene) => scene.id === "deep-home").world.collisionRects;
  deepRects.push({ id: "deep-out-of-bounds", left: -0.75, top: 1, right: 1, bottom: 2 });

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /town.*collisionRects must be an array/.test(error)));
  assert.ok(result.errors.some((error) => /coral-home.*duplicate id coral-upper-left-table/.test(error)));
  assert.ok(result.errors.some((error) => /collisionRects\[\d+\]\.id must be non-empty/.test(error)));
  assert.ok(result.errors.some((error) => /collisionRects\[\d+\].*left less than right/.test(error)));
  assert.ok(result.errors.some((error) => /collisionRects\[\d+\]\.top must be finite/.test(error)));
  assert.ok(result.errors.some((error) => /collisionRects\[\d+\].*inside the scene bounds/.test(error)));
});

test("content validation rejects malformed layered-world collections", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  const town = invalid.scenes.find((scene) => scene.id === "town");
  town.world.walkableRegions = { unexpected: true };
  town.world.layeredObjects = { unexpected: true };

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /town.*walkableRegions must be a non-empty array/.test(error)));
  assert.ok(result.errors.some((error) => /town.*layeredObjects must be an array/.test(error)));
});

test("content validation protects layered object identity, sprite, base, and depth contracts", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  const town = invalid.scenes.find((scene) => scene.id === "town");
  const { walkableRegions, layeredObjects } = town.world;

  walkableRegions.push({ ...walkableRegions[0] });
  walkableRegions.push({ id: "", left: 1, top: 1, right: 2, bottom: 2 });
  walkableRegions.push({ id: "empty-region", left: 3, top: 3, right: 3, bottom: 4 });
  walkableRegions.push({ id: "off-map-region", left: -1, top: 1, right: 1, bottom: 2 });

  layeredObjects.push({ ...layeredObjects[0] });
  layeredObjects[0].renderId = "wrong-render-id";
  layeredObjects[1].kind = "building";
  layeredObjects[2].archetype = "";
  layeredObjects[3].at.x = Number.NaN;
  layeredObjects[4].sprite.src = "https://example.invalid/tree.jpg";
  layeredObjects[5].sprite.width = 0;
  layeredObjects[6].sprite.anchorX = 2;
  layeredObjects[7].scale = 0;
  layeredObjects[8].layer = "foreground";
  layeredObjects[9].depthY = Number.NaN;
  layeredObjects[10].depthBias = 0.5;
  layeredObjects[11].visualBounds.right = layeredObjects[11].visualBounds.left;
  layeredObjects[12].collisionRects = { unexpected: true };
  layeredObjects[13].collisionRects[0].left += 0.1;
  layeredObjects[14].collisionRects[0].id = "wrong-owner:foundation";
  layeredObjects[15].interactionId = "missing-interaction";
  layeredObjects[16].interactionId = "interaction-elverson-enter-chestnut-home";

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  for (const expected of [
    /walkableRegions contains duplicate id mainland/,
    /walkableRegions\[\d+\]\.id must be non-empty/,
    /walkableRegions\[\d+\].*left less than right/,
    /walkableRegions\[\d+\].*inside the scene bounds/,
    /layeredObjects contains duplicate id west-blue-home/,
    /renderId must equal object:west-blue-home/,
    /\.kind must equal object/,
    /\.archetype must be non-empty/,
    /\.at requires finite x and y coordinates/,
    /sprite\.src must reference a PNG/,
    /sprite\.width must be a positive finite number/,
    /sprite\.anchorX must stay between 0 and 1/,
    /\.scale must be a positive finite number/,
    /\.layer must be ground, depth, or overhead/,
    /\.depthY must be finite/,
    /\.depthBias must be an integer/,
    /visualBounds.*left less than right/,
    /collisionRects must be an array/,
    /must match its world\.collisionRects geometry/,
    /\.id must begin with tree-north-midwest:/,
    /interactionId references unknown scene interaction missing-interaction/,
    /links interaction interaction-elverson-enter-chestnut-home more than once/,
  ]) {
    assert.ok(
      result.errors.some((error) => expected.test(error)),
      `expected layered-world validation error ${expected}`,
    );
  }
});

test("content validation rejects malformed and out-of-bounds NPC patrol metadata", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  const shellshoreTown = invalid.scenes.find((scene) => scene.id === "town");
  const shellshoreDoor = shellshoreTown.world.interactions.find((interaction) => interaction.type === "enter");
  shellshoreDoor.patrol = {
    mode: "loop",
    speed: 1,
    pauseMs: 0,
    waypoints: [shellshoreDoor.at, { x: shellshoreDoor.at.x, y: shellshoreDoor.at.y + 1 }],
  };

  const sunpatchTavi = invalid.scenes
    .find((scene) => scene.id === "sunpatch-cay-town")
    .world.interactions.find((interaction) => interaction.id === "interaction-sunpatch-tavi");
  sunpatchTavi.patrol = [];

  const brackwaterRhea = invalid.scenes
    .find((scene) => scene.id === "brackwater-landing-town")
    .world.interactions.find((interaction) => interaction.id === "interaction-brackwater-rhea");
  brackwaterRhea.patrol.waypoints = [brackwaterRhea.at];

  const currentGuide = invalid.scenes
    .find((scene) => scene.id === "current-commons-town")
    .world.interactions.find((interaction) => interaction.id === "interaction-current-guide");
  currentGuide.patrol.waypoints[1].x = Number.POSITIVE_INFINITY;
  currentGuide.patrol.waypoints[2].y = 999;

  const kelpwatchGuide = invalid.scenes
    .find((scene) => scene.id === "kelpwatch-island-town")
    .world.interactions.find((interaction) => interaction.id === "interaction-kelpwatch-guide");
  kelpwatchGuide.patrol.mode = "wander";
  kelpwatchGuide.patrol.speed = 0;
  kelpwatchGuide.patrol.pauseMs = -1;
  kelpwatchGuide.patrol.playerPauseDistance = -0.5;
  kelpwatchGuide.patrol.waypoints[0] = { x: kelpwatchGuide.at.x + 1, y: kelpwatchGuide.at.y };

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /patrol may only be supplied for npc or trainer interactions/.test(error)));
  assert.ok(result.errors.some((error) => /patrol must be an object/.test(error)));
  assert.ok(result.errors.some((error) => /waypoints must be an array with at least two entries/.test(error)));
  assert.ok(result.errors.some((error) => /waypoints\[1\] requires finite x and y coordinates/.test(error)));
  assert.ok(result.errors.some((error) => /waypoints\[2\] must stay inside the scene bounds/.test(error)));
  assert.ok(result.errors.some((error) => /mode must be loop or ping-pong/.test(error)));
  assert.ok(result.errors.some((error) => /speed must be a positive finite number/.test(error)));
  assert.ok(result.errors.some((error) => /pauseMs must be a nonnegative finite number/.test(error)));
  assert.ok(result.errors.some((error) => /playerPauseDistance must be a nonnegative finite number/.test(error)));
  assert.ok(result.errors.some((error) => /waypoints\[0\] must match the interaction at position/.test(error)));
});

test("content validation rejects invalid portal destination facing", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  invalid.scenes.find((scene) => scene.id === "town").world.interactions[0].facing = "diagonal";

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /facing must be up, down, left, or right/.test(error)));
});

test("content validation protects Phase 4 route, fieldwork, NPC, and exhibition contracts", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  const routeScene = invalid.scenes.find((scene) => scene.id === "shellshore-sunpatch-sea");
  routeScene.world.movement.mode = "walk";
  routeScene.world.interactions.find((interaction) => interaction.endpoint === "from").endpoint = "middle";
  invalid.routes.find((route) => route.id === "route-shellshore-sunpatch").toSpawn.facing = "diagonal";

  const town = invalid.scenes.find((scene) => scene.id === "sunpatch-cay-town");
  town.world.interactions.find((interaction) => interaction.type === "observation").observationId = "";
  const fieldStation = invalid.scenes.find((scene) => scene.id === "sunpatch-field-station");
  fieldStation.world.interactions.find((interaction) => interaction.type === "interpretation").choiceSetId = "";

  invalid.npcs.find((npc) => npc.id === "sunpatch-tavi").encounterId = "encounter-sunpatch-resident-gardener";
  invalid.fieldNotes.find((fieldNote) => fieldNote.id === "field-note-coral-observations").sourceUrls = [
    "http://example.invalid/not-secure",
  ];
  const exhibition = invalid.encounters.find((encounter) => encounter.id === "encounter-sunpatch-exhibition");
  exhibition.victoryTarget = 10;
  exhibition.prerequisites = [];

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /shellshore-sunpatch-sea.*movement must declare boat mode/.test(error)));
  assert.ok(result.errors.some((error) => /endpoint must be from or to/.test(error)));
  assert.ok(result.errors.some((error) => /route-shellshore-sunpatch.*toSpawn\.facing must be up, down, left, or right/.test(error)));
  assert.ok(result.errors.some((error) => /observationId is required/.test(error)));
  assert.ok(result.errors.some((error) => /choiceSetId is required/.test(error)));
  assert.ok(result.errors.some((error) => /npcId must resolve to a non-dueling NPC/.test(error)));
  assert.ok(result.errors.some((error) => /sourceUrls must contain at least three HTTPS science sources/.test(error)));
  assert.ok(result.errors.some((error) => /exhibition must use 30 VP/.test(error)));
  assert.ok(result.errors.some((error) => /exhibition must require the town qualifier/.test(error)));
});

test("content validation protects Brackwater art, evidence, science-source, and NPC-role contracts", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  invalid.scenes.find((scene) => scene.id === "sunpatch-brackwater-sea").world.artPath = "https://example.invalid/route.jpg";
  invalid.scenes
    .find((scene) => scene.id === "brackwater-landing-town")
    .world.interactions
    .find((interaction) => interaction.type === "observation")
    .observationId = "";
  invalid.fieldNotes.find((fieldNote) => fieldNote.id === "field-note-estuary-conditions").sourceUrls = [];
  invalid.npcs.find((npc) => npc.id === "brackwater-scientist").roleId = "resident";

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /sunpatch-brackwater-sea.*artPath must reference a PNG/.test(error)));
  assert.ok(result.errors.some((error) => /brackwater-landing-town.*observationId is required/.test(error)));
  assert.ok(result.errors.some((error) => /field-note-estuary-conditions.*sourceUrls must contain at least three HTTPS science sources/.test(error)));
  assert.ok(result.errors.some((error) => /brackwater-landing.*no NPC for role field-partner/.test(error)));
});

test("content validation protects Current route, evidence, science-source, and NPC-role contracts", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  invalid.scenes.find((scene) => scene.id === "brackwater-current-sea").world.artPath = "https://example.invalid/route.jpg";
  invalid.scenes
    .find((scene) => scene.id === "current-commons-town")
    .world.interactions
    .find((interaction) => interaction.type === "observation")
    .observationId = "";
  invalid.fieldNotes.find((fieldNote) => fieldNote.id === "field-note-current-connections").sourceUrls = [];
  invalid.npcs.find((npc) => npc.id === "current-analyst").roleId = "resident";

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /brackwater-current-sea.*artPath must reference a PNG/.test(error)));
  assert.ok(result.errors.some((error) => /current-commons-town.*observationId is required/.test(error)));
  assert.ok(result.errors.some((error) => /field-note-current-connections.*sourceUrls must contain at least three HTTPS science sources/.test(error)));
  assert.ok(result.errors.some((error) => /current-commons.*no NPC for role field-partner/.test(error)));
});

test("content validation protects Kelpwatch route, evidence, science-source, and NPC-role contracts", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  invalid.scenes.find((scene) => scene.id === "current-kelpwatch-sea").world.artPath = "https://example.invalid/route.jpg";
  invalid.scenes
    .find((scene) => scene.id === "kelpwatch-island-town")
    .world.interactions
    .find((interaction) => interaction.type === "observation")
    .observationId = "";
  invalid.fieldNotes.find((fieldNote) => fieldNote.id === "field-note-kelp-food-web").sourceUrls = [];
  invalid.npcs.find((npc) => npc.id === "kelpwatch-ecologist").roleId = "resident";

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /current-kelpwatch-sea.*artPath must reference a PNG/.test(error)));
  assert.ok(result.errors.some((error) => /kelpwatch-island-town.*observationId is required/.test(error)));
  assert.ok(result.errors.some((error) => /field-note-kelp-food-web.*sourceUrls must contain at least three HTTPS science sources/.test(error)));
  assert.ok(result.errors.some((error) => /kelpwatch-island.*no NPC for role field-partner/.test(error)));
});

test("playable deep-ocean Field Notes require authoritative HTTPS science sources", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  const fieldNote = invalid.fieldNotes.find(
    ({ id }) => id === "field-note-deep-adaptations",
  );
  fieldNote.status = "prototype";
  fieldNote.summary ||= "Deep-ocean observations require locally supported explanations.";
  fieldNote.observations ||= [
    "Light dwindles during descent.",
    "Pressure rises as depth increases.",
  ];
  fieldNote.safetyChecklist ||= [
    "Travel with the trained expedition crew.",
    "Observe without collecting wildlife.",
    "Abort rather than contacting habitat.",
  ];
  fieldNote.glossary ||= [
    { term: "Marine snow", definition: "Sinking material derived mostly from upper waters." },
  ];
  fieldNote.sourceUrls = [];

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => (
    /field-note-deep-adaptations.*sourceUrls must contain at least three HTTPS science sources/.test(error)
  )));
});

test("content validation protects Phase 2 starter, tutorial, mentor, and Field Note contracts", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  invalid.starterDecks.find((starter) => starter.id === "blue-water").metrics.tempo = 8;
  invalid.tutorials[0].victoryTarget = 10;
  invalid.encounters.find((encounter) => encounter.tutorialId === invalid.tutorials[0].id).victoryTarget = 10;
  invalid.tutorials[0].checkpoints[1].actionType = "attack-resolved";
  invalid.conversations.find((conversation) => conversation.npcId === "academy-mentor").lines.boatSafety = [];
  invalid.rewards.find((reward) => reward.id === "reward-shellshore-tutorial").fieldNoteIds = ["missing-note"];

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /blue-water\.metrics\.tempo must be an integer from 1 to 5/.test(error)));
  assert.ok(result.errors.some((error) => /tutorials\..*\.victoryTarget must be 26/.test(error)));
  assert.ok(result.errors.some((error) => /encounters\..*\.victoryTarget must be 26 for an Academy tutorial/.test(error)));
  assert.ok(result.errors.some((error) => /checkpoints must exactly follow/.test(error)));
  assert.ok(result.errors.some((error) => /lines\.boatSafety must contain/.test(error)));
  assert.ok(result.errors.some((error) => /fieldNoteIds references unknown id missing-note/.test(error)));
});
