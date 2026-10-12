import { notFound } from "next/navigation";
import ReefboundLocalPlaytest from "./ReefboundLocalPlaytest";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reefbound local playtest", robots: { index: false, follow: false } };

export default function ReefboundLocalPlaytestPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ReefboundLocalPlaytest />;
}
