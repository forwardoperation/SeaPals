import { CardKind, CardCategory, EffectType, Timing, Zone } from "../types";

const requiresMarineSanctuary = {
  id: "requires-marine-sanctuary",
  type: "cardInPlay",
  cardId: "marine-sanctuary",
  requiredKind: CardKind.STRUCTURE,
  zone: Zone.YOUR_REEF,
  text: "Can only be played if Marine Sanctuary is in play on your reef.",
};

const coralDamage = (amount) => ({
  type: EffectType.DAMAGE,
  target: {
    controller: "opponent",
    kind: CardKind.CORAL,
    zone: Zone.OPPONENT_REEF,
  },
  amount: { type: "fixed", value: amount },
});

const coralDiceDamage = ({ dice, multiplier, fallbackAmount = null }) => ({
  type: EffectType.DAMAGE,
  target: {
    controller: "opponent",
    kind: CardKind.CORAL,
    zone: Zone.OPPONENT_REEF,
  },
  amount: {
    type: "dice",
    dice,
    multiplier,
    fallbackAmount,
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

const biteEffect = ({ categories }) => ({
  type: EffectType.ATTACK,
  attackName: "Bite",
  attackDice: "D6",
  repeat: 1,
  target: {
    controller: "opponent",
    kind: CardKind.CREATURE,
    categories,
    zone: Zone.OPPONENT_REEF,
  },
});

const toxicPassive = {
  id: "toxic",
  name: "Toxic",
  text: "If eaten, flip a coin. If tails, the consuming creature is discarded.",
  timing: "whenEaten",
  effect: {
    type: EffectType.TOXIC_WHEN_EATEN,
    coinFlip: {
      failResult: "tails",
      effect: {
        type: EffectType.DISCARD_CONSUMING_CREATURE,
      },
    },
  },
};

export const fishCards = [
  {
    id: "fairy-parrotfish",
    name: "Parrotfish",
    subtitle: "Fairy",
    kind: CardKind.CREATURE,
    category: CardCategory.FISH,
    image: "/images/cards/fish/fairy-parrotfish.png",
    sortOrder: 200,

    cost: { rp: 2 },
    victoryPoints: 2,
    tags: ["creature", "fish", "parrotfish", "herbivore"],

    bio: {
      commonName: "Fairy Parrotfish",
      scientificName: "",
      role: "Reef Fish",
      region: "Caribbean",
      length: "2’ 2”",
      weight: "32 lbs",
    },

    playRequirements: [],
    passives: [],

    onPlay: [
      {
        id: "eat",
        name: "Eat",
        text: "Inflict 10 HP of damage to an opponent’s coral.",
        effects: [coralDamage(10)],
      },
    ],

    actions: [],
    defense: { dice: "D6" },
    flavorText:
      "Parrotfish scrape algae with a beak-like bite, grinding coral into fine sand.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "cleaner-wrasse",
    name: "Wrasse",
    subtitle: "Cleaner",
    kind: CardKind.CREATURE,
    category: CardCategory.FISH,
    image: "/images/cards/fish/cleaner-wrasse.png",
    sortOrder: 201,

    cost: { rp: 2 },
    victoryPoints: 2,
    tags: ["creature", "fish", "wrasse", "cleaner"],

    bio: {
      commonName: "Cleaner Wrasse",
      scientificName: "",
      role: "Reef Fish",
      region: "Caribbean",
      length: "5.5”",
      weight: "33 g",
    },

    playRequirements: [],
    passives: [],

    onPlay: [],

    actions: [
      {
        id: "parasite-clean",
        name: "Parasite Clean",
        text: "Choose one of your fish or predator class creatures. That creature has advantage on defensive rolls until your next turn.",
        cost: { rp: 1 },
        timing: Timing.ACTION_PHASE,
        target: {
          controller: "you",
          kind: CardKind.CREATURE,
          categories: [CardCategory.FISH, CardCategory.PREDATOR],
          zone: Zone.YOUR_REEF,
        },
        effect: {
          type: EffectType.GRANT_DEFENSE_ADVANTAGE,
          duration: "untilYourNextTurn",
        },
      },
    ],

    defense: { dice: "D4" },
    flavorText:
      "Cleaner wrasses run reef stations where big fish queue for a cleanup.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "picasso-triggerfish",
    name: "Triggerfish",
    subtitle: "Picasso",
    kind: CardKind.CREATURE,
    category: CardCategory.FISH,
    image: "/images/cards/fish/picasso-triggerfish.png",
    sortOrder: 202,

    cost: { rp: 2 },
    victoryPoints: 2,
    tags: ["creature", "fish", "triggerfish"],

    bio: {
      commonName: "Picasso Triggerfish",
      scientificName: "Rhinecanthus aculeatus",
      role: "Reef Fish",
      region: "Indo-Pacific",
      length: "11”",
      weight: "900 g",
    },

    playRequirements: [],
    passives: [],

    onPlay: [
      {
        id: "target",
        name: "Target",
        text: "Choose 1 card from your opponent’s hand without looking and discard it.",
        effects: [
          {
            type: EffectType.DISCARD_RANDOM_CARD,
            targetPlayer: "opponent",
            from: Zone.HAND,
            amount: 1,
          },
        ],
      },
    ],

    actions: [],
    defense: { dice: "D6" },
    flavorText:
      "Known for striking colors and pugnacious attitude, this triggerfish can lock its dorsal spine into coral crevices.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "bluestriped-grunt",
    name: "Grunt",
    subtitle: "Bluestriped",
    kind: CardKind.CREATURE,
    category: CardCategory.FISH,
    image: "/images/cards/fish/bluestriped-grunt.png",
    sortOrder: 203,

    cost: { rp: 1 },
    victoryPoints: 1,
    tags: ["creature", "fish", "grunt"],

    bio: {
      commonName: "Bluestriped Grunt",
      scientificName: "",
      role: "Reef Fish",
      region: "Caribbean",
      length: "2’ 6”",
      weight: "123 lbs",
    },

    playRequirements: [],
    passives: [],

    onPlay: [
      {
        id: "call-for-family",
        name: "Call for Family",
        text: "Search your deck for up to two fish and place them into your hand. Shuffle your deck afterwards.",
        effects: [
          {
            type: EffectType.SEARCH_DECK,
            targetKind: CardKind.CREATURE,
            targetCategories: [CardCategory.FISH],
            destination: Zone.HAND,
            amount: 2,
            shuffleAfterwards: true,
          },
        ],
      },
    ],

    actions: [],
    defense: { dice: "D4" },
    flavorText:
      "Grunts school tightly by day and roam seagrass beds to feed at night.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "frogfish",
    name: "Frogfish",
    kind: CardKind.CREATURE,
    category: CardCategory.FISH,
    image: "/images/cards/fish/frogfish.png",
    sortOrder: 204,

    cost: { rp: 2 },
    victoryPoints: 2,
    tags: ["creature", "fish", "ambush"],

    bio: {
      commonName: "Frogfish",
      scientificName: "",
      role: "Reef Fish",
      region: "Caribbean",
      length: "8”",
      weight: "33 g",
    },

    playRequirements: [],
    passives: [],

    onPlay: [
      {
        id: "sneak-attack",
        name: "Sneak Attack",
        text: "Perform 1 Bite.",
        effects: [
          biteEffect({
            categories: [CardCategory.FISH, CardCategory.INVERTEBRATE],
          }),
        ],
        icons: {
          attack: "bite",
          targetable: [CardCategory.FISH, CardCategory.INVERTEBRATE],
        },
      },
    ],

    actions: [],
    defense: { dice: "D6" },
    flavorText:
      "Frogfish vanish in plain sight. They fish with a built-in lure, then gulp prey with one of the fastest strikes in the ocean.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "clownfish",
    name: "Clownfish",
    kind: CardKind.CREATURE,
    category: CardCategory.FISH,
    image: "/images/cards/fish/clownfish.png",
    sortOrder: 205,

    cost: { rp: 2 },
    victoryPoints: 2,
    tags: ["creature", "fish", "clownfish"],

    bio: {
      commonName: "Clownfish",
      scientificName: "",
      role: "Reef Fish",
      region: "Barrier Reef",
      length: "4.3”",
      weight: "200 g",
    },

    playRequirements: [],
    passives: [
      {
        id: "symbiosis",
        name: "Symbiosis",
        text: "Can be placed inside an anemone’s slots. If inside of an anemone, it is considered to be covered and also cannot be pierced.",
        timing: Timing.PASSIVE,
        effect: {
          type: "specialPlacement",
          allowedHostTags: ["anemone"],
          grantsConditions: ["covered", "cannotBePierced"],
        },
      },
    ],

    onPlay: [],
    actions: [],
    defense: { dice: "D4" },
    flavorText:
      "Clownfish live safely among stinging anemones, protected by a special mucus coat.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "boxfish",
    name: "Boxfish",
    kind: CardKind.CREATURE,
    category: CardCategory.FISH,
    image: "/images/cards/fish/boxfish.png",
    sortOrder: 206,

    cost: { rp: 2 },
    victoryPoints: 2,
    tags: ["creature", "fish", "boxfish", "toxic"],

    bio: {
      commonName: "Boxfish",
      scientificName: "",
      role: "Reef Fish",
      region: "Caribbean",
      length: "1’ 2”",
      weight: "1.2 lbs",
    },

    playRequirements: [],
    passives: [toxicPassive],

    onPlay: [],
    actions: [],
    defense: { dice: "D4" },
    flavorText:
      "Boxfish wear bony, box-shaped armor and hover with tiny fins.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "porcupine-fish",
    name: "Porcupine Fish",
    kind: CardKind.CREATURE,
    category: CardCategory.FISH,
    image: "/images/cards/fish/porcupinefish.png",
    sortOrder: 207,

    cost: { rp: 2 },
    victoryPoints: 2,
    tags: ["creature", "fish", "porcupinefish", "toxic"],

    bio: {
      commonName: "Porcupine Fish",
      scientificName: "",
      role: "Reef Fish",
      region: "Caribbean",
      length: "2’ 6”",
      weight: "9 lbs",
    },

    playRequirements: [],
    passives: [toxicPassive],

    onPlay: [],

    actions: [
      {
        id: "crunch",
        name: "Crunch",
        text: "Perform a 1D4 attack targeting one of opponent’s invertebrates. You cannot use this action on your next turn.",
        cost: { rp: 1 },
        timing: Timing.ACTION_PHASE,
        effect: attackEffect({
          dice: "D4",
          categories: [CardCategory.INVERTEBRATE],
        }),
        cooldown: {
          duration: "yourNextTurn",
        },
      },
    ],

    defense: { dice: "D4" },
    flavorText:
      "Porcupinefish puff into a spiky ball to scare off predators.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "lionfish",
    name: "Lionfish",
    kind: CardKind.CREATURE,
    category: CardCategory.FISH,
    image: "/images/cards/fish/lionfish.png",
    sortOrder: 208,

    cost: { rp: 3 },
    victoryPoints: 3,
    tags: ["creature", "fish", "lionfish", "toxic"],

    bio: {
      commonName: "Lionfish",
      scientificName: "",
      role: "Reef Fish",
      region: "Caribbean",
      length: "13”",
      weight: "2.3 lbs",
    },

    playRequirements: [],
    passives: [
      {
        ...toxicPassive,
        text: "If eaten, your opponent flips a coin. If tails, they discard the consuming card.",
      },
    ],

    onPlay: [
      {
        id: "gulp",
        name: "Gulp",
        text: "1 Bite.",
        effects: [
          biteEffect({
            categories: [CardCategory.FISH, CardCategory.INVERTEBRATE],
          }),
        ],
        icons: {
          attack: "bite",
          targetable: [CardCategory.FISH, CardCategory.INVERTEBRATE],
        },
      },
    ],

    actions: [],
    defense: { dice: "D4" },
    flavorText:
      "Lionfish drift like ornate fans, herding small fish with wide fins before a lightning strike.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "flounder",
    name: "Flounder",
    kind: CardKind.CREATURE,
    category: CardCategory.FISH,
    image: "/images/cards/fish/flounder.png",
    sortOrder: 209,

    cost: { rp: 3 },
    victoryPoints: 3,
    tags: ["creature", "fish", "flounder"],

    bio: {
      commonName: "Flounder",
      scientificName: "",
      role: "Reef Fish",
      region: "Caribbean",
      length: "2’ 2”",
      weight: "7 lbs",
    },

    playRequirements: [],
    passives: [],
    onPlay: [],
    actions: [],
    defense: { dice: "D10" },
    flavorText:
      "Flounders lie flat and camouflaged, burying in sand with both eyes on one side.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "sargeant-major",
    name: "Sargeant Major",
    kind: CardKind.CREATURE,
    category: CardCategory.FISH,
    image: "/images/cards/fish/sargeant-major.png",
    sortOrder: 210,

    cost: { rp: 1 },
    victoryPoints: 1,
    tags: ["creature", "fish", "damselfish"],

    bio: {
      commonName: "Sargeant Major",
      scientificName: "",
      role: "Reef Fish",
      region: "Caribbean",
      length: "6”",
      weight: "100 g",
    },

    playRequirements: [],
    passives: [
      {
        id: "coral-protector",
        name: "Coral Protector",
        text: "Any coral this fish is attached to gains +10 HP.",
        timing: Timing.PASSIVE,
        effect: {
          type: "modifyHealth",
          target: {
            controller: "you",
            kind: CardKind.CORAL,
            relationship: "attachedHost",
          },
          amount: 10,
        },
      },
    ],

    onPlay: [],
    actions: [],
    defense: { dice: "D4" },
    flavorText:
      "Sergeant major damselfish wear bold black-and-white bars with yellow on top.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "french-angelfish",
    name: "French Angelfish",
    kind: CardKind.CREATURE,
    category: CardCategory.FISH,
    image: "/images/cards/fish/french-angelfish.png",
    sortOrder: 211,

    cost: { rp: 5 },
    victoryPoints: 3,
    bonusVictoryPoints: {
      amount: 2,
      condition: {
        type: "cardInPlay",
        cardId: "marine-sanctuary",
        zone: Zone.YOUR_REEF,
      },
      text: "If Marine Sanctuary is in play, gain two additional victory points while this card is on your reef.",
    },

    tags: ["creature", "fish", "angelfish"],

    bio: {
      commonName: "French Angelfish",
      scientificName: "",
      role: "Fish",
      species: "Ray Finned Fish",
      region: "Caribbean",
      length: "1’ 6”",
      weight: "4.4 lbs",
    },

    playRequirements: [],
    passives: [],
    onPlay: [],
    actions: [],
    defense: { dice: "D6" },
    flavorText:
      "French angelfish cruise reefs in bonded pairs, flashing yellow-edged scales and a dark mask.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "spanish-hogfish",
    name: "Spanish Hogfish",
    kind: CardKind.CREATURE,
    category: CardCategory.FISH,
    image: "/images/cards/fish/spanish-hogfish.png",
    sortOrder: 212,

    cost: { rp: 2 },
    victoryPoints: 2,
    tags: ["creature", "fish", "wrasse"],

    bio: {
      commonName: "Spanish Hogfish",
      scientificName: "",
      role: "Fish",
      region: "Caribbean",
      length: "2’ 1”",
      weight: "22 lbs",
    },

    playRequirements: [],
    passives: [],

    onPlay: [],

    actions: [
      {
        id: "crunch",
        name: "Crunch",
        text: "Perform a 1D6 attack targeting one of opponent’s invertebrates. You cannot use this action on your next turn.",
        cost: { rp: 1 },
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
    flavorText:
      "Spanish hogfish are wrasses with a pig-like snout they use to root out crabs and clams.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "twinspot-butterflyfish",
    name: "Butterflyfish",
    subtitle: "Twinspot",
    kind: CardKind.CREATURE,
    category: CardCategory.FISH,
    image: "/images/cards/fish/twinspot-butterflyfish.png",
    sortOrder: 213,

    cost: { rp: 2 },
    victoryPoints: 2,
    bonusVictoryPoints: {
      type: "perCardOnReef",
      amount: 1,
      targetCardId: "twinspot-butterflyfish",
      condition: {
        type: "cardInPlay",
        cardId: "marine-sanctuary",
        zone: Zone.YOUR_REEF,
      },
      text: "If Marine Sanctuary is in play, gain an additional victory point for each Twinspot Butterflyfish on your reef.",
    },

    tags: ["creature", "fish", "butterflyfish"],

    bio: {
      commonName: "Twinspot Butterflyfish",
      scientificName: "",
      role: "Reef Fish",
      region: "Red Sea",
      length: "5”",
      weight: "50 g",
    },

    playRequirements: [],
    passives: [],
    onPlay: [],
    actions: [],
    defense: { dice: "D4" },
    flavorText:
      "The twinspot butterflyfish is recognized by its two distinctive dark spots.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "queen-angelfish",
    name: "Queen Angelfish",
    kind: CardKind.CREATURE,
    category: CardCategory.FISH,
    image: "/images/cards/fish/queen-angelfish.png",
    sortOrder: 214,

    cost: { rp: 4 },
    victoryPoints: 3,
    bonusVictoryPoints: {
      amount: 1,
      condition: {
        type: "cardInPlay",
        cardId: "marine-sanctuary",
        zone: Zone.YOUR_REEF,
      },
      text: "If Marine Sanctuary is in play, gain one additional victory point while this card is on your reef.",
    },

    tags: ["creature", "fish", "angelfish"],

    bio: {
      commonName: "Queen Angelfish",
      scientificName: "",
      role: "Reef Fish",
      region: "Caribbean",
      length: "14”",
      weight: "3 lbs",
    },

    playRequirements: [],
    passives: [],
    onPlay: [],
    actions: [],
    defense: { dice: "D6" },
    flavorText:
      "The queen angelfish is a brilliantly colored reef fish that glides through warm, clear Caribbean shallows.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "blue-tang",
    name: "Blue Tang",
    kind: CardKind.CREATURE,
    category: CardCategory.FISH,
    image: "/images/cards/fish/blue-tang.png",
    sortOrder: 215,

    cost: { rp: 1 },
    victoryPoints: 2,
    tags: ["creature", "fish", "tang"],

    bio: {
      commonName: "Blue Tang",
      scientificName: "",
      role: "Reef Fish",
      region: "Caribbean",
      length: "10”",
      weight: "300 g",
    },

    playRequirements: [requiresMarineSanctuary],
    passives: [],
    onPlay: [],
    actions: [],
    defense: { dice: "D4" },
    flavorText:
      "Known for its electric-blue body, scalpel-sharp tail spine, and active grazing behavior.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "spectacled-parrotfish",
    name: "Parrotfish",
    subtitle: "Spectacled",
    kind: CardKind.CREATURE,
    category: CardCategory.FISH,
    image: "/images/cards/fish/spectacled-parrotfish.png",
    sortOrder: 216,

    cost: { rp: 5 },
    victoryPoints: 4,
    tags: ["creature", "fish", "parrotfish", "herbivore"],

    bio: {
      commonName: "Spectacled Parrotfish",
      scientificName: "Chlorurus perspicillatus",
      role: "Reef Fish",
      species: "Parrotfish",
      region: "Eastern Pacific",
      habitat: "Coral reefs",
      diet: "Algae",
      length: "24”",
      weight: "21 lbs",
    },

    playRequirements: [],
    passives: [],

    onPlay: [
      {
        id: "chomp",
        name: "Chomp",
        text: "If Marine Sanctuary is in play, inflict 1D4 × 10 damage to an opponent’s coral. Otherwise, inflict 10 HP damage to an opponent’s coral.",
        effects: [
          coralDiceDamage({
            dice: "D4",
            multiplier: 10,
            fallbackAmount: 10,
          }),
        ],
        conditionalModifiers: [
          {
            condition: {
              type: "cardInPlay",
              cardId: "marine-sanctuary",
              zone: Zone.YOUR_REEF,
            },
            modifier: {
              type: "useDiceDamage",
            },
          },
        ],
      },
    ],

    actions: [],
    defense: { dice: "D8" },
    flavorText:
      "Known for its distinctive spectacle-like markings around the eyes and beak.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },
];