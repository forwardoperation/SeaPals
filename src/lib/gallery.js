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
  { slug: "environments", title: "Environments", category: "environment" },
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
  "/images/cards/fish/southern-flounder.png",
  "/images/cards/fish/spanish-hogfish.png",
  "/images/cards/fish/spectacled-parrotfish.png",
  "/images/cards/invertebrates/blue-crab.png",
  "/images/cards/invertebrates/emerald-crab.png",
  "/images/cards/predator/reef/moray-eel.png",
  "/images/cards/predator/reef/reef-shark.png",
  "/images/cards/predator/reef/spinner-dolphins.png",
  "/images/cards/predator/oceanic/thresher-shark.png",
  "/images/cards/support/coral-cement.png",
  "/images/cards/support/crab-trap.png",
  "/images/cards/support/deep-sea-fishing-rod.png",
  "/images/cards/support/full-heal.png",
  "/images/cards/support/poison-heal.png",
  "/images/cards/support/remote-search.png",
  "/images/cards/support/Deep/rov-lights.png",
  "/images/cards/apex/Deep/colossal-squid.png",
  "/images/cards/apex/Deep/giant-phantom-jelly.png",
  "/images/cards/apex/Deep/giant-squid.png",
  "/images/cards/apex/Deep/greenland-shark.png",
  "/images/cards/coral/Deep/bamboo-coral-base.png",
  "/images/cards/coral/Deep/bamboo-coral-stage-1.png",
  "/images/cards/coral/Deep/bamboo-coral-stage-2.png",
  "/images/cards/coral/Deep/black-coral-base.png",
  "/images/cards/coral/Deep/black-coral-stage-1.png",
  "/images/cards/coral/Deep/black-coral-stage-2.png",
  "/images/cards/coral/Deep/deep-sea-vent.png",
  "/images/cards/coral/Deep/mushroom-coral-base.png",
  "/images/cards/coral/Deep/mushroom-coral-stage-1.png",
  "/images/cards/coral/Deep/mushroom-coral-stage-2.png",
  "/images/cards/fish/Deep/barrel-eye-fish.png",
  "/images/cards/fish/Deep/black-swallower.png",
  "/images/cards/fish/Deep/bristlemouth.png",
  "/images/cards/fish/Deep/coelacanth.png",
  "/images/cards/fish/Deep/fangtooth-fish.png",
  "/images/cards/fish/Deep/humpback-anglerfish.png",
  "/images/cards/fish/Deep/owlfish.png",
  "/images/cards/fish/Deep/pacific-grenadier.png",
  "/images/cards/fish/Deep/tripod-fish.png",
  "/images/cards/fish/Deep/viperfish.png",
  "/images/cards/invertebrates/Deep/brittlestar.png",
  "/images/cards/invertebrates/Deep/deep-cucumber.png",
  "/images/cards/invertebrates/Deep/deep-sea-jelly.png",
  "/images/cards/invertebrates/Deep/dumbo-octopus.png",
  "/images/cards/invertebrates/Deep/giant-isopod.png",
  "/images/cards/invertebrates/Deep/giant-red-shrimp.png",
  "/images/cards/invertebrates/Deep/giant-tube-worm.png",
  "/images/cards/invertebrates/Deep/peacock-squid.png",
  "/images/cards/invertebrates/Deep/vampire-squid.png",
  "/images/cards/predator/Deep/chimera.png",
  "/images/cards/predator/Deep/cookie-cutter-shark.png",
  "/images/cards/predator/Deep/deep-sea-skate.png",
  "/images/cards/predator/Deep/frilled-shark.png",
  "/images/cards/predator/Deep/goblin-shark.png",
  "/images/cards/predator/Deep/gulper-eel.png",
]);

const IMAGE_PATH_OVERRIDES = {
  "bottlenose-dolphin": "/images/cards/apex/bottlenose-dolpin.png",
  "killer-whales": "/images/cards/apex/killer-whale.png",
  "green-moray-eel": "/images/cards/predator/reef/moray-eel.png",
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
