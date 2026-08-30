import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

test("legacy tutorial keeps its introduction while V2 hands off directly to the coin flow", () => {
  assert.match(simulatorSource, /setTutorialIntroductionStep\(tutorialContract && tutorialUsesScriptedScenario && !previewExperience \? 0 : null\)/);
  assert.match(simulatorSource, /previewExperience[\s\S]*?createOpeningCoinCallOverlay\(\{ tutorial: true, guideName: tutorialGuide\.name \}\)/);
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

test("fullscreen lesson keeps the card clear and docks the coach and navigation below it", () => {
  assert.match(simulatorSource, /className="fixed inset-0 z-\[180\] flex min-h-0 flex-col overflow-hidden/);
  assert.match(simulatorSource, /data-card-lesson-stage[\s\S]*data-card-lesson-coach/);
  assert.match(simulatorSource, /data-card-lesson-coach[\s\S]*ref=\{scrollRef\} className="max-h-\[25dvh\] overflow-y-auto/);
  assert.match(simulatorSource, /data-card-lesson-coach[\s\S]*<footer className="border-t/);
  assert.match(simulatorSource, /ProfessorGuidePortrait guide=\{guide\} compact[\s\S]*\{activeTitle\}[\s\S]*\{activeMessage\}/);
  assert.match(simulatorSource, /role="dialog"[\s\S]*aria-modal="true"/);
  assert.match(simulatorSource, /env\(safe-area-inset-bottom\)/);
  assert.match(simulatorSource, /event\.key !== "Tab"[\s\S]*button:not\(\[disabled\]\)[\s\S]*last\.focus\(\)/);
  assert.match(simulatorSource, /isolatedElements[\s\S]*sibling\.inert = true[\s\S]*element\.inert = inert/);
});

test("card cues use card-native regions, one larger static arrow, and no text over the artwork", () => {
  assert.match(simulatorSource, /viewBox="0 0 375 525"/);
  assert.match(simulatorSource, /data-card-cue-region=\{focus\}/);
  assert.match(simulatorSource, /className="pointer-events-none absolute inset-0[^"]*overflow-visible"/);
  assert.match(simulatorSource, /<rect[\s\S]*x=\{region\.x\}[\s\S]*width=\{region\.width\}/);
  assert.match(simulatorSource, /<path d=\{region\.path\}[\s\S]*markerEnd="url\(#seapals-card-cue-arrowhead\)"/);
  assert.match(simulatorSource, /markerUnits="userSpaceOnUse"/);
  assert.match(simulatorSource, /markerWidth="14" markerHeight="14"/);
  assert.match(simulatorSource, /stroke="#071827" strokeWidth="10"/);
  assert.match(simulatorSource, /stroke="#fbbf24" strokeWidth="5"/);
  assert.doesNotMatch(simulatorSource, /seapals-card-cue-pulse|seapalsCardCuePulse/);
  assert.doesNotMatch(simulatorSource, /seapals-card-cue-float|seapalsCardCueFloat|const float[XY]/);
  assert.doesNotMatch(simulatorSource, /focusLabel|top-3 h-\[18%\]|top-\[45%\] h-\[28%\]/);
});

test("later card templates use one normalized reference instead of Mustard-specific artwork coordinates", () => {
  assert.match(simulatorSource, /effectiveReferenceMode = referenceMode === "normalized" \|\| placeholderArt \? "normalized" : "printed"/);
  assert.match(simulatorSource, /referenceMode=\{lesson\.referenceMode\}/);
  assert.match(simulatorSource, /effectiveReferenceMode === "normalized"[\s\S]*referenceRules\.map/);
  assert.match(simulatorSource, /TutorialCardCueOverlay focus=\{focus\} referenceMode=\{effectiveReferenceMode\}/);
  assert.match(simulatorSource, /slotSummary[\s\S]{0,350}schoolDensity > 0[\s\S]{0,180}: null/);
});

test("normalized card text scales with the lesson card instead of the viewport", () => {
  assert.match(simulatorSource, /\.seapals-card-reference \{ container-type: inline-size/);
  assert.match(simulatorSource, /font-size: clamp\(6px, 2\.6cqw, 10px\)/);
  assert.match(simulatorSource, /font-size: clamp\(7px, 3cqw, 12px\)/);
  assert.match(simulatorSource, /font-size: clamp\(5px, 2\.1cqw, 8px\)/);
  assert.doesNotMatch(simulatorSource, /seapals-normalized-card-(?:type|name|cost|caption|rules|stat)[^\n]*sm:/);
});

test("multi-concept cards advance one arrow and one coach explanation at a time", () => {
  assert.match(simulatorSource, /const \[segmentIndex, setSegmentIndex\] = useState\(0\)/);
  assert.match(simulatorSource, /activeSegment\?\.focus \?\? lesson\.focus/);
  assert.match(simulatorSource, /if \(hasNextSegment\)[\s\S]*setSegmentIndex/);
  assert.match(simulatorSource, /data-card-cue-region=\{activeFocus \?\? undefined\}/);
  assert.match(simulatorSource, /aria-live="polite"/);
});

test("the full-screen lesson suppresses competing coach and target surfaces", () => {
  assert.match(simulatorSource, /tutorialHelpFloating = Boolean\([\s\S]*!tutorialIntroductionOpen[\s\S]*!tutorialCardLessonOpen/);
  assert.match(simulatorSource, /tutorialTargetBeaconOpen = Boolean\([\s\S]*!tutorialIntroductionOpen[\s\S]*!tutorialCardLessonOpen/);
});
