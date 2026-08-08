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
  assert.match(component, /facing=\{renderedActorFacing\}/);
  assert.match(component, /const actorAnimationMode = getAdventureActorAnimationMode\(\{/);
  assert.match(component, /isMoving:\s*runtimeActor\?\.moving === true/);
  assert.match(component, /isEngaged:\s*actorIsEngaged/);
  assert.match(component, /movementPaused,/);
  assert.match(component, /pageVisible,/);
  assert.match(component, /reducedMotion:\s*effectiveReducedMotion/);
  assert.match(component, /moving=\{!idleGesture && actorAnimationMode === ADVENTURE_ACTOR_ANIMATION_MODES\.WALKING\}/);
  assert.doesNotMatch(component, /hasPatrol:/);
  assert.doesNotMatch(component, /steppingInPlace|STEPPING_IN_PLACE/);
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
  assert.match(component, /ADVENTURE_NPC_WALK_CYCLE_DISTANCE/);
  assert.match(component, /walkCycleDistance = undefined/);
  assert.match(component, /getAdventureWalkCycleDurationMs\(\s*walkSpeed,\s*\{ cycleDistance: walkCycleDistance \},\s*\)/);
  assert.match(component, /"--sprite-walk-cycle-duration": `\$\{getAdventureWalkCycleDurationMs\(/);
  assert.match(component, /walkSpeed=\{characterInteraction\.patrol\?\.speed \?\? ADVENTURE_ACTOR_DEFAULTS\.speed\}/);
  assert.match(component, /const playerWalkSpeed = bestFriendWalkSample\?\.follower\.moving === true[\s\S]*?\? bestFriendSequence\?\.plan\?\.speed[\s\S]*?: guidedWalkSample\?\.follower\.moving === true[\s\S]*?\? guidedWalk\?\.plan\?\.speed[\s\S]*?: scene\.movement\?\.speed/);
  assert.match(component, /walkSpeed=\{playerWalkSpeed\}/);
  assert.match(component, /walkCycleDistance=\{ADVENTURE_NPC_WALK_CYCLE_DISTANCE\}/);
  const playerSpriteBlock = component.slice(
    component.indexOf("function AdventurePlayerSprite"),
    component.indexOf("function AdventureBoatSprite"),
  );
  assert.doesNotMatch(playerSpriteBlock, /walkCycleDistance/);
  assert.match(styles, /animation:\s*spriteWalk var\(--sprite-walk-cycle-duration, 480ms\) steps\(1, end\) infinite/);
});

test("the bedroom enlarges the player artwork without changing world geometry", () => {
  const playerSpriteBlock = component.slice(
    component.indexOf("function AdventurePlayerSprite"),
    component.indexOf("function AdventureBoatSprite"),
  );
  const shadowRules = styles.match(/\.characterShadow\s*\{[\s\S]*?\n\}/g) ?? [];
  const spriteRule = styles.match(/\.spriteArtwork\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(
    playerSpriteBlock,
    /scene\.id === ELVERSON_PROLOGUE_BEDROOM_SCENE_ID \? 1\.6 : 1/,
  );
  assert.match(playerSpriteBlock, /"--character-scale": characterScale/);
  assert.match(shadowRules.at(-1) ?? "", /scale:\s*var\(--character-scale, 1\)/);
  assert.match(spriteRule, /scale:\s*var\(--character-scale, 1\)/);
  assert.match(spriteRule, /transform-origin:\s*center 94\.7%/);
});

test("stationary residents use their registered neutral frame while moving actors cycle", () => {
  assert.match(component, /const frameRegistration = getAdventureWalkFrameRegistration\(\{/);
  assert.match(component, /const spriteStyle = \{/);
  assert.match(component, /"--sprite-step-frame-a-x": `\$\{frameRegistration\.frameA\}%`/);
  assert.match(component, /"--sprite-step-neutral-x": `\$\{frameRegistration\.neutral\}%`/);
  assert.match(component, /"--sprite-step-frame-b-x": `\$\{frameRegistration\.frameB\}%`/);
  assert.match(component, /data-sprite-profile=\{animationProfile\}/);
  assert.match(styles, /\.spriteArtwork\s*\{[\s\S]*?background-position:\s*var\(--sprite-step-neutral-x, 50%\) var\(--sprite-row\)/);
  assert.doesNotMatch(styles, /spriteSteppingInPlace|spriteWalkInPlace/);

  const movingCycle = styles.match(/@keyframes spriteWalk\s*\{[\s\S]*?(?=@keyframes professorSpriteWalk)/)?.[0] ?? "";
  assert.ok(movingCycle);
  assert.match(movingCycle, /--sprite-step-frame-a-x/);
  assert.match(movingCycle, /--sprite-step-neutral-x/);
  assert.match(movingCycle, /--sprite-step-frame-b-x/);
  assert.doesNotMatch(movingCycle, /translateY\(-/);
});

test("dock gestures switch registered neutral facings only during the visible full-motion speech", () => {
  assert.match(
    component,
    /dockCutscenePhase === "speech"[\s\S]*?conversation\?\.dockSpeech === true[\s\S]*?pageVisible[\s\S]*?!effectiveReducedMotion/,
  );
  assert.match(component, /const idleGesture = dockSpeechGestureActive[\s\S]*?characterInteraction\.dockSpeechGesture \?\? null/);
  assert.match(component, /const renderedActorFacing = idleGesture\?\.baseFacing \?\? actorFacing/);
  assert.match(component, /"--sprite-idle-left-x": `\$\{idleGestureRegistrations\.left\.neutral\}%`/);
  assert.match(component, /"--sprite-idle-right-x": `\$\{idleGestureRegistrations\.right\.neutral\}%`/);
  assert.match(component, /const dockGatheringStaged = dockSpeechPending \|\| bestFriendEscortActive/);
  assert.match(component, /markersEnabled=\{!dockGatheringStaged\}/);
  assert.match(component, /idleGesture=\{idleGesture\}/);

  for (const keyframesName of [
    "dockAudienceGlanceLeft",
    "dockAudienceGlanceRight",
    "dockSpeechSpeakerTurn",
  ]) {
    const keyframes = styles.match(
      new RegExp(`@keyframes ${keyframesName}\\s*\\{[\\s\\S]*?(?=\\n@keyframes|\\n\\.spritePortrait)`),
    )?.[0] ?? "";
    assert.ok(keyframes, `${keyframesName} should be authored`);
    assert.match(keyframes, /--sprite-idle-(?:down|left|right|up)-x/);
    assert.doesNotMatch(keyframes, /frameA|frameB|sprite-step-frame/);
  }
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
