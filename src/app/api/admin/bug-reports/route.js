import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createAdminBugReportHandlers } from "./handler.mjs";

export const runtime = "nodejs";

const handlers = createAdminBugReportHandlers({
  createAdmin: createSupabaseAdmin,
});

export async function GET(request) {
  return handlers.GET(request);
}

export async function PATCH(request) {
  return handlers.PATCH(request);
}
