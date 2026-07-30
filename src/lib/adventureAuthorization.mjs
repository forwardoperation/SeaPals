import {
  ADVENTURE_ACCOUNT_GATE_CONSENT_SOURCE,
  ADVENTURE_FAMILY_ACCOUNT_ATTESTATION_VERSION,
  ADVENTURE_MARKETING_CONSENT_VERSION,
  ADVENTURE_POST_PLAY_CONSENT_SOURCE,
  parseAdventureAuthIntent,
} from "./adventureAccount.mjs";

export const ADVENTURE_AUTHORIZATION_APP_METADATA_KEY =
  "seapals_adventure_authorization";
export const ADVENTURE_AUTHORIZATION_SCHEMA_VERSION = 2;

const NEWSLETTER_STATUSES = new Set([
  "not_requested",
  "processing",
  "submitted",
  "subscribed",
  "failed",
]);
const LEGACY_AUTHORIZATION_SCHEMA_VERSION = 1;
const MARKETING_CONSENT_SOURCES = new Set([
  ADVENTURE_ACCOUNT_GATE_CONSENT_SOURCE,
  ADVENTURE_POST_PLAY_CONSENT_SOURCE,
]);
const TOKEN_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function timestampFrom(now) {
  const value = typeof now === "function" ? now() : now;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError("Adventure authorization time must be valid.");
  }
  return date.toISOString();
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createAdventureAuthorizationRecord({
  intent,
  intentId,
  newsletterStatus,
  previousAuthorization = null,
  now = () => new Date(),
} = {}) {
  const finalizedAt = timestampFrom(now);
  const parsedIntent = parseAdventureAuthIntent(intent, {
    now: () => Date.parse(finalizedAt),
  });
  if (!parsedIntent) {
    throw new TypeError("Adventure authorization requires a valid intent.");
  }
  if (typeof intentId !== "string" || !TOKEN_ID_PATTERN.test(intentId)) {
    throw new TypeError("Adventure authorization intent ID is invalid.");
  }
  if (!NEWSLETTER_STATUSES.has(newsletterStatus)) {
    throw new TypeError("Adventure authorization newsletter status is invalid.");
  }
  if (
    (parsedIntent.marketingOptIn && newsletterStatus === "not_requested")
    || (!parsedIntent.marketingOptIn && newsletterStatus !== "not_requested")
  ) {
    throw new TypeError(
      "Adventure authorization newsletter status does not match consent.",
    );
  }

  const previous = parseAdventureAuthorizationRecord(previousAuthorization);
  const preservedMarketing =
    !parsedIntent.marketingOptIn && previous?.marketing.opted_in
      ? previous.marketing
      : null;

  return Object.freeze({
    schema_version: ADVENTURE_AUTHORIZATION_SCHEMA_VERSION,
    authorized: true,
    adult_attested: true,
    attestation_version: parsedIntent.attestationVersion,
    attested_at: finalizedAt,
    source: parsedIntent.source,
    intent_id: intentId,
    marketing: preservedMarketing ?? Object.freeze({
      opted_in: parsedIntent.marketingOptIn,
      consent_version: parsedIntent.marketingConsentVersion,
      consented_at: parsedIntent.marketingOptIn ? finalizedAt : null,
      consent_intent_id: parsedIntent.marketingOptIn ? intentId : null,
      consent_source: parsedIntent.marketingOptIn
        ? ADVENTURE_ACCOUNT_GATE_CONSENT_SOURCE
        : null,
      adult_confirmed_at: parsedIntent.marketingOptIn ? finalizedAt : null,
      subscription_status: newsletterStatus,
      attempt_started_at: parsedIntent.marketingOptIn ? finalizedAt : null,
      submitted_at:
        newsletterStatus === "submitted" || newsletterStatus === "subscribed"
          ? finalizedAt
          : null,
      subscribed_at:
        newsletterStatus === "subscribed" ? finalizedAt : null,
      provider: parsedIntent.marketingOptIn ? "kit" : null,
    }),
  });
}

