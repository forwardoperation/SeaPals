import Simulator from "@/app/simulator/Simulator";
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
    <Simulator
      key={initialDeckId ?? "default"}
      initialDeckId={initialDeckId}
      previewExperience
    />
  );
}
