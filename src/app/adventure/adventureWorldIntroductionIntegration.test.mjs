import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ELVERSON_PROLOGUE_BEATS,
  ELVERSON_PROLOGUE_BEDROOM_SCENE_ID,
  ELVERSON_PROLOGUE_HOME_SCENE_ID,
  getElversonPrologueProgress,
  recordElversonPrologueBeat,
} from "./adventureElversonPrologue.mjs";
import {
  getOnboardingProgress,
  recordWorldIntroduction,
} from "./adventureOnboarding.mjs";
import {
  getAdventureScene,
  resolveAdventureNpc,
} from "./adventureContent.mjs";
import { createNewAdventureSession } from "./adventureSession.mjs";

const component = readFileSync(
  new URL("./AdventureGame.jsx", import.meta.url),
  "utf8",
).replaceAll("\r\n", "\n");

function persisted(save) {
  return JSON.parse(JSON.stringify(save));
}

function recordPersistedBeat(save, beatId) {
  const result = recordElversonPrologueBeat(save, beatId);
  assert.equal(result.applied, true);
  return persisted(result.save);
}

test("a fresh profile starts upstairs and persists the ordered home sequence before the dock kickoff", () => {
  let save = persisted(createNewAdventureSession("profile-1"));
  assert.equal(save.world.sceneId, ELVERSON_PROLOGUE_BEDROOM_SCENE_ID);

  const expectedHomeBeats = [
    [ELVERSON_PROLOGUE_BEATS.breakfast, "player-mom"],
    [ELVERSON_PROLOGUE_BEATS.permission, "player-dad"],
    [ELVERSON_PROLOGUE_BEATS.race, "player-best-friend"],
  ];

  for (const [beatId, trainerId] of expectedHomeBeats) {
    const progress = getElversonPrologueProgress(save);
    assert.equal(progress.nextBeatId, beatId);
    assert.equal(progress.homeConversation?.trainerId, trainerId);
    assert.equal(progress.homeConversation?.sceneId, ELVERSON_PROLOGUE_HOME_SCENE_ID);
    save = recordPersistedBeat(save, beatId);
  }

  const kickoffReady = getElversonPrologueProgress(save);
  assert.equal(kickoffReady.nextBeatId, ELVERSON_PROLOGUE_BEATS.challenge);
  assert.equal(kickoffReady.readyForDockSpeech, true);
  assert.equal(kickoffReady.friendVisibleInAquarium, false);

  const introduced = recordWorldIntroduction(save);
  assert.equal(introduced.applied, true);
  save = recordPersistedBeat(introduced.save, ELVERSON_PROLOGUE_BEATS.challenge);

  const accepted = getElversonPrologueProgress(save);
  assert.equal(accepted.aquariumChallengeAccepted, true);
  assert.equal(accepted.nextBeatId, ELVERSON_PROLOGUE_BEATS.starter);
  assert.equal(accepted.friendVisibleInAquarium, true);
  assert.equal(getOnboardingProgress(save).worldIntroductionComplete, true);
});

