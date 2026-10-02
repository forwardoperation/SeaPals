export const SEAPALS_LEGACY_SITE_ORIGIN = "https://seapalstcg.com";
export const SEAREALM_SITE_ORIGIN = "https://searealm.com";

// SeaRealm is the public identity after DNS, auth, cloud-save, and payment checks.
export const CANONICAL_SITE_ORIGIN = SEAREALM_SITE_ORIGIN;
export const CANONICAL_SITE_HOSTNAME = new URL(
  CANONICAL_SITE_ORIGIN,
).hostname;

// This remains on the verified, monitored mailbox until maker@searealm.com is
// provisioned and its delivery has been tested. It is independent of the
// website's canonical hostname.
export const PUBLIC_SUPPORT_EMAIL = "maker@seapalstcg.com";

export const SITE_BRAND_NAME = "SeaRealm TCG";
export const SITE_OPERATOR_NAME = "Sea Realm, LLC";