export function parseAdventureAuthorizationRecord(value) {
  if (!isRecord(value) || !isRecord(value.marketing)) return null;

  const legacy =
    value.schema_version === LEGACY_AUTHORIZATION_SCHEMA_VERSION;
  if (
    !legacy
    && value.schema_version !== ADVENTURE_AUTHORIZATION_SCHEMA_VERSION
  ) {
    return null;
  }

  const attestedAtMs = Date.parse(value.attested_at);
  const consentedAtMs =
    value.marketing.consented_at === null
      ? null
      : Date.parse(value.marketing.consented_at);
  const consentSource = legacy
    ? value.marketing.opted_in === true
      ? ADVENTURE_ACCOUNT_GATE_CONSENT_SOURCE
      : null
    : value.marketing.consent_source;
  const adultConfirmedAt = legacy
    ? value.marketing.opted_in === true
      ? value.marketing.consented_at
      : null
    : value.marketing.adult_confirmed_at;
  const adultConfirmedAtMs =
    adultConfirmedAt === null ? null : Date.parse(adultConfirmedAt);
  const attemptStartedAt = legacy
    ? value.marketing.opted_in === true
      ? value.marketing.submitted_at ?? value.marketing.consented_at
      : null
    : value.marketing.attempt_started_at;
  const attemptStartedAtMs =
    attemptStartedAt === null ? null : Date.parse(attemptStartedAt);
  const submittedAtMs =
    value.marketing.submitted_at === null
      ? null
      : Date.parse(value.marketing.submitted_at);
  const subscribedAtMs =
    value.marketing.subscribed_at === null
      ? null
      : Date.parse(value.marketing.subscribed_at);
  const optedIn = value.marketing.opted_in === true;
  const status = value.marketing.subscription_status;

  if (
    value.authorized !== true
    || value.adult_attested !== true
    || value.attestation_version !==
      ADVENTURE_FAMILY_ACCOUNT_ATTESTATION_VERSION
    || !Number.isFinite(attestedAtMs)
    || new Date(attestedAtMs).toISOString() !== value.attested_at
    || value.source !== "adventure_account_gate"
    || typeof value.intent_id !== "string"
    || !TOKEN_ID_PATTERN.test(value.intent_id)
    || !NEWSLETTER_STATUSES.has(status)
    || (legacy && status === "processing")
    || (optedIn && status === "not_requested")
    || (!optedIn && status !== "not_requested")
    || (optedIn && !Number.isFinite(consentedAtMs))
    || (!optedIn && value.marketing.consented_at !== null)
    || value.marketing.consent_version
      !== (optedIn ? ADVENTURE_MARKETING_CONSENT_VERSION : null)
    || (
      optedIn
      && (
        typeof value.marketing.consent_intent_id !== "string"
        || !TOKEN_ID_PATTERN.test(value.marketing.consent_intent_id)
      )
    )
    || (!optedIn && value.marketing.consent_intent_id !== null)
    || (
      optedIn
      && !MARKETING_CONSENT_SOURCES.has(consentSource)
    )
    || (!optedIn && consentSource !== null)
    || (optedIn && !Number.isFinite(adultConfirmedAtMs))
    || (!optedIn && adultConfirmedAt !== null)
    || (
      optedIn
      && new Date(adultConfirmedAtMs).toISOString() !== adultConfirmedAt
    )
    || (optedIn && !Number.isFinite(attemptStartedAtMs))
    || (!optedIn && attemptStartedAt !== null)
    || (
      optedIn
      && new Date(attemptStartedAtMs).toISOString() !== attemptStartedAt
    )
    || (
      optedIn
      && (
        adultConfirmedAtMs < consentedAtMs
        || attemptStartedAtMs < consentedAtMs
      )
    )
    || (
      optedIn
      && new Date(consentedAtMs).toISOString()
        !== value.marketing.consented_at
    )
    || (
      (status === "submitted" || status === "subscribed")
      && !Number.isFinite(submittedAtMs)
    )
    || (
      (status === "submitted" || status === "subscribed")
      && new Date(submittedAtMs).toISOString()
        !== value.marketing.submitted_at
    )
    || (
      (status === "submitted" || status === "subscribed")
      && submittedAtMs < attemptStartedAtMs
    )
    || (
      status !== "submitted"
      && status !== "subscribed"
      && value.marketing.submitted_at !== null
    )
    || (status === "subscribed" && !Number.isFinite(subscribedAtMs))
    || (
      status === "subscribed"
      && new Date(subscribedAtMs).toISOString()
        !== value.marketing.subscribed_at
    )
    || (status !== "subscribed" && value.marketing.subscribed_at !== null)
    || value.marketing.provider !== (optedIn ? "kit" : null)
  ) {
    return null;
  }

  return Object.freeze({
    ...value,
    schema_version: ADVENTURE_AUTHORIZATION_SCHEMA_VERSION,
    marketing: Object.freeze({
      ...value.marketing,
      consent_source: consentSource,
      adult_confirmed_at: adultConfirmedAt,
      attempt_started_at: attemptStartedAt,
    }),
  });
}

