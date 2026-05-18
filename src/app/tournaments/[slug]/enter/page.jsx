"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { allCards, cardsById } from "@/data/cards";
import {
  CUSTOM_DECK_OPTION,
  DEFAULT_PREBUILT_DECK_ID,
  getPrebuiltDeckById,
  prebuiltDecks,
} from "@/data/tournaments/prebuiltDecks";
import {
  formatCreatureClass,
  formatCreatureType,
  formatCreatureZone,
} from "@/data/cards/types";
import { getDeckAnalytics } from "@/lib/tournaments/deckAnalytics";
import { validateDeck } from "@/lib/tournaments/validateDeck";

const CARD_TABS = [
  { label: "Coral", value: "coral" },
  { label: "Support", value: "support" },
  { label: "Apex", value: "apex" },
  { label: "Predator", value: "predator" },
  { label: "Fish", value: "fish" },
  { label: "Invertebrate", value: "invertebrate" },
  { label: "Filter Feeder", value: "filter-feeder" },
  { label: "Structure", value: "structure" },
];

const PRESET_SUMMARY_GROUPS = [
  { label: "Coral", category: "coral" },
  { label: "Support", category: "support" },
  { label: "Fish", category: "fish" },
  { label: "Predator", category: "predator" },
  { label: "Apex", category: "apex" },
  { label: "Filter Feeder", category: "filter-feeder" },
  { label: "Invertebrate", category: "invertebrate" },
  { label: "Structure", category: "structure" },
];

function getCardDisplayName(card) {
  return card.bio?.commonName || card.name;
}

function getCardSubtitle(card) {
  const parts = [];
  const creatureType = formatCreatureType(card);

  if (creatureType) parts.push(creatureType);
  else if (card.category) parts.push(card.category);
  if (card.kind) parts.push(card.kind);
  if (card.kind === "coral" && card.stageLabel) parts.push(card.stageLabel);
  if (card.bio?.scientificName) parts.push(card.bio.scientificName);

  return parts.join(" · ");
}

function formatCost(card) {
  if (card.kind === "support") return "Free to play";
  if (card.kind === "condition") return "Environment card";
  if (!card.cost?.rp) return "No RP cost";
  return `${card.cost.rp} RP`;
}

function formatEffects(items = [], prefix = "effect") {
  return items.map((item, index) => {
    if (typeof item === "string") {
      return {
        id: `${prefix}-${index}`,
        name: "",
        text: item,
        effects: [],
      };
    }

    return {
      id: item.id,
      name: item.name,
      text: item.text,
      effects: item.effects ?? (item.effect ? [item.effect] : []),
    };
  });
}

function formatSlotType(slot) {
  if (slot.zone && slot.slotClass) {
    return `${formatCreatureZone(slot.zone)} ${formatCreatureClass(
      slot.slotClass
    )}`;
  }

  if (slot.slotType) {
    return `${slot.slotType} slot`;
  }

  if (slot.acceptsCategories?.length) {
    return `${slot.acceptsCategories.join(", ")} slot`;
  }

  if (slot.tags?.length) {
    return `${slot.tags.join(", ")} slot`;
  }

  return `${slot.kind} slot`;
}

function getSubmissionErrorMessage(error) {
  if (error?.message?.includes("edit_token")) {
    return "Deck edit links are not set up in Supabase yet. Run supabase/deck-submission-review.sql in the Supabase SQL editor, then try again.";
  }

  return error?.message ?? "Deck submission failed.";
}

