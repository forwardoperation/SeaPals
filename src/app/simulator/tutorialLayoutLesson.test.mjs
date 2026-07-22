import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GUIDED_ACADEMY_LAYOUT_ACTIONS,
  completeGuidedAcademyLayoutAction,
  createGuidedAcademyLayoutProgress,
  getGuidedAcademyFoundationPlacementTarget,
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
