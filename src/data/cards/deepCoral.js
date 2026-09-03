import {
  CardCategory,
  CardKind,
  CreatureClass,
  CreatureZone,
  EffectType,
  Timing,
  makeCreatureSlot,
} from "./types";

const deepSlot = (slotClass, count = 1) => ({
  ...makeCreatureSlot(CreatureZone.DEEP, slotClass),
  kind: CardKind.CREATURE,
  count,
});

const passiveText = (id, text) => ({
  id,
  name: text.split(":")[0],
  text,
  timing: Timing.PASSIVE,
});

const generateRp = (amount) => ({
  id: `generate-${amount}-rp`,
  name: "Biosynthesis",
  text: `Collect ${amount}RP at the start of your turn.`,
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

function deepCoral({
  id,
  name,
  stage,
  cost,
  health,
  generate,
  passives = [],
  slots = [],
  nextCardId,
  sortOrder,
  image,
}) {
  return {
    id,
    name,
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    zone: CreatureZone.DEEP,
    stage: stage === "base" ? 0 : stage === "stage1" ? 1 : 2,
    stageLabel: stage === "base" ? "Base" : stage === "stage1" ? "Stage 1" : "Stage 2",
    image,
    sortOrder,
    cost: { rp: cost },
    health,
    tags: ["coral", "deep", stage],
    slots,
    upgrade: nextCardId
      ? {
          canUpgrade: true,
          nextCardId,
          timing: "oncePerTurn",
          cost: { rp: stage === "base" ? 2 : 4 },
          text: `Upgrade to ${name} ${stage === "base" ? "Stage 1" : "Stage 2"}.`,
        }
      : noUpgrade,
    passives: [
      ...(generate ? [generateRp(generate)] : []),
      ...passives.map((text, index) => passiveText(`${id}-passive-${index}`, text)),
    ],
    onPlay: [],
    actions: [],
    flavorText: "",
    set: {
      id: "deep",
      name: "Deep",
      collectorNumber: null,
      totalInSet: null,
    },
  };
}

export const deepCoralCards = [
  deepCoral({
    id: "bamboo_coral_base",
    name: "Bamboo Coral",
    stage: "base",
    cost: 1,
    health: 10,
    generate: 1,
    image: "/images/cards/coral/Deep/bamboo-coral-base.png",
    slots: [
      deepSlot(CreatureClass.FISH, 1),
      deepSlot(CreatureClass.INVERTEBRATE, 1),
    ],
    nextCardId: "bamboo_coral_stage1",
    sortOrder: 930,
  }),
  deepCoral({
    id: "bamboo_coral_stage1",
    name: "Bamboo Coral",
    stage: "stage1",
    cost: 3,
    health: 30,
    generate: 2,
    image: "/images/cards/coral/Deep/bamboo-coral-stage-1.png",
    slots: [
      deepSlot(CreatureClass.PREDATOR, 1),
      deepSlot(CreatureClass.FISH, 1),
      deepSlot(CreatureClass.INVERTEBRATE, 2),
    ],
    nextCardId: "bamboo_coral_stage2",
    sortOrder: 931,
  }),
  deepCoral({
    id: "bamboo_coral_stage2",
    name: "Bamboo Coral",
    stage: "stage2",
    cost: 5,
    health: 40,
    generate: 5,
    image: "/images/cards/coral/Deep/bamboo-coral-stage-2.png",
    passives: [
      "Shelter: Creatures attached to this coral gain +1 on their defensive dice rolls.",
    ],
    slots: [
      deepSlot(CreatureClass.APEX, 1),
      deepSlot(CreatureClass.PREDATOR, 2),
      deepSlot(CreatureClass.INVERTEBRATE, 3),
    ],
    sortOrder: 932,
  }),
  deepCoral({
    id: "black_coral_base",
    name: "Black Coral",
    stage: "base",
    cost: 1,
    health: 10,
    generate: 1,
    image: "/images/cards/coral/Deep/black-coral-base.png",
    slots: [
      deepSlot(CreatureClass.FISH, 1),
      deepSlot(CreatureClass.INVERTEBRATE, 1),
    ],
    nextCardId: "black_coral_stage1",
    sortOrder: 940,
  }),
  deepCoral({
    id: "black_coral_stage1",
    name: "Black Coral",
    stage: "stage1",
    cost: 2,
    health: 20,
    generate: 2,
    image: "/images/cards/coral/Deep/black-coral-stage-1.png",
    slots: [
      deepSlot(CreatureClass.PREDATOR, 1),
      deepSlot(CreatureClass.FISH, 1),
      deepSlot(CreatureClass.INVERTEBRATE, 2),
    ],
    nextCardId: "black_coral_stage2",
    sortOrder: 941,
  }),
  deepCoral({
    id: "black_coral_stage2",
    name: "Black Coral",
    stage: "stage2",
    cost: 4,
    health: 30,
    generate: 3,
    image: "/images/cards/coral/Deep/black-coral-stage-2.png",
    passives: [
      "Jointed Structure: Once per turn, you may move a creature between your corals.",
    ],
    slots: [
      deepSlot(CreatureClass.APEX, 1),
      deepSlot(CreatureClass.PREDATOR, 1),
      deepSlot(CreatureClass.FISH, 1),
      deepSlot(CreatureClass.INVERTEBRATE, 3),
    ],
    sortOrder: 942,
  }),
  deepCoral({
    id: "deep_mushroom_base",
    name: "Deep Mushroom",
    stage: "base",
    cost: 2,
    health: 10,
    generate: 1,
    image: "/images/cards/coral/Deep/mushroom-coral-base.png",
    slots: [
      deepSlot(CreatureClass.FISH, 1),
      deepSlot(CreatureClass.INVERTEBRATE, 1),
    ],
    nextCardId: "deep_mushroom_stage1",
    sortOrder: 950,
  }),
  deepCoral({
    id: "deep_mushroom_stage1",
    name: "Deep Mushroom",
    stage: "stage1",
    cost: 3,
    health: 40,
    generate: 2,
    image: "/images/cards/coral/Deep/mushroom-coral-stage-1.png",
    slots: [
      deepSlot(CreatureClass.PREDATOR, 2),
      deepSlot(CreatureClass.INVERTEBRATE, 2),
    ],
    nextCardId: "deep_mushroom_stage2",
    sortOrder: 951,
  }),
  deepCoral({
    id: "deep_mushroom_stage2",
    name: "Deep Mushroom",
    stage: "stage2",
    cost: 6,
    health: 60,
    generate: 4,
    image: "/images/cards/coral/Deep/mushroom-coral-stage-2.png",
    passives: [
      "Recovery: Once per turn, you may heal 10HP of any coral on your reef.",
    ],
    slots: [
      deepSlot(CreatureClass.APEX, 2),
      deepSlot(CreatureClass.PREDATOR, 1),
      deepSlot(CreatureClass.INVERTEBRATE, 3),
    ],
    sortOrder: 952,
  }),
  deepCoral({
    id: "deep_sea_vent",
    name: "Deep Sea Vent",
    stage: "base",
    cost: 3,
    health: 30,
    image: "/images/cards/coral/Deep/deep-sea-vent.png",
    passives: [
      "Symbiosis: Collect 2RP for each Giant Tube Worm attached to this card.",
    ],
    slots: [
      deepSlot(CreatureClass.PREDATOR, 1),
      deepSlot(CreatureClass.FISH, 1),
      deepSlot(CreatureClass.INVERTEBRATE, 2),
    ],
    sortOrder: 960,
  }),
];
