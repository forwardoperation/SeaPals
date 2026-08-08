import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ADVENTURE_CONTENT,
  resolveAdventureNpc,
} from "./adventureContent.mjs";
import {
  ELVERSON_BEST_FRIEND_ARRIVAL_INTERACTION_ID,
  ELVERSON_BEST_FRIEND_ARRIVAL_PATH,
  ELVERSON_BEST_FRIEND_ARRIVAL_POSITION,
  ELVERSON_BEST_FRIEND_DOCK_WALK,
  ELVERSON_BEST_FRIEND_MEETING_POSITION,
  ELVERSON_DOCK_SPEECH_CAMERA_POSITION,
  ELVERSON_DOCK_SPEECH_INTERACTION_ID,
  ELVERSON_DOCK_SPEECH_MENTOR_POSITION,
  ELVERSON_DOCK_SPEECH_PLAYER_POSITION,
  ELVERSON_DOCK_SPEECH_RESTORE_POSITION,
  ELVERSON_DOCK_SPEECH_TRIGGER,
  ELVERSON_MOM_GREETING_PATH,
  ELVERSON_MOM_GREETING_POSITION,
  createElversonDockSpeechInteractions,
  isElversonDockSpeechTriggerPosition,
} from "./adventureElversonOpeningScene.mjs";
import { getAdventureCameraLayout } from "./adventureCamera.mjs";
import { ELVERSON_TOWN_SAFE_POSITIONS } from "./adventureElversonTownLayout.mjs";
import { canOccupyContinuousPosition, SCENES } from "./adventureWorld.mjs";

const adventureStyles = readFileSync(
  new URL("./adventure.module.css", import.meta.url),
  "utf8",
);

function getSpriteArtworkCellBounds() {
  const rule = adventureStyles.match(/\.spriteArtwork\s*\{([\s\S]*?)\}/)?.[1];
  assert.ok(rule, "the shared sprite artwork rule must exist");
  const readPercent = (property) => {
    const value = rule.match(new RegExp(`${property}:\\s*([\\d.]+)%`))?.[1];
    assert.ok(value, `the shared sprite artwork rule must define ${property} as a percentage`);
    return Number(value) / 100;
  };
  const left = readPercent("left");
  const width = readPercent("width");
  const height = readPercent("height");
  const bottom = readPercent("bottom");
  return Object.freeze({
    left,
    top: 1 - bottom - height,
    right: left + width,
    bottom: 1 - bottom,
  });
}

const elversonNpcIds = ADVENTURE_CONTENT.npcs
  .filter((npc) => npc.townId === "shellshore-village")
  .map((npc) => npc.id);

function assertPathIsSafe(sceneId, path, label) {
  assert.ok(Array.isArray(path) && path.length >= 2, `${label} needs at least two points`);
  for (let segmentIndex = 0; segmentIndex < path.length - 1; segmentIndex += 1) {
    const start = path[segmentIndex];
    const end = path[segmentIndex + 1];
    for (let sampleIndex = 0; sampleIndex <= 40; sampleIndex += 1) {
      const progress = sampleIndex / 40;
      const position = {
        x: start.x + ((end.x - start.x) * progress),
        y: start.y + ((end.y - start.y) * progress),
      };
      assert.equal(
        canOccupyContinuousPosition(sceneId, position, 0.22, { ignoreActorTiles: true }),
        true,
        `${label} segment ${segmentIndex} must stay clear at ${JSON.stringify(position)}`,
      );
    }
  }
}

test("Mom approaches on a cardinal right-then-up path and stops beside the player", () => {
  assert.deepEqual(ELVERSON_MOM_GREETING_PATH, [
    { x: 4.75, y: 4.55 },
    { x: 6.15, y: 4.55 },
    ELVERSON_MOM_GREETING_POSITION,
  ]);
  assert.ok(ELVERSON_MOM_GREETING_PATH[1].x > ELVERSON_MOM_GREETING_PATH[0].x);
  assert.equal(ELVERSON_MOM_GREETING_PATH[1].y, ELVERSON_MOM_GREETING_PATH[0].y);
  assert.equal(ELVERSON_MOM_GREETING_PATH[2].x, ELVERSON_MOM_GREETING_PATH[1].x);
  assert.ok(ELVERSON_MOM_GREETING_PATH[2].y < ELVERSON_MOM_GREETING_PATH[1].y);
  assert.deepEqual(ELVERSON_MOM_GREETING_POSITION, { x: 6.15, y: 3.55 });
  assertPathIsSafe("player-home", ELVERSON_MOM_GREETING_PATH, "Mom greeting path");
});

