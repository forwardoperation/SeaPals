import { CANONICAL_SITE_ORIGIN } from "@/lib/siteIdentity.mjs";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/auth/",
        "/store/cancel",
        "/store/success",
        "/surveys/results",
      ],
    },
    sitemap: new URL("/sitemap.xml", CANONICAL_SITE_ORIGIN).toString(),
    host: CANONICAL_SITE_ORIGIN,
  };
}
