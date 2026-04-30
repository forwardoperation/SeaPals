import {
  CardKind,
  CardCategory,
  EffectType,
  Timing,
  Weakness,
  Zone,
} from "./types";

export const conditionCards = [
  {
    id: "red-tide",
    name: "Red Tide",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/cards/conditions/red-tide.png",

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
    image: "/images/cards/conditions/abundant-sunlight.png",

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
    image: "/images/cards/conditions/clear-water.png",

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
    image: "/images/cards/conditions/murky-water.png",

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
    image: "/images/cards/conditions/bleak-overcast.png",

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
    image: "/images/cards/conditions/undertow.png",

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
    image: "/images/cards/conditions/algae-bloom.png",

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

    text: "Players cannot have more than 7 cards in their hands. Additional cards must be discarded.",
  },

  {
    id: "jelly-field",
    name: "Jelly Field",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/cards/conditions/jelly-field.png",

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
    image: "/images/cards/conditions/severe-coral-bleaching.png",

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
    image: "/images/cards/conditions/fishing-nets.png",

    sortOrder: 409,

    tags: ["condition", "harmful"],

    timing: "whileActive",

    effects: [
      {
        type: EffectType.PREVENT_CARD_PLAY,
        affectedPlayers: "all",
        targetKind: CardKind.CREATURE,
        targetCategories: [CardCategory.PREDATOR, CardCategory.APEX],
        duration: "round",
      },
    ],

    text: "Mega and Apex class cannot be played while this card is in play.",
  },

  {
    id: "coral-disease",
    name: "Coral Disease",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/cards/conditions/coral-disease.png",

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
    image: "/images/cards/conditions/hurricane.png",

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
    image: "/images/cards/conditions/sardine-run.png",

    sortOrder: 412,

    tags: ["condition", "persistent", "vp-source"],

    timing: "persistent",

    health: 40,
    victoryPoints: 4,

    effects: [
      {
        type: EffectType.CREATE_ATTACKABLE_VP_CARD,
        controller: "environment",
        health: 40,
        victoryPoints: 4,
        damageToVpRatio: {
          damage: 10,
          victoryPoints: 1,
        },
        targetableBy: {
          kind: CardKind.CREATURE,
          categories: [CardCategory.PREDATOR, CardCategory.APEX],
          requiresActionType: "attack",
        },
        discardWhenHealthReaches: 0,
      },
    ],

    text: "Place this card on the side of the environment deck. For every 10 damage done to this card, gain 1 VP. Any predator or apex with an attack action may target the Sardine Run.",
  },

  {
    id: "krill-ball",
    name: "Krill Ball!",
    kind: CardKind.CONDITION,
    category: CardCategory.CONDITION,
    image: "/images/cards/conditions/krill-ball.png",

    sortOrder: 413,

    tags: ["condition", "persistent", "filter-feeding-event"],

    timing: "persistent",

    effects: [
      {
        type: EffectType.ENABLE_FILTER_FEEDER_PLAY,
        affectedPlayers: "all",
        targetKind: CardKind.CREATURE,
        targetCategories: [CardCategory.FILTER_FEEDER],
        destination: Zone.YOUR_REEF,
        maxPerPlayer: 1,
        consumeWhenUsed: true,
      },
    ],

    text: "Place this card on the side of the environment deck. A Filter Feeder class creature may now be played onto a player’s reef. Each player may only play one filter feeder.",
  },
];