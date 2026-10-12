import { notFound } from "next/navigation";
import ReefboundPreview from "./ReefboundPreview";

export const dynamic = "force-dynamic";

export default async function ReefboundPreviewPage({ searchParams }) {
  // A local rendering harness, never an alternative entrance to account saves.
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  return <ReefboundPreview embedded={params?.embedded === "1"} />;
}
