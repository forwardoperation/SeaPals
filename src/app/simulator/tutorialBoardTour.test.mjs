import test from "node:test";
import assert from "node:assert/strict";
import {
  GUIDED_ACADEMY_BOARD_TOUR_STEPS,
  getGuidedAcademyBoardTourStep,
  getNextGuidedAcademyBoardTourStep,
} from "./tutorialBoardTour.mjs";

test("guided Academy board tour visits the decision areas in a stable teaching order", () => {
  assert.deepEqual(
    GUIDED_ACADEMY_BOARD_TOUR_STEPS.map((step) => step.id),
    [
      "score",
      "player-ecosystem",
      "opponent-ecosystem",
      "condition",
      "resources",
      "hand",
      "zones",
      "events",
      "turn-control",
    ],
  );
  assert.equal(new Set(GUIDED_ACADEMY_BOARD_TOUR_STEPS.map((step) => step.target)).size, 9);
});

test("guided Academy board tour exposes paced Professor cues and hands off to the coin flip", () => {
  const first = getGuidedAcademyBoardTourStep(0);
  assert.equal(first.progressLabel, "Board tour • 1/9");
  assert.equal(first.advanceLabel, "Next");
  assert.equal(first.finalStep, false);
  assert.equal(getNextGuidedAcademyBoardTourStep(0), 1);

  const lastIndex = GUIDED_ACADEMY_BOARD_TOUR_STEPS.length - 1;
  const last = getGuidedAcademyBoardTourStep(lastIndex);
  assert.equal(last.target, "turn-button");
  assert.equal(last.advanceLabel, "Flip Coin");
  assert.match(last.action, /opening call.*guided setup/i);
  assert.equal(last.finalStep, true);
  assert.equal(getNextGuidedAcademyBoardTourStep(lastIndex), null);
});

test("guided Academy board tour rejects missing and out-of-range steps", () => {
  assert.equal(getGuidedAcademyBoardTourStep(null), null);
  assert.equal(getGuidedAcademyBoardTourStep(-1), null);
  assert.equal(getGuidedAcademyBoardTourStep(GUIDED_ACADEMY_BOARD_TOUR_STEPS.length), null);
  assert.equal(getGuidedAcademyBoardTourStep(1.5), null);
});
