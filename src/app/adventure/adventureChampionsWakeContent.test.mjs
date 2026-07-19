import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVENTURE_CONTENT,
  CHAMPIONS_WAKE_ACTION_IDS,
  REQUIRED_DIALOGUE_BEATS,
  getAdventureDock,
  getAdventureFieldNote,
  getAdventureRoute,
  getAdventureScene,
  resolveAdventureInteraction,
  resolveAdventureNpc,
} from "./adventureContent.mjs";
import { validateAdventureContent } from "./adventureContentValidation.mjs";
import {
  SCENES,
  canOccupyContinuousPosition,
  getContinuousInteraction,
  getDoorwayTransition,
} from "./adventureWorld.mjs";

const CHAMPIONS_WAKE_SCENE_IDS = Object.freeze([
  "trenchlight-champions-wake-sea",
  "champions-wake-town",
  "champions-wake-registration-hall",
  "champions-wake-arena",
  "champions-wake-reflection-pavilion",
]);

const CHAMPIONS_WAKE_NPC_IDS = Object.freeze([
  "champions-wake-director",
  "tournament-quarterfinalist",
  "tournament-semifinalist",
  "tournament-champion",
  "champions-wake-reflector",
  "champions-wake-spectator",
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function integerReachablePositions(sceneId) {
  const scene = SCENES[sceneId];
  const start = scene.spawn;
  const queue = [start];
  const visited = new Set([`${start.x},${start.y}`]);
  const steps = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  while (queue.length) {
    const current = queue.shift();
    for (const step of steps) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      const key = `${next.x},${next.y}`;
      if (visited.has(key) || !canOccupyContinuousPosition(sceneId, next)) continue;
      visited.add(key);
      queue.push(next);
    }
  }

  return visited;
}

test("Champion's Wake converts its final route, dock, floating town, and three interiors to runtime content", () => {
  const route = getAdventureRoute("route-trenchlight-champions-wake");
  assert.deepEqual(route, {
    id: "route-trenchlight-champions-wake",
    fromTownId: "trenchlight-station",
    toTownId: "champions-wake",
    sceneId: "trenchlight-champions-wake-sea",
    fromDockId: "trenchlight-champions-wake-dock",
    toDockId: "champions-wake-dock",
    fromSpawn: { x: 1, y: 5, facing: "right" },
    toSpawn: { x: 14, y: 5, facing: "left" },
    manualPilotRequiredFirstTime: true,
    autoSteerAfterFirstCompletion: true,
  });

  assert.deepEqual(getAdventureDock("champions-wake-dock"), {
    id: "champions-wake-dock",
    townId: "champions-wake",
    sceneId: "champions-wake-town",
    status: "prototype",
    position: { x: 7, y: 8 },
    facing: "up",
  });
  assert.equal(getAdventureDock("trenchlight-champions-wake-dock").status, "prototype");

  const expectedArt = new Map([
    ["trenchlight-champions-wake-sea", "/images/adventure/trenchlight-champions-wake-route.png"],
    ["champions-wake-town", "/images/adventure/champions-wake-town.png"],
    ["champions-wake-registration-hall", "/images/adventure/champions-wake-registration-hall.png"],
    ["champions-wake-arena", "/images/adventure/champions-wake-arena.png"],
    ["champions-wake-reflection-pavilion", "/images/adventure/champions-wake-reflection-pavilion.png"],
  ]);
  for (const sceneId of CHAMPIONS_WAKE_SCENE_IDS) {
    const scene = getAdventureScene(sceneId);
    assert.equal(scene.status, "prototype", `${sceneId} should be playable`);
    assert.equal(scene.world.artPath, expectedArt.get(sceneId));
    assert.ok(scene.world.collisionRects === undefined || scene.world.collisionRects.length > 0);
  }

  for (const sceneId of ["trenchlight-champions-wake-sea", "champions-wake-town"]) {
    const scene = getAdventureScene(sceneId);
    assert.equal(scene.world.tiles.length, 10);
    assert.ok(scene.world.tiles.every((row) => row.length === 16));
  }

  const routeScene = getAdventureScene(route.sceneId);
  assert.equal(routeScene.kind, "route");
  assert.equal(routeScene.world.movement.mode, "boat");
  assert.deepEqual(routeScene.world.interactions.map(({ id, endpoint }) => ({ id, endpoint })), [
    { id: "interaction-route-dock-trenchlight-champions-wake", endpoint: "from" },
    { id: "interaction-route-dock-champions-wake", endpoint: "to" },
  ]);
});

test("all Champion's Wake doors auto-transition from reachable approaches and return to safe town corridors", () => {
  const townDoors = [
    ["interaction-champions-wake-enter-registration", "champions-wake-registration-hall", { x: 3, y: 3 }],
    ["interaction-champions-wake-enter-arena", "champions-wake-arena", { x: 8, y: 3 }],
    ["interaction-champions-wake-enter-reflection-pavilion", "champions-wake-reflection-pavilion", { x: 12, y: 3 }],
  ];
  const reachableTown = integerReachablePositions("champions-wake-town");

  for (const [interactionId, targetSceneId, approach] of townDoors) {
    assert.ok(reachableTown.has(`${approach.x},${approach.y}`), `${interactionId} needs a connected town approach`);
    assert.equal(
      getDoorwayTransition("champions-wake-town", { x: approach.x, y: approach.y - 0.27 }, "up")?.interactionId,
      interactionId,
    );
    const entrance = resolveAdventureInteraction("champions-wake-town", interactionId);
    assert.equal(entrance.targetSceneContent.id, targetSceneId);
    assert.equal(canOccupyContinuousPosition(targetSceneId, entrance.spawn), true);
  }

  const exits = [
    ["champions-wake-registration-hall", "interaction-champions-wake-registration-exit", { x: 3, y: 3 }],
    ["champions-wake-arena", "interaction-champions-wake-arena-exit", { x: 8, y: 3 }],
    ["champions-wake-reflection-pavilion", "interaction-champions-wake-pavilion-exit", { x: 12, y: 3 }],
  ];
  for (const [sceneId, interactionId, townSpawn] of exits) {
    assert.ok(integerReachablePositions(sceneId).has("5,6"));
    assert.equal(
      getDoorwayTransition(sceneId, { x: 5, y: 6.27 }, "down")?.interactionId,
      interactionId,
    );
    const exit = resolveAdventureInteraction(sceneId, interactionId);
    assert.equal(exit.targetSceneContent.id, "champions-wake-town");
    assert.deepEqual(exit.spawn, townSpawn);
    assert.equal(canOccupyContinuousPosition("champions-wake-town", townSpawn), true);
  }
});

test("every Champion's Wake story, registration, bracket, epilogue, and route action is reachable", () => {
  const cases = [
    ["trenchlight-champions-wake-sea", { x: 1, y: 5 }, "left", "interaction-route-dock-trenchlight-champions-wake"],
    ["trenchlight-champions-wake-sea", { x: 14, y: 5 }, "right", "interaction-route-dock-champions-wake"],
    ["champions-wake-town", { x: 7, y: 8 }, "down", "interaction-champions-wake-board-trenchlight-route"],
    ["champions-wake-registration-hall", { x: 5, y: 4 }, "up", CHAMPIONS_WAKE_ACTION_IDS.registration],
    ["champions-wake-arena", { x: 2, y: 4 }, "up", CHAMPIONS_WAKE_ACTION_IDS.rounds[0]],
    ["champions-wake-arena", { x: 5, y: 4 }, "up", CHAMPIONS_WAKE_ACTION_IDS.rounds[1]],
    ["champions-wake-arena", { x: 8, y: 4 }, "up", CHAMPIONS_WAKE_ACTION_IDS.rounds[2]],
    ["champions-wake-reflection-pavilion", { x: 4, y: 4 }, "up", CHAMPIONS_WAKE_ACTION_IDS.epilogue],
    ["champions-wake-reflection-pavilion", { x: 7, y: 4 }, "up", "interaction-champions-wake-spectator"],
  ];

  for (const [sceneId, position, facing, interactionId] of cases) {
    assert.ok(integerReachablePositions(sceneId).has(`${position.x},${position.y}`), `${interactionId} approach should connect to the scene spawn`);
    assert.equal(canOccupyContinuousPosition(sceneId, position), true);
    assert.equal(getContinuousInteraction(sceneId, position, facing)?.interactionId, interactionId);
  }
});

test("Champion's Wake publishes explicit tournament actions and an ordered 30 VP bracket", () => {
  assert.deepEqual(CHAMPIONS_WAKE_ACTION_IDS, {
    registration: "interaction-champions-wake-director",
    rounds: [
      "interaction-tournament-quarterfinal",
      "interaction-tournament-semifinal",
      "interaction-tournament-final",
    ],
    epilogue: "interaction-champions-wake-epilogue",
  });

  const registration = resolveAdventureInteraction("champions-wake-registration-hall", CHAMPIONS_WAKE_ACTION_IDS.registration);
  assert.equal(registration.tournamentAction, "registration");
  assert.equal(registration.questId, "quest-champions-wake");
  assert.equal(registration.npc.roleId, "tournament-director");
  assert.equal(registration.requiredTideMarkIds.length, 5);

  const town = ADVENTURE_CONTENT.towns.find(({ id }) => id === "champions-wake");
  const encounters = town.encounterIds.map((encounterId) => (
    ADVENTURE_CONTENT.encounters.find(({ id }) => id === encounterId)
  ));
  assert.deepEqual(encounters.map(({ id, roundIndex, opponentDeckId, victoryTarget, rewardId }) => ({
    id,
    roundIndex,
    opponentDeckId,
    victoryTarget,
    rewardId,
  })), [
    { id: "encounter-tournament-quarterfinal", roundIndex: 1, opponentDeckId: "disruption", victoryTarget: 30, rewardId: null },
    { id: "encounter-tournament-semifinal", roundIndex: 2, opponentDeckId: "open-ocean-hunt", victoryTarget: 30, rewardId: null },
    { id: "encounter-tournament-final", roundIndex: 3, opponentDeckId: "darkness-shroud", victoryTarget: 30, rewardId: "reward-tournament-champion" },
  ]);
  assert.deepEqual(encounters[0].prerequisites, [
    { type: "questStatus", questId: "quest-champions-wake", status: "active" },
  ]);
  assert.deepEqual(encounters[1].prerequisites, [
    { type: "encounterComplete", encounterId: encounters[0].id },
  ]);
  assert.deepEqual(encounters[2].prerequisites, [
    { type: "encounterComplete", encounterId: encounters[1].id },
  ]);

  for (const [index, interactionId] of CHAMPIONS_WAKE_ACTION_IDS.rounds.entries()) {
    const interaction = resolveAdventureInteraction("champions-wake-arena", interactionId);
    assert.equal(interaction.tournamentAction, "round");
    assert.equal(interaction.roundIndex, index + 1);
    assert.equal(interaction.encounterId, encounters[index].id);
  }
  assert.equal(
    resolveAdventureInteraction("champions-wake-reflection-pavilion", CHAMPIONS_WAKE_ACTION_IDS.epilogue).tournamentAction,
    "epilogue",
  );
});

test("the original Champion's Wake cast carries warm tournament and evidence-synthesis conversations", () => {
  const cast = CHAMPIONS_WAKE_NPC_IDS.map((npcId) => resolveAdventureNpc(npcId));
  assert.ok(cast.every(Boolean));
  assert.equal(new Set(cast.map(({ name }) => name)).size, cast.length);
  assert.deepEqual(cast.map(({ roleId }) => roleId), [
    "tournament-director",
    "town-challenger",
    "town-challenger",
    "town-challenger",
    "reflection-character",
    "spectator",
  ]);

  const director = cast[0].conversation.lines;
  for (const mode of ["intro", "guidance", "registration", "roundReady", "champion", "postgame", "return"]) {
    assert.ok(director[mode].length > 0, `director needs ${mode} dialogue`);
  }
  for (const opponent of cast.slice(1, 4)) {
    for (const mode of ["intro", "roundReady", "defeat", "rematch", "victory", "roundVictory", "postgame"]) {
      assert.ok(opponent.conversation.lines[mode].length > 0, `${opponent.id} needs ${mode} dialogue`);
    }
  }
  assert.match(director.registration[0], /welcome.*Director Amara Vela/i);
  for (const opponent of cast.slice(1, 4)) {
    assert.match(
      opponent.conversation.lines.roundReady[0],
      new RegExp(opponent.name, "i"),
      `${opponent.name}'s live round prompt should greet and identify them`,
    );
  }

  const storyText = cast.flatMap(({ conversation }) => Object.values(conversation.lines).flat()).join(" ");
  assert.match(storyText, /30 VP.*evidence.*uncertainty.*monitor/i);
  assert.match(storyText, /reef.*estuary.*current.*kelp.*deep/i);
  assert.match(storyText, /not declarations that any ecosystem is permanently fixed/i);

  const dialogue = ADVENTURE_CONTENT.dialogues.find(({ id }) => id === "dialogue-champions-wake");
  assert.deepEqual(dialogue.beats.map(({ id }) => id), REQUIRED_DIALOGUE_BEATS);
  assert.ok(dialogue.beats.every(({ speakerNpcId, lines }) => speakerNpcId && lines.length));
});

test("Archipelago Reflections rewards a playable postgame synthesis instead of a solved-nature claim", () => {
  const note = getAdventureFieldNote("field-note-archipelago-reflection");
  assert.equal(note.status, "prototype");
  assert.equal(note.observations.length, 6);
  assert.equal(note.checklist.length, 5);
  assert.ok(note.glossary.some(({ term }) => term === "Adaptive decision"));
  assert.match(note.summary, /place-specific observations.*uncertainty.*no Tide Mark.*permanently fixed/i);
  assert.match(note.observations.join(" "), /coral.*estuary.*drifter.*kelp.*deep/i);

  const reward = ADVENTURE_CONTENT.rewards.find(({ id }) => id === "reward-tournament-champion");
  assert.deepEqual(reward, {
    id: "reward-tournament-champion",
    grantId: "reward-tournament-champion",
    storyItems: { "seapals-championship-cup": 1 },
    fieldNoteIds: [note.id],
  });
});

test("content validation rejects generic tournament actions and broken bracket order", () => {
  const malformedAction = clone(ADVENTURE_CONTENT);
  const registration = malformedAction.scenes
    .find(({ id }) => id === "champions-wake-registration-hall")
    .world.interactions.find(({ id }) => id === CHAMPIONS_WAKE_ACTION_IDS.registration);
  registration.tournamentAction = "talk";
  let result = validateAdventureContent(malformedAction);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /tournamentAction must be registration, round, or epilogue/.test(error)));

  const missingMark = clone(ADVENTURE_CONTENT);
  missingMark.scenes
    .find(({ id }) => id === "champions-wake-registration-hall")
    .world.interactions.find(({ id }) => id === CHAMPIONS_WAKE_ACTION_IDS.registration)
    .requiredTideMarkIds.pop();
  result = validateAdventureContent(missingMark);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /five earned ecosystem Tide Marks/.test(error)));

  const skippedRound = clone(ADVENTURE_CONTENT);
  skippedRound.encounters
    .find(({ id }) => id === "encounter-tournament-final")
    .prerequisites[0].encounterId = "encounter-tournament-quarterfinal";
  result = validateAdventureContent(skippedRound);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /must require completion of encounter-tournament-semifinal/.test(error)));

  const genericTrainer = clone(ADVENTURE_CONTENT);
  delete genericTrainer.scenes
    .find(({ id }) => id === "champions-wake-arena")
    .world.interactions.find(({ id }) => id === CHAMPIONS_WAKE_ACTION_IDS.rounds[0])
    .tournamentAction;
  result = validateAdventureContent(genericTrainer);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /tournament trainer must declare tournamentAction round/.test(error)));
});
