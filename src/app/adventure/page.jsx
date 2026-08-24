import { cookies } from "next/headers";
import AdventureAccountBridge from "./AdventureAccountBridge";
import AdventureAuthGate from "./AdventureAuthGate";
import { getAdventureAuthorizationUser } from "@/lib/adventureAuthorizationServer";
import {
  ADVENTURE_PENDING_AUTH_COOKIE_NAME,
  parsePendingAdventureAuthToken,
} from "@/lib/adventurePendingAuth.mjs";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Reefbound Adventure | SeaPals TCG",
  description:
    "Explore coastal Elverson and help Mr. Easterling create a new community aquarium exhibit.",
  alternates: { canonical: "/adventure" },
};

export const dynamic = "force-dynamic";

const AUTH_ERROR_MESSAGES = Object.freeze({
  missing_code:
    "That sign-in link is incomplete. Request a new email link or try Google again.",
  code_exchange_failed:
    "That sign-in link expired or was already used. Request a new one to continue.",
  service_unavailable:
    "SeaPals sign-in is temporarily unavailable. Please try again in a moment.",
});

const ACCOUNT_NOTICE_MESSAGES = Object.freeze({
  newsletter_failed: {
    kind: "error",
    message:
      "Your family account is ready, but the optional SeaPals updates signup did not finish. You can use Join the Crew on the home page to try again.",
  },
  newsletter_submitted: {
    kind: "info",
    message:
      "Your SeaPals updates signup was submitted. Check your inbox and confirm it if Kit asks you to.",
  },
  newsletter_subscribed: {
    kind: "info",
    message:
      "You’re signed in and subscribed to SeaPals updates. You can unsubscribe from any email.",
  },
});

export default async function AdventurePage({ searchParams }) {
  const params = await searchParams;
  const initialError =
    AUTH_ERROR_MESSAGES[params?.auth_error] ??
    (params?.auth_error
      ? "Sign-in did not finish. Please try again."
      : null);

  let claims = null;
  try {
    const supabase = await createServerSupabaseClient();
    const result = await supabase.auth.getClaims();
    claims = result.data?.claims ?? null;
  } catch {
    // The signed-out gate can explain a temporary configuration problem
    // without exposing provider details or rendering the game.
  }

  if (!claims?.sub || claims.role !== "authenticated") {
    return <AdventureAuthGate initialError={initialError} />;
  }

  let authorizationUser = null;
  let authorizationError = null;
  try {
    authorizationUser = await getAdventureAuthorizationUser(claims.sub);
  } catch {
    authorizationError =
      "SeaPals could not check family-account approval. Review the approval below and try again.";
  }

  const accountEmail =
    typeof authorizationUser?.user?.email === "string"
      ? authorizationUser.user.email
      : typeof claims.email === "string"
        ? claims.email
        : "your family account";

  const cookieStore = await cookies();
  const pendingAuthorization = parsePendingAdventureAuthToken(
    cookieStore.get(ADVENTURE_PENDING_AUTH_COOKIE_NAME)?.value,
    {
      secret:
        process.env.ADVENTURE_AUTH_SIGNING_SECRET
        || process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  );

  if (!authorizationUser?.authorization || pendingAuthorization) {
    return (
      <AdventureAuthGate
        initialError={initialError ?? authorizationError}
        signedInEmail={accountEmail}
      />
    );
  }

  return (
    <AdventureAccountBridge
      account={{
        id: claims.sub,
        email: accountEmail,
        newsletter: {
          optedIn:
            authorizationUser.authorization.marketing.opted_in === true,
          status:
            authorizationUser.authorization.marketing.subscription_status,
        },
      }}
      initialNotice={ACCOUNT_NOTICE_MESSAGES[params?.account_notice] ?? null}
    />
  );
}