function CardDetails({ card }) {
  const abilities = [
    ...formatEffects(card.passives, "passive"),
    ...formatEffects(card.onPlay, "on-play"),
    ...formatEffects(card.actions, "action"),
    ...formatEffects(card.specialRules, "special-rule"),
  ];

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
      <div className="grid gap-3 md:grid-cols-3">
        <Info label="RP Cost" value={formatCost(card)} />

        {card.victoryPoints != null && (
          <Info label="Victory Points" value={card.victoryPoints} />
        )}

        {(typeof card.defense === "string" || card.defense?.dice) && (
          <Info
            label="Defense"
            value={
              typeof card.defense === "string"
                ? card.defense
                : card.defense.dice
            }
          />
        )}

        {card.health != null && <Info label="HP" value={card.health} />}

        {card.stageLabel && <Info label="Stage" value={card.stageLabel} />}
      </div>

      {card.slots?.length > 0 && (
        <section className="mt-4">
          <h4 className="font-bold text-slate-900">Coral Slots</h4>
          <ul className="mt-2 list-disc pl-5">
            {card.slots.map((slot, index) => (
            <li key={index}>
            {slot.count} × {formatSlotType(slot)}
            </li>
            ))}
          </ul>
        </section>
      )}

      {card.weaknesses?.length > 0 && (
        <section className="mt-4">
          <h4 className="font-bold text-slate-900">Weaknesses</h4>
          <p className="mt-1">{card.weaknesses.join(", ")}</p>
        </section>
      )}

      {card.playRequirements?.length > 0 && (
        <section className="mt-4">
          <h4 className="font-bold text-slate-900">Play Requirements</h4>
          <ul className="mt-2 list-disc pl-5">
            {card.playRequirements.map((requirement) => (
              <li key={requirement.id}>{requirement.text}</li>
            ))}
          </ul>
        </section>
      )}

      {abilities.length > 0 && (
        <section className="mt-4">
          <h4 className="font-bold text-slate-900">Abilities</h4>
          <div className="mt-2 space-y-2">
            {abilities.map((ability) => (
              <div key={ability.id} className="rounded-xl bg-slate-50 p-3">
                <div className="font-bold text-slate-900">{ability.name}</div>
                {ability.text && <p className="mt-1">{ability.text}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {card.bio && (
        <section className="mt-4">
          <h4 className="font-bold text-slate-900">Bio</h4>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {Object.entries(card.bio)
              .filter(([, value]) => value)
              .map(([key, value]) => (
                <Info key={key} label={key} value={value} />
              ))}
          </div>
        </section>
      )}

      {card.flavorText && (
        <p className="mt-4 italic text-slate-500">“{card.flavorText}”</p>
      )}

			{card.text && (
			<section className="mt-4">
					<h4 className="font-bold text-slate-900">Card Text</h4>
					<p className="mt-1">{card.text}</p>
			</section>
			)}

			{card.restrictions?.length > 0 && (
			<section className="mt-4">
					<h4 className="font-bold text-slate-900">Restrictions</h4>
					<ul className="mt-2 list-disc pl-5">
					{card.restrictions.map((restriction, index) => (
							<li key={restriction.id ?? index}>
							{restriction.text ?? String(restriction)}
							</li>
					))}
					</ul>
			</section>
			)}
    </div>
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
          className="h-full rounded-full bg-cyan-400 transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function DeckAnalyticsPanel({ analytics, tournament }) {
  return (
    <section className="rounded-3xl border border-cyan-200 bg-sky-50 p-5 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Deck Analytics</h2>
          <p className="mt-1 text-sm text-slate-600">
            Live balance based on selected cards, victory points, cost, dice, and card effects.
          </p>
        </div>
        <div className="text-sm font-semibold text-slate-700">
          VP: {analytics.totalVictoryPoints} / 30 · Avg RP:{" "}
          {analytics.averageRpCost.toFixed(1)} · Cards: {analytics.totalCards} /{" "}
          {tournament.deck_size}
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600">
            Class VP Share
          </h3>
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
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600">
            Deck Profile
          </h3>
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
    </section>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 font-semibold text-slate-900">{String(value)}</div>
    </div>
  );
}

function entriesToQuantities(entries) {
  const nextQuantities = {};

  for (const entry of entries) {
    if (cardsById[entry.cardId]) {
      nextQuantities[entry.cardId] = String(entry.quantity);
    }
  }

  return nextQuantities;
}

function getDefaultPrebuiltDeck() {
  return getPrebuiltDeckById(DEFAULT_PREBUILT_DECK_ID);
}

function DeckPresetSummary({ deck }) {
  const availableCards = deck.cards.filter((entry) => cardsById[entry.cardId]);
  const unavailableCards = deck.cards.filter((entry) => !cardsById[entry.cardId]);
  const listedTotal = deck.cards.reduce((sum, entry) => sum + entry.quantity, 0);
  const selectableTotal = availableCards.reduce(
    (sum, entry) => sum + entry.quantity,
    0
  );
  const groupedCards = PRESET_SUMMARY_GROUPS.map((group) => ({
    ...group,
    cards: availableCards
      .filter((entry) => cardsById[entry.cardId]?.category === group.category)
      .sort((first, second) => {
        const firstCard = cardsById[first.cardId];
        const secondCard = cardsById[second.cardId];
        const firstName = `${getCardDisplayName(firstCard)} ${
          firstCard.stageLabel ?? ""
        }`;
        const secondName = `${getCardDisplayName(secondCard)} ${
          secondCard.stageLabel ?? ""
        }`;

        return firstName.localeCompare(secondName);
      }),
  })).filter((group) => group.cards.length > 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{deck.name}</h3>
          <p className="text-sm text-slate-600">
            Standard issued deck list. Choose Custom to edit card quantities.
          </p>
        </div>
        <p className="text-sm font-bold text-slate-700">
          {listedTotal} listed / {selectableTotal} selectable
        </p>
      </div>

      {unavailableCards.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Missing card data:{" "}
          {unavailableCards
            .map((entry) => `${entry.quantity}x ${entry.unavailableName ?? entry.cardId}`)
            .join(", ")}
        </div>
      )}

      <div className="mt-5 space-y-5">
        {groupedCards.map((group) => (
          <section key={group.category}>
            <h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              {group.label}
            </h4>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {group.cards.map((entry) => {
                const card = cardsById[entry.cardId];

                return (
                  <div
                    key={entry.cardId}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm"
                  >
                    <span className="font-semibold text-slate-800">
                      {getCardDisplayName(card)}
                      {card.stageLabel ? ` - ${card.stageLabel}` : ""}
                    </span>
                    <span className="font-bold text-slate-500">
                      x{entry.quantity}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

export default function EnterTournamentPage({ params, searchParams }) {
  const defaultPrebuiltDeck = getDefaultPrebuiltDeck();
  const [slug, setSlug] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [editToken, setEditToken] = useState("");
  const [editingSubmission, setEditingSubmission] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [activeTab, setActiveTab] = useState("coral");
  const [openCardId, setOpenCardId] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [deckName, setDeckName] = useState(defaultPrebuiltDeck?.name ?? "");
  const [selectedDeckOption, setSelectedDeckOption] = useState(
    DEFAULT_PREBUILT_DECK_ID
  );
  const [quantities, setQuantities] = useState(() =>
    defaultPrebuiltDeck ? entriesToQuantities(defaultPrebuiltDeck.cards) : {}
  );
  const [adminNotes, setAdminNotes] = useState("");
  const [message, setMessage] = useState("");
  const [validationAttempted, setValidationAttempted] = useState(false);

  useEffect(() => {
    async function loadParams() {
      const resolvedParams = await params;
      const resolvedSearchParams = await searchParams;
      setSlug(resolvedParams.slug);
      setSubmissionId(resolvedSearchParams?.submission ?? "");
      setEditToken(resolvedSearchParams?.token ?? "");
    }

    loadParams();
  }, [params, searchParams]);

  useEffect(() => {
    if (!slug) return;

    async function loadTournament() {
      const { data } = await supabase
        .from("tournaments")
        .select("*")
        .eq("slug", slug)
        .single();

      setTournament(data);
    }

    loadTournament();
  }, [slug]);

  useEffect(() => {
    if (!submissionId || !editToken) return;

    async function loadSubmission() {
      const { data, error } = await supabase
        .from("deck_submissions")
        .select("*")
        .eq("id", submissionId)
        .eq("edit_token", editToken)
        .single();

      if (error || !data) {
        setMessage("This deck edit link is invalid or expired.");
        return;
      }

      setEditingSubmission(data);
      setSelectedDeckOption(CUSTOM_DECK_OPTION);
      setPlayerName(data.player_name ?? "");
      setPlayerEmail(data.player_email ?? "");
      setDeckName(data.deck_name ?? "");
      setAdminNotes(data.admin_notes ?? "");

      const nextQuantities = {};
      for (const entry of data.cards ?? []) {
        nextQuantities[entry.cardId] = String(entry.quantity);
      }
      setQuantities(nextQuantities);
    }

    loadSubmission();
  }, [submissionId, editToken]);

  const selectedPrebuiltDeck = useMemo(
    () => getPrebuiltDeckById(selectedDeckOption),
    [selectedDeckOption]
  );

  const filteredCards = useMemo(() => {
    return allCards.filter((card) => card.category === activeTab);
  }, [activeTab]);

  const selectedCards = useMemo(() => {
    return Object.entries(quantities)
      .map(([cardId, quantity]) => ({
        cardId,
        quantity: Number(quantity),
      }))
      .filter((entry) => entry.quantity > 0);
  }, [quantities]);

  const totalCards = selectedCards.reduce(
    (sum, entry) => sum + entry.quantity,
    0
  );
  const hasCorrectCardCount = totalCards === tournament?.deck_size;
  const cardCountDifference = (tournament?.deck_size ?? 0) - totalCards;
  const deckAnalytics = useMemo(
    () => getDeckAnalytics(selectedCards),
    [selectedCards]
  );
  const tabCounts = useMemo(() => {
    const counts = Object.fromEntries(CARD_TABS.map((tab) => [tab.value, 0]));

    for (const [cardId, quantity] of Object.entries(quantities)) {
      const card = cardsById[cardId];
      const numericQuantity = Number(quantity);

      if (!card || !Number.isFinite(numericQuantity) || numericQuantity <= 0) {
        continue;
      }

      counts[card.category] = (counts[card.category] ?? 0) + numericQuantity;
    }

    return counts;
  }, [quantities]);

  const deckValidation = useMemo(() => {
    if (!tournament) {
      return { isValid: false, errors: [], warnings: [] };
    }

    return validateDeck(
      {
        playerName,
        deckName,
        cards: selectedCards,
      },
      tournament
    );
  }, [deckName, playerName, selectedCards, tournament]);

  function selectDeckOption(deckId) {
    setSelectedDeckOption(deckId);
    setOpenCardId(null);
    setValidationAttempted(false);

    const prebuiltDeck = getPrebuiltDeckById(deckId);

    if (!prebuiltDeck) {
      return;
    }

    setDeckName(prebuiltDeck.name);
    setQuantities(entriesToQuantities(prebuiltDeck.cards));
  }

  async function submitDeck(event) {
    event.preventDefault();
    setMessage("");
    setValidationAttempted(true);

    if (!tournament) return;

    if (!deckValidation.isValid) {
      setMessage("Please fix the deck issues before submitting.");
      return;
    }

    const payload = {
      tournament_id: tournament.id,
      player_name: playerName,
      player_email: playerEmail,
      deck_name: deckName,
      cards: selectedCards,
      status: "pending",
      admin_notes: "",
    };

    if (editingSubmission) {
      const { data: wasSaved, error } = await supabase.rpc(
        "update_deck_submission_with_token",
        {
          submission_id: editingSubmission.id,
          submission_edit_token: editToken,
          player_name: playerName,
          player_email: playerEmail,
          deck_name: deckName,
          deck_cards: selectedCards,
        }
      );

      if (error) {
        setMessage(getSubmissionErrorMessage(error));
        return;
      }

      if (!wasSaved) {
        setMessage("Deck changes were not saved. Please use the latest edit link and try again.");
        return;
      }

      setMessage("Deck changes submitted for review.");
      setEditingSubmission((current) => ({ ...current, ...payload }));
      setAdminNotes("");
      return;
    }

    const { error } = await supabase.from("deck_submissions").insert({
      ...payload,
      edit_token: crypto.randomUUID(),
    });

    if (error) {
      setMessage(getSubmissionErrorMessage(error));
      return;
    }

    setMessage("Deck submitted for review.");

    setPlayerName("");
    setPlayerEmail("");
    setDeckName(defaultPrebuiltDeck?.name ?? "");
    setSelectedDeckOption(DEFAULT_PREBUILT_DECK_ID);
    setQuantities(
      defaultPrebuiltDeck ? entriesToQuantities(defaultPrebuiltDeck.cards) : {}
    );
    setValidationAttempted(false);
    setOpenCardId(null);
  }

  if (!tournament) {
    return <main>Loading tournament...</main>;
  }

  return (
    <main className="space-y-8">
      <section>
        <h1 className="text-4xl font-bold text-slate-900">
          {editingSubmission ? "Edit" : "Enter"} {tournament.name}
        </h1>
        <p className="mt-2 text-slate-600">Deck Size: {tournament.deck_size}</p>
        <p className="text-slate-600">
          Selected Cards: {totalCards} / {tournament.deck_size}
        </p>
      </section>

      {(validationAttempted ||
        (totalCards > 0 && totalCards !== tournament.deck_size)) &&
        deckValidation.errors.length > 0 && (
          <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
            <h2 className="text-lg font-bold">Deck Issues</h2>
            <ul className="mt-2 list-disc pl-5">
              {deckValidation.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
        </section>
      )}

      <DeckAnalyticsPanel analytics={deckAnalytics} tournament={tournament} />

      {adminNotes && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <h2 className="text-lg font-bold">Admin Notes</h2>
          <p className="mt-2 whitespace-pre-wrap">{adminNotes}</p>
        </section>
      )}

      <form
        onSubmit={submitDeck}
        className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Player Name" value={playerName} setValue={setPlayerName} />
          <Field label="Player Email" value={playerEmail} setValue={setPlayerEmail} />
          <Field label="Deck Name" value={deckName} setValue={setDeckName} />
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Deck Type
            </label>
            <select
              value={selectedDeckOption}
              onChange={(event) => selectDeckOption(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
            >
              {prebuiltDecks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name}
                </option>
              ))}
              <option value={CUSTOM_DECK_OPTION}>Custom Deck</option>
            </select>
          </div>
        </div>

        <section>
          <h2 className="mb-4 text-2xl font-bold text-slate-900">Deck List</h2>

          {selectedPrebuiltDeck ? (
            <DeckPresetSummary deck={selectedPrebuiltDeck} />
          ) : (
            <>
          <div className="mb-5 flex flex-wrap gap-2">
            {CARD_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setActiveTab(tab.value);
                  setOpenCardId(null);
                }}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  activeTab === tab.value
                    ? "bg-sky-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.label}
                {tabCounts[tab.value] > 0 && (
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                      activeTab === tab.value
                        ? "bg-white/20 text-white"
                        : "bg-white text-slate-600"
                    }`}
                  >
                    {tabCounts[tab.value]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="grid gap-3">
            {filteredCards.map((card) => {
              const isOpen = openCardId === card.id;

              return (
                <div key={card.id} className="rounded-2xl bg-slate-50 p-4">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenCardId(isOpen ? null : card.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        setOpenCardId(isOpen ? null : card.id);
                      }
                    }}
                    className="grid cursor-pointer grid-cols-[1fr_90px] items-center gap-4"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        {getCardDisplayName(card)}

                        {card.kind === "coral" && card.stageLabel && (
                          <span className="ml-2 rounded-full bg-sky-100 px-2 py-1 text-xs font-bold text-sky-700">
                            {card.stageLabel}
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-slate-500">
                        {getCardSubtitle(card)}
                      </div>

                      <div className="mt-1 text-xs font-semibold text-sky-700">
                        {isOpen ? "Hide details" : "Show details"}
                      </div>
                    </div>

                    <input
                      type="number"
                      min="0"
                      max={tournament.max_copies_per_card}
                      value={quantities[card.id] ?? ""}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [card.id]: event.target.value,
                        }))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>

                  {isOpen && <CardDetails card={card} />}
                </div>
              );
            })}
          </div>
            </>
          )}
        </section>

        <button
          type="submit"
          disabled={!hasCorrectCardCount}
          className="rounded-xl bg-sky-600 px-5 py-3 font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {!hasCorrectCardCount
            ? cardCountDifference > 0
              ? `Select ${cardCountDifference} more card${
                  cardCountDifference === 1 ? "" : "s"
                }`
              : `Remove ${Math.abs(cardCountDifference)} card${
                  Math.abs(cardCountDifference) === 1 ? "" : "s"
                }`
            : editingSubmission
              ? "Submit Changes"
              : "Submit Deck"}
        </button>

        {message && (
          <p className="rounded-xl bg-slate-100 px-4 py-3 text-slate-700">
            {message}
          </p>
        )}
      </form>
    </main>
  );
}

function Field({ label, value, setValue, required = true }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required={required}
        type={label === "Player Email" ? "email" : "text"}
        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
      />
    </div>
  );
}