test("the best friend enters from the right, meets face-to-face, and escorts along safe dock paths", () => {
  assert.equal(
    ELVERSON_BEST_FRIEND_ARRIVAL_INTERACTION_ID,
    "interaction-elverson-best-friend-arrival",
  );
  assert.deepEqual(ELVERSON_BEST_FRIEND_ARRIVAL_PATH[0], ELVERSON_BEST_FRIEND_ARRIVAL_POSITION);
  assert.deepEqual(ELVERSON_BEST_FRIEND_ARRIVAL_PATH.at(-1), ELVERSON_BEST_FRIEND_MEETING_POSITION);
  assert.ok(ELVERSON_BEST_FRIEND_ARRIVAL_POSITION.x > 10.5, "arrival begins beyond the opening camera's right edge");
  assert.equal(
    ELVERSON_BEST_FRIEND_MEETING_POSITION.y,
    ELVERSON_TOWN_SAFE_POSITIONS.playerHomeExterior.y,
  );
  assert.ok(
    ELVERSON_BEST_FRIEND_MEETING_POSITION.x > ELVERSON_TOWN_SAFE_POSITIONS.playerHomeExterior.x,
    "the friend must stop to the player's right for eye contact",
  );
  assert.ok(
    ELVERSON_BEST_FRIEND_MEETING_POSITION.x - ELVERSON_TOWN_SAFE_POSITIONS.playerHomeExterior.x <= 1,
    "the face-to-face stopping distance stays conversational",
  );

  assert.deepEqual(
    ELVERSON_BEST_FRIEND_DOCK_WALK.leader[0],
    ELVERSON_BEST_FRIEND_MEETING_POSITION,
  );
  assert.deepEqual(
    ELVERSON_BEST_FRIEND_DOCK_WALK.follower[0],
    ELVERSON_TOWN_SAFE_POSITIONS.playerHomeExterior,
  );
  assert.deepEqual(
    ELVERSON_BEST_FRIEND_DOCK_WALK.follower.at(-1),
    ELVERSON_DOCK_SPEECH_PLAYER_POSITION,
  );
  assert.equal(
    isElversonDockSpeechTriggerPosition(ELVERSON_BEST_FRIEND_DOCK_WALK.follower.at(-1)),
    true,
  );

  assertPathIsSafe("town", ELVERSON_BEST_FRIEND_ARRIVAL_PATH, "best-friend arrival path");
  assertPathIsSafe("town", ELVERSON_BEST_FRIEND_DOCK_WALK.leader, "best-friend dock path");
  assertPathIsSafe("town", ELVERSON_BEST_FRIEND_DOCK_WALK.follower, "player dock path");
});

test("the dock kickoff stages every Elverson NPC in unique safe waterfront positions", () => {
  const interactions = createElversonDockSpeechInteractions(elversonNpcIds);
  assert.equal(interactions.length, elversonNpcIds.length);
  assert.equal(interactions[0].id, ELVERSON_DOCK_SPEECH_INTERACTION_ID);
  assert.equal(interactions[0].npcId, "academy-mentor");
  assert.equal(new Set(interactions.map(({ id }) => id)).size, interactions.length);
  assert.equal(new Set(interactions.map(({ npcId }) => npcId)).size, interactions.length);

  for (const interaction of interactions) {
    assert.equal(
      canOccupyContinuousPosition("town", interaction.at, 0.18),
      true,
      `${interaction.npcId} must have a safe crowd mark`,
    );
  }
  assert.equal(canOccupyContinuousPosition("town", ELVERSON_DOCK_SPEECH_PLAYER_POSITION), true);
  assert.equal(canOccupyContinuousPosition("town", ELVERSON_DOCK_SPEECH_RESTORE_POSITION), true);
});

