import assert from "node:assert/strict";
import test from "node:test";

import { createAdventureAuthIntent } from "./adventureAccount.mjs";
import {
  beginAdventureMarketingAuthorization,
  createAdventureAuthorizationRecord,
} from "./adventureAuthorization.mjs";
import {
  ADVENTURE_NEWSLETTER_ATTEMPT_COOLDOWN_MS,
  ADVENTURE_NEWSLETTER_SUBMITTED_COOLDOWN_MS,
  getAdventureNewsletterOptInDisposition,
  parseAdventureNewsletterOptInRequest,
} from "./adventureNewsletterOptIn.mjs";

const ACCOUNT_INTENT_ID = "3c331bf0-a9a2-491a-984a-5af612e4f45f";
const MARKETING_INTENT_ID = "8a0ac0f2-b62d-4cc8-a4c5-7795ab54bd90";
const ACCOUNT_TIME = "2026-07-30T12:00:00.000Z";

function accountAuthorization({
  marketingOptIn = false,
  newsletterStatus = "not_requested",
  finalizedAt = ACCOUNT_TIME,
} = {}) {
  return createAdventureAuthorizationRecord({
    intent: createAdventureAuthIntent({
      marketingOptIn,
      now: () => new Date("2026-07-30T11:59:00.000Z"),
    }),
    intentId: ACCOUNT_INTENT_ID,
    newsletterStatus,
    now: () => new Date(finalizedAt),
  });
}

test("accepts only an exact explicit adult marketing request", () => {
  const valid = {
    adultAccountOwner: true,
    marketingConsent: true,
    consentVersion: "reefbound-adventure-updates-v1",
  };
  assert.deepEqual(parseAdventureNewsletterOptInRequest(valid), valid);
  assert.equal(
    parseAdventureNewsletterOptInRequest({
      ...valid,
      marketingConsent: false,
    }),
    null,
  );
  assert.equal(
    parseAdventureNewsletterOptInRequest({
      ...valid,
      adultAccountOwner: false,
    }),
    null,
  );
  assert.equal(
    parseAdventureNewsletterOptInRequest({
      ...valid,
      consentVersion: "older-copy",
    }),
    null,
  );
  assert.equal(
    parseAdventureNewsletterOptInRequest({
      ...valid,
      email: "client-controlled@example.com",
    }),
    null,
  );
  assert.equal(parseAdventureNewsletterOptInRequest(null), null);
});

test("requires an authorized family account and permits a first opt-in", () => {
  assert.deepEqual(
    getAdventureNewsletterOptInDisposition(null, {
      now: new Date(ACCOUNT_TIME),
    }),
    { kind: "authorization_required" },
  );
  assert.deepEqual(
    getAdventureNewsletterOptInDisposition(accountAuthorization(), {
      now: new Date(ACCOUNT_TIME),
    }),
    { kind: "eligible" },
  );
});

test("deduplicates submitted and subscribed requests", () => {
  const submitted = accountAuthorization({
    marketingOptIn: true,
    newsletterStatus: "submitted",
  });
  const recent = getAdventureNewsletterOptInDisposition(submitted, {
    now: new Date(
      Date.parse(ACCOUNT_TIME)
        + ADVENTURE_NEWSLETTER_SUBMITTED_COOLDOWN_MS
        - 1,
    ),
  });
  assert.equal(recent.kind, "submitted");
  assert.equal(recent.retryAfterMs, 1);

  assert.deepEqual(
    getAdventureNewsletterOptInDisposition(submitted, {
      now: new Date(
        Date.parse(ACCOUNT_TIME)
          + ADVENTURE_NEWSLETTER_SUBMITTED_COOLDOWN_MS,
      ),
    }),
    { kind: "eligible" },
  );

  const subscribed = accountAuthorization({
    marketingOptIn: true,
    newsletterStatus: "subscribed",
  });
  assert.deepEqual(
    getAdventureNewsletterOptInDisposition(subscribed, {
      now: new Date("2030-01-01T00:00:00.000Z"),
    }),
    { kind: "subscribed" },
  );
});

test("cooldowns prevent rapid processing and failed-attempt replays", () => {
  const processing = beginAdventureMarketingAuthorization({
    authorization: accountAuthorization(),
    consentIntentId: MARKETING_INTENT_ID,
    now: () => new Date(ACCOUNT_TIME),
  });
  const recentProcessing = getAdventureNewsletterOptInDisposition(processing, {
    now: new Date(Date.parse(ACCOUNT_TIME) + 1_000),
  });
  assert.equal(recentProcessing.kind, "processing");
  assert.equal(
    recentProcessing.retryAfterMs,
    ADVENTURE_NEWSLETTER_ATTEMPT_COOLDOWN_MS - 1_000,
  );

  const failed = accountAuthorization({
    marketingOptIn: true,
    newsletterStatus: "failed",
  });
  const recentFailure = getAdventureNewsletterOptInDisposition(failed, {
    now: new Date(Date.parse(ACCOUNT_TIME) + 1_000),
  });
  assert.equal(recentFailure.kind, "retry_later");
  assert.equal(
    recentFailure.retryAfterMs,
    ADVENTURE_NEWSLETTER_ATTEMPT_COOLDOWN_MS - 1_000,
  );

  assert.deepEqual(
    getAdventureNewsletterOptInDisposition(processing, {
      now: new Date(
        Date.parse(ACCOUNT_TIME) + ADVENTURE_NEWSLETTER_ATTEMPT_COOLDOWN_MS,
      ),
    }),
    { kind: "eligible" },
  );
});
