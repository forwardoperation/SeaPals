import { CardKind, CardCategory } from "./types";

export const structureCards = [
  {
    id: "rock-arch",
    name: "Rock Arch",
    kind: CardKind.STRUCTURE,
    category: CardCategory.STRUCTURE,
    image: "/images/cards/support/rock-arch.png",

    sortOrder: 300,

    cost: { rp: 4 },

    tags: ["structure", "reef-feature", "rock-arch"],

    playRequirements: [],

    passives: [],

    onPlay: [],

    actions: [],

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },
  {
    id: "drop-off",
    name: "Drop Off",
    kind: CardKind.STRUCTURE,
    category: CardCategory.STRUCTURE,
    image: "/images/cards/support/drop-off.png",

    sortOrder: 301,

    cost: { rp: 4 },

    tags: ["structure", "reef-feature", "drop-off"],

    playRequirements: [],

    passives: [],

    onPlay: [],

    actions: [],

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },
];