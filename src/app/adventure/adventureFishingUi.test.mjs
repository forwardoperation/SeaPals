import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const game = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");
const modal = readFileSync(new URL("./AdventureFishingModal.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");
const content = readFileSync(new URL("./adventureContent.mjs", import.meta.url), "utf8");

test("Elverson shore input, Wyeth's lesson, catch saving, and Easterling delivery are wired into play", () => {
  assert.match(game, /getElversonFishingInteraction\(sceneId, position, facing\)/);
  assert.match(game, /authoredInteraction \?\? shorelineFishingInteraction/);
  assert.match(game, /if \(interaction\.type === "fishing"\)/);
  assert.match(game, /beginElversonFishingTutorial\(current\)/);
  assert.match(
    game,
    /if \(trainerId === FISHERMAN_WYETH_ID\)[\s\S]*?mode: getElversonFishingConversationMode\(current\)[\s\S]*?return;[\s\S]*?if \(trainerId === ACADEMY_MENTOR_ID\)/,
  );
  assert.match(game, /afterArrivalFishingSession: ELVERSON_FISHING_TUTORIAL_SESSION/);
  assert.match(game, /recordElversonFishingTutorialCatch\(current, creatureId\)/);
  assert.match(game, /recordElversonFishingCatch\(current, creatureId\)/);
  assert.match(game, /deliverElversonFishingCatches\(current\)/);
  assert.match(game, /<AdventureFishingModal[\s\S]*?onCatch=\{saveFishingCatch\}/);
  assert.match(content, /Find Fisherman Wyeth by the south pier/);
  assert.match(content, /fishingLesson:/);
  assert.match(content, /fishingPractice:/);
  assert.match(content, /fishingTurnIn:/);
});

test("Wyeth guides interrupted lessons to the practice rail and requires the first catch", () => {
  assert.match(game, /ELVERSON_FISHING_PRACTICE_POSITION = Object\.freeze\(\{ x: 10\.05, y: 16\.9 \}\)/);
  assert.match(game, /interactionId: "guided-fishing-lesson-to-practice-rail"/);
  assert.match(game, /fishingProgress\?\.tutorialStarted[\s\S]*?!fishingProgress\.hasRod[\s\S]*?fishingProgress\.tutorialComplete/);
  assert.match(game, /setFishingSession\(\{ \.\.\.ELVERSON_FISHING_TUTORIAL_SESSION \}\)/);
  assert.match(game, /fishingSession\.required[\s\S]*?Complete Wyeth's practice catch before leaving the lesson/);
  assert.match(modal, /required \? \([\s\S]*?Practice catch required/);
  assert.match(modal, /\{!required \? <button[\s\S]*?>Not now<\/button> : null\}/);
  assert.match(modal, /Finish Wyeth&apos;s lesson/);
});

test("the fishing dialog traps and restores focus while announcing meaningful results", () => {
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /primaryActionRef\.current\?\.focus/);
  assert.match(modal, /modalStack\.at\(-1\) !== dialog/);
  assert.match(modal, /!dialog\.contains\(document\.activeElement\)/);
  assert.match(modal, /previousFocus\?\.focus/);
  assert.match(modal, /aria-live=\{phase === "bite" \? "assertive" : "polite"\}/);
  assert.match(modal, /\$\{creatureName \?\? "Creature"\} caught!/);
  assert.match(modal, /aria-label=\{entry\.discovered/);
});

test("fishing offers a static assisted reel and honors effective reduced motion", () => {
  assert.match(modal, /const \[assistedMode, setAssistedMode\] = useState\(Boolean\(reducedMotion \|\| \(tutorial && required\)\)\)/);
  assert.match(modal, /Assisted reel: \{assistedMode \? "On" : "Off"\}/);
  assert.match(modal, /Use assisted reel/);
  assert.match(modal, /phase !== "reeling" \|\| assistedMode \|\| reducedMotion/);
  assert.match(modal, /aria-hidden="true"/);
  assert.match(modal, /reducedMotion \|\| assistedMode \? 6500 : 3000/);
  assert.match(game, /gameSave\.settings\.reducedMotion \|\| systemReducedMotion \? styles\.reducedMotionMode/);
  assert.match(styles, /\.reducedMotionMode \.fishingWater::before,[\s\S]*?\.reducedMotionMode \.fishingHookButton[\s\S]*?animation:\s*none\s*!important/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.fishingWater::before,[\s\S]*?\.fishingHookButton/);
});

test("the fishing dialog remains scrollable within safe areas and short viewports", () => {
  assert.match(styles, /\.fishingLayer[\s\S]*?env\(safe-area-inset-top\)[\s\S]*?env\(safe-area-inset-bottom\)/);
  assert.match(styles, /\.fishingCard[\s\S]*?max-height:\s*calc\(100dvh[\s\S]*?overflow-y:\s*auto/);
  assert.match(styles, /@media \(max-height: 620px\)[\s\S]*?\.fishingLayer \{ place-items: start center; \}/);
});
