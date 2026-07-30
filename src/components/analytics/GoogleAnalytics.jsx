"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

const GA_ID = "G-WT26D58KF0";

function excludesAnalytics(pathname) {
  return (
    pathname === "/adventure" ||
    pathname.startsWith("/adventure/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/")
  );
}

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const disabled = excludesAnalytics(pathname);

  useEffect(() => {
    window[`ga-disable-${GA_ID}`] = disabled;
    if (disabled && typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        analytics_storage: "denied",
      });
    }
  }, [disabled]);

  if (disabled) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
