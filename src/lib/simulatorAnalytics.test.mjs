import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";
import { aggregateSimulatorAnalytics, ANALYTICS_COVERAGE_KEYS, ANALYTICS_METRICS, parseSimulatorAnalyticsFilters, validateSimulatorAnalyticsSubmission } from "./simulatorAnalytics.mjs";

export const now = Date.parse("2026-09-09T12:00:00Z");
export const cards = [
  { id: "coral", name: "Coral", kind: "coral", actions: [], onPlay: [], passives: [{ name: "Photosynthesis" }] },
  { id: "fish", name: "Fish", kind: "creature", actions: [{ name: "Bite" }], onPlay: [{ name: "Eat" }], passives: [] },
  { id: "habitat", name: "Reef", kind: "habitat", actions: [], onPlay: [], passives: [] },
  { id: "support", name: "Heal", kind: "support", actions: [], onPlay: [], passives: [] },
  { id: "unsampled", name: "Unused elsewhere", kind: "support", actions: [], onPlay: [], passives: [] },
];
export const decks = [{ id: "reef", name: "Reef deck" }, { id: "deep", name: "Deep deck" }];
export function matchFixture(overrides = {}) {
  const player = (side, controller, deckId) => ({
    side, controller, deckId, eligibleCards: { coral: 2, fish: 2, habitat: 1, support: 1 },
    cards: { coral: 2, fish: 1 }, actions: { "fish::Bite": 2 }, onPlay: { "fish::Eat": 1 }, passives: { "coral::Photosynthesis": 3 },
    metrics: Object.fromEntries(ANALYTICS_METRICS.map((key, i) => [key, 10 + i])),
  });
  return {
    schemaVersion: 1, simulatorVersion: "v2", id: "12345678-abcd-4000-8000-123456789abc",
    startedAt: "2026-09-09T10:00:00Z", completedAt: "2026-09-09T10:30:00Z",
    difficulty: "medium", mode: "standard", rounds: 5, victoryTarget: 30, winner: "player", vpLeadChanges: 2,
    players: [player("player", "human", "reef"), player("opponent", "ai", "deep")],
    coverage: Object.fromEntries(ANALYTICS_COVERAGE_KEYS.map((key) => [key, "complete"])),
    ...overrides,
  };
}
const context = { cards, decks, now };
const filters = { cohort: "human", difficulty: "all", deck: "all", period: "30d" };

test("validation canonicalizes anonymous fields and rejects incomplete, old-version, tutorial and invalid telemetry", () => {
  const match = matchFixture({ email: "do-not-retain@example.com", rawLog: "private", accountId: "123", deckName: "private" });
  match.players[0].name = "Private name";
  match.players[0].metrics.private = 4;
  const parsed = validateSimulatorAnalyticsSubmission(match, context);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.players[0].name, undefined);
  assert.equal(parsed.value.email, undefined);
  assert.equal(parsed.value.rawLog, undefined);
  assert.equal(parsed.value.players[0].metrics.private, undefined);
  assert.equal(parsed.value.completedAt, "2026-09-09T10:30:00.000Z");
  for (const changes of [{ winner: null }, { mode: "tutorial" }, { simulatorVersion: "v1" }, { difficulty: "extreme" }, { rounds: -1 }, { id: "bad" }, { completedAt: "2026-09-09T09:00:00Z" }, { completedAt: "2027-01-01T00:00:00Z" }]) {
    assert.equal(validateSimulatorAnalyticsSubmission(matchFixture(changes), context).ok, false, JSON.stringify(changes));
  }
});

test("validation rejects arbitrary card, ability and deck identifiers and malicious or nonfinite counts", () => {
  for (const mutate of [
    (m) => { m.players[0].cards.unknown = 1; },
    (m) => { m.players[0].cards.coral = -2; },
    (m) => { m.players[0].cards.coral = 0.5; },
    (m) => { m.players[0].metrics.rpCollected = Infinity; },
    (m) => { m.players[0].metrics.rpCollected = null; },
    (m) => { m.players[0].eligibleCards = {}; },
    (m) => { m.players[0].deckId = "my-secret-name"; },
    (m) => { m.players[0].actions["fish::arbitrary user text"] = 1; },
    (m) => { m.players[0].controller = "ai"; },
    (m) => { m.coverage.cards = "probably"; },
  ]) {
    const match = matchFixture(); mutate(match);
    assert.equal(validateSimulatorAnalyticsSubmission(match, context).ok, false);
  }
  const syntheticAttack = matchFixture();
  syntheticAttack.players[0].actions = { "fish::Attack": 3 };
  assert.equal(validateSimulatorAnalyticsSubmission(syntheticAttack, context).ok, true);
});

