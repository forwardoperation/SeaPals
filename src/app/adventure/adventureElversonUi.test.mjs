import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");
const page = readFileSync(new URL("./page.jsx", import.meta.url), "utf8");
const simulator = readFileSync(new URL("../simulator/Simulator.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");

test("the active adventure presentation begins with Elverson's aquarium project", () => {
  assert.match(component, /Begin in coastal Elverson, where Mr\. Easterling is creating a new aquarium exhibit/);
  assert.match(component, /Hello Adventurer! I am Mr\. Easterling, and I study Sea Creatures in the Sea Realm\./);
  assert.match(component, /Your tenth-birthday morning/);
  assert.match(component, /Head downstairs, greet Mom, check with Dad, then meet/);
  assert.match(component, /Meet \$\{dialogueIdentity\.bestFriendName\} outside/);
  assert.match(component, /Your best friend is coming to find you with news about the waterfront kickoff/);
  assert.match(component, /Join the kickoff at the dock/);
  assert.match(component, /approach the central dock to hear Mr\. Easterling open the Sea Creature Challenge/);
  assert.match(component, /Mr\. Easterling&apos;s three starter reefs/);
  assert.match(component, /Mr\. Easterling's Live Lesson/);
  assert.match(page, /Explore coastal Elverson and help Mr\. Easterling create a new community aquarium exhibit/);
});

test("the opening setup keeps Mr. Easterling in a fixed shared dialogue portrait", () => {
  assert.match(
    component,
    /className=\{`\$\{styles\.portrait\} \$\{styles\.portraitteal\}`\}[\s\S]*?<CharacterPortrait character=\{ACADEMY_MENTOR_ID\}/,
  );
  assert.match(
    styles,
    /\.portrait\s*\{[\s\S]*?position:\s*relative;[\s\S]*?overflow:\s*hidden;/,
  );
  assert.match(
    styles,
    /\.openingSetupDialogueBox\s*>\s*\.portrait\s*\{[^}]*align-self:\s*start;[^}]*height:\s*120px;[^}]*min-height:\s*120px;[^}]*\}/,
  );
  assert.match(
    styles,
    /@media \(max-width:\s*700px\)[\s\S]*?\.openingSetupDialogueBox\s*>\s*\.portrait\s*\{[^}]*height:\s*94px;[^}]*min-height:\s*94px;[^}]*\}/,
  );
  assert.match(styles, /\.mrEasterlingPortraitArtwork\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;/);
  assert.doesNotMatch(component, /openingSeaPal/);
  assert.doesNotMatch(styles, /\.openingSeaPal/);
});

test("the opening callouts point back to their actual speaker direction", () => {
  assert.match(
    styles,
    /\.overworldSpeechAnchor\s*\{[^}]*transform:\s*translate\(-50%,\s*-50%\);/,
  );
  assert.match(
    styles,
    /\.openingNameCallout\s*\{[^}]*top:\s*50%;[^}]*right:[^;}]+;[^}]*bottom:\s*auto;[^}]*animation:\s*openingEdgeGreetingIn/,
  );
  assert.match(
    styles,
    /\.openingNameCallout::after\s*\{[^}]*top:\s*50%;[^}]*left:\s*100%;[^}]*border-top:[^;}]+;[^}]*border-right:/,
  );
  assert.match(styles, /@keyframes openingEdgeGreetingIn\s*\{/);
});

test("the opening dialogue exposes progress and readable light-surface name controls", () => {
  assert.match(
    component,
    /className=\{styles\.openingSetupProgress\}[\s\S]*?role="progressbar"[\s\S]*?aria-valuemin=\{1\}[\s\S]*?aria-valuemax=\{steps\.length\}[\s\S]*?aria-valuenow=\{stepNumber\}/,
  );
  assert.match(
    styles,
    /\.openingSetupResponse \.openingNameField input\s*\{[^}]*border-color:\s*#0e7490;[^}]*\}/,
  );
  assert.match(
    styles,
    /\.openingSetupResponse \.openingNameField input:focus\s*\{[^}]*border-color:\s*#155e75;[^}]*\}/,
  );
  assert.match(
    styles,
    /\.openingSetupResponse \.openingNameError\s*\{[^}]*color:\s*#b91c1c\s*!important;[^}]*\}/,
  );
});

