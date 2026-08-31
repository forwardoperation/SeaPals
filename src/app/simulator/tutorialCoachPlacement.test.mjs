import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  TUTORIAL_COACH_SIDES,
  getTutorialBeaconAnchor,
  getTutorialCoachPlacement,
} from "./tutorialCoachPlacement.mjs";

const desktopViewport = { viewportWidth: 1200, viewportHeight: 800 };
const coachRect = { left: 0, top: 0, right: 400, bottom: 240 };

function assertInsideViewport(placement, width, height, margin = 12) {
  assert.ok(placement.left >= margin);
  assert.ok(placement.top >= margin);
  assert.ok(placement.left + placement.width <= width - margin);
  assert.ok(placement.top + placement.height <= height - margin);
}

test("a lower board target moves the Professor card above it", () => {
  const placement = getTutorialCoachPlacement({
    ...desktopViewport,
    coachRect,
    targetRect: { left: 580, top: 600, right: 620, bottom: 640 },
    gap: 16,
  });

  assert.equal(placement.side, TUTORIAL_COACH_SIDES.ABOVE);
  assert.equal(placement.left, 400);
  assert.equal(placement.top, 344);
  assert.equal(placement.arrowOffset, 200);
  assert.equal(placement.constrained, false);
});

test("an upper board target moves the Professor card below it", () => {
  const placement = getTutorialCoachPlacement({
    ...desktopViewport,
    coachRect,
    targetRect: { left: 580, top: 90, right: 620, bottom: 130 },
  });

  assert.equal(placement.side, TUTORIAL_COACH_SIDES.BELOW);
  assert.ok(placement.top > 130);
  assertInsideViewport(placement, 1200, 800);
});

test("right-side HUD targets place the Professor card to their left", () => {
  const placement = getTutorialCoachPlacement({
    ...desktopViewport,
    coachRect,
    targetRect: { left: 980, top: 230, right: 1180, bottom: 340 },
  });

  assert.equal(placement.side, TUTORIAL_COACH_SIDES.LEFT);
  assert.ok(placement.left + placement.width < 980);
  assertInsideViewport(placement, 1200, 800);
});

test("mobile targets choose the open vertical band and remain clamped", () => {
  const topTarget = getTutorialCoachPlacement({
    viewportWidth: 320,
    viewportHeight: 568,
    coachRect: { left: 0, top: 0, right: 304, bottom: 180 },
    targetRect: { left: 230, top: 20, right: 310, bottom: 72 },
  });
  assert.equal(topTarget.side, TUTORIAL_COACH_SIDES.BELOW);
  assertInsideViewport(topTarget, 320, 568);
  assert.ok(topTarget.arrowOffset >= 32);
  assert.ok(topTarget.arrowOffset <= topTarget.width - 32);

  const bottomTarget = getTutorialCoachPlacement({
    viewportWidth: 320,
    viewportHeight: 568,
    coachRect: { left: 0, top: 0, right: 304, bottom: 180 },
    targetRect: { left: 12, top: 500, right: 308, bottom: 556 },
  });
  assert.equal(bottomTarget.side, TUTORIAL_COACH_SIDES.ABOVE);
  assertInsideViewport(bottomTarget, 320, 568);
});

test("mobile reef-tab anchors keep the coach below the visible board context", () => {
  for (const scenario of [
    {
      viewportWidth: 320,
      viewportHeight: 568,
      targetRect: { left: 162, top: 168, right: 308, bottom: 212 },
      coachRect: { left: 0, top: 0, right: 296, bottom: 180 },
    },
    {
      viewportWidth: 390,
      viewportHeight: 844,
      targetRect: { left: 198, top: 220, right: 378, bottom: 264 },
      coachRect: { left: 0, top: 0, right: 366, bottom: 228 },
    },
  ]) {
    const placement = getTutorialCoachPlacement(scenario);

    assert.equal(placement.side, TUTORIAL_COACH_SIDES.BELOW);
    assert.ok(placement.top > scenario.targetRect.bottom);
    assertInsideViewport(
      placement,
      scenario.viewportWidth,
      scenario.viewportHeight,
    );
  }
});

test("oversized cards use a documented constrained fallback without leaving the viewport", () => {
  const placement = getTutorialCoachPlacement({
    viewportWidth: 360,
    viewportHeight: 640,
    coachRect: { left: 0, top: 0, right: 520, bottom: 580 },
    targetRect: { left: 150, top: 280, right: 210, bottom: 360 },
  });

  assert.equal(placement.constrained, true);
  assert.equal(placement.width, 336);
  assert.equal(placement.height, 580);
  assertInsideViewport(placement, 360, 640);
});

test("missing, zero-sized, and fully offscreen targets retain the stable fallback card", () => {
  assert.equal(getTutorialCoachPlacement(), null);
  assert.equal(getTutorialCoachPlacement({
    ...desktopViewport,
    coachRect,
    targetRect: { left: 20, top: 20, right: 20, bottom: 80 },
  }), null);
  assert.equal(getTutorialCoachPlacement({
    ...desktopViewport,
    coachRect,
    targetRect: { left: 1300, top: 50, right: 1400, bottom: 100 },
  }), null);
});

