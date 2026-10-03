import SimulatorV2Experience from "./SimulatorV2Experience";
import { getValidSimulatorDeck } from "./simulatorDeckRoute.mjs";

export const metadata = {
  title: "Simulator | SeaRealm TCG",
  description: "Learn SeaRealm with guided lessons, try a deck, and play against an adjustable AI opponent.",
  alternates: { canonical: "/simulator" },
};

export default async function SimulatorPage({ searchParams }) {
  const params = await searchParams;
  const initialDeckId = getValidSimulatorDeck(params?.deck)?.id ?? null;
  const initialTutorial = params?.tutorial === "1";

  return (
    <SimulatorV2Experience
      key={`${initialDeckId ?? "default"}:${initialTutorial ? "tutorial" : "match"}`}
      initialDeckId={initialDeckId}
      initialTutorial={initialTutorial}
    />
  );
}
