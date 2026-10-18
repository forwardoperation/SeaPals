import Image from "next/image";
import Link from "next/link";
import EncyclopediaExplorer from "./EncyclopediaExplorer";
import {
  encyclopediaCreatures,
  encyclopediaStats,
  getEncyclopediaSummaries,
} from "@/data/encyclopedia";

export const metadata = {
  title: "Marine Encyclopedia for Kids | SeaRealm",
  description:
    "Meet every real marine creature in SeaRealm with kid-friendly facts, ocean superpowers, habitats, diets, sizes, and research links.",
  alternates: { canonical: "/encyclopedia" },
  openGraph: {
    title: "Meet Every SeaPal | A Marine Encyclopedia for Kids",
    description:
      "Dive into kid-friendly facts about every real marine creature in SeaRealm.",
    url: "/encyclopedia",
    type: "website",
    images: [
      {
        url: "/images/encyclopedia/social-card.png",
        width: 1730,
        height: 909,
        alt: "A shark, blue whale, and vampire squid swimming above the words Meet Every SeaPal — A Marine Encyclopedia for Kids.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Meet Every SeaPal | A Marine Encyclopedia for Kids",
    description:
      "Dive into kid-friendly facts about every real marine creature in SeaRealm.",
    images: ["/images/encyclopedia/social-card.png"],
  },
};

const FEATURED_SLUGS = ["bull-shark", "blue-whale", "vampire-squid"];

export default function EncyclopediaPage() {
  const creatures = getEncyclopediaSummaries();
  const featuredCreatures = FEATURED_SLUGS.map((slug) =>
    encyclopediaCreatures.find((creature) => creature.slug === slug)
  ).filter(Boolean);

  return (
    <main className="pb-16 text-white md:pb-24">
      <section className="relative isolate overflow-hidden py-10 text-white md:py-14">
        <span
          aria-hidden="true"
          className="absolute left-[47%] top-12 h-8 w-8 rounded-full border-4 border-cyan-200/25"
        />
        <span
          aria-hidden="true"
          className="absolute left-[55%] top-28 h-4 w-4 rounded-full border-2 border-cyan-200/30"
        />

        <div className="relative grid items-center gap-12 lg:grid-cols-[1.06fr_.94fr]">
          <div>
            <p className="inline-flex rounded-full border border-cyan-200/25 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">
              SeaRealm marine encyclopedia
            </p>
            <h1 className="mt-6 max-w-3xl font-serif text-4xl font-bold leading-[1.03] tracking-tight text-white sm:text-5xl md:text-6xl">
              Meet the real animals behind every SeaPal.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-cyan-50/90 md:text-xl">
              Dive past the cards and into the ocean. Discover surprising
              superpowers, favorite foods, wild habitats, and facts worth
              sharing at the dinner table.
            </p>

            <a
              href="#explore-heading"
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[#f7c948] px-6 py-3 font-bold text-[#073d58] shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#ffda68] focus:outline-none focus:ring-4 focus:ring-cyan-200/50"
            >
              Start exploring
            </a>

            <dl className="mt-9 grid grid-cols-3 gap-3 border-t border-white/15 pt-7">
              <div>
                <dt className="text-2xl font-bold text-white md:text-3xl">
                  {encyclopediaStats.creatures}
                </dt>
                <dd className="mt-1 text-xs font-bold uppercase tracking-[0.13em] text-cyan-200">
                  Creatures
                </dd>
              </div>
              <div>
                <dt className="text-2xl font-bold text-white md:text-3xl">
                  {encyclopediaStats.zones}
                </dt>
                <dd className="mt-1 text-xs font-bold uppercase tracking-[0.13em] text-cyan-200">
                  Ocean zones
                </dd>
              </div>
              <div>
                <dt className="text-2xl font-bold text-white md:text-3xl">
                  {encyclopediaStats.facts}
                </dt>
                <dd className="mt-1 text-xs font-bold uppercase tracking-[0.13em] text-cyan-200">
                  Fun facts
                </dd>
              </div>
            </dl>
          </div>

          <div className="relative mx-auto flex min-h-[390px] w-full max-w-lg items-center justify-center sm:min-h-[440px]">
            <div className="absolute inset-x-8 bottom-5 top-5 rounded-[45%] bg-gradient-to-b from-cyan-300/20 to-blue-950/20 blur-sm" />
            {featuredCreatures.map((creature, index) => (
              <Link
                key={creature.slug}
                href={`/encyclopedia/${creature.slug}`}
                aria-label={`Learn about the ${creature.name}`}
                className={`absolute w-[34%] max-w-44 rounded-2xl bg-white p-1.5 shadow-2xl shadow-black/40 ring-1 ring-white/70 transition duration-300 hover:z-30 hover:-translate-y-3 focus:z-30 focus:outline-none focus:ring-4 focus:ring-cyan-200 ${
                  index === 0
                    ? "left-[4%] top-[30%] -rotate-6"
                    : index === 1
                      ? "left-[33%] top-[12%] z-20 rotate-2"
                      : "right-[3%] top-[34%] rotate-6"
                }`}
              >
                <Image
                  src={creature.image}
                  alt={`${creature.name} SeaRealm card`}
                  width={300}
                  height={420}
                  priority
                  sizes="(max-width: 640px) 30vw, 170px"
                  className="h-auto w-full rounded-xl"
                />
              </Link>
            ))}
            <p className="absolute bottom-0 rounded-full border border-cyan-200/25 bg-slate-950/35 px-4 py-2 text-center text-xs font-bold uppercase tracking-[0.17em] text-cyan-100 shadow-lg backdrop-blur">
              Tap a card to take a quick dive
            </p>
          </div>
        </div>
      </section>

      <EncyclopediaExplorer creatures={creatures} />

      <section className="mt-14 grid gap-5 border-t border-cyan-200/20 py-9 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
            Learning meets play
          </p>
          <h2 className="mt-2 font-serif text-3xl font-bold text-white">
            Found a new favorite?
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-cyan-100">
            Spot its SeaRealm card, then bring that creature’s real ocean talents
            back to your next game.
          </p>
        </div>
        <Link
          href="/gallery"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-cyan-200/40 bg-slate-950/35 px-5 py-3 font-bold text-cyan-100 transition hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-cyan-200/40"
        >
          Browse the card gallery
        </Link>
      </section>
    </main>
  );
}
