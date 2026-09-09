export const SIMULATOR_ANALYTICS_STORAGE_KEY = "seapals.simulator-v2.analytics.pending.v1";
export const SIMULATOR_ANALYTICS_SCHEMA_VERSION = 1;
const REJECTED_STORAGE_KEY = "seapals.simulator-v2.analytics.rejected.v1";

const METRICS = ["rpCollected", "ecoBoostGained", "finalVp", "stunsApplied", "coralDamage", "schoolDamage", "schoolDensityGained"];
const COUNTERS = new Set(["cards", "actions", "onPlay", "passives"]);
const finite = (value) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
const clone = (value) => JSON.parse(JSON.stringify(value));
const object = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function getSimulatorAnalyticsRpCollected(before, after, committedSpend = 0) {
  return Math.max(0, finite(after) - finite(before) + finite(committedSpend));
}

export function getSimulatorAnalyticsStorage(scope = globalThis) {
  try { return scope.localStorage ?? null; } catch { return null; }
}

export function getSimulatorAnalyticsIncomePassives({ foundations = [], side, round, turn, getCard, getRp, isBlocked }) {
  const observations = [];
  const observe = (cardId, instanceKey) => {
    const card = getCard(cardId);
    for (const passive of card?.passives ?? []) {
      if (!(getRp({ ...card, passives: [passive] }) > 0)) continue;
      const name = typeof passive === "string" ? passive.split(":")[0].trim() : passive.name;
      if (name) observations.push({ side, cardId, name, id: `income:${side}:${round}:${turn}:${instanceKey}:${name}` });
    }
  };
  for (const foundation of foundations) {
    if (!isBlocked(foundation) && getRp(getCard(foundation.cardId)) > Number(foundation.rpPenaltyNextTurn ?? 0)) observe(foundation.cardId, `foundation:${foundation.id}`);
    for (const slot of foundation.slots ?? []) if (!slot.invasiveOwner && slot.cardId) observe(slot.cardId, `slot:${slot.id}`);
  }
  return observations;
}

export function createSimulatorAnalyticsMatch({ id = globalThis.crypto?.randomUUID?.(), now = new Date().toISOString(), difficulty, victoryTarget, playerDeck, opponentDeck } = {}) {
  if (!id || !playerDeck?.id || !opponentDeck?.id) return null;
  return {
    schemaVersion: 1, simulatorVersion: "v2", mode: "standard", id,
    startedAt: now, difficulty, victoryTarget, vpLeadChanges: 0,
    coverage: {
      cards: "complete", actions: "partial", onPlay: "partial", passives: "partial",
      rpCollected: "partial", ecoBoostGained: "partial", schoolDensityGained: "partial",
      coralDamage: "complete", schoolDamage: "complete", stunsApplied: "complete",
      finalVp: "complete", vpLeadChanges: "partial",
    },
    players: [playerDeck, opponentDeck].map((deck, index) => ({
      side: index ? "opponent" : "player", controller: index ? "ai" : "human", deckId: deck.id,
      eligibleCards: Object.fromEntries((deck.cards ?? []).map((entry) => [entry.cardId, finite(entry.quantity)])),
      cards: {}, actions: {}, onPlay: {}, passives: {},
      metrics: Object.fromEntries(METRICS.map((key) => [key, 0])),
    })),
    // Internal continuation data is checkpointed but never sent to the public API.
    tracking: { seen: {}, snapshots: {}, leader: null, completed: false },
  };
}

export function isSimulatorAnalyticsMatch(value) {
  return Boolean(value && value.schemaVersion === 1 && value.simulatorVersion === "v2"
    && typeof value.id === "string" && value.mode === "standard"
    && Array.isArray(value.players) && value.players.length === 2
    && value.players.every((player, index) => player?.side === (index ? "opponent" : "player")
      && METRICS.every((key) => Number.isFinite(player.metrics?.[key]) && player.metrics[key] >= 0)
      && object(player.eligibleCards)
      && [...COUNTERS].every((key) => object(player[key]) && Object.values(player[key]).every((count) => Number.isInteger(count) && count >= 0)))
    && object(value.tracking) && object(value.tracking.seen) && object(value.tracking.snapshots));
}

