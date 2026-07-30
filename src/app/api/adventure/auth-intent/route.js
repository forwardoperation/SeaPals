import { NextResponse } from "next/server";

import {
  ADVENTURE_PENDING_AUTH_COOKIE_NAME,
  clearedPendingAdventureAuthCookieOptions,
  createPendingAdventureAuthToken,
  pendingAdventureAuthCookieOptions,
} from "@/lib/adventurePendingAuth.mjs";
import { isTrustedSameOriginMutation } from "@/lib/sameOriginMutation.mjs";

const MAX_INTENT_BODY_BYTES = 4096;

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
    },
  });
}

function usesSecureCookies(request) {
  return (
    process.env.NODE_ENV === "production"
    || new URL(request.url).protocol === "https:"
  );
}

function clearPendingCookie(response, request) {
  response.cookies.set(
    ADVENTURE_PENDING_AUTH_COOKIE_NAME,
    "",
    clearedPendingAdventureAuthCookieOptions({
      secure: usesSecureCookies(request),
    }),
  );
  return response;
}

async function readLimitedBody(request) {
  if (!request.body) return { text: "", tooLarge: false };

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_INTENT_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return { text: "", tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });

  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      tooLarge: false,
    };
  } catch {
    return { text: "", tooLarge: false };
  }
}

export async function POST(request) {
  if (!isTrustedSameOriginMutation(request)) {
    return json({ error: "Request origin was not accepted." }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith(
    "application/json",
  )) {
    return json({ error: "Account approval must be submitted as JSON." }, 415);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_INTENT_BODY_BYTES) {
    return json({ error: "Account approval details are too large." }, 413);
  }

  let body;
  try {
    body = await readLimitedBody(request);
  } catch {
    body = { text: "", tooLarge: false };
  }
  if (body.tooLarge) {
    return json({ error: "Account approval details are too large." }, 413);
  }

  let value;
  try {
    value = JSON.parse(body.text);
  } catch {
    value = null;
  }

  let token;
  try {
    token = createPendingAdventureAuthToken(value, {
      secret:
        process.env.ADVENTURE_AUTH_SIGNING_SECRET
        || process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
  } catch {
    return clearPendingCookie(
      json({ error: "Account approval details are invalid or expired." }, 400),
      request,
    );
  }

  const response = json({ ok: true });
  response.cookies.set(
    ADVENTURE_PENDING_AUTH_COOKIE_NAME,
    token,
    pendingAdventureAuthCookieOptions({
      secure: usesSecureCookies(request),
    }),
  );
  return response;
}

export async function DELETE(request) {
  if (!isTrustedSameOriginMutation(request)) {
    return json({ error: "Request origin was not accepted." }, 403);
  }
  return clearPendingCookie(json({ ok: true }), request);
}
