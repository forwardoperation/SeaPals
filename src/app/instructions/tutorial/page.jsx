import StandaloneTutorial from "./StandaloneTutorial";
import {
  createSimulatorDeckHref,
  getValidSimulatorDeck,
} from "@/app/simulator/simulatorDeckRoute.mjs";
import {
  STANDALONE_TUTORIAL_RETURN_PATH,
  createStandaloneTutorialStoryModeData,
} from "./standaloneTutorialConfig.mjs";

export const metadata = {
  title: "Guided Interactive Tutorial | SeaPals TCG",
  description:
    "Learn SeaPals by playing Mr. Easterling's complete guided aquarium lesson.",
};

export default async function InstructionsTutorialPage({ searchParams }) {
  const params = await searchParams;
  const returnDeck = getValidSimulatorDeck(params?.returnDeck);
  const returnPath =
    createSimulatorDeckHref(returnDeck?.id) ?? STANDALONE_TUTORIAL_RETURN_PATH;
  const returnDeckName = returnDeck?.name.replace(/\s+Deck$/i, "");
  const storyModeData = {
    ...createStandaloneTutorialStoryModeData(),
    returnLabel: returnDeckName ? `${returnDeckName} Trial` : "Instructions",
  };

  return (
    <StandaloneTutorial
      storyModeData={storyModeData}
      returnPath={returnPath}
    />
  );
}
