"use client";

import { useEffect, useMemo, useState } from "react";
import { cardsById } from "@/data/cards";
import { supabase } from "@/lib/supabaseClient";
import { getDeckAnalytics } from "@/lib/tournaments/deckAnalytics";

function normalizeDeck(deck) {
  return {
    id: deck.id,
    playerName: deck.player_name ?? deck.playerName ?? "",
    deckName: deck.deck_name ?? deck.deckName ?? "",
    cards: Array.isArray(deck.cards) ? deck.cards : [],
    status: deck.status,
    createdAt: deck.created_at ?? deck.createdAt ?? "",
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
  habitat: "Habitat",
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
  "habitat",
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

function nextPowerOfTwo(value) {
  if (value <= 1) return 1;

  return 2 ** Math.ceil(Math.log2(value));
}

function getMatchKey(deckAId, deckBId) {
  return [deckAId, deckBId].sort().join(":");
}

function getBracketSeeds(decks) {
  return [...decks].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) ||
      a.deckName.localeCompare(b.deckName) ||
      a.playerName.localeCompare(b.playerName)
  );
}

function buildDefaultSeedSlots(decks) {
  const seeds = getBracketSeeds(decks);
  const bracketSize = nextPowerOfTwo(seeds.length);
  const slots = Array(bracketSize).fill(null);
  let left = 0;
  let right = bracketSize - 1;

  seeds.forEach((deck, index) => {
    if (index % 2 === 0) {
      slots[left] = deck;
      left += 1;
    } else {
      slots[right] = deck;
      right -= 1;
    }
  });

  return slots;
}

function buildSeedSlots(decks, savedOrder = []) {
  const defaultSlots = buildDefaultSeedSlots(decks);

  if (!Array.isArray(savedOrder) || savedOrder.length === 0) {
    return defaultSlots;
  }

  const decksById = new Map(decks.map((deck) => [deck.id, deck]));
  const slots = Array(defaultSlots.length).fill(null);
  const placedDeckIds = new Set();

  savedOrder.slice(0, slots.length).forEach((deckId, index) => {
    const deck = deckId ? decksById.get(deckId) : null;

    if (deck && !placedDeckIds.has(deck.id)) {
      slots[index] = deck;
      placedDeckIds.add(deck.id);
    }
  });

  for (const defaultDeck of defaultSlots) {
    if (!defaultDeck || placedDeckIds.has(defaultDeck.id)) continue;

    const openSlotIndex = slots.findIndex((slot) => !slot);
    if (openSlotIndex === -1) break;
    slots[openSlotIndex] = defaultDeck;
    placedDeckIds.add(defaultDeck.id);
  }

  return slots;
}

function getSeedOrder(decks, savedOrder = []) {
  return buildSeedSlots(decks, savedOrder).map((deck) => deck?.id ?? null);
}

function seedOrdersMatch(first, second) {
  return (
    first.length === second.length &&
    first.every((deckId, index) => deckId === second[index])
  );
}

