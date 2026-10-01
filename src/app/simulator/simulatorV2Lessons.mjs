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
  instruction = `Draw one card from the ${deckType === "foundation" ? "Foundation" : "Main"} Deck.`,
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
    introducedCardIds: [],
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
  { id: "habitat-apex", title: "Build a Habitat", summary: "Meet Coral Reef's creature requirements, then unlock an Apex predator.", lessonIds: ["apex-predators"] },
  { id: "support-tools", title: "Support Strategies", summary: "Cycle a hand, search a deck, and reuse an On Play creature.", lessonIds: ["support-strategies"] },
  { id: "open-water", title: "Grow into Open Water", summary: "Build Creature Schools from zero Density, then welcome Ocean Sunfish.", lessonIds: ["filter-feeder"] },
]);

/** Short positions prepared inside the real Simulator. */
export const SIMULATOR_V2_LESSONS = Object.freeze([
  lesson({
    id: "first-reef", moduleId: "reef-basics", number: 1,
    title: "Build Your First Reef", duration: "6 min", goalLabel: "Set up and reach 1 VP",
    summary: "Build two Corals, read changing Conditions, place a creature, and level up your reef.",
    introduction: "Build an ecosystem and be first to reach the agreed Victory Point (VP) target: 10 for a learning game or 30 for a full game. Only cards currently in your ecosystem count toward your score. These lessons use prepared boards, arranged draws, and smaller goals so you can learn one idea at a time. Let's start by building a home for your first creature!",
    completion: "You built two Corals, adapted to Coral Disease, and upgraded Brain Coral to open a Predator slot.",
    preVictoryMessage: "Your reef now produces RP and houses a creature worth 1 VP. RP pays for plays; VP is your current score. If a creature leaves your ecosystem, you lose its VP immediately. In a normal game, begin with 3 RP and draw four Foundation and four Main cards, then play a starting Foundation. Our smaller practice hand let you learn that setup one step at a time.",
    knowledgeCheck: {
      prompt: "You have 6 VP in play. Your only 2-VP fish is removed. What is your score now?",
      correctChoiceId: "four",
      choices: [
        { id: "six", text: "6 VP — points stay once earned", feedback: "VP is not a running total of everything you have played. Count only the cards still in your ecosystem." },
        { id: "four", text: "4 VP — the removed fish no longer counts", feedback: "Exactly. Losing a creature can lower your score. Protecting your ecosystem matters as much as growing it." },
        { id: "eight", text: "8 VP — add the fish's points again", feedback: "The fish is leaving play, so its points are removed rather than added." },
      ],
    },
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
    introducedCardIds: [
      "brain-coral-base",
      "mustard-hill-coral-base",
      "sea-urchin",
      "brain-coral-stage-1",
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
    title: "Interactions", duration: "9 min", goalLabel: "Use four abilities and reach 7 VP",
    summary: "Lead an attack, defend a counterattack, trigger a passive, recover a card, and unleash an On Play ability.",
    introduction: "In our next lesson, we will learn about the relationships between different sea creatures. In each ecosystem, there is a well defined food web which tells what creatures prey on other creatures. Certain fish may hunt invertebrates, while predators may consume both. Beware, there’s always a bigger fish! Let’s get started!",
    completion: "You led and read a full faceoff, defended a counterattack, saw a passive work automatically, recovered a card with a non-attack action, and triggered a Predator's On Play attack.",
    preVictoryMessage: "You used three ability timings: Passive works automatically while a card is in play, On Play happens when it enters, and Action waits for your command and any RP payment. Read each attack's targeting symbols; a creature's class alone does not tell you what every ability can hunt. Ordinary defeated creatures enter discard and can be recovered by effects such as Scavenge. Destroyed Apex and Filter Feeders go to the Lost Zone instead.",
    knowledgeCheck: {
      prompt: "Your attack and the defender both finish on 4. No other effects apply. What happens?",
      correctChoiceId: "defender",
      choices: [
        { id: "reroll", text: "Both players reroll", feedback: "There is no automatic tie reroll. A tied total has a winner under the normal faceoff rules." },
        { id: "attacker", text: "The attacker wins because it started the fight", feedback: "Starting the attack gives no tie advantage. The attacker must beat the defender's total." },
        { id: "defender", text: "The defender wins; both creatures stay", feedback: "Right. Ties favor the defender. A failed normal attack does not destroy the attacker or deal retaliation damage." },
      ],
    },
    celebration: "Every ability had a job to do!",
    fitAllPlayerSlots: true,
    skills: ["Attack actions", "Offense and defense", "Passive abilities", "Recovery actions", "On Play abilities"],
    introducedConcepts: [
      SIMULATOR_V2_LESSON_CONCEPTS.ATTACKING,
      SIMULATOR_V2_LESSON_CONCEPTS.OPPONENT_TURNS,
      SIMULATOR_V2_LESSON_CONCEPTS.DEFENDING,
      SIMULATOR_V2_LESSON_CONCEPTS.PASSIVE_ABILITIES,
      SIMULATOR_V2_LESSON_CONCEPTS.ON_PLAY_ABILITIES,
      SIMULATOR_V2_LESSON_CONCEPTS.NON_ATTACK_ACTIONS,
    ],
    introducedCardIds: ["porcupine-fish", "blue-crab", "great-barracuda"],
    focusCardId: "porcupine-fish", victoryTarget: 7,
    randomSeed: 0x5EA9101C,
    attackCardId: "porcupine-fish", attackTargetCardId: "sea-urchin",
    defeatTeachingCardId: "sea-urchin",
    abilityCardId: "blue-crab",
    preFaceoffPrimer: {
      checkpointId: "tutorial-attack",
      steps: [
        {
          title: "Crunch starts a dice faceoff!",
          message: "You just played Porcupine Fish! Its Crunch Action can attack your opponent's Sea Urchin because Sea Urchin is an Invertebrate. Crunch starts a faceoff: Porcupine Fish attacks with a D4, and Sea Urchin defends with a D6. Before we roll, meet all six faceoff dice: D4, D6, D8, D10, D12, and D20. The number tells you how many sides the die has and its possible range. A D4 rolls 1–4, while a D20 rolls 1–20. A larger die can roll higher, but every result still depends on the roll!",
          action: "Review the dice and their ranges, then learn how this faceoff works.",
          visualAid: {
            kind: "dice-ladder",
            dice: ["D4", "D6", "D8", "D10", "D12", "D20"],
          },
        },
        {
          title: "How a faceoff is decided",
          message: "The attacker rolls the die named by its ability; the defender uses the Defense die printed on its card. After modifiers, the higher total wins, and ties go to the defender. A successful normal attack sends the defender to discard. If the defender wins, both creatures stay: the attacker takes no retaliation damage. Card abilities can change these results, so read their text.",
          action: "Remember: higher wins, and ties go to the defender.",
        },
        {
          title: "Why Porcupine Fish targets Invertebrates",
          message: "Real porcupinefish hunt hard-shelled animals such as snails, crabs, and sea urchins. Their fused teeth form a powerful beak that can crack shells! Crunch reflects that food-web relationship: it can target an opposing Invertebrate. Sea Urchin's type line identifies it as an Invertebrate, so it is a legal target.",
          action: "Continue, then select Porcupine Fish to begin Crunch.",
        },
      ],
    },
    abilityRecoveryTargets: { "v2-recover-sea-urchin": "sea-urchin" },
    expectedDraws: {
      "v2-draw-opening-attacker": { deckType: "pals", cardId: "porcupine-fish" },
      "tutorial-draw-card": { deckType: "pals", cardId: "blue-crab" },
      "v2-draw-predator": { deckType: "pals", cardId: "great-barracuda" },
    },
    seed: seed({
      hand: [],
      foundationDeck: [],
      palsDeck: ["porcupine-fish", "blue-crab", "great-barracuda"],
      rp: 4,
      conditionDeck: ["clear-water", "murky-water"],
      gamePhase: "draw",
      round: 2,
      turn: 2,
      hasDrawnThisTurn: false,
      turnDrawSelection: {
        requested: 1,
        target: 1,
        shortfall: 0,
        foundation: 0,
        pals: 0,
      },
      activeConditionId: "coral-disease",
      playerTableau: [
        tableau("brain-coral-stage-1", [
          ["sea-urchin", "invertebrate"],
        ], { x: -10, y: 50 }),
        tableau("mustard-hill-coral-base", [], { x: 110, y: 50 }),
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
      drawCheckpoint({
        id: "v2-draw-opening-attacker",
        title: "Begin your turn with a Main Deck draw",
        deckType: "pals",
      }),
      buildCheckpoint("v2-place-opening-attacker", "Play Porcupine Fish", "porcupine-fish"),
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
      checkpoint("tutorial-draw-card", ACTION.CARD_DRAWN, "Draw Blue Crab", "Choose one card from the Main Deck.", [
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
      "v2-place-opening-attacker": ["porcupine-fish"],
      "v2-place-passive": ["blue-crab"],
      "v2-replay-sea-urchin": ["sea-urchin"],
      "v2-place-predator": ["great-barracuda"],
    },
    placementTargets: {
      "v2-place-opening-attacker": {
        cardId: "porcupine-fish",
        foundationCardId: "brain-coral-stage-1",
        slotClass: "fish",
        slotOrdinal: 0,
        blockMessage: "Place Porcupine Fish in Brain Coral's highlighted Fish slot so the Predator slot stays open for Great Barracuda later.",
      },
      "v2-place-predator": {
        cardId: "great-barracuda",
        foundationCardId: "brain-coral-stage-1",
        slotClass: "predator",
        slotOrdinal: 0,
        blockMessage: "Great Barracuda is a Reef Predator, so it cannot use a Fish slot. Place it in Brain Coral's highlighted Predator slot.",
      },
    },
  }),
  lesson({
    id: "apex-predators", moduleId: "habitat-apex", number: 3,
    randomSeed: (LESSON_RANDOM_SEED_BASE + 4) >>> 0,
    title: "Build a Habitat for an Apex", duration: "7 min", goalLabel: "Complete Coral Reef and reach 12 VP",
    summary: "Meet Coral Reef's creature requirements, play the Habitat, upgrade a Coral, and welcome Hammerhead.",
    introduction: "In this lesson, you’ll learn how a thriving Habitat unlocks powerful creatures! Complete the required Fish and Invertebrate counts, place Coral Reef, and prepare an Apex slot for Hammerhead.",
    completion: "You supplied four Reef Corals, two Reef Fish, and two Reef Invertebrates to sustain Coral Reef. That Habitat and a Stage 2 Apex slot let Hammerhead enter and use Ravage.",
    preVictoryMessage: "Your Habitat unlocked the hammerhead, and you resolved all of Ravage before finishing. A Habitat is an extra requirement, not a home or a payment: the supporting creatures stay in play, and the Apex still needs a legal slot and enough RP. Keep Coral Reef's required population alive. If any count is short at the end of your turn, the Habitat takes 10 HP damage.",
    knowledgeCheck: {
      prompt: "Coral Reef is in play, but your only Apex slot is occupied. You have enough RP for another hammerhead. Can you play it?",
      correctChoiceId: "slot",
      choices: [
        { id: "habitat", text: "Yes — the Habitat replaces the need for a slot", feedback: "The Habitat unlocks the card, but does not replace its home. A Reef Apex still needs a compatible open slot." },
        { id: "slot", text: "No — it also needs an open Apex slot", feedback: "Correct. Check every requirement: the Habitat, the RP cost, and a compatible open home." },
        { id: "sacrifice", text: "Yes — discard a required Fish to make room", feedback: "Habitat requirements are creatures you keep in play, not sacrifices. Removing a Fish would not create an Apex slot." },
      ],
    },
    celebration: "Your thriving reef welcomed an Apex!",
    skills: ["Habitat requirements", "Maintaining a Habitat", "Apex slots", "Multi-attack abilities", "Turn planning"],
    introducedConcepts: [
      SIMULATOR_V2_LESSON_CONCEPTS.HABITATS,
      SIMULATOR_V2_LESSON_CONCEPTS.APEX,
      SIMULATOR_V2_LESSON_CONCEPTS.MULTI_ATTACK,
      SIMULATOR_V2_LESSON_CONCEPTS.TURN_PLANNING,
    ],
    introducedCardIds: ["clownfish", "arrow-crab", "coral-reef", "brain-coral-stage-2", "hammerhead"],
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
      checkpoint("v2-resolve-ravage", ACTION.ATTACK_RESOLVED, "Resolve both Ravage attacks", "Choose two different legal targets and resolve both faceoffs.", [
        truthy("details.accepted"),
        equals("details.attackerCardId", "hammerhead"),
        truthy("details.onPlay"),
        atLeast("details.resolvedCount", 2),
      ]),
      victoryCheckpoint(12),
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
    id: "support-strategies", moduleId: "support-tools", number: 4,
    randomSeed: 0x5EA9400D,
    title: "Turn Support into a combo", duration: "10 min", goalLabel: "Use three Supports and repeat an On Play ability",
    summary: "Search for a precise card, refresh your hand, and reuse Great Barracuda's Quick Strike.",
    introduction: "In this lesson, you’ll learn three ways Support cards shape a turn: Coral Gardener searches for a precise Foundation, Dr. Evans exchanges a stale hand for seven new cards, and Spearfishing converts a creature into RP. Then Blue Crab will retrieve that creature so its On Play ability can fire again!",
    completion: "You searched for and built a Foundation, watched Recycle refund an eaten Fish, cycled a stale hand, converted Great Barracuda into RP, and used Scavenge to replay Quick Strike.",
    preVictoryMessage: "You used a search to choose a specific card, a hand cycle to draw fresh options, and Spearfishing plus Scavenge to replay an On Play attack. Recycle was different: it refunded RP when your Fish was eaten, but did not return the card. Read each Support's timing restriction; the three we used prevent another Support that turn. Also watch your decks: you lose if you cannot complete a required draw, not merely because a deck becomes empty.",
    knowledgeCheck: {
      prompt: "Spearfishing sends your barracuda to discard. How can you trigger its On Play Quick Strike again?",
      correctChoiceId: "recover-replay",
      choices: [
        { id: "recycle", text: "Wait for Blue Crab's Recycle to replay it", feedback: "Recycle gives RP when one of your Fish is eaten. It neither retrieves a card nor triggers from Spearfishing." },
        { id: "tap-discard", text: "Use Quick Strike while it is in discard", feedback: "On Play triggers when the creature enters your ecosystem. It cannot attack from the discard pile." },
        { id: "recover-replay", text: "Pay for Scavenge, then pay to play the barracuda again", feedback: "Exactly. Scavenge returns it to hand; replaying it pays its current cost and creates a new On Play trigger." },
      ],
    },
    celebration: "One Barracuda delivered two entrances!",
    fitAllPlayerSlots: true,
    skills: ["Support timing", "Deck search", "Hand cycling", "Spearfishing", "Discard recovery", "On Play combos"],
    introducedConcepts: [
      SIMULATOR_V2_LESSON_CONCEPTS.SUPPORT_CARDS,
      SIMULATOR_V2_LESSON_CONCEPTS.DECK_SEARCH,
    ],
    introducedCardIds: ["coral-gardener", "dr-evans", "spearfishing"],
    focusCardId: "coral-gardener", attackCardId: "great-barracuda", abilityCardId: "blue-crab", victoryTarget: 6,
    supportSearchTargets: {
      "v2-search-for-coral": "mustard-hill-coral-base",
    },
    supportEffectTargets: {
      "v2-cash-in-barracuda": "great-barracuda",
    },
    abilityRecoveryTargets: {
      "v2-scavenge-barracuda": "great-barracuda",
    },
    seed: seed({
      hand: ["coral-gardener", "porcupine-fish", "coral-reef", "hammerhead"],
      foundationDeck: ["mustard-hill-coral-base"],
      palsDeck: ["dr-evans", "spearfishing", "great-barracuda", "sea-urchin", "porcupine-fish", "coral-reef", "hammerhead", "clownfish", "arrow-crab"],
      playerTableau: [
        tableau("brain-coral-stage-1", [["clownfish", "fish"], ["blue-crab", "invertebrate"]]),
      ],
      opponentTableau: [
        tableau("brain-coral-stage-1"),
        tableau("mustard-hill-coral-base", [["bluestriped-grunt", "fish"]]),
        tableau("mustard-hill-coral-base", [["bluestriped-grunt", "fish"]]),
      ],
      opponentTurnMode: "play",
      opponent: {
        hand: ["great-barracuda"],
        foundationDeck: [],
        palsDeck: ["blue-whale", "blue-whale"],
        rp: 4,
      },
      rp: 2,
      activeConditionId: "clear-water",
      conditionDeck: ["coral-disease", "clear-water"],
    }),
    expectedDraws: {
      "v2-draw-dr-evans": { deckType: "pals", cardId: "dr-evans" },
      "v2-draw-final-support-card": { deckType: "pals", cardId: "arrow-crab" },
    },
    checkpoints: [
      supportCheckpoint("v2-search-for-coral", "Search for the right Foundation", "coral-gardener"),
      buildCheckpoint("v2-build-searched-coral", "Build the searched Foundation", "mustard-hill-coral-base", { cardKind: "coral", placement: "foundation" }),
      checkpoint("v2-pass-after-search", ACTION.TURN_ENDED, "Watch Recycle protect your economy", "End your turn so the opponent can eat Clownfish while Blue Crab is in play."),
      checkpoint("v2-see-recycle", ACTION.ATTACK_RESOLVED, "See Recycle refund an eaten Fish", "Watch Blue Crab return half of Clownfish's printed RP cost after the opponent eats it.", [
        truthy("details.accepted"),
        equals("details.attackerCardId", "great-barracuda"),
        equals("details.defenderCardId", "clownfish"),
        equals("details.discardedCardId", "clownfish"),
      ], { actor: "opponent" }),
      checkpoint("v2-collect-for-cycle", ACTION.RP_COLLECTED, "Begin the hand-cycle turn", "Collect RP for your next plan.", [atLeast("details.collected", 1)]),
      drawCheckpoint({ id: "v2-draw-dr-evans", title: "Draw Dr. Evans", deckType: "pals" }),
      supportCheckpoint("v2-cycle-hand", "Cycle the stale hand", "dr-evans"),
      checkpoint("v2-pass-after-cycle", ACTION.TURN_ENDED, "Reset Support timing again", "End your turn after Dr. Evans resolves."),
      checkpoint("v2-collect-for-combo", ACTION.RP_COLLECTED, "Fund the Support combo", "Collect enough RP to reuse Great Barracuda.", [atLeast("details.collected", 1)]),
      drawCheckpoint({ id: "v2-draw-final-support-card", title: "Draw the final card", deckType: "pals" }),
      buildCheckpoint("v2-place-sea-urchin", "Add a safe scoring card", "sea-urchin"),
      buildCheckpoint("v2-play-first-barracuda", "Play Great Barracuda", "great-barracuda"),
      checkpoint("v2-first-quick-strike", ACTION.ATTACK_RESOLVED, "Resolve Quick Strike", "Resolve Great Barracuda's first On Play Bite.", [
        truthy("details.accepted"),
        equals("details.attackerCardId", "great-barracuda"),
        truthy("details.onPlay"),
      ]),
      supportCheckpoint("v2-cash-in-barracuda", "Convert a creature into RP", "spearfishing"),
      abilityCheckpoint("v2-scavenge-barracuda", "Retrieve the spent creature", "blue-crab", "Scavenge", "great-barracuda"),
      buildCheckpoint("v2-replay-barracuda", "Replay Great Barracuda", "great-barracuda"),
      checkpoint("v2-repeat-quick-strike", ACTION.ATTACK_RESOLVED, "Trigger Quick Strike again", "Resolve Great Barracuda's repeated On Play Bite.", [
        truthy("details.accepted"),
        equals("details.attackerCardId", "great-barracuda"),
        truthy("details.onPlay"),
      ]),
      buildCheckpoint("v2-play-final-arrow-crab", "Finish the support plan", "arrow-crab"),
      victoryCheckpoint(6),
    ],
    supportCards: {
      "v2-search-for-coral": ["coral-gardener"],
      "v2-cycle-hand": ["dr-evans"],
      "v2-cash-in-barracuda": ["spearfishing"],
    },
    buildCards: {
      "v2-build-searched-coral": ["mustard-hill-coral-base"],
      "v2-place-sea-urchin": ["sea-urchin"],
      "v2-play-first-barracuda": ["great-barracuda"],
      "v2-replay-barracuda": ["great-barracuda"],
      "v2-play-final-arrow-crab": ["arrow-crab"],
    },
    placementTargets: {
      "v2-place-sea-urchin": {
        cardId: "sea-urchin",
        foundationCardId: "brain-coral-stage-1",
        slotClass: "invertebrate",
        slotOrdinal: 1,
      },
      "v2-play-first-barracuda": {
        cardId: "great-barracuda",
        foundationCardId: "brain-coral-stage-1",
        slotClass: "predator",
        slotOrdinal: 0,
      },
      "v2-replay-barracuda": {
        cardId: "great-barracuda",
        foundationCardId: "brain-coral-stage-1",
        slotClass: "predator",
        slotOrdinal: 0,
        blockMessage: "Return Great Barracuda to Brain Coral's highlighted Predator slot so Quick Strike can trigger again.",
      },
      "v2-play-final-arrow-crab": {
        cardId: "arrow-crab",
        foundationCardId: "mustard-hill-coral-base",
        slotClass: "invertebrate",
        slotOrdinal: 0,
      },
    },
  }),
  lesson({
    id: "filter-feeder", moduleId: "open-water", number: 5,
    randomSeed: (LESSON_RANDOM_SEED_BASE + 7) >>> 0,
    title: "Build an open-water ecosystem", duration: "12 min", goalLabel: "Build Open Ocean from 0 School Density and play Ocean Sunfish",
    summary: "Start with a bare board, build an open-water food web, and create enough shared School Density for Ocean Sunfish.",
    introduction: "Build an ecosystem from a bare board and 0 School Density! Creature Schools are another kind of Foundation; you can use them alongside Corals. They create no slots, but supply shared Density for creatures in open water. This practice hand and extra starting RP let you focus on Schools. Build the food web that will support an ocean sunfish!",
    completion: "You began with a bare board and 0 School Density, built four Creature Schools instead of Corals, added open-water Fish and Invertebrates without using slots, established Open Ocean, and welcomed Ocean Sunfish with 10 Density still open.",
    preVictoryMessage: "You built two kinds of homes across these lessons: Coral slots for compatible reef creatures, and shared School Density for creatures in open water. For your first normal match, try 10 VP. Each turn, draw one card from either deck, collect RP, then make the plays and use the abilities you can afford. Check the active Condition and printed requirements, resolve every effect, and end your turn when ready. Keep your score in play while disrupting your opponent's plan!",
    knowledgeCheck: {
      prompt: "Your Schools supply 60 Density and your creatures use all 60. A creature using 20 Density leaves play. How much capacity is now free?",
      correctChoiceId: "twenty",
      choices: [
        { id: "zero", text: "0 — Density was spent permanently", feedback: "School Density is shared capacity, not spent currency. A creature releases its commitment when it leaves." },
        { id: "twenty", text: "20 — the departing creature releases it", feedback: "Right. RP is spent to play a card; School Density is reserved only while that creature stays in your ecosystem." },
        { id: "sixty", text: "60 — all creatures stop using it", feedback: "The creatures still in play continue reserving 40. Only the departing creature's 20 becomes free." },
      ],
    },
    celebration: "Your open-water ecosystem supports a giant!",
    fitAllPlayerSlots: true,
    skills: ["Creature Schools", "School Density", "Foundation upgrades", "Open-water placement", "Open Ocean requirements", "Filter Feeders"],
    introducedConcepts: [
      SIMULATOR_V2_LESSON_CONCEPTS.SCHOOL_DENSITY,
      SIMULATOR_V2_LESSON_CONCEPTS.OPEN_WATER,
      SIMULATOR_V2_LESSON_CONCEPTS.FILTER_FEEDERS,
    ],
    introducedCardIds: ["herring-ball-base", "herring-ball-stage1", "herring-ball-stage2", "sardine-ball-base", "anchovy-ball-base", "halfbeak", "bonito-tuna", "blue-sea-dragon", "market-squid", "open-ocean", "ocean-sunfish"],
    focusCardId: "ocean-sunfish", victoryTarget: 13,
    schoolMomentumTargets: {
      "v2-upgrade-second-herring-stage1": "herring-ball-stage1",
      "v2-grow-herring-stage1s": "herring-ball-stage2",
    },
    expectedDraws: {
      "v2-draw-herring-stage1": { deckType: "foundation", cardId: "herring-ball-stage1" },
      "v2-draw-halfbeak": { deckType: "pals", cardId: "halfbeak" },
      "v2-draw-bonito-tuna": { deckType: "pals", cardId: "bonito-tuna" },
      "v2-draw-blue-sea-dragon": { deckType: "pals", cardId: "blue-sea-dragon" },
      "v2-draw-market-squid": { deckType: "pals", cardId: "market-squid" },
      "v2-draw-open-ocean": { deckType: "pals", cardId: "open-ocean" },
      "v2-draw-ocean-sunfish": { deckType: "pals", cardId: "ocean-sunfish" },
    },
    seed: seed({
      hand: ["herring-ball-base", "herring-ball-base", "sardine-ball-base", "anchovy-ball-base"],
      foundationDeck: ["herring-ball-stage1", "herring-ball-stage1", "herring-ball-stage2", "brain-coral-base"],
      palsDeck: ["halfbeak", "bonito-tuna", "blue-sea-dragon", "market-squid", "open-ocean", "ocean-sunfish"],
      playerTableau: [],
      playerHabitats: [],
      rp: 8,
      activeConditionId: "clear-water",
      conditionDeck: ["clear-water", "clear-water", "clear-water", "clear-water", "clear-water", "clear-water", "clear-water"],
    }),
    checkpoints: [
      buildCheckpoint("v2-place-first-herring-school", "Place the first Creature School", "herring-ball-base", { cardKind: "creature", placement: "foundation" }),
      buildCheckpoint("v2-place-second-herring-school", "Place another Herring Ball", "herring-ball-base", { cardKind: "creature", placement: "foundation" }),
      buildCheckpoint("v2-place-sardine-school", "Add Sardine Ball", "sardine-ball-base", { cardKind: "creature", placement: "foundation" }),
      buildCheckpoint("v2-place-anchovy-school", "Add Anchovy Ball", "anchovy-ball-base", { cardKind: "creature", placement: "foundation" }),
      checkpoint("v2-grow-school-bases", ACTION.TURN_ENDED, "Let the Schools establish", "End the turn so both Herring Ball Schools can become eligible for upgrades."),
      checkpoint("v2-collect-for-herring-stage1", ACTION.RP_COLLECTED, "Collect from four Schools", "Begin the next round and collect RP from every Creature School.", [atLeast("details.collected", 1)]),
      drawCheckpoint({ id: "v2-draw-herring-stage1", title: "Draw Herring Ball Stage 1", deckType: "foundation" }),
      buildCheckpoint("v2-upgrade-first-herring-stage1", "Upgrade the first Herring Ball", "herring-ball-stage1", { cardKind: "creature", placement: "foundation-upgrade" }),
      buildCheckpoint("v2-upgrade-second-herring-stage1", "Upgrade the second Herring Ball", "herring-ball-stage1", { cardKind: "creature", placement: "foundation-upgrade" }),
      checkpoint("v2-grow-herring-stage1s", ACTION.TURN_ENDED, "Let both Stage 1 Schools establish", "End the turn so a Herring Ball can reach Stage 2."),
      checkpoint("v2-collect-for-herring-stage2", ACTION.RP_COLLECTED, "Fund the final School upgrade", "Collect the 7 RP needed for Herring Ball Stage 2.", [atLeast("details.collected", 1)]),
      drawCheckpoint({ id: "v2-draw-halfbeak", title: "Draw the first open-water Fish", deckType: "pals" }),
      buildCheckpoint("v2-upgrade-herring-stage2", "Raise capacity to 220 Density", "herring-ball-stage2", { cardKind: "creature", placement: "foundation-upgrade" }),
      checkpoint("v2-fund-open-water-fish", ACTION.TURN_ENDED, "Prepare the open-water food web", "End the turn so your Schools can fund the creatures Open Ocean requires."),
      checkpoint("v2-collect-for-open-water-fish", ACTION.RP_COLLECTED, "Collect from the upgraded Schools", "Collect RP from the four Schools.", [atLeast("details.collected", 1)]),
      drawCheckpoint({ id: "v2-draw-bonito-tuna", title: "Draw the second open-water Fish", deckType: "pals" }),
      buildCheckpoint("v2-play-halfbeak", "Place Halfbeak in open water", "halfbeak", { placement: "open-water" }),
      buildCheckpoint("v2-play-bonito-tuna", "Place Bonito Tuna in open water", "bonito-tuna", { placement: "open-water" }),
      checkpoint("v2-fund-first-open-water-invertebrate", ACTION.TURN_ENDED, "Prepare an open-water Invertebrate", "End the turn to prepare the next part of Open Ocean's food web."),
      checkpoint("v2-collect-for-blue-sea-dragon", ACTION.RP_COLLECTED, "Collect for Blue Sea Dragon", "Collect RP from the Schools.", [atLeast("details.collected", 1)]),
      drawCheckpoint({ id: "v2-draw-blue-sea-dragon", title: "Draw Blue Sea Dragon", deckType: "pals" }),
      buildCheckpoint("v2-play-blue-sea-dragon", "Place Blue Sea Dragon in open water", "blue-sea-dragon", { placement: "open-water" }),
      checkpoint("v2-fund-second-open-water-invertebrate", ACTION.TURN_ENDED, "Prepare the second Invertebrate", "End the turn so the last Open Ocean requirement can join your ecosystem."),
      checkpoint("v2-collect-for-market-squid", ACTION.RP_COLLECTED, "Collect for Market Squid", "Collect RP from the Schools.", [atLeast("details.collected", 1)]),
      drawCheckpoint({ id: "v2-draw-market-squid", title: "Draw Market Squid", deckType: "pals" }),
      buildCheckpoint("v2-play-market-squid", "Place Market Squid in open water", "market-squid", { placement: "open-water" }),
      checkpoint("v2-prepare-open-ocean", ACTION.TURN_ENDED, "Prepare the Habitat turn", "End the turn after meeting Open Ocean's four School, two Fish, and two Invertebrate requirements."),
      checkpoint("v2-collect-for-open-ocean", ACTION.RP_COLLECTED, "Begin the Habitat turn", "Collect RP before drawing Open Ocean.", [atLeast("details.collected", 1)]),
      drawCheckpoint({ id: "v2-draw-open-ocean", title: "Draw Open Ocean", deckType: "pals" }),
      buildCheckpoint("v2-play-open-ocean", "Establish Open Ocean", "open-ocean", { cardKind: "habitat", placement: "habitat" }),
      checkpoint("v2-fund-ocean-sunfish", ACTION.TURN_ENDED, "Prepare the Filter Feeder turn", "End the turn so the Schools can fund Ocean Sunfish."),
      checkpoint("v2-collect-for-ocean-sunfish", ACTION.RP_COLLECTED, "Keep enough RP for Ocean Sunfish", "Review your bank before drawing Ocean Sunfish; a full bank cannot gain more RP.", [atLeast("details.collected", 0), atLeast("details.bankAfter", 8)]),
      drawCheckpoint({ id: "v2-draw-ocean-sunfish", title: "Draw Ocean Sunfish", deckType: "pals" }),
      buildCheckpoint("v2-play-filter-feeder", "Welcome Ocean Sunfish", "ocean-sunfish", { placement: "open-water" }),
      victoryCheckpoint(13),
    ],
    buildCards: {
      "v2-place-first-herring-school": ["herring-ball-base"],
      "v2-place-second-herring-school": ["herring-ball-base"],
      "v2-place-sardine-school": ["sardine-ball-base"],
      "v2-place-anchovy-school": ["anchovy-ball-base"],
      "v2-upgrade-first-herring-stage1": ["herring-ball-stage1"],
      "v2-upgrade-second-herring-stage1": ["herring-ball-stage1"],
      "v2-upgrade-herring-stage2": ["herring-ball-stage2"],
      "v2-play-halfbeak": ["halfbeak"],
      "v2-play-bonito-tuna": ["bonito-tuna"],
      "v2-play-blue-sea-dragon": ["blue-sea-dragon"],
      "v2-play-market-squid": ["market-squid"],
      "v2-play-open-ocean": ["open-ocean"],
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

export function getSimulatorV2PreviouslySeenCardIds(value, completedLessonIds = []) {
  const selected = getSimulatorV2Lesson(value);
  if (!selected) return [];
  const completed = new Set(Array.isArray(completedLessonIds) ? completedLessonIds : []);
  return [...new Set(SIMULATOR_V2_LESSONS
    .filter((entry) => entry.number < selected.number && completed.has(entry.id))
    .flatMap((entry) => entry.introducedCardIds ?? []))];
}

export function createSimulatorV2LessonRuntime(lessonId, { completedLessonIds = [] } = {}) {
  const selected = getSimulatorV2Lesson(lessonId);
  if (!selected) throw new RangeError("Unknown Simulator V2 lesson: " + String(lessonId) + ".");
  return {
    lesson: selected,
    scriptedDecks: false,
    contract: selected.contract,
    previouslyTaughtConcepts: getSimulatorV2PreviouslyTaughtConcepts(selected, completedLessonIds),
    previouslySeenCardIds: getSimulatorV2PreviouslySeenCardIds(selected, completedLessonIds),
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
  "dr-evans": "Dr. Evans",
  spearfishing: "Spearfishing",
  "coral-heal": "Coral Heal",
  "capt-dani": "Capt. Dani",
  "coral-reef": "Coral Reef",
  "open-ocean": "Open Ocean",
  "lettuce-coral-base": "Lettuce Coral",
  "sardine-ball-base": "Sardine Ball",
  "anchovy-ball-base": "Anchovy Ball",
  "herring-ball-base": "Herring Ball",
  "herring-ball-stage1": "Herring Ball Stage 1",
  "herring-ball-stage2": "Herring Ball Stage 2",
  "anchovy-ball-stage1": "Anchovy Ball Stage 1",
  halfbeak: "Halfbeak",
  "bonito-tuna": "Bonito Tuna",
  "blue-sea-dragon": "Blue Sea Dragon",
  "market-squid": "Market Squid",
  "ocean-sunfish": "Ocean Sunfish",
  hammerhead: "Hammerhead",
});

const FOUNDATION_CARD_IDS = new Set([
  "mustard-hill-coral-base",
  "brain-coral-base",
  "sardine-ball-base",
  "anchovy-ball-base",
  "herring-ball-base",
]);
const UPGRADE_CARD_IDS = new Set(["brain-coral-stage-1", "brain-coral-stage-2"]);
const SCHOOL_BASE_CARD_IDS = new Set(["sardine-ball-base", "anchovy-ball-base", "herring-ball-base"]);
const SCHOOL_UPGRADE_CARD_IDS = new Set(["anchovy-ball-stage1", "herring-ball-stage1", "herring-ball-stage2"]);
const OPEN_WATER_CARD_IDS = new Set(["halfbeak", "bonito-tuna", "blue-sea-dragon", "market-squid", "ocean-sunfish"]);
const SCHOOL_DENSITY_BY_CARD = Object.freeze({
  "sardine-ball-base": 10,
  "anchovy-ball-base": 10,
  "herring-ball-base": 20,
});
const OPEN_WATER_DENSITY_BY_CARD = Object.freeze({
  halfbeak: 10,
  "bonito-tuna": 10,
  "blue-sea-dragon": 20,
  "market-squid": 20,
  "ocean-sunfish": 150,
});
const name = (cardId) => CARD_NAMES[cardId] ?? cardId ?? "the highlighted card";

const FIRST_REEF_VISIBLE_COPY = Object.freeze({
  "brain-coral-base": "Your ecosystem is below the middle bar; your opponent's is above it. Let's begin by playing Brain Coral! This Base Coral costs 1 of your 3 Resource Points (RP) and provides homes for sea creatures. Drag it from your hand into the highlighted open water.",
  "sea-urchin": "Creature slots are the round symbols connected to a Coral. Each slot inherits its Coral's habitat, and its icon shows the creature class it accepts. Match both: the sea urchin is a Reef Invertebrate, so it needs a Reef Invertebrate slot. Its printed 1 VP counts while it stays in your ecosystem. Drag it into the glowing Reef Invertebrate slot.",
  "mustard-hill-coral-base": "You can play several cards in one turn while you can afford them. Spend 2 RP on Mustard Hill Coral. A Base starts a separate Foundation; a Stage upgrades one already in play. This Base produces 2 RP and has no Disease weakness. Drag it into the highlighted open water beside Brain Coral.",
  "brain-coral-stage-1": "A Coral can upgrade after its current stage has survived a full turn. Put the matching next Stage on it; position, damage, and compatible residents remain. Brain Coral Stage 1 costs 2 RP. Its printed health rises from 10 to 20 HP; the sea urchin still adds 20, giving it 40 total. Production rises from 1 to 2 RP, and it gains a Predator slot plus another Invertebrate slot. Drag Stage 1 onto the glowing Brain Coral.",
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
    return "Each turn you normally draw one card total, from either personal deck. Foundation holds Corals, Creature Schools, and their upgrades; Main holds other creatures, Habitats, and Support cards. Drawing takes the top card without searching. This practice deck has a sea urchin ready: choose one Main card, then confirm your draw.";
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
  if (["coral-reef", "open-ocean"].includes(cardId)) return SIMULATOR_V2_LESSON_CONCEPTS.HABITATS;
  if (SCHOOL_UPGRADE_CARD_IDS.has(cardId)) return SIMULATOR_V2_LESSON_CONCEPTS.SCHOOL_DENSITY;
  if (SCHOOL_BASE_CARD_IDS.has(cardId)) return SIMULATOR_V2_LESSON_CONCEPTS.SCHOOL_DENSITY;
  if (FOUNDATION_CARD_IDS.has(cardId)) return SIMULATOR_V2_LESSON_CONCEPTS.CORALS;
  if (UPGRADE_CARD_IDS.has(cardId)) return SIMULATOR_V2_LESSON_CONCEPTS.CORAL_UPGRADES;
  if (OPEN_WATER_CARD_IDS.has(cardId) && cardId !== "ocean-sunfish") return SIMULATOR_V2_LESSON_CONCEPTS.OPEN_WATER;
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

const FIRST_REEF_CORAL_DISEASE_WEAKNESS_COPY = "Coral Disease is active this round! The germ icon under Brain Coral's Weaknesses matches this Condition, so Brain Coral produces no RP this round but stays in play. Mustard Hill has no Disease weakness, so its 2 RP is safe. Other Conditions can check the Storm (swirl) or High Temperature (thermometer) icons the same way: Hurricane and Severe Coral Bleaching pause RP from Corals with their matching symbols.";

/** Reusable guidance for the first lesson's active Coral Disease presentation. */
export function getSimulatorV2CoralDiseaseWeaknessHelp() {
  return {
    target: "coral-weakness",
    message: FIRST_REEF_CORAL_DISEASE_WEAKNESS_COPY,
    action: FIRST_REEF_CORAL_DISEASE_WEAKNESS_COPY,
    cue: "first-reef:coral-disease-weakness",
    targetCardId: "brain-coral-base",
    targetLabel: "Brain Coral's printed Disease weakness",
  };
}

/** True only while the first lesson is presenting the active Coral Disease Condition. */
export function shouldTeachSimulatorV2CoralDiseaseWeakness({
  lessonId,
  stageKind,
  conditionId,
  acknowledged,
} = {}) {
  return lessonId === "first-reef"
    && stageKind === "condition"
    && conditionId === "coral-disease"
    && acknowledged !== true;
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
      message: "Coral Reef is a Habitat: it stays in its own zone and unlocks creatures that require it. Keep four Reef Corals, two Reef Fish, and two Reef Invertebrates in play; these are not sacrificed. If any count falls short, it takes 10 HP damage at the end of your turn.",
      action: "Choose Play Card to establish Coral Reef in your Habitat zone.",
    };
  }
  if (cardId === "open-ocean") {
    return {
      message: "Open Ocean needs four Creature Schools, two Oceanic Fish, and two Oceanic Invertebrates. They stay in play to sustain it. Like Coral Reef, this Habitat loses 10 HP at the end of your turn if any required count is short.",
      action: "Choose Play Card to establish Open Ocean in your Habitat zone.",
    };
  }
  if (SCHOOL_UPGRADE_CARD_IDS.has(cardId)) {
    const densityChange = cardId === "herring-ball-stage1"
      ? "Herring Ball Stage 1 replaces the Base School and raises its supply from 20 to 60 School Density."
      : cardId === "herring-ball-stage2"
        ? "Herring Ball Stage 2 replaces Stage 1 and raises its supply from 60 to 140 School Density."
        : "Anchovy Ball Stage 1 replaces the matching Base School and raises its supply from 10 to 50 School Density.";
    return {
      message: densityChange + " The School keeps its place in open water while its capacity grows.",
      action: "Choose the glowing matching Creature School to upgrade it.",
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
      message: SCHOOL_BASE_CARD_IDS.has(cardId)
        ? `${name(cardId)} is a Creature School Foundation. It sits directly in open water, supplies ${SCHOOL_DENSITY_BY_CARD[cardId]} School Density, and produces RP each turn instead of creating Coral slots.`
        : "Foundations create homes and produce RP at the start of your turns.",
      action: "Choose an open space in your ecosystem.",
    };
  }
  if (OPEN_WATER_CARD_IDS.has(cardId)) {
    const density = OPEN_WATER_DENSITY_BY_CARD[cardId];
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
  const slot = ["sea-urchin", "blue-crab", "arrow-crab"].includes(cardId)
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
  if (selected?.id === "filter-feeder" && SCHOOL_BASE_CARD_IDS.has(cardId)) {
    return `Drag ${name(cardId)} from your hand into the highlighted open water as a Creature School Foundation.`;
  }
  if (selected?.id === "filter-feeder" && SCHOOL_UPGRADE_CARD_IDS.has(cardId)) {
    return `Drag ${name(cardId)} onto the highlighted Herring Ball School.`;
  }
  if (selected?.id === "filter-feeder" && cardId === "ocean-sunfish") {
    return "You made enough room—now welcome a giant! Drag Ocean Sunfish from your hand into the highlighted open-water area.";
  }
  if (selected?.id === "filter-feeder" && cardId === "open-ocean") {
    return "Your food web meets every requirement! Select Open Ocean, then choose Play Card to establish the Habitat.";
  }
  if (["coral-reef", "open-ocean"].includes(cardId)) {
    return `Select ${name(cardId)} in your hand, then choose Play Card to put it in the Habitat zone.`;
  }
  if (SCHOOL_UPGRADE_CARD_IDS.has(cardId)) {
    return `Drag ${name(cardId)} from your hand onto the highlighted matching Creature School.`;
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
  const slot = ["sea-urchin", "blue-crab", "arrow-crab"].includes(cardId)
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

  if (selected.id === "filter-feeder" && uiState.eventOverlayType === "choose-school-momentum") {
    const targetCardId = selected.schoolMomentumTargets?.[current.id] ?? null;
    if (targetCardId) {
      return help(
        "search-card",
        targetCardId === "herring-ball-stage1"
          ? "Herring Ball Stage 1 has Momentum. Its upgrade replaces one School, then searches your personal decks for another Creature School. Find the second Stage 1 now so both Herring Balls can grow this turn."
          : "The second Stage 1 also triggers Momentum. Find Herring Ball Stage 2 now; it will wait in your hand until a Stage 1 School has survived a full turn.",
        `Choose ${name(targetCardId)}.`,
        { targetSearchCardId: targetCardId },
      );
    }
  }

  if (uiState.modal === "draw-result") {
    return help("continue-actions", selected.id === "first-reef"
      ? "Your draw joins your hand. In a normal game, you can make multiple legal plays and use abilities while you can afford their costs; you do not have to empty your hand. The lesson highlights one step at a time."
      : "Your draw joins your hand. Next you can play cards and use abilities.", "Continue to Actions.");
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
      const expectedDeckName = expectedDraw.deckType === "foundation" ? "Foundation" : "Main";
      const wrongDeckName = wrongDeck === "foundation" ? "Foundation" : "Main";
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
        firstReefDrawCopy ? "" : "Your deck choice is ready. Draw the card to add it to your hand.",
        firstReefDrawCopy ?? "Confirm selection to draw your card.",
        firstReefDrawCopy ? {
          cue: firstReefDrawCue,
          pointerPrompt: "Confirm your draw.",
          targetLabel: "the Confirm Selection button",
        } : undefined,
      );
    }
    const firstReefUpgradeDraw = selected.id === "first-reef" && expectedDraw?.cardId === "brain-coral-stage-1";
    const firstAttackOpeningDraw = selected.id === "first-attack" && expectedDraw?.cardId === "porcupine-fish";
    const firstAttackPredatorDraw = selected.id === "first-attack" && expectedDraw?.cardId === "great-barracuda";
    const seaUrchinWasDefeated = Array.isArray(uiState.discardPileCardIds)
      && uiState.discardPileCardIds.includes("sea-urchin");
    const supportDrawMessage = expectedDraw?.cardId === "dr-evans"
      ? "Blue Crab's Recycle just returned 1 RP when Clownfish was eaten. Dr. Evans is now on top of your Main Deck. Draw it to replace the familiar cards still in your hand with seven new options."
      : "Dr. Evans refreshed your hand and left one card in the Main Deck. Draw Arrow Crab now; its 1 VP will finish the Support plan after the Barracuda combo."
    const openWaterDrawMessages = {
      "herring-ball-stage1": "Your four Base Schools now supply 60 School Density and produce enough RP for two upgrades. Draw Herring Ball Stage 1 from the Foundation Deck; its Momentum will find the second copy.",
      halfbeak: "Both Stage 1 Schools survived a full turn, and Momentum already placed Stage 2 in your hand. Draw Halfbeak from the Main Deck before you make the final School upgrade.",
      "bonito-tuna": "Your Schools now supply 220 School Density. Draw Bonito Tuna so you can place both required Oceanic Fish directly in open water, without Coral slots.",
      "blue-sea-dragon": "Open Ocean also needs two Oceanic Invertebrates. Draw Blue Sea Dragon from the Main Deck; it will reserve 20 shared School Density instead of using a slot.",
      "market-squid": "Draw Market Squid, the second Oceanic Invertebrate. Once it joins Blue Sea Dragon, your creature counts will satisfy the last part of Open Ocean's requirement.",
      "open-ocean": "You now have four Creature Schools, two Oceanic Fish, and two Oceanic Invertebrates. Draw Open Ocean from the Main Deck so those cards can sustain the Habitat.",
      "ocean-sunfish": "Open Ocean is established and 160 of your 220 School Density remains available. Draw Ocean Sunfish from the Main Deck; it needs 150 of that shared capacity.",
    };
    const scenarioDrawMessage = selected.id === "apex-predators"
      ? "Your Coral Reef is established and Brain Coral has an Apex slot. Draw Hammerhead from the Main Deck so you can use the RP you collected for the final play."
      : selected.id === "support-strategies"
        ? supportDrawMessage
      : selected.id === "filter-feeder"
        ? openWaterDrawMessages[expectedDraw?.cardId] ?? "Choose the highlighted personal deck for the next part of your open-water ecosystem."
      : firstReefUpgradeDraw
        ? "Brain Coral Stage 1 is on top of your Foundation Deck. Draw it so you can level up the Coral you placed last round."
      : firstAttackOpeningDraw
        ? "You are at the start of a turn, with RP already collected automatically. Draw one card before playing or attacking. This prepared Main Deck has a porcupine fish on top; draw it to explore how creatures interact through the food web."
      : firstAttackPredatorDraw
        ? `${seaUrchinWasDefeated
          ? "Scavenge brought Sea Urchin back to your hand for this round."
          : "Your reef is ready for its next play."
        } Great Barracuda is on top of your Main Deck. Its type line says Reef Predator: Reef tells you which ecosystem zone and slots it uses, while Predator is its creature class. Draw it now so we can see how class controls placement and targeting.`
      : selected.id === "first-attack"
        ? "Blue Crab is on top of your Main Deck. Draw it to see how a Passive works automatically, then use its non-attack Scavenge Action."
        : selected.id === "first-reef"
          ? "Sea Urchin is waiting on top of your Main Deck. Draw it so you can place your first creature."
        : "Choose the Main Deck when you want creatures, Habitats, and Support cards.";
    const drawMessage = conceptWasPreviouslyTaught(uiState, SIMULATOR_V2_LESSON_CONCEPTS.DRAWING)
      ? scenarioDrawMessage
      : selected.id === "first-reef"
        ? scenarioDrawMessage
        : `The Main Deck holds creatures, Habitats, and Support cards. ${scenarioDrawMessage}`;
    const drawCount = Math.max(1, Number(uiState.drawTarget ?? 1));
    return help(
      "draw-controls",
      firstReefDrawCopy ? "" : drawMessage,
      firstReefDrawCopy
        ?? `Choose ${drawCount === 1 ? "one card" : `${drawCount} cards`} from the ${expectedDraw?.deckType === "foundation" ? "Foundation" : "Main"} Deck.`,
      {
        targetDeck: expectedDraw?.deckType ?? "pals",
        targetDrawAction: "add",
        ...(firstReefDrawCopy ? {
          cue: firstReefDrawCue,
          pointerPrompt: `Add one card from the ${expectedDraw?.deckType === "foundation" ? "Foundation" : "Main"} Deck.`,
          targetLabel: `the ${expectedDraw?.deckType === "foundation" ? "Foundation" : "Main"} Deck control`,
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
      firstReefCopy ? "" : conceptCopy(uiState, placementConcept(uiState.playingCardId), copy.message),
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
        firstReefCopy ? "" : selectedCard
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
        "",
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
        "",
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
          ? "Each round reveals a shared Condition that can change both players' rules. Each turn you draw one card and collect 1 RP plus active Foundation income, then play cards and use abilities. The simulator collects RP automatically before showing your deck choice. Press Begin Round to see the sequence."
          : "Press Begin Round and watch your RP bank.",
      selected.id === "first-reef" ? {
        pointerPrompt: "Press Begin Round.",
        targetLabel: "the Begin Round button",
      } : undefined,
    );
  }

  if (current.actionType === ACTION.SUPPORT_PLAYED) {
    const cardId = selected.supportCards?.[current.id]?.[0];
    const searchTargetCardId = selected.supportSearchTargets?.[current.id] ?? selected.searchCardId;
    if (uiState.modal === "search" && searchTargetCardId) {
      return help(
        "search-card",
        cardId === "coral-gardener"
          ? "Coral Gardener found the eligible Corals in your Foundation Deck. Search effects trade one Support card for the exact card your plan needs."
          : name(cardId) + " found the eligible cards in your personal decks.",
        "Choose " + name(searchTargetCardId) + ".",
        { targetSearchCardId: searchTargetCardId },
      );
    }
    if (cardId === "dr-evans" && uiState.modal === "support-draw") {
      const allocationReady = Number(uiState.drawSelected ?? 0) >= Number(uiState.drawTarget ?? 7);
      return help(
        allocationReady ? "confirm-support-draw" : "support-draw-controls",
        "Dr. Evans discards every other card in your hand, then draws seven replacements. Eight cards remain in your Main Deck; choose seven now and leave one for the normal draw next turn.",
        allocationReady
          ? "Discard the stale hand and draw the seven selected cards."
          : "Choose seven Main draws, leaving one card for next turn, then confirm.",
      );
    }
    if (cardId === "spearfishing" && uiState.eventOverlayType === "choose-spearfishing-target") {
      return help(
        "support-effect-choice",
        "Spearfishing discards one of your Fish or Predators and returns its printed RP cost. The barracuda refunds 3 RP even though Clear Water made you pay 4 RP to play it. Its VP leaves your score until you replay it.",
        "Choose Great Barracuda.",
        { targetCardId: "great-barracuda" },
      );
    }
    const selectedCard = uiState.selectedHandCard === cardId
      && (uiState.handPopoverOpen || uiState.handDockSelectionOpen || uiState.modal === "hand");
    const message = cardId === "coral-gardener"
      ? "Support cards normally resolve once and go to discard, unless their text says otherwise. Coral Gardener searches your personal decks for one Coral: you choose a specific card instead of taking a blind draw. Its printed restriction prevents another Support this turn; that limit is not a rule for every Support."
      : cardId === "dr-evans"
        ? "Coral Gardener found a Coral, but imagine the rest of this hand no longer fits your plan. Dr. Evans discards the cards you are holding and replaces them with seven new cards. It is a powerful reset when hand quality matters more than keeping individual cards."
        : cardId === "spearfishing"
          ? "Spearfishing turns a Fish or Predator already on your reef into immediate RP equal to its printed cost. The creature and Support both go to discard, so the best target is one you can profitably recover or no longer need."
          : "Support cards normally resolve once and go to discard, unless their text says otherwise.";
    const action = selectedCard
      ? "Choose Play Card."
      : `Select ${name(cardId)} in your hand, then play it.`;
    return help(
      selectedCard ? "play-card" : "hand",
      selectedCard ? message + ` ${name(cardId)} is selected and ready to resolve.` : message,
      action,
      {
        interaction: "tap",
        targetCardId: cardId,
        hint: cardId === "coral-gardener"
          ? "After playing it, choose Mustard Hill Coral in the deck search."
          : cardId === "spearfishing"
            ? "After playing it, choose Great Barracuda as the creature to convert into RP."
            : "Finish the replacement-draw choice to resolve Dr. Evans.",
      },
    );
  }

  if (current.actionType === ACTION.ABILITY_RESOLVED) {
    const utility = uiState.inspectedUtilityAction?.cardId === selected.abilityCardId
      ? uiState.inspectedUtilityAction
      : uiState.readyUtilityAction?.cardId === selected.abilityCardId
        ? uiState.readyUtilityAction
        : null;
    const choosingSupportComboRecovery = selected.id === "support-strategies"
      && uiState.eventOverlayType === "choose-action-discard";
    const target = choosingSupportComboRecovery
      ? "search-card"
      : uiState.inspectedUtilityAction?.cardId === selected.abilityCardId
      ? "utility-action-button"
      : "player-board";
    const supportComboMessage = "Spearfishing put Great Barracuda in your discard pile and recovered its 3 RP. Blue Crab's Scavenge is the recycling step: pay 2 RP to move Barracuda back to your hand. Blue Crab's separate Recycle passive only triggers when one of your Fish is eaten, so Spearfishing does not trigger Recycle.";
    return help(
      target,
      selected.id === "support-strategies"
        ? supportComboMessage
        : "Not every ability is an attack! An Action waits for your command during your turn. You decide when to use it and pay any RP cost shown beside it. Blue Crab’s Scavenge costs 2 RP to recover the defeated Sea Urchin from your discard pile and set up your next round. Let’s bring it home!",
      selected.id === "support-strategies"
        ? choosingSupportComboRecovery
          ? "Choose Great Barracuda from the discard pile."
          : target === "utility-action-button"
            ? "Use Scavenge, then choose Great Barracuda."
            : "Select Blue Crab, then use Scavenge."
        : target === "utility-action-button"
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
    if (selected.id === "support-strategies") {
      const repeated = current.id === "v2-repeat-quick-strike";
      return help(
        "opponent-board",
        repeated
          ? "Great Barracuda entered play again, so its On Play Quick Strike fires again. Spearfishing and Scavenge did more than move a card: together they reset the timing that makes this second Bite possible."
          : "Great Barracuda's Quick Strike began automatically when it entered play. This first Bite establishes the value you will repeat after Spearfishing sends Barracuda to discard and Scavenge returns it.",
        "Choose a glowing opposing Fish or Predator and resolve the D6 Bite.",
        { targetCardId: "great-barracuda" },
      );
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
        "Ravage first deals a D4 roll times 10 damage to an opposing Coral's HP, without a defense roll. A destroyed Coral goes to discard; its creatures survive and need compatible homes. Then resolve two D8 faceoffs against different legal creatures.",
        "Finish Ravage and resolve both faceoffs.",
        { targetCardId: "hammerhead" },
      );
    }
    if (selected.id === "first-attack" && current.id === "v2-predator-attack") {
      return help(
        "opponent-board",
        "Quick Strike has triggered! Unlike an Action, this On Play ability began automatically when Great Barracuda entered your ecosystem. Bite can target an opposing Fish or Predator, but not an Invertebrate or Apex. Spanish Hogfish's type line says Reef Fish, so it is legal; Sea Urchin would not be.",
        "Choose the glowing Spanish Hogfish and resolve Great Barracuda’s D6 Bite.",
        { targetCardId: "great-barracuda" },
      );
    }
    if (uiState.attackContext) {
      const choosingFirstTarget = selected.id === "first-attack" && current.id === "tutorial-attack";
      return help(
        "opponent-board",
        choosingFirstTarget
          ? "Sea Urchin is glowing because its type line identifies it as an opposing Invertebrate, making it a legal target for Crunch. Selecting it makes Sea Urchin the defender."
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
        ? "Crunch is an Action: you choose when to use it during your turn and pay its 1 RP separately from the fish's play cost. Actions normally work once per turn, but read extra restrictions: Crunch cannot be used again on your next turn."
        : chooseFirstAttack
          ? "Porcupine Fish is your attacker. Crunch costs 1 RP and can target an opposing Invertebrate."
          : "Crunch costs 1 RP and targets an opposing Invertebrate.",
      chooseFirstAttack
        ? "Great—Porcupine Fish is selected! Choose Crunch to commit 1 RP and begin the attack."
        : introduceActions
          ? "Now it’s your turn to attack! Select Porcupine Fish to begin."
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
      message = "All three Coral Reef counts are met! Four Reef Corals, two Reef Fish, and two Reef Invertebrates sustain this zero-RP Habitat and unlock the hammerhead. They stay in play; they are not sacrificed. If a count falls short at the end of your turn, the Habitat takes 10 HP damage.";
    } else if (selected.id === "support-strategies" && cardId === "mustard-hill-coral-base") {
      message = "Coral Gardener turned a Support card into the exact Foundation your plan needed. Build Mustard Hill Coral for 2 RP now. Its 2 RP production will help fund the later Barracuda combo.";
    } else if (selected.id === "support-strategies" && cardId === "sea-urchin") {
      message = "Dr. Evans replaced the stale hand with seven new cards. Sea Urchin is the inexpensive first play: it costs 1 RP, scores 1 VP, and leaves enough RP for the combo that follows.";
    } else if (selected.id === "support-strategies" && cardId === "great-barracuda") {
      message = current.id === "v2-replay-barracuda"
        ? "Scavenge returned the barracuda to your hand. Pay its current 4 RP cost under Clear Water and replay it in the same Predator slot. Entering play again triggers Quick Strike again."
        : "Clear Water makes Predators cost 1 extra RP, so the barracuda costs 4 RP now instead of its printed 3. Its Predator slot is ready. Quick Strike is On Play: its Bite begins immediately when it enters, with no separate Action cost.";
    } else if (selected.id === "support-strategies" && cardId === "arrow-crab") {
      message = "The Support chain is complete. Arrow Crab costs the final 1 RP, fits Mustard Hill Coral's Invertebrate slot, and supplies the last VP needed to finish the lesson.";
    } else if (selected.id === "filter-feeder" && cardId === "herring-ball-base") {
      message = current.id === "v2-place-first-herring-school"
        ? "Your ecosystem is completely bare: no Corals, no creature slots, and 0 School Density. Herring Ball is a Creature School Foundation. Place it directly in open water to create 20 shared Density and produce 1 RP each turn."
        : "A second Herring Ball creates another independent Foundation. It does not attach to the first School or create slots; its 20 Density joins the same shared capacity pool, raising the total to 40.";
    } else if (selected.id === "filter-feeder" && cardId === "sardine-ball-base") {
      message = "Sardine Ball is another School Foundation. Its 10 Density raises the shared pool from 40 to 50, and it produces 1 RP each turn without creating a Coral branch.";
    } else if (selected.id === "filter-feeder" && cardId === "anchovy-ball-base") {
      message = "Anchovy Ball supplies the fourth School Open Ocean will eventually require. Its 10 Density raises total capacity to 60, while all four Foundations remain free of Coral slots.";
    } else if (selected.id === "filter-feeder" && cardId === "herring-ball-stage1") {
      message = current.id === "v2-upgrade-first-herring-stage1"
        ? "Upgrade one Herring Ball from 20 to 60 Density. Replacing the Base adds 40 capacity, raising the shared total from 60 to 100. Its Momentum ability will then search for another Creature School."
        : "Use the Stage 1 card found by Momentum on the other Herring Ball. Another 40 Density raises total capacity from 100 to 140, and this copy's Momentum can find Stage 2 for the following turn.";
    } else if (selected.id === "filter-feeder" && cardId === "herring-ball-stage2") {
      message = "One Stage 1 Herring Ball has survived a full turn. Upgrade it from 60 to 140 Density for 7 RP. The 80-point increase takes your four-School ecosystem from 140 to 220 total Density.";
    } else if (selected.id === "filter-feeder" && cardId === "halfbeak") {
      message = "Schools provide shared capacity; open-water creatures use it instead of slots. Pay 2 RP for the halfbeak and reserve 10 of your 220 School Density (SD). RP is spent, but SD is only occupied: that 10 becomes free again if the halfbeak leaves play.";
    } else if (selected.id === "filter-feeder" && cardId === "bonito-tuna") {
      message = "The bonito tuna is the second Oceanic Fish Open Ocean requires. It lives directly in open water and reserves 10 Density, bringing your total to 20 used out of 220. Every School contributes to the same pool; a creature does not belong to one particular School.";
    } else if (selected.id === "filter-feeder" && cardId === "blue-sea-dragon") {
      message = "Blue Sea Dragon is an Oceanic Invertebrate, but it does not need an Invertebrate slot. It reserves 20 shared Density in open water, bringing the total commitment to 40.";
    } else if (selected.id === "filter-feeder" && cardId === "market-squid") {
      message = "Market Squid is the second Oceanic Invertebrate. It reserves another 20 Density, so 60 of 220 is committed and 160 remains open—enough for Ocean Sunfish later.";
    } else if (selected.id === "filter-feeder" && cardId === "open-ocean") {
      message = "Four Schools, two Oceanic Fish, and two Oceanic Invertebrates now satisfy Open Ocean. Establish the zero-RP Habitat in its own zone. Keep that population in play: like Coral Reef, it loses 10 HP at the end of your turn if any required count is short.";
    } else if (cardId === "mustard-hill-coral-base" && selected.id === "first-reef") {
      message = "Build Mustard Hill Coral as a second Foundation. It has no Disease weakness, so Coral Disease will not stop its 2 RP production next round.";
    } else if (cardId === "porcupine-fish" && selected.id === "first-attack") {
      message = "Porcupine Fish is a Reef Fish, so it fits Brain Coral's open Fish slot. Play it for 2 RP. Once it is settled, we’ll learn how its Crunch Action chooses prey and how every faceoff die works.";
    } else if (cardId === "blue-crab" && selected.id === "first-attack") {
      message = "Blue Crab's Eco Boost is Passive: it works automatically while the crab remains in your ecosystem. It raises your RP bank cap from 8 to 9. It creates room for more RP, but does not itself add RP to your bank.";
    } else if (cardId === "sea-urchin" && selected.id === "first-attack") {
      message = "Scavenge recovered Sea Urchin instead of attacking. Return it to Brain Coral now, and its Spines passive will again add 20 HP to that Coral.";
    } else if (cardId === "brain-coral-stage-1") {
      message = selected.id === "first-reef"
        ? "Upgrade Brain Coral for 2 RP. Its resilience rises from 10 to 20 HP, it can produce 2 RP instead of 1 when a Condition is not blocking it, and it gains a Predator slot plus another Invertebrate slot. Sea Urchin stays attached."
        : "Coral Heal cleared Stunned, so Brain Coral can upgrade for 2 RP. You’ve seen the payoff: 20 HP of resilience, 2 RP each round, a Predator slot, and another Invertebrate slot.";
    } else if (cardId === "brain-coral-stage-2") {
      message = "Upgrade Brain Coral to Stage 2 for 5 RP. Printed health rises from 20 to 60 HP, production grows from 2 to 5 RP each round, and it opens two Predator, one Apex, and three Invertebrate slots. Stage 2 has no Fish slot, so check attached creatures first; a Fish can move to a compatible Predator or Apex slot.";
    } else if (cardId === "sardine-ball-base") {
      message = "Sardine Ball costs 1 RP. As a Creature School it acts as a Foundation and supplies 10 School Density.";
    } else if (cardId === "halfbeak") {
      message = "I've added two Creature Schools to your reef: Sardine Ball supplies 120 School Density and Anchovy Ball supplies 10. Halfbeak costs 2 RP and commits 10 of that 130. Afterward, only 120 is free, which is too little for Ocean Sunfish's 150.";
    } else if (cardId === "ocean-sunfish") {
      message = selected.id === "filter-feeder"
        ? "Ocean Sunfish is the payoff for the whole ecosystem. Open Ocean satisfies its Habitat requirement, your four smaller creatures use 60 of 220 Density, and the remaining 160 can support its 150-Density requirement. Pay 8 RP to place it in open water, leaving 10 Density free and reaching 13 VP."
        : "Ocean Sunfish costs 8 RP, needs Coral Reef or Open Ocean, and commits 150 School Density.";
    } else if (cardId === "hammerhead") {
      message = "The hammerhead costs 6 RP and needs both Coral Reef and an open Apex slot. A Reef Apex slot can house Reef Fish, Predators, or Apex creatures, but an Apex cannot use the smaller Fish or Predator slots. Stage 2 Brain Coral supplies the home you need.";
    } else if (cardId === "great-barracuda") {
      message = selected.id === "first-attack"
        ? "The great barracuda is a Reef Predator. Predator slots also accept Fish, but a Predator cannot use a Fish slot. Murky Water discounts its printed 3 RP cost to 2 RP this round. Quick Strike is On Play: placing it immediately begins a D6 Bite against an opposing Fish or Predator, with no separate Action cost."
        : "Each attack tells you which die to roll. Porcupine Fish's Crunch uses a D4 (1–4); Great Barracuda's Bite uses a D6 (1–6), giving it a wider possible range.";
    }
    return help(
      selectedCard ? "play-card" : "hand",
      firstReefCopy ? "" : selectedCard ? name(cardId) + " is selected. Play Card will show its legal placement." : message,
      firstReefCopy ?? (selectedCard ? "Choose Play Card." : dragActionCopy(cardId, candidates, selected, current)),
      {
        cue: firstReefCopy ? `first-reef-place:${cardId}` : undefined,
        interaction: selectedCard || ["coral-reef", "open-ocean"].includes(cardId) ? "tap" : "drag",
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
        "Only VP on cards currently in your ecosystem counts; your score falls when they leave. Reach " + selected.victoryTarget + " VP for this practice goal.",
      ),
      "Watch your VP total.",
    );
  }
  if (current.actionType === ACTION.TURN_ENDED) {
    if (selected.id === "first-reef") {
      const message = "The turn button ends your actions and passes play to the opponent. You keep unused RP and cards in hand. After both players finish, a new round reveals the next Condition. End your turn now; this practice opponent will pass, then Coral Disease lets us compare your Corals' RP production.";
      return help("turn-button", message, message, {
        pointerPrompt: "End the turn to reveal Coral Disease.",
        targetLabel: "the End Turn button",
      });
    }
    const message = selected.id === "apex-predators"
      ? "Your Coral Reef is thriving! All four Corals, two Fish, and two Invertebrates are still here. Brain Coral's new Apex slot is ready; end the turn and refill your RP bank so Hammerhead can enter next round."
      : selected.id === "support-strategies"
        ? current.id === "v2-pass-after-search"
          ? "End the turn now. The opponent will play Great Barracuda, and its Quick Strike can eat Clownfish. Watch Blue Crab's Recycle passive: because one of your Fish is eaten, it returns half of Clownfish's printed 2 RP cost, rounded up."
          : "Dr. Evans discarded the stale cards and drew seven replacements, but its Support lock lasts for the rest of this turn. End now; the next turn resets that limit so Spearfishing can begin the combo."
      : selected.id === "filter-feeder"
        ? current.id === "v2-grow-school-bases"
          ? "Four Creature Schools now sit where Coral Foundations normally would. Together they provide 60 School Density and 4 RP of Foundation income. End the turn so both Herring Ball bases become eligible to upgrade."
          : current.id === "v2-grow-herring-stage1s"
            ? "Both Herring Balls are now Stage 1, and their combined upgrades raised total capacity to 140. Stage 2 is already in your hand from Momentum, but a Stage 1 must survive a full turn before it can upgrade again."
            : current.id === "v2-fund-open-water-fish"
              ? "Your School Foundations now supply 220 Density. End the turn and refill your RP bank so you can begin placing creatures directly in open water."
              : current.id === "v2-fund-first-open-water-invertebrate"
                ? "Halfbeak and Bonito Tuna meet Open Ocean's two-Fish requirement and commit 20 Density together. End the turn to prepare the first required Invertebrate."
                : current.id === "v2-fund-second-open-water-invertebrate"
                  ? "Blue Sea Dragon lives in open water without a Coral slot and commits 20 Density. End the turn to draw the second Oceanic Invertebrate."
                  : current.id === "v2-prepare-open-ocean"
                    ? "Your four Schools, two Oceanic Fish, and two Oceanic Invertebrates meet Open Ocean's requirements. Protect those Schools: attacks against them deal the attack roll times 10 HP instead of a defense faceoff. End the turn to draw the Habitat."
                    : "Open Ocean is established, your RP bank is full, and 160 Density remains free. End the turn once more to draw Ocean Sunfish. Protect your Schools: losing capacity can block future plays. If you become over capacity, creatures already in play stay, but you cannot add another creature that needs Density until enough is free."
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
      : "Your bank increased from 2 RP to 4 RP: 1 for the turn and 1 from Brain Coral. Unspent RP carries forward, but the normal bank cap is 8; extra income above your current cap is lost. Continue to your draw.";
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
      "Continue to draw Hammerhead from the Main Deck.",
    );
  }
  if (current.actionType === ACTION.RP_COLLECTED && selected.id === "support-strategies") {
    const firstSupportCollection = current.id === "v2-collect-for-cycle";
    return help(
      "rp-bank",
      firstSupportCollection
        ? "Recycle already returned 1 RP when Great Barracuda ate Clownfish. Now the new round adds its normal income. That refund is separate from Spearfishing: Recycle only triggers when one of your Fish is eaten."
        : "A new turn ends Dr. Evans's printed restriction on playing another Support. Your bank can fund Sea Urchin, two 4-RP barracuda plays under Clear Water, and Scavenge for 2 RP, because Spearfishing returns the barracuda's printed 3 RP cost between plays.",
      firstSupportCollection
        ? "Continue to draw Dr. Evans from the Main Deck."
        : "Continue to draw Arrow Crab from the Main Deck.",
    );
  }
  if (current.actionType === ACTION.RP_COLLECTED && selected.id === "filter-feeder") {
    const messages = {
      "v2-collect-for-herring-stage1": "All four Base Schools produced RP, and the round added 1 more. Your bank now has exactly 6 RP—enough to upgrade both Herring Balls to Stage 1 after Momentum finds the second copy.",
      "v2-collect-for-herring-stage2": "Two Stage 1 Herring Balls plus Sardine Ball and Anchovy Ball produced 6 RP; the round added 1. Your 7 RP bank can pay the complete Stage 2 upgrade cost.",
      "v2-collect-for-open-water-fish": "Herring Ball Stage 2, Herring Ball Stage 1, Sardine Ball, and Anchovy Ball generate more than the 8 RP base bank can hold. That full bank can place both required Oceanic Fish.",
      "v2-collect-for-blue-sea-dragon": "Your Schools refilled the RP bank. Blue Sea Dragon costs 2 RP and will reserve 20 School Density in open water rather than occupy a Coral slot.",
      "v2-collect-for-market-squid": "Your Schools refilled the bank again. Market Squid costs 2 RP, supplies the second Oceanic Invertebrate, and raises the bank cap through EcoBoost.",
      "v2-collect-for-open-ocean": "The four Schools continue to fund the ecosystem. Open Ocean itself costs 0 RP, but it can enter only because all four School, two Fish, and two Invertebrate requirements are now met.",
      "v2-collect-for-ocean-sunfish": "Your expanded RP bank was already full, so this collection adds 0 RP. You still have enough: Ocean Sunfish needs 8 RP, Open Ocean, and 150 free School Density. All three requirements are ready.",
    };
    return help(
      "rp-bank",
      messages[current.id] ?? "Your Creature Schools produced RP at the start of the turn.",
      current.id === "v2-collect-for-ocean-sunfish"
        ? "Continue to draw Ocean Sunfish from the Main Deck."
        : "Continue to the highlighted draw.",
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
  preFaceoffPrimerAcknowledged,
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
      ? "Choose the " + (expected.deckType === "pals" ? "Main" : "Foundation") + " Deck for this lesson's draw."
      : "This practice board is already ready for its next action.";
  }
  if (action === "attack") {
    if (
      selected.preFaceoffPrimer?.checkpointId === current.id
      && preFaceoffPrimerAcknowledged !== true
    ) return "Review the faceoff dice and rules with Mr. Easterling before beginning the attack.";
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
  const completed = value?.version === 4
    ? savedIds
    : value?.version === 3 || value?.version === 2
      ? savedIds.filter((id) => id === "first-reef" || id === "first-attack" || id === "apex-predators")
    : value?.version === 1
      ? savedIds.filter((id) => id === "first-reef" || id === "first-attack")
      : [];
  return {
    version: 4,
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
