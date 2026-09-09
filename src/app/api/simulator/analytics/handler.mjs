import { createHmac } from "node:crypto";
import { isTrustedSameOriginMutation } from "../../../../lib/sameOriginMutation.mjs";
import { aggregateSimulatorAnalytics, parseSimulatorAnalyticsFilters, validateSimulatorAnalyticsSubmission } from "../../../../lib/simulatorAnalytics.mjs";

export const ANALYTICS_MAX_REQUEST_BYTES = 128_000;
export const ANALYTICS_MAX_REPORTS = 10_000;
export const ANALYTICS_MAX_REPORT_BYTES = 8 * 1024 * 1024;
const PAGE_SIZE = 100;

function json(payload, status = 200, headers = {}) {
  return Response.json(payload, { status, headers: { "Cache-Control": "private, no-store, max-age=0", ...headers } });
}

async function readBoundedJson(request) {
  if (Number(request.headers.get("content-length") ?? 0) > ANALYTICS_MAX_REQUEST_BYTES) return { error: "The match report is too large.", status: 413 };
  const reader = request.body?.getReader();
  if (!reader) return { error: "A match report is required.", status: 400 };
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > ANALYTICS_MAX_REQUEST_BYTES) {
        await reader.cancel();
        return { error: "The match report is too large.", status: 413 };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch {
    return { error: "The match report must contain valid JSON.", status: 400 };
  } finally {
    reader.releaseLock();
  }
}

// Only an opaque rotating hash reaches the short-lived abuse-control table.
// The raw address is never stored with a report or returned by the public API.
export function analyticsSourceHash(request, now = Date.now()) {
  const secret = process.env.SIMULATOR_ANALYTICS_RATE_LIMIT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Analytics rate limiting is not configured.");
  const address = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return createHmac("sha256", secret).update(`${Math.floor(now / 86_400_000)}:${address.slice(0, 200)}`).digest("hex");
}

export function createSimulatorAnalyticsHandlers({ createAdmin, cards = [], decks = [], now = Date.now, sourceHash = analyticsSourceHash, logger = console } = {}) {
  if (typeof createAdmin !== "function") throw new TypeError("createAdmin must be provided.");
  return {
    async POST(request) {
      if (!isTrustedSameOriginMutation(request)) return json({ error: "Match reports must be sent from SeaPals." }, 403);
      if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json({ error: "Match reports must use JSON." }, 415);
      const body = await readBoundedJson(request);
      if (body.error) return json({ error: body.error }, body.status);
      const validation = validateSimulatorAnalyticsSubmission(body.value, { cards, decks, now: now() });
      if (!validation.ok) return json({ error: validation.error }, 422);
      try {
        const supabase = createAdmin();
        const { data, error } = await supabase.rpc("submit_simulator_analytics", { report: validation.value, source_hash: sourceHash(request, now()) });
        if (error) throw error;
        const result = typeof data === "string" ? data : data?.status;
        if (result === "rate_limited") return json({ saved: false, error: "Too many match reports. Please try again later." }, 429, { "Retry-After": "3600" });
        if (result === "duplicate") return json({ saved: true, duplicate: true });
        if (result !== "saved") throw new Error("Unexpected analytics insert result.");
        return json({ saved: true }, 201);
      } catch (error) {
        logger?.error?.("Simulator analytics submission failed", { code: error?.code ?? "unavailable" });
        return json({ saved: false, error: "Match analytics collection is temporarily unavailable." }, 503);
      }
    },
    async GET(request) {
      const parsed = parseSimulatorAnalyticsFilters(new URL(request.url).searchParams, { decks });
      if (!parsed.ok) return json({ available: false, error: parsed.error }, 400);
      const filters = parsed.value;
      try {
        const supabase = createAdmin();
        const timestamp = now();
        const reports = [];
        let reportBytes = 0;
        let truncationReason = null;
        const encoder = new TextEncoder();
        for (let offset = 0; offset <= ANALYTICS_MAX_REPORTS; offset += PAGE_SIZE) {
          let query = supabase.from("simulator_analytics_matches").select("report")
            .order("completed_at", { ascending: false }).order("id", { ascending: false });
          if (filters.difficulty !== "all") query = query.eq("difficulty", filters.difficulty);
          if (filters.deck !== "all") query = query.eq(filters.cohort === "human" ? "human_deck_id" : "ai_deck_id", filters.deck);
          if (filters.period !== "all") query = query.gte("completed_at", new Date(timestamp - Number.parseInt(filters.period, 10) * 86_400_000).toISOString());
          query = query.lte("completed_at", new Date(timestamp).toISOString()).lte("received_at", new Date(timestamp).toISOString());
          const { data, error } = await query.range(offset, Math.min(offset + PAGE_SIZE - 1, ANALYTICS_MAX_REPORTS));
          if (error) throw error;
          for (const row of data ?? []) {
            if (reports.length === ANALYTICS_MAX_REPORTS) {
              truncationReason = "report-limit";
              break;
            }
            const bytes = encoder.encode(JSON.stringify(row.report)).byteLength;
            if (reportBytes + bytes > ANALYTICS_MAX_REPORT_BYTES) {
              truncationReason = "size-limit";
              break;
            }
            reports.push(row.report);
            reportBytes += bytes;
          }
          if (truncationReason || !data || data.length < PAGE_SIZE) break;
        }
        const result = aggregateSimulatorAnalytics(reports, {
          cards, decks, filters, now: timestamp, limit: ANALYTICS_MAX_REPORTS, truncated: truncationReason !== null,
          bytes: reportBytes, byteLimit: ANALYTICS_MAX_REPORT_BYTES, truncationReason,
        });
        return json(result, 200, { "Cache-Control": "public, max-age=60, s-maxage=60" });
      } catch (error) {
        logger?.error?.("Simulator analytics query failed", { code: error?.code ?? "unavailable" });
        return json({ available: false, error: "Public analytics is not available yet. Match storage may still need to be configured." }, 503);
      }
    },
  };
}
