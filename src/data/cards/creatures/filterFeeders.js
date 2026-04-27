import { CardKind, CardCategory, EffectType, Timing, Zone } from "../types";

const requiresFilterFeedingEvent = {
  id: "requires-filter-feeding-event",
  type: "conditionInPlay",
  cardId: "krill-ball",
  zone: "environment",
  text: "Can only be played if a filter feeding event is in play.",
};

const massivePassive = {
  id: "massive",
  name: "Massive",
  text: "Gain advantage on defensive dice rolls.",
  timing: Timing.PASSIVE,
  effect: {
    type: EffectType.GRANT_DEFENSE_ADVANTAGE,
    target: {
      controller: "you",
      source: "self",
    },
    duration: "whileInPlay",
  },
};

export const filterFeederCards = [
  {
    id: "manta-ray",
    name: "Manta Ray",
    kind: CardKind.CREATURE,
    category: CardCategory.FILTER_FEEDER,
    image: "/images/cards/filter-feeders/manta-ray.png",
    sortOrder: 400,

    cost: { rp: 8 },
    victoryPoints: 10,
    tags: ["creature", "filter-feeder", "ray"],

    bio: {
      commonName: "Manta Ray",
      role: "Filter Feeder",
      region: "Worldwide",
      length: "22’",
      weight: "1.5 tons",
    },

    playRequirements: [requiresFilterFeedingEvent],
    passives: [],
    onPlay: [],
    actions: [],
    defense: { dice: "D10" },

    flavorText:
      "Manta rays glide on giant wings, funneling plankton with unfurling head fins.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "blue-whale",
    name: "Blue Whale",
    kind: CardKind.CREATURE,
    category: CardCategory.FILTER_FEEDER,
    image: "/images/cards/filter-feeders/blue-whale.png",
    sortOrder: 401,

    cost: { rp: 14 },
    victoryPoints: 16,
    tags: ["creature", "filter-feeder", "whale"],

    bio: {
      commonName: "Blue Whale",
      role: "Filter Feeder",
      region: "Worldwide",
      length: "100’",
      weight: "200 tons",
    },

    playRequirements: [requiresFilterFeedingEvent],
    passives: [massivePassive],
    onPlay: [],
    actions: [],
    defense: { dice: "D20" },

    flavorText:
      "The blue whale is the largest animal ever known to live on Earth.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "humpback-whale",
    name: "Humpback Whale",
    kind: CardKind.CREATURE,
    category: CardCategory.FILTER_FEEDER,
    image: "/images/cards/filter-feeders/humpback-whale.png",
    sortOrder: 402,

    cost: { rp: 10 },
    victoryPoints: 12,
    tags: ["creature", "filter-feeder", "whale"],

    bio: {
      commonName: "Humpback Whale",
      role: "Filter Feeder",
      region: "Worldwide",
      length: "8’",
      weight: "40 tons",
    },

    playRequirements: [requiresFilterFeedingEvent],
    passives: [massivePassive],
    onPlay: [],
    actions: [],
    defense: { dice: "D20" },

    flavorText:
      "Humpback whales sing long, evolving songs that can travel for miles.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "whale-shark",
    name: "Whale Shark",
    kind: CardKind.CREATURE,
    category: CardCategory.FILTER_FEEDER,
    image: "/images/cards/filter-feeders/whale-shark.png",
    sortOrder: 403,

    cost: { rp: 9 },
    victoryPoints: 9,
    tags: ["creature", "filter-feeder", "shark"],

    bio: {
      commonName: "Whale Shark",
      role: "Filter Feeder",
      region: "Worldwide",
      length: "40’",
      weight: "12.5 tons",
    },

    playRequirements: [requiresFilterFeedingEvent],
    passives: [],
    onPlay: [],
    actions: [],
    defense: { dice: "D20" },

    flavorText:
      "Whale sharks are gentle giants—the largest fish on Earth.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "ocean-sunfish",
    name: "Ocean Sunfish",
    kind: CardKind.CREATURE,
    category: CardCategory.FILTER_FEEDER,
    image: "/images/cards/filter-feeders/ocean-sunfish.png",
    sortOrder: 404,

    cost: { rp: 8 },
    victoryPoints: 8,
    tags: ["creature", "filter-feeder", "sunfish"],

    bio: {
      commonName: "Ocean Sunfish",
      role: "Filter Feeder",
      region: "Worldwide",
      length: "8’ 6”",
      weight: "1 ton",
    },

    playRequirements: [requiresFilterFeedingEvent],
    passives: [],
    onPlay: [],
    actions: [],
    defense: { dice: "D8" },

    flavorText:
      "The world’s heaviest bony fish, it drifts like a giant sideways plate.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },
];