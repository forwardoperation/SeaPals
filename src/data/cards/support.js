import {
  CardKind,
  CardCategory,
  CreatureZone,
  EffectType,
  Timing,
  Zone,
  GamePhase,
  Duration,
} from "./types";

const standardSupportRules = {
  category: CardCategory.SUPPORT,
  timing: Timing.ACTION_PHASE,
  playRestrictions: [
    {
      type: "phaseOnly",
      phase: GamePhase.MAIN,
      text: "This card can only be played in the main phase of play.",
    },
  ],
};

export const supportCards = [
  {
    id: "spearfishing",
    name: "Spearfishing",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",
    sortOrder: 500,

    text: "Discard one fish or predator in play on your reef and collect its RP cost. You cannot play another Support card this turn.",
    locksFurtherSupportsThisTurn: true,

    effects: [
      {
        type: EffectType.MOVE_CARD,
        from: Zone.YOUR_REEF,
        to: Zone.DISCARD,
        target: {
          controller: "you",
          kind: CardKind.CREATURE,
          categories: [CardCategory.FISH, CardCategory.PREDATOR],
        },
        then: {
          type: EffectType.GAIN_RESOURCE,
          resource: "rp",
          amountSource: "cardCost",
        },
      },
    ],
  },

  {
    id: "coral-gardener",
    name: "Coral Gardener",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",
    sortOrder: 501,

    text: "Search your deck for a coral and place it into your hand. You cannot play another Support card this turn.",
    locksFurtherSupportsThisTurn: true,

    effects: [
      {
        type: EffectType.SEARCH_DECK,
        targetKind: CardKind.CORAL,
        amount: 1,
        destination: Zone.HAND,
        shuffleAfterwards: true,
      },
    ],
  },

  {
    id: "coral-heal",
    name: "Coral Heal",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/cards/support/full-heal.png",
    sortOrder: 502,

    text: "Choose one of your corals, remove all effects from it.",

    effects: [
      {
        type: "removeStatusEffects",
        removeAll: true,
        target: {
          controller: "you",
          kind: CardKind.CORAL,
          zone: Zone.YOUR_REEF,
        },
      },
    ],
  },

  {
    id: "capt-dani",
    name: "Capt. Dani",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",
    sortOrder: 503,

    text: "Search your deck for a Filter Feeder creature and place it into your hand. Shuffle your deck afterwards. You cannot play another Support card this turn.",
    locksFurtherSupportsThisTurn: true,

    effects: [
      {
        type: EffectType.SEARCH_DECK,
        targetKind: CardKind.CREATURE,
        targetCategories: [CardCategory.FILTER_FEEDER],
        amount: 1,
        destination: Zone.HAND,
        shuffleAfterwards: true,
      },
    ],
  },

  {
    id: "dr-evans",
    name: "Dr. Evans",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",
    sortOrder: 504,

    text: "Discard your hand and draw 7 cards. You cannot play another Support card this turn.",
    locksFurtherSupportsThisTurn: true,

    effects: [
      {
        type: EffectType.MOVE_CARD,
        from: Zone.HAND,
        to: Zone.DISCARD,
        target: {
          controller: "you",
          all: true,
        },
      },
      {
        type: EffectType.DRAW_CARDS,
        amount: 7,
      },
    ],
  },

  {
    id: "scientist-jes",
    name: "Scientist Jes",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",
    sortOrder: 505,

    text: "Search your deck for a habitat card and place it into your hand, then shuffle. OR draw 2 cards. You cannot play another Support card this turn.",
    locksFurtherSupportsThisTurn: true,

    effects: [
      {
        type: EffectType.SEARCH_DECK,
        targetKind: CardKind.HABITAT,
        amount: 1,
        destination: Zone.HAND,
        shuffleAfterwards: true,
      },
      {
        type: EffectType.DRAW_CARDS,
        amount: 2,
      },
    ],
  },

  {
    id: "whirlpool",
    name: "Whirlpool",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",
    sortOrder: 506,

    text: "Choose one of your opponent’s corals. That coral produces 1 RP less next round.",

    effects: [
      {
        type: EffectType.MODIFY_RP_GENERATION,
        amount: -1,
        duration: Duration.NEXT_ROUND,
        target: {
          controller: "opponent",
          kind: CardKind.CORAL,
          zone: Zone.OPPONENT_REEF,
        },
      },
    ],
  },

  {
    id: "super-whirlpool",
    name: "Super Whirlpool",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",
    sortOrder: 507,

    text: "Spend 1 RP to play this card. Choose one of your opponent’s corals. That coral produces 2 RP less next round. You cannot play another Support card this turn.",
    locksFurtherSupportsThisTurn: true,

    cost: { rp: 1 },

    effects: [
      {
        type: EffectType.MODIFY_RP_GENERATION,
        amount: -2,
        duration: Duration.NEXT_ROUND,
        target: {
          controller: "opponent",
          kind: CardKind.CORAL,
          zone: Zone.OPPONENT_REEF,
        },
      },
    ],
  },

  {
    id: "restocking",
    name: "Restocking",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",
    sortOrder: 508,

    text: "Choose up to three fish in your discard pile and shuffle them into your deck. You cannot play another Support card this turn.",
    locksFurtherSupportsThisTurn: true,

    effects: [
      {
        type: EffectType.RECOVER_CARD_FROM_DISCARD,
        targetKind: CardKind.CREATURE,
        targetCategories: [CardCategory.FISH],
        amount: 3,
        destination: Zone.DECK,
        routeByPersonalDeck: true,
        shuffleAfterwards: true,
      },
    ],
  },

  {
    id: "robotic-survey",
    name: "Robotic Survey",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",
    sortOrder: 509,

    text: "Look at the top 5 cards of your deck and rearrange them in any way you see fit. You cannot play another Support card this turn.",
    locksFurtherSupportsThisTurn: true,

    effects: [
      {
        type: "peekAndReorderDeck",
        amount: 5,
      },
    ],
  },

  {
    id: "deep-sea-fishing",
    name: "Deep Sea Fishing",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/cards/support/deep-sea-fishing-rod.png",
    sortOrder: 510,

    text: "Search your deck for a predator or apex, show it to your opponent, and place it into your hand. Shuffle your deck afterwards.",

    effects: [
      {
        type: EffectType.SEARCH_DECK,
        targetKind: CardKind.CREATURE,
        targetCategories: [CardCategory.PREDATOR, CardCategory.APEX],
        amount: 1,
        destination: Zone.HAND,
        revealToOpponent: true,
        shuffleAfterwards: true,
      },
    ],
  },

  {
    id: "explorer-jordan",
    name: "Explorer Jordan",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",
    sortOrder: 511,

    text: "Look at the top 5 cards of your deck. You may reveal a creature of any class from among them, show it to your opponent, and add it to your hand. Shuffle the rest.",

    effects: [
      {
        type: "chooseFromTopDeck",
        amount: 5,
        choose: 1,
        revealToOpponent: true,
        targetKind: CardKind.CREATURE,
        destination: Zone.HAND,
        shuffleRemaining: true,
      },
    ],
  },

  {
    id: "coral-cement",
    name: "Coral Cement",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/cards/support/coral-cement.png",
    sortOrder: 512,

    text: "Heal 20 HP on one of your corals.",

    effects: [
      {
        type: EffectType.MODIFY_HEALTH,
        amount: 20,
        target: {
          controller: "you",
          kind: CardKind.CORAL,
          zone: Zone.YOUR_REEF,
        },
      },
    ],
  },

  {
    id: "remote-search",
    name: "Remote Search",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/cards/support/remote-search.png",
    sortOrder: 513,

    text: "Search your deck for a support card, show it to your opponent, and place it into your hand. Shuffle your deck afterwards.",

    effects: [
      {
        type: EffectType.SEARCH_DECK,
        targetKind: CardKind.SUPPORT,
        amount: 1,
        destination: Zone.HAND,
        revealToOpponent: true,
        shuffleAfterwards: true,
      },
    ],
  },

  {
    id: "poison-heal",
    name: "Poison Heal",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/cards/support/poison-heal.png",
    sortOrder: 514,

    text: "On your next attack, ignore any effects from Toxic.",

    effects: [
      {
        type: EffectType.GRANT_CONDITION,
        condition: "poisonImmunity",
        duration: Duration.NEXT_ATTACK,
        target: {
          controller: "you",
          kind: CardKind.CREATURE,
        },
      },
    ],
  },

  {
    id: "fishing",
    name: "Fishing",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",
    sortOrder: 515,

    text: "Search your deck for a non-Creature School fish, show it to your opponent, and place it into your hand.",

    effects: [
      {
        type: EffectType.SEARCH_DECK,
        targetKind: CardKind.CREATURE,
        targetCategories: [CardCategory.FISH],
        excludeTags: ["creature-school"],
        amount: 1,
        destination: Zone.HAND,
        revealToOpponent: true,
        shuffleAfterwards: true,
      },
    ],
  },

  {
    id: "cast-net",
    name: "Cast Net",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/cards/support/cast-net.png",
    sortOrder: 516,

    text: "Search your deck for a Creature School, show it to your opponent, and place it into your hand.",

    effects: [
      {
        type: EffectType.SEARCH_DECK,
        targetKind: CardKind.CREATURE,
        targetCategories: [CardCategory.FISH],
        targetTags: ["creature-school"],
        amount: 1,
        destination: Zone.HAND,
        revealToOpponent: true,
        shuffleAfterwards: true,
      },
    ],
  },

  {
    id: "crab-trap",
    name: "Crab Trap",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/cards/support/crab-trap.png",
    sortOrder: 517,

    text: "Search your deck for up to two invertebrates, show them to your opponent, and place them into your hand.",

    effects: [
      {
        type: EffectType.SEARCH_DECK,
        targetKind: CardKind.CREATURE,
        targetCategories: [CardCategory.INVERTEBRATE],
        amount: 2,
        destination: Zone.HAND,
        revealToOpponent: true,
        shuffleAfterwards: true,
      },
    ],
  },

  {
    id: "recovery",
    name: "Recovery",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/brand/SeaPalsTCGLogoWhite.svg",
    sortOrder: 518,

    text: "Flip a coin. If heads, put a discarded card into your hand.",

    effects: [
      {
        type: EffectType.FLIP_COIN,
        successResult: "heads",
        onSuccess: {
          type: EffectType.RECOVER_CARD_FROM_DISCARD,
          amount: 1,
          destination: Zone.HAND,
        },
      },
    ],
  },

  {
    id: "rov-lights",
    name: "ROV Lights",
    kind: CardKind.SUPPORT,
    ...standardSupportRules,
    image: "/images/cards/support/Deep/rov-lights.png",
    sortOrder: 519,

    text: "Your attacks get +2 when targeting Deep creatures this turn.",

    effects: [
      {
        type: "modifyAttackRoll",
        amount: 2,
        duration: Duration.THIS_TURN,
        target: {
          controller: "opponent",
          kind: CardKind.CREATURE,
          zone: CreatureZone.DEEP,
        },
      },
    ],
  },
];
