import assert from "node:assert/strict";
import test from "node:test";

import { createAdventureAuthIntent } from "./adventureAccount.mjs";
import {
  ADVENTURE_AUTHORIZATION_APP_METADATA_KEY,
  ADVENTURE_AUTHORIZATION_SCHEMA_VERSION,
  beginAdventureMarketingAuthorization,
  createAdventureAuthorizationRecord,
  finalizeAdventureMarketingAuthorization,
  getAdventureAuthorizationFromAppMetadata,
  mergeAdventureAuthorizationAppMetadata,
  parseAdventureAuthorizationRecord,
} from "./adventureAuthorization.mjs";

const FINALIZED_AT = "2026-07-29T19:15:00.000Z";
const INTENT_ID = "2ef1c471-4ce4-4689-844c-dbe7eac5cdee";

function intent(marketingOptIn) {
  return createAdventureAuthIntent({
    marketingOptIn,
    now: () => new Date("2026-07-29T19:00:00.000Z"),
  });
}

test("creates an authorized record only after an accurate newsletter outcome", () => {
  const submitted = createAdventureAuthorizationRecord({
    intent: intent(true),
    intentId: INTENT_ID,
    newsletterStatus: "submitted",
    now: () => new Date(FINALIZED_AT),
  });

  assert.equal(submitted.authorized, true);
  assert.equal(submitted.adult_attested, true);
  assert.equal(submitted.marketing.opted_in, true);
  assert.equal(submitted.marketing.subscription_status, "submitted");
  assert.equal(submitted.marketing.submitted_at, FINALIZED_AT);
  assert.equal(submitted.marketing.subscribed_at, null);

  const subscribed = createAdventureAuthorizationRecord({
    intent: intent(true),
    intentId: INTENT_ID,
    newsletterStatus: "subscribed",
    now: () => new Date(FINALIZED_AT),
  });
  assert.equal(subscribed.marketing.submitted_at, FINALIZED_AT);
  assert.equal(subscribed.marketing.subscribed_at, FINALIZED_AT);

  const failed = createAdventureAuthorizationRecord({
    intent: intent(true),
    intentId: INTENT_ID,
    newsletterStatus: "failed",
    now: () => new Date(FINALIZED_AT),
  });
  assert.equal(failed.marketing.subscription_status, "failed");
  assert.equal(failed.marketing.submitted_at, null);
  assert.equal(failed.marketing.subscribed_at, null);
});

test("records an explicit no-marketing choice without subscription claims", () => {
  const record = createAdventureAuthorizationRecord({
    intent: intent(false),
    intentId: INTENT_ID,
    newsletterStatus: "not_requested",
    now: () => new Date(FINALIZED_AT),
  });

  assert.deepEqual(record.marketing, {
    opted_in: false,
    consent_version: null,
    consented_at: null,
    consent_intent_id: null,
    consent_source: null,
    adult_confirmed_at: null,
    subscription_status: "not_requested",
    attempt_started_at: null,
    submitted_at: null,
    subscribed_at: null,
    provider: null,
  });
  assert.throws(
    () =>
      createAdventureAuthorizationRecord({
        intent: intent(false),
        intentId: INTENT_ID,
        newsletterStatus: "subscribed",
        now: () => new Date(FINALIZED_AT),
      }),
    /does not match consent/i,
  );
});

test("a later login without a new opt-in preserves an existing subscription", () => {
  const existing = createAdventureAuthorizationRecord({
    intent: intent(true),
    intentId: INTENT_ID,
    newsletterStatus: "subscribed",
    now: () => new Date(FINALIZED_AT),
  });
  const nextIntentId = "945f4f20-f67d-43ba-9ca9-87b62f13881d";
  const later = createAdventureAuthorizationRecord({
    intent: intent(false),
    intentId: nextIntentId,
    newsletterStatus: "not_requested",
    previousAuthorization: existing,
    now: () => new Date("2026-07-29T20:00:00.000Z"),
  });

  assert.equal(later.intent_id, nextIntentId);
  assert.deepEqual(later.marketing, existing.marketing);
  assert.equal(later.marketing.subscription_status, "subscribed");
  assert.equal(later.marketing.consent_intent_id, INTENT_ID);
});

test("merges protected authorization without dropping other app metadata", () => {
  const record = createAdventureAuthorizationRecord({
    intent: intent(false),
    intentId: INTENT_ID,
    newsletterStatus: "not_requested",
    now: () => new Date(FINALIZED_AT),
  });
  const merged = mergeAdventureAuthorizationAppMetadata(
    { provider: "google", roles: ["customer"] },
    record,
  );

  assert.equal(merged.provider, "google");
  assert.deepEqual(merged.roles, ["customer"]);
  assert.deepEqual(
    merged[ADVENTURE_AUTHORIZATION_APP_METADATA_KEY],
    record,
  );
  assert.deepEqual(getAdventureAuthorizationFromAppMetadata(merged), record);
});

