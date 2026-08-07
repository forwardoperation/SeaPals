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
  assert.match(modal, /<span aria-hidden="true">A<\/span> Catch/);
  assert.match(modal, /Move slowly through the shallows/);
  assert.match(modal, /ELVERSON_HAND_NET_TIDEPOOL_PATH/);
  assert.match(modal, /ELVERSON_HAND_NET_PLAYER_ATLAS_PATH/);
  assert.match(modal, /player-hand-net-isometric-v1\.png/);
  assert.match(modal, /state\.presentation\.scoopFrameIndex/);
  assert.match(modal, /state\.presentation\.walkFrameIndex/);
  assert.doesNotMatch(modal, /state\.simulationTimeMs\s*\/\s*115/);
  assert.match(modal, /data-hand-net-scoop-frame=\{playerSpriteFrame\}/);
  assert.doesNotMatch(modal, /styles\.handNetHandle/);
  assert.doesNotMatch(modal, /styles\.handNetScoop\b/);
  assert.match(modal, /handNetToolHud/);
  assert.match(modal, /handNetCatchTray/);
  assert.match(modal, /--hand-net-player-x/);
  assert.match(modal, /--hand-net-player-y/);
  assert.match(modal, /--hand-net-player-velocity-x/);
  assert.match(modal, /--hand-net-player-velocity-y/);
  assert.match(modal, /--hand-net-player-speed-ratio/);
  assert.match(modal, /handNetCaustics/);
  assert.match(modal, /handNetCausticWake/);
  assert.match(modal, /data-hand-net-effect="surface-caustics" aria-hidden="true"/);
  assert.match(modal, /data-hand-net-effect="surface-veil" aria-hidden="true"/);
  assert.match(modal, /data-hand-net-effect="wading-wake" aria-hidden="true"/);
  assert.match(modal, /state\.presentation\.netImpact/);
  assert.match(modal, /key=\{`\$\{seedRef\.current\}-\$\{netSplash\.sequence\}`\}/);
  assert.match(modal, /handNetNetSplashActive/);
  assert.match(modal, /data-hand-net-effect="net-splash"/);
  assert.match(game, /preloadAdventureAsset\(ELVERSON_HAND_NET_TIDEPOOL_PATH\)/);
  assert.match(styles, /\.handNetShallows[\s\S]*?aspect-ratio:\s*3 \/ 2/);
  assert.match(styles, /var\(--hand-net-tidepool-image\)/);
  assert.match(styles, /\.handNetCreature[\s\S]*?background-size:\s*500% 200%/);
  assert.match(styles, /@keyframes handNetWaveDrift/);
  assert.match(styles, /@keyframes handNetScoop/);
  assert.match(styles, /\.handNetCaustics[\s\S]*?pointer-events:\s*none/);
  assert.match(styles, /\.handNetSurfaceVeil[\s\S]*?z-index:\s*8/);
  assert.match(styles, /\.handNetSurfaceVeil[\s\S]*?pointer-events:\s*none/);
  assert.match(styles, /\.handNetPlayer[\s\S]*?background-size:\s*700% 400%/);
  assert.match(styles, /\.handNetControlDock[\s\S]*?justify-content:\s*space-between/);
  assert.match(styles, /\.handNetCausticWake[\s\S]*?var\(--hand-net-player-motion-angle\)/);
  assert.match(styles, /\.handNetNetSplash[\s\S]*?pointer-events:\s*none/);
  assert.match(styles, /@keyframes handNetCausticsDrift/);
  assert.match(styles, /@keyframes handNetSplashFlash/);
});

test("the required tutorial stays with the player until a catch is recorded", () => {
  assert.match(game, /fishingSession\.required[\s\S]*?Complete Wyeth's practice catch before leaving the lesson/);
  assert.match(modal, /if \(required && !catchResult\) return/);
  assert.match(modal, /!required \|\| catchResult/);
  assert.match(modal, /tutorial \? "tutorial-complete" : "caught"/);
  assert.match(modal, /Retry catch/);
  assert.match(modal, /Try again/);
});

test("Wyeth visibly leads a locked-input predetermined walk to the sandy cove", () => {
  assert.match(game, /createGuidedWalkPlan\(\{[\s\S]*?path: ELVERSON_WYETH_HAND_NET_PATH\.leader/);
  assert.match(game, /followerPath: ELVERSON_WYETH_HAND_NET_PATH\.follower/);
  assert.match(game, /advanceGuidedWalkClock\(/);
  assert.match(game, /completionFallbackMs/);
  assert.doesNotMatch(game, /startedAt: performance\.now\(\)/);
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
  assert.match(modal, /setPointerCapture/);
  assert.match(modal, /onPointerDown=\{\(event\) =>/);
  assert.match(modal, /onClick=\{handleWaterScoop\}/);
  assert.match(modal, /target\.closest\("button, a, input, select, textarea, \[data-hand-net-ui\]"\)/);
  assert.match(modal, /tabIndex=\{0\}/);
  assert.match(modal, /styles\.controlDock/);
  assert.match(modal, /styles\.dpad/);
  assert.match(modal, /styles\.actionButton/);
  assert.match(modal, /modalStack\.at\(-1\) !== dialog/);
  assert.match(modal, /previousFocusRef\.current\?\.focus/);
  assert.match(modal, /role="status" aria-live="polite"/);
  assert.match(modal, /Gentle guidance: \{assistedMode \? "On" : "Off"\}/);
  assert.match(styles, /\.reducedMotionMode \.handNetWave,[\s\S]*?animation:\s*none !important/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.handNetCreature/);
  assert.match(styles, /\.reducedMotionMode \.handNetCaustics[\s\S]*?animation:\s*none !important/);
  assert.match(styles, /\.reducedMotionMode \.handNetSurfaceVeil[\s\S]*?animation:\s*none !important/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.handNetNetSplash::before/);
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
