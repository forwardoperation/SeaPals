import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

test("scripted tutorial starts with the introduction and hands off to the board tour", () => {
  assert.match(simulatorSource, /setTutorialIntroductionStep\(tutorialContract && tutorialUsesScriptedScenario \? 0 : null\)/);
  assert.match(simulatorSource, /setTutorialBoardTourStep\(null\)/);
  assert.match(simulatorSource, /function finishTutorialIntroduction\(\)[\s\S]*setTutorialIntroductionStep\(null\)[\s\S]*setTutorialBoardTourStep\(0\)/);
  assert.match(simulatorSource, /function finishTutorialBoardTour\(\)[\s\S]*openOpeningCoinFlip\(\)/);
});

test("later card lessons derive only from an authored hand target and preserve the pending action", () => {
  assert.match(simulatorSource, /tutorialHelp\?\.target !== "hand"/);
  assert.match(simulatorSource, /createGuidedAcademyCardLesson\(card, \{[\s\S]*seenConceptKeys: tutorialSeenCardConceptKeys/);
  assert.match(simulatorSource, /function finishTutorialCardLesson\(\)[\s\S]*mergeTutorialSeenConcepts[\s\S]*setTutorialCardLesson\(null\)/);
  assert.doesNotMatch(simulatorSource, /finishTutorialCardLesson\(\)[\s\S]{0,500}setTutorialHelpDismissedId/);
});

test("fullscreen lesson keeps its body scrollable and its navigation outside that scroll region", () => {
  assert.match(simulatorSource, /className="fixed inset-0 z-\[180\] flex min-h-0 flex-col overflow-hidden/);
  assert.match(simulatorSource, /ref=\{scrollRef\} className="min-h-0 flex-1 overflow-y-auto/);
  assert.match(simulatorSource, /<footer className="shrink-0 border-t/);
  assert.match(simulatorSource, /role="dialog"[\s\S]*aria-modal="true"/);
  assert.match(simulatorSource, /env\(safe-area-inset-bottom\)/);
  assert.match(simulatorSource, /event\.key !== "Tab"[\s\S]*button:not\(\[disabled\]\)[\s\S]*last\.focus\(\)/);
  assert.match(simulatorSource, /isolatedElements[\s\S]*sibling\.inert = true[\s\S]*element\.inert = inert/);
});

test("the full-screen lesson suppresses competing coach and target surfaces", () => {
  assert.match(simulatorSource, /tutorialHelpFloating = Boolean\([\s\S]*!tutorialIntroductionOpen[\s\S]*!tutorialCardLessonOpen/);
  assert.match(simulatorSource, /tutorialTargetBeaconOpen = Boolean\([\s\S]*!tutorialIntroductionOpen[\s\S]*!tutorialCardLessonOpen/);
});
