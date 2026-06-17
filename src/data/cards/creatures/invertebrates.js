import { CardKind, CardCategory, EffectType, Timing, Zone } from "../types";

const requiresAnyhabitat = {
  id: "requires-habitat",
  type: "kindInPlay",
  requiredKind: CardKind.HABITAT,
  zone: Zone.YOUR_REEF,
  text: "Can only be played if a habitat card is in play on your reef.",
};

const requiresShipWreck = {
  id: "requires-ship-wreck",
  type: "cardInPlay",
  cardId: "ship-wreck",
  requiredKind: CardKind.HABITAT,
  zone: Zone.YOUR_REEF,
  text: "Can only be played if a Ship Wreck habitat card is in play on your reef.",
};

const toxicPassive = {
  id: "toxic",
  name: "Toxic",
  text: "If eaten, your opponent flips a coin. If tails, they discard the consuming card.",
  timing: "whenEaten",
  effect: {
    type: "toxicWhenEaten",
    coinFlip: {
      failResult: "tails",
      effect: {
        type: "discardConsumingCreature",
      },
    },
  },
};

const ecoBoost = (amount) => ({
  id: "eco-boost",
  name: "Eco Boost",
  text: `Add +${amount} to your max resource bank while this card is in play.`,
  timing: Timing.PASSIVE,
  effect: {
    type: EffectType.MODIFY_RP_BANK_CAP,
    controller: "you",
    amount,
    duration: "whileInPlay",
  },
});

const attackEffect = ({ dice, categories, repeat = 1 }) => ({
  type: EffectType.ATTACK,
  attackDice: dice,
  repeat,
  target: {
    controller: "opponent",
    kind: CardKind.CREATURE,
    categories,
    zone: Zone.OPPONENT_REEF,
  },
});

