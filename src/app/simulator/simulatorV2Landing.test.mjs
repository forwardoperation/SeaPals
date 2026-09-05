import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const simulatorDirectory = new URL("./", import.meta.url);
const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const presentationFiles = (await readdir(simulatorDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.(?:css|jsx)$/.test(entry.name));
const presentationSources = await Promise.all(
  presentationFiles.map(async (entry) => ({
    name: entry.name,
    source: await readFile(new URL(entry.name, simulatorDirectory), "utf8"),
  })),
);
const landingComponentSource = presentationSources.find(({ source }) => (
  source.includes("data-v2-new-game-setup")
))?.source ?? "";
const landingStyleSource = presentationSources.find(({ name }) => (
  name === "SimulatorV2NewGameSetup.module.css"
))?.source ?? "";

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

function jsxOpeningTagContaining(source, attribute) {
  const attributeIndex = source.indexOf(attribute);
  assert.ok(attributeIndex >= 0, `Missing JSX attribute: ${attribute}`);
  const openingStart = source.lastIndexOf("<", attributeIndex);
  assert.ok(openingStart >= 0, `Could not locate the ${attribute} opening element`);

  let braceDepth = 0;
  let quote = null;
  let escaped = false;
  for (let index = openingStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
    } else if (character === "{") {
      braceDepth += 1;
    } else if (character === "}") {
      braceDepth -= 1;
    } else if (character === ">" && braceDepth === 0) {
      return source.slice(openingStart, index + 1);
    }
  }

  assert.fail(`Could not locate the end of the ${attribute} opening element`);
}

function elementContainingDataAttribute(attribute) {
  const matchingFile = presentationSources.find(({ source }) => source.includes(attribute));
  assert.ok(matchingFile, `Missing ${attribute} from the simulator presentation`);

  const attributeIndex = matchingFile.source.indexOf(attribute);
  const openingTag = jsxOpeningTagContaining(matchingFile.source, attribute);
  const openingStart = matchingFile.source.lastIndexOf("<", attributeIndex);
  const tagName = openingTag.match(/^<([A-Za-z][\w.]*)\b/)?.[1];
  assert.ok(tagName, `Could not identify the element carrying ${attribute}`);

  if (/\/\s*>$/.test(openingTag)) return openingTag;

  const tagPattern = new RegExp(`<\\/?${tagName.replace(".", "\\.")}\\b[^>]*>`, "g");
  tagPattern.lastIndex = openingStart;
  let depth = 0;
  let match;
  while ((match = tagPattern.exec(matchingFile.source))) {
    const tag = match[0];
    if (tag.startsWith("</")) {
      depth -= 1;
      if (depth === 0) return matchingFile.source.slice(openingStart, tagPattern.lastIndex);
    } else if (!/\/\s*>$/.test(tag)) {
      depth += 1;
    }
  }

  assert.fail(`Could not locate the closing ${tagName} for ${attribute}`);
}

const newGameBranch = sourceSection(
  simulatorSource,
  'eventOverlay.type === "new-game-setup"',
  ') : eventOverlay.type === "opponent-thinking"',
);

