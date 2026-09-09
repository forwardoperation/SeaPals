import SimulatorAnalytics from "./SimulatorAnalytics";

export const metadata = {
  title: "Simulator V2 Analytics | SeaPals TCG",
  description: "Explore anonymous simulator-v2 play data: card usage, deck win rates, abilities, resources, and game balance across human players and AI difficulties.",
  alternates: { canonical: "/simulator-v2/analytics" },
};

export default function SimulatorAnalyticsPage() {
  return <SimulatorAnalytics />;
}