test("the dock speech camera keeps both actors above the bottom dialogue overlay", () => {
  const townScene = SCENES.town;
  const artworkCellBounds = getSpriteArtworkCellBounds();
  const camera = getAdventureCameraLayout({
    worldWidth: townScene.width,
    worldHeight: townScene.height,
    playerX: ELVERSON_DOCK_SPEECH_CAMERA_POSITION.x,
    playerY: ELVERSON_DOCK_SPEECH_CAMERA_POSITION.y,
  });
  const visibleBounds = {
    left: camera.originX,
    top: camera.originY,
    right: camera.originX + camera.viewWidth,
    bottom: camera.originY + camera.viewHeight,
  };
  const dialogueSafeFrame = {
    top: 0.04,
    bottom: 0.76,
  };

  for (const [label, position] of [
    ["player", ELVERSON_DOCK_SPEECH_PLAYER_POSITION],
    ["Mr. Easterling", ELVERSON_DOCK_SPEECH_MENTOR_POSITION],
  ]) {
    const artworkBounds = {
      left: position.x + artworkCellBounds.left,
      top: position.y + artworkCellBounds.top,
      right: position.x + artworkCellBounds.right,
      bottom: position.y + artworkCellBounds.bottom,
    };
    assert.ok(artworkBounds.left >= visibleBounds.left, `${label} artwork left edge must be visible`);
    assert.ok(artworkBounds.right <= visibleBounds.right, `${label} artwork right edge must be visible`);
    assert.ok(artworkBounds.top >= visibleBounds.top, `${label} artwork top edge must be visible`);
    assert.ok(artworkBounds.bottom <= visibleBounds.bottom, `${label} artwork bottom edge must be visible`);
    const screenTop = (artworkBounds.top - camera.originY) / camera.viewHeight;
    const screenBottom = (artworkBounds.bottom - camera.originY) / camera.viewHeight;
    assert.ok(screenTop >= dialogueSafeFrame.top, `${label} must clear the top crop`);
    assert.ok(
      screenBottom <= dialogueSafeFrame.bottom,
      `${label} must stay above the fixed bottom dialogue box`,
    );
  }
});

test("the dock gathering leaves safe capacity for future Elverson residents", () => {
  const futureCast = [
    "academy-mentor",
    ...Array.from({ length: 45 }, (_, index) => `future-resident-${index + 1}`),
  ];
  const interactions = createElversonDockSpeechInteractions(futureCast);
  assert.equal(interactions.length, futureCast.length);
  assert.equal(new Set(interactions.map(({ id }) => id)).size, futureCast.length);
  assert.ok(interactions.every(({ at }) => canOccupyContinuousPosition("town", at, 0.18)));
});

test("the dock trigger starts only inside the authored waterfront approach", () => {
  assert.equal(isElversonDockSpeechTriggerPosition({
    x: ELVERSON_DOCK_SPEECH_TRIGGER.left,
    y: ELVERSON_DOCK_SPEECH_TRIGGER.top,
  }), true);
  assert.equal(isElversonDockSpeechTriggerPosition({
    x: ELVERSON_DOCK_SPEECH_TRIGGER.right,
    y: ELVERSON_DOCK_SPEECH_TRIGGER.bottom,
  }), true);
  assert.equal(isElversonDockSpeechTriggerPosition({
    x: ELVERSON_DOCK_SPEECH_TRIGGER.left - 0.01,
    y: ELVERSON_DOCK_SPEECH_TRIGGER.top,
  }), false);
  assert.equal(isElversonDockSpeechTriggerPosition({ x: 20.5, y: 16.2 }), false);
  assert.equal(isElversonDockSpeechTriggerPosition(null), false);
});

test("Mr. Easterling closes the public speech with the aquarium registration invitation", () => {
  const mentor = resolveAdventureNpc("academy-mentor");
  assert.match(
    mentor.conversation.lines.worldIntroduction.at(-1),
    /register for the Sea Creature Challenge.*come see me in my aquarium/i,
  );
  assert.match(
    mentor.conversation.lines.registration[0],
    /hello, adventurer.*register for the Sea Creature Challenge/i,
  );
});
