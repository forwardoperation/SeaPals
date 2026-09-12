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
  { id: "battle-basics", title: "Battle Basics", summary: "Attack, defend, and answer with a stronger attacker.", lessonIds: ["first-attack"] },
  { id: "smart-plays", title: "Smart Plays", summary: "Use Support cards and clear a Condition.", lessonIds: ["support-search", "clear-stun"] },
  { id: "build-to-victory", title: "Build to Victory", summary: "Master School Density, Filter Feeders, Apex cards, and winning turns.", lessonIds: ["school-density", "filter-feeder", "apex-predators", "winning-turn"] },
]);

/** Short positions prepared inside the real Simulator. */
export const SIMULATOR_V2_LESSONS = Object.freeze([
  lesson({
    id: "first-reef", moduleId: "reef-basics", number: 1,
    title: "Build your first reef", duration: "4 min", goalLabel: "Build a 3 VP reef",
    summary: "Place a Coral, collect RP, draw, and match two SeaPals to their slots.",
    introduction: "In this lesson, you’ll learn how every lively reef begins. Build Mustard Hill Coral, then help Sea Urchin and Clownfish settle into the right homes.",
    completion: "You built a home, collected RP, drew a card, and matched an Invertebrate and a Fish to reach 3 VP.",
    celebration: "Your first reef is thriving!",
    skills: ["Conditions", "Corals", "Reef layout", "Resource Points", "Drawing", "Creature slots", "Victory Points"],
    introducedConcepts: [
      SIMULATOR_V2_LESSON_CONCEPTS.ROUND_CONDITIONS,
      SIMULATOR_V2_LESSON_CONCEPTS.CORALS,
      SIMULATOR_V2_LESSON_CONCEPTS.RESOURCE_POINTS,
      SIMULATOR_V2_LESSON_CONCEPTS.DRAWING,
      SIMULATOR_V2_LESSON_CONCEPTS.CREATURE_SLOTS,
      SIMULATOR_V2_LESSON_CONCEPTS.REEF_LAYOUT,
      SIMULATOR_V2_LESSON_CONCEPTS.VICTORY_POINTS,
    ],
    focusCardId: "mustard-hill-coral-base", victoryTarget: 3,
    setupCardId: "mustard-hill-coral-base",
    expectedDraw: { deckType: "pals", cardId: "sea-urchin" },
    seed: seed({
      hand: ["mustard-hill-coral-base", "clownfish"],
      palsDeck: ["sea-urchin"],
      gamePhase: "setup",
      round: 0,
      hasDrawnThisTurn: false,
      activeConditionId: null,
    }),
    checkpoints: [
      checkpoint("tutorial-setup", ACTION.MATCH_READY, "Give your reef a home", "Place Mustard Hill Coral, then press Begin Round.", [atLeast("details.foundationCount", 1)]),
      collectCheckpoint(),
      drawCheckpoint(),
      buildCheckpoint("tutorial-build-card", "Match the Invertebrate slot", "sea-urchin"),
      buildCheckpoint("v2-place-fish", "Match the Fish slot", "clownfish"),
      victoryCheckpoint(3),
    ],
    buildCards: {
      "tutorial-build-card": ["sea-urchin"],
      "v2-place-fish": ["clownfish"],
    },
  }),
  lesson({
    id: "first-attack", moduleId: "battle-basics", number: 2,
    title: "Attack and defend", duration: "7 min", goalLabel: "Trade attacks and reach 7 VP",
    summary: "Attack with a Fish, defend the counterattack, then answer with a Predator.",
    introduction: "In this lesson, you’ll learn both sides of a faceoff. Start with Porcupine Fish, face my Spanish Hogfish's counterattack, then upgrade your Coral and answer with a Predator.",
    completion: "You attacked with a D4, saw a defeated creature move to the discard pile, then built Great Barracuda and answered with a D6 Bite.",
    celebration: "You commanded both sides of the battle!",
    skills: ["Attack costs", "Legal targets", "Defending", "Defeat", "Attack dice"],
    introducedConcepts: [
      SIMULATOR_V2_LESSON_CONCEPTS.ATTACKING,
      SIMULATOR_V2_LESSON_CONCEPTS.OPPONENT_TURNS,
      SIMULATOR_V2_LESSON_CONCEPTS.DEFENDING,
      SIMULATOR_V2_LESSON_CONCEPTS.CORAL_UPGRADES,
    ],
    focusCardId: "porcupine-fish", victoryTarget: 7,
    randomSeed: 0x5EA910CC,
    attackCardId: "porcupine-fish", attackTargetCardId: "sea-urchin",
    defeatTeachingCardId: "sea-urchin",
    expectedDraws: {
      "tutorial-draw-card": { deckType: "pals", cardId: "porcupine-fish" },
      "v2-draw-predator-upgrade": { deckType: "foundation", cardId: "brain-coral-stage-1" },
    },
    seed: seed({
      hand: ["brain-coral-base", "great-barracuda"],
      foundationDeck: ["brain-coral-stage-1"],
      palsDeck: ["porcupine-fish"],
      rp: 2,
      conditionDeck: ["clear-water", "abundant-sunlight"],
      gamePhase: "setup",
      round: 0,
      hasDrawnThisTurn: false,
      activeConditionId: null,
      playerTableau: [homeReef()],
      opponentTableau: [tableau("mustard-hill-coral-base", [["sea-urchin", "invertebrate"]])],
      opponentTurnMode: "play",
      opponent: {
        hand: ["spanish-hogfish"],
        foundationDeck: ["brain-coral-stage-2"],
        palsDeck: ["blue-whale"],
        rp: 0,
      },
    }),
    checkpoints: [
      collectCheckpoint(),
      drawCheckpoint(),
      buildCheckpoint("v2-build-attacker-coral", "Expand with Brain Coral", "brain-coral-base", { cardKind: "coral", placement: "foundation" }),
      buildCheckpoint("v2-place-attacker", "Give Porcupine Fish a home", "porcupine-fish"),
      checkpoint("tutorial-attack", ACTION.ATTACK_RESOLVED, "Resolve one attack", "Use Porcupine Fish's Crunch on the opposing Sea Urchin and resolve the faceoff.", [
        truthy("details.accepted"),
        equals("details.attackerCardId", "porcupine-fish"),
        equals("details.onPlay", false),
      ]),
      checkpoint("v2-pass-to-opponent", ACTION.TURN_ENDED, "Let the rival answer", "End your turn and watch the opponent build and attack."),
      checkpoint("v2-defend-attack", ACTION.ATTACK_RESOLVED, "Defend the counterattack", "Watch Spanish Hogfish attack your Sea Urchin.", [
        truthy("details.accepted"),
        equals("details.attackerCardId", "spanish-hogfish"),
        equals("details.defenderCardId", "sea-urchin"),
        equals("details.outcome", "defense-broken"),
        truthy("details.resolution.attackerWins"),
        equals("details.discardedCardId", "sea-urchin"),
        equals("details.destinationZone", "discard"),
      ], { actor: "opponent" }),
      drawCheckpoint({
        id: "v2-draw-predator-upgrade",
        title: "Draw the next Coral stage",
        deckType: "foundation",
      }),
      buildCheckpoint("v2-upgrade-predator-coral", "Open a Predator slot", "brain-coral-stage-1", { cardKind: "coral", placement: "foundation-upgrade" }),
      buildCheckpoint("v2-place-predator", "Play Great Barracuda", "great-barracuda"),
      checkpoint("v2-predator-attack", ACTION.ATTACK_RESOLVED, "Resolve the D6 Bite", "Use Great Barracuda's Quick Strike against the opposing Spanish Hogfish.", [
        truthy("details.accepted"),
        equals("details.attackerCardId", "great-barracuda"),
        truthy("details.onPlay"),
      ]),
      victoryCheckpoint(7),
    ],
    buildCards: {
      "v2-build-attacker-coral": ["brain-coral-base"],
      "v2-place-attacker": ["porcupine-fish"],
      "v2-upgrade-predator-coral": ["brain-coral-stage-1"],
      "v2-place-predator": ["great-barracuda"],
    },
  }),
  lesson({
    id: "support-search", moduleId: "smart-plays", number: 3,
    title: "Call in Support", duration: "3 min", goalLabel: "Search, build, and reach 4 VP",
    summary: "Use Coral Gardener to expand your familiar reef with the exact Coral it needs.",
    introduction: "In this lesson, you’ll learn to call for the right help at the right time. Coral Gardener can find Brain Coral; build it, then welcome another Sea Urchin.",
    completion: "Coral Gardener found a Coral, revealed it, and moved to the discard pile. You turned that one-time effect into a lasting 4 VP reef.",
    celebration: "A smart search grew your reef!",
    skills: ["Support cards", "Searching decks", "Discard pile"],
    introducedConcepts: [
      SIMULATOR_V2_LESSON_CONCEPTS.SUPPORT_CARDS,
      SIMULATOR_V2_LESSON_CONCEPTS.DECK_SEARCH,
    ],
    focusCardId: "coral-gardener", searchCardId: "brain-coral-base", victoryTarget: 4,
    seed: seed({
      hand: ["coral-gardener", "sea-urchin"],
      foundationDeck: ["brain-coral-base"],
      playerTableau: [homeReef()],
      rp: 2,
    }),
    checkpoints: [
      supportCheckpoint("v2-play-coral-gardener", "Search with Coral Gardener", "coral-gardener"),
      buildCheckpoint("v2-build-searched-coral", "Build the Coral you found", "brain-coral-base", { cardKind: "coral", placement: "foundation" }),
      buildCheckpoint("v2-support-finish", "Welcome Sea Urchin", "sea-urchin"),
      victoryCheckpoint(4),
    ],
    supportCards: { "v2-play-coral-gardener": ["coral-gardener"] },
    buildCards: {
      "v2-build-searched-coral": ["brain-coral-base"],
      "v2-support-finish": ["sea-urchin"],
    },
  }),
  lesson({
    id: "clear-stun", moduleId: "smart-plays", number: 4,
    title: "Clear Stunned", duration: "3 min", goalLabel: "Recover and reach 4 VP",
    summary: "Clear a Condition with Coral Heal, then upgrade and rebuild.",
    introduction: "In this lesson, you’ll learn to clear a Condition. Brain Coral is Stunned, so use Coral Heal, upgrade it, and give Sea Urchin a home.",
    completion: "Coral Heal cleared Stunned, so Brain Coral could upgrade and welcome another Sea Urchin.",
    celebration: "Your Coral is back in action!",
    skills: ["Stunned", "Coral Heal", "Status recovery"],
    introducedConcepts: [
      SIMULATOR_V2_LESSON_CONCEPTS.STATUS_EFFECTS,
    ],
    focusCardId: "coral-heal", victoryTarget: 4,
    seed: seed({
      hand: ["coral-heal", "brain-coral-stage-1", "sea-urchin"],
      playerTableau: [
        homeReef(),
        tableau("brain-coral-base", [], {
          statuses: [{ type: "stunned", sourceCardId: "crown-of-thorns" }],
        }),
      ],
      rp: 3,
    }),
    checkpoints: [
      supportCheckpoint("v2-clear-stunned", "Use Coral Heal", "coral-heal"),
      buildCheckpoint("v2-upgrade-after-stun", "Upgrade the recovered Coral", "brain-coral-stage-1", { cardKind: "coral", placement: "foundation-upgrade" }),
      buildCheckpoint("v2-stun-finish", "Use the open Invertebrate slot", "sea-urchin"),
      victoryCheckpoint(4),
    ],
    supportCards: { "v2-clear-stunned": ["coral-heal"] },
    buildCards: {
      "v2-upgrade-after-stun": ["brain-coral-stage-1"],
      "v2-stun-finish": ["sea-urchin"],
    },
  }),
  lesson({
    id: "school-density", moduleId: "build-to-victory", number: 5,
    title: "Supply School Density", duration: "3 min", goalLabel: "Supply 10, spend 10, reach 4 VP",
    summary: "Grow beyond your reef by building a Creature School and an Oceanic Fish.",
    introduction: "In this lesson, you’ll learn to grow beyond the reef. Build Sardine Ball, then use its 10 School Density to support Halfbeak in open water.",
    completion: "Sardine Ball supplied 10 School Density and Halfbeak committed all 10, growing your ecosystem to 4 VP. The density meter tracks what is supplied and what is already in use.",
    celebration: "Your open-water ecosystem is growing!",
    skills: ["Creature Schools", "School Density", "Open water"],
    introducedConcepts: [
      SIMULATOR_V2_LESSON_CONCEPTS.SCHOOL_DENSITY,
      SIMULATOR_V2_LESSON_CONCEPTS.OPEN_WATER,
    ],
    focusCardId: "sardine-ball-base", victoryTarget: 4,
    seed: seed({
      hand: ["sardine-ball-base", "halfbeak"],
      playerTableau: [homeReef()],
      rp: 3,
    }),
    checkpoints: [
      buildCheckpoint("v2-build-density-source", "Build Sardine Ball", "sardine-ball-base", { placement: "foundation" }),
      buildCheckpoint("v2-spend-density", "Play Halfbeak in open water", "halfbeak", { placement: "open-water" }),
      victoryCheckpoint(4),
    ],
    buildCards: {
      "v2-build-density-source": ["sardine-ball-base"],
      "v2-spend-density": ["halfbeak"],
    },
  }),
  lesson({
    id: "filter-feeder", moduleId: "build-to-victory", number: 6,
    title: "Welcome a Filter Feeder", duration: "2 min", goalLabel: "Commit 150 Density for 11 VP",
    summary: "Use a Habitat and available School Density to add Ocean Sunfish beside your reef.",
    introduction: "In this lesson, you’ll learn what a giant Filter Feeder needs. Open Ocean and two Schools are ready for Ocean Sunfish—if you can make the numbers work.",
    completion: "Ocean Sunfish joined your 3 VP reef because you had a matching Habitat, 8 RP, and at least 150 available School Density.",
    celebration: "A Filter Feeder joins the ecosystem!",
    skills: ["Filter Feeders", "Habitats", "Density commitments"],
    introducedConcepts: [
      SIMULATOR_V2_LESSON_CONCEPTS.HABITATS,
      SIMULATOR_V2_LESSON_CONCEPTS.FILTER_FEEDERS,
    ],
    focusCardId: "ocean-sunfish", victoryTarget: 11,
    seed: seed({
      hand: ["ocean-sunfish"],
      playerTableau: [homeReef(), tableau("sardine-ball-stage2"), tableau("anchovy-ball-stage1")],
      playerHabitats: ["open-ocean"],
      rp: 8,
    }),
    checkpoints: [
      buildCheckpoint("v2-play-filter-feeder", "Play Ocean Sunfish", "ocean-sunfish", { placement: "open-water" }),
      victoryCheckpoint(11),
    ],
    buildCards: { "v2-play-filter-feeder": ["ocean-sunfish"] },
  }),
  lesson({
    id: "apex-predators", moduleId: "build-to-victory", number: 7,
    title: "Level up to an Apex", duration: "4 min", goalLabel: "Upgrade, play an Apex, reach 14 VP",
    summary: "Upgrade Brain Coral to Stage 2, unlock its Apex slot, and resolve Ravage.",
    introduction: "In this lesson, you’ll learn how upgrades welcome Apex predators. Level Brain Coral to Stage 2, play Hammerhead, and guide both Ravage attacks.",
    completion: "Stage 2 unlocked an Apex slot. Hammerhead met its Habitat, slot, and RP requirements, then resolved both attacks from Ravage.",
    celebration: "Your Apex has arrived!",
    skills: ["Coral upgrades", "Apex slots", "Multi-attack abilities"],
    introducedConcepts: [
      SIMULATOR_V2_LESSON_CONCEPTS.APEX,
      SIMULATOR_V2_LESSON_CONCEPTS.MULTI_ATTACK,
    ],
    focusCardId: "hammerhead", attackCardId: "hammerhead", victoryTarget: 14,
    seed: seed({
      hand: ["brain-coral-stage-2", "hammerhead"],
      playerTableau: [
        tableau("brain-coral-stage-1"),
        homeReef(),
        tableau("pillar-coral-base", [["fairy-parrotfish", "fish"], ["arrow-crab", "invertebrate"], ["arrow-crab", "invertebrate"]]),
        tableau("lettuce-coral-base", [["arrow-crab", "invertebrate"]]),
      ],
      playerHabitats: ["coral-reef"],
      opponentTableau: [tableau("boulder-star-coral-stage-2", [["clownfish", "predator"], ["clownfish", "predator"]])],
      rp: 11,
      activeConditionId: null,
    }),
    checkpoints: [
      buildCheckpoint("v2-upgrade-apex-coral", "Upgrade Brain Coral to Stage 2", "brain-coral-stage-2", { cardKind: "coral", placement: "foundation-upgrade" }),
      buildCheckpoint("v2-play-apex", "Play Hammerhead", "hammerhead"),
      victoryCheckpoint(14),
      checkpoint("v2-resolve-ravage", ACTION.ATTACK_RESOLVED, "Resolve both Ravage attacks", "Choose two different legal targets and resolve both faceoffs.", [
        truthy("details.accepted"),
        equals("details.attackerCardId", "hammerhead"),
        truthy("details.onPlay"),
        atLeast("details.resolvedCount", 2),
      ]),
    ],
    buildCards: {
      "v2-upgrade-apex-coral": ["brain-coral-stage-2"],
      "v2-play-apex": ["hammerhead"],
    },
  }),
  lesson({
    id: "winning-turn", moduleId: "build-to-victory", number: 8,
    title: "Find your winning play", duration: "3 min", goalLabel: "Plan a full turn to reach 5 VP",
    summary: "Use a full turn to grow from 1 VP to a short practice goal of 5.",
    introduction: "In this lesson, you’ll learn to spot the winning line for yourself. Begin the round, draw wisely, and fill both Fish slots to reach 5 VP.",
    completion: "You reached 5 VP by collecting, drawing, and building your ecosystem. You are ready to try a match with the simulator's usual VP goal.",
    celebration: "You found the winning play!",
    skills: ["Turn order", "Choosing plays", "Winning"],
    introducedConcepts: [SIMULATOR_V2_LESSON_CONCEPTS.TURN_PLANNING],
    focusCardId: "clownfish", victoryTarget: 5,
    expectedDraw: { deckType: "pals", cardId: "clownfish" },
    seed: seed({
      hand: ["porcupine-fish"],
      rp: 1,
      gamePhase: "setup",
      round: 0,
      hasDrawnThisTurn: false,
      activeConditionId: null,
      playerTableau: [
        tableau("mustard-hill-coral-base", [["sea-urchin", "invertebrate"]]),
        tableau("brain-coral-base"),
      ],
    }),
    checkpoints: [
      collectCheckpoint(),
      drawCheckpoint(),
      buildCheckpoint("v2-first-winning-fish", "Choose your first Fish"),
      buildCheckpoint("v2-second-winning-fish", "Reach the practice goal"),
      victoryCheckpoint(5),
    ],
    buildCards: {
      "v2-first-winning-fish": ["porcupine-fish", "clownfish"],
      "v2-second-winning-fish": ["porcupine-fish", "clownfish"],
    },
  }),
]);

