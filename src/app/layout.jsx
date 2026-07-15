import "../styles/globals.css";
import Header from "@/components/layout/Header";
import RulesChat from "@/components/rules/RulesChat";
import Script from "next/script";

export const metadata = {
  metadataBase: new URL("https://seapalstcg.com"),
  title: "SeaPals TCG | Creation-Focused Family Card Game",
  description:
    "A fast, face-to-face marine-life strategy game for families who want fun, learning, and a clear Christian worldview.",
  openGraph: {
    title: "SeaPals TCG | A family game with a world you can trust",
    description:
      "Build living reefs, discover real ocean creatures, and bring siblings and friends back to the same table.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "SeaPals cards underwater with the message: A family game with a world you can trust.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SeaPals TCG | A family game with a world you can trust",
    description:
      "Real marine life, face-to-face play, and a clear creation-focused worldview.",
    images: ["/og.png"],
  },
};

const GA_ID = "G-WT26D58KF0";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-b from-sky-50 via-cyan-50 to-white text-slate-800">
        <div className="mx-auto max-w-6xl px-6 py-6 md:px-10">
          <Header />
          <div className="mt-8">{children}</div>
        </div>

        <RulesChat />

        {/* Google Analytics */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
