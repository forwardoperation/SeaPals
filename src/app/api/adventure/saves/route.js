import { getAdventureAuthorizationUser } from "@/lib/adventureAuthorizationServer";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { createAdventureSavesHandlers } from "./handler.mjs";

export const runtime = "nodejs";

const handlers = createAdventureSavesHandlers({
  createClient: createServerSupabaseClient,
  getFamilyAccount: getAdventureAuthorizationUser,
});

export async function GET(request) {
  return handlers.GET(request);
}

export async function PUT(request) {
  return handlers.PUT(request);
}

export async function DELETE(request) {
  return handlers.DELETE(request);
}
