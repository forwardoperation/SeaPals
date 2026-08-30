import StandaloneTutorial from "@/app/instructions/tutorial/StandaloneTutorial";
import { getValidSimulatorDeck } from "@/app/simulator/simulatorDeckRoute.mjs";
import {
  STANDALONE_TUTORIAL_RETURN_PATH,
  createStandaloneTutorialStoryModeData,
} from "@/app/instructions/tutorial/standaloneTutorialConfig.mjs";

export const metadata = {
  title: "Guided Tutorial V2 Preview | SeaPals TCG",
  description: "A work-in-progress preview of the redesigned guided SeaPals lesson.",
  robots: { index: false, follow: false },
};

export default async function InstructionsTutorialV2Page({ searchParams }) {
  const params = await searchParams;
  const returnDeck = getValidSimulatorDeck(params?.returnDeck);
  const returnPath = returnDeck
    ? `/simulator-v2?deck=${encodeURIComponent(returnDeck.id)}`
    : "/simulator-v2";
  const returnDeckName = returnDeck?.name.replace(/\s+Deck$/i, "");
  const storyModeData = {
    ...createStandaloneTutorialStoryModeData(),
    returnLabel: returnDeckName ? `${returnDeckName} Trial` : "V2 Preview",
  };

  return (
    <StandaloneTutorial
      storyModeData={storyModeData}
      returnPath={returnPath || STANDALONE_TUTORIAL_RETURN_PATH}
      previewExperience
    />
  );
}
