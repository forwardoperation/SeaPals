import {
  CardKind,
  CardCategory,
  EffectType,
  Timing,
  Zone,
} from "../types";

const requiresAnyhabitat = {
  id: "requires-habitat",
  type: "kindInPlay",
  requiredKind: CardKind.HABITAT,
  zone: Zone.YOUR_REEF,
  text: "Can only be played if a habitat card is in play on your reef.",
};

const requiresCoralReef = {
  id: "requires-coral-reef",
  type: "cardInPlay",
  cardId: "coral-reef",
  requiredKind: CardKind.HABITAT,
  zone: Zone.YOUR_REEF,
  text: "Can only be played if a Coral Reef habitat card is in play on your reef.",
};

const attackEffect = ({ dice, repeat = 1, categories, advantage = false }) => ({
  type: EffectType.ATTACK,
  attackDice: dice,
  repeat,
  advantage,
  target: {
    controller: "opponent",
    kind: CardKind.CREATURE,
    categories,
    zone: Zone.OPPONENT_REEF,
  },
});

const biteEffect = ({ count = 1, categories }) => ({
  type: EffectType.ATTACK,
  attackDice: "D6",
  repeat: count,
  attackName: "Bite",
  target: {
    controller: "opponent",
    kind: CardKind.CREATURE,
    categories,
    zone: Zone.OPPONENT_REEF,
  },
});

