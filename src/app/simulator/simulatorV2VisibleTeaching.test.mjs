import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { getSimulatorV2Lesson, getSimulatorV2LessonHelp } from "./simulatorV2Lessons.mjs";

const panelSource = await readFile(new URL("./SimulatorV2LessonPanel.jsx", import.meta.url), "utf8");
const start = panelSource.indexOf("export function composeLessonDialogueMessage(");
const end = panelSource.indexOf("\nfunction LessonModal(", start);
assert.ok(start >= 0 && end > start, "the coach must compose teaching with its next action");
// Exercise the actual presentation function without requiring a JSX/CSS runtime.
const composeLessonDialogueMessage = vm.runInNewContext(
  panelSource.slice(start, end).replace("export function", "function") + "\ncomposeLessonDialogueMessage;",
);

function visibleGuidance(lessonId, checkpointId) {
  const lesson = getSimulatorV2Lesson(lessonId);
  const checkpoint = lesson.checkpoints.find((entry) => entry.id === checkpointId);
  const help = getSimulatorV2LessonHelp(lesson, checkpoint);
  return { help, spoken: composeLessonDialogueMessage({ explanation: help.message, instruction: help.action, messageKey: help.cueId }) };
}

test("ordinary placement guidance teaches the School mechanic before giving the drag instruction", () => {
  const { help, spoken } = visibleGuidance("filter-feeder", "v2-place-first-herring-school");
  assert.ok(spoken.includes(help.message), "the capacity/RP explanation must actually reach the player");
  assert.ok(spoken.includes(help.action), "the live placement instruction must remain visible");
  assert.ok(spoken.indexOf(help.message) < spoken.indexOf(help.action));
});

test("ordinary Support guidance includes the card's effect and timing restriction", () => {
  const { help, spoken } = visibleGuidance("support-strategies", "v2-search-for-coral");
  assert.ok(spoken.includes(help.message));
  assert.ok(spoken.includes(help.action));
  assert.match(spoken, /search/i);
  assert.match(spoken, /Support.*turn|turn.*Support/i);
});

test("recovery guidance explains why the discard matters before directing the next click", () => {
  const { help, spoken } = visibleGuidance("first-attack", "v2-recover-sea-urchin");
  assert.ok(spoken.includes(help.message));
  assert.ok(spoken.includes(help.action));
  assert.match(spoken, /discard pile/i);
});

test("repeated explanations and repeated sentences appear only once", () => {
  assert.equal(composeLessonDialogueMessage({ explanation: "Begin your turn.", instruction: "Begin your turn." }), "Begin your turn.");
  assert.equal(composeLessonDialogueMessage({ explanation: "Begin your turn.", instruction: "Begin your turn. Draw one card." }), "Begin your turn. Draw one card.");
  assert.equal(composeLessonDialogueMessage({ explanation: "Begin your turn. Draw one card.", instruction: "Draw one card." }), "Begin your turn. Draw one card.");
  assert.equal(composeLessonDialogueMessage({ explanation: "Draw one card. It joins your hand.", instruction: "Draw one card. Then continue." }), "Draw one card. It joins your hand. Then continue.");
});

test("new-card tap cues stay brief and lessons with a Next button keep their focused explanation", () => {
  assert.equal(composeLessonDialogueMessage({ explanation: "The clownfish is new. Open it for a strategy introduction.", instruction: "Tap on your Clownfish.", messageKey: "tutorial-card-review:clownfish" }), "Tap on your Clownfish.");
  assert.equal(composeLessonDialogueMessage({ explanation: "A tied roll keeps the defender safe.", instruction: "Select Next.", advanceOnly: true }), "A tied roll keeps the defender safe.");
  assert.equal(composeLessonDialogueMessage({ instruction: "Continue.", advanceOnly: true }), "Continue.");
});

test("the rendered coach uses the composed dialogue for its scrolling text", () => {
  assert.match(panelSource, /const dialogueMessage = composeLessonDialogueMessage\(\{\s*explanation,\s*instruction: currentInstruction,\s*messageKey,\s*advanceOnly: Boolean\(onAdvance\)/);
  assert.match(panelSource, /<LessonDialogueMessage[\s\S]*?message=\{dialogueMessage\}/);
});
