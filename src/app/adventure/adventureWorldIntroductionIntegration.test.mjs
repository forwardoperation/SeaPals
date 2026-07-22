import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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

test("a pending world introduction automatically opens exactly one blocking mentor conversation", () => {
  const automaticOpening = sourceBetween(
    '  useEffect(() => {\n    if (\n      screen !== "playing"\n      || !gameSave\n      || !onboardingProgress?.needsWorldIntroduction',
    "  function beginNewGame",
  );

  assert.match(automaticOpening, /\|\| conversation\s+\|\| conversationLeadIn/);
  assert.match(automaticOpening, /\|\| activeTrainerId\s+\|\| sceneTransition/);
  assert.match(automaticOpening, /clearMovement\(\);/);
  assert.equal(
    automaticOpening.match(/mode: "worldIntroduction"/g)?.length,
    1,
  );
  assert.match(
    automaticOpening,
    /setConversation\(\{\s*trainerId: ACADEMY_MENTOR_ID,\s*sceneId: "town",\s*interactionId: ELVERSON_OPENING_MENTOR_INTERACTION_ID,\s*index: 0,\s*mode: "worldIntroduction",\s*\}\);/,
  );
  assert.match(
    automaticOpening,
    /onboardingProgress\?\.needsWorldIntroduction,[\s\S]*screen,[\s\S]*worldMapOpen,/,
  );
});

test("the opening stages one transient exterior mentor beside the aquarium approach", () => {
  const stagedActor = sourceBetween(
    "const ELVERSON_OPENING_MENTOR_INTERACTION_ID",
    "const SHELLSHORE_TUTORIAL",
  );
  assert.match(
    stagedActor,
    /const ELVERSON_OPENING_MENTOR_INTERACTION_ID = "interaction-elverson-opening-mentor"/,
  );
  assert.match(stagedActor, /id === "interaction-academy-exit"/);
  assert.match(stagedActor, /type: "npc"/);
  assert.match(stagedActor, /npcId: ACADEMY_MENTOR_ID/);
  assert.match(stagedActor, /x: aquariumExit\.spawn\.x \+ 1/);
  assert.match(stagedActor, /y: aquariumExit\.spawn\.y/);
  assert.match(stagedActor, /facing: "left"/);

  const sceneActors = sourceBetween(
    '  const scene = SCENES[sceneId];',
    "  const anchoredActorStates = useMemo(",
  );
  assert.match(sceneActors, /const stageOpeningMentor = sceneId === "town"/);
  assert.match(sceneActors, /onboardingProgress\?\.needsWorldIntroduction/);
  assert.match(sceneActors, /worldIntroductionConversationActive/);
  assert.match(
    sceneActors,
    /sceneTransition\?\.type === "guided"[\s\S]*sceneTransition\.interactionId === ELVERSON_AQUARIUM_GUIDED_TRANSITION\.interactionId/,
  );
  assert.match(
    sceneActors,
    /\? \[\.\.\.authoredInteractions, ELVERSON_OPENING_MENTOR_INTERACTION\]\s*: authoredInteractions/,
  );

  assert.doesNotMatch(
    content,
    /interaction-elverson-opening-mentor/,
    "the staged actor must not become a permanent Elverson resident or collision",
  );
});

test("completing the opening walks through the aquarium door and opens the authored aquarium intro", () => {
  const guidedTransition = sourceBetween(
    "const ELVERSON_AQUARIUM_GUIDED_TRANSITION",
    "const SHELLSHORE_TUTORIAL",
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
  assert.match(completion, /recordWorldIntroduction\(current\)/);
  assert.match(
    completion,
    /if \(introduced\.applied\) \{[\s\S]*commitAdventureMutation\([\s\S]*"world-introduction-complete"/,
  );
  assert.match(
    completion,
    /requestSceneTransition\(\s*ELVERSON_AQUARIUM_GUIDED_TRANSITION,\s*introduced\.save,\s*\{[\s\S]*afterArrivalConversation:[\s\S]*interactionId: ACADEMY_MENTOR_INTERACTION_ID,[\s\S]*mode: "intro"/,
  );

  const arrival = sourceBetween(
    "      const pending = pendingSceneTransitionRef.current;\n      pendingSceneTransitionRef.current = null;",
    "  useEffect(() => {\n    if (!conversationLeadIn)",
  );
  assert.match(arrival, /if \(pending\?\.afterArrivalConversation\)/);
  assert.match(arrival, /setConversationLeadIn\(\{\s*\.\.\.pending\.afterArrivalConversation,\s*\.\.\.origin,/);
});

test("Escape cannot dismiss the required world introduction", () => {
  const escapeHandler = sourceBetween(
    "  escapeRef.current = () => {",
    "  useEffect(() => {\n    function onKeyDown",
  );

  assert.match(
    escapeHandler,
    /else if \(conversation\?\.mode === "worldIntroduction"\) \{\s*return;\s*\} else if \(conversation\) \{\s*closeConversation\(\);/,
  );
});