test("the normal V2 opening screen keeps deck setup primary and offers a guided tutorial", () => {
  const landing = elementContainingDataAttribute("data-v2-new-game-setup");
  const playerSelect = jsxOpeningTagContaining(landing, "data-v2-player-deck");
  const opponentSelect = jsxOpeningTagContaining(landing, "data-v2-opponent-deck");
  const startAction = jsxOpeningTagContaining(landing, "data-v2-start-game");
  const tutorialAction = jsxOpeningTagContaining(landing, "data-v2-tutorial-link");

  assert.equal((landing.match(/<select\b/g) ?? []).length, 2, "the landing should expose exactly two deck selectors");
  assert.ok(playerSelect, "the player deck selector needs a stable semantic hook");
  assert.match(playerSelect, /value=\{(?:selectedDeckId|playerDeckId)\}/);
  assert.match(playerSelect, /onChange=\{[^}]*set(?:SelectedDeckId|PlayerDeckId)/);
  assert.ok(opponentSelect, "the opponent deck selector needs a stable semantic hook");
  assert.match(opponentSelect, /value=\{(?:selectedOpponentDeckId|opponentDeckId)\}/);
  assert.match(opponentSelect, /onChange=\{[^}]*set(?:SelectedOpponentDeckId|OpponentDeckId)/);
  assert.equal((landing.match(/data-v2-start-game/g) ?? []).length, 1, "the landing should expose one primary start action");
  assert.ok(startAction, "the primary action should be a button");
  assert.match(startAction, /type="submit"/);
  assert.match(landing, /<form\b[^>]*onSubmit=\{startMatch\}/);
  assert.match(
    landingComponentSource,
    /function startMatch\([^)]*\)[\s\S]*?onStart\(playerDeckId,\s*opponentDeckId,\s*selectedDifficulty\.id\)/,
  );

  assert.match(landing, /New to SeaPals\?/);
  assert.match(landing, /Try the Tutorial/);
  assert.match(tutorialAction, /^<Link\b/);
  assert.match(tutorialAction, /pathname:\s*"\/instructions\/tutorial-v2"/);
  assert.match(tutorialAction, /query:\s*\{\s*returnDeck:\s*playerDeckId\s*\}/);
  assert.doesNotMatch(tutorialAction, /type="submit"/);
  assert.equal(
    (landing.match(/data-v2-tutorial-link/g) ?? []).length,
    1,
    "the landing should expose one secondary tutorial action",
  );
  assert.match(
    landingComponentSource,
    /const focusSelector = "a\[href\],[^"]+"/,
    "the dialog focus trap should include the tutorial link",
  );

  assert.doesNotMatch(landing, /Victory Target|How a turn works|Start guided tutorial/i);
  assert.doesNotMatch(landing, /four Foundation|four Pals|Every illegal play|choose an opponent deck and victory target/i);
  assert.doesNotMatch(landing, /aria-pressed=/, "difficulty should not fall back to a wall of option buttons");
});

test("the streamlined V2 opening names decks directly and keeps difficulty labels free of explanatory copy", () => {
  const landing = elementContainingDataAttribute("data-v2-new-game-setup");

  assert.match(
    landing,
    /<h2\b[^>]*>\s*Choose your Decks\s*<\/h2>/,
    "the launch title should use the requested deck language exactly",
  );
  assert.doesNotMatch(landing, /Choose your reefs/i);
  assert.doesNotMatch(
    landing,
    /selectedDifficulty\?\.description|difficultyDescription|seapals-v2-difficulty-description/,
    "Easy, Medium, and Hard should stand on their own without adjacent descriptive prose",
  );
});

test("the V2 difficulty control is a labelled, keyboard-native three-step slider", () => {
  const landing = elementContainingDataAttribute("data-v2-new-game-setup");
  const slider = jsxOpeningTagContaining(landing, "data-v2-difficulty-slider");

  assert.match(slider, /type=(?:"range"|\{"range"\})/);
  assert.match(slider, /min=(?:"?0"?|\{0\})/);
  assert.match(slider, /max=(?:"?2"?|\{2\}|\{(?:Math\.max\(0,\s*)?(?:OPPONENT_DIFFICULTY_OPTIONS|difficultyOptions)\.length\s*-\s*1\)?\})/);
  assert.match(slider, /step=(?:"?1"?|\{1\})/);
  assert.match(slider, /value=\{[^}]+\}/);
  assert.match(slider, /onChange=\{[^}]*set(?:PendingOpponentDifficulty|DifficultyIndex)/);
  assert.match(slider, /aria-valuetext=\{[^}]+\}/);

  const sliderId = slider.match(/\bid="([^"]+)"/)?.[1];
  const labelledById = slider.match(/aria-labelledby="([^"]+)"/)?.[1];
  const hasProgrammaticLabel = (sliderId
    ? new RegExp(`<label\\b[^>]*htmlFor="${sliderId}"[^>]*>[\\s\\S]*?Opponent Difficulty`, "i").test(landing)
    : false)
    || (labelledById
      ? new RegExp(`id="${labelledById}"[^>]*>[\\s\\S]{0,200}?Opponent difficulty`, "i").test(landing)
      : false)
    || /aria-label="Opponent Difficulty"/i.test(slider);
  assert.ok(hasProgrammaticLabel, "the difficulty range needs a programmatic Opponent Difficulty label");
  assert.match(landingComponentSource, /difficultyOptions\.map|OPPONENT_DIFFICULTY_OPTIONS\.map/);
});

