import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");

test("overworld movement stays continuous while resolving to one visible cardinal direction", () => {
  assert.match(component, /resolveAdventureMovementInput\(overworldDirectionsRef\.current\)/);
  assert.match(component, /nextFacing = movementInput\.direction/);
  assert.match(component, /const MIN_MOVEMENT_INTENT_MS = 34/);
  assert.match(component, /releaseMovementIntent\(/);
  assert.doesNotMatch(component, /function movementVector\(/);
  assert.doesNotMatch(component, /function movementFacing\(/);
  assert.match(component, /onLostPointerCapture=/);
  assert.match(component, /if \(!visible\) clearMovement\(\)/);
});

test("doorways stage departure, covered scene swap, and arrival without a black fade", () => {
  assert.match(component, /createAdventureSceneTransition\(/);
  assert.match(component, /getAdventureSceneTransitionDurationMs\(sceneTransition\.phase/);
  assert.match(component, /applySceneTransition\(pending\.candidate, pending\.sourceSave\)/);
  assert.match(component, /advanceAdventureSceneTransition\(sceneTransition/);
  assert.match(component, /requestSceneTransition\(doorway, updated\)/);
  assert.match(component, /aria-busy=\{Boolean\(sceneTransition\)\}/);
  assert.match(component, /explorationBlocked \|\| sceneTransition \|\| conversationLeadIn/);
  assert.match(component, /inert=\{gameplaySurfaceLocked\}/);
  assert.match(component, /sceneTransitionCurtain/);
  assert.match(styles, /\.sceneTransitionDeparting \.sceneTransitionLeft/);
  assert.match(styles, /\.sceneTransitionArriving \.sceneTransitionRight/);
  assert.match(styles, /@keyframes playerDoorDepart/);
  assert.match(styles, /@keyframes playerDoorArrive/);
  assert.doesNotMatch(styles, /sceneCurtain(?:Left|Right)(?:Close|Open)[\s\S]{0,180}opacity:/);
});

test("talk keeps the town visible and NPC rendering aligned with interaction geometry", () => {
  assert.match(styles, /\.dialogueLayer\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?backdrop-filter:\s*none;/);
  assert.match(styles, /\.npcCell\s*\{[\s\S]*?transition:\s*none;/);
  assert.match(component, /focusAdventureActor\(/);
  assert.match(component, /activeConversationInteractionId === characterInteraction\.id/);
});

test("menu panels share restrained motion and every new animation honors reduced motion", () => {
  assert.match(styles, /\.pauseCard,[\s\S]*?animation:\s*menuPanelIn/);
  assert.match(styles, /\.worldMapCard,[\s\S]*?animation:\s*menuPanelIn/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.playerSceneDeparting,[\s\S]*?\.sceneTransitionLeft,[\s\S]*?\.pauseCard,/);
  assert.match(styles, /\.reducedMotionMode \*,[\s\S]*?animation:\s*none\s*!important;/);
});
