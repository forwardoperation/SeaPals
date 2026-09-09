import assert from "node:assert/strict";
import test from "node:test";
import {
  SIMULATOR_ANALYTICS_STORAGE_KEY,
  completeSimulatorAnalyticsMatch, createSimulatorAnalyticsMatch,
  enqueueSimulatorAnalytics, flushPendingSimulatorAnalytics,
  getSimulatorAnalyticsRpCollected, isSimulatorAnalyticsMatch,
  getSimulatorAnalyticsStorage,
  getSimulatorAnalyticsIncomePassives,
  readPendingSimulatorAnalytics, recordSimulatorAnalytics, recordSimulatorAnalyticsScores,
} from "./simulatorAnalytics.mjs";
import { validateSimulatorAnalyticsSubmission } from "../../lib/simulatorAnalytics.mjs";

const cards = [{ id: "coral", name: "Coral", kind: "coral", actions: [], onPlay: [], passives: [] }];
const deck = { id: "test-deck", cards: [{ cardId: "coral", quantity: 4 }] };
const makeMatch = (id = "96ddf20c-daa3-471a-b6f1-c5447ccf49ec") => createSimulatorAnalyticsMatch({
  id, now: "2026-09-09T12:00:00.000Z", difficulty: "hard", victoryTarget: 30,
  playerDeck: deck, opponentDeck: deck,
});
const finish = (match = makeMatch()) => completeSimulatorAnalyticsMatch(match, { winner: "player", rounds: 4, now: "2026-09-09T12:15:00.000Z" });
class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

test("a new match excludes starting RP and carries eligible deck copies for zero-use rankings", () => {
  const match = makeMatch();
  assert.ok(isSimulatorAnalyticsMatch(match));
  assert.equal(match.players[0].metrics.rpCollected, 0);
  assert.deepEqual(match.players[1].eligibleCards, { coral: 4 });
  assert.equal(match.players[0].controller, "human");
  assert.equal(match.players[1].controller, "ai");
});

test("committed transaction credits retain income netted against spending and exclude caps/refunds of initial state", () => {
  assert.equal(getSimulatorAnalyticsRpCollected(5, 4, 3), 2);
  assert.equal(getSimulatorAnalyticsRpCollected(5, 2, 3), 0);
  assert.equal(getSimulatorAnalyticsRpCollected(5, 8), 3);
  assert.equal(getSimulatorAnalyticsRpCollected(12, 8), 0);
});

test("stable event IDs deduplicate animation commits and survive serialized resume", () => {
  const initial = makeMatch();
  const event = { id: "committed-play-1", side: "opponent", counter: "cards", key: "coral", metrics: { rpCollected: 2, schoolDamage: 10 } };
  const once = recordSimulatorAnalytics(initial, event);
  const resumed = JSON.parse(JSON.stringify(once));
  const repeated = recordSimulatorAnalytics(resumed, event);
  assert.ok(isSimulatorAnalyticsMatch(resumed));
  assert.equal(repeated.players[1].cards.coral, 1);
  assert.equal(repeated.players[1].metrics.rpCollected, 2);
  assert.equal(repeated.players[1].metrics.schoolDamage, 10);
  assert.deepEqual(initial.players[1].cards, {});
});

test("ties preserve the last outright leader, and first lead is not a lead change", () => {
  let match = makeMatch();
  for (const [player, opponent] of [[0, 0], [5, 2], [5, 5], [5, 6], [8, 6]]) match = recordSimulatorAnalyticsScores(match, player, opponent);
  assert.equal(match.vpLeadChanges, 2);
  assert.equal(match.players[0].metrics.finalVp, 8);
  assert.equal(match.players[1].metrics.finalVp, 6);
});

test("a final report obeys the server contract and excludes internal snapshots/seen IDs", () => {
  let match = recordSimulatorAnalytics(makeMatch(), { counter: "cards", key: "coral" });
  match = recordSimulatorAnalyticsScores(match, 30, 18);
  match.tracking.snapshots = { player: { privateField: "never upload" } };
  const report = finish(match);
  assert.equal(report.tracking, undefined);
  assert.ok(!JSON.stringify(report).includes("never upload"));
  const validated = validateSimulatorAnalyticsSubmission(report, { cards, decks: [deck], now: Date.parse(report.completedAt) });
  assert.equal(validated.ok, true, validated.error);
});

