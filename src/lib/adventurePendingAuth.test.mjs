import assert from "node:assert/strict";
import test from "node:test";

import { createAdventureAuthIntent } from "./adventureAccount.mjs";
import {
  ADVENTURE_PENDING_AUTH_COOKIE_NAME,
  ADVENTURE_PENDING_AUTH_MAX_AGE_SECONDS,
  clearedPendingAdventureAuthCookieOptions,
  createPendingAdventureAuthToken,
  parsePendingAdventureAuthToken,
  pendingAdventureAuthCookieOptions,
} from "./adventurePendingAuth.mjs";

const SECRET = "test-only-service-role-secret-with-more-than-32-characters";
const ISSUED_AT = "2026-07-29T18:00:00.000Z";
const TOKEN_ID = "2ef1c471-4ce4-4689-844c-dbe7eac5cdee";

function intent(marketingOptIn = false) {
  return createAdventureAuthIntent({
    marketingOptIn,
    now: () => new Date(ISSUED_AT),
  });
}

test("issues and verifies a canonical short-lived pending auth token", () => {
  const token = createPendingAdventureAuthToken(intent(true), {
    secret: SECRET,
    now: () => new Date(ISSUED_AT),
    nonce: () => TOKEN_ID,
  });
  const parsed = parsePendingAdventureAuthToken(token, {
    secret: SECRET,
    now: () => new Date("2026-07-29T18:30:00.000Z"),
  });

  assert.equal(parsed.id, TOKEN_ID);
  assert.equal(parsed.issuedAt, ISSUED_AT);
  assert.equal(parsed.intent.marketingOptIn, true);
  assert.equal(
    Date.parse(parsed.expiresAt) - Date.parse(parsed.issuedAt),
    ADVENTURE_PENDING_AUTH_MAX_AGE_SECONDS * 1000,
  );
});

test("rejects tampering, the wrong secret, and expired tokens", () => {
  const token = createPendingAdventureAuthToken(intent(), {
    secret: SECRET,
    now: () => new Date(ISSUED_AT),
    nonce: () => TOKEN_ID,
  });
  const [payload, signature] = token.split(".");
  const tampered = `${payload.slice(0, -1)}A.${signature}`;

  assert.equal(
    parsePendingAdventureAuthToken(tampered, {
      secret: SECRET,
      now: () => new Date("2026-07-29T18:01:00.000Z"),
    }),
    null,
  );
  assert.equal(
    parsePendingAdventureAuthToken(token, {
      secret: `${SECRET}-wrong`,
      now: () => new Date("2026-07-29T18:01:00.000Z"),
    }),
    null,
  );
  assert.equal(
    parsePendingAdventureAuthToken(token, {
      secret: SECRET,
      now: () => new Date("2026-07-29T19:00:00.000Z"),
    }),
    null,
  );
});

test("server issuance canonicalizes time and rejects invalid client intent", () => {
  const clientIntent = createAdventureAuthIntent({
    marketingOptIn: false,
    now: () => new Date("2026-07-29T17:55:00.000Z"),
  });
  const token = createPendingAdventureAuthToken(clientIntent, {
    secret: SECRET,
    now: () => new Date(ISSUED_AT),
    nonce: () => TOKEN_ID,
  });
  const parsed = parsePendingAdventureAuthToken(token, {
    secret: SECRET,
    now: () => new Date(ISSUED_AT),
  });

  assert.equal(parsed.intent.createdAt, ISSUED_AT);
  assert.throws(
    () =>
      createPendingAdventureAuthToken(
        { ...clientIntent, adultAttested: false },
        {
          secret: SECRET,
          now: () => new Date(ISSUED_AT),
          nonce: () => TOKEN_ID,
        },
      ),
    /invalid or expired/i,
  );
});

test("pending auth cookie options are HttpOnly, scoped, and explicitly clearable", () => {
  assert.equal(
    ADVENTURE_PENDING_AUTH_COOKIE_NAME,
    "seapals-adventure-pending-auth-v1",
  );
  assert.deepEqual(pendingAdventureAuthCookieOptions({ secure: true }), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: ADVENTURE_PENDING_AUTH_MAX_AGE_SECONDS,
    priority: "high",
  });
  const cleared = clearedPendingAdventureAuthCookieOptions({ secure: true });
  assert.equal(cleared.httpOnly, true);
  assert.equal(cleared.maxAge, 0);
  assert.equal(cleared.expires.toISOString(), "1970-01-01T00:00:00.000Z");
});
