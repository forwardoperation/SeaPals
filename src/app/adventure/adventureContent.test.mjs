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

test("the four live Shellshore scenes and Phase 1 dock start resolve from content", () => {
  const runtimeScenes = getRuntimeAdventureScenes();
  assert.deepEqual(runtimeScenes.map((scene) => scene.id), ["town", "coral-home", "deep-home", "academy-lab"]);
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
  assert.equal(mentorInteraction.npc.encounter.id, "encounter-shellshore-mentor-practice");
  assert.equal(mentorInteraction.npc.encounter.victoryTarget, 10);
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
  assert.equal(tutorial.practiceEncounter.victoryTarget, 10);
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

test("content validation protects Phase 2 starter, tutorial, mentor, and Field Note contracts", () => {
  const invalid = clone(ADVENTURE_CONTENT);
  invalid.starterDecks.find((starter) => starter.id === "blue-water").metrics.tempo = 8;
  invalid.tutorials[0].checkpoints[1].actionType = "attack-resolved";
  invalid.conversations.find((conversation) => conversation.npcId === "academy-mentor").lines.boatSafety = [];
  invalid.rewards.find((reward) => reward.id === "reward-shellshore-tutorial").fieldNoteIds = ["missing-note"];

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /blue-water\.metrics\.tempo must be an integer from 1 to 5/.test(error)));
  assert.ok(result.errors.some((error) => /checkpoints must exactly follow/.test(error)));
  assert.ok(result.errors.some((error) => /lines\.boatSafety must contain/.test(error)));
  assert.ok(result.errors.some((error) => /fieldNoteIds references unknown id missing-note/.test(error)));
});