test("aggregation uses selected side appearances, deck eligibility, zero counts and within-type shares", () => {
  const first = matchFixture();
  const second = matchFixture({ id: "22345678-abcd-4000-8000-123456789abc", winner: "opponent", rounds: 9, vpLeadChanges: 4 });
  second.players[0].eligibleCards = { fish: 2 };
  second.players[0].cards = { fish: 3 };
  second.players[0].actions = {};
  second.players[0].passives = {};
  second.players[0].metrics.rpCollected = 30;
  const stats = aggregateSimulatorAnalytics([first, second, first], { ...context, filters });
  assert.equal(stats.summary.games, 2);
  assert.equal(stats.summary.winRate, 50);
  assert.equal(stats.summary.avgRounds, 7);
  assert.equal(stats.summary.avgDurationMinutes, 30);
  assert.equal(stats.summary.vpLeadChanges, 3);
  assert.equal(stats.summary.metrics.rpCollected.average, 20);
  const coral = stats.cards.find((card) => card.id === "coral");
  assert.equal(coral.count, 2);
  assert.equal(coral.perGame, 1);
  assert.equal(coral.perEligibleGame, 2);
  assert.equal(coral.eligibleGames, 1);
  assert.equal(coral.playRatePct, 100);
  assert.equal(stats.cards.find((card) => card.id === "support").count, 0);
  assert.equal(stats.cards.some((card) => card.id === "unsampled"), false);
  assert.equal(stats.types.find((type) => type.type === "creature").topCard.shareOfTypePct, 100);
  assert.equal(stats.matchups[0].deckId, "reef");
  assert.equal(stats.matchups[0].opponentDeckId, "deep");
  assert.equal(stats.decks[0].metrics.rpCollected.average, 20);
  const ai = aggregateSimulatorAnalytics([first, second], { ...context, filters: { ...filters, cohort: "ai" } });
  assert.equal(ai.summary.games, 2);
  assert.equal(ai.decks[0].id, "deep");
  assert.equal(ai.matchups[0].opponentDeckId, "reef");
});

test("difficulty, time, deck and cohort filters intersect and exclude unfinished and original-simulator games", () => {
  const valid = matchFixture();
  const old = matchFixture({ id: "32345678-abcd-4000-8000-123456789abc", completedAt: "2026-01-01T10:30:00Z" });
  const hard = matchFixture({ id: "42345678-abcd-4000-8000-123456789abc", difficulty: "hard" });
  const unfinished = matchFixture({ id: "52345678-abcd-4000-8000-123456789abc", winner: null });
  const original = matchFixture({ id: "62345678-abcd-4000-8000-123456789abc", simulatorVersion: "v1" });
  assert.equal(aggregateSimulatorAnalytics([valid, old, hard, unfinished, original], { ...context, filters: { ...filters, difficulty: "medium", deck: "reef" } }).summary.games, 1);
  assert.equal(aggregateSimulatorAnalytics([valid], { ...context, filters: { ...filters, deck: "deep" } }).summary.games, 0);
});

test("unavailable values are excluded while partial counts stay explicitly partial and empty samples are null", () => {
  const first = matchFixture();
  const second = matchFixture({ id: "72345678-abcd-4000-8000-123456789abc" });
  first.coverage.rpCollected = "partial";
  second.coverage.rpCollected = "unavailable";
  second.players[0].metrics.rpCollected = 0;
  const stats = aggregateSimulatorAnalytics([first, second], { ...context, filters });
  assert.deepEqual(stats.summary.metrics.rpCollected, { total: 10, average: 10, sampleSize: 1, coverage: "partial" });
  assert.equal(stats.coverage.rpCollected, "partial");
  const empty = aggregateSimulatorAnalytics([], { ...context, filters });
  assert.equal(empty.summary.winRate, null);
  assert.equal(empty.summary.avgRounds, null);
  assert.equal(empty.summary.metrics.finalVp.average, null);
  assert.equal(empty.coverage.finalVp, "unavailable");
  assert.deepEqual(empty.cards, []);
});

test("draws are counted in completed-game win-rate denominators and no identifying or raw match fields escape", () => {
  const first = matchFixture();
  const draw = matchFixture({ id: "82345678-abcd-4000-8000-123456789abc", winner: "draw" });
  const stats = aggregateSimulatorAnalytics([first, draw], { ...context, filters });
  assert.equal(stats.summary.wins, 1);
  assert.equal(stats.summary.draws, 1);
  assert.equal(stats.summary.losses, 0);
  assert.equal(stats.summary.winRate, 50);
  const serialized = JSON.stringify(stats);
  assert.equal(serialized.includes(first.id), false);
  assert.equal(serialized.includes("startedAt"), false);
  assert.equal(serialized.includes("players"), false);
});

