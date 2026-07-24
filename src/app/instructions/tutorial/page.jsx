import StandaloneTutorial from "./StandaloneTutorial";
import {
  STANDALONE_TUTORIAL_RETURN_PATH,
  createStandaloneTutorialStoryModeData,
} from "./standaloneTutorialConfig.mjs";

export const metadata = {
  title: "Guided Interactive Tutorial | SeaPals TCG",
  description:
    "Learn SeaPals by playing Mr. Easterling's complete guided aquarium lesson.",
};

export default function InstructionsTutorialPage() {
  return (
    <StandaloneTutorial
      storyModeData={createStandaloneTutorialStoryModeData()}
      returnPath={STANDALONE_TUTORIAL_RETURN_PATH}
    />
  );
}
