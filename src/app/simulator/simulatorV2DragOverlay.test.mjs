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
    "function ProfessorCoachOverlay(",
  );

  assert.match(finder, /data-v2-lesson-drop-cards~/);
  assert.match(finder, /help\?\.dragDestination === "clear-water"/);
  assert.match(finder, /data-v2-lesson-clear-water-destination/);
  assert.match(finder, /Math\.hypot/);
  assert.match(cue, /const source = findTutorialTarget\(help\)/);
  assert.match(cue, /findEmbeddedLessonDragDestination\(help, source\.rect\)/);
  assert.match(cue, /className=\{`seapals-v2-action-cue is-drag is-path\$\{layoutMove[\s\S]*?\$\{dragging/);
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

test("clear-water layout moves keep a large, distant target at fitted board zoom", () => {
  const helperSource = sourceSection(
    "function getEmbeddedLessonClearWaterCueRect(",
    "function getEmbeddedLessonDragPath(",
  );
  const getCueRect = Function(`return (${helperSource})`)();
  const center = (rect) => ({
    x: rect.left + (rect.width / 2),
    y: rect.top + (rect.height / 2),
  });
  const assertLegibleCue = ({ sourceRect, hintRect, boardRect }) => {
    const cue = getCueRect({ sourceRect, hintRect, boardRect });
    const sourceCenter = center(sourceRect);
    const hintCenter = center(hintRect);
    const cueCenter = center(cue);
    const directionDot = ((hintCenter.x - sourceCenter.x) * (cueCenter.x - sourceCenter.x))
      + ((hintCenter.y - sourceCenter.y) * (cueCenter.y - sourceCenter.y));

    assert.ok(cue.width >= 56, `expected a readable target, received ${cue.width}px`);
    assert.equal(cue.width, cue.height);
    assert.ok(Math.hypot(cueCenter.x - sourceCenter.x, cueCenter.y - sourceCenter.y) >= 140);
    assert.ok(directionDot > 0, "the enlarged cue should preserve the authored move direction when space permits");
    assert.ok(cue.left >= boardRect.left + 19);
    assert.ok(cue.top >= boardRect.top + 19);
    assert.ok(cue.left + cue.width <= boardRect.left + boardRect.width - 19);
    assert.ok(cue.top + cue.height <= boardRect.top + boardRect.height - 19);
  };

  assertLegibleCue({
    sourceRect: { left: 610, top: 470, width: 38, height: 46 },
    hintRect: { left: 515, top: 440, width: 18, height: 18 },
    boardRect: { left: 20, top: 360, width: 1240, height: 340 },
  });
  assertLegibleCue({
    sourceRect: { left: 184, top: 590, width: 44, height: 54 },
    hintRect: { left: 275, top: 625, width: 24, height: 24 },
    boardRect: { left: 16, top: 470, width: 358, height: 350 },
  });
});

test("layout movement uses a direct path while hand-card drags retain their upward lift", () => {
  const pathSource = sourceSection(
    "function getEmbeddedLessonDragPath(",
    "function EmbeddedLessonHandIcon(",
  );
  const getEmbeddedLessonDragPath = Function(`return (${pathSource})`)();
  const source = { left: 300, top: 520, width: 40, height: 48 };
  const destination = { left: 100, top: 430, width: 64, height: 64 };
  const layoutPath = getEmbeddedLessonDragPath(source, destination, { layoutMove: true });
  const cardPath = getEmbeddedLessonDragPath(source, destination);

  const expectedControl1X = layoutPath.start.x + ((layoutPath.end.x - layoutPath.start.x) * .3);
  const expectedControl1Y = layoutPath.start.y + ((layoutPath.end.y - layoutPath.start.y) * .3);
  assert.equal(layoutPath.control1.x, expectedControl1X);
  assert.equal(layoutPath.control1.y, expectedControl1Y);
  assert.ok(cardPath.control1.y < cardPath.start.y);
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
    /embeddedLessonEcosystemDropPosition[\s\S]*?getGuidedAcademyFoundationPlacementTarget\(playerCorals\)[\s\S]*?\{ x: 72, y: 38 \}/,
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
    "function ProfessorCoachOverlay(",
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
    /<EmbeddedLessonActionCue[\s\S]*?active=\{embeddedLessonActionReady && !embeddedLessonPresentationBlocked && tutorialTargetBeaconOpen\}[\s\S]*?measureKey=\{embeddedLessonActionCueMeasureKey\}[\s\S]*?dragging=\{Boolean\(mobileHandDrag \|\| draggingCoralId \|\| slotDragStart\)\}/,
  );
  const helpState = sourceSection(
    "const tutorialHelp = tutorialContract && !embeddedLessonAutoEndingOpeningTurn ?",
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
  assert.match(cue, /getEmbeddedLessonClearWaterCueRect\(\{/);
  assert.match(cue, /getEmbeddedLessonDragPath\(layout\.sourceRect, layout\.destinationRect, \{ layoutMove \}\)/);
  assert.match(cue, /data-v2-clear-water-cue=\{layoutMove \? "true" : undefined\}/);
  assert.match(cue, /seapals-v2-action-cue-source-label">HOLD/);
  assert.match(cue, /seapals-v2-action-cue-destination-label">MOVE HERE/);
  assert.match(simulatorSource, /<ProfessorGuideCard[\s\S]*?help=\{tutorialHelp\}[\s\S]*?dragPassive=\{Boolean\(mobileHandDrag \|\| draggingCoralId \|\| slotDragStart\)\}/);
  assert.match(
    simulatorSource,
    /EMBEDDED_LESSON_CLEAR_WATER_DESTINATIONS[\s\S]*?"move-foundation"[\s\S]*?"move-slot"[\s\S]*?data-v2-lesson-clear-water-destination=\{tutorialHelp\.actionId\}/,
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

test("all in-board coaching stays fixed at screen-left while the hand points to the action", () => {
  const coach = sourceSection(
    "function ProfessorCoachOverlay(",
    "function destroyedCardGoesToLostZone(",
  );

  assert.match(coach, /data-tutorial-coach-placement="screen-left"/);
  assert.doesNotMatch(coach, /getTutorialCoachPlacement|getTutorialDividerCoachPlacement|findTutorialTarget|ResizeObserver/);
  const coachCss = simulatorSource.match(/\.seapals-professor-coach-wrap\s*\{([^}]+)\}/)?.[1];
  assert.ok(coachCss, "missing shared coach wrapper style");
  assert.match(coachCss, /position:\s*fixed/);
  assert.match(coachCss, /top:\s*50%/);
  assert.match(coachCss, /left:\s*(?:1rem|12px)/);
  assert.match(coachCss, /width:\s*min\(23rem, calc\(100vw - 2rem\)\)/);
  assert.match(coachCss, /max-height:\s*calc\(100dvh - 1\.5rem\)/);
  assert.match(coachCss, /transform:\s*translateY\(-50%\)/);
  assert.doesNotMatch(coachCss, /transition:\s*(?:left|top)/);
  assert.match(simulatorSource, /\.seapals-professor-coach-wrap > \[data-v2-lesson-panel="coach"\]\s*\{[^}]*overflow-y:\s*auto/);

  for (const help of ["embeddedLessonPreVictoryHelp", "embeddedCompactCoachHelp", "tutorialHelp", "tutorialBoardTourHelp"]) {
    assert.match(simulatorSource, new RegExp(`<ProfessorGuideCard[\\s\\S]{0,400}?help=\\{${help}\\}`));
  }
  assert.match(simulatorSource, /\) : tutorialHelpFloating \? \(\s*<ProfessorCoachOverlay>[\s\S]*?<ProfessorGuideCard[\s\S]*?help=\{tutorialHelp\}/);
  assert.match(simulatorSource, /<EmbeddedLessonActionCue[\s\S]*?active=\{embeddedLessonActionReady && !embeddedLessonPresentationBlocked && tutorialTargetBeaconOpen\}/);
});

test("tap cues remain target-local and the hand travels smoothly along the exact path", () => {
  const cue = sourceSection(
    "function EmbeddedLessonActionCue(",
    "function ProfessorCoachOverlay(",
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
