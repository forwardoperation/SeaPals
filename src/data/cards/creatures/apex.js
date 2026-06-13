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

const REQUIRES_habitat = {
  id: "requires-habitat",
  type: "kindInPlay",
  requiredKind: CardKind.HABITAT,
  zone: Zone.YOUR_REEF,
  text: "Can only be played if a habitat card is in play on your reef.",
};

const reefApexCards = [
  // 🦈 GREAT WHITE
  {
    id: "great-white",
    name: "Great White",
    kind: CardKind.CREATURE,
    category: CardCategory.APEX,
    image: "/images/cards/apex/Reef/great-white.png",
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
        ...REQUIRES_habitat,
        text: "Can only be played if a Drop Off habitat card is in play on your reef.",
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
    image: "/images/cards/apex/Reef/tiger-shark.png",
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
        ...REQUIRES_habitat,
        text: "Can only be played if a Drop Off habitat card is in play on your reef.",
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
    image: "/images/cards/apex/Reef/hammerhead.png",
    sortOrder: 18,
    cost: { rp: 6 },
    victoryPoints: 6,
    tags: ["apex", "shark"],
    bio: {
      commonName: "Hammerhead Shark",
      scientificName: "Sphyrnidae",
    },
    playRequirements: [REQUIRES_habitat],
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
    image: "/images/cards/apex/Reef/bull-shark.png",
    sortOrder: 20,
    cost: { rp: 6 },
    victoryPoints: 6,
    tags: ["apex", "shark"],
    bio: {
      commonName: "Bull Shark",
      scientificName: "Carcharhinus leucas",
    },
    playRequirements: [REQUIRES_habitat],
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
    image: "/images/cards/apex/Oceanic/pilot-whale.png",
    sortOrder: 25,
    cost: { rp: 7 },
    victoryPoints: 7,
    tags: ["apex", "whale"],
    bio: {
      commonName: "Pilot Whale",
    },
    playRequirements: [
      {
        ...REQUIRES_habitat,
        text: "Can only be played if a Drop Off habitat card is in play on your reef.",
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
    image: "/images/cards/apex/Reef/bottlenose-dolpin.png",
    sortOrder: 30,
    cost: { rp: 5 },
    victoryPoints: 5,
    tags: ["apex", "dolphin"],
    playRequirements: [
      {
        id: "requires-sanctuary",
        type: "kindInPlay",
        requiredKind: CardKind.HABITAT,
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
    image: "/images/cards/apex/Oceanic/killer-whale.png",
    sortOrder: 35,
    cost: { rp: 10 },
    victoryPoints: 10,
    tags: ["apex", "orca"],
    playRequirements: [REQUIRES_habitat],
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

export const apexCards = reefApexCards.filter(
  (card) => !["pilot-whale", "killer-whales"].includes(card.id)
);
