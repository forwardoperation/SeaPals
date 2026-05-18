import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import TournamentLeaderboard from "./TournamentLeaderboard";

export const dynamic = "force-dynamic";

async function getMatchResults(tournamentId) {
  const { data, error } = await supabase
    .from("match_results")
    .select("*")
    .eq("tournament_id", tournamentId);

  if (error) {
    return [];
  }

  return data ?? [];
}

export default async function TournamentDetailPage({ params }) {
  const { slug } = await params;

  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !tournament) {
    return <main>Tournament not found.</main>;
  }

  const { data: decks } = await supabase
    .from("deck_submissions")
    .select("*")
    .eq("tournament_id", tournament.id)
    .eq("status", "approved");
  const matches = await getMatchResults(tournament.id);

  return (
    <main className="space-y-8">
      <section className="grid gap-8 lg:grid-cols-[minmax(260px,0.8fr)_minmax(360px,1.2fr)] lg:items-start">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">
            {tournament.name}
          </h1>
          <p className="mt-2 text-slate-600">Status: {tournament.status}</p>
          <p className="text-slate-600">Deck Size: {tournament.deck_size}</p>
          <p className="text-slate-600">
            Max Copies Per Card: {tournament.max_copies_per_card}
          </p>
        </div>

        <Image
          src="/images/brand/SeaPals-Tournament.png"
          alt="SeaPals Tournament"
          width={640}
          height={230}
          priority
          className="h-auto w-full justify-self-center lg:justify-self-end"
        />
      </section>

      {tournament.status === "open" && (
        <Link
          href={`/tournaments/${tournament.slug}/enter`}
          className="inline-block rounded-xl bg-sky-600 px-5 py-3 font-bold text-white hover:bg-sky-700"
        >
          Enter Tournament
        </Link>
      )}

      <TournamentLeaderboard
        tournamentId={tournament.id}
        decks={decks ?? []}
        matches={matches}
      />
    </main>
  );
}
