export const ADVENTURE_CONTENT_SCHEMA_VERSION = 1;

export const REQUIRED_ECOSYSTEM_NPC_ROLES = Object.freeze([
  "local-guide",
  "field-partner",
  "resident",
  "town-challenger",
  "reflection-character",
]);

export const REQUIRED_DIALOGUE_BEATS = Object.freeze([
  "hook",
  "observation",
  "interpretation",
  "decision",
  "community-action",
  "duel",
  "debrief",
  "reflection",
  "callback",
]);

const npcRoleDefinitions = [
  { id: "mentor", purpose: "Introduces SeaPals, starter choice, and safe field practice." },
  { id: "local-guide", purpose: "Frames what has changed without supplying the answer." },
  { id: "field-partner", purpose: "Teaches one investigation tool through play." },
  { id: "resident", purpose: "Presents a practical constraint or common misconception." },
  { id: "town-challenger", purpose: "Connects the local habitat to a SeaPals deck strategy." },
  { id: "reflection-character", purpose: "Prompts an evidence-based explanation and later callback." },
  { id: "tournament-director", purpose: "Registers legal decks and explains the 30 VP bracket." },
];

const towns = [
  {
    id: "shellshore-village",
    name: "Shellshore Academy",
    chapterType: "starter",
    settlementType: "island",
    habitatId: "harbor-lagoon",
    startSceneId: "town",
    dockId: "shellshore-dock",
    questIds: ["quest-shellshore-first-voyage"],
    encounterIds: [
      "encounter-shellshore-mentor-practice",
      "encounter-shellshore-marina",
      "encounter-shellshore-dorian",
    ],
    plannedNpcRoleIds: ["mentor", "field-partner", "town-challenger", "reflection-character"],
    packPoolId: null,
    unlockRuleId: "unlock-shellshore-start",
    arrivalRouteId: null,
    encounterPlan: { practice: 1, resident: 2, qualifier: 0 },
  },
  {
    id: "sunpatch-cay",
    name: "Sunpatch Cay",
    chapterType: "ecosystem",
    settlementType: "island",
    habitatId: "coral-reef",
    startSceneId: "sunpatch-cay-town",
    dockId: "sunpatch-dock",
    questIds: ["quest-sunpatch-reef-response"],
    encounterIds: [
      "encounter-sunpatch-resident-gardener",
      "encounter-sunpatch-resident-surveyor",
      "encounter-sunpatch-qualifier",
    ],
    plannedNpcRoleIds: [...REQUIRED_ECOSYSTEM_NPC_ROLES],
    packPoolId: "pack-pool-sunpatch-coral",
    unlockRuleId: "unlock-sunpatch",
    arrivalRouteId: "route-shellshore-sunpatch",
    encounterPlan: { practice: 0, resident: 2, qualifier: 1 },
  },
  {
    id: "brackwater-landing",
    name: "Brackwater Landing",
    chapterType: "ecosystem",
    settlementType: "floating",
    habitatId: "estuary-mangrove",
    startSceneId: "brackwater-landing-town",
    dockId: "brackwater-dock",
    questIds: ["quest-brackwater-water-clues"],
    encounterIds: [
      "encounter-brackwater-resident-naturalist",
      "encounter-brackwater-resident-harbormaster",
      "encounter-brackwater-qualifier",
    ],
    plannedNpcRoleIds: [...REQUIRED_ECOSYSTEM_NPC_ROLES],
    packPoolId: "pack-pool-brackwater-murky",
    unlockRuleId: "unlock-brackwater",
    arrivalRouteId: "route-sunpatch-brackwater",
    encounterPlan: { practice: 0, resident: 2, qualifier: 1 },
  },
  {
    id: "current-commons",
    name: "Current Commons",
    chapterType: "ecosystem",
    settlementType: "floating",
    habitatId: "open-ocean",
    startSceneId: "current-commons-town",
    dockId: "current-commons-dock",
    questIds: ["quest-current-ghost-gear"],
    encounterIds: [
      "encounter-current-resident-navigator",
      "encounter-current-resident-deckhand",
      "encounter-current-qualifier",
    ],
    plannedNpcRoleIds: [...REQUIRED_ECOSYSTEM_NPC_ROLES],
    packPoolId: "pack-pool-current-bluewater",
    unlockRuleId: "unlock-current-commons",
    arrivalRouteId: "route-brackwater-current",
    encounterPlan: { practice: 0, resident: 2, qualifier: 1 },
  },
  {
    id: "kelpwatch-island",
    name: "Kelpwatch Island",
    chapterType: "ecosystem",
    settlementType: "island",
    habitatId: "kelp-forest",
    startSceneId: "kelpwatch-island-town",
    dockId: "kelpwatch-dock",
    questIds: ["quest-kelpwatch-balance"],
    encounterIds: [
      "encounter-kelpwatch-resident-diver",
      "encounter-kelpwatch-resident-ranger",
      "encounter-kelpwatch-qualifier",
    ],
    plannedNpcRoleIds: [...REQUIRED_ECOSYSTEM_NPC_ROLES],
    packPoolId: "pack-pool-kelpwatch",
    unlockRuleId: "unlock-kelpwatch",
    arrivalRouteId: "route-current-kelpwatch",
    encounterPlan: { practice: 0, resident: 2, qualifier: 1 },
  },
  {
    id: "trenchlight-station",
    name: "Trenchlight Station",
    chapterType: "ecosystem",
    settlementType: "floating",
    habitatId: "deep-ocean-trench",
    startSceneId: "trenchlight-station-town",
    dockId: "trenchlight-dock",
    questIds: ["quest-trenchlight-sensor"],
    encounterIds: [
      "encounter-trenchlight-resident-engineer",
      "encounter-trenchlight-resident-observer",
      "encounter-trenchlight-qualifier",
    ],
    plannedNpcRoleIds: [...REQUIRED_ECOSYSTEM_NPC_ROLES],
    packPoolId: "pack-pool-trenchlight-deep",
    unlockRuleId: "unlock-trenchlight",
    arrivalRouteId: "route-kelpwatch-trenchlight",
    encounterPlan: { practice: 0, resident: 2, qualifier: 1 },
  },
  {
    id: "champions-wake",
    name: "Champion's Wake",
    chapterType: "tournament",
    settlementType: "floating",
    habitatId: "archipelago-synthesis",
    startSceneId: "champions-wake-town",
    dockId: "champions-wake-dock",
    questIds: ["quest-champions-wake"],
    encounterIds: [
      "encounter-tournament-quarterfinal",
      "encounter-tournament-semifinal",
      "encounter-tournament-final",
    ],
    plannedNpcRoleIds: ["tournament-director", "town-challenger", "reflection-character"],
    packPoolId: null,
    unlockRuleId: "unlock-champions-wake",
    arrivalRouteId: "route-trenchlight-champions-wake",
    encounterPlan: { practice: 0, resident: 0, qualifier: 0, tournament: 3 },
  },
];

