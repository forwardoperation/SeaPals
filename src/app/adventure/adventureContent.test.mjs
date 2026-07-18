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

test("Shellshore and Sunpatch prototype scenes plus the Phase 1 dock start resolve from content", () => {
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
  ]);
  assert.ok(runtimeScenes.every((scene) => scene.world.tiles.length > 0));
  assert.deepEqual(getAdventureStartLocation(), {
    townId: "shellshore-village",
    dockId: "shellshore-dock",
    sceneId: "town",
    position: { x: 7, y: 8 },
    facing: "up",
  });
  assert.deepEqual(getAdventureDock("shellshore-dock"), {
    id: "shellshore-dock",
    townId: "shellshore-village",
    sceneId: "town",
    status: "prototype",
    position: { x: 7, y: 8 },
    facing: "up",
  });
});

test("the Shellshore-Sunpatch route has an exact 16 by 10 boat lane and two dock endpoints", () => {
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
      spawn: { x: 7, y: 8 },
      facing: "up",
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

  const shellshoreBoard = resolveAdventureInteraction("town", "interaction-shellshore-board-boat");
  const sunpatchBoard = resolveAdventureInteraction("sunpatch-cay-town", "interaction-sunpatch-board-shellshore-route");
  assert.deepEqual(
    [shellshoreBoard, sunpatchBoard].map(({ targetSceneContent, ...interaction }) => interaction),
    [
      {
        id: "interaction-shellshore-board-boat",
        type: "board",
        at: { x: 7, y: 9 },
        routeId: route.id,
        dockId: "shellshore-dock",
        targetScene: route.sceneId,
        spawn: { x: 1, y: 5 },
        facing: "right",
      },
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
    ],
  );
  assert.ok(shellshoreBoard.targetSceneContent === routeScene);
  assert.ok(sunpatchBoard.targetSceneContent === routeScene);
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
      { id: "interaction-sunpatch-enter-garden-home", at: { x: 3, y: 1 }, targetScene: "sunpatch-garden-home", spawn: { x: 5, y: 6 }, facing: "up" },
      { id: "interaction-sunpatch-enter-field-station", at: { x: 8, y: 1 }, targetScene: "sunpatch-field-station", spawn: { x: 5, y: 6 }, facing: "up" },
      { id: "interaction-sunpatch-enter-tide-hall", at: { x: 13, y: 1 }, targetScene: "sunpatch-tide-hall", spawn: { x: 5, y: 6 }, facing: "up" },
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

test("Shellshore interiors define validated art-aligned furniture collision rectangles", () => {
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

test("all live Shellshore portals define a valid destination facing", () => {
  const validFacings = new Set(["up", "down", "left", "right"]);
  const portals = getRuntimeAdventureScenes().flatMap((scene) => (
    scene.world.interactions.filter((interaction) => ["enter", "exit"].includes(interaction.type))
  ));

  assert.ok(portals.length > 0);
  assert.ok(portals.every((portal) => validFacings.has(portal.facing)));
});

test("Shellshore doors, trainers, conversations, and encounters cross-resolve", () => {
  const door = resolveAdventureInteraction("town", "interaction-town-enter-coral-home");
  assert.equal(door.targetSceneContent.id, "coral-home");
  assert.deepEqual(door.spawn, { x: 5, y: 6 });

  const marinaInteraction = resolveAdventureInteraction("coral-home", "interaction-coral-home-marina");
  assert.equal(marinaInteraction.npc.name, "Marina");
  assert.equal(marinaInteraction.npc.conversation.lines.intro.length, 2);
  assert.equal(marinaInteraction.npc.encounter.opponentDeckId, "coral-garden");
  assert.equal(marinaInteraction.npc.encounter.victoryTarget, 10);

  const dorian = resolveAdventureNpc("dorian");
  assert.equal(dorian.sceneId, "deep-home");
  assert.equal(dorian.conversation.lines.rematch.length, 2);
  assert.equal(dorian.encounter.opponentDeckId, "darkness-shroud");
  assert.equal(dorian.encounter.difficulty, "medium");

  const academyDoor = resolveAdventureInteraction("town", "interaction-town-enter-academy");
  assert.equal(academyDoor.targetSceneContent.id, "academy-lab");
  assert.deepEqual(academyDoor.spawn, { x: 6, y: 7 });

  const mentorInteraction = resolveAdventureInteraction("academy-lab", "interaction-academy-mentor");
  assert.equal(mentorInteraction.npc.name, "Professor Marlow Current");
  assert.equal(mentorInteraction.npc.roleId, "mentor");
  assert.equal(mentorInteraction.npc.conversation.lines.boatSafety.length, 2);
  assert.equal(mentorInteraction.npc.conversation.lines.tutorialIntro.length, 3);
  assert.match(mentorInteraction.npc.conversation.lines.tutorialIntro[0], /Reefkeeper/i);
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
  assert.equal(tutorial.mentor.name, "Professor Marlow Current");
  assert.equal(tutorial.practiceEncounter.id, "encounter-shellshore-mentor-practice");
  assert.equal(tutorial.victoryTarget, 26);
  assert.equal(tutorial.practiceEncounter.victoryTarget, 26);
  assert.deepEqual(tutorial.starterDecks.map((starter) => starter.id), ADVENTURE_STARTER_DECK_IDS);
  assert.deepEqual(tutorial.checkpoints.map((checkpoint) => checkpoint.actionType), REQUIRED_TUTORIAL_ACTION_TYPES);
  assert.deepEqual(tutorial.checkpoints.map((checkpoint) => checkpoint.id), REQUIRED_TUTORIAL_CHECKPOINT_IDS);
  assert.equal(tutorial.fieldNote.id, "field-note-harbor-basics");

  const fieldNote = getAdventureFieldNote("field-note-harbor-basics");
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

test("content validation rejects broken Shellshore runtime cross-references", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  invalid.scenes.find((scene) => scene.id === "town").world.interactions[0].targetScene = "missing-home";
  invalid.scenes.find((scene) => scene.id === "coral-home").world.interactions[0].conversationId = "missing-conversation";
  invalid.docks.find((dock) => dock.id === "shellshore-dock").sceneId = "sunpatch-cay-town";
  invalid.npcs.find((npc) => npc.id === "dorian").encounterId = "encounter-shellshore-marina";
  invalid.conversations.find((conversation) => conversation.npcId === "marina").lines.victory = [];

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /targetScene references unknown id missing-home/.test(error)));
  assert.ok(result.errors.some((error) => /conversationId references unknown id missing-conversation/.test(error)));
  assert.ok(result.errors.some((error) => /shellshore-dock.*sceneId must belong to the dock town/.test(error)));
  assert.ok(result.errors.some((error) => /dorian.*encounterId must resolve to an encounter/.test(error)));
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
