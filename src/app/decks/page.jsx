import Image from "next/image";
import Link from "next/link";
import physicalManifest from "@/data/decks/physicalDecks.json";
import galleryImages from "@/data/gallery-images.json";
import masterSetList from "@/data/gallery-set-list.json";
import { storeProductDefinitions } from "@/data/store/products.js";
import { buildPhysicalDeckContents } from "@/lib/decks/physicalDeckContents.mjs";
import { getStoreProductPath } from "@/lib/store/productDetails.mjs";

export const metadata = {
  title: "Decks | SeaRealm TCG",
  description: "Explore the card contents of SeaRealm's seven 60-card ready-to-play physical decks.",
  alternates: { canonical: "/decks" },
};

function getPhysicalDecks() {
  const productsByDeckId = new Map(
    storeProductDefinitions
      .filter((product) => product.category === "expansion-decks" && product.deckId)
      .map((product) => [product.deckId, product])
  );
  return buildPhysicalDeckContents(physicalManifest, galleryImages, masterSetList)
    .map((deck) => {
      const product = productsByDeckId.get(deck.id);
      if (!product) throw new Error(`Missing retail product for physical deck ${deck.id}.`);
      return {
        ...deck,
        name: product.shortName || product.name,
        description: product.description,
        productId: product.id,
        image: product.image,
        imageAlt: product.imageAlt,
      };
    });
}

function CardRow({ card }) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          <Image
            src={card.image}
            alt={card.displayName}
            width={48}
            height={67}
            className="h-16 w-12 shrink-0 rounded border border-slate-200 object-cover"
          />
          <div className="min-w-0">
            <div className="font-bold text-slate-900">{card.displayName}</div>
            <div className="mt-0.5 text-xs font-semibold text-slate-500">{card.categoryLabel}</div>
          </div>
        </div>
      </td>
      <td className="w-20 px-3 py-3 text-right font-bold tabular-nums text-slate-900">
        x{card.quantity}
      </td>
    </tr>
  );
}

function DeckList({ deck }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      {deck.groups.map((group) => (
        <section key={group.category} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
            <h3 id={`${deck.id}-${group.category}-heading`} className="font-bold text-slate-900">{group.label}</h3>
            <span className="text-sm font-bold text-slate-500">{group.count} {group.count === 1 ? "card" : "cards"}</span>
          </div>
          <table aria-labelledby={`${deck.id}-${group.category}-heading`} className="w-full text-left text-sm">
            <thead className="sr-only">
              <tr><th scope="col">Card</th><th scope="col">Quantity</th></tr>
            </thead>
            <tbody>
              {group.cards.map((card) => <CardRow key={card.cardId} card={card} />)}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

function DeckSection({ deck }) {
  return (
    <section id={deck.id} aria-labelledby={`deck-${deck.id}-heading`} className="scroll-mt-8 border-t border-slate-200 py-10 first:border-t-0">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 id={`deck-${deck.id}-heading`} className="text-3xl font-bold text-slate-950">{deck.name}</h2>
          <p className="mt-2 max-w-3xl leading-7 text-slate-600">{deck.description}</p>
          <p className="mt-3 text-sm font-bold text-cyan-900">{deck.totalCards} cards in this deck</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={getStoreProductPath(deck.productId)}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#f7c948] px-5 py-2.5 text-sm font-black text-[#073d58] transition hover:-translate-y-0.5 hover:bg-[#ffda68] focus:outline-none focus:ring-4 focus:ring-cyan-200/70"
            >
              Shop this deck
            </Link>
            <Link
              href={`/simulator?deck=${deck.id}`}
              className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-black text-cyan-800 transition hover:-translate-y-0.5 hover:bg-cyan-50 focus:outline-none focus:ring-4 focus:ring-cyan-200/70"
            >
              Open simulator
            </Link>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">Simulator previews may differ from the physical contents listed here.</p>
        </div>
        <Link href={getStoreProductPath(deck.productId)} className="relative block aspect-[4/3] w-44 shrink-0 self-center overflow-hidden rounded-2xl border border-cyan-100 bg-cyan-50 sm:self-start">
          <Image src={deck.image} alt={deck.imageAlt || `${deck.name} deck box`} fill sizes="176px" className="object-contain p-3" />
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2" aria-label={`${deck.name} card composition`}>
        {deck.groups.map((group) => (
          <span key={group.category} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
            {group.label} <strong className="font-bold text-slate-950">{group.count}</strong>
          </span>
        ))}
      </div>
      <div className="mt-6"><DeckList deck={deck} /></div>
    </section>
  );
}

export default function DecksPage() {
  const decks = getPhysicalDecks();
  return (
    <main className="space-y-8 pb-12">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="relative aspect-[6596/1202] min-h-[150px]">
          <Image
            src="/images/promo/decks-promo.png"
            alt="SeaRealm prebuilt deck boxes"
            width={6596}
            height={1202}
            priority
            className="h-full w-full object-cover object-center"
          />
        </div>
        <div className="border-t border-slate-200 px-6 py-6 md:px-8">
          <p className="text-sm font-bold uppercase tracking-wide text-cyan-700">Prebuilt Deck Guide</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">SeaRealm Decks</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">See what is included in each ready-to-play physical deck, with exact card quantities and artwork.</p>
        </div>
      </section>

      <nav aria-label="Physical decks" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {decks.map((deck) => (
          <a key={deck.id} href={`#${deck.id}`} className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-cyan-300 hover:bg-cyan-50 focus:outline-none focus:ring-4 focus:ring-cyan-200/70">
            <div className="font-bold text-slate-950">{deck.name}</div>
            <div className="mt-2 text-sm font-semibold text-slate-500">{deck.totalCards} cards</div>
          </a>
        ))}
      </nav>

      <div>{decks.map((deck) => <DeckSection key={deck.id} deck={deck} />)}</div>
    </main>
  );
}
