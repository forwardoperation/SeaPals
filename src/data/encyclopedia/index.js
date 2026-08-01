import { allCards } from "@/data/cards";
import { CardKind } from "@/data/cards/types";
import { reefEncyclopediaEntries } from "./reef";
import { deepEncyclopediaEntries } from "./deep";
import { oceanicEncyclopediaEntries } from "./oceanic";
import { encyclopediaCardOwnerOverrides } from "./cardOwnership";

const ZONE_TO_CARD_ZONE = {
  Reef: "reef",
  Oceanic: "ocean",
  Deep: "deep",
};

const CATEGORY_LABELS = {
  apex: "Apex",
  fish: "Fish",
  predator: "Predator",
  invertebrate: "Invertebrate",
  "filter-feeder": "Filter Feeder",
};

export function slugifyCreatureName(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function cardDisplayNames(card) {
  return [
    card.name,
    card.bio?.commonName,
    card.subtitle ? `${card.subtitle} ${card.name}` : null,
    card.subtitle ? `${card.name} ${card.subtitle}` : null,
  ].filter(Boolean);
}

function cardDisplayName(card) {
  return (
    card.bio?.commonName ??
    (card.subtitle ? `${card.subtitle} ${card.name}` : card.name)
  );
}

function hasArtwork(card) {
  return Boolean(card?.image && !card.image.includes("/images/brand/"));
}

const creatureCards = allCards.filter((card) => card.kind === CardKind.CREATURE);

function cardMatchesEntry(card, entry) {
  const entryNames = new Set(
    [entry.name, ...(entry.aliases ?? [])].map(normalizeName).filter(Boolean)
  );

  return cardDisplayNames(card).some((name) =>
    entryNames.has(normalizeName(name))
  );
}

function preferredCardFor(entry, cards) {
  return [...cards].sort((a, b) => {
    const score = (card) =>
      (card.zone === ZONE_TO_CARD_ZONE[entry.zone] ? 8 : 0) +
      (CATEGORY_LABELS[card.category] === entry.group ? 5 : 0) +
      (hasArtwork(card) ? 2 : 0) +
      (card.stage == null ? 1 : 0);

    return score(b) - score(a) || a.sortOrder - b.sortOrder;
  })[0];
}

const rawEntries = [
  ...reefEncyclopediaEntries,
  ...oceanicEncyclopediaEntries,
  ...deepEncyclopediaEntries,
];

const REQUIRED_ENTRY_FIELDS = [
  "name",
  "scientificName",
  "aliases",
  "zone",
  "group",
  "tagline",
  "intro",
  "home",
  "diet",
  "size",
  "superpower",
  "funFacts",
  "lookFor",
  "sourceUrls",
];
const VALID_ZONES = new Set(Object.keys(ZONE_TO_CARD_ZONE));
const VALID_GROUPS = new Set(Object.values(CATEGORY_LABELS));
const VALID_GRAMMATICAL_NUMBERS = new Set(["singular", "plural"]);

for (const entry of rawEntries) {
  const missingFields = REQUIRED_ENTRY_FIELDS.filter(
    (field) => entry[field] == null || entry[field] === ""
  );
  if (missingFields.length > 0) {
    throw new Error(
      `Encyclopedia entry “${entry.name ?? "unknown"}” is missing: ${missingFields.join(", ")}`
    );
  }
  if (!VALID_ZONES.has(entry.zone) || !VALID_GROUPS.has(entry.group)) {
    throw new Error(`Encyclopedia entry “${entry.name}” has an invalid zone or group.`);
  }
  if (
    entry.grammaticalNumber != null &&
    !VALID_GRAMMATICAL_NUMBERS.has(entry.grammaticalNumber)
  ) {
    throw new Error(
      `Encyclopedia entry ${entry.name} has an invalid grammatical number.`
    );
  }
  if (!Array.isArray(entry.aliases)) {
    throw new Error(`Encyclopedia entry “${entry.name}” must provide an aliases array.`);
  }
  if (entry.tagline.trim().split(/\s+/).length > 12) {
    throw new Error(`Encyclopedia entry “${entry.name}” has a tagline over 12 words.`);
  }
  if (!Array.isArray(entry.funFacts) || entry.funFacts.length !== 4) {
    throw new Error(`Encyclopedia entry “${entry.name}” must have exactly four fun facts.`);
  }
  if (new Set(entry.funFacts).size !== entry.funFacts.length) {
    throw new Error(`Encyclopedia entry “${entry.name}” repeats a fun fact.`);
  }
  if (
    !Array.isArray(entry.sourceUrls) ||
    entry.sourceUrls.length === 0 ||
    entry.sourceUrls.length > 3
  ) {
    throw new Error(`Encyclopedia entry “${entry.name}” must cite one to three sources.`);
  }
  for (const sourceUrl of entry.sourceUrls) {
    try {
      const source = new URL(sourceUrl);
      if (source.protocol !== "https:") throw new Error("HTTPS required");
    } catch {
      throw new Error(`Encyclopedia entry “${entry.name}” has an invalid source URL.`);
    }
  }
}

const duplicateSlugs = rawEntries
  .map((entry) => slugifyCreatureName(entry.name))
  .filter((slug, index, slugs) => slugs.indexOf(slug) !== index);

if (duplicateSlugs.length > 0) {
  throw new Error(
    `Duplicate encyclopedia creature slugs: ${[...new Set(duplicateSlugs)].join(", ")}`
  );
}

const rawEntryBySlug = new Map(
  rawEntries.map((entry) => [slugifyCreatureName(entry.name), entry])
);
const creatureCardIds = new Set(creatureCards.map((card) => card.id));

for (const [cardId, ownerSlug] of Object.entries(
  encyclopediaCardOwnerOverrides
)) {
  if (!creatureCardIds.has(cardId)) {
    throw new Error(
      `Encyclopedia card owner override references unknown creature card: ${cardId}`
    );
  }
  if (!rawEntryBySlug.has(ownerSlug)) {
    throw new Error(
      `Encyclopedia card owner override for ${cardId} references unknown profile: ${ownerSlug}`
    );
  }
}

const encyclopediaOwnerSlugByCardId = new Map(
  creatureCards.map((card) => {
    const candidates = rawEntries.filter((entry) => cardMatchesEntry(card, entry));
    const candidateSlugs = candidates.map((entry) =>
      slugifyCreatureName(entry.name)
    );
    const explicitOwner = encyclopediaCardOwnerOverrides[card.id];

    if (explicitOwner) {
      if (!candidateSlugs.includes(explicitOwner)) {
        throw new Error(
          `Encyclopedia card owner override for ${card.id} no longer matches ${explicitOwner}.`
        );
      }
      return [card.id, explicitOwner];
    }

    if (candidateSlugs.length !== 1) {
      const detail = candidateSlugs.length
        ? candidateSlugs.join(", ")
        : "no profiles";
      throw new Error(
        `Creature card ${card.id} needs an explicit encyclopedia owner; matched ${detail}.`
      );
    }

    return [card.id, candidateSlugs[0]];
  })
);

export const encyclopediaCreatures = rawEntries
  .map((entry) => {
    const slug = slugifyCreatureName(entry.name);
    const cards = creatureCards.filter(
      (card) => encyclopediaOwnerSlugByCardId.get(card.id) === slug
    );
    const preferredCard = preferredCardFor(entry, cards);

    if (!preferredCard) {
      throw new Error(
        `Encyclopedia entry “${entry.name}” does not match a SeaPals creature card.`
      );
    }

    return {
      ...entry,
      slug,
      image: preferredCard.image,
      hasArtwork: hasArtwork(preferredCard),
      cardId: preferredCard.id,
      cardIds: cards.map((card) => card.id),
      cardName: cardDisplayName(preferredCard),
      cardCount: cards.length,
      searchText: [
        entry.name,
        entry.scientificName,
        ...(entry.aliases ?? []),
        entry.zone,
        entry.group,
        entry.tagline,
        entry.intro,
        entry.home,
        entry.diet,
        entry.superpower,
        ...(entry.funFacts ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const entriesByCardId = new Map();
for (const creature of encyclopediaCreatures) {
  for (const cardId of creature.cardIds) {
    if (entriesByCardId.has(cardId)) {
      throw new Error(
        `Creature card ${cardId} is owned by multiple encyclopedia profiles.`
      );
    }
    entriesByCardId.set(cardId, creature.slug);
  }
}

export const encyclopediaSlugByCardId = Object.fromEntries(entriesByCardId);

const unmatchedCardIds = creatureCards
  .filter((card) => !entriesByCardId.has(card.id))
  .map((card) => card.id);

if (unmatchedCardIds.length > 0) {
  throw new Error(
    `SeaPals creature cards missing encyclopedia entries: ${unmatchedCardIds.join(", ")}`
  );
}

export const encyclopediaCreatureBySlug = Object.fromEntries(
  encyclopediaCreatures.map((creature) => [creature.slug, creature])
);

export const encyclopediaStats = {
  creatures: encyclopediaCreatures.length,
  zones: new Set(encyclopediaCreatures.map((creature) => creature.zone)).size,
  facts: encyclopediaCreatures.reduce(
    (total, creature) => total + creature.funFacts.length,
    0
  ),
};

export function getEncyclopediaSummaries() {
  return encyclopediaCreatures.map(
    ({
      slug,
      name,
      scientificName,
      aliases,
      zone,
      group,
      tagline,
      image,
      hasArtwork,
      searchText,
    }) => ({
      slug,
      name,
      scientificName,
      aliases,
      zone,
      group,
      tagline,
      image,
      hasArtwork,
      searchText,
    })
  );
}
