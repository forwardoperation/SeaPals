import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  createAdventureAuthIntent,
  parseAdventureAuthIntent,
} from "./adventureAccount.mjs";

export const ADVENTURE_PENDING_AUTH_COOKIE_NAME =
  "seapals-adventure-pending-auth-v1";
export const ADVENTURE_PENDING_AUTH_MAX_AGE_SECONDS = 60 * 60;

const TOKEN_FORMAT = "seapals-adventure-pending-auth";
const TOKEN_VERSION = 1;
const TOKEN_MAX_LENGTH = 4096;
const TOKEN_PART_PATTERN = /^[A-Za-z0-9_-]+$/;
const TOKEN_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function normalizeSecret(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new TypeError(
      "Adventure pending-auth signing requires a server secret of at least 32 characters.",
    );
  }
  return secret;
}

function timestampFrom(now) {
  const value = typeof now === "function" ? now() : now;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError("Adventure pending-auth time must be valid.");
  }
  return date;
}

function tokenIdFrom(nonce) {
  const value = typeof nonce === "function" ? nonce() : nonce;
  if (typeof value !== "string" || !TOKEN_ID_PATTERN.test(value)) {
    throw new TypeError("Adventure pending-auth token ID is invalid.");
  }
  return value;
}

function signPayload(encodedPayload, secret) {
  return createHmac("sha256", normalizeSecret(secret))
    .update(encodedPayload)
    .digest("base64url");
}

function signaturesMatch(left, right) {
  if (
    typeof left !== "string"
    || typeof right !== "string"
    || !TOKEN_PART_PATTERN.test(left)
    || !TOKEN_PART_PATTERN.test(right)
  ) {
    return false;
  }

  const leftBytes = Buffer.from(left, "base64url");
  const rightBytes = Buffer.from(right, "base64url");
  return (
    leftBytes.length === rightBytes.length
    && timingSafeEqual(leftBytes, rightBytes)
  );
}

/**
 * Reissues a client declaration as a canonical, short-lived server token.
 * Client timestamps and version fields are validated but never trusted as the
 * timestamp written into the signed payload.
 */
export function createPendingAdventureAuthToken(
  value,
  {
    secret,
    now = () => new Date(),
    nonce = () => randomUUID(),
    maxAgeSeconds = ADVENTURE_PENDING_AUTH_MAX_AGE_SECONDS,
  } = {},
) {
  const issuedAt = timestampFrom(now);
  if (!Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds <= 0) {
    throw new TypeError("Adventure pending-auth max age must be positive.");
  }

  const requestedIntent = parseAdventureAuthIntent(value, {
    now: () => issuedAt.getTime(),
  });
  if (!requestedIntent) {
    throw new TypeError("Adventure pending-auth intent is invalid or expired.");
  }

  const intent = createAdventureAuthIntent({
    marketingOptIn: requestedIntent.marketingOptIn,
    now: () => issuedAt,
  });
  const payload = {
    format: TOKEN_FORMAT,
    version: TOKEN_VERSION,
    id: tokenIdFrom(nonce),
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(
      issuedAt.getTime() + maxAgeSeconds * 1000,
    ).toISOString(),
    intent,
  };
  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
    "utf8",
  ).toString("base64url");
  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
}

export function parsePendingAdventureAuthToken(
  token,
  {
    secret,
    now = () => new Date(),
    maxAgeSeconds = ADVENTURE_PENDING_AUTH_MAX_AGE_SECONDS,
  } = {},
) {
  const currentTime = timestampFrom(now).getTime();
  if (
    typeof token !== "string"
    || token.length === 0
    || token.length > TOKEN_MAX_LENGTH
    || !Number.isSafeInteger(maxAgeSeconds)
    || maxAgeSeconds <= 0
  ) {
    return null;
  }

  let signingSecret;
  try {
    signingSecret = normalizeSecret(secret);
  } catch {
    return null;
  }

  const parts = token.split(".");
  if (
    parts.length !== 2
    || !TOKEN_PART_PATTERN.test(parts[0])
    || !signaturesMatch(
      parts[1],
      signPayload(parts[0], signingSecret),
    )
  ) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const issuedAtMs = Date.parse(payload?.issuedAt);
  const expiresAtMs = Date.parse(payload?.expiresAt);
  if (
    payload?.format !== TOKEN_FORMAT
    || payload?.version !== TOKEN_VERSION
    || typeof payload?.id !== "string"
    || !TOKEN_ID_PATTERN.test(payload.id)
    || !Number.isFinite(issuedAtMs)
    || !Number.isFinite(expiresAtMs)
    || new Date(issuedAtMs).toISOString() !== payload.issuedAt
    || new Date(expiresAtMs).toISOString() !== payload.expiresAt
    || expiresAtMs <= issuedAtMs
    || expiresAtMs - issuedAtMs > maxAgeSeconds * 1000
    || issuedAtMs > currentTime + 5 * 60 * 1000
    || currentTime >= expiresAtMs
  ) {
    return null;
  }

  const intent = parseAdventureAuthIntent(payload.intent, {
    now: () => currentTime,
    maxAgeMs: maxAgeSeconds * 1000,
  });
  if (!intent || intent.createdAt !== payload.issuedAt) {
    return null;
  }

  return Object.freeze({
    id: payload.id,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    intent: Object.freeze(intent),
  });
}

export function pendingAdventureAuthCookieOptions({
  secure = process.env.NODE_ENV === "production",
} = {}) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: Boolean(secure),
    path: "/",
    maxAge: ADVENTURE_PENDING_AUTH_MAX_AGE_SECONDS,
    priority: "high",
  };
}

export function clearedPendingAdventureAuthCookieOptions({
  secure = process.env.NODE_ENV === "production",
} = {}) {
  return {
    ...pendingAdventureAuthCookieOptions({ secure }),
    expires: new Date(0),
    maxAge: 0,
  };
}
