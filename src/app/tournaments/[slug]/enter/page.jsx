"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { allCards } from "@/data/cards";

const CARD_TABS = [
  { label: "Coral", value: "coral" },
  { label: "Support", value: "support" },
  { label: "Apex", value: "apex" },
  { label: "Predator", value: "predator" },
  { label: "Fish", value: "fish" },
  { label: "Structure", value: "structure" },
];

function getCardDisplayName(card) {
  return card.bio?.commonName || card.name;
}

function getCardSubtitle(card) {
  const parts = [];

  if (card.category) parts.push(card.category);
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

function formatEffects(items = []) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    text: item.text,
    effects: item.effects ?? (item.effect ? [item.effect] : []),
  }));
}

function formatSlotType(slot) {
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
function CardDetails({ card }) {
  const abilities = [
    ...formatEffects(card.passives),
    ...formatEffects(card.onPlay),
    ...formatEffects(card.actions),
  ];

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
      <div className="grid gap-3 md:grid-cols-3">
        <Info label="RP Cost" value={formatCost(card)} />

        {card.victoryPoints != null && (
          <Info label="Victory Points" value={card.victoryPoints} />
        )}

        {card.defense?.dice && <Info label="Defense" value={card.defense.dice} />}

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

export default function EnterTournamentPage({ params }) {
  const [slug, setSlug] = useState("");
  const [tournament, setTournament] = useState(null);
  const [activeTab, setActiveTab] = useState("coral");
  const [openCardId, setOpenCardId] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [deckName, setDeckName] = useState("");
  const [quantities, setQuantities] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadParams() {
      const resolvedParams = await params;
      setSlug(resolvedParams.slug);
    }

    loadParams();
  }, [params]);

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

  async function submitDeck(event) {
    event.preventDefault();
    setMessage("");

    if (!tournament) return;

    const { error } = await supabase.from("deck_submissions").insert({
      tournament_id: tournament.id,
      player_name: playerName,
      player_email: playerEmail,
      deck_name: deckName,
      cards: selectedCards,
      status: "pending",
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Deck submitted for review.");
    setPlayerName("");
    setPlayerEmail("");
    setDeckName("");
    setQuantities({});
    setOpenCardId(null);
  }

  if (!tournament) {
    return <main>Loading tournament...</main>;
  }

  return (
    <main className="space-y-8">
      <section>
        <h1 className="text-4xl font-bold text-slate-900">
          Enter {tournament.name}
        </h1>
        <p className="mt-2 text-slate-600">Deck Size: {tournament.deck_size}</p>
        <p className="text-slate-600">
          Selected Cards: {totalCards} / {tournament.deck_size}
        </p>
      </section>

      <form
        onSubmit={submitDeck}
        className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Player Name" value={playerName} setValue={setPlayerName} />
          <Field label="Player Email" value={playerEmail} setValue={setPlayerEmail} />
          <Field label="Deck Name" value={deckName} setValue={setDeckName} />
        </div>

        <section>
          <h2 className="mb-4 text-2xl font-bold text-slate-900">Deck List</h2>

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
        </section>

        <button
          type="submit"
          className="rounded-xl bg-sky-600 px-5 py-3 font-bold text-white hover:bg-sky-700"
        >
          Submit Deck
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

function Field({ label, value, setValue }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required={label !== "Player Email"}
        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
      />
    </div>
  );
}