test("compact cue arrows land on the exact target center after horizontal clamping", () => {
  const targetRect = { left: 1160, top: 300, right: 1200, bottom: 340 };
  const placement = getTutorialBeaconAnchor({
    viewportWidth: 1200,
    viewportHeight: 800,
    targetRect,
  });
  const renderedCueLeft = placement.left - 152;
  const renderedArrowX = renderedCueLeft + 152 + placement.arrowShift;

  assert.equal(placement.direction, TUTORIAL_COACH_SIDES.ABOVE);
  assert.equal(renderedArrowX, 1180);
  assert.equal(placement.targetX, 1180);
});

test("compact cue arrow tips stop at the referenced button edge", () => {
  const upperButton = getTutorialBeaconAnchor({
    viewportWidth: 900,
    viewportHeight: 700,
    targetRect: { left: 205, top: 134, right: 245, bottom: 174 },
  });
  assert.equal(upperButton.direction, TUTORIAL_COACH_SIDES.BELOW);
  assert.equal(upperButton.top - upperButton.arrowLength, 174);

  const lowerButton = getTutorialBeaconAnchor({
    viewportWidth: 900,
    viewportHeight: 700,
    targetRect: { left: 205, top: 334, right: 245, bottom: 374 },
  });
  assert.equal(lowerButton.direction, TUTORIAL_COACH_SIDES.ABOVE);
  assert.equal(lowerButton.top + lowerButton.arrowLength, 334);
});

test("the board tour wires its full Next card to the target-aware coach and one arrow", async () => {
  const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

  assert.match(
    simulatorSource,
    /<ProfessorCoachOverlay help=\{tutorialBoardTourHelp\}>[\s\S]*?<ProfessorGuideCard[\s\S]*?onAdvance=\{advanceTutorialBoardTour\}[\s\S]*?<\/ProfessorCoachOverlay>/,
  );
  assert.match(simulatorSource, /data-tutorial-coach-side=\{placement\?\.side\}/);
  assert.match(simulatorSource, /className="seapals-professor-coach-arrow"/);
  assert.match(simulatorSource, /--seapals-target-arrow-shift/);
  assert.match(simulatorSource, /--seapals-target-arrow-length/);
  assert.match(
    simulatorSource,
    /<ProfessorTargetBeacon[\s\S]*?active=\{tutorialTargetBeaconOpen && !tutorialBoardTourOpen && !tutorialSetupHelpAnchored\}/,
  );
  const coachAnchorSelector = simulatorSource.indexOf("[data-tutorial-coach-anchor=");
  const genericTargetSelector = simulatorSource.indexOf("[data-tutorial-target=", coachAnchorSelector);
  assert.ok(coachAnchorSelector >= 0);
  assert.ok(genericTargetSelector > coachAnchorSelector);
  assert.match(simulatorSource, /data-tutorial-coach-anchor="player-board-tab"/);
  assert.match(simulatorSource, /data-tutorial-coach-anchor="opponent-board-tab"/);
});

test("blocking simulator layers and the tutorial stay above Ask Finn", async () => {
  const [simulatorSource, rulesChatSource] = await Promise.all([
    readFile(new URL("./Simulator.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../components/rules/RulesChat.jsx", import.meta.url), "utf8"),
  ]);
  const coachZIndex = Number(
    simulatorSource.match(/\.seapals-professor-coach-wrap\s*\{[\s\S]*?z-index:\s*(\d+);/)?.[1],
  );
  const shieldZIndex = Number(
    simulatorSource.match(/tutorialBoardTourOpen\s*\?\s*<div className="fixed inset-0 z-\[(\d+)\]"/)?.[1],
  );
  const askFinnZIndex = Number(
    rulesChatSource.match(/simulatorPlacement\s*\?\s*\{\s*zIndex:\s*(\d+)\s*\}/)?.[1],
  );
  const askFinnPanelZIndex = Number(
    rulesChatSource.match(/simulatorPlacement\s*\?\s*\{\s*top:[^}]*zIndex:\s*(\d+)\s*\}/)?.[1],
  );
  const modalZIndex = Number(
    simulatorSource.match(/\{fullPageModalOpen \? \(\s*<div\s*className=\{`fixed inset-0 z-\[(\d+)\]/)?.[1],
  );
  const eventOverlayZIndex = Number(
    simulatorSource.match(/\{eventOverlay \? \(\s*<div\s*className="fixed inset-0 z-\[(\d+)\]/)?.[1],
  );
  const inspectorBackdropZIndex = Number(
    simulatorSource.match(/aria-label="Close card inspector"[^>]*className="fixed inset-0 z-\[(\d+)\]/)?.[1],
  );
  const inspectorPanelZIndex = Number(
    simulatorSource.match(/className="seapals-card-drawer[^\"]*z-\[(\d+)\]/)?.[1],
  );

  for (const blockingZIndex of [
    modalZIndex,
    eventOverlayZIndex,
    inspectorBackdropZIndex,
    inspectorPanelZIndex,
  ]) {
    assert.ok(blockingZIndex > askFinnZIndex);
    assert.ok(blockingZIndex > askFinnPanelZIndex);
  }

  assert.ok(coachZIndex > askFinnZIndex);
  assert.ok(coachZIndex > askFinnPanelZIndex);
  assert.ok(shieldZIndex > askFinnZIndex);
  assert.ok(shieldZIndex > askFinnPanelZIndex);
  assert.ok(coachZIndex > shieldZIndex);
});
