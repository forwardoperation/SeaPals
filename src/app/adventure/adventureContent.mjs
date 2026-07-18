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

export const ADVENTURE_STARTER_DECK_IDS = Object.freeze([
  "coral-garden",
  "murky-water",
  "blue-water",
]);

export const REQUIRED_TUTORIAL_ACTION_TYPES = Object.freeze([
  "match-ready",
  "rp-collected",
  "card-drawn",
  "card-built",
  "attack-resolved",
  "turn-ended",
  "vp-earned",
]);

export const REQUIRED_TUTORIAL_CHECKPOINT_IDS = Object.freeze([
  "tutorial-setup",
  "tutorial-collect-rp",
  "tutorial-draw-card",
  "tutorial-build-card",
  "tutorial-attack",
  "tutorial-end-turn",
  "tutorial-earn-vp",
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
    academySceneId: "academy-lab",
    mentorNpcId: "academy-mentor",
    tutorialId: "tutorial-shellshore-live-basics",
    starterDeckIds: [...ADVENTURE_STARTER_DECK_IDS],
    questIds: ["quest-shellshore-first-voyage"],
    encounterIds: [
      "encounter-shellshore-mentor-practice",
      "encounter-shellshore-marina",
      "encounter-shellshore-dorian",
    ],
    plannedNpcRoleIds: ["mentor", "field-partner", "town-challenger", "reflection-character"],
    packPoolId: "pack-pool-shellshore-discovery",
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
      "encounter-sunpatch-exhibition",
    ],
    plannedNpcRoleIds: [...REQUIRED_ECOSYSTEM_NPC_ROLES],
    packPoolId: "pack-pool-sunpatch-coral",
    unlockRuleId: "unlock-sunpatch",
    arrivalRouteId: "route-shellshore-sunpatch",
    encounterPlan: { practice: 0, resident: 2, qualifier: 1, exhibition: 1 },
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
      "ttttssssSssstttt",
      "ttttttttpttttttt",
      "tttccCccpddDdddt",
      "ttttgpggpggpgttt",
      "ttttgpggpggpgtgt",
      "ttttgpgggggpgtgt",
      "ttpppppppppppppt",
      "tttppppppppppptt",
      "tttttttttttttttt",
    ],
    spawn: { x: 7, y: 8 },
    startFacing: "up",
    collisionRects: [
      { id: "town-center-sign-post", left: 8.45, top: 3.95, right: 9.15, bottom: 4.7 },
    ],
    interactions: [
      {
        id: "interaction-town-enter-academy",
        type: "enter",
        at: { x: 8, y: 1 },
        targetScene: "academy-lab",
        spawn: { x: 6, y: 7 },
        facing: "up",
      },
      {
        id: "interaction-town-enter-coral-home",
        type: "enter",
        at: { x: 5, y: 3 },
        targetScene: "coral-home",
        spawn: { x: 5, y: 6 },
        facing: "up",
      },
      {
        id: "interaction-town-enter-deep-home",
        type: "enter",
        at: { x: 11, y: 3 },
        targetScene: "deep-home",
        spawn: { x: 5, y: 6 },
        facing: "up",
      },
      {
        id: "interaction-shellshore-board-boat",
        type: "board",
        at: { x: 7, y: 9 },
        routeId: "route-shellshore-sunpatch",
        dockId: "shellshore-dock",
        targetScene: "shellshore-sunpatch-sea",
        spawn: { x: 1, y: 5 },
        facing: "right",
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
    collisionRects: [
      { id: "coral-upper-left-table", left: 0.45, top: 1.45, right: 2.75, bottom: 1.98 },
      { id: "coral-left-aquarium", left: 0.35, top: 2.1, right: 3.3, bottom: 4.65 },
      { id: "coral-upper-right-bookcase", left: 7.75, top: 1.55, right: 10.45, bottom: 4.25 },
      { id: "coral-lower-left-display", left: -0.1, top: 4.6, right: 3.1, bottom: 6.35 },
      { id: "coral-lower-right-display", left: 7.75, top: 4.55, right: 10.95, bottom: 6.35 },
    ],
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
        facing: "down",
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
    collisionRects: [
      { id: "deep-left-habitat-tank", left: 0.25, top: 1.65, right: 3.1, bottom: 4.65 },
      { id: "deep-right-research-console", left: 7.6, top: 1.85, right: 10.25, bottom: 4.8 },
      { id: "deep-lower-left-equipment", left: -0.05, top: 5.45, right: 3.3, bottom: 6.95 },
      { id: "deep-lower-right-equipment", left: 7.2, top: 5.45, right: 10.7, bottom: 6.95 },
    ],
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
        facing: "down",
      },
    ],
  },
  "academy-lab": {
    name: "Shellshore Academy Lab",
    worldKind: "interior",
    theme: "academy-lab",
    tiles: [
      "wwwwwwwwwwwwww",
      "wwwwwwwwwwwwww",
      "waaffffaffffaw",
      "waaffffnffffaw",
      "wfffrrrrrrfffw",
      "wfffrrrrrrfffw",
      "wfffaaffaafffw",
      "wffffffffffffw",
      "wwwwwwEwwwwwww",
    ],
    spawn: { x: 6, y: 7 },
    collisionRects: [
      { id: "academy-top-left-cabinetry", left: 0.5, top: 1.45, right: 3.75, bottom: 3.2 },
      { id: "academy-rear-bench", left: 4.95, top: 1.45, right: 7.95, bottom: 2.65 },
      { id: "academy-helm-wheel", left: 7.95, top: 1.7, right: 8.8, bottom: 2.8 },
      { id: "academy-top-right-cabinetry", left: 9.3, top: 1.45, right: 12.2, bottom: 3.2 },
      { id: "academy-left-aquarium-workstation", left: 2.45, top: 4.25, right: 5.1, bottom: 7.1 },
      { id: "academy-right-aquarium-workstation", left: 7.85, top: 4.25, right: 10.55, bottom: 7.1 },
      { id: "academy-lower-left-storage", left: 0.05, top: 6.15, right: 1.75, bottom: 7.15 },
      { id: "academy-right-gear-cabinet", left: 11.05, top: 4.5, right: 12.85, bottom: 7.15 },
    ],
    interactions: [
      {
        id: "interaction-academy-mentor",
        type: "trainer",
        at: { x: 7, y: 3 },
        trainerId: "academy-mentor",
        npcId: "academy-mentor",
        conversationId: "conversation-shellshore-academy-mentor",
        encounterId: "encounter-shellshore-mentor-practice",
      },
      {
        id: "interaction-academy-exit",
        type: "exit",
        at: { x: 6, y: 8 },
        targetScene: "town",
        spawn: { x: 8, y: 2 },
        facing: "down",
      },
    ],
  },
};

