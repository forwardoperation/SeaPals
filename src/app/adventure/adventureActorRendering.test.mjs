import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");

test("live actor state drives rendering, interaction targeting, and player collision", () => {
  assert.match(component, /advanceAdventureActorStates\(/);
  assert.match(component, /positionOverrides:\s*actorPositionOverrides/);
  assert.match(component, /dynamicBlockers:\s*getAdventureActorBlockers\(/);
  assert.match(component, /ignoreActorTiles:\s*true/);
  assert.match(component, /position=\{runtimeActor\?\.position \?\? characterInteraction\.at\}/);
  assert.match(component, /facing=\{actorFacing\}/);
  assert.match(component, /const actorAnimationMode = getAdventureActorAnimationMode\(\{/);
  assert.match(component, /hasPatrol:\s*Boolean\(characterInteraction\.patrol\)/);
  assert.match(component, /isMoving:\s*runtimeActor\?\.moving === true/);
  assert.match(component, /isEngaged:\s*actorIsEngaged/);
  assert.match(component, /movementPaused,/);
  assert.match(component, /pageVisible,/);
  assert.match(component, /reducedMotion:\s*effectiveReducedMotion/);
  assert.match(component, /moving=\{actorAnimationMode === ADVENTURE_ACTOR_ANIMATION_MODES\.WALKING\}/);
  assert.match(component, /steppingInPlace=\{actorAnimationMode === ADVENTURE_ACTOR_ANIMATION_MODES\.STEPPING_IN_PLACE\}/);
});

test("patrol animation pauses with gameplay and honors reduced motion", () => {
  assert.match(component, /!movementPausedRef\.current/);
  assert.match(component, /pageVisibleRef\.current/);
  assert.match(component, /const effectiveReducedMotion = gameSave\?\.settings\?\.reducedMotion === true \|\| systemReducedMotion/);
  assert.match(component, /window\.matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(component, /if \(effectiveReducedMotion\) \{[\s\S]*return undefined;/);
  assert.match(component, /if \(screen !== "playing" \|\| movementPaused \|\| !pageVisible\) \{[\s\S]*return undefined;/);
  assert.match(component, /actorVisualStateChanged\(currentRuntime\.actors, nextRuntime\.actors\)/);
  assert.doesNotMatch(component, /elapsedMs >= 32/);
  assert.match(styles, /\.npcCell\s*\{[\s\S]*?transition:\s*none/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.npcCell,[\s\S]*transition:\s*none\s*!important/);
});

test("player and patrol walk cycles derive their cadence from world speed", () => {
  assert.match(component, /getAdventureWalkCycleDurationMs\(walkSpeed\)/);
  assert.match(component, /"--sprite-walk-cycle-duration": `\$\{getAdventureWalkCycleDurationMs\(walkSpeed\)\}ms`/);
  assert.match(component, /walkSpeed=\{characterInteraction\.patrol\?\.speed \?\? ADVENTURE_ACTOR_DEFAULTS\.speed\}/);
  assert.match(component, /walkSpeed=\{scene\.movement\?\.speed\}/);
  assert.match(styles, /animation:\s*spriteWalk var\(--sprite-walk-cycle-duration, 250ms\) steps\(1, end\) infinite/);
});

test("stationary residents use a registered alternating-leg gait over one world anchor", () => {
  assert.match(component, /const frameRegistration = getAdventureWalkFrameRegistration\(\{/);
  assert.match(component, /"--sprite-step-frame-a-x": `\$\{frameRegistration\.frameA\}%`/);
  assert.match(component, /"--sprite-step-neutral-x": `\$\{frameRegistration\.neutral\}%`/);
  assert.match(component, /"--sprite-step-frame-b-x": `\$\{frameRegistration\.frameB\}%`/);
  assert.match(component, /data-sprite-profile=\{animationProfile\}/);
  assert.match(styles, /\.spriteSteppingInPlace\s*\{[\s\S]*?background-position:\s*var\(--sprite-step-neutral-x, 50%\) var\(--sprite-row\)/);
  assert.match(styles, /\.spriteSteppingInPlace\s*\{[\s\S]*?transform-origin:\s*center bottom/);
  assert.match(styles, /\.spriteSteppingInPlace\s*\{[\s\S]*?animation:\s*spriteWalkInPlace[\s\S]*?steps\(1, end\)/);
  const idleCycle = styles.match(/@keyframes spriteWalkInPlace[\s\S]*?(?=@keyframes spriteBreathe)/)?.[0] ?? "";
  assert.ok(idleCycle);
  assert.match(idleCycle, /--sprite-step-frame-a-x/);
  assert.match(idleCycle, /--sprite-step-neutral-x/);
  assert.match(idleCycle, /--sprite-step-frame-b-x/);
  assert.doesNotMatch(idleCycle, /translateX|scaleY/);
});

test("the player walk cycle follows active walking intent even when collision stops displacement", () => {
  assert.match(component, /const playerWalking = bestFriendWalkSample\?\.follower\.moving === true[\s\S]*?\|\| guidedWalkSample\?\.follower\.moving === true[\s\S]*?\|\| isAdventurePlayerWalking\(\{ isMoving, boatMode, movementPaused \}\)/);
  assert.doesNotMatch(component, /\[playerWalking, setPlayerWalking\]/);
  assert.doesNotMatch(component, /setPlayerWalking\(/);
  assert.match(component, /moving=\{playerWalking\}/);
});

test("world conversations explicitly turn the selected live actor toward the player", () => {
  assert.match(component, /worldConversationOrigin = \["trainer", "npc"\]\.includes\(interaction\.type\)/);
  assert.match(component, /interactionId:\s*interaction\.interactionId/);
  assert.match(component, /focusAdventureActor\([\s\S]*?worldConversationOrigin\.interactionId,[\s\S]*?position/);
  assert.match(component, /activeConversationInteractionId === characterInteraction\.id/);
  assert.match(component, /getAdventureFacingToward\(/);
  assert.match(component, /engaged=\{actorIsEngaged\}/);
  assert.match(styles, /\.npcEngaged\s*\{[\s\S]*?animation:\s*npcAttention/);
});

test("multi-step mentor dialogue preserves its world actor origin", () => {
  const functionalConversationUpdates = component.match(/setConversation\(\(currentConversation\) => \(\{[\s\S]*?\.\.\.currentConversation,[\s\S]*?mode: "(?:starterConfirmed|starterPresentation|tutorialIntro)",[\s\S]*?\}\)\);/g) ?? [];

  assert.equal(functionalConversationUpdates.length, 4);
  assert.match(component, /const activeWorldConversation = conversationLeadIn \?\? conversation/);
  assert.match(component, /activeWorldConversation\?\.sceneId === sceneId/);
});
