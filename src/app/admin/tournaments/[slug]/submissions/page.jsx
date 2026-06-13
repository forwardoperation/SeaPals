"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cardsById } from "@/data/cards";
import { supabase } from "@/lib/supabaseClient";
import { getDeckAnalytics } from "@/lib/tournaments/deckAnalytics";
import { validateDeck } from "@/lib/tournaments/validateDeck";

const STATUS_OPTIONS = [
  { label: "Approve", value: "approved", className: "bg-emerald-600 hover:bg-emerald-700" },
  { label: "Request Changes", value: "changesRequested", className: "bg-amber-500 hover:bg-amber-600" },
  { label: "Reject", value: "rejected", className: "bg-rose-600 hover:bg-rose-700" },
];

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

function getCardName(cardId) {
  const card = cardsById[cardId];
  if (!card) return cardId;

  const commonName = card.bio?.commonName;
  const stage = card.stageLabel ? ` (${card.stageLabel})` : "";

  return `${commonName || card.name}${stage}`;
}

function normalizeSubmission(submission) {
  return {
    ...submission,
    playerName: submission.player_name,
    deckName: submission.deck_name,
    cards: Array.isArray(submission.cards) ? submission.cards : [],
  };
}

function getEditUrl(tournament, submission) {
  if (typeof window === "undefined" || !tournament || !submission?.edit_token) {
    return "";
  }

  const url = new URL(`/tournaments/${tournament.slug}/enter`, window.location.origin);
  url.searchParams.set("submission", submission.id);
  url.searchParams.set("token", submission.edit_token);
  return url.toString();
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

function DeckAnalyticsSummary({ analytics, tournament }) {
  return (
    <div className="mt-5 rounded-2xl border border-cyan-200 bg-sky-50 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <h3 className="text-lg font-bold text-slate-900">Deck Analytics</h3>
        <div className="text-sm font-semibold text-slate-700">
          VP: {analytics.totalVictoryPoints} / 30 · Avg RP:{" "}
          {analytics.averageRpCost.toFixed(1)} · Cards: {analytics.totalCards} /{" "}
          {tournament.deck_size}
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

function GroupedDeckList({ cards }) {
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
                  {group.cards.map((entry) => (
                    <tr key={entry.cardId} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {getCardName(entry.cardId)}
                      </td>
                      <td className="w-24 px-4 py-3 text-slate-700">
                        {entry.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default function AdminTournamentSubmissionsPage({ params }) {
  const [slug, setSlug] = useState("");
  const [tournament, setTournament] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [openDeckIds, setOpenDeckIds] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadParams() {
      const resolvedParams = await params;
      setSlug(resolvedParams.slug);
    }

    loadParams();
  }, [params]);

  const loadSubmissions = useCallback(async () => {
    if (!slug) return;

    setLoading(true);
    setMessage("");

    const { data: tournamentData, error: tournamentError } = await supabase
      .from("tournaments")
      .select("*")
      .eq("slug", slug)
      .single();

    if (tournamentError || !tournamentData) {
      setMessage(tournamentError?.message ?? "Tournament not found.");
      setLoading(false);
      return;
    }

    const { data: submissionData, error: submissionsError } = await supabase
      .from("deck_submissions")
      .select("*")
      .eq("tournament_id", tournamentData.id)
      .order("created_at", { ascending: false });

    setTournament(tournamentData);

    if (submissionsError) {
      setMessage(submissionsError.message);
    } else {
      setSubmissions(submissionData ?? []);
    }

    setLoading(false);
  }, [slug]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  useEffect(() => {
    if (!tournament?.id) return;

    const channel = supabase
      .channel(`deck-submissions-${tournament.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deck_submissions",
          filter: `tournament_id=eq.${tournament.id}`,
        },
        () => {
          loadSubmissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSubmissions, tournament?.id]);

  const counts = useMemo(() => {
    return submissions.reduce(
      (summary, submission) => ({
        ...summary,
        [submission.status]: (summary[submission.status] ?? 0) + 1,
      }),
      {}
    );
  }, [submissions]);

  async function updateStatus(submission, status) {
    setMessage("");
    setSavingId(submission.id);

    const { data: wasSaved, error } = await supabase.rpc(
      "update_deck_submission_review",
      {
        submission_id: submission.id,
        next_status: status,
        notes: submission.admin_notes ?? "",
      }
    );

    if (error) {
      setSavingId("");
      setMessage(error.message);
      return;
    }

    if (!wasSaved) {
      setSavingId("");
      setMessage("Deck status was not saved. Refresh and try again.");
      return;
    }

    let emailMessage = "";
    const editUrl = getEditUrl(tournament, submission);

    if (submission.player_email && editUrl) {
      const response = await fetch("/api/deck-submissions/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: submission.player_email,
          playerName: submission.player_name,
          deckName: submission.deck_name,
          tournamentName: tournament.name,
          status,
          adminNotes: submission.admin_notes,
          editUrl,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        emailMessage = ` Email failed: ${result.error}`;
      } else if (result.skipped) {
        emailMessage = ` ${result.message}`;
      } else {
        emailMessage = " Email sent.";
      }
    } else if (!submission.player_email) {
      emailMessage = " No player email on this submission.";
    } else {
      emailMessage = " No edit token found for this submission.";
    }

    setSavingId("");
    setSubmissions((current) =>
      current.map((item) =>
        item.id === submission.id ? { ...item, status } : item
      )
    );
    setMessage(`${submission.deck_name} marked ${status}.${emailMessage}`);
  }

  async function saveNotes(submission) {
    setMessage("");
    setSavingId(submission.id);

    const { data: wasSaved, error } = await supabase.rpc(
      "update_deck_submission_review",
      {
        submission_id: submission.id,
        next_status: submission.status,
        notes: submission.admin_notes ?? "",
      }
    );

    setSavingId("");

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!wasSaved) {
      setMessage("Notes were not saved. Refresh and try again.");
      return;
    }

    setMessage(`Saved notes for ${submission.deck_name}.`);
  }

  function updateNotes(submissionId, adminNotes) {
    setSubmissions((current) =>
      current.map((item) =>
        item.id === submissionId ? { ...item, admin_notes: adminNotes } : item
      )
    );
  }

  function toggleDeckList(submissionId) {
    setOpenDeckIds((current) => ({
      ...current,
      [submissionId]: !current[submissionId],
    }));
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            href="/admin/tournaments"
            className="text-sm font-bold text-sky-700 hover:text-sky-900"
          >
            Back to tournaments
          </Link>
          <h1 className="mt-2 text-4xl font-bold text-slate-900">
            Deck Submissions
          </h1>
          {tournament && (
            <p className="mt-2 text-slate-600">
              {tournament.name} · {submissions.length} total ·{" "}
              {counts.pending ?? 0} pending
            </p>
          )}
        </div>

        {tournament && (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadSubmissions}
              className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2 font-bold text-white hover:bg-sky-700"
            >
              Refresh
            </button>

            <Link
              href={`/tournaments/${tournament.slug}`}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50"
            >
              View Tournament
            </Link>
          </div>
        )}
      </div>

      {message && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          {message}
        </p>
      )}

      {loading ? (
        <p className="text-slate-500">Loading submissions...</p>
      ) : (
        <div className="grid gap-5">
          {submissions.map((submission) => {
            const normalizedSubmission = normalizeSubmission(submission);
            const validation = validateDeck(normalizedSubmission, tournament);
            const analytics = getDeckAnalytics(normalizedSubmission.cards);
            const isDeckListOpen = Boolean(openDeckIds[submission.id]);
            const totalCards = normalizedSubmission.cards.reduce(
              (sum, entry) => sum + Number(entry.quantity ?? 0),
              0
            );

            return (
              <section
                key={submission.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-bold text-slate-900">
                        {submission.deck_name}
                      </h2>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                        {submission.status}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                          validation.isValid
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {validation.isValid ? "Valid" : "Needs Review"}
                      </span>
                    </div>

                    <p className="mt-2 text-slate-600">
                      {submission.player_name}
                      {submission.player_email ? ` · ${submission.player_email}` : ""}
                    </p>
                    <p className="text-slate-600">
                      Cards: {totalCards} / {tournament.deck_size}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateStatus(submission, option.value)}
                        disabled={
                          savingId === submission.id ||
                          submission.status === option.value
                        }
                        className={`inline-flex items-center justify-center rounded-xl px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300 ${option.className}`}
                      >
                        {savingId === submission.id ? "Saving..." : option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!validation.isValid && (
                  <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">
                    <h3 className="font-bold">Validation Issues</h3>
                    <ul className="mt-2 list-disc pl-5">
                      {validation.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <DeckAnalyticsSummary
                  analytics={analytics}
                  tournament={tournament}
                />

                <div className="mt-5">
                  <label className="block text-sm font-bold text-slate-700">
                    Admin Notes
                  </label>
                  <textarea
                    value={submission.admin_notes ?? ""}
                    onChange={(event) =>
                      updateNotes(submission.id, event.target.value)
                    }
                    rows={3}
                    placeholder="Explain what should change before approval."
                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-800"
                  />
                  <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <button
                      type="button"
                      onClick={() => saveNotes(submission)}
                      disabled={savingId === submission.id}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      {savingId === submission.id ? "Saving..." : "Save Notes"}
                    </button>

                    {submission.edit_token && tournament && (
                      <a
                        href={getEditUrl(tournament, submission)}
                        className="text-sm font-bold text-sky-700 hover:text-sky-900"
                      >
                        Open player edit link
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => toggleDeckList(submission.id)}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50"
                  >
                    {isDeckListOpen ? "Hide Deck List" : "Show Deck List"}
                  </button>

                  {isDeckListOpen && (
                    <div className="mt-3">
                      <GroupedDeckList cards={normalizedSubmission.cards} />
                    </div>
                  )}
                </div>
              </section>
            );
          })}

          {submissions.length === 0 && (
            <p className="text-slate-500">No deck submissions yet.</p>
          )}
        </div>
      )}
    </main>
  );
}
