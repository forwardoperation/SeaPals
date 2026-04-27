import {
  CardKind,
  CardCategory,
  EffectType,
  Timing,
  Weakness,
  Zone,
} from "./types";

const photosynthesis = (amount) => ({
  id: "photosynthesis",
  name: "Photosynthesis",
  text: `Collect ${amount} RP at the start of your turn.`,
  timing: Timing.START_OF_TURN,
  effect: {
    type: EffectType.GAIN_RESOURCE,
    resource: "rp",
    amount,
  },
});

const noUpgrade = {
  canUpgrade: false,
  nextCardId: null,
};

export const coralCards = [
  {
    id: "elkhorn-coral-base",
    name: "Elkhorn Coral",
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    stage: 0,
    stageLabel: "Base",
    image: "/images/cards/coral/elkhorn-coral-base.png",

    sortOrder: 1,

    cost: { rp: 1 },
    health: 10,

    tags: ["coral", "base", "structure", "elkhorn"],

    bio: {
      commonName: "Elkhorn Coral",
      scientificName: "Acropora palmata",
      role: "Reef Builder",
      habitat: "Shallow coral reefs",
      region: "FL Keys",
      diet: "Photosynthesis, plankton",
      length: "1’ 2”",
      weight: "3 lbs",
    },

    weaknesses: [
      Weakness.STORM,
      Weakness.HIGH_TEMPERATURE,
      Weakness.DISEASE,
    ],

    slots: [
      { kind: CardKind.CREATURE, tags: ["fish"], count: 1 },
      { kind: CardKind.CREATURE, tags: ["invertebrate"], count: 1 },
    ],

    upgrade: {
      canUpgrade: true,
      nextCardId: "elkhorn-coral-stage-1",
      timing: "oncePerTurn",
      cost: { rp: 2 },
      text: "Upgrade to Elkhorn Coral Stage 1.",
    },

    passives: [photosynthesis(1)],

    onPlay: [],
    actions: [],

    flavorText:
      "Its antler-like branches break waves and shelter young fish in shallow reefs.",

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },

  {
    id: "elkhorn-coral-stage-1",
    name: "Elkhorn Coral",
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    stage: 1,
    stageLabel: "Stage 1",
    image: "/images/cards/coral/elkhorn-coral-stage-1.png",

    sortOrder: 2,

    cost: { rp: 2 },
    health: 20,

    tags: ["coral", "stage-1", "structure", "elkhorn"],

    bio: {
      commonName: "Elkhorn Coral",
      scientificName: "Acropora palmata",
      role: "Reef Builder",
      habitat: "Shallow coral reefs",
      region: "FL Keys",
      diet: "Photosynthesis, plankton",
      length: "3’ 2”",
      weight: "50 lbs",
    },

    weaknesses: [
      Weakness.STORM,
      Weakness.HIGH_TEMPERATURE,
      Weakness.DISEASE,
    ],

    slots: [
      { kind: CardKind.CREATURE, tags: ["fish"], count: 2 },
      { kind: CardKind.CREATURE, tags: ["invertebrate"], count: 1 },
    ],

    upgrade: {
      canUpgrade: true,
      nextCardId: "elkhorn-coral-stage-2",
      timing: "oncePerTurn",
      cost: { rp: 6 },
      text: "Upgrade to Elkhorn Coral Stage 2.",
    },

    passives: [
      photosynthesis(2),
      {
        id: "fragment",
        name: "Fragment",
        text: "If this coral is destroyed, search your discard for a base class Elkhorn Coral and place it into your hand.",
        timing: Timing.ON_DESTROYED,
        effect: {
          type: EffectType.RECOVER_CARD_FROM_DISCARD,
          targetCardId: "elkhorn-coral-base",
          destination: Zone.HAND,
        },
      },
    ],

    onPlay: [],
    actions: [],

    flavorText:
      "Its wide, flattened limbs catch sunlight efficiently in turbulent water.",

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },

  {
    id: "elkhorn-coral-stage-2",
    name: "Elkhorn Coral",
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    stage: 2,
    stageLabel: "Stage 2",
    image: "/images/cards/coral/elkhorn-coral-stage-2.png",

    sortOrder: 3,

    cost: { rp: 6 },
    health: 30,

    tags: ["coral", "stage-2", "structure", "elkhorn"],

    bio: {
      commonName: "Elkhorn Coral",
      scientificName: "Acropora palmata",
      role: "Reef Builder",
      habitat: "Shallow coral reefs",
      region: "FL Keys",
      diet: "Photosynthesis, plankton",
      length: "5’ 1”",
      weight: "200 lbs",
    },

    weaknesses: [
      Weakness.STORM,
      Weakness.HIGH_TEMPERATURE,
      Weakness.DISEASE,
    ],

    slots: [
      { kind: CardKind.CREATURE, tags: ["fish"], count: 3 },
      { kind: CardKind.CREATURE, tags: ["invertebrate"], count: 3 },
    ],

    upgrade: noUpgrade,

    passives: [
      photosynthesis(6),
      {
        id: "fragment",
        name: "Fragment",
        text: "If this coral is destroyed, search your discard for two base class Elkhorn Corals and place them into your hand.",
        timing: Timing.ON_DESTROYED,
        effect: {
          type: EffectType.RECOVER_CARD_FROM_DISCARD,
          targetCardId: "elkhorn-coral-base",
          destination: Zone.HAND,
          amount: 2,
        },
      },
    ],

    onPlay: [],
    actions: [],

    flavorText:
      "Elkhorn coral is a rugged reef builder with thick branches that resemble elk antlers.",

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },

  {
    id: "boulder-star-coral-base",
    name: "Boulder Star Coral",
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    stage: 0,
    stageLabel: "Base",
    image: "/images/cards/coral/boulder-star-coral-base.png",

    sortOrder: 10,

    cost: { rp: 2 },
    health: 20,

    tags: ["coral", "base", "boulder-star"],

    bio: {
      commonName: "Boulder Star Coral",
      scientificName: "",
      role: "Reef Builder",
      habitat: "Coral reefs",
      region: "FL Keys",
      diet: "Photosynthesis, plankton",
      length: "6”",
      weight: "2 lbs",
    },

    weaknesses: [Weakness.HIGH_TEMPERATURE, Weakness.DISEASE],

    slots: [{ kind: CardKind.CREATURE, tags: ["fish"], count: 2 }],

    upgrade: {
      canUpgrade: true,
      nextCardId: "boulder-star-coral-stage-1",
      timing: "oncePerTurn",
      cost: { rp: 3 },
      text: "Upgrade to Boulder Star Coral Stage 1.",
    },

    passives: [photosynthesis(1)],

    onPlay: [],
    actions: [],

    flavorText: "",

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },

  {
    id: "boulder-star-coral-stage-1",
    name: "Boulder Star Coral",
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    stage: 1,
    stageLabel: "Stage 1",
    image: "/images/cards/coral/boulder-star-coral-stage-1.png",

    sortOrder: 11,

    cost: { rp: 3 },
    health: 40,

    tags: ["coral", "stage-1", "boulder-star"],

    bio: {
      commonName: "Boulder Star Coral",
      scientificName: "",
      role: "Reef Builder",
      habitat: "Coral reefs",
      region: "FL Keys",
      diet: "Photosynthesis, plankton",
      length: "3’ 8”",
      weight: "350 lbs",
    },

    weaknesses: [Weakness.HIGH_TEMPERATURE, Weakness.DISEASE],

    slots: [
      { kind: CardKind.CREATURE, tags: ["fish"], count: 2 },
      { kind: CardKind.CREATURE, tags: ["invertebrate"], count: 1 },
    ],

    upgrade: {
      canUpgrade: true,
      nextCardId: "boulder-star-coral-stage-2",
      timing: "oncePerTurn",
      cost: { rp: 7 },
      text: "Upgrade to Boulder Star Coral Stage 2.",
    },

    passives: [photosynthesis(2)],

    onPlay: [],
    actions: [],

    flavorText: "",

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },

  {
    id: "boulder-star-coral-stage-2",
    name: "Boulder Star Coral",
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    stage: 2,
    stageLabel: "Stage 2",
    image: "/images/cards/coral/boulder-star-coral-stage-2.png",

    sortOrder: 12,

    cost: { rp: 7 },
    health: 80,

    tags: ["coral", "stage-2", "boulder-star"],

    bio: {
      commonName: "Boulder Star Coral",
      scientificName: "",
      role: "Reef Builder",
      habitat: "Coral reefs",
      region: "FL Keys",
      diet: "Photosynthesis, plankton",
      length: "3’ 3”",
      weight: "925 lbs",
    },

    weaknesses: [Weakness.DISEASE],

    slots: [
      { kind: CardKind.CREATURE, tags: ["fish"], count: 3 },
      { kind: CardKind.CREATURE, tags: ["apex"], count: 1 },
    ],

    upgrade: noUpgrade,

    passives: [
      {
        id: "sturdy",
        name: "Sturdy",
        text: "All corals on your reef gain +10 HP.",
        timing: Timing.PASSIVE,
        effect: {
          type: "modifyHealth",
          targetKind: CardKind.CORAL,
          controller: "you",
          amount: 10,
        },
      },
      photosynthesis(5),
    ],

    onPlay: [],
    actions: [],

    flavorText: "",

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },

  {
    id: "pillar-coral-base",
    name: "Pillar Coral",
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    stage: 0,
    stageLabel: "Base",
    image: "/images/cards/coral/pillar-coral-base.png",

    sortOrder: 20,

    cost: { rp: 3 },
    health: 40,

    tags: ["coral", "base", "pillar"],

    bio: {
      commonName: "Pillar Coral",
      scientificName: "",
      role: "Reef Builder",
      habitat: "Coral reefs",
      region: "FL Keys",
      diet: "Photosynthesis, plankton",
      length: "6’",
      weight: "300 lbs",
    },

    weaknesses: [
      Weakness.STORM,
      Weakness.HIGH_TEMPERATURE,
      Weakness.DISEASE,
    ],

    slots: [
      { kind: CardKind.CREATURE, tags: ["fish"], count: 1 },
      { kind: CardKind.CREATURE, tags: ["invertebrate"], count: 1 },
      { kind: CardKind.CREATURE, tags: ["apex"], count: 1 },
    ],

    upgrade: noUpgrade,

    passives: [photosynthesis(2)],

    onPlay: [],
    actions: [],

    flavorText: "",

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },

  {
    id: "brain-coral-base",
    name: "Brain Coral",
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    stage: 0,
    stageLabel: "Base",
    image: "/images/cards/coral/brain-coral-base.png",

    sortOrder: 30,

    cost: { rp: 1 },
    health: 10,

    tags: ["coral", "base", "brain"],

    bio: {
      commonName: "Brain Coral",
      scientificName: "",
      role: "Reef Builder",
      habitat: "Coral reefs",
      region: "FL Keys",
      diet: "Photosynthesis, plankton",
      length: "6”",
      weight: "10 lbs",
    },

    weaknesses: [Weakness.DISEASE],

    slots: [{ kind: CardKind.CREATURE, tags: ["fish"], count: 1 }],

    upgrade: {
      canUpgrade: true,
      nextCardId: "brain-coral-stage-1",
      timing: "oncePerTurn",
      cost: { rp: 2 },
      text: "Upgrade to Brain Coral Stage 1.",
    },

    passives: [photosynthesis(1)],

    onPlay: [],
    actions: [],

    flavorText: "",

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },

  {
    id: "brain-coral-stage-1",
    name: "Brain Coral",
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    stage: 1,
    stageLabel: "Stage 1",
    image: "/images/cards/coral/brain-coral-stage-1.png",

    sortOrder: 31,

    cost: { rp: 2 },
    health: 20,

    tags: ["coral", "stage-1", "brain"],

    bio: {
      commonName: "Brain Coral",
      scientificName: "",
      role: "Reef Builder",
      habitat: "Coral reefs",
      region: "FL Keys",
      diet: "Photosynthesis, plankton",
      length: "8”",
      weight: "40 lbs",
    },

    weaknesses: [Weakness.DISEASE],

    slots: [
      { kind: CardKind.CREATURE, tags: ["fish"], count: 1 },
      { kind: CardKind.CREATURE, tags: ["invertebrate"], count: 1 },
    ],

    upgrade: {
      canUpgrade: true,
      nextCardId: "brain-coral-stage-2",
      timing: "oncePerTurn",
      cost: { rp: 5 },
      text: "Upgrade to Brain Coral Stage 2.",
    },

    passives: [photosynthesis(2)],

    onPlay: [],
    actions: [],

    flavorText: "",

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },

  {
    id: "brain-coral-stage-2",
    name: "Brain Coral",
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    stage: 2,
    stageLabel: "Stage 2",
    image: "/images/cards/coral/brain-coral-stage-2.png",

    sortOrder: 32,

    cost: { rp: 5 },
    health: 60,

    tags: ["coral", "stage-2", "brain"],

    bio: {
      commonName: "Brain Coral",
      scientificName: "",
      role: "Reef Builder",
      habitat: "Coral reefs",
      region: "FL Keys",
      diet: "Photosynthesis, plankton",
      length: "1’ 8”",
      weight: "110 lbs",
    },

    weaknesses: [Weakness.DISEASE],

    slots: [
      { kind: CardKind.CREATURE, tags: ["fish"], count: 3 },
      { kind: CardKind.CREATURE, tags: ["apex"], count: 1 },
    ],

    upgrade: noUpgrade,

    passives: [
      photosynthesis(5),
      {
        id: "neural-network",
        name: "Neural Network",
        text: "As often as you like on your turn, move 1 damage counter from one of your coral to another coral if the second coral does not already have this condition.",
        timing: Timing.ACTION_PHASE,
        effect: {
          type: "moveDamageCounter",
          amount: 1,
          source: {
            controller: "you",
            kind: CardKind.CORAL,
          },
          destination: {
            controller: "you",
            kind: CardKind.CORAL,
            cannotAlreadyHaveCondition: true,
          },
        },
      },
    ],

    onPlay: [],
    actions: [],

    flavorText: "",

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },

  {
    id: "lettuce-coral-base",
    name: "Lettuce Coral",
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    stage: 0,
    stageLabel: "Base",
    image: "/images/cards/coral/lettuce-coral-base.png",

    sortOrder: 40,

    cost: { rp: 1 },
    health: 10,

    tags: ["coral", "base", "lettuce"],

    bio: {
      commonName: "Lettuce Coral",
      scientificName: "",
      role: "Reef Builder",
      habitat: "Coral reefs",
      region: "FL Keys",
      diet: "Photosynthesis, plankton",
      length: "8”",
      weight: "12 lbs",
    },

    weaknesses: [Weakness.HIGH_TEMPERATURE, Weakness.DISEASE],

    slots: [{ kind: CardKind.CREATURE, tags: ["fish"], count: 1 }],

    upgrade: {
      canUpgrade: true,
      nextCardId: "lettuce-coral-stage-1",
      timing: "oncePerTurn",
      cost: { rp: 2 },
      text: "Upgrade to Lettuce Coral Stage 1.",
    },

    passives: [photosynthesis(1)],

    onPlay: [],
    actions: [],

    flavorText: "",

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },

  {
    id: "lettuce-coral-stage-1",
    name: "Lettuce Coral",
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    stage: 1,
    stageLabel: "Stage 1",
    image: "/images/cards/coral/lettuce-coral-stage-1.png",

    sortOrder: 41,

    cost: { rp: 2 },
    health: 30,

    tags: ["coral", "stage-1", "lettuce"],

    bio: {
      commonName: "Lettuce Coral",
      scientificName: "",
      role: "Reef Builder",
      habitat: "Coral reefs",
      region: "FL Keys",
      diet: "Photosynthesis, plankton",
      length: "3’ 4”",
      weight: "24 lbs",
    },

    weaknesses: [Weakness.HIGH_TEMPERATURE, Weakness.DISEASE],

    slots: [
      { kind: CardKind.CREATURE, tags: ["fish"], count: 2 },
      { kind: CardKind.CREATURE, tags: ["invertebrate"], count: 1 },
    ],

    upgrade: noUpgrade,

    passives: [photosynthesis(3)],

    onPlay: [],
    actions: [],

    flavorText: "",

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },

  {
    id: "staghorn-coral-base",
    name: "Staghorn Coral",
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    stage: 0,
    stageLabel: "Base",
    image: "/images/cards/coral/staghorn-coral-base.png",

    sortOrder: 50,

    cost: { rp: 1 },
    health: 10,

    tags: ["coral", "base", "staghorn"],

    bio: {
      commonName: "Staghorn Coral",
      scientificName: "",
      role: "Reef Builder",
      habitat: "Coral reefs",
      region: "FL Keys",
      diet: "Photosynthesis, plankton",
      length: "3’",
      weight: "35 lbs",
    },

    weaknesses: [
      Weakness.STORM,
      Weakness.HIGH_TEMPERATURE,
      Weakness.DISEASE,
    ],

    slots: [{ kind: CardKind.CREATURE, tags: ["fish"], count: 1 }],

    upgrade: noUpgrade,

    passives: [
      photosynthesis(1),
      {
        id: "fragment",
        name: "Fragment",
        text: "Search your deck for another Staghorn Coral and place it into your hand.",
        timing: Timing.ON_PLAY,
        effect: {
          type: "searchDeck",
          targetCardId: "staghorn-coral-base",
          destination: Zone.HAND,
          amount: 1,
        },
      },
    ],

    onPlay: [],
    actions: [],

    flavorText: "",

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },

  {
    id: "clubfinger-coral-base",
    name: "Clubfinger Coral",
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    stage: 0,
    stageLabel: "Base",
    image: "/images/cards/coral/clubfinger-coral-base.png",

    sortOrder: 60,

    cost: { rp: 1 },
    health: 10,

    tags: ["coral", "base", "clubfinger"],

    bio: {
      commonName: "Clubfinger Coral",
      scientificName: "",
      role: "Reef Builder",
      habitat: "Coral reefs",
      region: "FL Keys",
      diet: "Photosynthesis, plankton",
      length: "4.5”",
      weight: "300 g",
    },

    weaknesses: [
      Weakness.STORM,
      Weakness.HIGH_TEMPERATURE,
      Weakness.DISEASE,
    ],

    slots: [{ kind: CardKind.CREATURE, tags: ["fish"], count: 1 }],

    upgrade: {
      canUpgrade: true,
      nextCardId: "clubfinger-coral-stage-1",
      timing: "oncePerTurn",
      cost: { rp: 2 },
      text: "Upgrade to Clubfinger Coral Stage 1.",
    },

    passives: [photosynthesis(1)],

    onPlay: [],
    actions: [],

    flavorText: "",

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },

  {
    id: "clubfinger-coral-stage-1",
    name: "Clubfinger Coral",
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    stage: 1,
    stageLabel: "Stage 1",
    image: "/images/cards/coral/clubfinger-coral-stage-1.png",

    sortOrder: 61,

    cost: { rp: 2 },
    health: 30,

    tags: ["coral", "stage-1", "clubfinger"],

    bio: {
      commonName: "Clubfinger Coral",
      scientificName: "",
      role: "Reef Builder",
      habitat: "Coral reefs",
      region: "FL Keys",
      diet: "Photosynthesis, plankton",
      length: "1’ 8”",
      weight: "12 lbs",
    },

    weaknesses: [
      Weakness.STORM,
      Weakness.HIGH_TEMPERATURE,
      Weakness.DISEASE,
    ],

    slots: [
      { kind: CardKind.CREATURE, tags: ["fish"], count: 2 },
      { kind: CardKind.CREATURE, tags: ["invertebrate"], count: 1 },
    ],

    upgrade: noUpgrade,

    passives: [photosynthesis(2)],

    onPlay: [],
    actions: [],

    flavorText: "",

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },

  {
    id: "mustard-hill-coral-base",
    name: "Mustard Hill Coral",
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    stage: 0,
    stageLabel: "Base",
    image: "/images/cards/coral/mustard-hill-coral-base.png",

    sortOrder: 70,

    cost: { rp: 3 },
    health: 30,

    tags: ["coral", "base", "mustard-hill"],

    bio: {
      commonName: "Mustard Hill Coral",
      scientificName: "",
      role: "Reef Builder",
      habitat: "Coral reefs",
      region: "FL Keys",
      diet: "Photosynthesis, plankton",
      length: "8”",
      weight: "12 lbs",
    },

    weaknesses: [],

    slots: [{ kind: CardKind.CREATURE, tags: ["fish"], count: 1 }],

    upgrade: noUpgrade,

    passives: [photosynthesis(2)],

    onPlay: [],
    actions: [],

    flavorText: "",

    set: {
      id: "genesis",
      name: "Genesis",
      collectorNumber: null,
      totalInSet: null,
    },
  },
];