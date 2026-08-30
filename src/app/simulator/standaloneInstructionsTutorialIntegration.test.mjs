import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveAdventureTutorial } from "../adventure/adventureContent.mjs";
import {
  STANDALONE_TUTORIAL_ID,
  STANDALONE_TUTORIAL_PLAYER_DECK_ID,
  STANDALONE_TUTORIAL_RETURN_PATH,
  createStandaloneTutorialStoryModeData,
} from "../instructions/tutorial/standaloneTutorialConfig.mjs";
import { SCRIPTED_TUTORIAL_FINISH_PLAN } from "./tutorialScenario.mjs";

const filename = fileURLToPath(import.meta.url);
const simulatorDirectory = path.dirname(filename);
const appDirectory = path.resolve(simulatorDirectory, "..");

async function readAppSource(...segments) {
  return readFile(path.join(appDirectory, ...segments), "utf8");
}

function collectFunctions(value, currentPath = "storyMode", found = []) {
  if (typeof value === "function") {
    found.push(currentPath);
    return found;
  }
  if (!value || typeof value !== "object") return found;
  for (const [key, nestedValue] of Object.entries(value)) {
    collectFunctions(nestedValue, `${currentPath}.${key}`, found);
  }
  return found;
}

test("instructions tutorial reuses the canonical authored opening lesson", () => {
  const authoredTutorial = resolveAdventureTutorial(STANDALONE_TUTORIAL_ID);
  const storyMode = createStandaloneTutorialStoryModeData();

  assert.equal(storyMode.encounterId, authoredTutorial.practiceEncounter.id);
  assert.equal(storyMode.opponentId, authoredTutorial.mentor.id);
  assert.equal(storyMode.opponentDeckId, authoredTutorial.practiceEncounter.opponentDeckId);
  assert.equal(storyMode.victoryTarget, authoredTutorial.victoryTarget);
  assert.equal(storyMode.victoryTarget, SCRIPTED_TUTORIAL_FINISH_PLAN.victoryTarget);
  assert.equal(storyMode.difficulty, authoredTutorial.practiceEncounter.difficulty);
  assert.equal(storyMode.opponentName, authoredTutorial.mentor.name);
  assert.equal(storyMode.playerDeckId, STANDALONE_TUTORIAL_PLAYER_DECK_ID);
  assert.equal(storyMode.playerDeckId, "coral-garden");
  assert.equal(storyMode.returnLabel, "Instructions");
  assert.equal(storyMode.tutorial.scriptedDecks, true);
  assert.deepEqual(
    storyMode.tutorial.contract.checkpoints.map(({ id, actionType }) => ({ id, actionType })),
    authoredTutorial.checkpoints.map(({ id, actionType }) => ({ id, actionType })),
  );
  assert.deepEqual(JSON.parse(JSON.stringify(storyMode)), storyMode);
});

test("standalone tutorial is isolated from adventure saves and only adds a return callback", async () => {
  const storyMode = createStandaloneTutorialStoryModeData();
  assert.deepEqual(collectFunctions(storyMode), []);
  assert.equal("onResult" in storyMode, false);
  assert.equal("onVictory" in storyMode, false);
  assert.equal("onDefeat" in storyMode, false);
  assert.equal("initialProgress" in storyMode.tutorial, false);
  assert.equal("onCheckpoint" in storyMode.tutorial, false);
  assert.equal("onProgress" in storyMode.tutorial, false);
  assert.equal("onRetry" in storyMode.tutorial, false);

  const clientSource = await readAppSource("instructions", "tutorial", "StandaloneTutorial.jsx");
  assert.match(clientSource, /<Simulator storyMode=\{storyMode\}/);
  assert.match(clientSource, /router\.replace\(returnPath\)/);
  assert.doesNotMatch(
    clientSource,
    /adventureStorage|adventureOnboarding|recordTutorialCheckpoint|recordPracticeDuelResult|localStorage|sessionStorage/,
  );
  assert.equal(STANDALONE_TUTORIAL_RETURN_PATH, "/instructions#learn-by-doing");
});

test("V2 preview routes opt into the new shell without changing canonical routes", async () => {
  const [simulatorPreview, tutorialPreview, tutorialClient, canonicalSimulator] = await Promise.all([
    readAppSource("simulator-v2", "page.jsx"),
    readAppSource("instructions", "tutorial-v2", "page.jsx"),
    readAppSource("instructions", "tutorial", "StandaloneTutorial.jsx"),
    readAppSource("simulator", "page.jsx"),
  ]);

  assert.match(simulatorPreview, /<Simulator[\s\S]*previewExperience/);
  assert.match(tutorialPreview, /<StandaloneTutorial[\s\S]*previewExperience/);
  assert.match(tutorialPreview, /\/simulator-v2/);
  assert.match(tutorialClient, /<Simulator storyMode=\{storyMode\} previewExperience=\{previewExperience\}/);
  assert.doesNotMatch(canonicalSimulator, /previewExperience/);
});

test("learn by doing appears before the written rules and legacy tutorial links redirect", async () => {
  const instructionsSource = await readAppSource("instructions", "page.jsx");
  const legacyTutorialSource = await readAppSource("tutorial", "page.jsx");
  const learnByDoingIndex = instructionsSource.indexOf('id="learn-by-doing"');
  const writtenRulesIndex = instructionsSource.indexOf('id="start-here"');

  assert.ok(learnByDoingIndex >= 0, "instructions page should include the learn-by-doing section");
  assert.ok(writtenRulesIndex >= 0, "instructions page should include the written rules section");
  assert.ok(
    learnByDoingIndex < writtenRulesIndex,
    "guided lesson should appear before the written rules",
  );
  assert.match(instructionsSource, /href="\/instructions\/tutorial"/);
  assert.match(instructionsSource, /Start guided tutorial/);
  assert.match(legacyTutorialSource, /redirect\("\/instructions\/tutorial"\)/);
  assert.doesNotMatch(legacyTutorialSource, /TutorialSimulator|PokemonTutorial/);
});