test("the opening presentation fades from the player's bedroom into Mom's face-to-face greeting", () => {
  assert.match(component, /setOpeningPrelude\("narration"\)/);
  assert.match(component, /Is it morning yet\?/);
  assert.match(component, /I feel like a great adventure awaits me this morning/);
  assert.match(component, /openingPrelude === "narration"[\s\S]*setOpeningPrelude\(\(current\) => current === "narration" \? "revealing" : null\)/);
  assert.match(component, /sceneId !== ELVERSON_PROLOGUE_HOME_SCENE_ID[\s\S]*nextBeatId !== ELVERSON_PROLOGUE_BEATS\.breakfast/);
  assert.match(component, /setMomGreetingStage\("calling"\)/);
  assert.match(component, /setMomGreetingStage\("approaching"\)/);
  assert.match(component, /ELVERSON_MOM_GREETING_POSITION/);
  assert.match(component, /facing: getAdventureFacingToward\([\s\S]*playerPosition,[\s\S]*ELVERSON_MOM_GREETING_POSITION/);
  assert.match(component, /setGameSave\(greetedSave\)/);
  assert.match(component, />Good morning, dear!</);
});

test("the dock kickoff stages the town cast, triggers by proximity, and restores free exploration after a black fade", () => {
  assert.match(component, /const dockSpeechPending = Boolean\([\s\S]*prologueProgress\.readyForDockSpeech/);
  assert.match(component, /return sceneId === "town" \? \[\.\.\.ELVERSON_DOCK_SPEECH_INTERACTIONS\] : \[\]/);
  assert.match(component, /const bestFriendLeftHome = Boolean\([\s\S]*ELVERSON_PROLOGUE_BEATS\.race/);
  assert.match(component, /bestFriendLeftHome[\s\S]*sceneId === ELVERSON_PROLOGUE_HOME_SCENE_ID[\s\S]*npcId === ELVERSON_PROLOGUE_BEST_FRIEND_ID/);
  assert.match(component, /dockSpeechPending && \["trainer", "npc"\]\.includes\(candidate\?\.type\)/);
  assert.match(component, /const candidateNpcId = candidate\?\.trainerId \?\? candidate\?\.npcId;[\s\S]*bestFriendLeftHome[\s\S]*candidateNpcId === ELVERSON_PROLOGUE_BEST_FRIEND_ID/);
  assert.match(component, /isElversonDockSpeechTriggerPosition\(position\)/);
  assert.match(component, /position: \{ \.\.\.ELVERSON_DOCK_SPEECH_PLAYER_POSITION \}[\s\S]*facing: "down"/);
  assert.match(component, /interactionId: ELVERSON_DOCK_SPEECH_INTERACTION_ID[\s\S]*mode: "worldIntroduction"[\s\S]*dockSpeech: true/);
  assert.match(component, /pendingDockSpeechSaveRef\.current = opening\.save[\s\S]*setDockCutscenePhase\("covering"\)/);
  assert.match(component, /position: \{ \.\.\.ELVERSON_DOCK_SPEECH_RESTORE_POSITION \}[\s\S]*commitAdventureMutation\([\s\S]*"elverson-dock-speech-complete"[\s\S]*setDockCutscenePhase\("revealing"\)/);
});

test("Mr. Easterling's speech advertises aquarium registration, then registration opens starter selection", () => {
  const mentor = resolveAdventureNpc("academy-mentor");
  const speech = mentor.conversation.lines.worldIntroduction;
  const registration = mentor.conversation.lines.registration;
  assert.ok(speech.some((line) => /Sea Creature Challenge/i.test(line)));
  assert.equal(
    speech.at(-1),
    "For anyone who wants to register for the Sea Creature Challenge, come see me in my aquarium!",
  );
  assert.equal(
    registration[0],
    "Oh, hello, adventurer! Have you come to register for the Sea Creature Challenge?",
  );
  assert.match(component, /if \(conversation\.mode === "registration"\) \{[\s\S]*mode: "starterPresentation"/);
  assert.match(component, /if \(conversation\.mode === "starterPresentation"\) \{[\s\S]*openStarterSelection\(\)/);

  const town = getAdventureScene("town").world;
  const aquariumEntrance = town.interactions.find(
    ({ id }) => id === "interaction-elverson-enter-aquarium",
  );
  const aquarium = getAdventureScene("academy-lab").world;
  const mentorInteraction = aquarium.interactions.find(
    ({ id }) => id === "interaction-academy-mentor",
  );
  assert.deepEqual(aquariumEntrance.spawn, { x: mentorInteraction.at.x, y: 7 });
  assert.equal(aquariumEntrance.facing, "up");
  assert.deepEqual(aquarium.spawn, aquariumEntrance.spawn);
  assert.equal(aquarium.startFacing, "up");
});

test("free exploration is available before the speech while required conversations and transitions remain protected", () => {
  const movementLock = component.slice(
    component.indexOf("  const openingFreeRoamLocked = Boolean("),
    component.indexOf("  movementPausedRef.current = movementPaused;"),
  );
  assert.match(movementLock, /prologueProgress\.needsRivalDeparture/);
  assert.doesNotMatch(movementLock, /needsHomeSequence/);
  assert.doesNotMatch(movementLock, /readyForDockSpeech/);
  assert.match(component, /doorway\?\.interactionId === "interaction-player-home-exit"[\s\S]*needsHomeSequence/);
  assert.match(component, /if \(openingPrelude \|\| momGreetingStage \|\| dockCutscenePhase\) return;/);
  assert.match(component, /conversation\?\.mode === "worldIntroduction"[\s\S]*Boolean\(conversation\?\.openingBeatId\)[\s\S]*return;/);
});