const shellshoreRuntimeScenes = {
  town: {
    name: "Tidepool Town",
    worldKind: "town",
    theme: "sunlit-reef",
    tiles: [
      "tttttttttttttttt",
      "ttttttttpttttttt",
      "ttttttttpttttttt",
      "tttccCccpddDdddt",
      "ttttgpgtptgpgttt",
      "ttttgpggtggpgtgt",
      "ttttgpgggggpgtgt",
      "ttpppppppppppppt",
      "tttppppppppppptt",
      "tttttttttttttttt",
    ],
    spawn: { x: 7, y: 8 },
    startFacing: "up",
    interactions: [
      {
        id: "interaction-town-enter-coral-home",
        type: "enter",
        at: { x: 5, y: 3 },
        targetScene: "coral-home",
        spawn: { x: 5, y: 6 },
      },
      {
        id: "interaction-town-enter-deep-home",
        type: "enter",
        at: { x: 11, y: 3 },
        targetScene: "deep-home",
        spawn: { x: 5, y: 6 },
      },
    ],
  },
  "coral-home": {
    name: "Marina's Coral Cottage",
    worldKind: "interior",
    theme: "coral-cottage",
    tiles: [
      "wwwwwwwwwwww",
      "wwwwwwwwwwww",
      "waaafnffaaaw",
      "waaarrrraaaw",
      "waaarrrraaaw",
      "waaarrrrfffw",
      "waaaffffaaaw",
      "wwwwwEwwwwww",
    ],
    spawn: { x: 5, y: 6 },
    interactions: [
      {
        id: "interaction-coral-home-marina",
        type: "trainer",
        at: { x: 5, y: 2 },
        trainerId: "marina",
        npcId: "marina",
        conversationId: "conversation-shellshore-marina",
        encounterId: "encounter-shellshore-marina",
      },
      {
        id: "interaction-coral-home-exit",
        type: "exit",
        at: { x: 5, y: 7 },
        targetScene: "town",
        spawn: { x: 5, y: 4 },
      },
    ],
  },
  "deep-home": {
    name: "Dorian's Deep-Sea Den",
    worldKind: "interior",
    theme: "deep-sea-den",
    tiles: [
      "wwwwwwwwwwww",
      "wwwwwwwwwwww",
      "waaafnffaaaw",
      "waaarrrraaaw",
      "waaarrrraaaw",
      "waaarrrraaaw",
      "waaaffffaaaw",
      "wwwwwEwwwwww",
    ],
    spawn: { x: 5, y: 6 },
    interactions: [
      {
        id: "interaction-deep-home-dorian",
        type: "trainer",
        at: { x: 5, y: 2 },
        trainerId: "dorian",
        npcId: "dorian",
        conversationId: "conversation-shellshore-dorian",
        encounterId: "encounter-shellshore-dorian",
      },
      {
        id: "interaction-deep-home-exit",
        type: "exit",
        at: { x: 5, y: 7 },
        targetScene: "town",
        spawn: { x: 11, y: 4 },
      },
    ],
  },
};

