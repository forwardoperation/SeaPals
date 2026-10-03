import { allCards } from "@/data/cards";
import galleryImages from "@/data/gallery-images.json";
import { CreatureZone } from "@/data/cards/types";

const ZONE_CONFIG = [
  { slug: "reef", title: "Reef Set", label: "Reef", zone: CreatureZone.REEF },
  {
    slug: "ocean",
    title: "Ocean Set",
    label: "Ocean",
    zone: CreatureZone.OCEAN,
  },
  { slug: "deep", title: "Deep Set", label: "Deep", zone: CreatureZone.DEEP },
];

const TYPE_CONFIG = [
  { slug: "filter-feeders", title: "Filter Feeders", category: "filter-feeder" },
  { slug: "apex", title: "Apex", category: "apex" },
  { slug: "predator", title: "Predator", category: "predator" },
  { slug: "fish", title: "Fish", category: "fish" },
  { slug: "invertebrates", title: "Invertebrates", category: "invertebrate" },
  { slug: "coral", title: "Coral", category: "coral" },
  { slug: "habitats", title: "Habitats", category: "habitat" },
  { slug: "support", title: "Support", category: "support" },
  { slug: "conditions", title: "Conditions", category: "condition" },
];

const imageByCardId = new Map(
  galleryImages.cards.map((image) => [image.cardId, image])
);
const catalogCardIds = new Set(allCards.map((card) => card.id));

// Figma-only cards are gallery previews; they do not enter the playable catalog.
const galleryOnlyCards = galleryImages.cards
  .filter(
    (image) => image.galleryOnly && !image.hidden && !catalogCardIds.has(image.cardId)
  )
  .map((image, index) => ({
    id: image.cardId,
    name: image.name,
    category: image.category,
    kind: ["coral", "habitat", "support", "condition"].includes(image.category)
      ? image.category
      : "creature",
    zone: image.zone,
    sortOrder: 10000 + index,
    galleryOnly: true,
  }));

function cardZone(card) {
  return card.zone ?? CreatureZone.REEF;
}

function compactRuleList(items) {
  return items?.map((item, index) => {
    if (typeof item === "string") {
      return { id: `rule-${index}`, text: item };
    }

    return {
      id: item.id ?? `rule-${index}`,
      name: item.name,
      text: item.text,
    };
  });
}

function compactCard(card) {
  return {
    bio: card.bio,
    bonusVictoryPoints: card.bonusVictoryPoints?.text
      ? { text: card.bonusVictoryPoints.text }
      : null,
    category: card.category,
    cost: card.cost,
    defense: card.defense,
    destroyedDestination: card.destroyedDestination,
    flavorText: card.flavorText,
    health: card.health,
    kind: card.kind,
    name: card.name,
    actions: compactRuleList(card.actions),
    maintenance: compactRuleList(card.maintenance ? [card.maintenance] : []),
    onPlay: compactRuleList(card.onPlay),
    passives: compactRuleList(card.passives),
    playRequirements: compactRuleList(card.playRequirements),
    prerelease: card.prerelease,
    schoolDensity: card.schoolDensity ?? card.schoolDensityRequirement,
    set: card.set,
    specialRules: compactRuleList(card.specialRules),
    stageLabel: card.stageLabel,
    subtitle: card.subtitle,
    tags: card.tags,
    victoryPoints: card.victoryPoints,
    weaknesses: card.weaknesses,
    zone: card.zone,
  };
}

function galleryCard(card) {
  const image = imageByCardId.get(card.id);
  const src = image?.src ?? null;
  const hasSupportedImage = Boolean(image && !image.hidden);

  return {
    cardId: card.id,
    name: card.name,
    src,
    hasImage: hasSupportedImage,
    prerelease: image?.prerelease ?? card.prerelease,
    width: image?.width ?? 375,
    height: image?.height ?? 525,
    card: card.galleryOnly ? null : compactCard(card),
  };
}

export async function getGalleryData() {
  return ZONE_CONFIG.map((zone) => {
    const zoneCards = [...allCards, ...galleryOnlyCards].filter(
      (card) => !card.galleryHidden && !card.hideFromGallery && cardZone(card) === zone.zone
    );
    const groups = TYPE_CONFIG.map((type) => ({
      slug: `${zone.slug}-${type.slug}`,
      title: `${zone.label} ${type.title}`,
      images: zoneCards
        .filter(
          (card) =>
            card.category === type.category || card.kind === type.category
        )
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(galleryCard),
    })).filter((type) => type.images.length > 0);

    return {
      ...zone,
      images: zoneCards
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(galleryCard),
      groups,
    };
  });
}
