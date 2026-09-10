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
  assert.match(cue, /className="seapals-v2-action-cue is-drag is-path"/);
  assert.match(cue, /className="seapals-v2-action-cue-path-line"/);
  assert.match(cue, /className="seapals-v2-action-cue-destination"/);
  assert.match(cue, /--seapals-drag-start-x/);
  assert.match(cue, /--seapals-drag-motion-path/);
  assert.match(cue, /className="seapals-v2-action-cue-hand-glyph"/);
  assert.doesNotMatch(cue, /--seapals-drag-(?:first|middle|last)-[xy]/);
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

test("the board-native overlay stays noninteractive, below the coach, and disappears during the real drag", () => {
  assert.match(
    simulatorSource,
    /<EmbeddedLessonActionCue[\s\S]*?active=\{embeddedLessonActionReady && !embeddedLessonPresentationBlocked && tutorialTargetBeaconOpen && !mobileHandDrag\}[\s\S]*?measureKey=\{embeddedLessonActionCueMeasureKey\}/,
  );
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

test("drag-step coaching moves to the clear top edge instead of covering the gesture corridor", () => {
  const coach = sourceSection(
    "function ProfessorCoachOverlay(",
    "function destroyedCardGoesToLostZone(",
  );

  assert.match(simulatorSource, /function getEmbeddedLessonDragCoachPlacement\([\s\S]*?boardControlClearance[\s\S]*?top: edgeMargin/);
  assert.match(coach, /const usesDragCorridor = help\?\.interaction === "drag" && Number\.isInteger\(help\?\.lessonStep\)/);
  assert.match(coach, /usesDragCorridor[\s\S]*?getEmbeddedLessonDragCoachPlacement/);
  assert.match(coach, /placement && !usesDragCorridor/);
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
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.seapals-v2-action-cue-path-line,[\s\S]*?animation:\s*none;/,
  );
  assert.match(
    simulatorSource,
    /@media \(forced-colors: active\) \{[\s\S]*?\.seapals-v2-action-cue-path-line \{ stroke: Highlight;/,
  );
});
