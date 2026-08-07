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

test("a named fresh profile starts upstairs, meets family indoors, then meets the best friend outside", () => {
  let save = persisted(createNewAdventureSession("profile-1", {
    playerName: "Kai",
    bestFriendName: "Mira",
  }));
  assert.equal(save.world.sceneId, ELVERSON_PROLOGUE_BEDROOM_SCENE_ID);
  assert.equal(save.player.name, "Kai");
  assert.equal(save.player.bestFriendName, "Mira");

  const expectedHomeBeats = [
    [ELVERSON_PROLOGUE_BEATS.breakfast, "player-mom"],
    [ELVERSON_PROLOGUE_BEATS.permission, "player-dad"],
  ];

  for (const [beatId, trainerId] of expectedHomeBeats) {
    const progress = getElversonPrologueProgress(save);
    assert.equal(progress.nextBeatId, beatId);
    assert.equal(progress.homeConversation?.trainerId, trainerId);
    assert.equal(progress.homeConversation?.sceneId, ELVERSON_PROLOGUE_HOME_SCENE_ID);
    save = recordPersistedBeat(save, beatId);
  }

  const outsideMeeting = getElversonPrologueProgress(save);
  assert.equal(outsideMeeting.nextBeatId, ELVERSON_PROLOGUE_BEATS.race);
  assert.equal(outsideMeeting.homeConversation?.trainerId, "player-best-friend");
  assert.equal(outsideMeeting.homeConversation?.sceneId, "town");
  assert.equal(outsideMeeting.needsHomeSequence, false);
  assert.equal(outsideMeeting.needsBestFriendArrival, true);
  save = recordPersistedBeat(save, ELVERSON_PROLOGUE_BEATS.race);

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

test("the opening introduces SeaPals, names both children, then stages Mom's cardinal face-to-face greeting", () => {
  assert.match(component, /function OpeningSetupModal/);
  assert.match(component, /This world is full of wonderful sea creatures\. Around here, we call them/);
  assert.match(component, /<strong> SeaPals<\/strong>/);
  assert.match(component, /What is your name\?/);
  assert.match(component, /What is your best friend/);
  assert.match(component, /normalizeAdventureCharacterName/);
  assert.match(component, /createNewAdventureSession\(profileId, identity\)/);
  assert.match(component, /setOpeningPrelude\("narration"\)/);
  assert.match(component, /Is it morning yet\?/);
  assert.match(component, /I feel like a great adventure awaits me this morning/);
  assert.match(component, /openingPrelude === "narration"[\s\S]*setOpeningPrelude\(\(current\) => current === "narration" \? "revealing" : null\)/);
  assert.match(component, /sceneId !== ELVERSON_PROLOGUE_HOME_SCENE_ID[\s\S]*nextBeatId !== ELVERSON_PROLOGUE_BEATS\.breakfast/);
  assert.match(component, /setMomGreetingStage\("calling"\)/);
  assert.match(component, /setMomGreetingStage\("approaching"\)/);
  assert.match(component, /path: ELVERSON_MOM_GREETING_PATH/);
  assert.match(component, /facing: getAdventureFacingToward\([\s\S]*playerPosition,[\s\S]*ELVERSON_MOM_GREETING_POSITION/);
  assert.match(component, /setGameSave\(greetedSave\)/);
  assert.match(component, /dialogueIdentity\.playerName\}! Good morning!/);
});

test("the exterior arrival calls the player's name, walks in from the right, and escorts to the dock before recording the race beat", () => {
  assert.match(component, /const bestFriendArrivalPending = Boolean\([\s\S]*needsBestFriendArrival[\s\S]*sceneId === "town"/);
  assert.match(component, /interactions\.push\(ELVERSON_BEST_FRIEND_ARRIVAL_INTERACTION\)/);
  assert.match(component, /setBestFriendSequence\(\{ phase: "calling", plan: null \}\)/);
  assert.match(component, /bestFriendSequence\?\.phase === "calling"[\s\S]*dialogueIdentity\.playerName\}!!/);
  assert.match(component, /path: ELVERSON_BEST_FRIEND_ARRIVAL_PATH/);
  assert.match(component, /position: \{ \.\.\.ELVERSON_BEST_FRIEND_MEETING_POSITION \}[\s\S]*facing: "left"/);
  assert.match(component, /position: \{ \.\.\.ELVERSON_TOWN_SAFE_POSITIONS\.playerHomeExterior \}[\s\S]*facing: "right"/);
  assert.match(component, /escortToDock: true/);
  assert.match(component, /path: ELVERSON_BEST_FRIEND_DOCK_WALK\.leader[\s\S]*followerPath: ELVERSON_BEST_FRIEND_DOCK_WALK\.follower/);
  assert.match(component, /phase === "escorting"[\s\S]*position: \{ \.\.\.sample\.follower\.position \}/);
  assert.match(component, /recordElversonPrologueBeat\([\s\S]*ELVERSON_PROLOGUE_BEATS\.race[\s\S]*elverson-opening:best-friend-dock-escort/);
  assert.match(component, /!dockSpeechPending[\s\S]*bestFriendSequence/);
});

test("the dock kickoff stages the town cast and restores exploration after its black fade", () => {
  assert.match(component, /const dockSpeechPending = Boolean\([\s\S]*prologueProgress\.readyForDockSpeech/);
  assert.match(component, /return sceneId === "town" \? \[\.\.\.ELVERSON_DOCK_SPEECH_INTERACTIONS\] : \[\]/);
  assert.match(component, /sceneId === ELVERSON_PROLOGUE_HOME_SCENE_ID[\s\S]*npcId === ELVERSON_PROLOGUE_BEST_FRIEND_ID/);
  assert.match(component, /dockSpeechPending && \["trainer", "npc"\]\.includes\(candidate\?\.type\)/);
  assert.match(component, /const candidateNpcId = candidate\?\.trainerId \?\? candidate\?\.npcId;[\s\S]*candidateNpcId === ELVERSON_PROLOGUE_BEST_FRIEND_ID/);
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

test("input stays frozen through authored arrivals and escorts while required conversations and transitions remain protected", () => {
  const movementLock = component.slice(
    component.indexOf("  const openingFreeRoamLocked = Boolean("),
    component.indexOf("  movementPausedRef.current = movementPaused;"),
  );
  assert.match(movementLock, /prologueProgress\.needsRivalDeparture/);
  assert.doesNotMatch(movementLock, /needsHomeSequence/);
  assert.doesNotMatch(movementLock, /readyForDockSpeech/);
  assert.match(movementLock, /Boolean\(bestFriendSequence\)/);
  assert.match(component, /doorway\?\.interactionId === "interaction-player-home-exit"[\s\S]*needsHomeSequence/);
  assert.match(component, /if \(openingPrelude \|\| momGreetingStage \|\| bestFriendSequence \|\| dockCutscenePhase\) return;/);
  assert.match(component, /openingFreeRoamLocked \|\| openingPrelude \|\| momGreetingStage \|\| bestFriendSequence \|\| dockCutscenePhase/);
  assert.match(component, /actorIsScriptedWalker[\s\S]*movementPaused: movementPaused && !actorIsScriptedWalker/);
  assert.match(component, /conversation\?\.mode === "worldIntroduction"[\s\S]*Boolean\(conversation\?\.openingBeatId\)[\s\S]*return;/);
});