export function beginAdventureMarketingAuthorization({
  authorization,
  consentIntentId,
  now = () => new Date(),
} = {}) {
  const current = parseAdventureAuthorizationRecord(authorization);
  if (!current) {
    throw new TypeError(
      "Post-play marketing consent requires an authorized family account.",
    );
  }
  if (
    typeof consentIntentId !== "string"
    || !TOKEN_ID_PATTERN.test(consentIntentId)
  ) {
    throw new TypeError("Post-play marketing consent ID is invalid.");
  }

  const consentedAt = timestampFrom(now);
  return Object.freeze({
    ...current,
    schema_version: ADVENTURE_AUTHORIZATION_SCHEMA_VERSION,
    marketing: Object.freeze({
      opted_in: true,
      consent_version: ADVENTURE_MARKETING_CONSENT_VERSION,
      consented_at: consentedAt,
      consent_intent_id: consentIntentId,
      consent_source: ADVENTURE_POST_PLAY_CONSENT_SOURCE,
      adult_confirmed_at: consentedAt,
      subscription_status: "processing",
      attempt_started_at: consentedAt,
      submitted_at: null,
      subscribed_at: null,
      provider: "kit",
    }),
  });
}

export function finalizeAdventureMarketingAuthorization({
  authorization,
  consentIntentId,
  newsletterStatus,
  now = () => new Date(),
} = {}) {
  const current = parseAdventureAuthorizationRecord(authorization);
  if (
    !current
    || current.marketing.opted_in !== true
    || current.marketing.consent_source
      !== ADVENTURE_POST_PLAY_CONSENT_SOURCE
  ) {
    throw new TypeError("Post-play marketing consent is not in progress.");
  }
  if (
    typeof consentIntentId !== "string"
    || !TOKEN_ID_PATTERN.test(consentIntentId)
    || current.marketing.consent_intent_id !== consentIntentId
  ) {
    throw new TypeError("Post-play marketing consent ID does not match.");
  }
  if (newsletterStatus !== "submitted" && newsletterStatus !== "failed") {
    throw new TypeError(
      "Post-play marketing outcome must be submitted or failed.",
    );
  }
  if (current.marketing.subscription_status === newsletterStatus) {
    return current;
  }
  if (current.marketing.subscription_status !== "processing") {
    throw new TypeError("Post-play marketing consent is no longer processing.");
  }

  const finalizedAt = timestampFrom(now);
  if (Date.parse(finalizedAt) < Date.parse(current.marketing.attempt_started_at)) {
    throw new TypeError("Post-play marketing outcome time is invalid.");
  }

  return Object.freeze({
    ...current,
    marketing: Object.freeze({
      ...current.marketing,
      subscription_status: newsletterStatus,
      submitted_at: newsletterStatus === "submitted" ? finalizedAt : null,
      subscribed_at: null,
    }),
  });
}

export function mergeAdventureAuthorizationAppMetadata(
  appMetadata,
  authorization,
) {
  const current = isRecord(appMetadata) ? appMetadata : {};
  const parsed = parseAdventureAuthorizationRecord(authorization);
  if (!parsed) {
    throw new TypeError("Cannot persist an invalid adventure authorization.");
  }
  return {
    ...current,
    [ADVENTURE_AUTHORIZATION_APP_METADATA_KEY]: parsed,
  };
}

export function getAdventureAuthorizationFromAppMetadata(appMetadata) {
  if (!isRecord(appMetadata)) return null;
  return parseAdventureAuthorizationRecord(
    appMetadata[ADVENTURE_AUTHORIZATION_APP_METADATA_KEY],
  );
}