const scenes = [
  { id: "town", townId: "shellshore-village", kind: "exterior", status: "prototype", world: shellshoreRuntimeScenes.town },
  { id: "coral-home", townId: "shellshore-village", kind: "interior", status: "prototype", world: shellshoreRuntimeScenes["coral-home"] },
  { id: "deep-home", townId: "shellshore-village", kind: "interior", status: "prototype", world: shellshoreRuntimeScenes["deep-home"] },
  { id: "academy-lab", townId: "shellshore-village", kind: "interior", status: "planned" },
  { id: "sunpatch-cay-town", townId: "sunpatch-cay", kind: "exterior", status: "planned" },
  { id: "brackwater-landing-town", townId: "brackwater-landing", kind: "exterior", status: "planned" },
  { id: "current-commons-town", townId: "current-commons", kind: "exterior", status: "planned" },
  { id: "kelpwatch-island-town", townId: "kelpwatch-island", kind: "exterior", status: "planned" },
  { id: "trenchlight-station-town", townId: "trenchlight-station", kind: "exterior", status: "planned" },
  { id: "trenchlight-sub-descent", townId: "trenchlight-station", kind: "vehicle", status: "planned" },
  { id: "champions-wake-town", townId: "champions-wake", kind: "exterior", status: "planned" },
];

const docks = [
  { id: "shellshore-dock", townId: "shellshore-village", sceneId: "town", status: "prototype", position: { x: 7, y: 8 }, facing: "up" },
  { id: "sunpatch-dock", townId: "sunpatch-cay", sceneId: "sunpatch-cay-town", status: "planned" },
  { id: "brackwater-dock", townId: "brackwater-landing", sceneId: "brackwater-landing-town", status: "planned" },
  { id: "current-commons-dock", townId: "current-commons", sceneId: "current-commons-town", status: "planned" },
  { id: "kelpwatch-dock", townId: "kelpwatch-island", sceneId: "kelpwatch-island-town", status: "planned" },
  { id: "trenchlight-dock", townId: "trenchlight-station", sceneId: "trenchlight-station-town", status: "planned" },
  { id: "champions-wake-dock", townId: "champions-wake", sceneId: "champions-wake-town", status: "planned" },
];

const conversations = [
  {
    id: "conversation-shellshore-marina",
    townId: "shellshore-village",
    npcId: "marina",
    lines: {
      intro: [
        "Welcome to Coral Cottage! Every strong ecosystem starts with a patient gardener.",
        "I use clever reef friendships to build Victory Points fast. Want to test your SeaPals deck against mine?",
      ],
      rematch: [
        "Your Coral Crest still shines! A good Reefkeeper never turns down more practice.",
        "Would you like another 10 VP duel with my Coral Garden deck?",
      ],
      victory: [
        "That was a beautiful ecosystem! You read the current and reached 10 VP first.",
        "Take the Coral Crest. Dorian across the village studies the creatures of the deep\u2014he will be a tougher challenge.",
      ],
    },
  },
  {
    id: "conversation-shellshore-dorian",
    townId: "shellshore-village",
    npcId: "dorian",
    lines: {
      intro: [
        "You made it to Deepwater House. Down here, patience matters more than sunlight.",
        "My Darkness Shroud deck hides powerful creatures in the abyss. Show me how your reef handles the pressure.",
      ],
      rematch: [
        "The Abyss Crest belongs to you, but the deep is never the same twice.",
        "Ready to face my Darkness Shroud deck again?",
      ],
      victory: [
        "Impressive. You kept building even when the deep pushed back.",
        "The Abyss Crest is yours. Shellshore Village now recognizes you as a Tidebound Champion!",
      ],
    },
  },
];

const npcs = [
  {
    id: "marina",
    townId: "shellshore-village",
    sceneId: "coral-home",
    roleId: "town-challenger",
    name: "Marina",
    title: "Coral Gardener",
    color: "coral",
    crest: "Coral Crest",
    conversationId: "conversation-shellshore-marina",
    encounterId: "encounter-shellshore-marina",
  },
  {
    id: "dorian",
    townId: "shellshore-village",
    sceneId: "deep-home",
    roleId: "town-challenger",
    name: "Dorian",
    title: "Deep Sea Researcher",
    color: "deep",
    crest: "Abyss Crest",
    conversationId: "conversation-shellshore-dorian",
    encounterId: "encounter-shellshore-dorian",
  },
];

