import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GUIDED_ACADEMY_LAYOUT_ACTIONS,
  completeGuidedAcademyLayoutAction,
  createGuidedAcademyLayoutProgress,
  getGuidedAcademyFoundationPlacementTarget,
  getPreparedTutorialFoundationPlacement,
  getGuidedAcademyLayoutLessonStep,
} from "./tutorialLayoutLesson.mjs";

test("the Academy layout lesson requires every real view and arrangement control in order", () => {
  let progress = createGuidedAcademyLayoutProgress();
  const observed = [];

  while (true) {
    const step = getGuidedAcademyLayoutLessonStep(progress, { foundationName: "Mustard Hill Coral" });
    if (!step) break;
    observed.push({ actionId: step.actionId, target: step.target });
    progress = completeGuidedAcademyLayoutAction(progress, step.actionId);
  }

  assert.deepEqual(observed, [
    { actionId: GUIDED_ACADEMY_LAYOUT_ACTIONS.ZOOM_IN, target: "player-zoom-in" },
    { actionId: GUIDED_ACADEMY_LAYOUT_ACTIONS.ZOOM_OUT, target: "player-zoom-out" },
    { actionId: GUIDED_ACADEMY_LAYOUT_ACTIONS.MOVE_FOUNDATION, target: "foundation-drag" },
    { actionId: GUIDED_ACADEMY_LAYOUT_ACTIONS.MOVE_SLOT, target: "slot-drag" },
    { actionId: GUIDED_ACADEMY_LAYOUT_ACTIONS.FIT, target: "player-zoom-fit" },
  ]);
  assert.equal(getGuidedAcademyLayoutLessonStep(progress), null);
});

test("layout copy explains that controls organize the view without changing game rules", () => {
  const zoom = getGuidedAcademyLayoutLessonStep({});
  assert.match(zoom.message, /changes only your view/i);

  const foundation = getGuidedAcademyLayoutLessonStep({
    [GUIDED_ACADEMY_LAYOUT_ACTIONS.ZOOM_IN]: true,
    [GUIDED_ACADEMY_LAYOUT_ACTIONS.ZOOM_OUT]: true,
  }, { foundationName: "Mustard Hill Coral" });
  assert.match(foundation.message, /Mustard Hill Coral/i);
  assert.match(foundation.message, /only the visual arrangement/i);

  const slot = getGuidedAcademyLayoutLessonStep({
    [GUIDED_ACADEMY_LAYOUT_ACTIONS.ZOOM_IN]: true,
    [GUIDED_ACADEMY_LAYOUT_ACTIONS.ZOOM_OUT]: true,
    [GUIDED_ACADEMY_LAYOUT_ACTIONS.MOVE_FOUNDATION]: true,
  });
  assert.match(slot.message, /does not change which card class it accepts/i);
});

test("guided foundation targets spread early tutorial cards across distinct open areas", () => {
  const positions = Array.from({ length: 5 }, (_, index) => (
    getGuidedAcademyFoundationPlacementTarget(index)
  ));
  assert.deepEqual(
    positions[0],
    { x: 50, y: 24 },
    "the first foundation marker must stay above the mobile Professor card",
  );
  assert.equal(new Set(positions.map(({ x, y }) => `${x}:${y}`)).size, positions.length);
  for (let left = 0; left < positions.length; left += 1) {
    for (let right = left + 1; right < positions.length; right += 1) {
      assert.ok(
        Math.hypot(
          positions[left].x - positions[right].x,
          positions[left].y - positions[right].y,
        ) >= 30,
      );
      const horizontalSeparation = Math.abs(positions[left].x - positions[right].x) / 100 * 1040;
      const verticalSeparation = Math.abs(positions[left].y - positions[right].y) / 100 * 585;
      assert.ok(
        horizontalSeparation >= 220 || verticalSeparation >= 260,
        `planned foundation ${left + 1} must not cover foundation ${right + 1}`,
      );
    }
  }
  assert.throws(() => getGuidedAcademyFoundationPlacementTarget(-1), /non-negative/);
});

test("prepared lesson foundations open in a mobile-clear two-dimensional grid", () => {
  const mobileBoard = { width: 375, height: 350 };
  const foundationFootprint = { width: 240, height: 280 };

  for (let total = 1; total <= 6; total += 1) {
    const positions = Array.from({ length: total }, (_, index) => (
      getPreparedTutorialFoundationPlacement(index, total)
    ));
    assert.equal(new Set(positions.map(({ x, y }) => `${x}:${y}`)).size, total);
    if (total >= 3) {
      assert.ok(new Set(positions.map(({ y }) => y)).size > 1, `${total} prepared Foundations use more than one row`);
    }
    for (let left = 0; left < positions.length; left += 1) {
      for (let right = left + 1; right < positions.length; right += 1) {
        const horizontal = Math.abs(positions[left].x - positions[right].x) / 100 * mobileBoard.width;
        const vertical = Math.abs(positions[left].y - positions[right].y) / 100 * mobileBoard.height;
        assert.ok(
          horizontal >= foundationFootprint.width || vertical >= foundationFootprint.height,
          `prepared Foundation ${left + 1} must clear Foundation ${right + 1} on a narrow board`,
        );
      }
    }
  }

  assert.throws(() => getPreparedTutorialFoundationPlacement(2, 2), /valid index/);
  assert.throws(() => getPreparedTutorialFoundationPlacement(0, 0), /positive total/);
});