function buildBracketRounds(decks, matches, seedOrder = []) {
  if (decks.length < 2) return [];

  const matchesByPair = new Map();

  for (const match of matches) {
    if (!match.deckAId || !match.deckBId) continue;
    matchesByPair.set(getMatchKey(match.deckAId, match.deckBId), match);
  }

  const rounds = [];
  let slots = buildSeedSlots(decks, seedOrder);
  let roundIndex = 0;

  while (slots.length > 1) {
    const round = {
      index: roundIndex,
      title:
        slots.length === 2
          ? "Final"
          : slots.length === 4
            ? "Semifinals"
            : `Round ${roundIndex + 1}`,
      matches: [],
    };
    const nextSlots = [];

    for (let index = 0; index < slots.length; index += 2) {
      const deckA = slots[index];
      const deckB = slots[index + 1];
      const match =
        deckA && deckB
          ? matchesByPair.get(getMatchKey(deckA.id, deckB.id)) ?? null
          : null;
      const automaticWinner = deckA && !deckB ? deckA : deckB && !deckA ? deckB : null;
      const winner =
        automaticWinner ??
        (match?.winnerDeckId
          ? [deckA, deckB].find((deck) => deck?.id === match.winnerDeckId) ?? null
          : null);

      round.matches.push({
        id: `${roundIndex}-${index / 2}`,
        roundIndex,
        matchIndex: index / 2,
        deckA,
        deckB,
        match,
        winner,
        isBye: Boolean(automaticWinner),
      });
      nextSlots.push(winner);
    }

    rounds.push(round);
    slots = nextSlots;
    roundIndex += 1;
  }

  return rounds;
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

function BracketDeckSlot({
  deck,
  winner,
  disabled,
  onWinnerClick,
  canReorder = false,
  slotIndex,
  selectedForMove = false,
  hasSelectedSlot = false,
  isDropTarget = false,
  onMoveClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  const isWinner = deck && winner?.id === deck.id;
  const reorderClasses = isDropTarget
    ? "ring-2 ring-sky-400 ring-offset-2"
    : selectedForMove
      ? "ring-2 ring-amber-400 ring-offset-2"
      : "";

  if (!deck) {
    return (
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-400 transition ${reorderClasses}`}
      >
        {canReorder && hasSelectedSlot ? (
          <button
            type="button"
            onClick={() => onMoveClick(slotIndex, false)}
            className="w-full text-left font-bold text-sky-700 hover:text-sky-900"
          >
            Move here
          </button>
        ) : (
          "Bye"
        )}
      </div>
    );
  }

  return (
    <div
      draggable={canReorder}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex rounded-xl border transition ${reorderClasses} ${
        isWinner
          ? "border-emerald-300 bg-emerald-50 text-emerald-950"
          : "border-slate-200 bg-white text-slate-800 hover:border-sky-300 hover:bg-sky-50"
      } ${canReorder ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <button
        type="button"
        onClick={() => onWinnerClick(deck.id)}
        disabled={disabled}
        className="min-w-0 flex-1 px-3 py-3 text-left disabled:cursor-not-allowed"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-bold">{deck.deckName}</div>
            <div className="mt-0.5 text-xs font-semibold text-slate-500">
              {deck.playerName}
            </div>
          </div>
          {isWinner && (
            <span className="rounded-full bg-emerald-600 px-2 py-1 text-xs font-bold text-white">
              Win
            </span>
          )}
        </div>
      </button>
      {canReorder && (
        <button
          type="button"
          onClick={() => onMoveClick(slotIndex, true)}
          aria-label={
            selectedForMove
              ? `Cancel moving ${deck.deckName}`
              : hasSelectedSlot
                ? `Swap with ${deck.deckName}`
                : `Move ${deck.deckName}`
          }
          aria-pressed={selectedForMove}
          title={
            hasSelectedSlot && !selectedForMove
              ? "Swap with selected deck"
              : "Drag, or click to select a new position"
          }
          className={`m-1 flex w-9 shrink-0 items-center justify-center rounded-lg text-lg font-black transition ${
            selectedForMove
              ? "bg-amber-100 text-amber-700"
              : "text-slate-400 hover:bg-sky-100 hover:text-sky-700"
          }`}
        >
          <span aria-hidden="true">&#8597;</span>
        </button>
      )}
    </div>
  );
}

function TournamentBracket({
  rounds,
  savingMatchId,
  pairingsDirty,
  onMoveSeed,
  onSavePairings,
  onResetPairings,
  onSaveWinner,
  onClearMatch,
}) {
  const [draggedSlot, setDraggedSlot] = useState(null);
  const [dropTargetSlot, setDropTargetSlot] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const isSavingPairings = savingMatchId === "bracket-seeding";

  function moveSeed(sourceSlot, targetSlot) {
    if (
      sourceSlot === null ||
      targetSlot === null ||
      sourceSlot === targetSlot
    ) {
      return;
    }

    onMoveSeed(sourceSlot, targetSlot);
  }

  function handleMoveClick(slotIndex, hasDeck) {
    if (selectedSlot === null) {
      if (hasDeck) setSelectedSlot(slotIndex);
      return;
    }

    if (selectedSlot === slotIndex) {
      setSelectedSlot(null);
      return;
    }

    moveSeed(selectedSlot, slotIndex);
    setSelectedSlot(null);
  }

  function handleDragStart(event, slotIndex) {
    setDraggedSlot(slotIndex);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(slotIndex));
  }

  function handleDragOver(event, slotIndex) {
    if (draggedSlot === slotIndex) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetSlot(slotIndex);
  }

  function handleDrop(event, targetSlot) {
    event.preventDefault();
    const transferredValue = event.dataTransfer.getData("text/plain");
    const transferredSlot = transferredValue === "" ? null : Number(transferredValue);
    const sourceSlot = draggedSlot ?? transferredSlot;

    if (Number.isInteger(sourceSlot)) {
      moveSeed(sourceSlot, targetSlot);
    }

    setDraggedSlot(null);
    setDropTargetSlot(null);
    setSelectedSlot(null);
  }

  function endDrag() {
    setDraggedSlot(null);
    setDropTargetSlot(null);
  }

  if (rounds.length === 0) {
    return (
      <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-slate-500">
        Approve at least two decks to generate a bracket.
      </p>
    );
  }

  return (
    <div className="mt-5">
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold text-slate-900">Edit first-round pairings</p>
          <p className="mt-0.5 text-sm text-slate-600">
            Drag a deck to another slot, or use its arrow control to select and
            swap it.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => {
              onResetPairings();
              setSelectedSlot(null);
            }}
            disabled={!pairingsDirty || isSavingPairings}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onSavePairings}
            disabled={!pairingsDirty || isSavingPairings}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSavingPairings ? "Saving..." : "Save pairings"}
          </button>
        </div>
      </div>

      {pairingsDirty && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          This is a preview. Save the pairings before choosing winners.
        </p>
      )}

      <div className="overflow-x-auto pb-3">
        <div
          className="grid min-w-max gap-4"
          style={{
            gridTemplateColumns: `repeat(${rounds.length}, minmax(250px, 1fr))`,
          }}
        >
          {rounds.map((round) => (
            <section key={round.index} className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              {round.title}
            </h3>
            <div className="space-y-4">
              {round.matches.map((match) => {
                const canUpdate = Boolean(
                  !pairingsDirty && match.deckA && match.deckB
                );
                const savingKey = match.match?.id ?? match.id;
                const isSaving = savingMatchId === savingKey;
                const canReorder = round.index === 0 && !isSavingPairings;
                const deckASlotIndex = match.matchIndex * 2;
                const deckBSlotIndex = deckASlotIndex + 1;

                const getReorderProps = (slotIndex) => ({
                  canReorder,
                  slotIndex,
                  selectedForMove: selectedSlot === slotIndex,
                  hasSelectedSlot: selectedSlot !== null,
                  isDropTarget: dropTargetSlot === slotIndex,
                  onMoveClick: handleMoveClick,
                  onDragStart: (event) => handleDragStart(event, slotIndex),
                  onDragEnd: endDrag,
                  onDragOver: (event) => handleDragOver(event, slotIndex),
                  onDragLeave: () => {
                    if (dropTargetSlot === slotIndex) setDropTargetSlot(null);
                  },
                  onDrop: (event) => handleDrop(event, slotIndex),
                });

                return (
                  <div
                    key={match.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="space-y-2">
                      <BracketDeckSlot
                        deck={match.deckA}
                        winner={match.winner}
                        disabled={!canUpdate || isSaving}
                        onWinnerClick={(winnerDeckId) =>
                          onSaveWinner(match, winnerDeckId)
                        }
                        {...getReorderProps(deckASlotIndex)}
                      />
                      <BracketDeckSlot
                        deck={match.deckB}
                        winner={match.winner}
                        disabled={!canUpdate || isSaving}
                        onWinnerClick={(winnerDeckId) =>
                          onSaveWinner(match, winnerDeckId)
                        }
                        {...getReorderProps(deckBSlotIndex)}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                      <span>
                        {match.isBye
                          ? "Advances by bye"
                          : match.winner
                            ? "Winner selected"
                            : canUpdate
                              ? "Choose winner"
                              : "Waiting for prior result"}
                      </span>
                      {match.match && (
                        <button
                          type="button"
                          onClick={() => onClearMatch(match.match.id)}
                          disabled={isSaving}
                          className="font-bold text-rose-600 hover:text-rose-700 disabled:text-slate-300"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TournamentLeaderboard({
  tournamentId,
  bracketSeedOrder = [],
  decks = [],
  matches = [],
}) {
  const normalizedDecks = useMemo(() => decks.map(normalizeDeck), [decks]);
  const incomingSeedOrder = useMemo(
    () => getSeedOrder(normalizedDecks, bracketSeedOrder),
    [bracketSeedOrder, normalizedDecks]
  );
  const [openDeckId, setOpenDeckId] = useState("");
  const [matchResults, setMatchResults] = useState(() =>
    matches.map(normalizeMatch)
  );
  const [seedOrder, setSeedOrder] = useState(incomingSeedOrder);
  const [savedSeedOrder, setSavedSeedOrder] = useState(incomingSeedOrder);
  const [savingMatchId, setSavingMatchId] = useState("");
  const [message, setMessage] = useState("");
  const normalizedMatches = useMemo(
    () => matchResults.map(normalizeMatch),
    [matchResults]
  );
  const pairingsDirty = !seedOrdersMatch(seedOrder, savedSeedOrder);
  const leaderboard = useMemo(
    () => buildLeaderboard(normalizedDecks, normalizedMatches),
    [normalizedDecks, normalizedMatches]
  );
  const bracketRounds = useMemo(
    () =>
      buildBracketRounds(
        normalizedDecks,
        pairingsDirty ? [] : normalizedMatches,
        seedOrder
      ),
    [normalizedDecks, normalizedMatches, pairingsDirty, seedOrder]
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
  useEffect(() => {
    setMatchResults(matches.map(normalizeMatch));
  }, [matches]);

  useEffect(() => {
    setSeedOrder(incomingSeedOrder);
    setSavedSeedOrder(incomingSeedOrder);
  }, [incomingSeedOrder]);

  function moveFirstRoundSeed(sourceSlot, targetSlot) {
    setSeedOrder((current) => {
      if (
        sourceSlot < 0 ||
        targetSlot < 0 ||
        sourceSlot >= current.length ||
        targetSlot >= current.length
      ) {
        return current;
      }

      const next = [...current];
      [next[sourceSlot], next[targetSlot]] = [
        next[targetSlot],
        next[sourceSlot],
      ];
      return next;
    });
    setMessage("");
  }

  function resetPairings() {
    setSeedOrder([...savedSeedOrder]);
    setMessage("Pairing changes reset.");
  }

  async function savePairings() {
    if (!tournamentId || !pairingsDirty) return;

    if (
      matchResults.length > 0 &&
      !window.confirm(
        `Saving these pairings will delete ${matchResults.length} existing match ${
          matchResults.length === 1 ? "result" : "results"
        } and reset the bracket. Continue?`
      )
    ) {
      return;
    }

    setSavingMatchId("bracket-seeding");
    setMessage("");

    const { data, error } = await supabase.rpc("reseed_tournament_bracket", {
      bracket_tournament_id: tournamentId,
      bracket_deck_ids: seedOrder,
    });

    setSavingMatchId("");

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data) {
      setMessage("Pairings were not saved. Refresh and try again.");
      return;
    }

    const savedOrder = [...seedOrder];
    setSavedSeedOrder(savedOrder);
    setMatchResults([]);
    setMessage("First-round pairings saved. The bracket has been reset.");
  }

  async function saveBracketWinner(bracketMatch, winnerDeckId) {
    setMessage("");

    if (!tournamentId) {
      setMessage("Tournament is not ready yet.");
      return;
    }

    if (!bracketMatch.deckA || !bracketMatch.deckB) {
      setMessage("This bracket match is waiting for both decks.");
      return;
    }

    const savingKey = bracketMatch.match?.id ?? bracketMatch.id;
    setSavingMatchId(savingKey);

    const { data, error } = bracketMatch.match
      ? await supabase.rpc("update_match_result", {
          match_id: bracketMatch.match.id,
          match_deck_a_id: bracketMatch.deckA.id,
          match_deck_b_id: bracketMatch.deckB.id,
          match_winner_deck_id: winnerDeckId,
        })
      : await supabase.rpc("create_match_result", {
          match_tournament_id: tournamentId,
          match_deck_a_id: bracketMatch.deckA.id,
          match_deck_b_id: bracketMatch.deckB.id,
          match_winner_deck_id: winnerDeckId,
        });

    setSavingMatchId("");

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data) {
      setMessage("Bracket result was not saved. Refresh and try again.");
      return;
    }

    const savedMatch = {
      id: bracketMatch.match?.id || data,
      deckAId: bracketMatch.deckA.id,
      deckBId: bracketMatch.deckB.id,
      winnerDeckId,
    };

    setMatchResults((current) =>
      bracketMatch.match
        ? current.map((match) =>
            match.id === bracketMatch.match.id ? savedMatch : match
          )
        : [savedMatch, ...current]
    );
    setMessage("Bracket result saved.");
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
    setMessage("Match result deleted.");
  }

  return (
    <section className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Tournament Bracket
          </h2>
          <p className="mt-1 text-slate-600">
            Drag first-round decks to change the pairings, then click a deck in
            each matchup to advance it.
          </p>
        </div>

        <TournamentBracket
          rounds={bracketRounds}
          savingMatchId={savingMatchId}
          pairingsDirty={pairingsDirty}
          onMoveSeed={moveFirstRoundSeed}
          onSavePairings={savePairings}
          onResetPairings={resetPairings}
          onSaveWinner={saveBracketWinner}
          onClearMatch={deleteMatch}
        />

        {message && (
          <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
            {message}
          </p>
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
