import "../styles/globals.css";
import Header from "@/components/layout/Header";
import RulesChat from "@/components/rules/RulesChat";
import Script from "next/script";

export const metadata = {
  title: "SeaPals TCG",
  description: "Build your reef. Play with friends.",
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
