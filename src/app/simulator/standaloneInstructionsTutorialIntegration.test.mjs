import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const filename = fileURLToPath(import.meta.url);
const simulatorDirectory = path.dirname(filename);
const appDirectory = path.resolve(simulatorDirectory, "..");

async function readAppSource(...segments) {
  return readFile(path.join(appDirectory, ...segments), "utf8");
}

test("instructions opens V2 lessons with an exit back to instructions or the selected deck trial", async () => {
  const pageSource = await readAppSource("instructions", "tutorial", "page.jsx");
  const clientSource = await readAppSource("instructions", "tutorial", "StandaloneTutorial.jsx");
  const experienceSource = await readAppSource("simulator", "SimulatorV2Experience.jsx");

  assert.match(pageSource, /getValidSimulatorDeck\(params\?\.returnDeck\)/);
  assert.match(pageSource, /createSimulatorDeckHref\(returnDeck\?\.id\) \?\? "\/instructions#learn-by-doing"/);
  assert.match(pageSource, /initialDeckId=\{returnDeck\?\.id \?\? null\}/);
  assert.match(clientSource, /<SimulatorV2Experience[\s\S]*?initialDeckId=\{initialDeckId\}[\s\S]*?initialTutorial[\s\S]*?onExitTutorial=\{returnToInstructions\}/);
  assert.match(clientSource, /router\.replace\(returnPath\)/);
  assert.match(experienceSource, /useState\(initialTutorial \? "chooser" : null\)/);
  assert.match(experienceSource, /onExit=\{panel === "intro" \? \(\) => setPanel\("chooser"\) : onExitTutorial \?\? returnToSimulator\}/);
  assert.doesNotMatch(
    clientSource,
    /adventureStorage|adventureOnboarding|recordTutorialCheckpoint|recordPracticeDuelResult|storyModeData|localStorage|sessionStorage/,
  );
});

test("the official simulator and existing V2 bookmarks share the V2 board and lesson runtime", async () => {
  const [simulatorAlias, simulatorExperience, tutorialPreview, canonicalSimulator] = await Promise.all([
    readAppSource("simulator-v2", "page.jsx"),
    readAppSource("simulator", "SimulatorV2Experience.jsx"),
    readAppSource("instructions", "tutorial-v2", "page.jsx"),
    readAppSource("simulator", "page.jsx"),
  ]);

  assert.match(simulatorAlias, /export \{ default, metadata \} from "\.\.\/simulator\/page"/);
  assert.match(canonicalSimulator, /<SimulatorV2Experience[\s\S]*initialDeckId=\{initialDeckId\}/);
  assert.match(canonicalSimulator, /initialTutorial = params\?\.tutorial === "1"/);
  assert.match(canonicalSimulator, /initialTutorial=\{initialTutorial\}/);
  assert.match(canonicalSimulator, /canonical: "\/simulator"/);
  assert.doesNotMatch(canonicalSimulator, /Preview|work-in-progress|index: false/);
  assert.match(simulatorExperience, /<Simulator\b[\s\S]*previewExperience/);
  assert.match(simulatorExperience, /createSimulatorV2LessonRuntime\(lesson\.id, \{ completedLessonIds \}\)/);
  assert.match(simulatorExperience, /tutorial:\s*runtime/);
  assert.match(tutorialPreview, /getValidSimulatorDeck\(params\?\.returnDeck\)/);
  assert.match(tutorialPreview, /redirect\(`\/simulator\?tutorial=1/);
  assert.match(tutorialPreview, /&deck=\$\{encodeURIComponent\(deck\.id\)\}/);
  assert.doesNotMatch(tutorialPreview, /<StandaloneTutorial|<TutorialV2Course/);
});

test("Reefbound uses the V2 board while retaining its campaign duel and tutorial contract", async () => {
  const adventure = await readAppSource("adventure", "AdventureGame.jsx");
  const simulator = await readAppSource("simulator", "Simulator.jsx");
  const duel = adventure.slice(adventure.indexOf("<Simulator"), adventure.indexOf("const baseConversationTrainer"));

  assert.match(simulator, /previewExperience = true/);
  assert.match(duel, /\bpreviewExperience\s+accessibilitySettings=\{gameSave\?\.settings\}/);
  assert.match(duel, /playerDeckSnapshot: activeDuelDeckSnapshot/);
  assert.match(duel, /initialProgress: gameSave\?\.tutorial/);
  assert.match(duel, /onCheckpoint: recordSimulatorTutorialCheckpoint/);
  assert.match(duel, /onExit: \(\) => exitDuel\(activeTrainerId\)/);
  assert.match(duel, /onResult: \(result\) => recordDuelResult\(activeTrainerId, result\)/);
  assert.match(simulator, /simulatorResumeEnabled = Boolean\(previewExperience && !isStoryMode && !tutorialRuntime\)/);
  assert.match(simulator, /simulatorAnalyticsEnabled = Boolean\(previewExperience && !isStoryMode && !tutorialRuntime\)/);
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
