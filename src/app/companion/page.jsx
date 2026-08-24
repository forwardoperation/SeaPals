import Companion from "./Companion";

export const metadata = {
  title: "Game Companion | SeaPals TCG",
  description: "Touch-friendly victory point and School Density trackers with a complete virtual dice tray.",
  alternates: { canonical: "/companion" },
};

export default function CompanionPage() {
  return <Companion />;
}
