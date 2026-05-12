import { allCards } from "@/data/cards";
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
  { slug: "structures", title: "Structures", category: "structure" },
  { slug: "support", title: "Support", category: "support" },
];

const AVAILABLE_IMAGE_PATHS = new Set([
  "/images/cards/apex/bottlenose-dolpin.png",
  "/images/cards/apex/bull-shark.png",
  "/images/cards/apex/great-white.png",
  "/images/cards/apex/hammerhead.png",
  "/images/cards/apex/killer-whale.png",
  "/images/cards/apex/pilot-whale.png",
  "/images/cards/apex/tiger-shark.png",
  "/images/cards/filter-feeders/blue-whale.png",
  "/images/cards/filter-feeders/manta-ray.png",
  "/images/cards/fish/blue-tang.png",
  "/images/cards/fish/cleaner-wrasse.png",
  "/images/cards/fish/french-angelfish.png",
  "/images/cards/fish/picasso-triggerfish.png",
  "/images/cards/fish/spanish-hogfish.png",
  "/images/cards/fish/spectacled-parrotfish.png",
  "/images/cards/invertebrates/blue-crab.png",
  "/images/cards/invertebrates/emerald-crab.png",
  "/images/cards/predator/moray-eel.png",
  "/images/cards/predator/spinner-dolpins.png",
  "/images/cards/predator/thresher-shark.png",
  "/images/cards/support/coral-cement.png",
  "/images/cards/support/deep-sea-fishing-rod.png",
]);

const IMAGE_PATH_OVERRIDES = {
  "bottlenose-dolphin": "/images/cards/apex/bottlenose-dolpin.png",
  "killer-whales": "/images/cards/apex/killer-whale.png",
  "green-moray-eel": "/images/cards/predator/moray-eel.png",
  "spinner-dolphins": "/images/cards/predator/spinner-dolpins.png",
};

function cardZone(card) {
  return card.zone ?? CreatureZone.REEF;
}

function galleryCard(card) {
  const src = IMAGE_PATH_OVERRIDES[card.id] ?? card.image ?? null;
  const hasPngImage = Boolean(
    src?.toLowerCase().endsWith(".png") && AVAILABLE_IMAGE_PATHS.has(src)
  );

  return {
    cardId: card.id,
    name: card.name,
    src,
    hasImage: hasPngImage,
    card,
  };
}

export async function getGalleryData() {
  return ZONE_CONFIG.map((zone) => {
    const zoneCards = allCards.filter((card) => cardZone(card) === zone.zone);
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
