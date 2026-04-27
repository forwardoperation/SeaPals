import { CardKind, CardCategory, Zone } from "../types";

export const apexCards = [
  {
    id: "bull-shark",
    name: "Bull Shark",
    kind: CardKind.CREATURE,
    category: CardCategory.APEX,
    image: "/images/cards/apex/bull-shark.png",

    sortOrder: 20,

    cost: { rp: 6 },
    victoryPoints: 6,

    tags: ["creature", "apex", "predator", "shark"],

    bio: {
      commonName: "Bull Shark",
      scientificName: "Carcharhinus leucas",
      role: "Apex Predator",
      habitat: "Coastal waters, estuaries, rivers",
      region: "Worldwide",
      diet: "Fish, rays, smaller sharks",
      length: "10’ 8”",
      weight: "450 lbs",
    },

    playRequirements: [
    {
        id: "requires-structure",
        type: "kindInPlay",
        requiredKind: CardKind.STRUCTURE,
        zone: Zone.YOUR_REEF,
        text: "Can only be played if a structure card is in play on your reef.",
    },
    ],

    passives: [
      {
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
      },
    ],

    onPlay: [
      {
        id: "tear-apart",
        name: "Tear Apart",
        text: "Inflict 1D4 × 10 damage to an opponent’s coral. Then perform a D10 attack against an opponent’s fish, predator, or apex creature twice.",
        effects: [
          {
            type: "damage",
            target: {
              controller: "opponent",
              kind: CardKind.CORAL,
              zone: Zone.OPPONENT_REEF,
            },
            amount: {
              type: "dice",
              dice: "D4",
              multiplier: 10,
            },
          },
          {
            type: "attack",
            attackDice: "D10",
            repeat: 2,
            target: {
              controller: "opponent",
              kind: CardKind.CREATURE,
              categories: [
                CardCategory.FISH,
                CardCategory.PREDATOR,
                CardCategory.APEX,
              ],
              zone: Zone.OPPONENT_REEF,
            },
          },
        ],
        icons: {
          attack: "d10_attack",
          targetable: [
            CardCategory.FISH,
            CardCategory.PREDATOR,
            CardCategory.APEX,
          ],
          repeat: 2,
        },
      },
    ],

    actions: [],

    defense: {
      dice: "D8",
    },

    flavorText:
      "Bull sharks can live in both salt and freshwater, cruising far up rivers.",

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },
];