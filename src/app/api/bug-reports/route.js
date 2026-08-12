import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createBugReportPostHandler } from "./handler.mjs";

export const runtime = "nodejs";

const handlePost = createBugReportPostHandler({
  createAdmin: createSupabaseAdmin,
});

export async function POST(request) {
  return handlePost(request);
}
