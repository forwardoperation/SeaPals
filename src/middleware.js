import { updateSupabaseSession } from "@/lib/supabase/proxy";

// Next.js 16's newer proxy.js convention is Node-runtime-only. OpenNext
// Cloudflare 1.19 supports Edge Middleware but not Node Middleware, so keep
// session refresh at this compatibility boundary until the adapter adds
// Node Proxy support.
export async function middleware(request) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    "/adventure/:path*",
    "/auth/:path*",
    "/api/adventure/:path*",
  ],
};
