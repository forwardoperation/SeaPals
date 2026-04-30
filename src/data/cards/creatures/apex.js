import { CardKind, CardCategory, Zone } from "../types";

const INTIMIDATION_PASSIVE = {
  id: "intimidation",
  name: "Intimidation",
  text: "Opponent’s fish cost +1 RP to play.",
  timing: "whileInPlay",
  effect: {
    type: "modifyPlayCost",
    targetPlayer: "opponent",
    targetKind: CardKind.CREATURE,
    targetCategories: [CardCategory.FISH],
    resource: "rp",
    amount: 1,
  },
};

const REQUIRES_STRUCTURE = {
  id: "requires-structure",
  type: "kindInPlay",
  requiredKind: CardKind.STRUCTURE,
  zone: Zone.YOUR_REEF,
  text: "Can only be played if a structure card is in play on your reef.",
};

export const apexCards = [
  // 🦈 GREAT WHITE
  {
    id: "great-white",
    name: "Great White",
    kind: CardKind.CREATURE,
    category: CardCategory.APEX,
    image: "/images/cards/apex/great-white.png",
    sortOrder: 10,
    cost: { rp: 8 },
    victoryPoints: 9,
    tags: ["apex", "shark"],
    bio: {
      commonName: "Great White Shark",
      scientificName: "Carcharodon carcharias",
    },
    playRequirements: [
      {
        ...REQUIRES_STRUCTURE,
        text: "Can only be played if a Drop Off structure card is in play on your reef.",
      },
    ],
    passives: [INTIMIDATION_PASSIVE],
    onPlay: [
      {
        id: "crushing-jaws",
        name: "Crushing Jaws",
        text: "Inflict 60 HP damage to an opponent’s coral. Then perform a D20 attack three times.",
        effects: [
          {
            type: "damage",
            amount: 60,
            target: {
              controller: "opponent",
              kind: CardKind.CORAL,
              zone: Zone.OPPONENT_REEF,
            },
          },
          {
            type: "attack",
            attackDice: "D20",
            repeat: 3,
          },
        ],
      },
    ],
    defense: { dice: "D10" },
  },

  // 🦈 TIGER SHARK
  {
    id: "tiger-shark",
    name: "Tiger Shark",
    kind: CardKind.CREATURE,
    category: CardCategory.APEX,
    image: "/images/cards/apex/tiger-shark.png",
    sortOrder: 15,
    cost: { rp: 7 },
    victoryPoints: 7,
    tags: ["apex", "shark"],
    bio: {
      commonName: "Tiger Shark",
      scientificName: "Galeocerdo cuvier",
    },
    playRequirements: [
      {
        ...REQUIRES_STRUCTURE,
        text: "Can only be played if a Drop Off structure card is in play on your reef.",
      },
    ],
    passives: [INTIMIDATION_PASSIVE],
    onPlay: [
      {
        id: "decimate",
        name: "Decimate",
        text: "Inflict 50 HP damage to an opponent’s coral. Then perform a D20 attack twice.",
        effects: [
          {
            type: "damage",
            amount: 50,
            target: {
              controller: "opponent",
              kind: CardKind.CORAL,
              zone: Zone.OPPONENT_REEF,
            },
          },
          {
            type: "attack",
            attackDice: "D20",
            repeat: 2,
          },
        ],
      },
    ],
    defense: { dice: "D12" },
  },

  // 🦈 HAMMERHEAD
  {
    id: "hammerhead",
    name: "Hammerhead",
    kind: CardKind.CREATURE,
    category: CardCategory.APEX,
    image: "/images/cards/apex/hammerhead.png",
    sortOrder: 18,
    cost: { rp: 6 },
    victoryPoints: 6,
    tags: ["apex", "shark"],
    bio: {
      commonName: "Hammerhead Shark",
      scientificName: "Sphyrnidae",
    },
    playRequirements: [REQUIRES_STRUCTURE],
    passives: [INTIMIDATION_PASSIVE],
    onPlay: [
      {
        id: "ravage",
        name: "Ravage",
        text: "Inflict 1D4 × 10 damage to coral. Then perform a D8 attack twice.",
        effects: [
          {
            type: "damage",
            amount: {
              type: "dice",
              dice: "D4",
              multiplier: 10,
            },
          },
          {
            type: "attack",
            attackDice: "D8",
            repeat: 2,
          },
        ],
      },
    ],
    defense: { dice: "D12" },
  },

  // 🦈 BULL SHARK (yours, unchanged)
  {
    id: "bull-shark",
    name: "Bull Shark",
    kind: CardKind.CREATURE,
    category: CardCategory.APEX,
    image: "/images/cards/apex/bull-shark.png",
    sortOrder: 20,
    cost: { rp: 6 },
    victoryPoints: 6,
    tags: ["apex", "shark"],
    bio: {
      commonName: "Bull Shark",
      scientificName: "Carcharhinus leucas",
    },
    playRequirements: [REQUIRES_STRUCTURE],
    passives: [INTIMIDATION_PASSIVE],
    onPlay: [
      {
        id: "tear-apart",
        name: "Tear Apart",
        effects: [
          {
            type: "damage",
            amount: { type: "dice", dice: "D4", multiplier: 10 },
          },
          {
            type: "attack",
            attackDice: "D10",
            repeat: 2,
          },
        ],
      },
    ],
    defense: { dice: "D8" },
  },

  // 🐋 PILOT WHALE
  {
    id: "pilot-whale",
    name: "Pilot Whale",
    kind: CardKind.CREATURE,
    category: CardCategory.APEX,
    image: "/images/cards/apex/pilot-whale.png",
    sortOrder: 25,
    cost: { rp: 7 },
    victoryPoints: 7,
    tags: ["apex", "whale"],
    bio: {
      commonName: "Pilot Whale",
    },
    playRequirements: [
      {
        ...REQUIRES_STRUCTURE,
        text: "Can only be played if a Drop Off structure card is in play on your reef.",
      },
    ],
    onPlay: [
      {
        id: "echo-disruption",
        name: "Echo Disruption",
        text: "Opponent cannot play support cards next turn.",
        effects: [{ type: "preventCardPlay" }],
      },
      {
        id: "deep-hunt",
        name: "Deep Hunt",
        effects: [
          {
            type: "attack",
            attackDice: "D20",
            repeat: 2,
          },
        ],
      },
    ],
    defense: { dice: "D8" },
  },

  // 🐬 BOTTLENOSE DOLPHIN
  {
    id: "bottlenose-dolphin",
    name: "Bottlenose Dolphin",
    kind: CardKind.CREATURE,
    category: CardCategory.APEX,
    image: "/images/cards/apex/bottlenose-dolphin.png",
    sortOrder: 30,
    cost: { rp: 5 },
    victoryPoints: 5,
    tags: ["apex", "dolphin"],
    playRequirements: [
      {
        id: "requires-sanctuary",
        type: "kindInPlay",
        requiredKind: CardKind.STRUCTURE,
        text: "Requires Marine Sanctuary.",
      },
    ],
    onPlay: [
      {
        id: "echo-locate",
        name: "Echo Locate",
        effects: [{ type: "drawCards", amount: 3 }],
      },
      {
        id: "savvy-hunter",
        name: "Savvy Hunter",
        effects: [
          {
            type: "attack",
            attackDice: "D10",
          },
        ],
      },
    ],
    defense: { dice: "D10" },
  },

  // 🐋 ORCA
  {
    id: "killer-whales",
    name: "Killer Whales",
    kind: CardKind.CREATURE,
    category: CardCategory.APEX,
    image: "/images/cards/apex/killer-whales.png",
    sortOrder: 35,
    cost: { rp: 10 },
    victoryPoints: 10,
    tags: ["apex", "orca"],
    playRequirements: [REQUIRES_STRUCTURE],
    onPlay: [
      {
        id: "apex-hunter",
        name: "Apex Hunter",
        effects: [
          {
            type: "attack",
            attackDice: "D20",
            repeat: 2,
          },
        ],
      },
    ],
    defense: { dice: "D20" },
  },
];