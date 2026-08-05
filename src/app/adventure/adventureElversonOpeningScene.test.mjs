import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVENTURE_CONTENT,
  resolveAdventureNpc,
} from "./adventureContent.mjs";
import {
  ELVERSON_DOCK_SPEECH_INTERACTION_ID,
  ELVERSON_DOCK_SPEECH_PLAYER_POSITION,
  ELVERSON_DOCK_SPEECH_RESTORE_POSITION,
  ELVERSON_DOCK_SPEECH_TRIGGER,
  createElversonDockSpeechInteractions,
  isElversonDockSpeechTriggerPosition,
} from "./adventureElversonOpeningScene.mjs";
import { canOccupyContinuousPosition } from "./adventureWorld.mjs";

const elversonNpcIds = ADVENTURE_CONTENT.npcs
  .filter((npc) => npc.townId === "shellshore-village")
  .map((npc) => npc.id);

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