const shellshoreSunpatchRouteWorld = {
  name: "Shellshore–Sunpatch Sea Lane",
  worldKind: "route",
  theme: "shellshore-sunpatch-route",
  movement: {
    mode: "boat",
    speed: 3.2,
    radius: 0.28,
    maxStepDistance: 0.08,
  },
  tiles: [
    "kkkkkkkkkkkkkkkk",
    "kooooooooooooook",
    "kooobooooookoook",
    "kooooooooooooook",
    "kookoooooboooook",
    "HooooooooooooooH",
    "koooookooooooook",
    "kooooobooooooook",
    "kooooooooooooook",
    "kkkkkkkkkkkkkkkk",
  ],
  spawn: { x: 1, y: 5 },
  startFacing: "right",
  interactions: [
    {
      id: "interaction-route-dock-shellshore",
      type: "dock",
      endpoint: "from",
      at: { x: 0, y: 5 },
      routeId: "route-shellshore-sunpatch",
      dockId: "shellshore-dock",
      targetScene: "town",
      spawn: { x: 7, y: 8 },
      facing: "up",
    },
    {
      id: "interaction-route-dock-sunpatch",
      type: "dock",
      endpoint: "to",
      at: { x: 15, y: 5 },
      routeId: "route-shellshore-sunpatch",
      dockId: "sunpatch-dock",
      targetScene: "sunpatch-cay-town",
      spawn: { x: 7, y: 8 },
      facing: "up",
    },
  ],
};