test("the V2 landing ocean is decorative motion with both system and in-app reduced-motion fallbacks", () => {
  const oceanScene = elementContainingDataAttribute("data-v2-ocean-scene");
  assert.match(oceanScene, /aria-hidden="true"/);
  assert.match(
    landingStyleSource,
    /@keyframes\s+[\w-]*(?:ocean|wave|caustic|current|bubble|drift)[\w-]*/i,
    "the ocean scene should include deliberate ambient motion",
  );
  assert.match(
    landingStyleSource,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?(?:landing|ocean|wave|caustic|current|bubble)[\s\S]*?animation:\s*none\s*(?:!important)?/i,
    "system reduced-motion should stop ambient ocean animation",
  );
  assert.match(
    landingStyleSource,
    /(?:\.seapals-reduced-motion|\.reducedMotion)[\s\S]{0,500}?(?:landing|ocean|wave|caustic|current|bubble|lightRays|fish)[\s\S]{0,500}?animation:\s*none\s*(?:!important)?/i,
    "the simulator's reduced-motion setting should stop ambient ocean animation",
  );
});

test("the landing redesign is isolated to normal V2 games and preserves story, tutorial, and legacy setup", () => {
  const activeDefinition = sourceSection(
    simulatorSource,
    "const v2NewGameSetupActive = Boolean(",
    "const boardInteractionOverlayActive",
  );
  const v2Mount = sourceSection(
    simulatorSource,
    "{v2NewGameSetupActive ? (",
    "{eventOverlay && boardTargetingPresentationActive",
  );
  assert.match(activeDefinition, /previewExperience/);
  assert.match(activeDefinition, /&&\s*!isStoryMode/);
  assert.match(activeDefinition, /&&\s*eventOverlay\?\.type\s*===\s*"new-game-setup"/);
  assert.match(v2Mount, /<SimulatorV2NewGameSetup/);
  assert.match(v2Mount, /reducedMotion=\{accessibilityReducedMotion\}/);
  assert.match(v2Mount, /onStart=\{\(playerDeckId, opponentDeckId, difficulty\) =>[\s\S]*?restartGame\(playerDeckId, opponentDeckId, pendingVictoryTarget, difficulty\)/);

  assert.match(newGameBranch, /isStoryMode \? \(/, "story mode should retain its dedicated setup branch");
  assert.match(newGameBranch, /tutorialUsesScriptedScenario/);
  assert.match(newGameBranch, /restartStoryGame\("begin"\)/);
  assert.match(newGameBranch, /Victory Target/, "legacy setup should retain its victory target control");
  assert.match(newGameBranch, /How a turn works/, "legacy setup should retain its explanatory copy");
  assert.match(newGameBranch, /Start guided tutorial/, "legacy setup should retain its tutorial route");

  const genericOverlay = jsxOpeningTagContaining(simulatorSource, "hidden={v2NewGameSetupActive || resumeHydrationPending || Boolean(resumeCheckpoint)}");
  assert.match(genericOverlay, /hidden=\{v2NewGameSetupActive \|\| resumeHydrationPending \|\| Boolean\(resumeCheckpoint\)\}/);
  assert.match(genericOverlay, /style=\{v2NewGameSetupActive \|\| resumeHydrationPending \|\| resumeCheckpoint \? \{ display: "none" \} : undefined\}/);
  assert.match(genericOverlay, /aria-hidden=\{inspectedCardData \|\| resumeCheckpoint \|\| resumeHydrationPending/);
  assert.match(genericOverlay, /inert=\{inspectedCardData \|\| resumeCheckpoint \|\| resumeHydrationPending/);
});
