import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { manufacturingService, PRIVATE_HEADERS } from "./integration.mjs";
import { supabaseArtworkStore } from "./storage.mjs";

export const service = () => manufacturingService(createSupabaseAdmin());
export const json = (body, status = 200) =>
  Response.json(body, { status, headers: PRIVATE_HEADERS });
export async function bucket() {
  return supabaseArtworkStore(createSupabaseAdmin());
}
export async function body(request) {
  const text = await request.text();
  if (text.length > 2_000_000) throw new Error("Request is too large.");
  return JSON.parse(text);
}