test("queued matches persist through errors and only successful IDs are removed", async () => {
  const storage = new Storage();
  const report = finish();
  assert.equal(enqueueSimulatorAnalytics(storage, report), true);
  enqueueSimulatorAnalytics(storage, report);
  assert.equal(readPendingSimulatorAnalytics(storage).length, 1);
  await flushPendingSimulatorAnalytics(storage, async () => { throw new Error("offline"); });
  assert.equal(readPendingSimulatorAnalytics(storage).length, 1);
  await flushPendingSimulatorAnalytics(storage, async () => ({ ok: false }));
  assert.equal(readPendingSimulatorAnalytics(storage).length, 1);
  await flushPendingSimulatorAnalytics(storage, async (url, options) => {
    assert.equal(url, "/api/simulator/analytics");
    assert.equal(options.credentials, "same-origin");
    assert.equal(JSON.parse(options.body).id, report.id);
    return { ok: true };
  });
  assert.deepEqual(readPendingSimulatorAnalytics(storage), []);
});

test("a match added during an upload is retained and concurrent flushes share the request", async () => {
  const storage = new Storage();
  enqueueSimulatorAnalytics(storage, finish());
  let release;
  let calls = 0;
  const fetcher = () => { calls += 1; return new Promise((resolve) => { release = resolve; }); };
  const first = flushPendingSimulatorAnalytics(storage, fetcher);
  const second = flushPendingSimulatorAnalytics(storage, fetcher);
  enqueueSimulatorAnalytics(storage, finish(makeMatch("96ddf20c-daa3-471a-b6f1-c5447ccf49ed")));
  release({ ok: true });
  await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(readPendingSimulatorAnalytics(storage)[0].id, "96ddf20c-daa3-471a-b6f1-c5447ccf49ed");
});

test("malformed storage and unavailable persistence do not throw into gameplay", () => {
  const storage = new Storage();
  storage.setItem(SIMULATOR_ANALYTICS_STORAGE_KEY, "broken");
  assert.deepEqual(readPendingSimulatorAnalytics(storage), []);
  assert.equal(enqueueSimulatorAnalytics({ setItem() { throw new Error("quota"); } }, finish()), false);
  assert.equal(isSimulatorAnalyticsMatch({}), false);
  assert.equal(getSimulatorAnalyticsStorage({ get localStorage() { throw new Error("SecurityError"); } }), null);
});

test("permanently invalid reports cannot block later valid reports, while rate limits retry", async () => {
  const storage = new Storage();
  enqueueSimulatorAnalytics(storage, finish());
  enqueueSimulatorAnalytics(storage, finish(makeMatch("96ddf20c-daa3-471a-b6f1-c5447ccf49ef")));
  const ids = [];
  await flushPendingSimulatorAnalytics(storage, async (_url, options) => {
    ids.push(JSON.parse(options.body).id);
    return ids.length === 1 ? { ok: false, status: 422 } : { ok: true, status: 201 };
  });
  assert.equal(ids.length, 2);
  assert.deepEqual(readPendingSimulatorAnalytics(storage), []);
  enqueueSimulatorAnalytics(storage, finish());
  await flushPendingSimulatorAnalytics(storage, async () => ({ ok: false, status: 429 }));
  assert.equal(readPendingSimulatorAnalytics(storage).length, 1);
});

test("income counts legal per-instance passive activations, excluding blocked income and continuous cap bonuses", () => {
  const incomeCard = { id: "coral", passives: [{ name: "Photosynthesis", effect: { resource: "rp", amount: 2 } }, { name: "EcoBoost", effect: { amount: 3 } }] };
  const foundation = (id, extra = {}) => ({ id, cardId: "coral", slots: [], ...extra });
  const options = {
    side: "player", round: 2, turn: 3,
    getCard: () => incomeCard,
    getRp: (card) => (card?.passives ?? []).reduce((total, passive) => total + (passive.effect?.resource === "rp" ? passive.effect.amount : 0), 0),
    isBlocked: (entry) => entry.blocked,
    foundations: [foundation("first"), foundation("second"), foundation("stunned", { blocked: true }), foundation("penalty", { rpPenaltyNextTurn: 2 })],
  };
  const passives = getSimulatorAnalyticsIncomePassives(options);
  assert.equal(passives.length, 2);
  assert.ok(passives.every((passive) => passive.name === "Photosynthesis"));
  assert.notEqual(passives[0].id, passives[1].id);
  let match = makeMatch();
  for (const passive of [...passives, ...passives]) match = recordSimulatorAnalytics(match, { ...passive, counter: "passives", key: `${passive.cardId}::${passive.name}` });
  assert.equal(match.players[0].passives["coral::Photosynthesis"], 2);
  for (const passive of getSimulatorAnalyticsIncomePassives({ ...options, turn: 4 })) match = recordSimulatorAnalytics(match, { ...passive, counter: "passives", key: `${passive.cardId}::${passive.name}` });
  assert.equal(match.players[0].passives["coral::Photosynthesis"], 4);
});
