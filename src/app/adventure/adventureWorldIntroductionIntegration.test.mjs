import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ELVERSON_PROLOGUE_BEATS,
  ELVERSON_PROLOGUE_HOME_SCENE_ID,
  getElversonPrologueProgress,
  recordElversonPrologueBeat,
} from "./adventureElversonPrologue.mjs";
import {
  getOnboardingProgress,
  recordWorldIntroduction,
} from "./adventureOnboarding.mjs";
import { createNewAdventureSession } from "./adventureSession.mjs";

const component = readFileSync(
  new URL("./AdventureGame.jsx", import.meta.url),
  "utf8",
).replaceAll("\r\n", "\n");
const content = readFileSync(
  new URL("./adventureContent.mjs", import.meta.url),
  "utf8",
).replaceAll("\r\n", "\n");

function sourceBetween(startMarker, endMarker) {
  const start = component.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  const end = component.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return component.slice(start, end);
}

function persisted(save) {
  return JSON.parse(JSON.stringify(save));
}

function recordPersistedBeat(save, beatId) {
  const result = recordElversonPrologueBeat(save, beatId);
  assert.equal(result.applied, true);
  return persisted(result.save);
}

test("a fresh profile persists the ordered birthday-home sequence before the aquarium challenge", () => {
  let save = persisted(createNewAdventureSession("profile-1"));
  assert.equal(save.world.sceneId, ELVERSON_PROLOGUE_HOME_SCENE_ID);

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

  const raceReady = getElversonPrologueProgress(save);
  assert.equal(raceReady.nextBeatId, ELVERSON_PROLOGUE_BEATS.challenge);
  assert.equal(raceReady.readyForAquariumRace, true);
  assert.equal(raceReady.friendVisibleInAquarium, true);

  const introduced = recordWorldIntroduction(save);
  assert.equal(introduced.applied, true);
  save = recordPersistedBeat(introduced.save, ELVERSON_PROLOGUE_BEATS.challenge);

  const accepted = getElversonPrologueProgress(save);
  assert.equal(accepted.aquariumChallengeAccepted, true);
  assert.equal(accepted.nextBeatId, ELVERSON_PROLOGUE_BEATS.starter);
  assert.equal(accepted.friendVisibleInAquarium, true);
  assert.equal(getOnboardingProgress(save).worldIntroductionComplete, true);
});