const sunpatchRuntimeScenes = {
  "sunpatch-cay-town": {
    name: "Sunpatch Cay",
    worldKind: "town",
    theme: "sunpatch-cay",
    tiles: [
      "tttttttttttttttt",
      "tccCctssSstddDdt",
      "tcccctsssstddddt",
      "ttgppppppppppgtt",
      "ttgagppppppgagtt",
      "ttgggppppppnggtt",
      "ttgggppnpppgggtt",
      "ttgagppppppgagtt",
      "ttgggggppgggggtt",
      "tttttttHHttttttt",
    ],
    spawn: { x: 7, y: 8 },
    startFacing: "up",
    collisionRects: [
      { id: "sunpatch-station-healthy", left: 2.62, top: 3.62, right: 3.38, bottom: 4.38 },
      { id: "sunpatch-station-bleached", left: 11.62, top: 3.62, right: 12.38, bottom: 4.38 },
      { id: "sunpatch-station-lesion", left: 2.62, top: 6.62, right: 3.38, bottom: 7.38 },
      { id: "sunpatch-station-algae", left: 11.62, top: 6.62, right: 12.38, bottom: 7.38 },
    ],
    interactions: [
      {
        id: "interaction-sunpatch-enter-garden-home",
        type: "enter",
        at: { x: 3, y: 1 },
        targetScene: "sunpatch-garden-home",
        spawn: { x: 5, y: 6 },
        facing: "up",
      },
      {
        id: "interaction-sunpatch-enter-field-station",
        type: "enter",
        at: { x: 8, y: 1 },
        targetScene: "sunpatch-field-station",
        spawn: { x: 5, y: 6 },
        facing: "up",
      },
      {
        id: "interaction-sunpatch-enter-tide-hall",
        type: "enter",
        at: { x: 13, y: 1 },
        targetScene: "sunpatch-tide-hall",
        spawn: { x: 5, y: 6 },
        facing: "up",
      },
      {
        id: "interaction-sunpatch-tavi",
        type: "npc",
        at: { x: 7, y: 6 },
        npcId: "sunpatch-tavi",
        conversationId: "conversation-sunpatch-tavi",
      },
      {
        id: "interaction-sunpatch-bo",
        type: "trainer",
        at: { x: 11, y: 5 },
        trainerId: "sunpatch-surveyor",
        npcId: "sunpatch-surveyor",
        conversationId: "conversation-sunpatch-bo",
        encounterId: "encounter-sunpatch-resident-surveyor",
      },
      {
        id: "interaction-sunpatch-observe-healthy",
        type: "observation",
        at: { x: 3, y: 4 },
        questId: "quest-sunpatch-reef-response",
        observationId: "healthy-comparison",
      },
      {
        id: "interaction-sunpatch-observe-bleached",
        type: "observation",
        at: { x: 12, y: 4 },
        questId: "quest-sunpatch-reef-response",
        observationId: "bleached-tissue",
      },
      {
        id: "interaction-sunpatch-observe-lesion",
        type: "observation",
        at: { x: 3, y: 7 },
        questId: "quest-sunpatch-reef-response",
        observationId: "described-lesion",
      },
      {
        id: "interaction-sunpatch-observe-algae",
        type: "observation",
        at: { x: 12, y: 7 },
        questId: "quest-sunpatch-reef-response",
        observationId: "algae-covered-skeleton",
      },
      {
        id: "interaction-sunpatch-board-shellshore-route",
        type: "board",
        at: { x: 7, y: 9 },
        routeId: "route-shellshore-sunpatch",
        dockId: "sunpatch-dock",
        targetScene: "shellshore-sunpatch-sea",
        spawn: { x: 14, y: 5 },
        facing: "left",
      },
    ],
  },
  "sunpatch-field-station": {
    name: "Sunpatch Reef Field Station",
    worldKind: "interior",
    theme: "sunpatch-field-station",
    tiles: [
      "wwwwwwwwwwww",
      "wwwwwwwwwwww",
      "waaafnffaaaw",
      "wfffrrrrfffw",
      "wfffrrrrfffw",
      "wffffffffffw",
      "wffffffffffw",
      "wwwwwEwwwwww",
    ],
    spawn: { x: 5, y: 6 },
    collisionRects: [
      { id: "sunpatch-field-left-console", left: 0.5, top: 1.45, right: 3.55, bottom: 2.45 },
      { id: "sunpatch-field-right-console", left: 7.45, top: 1.45, right: 10.5, bottom: 2.45 },
    ],
    interactions: [
      {
        id: "interaction-sunpatch-mira",
        type: "npc",
        at: { x: 5, y: 2 },
        npcId: "sunpatch-mira",
        conversationId: "conversation-sunpatch-mira",
      },
      {
        id: "interaction-sunpatch-interpret-evidence",
        type: "interpretation",
        at: { x: 3, y: 2 },
        questId: "quest-sunpatch-reef-response",
        choiceSetId: "sunpatch-reef-interpretation",
      },
      {
        id: "interaction-sunpatch-choose-response",
        type: "response",
        at: { x: 8, y: 2 },
        questId: "quest-sunpatch-reef-response",
        choiceSetId: "sunpatch-reef-response",
      },
      {
        id: "interaction-sunpatch-field-exit",
        type: "exit",
        at: { x: 5, y: 7 },
        targetScene: "sunpatch-cay-town",
        spawn: { x: 8, y: 3 },
        facing: "down",
      },
    ],
  },
  "sunpatch-garden-home": {
    name: "Inez's Reef Garden",
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
    collisionRects: [
      { id: "sunpatch-garden-upper-left-table", left: 0.45, top: 1.45, right: 2.75, bottom: 1.98 },
      { id: "sunpatch-garden-left-aquarium", left: 0.35, top: 2.1, right: 3.3, bottom: 4.65 },
      { id: "sunpatch-garden-upper-right-bookcase", left: 7.75, top: 1.55, right: 10.45, bottom: 4.25 },
      { id: "sunpatch-garden-lower-left-display", left: -0.1, top: 4.6, right: 3.1, bottom: 6.35 },
      { id: "sunpatch-garden-lower-right-display", left: 7.75, top: 4.55, right: 10.95, bottom: 6.35 },
    ],
    interactions: [
      {
        id: "interaction-sunpatch-inez",
        type: "trainer",
        at: { x: 5, y: 2 },
        trainerId: "sunpatch-gardener",
        npcId: "sunpatch-gardener",
        conversationId: "conversation-sunpatch-inez",
        encounterId: "encounter-sunpatch-resident-gardener",
      },
      {
        id: "interaction-sunpatch-garden-exit",
        type: "exit",
        at: { x: 5, y: 7 },
        targetScene: "sunpatch-cay-town",
        spawn: { x: 3, y: 3 },
        facing: "down",
      },
    ],
  },
  "sunpatch-tide-hall": {
    name: "Sunpatch Tide Hall",
    worldKind: "interior",
    theme: "sunpatch-tide-hall",
    tiles: [
      "wwwwwwwwwwww",
      "wwwwwwwwwwww",
      "waaafnffaaaw",
      "wfffrrrrfffw",
      "wfffrrrrfffw",
      "wffffffffffw",
      "wffffffffffw",
      "wwwwwEwwwwww",
    ],
    spawn: { x: 5, y: 6 },
    collisionRects: [
      { id: "sunpatch-hall-left-display", left: 0.5, top: 1.45, right: 3.55, bottom: 2.45 },
      { id: "sunpatch-hall-right-display", left: 7.45, top: 1.45, right: 10.5, bottom: 2.45 },
    ],
    interactions: [
      {
        id: "interaction-sunpatch-nia",
        type: "trainer",
        at: { x: 5, y: 2 },
        trainerId: "sunpatch-leader",
        npcId: "sunpatch-leader",
        conversationId: "conversation-sunpatch-nia",
        encounterId: "encounter-sunpatch-qualifier",
      },
      {
        id: "interaction-sunpatch-hall-exit",
        type: "exit",
        at: { x: 5, y: 7 },
        targetScene: "sunpatch-cay-town",
        spawn: { x: 13, y: 3 },
        facing: "down",
      },
    ],
  },
};

const scenes = [
  { id: "town", townId: "shellshore-village", kind: "exterior", status: "prototype", world: shellshoreRuntimeScenes.town },
  { id: "coral-home", townId: "shellshore-village", kind: "interior", status: "prototype", world: shellshoreRuntimeScenes["coral-home"] },
  { id: "deep-home", townId: "shellshore-village", kind: "interior", status: "prototype", world: shellshoreRuntimeScenes["deep-home"] },
  { id: "academy-lab", townId: "shellshore-village", kind: "interior", status: "prototype", world: shellshoreRuntimeScenes["academy-lab"] },
  { id: "shellshore-sunpatch-sea", townId: "shellshore-village", routeId: "route-shellshore-sunpatch", kind: "route", status: "prototype", world: shellshoreSunpatchRouteWorld },
  { id: "sunpatch-cay-town", townId: "sunpatch-cay", kind: "exterior", status: "prototype", world: sunpatchRuntimeScenes["sunpatch-cay-town"] },
  { id: "sunpatch-field-station", townId: "sunpatch-cay", kind: "interior", status: "prototype", world: sunpatchRuntimeScenes["sunpatch-field-station"] },
  { id: "sunpatch-garden-home", townId: "sunpatch-cay", kind: "interior", status: "prototype", world: sunpatchRuntimeScenes["sunpatch-garden-home"] },
  { id: "sunpatch-tide-hall", townId: "sunpatch-cay", kind: "interior", status: "prototype", world: sunpatchRuntimeScenes["sunpatch-tide-hall"] },
  { id: "brackwater-landing-town", townId: "brackwater-landing", kind: "exterior", status: "planned" },
  { id: "current-commons-town", townId: "current-commons", kind: "exterior", status: "planned" },
  { id: "kelpwatch-island-town", townId: "kelpwatch-island", kind: "exterior", status: "planned" },
  { id: "trenchlight-station-town", townId: "trenchlight-station", kind: "exterior", status: "planned" },
  { id: "trenchlight-sub-descent", townId: "trenchlight-station", kind: "vehicle", status: "planned" },
  { id: "champions-wake-town", townId: "champions-wake", kind: "exterior", status: "planned" },
];