export function recordSimulatorAnalytics(match, { id, side = "player", counter, key, count = 1, metrics = {} } = {}) {
  if (!match || match.tracking.completed || (id && Object.hasOwn(match.tracking.seen, id))) return match;
  const index = side === "opponent" ? 1 : side === "player" ? 0 : -1;
  if (index < 0) return match;
  const next = { ...match, players: [...match.players], tracking: { ...match.tracking } };
  if (id) next.tracking.seen = { ...match.tracking.seen, [id]: true };
  const player = { ...match.players[index], metrics: { ...match.players[index].metrics } };
  next.players[index] = player;
  if (COUNTERS.has(counter) && key && !["__proto__", "constructor", "prototype"].includes(key)) {
    player[counter] = { ...player[counter], [key]: finite(player[counter][key]) + Math.floor(finite(count)) };
  }
  for (const metric of METRICS) if (Object.hasOwn(metrics, metric)) player.metrics[metric] += finite(metrics[metric]);
  return next;
}

export function recordSimulatorAnalyticsScores(match, playerVp, opponentVp) {
  if (!match || match.tracking.completed) return match;
  const leader = playerVp === opponentVp ? null : playerVp > opponentVp ? "player" : "opponent";
  const previous = match.tracking.leader;
  return {
    ...match,
    vpLeadChanges: match.vpLeadChanges + Number(Boolean(leader && previous && leader !== previous)),
    players: match.players.map((player, index) => ({ ...player, metrics: { ...player.metrics, finalVp: finite(index ? opponentVp : playerVp) } })),
    tracking: { ...match.tracking, leader: leader ?? previous },
  };
}

export function completeSimulatorAnalyticsMatch(match, { winner, rounds, now = new Date().toISOString() } = {}) {
  if (!match || !["player", "opponent", "draw"].includes(winner)) return null;
  const { tracking, ...report } = match;
  return clone({ ...report, winner, rounds: Math.floor(finite(rounds)), completedAt: now });
}

export function readPendingSimulatorAnalytics(storage) {
  try {
    const values = JSON.parse(storage?.getItem?.(SIMULATOR_ANALYTICS_STORAGE_KEY) ?? "[]");
    return Array.isArray(values) ? values.filter((value) => value?.schemaVersion === 1 && typeof value.id === "string" && value.completedAt) : [];
  } catch { return []; }
}

export function enqueueSimulatorAnalytics(storage, report) {
  if (!report?.id) return false;
  try {
    const pending = readPendingSimulatorAnalytics(storage);
    if (!pending.some((value) => value.id === report.id)) pending.push(report);
    storage.setItem(SIMULATOR_ANALYTICS_STORAGE_KEY, JSON.stringify(pending));
    return true;
  } catch { return false; }
}

// Requests are serialized per browser context. A failed request remains in storage
// until a later visit, reconnect, or periodic retry; the server deduplicates by id.
let flushing = null;
export function flushPendingSimulatorAnalytics(storage, fetcher = globalThis.fetch) {
  if (flushing) return flushing;
  flushing = (async () => {
    if (typeof fetcher !== "function") return;
    for (const report of readPendingSimulatorAnalytics(storage).slice(0, 10)) {
      try {
        const response = await fetcher("/api/simulator/analytics", {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "same-origin", body: JSON.stringify(report),
        });
        if (!response.ok && ![400, 413, 422].includes(response.status)) break;
        if (!response.ok) {
          // Keep rejected reports separately for diagnosis; one permanently
          // invalid payload must not block newer, valid completed games.
          let rejected = [];
          try { rejected = JSON.parse(storage.getItem(REJECTED_STORAGE_KEY) ?? "[]"); } catch { /* damaged diagnostic storage */ }
          if (!Array.isArray(rejected)) rejected = [];
          try { storage.setItem(REJECTED_STORAGE_KEY, JSON.stringify([...rejected, { report, status: response.status }].slice(-10))); } catch { /* quota must not block future reports */ }
        }
        const remaining = readPendingSimulatorAnalytics(storage).filter((value) => value.id !== report.id);
        storage.setItem(SIMULATOR_ANALYTICS_STORAGE_KEY, JSON.stringify(remaining));
      } catch { break; }
    }
  })().finally(() => { flushing = null; });
  return flushing;
}
