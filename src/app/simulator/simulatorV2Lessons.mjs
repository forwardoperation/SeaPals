import {
  createSimulatorTutorialContract,
  SIMULATOR_TUTORIAL_ACTION_TYPES as ACTION,
} from "./tutorialContract.mjs";

export const SIMULATOR_V2_LESSON_PROGRESS_KEY = "seapals-simulator-v2-lessons-v2";

export const SIMULATOR_V2_LESSON_CONCEPTS = Object.freeze({
  ROUND_CONDITIONS: "round-conditions",
  CORALS: "corals",
  RESOURCE_POINTS: "resource-points",
  DRAWING: "drawing",
  CREATURE_SLOTS: "creature-slots",
  REEF_LAYOUT: "reef-layout",
  VICTORY_POINTS: "victory-points",
  ATTACKING: "attacking",
  OPPONENT_TURNS: "opponent-turns",
  DEFENDING: "defending",
  PASSIVE_ABILITIES: "passive-abilities",
  ON_PLAY_ABILITIES: "on-play-abilities",
  NON_ATTACK_ACTIONS: "non-attack-actions",
  SUPPORT_CARDS: "support-cards",
  DECK_SEARCH: "deck-search",
  STATUS_EFFECTS: "status-effects",
  CORAL_UPGRADES: "coral-upgrades",
  SCHOOL_DENSITY: "school-density",
  OPEN_WATER: "open-water",
  HABITATS: "habitats",
  FILTER_FEEDERS: "filter-feeders",
  APEX: "apex",
  MULTI_ATTACK: "multi-attack",
  TURN_PLANNING: "turn-planning",
});

const MAIN_REQUIREMENT = { path: "phase", operator: "equals", value: "main" };
const LESSON_RANDOM_SEED_BASE = 0x5EA90000;
const atLeast = (path, value) => ({ path, operator: "at-least", value });
const equals = (path, value) => ({ path, operator: "equals", value });
const truthy = (path) => ({ path, operator: "truthy" });

function checkpoint(id, actionType, title, instruction, requirements = [], { actor = "player" } = {}) {
  return {
    id,
    actionType,
    title,
    instruction,
    requirements: [equals("actor", actor), ...requirements],
  };
}

const collectCheckpoint = () => checkpoint(
  "tutorial-collect-rp", ACTION.RP_COLLECTED, "Collect your RP",
  "Begin the round and watch your RP bank grow.",
  [atLeast("details.collected", 1)],
);

const drawCheckpoint = ({
  id = "tutorial-draw-card",
  title = "Choose your draw",
  deckType = "pals",
  instruction = `Draw one card from the ${deckType === "foundation" ? "Foundation" : "Pals"} Deck.`,
} = {}) => checkpoint(
  id, ACTION.CARD_DRAWN, title, instruction,
  [atLeast("details.count", 1), atLeast(`details.${deckType}Count`, 1)],
);

const buildCheckpoint = (id, title, cardId = null, { cardKind = "creature", placement = null } = {}) => checkpoint(
  id, ACTION.CARD_BUILT, title,
  "Choose the highlighted card from your hand and finish a legal placement.",
  [
    MAIN_REQUIREMENT,
    equals("details.cardKind", cardKind),
    ...(cardId ? [equals("details.cardId", cardId)] : []),
    ...(placement ? [equals("details.placement", placement)] : []),
  ],
);

const supportCheckpoint = (id, title, cardId) => checkpoint(
  id, ACTION.SUPPORT_PLAYED, title,
  "Play the highlighted Support card and finish its effect.",
  [MAIN_REQUIREMENT, truthy("details.accepted"), equals("details.cardId", cardId)],
);

const abilityCheckpoint = (id, title, cardId, actionName, targetCardId = null, actionId = actionName.toLowerCase().replace(/\s+/g, "-")) => checkpoint(
  id, ACTION.ABILITY_RESOLVED, title,
  "Use the highlighted non-attack ability and finish its effect.",
  [
    MAIN_REQUIREMENT,
    truthy("details.accepted"),
    equals("details.sourceCardId", cardId),
    equals("details.actionId", actionId),
    equals("details.actionName", actionName),
    ...(targetCardId ? [equals("details.targetCardId", targetCardId)] : []),
  ],
);

const victoryCheckpoint = (target) => checkpoint(
  "tutorial-earn-vp", ACTION.VP_EARNED, "Reach the VP goal",
  "Grow your ecosystem to " + target + " VP.",
  [atLeast("details.delta", 1), atLeast("details.to", target)],
);

function tableau(foundationCardId, placements = [], options = {}) {
  return {
    foundationCardId,
    placements: placements.map(([cardId, slotClass]) => ({ cardId, slotClass })),
    ...options,
  };
}

const homeReef = () => tableau("mustard-hill-coral-base", [
  ["sea-urchin", "invertebrate"],
  ["clownfish", "fish"],
]);

const firstLessonReef = () => [
  tableau("brain-coral-stage-1", [["sea-urchin", "invertebrate"]]),
  tableau("mustard-hill-coral-base"),
];