const docks = [
  { id: "shellshore-dock", townId: "shellshore-village", sceneId: "town", status: "prototype", position: { x: 7, y: 8 }, facing: "up" },
  { id: "sunpatch-dock", townId: "sunpatch-cay", sceneId: "sunpatch-cay-town", status: "prototype", position: { x: 7, y: 8 }, facing: "up" },
  { id: "brackwater-dock", townId: "brackwater-landing", sceneId: "brackwater-landing-town", status: "planned" },
  { id: "current-commons-dock", townId: "current-commons", sceneId: "current-commons-town", status: "planned" },
  { id: "kelpwatch-dock", townId: "kelpwatch-island", sceneId: "kelpwatch-island-town", status: "planned" },
  { id: "trenchlight-dock", townId: "trenchlight-station", sceneId: "trenchlight-station-town", status: "planned" },
  { id: "champions-wake-dock", townId: "champions-wake", sceneId: "champions-wake-town", status: "planned" },
];

const conversations = [
  {
    id: "conversation-shellshore-academy-mentor",
    townId: "shellshore-village",
    npcId: "academy-mentor",
    lines: {
      intro: [
        "Welcome to Shellshore Academy! I'm Professor Marlow Current, and I study how ocean neighbors share their homes.",
        "First, choose a starter deck that fits how you like to play. Then we'll learn SeaPals together, one move at a time.",
      ],
      rematch: [
        "A good field scientist practices, checks their notes, and tries again.",
        "We can replay the strategy lesson or have another friendly 26 VP academy duel whenever you like.",
      ],
      victory: [
        "You did it! You built a reliable economy, established a Coral Reef habitat, used School Density to welcome a Filter Feeder, brought out an Apex predator, and reached 26 VP.",
        "Your first Field Note is ready. Before we visit another island, let's review how to keep you, your boat, and wildlife safe.",
      ],
      starterPresentation: [
        "Coral Garden grows a busy reef, Murky Water adapts to a changing estuary, and Blue Water follows life across the open ocean.",
        "Every starter is a complete 60-card deck and can finish the whole voyage. Pick the strategy that sounds most fun to you.",
      ],
      starterConfirmed: [
        "Excellent choice. This deck is yours for the voyage, so let's learn what its cards can do.",
      ],
      tutorialIntro: [
        "Welcome to our live lesson, Reefkeeper! I'm glad we get to explore this match together.",
        "I'll stay beside you as we read the board, build a dependable RP economy, use cards only when they improve our position, and save attacks for targets that make them worthwhile.",
        "We'll play to 26 VP and finish the core lesson by establishing a Coral Reef habitat, building School Density for a Filter Feeder, and supporting an Apex predator. The next strategic choice will stay highlighted, so you'll always know what we are building toward.",
      ],
      practiceLoss: [
        "That match taught us something useful. Your deck is still safe, and losing never takes away progress.",
        "Review the lesson steps, try the practice duel again, or step outside for a break.",
      ],
      practiceExit: [
        "A smart explorer knows when to pause. Your completed lesson steps are saved, and we can continue when you're ready.",
      ],
      practiceRetry: [
        "Nice work reaching the end of that match. This academy lesson is about building a sound plan, not merely checking off controls.",
        "Your progress is safe. Let's rebuild our economy, establish the Coral Reef habitat, learn Creature Schools and Filter Feeders, and time an Apex predator carefully on the way to 26 VP.",
      ],
      boatSafety: [
        "Before leaving the harbor, wear your life jacket, check the weather, and tell the dock team your route.",
        "Slow down near animals and shallow habitats. Give wildlife space, follow marked channels, and bring every piece of gear home.",
      ],
    },
  },
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
        "You earned a Shellshore Discovery Pack, too. Open your Inventory from the pause menu when you are ready to add four new cards to your collection.",
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
  {
    id: "conversation-sunpatch-tavi",
    townId: "sunpatch-cay",
    npcId: "sunpatch-tavi",
    lines: {
      intro: [
        "Welcome to Sunpatch Cay, Reefkeeper! I'm Tavi. Some reef patches have gone pale, and one has lost tissue along its edge.",
        "We know the reef has changed, but color alone cannot tell us one cause. Dr. Mira has four monitoring stations ready for careful observations.",
      ],
      guidance: [
        "Visit all four shoreline stations. Record the comparison patch, pale living tissue, the tissue-loss lesion, and algae-covered exposed skeleton.",
        "Then bring the evidence to the field station. Describe first and diagnose later.",
      ],
      return: [
        "Welcome back! The repeat-photo stations are running, and the new mooring markers are keeping more anchors away from the monitored reef.",
        "Some coral is still pale, so the town is continuing to measure and report changes instead of declaring the reef cured.",
      ],
    },
  },
  {
    id: "conversation-sunpatch-mira",
    townId: "sunpatch-cay",
    npcId: "sunpatch-mira",
    lines: {
      intro: [
        "Hello, I'm Dr. Mira Sol. Thank you for helping us read the reef carefully.",
        "We will compare tissue, color, lesion shape, repeat photographs, local temperature trends, and water clarity. A single image or reading is evidence, not a diagnosis.",
      ],
      guidance: [
        "Pale tissue may still be alive and bleached. Record visible tissue loss as a lesion, then let trained specialists assess possible causes.",
        "At the two consoles, interpret the observations and choose a response that is useful without promising an instant cure.",
      ],
      debrief: [
        "Your notes separate three ideas: bleaching can leave living tissue pale, a lesion describes visible change without naming its cause, and algae-covered skeleton shows older tissue loss in that area.",
        "I'll add Reading a Reef to your Field Notes so you can use this evidence pattern again.",
      ],
      return: [
        "Good to see you again. Our repeat images make the trend clearer, but recovery remains gradual and uncertain.",
      ],
    },
  },
  {
    id: "conversation-sunpatch-inez",
    townId: "sunpatch-cay",
    npcId: "sunpatch-gardener",
    lines: {
      intro: [
        "Welcome to my reef garden! I'm Inez. I help trained nursery teams care for corals selected through monitoring, not guesswork.",
        "A nursery can support restoration work, but it cannot cool the ocean or make every damaged colony recover. Shall we compare Coral Garden strategies in a 10 VP duel?",
      ],
      rematch: [
        "Welcome back! My nursery deck has grown a little differently today.",
        "Would you like another 10 VP Coral Garden duel?",
      ],
      victory: [
        "Beautifully planned! You built the support your reef needed before reaching for the finish.",
        "Bring that same patience to the investigation: monitor first, then let evidence guide any nursery work.",
      ],
      return: [
        "The nursery team is reviewing the monitoring record. We are caring for selected corals, not claiming the whole reef has been repaired.",
      ],
    },
  },
  {
    id: "conversation-sunpatch-bo",
    townId: "sunpatch-cay",
    npcId: "sunpatch-surveyor",
    lines: {
      intro: [
        "Hello there! I'm Bo, the cay's mooring steward and reef surveyor.",
        "Heat stress reaches far beyond our harbor, while anchors and sediment are local pressures we can reduce here. Want to test your reef against my Stinging Fortress deck?",
      ],
      rematch: [
        "The marked moorings are holding, and my reef strategy is ready for another survey.",
        "How about another 10 VP duel?",
      ],
      victory: [
        "Strong work! You found a safe route through a crowded reef board.",
        "I'll help the town strengthen the no-anchor markers. That can prevent avoidable damage, but it does not remove the warming threat.",
      ],
      return: [
        "Fewer boats crossed the monitored patch this week. That is useful progress, even while the reef still needs long-term observation.",
      ],
    },
  },
  {
    id: "conversation-sunpatch-nia",
    townId: "sunpatch-cay",
    npcId: "sunpatch-leader",
    lines: {
      intro: [
        "Welcome to Tide Hall. I'm Nia, Sunpatch's Tide Steward.",
        "Complete the reef investigation and speak with our residents first. Then your evidence—and a 10 VP qualification duel—can earn Sunpatch's Tide Mark.",
      ],
      rematch: [
        "Welcome back, Tidekeeper. Your Sunpatch Tide Mark is secure.",
        "We can replay the 10 VP qualifier, or you can try our optional 30 VP full-game exhibition.",
      ],
      victory: [
        "Congratulations! You supported your conclusions with evidence and built a winning reef.",
        "The Sunpatch Tide Mark is yours, along with a Coral Pack. Our community will keep monitoring; no single duel or field day solves an ecosystem challenge.",
      ],
      exhibition: [
        "A 30 VP exhibition asks your deck to sustain its plan over a full match. It is optional, carries no story reward, and a loss never removes progress.",
      ],
      return: [
        "Welcome back to Sunpatch. Monitoring has improved and anchor crossings are down, but some patches remain pale and recovery is uncertain.",
      ],
    },
  },
];

