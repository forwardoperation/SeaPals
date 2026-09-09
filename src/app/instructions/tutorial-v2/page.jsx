import { redirect } from "next/navigation";
import { getValidSimulatorDeck } from "@/app/simulator/simulatorDeckRoute.mjs";

export default async function InstructionsTutorialV2Page({ searchParams }) {
  const params = await searchParams;
  const deck = getValidSimulatorDeck(params?.returnDeck);
  redirect(`/simulator-v2?tutorial=1${deck ? `&deck=${encodeURIComponent(deck.id)}` : ""}`);
}