test("the persisted home beats automatically chain into the birthday race and exterior challenge", () => {
  const homeOpening = sourceBetween(
    "  useEffect(() => {\n    const homeConversation = prologueProgress?.homeConversation;",
    "  useEffect(() => {\n    const freshOpeningReady = prologueProgress?.readyForAquariumRace;",
  );
  assert.match(homeOpening, /sceneId !== ELVERSON_PROLOGUE_HOME_SCENE_ID/);
  assert.match(homeOpening, /clearMovement\(\);/);
  assert.match(
    homeOpening,
    /setConversation\(\{\s*\.\.\.homeConversation,\s*openingBeatId: prologueProgress\.nextBeatId,\s*index: 0,/,
  );

  const homeTransition = sourceBetween(
    "const ELVERSON_HOME_GUIDED_TRANSITION",
    "const ELVERSON_OPENING_MENTOR_INTERACTION",
  );
  assert.match(homeTransition, /interactionId: "guided-birthday-race-to-aquarium"/);
  assert.match(homeTransition, /targetScene: "town"/);
  assert.match(homeTransition, /spawn: ELVERSON_TOWN_SAFE_POSITIONS\.aquariumExterior/);

  const automaticOpening = sourceBetween(
    "  useEffect(() => {\n    const freshOpeningReady = prologueProgress?.readyForAquariumRace;",
    "  useEffect(() => {\n    if (\n      screen !== \"playing\"\n      || !gameSave\n      || sceneId !== ELVERSON_PROLOGUE_AQUARIUM_SCENE_ID",
  );
  assert.match(automaticOpening, /const legacyIntroductionReady = prologueProgress\?\.legacySkipped/);
  assert.match(automaticOpening, /clearMovement\(\);/);
  assert.equal(automaticOpening.match(/mode: "worldIntroduction"/g)?.length, 1);
  assert.match(
    automaticOpening,
    /if \(freshOpeningReady && sceneId === ELVERSON_PROLOGUE_HOME_SCENE_ID\) \{[\s\S]*requestSceneTransition\(\s*ELVERSON_HOME_GUIDED_TRANSITION,\s*saveRef\.current \?\? gameSave,\s*\{ afterArrivalConversation: worldIntroduction \},/,
  );
  assert.match(automaticOpening, /if \(sceneId === "town"\) setConversation\(worldIntroduction\);/);
});

test("accepting the challenge persists its beat before opening the authored aquarium interior intro", () => {
  const guidedTransition = sourceBetween(
    "const ELVERSON_AQUARIUM_GUIDED_TRANSITION",
    "const ELVERSON_HOME_GUIDED_TRANSITION",
  );
  assert.match(guidedTransition, /SCENES\.town\.interactions\.find/);
  assert.match(guidedTransition, /id === "interaction-elverson-enter-aquarium"/);
  assert.match(guidedTransition, /type: "guided"/);
  assert.match(guidedTransition, /targetScene: entrance\.targetScene/);
  assert.match(guidedTransition, /spawn: entrance\.spawn/);

  const completion = sourceBetween(
    '    if (conversation.mode === "worldIntroduction") {',
    '    if (conversation.mode === "intro") {',
  );
  assert.match(completion, /const introduced = recordWorldIntroduction\(current\);/);
  assert.match(
    completion,
    /recordElversonPrologueBeat\(\s*introduced\.save,\s*ELVERSON_PROLOGUE_BEATS\.challenge,/,
  );
  assert.match(
    completion,
    /if \(introduced\.applied \|\| opening\.applied\) \{[\s\S]*commitAdventureMutation\(\s*opening\.save,\s*"elverson-aquarium-challenge-accepted"/,
  );
  assert.match(
    completion,
    /requestSceneTransition\(\s*ELVERSON_AQUARIUM_GUIDED_TRANSITION,\s*opening\.save,\s*\{[\s\S]*afterArrivalConversation:[\s\S]*interactionId: ACADEMY_MENTOR_INTERACTION_ID,[\s\S]*mode: "intro"/,
  );

  const arrival = sourceBetween(
    "      const pending = pendingSceneTransitionRef.current;\n      pendingSceneTransitionRef.current = null;",
    "  useEffect(() => {\n    if (!conversationLeadIn)",
  );
  assert.match(arrival, /if \(pending\?\.afterArrivalConversation\)/);
  assert.match(
    arrival,
    /setConversationLeadIn\(\{\s*\.\.\.pending\.afterArrivalConversation,\s*\.\.\.origin,/,
  );
});

test("the exterior mentor and aquarium friend are transient story-stage actors", () => {
  const stagedActors = sourceBetween(
    "const ELVERSON_OPENING_MENTOR_INTERACTION_ID",
    "const ELVERSON_FISHING_TUTORIAL_SESSION",
  );
  assert.match(stagedActors, /id: ELVERSON_OPENING_MENTOR_INTERACTION_ID/);
  assert.match(stagedActors, /npcId: ACADEMY_MENTOR_ID/);
  assert.match(stagedActors, /x: aquariumExit\.spawn\.x \+ 1/);
  assert.match(stagedActors, /const ELVERSON_RIVAL_AQUARIUM_INTERACTION/);
  assert.match(stagedActors, /id: ELVERSON_RIVAL_DEPARTURE_CONVERSATION\.interactionId/);
  assert.match(stagedActors, /npcId: ELVERSON_PROLOGUE_BEST_FRIEND_ID/);

  const sceneActors = sourceBetween(
    "  const worldIntroductionConversationActive",
    "  const anchoredActorStates = useMemo(",
  );
  assert.match(sceneActors, /const openingMentorReady = prologueProgress\?\.legacySkipped/);
  assert.match(sceneActors, /const stageOpeningMentor = sceneId === "town"/);
  assert.match(sceneActors, /if \(stageOpeningMentor\) interactions\.push\(ELVERSON_OPENING_MENTOR_INTERACTION\);/);
  assert.match(
    sceneActors,
    /sceneId === ELVERSON_PROLOGUE_AQUARIUM_SCENE_ID[\s\S]*prologueProgress\?\.friendVisibleInAquarium[\s\S]*interactions\.push\(ELVERSON_RIVAL_AQUARIUM_INTERACTION\);/,
  );

  assert.doesNotMatch(
    content,
    /interaction-elverson-opening-mentor/,
    "the exterior mentor must not become a permanent town resident or collision",
  );
  assert.doesNotMatch(
    content,
    /interaction-elverson-rival-aquarium/,
    "the best friend's aquarium appearance must remain story-stage controlled",
  );
});

test("Escape and movement cannot bypass any required opening conversation", () => {
  const movementLock = sourceBetween(
    "  const openingFreeRoamLocked = Boolean(",
    "  movementPausedRef.current = movementPaused;",
  );
  assert.match(movementLock, /!prologueProgress\.legacySkipped/);
  assert.match(movementLock, /!prologueProgress\.complete/);
  assert.match(movementLock, /prologueProgress\.needsHomeSequence/);
  assert.match(movementLock, /prologueProgress\.readyForAquariumRace/);
  assert.match(movementLock, /prologueProgress\.needsRivalDeparture/);
  assert.match(movementLock, /const movementPaused = screen !== "playing"\s*\|\| openingFreeRoamLocked/);

  const escapeHandler = sourceBetween(
    "  escapeRef.current = () => {",
    "  useEffect(() => {\n    function onKeyDown",
  );
  assert.match(
    escapeHandler,
    /conversation\?\.mode === "worldIntroduction"\s*\|\| Boolean\(conversation\?\.openingBeatId\)[\s\S]*return;/,
  );
  assert.match(
    escapeHandler,
    /else if \(conversation\) \{\s*closeConversation\(\);/,
  );
});
