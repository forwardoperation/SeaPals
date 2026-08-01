import Image from "next/image";
import Link from "next/link";
import { cardsById } from "@/data/cards";
import { CardCategory } from "@/data/cards/types";
import { prebuiltDecks } from "@/data/tournaments/prebuiltDecks";
import { getDeckAnalytics } from "@/lib/tournaments/deckAnalytics";

export const metadata = {
  title: "Decks | SeaPals TCG",
  description: "Explore SeaPals prebuilt deck lists and performance profiles.",
};

const CATEGORY_LABELS = {
  [CardCategory.CORAL]: "Coral",
  [CardCategory.SUPPORT]: "Support",
  [CardCategory.FISH]: "Fish",
  [CardCategory.PREDATOR]: "Predator",
  [CardCategory.APEX]: "Apex",
  [CardCategory.FILTER_FEEDER]: "Filter Feeder",
  [CardCategory.INVERTEBRATE]: "Invertebrate",
  [CardCategory.HABITAT]: "Habitat",
  [CardCategory.CONDITION]: "Condition",
  unavailable: "Missing Card Data",
};

const CATEGORY_ORDER = [
  CardCategory.CORAL,
  CardCategory.SUPPORT,
  CardCategory.FISH,
  CardCategory.PREDATOR,
  CardCategory.APEX,
  CardCategory.FILTER_FEEDER,
  CardCategory.INVERTEBRATE,
  CardCategory.HABITAT,
  CardCategory.CONDITION,
  "unavailable",
];

const DECK_NOTES = {
  "blue-water":
    "A steady reef builder with filter feeders, apex threats, and a heavy Boulder Star coral base.",
  disruption:
    "A reef-control deck that pressures opponents with whirlpools, recovery loops, and efficient predators.",
  "coral-garden":
    "A balanced coral economy deck with reliable support search and a wide reef creature package.",
  "darkness-shroud":
    "A deep-sea attack deck built around Abyss, hidden creatures, and large late-game predators.",
  "open-ocean-hunt":
    "An oceanic school-density deck that grows bait balls into fast fish, predators, and apex finishers.",
  "murky-water":
    "A reef deck that mixes coral growth, support consistency, and shark pressure.",
  "stinging-fortress":
    "A stinging reef shell with anemones, clownfish, poison pressure, and a compact coral base.",
};

function getCardDisplayName(card, entry) {
  if (!card) return entry.unavailableName ?? entry.cardId;
  return card.bio?.commonName ?? card.name;
}

function getCardLabel(card, entry) {
  const name = getCardDisplayName(card, entry);
  if (!card?.stageLabel && !card?.subtitle) return name;
  return [name, card.subtitle, card.stageLabel].filter(Boolean).join(" - ");
}

function getDeckGroups(deck) {
  const groups = new Map();

  for (const entry of deck.cards) {
    const card = cardsById[entry.cardId];
    const category = card?.category ?? "unavailable";
    const group = groups.get(category) ?? {
      category,
      label: CATEGORY_LABELS[category] ?? "Other",
      count: 0,
      cards: [],
    };

    group.count += Number(entry.quantity ?? 0);
    group.cards.push({ entry, card });
    groups.set(category, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      cards: group.cards.sort((a, b) =>
        getCardLabel(a.card, a.entry).localeCompare(getCardLabel(b.card, b.entry))
      ),
    }))
    .sort((a, b) => {
      const aIndex = CATEGORY_ORDER.indexOf(a.category);
      const bIndex = CATEGORY_ORDER.indexOf(b.category);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
}

function getComposition(deck) {
  const composition = {};

  for (const entry of deck.cards) {
    const card = cardsById[entry.cardId];
    const category = card?.category ?? "unavailable";
    composition[category] = (composition[category] ?? 0) + Number(entry.quantity ?? 0);
  }

  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category] ?? "Other",
    count: composition[category] ?? 0,
  })).filter((item) => item.count > 0);
}

function totalCards(deck) {
  return deck.cards.reduce((sum, entry) => sum + Number(entry.quantity ?? 0), 0);
}

function Bar({ label, value, detail }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-slate-800">{label}</span>
        <span className="text-xs font-semibold text-slate-500">{detail}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-cyan-500"
          style={{ width: `${Math.max(2, value)}%` }}
        />
      </div>
    </div>
  );
}

