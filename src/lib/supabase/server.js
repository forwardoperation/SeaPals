import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function requirePublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "SeaPals account sign-in is not configured. Add the public Supabase URL and publishable key.",
    );
  }

  return { url, publishableKey };
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = requirePublicSupabaseConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. The route proxy refreshes
          // sessions before rendering, while Route Handlers can write here.
        }
      },
    },
  });
}
