"use client";

import { useEffect, useMemo, useState } from "react";
import { cardsById } from "@/data/cards";
import { supabase } from "@/lib/supabaseClient";
import { getDeckAnalytics } from "@/lib/tournaments/deckAnalytics";

const emptyMatchForm = {
  id: "",
  deckAId: "",
  deckBId: "",
  winnerDeckId: "",
};

function normalizeDeck(deck) {
  return {
    id: deck.id,
    playerName: deck.player_name ?? deck.playerName ?? "",
    deckName: deck.deck_name ?? deck.deckName ?? "",
    cards: Array.isArray(deck.cards) ? deck.cards : [],
    status: deck.status,
  };
}

function normalizeMatch(match) {
  return {
    id: match.id,
    deckAId: match.deck_a_id ?? match.deckAId,
    deckBId: match.deck_b_id ?? match.deckBId,
    winnerDeckId: match.winner_deck_id ?? match.winnerDeckId,
  };
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function getTopClass(analytics) {
  const topClass = analytics.classBars.find((bar) => bar.victoryPoints > 0);
  return topClass?.label ?? "No VP class";
}

function getTopTrait(analytics) {
  const topTrait = [...analytics.traitBars].sort((a, b) => b.value - a.value)[0];
  return topTrait?.value > 0 ? topTrait.label : "No profile";
}

const CATEGORY_LABELS = {
  coral: "Coral",
  support: "Support",
  apex: "Apex",
  predator: "Predator",
  fish: "Fish",
  invertebrate: "Invertebrate",
  "filter-feeder": "Filter Feeder",
  structure: "Structure",
  condition: "Condition",
};

const CATEGORY_ORDER = [
  "coral",
  "support",
  "apex",
  "predator",
  "fish",
  "invertebrate",
  "filter-feeder",
  "structure",
  "condition",
];

function getDeckComposition(deck) {
  const analytics = getDeckAnalytics(deck.cards);
  return {
    analytics,
    label: `${getTopClass(analytics)} / ${getTopTrait(analytics)}`,
  };
}

function buildLeaderboard(decks, matches) {
  const rows = decks.map((deck) => ({
    ...deck,
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
    winRate: 0,
  }));
  const rowsByDeckId = Object.fromEntries(rows.map((row) => [row.id, row]));

  for (const match of matches) {
    const deckA = rowsByDeckId[match.deckAId];
    const deckB = rowsByDeckId[match.deckBId];

    if (!deckA || !deckB || !match.winnerDeckId) continue;

    deckA.gamesPlayed += 1;
    deckB.gamesPlayed += 1;

    if (match.winnerDeckId === deckA.id) {
      deckA.wins += 1;
      deckB.losses += 1;
    } else if (match.winnerDeckId === deckB.id) {
      deckB.wins += 1;
      deckA.losses += 1;
    }
  }

  return rows
    .map((row) => ({
      ...row,
      winRate: row.gamesPlayed ? row.wins / row.gamesPlayed : 0,
    }))
    .sort(
      (a, b) =>
        b.winRate - a.winRate ||
        b.wins - a.wins ||
        a.losses - b.losses ||
        a.deckName.localeCompare(b.deckName)
    );
}

function getMatchupRows(deck, decksById, matches) {
  const matchups = new Map();

  for (const match of matches) {
    const isDeckA = match.deckAId === deck.id;
    const isDeckB = match.deckBId === deck.id;

    if (!isDeckA && !isDeckB) continue;

    const opponent = decksById[isDeckA ? match.deckBId : match.deckAId];
    if (!opponent) continue;

    const composition = getDeckComposition(opponent).label;
    const current = matchups.get(composition) ?? {
      composition,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      winRate: 0,
    };

    current.gamesPlayed += 1;

    if (match.winnerDeckId === deck.id) {
      current.wins += 1;
    } else if (match.winnerDeckId) {
      current.losses += 1;
    }

    current.winRate = current.gamesPlayed
      ? current.wins / current.gamesPlayed
      : 0;
    matchups.set(composition, current);
  }

  return [...matchups.values()].sort(
    (a, b) => b.gamesPlayed - a.gamesPlayed || b.winRate - a.winRate
  );
}

function AnalyticsBar({ label, value, detail }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-slate-800">{label}</span>
        {detail && <span className="text-xs font-semibold text-slate-500">{detail}</span>}
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-cyan-400"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function DeckAnalytics({ analytics }) {
  return (
    <div className="rounded-2xl border border-cyan-200 bg-sky-50 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <h3 className="text-lg font-bold text-slate-900">Deck Analytics</h3>
        <div className="text-sm font-semibold text-slate-700">
          VP: {analytics.totalVictoryPoints} / 30 · Avg RP:{" "}
          {analytics.averageRpCost.toFixed(1)}
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">
            Class VP Share
          </h4>
          <div className="space-y-3">
            {analytics.classBars.map((bar) => (
              <AnalyticsBar
                key={bar.category}
                label={bar.label}
                value={bar.percent}
                detail={`${bar.victoryPoints} VP`}
              />
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">
            Deck Profile
          </h4>
          <div className="space-y-3">
            {analytics.traitBars.map((bar) => (
              <AnalyticsBar
                key={bar.label}
                label={bar.label}
                value={bar.value}
                detail={`${bar.value}%`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeckCardList({ cards }) {
  const [openCategories, setOpenCategories] = useState({});
  const groupedCards = useMemo(() => {
    const groups = {};

    for (const entry of cards) {
      const card = cardsById[entry.cardId];
      const category = card?.category ?? "other";

      if (!groups[category]) {
        groups[category] = {
          category,
          label: CATEGORY_LABELS[category] ?? "Other",
          count: 0,
          cards: [],
        };
      }

      groups[category].count += Number(entry.quantity ?? 0);
      groups[category].cards.push(entry);
    }

    return Object.values(groups).sort((a, b) => {
      const aIndex = CATEGORY_ORDER.indexOf(a.category);
      const bIndex = CATEGORY_ORDER.indexOf(b.category);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
  }, [cards]);

  function toggleCategory(category) {
    setOpenCategories((current) => ({
      ...current,
      [category]: !current[category],
    }));
  }

  return (
    <div className="space-y-3">
      {groupedCards.map((group) => {
        const isOpen = Boolean(openCategories[group.category]);

        return (
          <section
            key={group.category}
            className="overflow-hidden rounded-2xl border border-slate-200"
          >
            <button
              type="button"
              onClick={() => toggleCategory(group.category)}
              className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left font-bold text-slate-800 hover:bg-slate-100"
            >
              <span>{group.label}</span>
              <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">
                {group.count}
              </span>
            </button>

            {isOpen && (
              <table className="w-full text-left text-sm">
                <tbody>
                  {group.cards.map((entry) => {
                    const card = cardsById[entry.cardId];
                    const cardName =
                      card?.bio?.commonName ?? card?.name ?? entry.cardId;
                    const stage = card?.stageLabel ? ` (${card.stageLabel})` : "";

                    return (
                      <tr
                        key={entry.cardId}
                        className="border-t border-slate-100"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {cardName}
                          {stage}
                        </td>
                        <td className="w-24 px-4 py-3 text-slate-700">
                          {entry.quantity}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default function TournamentLeaderboard({
  tournamentId,
  decks = [],
  matches = [],
}) {
  const [openDeckId, setOpenDeckId] = useState("");
  const [matchResults, setMatchResults] = useState(() =>
    matches.map(normalizeMatch)
  );
  const [matchForm, setMatchForm] = useState(emptyMatchForm);
  const [savingMatchId, setSavingMatchId] = useState("");
  const [message, setMessage] = useState("");
  const normalizedDecks = useMemo(() => decks.map(normalizeDeck), [decks]);
  const normalizedMatches = useMemo(
    () => matchResults.map(normalizeMatch),
    [matchResults]
  );
  const leaderboard = useMemo(
    () => buildLeaderboard(normalizedDecks, normalizedMatches),
    [normalizedDecks, normalizedMatches]
  );
  const decksById = useMemo(
    () => Object.fromEntries(normalizedDecks.map((deck) => [deck.id, deck])),
    [normalizedDecks]
  );
  const openDeck = openDeckId ? decksById[openDeckId] : null;
  const openDeckAnalytics = openDeck ? getDeckAnalytics(openDeck.cards) : null;
  const matchupRows = openDeck
    ? getMatchupRows(openDeck, decksById, normalizedMatches)
    : [];
  const selectedMatchDecks = useMemo(() => {
    return normalizedDecks.filter(
      (deck) => deck.id === matchForm.deckAId || deck.id === matchForm.deckBId
    );
  }, [matchForm.deckAId, matchForm.deckBId, normalizedDecks]);

  useEffect(() => {
    setMatchResults(matches.map(normalizeMatch));
  }, [matches]);

  function getDeckLabel(deckId) {
    const deck = decksById[deckId];
    if (!deck) return "Unknown deck";

    return `${deck.deckName} (${deck.playerName})`;
  }

  function updateMatchForm(nextValues) {
    setMatchForm((current) => {
      const next = { ...current, ...nextValues };

      if (
        next.winnerDeckId &&
        next.winnerDeckId !== next.deckAId &&
        next.winnerDeckId !== next.deckBId
      ) {
        next.winnerDeckId = "";
      }

      return next;
    });
  }

  function resetMatchForm() {
    setMatchForm(emptyMatchForm);
  }

  async function saveMatch(event) {
    event.preventDefault();
    setMessage("");

    if (!tournamentId) {
      setMessage("Tournament is not ready yet.");
      return;
    }

    if (!matchForm.deckAId || !matchForm.deckBId || !matchForm.winnerDeckId) {
      setMessage("Choose two decks and a winner.");
      return;
    }

    if (matchForm.deckAId === matchForm.deckBId) {
      setMessage("A match needs two different decks.");
      return;
    }

    setSavingMatchId(matchForm.id || "new");

    const { data, error } = matchForm.id
      ? await supabase.rpc("update_match_result", {
          match_id: matchForm.id,
          match_deck_a_id: matchForm.deckAId,
          match_deck_b_id: matchForm.deckBId,
          match_winner_deck_id: matchForm.winnerDeckId,
        })
      : await supabase.rpc("create_match_result", {
          match_tournament_id: tournamentId,
          match_deck_a_id: matchForm.deckAId,
          match_deck_b_id: matchForm.deckBId,
          match_winner_deck_id: matchForm.winnerDeckId,
        });

    setSavingMatchId("");

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data) {
      setMessage("Match result was not saved. Refresh and try again.");
      return;
    }

    const savedMatch = {
      id: matchForm.id || data,
      deckAId: matchForm.deckAId,
      deckBId: matchForm.deckBId,
      winnerDeckId: matchForm.winnerDeckId,
    };

    setMatchResults((current) =>
      matchForm.id
        ? current.map((match) =>
            match.id === matchForm.id ? savedMatch : match
          )
        : [savedMatch, ...current]
    );
    resetMatchForm();
    setMessage(matchForm.id ? "Match result updated." : "Match result added.");
  }

  async function deleteMatch(matchId) {
    const confirmed = window.confirm("Delete this match result?");
    if (!confirmed) return;

    setSavingMatchId(matchId);
    setMessage("");

    const { data, error } = await supabase.rpc("delete_match_result", {
      match_id: matchId,
    });

    setSavingMatchId("");

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data) {
      setMessage("Match result was not deleted. Refresh and try again.");
      return;
    }

    setMatchResults((current) =>
      current.filter((match) => match.id !== matchId)
    );
    if (matchForm.id === matchId) resetMatchForm();
    setMessage("Match result deleted.");
  }

  return (
    <section className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Match Results
            </h2>
            <p className="mt-1 text-slate-600">
              Add or edit match outcomes for the leaderboard.
            </p>
          </div>
          <p className="text-sm font-semibold text-slate-600">
            {normalizedDecks.length} approved deck
            {normalizedDecks.length === 1 ? "" : "s"}
          </p>
        </div>

        {message && (
          <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
            {message}
          </p>
        )}

        <form
          onSubmit={saveMatch}
          className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Deck A</span>
            <select
              value={matchForm.deckAId}
              onChange={(event) =>
                updateMatchForm({ deckAId: event.target.value })
              }
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            >
              <option value="">Choose deck</option>
              {normalizedDecks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.deckName} ({deck.playerName})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">Deck B</span>
            <select
              value={matchForm.deckBId}
              onChange={(event) =>
                updateMatchForm({ deckBId: event.target.value })
              }
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            >
              <option value="">Choose deck</option>
              {normalizedDecks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.deckName} ({deck.playerName})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">Winner</span>
            <select
              value={matchForm.winnerDeckId}
              onChange={(event) =>
                updateMatchForm({ winnerDeckId: event.target.value })
              }
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            >
              <option value="">Choose winner</option>
              {selectedMatchDecks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.deckName}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={savingMatchId === (matchForm.id || "new")}
              className="rounded-xl bg-sky-600 px-5 py-3 font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {matchForm.id ? "Update" : "Add"}
            </button>
            {matchForm.id && (
              <button
                type="button"
                onClick={resetMatchForm}
                className="rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {normalizedMatches.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-bold">Deck A</th>
                  <th className="px-4 py-3 font-bold">Deck B</th>
                  <th className="px-4 py-3 font-bold">Winner</th>
                  <th className="px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {normalizedMatches.map((match) => (
                  <tr key={match.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-700">
                      {getDeckLabel(match.deckAId)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {getDeckLabel(match.deckBId)}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {getDeckLabel(match.winnerDeckId)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setMatchForm(match)}
                          className="rounded-xl border border-slate-300 px-3 py-2 font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMatch(match.id)}
                          disabled={savingMatchId === match.id}
                          className="rounded-xl bg-rose-600 px-3 py-2 font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-5 text-slate-500">No match results yet.</p>
        )}
      </section>

      <div>
        <h2 className="text-3xl font-bold text-slate-900">Leaderboard</h2>
        <p className="mt-1 text-slate-600">
          Approved decks ranked by win rate, then wins.
        </p>
      </div>

      {leaderboard.length === 0 ? (
        <p className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-500 shadow-sm">
          No approved decks are on the leaderboard yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-bold">Rank</th>
                <th className="px-4 py-3 font-bold">Deck</th>
                <th className="px-4 py-3 font-bold">Player</th>
                <th className="px-4 py-3 font-bold">Wins</th>
                <th className="px-4 py-3 font-bold">Losses</th>
                <th className="px-4 py-3 font-bold">Win Rate</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row, index) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-bold text-slate-700">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDeckId(openDeckId === row.id ? "" : row.id)
                      }
                      className="font-bold text-sky-700 hover:text-sky-900"
                    >
                      {row.deckName}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.playerName}</td>
                  <td className="px-4 py-3 text-slate-700">{row.wins}</td>
                  <td className="px-4 py-3 text-slate-700">{row.losses}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">
                    {formatPercent(row.winRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openDeck && openDeckAnalytics && (
        <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">
              {openDeck.deckName}
            </h3>
            <p className="mt-1 text-slate-600">{openDeck.playerName}</p>
          </div>

          <DeckAnalytics analytics={openDeckAnalytics} />

          <section>
            <h4 className="text-lg font-bold text-slate-900">
              Performance by Opponent Composition
            </h4>
            {matchupRows.length === 0 ? (
              <p className="mt-2 text-slate-500">
                No completed matches for this deck yet.
              </p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-bold">Opponent Composition</th>
                      <th className="px-4 py-3 font-bold">Wins</th>
                      <th className="px-4 py-3 font-bold">Losses</th>
                      <th className="px-4 py-3 font-bold">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchupRows.map((row) => (
                      <tr
                        key={row.composition}
                        className="border-t border-slate-100"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {row.composition}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{row.wins}</td>
                        <td className="px-4 py-3 text-slate-700">{row.losses}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {formatPercent(row.winRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h4 className="mb-3 text-lg font-bold text-slate-900">Deck List</h4>
            <DeckCardList cards={openDeck.cards} />
          </section>
        </div>
      )}
    </section>
  );
}
