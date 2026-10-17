import "../styles/globals.css";
import Header from "@/components/layout/Header";
import SiteFooter from "@/components/layout/SiteFooter";
import OceanBackground from "@/components/layout/OceanBackground";
import oceanStyles from "@/components/layout/OceanBackground.module.css";
import RulesChat from "@/components/rules/RulesChat";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import { CANONICAL_SITE_ORIGIN } from "@/lib/siteIdentity.mjs";

export const metadata = {
  metadataBase: new URL(CANONICAL_SITE_ORIGIN),
  title: "SeaRealm Trading Card Game",
  description:
    "A fast, face-to-face marine-life strategy game for families who want fun, learning, and a clear Christian worldview.",
  openGraph: {
    title: "SeaRealm Trading Card Game",
    description:
      "Discover real ocean creatures, build your ecosystem, and bring SeaRealm to the table.",
    type: "website",
    images: [
      {
        url: "/og-searealm-2026-10-v2.png",
        width: 1200,
        height: 630,
        alt: "SeaRealm Trading Card Game logo above full-art Reef Manta Ray, Humpback Whale, and Great White cards.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SeaRealm Trading Card Game",
    description:
      "Discover real ocean creatures, build your ecosystem, and bring SeaRealm to the table.",
    images: ["/og-searealm-2026-10-v2.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${oceanStyles.site} text-slate-800`}>
        <OceanBackground />
        <div className="mx-auto max-w-6xl px-6 py-6 md:px-10">
          <Header />
          <div className={oceanStyles.pageContent}>{children}</div>
          <SiteFooter />
        </div>

        <RulesChat />

        <GoogleAnalytics />
      </body>
    </html>
  );
}