const learningPlans = {
  "quest-shellshore-first-voyage": {
    concept: "A habitat is a place an organism lives; an ecosystem includes organisms, conditions, and their relationships.",
    misconception: "Habitat and ecosystem are interchangeable names for the same thing.",
    evidence: ["Compare organisms and physical conditions at two harbor survey points.", "Record a safe marked route through the harbor."],
    decision: "Choose which observations describe habitat and which describe ecosystem relationships.",
    consequence: "The mentor approves a safe first route and corrects unsupported conclusions.",
    debrief: "Explain why observing conditions and relationships comes before acting.",
    callback: "Use habitat and ecosystem evidence again when arriving at Sunpatch Cay.",
  },
  "quest-sunpatch-reef-response": {
    concept: "Bleaching is a stress response; visible tissue loss is recorded as a lesion and needs expert assessment before a disease label is assigned.",
    misconception: "Every white coral is dead or can be diagnosed as diseased by appearance alone.",
    evidence: ["Compare healthy, pale, tissue-loss, and algae-covered reef patches.", "Record temperature, water clarity, and repeat photographs."],
    decision: "Report the evidence and choose a local stress-reduction response without claiming an instant cure.",
    consequence: "Monitoring and no-anchor protection improve while reef recovery remains gradual and uncertain.",
    debrief: "Describe one difference among bleaching, suspected disease, and dead substrate.",
    callback: "Consider how warming and food-web stress can interact at Kelpwatch Island.",
  },
  "quest-brackwater-water-clues": {
    concept: "Estuary conditions naturally vary, while excess runoff or nutrients can alter turbidity, algae, and dissolved oxygen.",
    misconception: "Murky estuary water is always polluted.",
    evidence: ["Compare salinity, turbidity, and dissolved oxygen across locations and tides.", "Check rainfall and nutrient clues before choosing a cause."],
    decision: "Identify which pattern is expected variation and which warrants a runoff response.",
    consequence: "Residents target a source while preserving naturally productive nursery habitat.",
    debrief: "Explain why one cloudy reading alone cannot establish pollution.",
    callback: "Use current direction to predict where material from the estuary may travel.",
  },
  "quest-current-ghost-gear": {
    concept: "Currents connect distant places, and lost fishing gear can keep trapping wildlife until removed or prevented.",
    misconception: "A cleanup alone prevents future ghost gear.",
    evidence: ["Compare current arrows with reports of lost gear.", "Identify wildlife overlap and the likely upstream source area."],
    decision: "Plan a safe removal route and a source-prevention step.",
    consequence: "One hazard is removed and a reporting or gear-management practice reduces recurrence.",
    debrief: "Explain how current evidence connected the source and impact locations.",
    callback: "Use transported food and material as evidence during the deep-ocean descent.",
  },
  "quest-kelpwatch-balance": {
    concept: "Kelp is habitat-forming, and changes among predators, grazers, and kelp can cascade through a food web.",
    misconception: "Removing one species always restores ecological balance.",
    evidence: ["Compare kelp cover, grazer abundance, and predator observations at several sites.", "Build a three-link food-web model."],
    decision: "Choose a monitoring and restoration response that acknowledges multiple drivers.",
    consequence: "The town tests a bounded response and continues monitoring rather than promising instant recovery.",
    debrief: "Predict one effect of changing a grazer or predator population.",
    callback: "Recognize a different food-web constraint in a tournament conversation.",
  },
  "quest-trenchlight-sensor": {
    concept: "Deep-ocean organisms live with darkness, cold, pressure, and limited food; bioluminescence has several possible functions.",
    misconception: "Every trench contains a hydrothermal vent and all deep-sea life depends on chemosynthesis.",
    evidence: ["Track light and pressure during an NPC-piloted descent.", "Photograph marine snow and bioluminescent observations without collecting wildlife."],
    decision: "Use lights, camera, sonar, and the sampling arm to recover a sensor with minimal disturbance.",
    consequence: "The sensor is recovered while fragile habitat remains undisturbed.",
    debrief: "Connect one observed adaptation to a specific deep-ocean condition.",
    callback: "Apply evidence from all five habitats at Champion's Wake.",
  },
  "quest-champions-wake": {
    concept: "Ecosystem decisions require evidence, relationships, and acknowledgement of tradeoffs across habitats.",
    misconception: "One strategy or intervention works in every ocean habitat.",
    evidence: ["Review Tide Marks and Field Notes from all five ecosystem chapters.", "Compare unfamiliar examples with earlier evidence patterns."],
    decision: "Register a legal deck and explain an evidence-supported response before the tournament.",
    consequence: "The player enters a three-round 30 VP bracket and sees modest outcomes from earlier towns.",
    debrief: "Reflect on how evidence changed at least one earlier assumption.",
    callback: "Postgame rematches and return visits continue the observation cycle.",
  },
};