test("fails closed on malformed or contradictory authorization records", () => {
  const valid = createAdventureAuthorizationRecord({
    intent: intent(true),
    intentId: INTENT_ID,
    newsletterStatus: "subscribed",
    now: () => new Date(FINALIZED_AT),
  });

  assert.equal(
    parseAdventureAuthorizationRecord({
      ...valid,
      authorized: false,
    }),
    null,
  );
  assert.equal(
    parseAdventureAuthorizationRecord({
      ...valid,
      marketing: {
        ...valid.marketing,
        subscription_status: "failed",
      },
    }),
    null,
  );
  assert.equal(getAdventureAuthorizationFromAppMetadata({}), null);
});

test("records a post-play adult marketing choice without replacing account attestation", () => {
  const accountAuthorization = createAdventureAuthorizationRecord({
    intent: intent(false),
    intentId: INTENT_ID,
    newsletterStatus: "not_requested",
    now: () => new Date(FINALIZED_AT),
  });
  const consentIntentId = "a00c4b1c-f64f-4538-a3c0-68b554628fe9";
  const consentedAt = "2026-07-29T20:00:00.000Z";
  const processing = beginAdventureMarketingAuthorization({
    authorization: accountAuthorization,
    consentIntentId,
    now: () => new Date(consentedAt),
  });

  assert.equal(processing.schema_version, ADVENTURE_AUTHORIZATION_SCHEMA_VERSION);
  assert.equal(processing.intent_id, INTENT_ID);
  assert.equal(processing.attested_at, FINALIZED_AT);
  assert.equal(processing.marketing.opted_in, true);
  assert.equal(
    processing.marketing.consent_version,
    "reefbound-adventure-updates-v1",
  );
  assert.equal(processing.marketing.consent_intent_id, consentIntentId);
  assert.equal(
    processing.marketing.consent_source,
    "adventure_post_play_prompt",
  );
  assert.equal(processing.marketing.adult_confirmed_at, consentedAt);
  assert.equal(processing.marketing.attempt_started_at, consentedAt);
  assert.equal(processing.marketing.subscription_status, "processing");
  assert.equal(processing.marketing.submitted_at, null);

  const submittedAt = "2026-07-29T20:00:03.000Z";
  const submitted = finalizeAdventureMarketingAuthorization({
    authorization: processing,
    consentIntentId,
    newsletterStatus: "submitted",
    now: () => new Date(submittedAt),
  });
  assert.equal(submitted.marketing.subscription_status, "submitted");
  assert.equal(submitted.marketing.submitted_at, submittedAt);
  assert.equal(submitted.marketing.subscribed_at, null);
  assert.equal(submitted.intent_id, INTENT_ID);
  assert.equal(submitted.attested_at, FINALIZED_AT);
});

test("post-play outcome cannot finalize a different or stale consent record", () => {
  const accountAuthorization = createAdventureAuthorizationRecord({
    intent: intent(false),
    intentId: INTENT_ID,
    newsletterStatus: "not_requested",
    now: () => new Date(FINALIZED_AT),
  });
  const consentIntentId = "111bac8c-7812-49e9-8e18-28f794d6bab8";
  const processing = beginAdventureMarketingAuthorization({
    authorization: accountAuthorization,
    consentIntentId,
    now: () => new Date("2026-07-29T20:00:00.000Z"),
  });

  assert.throws(
    () =>
      finalizeAdventureMarketingAuthorization({
        authorization: processing,
        consentIntentId: "7657f32d-fb86-40d2-8cd6-2967d96fdf73",
        newsletterStatus: "submitted",
        now: () => new Date("2026-07-29T20:01:00.000Z"),
      }),
    /ID does not match/i,
  );
  assert.throws(
    () =>
      finalizeAdventureMarketingAuthorization({
        authorization: processing,
        consentIntentId,
        newsletterStatus: "subscribed",
        now: () => new Date("2026-07-29T20:01:00.000Z"),
      }),
    /submitted or failed/i,
  );
});

test("normalizes legacy authorization records without re-gating an account", () => {
  const current = createAdventureAuthorizationRecord({
    intent: intent(true),
    intentId: INTENT_ID,
    newsletterStatus: "submitted",
    now: () => new Date(FINALIZED_AT),
  });
  const legacy = {
    ...current,
    schema_version: 1,
    marketing: {
      opted_in: current.marketing.opted_in,
      consent_version: current.marketing.consent_version,
      consented_at: current.marketing.consented_at,
      consent_intent_id: current.marketing.consent_intent_id,
      subscription_status: current.marketing.subscription_status,
      submitted_at: current.marketing.submitted_at,
      subscribed_at: current.marketing.subscribed_at,
      provider: current.marketing.provider,
    },
  };

  const normalized = parseAdventureAuthorizationRecord(legacy);
  assert.ok(normalized);
  assert.equal(normalized.schema_version, ADVENTURE_AUTHORIZATION_SCHEMA_VERSION);
  assert.equal(
    normalized.marketing.consent_source,
    "adventure_account_gate",
  );
  assert.equal(
    normalized.marketing.adult_confirmed_at,
    legacy.marketing.consented_at,
  );
  assert.equal(
    normalized.marketing.attempt_started_at,
    legacy.marketing.submitted_at,
  );
});
