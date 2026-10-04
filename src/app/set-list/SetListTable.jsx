"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { filterSetListRows, RARITY_ORDER, RARITY_SYMBOLS } from "@/lib/setListData.mjs";

const RARITY_CLASSES = {
  Common: "border-slate-200 bg-slate-50 text-slate-700",
  Uncommon: "border-cyan-200 bg-cyan-50 text-cyan-800",
  Rare: "border-amber-200 bg-amber-50 text-amber-800",
  "Holo Rare": "border-violet-200 bg-violet-50 text-violet-800",
};

const ARTWORK_CLASSES = {
  Complete: "text-emerald-800",
  Prerelease: "text-amber-800",
  "Coming soon": "text-slate-500",
};

const controlClass = "mt-2 min-h-11 w-full rounded-xl border border-cyan-200 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:ring-4 focus:ring-cyan-100";

export default function SetListTable({ rows, sets }) {
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState("all");
  const [rarity, setRarity] = useState("all");
  const filtered = useMemo(
    () => filterSetListRows(rows, { query, zone, rarity }),
    [rows, query, zone, rarity]
  );
  const hasFilters = query !== "" || zone !== "all" || rarity !== "all";

  function clearFilters() {
    setQuery("");
    setZone("all");
    setRarity("all");
  }

  return (
    <section aria-labelledby="set-list-table-title" className="min-w-0 rounded-[2rem] border border-cyan-100 bg-white/90 shadow-sm">
      <div className="p-5 md:p-8">
        <h2 id="set-list-table-title" className="text-2xl font-bold text-slate-900">Find a card</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <label className="text-sm font-semibold text-slate-700" htmlFor="set-list-search">
            Search cards
            <input id="set-list-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Card name or set number" className={controlClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700" htmlFor="set-list-zone">
            Set
            <select id="set-list-zone" value={zone} onChange={(event) => setZone(event.target.value)} className={controlClass}>
              <option value="all">All sets</option>
              {sets.map((set) => <option key={set.zone} value={set.zone}>{set.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700" htmlFor="set-list-rarity">
            Rarity
            <select id="set-list-rarity" value={rarity} onChange={(event) => setRarity(event.target.value)} className={controlClass}>
              <option value="all">All rarities</option>
              {RARITY_ORDER.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="text-sm text-slate-600">
            Showing <strong className="text-slate-900">{filtered.length}</strong> of {rows.length} printings
          </p>
          {hasFilters && <button type="button" onClick={clearFilters} className="min-h-11 rounded-xl px-3 py-2 text-sm font-bold text-cyan-800 underline-offset-4 hover:underline focus:outline-none focus:ring-4 focus:ring-cyan-100">Clear filters</button>}
        </div>
        <p className="mt-2 text-xs text-slate-500 md:hidden">Swipe across the table to see every column.</p>
      </div>

      <div className="overflow-x-auto rounded-b-[2rem] border-t border-cyan-100" tabIndex={0} role="region" aria-label="Card set list, scroll horizontally on small screens">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <caption className="sr-only">SeaRealm card printings with set numbers, rarities, and artwork status. Card names open the gallery.</caption>
          <thead className="bg-cyan-950 text-white">
            <tr>
              {['Set', 'Number', 'Card', 'Type', 'Rarity', 'Artwork'].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap px-4 py-4 font-semibold first:pl-6 last:pr-6">{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t border-cyan-100 odd:bg-white even:bg-cyan-50/40 hover:bg-cyan-50">
                <td className="whitespace-nowrap py-4 pl-6 pr-4 text-slate-600">{row.setTitle}</td>
                <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-slate-600">{row.number}/{row.totalPrintings}</td>
                <th scope="row" className="min-w-48 px-4 py-4 font-semibold">
                  <Link href={`/gallery#card-${row.cardId}`} className="rounded text-cyan-900 underline-offset-4 hover:underline focus:outline-none focus:ring-4 focus:ring-cyan-100">{row.name}</Link>
                  {row.stageLabel && <span className="mt-1 block text-xs font-normal text-slate-500">{row.stageLabel}</span>}
                </th>
                <td className="whitespace-nowrap px-4 py-4 text-slate-600">{row.category}</td>
                <td className="px-4 py-4"><span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${RARITY_CLASSES[row.rarity]}`}><span aria-hidden="true">{RARITY_SYMBOLS[row.rarity]}</span>{row.rarity}</span></td>
                <td className={`whitespace-nowrap py-4 pl-4 pr-6 text-xs font-semibold ${ARTWORK_CLASSES[row.artwork]}`}>{row.artwork}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-6 py-14 text-center text-slate-600">No cards match these filters. Try another name, set, or rarity.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
