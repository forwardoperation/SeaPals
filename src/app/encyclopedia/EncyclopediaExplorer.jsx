"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

const ZONES = [
  { value: "All", label: "All waters", note: "Every SeaPal" },
  { value: "Reef", label: "Coral reef", note: "Bright & bustling" },
  { value: "Oceanic", label: "Open ocean", note: "Big blue explorers" },
  { value: "Deep", label: "Deep sea", note: "Midnight mysteries" },
];

const GROUPS = [
  "All",
  "Fish",
  "Invertebrate",
  "Predator",
  "Apex",
  "Filter Feeder",
];

const ZONE_STYLES = {
  Reef: {
    pill: "bg-emerald-300/15 text-emerald-100",
    wash: "from-emerald-700/15 via-cyan-950/10 to-sky-900/15",
    accent: "bg-emerald-500",
  },
  Oceanic: {
    pill: "bg-sky-300/15 text-sky-100",
    wash: "from-sky-700/15 via-blue-950/10 to-cyan-900/15",
    accent: "bg-sky-500",
  },
  Deep: {
    pill: "bg-indigo-300/15 text-indigo-100",
    wash: "from-indigo-700/15 via-slate-950/10 to-cyan-900/15",
    accent: "bg-indigo-500",
  },
};

function CreatureArtwork({ creature }) {
  const styles = ZONE_STYLES[creature.zone];

  return (
    <div
      className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br ${styles.wash}`}
    >
      <span
        aria-hidden="true"
        className="absolute -right-5 -top-5 h-24 w-24 rounded-full border-[14px] border-white/35"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-5 left-6 h-5 w-5 rounded-full border-4 border-white/60"
      />

      {creature.hasArtwork ? (
        <Image
          src={creature.image}
          alt={`${creature.name} SeaRealm card`}
          width={240}
          height={336}
          sizes="(max-width: 640px) 42vw, (max-width: 1024px) 28vw, 230px"
          className="h-[88%] w-auto rotate-2 rounded-lg object-contain drop-shadow-xl transition duration-300 group-hover:-rotate-1 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="relative grid h-28 w-28 place-items-center rounded-full border border-white/20 bg-slate-950/35 shadow-lg backdrop-blur">
          <span className="font-serif text-5xl font-bold text-cyan-50">
            {creature.name.charAt(0)}
          </span>
          <span
            aria-hidden="true"
            className={`absolute -bottom-2 -right-2 h-9 w-9 rounded-full ${styles.accent} opacity-75`}
          />
        </div>
      )}
    </div>
  );
}

export default function EncyclopediaExplorer({ creatures }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState("All");
  const [group, setGroup] = useState("All");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filteredCreatures = useMemo(
    () =>
      creatures.filter((creature) => {
        const matchesQuery =
          !deferredQuery || creature.searchText.includes(deferredQuery);
        const matchesZone = zone === "All" || creature.zone === zone;
        const matchesGroup = group === "All" || creature.group === group;
        return matchesQuery && matchesZone && matchesGroup;
      }),
    [creatures, deferredQuery, group, zone]
  );

  const clearFilters = () => {
    setQuery("");
    setZone("All");
    setGroup("All");
  };

  const surpriseMe = () => {
    const pool = filteredCreatures.length > 0 ? filteredCreatures : creatures;
    const creature = pool[Math.floor(Math.random() * pool.length)];
    router.push(`/encyclopedia/${creature.slug}`);
  };

  return (
    <section aria-labelledby="explore-heading" className="mt-12">
      <div className="py-2 md:py-4">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">
              Creature finder
            </p>
            <h2
              id="explore-heading"
              className="mt-2 font-serif text-3xl font-bold tracking-tight text-white md:text-4xl"
            >
              Who will you meet?
            </h2>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative block min-w-0 sm:min-w-80">
              <span className="sr-only">Search creatures and facts</span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-cyan-200"
              >
                ⌕
              </span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try ‘shark,’ ‘glow,’ or ‘squid’"
                className="min-h-12 w-full rounded-2xl border border-cyan-200/30 bg-slate-950/55 py-3 pl-11 pr-4 text-base text-white outline-none transition [color-scheme:dark] placeholder:text-cyan-200/70 focus:border-cyan-200/70 focus:bg-slate-950/70 focus:ring-4 focus:ring-cyan-200/40"
              />
            </label>
            <button
              type="button"
              onClick={surpriseMe}
              className="min-h-12 rounded-2xl bg-[#f7c948] px-5 py-3 font-bold text-[#073d58] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#ffda68] focus:outline-none focus:ring-4 focus:ring-amber-200"
            >
              Surprise me!
            </button>
          </div>
        </div>

        <div className="mt-7 grid gap-7 border-t border-cyan-200/20 pt-7 lg:grid-cols-[1.15fr_.85fr]">
          <fieldset>
            <legend className="text-sm font-bold text-white">
              Pick an ocean zone
            </legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ZONES.map((option) => {
                const selected = zone === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setZone(option.value)}
                    className={`rounded-2xl border px-3 py-3 text-left transition focus:outline-none focus:ring-4 focus:ring-cyan-200/40 ${
                      selected
                        ? "border-cyan-200/60 bg-cyan-700/70 text-white shadow-md"
                        : "border-cyan-200/20 bg-slate-950/35 text-white hover:border-cyan-200/35 hover:bg-white/10"
                    }`}
                  >
                    <span className="block text-sm font-bold">{option.label}</span>
                    <span
                      className={`mt-0.5 block text-[0.7rem] ${
                        selected ? "text-cyan-50" : "text-cyan-200"
                      }`}
                    >
                      {option.note}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-bold text-white">
              Choose a creature group
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {GROUPS.map((option) => {
                const selected = group === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setGroup(option)}
                    className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-cyan-200/40 ${
                      selected
                        ? "border-cyan-200/60 bg-cyan-700/70 text-white"
                        : "border-cyan-200/25 bg-slate-950/35 text-cyan-50 hover:border-cyan-400 hover:bg-white/10"
                    }`}
                  >
                    {option === "All" ? "All groups" : option}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <p className="font-semibold text-cyan-50" aria-live="polite">
          Showing <span className="text-white">{filteredCreatures.length}</span>{" "}
          {filteredCreatures.length === 1 ? "creature" : "creatures"}
        </p>
        {(query || zone !== "All" || group !== "All") && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full px-4 py-2 text-sm font-bold text-cyan-100 underline decoration-cyan-300 underline-offset-4 transition hover:text-white focus:outline-none focus:ring-4 focus:ring-cyan-200/40"
          >
            Clear filters
          </button>
        )}
      </div>

      {filteredCreatures.length > 0 ? (
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredCreatures.map((creature) => {
            const styles = ZONE_STYLES[creature.zone];
            return (
              <Link
                key={creature.slug}
                href={`/encyclopedia/${creature.slug}`}
                className="group overflow-hidden rounded-[1.6rem] border border-cyan-200/20 bg-slate-950/35 shadow-sm transition duration-300 hover:-translate-y-1.5 hover:border-cyan-200/35 hover:shadow-xl hover:shadow-cyan-950/10 focus:outline-none focus:ring-4 focus:ring-cyan-200/40"
              >
                <CreatureArtwork creature={creature} />
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] ${styles.pill}`}
                    >
                      {creature.zone}
                    </span>
                    <span className="text-xs font-semibold text-cyan-200">
                      {creature.group}
                    </span>
                  </div>
                  <h3 className="mt-3 font-serif text-2xl font-bold leading-tight text-white group-hover:text-cyan-100">
                    {creature.name}
                  </h3>
                  <p className="mt-1 truncate text-sm italic text-cyan-200">
                    {creature.scientificName}
                  </p>
                  <p className="mt-3 text-sm font-semibold leading-6 text-cyan-50">
                    {creature.tagline}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-cyan-100">
                    Open field guide <span aria-hidden="true">→</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-[2rem] border border-dashed border-cyan-200/35 bg-slate-950/35 px-6 py-14 text-center">
          <p className="font-serif text-3xl font-bold text-white">
            That creature is hiding!
          </p>
          <p className="mx-auto mt-3 max-w-lg leading-7 text-cyan-100">
            Try a different name or explore another ocean zone. You can also ask
            for a surprise dive.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-6 rounded-full bg-cyan-700 px-5 py-3 font-bold text-white transition hover:bg-cyan-800 focus:outline-none focus:ring-4 focus:ring-cyan-200/40"
          >
            Show every SeaPal
          </button>
        </div>
      )}
    </section>
  );
}