function seed(overrides = {}) {
  return {
    hand: [],
    foundationDeck: ["brain-coral-base"],
    palsDeck: ["clownfish"],
    conditionDeck: ["clear-water"],
    playerTableau: [],
    playerHabitats: [],
    opponentTableau: [tableau("mustard-hill-coral-base")],
    opponent: {},
    rp: 3,
    gamePhase: "main",
    round: 1,
    turn: 1,
    startingPlayer: "player",
    hasDrawnThisTurn: true,
    activeConditionId: "clear-water",
    opponentTurnMode: "observe",
    ...overrides,
  };
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function lesson(definition) {
  return deepFreeze({
    buildCards: {},
    placementTargets: {},
    supportCards: {},
    introducedConcepts: [],
    ...definition,
    randomSeed: Number.isInteger(definition.randomSeed)
      ? definition.randomSeed >>> 0
      : (LESSON_RANDOM_SEED_BASE + definition.number) >>> 0,
    contract: createSimulatorTutorialContract({
      id: "simulator-v2-" + definition.id,
      title: definition.title,
      checkpoints: definition.checkpoints,
    }),
  });
}

export const SIMULATOR_V2_LESSON_MODULES = deepFreeze([
  { id: "reef-basics", title: "Reef Basics", summary: "Build a home and welcome your first SeaPals.", lessonIds: ["first-reef"] },
  { id: "battle-basics", title: "Ability Basics", summary: "Use attacks, passive abilities, and a planned recovery action.", lessonIds: ["first-attack"] },
  { id: "support-recovery", title: "Recover and Rebuild", summary: "Clear a harmful status, search for the right upgrade, and rebuild your reef.", lessonIds: ["support-search"] },
  { id: "habitat-apex", title: "Build a Habitat", summary: "Meet Coral Reef's creature requirements, then unlock an Apex predator.", lessonIds: ["apex-predators"] },
  { id: "open-water", title: "Grow into Open Water", summary: "Expand School Density before committing it to a giant Filter Feeder.", lessonIds: ["filter-feeder"] },
]);

/** Short positions prepared inside the real Simulator. */
export const SIMULATOR_V2_LESSONS = Object.freeze([
  lesson({
    id: "first-reef", moduleId: "reef-basics", number: 1,
    title: "Build your first reef", duration: "6 min", goalLabel: "Set up and reach 1 VP",
    summary: "Build two Corals, read changing Conditions, place a creature, and level up your reef.",
    introduction: "In this lesson, you will learn the basics of setting up your ecosystem. Let’s get started!",
    completion: "You built two Corals, adapted to Coral Disease, and upgraded Brain Coral to open a Predator slot.",
    preVictoryMessage: "Excellent! Your ecosystem is really starting to build momentum.",
    celebration: "Your ecosystem has momentum!",
    skills: ["Conditions", "Corals", "Reef layout", "Resource Points", "Drawing", "Creature slots", "Coral upgrades", "Victory Points"],
    introducedConcepts: [
      SIMULATOR_V2_LESSON_CONCEPTS.ROUND_CONDITIONS,
      SIMULATOR_V2_LESSON_CONCEPTS.CORALS,
      SIMULATOR_V2_LESSON_CONCEPTS.RESOURCE_POINTS,
      SIMULATOR_V2_LESSON_CONCEPTS.DRAWING,
      SIMULATOR_V2_LESSON_CONCEPTS.CREATURE_SLOTS,
      SIMULATOR_V2_LESSON_CONCEPTS.REEF_LAYOUT,
      SIMULATOR_V2_LESSON_CONCEPTS.CORAL_UPGRADES,
      SIMULATOR_V2_LESSON_CONCEPTS.VICTORY_POINTS,
    ],
    focusCardId: "brain-coral-base", victoryTarget: 1,
    openingCardTourId: "brain-coral-base",
    setupCardId: "brain-coral-base",
    expectedDraws: {
      "tutorial-draw-card": { deckType: "pals", cardId: "sea-urchin" },
      "v2-draw-first-upgrade": { deckType: "foundation", cardId: "brain-coral-stage-1" },
    },
    seed: seed({
      hand: ["brain-coral-base", "mustard-hill-coral-base"],
      foundationDeck: ["brain-coral-stage-1"],
      palsDeck: ["sea-urchin"],
      conditionDeck: ["clear-water", "coral-disease"],
      gamePhase: "setup",
      round: 0,
      hasDrawnThisTurn: false,
      activeConditionId: null,
    }),
    checkpoints: [
      checkpoint("tutorial-setup", ACTION.MATCH_READY, "Place your first Coral", "Place Brain Coral, arrange the reef, then press Begin Round.", [atLeast("details.foundationCount", 1)]),
      checkpoint("tutorial-collect-rp", ACTION.RP_COLLECTED, "Collect your RP", "Begin the round and watch your RP bank grow.", [
        equals("round", 1),
        equals("details.collected", 2),
        equals("details.bankBefore", 2),
        equals("details.bankAfter", 4),
        equals("details.conditionId", "clear-water"),
      ]),
      drawCheckpoint(),
      buildCheckpoint("tutorial-build-card", "Give Sea Urchin a home", "sea-urchin"),
      buildCheckpoint("v2-place-resistant-coral", "Build around the next Condition", "mustard-hill-coral-base", { cardKind: "coral", placement: "foundation" }),
      checkpoint("v2-watch-coral-disease", ACTION.TURN_ENDED, "Reveal a new Condition", "End the turn and watch how Coral Disease changes your next RP collection."),
      checkpoint("v2-collect-under-coral-disease", ACTION.RP_COLLECTED, "Compare each Coral's RP", "Collect RP while Coral Disease affects only the Coral with the matching weakness.", [
        equals("round", 2),
        equals("details.collected", 3),
        equals("details.bankBefore", 1),
        equals("details.bankAfter", 4),
        equals("details.conditionId", "coral-disease"),
        equals("details.blockedFoundationCount", 1),
        equals("details.producingFoundationCount", 1),
      ]),
      drawCheckpoint({
        id: "v2-draw-first-upgrade",
        title: "Draw the next Coral stage",
        deckType: "foundation",
      }),
      buildCheckpoint("v2-upgrade-first-coral", "Open a Predator slot", "brain-coral-stage-1", { cardKind: "coral", placement: "foundation-upgrade" }),
      victoryCheckpoint(1),
    ],
    buildCards: {
      "tutorial-build-card": ["sea-urchin"],
      "v2-place-resistant-coral": ["mustard-hill-coral-base"],
      "v2-upgrade-first-coral": ["brain-coral-stage-1"],
    },
  }),
  lesson({
    id: "first-attack", moduleId: "battle-basics", number: 2,
    title: "Put abilities to work", duration: "9 min", goalLabel: "Use four abilities and reach 7 VP",
    summary: "Lead an attack, defend a counterattack, trigger a passive, recover a card, and unleash an On Play ability.",
    introduction: "In this lesson, you’ll learn to lead an attack with Porcupine Fish’s Crunch! I’ll guide you through choosing a target, rolling both dice, and reading the result before your opponent strikes back.",
    completion: "You led and read a full faceoff, defended a counterattack, saw a passive work automatically, recovered a card with a non-attack action, and triggered a Predator's On Play attack.",
    celebration: "Every ability had a job to do!",
    autoEndOpeningTurn: true,
    skills: ["Attack actions", "Offense and defense", "Passive abilities", "Recovery actions", "On Play abilities"],
    introducedConcepts: [
      SIMULATOR_V2_LESSON_CONCEPTS.ATTACKING,
      SIMULATOR_V2_LESSON_CONCEPTS.OPPONENT_TURNS,
      SIMULATOR_V2_LESSON_CONCEPTS.DEFENDING,
      SIMULATOR_V2_LESSON_CONCEPTS.PASSIVE_ABILITIES,
      SIMULATOR_V2_LESSON_CONCEPTS.ON_PLAY_ABILITIES,
      SIMULATOR_V2_LESSON_CONCEPTS.NON_ATTACK_ACTIONS,
    ],
    focusCardId: "porcupine-fish", victoryTarget: 7,
    randomSeed: 0x5EA9101C,
    attackCardId: "porcupine-fish", attackTargetCardId: "sea-urchin",
    defeatTeachingCardId: "sea-urchin",
    abilityCardId: "blue-crab",
    abilityRecoveryTargets: { "v2-recover-sea-urchin": "sea-urchin" },
    expectedDraws: {
      "tutorial-draw-card": { deckType: "pals", cardId: "blue-crab" },
      "v2-draw-predator": { deckType: "pals", cardId: "great-barracuda" },
    },
    seed: seed({
      hand: [],
      foundationDeck: [],
      palsDeck: ["blue-crab", "great-barracuda"],
      rp: 2,
      conditionDeck: ["clear-water", "murky-water"],
      gamePhase: "main",
      round: 2,
      turn: 2,
      hasDrawnThisTurn: true,
      activeConditionId: "coral-disease",
      playerTableau: [
        tableau("brain-coral-stage-1", [
          ["sea-urchin", "invertebrate"],
          ["porcupine-fish", "fish"],
        ]),
        tableau("mustard-hill-coral-base"),
      ],
      opponentTableau: [tableau("mustard-hill-coral-base", [["sea-urchin", "invertebrate"]])],
      opponentTurnMode: "play",
      opponent: {
        hand: ["spanish-hogfish"],
        foundationDeck: ["brain-coral-stage-2"],
        palsDeck: ["blue-whale", "blue-whale"],
        rp: 0,
      },
    }),
    checkpoints: [
      checkpoint("tutorial-attack", ACTION.ATTACK_RESOLVED, "Lead your first attack", "Use Porcupine Fish's Crunch on the opposing Sea Urchin, roll both dice, and read the result.", [
        truthy("details.accepted"),
        equals("details.attackerCardId", "porcupine-fish"),
        equals("details.defenderCardId", "sea-urchin"),
        equals("details.onPlay", false),
      ]),
      checkpoint("v2-pass-to-counterattack", ACTION.TURN_ENDED, "Explore the food chain", "End your turn; the opponent will play Spanish Hogfish and attack Sea Urchin."),
      checkpoint("v2-defend-attack", ACTION.ATTACK_RESOLVED, "Defend the counterattack", "Watch Spanish Hogfish attack your Sea Urchin and compare its roll with Sea Urchin's defense.", [
        truthy("details.accepted"),
        equals("details.attackerCardId", "spanish-hogfish"),
        equals("details.defenderCardId", "sea-urchin"),
        equals("details.outcome", "defense-broken"),
        truthy("details.resolution.attackerWins"),
        equals("details.discardedCardId", "sea-urchin"),
        equals("details.destinationZone", "discard"),
      ], { actor: "opponent" }),
      checkpoint("tutorial-collect-rp", ACTION.RP_COLLECTED, "Collect for the next plan", "Begin the new round and collect RP from both Corals.", [
        equals("round", 3),
        equals("details.collected", 5),
        equals("details.bankBefore", 1),
        equals("details.bankAfter", 6),
        equals("details.cap", 8),
        equals("details.conditionId", "clear-water"),
      ]),
      checkpoint("tutorial-draw-card", ACTION.CARD_DRAWN, "Draw Blue Crab", "Choose one card from the Pals Deck.", [
        equals("details.count", 1),
        equals("details.palsCount", 1),
      ]),
      buildCheckpoint("v2-place-passive", "Put a passive to work", "blue-crab"),
      abilityCheckpoint("v2-recover-sea-urchin", "Use a non-attack action", "blue-crab", "Scavenge", "sea-urchin"),
      checkpoint("v2-pass-to-predator", ACTION.TURN_ENDED, "Carry the plan forward", "End your turn with Sea Urchin recovered for the next round."),
      checkpoint("v2-collect-for-predator", ACTION.RP_COLLECTED, "Fund the planned plays", "Collect the RP saved and produced for this round.", [
        equals("round", 4),
        equals("details.collected", 5),
        equals("details.bankBefore", 2),
        equals("details.bankAfter", 7),
        equals("details.cap", 9),
        equals("details.conditionId", "murky-water"),
      ]),
      drawCheckpoint({ id: "v2-draw-predator", title: "Draw the Predator", deckType: "pals" }),
      buildCheckpoint("v2-replay-sea-urchin", "Return Sea Urchin to the reef", "sea-urchin"),
      buildCheckpoint("v2-place-predator", "Play Great Barracuda", "great-barracuda"),
      checkpoint("v2-predator-attack", ACTION.ATTACK_RESOLVED, "Resolve the D6 Bite", "Use Great Barracuda's Quick Strike against the opposing Spanish Hogfish.", [
        truthy("details.accepted"),
        equals("details.attackerCardId", "great-barracuda"),
        equals("details.defenderCardId", "spanish-hogfish"),
        truthy("details.onPlay"),
      ]),
      victoryCheckpoint(7),
    ],
    buildCards: {
      "v2-place-passive": ["blue-crab"],
      "v2-replay-sea-urchin": ["sea-urchin"],
      "v2-place-predator": ["great-barracuda"],
    },
    placementTargets: {
      "v2-place-predator": {
        cardId: "great-barracuda",
        foundationCardId: "brain-coral-stage-1",
        slotClass: "predator",
        slotOrdinal: 0,
      },
    },
  }),
  lesson({
    id: "support-search", moduleId: "support-recovery", number: 3,
    title: "Recover and rebuild", duration: "5 min", goalLabel: "Clear Stunned, find an upgrade, reach 4 VP",
    summary: "Use one-time Support cards in the right order to restore Brain Coral and grow your reef.",
    introduction: "In this lesson, you’ll learn how to recover from a setback. Brain Coral is Stunned, so let’s get it back in action! Then search for its upgrade and turn that recovery into room for another creature.",
    completion: "You cleared Stunned before Coral Gardener locked further Supports, found Brain Coral's upgrade, and turned two one-time effects into a stronger reef.",
    celebration: "Your reef bounced back stronger!",
    skills: ["Support timing", "Status recovery", "Deck search", "Coral upgrades"],
    introducedConcepts: [
      SIMULATOR_V2_LESSON_CONCEPTS.SUPPORT_CARDS,
      SIMULATOR_V2_LESSON_CONCEPTS.DECK_SEARCH,
      SIMULATOR_V2_LESSON_CONCEPTS.STATUS_EFFECTS,
    ],
    focusCardId: "coral-heal", searchCardId: "brain-coral-stage-1", victoryTarget: 4,
    seed: seed({
      hand: ["coral-heal", "coral-gardener", "sea-urchin"],
      foundationDeck: ["brain-coral-stage-1"],
      playerTableau: [
        homeReef(),
        tableau("brain-coral-base", [], {
          statuses: [{ type: "stunned", sourceCardId: "crown-of-thorns" }],
        }),
      ],
      rp: 3,
    }),
    checkpoints: [
      supportCheckpoint("v2-clear-stunned", "Clear Stunned before searching", "coral-heal"),
      supportCheckpoint("v2-play-coral-gardener", "Find the right upgrade", "coral-gardener"),
      buildCheckpoint("v2-upgrade-after-stun", "Upgrade the recovered Coral", "brain-coral-stage-1", { cardKind: "coral", placement: "foundation-upgrade" }),
      buildCheckpoint("v2-stun-finish", "Use the new Invertebrate slot", "sea-urchin"),
      victoryCheckpoint(4),
    ],
    supportCards: {
      "v2-clear-stunned": ["coral-heal"],
      "v2-play-coral-gardener": ["coral-gardener"],
    },
    buildCards: {
      "v2-upgrade-after-stun": ["brain-coral-stage-1"],
      "v2-stun-finish": ["sea-urchin"],
    },
  }),
  lesson({
    id: "apex-predators", moduleId: "habitat-apex", number: 4,
    title: "Build a Habitat for an Apex", duration: "7 min", goalLabel: "Complete Coral Reef and reach 12 VP",
    summary: "Meet Coral Reef's creature requirements, play the Habitat, upgrade a Coral, and welcome Hammerhead.",
    introduction: "In this lesson, you’ll learn how a thriving Habitat unlocks powerful creatures! Complete the required Fish and Invertebrate counts, place Coral Reef, and prepare an Apex slot for Hammerhead.",
    completion: "You supplied four Reef Corals, two Reef Fish, and two Reef Invertebrates to sustain Coral Reef. That Habitat and a Stage 2 Apex slot let Hammerhead enter and use Ravage.",
    celebration: "Your thriving reef welcomed an Apex!",
    skills: ["Habitat requirements", "Maintaining a Habitat", "Apex slots", "Multi-attack abilities", "Turn planning"],
    introducedConcepts: [
      SIMULATOR_V2_LESSON_CONCEPTS.HABITATS,
      SIMULATOR_V2_LESSON_CONCEPTS.APEX,
      SIMULATOR_V2_LESSON_CONCEPTS.MULTI_ATTACK,
      SIMULATOR_V2_LESSON_CONCEPTS.TURN_PLANNING,
    ],
    focusCardId: "coral-reef", attackCardId: "hammerhead", victoryTarget: 12,
    expectedDraws: {
      "v2-draw-hammerhead": { deckType: "pals", cardId: "hammerhead" },
    },
    seed: seed({
      hand: ["clownfish", "arrow-crab", "coral-reef", "brain-coral-stage-2"],
      foundationDeck: [],
      palsDeck: ["hammerhead"],
      playerTableau: [
        tableau("brain-coral-stage-1"),
        homeReef(),
        tableau("pillar-coral-base"),
        tableau("lettuce-coral-base"),
      ],
      playerHabitats: [],
      opponentTableau: [tableau("boulder-star-coral-stage-2", [["clownfish", "predator"], ["clownfish", "predator"]])],
      rp: 8,
      activeConditionId: null,
      conditionDeck: ["abundant-sunlight"],
    }),
    checkpoints: [
      buildCheckpoint("v2-add-habitat-fish", "Add the second Reef Fish", "clownfish"),
      buildCheckpoint("v2-add-habitat-invertebrate", "Add the second Reef Invertebrate", "arrow-crab"),
      buildCheckpoint("v2-play-coral-reef", "Establish Coral Reef", "coral-reef", { cardKind: "habitat", placement: "habitat" }),
      buildCheckpoint("v2-upgrade-apex-coral", "Open an Apex slot", "brain-coral-stage-2", { cardKind: "coral", placement: "foundation-upgrade" }),
      checkpoint("v2-save-for-apex", ACTION.TURN_ENDED, "Plan the Apex turn", "End the turn with a healthy Habitat and collect enough RP next round for Hammerhead."),
      collectCheckpoint(),
      drawCheckpoint({ id: "v2-draw-hammerhead", title: "Draw the Apex", deckType: "pals" }),
      buildCheckpoint("v2-play-apex", "Play Hammerhead", "hammerhead"),
      victoryCheckpoint(12),
      checkpoint("v2-resolve-ravage", ACTION.ATTACK_RESOLVED, "Resolve both Ravage attacks", "Choose two different legal targets and resolve both faceoffs.", [
        truthy("details.accepted"),
        equals("details.attackerCardId", "hammerhead"),
        truthy("details.onPlay"),
        atLeast("details.resolvedCount", 2),
      ]),
    ],
    buildCards: {
      "v2-add-habitat-fish": ["clownfish"],
      "v2-add-habitat-invertebrate": ["arrow-crab"],
      "v2-play-coral-reef": ["coral-reef"],
      "v2-upgrade-apex-coral": ["brain-coral-stage-2"],
      "v2-play-apex": ["hammerhead"],
    },
    placementTargets: {
      "v2-add-habitat-fish": {
        cardId: "clownfish", foundationCardId: "pillar-coral-base", slotClass: "fish", slotOrdinal: 0,
      },
      "v2-add-habitat-invertebrate": {
        cardId: "arrow-crab", foundationCardId: "pillar-coral-base", slotClass: "invertebrate", slotOrdinal: 0,
      },
    },
  }),
  lesson({
    id: "filter-feeder", moduleId: "open-water", number: 5,
    title: "Make room for a giant", duration: "5 min", goalLabel: "Balance School Density and reach 21 VP",
    summary: "Commit a little School Density, expand its supply, and then bring in an Ocean Sunfish.",
    introduction: "In this lesson, you’ll learn how to make room for a giant! I’ve prepared two Creature Schools beside your Coral Reef. Halfbeak uses a little Density; Ocean Sunfish needs much more, so let’s expand a School.",
    completion: "Your Coral Reef and Hammerhead stayed in play. Halfbeak used 10 School Density, then Anchovy Ball's upgrade left enough free for Ocean Sunfish to push the ecosystem to 21 VP.",
    celebration: "Your ecosystem made room for a giant!",
    skills: ["Creature Schools", "School Density", "Open water", "Filter Feeders"],
    introducedConcepts: [
      SIMULATOR_V2_LESSON_CONCEPTS.SCHOOL_DENSITY,
      SIMULATOR_V2_LESSON_CONCEPTS.OPEN_WATER,
      SIMULATOR_V2_LESSON_CONCEPTS.FILTER_FEEDERS,
    ],
    focusCardId: "ocean-sunfish", victoryTarget: 21,
    expectedDraws: {
      "v2-draw-filter-feeder": { deckType: "pals", cardId: "ocean-sunfish" },
    },
    seed: seed({
      hand: ["halfbeak", "anchovy-ball-stage1"],
      foundationDeck: [],
      palsDeck: ["ocean-sunfish"],
      playerTableau: [
        tableau("brain-coral-stage-2", [["hammerhead", "apex"]]),
        homeReef(),
        tableau("pillar-coral-base", [["clownfish", "fish"], ["arrow-crab", "invertebrate"]]),
        tableau("lettuce-coral-base"),
        tableau("sardine-ball-stage2"),
        tableau("anchovy-ball-base"),
      ],
      playerHabitats: ["coral-reef"],
      rp: 8,
      activeConditionId: null,
      conditionDeck: ["abundant-sunlight"],
    }),
    checkpoints: [
      buildCheckpoint("v2-spend-density", "See how a small Fish uses Density", "halfbeak", { placement: "open-water" }),
      buildCheckpoint("v2-expand-density", "Upgrade Anchovy Ball", "anchovy-ball-stage1", { placement: "foundation-upgrade" }),
      checkpoint("v2-fund-filter-feeder", ACTION.TURN_ENDED, "Prepare the next round", "End your turn so the reef can fund your giant Filter Feeder."),
      collectCheckpoint(),
      drawCheckpoint({ id: "v2-draw-filter-feeder", title: "Draw Ocean Sunfish", deckType: "pals" }),
      buildCheckpoint("v2-play-filter-feeder", "Welcome Ocean Sunfish", "ocean-sunfish", { placement: "open-water" }),
      victoryCheckpoint(21),
    ],
    buildCards: {
      "v2-spend-density": ["halfbeak"],
      "v2-expand-density": ["anchovy-ball-stage1"],
      "v2-play-filter-feeder": ["ocean-sunfish"],
    },
  }),
]);

export function getSimulatorV2Lesson(value) {
  const id = typeof value === "string" ? value : value?.id;
  return SIMULATOR_V2_LESSONS.find((entry) => entry.id === id) ?? null;
}

export function getSimulatorV2LessonPlacementTarget(value, checkpoint = null, cardId = null) {
  const selected = getSimulatorV2Lesson(value);
  const checkpointId = typeof checkpoint === "string" ? checkpoint : checkpoint?.id;
  const target = checkpointId ? selected?.placementTargets?.[checkpointId] ?? null : null;
  if (!target || (cardId && target.cardId !== cardId)) return null;
  return target;
}

/**
 * Older in-progress Lesson 2 sessions may already have Porcupine Fish in the
 * Predator slot. Repair that one authored deadlock without restarting the
 * lesson or changing the normal rule that lets Fish use Predator slots.
 */
export function repairSimulatorV2LessonPlacementConflict({
  lesson: value,
  checkpoint = null,
  foundations = [],
} = {}) {
  const selected = getSimulatorV2Lesson(value);
  const checkpointId = typeof checkpoint === "string" ? checkpoint : checkpoint?.id;
  if (selected?.id !== "first-attack" || checkpointId !== "v2-place-predator") return foundations;

  const foundationIndex = foundations.findIndex(({ cardId }) => cardId === "brain-coral-stage-1");
  if (foundationIndex < 0) return foundations;
  const foundation = foundations[foundationIndex];
  const sourceIndex = foundation.slots.findIndex((slot) => (
    (slot.slotClass ?? slot.slotType ?? slot.class) === "predator"
    && slot.cardId === "porcupine-fish"
  ));
  const destinationIndex = foundation.slots.findIndex((slot) => (
    (slot.slotClass ?? slot.slotType ?? slot.class) === "fish"
    && !slot.cardId
  ));
  if (sourceIndex < 0 || destinationIndex < 0) return foundations;

  const source = foundation.slots[sourceIndex];
  const destination = foundation.slots[destinationIndex];
  const {
    cardId,
    cardInstanceId,
    hostedCardIds,
    hostedSchoolDensityRequirements,
    controller,
    invasiveOwner,
    territorialTargetFoundationId,
    ...sourceLayout
  } = source;
  const clearedSource = {
    ...sourceLayout,
    cardId: null,
    cardInstanceId: null,
    hostedCardIds: [],
    hostedSchoolDensityRequirements: [],
  };
  const filledDestination = {
    ...destination,
    cardId,
    cardInstanceId: cardInstanceId ?? null,
    hostedCardIds: [...(hostedCardIds ?? [])],
    hostedSchoolDensityRequirements: [...(hostedSchoolDensityRequirements ?? [])],
    ...(Object.prototype.hasOwnProperty.call(source, "controller") ? { controller } : {}),
    ...(Object.prototype.hasOwnProperty.call(source, "invasiveOwner") ? { invasiveOwner } : {}),
    ...(Object.prototype.hasOwnProperty.call(source, "territorialTargetFoundationId")
      ? { territorialTargetFoundationId }
      : {}),
  };
  const slots = foundation.slots.map((slot, index) => (
    index === sourceIndex
      ? clearedSource
      : index === destinationIndex
        ? filledDestination
        : slot
  ));
  return foundations.map((entry, index) => index === foundationIndex ? { ...entry, slots } : entry);
}

export function simulatorV2LessonIntroduces(value, concept) {
  const selected = getSimulatorV2Lesson(value);
  return Boolean(selected?.introducedConcepts?.includes(concept));
}

export function getSimulatorV2PreviouslyTaughtConcepts(value, completedLessonIds = []) {
  const selected = getSimulatorV2Lesson(value);
  if (!selected) return [];
  const completed = new Set(Array.isArray(completedLessonIds) ? completedLessonIds : []);
  return [...new Set(SIMULATOR_V2_LESSONS
    .filter((entry) => entry.number < selected.number && completed.has(entry.id))
    .flatMap((entry) => entry.introducedConcepts))];
}

export function createSimulatorV2LessonRuntime(lessonId, { completedLessonIds = [] } = {}) {
  const selected = getSimulatorV2Lesson(lessonId);
  if (!selected) throw new RangeError("Unknown Simulator V2 lesson: " + String(lessonId) + ".");
  return {
    lesson: selected,
    scriptedDecks: false,
    contract: selected.contract,
    previouslyTaughtConcepts: getSimulatorV2PreviouslyTaughtConcepts(selected, completedLessonIds),
    guide: {
      name: "Mr. Easterling",
      role: "Your SeaPals teacher",
      portraitSrc: "/images/adventure/mr-easterling-portrait-v2.webp",
    },
  };
}

export function createSimulatorV2LessonSeed(value) {
  const selected = getSimulatorV2Lesson(value);
  if (!selected) throw new RangeError("Unknown Simulator V2 lesson: " + String(value?.id ?? value) + ".");
  return JSON.parse(JSON.stringify(selected.seed));
}

export function getSimulatorV2ExpectedDraw(value, checkpoint = null) {
  const selected = getSimulatorV2Lesson(value);
  if (!selected) return null;
  const checkpointId = typeof checkpoint === "string" ? checkpoint : checkpoint?.id;
  const checkpointDraw = checkpointId ? selected.expectedDraws?.[checkpointId] : null;
  if (checkpointDraw || selected.expectedDraw) return checkpointDraw ?? selected.expectedDraw;
  if (!checkpointId || !selected.expectedDraws) return null;

  // A new-round draw can open while the observer is still finishing the prior
  // checkpoint. Keep the controls and coaching on the next authored draw.
  const checkpointIndex = selected.contract.checkpoints.findIndex(({ id }) => id === checkpointId);
  if (checkpointIndex < 0) return null;
  for (const upcoming of selected.contract.checkpoints.slice(checkpointIndex + 1)) {
    const upcomingDraw = selected.expectedDraws[upcoming.id];
    if (upcomingDraw) return upcomingDraw;
  }
  return null;
}

const CARD_NAMES = Object.freeze({
  "mustard-hill-coral-base": "Mustard Hill Coral",
  "brain-coral-base": "Brain Coral",
  "brain-coral-stage-1": "Brain Coral Stage 1",
  "brain-coral-stage-2": "Brain Coral Stage 2",
  "sea-urchin": "Sea Urchin",
  clownfish: "Clownfish",
  "porcupine-fish": "Porcupine Fish",
  "spanish-hogfish": "Spanish Hogfish",
  "great-barracuda": "Great Barracuda",
  "arrow-crab": "Arrow Crab",
  flounder: "Southern Flounder",
  "coral-gardener": "Coral Gardener",
  "coral-heal": "Coral Heal",
  "coral-reef": "Coral Reef",
  "sardine-ball-base": "Sardine Ball",
  "anchovy-ball-stage1": "Anchovy Ball Stage 1",
  halfbeak: "Halfbeak",
  "ocean-sunfish": "Ocean Sunfish",
  hammerhead: "Hammerhead",
});

const FOUNDATION_CARD_IDS = new Set([
  "mustard-hill-coral-base",
  "brain-coral-base",
  "sardine-ball-base",
]);
const UPGRADE_CARD_IDS = new Set(["brain-coral-stage-1", "brain-coral-stage-2"]);
const SCHOOL_UPGRADE_CARD_IDS = new Set(["anchovy-ball-stage1"]);
const OPEN_WATER_CARD_IDS = new Set(["halfbeak", "ocean-sunfish"]);
const name = (cardId) => CARD_NAMES[cardId] ?? cardId ?? "the highlighted card";

const FIRST_REEF_VISIBLE_COPY = Object.freeze({
  "brain-coral-base": "Great! Now that we know how to read Foundation cards, drag Brain Coral into your ecosystem for a cost of 1 RP.",
  "sea-urchin": "Sea Urchin is ready for a home! Creature slots are the round symbols connected to a Coral. Each slot inherits its Coral's habitat, and its icon shows the creature class it accepts. A creature must match both. Fish slots accept Fish. Predator slots accept Fish or Predators, but Predators cannot use Fish slots. Apex slots accept Fish, Predators, or Apex creatures. Invertebrate and Filter Feeder slots accept only their matching class. Sea Urchin is a Reef Invertebrate, and its printed 1 VP counts while it stays in your ecosystem. Drag it into the glowing Reef Invertebrate slot.",
  "mustard-hill-coral-base": "Great—your first creature is home! A Base Coral begins a separate Foundation, while a Stage card upgrades an existing Coral. Mustard Hill is a Base Coral, so place it in empty water beside Brain Coral instead of on top of it. It produces 2 RP and has no Disease weakness. Drag it into the highlighted open water.",
  "brain-coral-stage-1": "Time to level up your reef! A Coral can upgrade after its current stage has survived a full turn. Put the matching next Stage on that Coral; its position, existing damage, and compatible residents remain. Brain Coral Stage 1 costs 2 RP. It raises health from 10 to 20 HP so it can withstand more damage, raises production from 1 to 2 RP each round, and adds a Predator slot plus a second Invertebrate slot so more creatures can live there. Drag Stage 1 onto the glowing Brain Coral.",
});

function firstReefVisiblePlacementCopy(cardId) {
  return FIRST_REEF_VISIBLE_COPY[cardId] ?? null;
}

function firstReefPlacementPointerPrompt(cardId, state = "hand") {
  if (state === "selected") return "Choose Play Card.";
  if (state === "placement") {
    if (cardId === "brain-coral-stage-1") return "Choose the glowing Brain Coral.";
    if (["brain-coral-base", "mustard-hill-coral-base"].includes(cardId)) return "Choose the highlighted open water.";
    return "Choose the glowing Reef Invertebrate slot.";
  }
  if (cardId === "brain-coral-stage-1") return "Drag Stage 1 onto Brain Coral.";
  if (["brain-coral-base", "mustard-hill-coral-base"].includes(cardId)) return `Drag ${name(cardId)} into the highlighted open water.`;
  return "Drag Sea Urchin into the glowing Reef Invertebrate slot.";
}

function firstReefDrawVisibleCopy(expectedDraw) {
  if (expectedDraw?.cardId === "brain-coral-stage-1") {
    return "Your first Coral upgrade is ready! Coral stages live in the Foundation Deck. To upgrade, you need the matching next Stage in your hand, and the current stage must have survived a full turn. Choose one card from the Foundation Deck, then confirm your draw.";
  }
  if (expectedDraw?.cardId === "sea-urchin") {
    return "Time to welcome your first creature! Each round, you choose which deck to draw from. The Foundation Deck holds Corals and Coral upgrades. The Pals Deck holds creatures, Habitats, and Support cards. Sea Urchin is a creature, so choose one card from the Pals Deck, then confirm your draw.";
  }
  return null;
}

function conceptWasPreviouslyTaught(uiState, concept) {
  return Array.isArray(uiState.previouslyTaughtConcepts)
    && uiState.previouslyTaughtConcepts.includes(concept);
}

function conceptCopy(uiState, concept, teachingCopy, practiceCopy = "") {
  return conceptWasPreviouslyTaught(uiState, concept) ? practiceCopy : teachingCopy;
}

function placementConcept(cardId) {
  if (cardId === "coral-reef") return SIMULATOR_V2_LESSON_CONCEPTS.HABITATS;
  if (SCHOOL_UPGRADE_CARD_IDS.has(cardId)) return SIMULATOR_V2_LESSON_CONCEPTS.SCHOOL_DENSITY;
  if (cardId === "sardine-ball-base") return SIMULATOR_V2_LESSON_CONCEPTS.SCHOOL_DENSITY;
  if (FOUNDATION_CARD_IDS.has(cardId)) return SIMULATOR_V2_LESSON_CONCEPTS.CORALS;
  if (UPGRADE_CARD_IDS.has(cardId)) return SIMULATOR_V2_LESSON_CONCEPTS.CORAL_UPGRADES;
  if (cardId === "halfbeak") return SIMULATOR_V2_LESSON_CONCEPTS.OPEN_WATER;
  if (cardId === "ocean-sunfish") return SIMULATOR_V2_LESSON_CONCEPTS.FILTER_FEEDERS;
  if (cardId === "hammerhead") return SIMULATOR_V2_LESSON_CONCEPTS.APEX;
  return SIMULATOR_V2_LESSON_CONCEPTS.CREATURE_SLOTS;
}

function helpFor(selected, current, target, message, action, extra = {}) {
  const checkpointIndex = selected.contract.checkpoints.findIndex(({ id }) => id === current?.id);
  const cue = extra.cue ?? [
    target ?? "observe",
    extra.targetCardId ?? extra.targetSearchCardId ?? extra.targetActionKey ?? extra.targetDeck ?? "",
  ].join(":");
  return {
    id: current?.id ?? selected.id + "-complete",
    title: current?.title ?? selected.title,
    cueId: [selected.id, current?.id ?? "complete", cue].join(":"),
    progressLabel: "Lesson " + selected.number + " of " + SIMULATOR_V2_LESSONS.length + " · " + selected.title,
    lessonStep: checkpointIndex + 1,
    lessonSteps: selected.contract.checkpoints.length,
    lead: "",
    target,
    message,
    action,
    targetLabel: action,
    ...extra,
  };
}

function allowedBuildCards(selected, current, uiState) {
  const ids = selected.buildCards?.[current?.id] ?? [];
  if (Array.isArray(uiState.hand)) return ids.filter((id) => uiState.hand.includes(id));
  if (Array.isArray(uiState.handCardIds)) return ids.filter((id) => uiState.handCardIds.includes(id));
  const recommendedId = uiState.recommendedBuildCard?.cardId;
  return recommendedId && ids.includes(recommendedId)
    ? [recommendedId, ...ids.filter((id) => id !== recommendedId)]
    : ids;
}

function placementCopy(cardId) {
  if (cardId === "coral-reef") {
    return {
      message: "Coral Reef is a Habitat: it stays in its own zone and unlocks creatures that require it. It needs four Reef Corals, two Reef Fish, and two Reef Invertebrates in play; if those counts later fall short, it takes 10 HP damage at the end of each turn.",
      action: "Choose Play Card to establish Coral Reef in your Habitat zone.",
    };
  }
  if (SCHOOL_UPGRADE_CARD_IDS.has(cardId)) {
    return {
      message: "Anchovy Ball Stage 1 replaces the matching Base School. Its supply rises from 10 to 50 School Density, making more room for open-water creatures.",
      action: "Choose the glowing Anchovy Ball School to upgrade it.",
    };
  }
  if (UPGRADE_CARD_IDS.has(cardId)) {
    return {
      message: name(cardId) + " levels up the matching Coral while preserving its position and compatible creatures.",
      action: "Choose the glowing matching Coral to upgrade it.",
    };
  }
  if (FOUNDATION_CARD_IDS.has(cardId)) {
    return {
      message: cardId === "sardine-ball-base"
        ? "Creature Schools are Foundations in open water. Sardine Ball supplies 10 School Density and produces RP each turn."
        : "Foundations create homes and produce RP at the start of your turns.",
      action: "Choose an open space in your ecosystem.",
    };
  }
  if (OPEN_WATER_CARD_IDS.has(cardId)) {
    const density = cardId === "ocean-sunfish" ? 150 : 10;
    return {
      message: name(cardId) + " lives in open water and commits " + density + " School Density while it remains in your ecosystem.",
      action: "Choose a glowing open-water space.",
    };
  }
  if (cardId === "hammerhead") {
    return {
      message: "Hammerhead needs a Coral Reef Habitat, 6 RP, and an open Apex slot. Your Stage 2 Brain Coral now provides that slot.",
      action: "Choose the glowing Apex slot on Brain Coral.",
    };
  }
  const slot = ["sea-urchin", "blue-crab"].includes(cardId)
    ? "Invertebrate"
    : cardId === "great-barracuda"
      ? "Predator"
      : "Fish";
  return {
    message: name(cardId) + " needs a compatible " + slot + " slot. The simulator highlights legal homes.",
    action: "Choose a glowing " + slot + " slot.",
  };
}

function dragActionCopy(cardId, candidates, selected, current) {
  if (selected?.id === "apex-predators" && cardId === "clownfish") {
    return "Let’s bring this Habitat to life! Drag Clownfish from your hand into the highlighted Fish slot.";
  }
  if (selected?.id === "apex-predators" && cardId === "arrow-crab") {
    return "Great—your Fish count is ready! Drag Arrow Crab from your hand into the highlighted Invertebrate slot.";
  }
  if (selected?.id === "apex-predators" && cardId === "coral-reef") {
    return "All the requirements are met! Select Coral Reef, then choose Play Card.";
  }
  if (selected?.id === "apex-predators" && cardId === "hammerhead") {
    return "Here comes Hammerhead! Drag it from your hand into the highlighted Apex slot.";
  }
  if (selected?.id === "filter-feeder" && cardId === "halfbeak") {
    return "Let’s see School Density in action! Drag Halfbeak from your hand into the highlighted open-water area.";
  }
  if (selected?.id === "filter-feeder" && cardId === "anchovy-ball-stage1") {
    return "Ocean Sunfish needs more room—let’s make it! Drag Anchovy Ball Stage 1 onto the highlighted School.";
  }
  if (selected?.id === "filter-feeder" && cardId === "ocean-sunfish") {
    return "You made enough room—now welcome a giant! Drag Ocean Sunfish from your hand into the highlighted open-water area.";
  }
  if (cardId === "coral-reef") {
    return "Select Coral Reef in your hand, then choose Play Card to put it in the Habitat zone.";
  }
  if (SCHOOL_UPGRADE_CARD_IDS.has(cardId)) {
    return "Drag Anchovy Ball Stage 1 from your hand onto the highlighted Anchovy Ball School.";
  }
  if (UPGRADE_CARD_IDS.has(cardId)) {
    return "Drag " + name(cardId) + " from your hand onto the highlighted matching Coral.";
  }
  if (FOUNDATION_CARD_IDS.has(cardId)) {
    return "Drag " + name(cardId) + " from your hand into a highlighted open ecosystem space.";
  }
  if (OPEN_WATER_CARD_IDS.has(cardId)) {
    return "Drag " + name(cardId) + " from your hand into the highlighted open-water area.";
  }
  if (cardId === "hammerhead") {
    return "Drag Hammerhead from your hand into the highlighted Apex slot.";
  }
  const slot = ["sea-urchin", "blue-crab"].includes(cardId)
    ? "Invertebrate"
    : cardId === "great-barracuda"
      ? "Predator"
      : "Fish";
  return "Drag " + name(cardId) + " from your hand into the highlighted " + slot + " slot.";
}

/** Uses live UI facts and the same target attributes as the Simulator. */
export function getSimulatorV2LessonHelp(value, current, uiState = {}) {
  const selected = getSimulatorV2Lesson(value);
  if (!selected || !current) return null;
  const help = (target, message, action, extra) => helpFor(selected, current, target, message, action, extra);
  const expectedDraw = getSimulatorV2ExpectedDraw(selected, current);

  if (uiState.modal === "draw-result") {
    return help("continue-actions", "Your draw is ready. Next you can play cards and use actions.", "Continue to Actions.");
  }
  if (uiState.modal === "turn-draw" || uiState.gamePhase === "draw") {
    const firstReefDrawCopy = selected.id === "first-reef"
      ? firstReefDrawVisibleCopy(expectedDraw)
      : null;
    const firstReefDrawCue = expectedDraw?.cardId
      ? `first-reef-draw:${expectedDraw.cardId}`
      : "first-reef-draw";
    const wrongDeck = expectedDraw?.deckType === "foundation" ? "pals" : "foundation";
    const wrongDeckSelected = Number(
      wrongDeck === "foundation" ? uiState.drawFoundationSelected : uiState.drawPalsSelected,
    ) > 0;
    if (expectedDraw && wrongDeckSelected) {
      const expectedDeckName = expectedDraw.deckType === "foundation" ? "Foundation" : "Pals";
      const wrongDeckName = wrongDeck === "foundation" ? "Foundation" : "Pals";
      return help(
        "draw-controls",
        `For this step, draw from the ${expectedDeckName} Deck.`,
        `Remove the ${wrongDeckName} draw, then choose ${expectedDeckName}.`,
        { targetDeck: wrongDeck, targetDrawAction: "remove" },
      );
    }
    if (Number(uiState.drawSelected ?? 0) >= Number(uiState.drawTarget ?? 1) && Number(uiState.drawTarget ?? 1) > 0) {
      return help(
        "confirm-draw",
        "Your deck choice is ready. Draw the card to add it to your hand.",
        firstReefDrawCopy ?? "Confirm selection to draw your card.",
        firstReefDrawCopy ? {
          cue: firstReefDrawCue,
          pointerPrompt: "Confirm your draw.",
          targetLabel: "the Confirm Selection button",
        } : undefined,
      );
    }
    const firstReefUpgradeDraw = selected.id === "first-reef" && expectedDraw?.cardId === "brain-coral-stage-1";
    const firstAttackPredatorDraw = selected.id === "first-attack" && expectedDraw?.cardId === "great-barracuda";
    const seaUrchinWasDefeated = Array.isArray(uiState.discardPileCardIds)
      && uiState.discardPileCardIds.includes("sea-urchin");
    const scenarioDrawMessage = selected.id === "apex-predators"
      ? "Your Coral Reef is established and Brain Coral has an Apex slot. Draw Hammerhead from the Pals Deck so you can use the RP you collected for the final play."
      : selected.id === "filter-feeder"
      ? "You expanded School Density for a giant creature. Draw Ocean Sunfish from the Pals Deck; your Coral Reef Habitat and 160 free Density are ready."
      : firstReefUpgradeDraw
        ? "Brain Coral Stage 1 is on top of your Foundation Deck. Draw it so you can level up the Coral you placed last round."
      : firstAttackPredatorDraw
        ? `${seaUrchinWasDefeated
          ? "Scavenge brought Sea Urchin back to your hand for this round."
          : "Your reef is ready for its next play."
        } Great Barracuda is on top of your Pals Deck. Draw it to prepare its On Play attack.`
      : selected.id === "first-attack"
        ? "Blue Crab is on top of your Pals Deck. Draw it to see how a Passive works automatically, then use its non-attack Scavenge Action."
        : selected.id === "first-reef"
          ? "Sea Urchin is waiting on top of your Pals Deck. Draw it so you can place your first creature."
        : "Choose the Pals Deck when you want creatures and other Pals cards.";
    const drawMessage = conceptWasPreviouslyTaught(uiState, SIMULATOR_V2_LESSON_CONCEPTS.DRAWING)
      ? scenarioDrawMessage
      : selected.id === "first-reef"
        ? scenarioDrawMessage
        : `The Pals Deck holds creatures and other Pals cards. ${scenarioDrawMessage}`;
    const drawCount = Math.max(1, Number(uiState.drawTarget ?? 1));
    return help(
      "draw-controls",
      drawMessage,
      firstReefDrawCopy
        ?? `Choose ${drawCount === 1 ? "one card" : `${drawCount} cards`} from the ${expectedDraw?.deckType === "foundation" ? "Foundation" : "Pals"} Deck.`,
      {
        targetDeck: expectedDraw?.deckType ?? "pals",
        targetDrawAction: "add",
        ...(firstReefDrawCopy ? {
          cue: firstReefDrawCue,
          pointerPrompt: `Add one card from the ${expectedDraw?.deckType === "foundation" ? "Foundation" : "Pals"} Deck.`,
          targetLabel: `the ${expectedDraw?.deckType === "foundation" ? "Foundation" : "Pals"} Deck control`,
        } : {}),
      },
    );
  }

  if (uiState.playingCardId) {
    const copy = placementCopy(uiState.playingCardId);
    const firstReefCopy = selected.id === "first-reef"
      ? firstReefVisiblePlacementCopy(uiState.playingCardId)
      : null;
    return help(
      "placement",
      conceptCopy(uiState, placementConcept(uiState.playingCardId), copy.message),
      firstReefCopy ?? copy.action,
      {
        cue: firstReefCopy ? `first-reef-place:${uiState.playingCardId}` : "placement:" + uiState.playingCardId,
        ...(firstReefCopy ? {
          pointerPrompt: firstReefPlacementPointerPrompt(uiState.playingCardId, "placement"),
          targetLabel: uiState.playingCardId === "brain-coral-stage-1"
            ? "the glowing Brain Coral"
            : uiState.playingCardId === "sea-urchin"
              ? "the glowing Reef Invertebrate slot"
              : "the highlighted open water",
        } : {}),
      },
    );
  }

  if (uiState.gamePhase === "setup") {
    if (!uiState.hasCoralInPlay && selected.setupCardId) {
      const cardId = selected.setupCardId;
      const selectedCard = uiState.selectedHandCard === cardId
        && (uiState.handPopoverOpen || uiState.handDockSelectionOpen || uiState.modal === "hand");
      const firstReefCopy = selected.id === "first-reef"
        ? firstReefVisiblePlacementCopy(cardId)
        : null;
      return help(
        selectedCard ? "play-card" : "hand",
        selectedCard
          ? "Card details are open. Play Card will let you choose its place in the reef."
          : `You start with 3 RP. ${name(cardId)} costs ${cardId === "brain-coral-base" ? 1 : 2} and creates a home for creatures.`,
        firstReefCopy ?? (selectedCard ? "Choose Play Card." : `Drag ${name(cardId)} from your hand into your ecosystem.`),
        {
          cue: firstReefCopy ? `first-reef-place:${cardId}` : undefined,
          interaction: selectedCard ? "tap" : "drag",
          targetCardId: cardId,
          ...(firstReefCopy ? {
            pointerPrompt: firstReefPlacementPointerPrompt(cardId, selectedCard ? "selected" : "hand"),
            targetLabel: selectedCard ? "the Play Card button" : "Brain Coral in your hand",
          } : {}),
          hint: selectedCard
            ? "Choose Play Card, then choose open water in your reef."
            : "Lift the card upward, then release over open water. You can also select it, choose Play, then choose an open space.",
        },
      );
    }
    if (uiState.handPopoverOpen || uiState.modal === "hand") {
      return help("close-modal", "Your reef is ready. Close your hand to begin the round.", "Close the card panel, then press Begin Round.");
    }
    if (
      selected.id === "first-reef"
      && uiState.hasCoralInPlay
      && uiState.layoutLessonProgress?.["move-slot"] !== true
    ) {
      return help(
        "slot-drag",
        "The connected circles are creature slots: homes for the creatures you will play. A slot can move around its Coral without changing which creatures fit there.",
        "Nice work! The connected circles are creature slots: homes for the creatures you will play. Press and hold the highlighted round slot, then drag it left or right and release in open water. It stays connected to Brain Coral and accepts the same kind of creature.",
        {
          actionId: "move-slot",
          interaction: "drag",
          dragDestination: "clear-water",
          targetCardId: selected.setupCardId,
          pointerPrompt: "Hold the round slot and drag it left or right.",
          targetLabel: "the highlighted slot",
          hint: "Drag the round slot marker. Its connector follows while the Coral stays in place.",
        },
      );
    }
    if (
      selected.id === "first-reef"
      && uiState.hasCoralInPlay
      && uiState.layoutLessonProgress?.["move-foundation"] !== true
    ) {
      return help(
        "foundation-drag",
        `Your reef layout is flexible. Drag ${name(selected.setupCardId)} and its whole branch moves with it. Moving cards only organizes your board; it never changes their rules.`,
        "Brain Coral and its whole branch can move together. Press and hold Brain Coral by its card, then drag it left or right and release in open water. Its connected slots move with it; only the layout changes.",
        {
          actionId: "move-foundation",
          interaction: "drag",
          dragDestination: "clear-water",
          targetCardId: selected.setupCardId,
          pointerPrompt: "Hold Brain Coral and drag it left or right.",
          targetLabel: "Brain Coral",
          hint: "Move the Coral by its card body. Its slots and attached creatures stay connected.",
        },
      );
    }
    const message = conceptCopy(
          uiState,
          SIMULATOR_V2_LESSON_CONCEPTS.RESOURCE_POINTS,
          selected.id === "first-reef"
            ? "Your Coral is ready. Begin Round adds 1 RP for the turn plus 1 from Brain Coral."
            : "Your Coral is ready. Begin Round collects RP from the round and your Foundations.",
        );
    return help(
      "turn-button",
      message,
      conceptWasPreviouslyTaught(uiState, SIMULATOR_V2_LESSON_CONCEPTS.RESOURCE_POINTS)
        ? "Press Begin Round."
        : selected.id === "first-reef"
          ? "Your first Foundation is ready! At the start of every round, a Condition changes the rules for both ecosystems, then you collect RP and draw. Press Begin Round to see the sequence."
          : "Press Begin Round and watch your RP bank.",
      selected.id === "first-reef" ? {
        pointerPrompt: "Press Begin Round.",
        targetLabel: "the Begin Round button",
      } : undefined,
    );
  }

  if (current.actionType === ACTION.SUPPORT_PLAYED) {
    const cardId = selected.supportCards?.[current.id]?.[0];
    if (uiState.modal === "search" && selected.searchCardId) {
      return help(
        "search-card",
        name(cardId) + " found the eligible Corals in your Foundation Deck. Choose the one this lesson needs.",
        "Choose " + name(selected.searchCardId) + ".",
        { targetSearchCardId: selected.searchCardId },
      );
    }
    const selectedCard = uiState.selectedHandCard === cardId
      && (uiState.handPopoverOpen || uiState.handDockSelectionOpen || uiState.modal === "hand");
    const message = cardId === "coral-heal"
      ? "Stunned is a status on Brain Coral, separate from the round's shared Condition. It blocks upgrading. Play Coral Heal first: Coral Gardener prevents more Supports this turn after its search."
      : "Brain Coral is clear of Stunned! Now Coral Gardener can search your Foundation Deck for the matching Stage 1 upgrade. Supports resolve once, then go to the discard pile.";
    const action = selectedCard
      ? "Choose Play Card."
      : cardId === "coral-heal"
        ? "Brain Coral is Stunned, but we can fix that! Select Coral Heal in your hand."
        : "Great—Brain Coral is clear! Now select Coral Gardener to find its Stage 1 upgrade.";
    return help(
      selectedCard ? "play-card" : "hand",
      selectedCard ? name(cardId) + " is selected and ready to resolve." : message,
      action,
      {
        interaction: "tap",
        targetCardId: cardId,
        hint: cardId === "coral-heal"
          ? "After playing it, choose the Brain Coral marked Stunned."
          : "After playing it, choose Brain Coral Stage 1 in the deck search.",
      },
    );
  }

  if (current.actionType === ACTION.ABILITY_RESOLVED) {
    const utility = uiState.inspectedUtilityAction?.cardId === selected.abilityCardId
      ? uiState.inspectedUtilityAction
      : uiState.readyUtilityAction?.cardId === selected.abilityCardId
        ? uiState.readyUtilityAction
        : null;
    const target = uiState.inspectedUtilityAction?.cardId === selected.abilityCardId
      ? "utility-action-button"
      : "player-board";
    return help(
      target,
      "Not every ability is an attack! An Action waits for your command during your turn. You decide when to use it and pay any RP cost shown beside it. Blue Crab’s Scavenge costs 2 RP to recover the defeated Sea Urchin from your discard pile and set up your next round. Let’s bring it home!",
      target === "utility-action-button"
        ? "Use Scavenge, then choose Sea Urchin."
        : "Select Blue Crab, then use Scavenge.",
      {
        targetCardId: selected.abilityCardId,
        targetActionKey: utility?.actionKey ?? utility?.utilityActionKey ?? null,
      },
    );
  }

  if (current.actionType === ACTION.ATTACK_RESOLVED) {
    const opponentAttack = current.requirements.some(
      (requirement) => requirement.path === "actor" && requirement.value === "opponent",
    );
    if (opponentAttack) return null;
    if (uiState.inspectedCardOpen && (uiState.attackContext || !uiState.inspectedPlayerCard)) {
      return help("close-modal", "Close these details so you can reach the live attack controls.", "Close the card details.");
    }
    if (selected.id === "apex-predators") {
      if (uiState.attackContext) {
        return help(
          "opponent-board",
          "Ravage performs two D8 attacks. Each attack must choose a different legal target.",
          "Choose the next glowing opposing creature and resolve the faceoff.",
          { targetCardId: "hammerhead" },
        );
      }
      return help(
        "opponent-board",
        "Hammerhead's Ravage begins with Coral damage, then performs two attacks.",
        "Finish Ravage and resolve both faceoffs.",
        { targetCardId: "hammerhead" },
      );
    }
    if (selected.id === "first-attack" && current.id === "v2-predator-attack") {
      return help(
        "opponent-board",
        "Quick Strike has triggered! Unlike an Action, this On Play ability began automatically when Great Barracuda entered your ecosystem. Its Bite uses a D6, giving it a wider possible roll than Porcupine Fish’s D4 Crunch.",
        "Choose the glowing Spanish Hogfish and resolve the D6 faceoff.",
        { targetCardId: "great-barracuda" },
      );
    }
    if (uiState.attackContext) {
      const choosingFirstTarget = selected.id === "first-attack" && current.id === "tutorial-attack";
      return help(
        "opponent-board",
        choosingFirstTarget
          ? "Crunch can attack only an opposing Invertebrate. The highlighted Sea Urchin is legal, so selecting it makes Sea Urchin the defender."
          : "Crunch can only target an opposing Invertebrate. Sea Urchin is the legal target glowing above.",
        choosingFirstTarget
          ? "Now choose the target! Select the highlighted Sea Urchin. Crunch will roll Porcupine Fish’s D4 attack die against Sea Urchin’s printed D6 defense die; then you’ll tap the board to lock both results."
          : "Choose the glowing Sea Urchin in the opposing reef.",
        choosingFirstTarget ? { targetCardId: selected.attackTargetCardId } : undefined,
      );
    }
    if (uiState.handPopoverOpen || uiState.modal === "hand") {
      return help("close-modal", "Your attacker is already on the board; you do not need to play another card.", "Close your hand, then select Porcupine Fish.");
    }
    const attack = uiState.inspectedAttack?.ready ? uiState.inspectedAttack : uiState.readyAttack;
    const target = uiState.inspectedAttack?.ready ? "attack-button" : "player-board";
    const introduceActions = selected.id === "first-attack"
      && current.id === "tutorial-attack"
      && target === "player-board";
    const chooseFirstAttack = selected.id === "first-attack"
      && current.id === "tutorial-attack"
      && target === "attack-button";
    return help(
      target,
      introduceActions
        ? "Crunch is an Action: an ability you choose during your turn, up to once each turn."
        : chooseFirstAttack
          ? "Porcupine Fish is your attacker. Crunch costs 1 RP, targets an opposing Invertebrate, and uses a D4 attack die."
          : "Crunch costs 1 RP and targets an opposing Invertebrate.",
      chooseFirstAttack
        ? "Great—Porcupine Fish is selected! Choose Crunch to commit 1 RP and begin the attack."
        : introduceActions
          ? "Your turn to attack! Crunch is an Action—an ability you choose during your turn. Actions can be used once per turn. Select Porcupine Fish to begin!"
          : "Select Porcupine Fish, then use Crunch.",
      { targetCardId: selected.attackCardId, targetActionKey: attack?.actionKey ?? null },
    );
  }

  if (current.actionType === ACTION.CARD_BUILT) {
    const candidates = allowedBuildCards(selected, current, uiState);
    const cardId = candidates.includes(uiState.selectedHandCard) ? uiState.selectedHandCard : candidates[0];
    if (!cardId) {
      return help("vp-score", "Your play is resolving. Watch how your ecosystem changes.", "Watch your Victory Points.");
    }
    if (uiState.handPopoverOpen && uiState.selectedHandCard && !candidates.includes(uiState.selectedHandCard)) {
      return help(
        "close-modal",
        "For this step, " + name(cardId) + " is ready in your hand.",
        "Close these details, then select " + name(cardId) + ".",
        { interaction: "tap", targetCardId: cardId, targetCardIds: candidates },
      );
    }
    const selectedCard = uiState.selectedHandCard === cardId
      && (uiState.handPopoverOpen || uiState.handDockSelectionOpen || uiState.modal === "hand");
    const firstReefCopy = selected.id === "first-reef"
      ? firstReefVisiblePlacementCopy(cardId)
      : null;
    let message = conceptCopy(uiState, placementConcept(cardId), placementCopy(cardId).message);
    if (selected.id === "apex-predators" && cardId === "clownfish") {
      message = "A Habitat needs a living ecosystem, not just RP. Your four Reef Corals are ready, but Coral Reef still needs two Fish and two Invertebrates. Right now each creature count is one short. Give Clownfish the highlighted Fish slot to reach two Reef Fish.";
    } else if (selected.id === "apex-predators" && cardId === "arrow-crab") {
      message = "Great—your Fish count is ready! Sea Urchin is the only Reef Invertebrate so far. Add Arrow Crab to reach the second one; then your reef will meet Coral Reef's full 4 Coral, 2 Fish, 2 Invertebrate requirement.";
    } else if (selected.id === "apex-predators" && cardId === "coral-reef") {
      message = "You did it—all three Coral Reef counts are met! Four Reef Corals, two Reef Fish, and two Reef Invertebrates now sustain this zero-RP Habitat and unlock Hammerhead. Keep those creatures in play: if a count falls short, the Habitat takes 10 HP each turn.";
    } else if (selected.id === "filter-feeder" && cardId === "anchovy-ball-stage1") {
      message = "Halfbeak committed 10 School Density. Your Schools now supply 130, leaving only 120 free: not enough for Ocean Sunfish's 150. Upgrade Anchovy Ball for 3 RP to raise its supply from 10 to 50. That leaves 160 free—enough room for Ocean Sunfish!";
    } else if (cardId === "mustard-hill-coral-base" && selected.id === "first-reef") {
      message = "Build Mustard Hill Coral as a second Foundation. It has no Disease weakness, so Coral Disease will not stop its 2 RP production next round.";
    } else if (cardId === "porcupine-fish" && selected.id === "first-attack") {
      message = "Place Porcupine Fish in Brain Coral's Fish slot. Its Crunch action uses a D4 attack die against an opposing Invertebrate's defense die.";
    } else if (cardId === "blue-crab" && selected.id === "first-attack") {
      message = "Some abilities help without waiting for a command. Blue Crab’s Eco Boost is a Passive ability, so it works automatically while Blue Crab remains in your ecosystem and raises your maximum RP bank by 1.";
    } else if (cardId === "sea-urchin" && selected.id === "first-attack") {
      message = "Scavenge recovered Sea Urchin instead of attacking. Return it to Brain Coral now, and its Spines passive will again add 20 HP to that Coral.";
    } else if (cardId === "brain-coral-stage-1") {
      message = selected.id === "first-reef"
        ? "Upgrade Brain Coral for 2 RP. Its resilience rises from 10 to 20 HP, it can produce 2 RP instead of 1 when a Condition is not blocking it, and it gains a Predator slot plus another Invertebrate slot. Sea Urchin stays attached."
        : "Coral Heal cleared Stunned, so Brain Coral can upgrade for 2 RP. You’ve seen the payoff: 20 HP of resilience, 2 RP each round, a Predator slot, and another Invertebrate slot.";
    } else if (cardId === "brain-coral-stage-2") {
      message = "Upgrade Brain Coral to Stage 2 for 5 RP. The payoff is huge: resilience rises from 20 to 60 HP, production grows from 2 to 5 RP each round, and its reef opens two Predator, one Apex, and three Invertebrate slots. Stage 2 has no Fish slot, so check attached creatures first.";
    } else if (cardId === "sardine-ball-base") {
      message = "Sardine Ball costs 1 RP. As a Creature School it acts as a Foundation and supplies 10 School Density.";
    } else if (cardId === "halfbeak") {
      message = "I've added two Creature Schools to your reef: Sardine Ball supplies 120 School Density and Anchovy Ball supplies 10. Halfbeak costs 2 RP and commits 10 of that 130. Afterward, only 120 is free, which is too little for Ocean Sunfish's 150.";
    } else if (cardId === "ocean-sunfish") {
      message = "Ocean Sunfish needs 8 RP, Coral Reef or Open Ocean, and 150 free School Density. Your Anchovy Ball upgrade raised supply to 170; with 10 used by Halfbeak, 160 remains. Play Sunfish to commit 150 and score 8 VP.";
    } else if (cardId === "hammerhead") {
      message = "Hammerhead costs 6 RP, needs Coral Reef, and must occupy an Apex slot. Stage 2 Brain Coral supplies that slot.";
    } else if (cardId === "great-barracuda") {
      message = selected.id === "first-attack"
        ? "Now for a different kind of ability! An On Play ability triggers as soon as its card enters your ecosystem. There’s no separate Action button or additional RP cost for Great Barracuda’s Quick Strike—its D6 Bite begins the moment you place it."
        : "Each attack tells you which die to roll. Porcupine Fish's Crunch uses a D4 (1–4); Great Barracuda's Bite uses a D6 (1–6), giving it a wider possible range.";
    }
    return help(
      selectedCard ? "play-card" : "hand",
      selectedCard ? name(cardId) + " is selected. Play Card will show its legal placement." : message,
      firstReefCopy ?? (selectedCard ? "Choose Play Card." : dragActionCopy(cardId, candidates, selected, current)),
      {
        cue: firstReefCopy ? `first-reef-place:${cardId}` : undefined,
        interaction: selectedCard || cardId === "coral-reef" ? "tap" : "drag",
        targetCardId: cardId,
        targetCardIds: candidates,
        ...(firstReefCopy ? {
          pointerPrompt: firstReefPlacementPointerPrompt(cardId, selectedCard ? "selected" : "hand"),
          targetLabel: selectedCard ? "the Play Card button" : `${name(cardId)} in your hand`,
        } : {}),
        hint: selectedCard
          ? "Choose Play Card, then choose the highlighted legal placement."
          : "Lift the card upward to reveal legal placements, then release over one. You can also select the card and choose Play.",
      },
    );
  }

  if (current.actionType === ACTION.VP_EARNED) {
    return help(
      "vp-score",
      conceptCopy(
        uiState,
        SIMULATOR_V2_LESSON_CONCEPTS.VICTORY_POINTS,
        "Victory Points come from cards in your ecosystem. Reach " + selected.victoryTarget + " VP to finish this lesson.",
      ),
      "Watch your VP total.",
    );
  }
  if (current.actionType === ACTION.TURN_ENDED) {
    if (selected.id === "first-reef") {
      if (current.id === "v2-watch-coral-disease" && !uiState.weaknessTourAcknowledged) {
        const explanation = "Here’s why that second Coral matters! See the germ icon under Brain Coral's Weaknesses? That means Disease. Coral Disease stops its RP for one round, but the Coral stays in play. The other weakness types are Storm (swirl) and High Temperature (thermometer). Hurricane and Severe Coral Bleaching pause RP from Corals with those matching symbols. Mustard Hill has no weakness icon, so its 2 RP is safe from these Conditions.";
        return help("coral-weakness", explanation, explanation, {
          cue: "first-reef:weakness-tour",
          targetCardId: "brain-coral-base",
          targetLabel: "Brain Coral's printed Disease weakness",
        });
      }
      const message = "Ready to test your reef? End your turn. Coral Disease will appear next round, and you can compare RP from Brain Coral and Mustard Hill.";
      return help("turn-button", message, message, {
        pointerPrompt: "End the turn to reveal Coral Disease.",
        targetLabel: "the End Turn button",
      });
    }
    const message = selected.id === "apex-predators"
      ? "Your Coral Reef is thriving! All four Corals, two Fish, and two Invertebrates are still here. Brain Coral's new Apex slot is ready; end the turn and refill your RP bank so Hammerhead can enter next round."
      : selected.id === "filter-feeder"
      ? "Your upgraded Schools now supply 170 Density. Halfbeak uses 10, leaving 160 free for Ocean Sunfish. End the turn to collect the RP needed for its 8 RP cost."
      : selected.id === "first-attack"
        ? current.id === "v2-pass-to-counterattack"
          ? "Excellent—you completed every step of an attack! Your opponent will now play Spanish Hogfish and use Crunch on your Sea Urchin, so you can watch the same faceoff from the defender’s side."
          : "Sea Urchin is back in your hand. End the turn and carry that non-attack action's setup into the next round."
      : "You can save your remaining RP for a later turn.";
    return help(
      "turn-button",
      message,
      "End your turn when you are ready.",
    );
  }
  if (selected.id === "first-reef" && current.actionType === ACTION.RP_COLLECTED) {
    const diseaseRound = current.id === "v2-collect-under-coral-disease";
    const action = diseaseRound
      ? "That’s resilience in action! Coral Disease blocked Brain Coral's 1 RP. Mustard Hill still produced 2 RP, and the round added 1, so you collected 3 RP. A varied ecosystem keeps one Condition from shutting down your whole economy. Continue to your draw."
      : "Nice! Your bank increased from 2 RP to 4 RP. Unspent RP stays in your bank for later rounds. Continue to your draw.";
    return help(
      "rp-bank",
      action,
      action,
      {
        pointerPrompt: "Review your RP bank, then continue.",
        targetLabel: "your RP bank",
      },
    );
  }
  if (current.actionType === ACTION.RP_COLLECTED && selected.id === "apex-predators") {
    return help(
      "rp-bank",
      "Your four Corals are producing again, and Arrow Crab raises your RP bank limit. This next turn gives you enough RP to pay Hammerhead's 6 RP cost while Coral Reef and the Apex slot stay ready.",
      "Continue to draw Hammerhead from the Pals Deck.",
    );
  }
  if (current.actionType === ACTION.RP_COLLECTED && selected.id === "filter-feeder") {
    return help(
      "rp-bank",
      "Your plan worked! You made room in School Density last turn. Now the Foundations' RP production refills your bank, so you can afford the 8 RP Ocean Sunfish without giving up Halfbeak.",
      "Continue to draw Ocean Sunfish from the Pals Deck.",
    );
  }
  return help(
    "rp-bank",
    "Your turn begins by collecting RP from the turn and your Foundations.",
    "Watch your RP bank grow.",
  );
}

/** Guidance gates sequencing. Live Simulator handlers still enforce every rule. */
export function getSimulatorV2LessonActionBlock({
  lesson: value,
  checkpoint: current,
  action,
  cardId,
  actionId,
  actionName,
  deckType,
  gamePhase,
  foundationCardId,
  slotClass,
  slotOrdinal,
  layoutLessonProgress,
  weaknessTourAcknowledged,
} = {}) {
  const selected = getSimulatorV2Lesson(value);
  if (!selected) return "";
  if (!current) return "This lesson is complete. Continue when you are ready.";
  if (action === "play-card") {
    if (gamePhase === "setup" && current.actionType === ACTION.MATCH_READY && cardId === selected.setupCardId) return "";
    if (current.actionType === ACTION.CARD_BUILT && selected.buildCards?.[current.id]?.includes(cardId)) return "";
    if (current.actionType === ACTION.SUPPORT_PLAYED && selected.supportCards?.[current.id]?.includes(cardId)) return "";
    return "Complete the highlighted step before playing another card.";
  }
  if (action === "place-card") {
    const target = getSimulatorV2LessonPlacementTarget(selected, current, cardId);
    if (!target) return "";
    const matches = (
      (!target.foundationCardId || target.foundationCardId === foundationCardId)
      && (!target.slotClass || target.slotClass === slotClass)
      && (!Number.isInteger(target.slotOrdinal) || target.slotOrdinal === slotOrdinal)
    );
    if (matches) return "";
    if (target.blockMessage) return target.blockMessage;
    const targetSlotName = String(target.slotClass ?? "prepared").replace(/-/g, " ");
    return `Place ${name(target.cardId)} in ${name(target.foundationCardId)}'s highlighted ${targetSlotName} slot.`;
  }
  if (action === "draw") {
    const expected = getSimulatorV2ExpectedDraw(selected, current);
    if (current.actionType === ACTION.CARD_DRAWN && expected && (!deckType || deckType === expected.deckType)) return "";
    return expected
      ? "Choose the " + (expected.deckType === "pals" ? "Pals" : "Foundation") + " Deck for this lesson's draw."
      : "This practice board is already ready for its next action.";
  }
  if (action === "attack") {
    const isPlayerCheckpoint = current.requirements.some(
      (requirement) => requirement.path === "actor" && requirement.value === "player",
    );
    const expectedAttackerId = current.requirements.find((requirement) => (
      requirement.path === "details.attackerCardId" && requirement.operator === "equals"
    ))?.value ?? selected.attackCardId;
    if (isPlayerCheckpoint && current.actionType === ACTION.ATTACK_RESOLVED && (!cardId || cardId === expectedAttackerId)) return "";
    return "Follow the highlighted lesson step before using an attack.";
  }
  if (action === "utility") {
    const expectedSourceId = current.requirements.find((requirement) => (
      requirement.path === "details.sourceCardId" && requirement.operator === "equals"
    ))?.value;
    const expectedActionName = current.requirements.find((requirement) => (
      requirement.path === "details.actionName" && requirement.operator === "equals"
    ))?.value;
    const expectedActionId = current.requirements.find((requirement) => (
      requirement.path === "details.actionId" && requirement.operator === "equals"
    ))?.value;
    if (
      current.actionType === ACTION.ABILITY_RESOLVED
      && (!cardId || !expectedSourceId || cardId === expectedSourceId)
      && (!actionId || !expectedActionId || actionId === expectedActionId)
      && (!actionName || !expectedActionName || actionName === expectedActionName)
    ) return "";
    return "Complete the highlighted lesson step before using another ability.";
  }
  if (action === "end-turn") {
    if (
      selected.id === "first-reef"
      && current.id === "v2-watch-coral-disease"
      && weaknessTourAcknowledged !== true
    ) return "Read Brain Coral's weaknesses with Mr. Easterling before ending the turn.";
    if (
      selected.id === "first-reef"
      && gamePhase === "setup"
      && current.actionType === ACTION.MATCH_READY
      && (
        layoutLessonProgress?.["move-foundation"] !== true
        || layoutLessonProgress?.["move-slot"] !== true
      )
    ) return `Move ${name(selected.setupCardId)} and one of its slots before beginning the round.`;
    if (gamePhase === "setup" && [ACTION.MATCH_READY, ACTION.RP_COLLECTED].includes(current.actionType)) return "";
    if (current.actionType === ACTION.TURN_ENDED) return "";
    return "Finish this lesson's highlighted play before ending the turn.";
  }
  return "";
}

export function parseSimulatorV2LessonProgress(raw) {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      value = null;
    }
  }
  const savedIds = Array.isArray(value?.completedLessonIds) ? value.completedLessonIds : [];
  const completed = value?.version === 2
    ? savedIds
    : value?.version === 1
      ? [
          ...savedIds.filter((id) => id === "first-reef" || id === "first-attack"),
          ...(savedIds.includes("support-search") && savedIds.includes("clear-stun") ? ["support-search"] : []),
          ...(savedIds.includes("school-density") && savedIds.includes("filter-feeder") ? ["filter-feeder"] : []),
        ]
      : [];
  return {
    version: 2,
    completedLessonIds: SIMULATOR_V2_LESSONS
      .map(({ id }) => id)
      .filter((id) => completed.includes(id)),
  };
}

export function recordSimulatorV2LessonCompletion(progress, lessonId) {
  const normalized = parseSimulatorV2LessonProgress(progress);
  if (!getSimulatorV2Lesson(lessonId)) return normalized;
  return parseSimulatorV2LessonProgress({
    ...normalized,
    completedLessonIds: [...normalized.completedLessonIds, lessonId],
  });
}