const npcs = [
  {
    id: "academy-mentor",
    townId: "shellshore-village",
    sceneId: "academy-lab",
    roleId: "mentor",
    name: "Professor Marlow Current",
    title: "Harbor Ecologist",
    color: "teal",
    crest: "Harbor Star",
    conversationId: "conversation-shellshore-academy-mentor",
    encounterId: "encounter-shellshore-mentor-practice",
  },
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
  {
    id: "sunpatch-tavi",
    townId: "sunpatch-cay",
    sceneId: "sunpatch-cay-town",
    roleId: "local-guide",
    name: "Tavi",
    title: "Cay Guide",
    color: "teal",
    crest: null,
    conversationId: "conversation-sunpatch-tavi",
    encounterId: null,
  },
  {
    id: "sunpatch-mira",
    townId: "sunpatch-cay",
    sceneId: "sunpatch-field-station",
    roleId: "field-partner",
    name: "Dr. Mira Sol",
    title: "Reef Monitor",
    color: "teal",
    crest: null,
    conversationId: "conversation-sunpatch-mira",
    encounterId: null,
  },
  {
    id: "sunpatch-gardener",
    townId: "sunpatch-cay",
    sceneId: "sunpatch-garden-home",
    roleId: "resident",
    name: "Inez",
    title: "Nursery Gardener",
    color: "coral",
    crest: "Nursery Ribbon",
    conversationId: "conversation-sunpatch-inez",
    encounterId: "encounter-sunpatch-resident-gardener",
  },
  {
    id: "sunpatch-surveyor",
    townId: "sunpatch-cay",
    sceneId: "sunpatch-cay-town",
    roleId: "town-challenger",
    name: "Bo",
    title: "Mooring Steward",
    color: "blue",
    crest: "Mooring Ribbon",
    conversationId: "conversation-sunpatch-bo",
    encounterId: "encounter-sunpatch-resident-surveyor",
  },
  {
    id: "sunpatch-leader",
    townId: "sunpatch-cay",
    sceneId: "sunpatch-tide-hall",
    roleId: "reflection-character",
    name: "Nia",
    title: "Tide Steward",
    color: "gold",
    crest: "Sunpatch Tide Mark",
    conversationId: "conversation-sunpatch-nia",
    encounterId: "encounter-sunpatch-qualifier",
    exhibitionEncounterId: "encounter-sunpatch-exhibition",
  },
];

