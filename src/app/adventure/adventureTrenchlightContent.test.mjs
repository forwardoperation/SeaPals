import test from "node:test";
import assert from "node:assert/strict";

import {
  ADVENTURE_CONTENT,
  getAdventureConversation,
  getAdventureDock,
  getAdventureFieldNote,
  getAdventureNpc,
  getAdventureRoute,
  getAdventureScene,
} from "./adventureContent.mjs";
import { getAdventurePackPool } from "./adventurePacks.mjs";
import { TRENCHLIGHT_REQUIRED_OBSERVATION_IDS } from "./adventureTrenchlight.mjs";

const TRENCHLIGHT_SCENE_IDS = [
  "kelpwatch-trenchlight-sea",
  "trenchlight-station-town",
  "trenchlight-mission-control",
  "trenchlight-engineer-workshop",
  "trenchlight-tide-hall",
  "trenchlight-sub-descent",
];

test("Trenchlight has a live two-dock route and six exact runtime scenes", () => {
  const route = getAdventureRoute("route-kelpwatch-trenchlight");
  assert.deepEqual(route, {
    id: "route-kelpwatch-trenchlight",
    fromTownId: "kelpwatch-island",
    toTownId: "trenchlight-station",
    sceneId: "kelpwatch-trenchlight-sea",
    fromDockId: "kelpwatch-trenchlight-dock",
    toDockId: "trenchlight-dock",
    fromSpawn: { x: 1, y: 5, facing: "right" },
    toSpawn: { x: 14, y: 5, facing: "left" },
    manualPilotRequiredFirstTime: true,
    autoSteerAfterFirstCompletion: true,
  });
  assert.deepEqual(getAdventureDock("kelpwatch-trenchlight-dock").position, { x: 8, y: 8 });
  assert.deepEqual(getAdventureDock("trenchlight-dock").position, { x: 7, y: 8 });

  for (const sceneId of TRENCHLIGHT_SCENE_IDS) {
    const scene = getAdventureScene(sceneId);
    assert.equal(scene.status, "prototype");
    assert.ok(scene.world.artPath.endsWith(".png"));
    assert.ok(scene.world.tiles.length > 0);
    assert.ok(scene.world.tiles.every((row) => row.length === scene.world.tiles[0].length));
  }
  assert.equal(getAdventureScene("kelpwatch-trenchlight-sea").world.worldKind, "route");
  assert.equal(getAdventureScene("trenchlight-sub-descent").world.worldKind, "vehicle");
});

test("Trenchlight's five authored residents cover every ecosystem role and conversation mode", () => {
  const cast = [
    ["trenchlight-guide", "Luz", "Station Guide", "local-guide", "trenchlight-station-town"],
    ["trenchlight-scientist", "Dr. Hana Okoye", "Deep-Sea Ecologist", "field-partner", "trenchlight-mission-control"],
    ["trenchlight-engineer", "Teo", "Submersible Engineer", "resident", "trenchlight-engineer-workshop"],
    ["trenchlight-observer", "Malik", "Low-Light Observer", "town-challenger", "trenchlight-station-town"],
    ["trenchlight-leader", "Captain Elian", "Tide Steward", "reflection-character", "trenchlight-tide-hall"],
  ];

  for (const [id, name, title, roleId, sceneId] of cast) {
    const npc = getAdventureNpc(id);
    assert.equal(npc.name, name);
    assert.equal(npc.title, title);
    assert.equal(npc.roleId, roleId);
    assert.equal(npc.sceneId, sceneId);
    const conversation = getAdventureConversation(npc.conversationId);
    const requiredModes = npc.encounterId
      ? ["intro", "rematch", "victory", "return"]
      : ["intro", "guidance", "debrief", "return"];
    assert.ok(requiredModes.every((mode) => conversation.lines[mode]?.length > 0));
  }
});

test("the sub expedition content encodes the survey, analysis return, and recovery response", () => {
  const sub = getAdventureScene("trenchlight-sub-descent").world;
  const observationInteractions = sub.interactions.filter(({ type }) => type === "observation");
  assert.deepEqual(
    observationInteractions.map(({ observationId }) => observationId),
    TRENCHLIGHT_REQUIRED_OBSERVATION_IDS,
  );
  assert.equal(sub.interactions.find(({ type }) => type === "response").choiceSetId, "trenchlight-sensor-recovery-response");
  assert.equal(sub.interactions.find(({ type }) => type === "exit").targetScene, "trenchlight-mission-control");

  const control = getAdventureScene("trenchlight-mission-control").world;
  assert.equal(control.interactions.find(({ type }) => type === "interpretation").choiceSetId, "trenchlight-deep-evidence-interpretation");
  const dialogue = ADVENTURE_CONTENT.dialogues.find(({ id }) => id === "dialogue-trenchlight-sensor");
  assert.deepEqual(dialogue.beats.map(({ id }) => id), [
    "hook",
    "observation",
    "interpretation",
    "decision",
    "community-action",
    "duel",
    "debrief",
    "reflection",
    "callback",
  ]);
});

test("Life in the Deep and the Discovery Pack are complete playable rewards", () => {
  const note = getAdventureFieldNote("field-note-deep-adaptations");
  assert.equal(note.status, "prototype");
  assert.equal(note.observations.length, 5);
  assert.equal(note.checklist.length, 5);
  assert.ok(note.sourceUrls.length >= 5);
  assert.ok(note.sourceUrls.every((url) => url.startsWith("https://oceanexplorer.noaa.gov/")));

  const pool = getAdventurePackPool("pack-pool-trenchlight-deep");
  assert.equal(pool.status, "playable");
  assert.equal(pool.cardsPerPack, 4);
  assert.deepEqual(pool.cardIds, [
    "abyss",
    "bamboo_coral_base",
    "black_coral_base",
    "deep_mushroom_base",
    "bristlemouth",
    "barrel-eye-fish",
    "humpback-anglerfish",
    "giant-red-shrimp",
    "deep-sea-jelly",
    "vampire-squid",
    "deep-cucumber",
    "gulper-eel",
  ]);
});
