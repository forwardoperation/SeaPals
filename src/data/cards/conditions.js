import {
  CardKind,
  CardCategory,
  CreatureZone,
  EffectType,
  Timing,
  Weakness,
} from "./types";

export const conditionCards = [
  {
    id: "red-tide",
    name: "Red Tide",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",

    sortOrder: 400,

    tags: ["condition", "harmful"],

    timing: "startOfRound",

    effects: [
      {
        type: EffectType.PREVENT_CARD_PLAY,
        affectedPlayers: "all",
        targetKind: CardKind.CREATURE,
        targetCategories: [
          CardCategory.FISH,
          CardCategory.PREDATOR,
          CardCategory.APEX,
        ],
        duration: "round",
      },
    ],

    text: "No Fish, Predators, or Apex can be played this round.",
  },

  {
    id: "abundant-sunlight",
    name: "Abundant Sunlight",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",

    sortOrder: 401,

    tags: ["condition", "helpful", "sunlight"],

    timing: "whileActive",

    effects: [
      {
        type: EffectType.MODIFY_RP_BANK_CAP,
        affectedPlayers: "all",
        amount: 2,
        duration: "round",
      },
    ],

    text: "All players’ RP bank cap is increased by +2 while this card is in play.",
  },

  {
    id: "clear-water",
    name: "Clear Water",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",

    sortOrder: 402,

    tags: ["condition", "play-cost"],

    timing: "whileActive",

    effects: [
      {
        type: EffectType.MODIFY_PLAY_COST,
        affectedPlayers: "all",
        targetKind: CardKind.CREATURE,
        targetCategories: [CardCategory.PREDATOR, CardCategory.APEX],
        resource: "rp",
        amount: 1,
        duration: "round",
      },
    ],

    text: "Predator and Apex cost 1 more RP to play.",
  },

  {
    id: "murky-water",
    name: "Murky Water",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",

    sortOrder: 403,

    tags: ["condition", "play-cost"],

    timing: "whileActive",

    effects: [
      {
        type: EffectType.MODIFY_PLAY_COST,
        affectedPlayers: "all",
        targetKind: CardKind.CREATURE,
        targetCategories: [CardCategory.PREDATOR, CardCategory.APEX],
        resource: "rp",
        amount: -1,
        duration: "round",
      },
    ],

    text: "Predator and Apex cost 1 less RP to play.",
  },

  {
    id: "bleak-overcast",
    name: "Bleak Overcast",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",

    sortOrder: 404,

    tags: ["condition", "harmful"],

    timing: "whileActive",

    effects: [
      {
        type: EffectType.MODIFY_RP_BANK_CAP,
        affectedPlayers: "all",
        amount: -2,
        duration: "round",
        enforceImmediately: true,
      },
    ],

    text: "All players’ RP bank cap is decreased by -2 while this card is in play. If you have more RP than the new cap, discard the amount over.",
  },

  {
    id: "undertow",
    name: "Undertow",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",

    sortOrder: 405,

    tags: ["condition", "helpful"],

    timing: Timing.START_OF_TURN,

    effects: [
      {
        type: EffectType.MODIFY_TURN_DRAW,
        affectedPlayers: "all",
        amount: 1,
        duration: "round",
      },
    ],

    text: "At the start of your turn, draw 1 additional card.",
  },

  {
    id: "algae-bloom",
    name: "Algae Bloom",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",

    sortOrder: 406,

    tags: ["condition", "hand-limit"],

    timing: "whileActive",

    effects: [
      {
        type: "setHandLimit",
        affectedPlayers: "all",
        amount: 7,
        duration: "round",
        discardExcess: true,
      },
    ],

    text: "Each player may have no more than 7 cards in hand. Whenever a player has more than 7 cards, that player chooses cards from their entire hand and discards them until 7 remain.",
  },

  {
    id: "jelly-field",
    name: "Jelly Field",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",

    sortOrder: 407,

    tags: ["condition", "harmful"],

    timing: "whileActive",

    effects: [
      {
        type: EffectType.PREVENT_CARD_PLAY,
        affectedPlayers: "all",
        targetKind: CardKind.SUPPORT,
        duration: "round",
      },
    ],

    text: "Support cards cannot be played while this card is in play.",
  },

  {
    id: "severe-coral-bleaching",
    name: "Severe Coral Bleaching",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",

    sortOrder: 408,

    tags: ["condition", "weakness-trigger"],

    timing: "startOfRound",

    effects: [
      {
        type: EffectType.PREVENT_RP_GENERATION,
        affectedPlayers: "all",
        targetKind: CardKind.CORAL,
        targetWeaknesses: [Weakness.HIGH_TEMPERATURE],
        duration: "round",
      },
    ],

    text: "All corals with weakness to high temperature do not generate RP this round.",
  },

  {
    id: "fishing-nets",
    name: "Fishing Nets",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",

    sortOrder: 409,

    tags: ["condition", "harmful"],

    timing: "whileActive",

    effects: [
      {
        type: EffectType.PREVENT_CARD_PLAY,
        affectedPlayers: "all",
        targetKind: CardKind.CREATURE,
        targetCategories: [CardCategory.FILTER_FEEDER, CardCategory.APEX],
        duration: "round",
      },
    ],

    text: "Filter Feeders and Apex creatures cannot be played while this card is in play.",
  },

  {
    id: "coral-disease",
    name: "Coral Disease",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",

    sortOrder: 410,

    tags: ["condition", "weakness-trigger"],

    timing: "startOfRound",

    effects: [
      {
        type: EffectType.PREVENT_RP_GENERATION,
        affectedPlayers: "all",
        targetKind: CardKind.CORAL,
        targetWeaknesses: [Weakness.DISEASE],
        duration: "round",
      },
    ],

    text: "All corals with weakness to disease do not produce RP this round.",
  },

  {
    id: "hurricane",
    name: "Hurricane",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",

    sortOrder: 411,

    tags: ["condition", "weakness-trigger"],

    timing: "startOfRound",

    effects: [
      {
        type: EffectType.PREVENT_RP_GENERATION,
        affectedPlayers: "all",
        targetKind: CardKind.CORAL,
        targetWeaknesses: [Weakness.STORM],
        duration: "round",
      },
    ],

    text: "All corals with weakness to storms do not produce RP this round.",
  },

  {
    id: "sardine-run",
    name: "Sardine Run!",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",

    sortOrder: 412,

    tags: ["condition", "persistent", "school-density-event"],

    timing: "persistent",

    effects: [
      {
        type: EffectType.MODIFY_SCHOOL_DENSITY_REQUIREMENT,
        affectedPlayers: "all",
        targetKind: CardKind.CREATURE,
        targetCategories: [CardCategory.PREDATOR],
        targetZone: CreatureZone.OCEAN,
        amount: -30,
        maxPerPlayer: 1,
        consumeWhenUsed: true,
      },
    ],

    text: "The next Oceanic Predator each player plays costs 30 less School Density. Each player may only gain this reduction once.",
  },

  {
    id: "krill-ball",
    name: "Krill Bloom",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",

    sortOrder: 413,

    tags: ["condition", "persistent", "filter-feeding-event", "school-density-event"],

    timing: "persistent",

    effects: [
      {
        type: EffectType.MODIFY_SCHOOL_DENSITY_REQUIREMENT,
        affectedPlayers: "all",
        targetKind: CardKind.CREATURE,
        targetCategories: [CardCategory.FILTER_FEEDER],
        amount: -150,
        maxPerPlayer: 1,
        consumeWhenUsed: true,
      },
    ],

    text: "The next Filter Feeder each player plays costs 150 less School Density. Each player may only gain this reduction once.",
  },
];
