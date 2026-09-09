import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ANALYTICS_COVERAGE_KEYS, ANALYTICS_METRICS } from "../../../../lib/simulatorAnalytics.mjs";
import { ANALYTICS_MAX_REPORT_BYTES, ANALYTICS_MAX_REQUEST_BYTES, createSimulatorAnalyticsHandlers } from "./handler.mjs";

const ORIGIN = "https://seapalstcg.com";
const now = Date.parse("2026-09-09T12:00:00Z");
const cards = [{ id: "coral", name: "Coral", kind: "coral", category: "coral", passives: [{ name: "Photosynthesis", timing: "startOfTurn" }] }];
const decks = [{ id: "reef", name: "Reef deck" }, { id: "deep", name: "Deep deck" }];
function payload(id = "12345678-abcd-4000-8000-123456789abc") {
  return {
    schemaVersion: 1, simulatorVersion: "v2", mode: "standard", id,
    startedAt: "2026-09-09T10:00:00.000Z", completedAt: "2026-09-09T10:30:00.000Z",
    rounds: 5, victoryTarget: 30, winner: "player", difficulty: "medium", vpLeadChanges: 2,
    coverage: Object.fromEntries(ANALYTICS_COVERAGE_KEYS.map((key) => [key, "complete"])),
    players: [["player", "human", "reef"], ["opponent", "ai", "deep"]].map(([side, controller, deckId]) => ({
      side, controller, deckId, eligibleCards: { coral: 2 }, cards: { coral: 1 }, actions: {}, onPlay: {}, passives: { "coral::Photosynthesis": 2 },
      metrics: Object.fromEntries(ANALYTICS_METRICS.map((key) => [key, 10])),
    })),
  };
}
function request(body = payload(), headers = {}) {
  return new Request(`${ORIGIN}/api/simulator/analytics`, {
    method: "POST", headers: { Origin: ORIGIN, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const settings = { cards, decks, now: () => now, sourceHash: () => "a".repeat(64), logger: { error() {} } };

test("POST blocks cross-origin, invalid media, oversized streamed UTF-8 bodies and invalid results before storage", async () => {
  let calls = 0;
  const handler = createSimulatorAnalyticsHandlers({ ...settings, createAdmin() { calls++; throw new Error("must not reach storage"); } });
  assert.equal((await handler.POST(request(payload(), { Origin: "https://attacker.example" }))).status, 403);
  assert.equal((await handler.POST(request(payload(), { "Sec-Fetch-Site": "cross-site" }))).status, 403);
  assert.equal((await handler.POST(request(payload(), { "Content-Type": "text/plain" }))).status, 415);
  assert.equal((await handler.POST(request("{"))).status, 400);
  assert.equal((await handler.POST(request({ ...payload(), winner: null }))).status, 422);
  const oversized = JSON.stringify({ extra: "🐠".repeat(ANALYTICS_MAX_REQUEST_BYTES / 4) });
  assert.equal((await handler.POST(request(oversized))).status, 413);
  assert.equal(calls, 0);
});

test("POST uses atomic idempotent submission RPC with canonical anonymous data only", async () => {
  const incoming = payload();
  incoming.accountId = "secret-account";
  incoming.players[0].name = "Secret player";
  let calls = 0;
  const handler = createSimulatorAnalyticsHandlers({ ...settings, createAdmin: () => ({ async rpc(name, args) {
    assert.equal(name, "submit_simulator_analytics");
    assert.equal(args.source_hash, "a".repeat(64));
    assert.equal(args.report.id, incoming.id);
    assert.equal(args.report.accountId, undefined);
    assert.equal(args.report.players[0].name, undefined);
    return { data: calls++ ? "duplicate" : "saved", error: null };
  } }) });
  const first = await handler.POST(request(incoming));
  assert.equal(first.status, 201);
  assert.deepEqual(await first.json(), { saved: true });
  const second = await handler.POST(request(incoming));
  assert.equal(second.status, 200);
  assert.deepEqual(await second.json(), { saved: true, duplicate: true });
});

test("POST exposes bounded retry guidance for the distributed quota and keeps database errors private", async () => {
  const limited = createSimulatorAnalyticsHandlers({ ...settings, createAdmin: () => ({ rpc: async () => ({ data: "rate_limited", error: null }) }) });
  const limitedResponse = await limited.POST(request());
  assert.equal(limitedResponse.status, 429);
  assert.equal(limitedResponse.headers.get("retry-after"), "3600");
  const failed = createSimulatorAnalyticsHandlers({ ...settings, createAdmin: () => ({ rpc: async () => ({ data: null, error: { code: "database-code", message: "secret schema details" } }) }) });
  const failedResponse = await failed.POST(request());
  assert.equal(failedResponse.status, 503);
  assert.equal((await failedResponse.text()).includes("secret schema"), false);
});

function queryAdmin(rows, captured) {
  return {
    from(table) {
      assert.equal(table, "simulator_analytics_matches");
      const query = {
        select(value) { assert.equal(value, "report"); return this; },
        order(...args) { captured.push(["order", ...args]); return this; },
        eq(...args) { captured.push(["eq", ...args]); return this; },
        gte(...args) { captured.push(["gte", ...args]); return this; },
        lte(...args) { captured.push(["lte", ...args]); return this; },
        async range(from, to) { captured.push(["range", from, to]); return { data: rows.slice(from, to + 1).map((report) => ({ report })), error: null }; },
      };
      return query;
    },
  };
}

test("GET returns public aggregates only and filters the database before applying the sample cap", async () => {
  const captured = [];
  const match = payload();
  const handler = createSimulatorAnalyticsHandlers({ ...settings, createAdmin: () => queryAdmin([match], captured) });
  const response = await handler.GET(new Request(`${ORIGIN}/api/simulator/analytics?cohort=ai&difficulty=medium&deck=deep&period=7d`));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /public, max-age=60/);
  const result = await response.json();
  assert.equal(result.available, true);
  assert.equal(result.summary.games, 1);
  assert.equal(result.summary.wins, 0);
  assert.equal(result.decks[0].id, "deep");
  assert.ok(captured.some((entry) => entry[0] === "eq" && entry[1] === "ai_deck_id" && entry[2] === "deep"));
  assert.ok(captured.some((entry) => entry[0] === "eq" && entry[1] === "difficulty" && entry[2] === "medium"));
  assert.ok(captured.some((entry) => entry[0] === "gte" && entry[1] === "completed_at"));
  assert.equal(JSON.stringify(result).includes(match.id), false);
  assert.equal(JSON.stringify(result).includes("players"), false);
  assert.equal(JSON.stringify(result).includes("source_hash"), false);
});

test("GET paginates beyond Supabase's default 1000 rows and explicitly signals the 10000-report cap", async () => {
  const captured = [];
  const rows = Array.from({ length: 10_001 }, (_, index) => {
    const report = payload(`${String(index).padStart(8, "0")}-abcd-4000-8000-123456789abc`);
    delete report.coverage;
    for (const player of report.players) {
      player.passives = {};
      for (const metric of Object.keys(player.metrics)) player.metrics[metric] = 0;
    }
    return report;
  });
  const handler = createSimulatorAnalyticsHandlers({ ...settings, createAdmin: () => queryAdmin(rows, captured) });
  const response = await handler.GET(new Request(`${ORIGIN}/api/simulator/analytics?period=all`));
  const result = await response.json();
  assert.equal(result.summary.games, 10_000);
  assert.equal(result.dataWindow.limit, 10_000);
  assert.equal(result.dataWindow.truncated, true);
  assert.equal(result.dataWindow.truncationReason, "report-limit");
  assert.equal(result.dataWindow.reportCount, 10_000);
  assert.ok(result.dataWindow.bytes <= ANALYTICS_MAX_REPORT_BYTES);
  assert.equal(captured.filter((entry) => entry[0] === "range").length, 101);
  assert.deepEqual(captured.at(-1), ["range", 10_000, 10_000]);
});

test("GET stops at its UTF-8 byte budget before reading another page and reports size truncation", async () => {
  const captured = [];
  const rows = Array.from({ length: 200 }, (_, index) => ({
    ...payload(`${String(index).padStart(8, "0")}-abcd-4000-8000-123456789abc`),
    // Model large stored reports with multibyte content to exercise byte, not character, accounting.
    padding: "🐠".repeat(25_000),
  }));
  const perReportBytes = new TextEncoder().encode(JSON.stringify(rows[0])).byteLength;
  const expectedCount = Math.floor(ANALYTICS_MAX_REPORT_BYTES / perReportBytes);
  const handler = createSimulatorAnalyticsHandlers({ ...settings, createAdmin: () => queryAdmin(rows, captured) });
  const result = await (await handler.GET(new Request(`${ORIGIN}/api/simulator/analytics?period=all`))).json();
  assert.equal(result.summary.games, expectedCount);
  assert.equal(result.dataWindow.truncated, true);
  assert.equal(result.dataWindow.truncationReason, "size-limit");
  assert.equal(result.dataWindow.byteLimit, ANALYTICS_MAX_REPORT_BYTES);
  assert.equal(result.dataWindow.bytes, perReportBytes * expectedCount);
  assert.equal(result.dataWindow.reportCount, expectedCount);
  assert.deepEqual(captured.filter((entry) => entry[0] === "range"), [["range", 0, 99]]);
});

test("GET distinguishes invalid filters, unconfigured storage and a genuinely empty dataset", async () => {
  let calls = 0;
  const unavailable = createSimulatorAnalyticsHandlers({ ...settings, createAdmin() { calls++; throw new Error("secret configuration"); } });
  assert.equal((await unavailable.GET(new Request(`${ORIGIN}/api/simulator/analytics?cohort=invalid`))).status, 400);
  assert.equal(calls, 0);
  const unavailableResponse = await unavailable.GET(new Request(`${ORIGIN}/api/simulator/analytics`));
  assert.equal(unavailableResponse.status, 503);
  assert.match(unavailableResponse.headers.get("cache-control"), /no-store/);
  const unavailableBody = await unavailableResponse.json();
  assert.equal(unavailableBody.available, false);
  assert.equal(unavailableBody.error.includes("secret configuration"), false);
  const empty = createSimulatorAnalyticsHandlers({ ...settings, createAdmin: () => queryAdmin([], []) });
  const emptyBody = await (await empty.GET(new Request(`${ORIGIN}/api/simulator/analytics`))).json();
  assert.equal(emptyBody.available, true);
  assert.equal(emptyBody.summary.games, 0);
  assert.equal(emptyBody.summary.metrics.rpCollected.average, null);
});

test("schema makes match submission atomic, unique, server-only and independently rate-limited", async () => {
  const sql = await readFile(new URL("../../../../../supabase/simulator-analytics.sql", import.meta.url), "utf8");
  assert.match(sql, /id uuid primary key/);
  assert.match(sql, /simulator_analytics_matches enable row level security/);
  assert.match(sql, /simulator_analytics_submission_limits enable row level security/);
  assert.match(sql, /revoke all on function public\.submit_simulator_analytics\(jsonb, text\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.submit_simulator_analytics\(jsonb, text\) to service_role/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /report_count >= 30/);
  assert.match(sql, /on conflict \(id\) do nothing/);
});