const questDefinitions = [
  ["quest-shellshore-first-voyage", "shellshore-village", "First Voyage", "dialogue-shellshore-first-voyage", "reward-shellshore-tutorial"],
  ["quest-sunpatch-reef-response", "sunpatch-cay", "Reef Response", "dialogue-sunpatch-reef-response", "reward-sunpatch-fieldwork"],
  ["quest-brackwater-water-clues", "brackwater-landing", "Water Clues", "dialogue-brackwater-water-clues", "reward-brackwater-fieldwork"],
  ["quest-current-ghost-gear", "current-commons", "Currents and Ghost Gear", "dialogue-current-ghost-gear", "reward-current-fieldwork"],
  ["quest-kelpwatch-balance", "kelpwatch-island", "A Forest in Balance", "dialogue-kelpwatch-balance", "reward-kelpwatch-fieldwork"],
  ["quest-trenchlight-sensor", "trenchlight-station", "Sensor in the Dark", "dialogue-trenchlight-sensor", "reward-trenchlight-fieldwork"],
  ["quest-champions-wake", "champions-wake", "The SeaPals Tournament", "dialogue-champions-wake", "reward-tournament-champion"],
];

const quests = questDefinitions.map(([id, townId, title, dialogueId, rewardId]) => ({
  id,
  townId,
  title,
  stateSequence: ["notStarted", "active", "readyToTurnIn", "complete"],
  dialogueId,
  rewardId,
  learning: learningPlans[id],
}));

function dialoguePlan(id, townId, questId, roles) {
  return {
    id,
    townId,
    questId,
    beats: REQUIRED_DIALOGUE_BEATS.map((beat, index) => ({
      id: beat,
      speakerRoleId: roles[index] ?? roles.at(-1),
      purpose: `${beat} beat for ${questId}`,
    })),
  };
}

const dialogues = [
  dialoguePlan("dialogue-shellshore-first-voyage", "shellshore-village", "quest-shellshore-first-voyage", ["mentor", "field-partner", "mentor", "reflection-character", "reflection-character"]),
  dialoguePlan("dialogue-sunpatch-reef-response", "sunpatch-cay", "quest-sunpatch-reef-response", REQUIRED_ECOSYSTEM_NPC_ROLES),
  dialoguePlan("dialogue-brackwater-water-clues", "brackwater-landing", "quest-brackwater-water-clues", REQUIRED_ECOSYSTEM_NPC_ROLES),
  dialoguePlan("dialogue-current-ghost-gear", "current-commons", "quest-current-ghost-gear", REQUIRED_ECOSYSTEM_NPC_ROLES),
  dialoguePlan("dialogue-kelpwatch-balance", "kelpwatch-island", "quest-kelpwatch-balance", REQUIRED_ECOSYSTEM_NPC_ROLES),
  dialoguePlan("dialogue-trenchlight-sensor", "trenchlight-station", "quest-trenchlight-sensor", REQUIRED_ECOSYSTEM_NPC_ROLES),
  dialoguePlan("dialogue-champions-wake", "champions-wake", "quest-champions-wake", ["tournament-director", "reflection-character", "tournament-director", "reflection-character", "reflection-character"]),
];