test("filter parsing restricts all public query inputs", () => {
  assert.deepEqual(parseSimulatorAnalyticsFilters(new URLSearchParams(), { decks }).value, filters);
  for (const query of ["cohort=anyone", "difficulty=impossible", "deck=personal-name", "period=forever"]) {
    assert.equal(parseSimulatorAnalyticsFilters(new URLSearchParams(query), { decks }).ok, false);
  }
});

test("type and category denominators exclude unavailable card tracking consistently", () => {
  const first = matchFixture();
  const second = matchFixture({ id: "92345678-abcd-4000-8000-123456789abc" });
  second.coverage.cards = "unavailable";
  const stats = aggregateSimulatorAnalytics([first, second], { ...context, filters });
  assert.equal(stats.summary.games, 2);
  assert.equal(stats.cards.find((card) => card.id === "coral").perGame, 2);
  assert.equal(stats.types.find((row) => row.type === "coral").perGame, 2);
  assert.equal(stats.categories.find((row) => row.type === "coral").perGame, 2);
});

test("continuous passives without trigger measurements are not ranked as zero uses", () => {
  const catalog = cards.map((card) => card.id === "coral" ? { ...card, passives: [
    ...card.passives, { name: "Always protected", timing: "whileInPlay" },
    { name: "Turn trigger", timing: "startOfTurn" },
  ] } : card);
  const stats = aggregateSimulatorAnalytics([matchFixture()], { ...context, cards: catalog, filters });
  assert.equal(stats.passives.some((row) => row.name === "Always protected"), false);
  assert.equal(stats.passives.find((row) => row.name === "Turn trigger").count, 0);
  assert.equal(stats.passives.find((row) => row.name === "Photosynthesis").count, 3);
});

test("shared ability names combine uses while counting eligible and active games only once", () => {
  const catalog = cards.map((card) => ["fish", "coral"].includes(card.id) ? { ...card, actions: [{ name: "Scavenge" }] } : card);
  const first = matchFixture();
  first.players[0].actions = { "coral::Scavenge": 2, "fish::Scavenge": 3 };
  const second = matchFixture({ id: "a2345678-abcd-4000-8000-123456789abc" });
  second.players[0].actions = {};
  second.players[0].eligibleCards = { fish: 2 };
  const stats = aggregateSimulatorAnalytics([first, second], { ...context, cards: catalog, filters });
  const group = stats.abilityTotals.actions.find((row) => row.name === "Scavenge");
  assert.deepEqual(group, { id: "Scavenge", name: "Scavenge", count: 5, gamesPlayed: 1, eligibleGames: 2, perGame: 2.5, perEligibleGame: 2.5, sharePct: 100, playRatePct: 50 });
});

test("every real deck's card IDs and object/string abilities pass the client/server contract", async () => {
  const jiti = createJiti(import.meta.url);
  const { allCards } = await jiti.import("../data/cards/index.js");
  const { prebuiltDecks } = await jiti.import("../data/decks/prebuiltDecks.js");
  const catalog = new Map(allCards.map((card) => [card.id, card]));
  let sawUnderscore = false;
  let sawLegacyAbility = false;
  for (const [index, deck] of prebuiltDecks.entries()) {
    const match = matchFixture({ id: `${String(index).padStart(8, "0")}-abcd-4000-8000-123456789abc` });
    for (const player of match.players) {
      player.deckId = deck.id;
      player.eligibleCards = Object.fromEntries(deck.cards.filter((entry) => catalog.has(entry.cardId)).map((entry) => [entry.cardId, entry.quantity]));
      player.cards = Object.fromEntries(Object.keys(player.eligibleCards).map((id) => [id, 1]));
      for (const field of ["actions", "onPlay", "passives"]) {
        player[field] = {};
        for (const cardId of Object.keys(player.eligibleCards)) {
          sawUnderscore ||= cardId.includes("_");
          for (const ability of catalog.get(cardId)[field] ?? []) {
            sawLegacyAbility ||= typeof ability === "string";
            const name = typeof ability === "string" ? ability.split(":")[0]?.trim() || "Action" : ability?.name ?? "Action";
            player[field][`${cardId}::${name}`] = 1;
          }
        }
      }
    }
    const parsed = validateSimulatorAnalyticsSubmission(match, { cards: allCards, decks: prebuiltDecks, now });
    assert.equal(parsed.ok, true, `${deck.id}: ${parsed.error ?? ""}`);
    const stats = aggregateSimulatorAnalytics([parsed.value], { cards: allCards, decks: prebuiltDecks, now, filters });
    assert.equal(stats.summary.games, 1);
    assert.ok(stats.cards.length > 0);
    assert.equal(stats.onPlay.some((row) => row.name === undefined), false);
  }
  assert.equal(sawUnderscore, true);
  assert.equal(sawLegacyAbility, true);
});
