import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  beginAdventureMarketingOptIn,
  finalizeAdventureMarketingOptIn,
  getAdventureAuthorizationUser,
} from "@/lib/adventureAuthorizationServer";
import {
  getAdventureNewsletterOptInDisposition,
  parseAdventureNewsletterOptInRequest,
} from "@/lib/adventureNewsletterOptIn.mjs";
import { subscribeToNewsletter } from "@/lib/newsletter";
import { isTrustedSameOriginMutation } from "@/lib/sameOriginMutation.mjs";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 1024;
const KIT_REQUEST_TIMEOUT_MS = 10_000;

function json(body, status = 200, { retryAfterMs } = {}) {
  const headers = {
    "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    headers["Retry-After"] = String(Math.max(1, Math.ceil(retryAfterMs / 1000)));
  }
  return NextResponse.json(body, { status, headers });
}

function responseForDisposition(disposition) {
  switch (disposition?.kind) {
    case "subscribed":
      return json({
        ok: true,
        newsletterAccepted: true,
        newsletterStatus: "subscribed",
        alreadyRequested: true,
      });
    case "submitted":
      return json({
        ok: true,
        newsletterAccepted: true,
        newsletterStatus: "submitted",
        alreadyRequested: true,
        message:
          "The signup was already submitted. Check the adult account inbox for a confirmation email.",
      });
    case "processing":
      return json(
        {
          ok: true,
          newsletterAccepted: false,
          newsletterStatus: "processing",
          alreadyRequested: true,
          message: "The newsletter request is still being processed.",
        },
        202,
        disposition,
      );
    case "retry_later":
      return json(
        {
          ok: false,
          newsletterAccepted: false,
          newsletterStatus: "failed",
          retryable: true,
          error: "Wait a few minutes before trying the newsletter signup again.",
        },
        429,
        disposition,
      );
    case "authorization_required":
      return json(
        { error: "An approved family account is required." },
        403,
      );
    default:
      return null;
  }
}

function kitTimeoutSignal() {
  return typeof AbortSignal !== "undefined"
    && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(KIT_REQUEST_TIMEOUT_MS)
    : undefined;
}

export async function POST(request) {
  if (!isTrustedSameOriginMutation(request)) {
    return json({ error: "Request origin was not accepted." }, 403);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return json({ error: "A JSON request body is required." }, 415);
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return json({ error: "The request body is too large." }, 413);
  }

  let requestedConsent;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return json({ error: "The request body is too large." }, 413);
    }
    requestedConsent = parseAdventureNewsletterOptInRequest(
      JSON.parse(rawBody),
    );
  } catch {
    return json({ error: "The newsletter request was not valid JSON." }, 400);
  }
  if (!requestedConsent) {
    return json(
      {
        error:
          "The adult account owner must explicitly request SeaPals email updates.",
      },
      422,
    );
  }

  let claims;
  try {
    const supabase = await createServerSupabaseClient();
    const claimsResult = await supabase.auth.getClaims();
    claims = claimsResult.data?.claims;
  } catch {
    return json(
      { error: "SeaPals could not verify the signed-in account." },
      503,
    );
  }
  if (!claims?.sub || claims.role !== "authenticated") {
    return json({ error: "Sign in is required." }, 401);
  }

  let account;
  try {
    account = await getAdventureAuthorizationUser(claims.sub);
  } catch {
    return json(
      { error: "The family account is temporarily unavailable." },
      503,
    );
  }
  if (!account.authorization) {
    return json({ error: "An approved family account is required." }, 403);
  }

  const email =
    typeof account.user.email === "string"
      ? account.user.email.trim().toLowerCase()
      : "";
  if (!email) {
    return json(
      { error: "The signed-in account has no adult email address." },
      422,
    );
  }

  const requestTime = new Date();
  const currentDisposition = getAdventureNewsletterOptInDisposition(
    account.authorization,
    { now: requestTime },
  );
  if (currentDisposition.kind !== "eligible") {
    return responseForDisposition(currentDisposition);
  }

  const consentIntentId = randomUUID();
  let begun;
  try {
    begun = await beginAdventureMarketingOptIn({
      userId: claims.sub,
      consentIntentId,
      now: requestTime,
    });
  } catch (error) {
    const status = error?.code === "AUTHORIZATION_REQUIRED" ? 403 : 503;
    return json(
      {
        error:
          status === 403
            ? "An approved family account is required."
            : "The newsletter consent could not be recorded.",
      },
      status,
    );
  }
  if (!begun.started) {
    return responseForDisposition(begun.disposition);
  }

  try {
    await subscribeToNewsletter({
      consent: true,
      email,
      signal: kitTimeoutSignal(),
    });
  } catch {
    try {
      await finalizeAdventureMarketingOptIn({
        userId: claims.sub,
        consentIntentId,
        newsletterStatus: "failed",
      });
    } catch {
      return json(
        {
          ok: false,
          newsletterAccepted: false,
          newsletterStatus: "processing",
          retryable: true,
          error:
            "The newsletter request did not finish, and its status could not be updated. Your game is unaffected.",
        },
        503,
      );
    }
    return json(
      {
        ok: false,
        newsletterAccepted: false,
        newsletterStatus: "failed",
        retryable: true,
        error:
          "The optional newsletter signup did not finish. Your game is unaffected, and the adult account owner can try again later.",
      },
      502,
    );
  }

  try {
    await finalizeAdventureMarketingOptIn({
      userId: claims.sub,
      consentIntentId,
      newsletterStatus: "submitted",
    });
  } catch {
    return json(
      {
        ok: true,
        newsletterAccepted: true,
        newsletterStatus: "processing",
        warning:
          "The signup reached the email provider, but SeaPals could not finish updating its status. Check the adult account inbox before trying again.",
      },
      202,
    );
  }

  return json({
    ok: true,
    newsletterAccepted: true,
    newsletterStatus: "submitted",
    message:
      "Check the adult account inbox and confirm the SeaPals updates signup.",
  });
}
