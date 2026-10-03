import StandaloneTutorial from "./StandaloneTutorial";
import {
  createSimulatorDeckHref,
  getValidSimulatorDeck,
} from "@/app/simulator/simulatorDeckRoute.mjs";

export const metadata = {
  title: "Guided Interactive Tutorial | SeaRealm TCG",
  description:
    "Learn SeaRealm with Mr. Easterling's guided simulator lessons, from your first reef to attacks, Apex creatures, and open-water ecosystems.",
  alternates: { canonical: "/instructions/tutorial" },
};

export default async function InstructionsTutorialPage({ searchParams }) {
  const params = await searchParams;
  const returnDeck = getValidSimulatorDeck(params?.returnDeck);
  const returnPath =
    createSimulatorDeckHref(returnDeck?.id) ?? "/instructions#learn-by-doing";

  return (
    <StandaloneTutorial
      key={returnDeck?.id ?? "default"}
      initialDeckId={returnDeck?.id ?? null}
      returnPath={returnPath}
    />
  );
}