test("the Elverson vertical slice does not offer outward world navigation", () => {
  assert.doesNotMatch(component, />Open World Map</);
  assert.doesNotMatch(component, /onWorldMap=/);
  assert.match(component, /The waters beyond Elverson are closed while we focus on getting the aquarium exhibit started/);
  assert.match(component, /"coastal-elverson": styles\.elversonTownMap/);
  assert.match(styles, /\.elversonTownMap\s*\{\s*background-color:/);
  assert.doesNotMatch(styles, /\.elversonTownMap::before/);
});

test("ambient residents render with stable sprite fallbacks and no duel marker", () => {
  assert.match(component, /function residentSpriteSource\(character\)/);
  assert.match(component, /const RESIDENT_SPRITE_ARCHETYPES = Object\.freeze\(\[\s*"player",\s*"marina",\s*"dorian",\s*\]\)/);
  assert.match(component, /"fisherman-wyeth": "fisherman-wyeth"/);
  assert.match(component, /"teacher-caroline": "teacher-caroline"/);
  assert.match(component, /"explorer-jordan": "explorer-jordan"/);
  assert.match(component, /"marine-biologist-jonah": "marine-biologist-jonah"/);
  assert.match(component, /"programmer-harlan": "programmer-harlan"/);
  assert.match(component, /\bhenderson:\s*"town-adult"/);
  assert.doesNotMatch(component, /\bhenderson:\s*"player"/);
  assert.match(component, /\bedith:\s*"marina"/);
  assert.doesNotMatch(component, /\bedith:\s*"town-elder"/);
  assert.match(component, /SPRITE_SOURCE_BY_CHARACTER\[character\] \?\? residentSpriteSource\(character\)/);
  assert.match(component, /const showMarker = markersEnabled && Boolean\(trainer\.encounterId \|\| status\)/);
  assert.match(component, /\{showMarker \? \(/);
  assert.match(component, /const dockGatheringStaged = dockSpeechPending \|\| bestFriendEscortActive/);
  assert.match(component, /markersEnabled=\{!dockGatheringStaged\}/);
  assert.match(component, /trainer\.encounterId && trainer\.townId === "shellshore-village"/);
  assert.match(component, /\.\.\.\(trainer\.dialogue\?\.intro \?\? \[\]\)/);
  assert.match(component, /\.\.\.\(trainer\.dialogue\?\.guidance \?\? \[\]\)/);
  assert.match(component, /residentConversationSeenRef\.current\.has\(trainerId\)/);
  assert.match(component, /trainer\.dialogue\?\.return \?\? trainer\.dialogue\?\.guidance/);
  assert.match(component, /trainer\.townId === "shellshore-village"\) \{\s*closeConversation\(\);\s*return;/);
});

test("the dock speech uses neutral-frame gestures without turning them into walking", () => {
  assert.match(
    component,
    /const dockSpeechGestureActive = Boolean\([\s\S]*?dockCutscenePhase === "speech"[\s\S]*?conversation\?\.dockSpeech === true[\s\S]*?pageVisible[\s\S]*?!effectiveReducedMotion/,
  );
  assert.match(component, /const renderedActorFacing = idleGesture\?\.baseFacing \?\? actorFacing/);
  assert.match(component, /moving=\{!idleGesture && actorAnimationMode === ADVENTURE_ACTOR_ANIMATION_MODES\.WALKING\}/);
  assert.match(component, /idleGesture=\{idleGesture\}/);
  assert.match(styles, /\.spriteDockAudienceGlanceLeft\s*\{[^}]*dockAudienceGlanceLeft/);
  assert.match(styles, /\.spriteDockAudienceGlanceRight\s*\{[^}]*dockAudienceGlanceRight/);
  assert.match(styles, /\.spriteDockSpeechSpeaker\s*\{[^}]*dockSpeechSpeakerTurn/);
});

test("Elverson uses a close-follow camera and compact human-toned overworld sprites", () => {
  assert.match(component, /getAdventureCameraLayout\(\{/);
  assert.match(
    component,
    /const cameraTarget = conversation\?\.dockSpeech[\s\S]{0,120}ELVERSON_DOCK_SPEECH_CAMERA_POSITION/,
  );
  assert.match(component, /className=\{`\$\{styles\.map\} \$\{sceneTransition/);
  assert.match(component, /className=\{`\$\{styles\.mapWorld\} \$\{mapThemeClass\} \$\{sceneTransition/);
  assert.match(component, /width: `\$\{cameraLayout\.worldWidthPercent\}%`/);
  assert.match(component, /left: `\$\{cameraLayout\.leftPercent\}%`/);
  assert.match(styles, /\.map\s*\{[\s\S]*?aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(styles, /\.mapWorld\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?display:\s*grid/);
  assert.match(styles, /\.spriteArtwork\s*\{[\s\S]*?width:\s*72%;[\s\S]*?height:\s*103%/);
  assert.match(styles, /\.town-elderSpriteArtwork\s*\{\s*background-image:\s*url\("\/images\/adventure\/town-elder-sprites-512-v3\.webp"\);\s*\}/);
  assert.doesNotMatch(styles, /hue-rotate\(/);
});

test("Elverson overworld sprites and dialogue portraits reuse compact WebP sheets", () => {
  const spriteSheets = {
    player: "player-sprites-512-v3.webp",
    marina: "marina-sprites-512-v3.webp",
    dorian: "dorian-sprites-512-v3.webp",
    "fisherman-wyeth": "fisherman-wyeth-sprites-512-v3.webp",
    "teacher-caroline": "teacher-caroline-sprites-512-v3.webp",
    ivy: "ivy-sprites-512-v3.webp",
    "explorer-jordan": "explorer-jordan-sprites-512-v3.webp",
    "marine-biologist-jonah": "marine-biologist-jonah-sprites-512-v3.webp",
    "programmer-harlan": "programmer-harlan-sprites-512-v3.webp",
    "town-elder": "town-elder-sprites-512-v3.webp",
    "town-adult": "town-adult-sprites-512-v3.webp",
  };

  for (const [spriteName, sheetName] of Object.entries(spriteSheets)) {
    assert.match(
      styles,
      new RegExp(`\\.${spriteName}SpriteArtwork[^}]*background-image:\\s*url\\("/images/adventure/${sheetName.replace(".", "\\.")}"\\)`),
    );
    assert.doesNotMatch(styles, new RegExp(`\\.${spriteName}SpriteArtwork\\.spritePortrait[^}]*background-image:`));
  }
});

test("the tutorial interface consistently identifies Mr. Easterling as the guide", () => {
  assert.match(simulator, /name: String\(tutorialRuntime\?\.guide\?\.name \?\? ""\)\.trim\(\) \|\| "Mr\. Easterling"/);
  assert.match(simulator, /aria-label=\{`\$\{guide\.name\} guidance`\}/);
  assert.match(simulator, /`\$\{tutorialGuide\.name\}'s pick`/);
  assert.match(simulator, /\{tutorialGuide\.name\}'s lesson target/);
  assert.doesNotMatch(simulator, /Professor guidance|Professor's pick|Professor's lesson target/);
});

test("Mr. Easterling uses his identity-based overworld sheet and dedicated portrait", () => {
  assert.match(styles, /\.academy-mentorSpriteArtwork[\s\S]*?mr-easterling-sprites-627-v4\.webp/);
  assert.match(styles, /\.mrEasterlingPortraitArtwork[\s\S]*?mr-easterling-portrait-v2\.webp/);
  assert.match(component, /function CharacterPortrait[\s\S]*?character === ACADEMY_MENTOR_ID[\s\S]*?mrEasterlingPortraitArtwork/);
  assert.match(component, /portraitSrc: "\/images\/adventure\/mr-easterling-portrait-v2\.webp"/);
  assert.match(simulator, /backgroundSize: "contain"/);
  assert.match(simulator, /mr-easterling-portrait-v2\.webp/);
  assert.doesNotMatch(styles, /academy-mentor-sprites\.png/);
});