const starterDecks = [
  {
    id: "coral-garden",
    deckId: "coral-garden",
    name: "Coral Garden",
    habitat: "Coral Reef",
    color: "coral",
    tagline: "Grow a lively reef together.",
    summary: "Build sturdy coral homes, connect reef neighbors, and turn a thriving community into VP.",
    playStyle: "Patient building and creature teamwork",
    difficulty: "beginner",
    strengths: ["Reliable habitats", "Connected creature bonuses", "Steady VP growth"],
    watchFor: "Plan where each reef creature will live before spending RP.",
    metrics: { offense: 3, defense: 4, economy: 4, consistency: 5, tempo: 3 },
  },
  {
    id: "murky-water",
    deckId: "murky-water",
    name: "Murky Water",
    habitat: "Estuary & Mangrove",
    color: "mangrove",
    tagline: "Adapt as the water changes.",
    summary: "Use flexible estuary species, clever card movement, and changing conditions to stay one step ahead.",
    playStyle: "Flexible choices and resource control",
    difficulty: "beginner",
    strengths: ["Flexible responses", "Efficient RP use", "Strong recovery"],
    watchFor: "Keep options in hand so you can answer the next change.",
    metrics: { offense: 3, defense: 3, economy: 5, consistency: 4, tempo: 4 },
  },
  {
    id: "blue-water",
    deckId: "blue-water",
    name: "Blue Water",
    habitat: "Open Ocean",
    color: "blue",
    tagline: "Move quickly with the current.",
    summary: "Gather open-ocean travelers, draw into new opportunities, and press the advantage with fast attacks.",
    playStyle: "Quick draws and active attacking",
    difficulty: "beginner",
    strengths: ["Fast starts", "Extra card access", "Direct pressure"],
    watchFor: "Balance quick attacks with enough RP to rebuild.",
    metrics: { offense: 5, defense: 3, economy: 3, consistency: 4, tempo: 5 },
  },
];

const tutorials = [
  {
    id: "tutorial-shellshore-live-basics",
    townId: "shellshore-village",
    sceneId: "academy-lab",
    questId: "quest-shellshore-first-voyage",
    mentorNpcId: "academy-mentor",
    practiceEncounterId: "encounter-shellshore-mentor-practice",
    completionRewardId: "reward-shellshore-tutorial",
    fieldNoteId: "field-note-harbor-basics",
    starterDeckIds: starterDecks.map((starter) => starter.id),
    victoryTarget: 26,
    ordered: true,
    allowRetry: true,
    allowExit: true,
    resumePolicy: "last-completed-checkpoint",
    checkpoints: [
      { id: "tutorial-setup", actionType: "match-ready", title: "Ready your ecosystem", instruction: "Set out your deck, hand, RP bank, and play areas." },
      { id: "tutorial-collect-rp", actionType: "rp-collected", title: "Collect RP", instruction: "Collect Resource Points (RP), the energy used to play cards." },
      { id: "tutorial-draw-card", actionType: "card-drawn", title: "Draw a card", instruction: "Draw a card so you have a new option for this turn." },
      { id: "tutorial-build-card", actionType: "card-built", title: "Add to your ecosystem", instruction: "Spend RP to play a habitat, foundation, or creature." },
      { id: "tutorial-attack", actionType: "attack-resolved", title: "Make an attack", instruction: "Choose a legal attacker and resolve one attack." },
      { id: "tutorial-end-turn", actionType: "turn-ended", title: "End your turn", instruction: "End your turn after checking your hand, board, and RP." },
      { id: "tutorial-earn-vp", actionType: "vp-earned", title: "Earn VP", instruction: "Earn Victory Points (VP) by growing a successful ecosystem." },
    ],
  },
];

