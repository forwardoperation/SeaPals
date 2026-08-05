export const TUTORIAL_FINAL_ROUND_MILESTONE = "pre-apex";

/**
 * Creates the one-time handoff from the Whale Shark lesson to the authored
 * final round. Returning null keeps ordinary Ocean-creature plays unchanged.
 */
export function createTutorialFinalRoundMilestone({
  tutorialActive = false,
  scriptedLesson = false,
  round = 0,
  cardId = null,
  finishPlan = null,
} = {}) {
  const finishRound = Number(finishPlan?.finishRound);
  const targetVp = Number(finishPlan?.victoryTarget);
  const preApexVp = Number(finishPlan?.preApexVp);
  if (
    !tutorialActive
    || !scriptedLesson
    || !Number.isFinite(finishRound)
    || Number(round) !== finishRound - 1
    || cardId !== finishPlan?.filterFeederCardId
    || !Number.isFinite(preApexVp)
    || !Number.isFinite(targetVp)
  ) {
    return null;
  }

  return Object.freeze({
    type: "tutorial-final-round-milestone",
    sourceCardId: cardId,
    title: `${preApexVp} / ${targetVp} VP — One Final Round Remains`,
    message: `Whale Shark brings your aquarium reef to ${preApexVp} of ${targetVp} VP. This is a milestone, not the end of the lesson. Continue into the final round, play Deep Sea Fishing to find Hammerhead, then place Hammerhead to reach ${targetVp} VP.`,
    success: true,
    tutorialMilestone: TUTORIAL_FINAL_ROUND_MILESTONE,
    continueLabel: "Continue to Final Round",
    continueToEndTurn: true,
  });
}

/** The initial story-duel briefing has no practice board to lose. */
export function shouldConfirmTutorialExit({
  isStoryMode = false,
  tutorialActive = false,
  gameResult = null,
  initialOverlay = false,
} = {}) {
  return Boolean(isStoryMode && tutorialActive && !gameResult && !initialOverlay);
}

export function isTutorialLessonVictory({
  tutorialActive = false,
  gameResult = null,
  playerVp = 0,
  victoryTarget = 0,
} = {}) {
  const target = Number(victoryTarget);
  return Boolean(
    tutorialActive
    && /^Victory:/i.test(String(gameResult ?? ""))
    && Number.isFinite(target)
    && target > 0
    && Number(playerVp) >= target
  );
}
