import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Tournaments | SeaPals TCG",
  alternates: { canonical: "/tournaments" },
};

export default async function TournamentsPage() {
  const { data: tournaments, error } = await supabase
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return <main>Error: {error.message}</main>;
  }

  return (
    <main className="space-y-6">
      <Image
        src="/images/brand/SeaPals-Tournament.png"
        alt="SeaPals Tournament"
        width={420}
        height={150}
        priority
        className="h-auto w-full max-w-xs sm:max-w-sm"
      />

      <div className="grid gap-4">
        {tournaments.map((t) => (
          <Link
            key={t.id}
            href={`/tournaments/${t.slug}`}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition"
          >
            <h2 className="text-2xl font-bold">{t.name}</h2>
            <p className="text-slate-600">Status: {t.status}</p>
            <p className="text-slate-600">
              Deck Size: {t.deck_size}
            </p>
          </Link>
        ))}

        {tournaments.length === 0 && (
          <p className="text-slate-500">
            No tournaments yet.
          </p>
        )}
      </div>
    </main>
  );
}