export const predatorCards = [
  {
    id: "green-moray-eel",
    name: "Green Moray Eel",
    kind: CardKind.CREATURE,
    category: CardCategory.PREDATOR,
    image: "/images/cards/predator/reef/moray-eel.png",
    sortOrder: 100,

    cost: { rp: 4 },
    victoryPoints: 4,
    tags: ["creature", "predator", "eel"],

    bio: {
      commonName: "Green Moray Eel",
      scientificName: "Gymnothorax funebris",
      role: "Predator",
      species: "True Eel",
      region: "Pacific",
      length: "8’ 6”",
      weight: "65 lbs",
    },

    playRequirements: [],

    passives: [],

    onPlay: [
      {
        id: "ambush-hunt",
        name: "Ambush Hunt",
        text: "Perform a D6 attack against an opponent’s fish or predator. If a habitat card is in play on your reef, add 1D4 to your attack roll.",
        effects: [
          attackEffect({
            dice: "D6",
            categories: [CardCategory.FISH, CardCategory.PREDATOR],
          }),
        ],
        conditionalModifiers: [
          {
            condition: {
              type: "kindInPlay",
              requiredKind: CardKind.HABITAT,
              zone: Zone.YOUR_REEF,
            },
            modifier: {
              type: "addDiceToAttackRoll",
              dice: "D4",
            },
          },
        ],
        icons: {
          attack: "d6_attack",
          targetable: [CardCategory.FISH, CardCategory.PREDATOR],
        },
      },
    ],

    actions: [],
    defense: { dice: "D8" },

    flavorText:
      "Moray eels lurk in crevices. They snatch prey, then fire out a second set of jaws to pull it down.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "reef-shark",
    name: "Reef Shark",
    kind: CardKind.CREATURE,
    category: CardCategory.PREDATOR,
    image: "/images/cards/predator/reef/reef-shark.png",
    sortOrder: 101,

    cost: { rp: 4 },
    victoryPoints: 4,
    tags: ["creature", "predator", "shark"],

    bio: {
      commonName: "Reef Shark",
      scientificName: "",
      role: "Predator",
      species: "Blacktip Reef Shark",
      region: "Caribbean",
      length: "5’",
      weight: "55 lbs",
    },

    playRequirements: [],

    passives: [],

    onPlay: [
      {
        id: "feeding-frenzy",
        name: "Feeding Frenzy",
        text: "1 Bite. If a habitat card is in play, add +1 more bite for each Reef Shark on your reef. Max 3.",
        effects: [
          {
            ...biteEffect({
              count: 1,
              categories: [CardCategory.FISH, CardCategory.PREDATOR],
            }),
            bonusRepeats: {
              type: "countCardsOnReef",
              cardId: "reef-shark",
              controller: "you",
              maxBonus: 3,
              requires: {
                type: "kindInPlay",
                requiredKind: CardKind.HABITAT,
                zone: Zone.YOUR_REEF,
              },
            },
          },
        ],
        icons: {
          attack: "bite",
          targetable: [CardCategory.FISH, CardCategory.PREDATOR],
        },
      },
    ],

    actions: [],
    defense: { dice: "D6" },

    flavorText:
      "Blacktip reef sharks are shallow-reef sprinters with signature black-tipped fins.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "great-barracuda",
    name: "Great Barracuda",
    kind: CardKind.CREATURE,
    category: CardCategory.PREDATOR,
    image: "/images/cards/predator/reef/great-barracuda.png",
    sortOrder: 102,

    cost: { rp: 3 },
    victoryPoints: 3,
    tags: ["creature", "predator", "barracuda"],

    bio: {
      commonName: "Great Barracuda",
      scientificName: "Sphyraena barracuda",
      role: "Predator",
      species: "Barracuda",
      region: "Caribbean",
      length: "4’ 6”",
      weight: "45 lbs",
    },

    playRequirements: [],

    passives: [],

    onPlay: [
      {
        id: "quick-strike",
        name: "Quick Strike",
        text: "1 Bite. If a Coral Reef habitat is on your reef, perform a second Bite.",
        effects: [
          {
            ...biteEffect({
              count: 1,
              categories: [CardCategory.FISH, CardCategory.PREDATOR],
            }),
            bonusRepeats: {
              type: "cardInPlay",
              cardId: "coral-reef",
              controller: "you",
              amount: 1,
              requires: {
                type: "cardInPlay",
                cardId: "coral-reef",
                requiredKind: CardKind.HABITAT,
                zone: Zone.YOUR_REEF,
              },
            },
          },
        ],
        icons: {
          attack: "bite",
          targetable: [CardCategory.FISH, CardCategory.PREDATOR],
        },
      },
    ],

    actions: [],
    defense: { dice: "D6" },

    flavorText:
      "Barracudas hover like steel spears, then explode forward to snatch prey.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "goliath-grouper",
    name: "Goliath Grouper",
    kind: CardKind.CREATURE,
    category: CardCategory.PREDATOR,
    image: "/images/cards/predator/reef/goliath-grouper.png",
    sortOrder: 103,

    cost: { rp: 6 },
    victoryPoints: 6,
    tags: ["creature", "predator", "grouper"],

    bio: {
      commonName: "Goliath Grouper",
      scientificName: "Epinephelus itajara",
      role: "Predator",
      species: "Grouper",
      region: "Caribbean",
      length: "7’ 4”",
      weight: "800 lbs",
    },

    playRequirements: [requiresCoralReef],

    passives: [],

    onPlay: [
      {
        id: "ambush",
        name: "Ambush",
        text: "1 Bite.",
        effects: [
          biteEffect({
            count: 1,
            categories: [CardCategory.FISH, CardCategory.PREDATOR],
          }),
        ],
        icons: {
          attack: "bite",
          targetable: [CardCategory.FISH, CardCategory.PREDATOR],
        },
      },
    ],

    actions: [],
    defense: { dice: "D12" },

    flavorText:
      "Groupers are ambush hunters that gulp prey with sudden vacuum force.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "green-sea-turtle",
    name: "Green Sea Turtle",
    kind: CardKind.CREATURE,
    category: CardCategory.PREDATOR,
    image: "/images/cards/predator/green-sea-turtle.png",
    sortOrder: 104,

    cost: { rp: 4 },
    victoryPoints: 4,
    tags: ["creature", "predator", "turtle"],

    bio: {
      commonName: "Green Sea Turtle",
      scientificName: "Chelonia mydas",
      role: "Predator",
      species: "Sea Turtle",
      region: "Caribbean",
      length: "4’ 8”",
      weight: "425 lbs",
    },

    playRequirements: [requiresCoralReef],

    passives: [],

    onPlay: [
      {
        id: "coral-heal",
        name: "Coral Heal",
        text: "Choose one of your corals and restore 1D6 × 10 HP.",
        effects: [
          {
            type: "heal",
            target: {
              controller: "you",
              kind: CardKind.CORAL,
              zone: Zone.YOUR_REEF,
            },
            amount: {
              type: "dice",
              dice: "D6",
              multiplier: 10,
            },
          },
        ],
      },
    ],

    actions: [],
    defense: { dice: "D8" },

    flavorText:
      "Green sea turtles graze on seagrass and algae.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "thresher-shark-legacy-reef",
    name: "Thresher Shark",
    kind: CardKind.CREATURE,
    category: CardCategory.PREDATOR,
    prerelease: true,
    galleryHidden: true,
    image: "/images/cards/predator/oceanic/thresher-shark.png",
    sortOrder: 105,

    cost: { rp: 5 },
    victoryPoints: 5,
    tags: ["creature", "predator", "shark"],

    bio: {
      commonName: "Thresher Shark",
      scientificName: "",
      role: "Predator",
      species: "Mackerel Shark",
      region: "Worldwide",
      length: "14’ 5”",
      weight: "600 lbs",
    },

    playRequirements: [],

    passives: [],

    onPlay: [
      {
        id: "tail-whip",
        name: "Tail Whip",
        text: "If Coral Reef habitat is in play on your reef, subtract 2 from your opponent’s defensive dice roll.",
        effects: [
          {
            type: "modifyDefenseRoll",
            targetPlayer: "opponent",
            amount: -2,
            duration: "thisAttack",
            requires: {
              type: "cardInPlay",
              cardId: "coral-reef",
              requiredKind: CardKind.HABITAT,
              zone: Zone.YOUR_REEF,
            },
          },
        ],
      },
      {
        id: "stun-strike",
        name: "Stun Strike",
        text: "Perform a D6 attack against an opponent’s fish or predator.",
        effects: [
          attackEffect({
            dice: "D6",
            categories: [CardCategory.FISH, CardCategory.PREDATOR],
          }),
        ],
        icons: {
          attack: "d6_attack",
          targetable: [CardCategory.FISH, CardCategory.PREDATOR],
        },
      },
    ],

    actions: [],
    defense: { dice: "D10" },

    flavorText:
      "A thresher shark is a sleek, fast-swimming predator famous for its extraordinary tail.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },

  {
    id: "spinner-dolphins",
    name: "Spinner Dolphins",
    kind: CardKind.CREATURE,
    category: CardCategory.PREDATOR,
    image: "/images/cards/predator/reef/spinner-dolphins.png",
    sortOrder: 106,

    cost: { rp: 4 },
    victoryPoints: 4,
    tags: ["creature", "predator", "dolphin"],

    bio: {
      commonName: "Spinner Dolphins",
      scientificName: "",
      role: "Predator",
      species: "Toothed Whale",
      region: "Worldwide",
      length: "5’ 9”",
      weight: "180 lbs",
    },

    playRequirements: [],

    passives: [],

    onPlay: [
      {
        id: "expert-hunter",
        name: "Expert Hunter",
        text: "If Coral Reef is in play, gain advantage on attacks against fish.",
        effects: [
          {
            type: "grantAdvantage",
            targetCategories: [CardCategory.FISH],
            duration: "thisCard",
            requires: {
              type: "cardInPlay",
              cardId: "coral-reef",
              requiredKind: CardKind.HABITAT,
              zone: Zone.YOUR_REEF,
            },
          },
        ],
      },
      {
        id: "agile-hunt",
        name: "Agile Hunt",
        text: "Perform a D8 attack against an opponent’s fish or predator.",
        effects: [
          attackEffect({
            dice: "D8",
            categories: [CardCategory.FISH, CardCategory.PREDATOR],
          }),
        ],
        icons: {
          attack: "d8_attack",
          targetable: [CardCategory.FISH, CardCategory.PREDATOR],
        },
      },
    ],

    actions: [],
    defense: { dice: "D8" },

    flavorText:
      "Spinner dolphins leap in tight corkscrew spins that can launch them high above the waves.",
    set: { id: "genesis", name: "Genesis", collectorNumber: null, totalInSet: null },
  },
];
