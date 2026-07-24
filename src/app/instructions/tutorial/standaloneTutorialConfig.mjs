import { resolveAdventureTutorial } from "../../adventure/adventureContent.mjs";

export const STANDALONE_TUTORIAL_ID = "tutorial-shellshore-live-basics";
export const STANDALONE_TUTORIAL_PLAYER_DECK_ID = "coral-garden";
export const STANDALONE_TUTORIAL_RETURN_PATH = "/instructions#learn-by-doing";

const GUIDE_PORTRAIT_SRC = "/images/adventure/mr-easterling-portrait-v2.png";

export function createStandaloneTutorialStoryModeData() {
  const tutorial = resolveAdventureTutorial(STANDALONE_TUTORIAL_ID);
  if (!tutorial?.mentor || !tutorial?.practiceEncounter) {
    throw new Error(`Unable to resolve standalone SeaPals tutorial: ${STANDALONE_TUTORIAL_ID}.`);
  }

  return {
    encounterId: tutorial.practiceEncounter.id,
    opponentId: tutorial.mentor.id,
    playerDeckId: STANDALONE_TUTORIAL_PLAYER_DECK_ID,
    opponentDeckId: tutorial.practiceEncounter.opponentDeckId,
    victoryTarget: tutorial.victoryTarget,
    difficulty: tutorial.practiceEncounter.difficulty,
    opponentName: tutorial.mentor.name,
    returnLabel: "Instructions",
    tutorial: {
      scriptedDecks: true,
      guide: {
        name: tutorial.mentor.name,
        role: tutorial.mentor.title,
        portraitSrc: GUIDE_PORTRAIT_SRC,
      },
      contract: {
        id: tutorial.id,
        title: `${tutorial.mentor.name}'s Live Lesson`,
        ordered: tutorial.ordered,
        checkpoints: tutorial.checkpoints,
      },
    },
  };
}
