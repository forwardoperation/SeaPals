import Simulator from "./Simulator";
import { getValidSimulatorDeck } from "./simulatorDeckRoute.mjs";

export const metadata = {
  title: "Simulator | SeaPals TCG",
  description: "A turn-based simulator for experimenting with play patterns.",
  alternates: { canonical: "/simulator" },
};

export default async function SimulatorPage({ searchParams }) {
  const params = await searchParams;
  const initialDeckId = getValidSimulatorDeck(params?.deck)?.id ?? null;

  return (
    <Simulator
      key={initialDeckId ?? "default"}
      initialDeckId={initialDeckId}
    />
  );
}
