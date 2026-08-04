function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * Representative canonical save written before route-completion and encounter-
 * result provenance were added in schema v2. This fixture is deliberately
 * independent of the current save factory so it cannot drift with new-game
 * defaults.
 */
export const ADVENTURE_SAVE_V1_FIXTURE = deepFreeze({
  schemaVersion: 1,
  profileId: "profile-1",
  player: {
    starterDeckId: "coral-garden",
    activeDeckId: "deck-legacy-reef",
  },
  world: {
    townId: "shellshore-village",
    sceneId: "coral-home",
    position: { x: 7.5, y: 4.25 },
    facing: "right",
    lastSafeDockId: "shellshore-dock",
    unlockedRouteIds: ["route-shellshore-sunpatch"],
  },
  progression: {
    quests: {
      "quest-shellshore-first-voyage": {
        status: "active",
        flags: {
          "world-introduction-complete": false,
          "legacy-v1-sentinel": "preserve-me",
        },
      },
    },
    npcStates: {
      "npc-mr-easterling": "introduced",
    },
    completedEncounterIds: ["encounter-shellshore-marina"],
    tideMarkIds: ["tide-mark-shellshore"],
    tournament: {
      status: "available",
      activeRoundId: null,
      completedRoundIds: [],
    },
  },
  inventory: {
    cards: { "white-grunt": 2 },
    unopenedPacks: { "pack-pool-shellshore-reef": 1 },
    storyItems: { "coral-crest": 1 },
    boatItems: { "shellshore-chart": 1 },
  },
  savedDecks: {
    "deck-legacy-reef": {
      name: "Legacy Reef",
      cards: { "white-grunt": 2 },
    },
  },
  tutorial: {
    status: "active",
    completedStepIds: ["tutorial-draw-opening-hand"],
  },
  fieldNotes: {
    entryIds: ["field-note-shellshore-coral"],
  },
  settings: {
    textSpeed: "fast",
    reducedMotion: true,
    highContrast: false,
    boatAutoSteer: true,
  },
  playtimeSeconds: 321,
  rewardLedger: ["reward-shellshore-marina-first-win"],
});
