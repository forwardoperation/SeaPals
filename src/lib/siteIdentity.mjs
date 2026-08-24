export const SEAPALS_LEGACY_SITE_ORIGIN = "https://seapalstcg.com";
export const SEAREALM_SITE_ORIGIN = "https://searealm.com";

// Keep the established site canonical until SeaRealm DNS, provider allowlists,
// and the Cloudflare custom domain have all been verified. The final cutover is
// intentionally one source change plus the matching SITE_URL deployment var.
export const CANONICAL_SITE_ORIGIN = SEAPALS_LEGACY_SITE_ORIGIN;
export const CANONICAL_SITE_HOSTNAME = new URL(
  CANONICAL_SITE_ORIGIN,
).hostname;

// This remains on the verified, monitored mailbox until maker@searealm.com is
// provisioned and its delivery has been tested. It is independent of the
// website's canonical hostname.
export const PUBLIC_SUPPORT_EMAIL = "maker@seapalstcg.com";

export const SITE_BRAND_NAME = "SeaPals TCG";
export const SITE_OPERATOR_NAME = "Sea Realm, LLC";
