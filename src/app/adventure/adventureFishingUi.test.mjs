import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const game = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");
const modal = readFileSync(new URL("./AdventureHandNetModal.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");
const residents = readFileSync(new URL("./adventureElversonResidents.mjs", import.meta.url), "utf8");
const exhibits = readFileSync(new URL("./adventureAquariumExhibits.mjs", import.meta.url), "utf8");

test("Elverson shore input, Wyeth's lesson, catch saving, and Easterling delivery use the hand-net flow", () => {
  assert.match(game, /getElversonHandNetInteraction\(sceneId, position, facing\)/);
  assert.match(game, /beginElversonHandNetTutorial\(current\)/);
  assert.match(game, /recordElversonHandNetTutorialCatch\(current, creatureId\)/);
  assert.match(game, /recordElversonHandNetCatch\(current, creatureId\)/);
  assert.match(game, /deliverElversonHandNetCatches\(current\)/);
  assert.match(game, /<AdventureHandNetModal[\s\S]*?onCatch=\{saveFishingCatch\}/);
  assert.match(residents, /good old-fashioned hand net/);
  assert.match(residents, /small reef fish under twelve inches long/);
  assert.doesNotMatch(modal, /fishing rod|cast a line|set the hook|reel/i);
});

test("the modal is a top-down shallow-water stealth-and-scoop game", () => {
  assert.match(modal, /createHandNetState/);
  assert.match(modal, /tickHandNetState/);
  assert.match(modal, /HAND_NET_ACTIONS\.MOVE/);
  assert.match(modal, /HAND_NET_ACTIONS\.SCOOP/);
  assert.match(modal, /handNetShallows/);
  assert.match(modal, /creature\.status === "fleeing"/);
  assert.match(modal, /creature\.alert > 0\.35/);
  assert.match(modal, /Scoop net/);
  assert.match(modal, /Move slowly through the shallows/);
  assert.match(styles, /\.handNetShallows[\s\S]*?aspect-ratio:\s*3 \/ 2/);
  assert.match(styles, /\.handNetCreature[\s\S]*?background-size:\s*500% 200%/);
  assert.match(styles, /@keyframes handNetWaveDrift/);
  assert.match(styles, /@keyframes handNetScoop/);
});

test("the required tutorial stays with the player until a catch is recorded", () => {
  assert.match(game, /fishingSession\.required[\s\S]*?Complete Wyeth's practice catch before leaving the lesson/);
  assert.match(modal, /if \(required && !catchResult\) return/);
  assert.match(modal, /!required \? <button[\s\S]*?: null/);
  assert.match(modal, /tutorial \? "tutorial-complete" : "caught"/);
  assert.match(modal, /Retry the catch safely/);
  assert.match(modal, /Try another calm patch/);
});

test("Wyeth visibly leads a locked-input predetermined walk to the sandy cove", () => {
  assert.match(game, /createGuidedWalkPlan\(\{[\s\S]*?path: ELVERSON_WYETH_HAND_NET_PATH\.leader/);
  assert.match(game, /sampleGuidedWalk\(/);
  assert.match(game, /FISHERMAN_WYETH_INTERACTION_ID/);
  assert.match(game, /position: \{ \.\.\.sample\.leader\.position \}/);
  assert.match(game, /position: \{ \.\.\.sample\.follower\.position \}/);
  assert.match(game, /\|\| Boolean\(guidedWalk\)[\s\S]*?starterSelectionOpen/);
  assert.match(game, /setFishingSession\(\{ \.\.\.ELVERSON_FISHING_TUTORIAL_SESSION \}\)/);
});

test("keyboard, touch, focus, live status, and reduced-motion affordances are explicit", () => {
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /role="application"/);
  assert.match(modal, /aria-keyshortcuts="Enter Space"/);
  assert.match(modal, /window\.addEventListener\("keyup", releaseMovementKey\)/);
  assert.match(modal, /onPointerDown=\{\(\) => beginMove/);
  assert.match(modal, /modalStack\.at\(-1\) !== dialog/);
  assert.match(modal, /previousFocusRef\.current\?\.focus/);
  assert.match(modal, /role="status" aria-live="polite"/);
  assert.match(modal, /Gentle guidance: \{assistedMode \? "On" : "Off"\}/);
  assert.match(styles, /\.reducedMotionMode \.handNetWave,[\s\S]*?animation:\s*none !important/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.handNetCreature/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*?\.handNetCard/);
});

test("delivered creatures populate animated care-specific Aquarium exhibits", () => {
  assert.match(game, /getElversonAquariumExhibitModel\(gameSave\)/);
  assert.match(game, /sceneId === ELVERSON_AQUARIUM_SCENE_ID/);
  assert.match(game, /<AdventureAquariumExhibits/);
  assert.match(exhibits, /Reef Cleaning Station/);
  assert.match(exhibits, /Sheltered Coral Garden/);
  assert.match(exhibits, /Rocky Invertebrate Nursery/);
  assert.match(exhibits, /creature\?\.aquarium > 0/);
  assert.match(styles, /@keyframes aquariumCreatureSwim/);
  assert.match(styles, /\.aquariumCreature[\s\S]*?background-size:\s*500% 200%/);
});

test("Aquarium deliveries still award matching cards without granting the campaign title early", () => {
  assert.match(game, /const matchingCardSummary = delivered\.awardedCards/);
  assert.match(game, /delivered\.awardedCardCount/);
  assert.match(game, /Your Sea Realm reward:/);
  assert.doesNotMatch(game, /titleAwardedNow/);
});