const encounters = [
  { id: "encounter-shellshore-mentor-practice", townId: "shellshore-village", questId: "quest-shellshore-first-voyage", role: "practice", opponentId: "academy-mentor", opponentDeckId: "coral-garden", victoryTarget: 10, difficulty: "easy", rewardId: "reward-shellshore-tutorial" },
  { id: "encounter-shellshore-marina", townId: "shellshore-village", questId: "quest-shellshore-first-voyage", role: "resident", opponentId: "marina", opponentDeckId: "coral-garden", victoryTarget: 10, difficulty: "easy", rewardId: null },
  { id: "encounter-shellshore-dorian", townId: "shellshore-village", questId: "quest-shellshore-first-voyage", role: "resident", opponentId: "dorian", opponentDeckId: "darkness-shroud", victoryTarget: 10, difficulty: "medium", rewardId: null },
  { id: "encounter-sunpatch-resident-gardener", townId: "sunpatch-cay", questId: "quest-sunpatch-reef-response", role: "resident", opponentId: "sunpatch-gardener", opponentDeckId: "coral-garden", victoryTarget: 10, difficulty: "easy", rewardId: null },
  { id: "encounter-sunpatch-resident-surveyor", townId: "sunpatch-cay", questId: "quest-sunpatch-reef-response", role: "resident", opponentId: "sunpatch-surveyor", opponentDeckId: "coral-garden", victoryTarget: 10, difficulty: "easy", rewardId: null },
  { id: "encounter-sunpatch-qualifier", townId: "sunpatch-cay", questId: "quest-sunpatch-reef-response", role: "qualifier", opponentId: "sunpatch-leader", opponentDeckId: "coral-garden", victoryTarget: 10, difficulty: "easy", rewardId: "reward-sunpatch-qualifier", prerequisites: [{ type: "questStatus", questId: "quest-sunpatch-reef-response", status: "complete" }] },
  { id: "encounter-brackwater-resident-naturalist", townId: "brackwater-landing", questId: "quest-brackwater-water-clues", role: "resident", opponentId: "brackwater-naturalist", opponentDeckId: "murky-water", victoryTarget: 10, difficulty: "easy", rewardId: null },
  { id: "encounter-brackwater-resident-harbormaster", townId: "brackwater-landing", questId: "quest-brackwater-water-clues", role: "resident", opponentId: "brackwater-harbormaster", opponentDeckId: "disruption", victoryTarget: 10, difficulty: "medium", rewardId: null },
  { id: "encounter-brackwater-qualifier", townId: "brackwater-landing", questId: "quest-brackwater-water-clues", role: "qualifier", opponentId: "brackwater-leader", opponentDeckId: "murky-water", victoryTarget: 10, difficulty: "medium", rewardId: "reward-brackwater-qualifier", prerequisites: [{ type: "questStatus", questId: "quest-brackwater-water-clues", status: "complete" }] },
  { id: "encounter-current-resident-navigator", townId: "current-commons", questId: "quest-current-ghost-gear", role: "resident", opponentId: "current-navigator", opponentDeckId: "blue-water", victoryTarget: 10, difficulty: "medium", rewardId: null },
  { id: "encounter-current-resident-deckhand", townId: "current-commons", questId: "quest-current-ghost-gear", role: "resident", opponentId: "current-deckhand", opponentDeckId: "open-ocean-hunt", victoryTarget: 10, difficulty: "medium", rewardId: null },
  { id: "encounter-current-qualifier", townId: "current-commons", questId: "quest-current-ghost-gear", role: "qualifier", opponentId: "current-leader", opponentDeckId: "blue-water", victoryTarget: 10, difficulty: "medium", rewardId: "reward-current-qualifier", prerequisites: [{ type: "questStatus", questId: "quest-current-ghost-gear", status: "complete" }] },
  { id: "encounter-kelpwatch-resident-diver", townId: "kelpwatch-island", questId: "quest-kelpwatch-balance", role: "resident", opponentId: "kelpwatch-diver", opponentDeckId: "stinging-fortress", victoryTarget: 10, difficulty: "medium", rewardId: null },
  { id: "encounter-kelpwatch-resident-ranger", townId: "kelpwatch-island", questId: "quest-kelpwatch-balance", role: "resident", opponentId: "kelpwatch-ranger", opponentDeckId: "coral-garden", victoryTarget: 10, difficulty: "medium", rewardId: null },
  { id: "encounter-kelpwatch-qualifier", townId: "kelpwatch-island", questId: "quest-kelpwatch-balance", role: "qualifier", opponentId: "kelpwatch-leader", opponentDeckId: "stinging-fortress", victoryTarget: 10, difficulty: "medium", rewardId: "reward-kelpwatch-qualifier", prerequisites: [{ type: "questStatus", questId: "quest-kelpwatch-balance", status: "complete" }] },
  { id: "encounter-trenchlight-resident-engineer", townId: "trenchlight-station", questId: "quest-trenchlight-sensor", role: "resident", opponentId: "trenchlight-engineer", opponentDeckId: "darkness-shroud", victoryTarget: 10, difficulty: "hard", rewardId: null },
  { id: "encounter-trenchlight-resident-observer", townId: "trenchlight-station", questId: "quest-trenchlight-sensor", role: "resident", opponentId: "trenchlight-observer", opponentDeckId: "disruption", victoryTarget: 10, difficulty: "hard", rewardId: null },
  { id: "encounter-trenchlight-qualifier", townId: "trenchlight-station", questId: "quest-trenchlight-sensor", role: "qualifier", opponentId: "trenchlight-leader", opponentDeckId: "darkness-shroud", victoryTarget: 10, difficulty: "hard", rewardId: "reward-trenchlight-qualifier", prerequisites: [{ type: "questStatus", questId: "quest-trenchlight-sensor", status: "complete" }] },
  { id: "encounter-tournament-quarterfinal", townId: "champions-wake", questId: "quest-champions-wake", role: "tournament", opponentId: "tournament-quarterfinalist", opponentDeckId: "disruption", victoryTarget: 30, difficulty: "medium", rewardId: null },
  { id: "encounter-tournament-semifinal", townId: "champions-wake", questId: "quest-champions-wake", role: "tournament", opponentId: "tournament-semifinalist", opponentDeckId: "open-ocean-hunt", victoryTarget: 30, difficulty: "hard", rewardId: null },
  { id: "encounter-tournament-final", townId: "champions-wake", questId: "quest-champions-wake", role: "tournament", opponentId: "tournament-champion", opponentDeckId: "darkness-shroud", victoryTarget: 30, difficulty: "hard", rewardId: "reward-tournament-champion" },
];

