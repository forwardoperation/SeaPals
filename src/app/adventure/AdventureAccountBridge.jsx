"use client";

import { useCallback, useEffect, useState } from "react";
import AdventureGame from "./AdventureGame";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function AdventureAccountBridge({
  account,
  initialNotice = null,
}) {
  const [accountNotice, setAccountNotice] = useState(initialNotice);

  useEffect(() => {
    if (!initialNotice) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("account_notice")) return;
    url.searchParams.delete("account_notice");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [initialNotice]);

  useEffect(() => {
    let active = true;
    let subscription;

    try {
      const supabase = createBrowserSupabaseClient();
      async function verifyActiveAccount(session) {
        if (!active) return;
        if (!session?.access_token) {
          window.location.replace("/adventure");
          return;
        }

        try {
          const { data, error } = await supabase.auth.getClaims(
            session.access_token,
          );
          if (!active || error || !data?.claims?.sub) return;
          if (data.claims.sub === account.id) return;
        } catch {
          // Keep the server-verified account mounted on a transient client
          // verification failure. A sign-out or verified subject change below
          // still forces a server re-check.
          return;
        }
        if (active) {
          window.location.replace("/adventure");
        }
      }

      subscription = supabase.auth.onAuthStateChange((_event, session) => {
        window.setTimeout(
          () => {
            void verifyActiveAccount(session);
          },
          0,
        );
      }).data.subscription;
    } catch {
      // The server already verified this account for the current request.
    }

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [account.id]);

  const signOut = useCallback(async () => {
    setAccountNotice({ kind: "info", message: "Signing out…" });
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      window.location.replace("/adventure");
    } catch {
      setAccountNotice({
        kind: "error",
        message: "Sign-out did not finish. Check your connection and try again.",
      });
    }
  }, []);

  return (
    <AdventureGame
      account={account}
      accountNotice={accountNotice}
      onSignOut={signOut}
    />
  );
}
