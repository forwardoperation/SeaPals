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
  { slug: "habitats", title: "Habitats", category: "habitat" },
  { slug: "support", title: "Support", category: "support" },
];

const AVAILABLE_IMAGE_PATHS = new Set([
  "/images/cards/apex/Reef/bottlenose-dolpin.png",
  "/images/cards/apex/Reef/bull-shark.png",
  "/images/cards/apex/Reef/great-white.png",
  "/images/cards/apex/Reef/hammerhead.png",
  "/images/cards/apex/Reef/tiger-shark.png",
  "/images/cards/filter-feeders/Oceanic/basking-shark.png",
  "/images/cards/filter-feeders/Oceanic/blue-whale.png",
  "/images/cards/filter-feeders/Oceanic/whale-shark.png",
  "/images/cards/filter-feeders/Reef/manta-ray.png",
  "/images/cards/apex/Oceanic/black-marlin.png",
  "/images/cards/apex/Oceanic/bluefin-tuna.png",
  "/images/cards/apex/Oceanic/killer-whale.png",
  "/images/cards/apex/Oceanic/pilot-whale.png",
  "/images/cards/apex/Oceanic/shortfin-mako.png",
  "/images/cards/apex/Oceanic/sperm-whale.png",
  "/images/cards/apex/Oceanic/swordfish.png",
  "/images/cards/fish/Reef/blue-tang.png",
  "/images/cards/fish/Reef/cleaner-wrasse.png",
  "/images/cards/fish/Reef/Clownfish.png",
  "/images/cards/fish/Reef/fairy-parrotfish.png",
  "/images/cards/fish/Reef/french-angelfish.png",
  "/images/cards/fish/Reef/Lionfish.png",
  "/images/cards/fish/Oceanic/african pompano.png",
  "/images/cards/fish/Oceanic/anchovy-ball-base.png",
  "/images/cards/fish/Oceanic/anchovy-ball-stage-1.png",
  "/images/cards/fish/Oceanic/anchovy-ball-stage-2.png",
  "/images/cards/fish/Oceanic/barracuda.png",
  "/images/cards/fish/Oceanic/bluefin-tuna-juvenile.png",
  "/images/cards/fish/Oceanic/bluefish.png",
  "/images/cards/fish/Oceanic/bonito-tuna.png",
  "/images/cards/fish/Oceanic/crevalle-jack.png",
  "/images/cards/fish/Oceanic/flying-fish.png",
  "/images/cards/fish/Oceanic/frigate-tuna.png",
  "/images/cards/fish/Oceanic/halfbeak.png",
  "/images/cards/fish/Oceanic/herring-ball-base.png",
  "/images/cards/fish/Oceanic/herring-ball-stage-1.png",
  "/images/cards/fish/Oceanic/herring-ball-stage-2.png",
  "/images/cards/fish/Oceanic/king-mackerel.png",
  "/images/cards/fish/Oceanic/krill-bloom-base.png",
  "/images/cards/fish/Oceanic/krill-bloom-stage-1.png",
  "/images/cards/fish/Oceanic/krill-bloom-stage-2.png",
  "/images/cards/fish/Oceanic/lookdown.png",
  "/images/cards/fish/Oceanic/mahi-mahi.png",
  "/images/cards/fish/Oceanic/needlefish.png",
  "/images/cards/fish/Oceanic/ocean-triggerfish.png",
  "/images/cards/fish/Oceanic/pompano.png",
  "/images/cards/fish/Oceanic/remora.png",
  "/images/cards/fish/Oceanic/sardine-ball-base.png",
  "/images/cards/fish/Oceanic/sardine-ball-stage-1.png",
  "/images/cards/fish/Oceanic/sardine-ball-stage-2.png",
  "/images/cards/fish/Oceanic/silverside-ball-base.png",
  "/images/cards/fish/Oceanic/silverside-ball-stage-1.png",
  "/images/cards/fish/Oceanic/silverside-ball-stage-2.png",
  "/images/cards/fish/Oceanic/tripletail.png",
  "/images/cards/fish/Oceanic/yellowtail-amberjack.png",
  "/images/cards/fish/Reef/picasso-triggerfish.png",
  "/images/cards/fish/Reef/southern-flounder.png",
  "/images/cards/fish/Reef/spanish-hogfish.png",
  "/images/cards/fish/Reef/spectacled-parrotfish.png",
  "/images/cards/invertebrates/Reef/blue-crab.png",
  "/images/cards/invertebrates/Reef/anemone.png",
  "/images/cards/invertebrates/Reef/emerald-crab.png",
  "/images/cards/invertebrates/Oceanic/blue-sea-dragon.png",
  "/images/cards/invertebrates/Oceanic/market-squid.png",
  "/images/cards/invertebrates/Oceanic/portugese-man-o-war.png",
  "/images/cards/coral/Reef/brain-coral-base.png",
  "/images/cards/coral/Reef/brain-coral-stage-1.png",
  "/images/cards/coral/Reef/brain-coral-stage-2.png",
  "/images/cards/coral/Reef/staghorn-coral.png",
  "/images/cards/coral/Reef/boulderstar-base.png",
  "/images/cards/coral/Reef/boulderstar-stage-1.png",
  "/images/cards/coral/Reef/bouldersta-stage-2.png",
  "/images/cards/coral/Reef/mustard-coral-base.png",
  "/images/cards/predator/reef/great-barracuda.png",
  "/images/cards/predator/reef/goliath-grouper.png",
  "/images/cards/predator/reef/moray-eel.png",
  "/images/cards/predator/reef/reef-shark.png",
  "/images/cards/predator/reef/spinner-dolphins.png",
  "/images/cards/predator/oceanic/blue-shark.png",
  "/images/cards/predator/oceanic/galapagos-shark.png",
  "/images/cards/predator/oceanic/oceanic-whitetip.png",
  "/images/cards/predator/oceanic/Sailfish.png",
  "/images/cards/predator/oceanic/silky-shark.png",
  "/images/cards/predator/oceanic/thresher-shark.png",
  "/images/cards/predator/oceanic/wahoo.png",
  "/images/cards/predator/oceanic/yellowfin-tuna.png",
  "/images/cards/support/coral-cement.png",
  "/images/cards/support/cast-net.png",
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
  "bottlenose-dolphin": "/images/cards/apex/Reef/bottlenose-dolpin.png",
  "green-moray-eel": "/images/cards/predator/reef/moray-eel.png",
};

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
    flavorText: card.flavorText,
    health: card.health,
    kind: card.kind,
    name: card.name,
    passives: compactRuleList(card.passives),
    playRequirements: compactRuleList(card.playRequirements),
    prerelease: card.prerelease,
    schoolDensity: card.schoolDensity,
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
  const src = IMAGE_PATH_OVERRIDES[card.id] ?? card.image ?? null;
  const hasPngImage = Boolean(
    src?.toLowerCase().endsWith(".png") && AVAILABLE_IMAGE_PATHS.has(src)
  );

  return {
    cardId: card.id,
    name: card.name,
    src,
    hasImage: hasPngImage,
    card: compactCard(card),
  };
}

export async function getGalleryData() {
  return ZONE_CONFIG.map((zone) => {
    const zoneCards = allCards.filter(
      (card) => !card.galleryHidden && cardZone(card) === zone.zone
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