const rewards = [
  { id: "reward-shellshore-tutorial", grantId: "reward-shellshore-tutorial", routeIds: ["route-shellshore-sunpatch"], fieldNoteIds: ["field-note-harbor-basics"] },
  { id: "reward-sunpatch-fieldwork", grantId: "reward-sunpatch-fieldwork", fieldNoteIds: ["field-note-coral-observations"] },
  { id: "reward-sunpatch-qualifier", grantId: "reward-sunpatch-qualifier", packs: { "pack-pool-sunpatch-coral": 1 }, tideMarkIds: ["tide-mark-sunpatch"], routeIds: ["route-sunpatch-brackwater"] },
  { id: "reward-brackwater-fieldwork", grantId: "reward-brackwater-fieldwork", fieldNoteIds: ["field-note-estuary-conditions"] },
  { id: "reward-brackwater-qualifier", grantId: "reward-brackwater-qualifier", packs: { "pack-pool-brackwater-murky": 1 }, tideMarkIds: ["tide-mark-brackwater"], routeIds: ["route-brackwater-current"] },
  { id: "reward-current-fieldwork", grantId: "reward-current-fieldwork", fieldNoteIds: ["field-note-current-connections"] },
  { id: "reward-current-qualifier", grantId: "reward-current-qualifier", packs: { "pack-pool-current-bluewater": 1 }, tideMarkIds: ["tide-mark-current"], routeIds: ["route-current-kelpwatch"] },
  { id: "reward-kelpwatch-fieldwork", grantId: "reward-kelpwatch-fieldwork", fieldNoteIds: ["field-note-kelp-food-web"] },
  { id: "reward-kelpwatch-qualifier", grantId: "reward-kelpwatch-qualifier", packs: { "pack-pool-kelpwatch": 1 }, tideMarkIds: ["tide-mark-kelpwatch"], routeIds: ["route-kelpwatch-trenchlight"] },
  { id: "reward-trenchlight-fieldwork", grantId: "reward-trenchlight-fieldwork", fieldNoteIds: ["field-note-deep-adaptations"] },
  { id: "reward-trenchlight-qualifier", grantId: "reward-trenchlight-qualifier", packs: { "pack-pool-trenchlight-deep": 1 }, tideMarkIds: ["tide-mark-trenchlight"], routeIds: ["route-trenchlight-champions-wake"] },
  { id: "reward-tournament-champion", grantId: "reward-tournament-champion", storyItems: { "seapals-championship-cup": 1 }, fieldNoteIds: ["field-note-archipelago-reflection"] },
];

const packPools = [
  ["pack-pool-sunpatch-coral", "Coral reef relationships"],
  ["pack-pool-brackwater-murky", "Estuary and mangrove relationships"],
  ["pack-pool-current-bluewater", "Open-ocean food webs"],
  ["pack-pool-kelpwatch", "Kelp-forest food webs"],
  ["pack-pool-trenchlight-deep", "Deep-ocean adaptations"],
].map(([id, theme]) => ({
  id,
  theme,
  status: "planned",
  purchaseMode: "earned-only",
  progressionGuarantee: "fixed-story-cards-plus-new-eligible-card",
  cardIds: [],
}));

const routes = [
  ["route-shellshore-sunpatch", "shellshore-village", "sunpatch-cay"],
  ["route-sunpatch-brackwater", "sunpatch-cay", "brackwater-landing"],
  ["route-brackwater-current", "brackwater-landing", "current-commons"],
  ["route-current-kelpwatch", "current-commons", "kelpwatch-island"],
  ["route-kelpwatch-trenchlight", "kelpwatch-island", "trenchlight-station"],
  ["route-trenchlight-champions-wake", "trenchlight-station", "champions-wake"],
].map(([id, fromTownId, toTownId]) => ({
  id,
  fromTownId,
  toTownId,
  manualPilotRequiredFirstTime: true,
  autoSteerAfterFirstCompletion: true,
}));