function DeckAnalyticsPanel({ analytics }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h3 className="text-sm font-bold uppercase text-slate-500">
          Victory Point Share
        </h3>
        <div className="mt-3 space-y-3">
          {analytics.classBars.map((bar) => (
            <Bar
              key={bar.category}
              label={bar.label}
              value={bar.percent}
              detail={`${bar.victoryPoints} VP`}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-bold uppercase text-slate-500">
          Performance Profile
        </h3>
        <div className="mt-3 space-y-3">
          {analytics.traitBars.map((bar) => (
            <Bar
              key={bar.label}
              label={bar.label}
              value={bar.value}
              detail={`${bar.value}%`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function CompositionStrip({ deck }) {
  const composition = getComposition(deck);
  const total = totalCards(deck);

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {composition.map((item) => (
        <div
          key={item.category}
          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
        >
          <span className="text-sm font-semibold text-slate-700">{item.label}</span>
          <span className="text-sm font-bold text-slate-950">
            {item.count}
            <span className="font-semibold text-slate-400">
              {" "}
              / {Math.round((item.count / total) * 100)}%
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function CardRow({ card, entry }) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          {card?.image ? (
            <Image
              src={card.image}
              alt={getCardLabel(card, entry)}
              width={48}
              height={67}
              className="h-14 w-10 rounded border border-slate-200 object-cover"
            />
          ) : (
            <div className="h-14 w-10 rounded border border-dashed border-amber-300 bg-amber-50" />
          )}
          <div>
            <div className="font-bold text-slate-900">
              {getCardLabel(card, entry)}
            </div>
            <div className="mt-0.5 text-xs font-semibold text-slate-500">
              {card
                ? [CATEGORY_LABELS[card.category], card.kind].filter(Boolean).join(" / ")
                : "Add this card to the card database to make it selectable"}
            </div>
          </div>
        </div>
      </td>
      <td className="w-20 px-3 py-3 text-right font-bold text-slate-900">
        x{entry.quantity}
      </td>
    </tr>
  );
}

function DeckList({ deck }) {
  const groups = getDeckGroups(deck);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {groups.map((group) => (
        <section
          key={group.category}
          className="overflow-hidden rounded-lg border border-slate-200 bg-white"
        >
          <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
            <h3 className="font-bold text-slate-900">{group.label}</h3>
            <span className="text-sm font-bold text-slate-500">
              {group.count} cards
            </span>
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              {group.cards.map(({ card, entry }) => (
                <CardRow key={entry.cardId} card={card} entry={entry} />
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

function DeckSection({ deck }) {
  const analytics = getDeckAnalytics(deck.cards);
  const total = totalCards(deck);

  return (
    <section
      id={deck.id}
      className="scroll-mt-8 border-t border-slate-200 py-10 first:border-t-0"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-950">{deck.name}</h2>
          <p className="mt-2 max-w-3xl text-slate-600">
            {DECK_NOTES[deck.id] ?? "A SeaPals prebuilt deck."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/store?deck=${deck.id}`}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#f7c948] px-5 py-2.5 text-sm font-black text-[#073d58] transition hover:-translate-y-0.5 hover:bg-[#ffda68] focus:outline-none focus:ring-4 focus:ring-cyan-200/70"
            >
              Shop this deck
            </Link>
            <Link
              href={`/simulator?deck=${deck.id}`}
              className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-black text-cyan-800 transition hover:-translate-y-0.5 hover:bg-cyan-50 focus:outline-none focus:ring-4 focus:ring-cyan-200/70"
            >
              Try this deck
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-2xl font-bold text-slate-950">{total}</div>
            <div className="text-xs font-semibold uppercase text-slate-500">
              Listed
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-2xl font-bold text-slate-950">
              {analytics.totalVictoryPoints}
            </div>
            <div className="text-xs font-semibold uppercase text-slate-500">
              VP
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-2xl font-bold text-slate-950">
              {analytics.averageRpCost.toFixed(1)}
            </div>
            <div className="text-xs font-semibold uppercase text-slate-500">
              Avg RP
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <CompositionStrip deck={deck} />
        <DeckAnalyticsPanel analytics={analytics} />
        <DeckList deck={deck} />
      </div>
    </section>
  );
}

export default function DecksPage() {
  return (
    <main className="space-y-8 pb-12">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="relative aspect-[6596/1202] min-h-[150px]">
          <Image
            src="/images/promo/decks-promo.png"
            alt="SeaPals prebuilt deck boxes"
            width={6596}
            height={1202}
            priority
            className="h-full w-full object-cover object-center"
          />
        </div>
        <div className="border-t border-slate-200 px-6 py-6 md:px-8">
          <p className="text-sm font-bold uppercase tracking-wide text-cyan-700">
            Prebuilt Deck Guide
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            SeaPals Decks
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Compare each ready-to-play deck, see what is inside, and review the
            same performance profile used for tournament analytics.
          </p>
        </div>
      </section>

      <nav className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {prebuiltDecks.map((deck) => {
          const analytics = getDeckAnalytics(deck.cards);

          return (
            <a
              key={deck.id}
              href={`#${deck.id}`}
              className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-cyan-300 hover:bg-cyan-50"
            >
              <div className="font-bold text-slate-950">{deck.name}</div>
              <div className="mt-2 text-sm font-semibold text-slate-500">
                {totalCards(deck)} cards / {analytics.totalVictoryPoints} VP
              </div>
            </a>
          );
        })}
      </nav>

      <div>
        {prebuiltDecks.map((deck) => (
          <DeckSection key={deck.id} deck={deck} />
        ))}
      </div>
    </main>
  );
}