test("the prepared Habitat lesson clears attached cards and neighboring slot markers", () => {
  const portraitBoard = { width: 750, height: 747 };
  const foundationSize = { width: 180, height: 220 };
  const foundationWrapper = { width: 240, height: 280 };
  const slotRadius = 92 / 100;
  const branches = [
    { slotCount: 4, filledSlots: new Set() },
    { slotCount: 2, filledSlots: new Set([0, 1]) },
    { slotCount: 4, filledSlots: new Set() },
    { slotCount: 2, filledSlots: new Set() },
  ];
  const rectangle = (centerX, centerY, width, height, label) => ({
    label,
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: centerY - height / 2,
    bottom: centerY + height / 2,
  });
  const cardsByBranch = branches.map((branch, branchIndex) => {
    const placement = getPreparedTutorialFoundationPlacement(branchIndex, branches.length);
    const centerX = placement.x / 100 * portraitBoard.width;
    const centerY = placement.y / 100 * portraitBoard.height;
    const cards = [rectangle(
      centerX,
      centerY - (foundationWrapper.height - foundationSize.height) / 2,
      foundationSize.width,
      foundationSize.height,
      `Foundation ${branchIndex + 1}`,
    )];
    for (let slotIndex = 0; slotIndex < branch.slotCount; slotIndex += 1) {
      const angle = slotIndex / branch.slotCount * Math.PI * 2 - Math.PI / 2;
      const slotCenterX = centerX + Math.cos(angle) * slotRadius * foundationWrapper.width;
      const slotCenterY = centerY + Math.sin(angle) * slotRadius * foundationWrapper.height;
      const filled = branch.filledSlots.has(slotIndex);
      cards.push(rectangle(
        slotCenterX,
        slotCenterY,
        filled ? 180 : 112,
        filled ? 220 : 112,
        `${filled ? "Card" : "Slot"} ${branchIndex + 1}.${slotIndex + 1}`,
      ));
    }
    return cards;
  });

  for (let leftBranch = 0; leftBranch < cardsByBranch.length; leftBranch += 1) {
    for (let rightBranch = leftBranch + 1; rightBranch < cardsByBranch.length; rightBranch += 1) {
      for (const left of cardsByBranch[leftBranch]) {
        for (const right of cardsByBranch[rightBranch]) {
          const horizontalOverlap = Math.min(left.right, right.right) - Math.max(left.left, right.left);
          const verticalOverlap = Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
          assert.ok(
            horizontalOverlap <= 0 || verticalOverlap <= 0,
            `${left.label} must clear ${right.label}`,
          );
        }
      }
    }
  }
});

test("guided foundation targets avoid Coral cards already on the live board", () => {
  const target = getGuidedAcademyFoundationPlacementTarget([
    { cardId: "mustard-hill-coral-base", x: 50, y: 50 },
  ]);

  assert.deepEqual(target, { x: 18, y: 72 });
  assert.ok(
    Math.abs(target.x - 50) >= 30 || Math.abs(target.y - 50) >= 38,
    "the drop target must clear the existing Coral card",
  );

  const crowdedTarget = getGuidedAcademyFoundationPlacementTarget([
    { x: 20, y: 50 },
    { x: 50, y: 50 },
    { x: 80, y: 50 },
  ]);
  assert.ok(crowdedTarget.y <= 24, "a crowded middle row should send the player to open water above it");
});

test("the live simulator wires each lesson to its real control and a precise placement marker", () => {
  const simulator = readFileSync(new URL("./Simulator.jsx", import.meta.url), "utf8");
  assert.match(simulator, /data-tutorial-target="player-zoom-in"[\s\S]{0,700}GUIDED_ACADEMY_LAYOUT_ACTIONS\.ZOOM_IN/);
  assert.match(simulator, /data-tutorial-target="player-zoom-out"[\s\S]{0,700}GUIDED_ACADEMY_LAYOUT_ACTIONS\.ZOOM_OUT/);
  assert.match(simulator, /data-tutorial-target="player-zoom-fit"[\s\S]{0,700}GUIDED_ACADEMY_LAYOUT_ACTIONS\.FIT/);
  assert.match(simulator, /data-tutorial-target=\{[\s\S]{0,220}"foundation-drag"/);
  assert.match(simulator, /data-tutorial-target=\{[\s\S]{0,220}"slot-drag"/);
  assert.match(simulator, /guidedFoundationPlacementTarget[\s\S]{0,200}\?\? getPlacementCoordinates/);
  assert.match(simulator, /data-tutorial-target="placement"[\s\S]{0,700}Place here/);
  assert.match(simulator, /const safeZoom = Math\.max\(0\.01, ecosystemZoom\)/);
  assert.match(simulator, /dx \/ safeZoom/);
  assert.match(simulator, /dy \/ safeZoom/);
});
