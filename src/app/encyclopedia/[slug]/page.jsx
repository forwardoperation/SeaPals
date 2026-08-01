import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  encyclopediaCreatureBySlug,
  encyclopediaCreatures,
} from "@/data/encyclopedia";
import {
  getCreatureDeckDiscovery,
  getCreatureDisplayGrammar,
} from "@/data/encyclopedia/deckDiscovery";

const ZONE_STYLES = {
  Reef: {
    label: "Coral Reef",
    pill: "bg-emerald-300/15 text-emerald-100 ring-emerald-200/25",
    panel: "border-emerald-100 bg-emerald-50/70",
    number: "bg-emerald-600",
  },
  Oceanic: {
    label: "Open Ocean",
    pill: "bg-cyan-300/15 text-cyan-100 ring-cyan-200/25",
    panel: "border-cyan-100 bg-cyan-50/70",
    number: "bg-cyan-700",
  },
  Deep: {
    label: "Deep Sea",
    pill: "bg-indigo-300/15 text-indigo-100 ring-indigo-200/25",
    panel: "border-indigo-100 bg-indigo-50/70",
    number: "bg-indigo-700",
  },
};

export function generateStaticParams() {
  return encyclopediaCreatures.map((creature) => ({ slug: creature.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const creature = encyclopediaCreatureBySlug[slug];

  if (!creature) return {};

  const title = `${creature.name}: Facts for Kids | SeaPals`;
  const description = `${creature.tagline} Explore this SeaPal's habitat, diet, ocean superpower, and four kid-friendly facts.`;

  return {
    title,
    description,
    alternates: { canonical: `/encyclopedia/${creature.slug}` },
    openGraph: {
      title,
      description,
      url: `/encyclopedia/${creature.slug}`,
      type: "article",
      images: [
        {
          url: "/images/encyclopedia/social-card.png",
          width: 1730,
          height: 909,
          alt: "A shark, blue whale, and vampire squid with the words Meet Every SeaPal — A Marine Encyclopedia for Kids.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/images/encyclopedia/social-card.png"],
    },
  };
}

function sourceLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Research source";
  }
}

function FactCard({ label, children }) {
  return (
    <div className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm">
      <dt className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
        {label}
      </dt>
      <dd className="mt-2 font-semibold leading-6 text-slate-800">{children}</dd>
    </div>
  );
}

function formatEnglishList(items) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function DeckDiscoverySection({ creature, discovery }) {
  const hasDecks = discovery.decks.length > 0;
  const { demonstrative, seaPalReference } =
    getCreatureDisplayGrammar(creature);
  const deckNameById = new Map(
    discovery.decks.map((deck) => [deck.deckId, deck.productName])
  );

  return (
    <section
      aria-labelledby="deck-discovery-heading"
      className="mt-10 overflow-hidden rounded-[2rem] border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-amber-50 shadow-sm"
    >
      <div className="px-6 py-7 sm:px-8 md:py-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
          From field guide to game table
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="deck-discovery-heading"
              className="font-serif text-3xl font-bold text-slate-950 md:text-4xl"
            >
              Bring {demonstrative} {creature.name} home
            </h2>
            <p className="mt-2 max-w-2xl leading-7 text-slate-600">
              See which ready-to-play decks feature {seaPalReference}. Try one
              in the simulator before you buy, or explore each full deck list.
            </p>
          </div>
          {hasDecks ? (
            <span className="rounded-full bg-cyan-800 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white">
              {discovery.decks.length} deck
              {discovery.decks.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {hasDecks ? (
          <ul className="mt-6 grid gap-4 lg:grid-cols-2">
            {discovery.decks.map((deck) => (
              <li
                key={deck.deckId}
                className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">
                      Ready-to-play deck
                    </p>
                    <h3 className="mt-1 font-serif text-2xl font-bold text-slate-950">
                      {deck.productName}
                    </h3>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#f7c948] px-3 py-1.5 text-xs font-black text-[#073d58]">
                    {deck.copies} {deck.copies === 1 ? "copy" : "copies"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Includes {deck.copies} {deck.copies === 1 ? "card" : "cards"}{" "}
                  featuring {creature.name}
                  {deck.matchedCards.length > 1
                    ? ` across ${deck.matchedCards.length} card versions`
                    : ""}
                  .
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href={deck.simulatorHref}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-900 focus:outline-none focus:ring-4 focus:ring-cyan-200"
                  >
                    Try this deck
                  </Link>
                  <Link
                    href={deck.storeHref}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-700 bg-white px-4 py-2 text-sm font-bold text-cyan-900 transition hover:bg-cyan-50 focus:outline-none focus:ring-4 focus:ring-cyan-100"
                  >
                    Shop this deck
                  </Link>
                  <Link
                    href={deck.deckListHref}
                    className="inline-flex min-h-11 items-center justify-center rounded-full px-3 py-2 text-sm font-bold text-cyan-800 underline decoration-cyan-300 underline-offset-4 transition hover:text-cyan-950 focus:outline-none focus:ring-4 focus:ring-cyan-100"
                  >
                    See full deck list
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-cyan-300 bg-white/80 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div>
              <h3 className="font-serif text-xl font-bold text-slate-950">
                Not currently in a ready-to-play deck
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                You can still find {seaPalReference} in the card gallery while
                planning your own custom deck.
              </p>
            </div>
            <div className="mt-4 flex shrink-0 flex-wrap gap-2 sm:mt-0">
              <Link
                href="/gallery"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-900 focus:outline-none focus:ring-4 focus:ring-cyan-200"
              >
                Browse the gallery
              </Link>
              <Link
                href="/decks"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-700 bg-white px-4 py-2 text-sm font-bold text-cyan-900 transition hover:bg-cyan-50 focus:outline-none focus:ring-4 focus:ring-cyan-100"
              >
                Explore all decks
              </Link>
            </div>
          </div>
        )}

        {discovery.bundles.map((bundle) => {
          const matchingDeckNames = bundle.matchingDeckIds
            .map((deckId) => deckNameById.get(deckId))
            .filter(Boolean);

          return (
            <aside
              key={bundle.productId}
              className="mt-4 rounded-2xl bg-[#073d58] p-5 text-white sm:flex sm:items-center sm:justify-between sm:gap-6"
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#f7c948]">
                  Also included in a bundle
                </p>
                <h3 className="mt-1 font-serif text-2xl font-bold">
                  {bundle.productName}
                </h3>
                <p className="mt-2 text-sm leading-6 text-cyan-50/85">
                  {bundle.productName} includes{" "}
                  {formatEnglishList(matchingDeckNames)}, bringing{" "}
                  {seaPalReference} to your table.
                </p>
              </div>
              <Link
                href={bundle.storeHref}
                className="mt-4 inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#f7c948] px-5 py-2 text-sm font-black text-[#073d58] transition hover:bg-amber-300 focus:outline-none focus:ring-4 focus:ring-cyan-200 sm:mt-0"
              >
                Shop {bundle.productName}
              </Link>
            </aside>
          );
        })}
      </div>
    </section>
  );
}

export default async function CreaturePage({ params }) {
  const { slug } = await params;
  const creature = encyclopediaCreatureBySlug[slug];

  if (!creature) notFound();

  const index = encyclopediaCreatures.findIndex((entry) => entry.slug === slug);
  const previous =
    encyclopediaCreatures[
      (index - 1 + encyclopediaCreatures.length) % encyclopediaCreatures.length
    ];
  const next = encyclopediaCreatures[(index + 1) % encyclopediaCreatures.length];
  const styles = ZONE_STYLES[creature.zone];
  const deckDiscovery = getCreatureDeckDiscovery(creature);

  return (
    <main className="pb-16 text-slate-900 md:pb-24">
      <nav aria-label="Breadcrumb" className="mb-5">
        <Link
          href="/encyclopedia"
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-cyan-800 transition hover:bg-cyan-50 focus:outline-none focus:ring-4 focus:ring-cyan-100"
        >
          <span aria-hidden="true">←</span> All creatures
        </Link>
      </nav>

      <article>
        <header className="relative isolate overflow-hidden rounded-[2rem] bg-[#062f46] px-5 py-9 text-white shadow-2xl shadow-cyan-950/15 sm:px-8 md:rounded-[2.75rem] md:px-12 md:py-12 lg:px-14">
          <div
            aria-hidden="true"
            className="absolute -right-28 -top-36 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl"
          />

          <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_330px]">
            <div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] ring-1 ${styles.pill}`}
                >
                  {styles.label}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-cyan-50 ring-1 ring-white/15">
                  {creature.group}
                </span>
              </div>

              <h1 className="mt-5 font-serif text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
                {creature.name}
              </h1>
              <p className="mt-2 text-lg italic text-cyan-100/80">
                {creature.scientificName}
              </p>
              <p className="mt-6 max-w-2xl text-2xl font-bold leading-snug text-[#f7c948]">
                {creature.tagline}
              </p>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-cyan-50/90">
                {creature.intro}
              </p>
              <Link
                href={`/gallery#card-${creature.cardId}`}
                className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-200/30 bg-white/10 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-cyan-200/40"
              >
                Find this SeaPal in the card gallery
              </Link>
            </div>

            <div className="mx-auto w-full max-w-[280px] lg:max-w-none">
              {creature.hasArtwork ? (
                <div className="rotate-2 rounded-[1.6rem] bg-white p-2.5 shadow-2xl shadow-black/40 ring-1 ring-white/70">
                  <Image
                    src={creature.image}
                    alt={`SeaPals card featuring ${creature.name}`}
                    width={450}
                    height={630}
                    priority
                    sizes="(max-width: 1024px) 280px, 330px"
                    className="h-auto w-full rounded-[1.1rem]"
                  />
                </div>
              ) : (
                <div className="relative grid aspect-[5/7] place-items-center overflow-hidden rounded-[1.6rem] border border-cyan-200/30 bg-gradient-to-br from-cyan-700 to-blue-950 shadow-2xl">
                  <span
                    aria-hidden="true"
                    className="absolute -right-8 -top-8 h-28 w-28 rounded-full border-[16px] border-white/10"
                  />
                  <div className="text-center">
                    <span className="font-serif text-8xl font-bold text-white/90">
                      {creature.name.charAt(0)}
                    </span>
                    <p className="mt-4 text-sm font-bold uppercase tracking-[0.18em] text-cyan-100">
                      Field guide profile
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <DeckDiscoverySection
          creature={creature}
          discovery={deckDiscovery}
        />

        <section aria-labelledby="passport-heading" className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
                Quick dive
              </p>
              <h2
                id="passport-heading"
                className="mt-2 font-serif text-3xl font-bold text-slate-950 md:text-4xl"
              >
                Creature passport
              </h2>
            </div>
          </div>

          <dl className="mt-5 grid gap-4 md:grid-cols-3">
            <FactCard label="Home">{creature.home}</FactCard>
            <FactCard label="Favorite foods">{creature.diet}</FactCard>
            <FactCard label="Size check">{creature.size}</FactCard>
          </dl>
        </section>

        <div className="mt-10 grid gap-7 lg:grid-cols-[1.15fr_.85fr]">
          <section
            aria-labelledby="facts-heading"
            className={`rounded-[2rem] border p-6 shadow-sm md:p-8 ${styles.panel}`}
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
              Tell-your-friends facts
            </p>
            <h2
              id="facts-heading"
              className="mt-2 font-serif text-3xl font-bold text-slate-950"
            >
              Four wonderfully wild things
            </h2>
            <ol className="mt-6 space-y-4">
              {creature.funFacts.map((fact, factIndex) => (
                <li
                  key={fact}
                  className="flex gap-4 rounded-2xl border border-white/90 bg-white/85 p-4 shadow-sm"
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black text-white ${styles.number}`}
                  >
                    {factIndex + 1}
                  </span>
                  <p className="pt-1 font-medium leading-7 text-slate-700">
                    {fact}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <div className="space-y-5">
            <section className="rounded-[2rem] bg-[#f7c948] p-6 text-[#073d58] shadow-sm md:p-7">
              <p className="text-xs font-black uppercase tracking-[0.2em] opacity-75">
                Ocean superpower
              </p>
              <h2 className="mt-3 font-serif text-3xl font-bold">
                Built to be amazing
              </h2>
              <p className="mt-4 text-lg font-bold leading-8">
                {creature.superpower}
              </p>
            </section>

            <section className="rounded-[2rem] border border-cyan-100 bg-white p-6 shadow-sm md:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
                Junior scientist tip
              </p>
              <h2 className="mt-3 font-serif text-2xl font-bold text-slate-950">
                What should I look for?
              </h2>
              <p className="mt-3 leading-7 text-slate-700">{creature.lookFor}</p>
            </section>

            <details className="group rounded-[2rem] border border-cyan-100 bg-white p-6 shadow-sm open:border-cyan-200">
              <summary className="cursor-pointer list-none font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-cyan-100">
                <span className="flex items-center justify-between gap-4">
                  Grown-up research links
                  <span
                    aria-hidden="true"
                    className="text-xl text-cyan-700 transition group-open:rotate-45"
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                We used trusted science organizations to check this profile.
              </p>
              <ul className="mt-4 space-y-2">
                {creature.sourceUrls.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-cyan-800 underline decoration-cyan-300 underline-offset-4 hover:text-cyan-950"
                    >
                      {sourceLabel(url)}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      </article>

      <nav
        aria-label="More creatures"
        className="mt-12 grid gap-4 border-t border-cyan-100 pt-8 sm:grid-cols-2"
      >
        <Link
          href={`/encyclopedia/${previous.slug}`}
          className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-cyan-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-cyan-100"
        >
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">
            ← Previous creature
          </span>
          <span className="mt-2 block font-serif text-xl font-bold text-slate-950">
            {previous.name}
          </span>
        </Link>
        <Link
          href={`/encyclopedia/${next.slug}`}
          className="rounded-2xl border border-cyan-100 bg-white p-5 text-right shadow-sm transition hover:-translate-y-1 hover:border-cyan-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-cyan-100"
        >
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">
            Next creature →
          </span>
          <span className="mt-2 block font-serif text-xl font-bold text-slate-950">
            {next.name}
          </span>
        </Link>
      </nav>
    </main>
  );
}
