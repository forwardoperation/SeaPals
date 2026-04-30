"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminTournamentsPage() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadTournaments() {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(error.message);
      } else {
        setTournaments(data ?? []);
      }

      setLoading(false);
    }

    loadTournaments();
  }, []);

  async function deleteTournament(tournament) {
    const confirmed = window.confirm(
      `Delete "${tournament.name}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setMessage("");
    setDeletingId(tournament.id);

    const { error } = await supabase
      .from("tournaments")
      .delete()
      .eq("id", tournament.id);

    setDeletingId("");

    if (error) {
      setMessage(error.message);
      return;
    }

    setTournaments((current) =>
      current.filter((item) => item.id !== tournament.id)
    );
    setMessage(`Deleted ${tournament.name}.`);
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">
            Manage Tournaments
          </h1>
          <p className="mt-2 text-slate-600">
            Create, review, and remove tournament records.
          </p>
        </div>

        <Link
          href="/admin/tournaments/new"
          className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-3 font-bold text-white hover:bg-sky-700"
        >
          Create Tournament
        </Link>
      </div>

      {message && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          {message}
        </p>
      )}

      {loading ? (
        <p className="text-slate-500">Loading tournaments...</p>
      ) : (
        <div className="grid gap-4">
          {tournaments.map((tournament) => (
            <section
              key={tournament.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {tournament.name}
                  </h2>
                  <p className="mt-1 text-slate-600">
                    Status: {tournament.status}
                  </p>
                  <p className="text-slate-600">
                    Deck Size: {tournament.deck_size}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/admin/tournaments/${tournament.slug}/submissions`}
                    className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2 font-bold text-white hover:bg-sky-700"
                  >
                    Review Decks
                  </Link>

                  <Link
                    href={`/tournaments/${tournament.slug}`}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50"
                  >
                    View
                  </Link>

                  <button
                    type="button"
                    onClick={() => deleteTournament(tournament)}
                    disabled={deletingId === tournament.id}
                    className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                  >
                    {deletingId === tournament.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </section>
          ))}

          {tournaments.length === 0 && (
            <p className="text-slate-500">No tournaments yet.</p>
          )}
        </div>
      )}
    </main>
  );
}
