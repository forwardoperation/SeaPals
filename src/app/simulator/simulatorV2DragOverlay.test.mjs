import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

function sourceSection(start, end) {
  const startIndex = simulatorSource.indexOf(start);
  const endIndex = simulatorSource.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `Missing section start: ${start}`);
  assert.ok(endIndex > startIndex, `Missing section end: ${end}`);
  return simulatorSource.slice(startIndex, endIndex);
}

test("drag lessons connect the exact hand card to the nearest visible legal destination", () => {
  const finder = sourceSection(
    "function findEmbeddedLessonDragDestination(",
    "function getEmbeddedLessonDragPath(",
  );
  const cue = sourceSection(
    "function EmbeddedLessonActionCue(",
    "const PROFESSOR_COACH_ARROW",
  );

  assert.match(finder, /data-v2-lesson-drop-cards~/);
  assert.match(finder, /Math\.hypot/);
  assert.match(cue, /const source = findTutorialTarget\(help\)/);
  assert.match(cue, /findEmbeddedLessonDragDestination\(help, source\.rect\)/);
  assert.match(cue, /className=\{`seapals-v2-action-cue is-drag is-path\$\{dragging/);
  assert.match(cue, /className="seapals-v2-action-cue-path-line"/);
  assert.match(cue, /className="seapals-v2-action-cue-destination"/);
  assert.match(cue, /--seapals-drag-start-x/);
  assert.match(cue, /--seapals-drag-motion-path/);
  assert.match(cue, /className="seapals-v2-action-cue-hand-glyph"/);
  assert.doesNotMatch(cue, /--seapals-drag-(?:first|middle|last)-[xy]/);
});

test("the animated drag path begins with the same upward lift accepted by the hand", () => {
  const pathSource = sourceSection(
    "function getEmbeddedLessonDragPath(",
    "function EmbeddedLessonHandIcon(",
  );
  const getEmbeddedLessonDragPath = Function(`return (${pathSource})`)();
  const path = getEmbeddedLessonDragPath(
    { left: 80, top: 600, width: 120, height: 160 },
    { left: 560, top: 280, width: 180, height: 220 },
  );

  assert.equal(path.control1.x, path.start.x);
  assert.ok(path.control1.y < path.start.y);
  assert.ok(path.end.x > path.start.x, "the cue should curve toward the real destination after lifting");
});

test("the pointer hand has a natural silhouette and a calibrated fingertip", () => {
  const icon = sourceSection(
    "function EmbeddedLessonHandIcon(",
    "function EmbeddedLessonActionCue(",
  );

  assert.match(icon, /viewBox="0 0 16 16"/);
  assert.match(icon, /M8\.5 4\.466V1\.75/);
  assert.match(simulatorSource, /offset-anchor:\s*42\.1875% 0;/);
  assert.match(simulatorSource, /transform-origin:\s*42\.1875% 0;/);
  assert.match(
    simulatorSource,
    /\.seapals-v2-action-cue-hand-glyph \{[\s\S]*?opacity:\s*\.75;[\s\S]*?transform-origin:\s*42\.1875% 0;/,
  );
});

test("the board exposes prepared ecosystem, matching Coral, and compatible slot destinations before dragging", () => {
  assert.match(
    simulatorSource,
    /embeddedLessonEcosystemDropPosition[\s\S]*?getGuidedAcademyFoundationPlacementTarget\(playerCorals\.length\)[\s\S]*?\{ x: 72, y: 38 \}/,
  );
  assert.match(
    simulatorSource,
    /data-v2-lesson-drop-kind="ecosystem"/,
  );
  assert.match(
    simulatorSource,
    /embeddedLessonUpgradeDropCardIds[\s\S]*?currentCard\.upgrade\.nextCardId === cardId[\s\S]*?data-v2-lesson-drop-kind=\{embeddedLessonUpgradeDropCardIds\.length \? "coral-upgrade"/,
  );
  assert.match(
    simulatorSource,
    /embeddedLessonSlotDropCardIds[\s\S]*?canUseSlotWithCard\(slot, cardId\)[\s\S]*?data-v2-lesson-drop-kind=\{embeddedLessonSlotDropCardIds\.length \? "slot"/,
  );
});

test("the board-native overlay keeps the drop circle and teacher visible during the real drag", () => {
  const cue = sourceSection(
    "function EmbeddedLessonActionCue(",
    "const PROFESSOR_COACH_ARROW",
  );
  const presentationGate = sourceSection(
    "const embeddedLessonPresentationBlocked = Boolean(",
    "const tutorialDrawTrayHelpAnchored = Boolean(",
  );
  const dragAnchorPipeline = sourceSection(
    "const embeddedLessonDragCardIds =",
    "const embeddedLessonEcosystemDropPosition =",
  );

  assert.match(
    simulatorSource,
    /<EmbeddedLessonActionCue[\s\S]*?active=\{embeddedLessonActionReady && !embeddedLessonPresentationBlocked && tutorialTargetBeaconOpen\}[\s\S]*?measureKey=\{embeddedLessonActionCueMeasureKey\}[\s\S]*?dragging=\{Boolean\(mobileHandDrag\)\}/,
  );
  const helpState = sourceSection(
    "const tutorialHelp = tutorialContract ?",
    "const tutorialConditionHelp =",
  );
  assert.doesNotMatch(presentationGate, /\|\| mobileHandDrag/);
  assert.doesNotMatch(dragAnchorPipeline, /mobileHandDrag/);
  assert.match(dragAnchorPipeline, /tutorialHelpTargetActive[\s\S]*?tutorialHelp\?\.interaction === "drag"/);
  assert.match(dragAnchorPipeline, /hand\.includes\(cardId\)/);
  assert.match(simulatorSource, /data-v2-lesson-drop-cards=\{embeddedLessonEcosystemDropCardIds\.join\(" "\)\}/);
  assert.match(helpState, /playingCardId,\s*playingCardName: playingCard\?\.name/);
  assert.doesNotMatch(helpState, /playingCardId:\s*embeddedLesson \? activePlacementCardId/);
  assert.match(cue, /\{!dragging \? \([\s\S]*?className="seapals-v2-action-cue-path"[\s\S]*?className="seapals-v2-action-cue-source"[\s\S]*?\) : null\}[\s\S]*?className="seapals-v2-action-cue-destination"[\s\S]*?\{!dragging \? \([\s\S]*?className="seapals-v2-action-cue-hand"/);
  assert.match(cue, /data-v2-user-dragging=\{dragging \? "true" : undefined\}/);
  assert.match(simulatorSource, /<ProfessorGuideCard[\s\S]*?help=\{tutorialHelp\}[\s\S]*?dragPassive=\{Boolean\(mobileHandDrag\)\}/);
  assert.match(
    simulatorSource,
    /\.seapals-v2-action-cue \{[\s\S]*?z-index:\s*159;[\s\S]*?pointer-events:\s*none;/,
  );
  assert.match(
    simulatorSource,
    /\.seapals-v2-action-cue-path \{[\s\S]*?pointer-events:\s*none;/,
  );
  assert.match(simulatorSource, /const embeddedLessonActionCueMeasureKey = [\s\S]*?ecosystemZoom[\s\S]*?ecosystemOffset\.x[\s\S]*?mobileReefSplit[\s\S]*?playerCorals\.map/);
});

test("embedded coaching stays left-anchored on the reef divider while the hand points to the action", () => {
  const coach = sourceSection(
    "function ProfessorCoachOverlay(",
    "function destroyedCardGoesToLostZone(",
  );

  assert.match(coach, /placementMode = "target", measureKey = null/);
  assert.match(coach, /const usesDividerAnchor = placementMode === "reef-divider"/);
  assert.match(coach, /document\.querySelector\('\[data-tutorial-coach-anchor="reef-divider"\]'\)/);
  assert.match(coach, /usesDividerAnchor[\s\S]*?getTutorialDividerCoachPlacement\(\{/);
  assert.match(coach, /viewportPlacement = nextPlacement[\s\S]*?viewportWidth,/);
  assert.match(coach, /usesDividerAnchor,[\s\S]*?measureKey,/);
  assert.match(
    coach,
    /width: usesDividerAnchor[\s\S]*?`min\(23rem, calc\(100vw - 24px\), \$\{Math\.max\(1, placement\.viewportWidth - 24\)\}px\)`/,
  );
  assert.match(coach, /data-tutorial-coach-placement=\{placementMode\}/);
  assert.match(coach, /placement && !usesDividerAnchor/);
  assert.match(
    simulatorSource,
    /<ProfessorCoachOverlay help=\{tutorialHelp\} placementMode="reef-divider" measureKey=\{mobileReefSplit\}>/,
  );
  assert.match(
    simulatorSource,
    /className=\{`seapals-reef-divider-handle[\s\S]*?data-tutorial-coach-anchor="reef-divider"[\s\S]*?role="separator"/,
  );
});

test("tap cues remain target-local and the hand travels smoothly along the exact path", () => {
  const cue = sourceSection(
    "function EmbeddedLessonActionCue(",
    "const PROFESSOR_COACH_ARROW",
  );

  assert.match(cue, /const targetRect = layout\.sourceRect;[\s\S]*?data-v2-target-gesture=\{gesture\}/);
  assert.match(cue, /left: `\$\{targetRect\.left\}px`/);
  assert.match(
    simulatorSource,
    /@supports \(offset-path: path\("M 0 0 L 1 1"\)\)[\s\S]*?offset-path:\s*var\(--seapals-drag-motion-path\);[\s\S]*?offset-rotate:\s*0deg;[\s\S]*?animation:\s*seapalsV2HandDragPath 2\.4s linear infinite;/,
  );
  assert.match(
    simulatorSource,
    /@keyframes seapalsV2HandDragPath[\s\S]*?20% \{ opacity: 1; offset-distance: 0%; \}[\s\S]*?80%, 92% \{ opacity: 1; offset-distance: 100%; \}/,
  );
  assert.match(simulatorSource, /@keyframes seapalsV2HandDragPress[\s\S]*?20%, 80% \{ transform: scale\(\.9\); \}/);
  assert.match(
    simulatorSource,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.seapals-v2-action-cue-path-line,[\s\S]*?animation:\s*none;[\s\S]*?\.seapals-v2-action-cue\.is-path \.seapals-v2-action-cue-hand \{[\s\S]*?opacity:\s*1;/,
  );
  assert.match(
    simulatorSource,
    /@media \(forced-colors: active\) \{[\s\S]*?\.seapals-v2-action-cue-path-line \{ stroke: Highlight;[\s\S]*?\.seapals-v2-action-cue-hand-glyph \{ opacity:\s*1; \}/,
  );
});
