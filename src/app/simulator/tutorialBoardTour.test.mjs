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
      "condition",
      "resources",
      "zones",
      "hand",
      "turn-control",
      "opponent-ecosystem",
      "player-ecosystem",
    ],
  );
  assert.deepEqual(
    GUIDED_ACADEMY_BOARD_TOUR_STEPS.slice(0, 6).map((step) => step.target),
    ["vp-score", "condition-panel", "rp-bank", "zones", "hand", "turn-button"],
  );
  assert.deepEqual(
    GUIDED_ACADEMY_BOARD_TOUR_STEPS.slice(6).map((step) => step.target),
    ["opponent-board", "player-board"],
  );
  assert.equal(new Set(GUIDED_ACADEMY_BOARD_TOUR_STEPS.map((step) => step.target)).size, 8);
  assert.equal(GUIDED_ACADEMY_BOARD_TOUR_STEPS[6].coachAnchor, "opponent-board-tab");
  assert.equal(GUIDED_ACADEMY_BOARD_TOUR_STEPS[7].coachAnchor, "player-board-tab");
});

test("guided Academy board tour exposes paced Professor cues and hands off to the coin flip", () => {
  const first = getGuidedAcademyBoardTourStep(0);
  assert.match(first.message, /now that you can read your first card.*map the match table/i);
  assert.equal(first.progressLabel, "Board tour • 1/8");
  assert.equal(first.advanceLabel, "Next");
  assert.equal(first.finalStep, false);
  assert.equal(getNextGuidedAcademyBoardTourStep(0), 1);

  const opposingReef = getGuidedAcademyBoardTourStep(6, { guideName: "Mr. Easterling" });
  assert.match(opposingReef.message, /I prepared durable Corals.*compatible practice targets/i);
  assert.doesNotMatch(opposingReef.message, /Mr\. Easterling has prepared/i);
  assert.doesNotMatch(opposingReef.message, /Professor Current/i);

  const condition = getGuidedAcademyBoardTourStep(1);
  assert.equal(condition.title, "Conditions model a changing ocean");
  assert.match(condition.message, /sunlight.*temperature.*visibility.*nutrients.*currents.*food availability/i);
  assert.match(condition.message, /simplified model.*real ecological question.*ecosystem can support/i);
  assert.match(condition.pointerPrompt, /environment changes the game/i);

  const turnControl = GUIDED_ACADEMY_BOARD_TOUR_STEPS.find((step) => step.id === "turn-control");
  assert.match(turnControl.message, /Begin Round.*Next Round/i);
  assert.doesNotMatch(turnControl.message, /ends your turn/i);

  const lastIndex = GUIDED_ACADEMY_BOARD_TOUR_STEPS.length - 1;
  const last = getGuidedAcademyBoardTourStep(lastIndex);
  assert.equal(last.target, "player-board");
  assert.equal(last.advanceLabel, "Call the Coin");
  assert.match(last.message, /completes our board tour.*call and toss the coin/i);
  assert.match(last.action, /choose heads or tails.*toss it yourself/i);
  assert.equal(last.finalStep, true);
  assert.equal(getNextGuidedAcademyBoardTourStep(lastIndex), null);
});

test("guided Academy board tour rejects missing and out-of-range steps", () => {
  assert.equal(getGuidedAcademyBoardTourStep(null), null);
  assert.equal(getGuidedAcademyBoardTourStep(-1), null);
  assert.equal(getGuidedAcademyBoardTourStep(GUIDED_ACADEMY_BOARD_TOUR_STEPS.length), null);
  assert.equal(getGuidedAcademyBoardTourStep(1.5), null);
});
