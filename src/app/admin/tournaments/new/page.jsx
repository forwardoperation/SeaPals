"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function NewTournamentPage() {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("draft");
  const [deckSize, setDeckSize] = useState(40);
  const [maxCopiesPerCard, setMaxCopiesPerCard] = useState(3);
  const [message, setMessage] = useState("");

  async function createTournament(event) {
    event.preventDefault();
    setMessage("");

    const { error } = await supabase.from("tournaments").insert({
      name,
      slug: slugify(name),
      status,
      deck_size: Number(deckSize),
      max_copies_per_card: Number(maxCopiesPerCard),
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Tournament created.");
    setName("");
    setStatus("draft");
    setDeckSize(40);
    setMaxCopiesPerCard(3);
  }

  return (
    <main className="mx-auto max-w-2xl">
      <h1 className="text-4xl font-bold text-slate-900">
        Create Tournament
      </h1>

      <form
        onSubmit={createTournament}
        className="mt-8 space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="block text-sm font-semibold text-slate-700">
            Tournament Name
          </label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="Genesis Test Tournament"
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700">
            Status
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
          >
            <option value="draft">Draft</option>
            <option value="open">Open</option>
            <option value="review">Review</option>
            <option value="active">Active</option>
            <option value="complete">Complete</option>
          </select>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Deck Size
            </label>
            <input
              type="number"
              value={deckSize}
              onChange={(event) => setDeckSize(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Max Copies Per Card
            </label>
            <input
              type="number"
              value={maxCopiesPerCard}
              onChange={(event) => setMaxCopiesPerCard(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </div>
        </div>

        <button
          type="submit"
          className="rounded-xl bg-sky-600 px-5 py-3 font-bold text-white hover:bg-sky-700"
        >
          Create Tournament
        </button>

        {message && (
          <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
            {message}
          </p>
        )}
      </form>
    </main>
  );
}