const unlockRules = [
  { id: "unlock-shellshore-start", townId: "shellshore-village", questIds: [], tideMarkIds: [], routeIds: [] },
  { id: "unlock-sunpatch", townId: "sunpatch-cay", questIds: ["quest-shellshore-first-voyage"], tideMarkIds: [], routeIds: ["route-shellshore-sunpatch"] },
  { id: "unlock-brackwater", townId: "brackwater-landing", questIds: ["quest-sunpatch-reef-response"], tideMarkIds: ["tide-mark-sunpatch"], routeIds: ["route-sunpatch-brackwater"] },
  { id: "unlock-current-commons", townId: "current-commons", questIds: ["quest-brackwater-water-clues"], tideMarkIds: ["tide-mark-brackwater"], routeIds: ["route-brackwater-current"] },
  { id: "unlock-kelpwatch", townId: "kelpwatch-island", questIds: ["quest-current-ghost-gear"], tideMarkIds: ["tide-mark-current"], routeIds: ["route-current-kelpwatch"] },
  { id: "unlock-trenchlight", townId: "trenchlight-station", questIds: ["quest-kelpwatch-balance"], tideMarkIds: ["tide-mark-kelpwatch"], routeIds: ["route-kelpwatch-trenchlight"] },
  { id: "unlock-champions-wake", townId: "champions-wake", questIds: ["quest-trenchlight-sensor"], tideMarkIds: ["tide-mark-sunpatch", "tide-mark-brackwater", "tide-mark-current", "tide-mark-kelpwatch", "tide-mark-trenchlight"], routeIds: ["route-trenchlight-champions-wake"] },
];

export const ADVENTURE_CONTENT = Object.freeze({
  schemaVersion: ADVENTURE_CONTENT_SCHEMA_VERSION,
  npcRoleDefinitions,
  npcs,
  towns,
  scenes,
  docks,
  conversations,
  dialogues,
  quests,
  encounters,
  rewards,
  packPools,
  routes,
  unlockRules,
});

function findContentById(collection, id) {
  return collection.find((item) => item.id === id) ?? null;
}

export function getAdventureTown(townId, content = ADVENTURE_CONTENT) {
  return findContentById(content.towns, townId);
}

export function getAdventureScene(sceneId, content = ADVENTURE_CONTENT) {
  return findContentById(content.scenes, sceneId);
}

export function getAdventureDock(dockId, content = ADVENTURE_CONTENT) {
  return findContentById(content.docks, dockId);
}

export function getAdventureNpc(npcId, content = ADVENTURE_CONTENT) {
  return findContentById(content.npcs, npcId);
}

export function getAdventureConversation(conversationId, content = ADVENTURE_CONTENT) {
  return findContentById(content.conversations, conversationId);
}

export function getAdventureEncounter(encounterId, content = ADVENTURE_CONTENT) {
  return findContentById(content.encounters, encounterId);
}

export function getRuntimeAdventureScenes(content = ADVENTURE_CONTENT) {
  return content.scenes.filter((scene) => scene.status === "prototype" && scene.world);
}

export function getAdventureStartLocation(content = ADVENTURE_CONTENT) {
  const town = content.towns.find((candidate) => candidate.chapterType === "starter" && candidate.arrivalRouteId === null);
  const scene = town ? getAdventureScene(town.startSceneId, content) : null;
  const dock = town ? getAdventureDock(town.dockId, content) : null;
  if (!town || !scene?.world) return null;
  return {
    townId: town.id,
    dockId: town.dockId,
    sceneId: scene.id,
    position: { ...(dock?.position ?? scene.world.spawn) },
    facing: dock?.facing ?? scene.world.startFacing ?? "down",
  };
}

export function getAdventureSceneInteraction(sceneId, interactionId, content = ADVENTURE_CONTENT) {
  const scene = getAdventureScene(sceneId, content);
  return scene?.world?.interactions.find((interaction) => interaction.id === interactionId) ?? null;
}

export function resolveAdventureNpc(npcId, content = ADVENTURE_CONTENT) {
  const npc = getAdventureNpc(npcId, content);
  if (!npc) return null;
  return {
    ...npc,
    conversation: getAdventureConversation(npc.conversationId, content),
    encounter: getAdventureEncounter(npc.encounterId, content),
  };
}

export function resolveAdventureInteraction(sceneId, interactionId, content = ADVENTURE_CONTENT) {
  const interaction = getAdventureSceneInteraction(sceneId, interactionId, content);
  if (!interaction) return null;
  if (interaction.type === "trainer") {
    return {
      ...interaction,
      npc: resolveAdventureNpc(interaction.npcId, content),
    };
  }
  return {
    ...interaction,
    targetSceneContent: getAdventureScene(interaction.targetScene, content),
  };
}