const fieldNotes = [
  {
    id: "field-note-harbor-basics",
    title: "Harbor Habitats & Safe Boating",
    habitatId: "harbor-lagoon",
    status: "prototype",
    summary: "A habitat is an organism's home. An ecosystem includes living things, nonliving conditions, and the relationships among them.",
    observations: [
      "Shellshore Harbor contains several connected habitats, including rocky shore, dock pilings, shallow sand, and sheltered lagoon water.",
      "Light, temperature, water movement, shelter, food, and other organisms can all shape where a species lives.",
      "One observation is a clue, not a complete conclusion. Compare places and conditions before deciding what a pattern means.",
    ],
    safetyChecklist: [
      "Wear a life jacket and check weather and route conditions before leaving the dock.",
      "Tell the dock team your route and stay inside marked channels.",
      "Slow down near wildlife and shallow habitat, keep a respectful distance, and bring all gear home.",
    ],
    glossary: [
      { term: "Habitat", definition: "The place where an organism lives and finds what it needs." },
      { term: "Ecosystem", definition: "Living things, nonliving conditions, and their relationships in a place." },
      { term: "Observation", definition: "Information noticed or measured without guessing what caused it." },
    ],
  },
  {
    id: "field-note-coral-observations",
    title: "Reading a Reef",
    habitatId: "coral-reef",
    status: "prototype",
    summary: "Bleaching, a tissue-loss lesion, and algae-covered exposed skeleton are different observations. Record evidence before naming a cause, and choose responses that are useful without promising an instant cure.",
    observations: [
      "Pigmented living tissue provides a comparison, but one healthy-looking image does not prove that no stress exists.",
      "Pale or translucent tissue may still be alive. Bleaching is a stress response, not another word for dead coral.",
      "A lesion describes a visible change such as tissue loss. Its shape, edge, location, and repeat appearance can be recorded without diagnosing a disease from sight alone.",
      "Algae on exposed skeleton shows that tissue was lost in that area earlier. It does not establish the cause or prove that the entire colony is dead.",
      "Repeat photographs, local temperature trends, water clarity, time, location, and resident observations provide stronger evidence together than any single clue.",
    ],
    checklistTitle: "Reef field practice",
    checklist: [
      "Use an established mooring or marked no-anchor area; never anchor on coral habitat.",
      "Observe without touching coral or stirring sediment, and give wildlife space.",
      "Take repeat photographs from the same marked position and record the time and local conditions.",
      "Report what is visible and measured. Leave disease assessment and nursery decisions to trained teams.",
    ],
    glossary: [
      { term: "Bleaching", definition: "A stress response in which coral loses much of the symbiotic algae that normally supplies color and energy; bleached tissue may still be alive." },
      { term: "Lesion", definition: "A visible area of changed, damaged, or missing tissue described without assuming its cause." },
      { term: "Substrate", definition: "The surface on which an organism lives or grows, such as exposed coral skeleton." },
      { term: "Resilience", definition: "The ability of an ecosystem to resist or recover from stress while its community continues monitoring change." },
    ],
    sourceUrls: [
      "https://oceanservice.noaa.gov/facts/coral_bleach.html",
      "https://cdhc.noaa.gov/coral-disease/lesion-terminology/",
      "https://oceanservice.noaa.gov/facts/reef-resilience.html",
      "https://www.fisheries.noaa.gov/national/habitat-conservation/shallow-coral-reef-habitat",
    ],
  },
  { id: "field-note-estuary-conditions", title: "Changing Estuary Water", habitatId: "estuary-mangrove", status: "planned" },
  { id: "field-note-current-connections", title: "Connected by Currents", habitatId: "open-ocean", status: "planned" },
  { id: "field-note-kelp-food-web", title: "A Kelp Forest Food Web", habitatId: "kelp-forest", status: "planned" },
  { id: "field-note-deep-adaptations", title: "Life in the Deep", habitatId: "deep-ocean-trench", status: "planned" },
  { id: "field-note-archipelago-reflection", title: "Archipelago Reflections", habitatId: "archipelago-synthesis", status: "planned" },
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
  {
    id: "dialogue-sunpatch-reef-response",
    townId: "sunpatch-cay",
    questId: "quest-sunpatch-reef-response",
    beats: [
      {
        id: "hook",
        speakerRoleId: "local-guide",
        speakerNpcId: "sunpatch-tavi",
        lines: ["Some reef patches have gone pale, and another has visible tissue loss. Let us gather evidence before deciding why."],
      },
      {
        id: "observation",
        speakerRoleId: "field-partner",
        speakerNpcId: "sunpatch-mira",
        lines: ["Compare living tissue, color, lesion shape, algae-covered skeleton, repeat images, and local condition trends at all four stations."],
      },
      {
        id: "interpretation",
        speakerRoleId: "field-partner",
        speakerNpcId: "sunpatch-mira",
        lines: ["Bleaching may leave living tissue pale. A lesion describes visible change, while algae-covered exposed skeleton records older tissue loss in that area."],
      },
      {
        id: "decision",
        speakerRoleId: "field-partner",
        speakerNpcId: "sunpatch-mira",
        lines: ["Choose a response tied to the evidence and honest about what local action can and cannot change."],
      },
      {
        id: "community-action",
        speakerRoleId: "local-guide",
        speakerNpcId: "sunpatch-tavi",
        lines: ["The town will maintain repeat-photo stations, strengthen mooring protection, and reduce supported local sources of sediment or excess nutrients."],
      },
      {
        id: "duel",
        speakerRoleId: "town-challenger",
        speakerNpcId: "sunpatch-surveyor",
        lines: ["Our resident duels test whether your deck can build a resilient plan; they do not mean the reef challenge has been defeated."],
      },
      {
        id: "debrief",
        speakerRoleId: "field-partner",
        speakerNpcId: "sunpatch-mira",
        lines: ["Reducing avoidable local stress can support resilience, but it does not replace action on ocean warming or guarantee recovery."],
      },
      {
        id: "reflection",
        speakerRoleId: "reflection-character",
        speakerNpcId: "sunpatch-leader",
        lines: ["Explain what the observations support, what remains uncertain, and why the community will keep monitoring."],
      },
      {
        id: "callback",
        speakerRoleId: "reflection-character",
        speakerNpcId: "sunpatch-leader",
        lines: ["At Kelpwatch, remember that heat and food-web changes can interact, just as local and global pressures interact here."],
      },
    ],
  },
  dialoguePlan("dialogue-brackwater-water-clues", "brackwater-landing", "quest-brackwater-water-clues", REQUIRED_ECOSYSTEM_NPC_ROLES),
  dialoguePlan("dialogue-current-ghost-gear", "current-commons", "quest-current-ghost-gear", REQUIRED_ECOSYSTEM_NPC_ROLES),
  dialoguePlan("dialogue-kelpwatch-balance", "kelpwatch-island", "quest-kelpwatch-balance", REQUIRED_ECOSYSTEM_NPC_ROLES),
  dialoguePlan("dialogue-trenchlight-sensor", "trenchlight-station", "quest-trenchlight-sensor", REQUIRED_ECOSYSTEM_NPC_ROLES),
  dialoguePlan("dialogue-champions-wake", "champions-wake", "quest-champions-wake", ["tournament-director", "reflection-character", "tournament-director", "reflection-character", "reflection-character"]),
];

