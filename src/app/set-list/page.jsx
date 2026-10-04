import Link from "next/link";
import { getGalleryData } from "@/lib/gallery";
import { buildSetListData, RARITY_ORDER, RARITY_SYMBOLS } from "@/lib/setListData.mjs";
import SetListTable from "./SetListTable";

export const metadata = {
  title: "Rarity Set List | SeaRealm TCG",
  description: "Explore the Reef, Oceanic, and Deep set lists. Find every SeaRealm card number, rarity, Holo Rare printing, and artwork status.",
  alternates: { canonical: "/set-list" },
};

export default async function SetListPage() {
  const { rows, sets } = buildSetListData(await getGalleryData());
  const uniqueCards = sets.reduce((total, set) => total + set.uniqueCards, 0);

  return (
    <main className="min-w-0 space-y-8 pb-16">
      <section className="rounded-[2rem] border border-cyan-100 bg-white/85 p-6 shadow-sm md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">SeaRealm Collection</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">Rarity Set List</h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600 md:text-lg">
          Explore {rows.length} numbered printings across {uniqueCards} cards and stages.
          Holo Rare versions have their own set numbers and appear as separate rows.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/gallery" className="inline-flex min-h-11 items-center rounded-full bg-cyan-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-800 focus:outline-none focus:ring-4 focus:ring-cyan-200">Browse the gallery →</Link>
          <p className="text-sm text-slate-500">Prerelease and Coming soon cards are included in the set list.</p>
        </div>
      </section>

      <section aria-labelledby="rarity-totals-title" className="space-y-4">
        <h2 id="rarity-totals-title" className="text-2xl font-bold text-slate-900">Rarities by set</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {sets.map((set) => (
            <div key={set.zone} className="rounded-2xl border border-cyan-100 bg-white/90 p-5 shadow-sm">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-900">{set.title}</h3>
                <span className="text-xs font-semibold text-slate-500">{set.totalPrintings} printings</span>
              </div>
              <dl className="mt-4 space-y-2.5">
                {RARITY_ORDER.map((rarity) => (
                  <div key={rarity} className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-slate-600"><span aria-hidden="true" className="mr-2 inline-block w-4 text-center text-cyan-700">{RARITY_SYMBOLS[rarity]}</span>{rarity}</dt>
                    <dd className="font-bold tabular-nums text-slate-900">{set.rarities[rarity]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      <SetListTable rows={rows} sets={sets} />
    </main>
  );
}
