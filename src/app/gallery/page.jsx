import Image from "next/image";
import Link from "next/link";
import { getGalleryData } from "@/lib/gallery";
import { getGalleryArtProgress } from "@/lib/galleryData.mjs";
import { formatCreatureType } from "@/data/cards/types";
import { encyclopediaSlugByCardId } from "@/data/encyclopedia";

export const metadata = {
  title: "Gallery | SeaRealm TCG",
  description: "Browse SeaRealm cards by zone, class, and category.",
  alternates: { canonical: "/gallery" },
};

function formatLabel(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCost(cost) {
  if (!cost) return null;

  return Object.entries(cost)
    .map(([resource, amount]) => `${amount} ${resource.toUpperCase()}`)
    .join(", ");
}

function formatList(values) {
  if (!values || values.length === 0) return null;
  return values.map(formatLabel).join(", ");
}

function cardDisplayName(card, fallbackName) {
  if (!card) return fallbackName;
  return card.subtitle ? `${card.subtitle} ${card.name}` : card.name;
}

function StatPill({ label, value }) {
  if (value === null || value === undefined || value === "") return null;

  return (
    <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2">
      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-cyan-700">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function MetadataRow({ label, value }) {
  if (!value) return null;

  return (
    <p>
      <span className="font-semibold text-slate-800">{label}:</span> {value}
    </p>
  );
}

function RuleList({ title, items }) {
  const visibleItems = items
    ?.map((item, index) =>
      typeof item === "string"
        ? { id: `${title}-${index}`, text: item }
        : item
    )
    .filter((item) => item?.text || item?.name);

  if (!visibleItems || visibleItems.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
        {title}
      </h4>
      <div className="mt-2 space-y-2">
        {visibleItems.map((item) => (
          <div key={item.id ?? `${title}-${item.name}`} className="text-slate-600">
            {item.name && (
              <p className="font-semibold text-slate-900">{item.name}</p>
            )}
            {item.text && <p className="leading-relaxed">{item.text}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ value }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-cyan-100">
      <div
        className="h-full rounded-full bg-cyan-500 transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function ArtProgress({ categories }) {
  const { categoryStats, totalCards, completedCards, overallPercent } =
    getGalleryArtProgress(categories);

  return (
    <section className="rounded-[2rem] border border-cyan-100 bg-white/85 p-8 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
            Set Art Progress
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            The SeaRealm set is {overallPercent}% illustrated
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600 md:text-lg">
            Progress follows the master set list, with one entry per card and
            stage. Prerelease cards and cards awaiting artwork do not
            count as complete.
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-6 py-5 text-center">
          <p className="text-5xl font-bold text-cyan-700">{overallPercent}%</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            {completedCards} of {totalCards} cards complete
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ProgressBar value={overallPercent} />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {categoryStats.map((category) => (
          <div
            key={category.slug}
            className="rounded-2xl border border-cyan-100 bg-white/90 p-4 shadow-sm"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold text-slate-900">{category.title}</h3>
              <p className="text-sm font-semibold text-cyan-700">
                {category.percent}%
              </p>
            </div>
            <div className="mt-3">
              <ProgressBar value={category.percent} />
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {category.complete} of {category.total} illustrated
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ComingSoonTile({ name }) {
  return (
    <div className="flex aspect-[5/7] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-300 bg-white/80 p-5 text-center shadow-sm transition group-open:border-cyan-400 group-open:bg-cyan-50/70 group-hover:-translate-y-1 group-hover:border-cyan-400 group-hover:bg-cyan-50/80">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700">
        Coming Soon!
      </p>
      <p className="mt-4 text-xl font-bold leading-tight text-slate-900">
        {name}
      </p>
    </div>
  );
}

function SetMetadata({ image }) {
  return (
    <div className="mt-3 space-y-1 text-slate-600">
      <MetadataRow label="Set" value={image.setTitle} />
      <MetadataRow label="Stage" value={image.stageLabel} />
      <MetadataRow
        label="Printings"
        value={image.printings.map(({ number, rarity }) =>
          `${number}/${image.totalPrintings} (${rarity})`
        ).join(", ")}
      />
      {image.prerelease && (
        <p className="font-semibold text-amber-700">Prerelease — artwork in progress</p>
      )}
    </div>
  );
}

function CardMetadata({ image }) {
  const card = image.card;

  if (!card) {
    return (
      <div className="mt-3 rounded-2xl border border-cyan-100 bg-white/90 p-4 text-sm shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">{image.name}</h3>
        <SetMetadata image={image} />
      </div>
    );
  }

  const encyclopediaSlug = encyclopediaSlugByCardId[image.cardId];

  return (
    <div className="mt-3 rounded-2xl border border-cyan-100 bg-white/95 p-4 text-sm shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
          {formatCreatureType(card) || formatLabel(card.category)}
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-900">
          {cardDisplayName(card, image.name)}
        </h3>
        {card.bio?.scientificName && (
          <p className="mt-1 italic text-slate-500">{card.bio.scientificName}</p>
        )}
      </div>

      <SetMetadata image={image} />

      <dl className="mt-4 grid grid-cols-2 gap-2">
        <StatPill label="Cost" value={formatCost(card.cost)} />
        <StatPill label="VP" value={card.victoryPoints} />
        <StatPill label="School Density" value={card.schoolDensity} />
        <StatPill
          label="Defense"
          value={
            typeof card.defense === "string"
              ? card.defense
              : card.defense?.dice
          }
        />
        <StatPill label="Health" value={card.health} />
      </dl>

      <div className="mt-4 space-y-1 text-slate-600">
        <MetadataRow label="Kind" value={formatLabel(card.kind)} />
        <MetadataRow label="Type" value={formatCreatureType(card)} />
        <MetadataRow label="Role" value={card.bio?.role} />
        <MetadataRow label="Species" value={card.bio?.species} />
        <MetadataRow label="Region" value={card.bio?.region} />
        <MetadataRow label="Habitat" value={card.bio?.habitat} />
        <MetadataRow label="Diet" value={card.bio?.diet} />
        <MetadataRow label="Length" value={card.bio?.length} />
        <MetadataRow label="Weight" value={card.bio?.weight} />
        <MetadataRow label="Weaknesses" value={formatList(card.weaknesses)} />
        <MetadataRow label="Tags" value={formatList(card.tags)} />
      </div>

      {card.bonusVictoryPoints?.text && (
        <div className="mt-4 rounded-xl bg-cyan-50 p-3 text-slate-700">
          <p className="font-semibold text-slate-900">Bonus VP</p>
          <p className="mt-1 leading-relaxed">{card.bonusVictoryPoints.text}</p>
        </div>
      )}

      {card.flavorText && (
        <p className="mt-4 border-l-2 border-cyan-200 pl-3 italic leading-relaxed text-slate-500">
          {card.flavorText}
        </p>
      )}

      <div className="mt-4 space-y-4">
        <RuleList title="Play Requirements" items={card.playRequirements} />
        <RuleList title="Maintenance" items={card.maintenance} />
        <RuleList title="Passives" items={card.passives} />
        <RuleList title="On Play" items={card.onPlay} />
        <RuleList title="Actions" items={card.actions} />
        <RuleList title="Special Rules" items={card.specialRules} />
      </div>

      {encyclopediaSlug && (
        <Link
          href={`/encyclopedia/${encyclopediaSlug}`}
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-cyan-700 px-4 py-3 font-bold text-white transition hover:bg-cyan-800 focus:outline-none focus:ring-4 focus:ring-cyan-100"
        >
          Meet the real creature →
        </Link>
      )}
    </div>
  );
}

function TypeSection({ title, slug, images }) {
  if (!images || images.length === 0) return null;

  return (
    <section id={slug} className="scroll-mt-28">
      <div className="mb-6">
        <h3 className="text-3xl font-bold text-slate-900">{title}</h3>
      </div>

      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
        {images.map((image) => (
          <details
            key={image.cardId ?? image.src}
            id={image.cardId ? `card-${image.cardId}` : undefined}
            className="group scroll-mt-28"
          >
            <summary className="list-none cursor-pointer outline-none">
              {image.hasImage ? (
                <div className="transition hover:-translate-y-1">
                  <Image
                    src={image.src}
                    alt={cardDisplayName(image.card, image.name)}
                    width={image.width}
                    height={image.height}
                    loading="lazy"
                    className="h-auto w-full drop-shadow-lg"
                  />
                </div>
              ) : (
                <ComingSoonTile name={cardDisplayName(image.card, image.name)} />
              )}
            </summary>

            <CardMetadata image={image} />
          </details>
        ))}
      </div>
    </section>
  );
}

function ZoneSection({ zone }) {
  return (
    <section id={zone.slug} className="scroll-mt-28 space-y-10">
      <div>
        <h2 className="text-4xl font-bold text-slate-900">{zone.title}</h2>
        {zone.images.length === 0 && (
          <div className="mt-6 rounded-[2rem] border border-dashed border-cyan-200 bg-white/75 p-8 text-slate-600 shadow-sm">
            <p className="text-lg font-semibold text-slate-900">
              No {zone.title.toLowerCase()} cards yet.
            </p>
            <p className="mt-2">
              This set is ready for future SeaRealm cards when the game expands.
            </p>
          </div>
        )}
      </div>

      {zone.groups.map((group) => (
        <TypeSection
          key={group.slug}
          title={group.title}
          slug={group.slug}
          images={group.images}
        />
      ))}
    </section>
  );
}

export default async function GalleryPage() {
  const categories = await getGalleryData();

  return (
    <main className="space-y-12 pb-16">
      <ArtProgress categories={categories} />

      <section className="rounded-[2rem] border border-cyan-100 bg-white/80 p-8 shadow-sm backdrop-blur">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
          SeaRealm Gallery
        </p>

        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Card Gallery
        </h1>

        <p className="mt-4 max-w-3xl text-base text-slate-600 md:text-lg">
          Browse SeaRealm cards by zone, then by card type.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/set-list"
            className="rounded-full bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 focus:outline-none focus:ring-4 focus:ring-cyan-200"
          >
            Rarity set list →
          </Link>
          {categories.map((category) => (
            <a
              key={category.slug}
              href={`#${category.slug}`}
              className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-900 transition hover:bg-cyan-100"
            >
              {category.title}
            </a>
          ))}
        </div>
      </section>

      {categories.map((category) => (
        <ZoneSection
          key={category.slug}
          zone={category}
        />
      ))}
    </main>
  );
}
