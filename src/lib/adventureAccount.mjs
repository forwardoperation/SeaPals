export const ADVENTURE_AUTH_INTENT_STORAGE_KEY =
  "seapals-adventure-auth-intent-v1";

export const ADVENTURE_FAMILY_ACCOUNT_ATTESTATION_VERSION =
  "reefbound-family-account-v1";

export const ADVENTURE_MARKETING_CONSENT_VERSION =
  "reefbound-adventure-updates-v1";
export const ADVENTURE_ACCOUNT_GATE_CONSENT_SOURCE =
  "adventure_account_gate";
export const ADVENTURE_POST_PLAY_CONSENT_SOURCE =
  "adventure_post_play_prompt";

const AUTH_INTENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function createAdventureAuthIntent({
  marketingOptIn = false,
  now = () => new Date(),
} = {}) {
  const createdAt = now();
  const timestamp =
    createdAt instanceof Date ? createdAt.toISOString() : String(createdAt);

  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new TypeError("Adventure account intent requires a valid timestamp.");
  }

  return {
    adultAttested: true,
    attestationVersion: ADVENTURE_FAMILY_ACCOUNT_ATTESTATION_VERSION,
    marketingOptIn: marketingOptIn === true,
    marketingConsentVersion: marketingOptIn
      ? ADVENTURE_MARKETING_CONSENT_VERSION
      : null,
    source: ADVENTURE_ACCOUNT_GATE_CONSENT_SOURCE,
    createdAt: new Date(timestamp).toISOString(),
  };
}

export function parseAdventureAuthIntent(
  value,
  { now = () => Date.now(), maxAgeMs = AUTH_INTENT_MAX_AGE_MS } = {},
) {
  let candidate = value;

  if (typeof value === "string") {
    try {
      candidate = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const createdAtMs = Date.parse(candidate.createdAt);
  const currentTime = now();
  if (
    candidate.adultAttested !== true ||
    candidate.attestationVersion !==
      ADVENTURE_FAMILY_ACCOUNT_ATTESTATION_VERSION ||
    candidate.source !== ADVENTURE_ACCOUNT_GATE_CONSENT_SOURCE ||
    !Number.isFinite(createdAtMs) ||
    !Number.isFinite(currentTime) ||
    createdAtMs > currentTime + 5 * 60 * 1000 ||
    currentTime - createdAtMs > maxAgeMs
  ) {
    return null;
  }

  const marketingOptIn = candidate.marketingOptIn === true;
  if (
    marketingOptIn &&
    candidate.marketingConsentVersion !==
      ADVENTURE_MARKETING_CONSENT_VERSION
  ) {
    return null;
  }

  return {
    adultAttested: true,
    attestationVersion: ADVENTURE_FAMILY_ACCOUNT_ATTESTATION_VERSION,
    marketingOptIn,
    marketingConsentVersion: marketingOptIn
      ? ADVENTURE_MARKETING_CONSENT_VERSION
      : null,
    source: ADVENTURE_ACCOUNT_GATE_CONSENT_SOURCE,
    createdAt: new Date(createdAtMs).toISOString(),
  };
}

export function sanitizeAuthReturnPath(value, fallback = "/adventure") {
  if (
    typeof fallback !== "string" ||
    !fallback.startsWith("/") ||
    fallback.startsWith("//")
  ) {
    throw new TypeError("Auth fallback must be a same-origin relative path.");
  }

  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return fallback;
  }

  try {
    const base = new URL("https://seapals.invalid");
    const resolved = new URL(value, base);
    if (resolved.origin !== base.origin) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
