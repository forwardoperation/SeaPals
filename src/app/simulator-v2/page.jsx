import SimulatorV2Experience from "@/app/simulator/SimulatorV2Experience";
import { getValidSimulatorDeck } from "@/app/simulator/simulatorDeckRoute.mjs";

export const metadata = {
  title: "Simulator V2 Preview | SeaPals TCG",
  description: "A work-in-progress preview of the redesigned SeaPals simulator.",
  robots: { index: false, follow: false },
};

export default async function SimulatorV2Page({ searchParams }) {
  const params = await searchParams;
  const initialDeckId = getValidSimulatorDeck(params?.deck)?.id ?? null;

  return (
    <SimulatorV2Experience
      key={initialDeckId ?? "default"}
      initialDeckId={initialDeckId}
      initialTutorial={params?.tutorial === "1"}
    />
  );
}
