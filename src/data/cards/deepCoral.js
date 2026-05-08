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
  name: "Generate RP",
  text: `Generate ${amount}RP at the start of your turn.`,
  timing: Timing.START_OF_TURN,
  effect: {
    type: EffectType.GAIN_RESOURCE,
    resource: "rp",
    amount,
  },
});

const actionText = (id, text) => ({
  id,
  name: text.split(":")[0],
  text,
  timing: Timing.ACTION_PHASE,
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
  actions = [],
  slots = [],
  nextCardId,
  sortOrder,
}) {
  return {
    id,
    name,
    kind: CardKind.CORAL,
    category: CardCategory.CORAL,
    zone: CreatureZone.DEEP,
    stage: stage === "base" ? 0 : stage === "stage1" ? 1 : 2,
    stageLabel: stage === "base" ? "Base" : stage === "stage1" ? "Stage 1" : "Stage 2",
    image: `/images/cards/deep-coral/${id}.png`,
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
      generateRp(generate),
      ...passives.map((text, index) => passiveText(`${id}-passive-${index}`, text)),
    ],
    onPlay: [],
    actions: actions.map((text, index) => actionText(`${id}-action-${index}`, text)),
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
    id: "moonlight_coral_base",
    name: "Moonlight Coral",
    stage: "base",
    cost: 1,
    health: 10,
    generate: 1,
    slots: [
      deepSlot(CreatureClass.INVERTEBRATE, 1),
      deepSlot(CreatureClass.FISH, 1),
    ],
    nextCardId: "moonlight_coral_stage1",
    sortOrder: 920,
  }),
  deepCoral({
    id: "moonlight_coral_stage1",
    name: "Moonlight Coral",
    stage: "stage1",
    cost: 2,
    health: 20,
    generate: 2,
    actions: [
      "Recovery: Pay 2RP to heal this coral by 1HP. Can only be used once per turn.",
    ],
    slots: [
      deepSlot(CreatureClass.INVERTEBRATE, 2),
      deepSlot(CreatureClass.FISH, 1),
      deepSlot(CreatureClass.PREDATOR, 1),
    ],
    nextCardId: "moonlight_coral_stage2",
    sortOrder: 921,
  }),
  deepCoral({
    id: "moonlight_coral_stage2",
    name: "Moonlight Coral",
    stage: "stage2",
    cost: 4,
    health: 30,
    generate: 3,
    actions: [
      "Recovery: Pay 2RP to heal this coral by 1HP. Can only be used once per turn.",
    ],
    slots: [
      deepSlot(CreatureClass.INVERTEBRATE, 3),
      deepSlot(CreatureClass.PREDATOR, 1),
      deepSlot(CreatureClass.APEX, 1),
    ],
    sortOrder: 922,
  }),
  deepCoral({
    id: "bamboo_coral_base",
    name: "Bamboo Coral",
    stage: "base",
    cost: 1,
    health: 10,
    generate: 1,
    actions: [
      "Jointed Structure: Once per turn, you may move one creature between your corals.",
    ],
    slots: [
      deepSlot(CreatureClass.INVERTEBRATE, 1),
      deepSlot(CreatureClass.FISH, 1),
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
    actions: [
      "Jointed Structure: Once per turn, you may move one creature between your corals.",
    ],
    slots: [
      deepSlot(CreatureClass.INVERTEBRATE, 2),
      deepSlot(CreatureClass.FISH, 1),
      deepSlot(CreatureClass.PREDATOR, 1),
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
    generate: 4,
    actions: [
      "Living Framework: Once per turn, you may move up to two creatures between your corals.",
    ],
    slots: [
      deepSlot(CreatureClass.INVERTEBRATE, 3),
      deepSlot(CreatureClass.PREDATOR, 2),
      deepSlot(CreatureClass.APEX, 1),
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
    passives: [
      "Shadow Cover: Creatures played onto this coral cannot be targeted on the turn they are played.",
    ],
    slots: [
      deepSlot(CreatureClass.INVERTEBRATE, 1),
      deepSlot(CreatureClass.FISH, 1),
    ],
    nextCardId: "black_coral_stage1",
    sortOrder: 940,
  }),
  deepCoral({
    id: "black_coral_stage1",
    name: "Black Coral",
    stage: "stage1",
    cost: 3,
    health: 20,
    generate: 3,
    passives: [
      "Abyss Veil: The first attack each turn against a creature on this coral has disadvantage.",
    ],
    slots: [
      deepSlot(CreatureClass.INVERTEBRATE, 2),
      deepSlot(CreatureClass.PREDATOR, 2),
    ],
    nextCardId: "black_coral_stage2",
    sortOrder: 941,
  }),
  deepCoral({
    id: "black_coral_stage2",
    name: "Black Coral",
    stage: "stage2",
    cost: 6,
    health: 50,
    generate: 4,
    passives: [
      "Abyss Veil: The first attack each turn against a creature on this coral has disadvantage.",
    ],
    slots: [
      deepSlot(CreatureClass.INVERTEBRATE, 3),
      deepSlot(CreatureClass.FISH, 2),
      deepSlot(CreatureClass.PREDATOR, 2),
      deepSlot(CreatureClass.APEX, 1),
    ],
    sortOrder: 942,
  }),
  deepCoral({
    id: "giant_mushroom_base",
    name: "Giant Mushroom Coral",
    stage: "base",
    cost: 3,
    health: 40,
    generate: 2,
    passives: [
      "Massive Colony: This coral cannot be destroyed by a single attack.",
    ],
    slots: [
      deepSlot(CreatureClass.INVERTEBRATE, 2),
      deepSlot(CreatureClass.FISH, 2),
    ],
    nextCardId: "giant_mushroom_stage1",
    sortOrder: 950,
  }),
  deepCoral({
    id: "giant_mushroom_stage1",
    name: "Giant Mushroom Coral",
    stage: "stage1",
    cost: 4,
    health: 60,
    generate: 3,
    passives: ["Living Fortress: Creatures on this coral gain +2 defense."],
    slots: [
      deepSlot(CreatureClass.INVERTEBRATE, 3),
      deepSlot(CreatureClass.FISH, 2),
      deepSlot(CreatureClass.PREDATOR, 1),
    ],
    nextCardId: "giant_mushroom_stage2",
    sortOrder: 951,
  }),
  deepCoral({
    id: "giant_mushroom_stage2",
    name: "Giant Mushroom Coral",
    stage: "stage2",
    cost: 7,
    health: 70,
    generate: 4,
    slots: [
      deepSlot(CreatureClass.INVERTEBRATE, 4),
      deepSlot(CreatureClass.PREDATOR, 1),
      deepSlot(CreatureClass.APEX, 2),
    ],
    sortOrder: 952,
  }),
  deepCoral({
    id: "thermal_vent_base",
    name: "Thermal Vent",
    stage: "base",
    cost: 8,
    health: 60,
    generate: 2,
    slots: [
      deepSlot(CreatureClass.INVERTEBRATE, 6),
      deepSlot(CreatureClass.APEX, 1),
    ],
    sortOrder: 960,
  }),
];