export function getSimulatorV2Lesson(value) {
  const id = typeof value === "string" ? value : value?.id;
  return SIMULATOR_V2_LESSONS.find((entry) => entry.id === id) ?? null;
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
  "sardine-ball-base": "Sardine Ball",
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
const OPEN_WATER_CARD_IDS = new Set(["halfbeak", "ocean-sunfish"]);
const name = (cardId) => CARD_NAMES[cardId] ?? cardId ?? "the highlighted card";

function conceptWasPreviouslyTaught(uiState, concept) {
  return Array.isArray(uiState.previouslyTaughtConcepts)
    && uiState.previouslyTaughtConcepts.includes(concept);
}

function conceptCopy(uiState, concept, teachingCopy, practiceCopy = "") {
  return conceptWasPreviouslyTaught(uiState, concept) ? practiceCopy : teachingCopy;
}

function placementConcept(cardId) {
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
  const slot = cardId === "sea-urchin"
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
  if (
    selected.id === "winning-turn"
    && current?.id === "v2-first-winning-fish"
    && candidates.length > 1
  ) {
    return "Drag either Fish from your hand into a highlighted Fish slot.";
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
  const slot = cardId === "sea-urchin"
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
        "Confirm selection to draw your card.",
      );
    }
    const firstAttackUpgradeDraw = selected.id === "first-attack" && expectedDraw?.cardId === "brain-coral-stage-1";
    const seaUrchinWasDefeated = Array.isArray(uiState.discardPileCardIds)
      && uiState.discardPileCardIds.includes("sea-urchin");
    const scenarioDrawMessage = selected.id === "winning-turn"
      ? "You need 4 more VP. Your Pals Deck contains a creature that can fill an empty Fish slot."
      : firstAttackUpgradeDraw
        ? `${seaUrchinWasDefeated
          ? "Sea Urchin lost that faceoff, so it moved to your discard pile and its 1 VP left your total."
          : "That counterattack is over, and your reef is ready to answer."
        } Brain Coral Stage 1 is on top of your Foundation Deck; draw it to open a Predator slot.`
      : selected.id === "first-attack"
        ? "Porcupine Fish is waiting on top of your Pals Deck. Draw it before you prepare the attack."
        : "Choose the Pals Deck when you want creatures and other Pals cards.";
    const drawMessage = conceptWasPreviouslyTaught(uiState, SIMULATOR_V2_LESSON_CONCEPTS.DRAWING)
      ? scenarioDrawMessage
      : selected.id === "first-reef"
        ? scenarioDrawMessage
        : `The Pals Deck holds creatures and other Pals cards. ${scenarioDrawMessage}`;
    return help(
      "draw-controls",
      drawMessage,
      `Choose one card from the ${expectedDraw?.deckType === "foundation" ? "Foundation" : "Pals"} Deck.`,
      { targetDeck: expectedDraw?.deckType ?? "pals", targetDrawAction: "add" },
    );
  }

  if (uiState.playingCardId) {
    const copy = placementCopy(uiState.playingCardId);
    return help(
      "placement",
      conceptCopy(uiState, placementConcept(uiState.playingCardId), copy.message),
      copy.action,
      { cue: "placement:" + uiState.playingCardId },
    );
  }

  if (uiState.gamePhase === "setup") {
    if (!uiState.hasCoralInPlay && selected.setupCardId) {
      const cardId = selected.setupCardId;
      const selectedCard = uiState.selectedHandCard === cardId
        && (uiState.handPopoverOpen || uiState.handDockSelectionOpen || uiState.modal === "hand");
      return help(
        selectedCard ? "play-card" : "hand",
        selectedCard
          ? "Card details are open. Play Card will let you choose its place in the reef."
          : "You start with 3 RP. Mustard Hill Coral costs 2 and creates a home for creatures.",
        selectedCard ? "Choose Play Card." : "Drag Mustard Hill Coral from your hand into your ecosystem.",
        {
          interaction: selectedCard ? "tap" : "drag",
          targetCardId: cardId,
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
      && uiState.layoutLessonProgress?.["move-foundation"] !== true
    ) {
      return help(
        "foundation-drag",
        "Your reef layout is flexible. Drag Mustard Hill Coral and its whole branch moves with it. You can also drag an individual slot when you need more room; moving either one never changes the rules.",
        "Drag Mustard Hill Coral a short distance into open water.",
        {
          actionId: "move-foundation",
          targetCardId: "mustard-hill-coral-base",
          hint: "Move the Coral by its card body. Its slots and attached creatures stay connected.",
        },
      );
    }
    if (
      selected.id === "first-reef"
      && uiState.hasCoralInPlay
      && uiState.layoutLessonProgress?.["move-slot"] !== true
    ) {
      return help(
        "slot-drag",
        "Each slot can move around its Coral too. This only organizes your reef; the slot still accepts the same kind of creature and remains connected to the same Coral.",
        "Drag the highlighted empty slot a short distance into clear water.",
        {
          actionId: "move-slot",
          targetCardId: "mustard-hill-coral-base",
          hint: "Drag the round slot marker. Its connector follows while the Coral stays in place.",
        },
      );
    }
    const message = selected.id === "winning-turn"
      ? "Your reef needs two more Fish to reach the target. Start the round to find the second one."
      : conceptCopy(
          uiState,
          SIMULATOR_V2_LESSON_CONCEPTS.RESOURCE_POINTS,
          "Your Coral is ready. Begin Round adds 1 RP for the turn plus 2 from Mustard Hill Coral.",
        );
    return help(
      "turn-button",
      message,
      conceptWasPreviouslyTaught(uiState, SIMULATOR_V2_LESSON_CONCEPTS.RESOURCE_POINTS)
        ? "Press Begin Round."
        : "Press Begin Round and watch your RP bank.",
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
      ? "Stunned pauses Brain Coral. Coral Heal clears the Condition so it can upgrade again."
      : "Support cards resolve once, then move to the discard pile. Coral Gardener searches your Foundation Deck for a Coral.";
    return help(
      selectedCard ? "play-card" : "hand",
      selectedCard ? name(cardId) + " is selected and ready to resolve." : message,
      selectedCard ? "Choose Play Card." : "Select " + name(cardId) + " in your hand.",
      {
        interaction: "tap",
        targetCardId: cardId,
        hint: cardId === "coral-heal"
          ? "After playing it, choose the Brain Coral marked Stunned."
          : "After playing it, choose Brain Coral in the deck search.",
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
        "Quick Strike triggers as Great Barracuda enters play. Each attack tells you which die to roll: its Bite uses a D6 (1–6), while Porcupine Fish's Crunch used a D4 (1–4).",
        "Choose the glowing Spanish Hogfish and resolve the D6 faceoff.",
        { targetCardId: "great-barracuda" },
      );
    }
    if (uiState.attackContext) {
      return help(
        "opponent-board",
        "Crunch can only target an opposing Invertebrate. Sea Urchin is the legal target glowing above.",
        "Choose the glowing Sea Urchin in the opposing reef.",
      );
    }
    if (uiState.handPopoverOpen || uiState.modal === "hand") {
      return help("close-modal", "Your attacker is already on the board; you do not need to play another card.", "Close your hand, then select Porcupine Fish.");
    }
    const attack = uiState.inspectedAttack?.ready ? uiState.inspectedAttack : uiState.readyAttack;
    const target = uiState.inspectedAttack?.ready ? "attack-button" : "player-board";
    return help(
      target,
      "Crunch costs 1 RP and targets an opposing Invertebrate.",
      target === "attack-button" ? "Use Crunch, then choose a legal target." : "Select Porcupine Fish, then use Crunch.",
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
    let message = conceptCopy(uiState, placementConcept(cardId), placementCopy(cardId).message);
    if (selected.id === "winning-turn") {
      message = current.id === "v2-first-winning-fish"
        ? "You have 5 RP and two open Fish slots. Each Fish in your hand costs 2 RP and gives 2 VP. Choose which to play first."
        : "Your reef has " + (uiState.playerVp ?? 3) + " VP. One more 2 VP Fish reaches the 5 VP practice goal.";
    } else if (cardId === "brain-coral-base" && selected.id === "support-search") {
      message = "The searched Brain Coral costs 1 RP and adds another Foundation with Fish and Invertebrate slots.";
    } else if (cardId === "brain-coral-stage-1") {
      message = selected.id === "first-attack"
        ? "Brain Coral has weathered a full turn, so it can level up now. Spend 2 RP for Stage 1. Here’s the payoff: its resilience doubles from 10 to 20 HP, it produces 2 RP instead of 1 each round, and it gains a Predator slot plus a second Invertebrate slot. Porcupine Fish stays safely in its Fish slot."
        : "Coral Heal cleared Stunned, so Brain Coral can upgrade for 2 RP. You’ve seen the payoff: 20 HP of resilience, 2 RP each round, a Predator slot, and another Invertebrate slot.";
    } else if (cardId === "brain-coral-stage-2") {
      message = "Upgrade Brain Coral to Stage 2 for 5 RP. The payoff is huge: resilience rises from 20 to 60 HP, production grows from 2 to 5 RP each round, and its reef opens two Predator, one Apex, and three Invertebrate slots. Stage 2 has no Fish slot, so check attached creatures first.";
    } else if (cardId === "sardine-ball-base") {
      message = "Sardine Ball costs 1 RP. As a Creature School it acts as a Foundation and supplies 10 School Density.";
    } else if (cardId === "halfbeak") {
      message = "Halfbeak costs 2 RP and commits the 10 School Density Sardine Ball supplies.";
    } else if (cardId === "ocean-sunfish") {
      message = "Ocean Sunfish needs 8 RP, a Coral Reef or Open Ocean Habitat, and 150 available School Density. All three are ready.";
    } else if (cardId === "hammerhead") {
      message = "Hammerhead costs 6 RP, needs Coral Reef, and must occupy an Apex slot. Stage 2 Brain Coral supplies that slot.";
    } else if (cardId === "great-barracuda") {
      message = "Each attack tells you which die to roll. Porcupine Fish's Crunch uses a D4 (1–4); Great Barracuda's Bite uses a D6 (1–6), giving it a wider possible range.";
    }
    return help(
      selectedCard ? "play-card" : "hand",
      selectedCard ? name(cardId) + " is selected. Play Card will show its legal placement." : message,
      selectedCard ? "Choose Play Card." : dragActionCopy(cardId, candidates, selected, current),
      {
        interaction: selectedCard ? "tap" : "drag",
        targetCardId: cardId,
        targetCardIds: candidates,
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
    const message = selected.id === "first-attack"
      ? "Brain Coral needs a turn in play before it can level up. End your turn; while it settles, I’ll play Spanish Hogfish and attack your Sea Urchin."
      : "You can save your remaining RP for a later turn.";
    return help("turn-button", message, "End your turn when you are ready.");
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
  deckType,
  gamePhase,
  layoutLessonProgress,
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
    return "This lesson focuses on the highlighted play. Try other abilities in a full match.";
  }
  if (action === "end-turn") {
    if (
      selected.id === "first-reef"
      && gamePhase === "setup"
      && current.actionType === ACTION.MATCH_READY
      && (
        layoutLessonProgress?.["move-foundation"] !== true
        || layoutLessonProgress?.["move-slot"] !== true
      )
    ) return "Move Mustard Hill Coral and one of its slots before beginning the round.";
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
  const completed = value?.version === 1 && Array.isArray(value.completedLessonIds)
    ? value.completedLessonIds
    : [];
  return {
    version: 1,
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