const encounters = [
  { id: "encounter-shellshore-mentor-practice", townId: "shellshore-village", questId: "quest-shellshore-first-voyage", tutorialId: "tutorial-shellshore-live-basics", role: "practice", opponentId: "academy-mentor", opponentDeckId: "coral-garden", victoryTarget: 26, difficulty: "easy", rewardId: "reward-shellshore-tutorial" },
  { id: "encounter-shellshore-marina", townId: "shellshore-village", questId: "quest-shellshore-first-voyage", role: "resident", opponentId: "marina", opponentDeckId: "coral-garden", victoryTarget: 10, difficulty: "easy", rewardId: "reward-shellshore-marina-first-win" },
  { id: "encounter-shellshore-dorian", townId: "shellshore-village", questId: "quest-shellshore-first-voyage", role: "resident", opponentId: "dorian", opponentDeckId: "darkness-shroud", victoryTarget: 10, difficulty: "medium", rewardId: null },
  { id: "encounter-sunpatch-resident-gardener", townId: "sunpatch-cay", questId: "quest-sunpatch-reef-response", role: "resident", opponentId: "sunpatch-gardener", opponentDeckId: "coral-garden", victoryTarget: 10, difficulty: "easy", rewardId: null },
  { id: "encounter-sunpatch-resident-surveyor", townId: "sunpatch-cay", questId: "quest-sunpatch-reef-response", role: "resident", opponentId: "sunpatch-surveyor", opponentDeckId: "stinging-fortress", victoryTarget: 10, difficulty: "easy-medium", rewardId: null },
  { id: "encounter-sunpatch-qualifier", townId: "sunpatch-cay", questId: "quest-sunpatch-reef-response", role: "qualifier", opponentId: "sunpatch-leader", opponentDeckId: "coral-garden", victoryTarget: 10, difficulty: "medium", rewardId: "reward-sunpatch-qualifier", prerequisites: [{ type: "questStatus", questId: "quest-sunpatch-reef-response", status: "complete" }] },
  { id: "encounter-sunpatch-exhibition", townId: "sunpatch-cay", questId: "quest-sunpatch-reef-response", role: "exhibition", opponentId: "sunpatch-leader", opponentDeckId: "coral-garden", victoryTarget: 30, difficulty: "medium", rewardId: null, prerequisites: [{ type: "encounterComplete", encounterId: "encounter-sunpatch-qualifier" }] },
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
  { id: "reward-shellshore-marina-first-win", grantId: "reward-shellshore-marina-first-win", packs: { "pack-pool-shellshore-discovery": 1 } },
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
  {
    id: "pack-pool-shellshore-discovery",
    name: "Shellshore Discovery Pack",
    version: 1,
    theme: "Harbor lagoon relationships",
    status: "playable",
    purchaseMode: "earned-only",
    cardsPerPack: 4,
    progressionGuarantee: "at-least-one-unowned-card-when-eligible",
    cardIds: [
      "nudibranch",
      "sea-urchin",
      "cleaner-shrimp",
      "emerald-crab",
      "pillar-coral-base",
      "lettuce-coral-base",
      "fairy-parrotfish",
      "picasso-triggerfish",
      "spanish-hogfish",
      "great-barracuda",
      "coral-gardener",
    ],
  },
  {
    id: "pack-pool-sunpatch-coral",
    name: "Sunpatch Coral Pack",
    version: 1,
    theme: "Coral reef relationships",
    status: "playable",
    purchaseMode: "earned-only",
    cardsPerPack: 4,
    progressionGuarantee: "at-least-one-unowned-card-when-eligible",
    cardIds: [
      "boulder-star-coral-base",
      "elkhorn-coral-base",
      "clubfinger-coral-base",
      "lettuce-coral-base",
      "mustard-hill-coral-base",
      "coral-reef",
      "coral-gardener",
      "coral-heal",
      "coral-cement",
      "cleaner-shrimp",
      "emerald-crab",
      "spectacled-parrotfish",
    ],
  },
  ["pack-pool-brackwater-murky", "Brackwater Discovery Pack", "Estuary and mangrove relationships"],
  ["pack-pool-current-bluewater", "Current Commons Pack", "Open-ocean food webs"],
  ["pack-pool-kelpwatch", "Kelpwatch Discovery Pack", "Kelp-forest food webs"],
  ["pack-pool-trenchlight-deep", "Trenchlight Discovery Pack", "Deep-ocean adaptations"],
].map((definition) => (Array.isArray(definition) ? {
  id: definition[0],
  name: definition[1],
  version: 1,
  theme: definition[2],
  status: "planned",
  purchaseMode: "earned-only",
  cardsPerPack: 4,
  progressionGuarantee: "at-least-one-unowned-card-when-eligible",
  cardIds: [],
} : definition));

const routes = [
  {
    id: "route-shellshore-sunpatch",
    fromTownId: "shellshore-village",
    toTownId: "sunpatch-cay",
    sceneId: "shellshore-sunpatch-sea",
    fromDockId: "shellshore-dock",
    toDockId: "sunpatch-dock",
    fromSpawn: { x: 1, y: 5, facing: "right" },
    toSpawn: { x: 14, y: 5, facing: "left" },
    manualPilotRequiredFirstTime: true,
    autoSteerAfterFirstCompletion: true,
  },
  ...[
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
  })),
];

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
  starterDecks,
  tutorials,
  fieldNotes,
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

export function getAdventureRoute(routeId, content = ADVENTURE_CONTENT) {
  return findContentById(content.routes, routeId);
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

export function getAdventureStarterDeck(starterDeckId, content = ADVENTURE_CONTENT) {
  return findContentById(content.starterDecks, starterDeckId);
}

export function getAdventureTutorial(tutorialId, content = ADVENTURE_CONTENT) {
  return findContentById(content.tutorials, tutorialId);
}

export function getAdventureFieldNote(fieldNoteId, content = ADVENTURE_CONTENT) {
  return findContentById(content.fieldNotes, fieldNoteId);
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

export function resolveAdventureTutorial(tutorialId, content = ADVENTURE_CONTENT) {
  const tutorial = getAdventureTutorial(tutorialId, content);
  if (!tutorial) return null;
  return {
    ...tutorial,
    mentor: resolveAdventureNpc(tutorial.mentorNpcId, content),
    practiceEncounter: getAdventureEncounter(tutorial.practiceEncounterId, content),
    starterDecks: tutorial.starterDeckIds
      .map((starterDeckId) => getAdventureStarterDeck(starterDeckId, content))
      .filter(Boolean),
    fieldNote: getAdventureFieldNote(tutorial.fieldNoteId, content),
  };
}

export function resolveAdventureInteraction(sceneId, interactionId, content = ADVENTURE_CONTENT) {
  const interaction = getAdventureSceneInteraction(sceneId, interactionId, content);
  if (!interaction) return null;
  if (interaction.type === "trainer" || interaction.type === "npc") {
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
