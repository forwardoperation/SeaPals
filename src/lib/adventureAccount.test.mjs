import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVENTURE_AUTH_INTENT_STORAGE_KEY,
  ADVENTURE_FAMILY_ACCOUNT_ATTESTATION_VERSION,
  ADVENTURE_MARKETING_CONSENT_VERSION,
  createAdventureAuthIntent,
  parseAdventureAuthIntent,
  sanitizeAuthReturnPath,
} from "./adventureAccount.mjs";

test("creates a versioned adult-owned account intent with optional consent", () => {
  const intent = createAdventureAuthIntent({
    marketingOptIn: true,
    now: () => new Date("2026-07-29T12:00:00.000Z"),
  });

  assert.equal(
    ADVENTURE_AUTH_INTENT_STORAGE_KEY,
    "seapals-adventure-auth-intent-v1",
  );
  assert.equal(
    intent.attestationVersion,
    ADVENTURE_FAMILY_ACCOUNT_ATTESTATION_VERSION,
  );
  assert.equal(
    intent.marketingConsentVersion,
    ADVENTURE_MARKETING_CONSENT_VERSION,
  );
  assert.equal(intent.marketingOptIn, true);
});

test("rejects stale, malformed, or unversioned account intents", () => {
  const now = Date.parse("2026-07-30T12:00:01.000Z");
  const valid = createAdventureAuthIntent({
    now: () => new Date("2026-07-29T12:00:02.000Z"),
  });

  assert.equal(parseAdventureAuthIntent("{not-json", { now: () => now }), null);
  assert.equal(
    parseAdventureAuthIntent({ ...valid, adultAttested: false }, { now: () => now }),
    null,
  );
  assert.equal(
    parseAdventureAuthIntent(
      { ...valid, createdAt: "2026-07-28T12:00:00.000Z" },
      { now: () => now },
    ),
    null,
  );
});

test("allows only same-origin relative auth return paths", () => {
  assert.equal(sanitizeAuthReturnPath("/adventure?save=2"), "/adventure?save=2");
  assert.equal(sanitizeAuthReturnPath("https://evil.example"), "/adventure");
  assert.equal(sanitizeAuthReturnPath("//evil.example"), "/adventure");
  assert.equal(sanitizeAuthReturnPath("/\\evil.example"), "/adventure");
});
