import { NextResponse } from "next/server";
import { sanitizeAuthReturnPath } from "@/lib/adventureAccount.mjs";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function errorRedirect(request, code) {
  const target = new URL("/adventure", request.url);
  target.searchParams.set("auth_error", code);
  const response = NextResponse.redirect(target);
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0",
  );
  return response;
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = sanitizeAuthReturnPath(
    requestUrl.searchParams.get("next"),
    "/adventure",
  );

  if (!code) return errorRedirect(request, "missing_code");

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return errorRedirect(request, "code_exchange_failed");
  } catch {
    return errorRedirect(request, "service_unavailable");
  }

  const response = NextResponse.redirect(new URL(next, requestUrl.origin));
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0",
  );
  return response;
}