export const invertebrateCards = [
  {
    id: "sea-urchin",
    name: "Sea Urchin",
    kind: CardKind.CREATURE,
    category: CardCategory.INVERTEBRATE,
    image: "/images/cards/invertebrates/sea-urchin.png",
    sortOrder: 300,

    cost: { rp: 1 },
    victoryPoints: 1,
    tags: ["creature", "invertebrate", "urchin"],

    bio: {
      commonName: "Sea Urchin",
      role: "Invertebrate",
      region: "Caribbean",
      length: "4”",
      weight: "1.2 lbs",
    },

    playRequirements: [],

    passives: [
      {
        id: "spines",
        name: "Spines",
        text: "Add +20 HP to any coral attached to. This effect cannot be duplicated with multiple attached sea urchins to one coral.",
        timing: Timing.PASSIVE,
        effect: {
          type: "modifyHealth",
          target: {
            controller: "you",
            kind: CardKind.CORAL,
            relationship: "attachedHost",
          },
          amount: 20,
          stacking: "uniquePerHost",
        },
      },
    ],

    onPlay: [],
    actions: [],
    defense: { dice: "D6" },
    flavorText: "A spiny ball that grazes algae and keeps the reef tidy.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "anemone",
    name: "Anemone",
    kind: CardKind.CREATURE,
    category: CardCategory.INVERTEBRATE,
    image: "/images/cards/invertebrates/Reef/anemone.png",
    sortOrder: 301,

    cost: { rp: 4 },
    victoryPoints: 2,
    tags: ["creature", "invertebrate", "anemone", "host"],

    bio: {
      commonName: "Anemone",
      role: "Invertebrate",
      region: "Pacific",
      length: "5”",
      weight: "8 lbs",
    },

    playRequirements: [],

    clownSlots: 2,

    passives: [
      {
        id: "stinging-fortress",
        name: "Stinging Fortress",
        text: "Adds 1D4 of defensive protection to any clownfish inside the anemone.",
        timing: Timing.PASSIVE,
        effect: {
          type: "modifyDefenseRoll",
          target: {
            controller: "you",
            kind: CardKind.CREATURE,
            tags: ["clownfish"],
            relationship: "hostedByThisCard",
          },
          amount: {
            type: "dice",
            dice: "D4",
          },
        },
      },
    ],

    onPlay: [
      {
        id: "symbiosis",
        name: "Symbiosis",
        text: "Attach to one of your corals in play. Search your hand for a Clownfish and attach it to this anemone.",
        effects: [
          {
            type: EffectType.ATTACH_TO_CARD,
            from: Zone.HAND,
            target: {
              controller: "you",
              kind: CardKind.CORAL,
              zone: Zone.YOUR_REEF,
            },
          },
          {
            type: "attachCardFromHand",
            targetCardTags: ["clownfish"],
            destination: "thisCard",
            optional: true,
          },
        ],
      },
    ],

    actions: [],
    defense: { dice: "D8" },
    flavorText: "Sea anemones anchor to rock and host stinging tentacles.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "emerald-crab",
    name: "Emerald Crab",
    kind: CardKind.CREATURE,
    category: CardCategory.INVERTEBRATE,
    image: "/images/cards/invertebrates/Reef/emerald-crab.png",
    sortOrder: 302,

    cost: { rp: 1 },
    victoryPoints: 1,
    tags: ["creature", "invertebrate", "crab"],

    bio: {
      commonName: "Emerald Crab",
      role: "Invertebrate",
      region: "Caribbean",
      length: "1.5”",
      weight: "30 g",
    },

    playRequirements: [],
    passives: [ecoBoost(1)],

    onPlay: [],

    actions: [
      {
        id: "scavenge",
        name: "Scavenge",
        text: "Draw 2 cards. You may only perform this once per turn.",
        cost: { rp: 2 },
        timing: Timing.ACTION_PHASE,
        oncePerTurn: true,
        effect: {
          type: EffectType.DRAW_CARDS,
          amount: 2,
        },
      },
    ],

    defense: { dice: "D4" },
    flavorText: "Emerald crabs prowl at night, picking algae and leftovers.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "blue-crab",
    name: "Blue Crab",
    kind: CardKind.CREATURE,
    category: CardCategory.INVERTEBRATE,
    image: "/images/cards/invertebrates/Reef/blue-crab.png",
    sortOrder: 303,

    cost: { rp: 2 },
    victoryPoints: 1,
    tags: ["creature", "invertebrate", "crab"],

    bio: {
      commonName: "Blue Crab",
      role: "Invertebrate",
      region: "Caribbean",
      length: "7”",
      weight: "0.7 lbs",
    },

    playRequirements: [],

    passives: [
      ecoBoost(1),
      {
        id: "recycle",
        name: "Recycle",
        text: "Whenever one of your fish is eaten, collect one half of the cost of that fish in RP rounded up. Cannot be repeated in a turn if multiple Blue Crabs are in play.",
        timing: "whenYourFishIsEaten",
        effect: {
          type: EffectType.RECYCLE_ON_EATEN,
          targetKind: CardKind.CREATURE,
          targetCategories: [CardCategory.FISH],
          resource: "rp",
          amount: {
            type: "halfCostRoundedUp",
            resource: "rp",
          },
          stacking: "oncePerTurnAcrossCopies",
        },
      },
    ],

    onPlay: [],

    actions: [
      {
        id: "scavenge",
        name: "Scavenge",
        text: "Choose a card from your discard and put it into your hand.",
        cost: { rp: 2 },
        timing: Timing.ACTION_PHASE,
        effect: {
          type: "recoverCardFromDiscard",
          controller: "you",
          destination: Zone.HAND,
          amount: 1,
        },
      },
    ],

    defense: { dice: "D4" },
    flavorText: "Blue crabs are fast swimmers with paddle-shaped back legs.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "arrow-crab",
    name: "Arrow Crab",
    kind: CardKind.CREATURE,
    category: CardCategory.INVERTEBRATE,
    image: "/images/cards/invertebrates/arrow-crab.png",
    sortOrder: 304,

    cost: { rp: 1 },
    victoryPoints: 1,
    tags: ["creature", "invertebrate", "crab"],

    bio: {
      commonName: "Arrow Crab",
      role: "Invertebrate",
      region: "Caribbean",
      length: "3.5”",
      weight: "1 g",
    },

    playRequirements: [],

    passives: [ecoBoost(1)],

    onPlay: [],

    actions: [
      {
        id: "scavenge",
        name: "Scavenge",
        text: "Discard two cards from your hand, then search your deck for a card, show it to your opponent, and place it in your hand.",
        cost: { rp: 2 },
        timing: Timing.ACTION_PHASE,
        effect: {
          type: "discardThenSearchDeck",
          discard: {
            from: Zone.HAND,
            amount: 2,
          },
          search: {
            amount: 1,
            destination: Zone.HAND,
            revealToOpponent: true,
            shuffleAfterwards: true,
          },
        },
      },
    ],

    defense: { dice: "D4" },
    flavorText: "Arrow crabs tiptoe on stilt-like legs.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "mantis-shrimp",
    name: "Mantis Shrimp",
    kind: CardKind.CREATURE,
    category: CardCategory.INVERTEBRATE,
    image: "/images/cards/invertebrates/mantis-shrimp.png",
    sortOrder: 305,

    cost: { rp: 3 },
    victoryPoints: 2,
    tags: ["creature", "invertebrate", "shrimp"],

    bio: {
      commonName: "Mantis Shrimp",
      role: "Invertebrate",
      region: "Caribbean",
      length: "2”",
      weight: "1.2 lbs",
    },

    playRequirements: [],
    passives: [],

    onPlay: [],

    actions: [
      {
        id: "shatter",
        name: "Shatter",
        text: "Perform a 1D6 attack on an opponent’s invertebrate. This attack cannot be performed on your next turn.",
        cost: { rp: 2 },
        timing: Timing.ACTION_PHASE,
        effect: attackEffect({
          dice: "D6",
          categories: [CardCategory.INVERTEBRATE],
        }),
        cooldown: {
          duration: "yourNextTurn",
        },
      },
    ],

    defense: { dice: "D6" },
    flavorText: "Mantis shrimp strike with club or spear arms so fast they create cavitation bubbles.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "leather-starfish",
    name: "Leather Starfish",
    kind: CardKind.CREATURE,
    category: CardCategory.INVERTEBRATE,
    image: "/images/cards/invertebrates/leather-starfish.png",
    sortOrder: 306,

    cost: { rp: 1 },
    victoryPoints: 1,
    tags: ["creature", "invertebrate", "starfish"],

    bio: {
      commonName: "Leather Starfish",
      role: "Invertebrate",
      region: "Caribbean",
      length: "3”",
      weight: "2 lbs",
    },

    playRequirements: [],
    passives: [],

    onPlay: [],

    actions: [
      {
        id: "slow-eat",
        name: "Slow Eat",
        text: "Perform a 1D4 attack on an opponent’s sea urchin or anemone.",
        cost: { rp: 1 },
        timing: Timing.ACTION_PHASE,
        effect: attackEffect({
          dice: "D4",
          categories: [CardCategory.INVERTEBRATE],
        }),
        targetTags: ["sea-urchin", "anemone"],
      },
    ],

    defense: { dice: "D4" },
    flavorText: "Leather starfish wear smooth, rubbery skin instead of spines.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "cleaner-shrimp",
    name: "Cleaner Shrimp",
    kind: CardKind.CREATURE,
    category: CardCategory.INVERTEBRATE,
    image: "/images/cards/invertebrates/cleaner-shrimp.png",
    sortOrder: 307,

    cost: { rp: 1 },
    victoryPoints: 1,
    tags: ["creature", "invertebrate", "shrimp", "cleaner"],

    bio: {
      commonName: "Cleaner Shrimp",
      role: "Invertebrate",
      region: "Caribbean",
      length: "2.5”",
      weight: "3 g",
    },

    playRequirements: [],

    passives: [ecoBoost(1)],

    onPlay: [],

    actions: [
      {
        id: "parasite-clean",
        name: "Parasite Clean",
        text: "Add 1D4 to any defensive dice rolls for one of your fish or predators until your next turn.",
        cost: { rp: 1 },
        timing: Timing.ACTION_PHASE,
        target: {
          controller: "you",
          kind: CardKind.CREATURE,
          categories: [CardCategory.FISH, CardCategory.PREDATOR],
          zone: Zone.YOUR_REEF,
        },
        effect: {
          type: "modifyDefenseRoll",
          amount: {
            type: "dice",
            dice: "D4",
          },
          duration: "untilYourNextTurn",
        },
      },
    ],

    defense: { dice: "D4" },
    flavorText: "Cleaner shrimp set up stations where larger fish wait for a cleanup.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "crown-of-thorns",
    name: "Crown of Thorns",
    kind: CardKind.CREATURE,
    category: CardCategory.INVERTEBRATE,
    image: "/images/cards/invertebrates/crown-of-thorns.png",
    sortOrder: 308,

    cost: { rp: 2 },
    victoryPoints: 1,
    tags: ["creature", "invertebrate", "starfish", "toxic"],

    bio: {
      commonName: "Crown of Thorns",
      role: "Invertebrate",
      region: "Australia",
      length: "3’",
      weight: "11 lbs",
    },

    playRequirements: [],

    passives: [toxicPassive],

    onPlay: [],

    actions: [
      {
        id: "stun",
        name: "Stun",
        text: "Flip a coin. If heads, choose one of your opponent’s corals and it is now stunned.",
        cost: { rp: 1 },
        timing: Timing.ACTION_PHASE,
        effect: {
          type: EffectType.FLIP_COIN,
          successResult: "heads",
          onSuccess: {
            type: EffectType.STUN_CORAL,
            target: {
              controller: "opponent",
              kind: CardKind.CORAL,
              zone: Zone.OPPONENT_REEF,
            },
          },
        },
      },
      {
        id: "venom-spines",
        name: "Venom Spines",
        text: "Flip a coin. If heads, inflict 10 HP damage on an opponent’s coral.",
        cost: { rp: 1 },
        timing: Timing.ACTION_PHASE,
        effect: {
          type: EffectType.FLIP_COIN,
          successResult: "heads",
          onSuccess: {
            type: EffectType.DAMAGE,
            target: {
              controller: "opponent",
              kind: CardKind.CORAL,
              zone: Zone.OPPONENT_REEF,
            },
            amount: { type: "fixed", value: 10 },
          },
        },
      },
    ],

    defense: { dice: "D4" },
    flavorText: "Crown-of-thorns starfish crawl over corals at night.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "nudibranch",
    name: "Nudibranch",
    kind: CardKind.CREATURE,
    category: CardCategory.INVERTEBRATE,
    image: "/images/cards/invertebrates/nudibranch.png",
    sortOrder: 309,

    cost: { rp: 1 },
    victoryPoints: 1,
    tags: ["creature", "invertebrate", "nudibranch"],

    bio: {
      commonName: "Nudibranch",
      role: "Invertebrate",
      region: "Caribbean",
      length: "3”",
      weight: "80 g",
    },

    playRequirements: [],
    passives: [],

    onPlay: [],

    actions: [
      {
        id: "munch",
        name: "Munch",
        text: "Flip a coin. If heads, choose one of your opponent’s corals. That coral produces 1 less RP on your opponent’s next turn.",
        cost: { rp: 0 },
        timing: Timing.ACTION_PHASE,
        effect: {
          type: EffectType.FLIP_COIN,
          successResult: "heads",
          onSuccess: {
            type: "modifyRpGeneration",
            target: {
              controller: "opponent",
              kind: CardKind.CORAL,
              zone: Zone.OPPONENT_REEF,
            },
            amount: -1,
            duration: "opponentNextTurn",
          },
        },
      },
    ],

    defense: { dice: "D4" },
    flavorText: "Nudibranchs are vividly colored sea slugs whose bright patterns warn predators.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "giant-triton",
    name: "Giant Triton",
    kind: CardKind.CREATURE,
    category: CardCategory.INVERTEBRATE,
    image: "/images/cards/invertebrates/giant-triton.png",
    sortOrder: 310,

    cost: { rp: 2 },
    victoryPoints: 1,
    tags: ["creature", "invertebrate", "triton"],

    bio: {
      commonName: "Giant Triton",
      role: "Invertebrate",
      region: "Indo-Pacific",
      length: "18”",
      weight: "600 lbs",
    },

    playRequirements: [],

    passives: [
      {
        id: "toxic-immunity",
        name: "Toxic Immunity",
        text: "Immune to Crown of Thorns toxic effect.",
        timing: Timing.PASSIVE,
        effect: {
          type: "ignoreEffect",
          sourceCardId: "crown-of-thorns",
          ignoredEffectType: "toxicWhenEaten",
        },
      },
    ],

    onPlay: [],

    actions: [
      {
        id: "starfish-hunt",
        name: "Starfish Hunt",
        text: "Perform a 1D6 attack targeting an opponent’s starfish.",
        cost: { rp: 1 },
        timing: Timing.ACTION_PHASE,
        effect: attackEffect({
          dice: "D6",
          categories: [CardCategory.INVERTEBRATE],
        }),
        targetTags: ["starfish"],
      },
    ],

    defense: { dice: "D8" },
    flavorText: "Giant tritons are large predatory sea snails that hunt crown-of-thorns starfish.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "octopus",
    name: "Octopus",
    kind: CardKind.CREATURE,
    category: CardCategory.INVERTEBRATE,
    image: "/images/cards/invertebrates/octopus.png",
    sortOrder: 311,

    cost: { rp: 6 },
    victoryPoints: 6,
    tags: ["creature", "invertebrate", "octopus"],

    bio: {
      commonName: "Octopus",
      role: "Invertebrate",
      region: "Worldwide",
      length: "3’ 2”",
      weight: "2 lbs",
    },

    playRequirements: [requiresShipWreck],

    passives: [],

    onPlay: [
      {
        id: "cunning-hunter",
        name: "Cunning Hunter",
        text: "1 Bite.",
        effects: [
          {
            type: EffectType.ATTACK,
            attackName: "Bite",
            attackDice: "D8",
            repeat: 1,
            target: {
              controller: "opponent",
              kind: CardKind.CREATURE,
              categories: [CardCategory.FISH, CardCategory.INVERTEBRATE],
              zone: Zone.OPPONENT_REEF,
            },
          },
        ],
        icons: {
          attack: "d8_attack",
          targetable: [CardCategory.FISH, CardCategory.INVERTEBRATE],
        },
      },
    ],

    actions: [],
    defense: { dice: "D8" },
    flavorText: "Octopuses change color and texture in a blink.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "oysters",
    name: "Oysters",
    kind: CardKind.CREATURE,
    category: CardCategory.INVERTEBRATE,
    image: "/images/cards/invertebrates/oysters.png",
    sortOrder: 312,

    cost: { rp: 6 },
    victoryPoints: 2,
    tags: ["creature", "invertebrate", "oyster", "filter-feeder"],

    bio: {
      commonName: "Oysters",
      role: "Invertebrate",
      region: "Worldwide",
      length: "10”",
      weight: "1.5 lbs",
    },

    playRequirements: [requiresAnyhabitat],

    passives: [ecoBoost(4)],

    onPlay: [],
    actions: [],
    defense: { dice: "D10" },
    flavorText: "Oysters are vital ecosystem engineers, forming reefs that significantly improve water quality.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "giant-clam",
    name: "Giant Clam",
    kind: CardKind.CREATURE,
    category: CardCategory.INVERTEBRATE,
    image: "/images/cards/invertebrates/giant-clam.png",
    sortOrder: 313,

    cost: { rp: 5 },
    victoryPoints: 3,
    tags: ["creature", "invertebrate", "clam", "filter-feeder"],

    bio: {
      commonName: "Giant Clam",
      role: "Invertebrate",
      region: "Indo-Pacific",
      length: "4’",
      weight: "600 lbs",
    },

    playRequirements: [],

    passives: [],

    onPlay: [],

    actions: [
      {
        id: "pearl-hunting",
        name: "Pearl Hunting",
        text: "On your turn, roll a D4. If you roll a 4, collect 4 RP. You may only roll this once per turn.",
        cost: { rp: 0 },
        timing: Timing.ACTION_PHASE,
        oncePerTurn: true,
        effect: {
          type: "rollDiceForResource",
          dice: "D4",
          successValues: [4],
          onSuccess: {
            type: EffectType.GAIN_RESOURCE,
            resource: "rp",
            amount: 4,
          },
        },
      },
    ],

    defense: { dice: "D4" },
    flavorText: "Giant clams are the biggest living bivalves.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },
];
