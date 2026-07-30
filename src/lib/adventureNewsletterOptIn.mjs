import {
  ADVENTURE_MARKETING_CONSENT_VERSION,
} from "./adventureAccount.mjs";
import {
  parseAdventureAuthorizationRecord,
} from "./adventureAuthorization.mjs";

export const ADVENTURE_NEWSLETTER_SUBMITTED_COOLDOWN_MS =
  24 * 60 * 60 * 1000;
export const ADVENTURE_NEWSLETTER_ATTEMPT_COOLDOWN_MS =
  5 * 60 * 1000;

const REQUEST_FIELDS = new Set([
  "adultAccountOwner",
  "marketingConsent",
  "consentVersion",
]);

function currentTimeFrom(now) {
  const value = typeof now === "function" ? now() : now;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) {
    throw new TypeError("Newsletter opt-in time must be valid.");
  }
  return time;
}

export function parseAdventureNewsletterOptInRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (
    keys.length !== REQUEST_FIELDS.size
    || keys.some((key) => !REQUEST_FIELDS.has(key))
    || value.adultAccountOwner !== true
    || value.marketingConsent !== true
    || value.consentVersion !== ADVENTURE_MARKETING_CONSENT_VERSION
  ) {
    return null;
  }

  return Object.freeze({
    adultAccountOwner: true,
    marketingConsent: true,
    consentVersion: ADVENTURE_MARKETING_CONSENT_VERSION,
  });
}

function retryDisposition(kind, elapsedMs, cooldownMs) {
  return Object.freeze({
    kind,
    retryAfterMs: Math.max(1, cooldownMs - Math.max(0, elapsedMs)),
  });
}

export function getAdventureNewsletterOptInDisposition(
  authorization,
  { now = () => new Date() } = {},
) {
  const current = parseAdventureAuthorizationRecord(authorization);
  if (!current) {
    return Object.freeze({ kind: "authorization_required" });
  }

  const marketing = current.marketing;
  if (marketing.subscription_status === "subscribed") {
    return Object.freeze({ kind: "subscribed" });
  }

  const currentTime = currentTimeFrom(now);
  const attemptTime = Date.parse(marketing.attempt_started_at);
  const elapsedMs = Number.isFinite(attemptTime)
    ? currentTime - attemptTime
    : Number.POSITIVE_INFINITY;

  if (
    marketing.subscription_status === "submitted"
    && elapsedMs < ADVENTURE_NEWSLETTER_SUBMITTED_COOLDOWN_MS
  ) {
    return retryDisposition(
      "submitted",
      elapsedMs,
      ADVENTURE_NEWSLETTER_SUBMITTED_COOLDOWN_MS,
    );
  }
  if (
    marketing.subscription_status === "processing"
    && elapsedMs < ADVENTURE_NEWSLETTER_ATTEMPT_COOLDOWN_MS
  ) {
    return retryDisposition(
      "processing",
      elapsedMs,
      ADVENTURE_NEWSLETTER_ATTEMPT_COOLDOWN_MS,
    );
  }
  if (
    marketing.subscription_status === "failed"
    && elapsedMs < ADVENTURE_NEWSLETTER_ATTEMPT_COOLDOWN_MS
  ) {
    return retryDisposition(
      "retry_later",
      elapsedMs,
      ADVENTURE_NEWSLETTER_ATTEMPT_COOLDOWN_MS,
    );
  }

  return Object.freeze({ kind: "eligible" });
}
