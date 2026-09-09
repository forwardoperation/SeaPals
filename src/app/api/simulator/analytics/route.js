import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { allCards } from "@/data/cards";
import { prebuiltDecks } from "@/data/decks/prebuiltDecks";
import { createSimulatorAnalyticsHandlers } from "./handler.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = createSimulatorAnalyticsHandlers({ createAdmin: createSupabaseAdmin, cards: allCards, decks: prebuiltDecks });

export async function GET(request) { return handlers.GET(request); }
export async function POST(request) { return handlers.POST(request); }
