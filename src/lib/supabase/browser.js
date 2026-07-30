import { createBrowserClient } from "@supabase/ssr";

let browserClient;

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

export function createBrowserSupabaseClient() {
  if (browserClient) return browserClient;
  const { url, publishableKey } = requirePublicSupabaseConfig();
  browserClient = createBrowserClient(url, publishableKey);
  return browserClient;
}
