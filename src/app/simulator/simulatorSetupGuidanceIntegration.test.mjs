import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = simulatorSource.indexOf(startMarker);
  const end = simulatorSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return simulatorSource.slice(start, end);
}

test("the mobile hand button blinks only until setup has a starting Foundation", () => {
  const mobileDock = sourceBetween(
    'aria-label="Mobile game command dock"',
    '<div className="seapals-hud-panel hidden min-h-0 overflow-y-auto',
  );

  assert.match(
    mobileDock,
    /onClick=\{\(\) => \{ if \(!playingCardId\) setModal\("hand"\); \}\}[\s\S]*?disabled=\{Boolean\(playingCardId\)\}[\s\S]*?\$\{isSetup && !hasCoralInPlay && !playingCardId \? " seapals-setup-playable-card" : ""\}[\s\S]*?>Open Hand/,
  );
});

test("setup hand guidance respects both reduced-motion paths", () => {
  const simulatorStyles = sourceBetween(
    "@keyframes seapalsPlayableCard",
    '<section className={`grid h-full',
  );

  assert.match(simulatorStyles, /\.seapals-setup-playable-card \{ animation: seapalsPlayableCard/);
  assert.match(simulatorStyles, /\.seapals-reduced-motion :is\(\.seapals-setup-playable-card/);
  assert.match(
    simulatorStyles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.seapals-setup-playable-card[^}]*animation: none !important/,
  );
});

test("embedded lessons expose each action with divider-anchored teacher guidance", () => {
  assert.match(
    simulatorSource,
    /const embeddedLessonActionReady = Boolean\(\s*embeddedLesson\s*&& tutorialHelpOpen\s*&& tutorialHelpDismissalKey\s*\);/,
  );
  assert.match(
    simulatorSource,
    /const embeddedLessonCoachOpen = Boolean\(\s*embeddedLessonActionReady\s*&& !embeddedLessonPresentationBlocked\s*\);/,
  );
  const embeddedCoach = sourceBetween(
    ") : embeddedLessonCoachOpen ? (",
    ") : tutorialSetupHelpAnchored || tutorialDrawTrayHelpAnchored ? (",
  );
  assert.match(
    embeddedCoach,
    /<ProfessorCoachOverlay help=\{tutorialHelp\} placementMode="reef-divider" measureKey=\{mobileReefSplit\}>[\s\S]*?<ProfessorGuideCard/,
  );
  assert.doesNotMatch(embeddedCoach, /onAdvance|advanceLabel|Show me/);
  assert.doesNotMatch(simulatorSource, /embeddedLessonActionCueIds|beginEmbeddedLessonAction|data-v2-lesson-dialogue/);
  assert.match(
    simulatorSource,
    /if \(!embeddedLessonCoachOpen \|\| !tutorialTargetBeaconOpen\) return undefined;[\s\S]*?findTutorialTarget\(tutorialHelp, \{ includeOffscreen: true \}\)[\s\S]*?\[data-simulator-hand-card-rail\][\s\S]*?scrollTutorialTargetWithinContainer/,
  );
  assert.match(simulatorSource, /<EmbeddedLessonActionCue[\s\S]*?active=\{embeddedLessonActionReady && !embeddedLessonPresentationBlocked && tutorialTargetBeaconOpen && !mobileHandDrag\}/);
  assert.match(simulatorSource, /\.seapals-v2-action-cue \{[\s\S]*?pointer-events: none;/);
});

test("compact turn teaching blocks the stale lesson coach and hand cue", () => {
  const presentationGate = sourceBetween(
    "const embeddedLessonPresentationBlocked = Boolean(",
    "const tutorialDrawTrayHelpAnchored = Boolean(",
  );

  assert.match(presentationGate, /\|\| compactTurnSequence/);
  assert.match(presentationGate, /embeddedLessonActionReady[\s\S]*?&& !embeddedLessonPresentationBlocked/);
  assert.match(
    simulatorSource,
    /<EmbeddedLessonActionCue[\s\S]*?active=\{embeddedLessonActionReady && !embeddedLessonPresentationBlocked && tutorialTargetBeaconOpen && !mobileHandDrag\}/,
  );
});

test("legacy setup guidance keeps its target-aware coach and beacon", () => {
  assert.match(
    simulatorSource,
    /const tutorialSetupHelpAnchored = Boolean\(\s*tutorialHelpFloating\s*&& isSetup\s*&& tutorialHelp\?\.target === "hand"\s*&& tutorialHelp\.targetCardId,\s*\);/,
  );
  assert.match(
    simulatorSource,
    /tutorialSetupHelpAnchored \|\| tutorialDrawTrayHelpAnchored \? \([\s\S]*?<ProfessorCoachOverlay help=\{tutorialHelp\}>[\s\S]*?<ProfessorGuideCard/,
  );
  assert.match(
    simulatorSource,
    /active=\{!embeddedLesson && tutorialTargetBeaconOpen && !tutorialBoardTourOpen && !tutorialSetupHelpAnchored\}/,
  );
  assert.match(simulatorSource, /window\.addEventListener\("scroll", requestUpdate, true\)/);
  assert.match(simulatorSource, /window\.removeEventListener\("scroll", requestUpdate, true\)/);
});
