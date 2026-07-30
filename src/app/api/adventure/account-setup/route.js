import { NextResponse } from "next/server";
import {
  getAdventureAuthorizationUser,
  writeAdventureAuthorization,
} from "@/lib/adventureAuthorizationServer";
import {
  ADVENTURE_PENDING_AUTH_COOKIE_NAME,
  clearedPendingAdventureAuthCookieOptions,
  parsePendingAdventureAuthToken,
} from "@/lib/adventurePendingAuth.mjs";
import { subscribeToNewsletter } from "@/lib/newsletter";
import { isTrustedSameOriginMutation } from "@/lib/sameOriginMutation.mjs";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const KIT_RESUBMIT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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

function completedResponse(request, body, status = 200) {
  return clearPendingCookie(json(body, status), request);
}

export async function POST(request) {
  if (!isTrustedSameOriginMutation(request)) {
    return json({ error: "Request origin was not accepted." }, 403);
  }

  const pending = parsePendingAdventureAuthToken(
    request.cookies.get(ADVENTURE_PENDING_AUTH_COOKIE_NAME)?.value,
    {
      secret:
        process.env.ADVENTURE_AUTH_SIGNING_SECRET
        || process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  );
  if (!pending) {
    return completedResponse(
      request,
      { error: "Account approval is missing, invalid, or expired." },
      400,
    );
  }

  let claims;
  try {
    const supabase = await createServerSupabaseClient();
    const claimsResult = await supabase.auth.getClaims();
    claims = claimsResult.data?.claims;
  } catch {
    return completedResponse(
      request,
      { error: "SeaPals could not verify the signed-in account." },
      503,
    );
  }
  if (!claims?.sub || claims.role !== "authenticated") {
    return completedResponse(
      request,
      { error: "Sign in is required." },
      401,
    );
  }

  let adminUser;
  let existingAuthorization;
  try {
    const account = await getAdventureAuthorizationUser(claims.sub);
    adminUser = account.user;
    existingAuthorization = account.authorization;
  } catch {
    return completedResponse(
      request,
      { error: "Family account setup is temporarily unavailable." },
      503,
    );
  }

  const email =
    typeof adminUser.email === "string"
      ? adminUser.email.trim().toLowerCase()
      : "";
  if (!email) {
    return completedResponse(
      request,
      { error: "The signed-in account has no email address." },
      422,
    );
  }

  let newsletterAccepted = false;
  let newsletterStatus = "not_requested";
  let newsletterFailed = false;
  if (pending.intent.marketingOptIn) {
    const existingStatus =
      existingAuthorization?.marketing?.subscription_status;
    const existingSubmittedAt = Date.parse(
      existingAuthorization?.marketing?.submitted_at,
    );
    const submittedRecently =
      existingStatus === "submitted"
      && Number.isFinite(existingSubmittedAt)
      && Date.now() - existingSubmittedAt < KIT_RESUBMIT_COOLDOWN_MS;
    if (existingStatus === "subscribed" || submittedRecently) {
      newsletterAccepted = true;
      newsletterStatus = existingStatus;
    } else {
      try {
        await subscribeToNewsletter({
          consent: true,
          email,
        });
        newsletterAccepted = true;
        newsletterStatus = "submitted";
      } catch {
        newsletterStatus = "failed";
        newsletterFailed = true;
      }
    }
  }

  try {
    await writeAdventureAuthorization({
      userId: claims.sub,
      user: adminUser,
      intent: pending.intent,
      intentId: pending.id,
      newsletterStatus,
    });
  } catch {
    return completedResponse(
      request,
      { error: "Family account setup could not be recorded." },
      503,
    );
  }

  if (newsletterFailed) {
    return completedResponse(
      request,
      {
        ok: true,
        warning:
          "The family account is ready, but the optional newsletter signup could not be completed.",
        newsletterAccepted: false,
        newsletterStatus,
      },
    );
  }

  return completedResponse(request, {
    ok: true,
    newsletterAccepted,
    newsletterStatus,
  });
}
