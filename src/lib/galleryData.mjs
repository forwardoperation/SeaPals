const TYPE_CONFIG = [
  { slug: "filter-feeders", title: "Filter Feeders", category: "filter-feeder" },
  { slug: "apex", title: "Apex", category: "apex" },
  { slug: "predator", title: "Predator", category: "predator" },
  { slug: "fish", title: "Fish", category: "fish" },
  { slug: "baitballs", title: "Baitballs", category: "baitball" },
  { slug: "invertebrates", title: "Invertebrates", category: "invertebrate" },
  { slug: "coral", title: "Coral", category: "coral" },
  { slug: "habitats", title: "Habitats", category: "habitat" },
  { slug: "support", title: "Support", category: "support" },
];

function compactRuleList(items) {
  return items?.map((item, index) =>
    typeof item === "string"
      ? { id: `rule-${index}`, text: item }
      : { id: item.id ?? `rule-${index}`, name: item.name, text: item.text }
  );
}

function compactCard(card, entry, set) {
  if (!card) return null;

  return {
    bio: card.bio,
    bonusVictoryPoints: card.bonusVictoryPoints?.text
      ? { text: card.bonusVictoryPoints.text }
      : null,
    category: entry.category,
    cost: card.cost,
    defense: card.defense,
    destroyedDestination: card.destroyedDestination,
    flavorText: card.flavorText,
    health: card.health,
    kind: card.kind,
    name: entry.name,
    actions: compactRuleList(card.actions),
    maintenance: compactRuleList(card.maintenance ? [card.maintenance] : []),
    onPlay: compactRuleList(card.onPlay),
    passives: compactRuleList(card.passives),
    playRequirements: compactRuleList(card.playRequirements),
    schoolDensity: card.schoolDensity ?? card.schoolDensityRequirement,
    specialRules: compactRuleList(card.specialRules),
    stageLabel: entry.stageLabel,
    tags: card.tags,
    victoryPoints: card.victoryPoints,
    weaknesses: card.weaknesses,
    zone: set.zone,
  };
}

// The master list controls membership, names, stages, set, and order. The
// playable catalog contributes optional details, never additional gallery cards.
export function buildGalleryData(masterSetList, imageManifest, catalogCards) {
  const imageByCardId = new Map(imageManifest.cards.map((image) => [image.cardId, image]));
  const catalogById = new Map(catalogCards.map((card) => [card.id, card]));

  return masterSetList.sets.map((set) => {
    const label = set.title.replace(/ Set$/, "");
    const images = set.cards.map((entry) => {
      const image = imageByCardId.get(entry.cardId);
      const hasImage = Boolean(image && !image.hidden);

      return {
        ...entry,
        zone: set.zone,
        setTitle: set.title,
        totalPrintings: set.totalPrintings,
        // A changed PNG gets a different URL, including at browser/CDN caches.
        src: hasImage ? `${image.src}?v=${image.contentHash}` : null,
        hasImage,
        // Status comes from visible Figma labels or the artist's confirmation.
        prerelease: hasImage && image.prerelease === true,
        width: image?.width ?? 375,
        height: image?.height ?? 525,
        card: compactCard(catalogById.get(entry.cardId), entry, set),
      };
    });

    return {
      slug: set.zone,
      zone: set.zone,
      title: set.title,
      label,
      images,
      groups: TYPE_CONFIG.map((type) => ({
        slug: `${set.zone}-${type.slug}`,
        title: `${label} ${type.title}`,
        images: images.filter((image) => image.category === type.category),
      })).filter((group) => group.images.length > 0),
    };
  });
}

export function getGalleryArtProgress(categories) {
  const categoryStats = categories.map((zone) => {
    const total = zone.images.length;
    const complete = zone.images.filter((image) => image.hasImage && !image.prerelease).length;
    return { ...zone, total, complete, percent: total ? Math.round(complete / total * 100) : 0 };
  });
  const totalCards = categoryStats.reduce((sum, zone) => sum + zone.total, 0);
  const completedCards = categoryStats.reduce((sum, zone) => sum + zone.complete, 0);

  return {
    categoryStats,
    totalCards,
    completedCards,
    overallPercent: totalCards ? Math.round(completedCards / totalCards * 100) : 0,
  };
}
