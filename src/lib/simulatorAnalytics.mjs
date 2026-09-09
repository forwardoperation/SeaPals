export const ANALYTICS_SCHEMA_VERSION = 1;
export const ANALYTICS_METRICS = [
  "rpCollected", "ecoBoostGained", "finalVp", "stunsApplied",
  "coralDamage", "schoolDamage", "schoolDensityGained",
];
export const ANALYTICS_COUNTERS = ["cards", "actions", "onPlay", "passives"];
export const ANALYTICS_COVERAGE_KEYS = [...ANALYTICS_COUNTERS, ...ANALYTICS_METRICS, "vpLeadChanges"];
export const ANALYTICS_DIFFICULTIES = ["easy", "medium", "hard"];
const COVERAGE_VALUES = new Set(["complete", "partial", "unavailable"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID = /^[a-z0-9][a-z0-9_-]{0,99}$/;
const MAX_COUNT = 100_000;
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const finiteCount = (value, max = MAX_COUNT) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const safeMetric = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000;
const divide = (value, denominator) => denominator ? value / denominator : null;
const percent = (value, denominator) => denominator ? (value / denominator) * 100 : null;

/** Only canonical game facts are retained: never account, session, deck names, logs, or user text. */
export function validateSimulatorAnalyticsSubmission(input, { cards = [], decks = [], now = Date.now() } = {}) {
  const fail = (error) => ({ ok: false, error });
  if (!record(input) || input.schemaVersion !== 1 || input.simulatorVersion !== "v2" || input.mode !== "standard") {
    return fail("Only completed standard Simulator V2 matches can be recorded.");
  }
  if (!UUID.test(input.id ?? "")) return fail("The match identifier is invalid.");
  if (!ANALYTICS_DIFFICULTIES.includes(input.difficulty)) return fail("The AI difficulty is invalid.");
  if (!["player", "opponent", "draw"].includes(input.winner)) return fail("The match must have a completed result.");
  if (!finiteCount(input.rounds, 10_000) || input.rounds < 1 || !finiteCount(input.victoryTarget, 10_000) || input.victoryTarget < 1 || !finiteCount(input.vpLeadChanges)) {
    return fail("The match totals are invalid.");
  }
  const startedAt = typeof input.startedAt === "string" && input.startedAt.length <= 40 ? Date.parse(input.startedAt) : NaN;
  const completedAt = typeof input.completedAt === "string" && input.completedAt.length <= 40 ? Date.parse(input.completedAt) : NaN;
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt < startedAt || completedAt > now + 300_000 || completedAt - startedAt > 30 * 86_400_000) {
    return fail("The match timestamps are invalid.");
  }
  const cardIds = new Set(cards.map((card) => card.id));
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const deckIds = new Set([...decks.map((deck) => deck.id), "custom"]);
  if (!Array.isArray(input.players) || input.players.length !== 2) return fail("A match must contain two participants.");
  const players = [];
  for (const [side, controller] of [["player", "human"], ["opponent", "ai"]]) {
    const matches = input.players.filter((player) => player?.side === side);
    if (matches.length !== 1 || matches[0].controller !== controller) return fail("The participant controllers are invalid.");
    const player = matches[0];
    if (!deckIds.has(player.deckId)) return fail("The participant deck is invalid.");
    const normalized = { side, controller, deckId: player.deckId };
    for (const field of ["eligibleCards", ...ANALYTICS_COUNTERS]) {
      if (!record(player[field]) || Object.keys(player[field]).length > 1000) return fail(`The ${field} counters are invalid.`);
      const counts = {};
      let total = 0;
      for (const [key, count] of Object.entries(player[field])) {
        if (!finiteCount(count, field === "eligibleCards" ? 100 : MAX_COUNT) || key.length > 220) return fail(`The ${field} counters are invalid.`);
        const separator = key.indexOf("::");
        const cardId = separator === -1 ? key : key.slice(0, separator);
        if (!ID.test(cardId) || !cardIds.has(cardId)) return fail(`The ${field} counters contain an unknown card.`);
        if (field === "eligibleCards" || field === "cards") {
          if (separator !== -1) return fail(`The ${field} card identifier is invalid.`);
        } else {
          const label = key.slice(separator + 2);
          if (separator === -1 || !label.trim() || /[\x00-\x1f\x7f<>]/.test(label) || label.length > 120) return fail(`The ${field} ability identifier is invalid.`);
          const card = cardById.get(cardId);
          if (!catalogAbilities(card, field).some((ability) => ability.name === label) && !(field === "actions" && label === "Attack" && card.kind === "creature")) return fail(`The ${field} counters contain an unknown ability.`);
        }
        total += count;
        if (total > (field === "eligibleCards" ? 500 : 1_000_000)) return fail(`The ${field} totals are too large.`);
        if (count > 0) counts[key] = count;
      }
      normalized[field] = counts;
    }
    if (!Object.keys(normalized.eligibleCards).length) return fail("The participant deck inventory is required.");
    if (!record(player.metrics)) return fail("The participant metrics are invalid.");
    normalized.metrics = {};
    for (const metric of ANALYTICS_METRICS) {
      if (!safeMetric(player.metrics[metric])) return fail(`The ${metric} metric is invalid.`);
      normalized.metrics[metric] = player.metrics[metric];
    }
    players.push(normalized);
  }
  if (input.coverage !== undefined && !record(input.coverage)) return fail("The metric coverage is invalid.");
  const coverage = {};
  for (const key of ANALYTICS_COVERAGE_KEYS) {
    const value = input.coverage?.[key] ?? (key === "finalVp" ? "complete" : "partial");
    if (!COVERAGE_VALUES.has(value)) return fail("The metric coverage is invalid.");
    coverage[key] = value;
  }
  return { ok: true, value: {
    schemaVersion: 1, simulatorVersion: "v2", id: input.id.toLowerCase(),
    startedAt: new Date(startedAt).toISOString(), completedAt: new Date(completedAt).toISOString(),
    difficulty: input.difficulty, mode: "standard", rounds: input.rounds,
    victoryTarget: input.victoryTarget, winner: input.winner, vpLeadChanges: input.vpLeadChanges,
    players, coverage,
  } };
}

export function parseSimulatorAnalyticsFilters(searchParams, { decks = [] } = {}) {
  const cohort = searchParams.get("cohort") ?? "human";
  const difficulty = searchParams.get("difficulty") ?? "all";
  const deck = searchParams.get("deck") ?? "all";
  const period = searchParams.get("period") ?? "30d";
  if (!["human", "ai"].includes(cohort) || !["all", ...ANALYTICS_DIFFICULTIES].includes(difficulty) || !["all", "7d", "30d", "90d"].includes(period) || !["all", "custom", ...decks.map((item) => item.id)].includes(deck)) {
    return { ok: false, error: "The analytics filters are invalid." };
  }
  return { ok: true, value: { cohort, difficulty, deck, period } };
}

function mergeCoverage(values) {
  if (!values.length || values.every((value) => value === "unavailable")) return "unavailable";
  return values.every((value) => value === "complete") ? "complete" : "partial";
}

function summarizeMetrics(appearances) {
  return Object.fromEntries(ANALYTICS_METRICS.map((key) => {
    const measured = appearances.filter(({ match }) => match.coverage?.[key] !== "unavailable");
    const total = measured.reduce((sum, { player }) => sum + player.metrics[key], 0);
    return [key, {
      total, average: divide(total, measured.length), sampleSize: measured.length,
      coverage: mergeCoverage(appearances.map(({ match }) => match.coverage?.[key] ?? "partial")),
    }];
  }));
}

function resultCounts(appearances) {
  const wins = appearances.filter(({ match, player }) => match.winner === player.side).length;
  const draws = appearances.filter(({ match }) => match.winner === "draw").length;
  return { games: appearances.length, wins, losses: appearances.length - wins - draws, draws, winRate: percent(wins, appearances.length) };
}

function catalogAbilities(card, field) {
  return (card[field] ?? []).map((ability) => typeof ability === "string"
    ? { name: ability.split(":")[0]?.trim() || "Action", timing: null }
    : { ...ability, name: ability?.name ?? "Action" });
}

function cardDisplayName(card) {
  return [card.name, card.subtitle, card.stageLabel].filter(Boolean).join(" · ");
}

function rankedCounters(appearances, field, cardById) {
  const measured = appearances.filter(({ match }) => match.coverage?.[field] !== "unavailable");
  const candidates = new Map();
  for (const { player } of measured) {
    for (const cardId of Object.keys(player.eligibleCards ?? {})) {
      const card = cardById.get(cardId);
      if (!card) continue;
      if (field === "cards") candidates.set(cardId, { cardId, label: cardDisplayName(card) });
      else for (const ability of catalogAbilities(card, field)) {
        if (field === "passives" && (!ability.timing || ["passive", "whileInPlay"].includes(ability.timing))) continue;
        if (ability.name) candidates.set(`${cardId}::${ability.name}`, { cardId, label: ability.name });
      }
    }
    for (const key of Object.keys(player[field] ?? {})) {
      const [cardId, ...label] = key.split("::");
      if (cardById.has(cardId)) candidates.set(key, { cardId, label: field === "cards" ? cardDisplayName(cardById.get(cardId)) : label.join("::") });
    }
  }
  const total = measured.reduce((sum, { player }) => sum + Object.values(player[field] ?? {}).reduce((a, b) => a + b, 0), 0);
  return [...candidates].map(([id, { cardId, label }]) => {
    const card = cardById.get(cardId);
    const count = measured.reduce((sum, { player }) => sum + (player[field]?.[id] ?? 0), 0);
    const gamesPlayed = measured.filter(({ player }) => (player[field]?.[id] ?? 0) > 0).length;
    const eligibleGames = measured.filter(({ player }) => (player.eligibleCards?.[cardId] ?? 0) > 0 || (player[field]?.[id] ?? 0) > 0).length;
    return {
      id, name: label, cardId, cardName: cardDisplayName(card), type: card.kind, category: card.category ?? card.kind,
      count, gamesPlayed, eligibleGames, perGame: divide(count, measured.length),
      perEligibleGame: divide(count, eligibleGames), sharePct: percent(count, total),
      playRatePct: percent(gamesPlayed, eligibleGames),
    };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function groupedAbilityCounters(appearances, field, sourceRows) {
  const measured = appearances.filter(({ match }) => match.coverage?.[field] !== "unavailable");
  const groups = new Map();
  for (const row of sourceRows) {
    if (!groups.has(row.name)) groups.set(row.name, []);
    groups.get(row.name).push(row);
  }
  const total = sourceRows.reduce((sum, row) => sum + row.count, 0);
  return [...groups].map(([name, rows]) => {
    const count = rows.reduce((sum, row) => sum + row.count, 0);
    const gamesPlayed = measured.filter(({ player }) => rows.some((row) => (player[field]?.[row.id] ?? 0) > 0)).length;
    const eligibleGames = measured.filter(({ player }) => rows.some((row) => (player.eligibleCards?.[row.cardId] ?? 0) > 0 || (player[field]?.[row.id] ?? 0) > 0)).length;
    return {
      id: name, name, count, gamesPlayed, eligibleGames,
      perGame: divide(count, measured.length), perEligibleGame: divide(count, eligibleGames),
      sharePct: percent(count, total), playRatePct: percent(gamesPlayed, eligibleGames),
    };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Aggregates one selected participant per finished match; zero-use candidates require deck exposure. */
export function aggregateSimulatorAnalytics(reports, {
  cards = [], decks = [], filters = { cohort: "human", difficulty: "all", deck: "all", period: "30d" },
  now = Date.now(), limit = 10_000, truncated = false, bytes = null, byteLimit = null, truncationReason = null,
} = {}) {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const deckById = new Map(decks.map((deck) => [deck.id, deck.name]));
  deckById.set("custom", "Custom deck");
  const cutoff = filters.period === "all" ? -Infinity : now - Number.parseInt(filters.period, 10) * 86_400_000;
  const seen = new Set();
  const appearances = [];
  for (const match of reports) {
    if (!match || match.schemaVersion !== 1 || match.simulatorVersion !== "v2" || match.mode !== "standard" || !["player", "opponent", "draw"].includes(match.winner) || seen.has(match.id)) continue;
    seen.add(match.id);
    if (Date.parse(match.completedAt) < cutoff || (filters.difficulty !== "all" && match.difficulty !== filters.difficulty)) continue;
    const player = match.players?.find((item) => item.controller === filters.cohort);
    if (!player || (filters.deck !== "all" && player.deckId !== filters.deck)) continue;
    const opponent = match.players.find((item) => item.side !== player.side);
    if (opponent) appearances.push({ match, player, opponent });
  }
  const ranked = Object.fromEntries(ANALYTICS_COUNTERS.map((field) => [field, rankedCounters(appearances, field, cardById)]));
  const abilityTotals = Object.fromEntries(["actions", "onPlay", "passives"].map((field) => [field, groupedAbilityCounters(appearances, field, ranked[field])]));
  const count = appearances.length;
  const measuredCardGames = appearances.filter(({ match }) => match.coverage?.cards !== "unavailable").length;
  const cardTotal = ranked.cards.reduce((sum, card) => sum + card.count, 0);
  const distribution = (field) => [...new Set(ranked.cards.map((card) => card[field]))].map((type) => {
    const group = ranked.cards.filter((card) => card[field] === type);
    const total = group.reduce((sum, card) => sum + card.count, 0);
    return { type, count: total, perGame: divide(total, measuredCardGames), sharePct: percent(total, cardTotal), topCard: total ? { ...group[0], shareOfTypePct: percent(group[0].count, total) } : null };
  }).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  const types = distribution("type");
  const categories = distribution("category");
  const deckStats = [...new Set(appearances.map(({ player }) => player.deckId))].map((id) => {
    const group = appearances.filter(({ player }) => player.deckId === id);
    return { id, name: deckById.get(id) ?? "Unknown deck", ...resultCounts(group), metrics: summarizeMetrics(group) };
  }).sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));
  const matchupGroups = new Map();
  for (const appearance of appearances) {
    const key = `${appearance.player.deckId}::${appearance.opponent.deckId}`;
    if (!matchupGroups.has(key)) matchupGroups.set(key, []);
    matchupGroups.get(key).push(appearance);
  }
  const matchups = [...matchupGroups.values()].map((group) => ({
    deckId: group[0].player.deckId, deckName: deckById.get(group[0].player.deckId) ?? "Unknown deck",
    opponentDeckId: group[0].opponent.deckId, opponentDeckName: deckById.get(group[0].opponent.deckId) ?? "Unknown deck",
    ...resultCounts(group),
  })).sort((a, b) => b.games - a.games);
  const measuredLeads = appearances.filter(({ match }) => match.coverage?.vpLeadChanges !== "unavailable");
  return {
    available: true, schemaVersion: 1, filters,
    options: { decks: [...deckById].map(([id, name]) => ({ id, name })), difficulties: [...ANALYTICS_DIFFICULTIES] },
    summary: {
      ...resultCounts(appearances), appearances: count,
      avgRounds: divide(appearances.reduce((sum, { match }) => sum + match.rounds, 0), count),
      avgDurationMinutes: divide(appearances.reduce((sum, { match }) => sum + (Date.parse(match.completedAt) - Date.parse(match.startedAt)) / 60_000, 0), count),
      vpLeadChanges: divide(measuredLeads.reduce((sum, { match }) => sum + match.vpLeadChanges, 0), measuredLeads.length),
      totalCardsPlayed: cardTotal, totalActions: ranked.actions.reduce((sum, action) => sum + action.count, 0),
      metrics: summarizeMetrics(appearances),
    },
    ...ranked, abilityTotals, types, categories, decks: deckStats, matchups,
    coverage: Object.fromEntries(ANALYTICS_COVERAGE_KEYS.map((key) => [key, mergeCoverage(appearances.map(({ match }) => match.coverage?.[key] ?? "partial"))])),
    dataWindow: { limit, truncated, reportCount: reports.length, bytes, byteLimit, truncationReason },
    methodology: [
      "Completed standard Simulator V2 matches collected after analytics was enabled; tutorials, story games, abandoned games, and the original simulator are excluded. Results are anonymous client-reported telemetry, not independently verified competition results.",
      "Human selects the human side and AI selects the opponent side. Difficulty always describes the AI opponent. Every average per game uses one selected participant per match; a match is never counted twice in a tab.",
      "Card and ability shares are percentages of the corresponding recorded uses. Eligible games contain the source card in the starting deck or a recorded use. Zero-use entries are restricted to cards and abilities in sampled decks, not the whole catalog. Eligibility does not imply that a card was drawn or playable.",
      "Win rate is wins divided by all completed selected games, including draws. Different victory targets may be combined. Small samples and deck selection can strongly affect comparisons.",
      "Resource, status, damage, density and ability metrics marked partial are observed lower bounds. Unavailable measurements are excluded from metric averages. Starting resources are excluded; cards placed during setup count as plays. Duration includes pauses and resumed sessions.",
      "Continuous passive abilities without recorded trigger events are not assigned zero uses or ranked as least used. Passive rankings describe observed triggers, not time active on the board.",
      "VP lead changes count switches between the two non-tied leaders; the first leader and temporary ties do not add a change.",
      "The dashboard samples the newest matching reports, stopping at 10,000 reports or an 8 MiB report budget. A truncated sample is explicitly marked; filters apply before these caps. Public aggregate responses may be cached for 60 seconds.",
    ],
  };
}
