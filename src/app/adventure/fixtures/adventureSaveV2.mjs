function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const VICTORY_SUMMARY = {
  outcome: "victory",
  completionReason: "vp-target",
  playerDeckId: "deck-legacy-hybrid",
  playerDeckFingerprint: "deck-v1-0123456789abcdef",
  opponentId: "trainer-marina",
  playerVp: 10,
  opponentVp: 6,
  targetVp: 10,
  round: 4,
  turn: 9,
};

/**
 * Representative full schema-v2 save. Non-default sentinels in every domain
 * make accidental resets, rewards, relocation, or opening replay observable.
 */
export const ADVENTURE_SAVE_V2_FIXTURE = deepFreeze({
  schemaVersion: 2,
  profileId: "profile-1",
  player: {
    starterDeckId: "coral-garden",
    activeDeckId: "deck-legacy-hybrid",
  },
  world: {
    townId: "shellshore-village",
    sceneId: "deep-home",
    position: { x: 11.75, y: 8.5 },
    facing: "up",
    lastSafeDockId: "shellshore-dock",
    unlockedRouteIds: ["route-shellshore-sunpatch", "route-sunpatch-brackwater"],
    completedRouteIds: ["route-shellshore-sunpatch"],
  },
  progression: {
    quests: {
      "quest-shellshore-first-voyage": {
        status: "readyToTurnIn",
        flags: {
          "world-introduction-complete": false,
          "live-tutorial-complete": true,
          "boat-safety-reviewed": true,
          "fishing-tutorial-started": true,
          "fishing-tutorial-complete": true,
          "fishing-total-caught": 7,
          "fishing-total-delivered": 3,
          "matching-card-awarded-blue-crab": 1,
          "legacy-v2-sentinel": "preserve-me",
        },
      },
      "quest-sunpatch-reef-response": {
        status: "complete",
        flags: { "survey-count": 4 },
      },
    },
    npcStates: {
      "npc-fisherman-wyeth": "lesson-complete",
      "npc-mr-easterling": "cataloguing",
    },
    completedEncounterIds: [
      "encounter-shellshore-marina",
      "encounter-sunpatch-qualifier",
    ],
    encounterResults: {
      "encounter-shellshore-marina": {
        attempts: 2,
        latest: { ...VICTORY_SUMMARY },
        firstVictory: { ...VICTORY_SUMMARY },
      },
    },
    tideMarkIds: ["tide-mark-shellshore", "tide-mark-sunpatch"],
    tournament: {
      status: "active",
      activeRoundId: "round-shellshore-final",
      completedRoundIds: ["round-shellshore-one"],
      lockedDeckSnapshot: {
        id: "deck-legacy-hybrid",
        name: "Legacy Hybrid",
        cards: [
          { cardId: "blue-crab", quantity: 1 },
          { cardId: "white-grunt", quantity: 2 },
        ],
        fingerprint: "deck-v1-0123456789abcdef",
      },
      roundAttemptBaselines: { "round-shellshore-final": 2 },
      roundVictoryAttemptCounts: { "round-shellshore-one": 1 },
    },
  },
  inventory: {
    cards: {
      "blue-crab": 2,
      "queen-angelfish": 1,
      "white-grunt": 4,
    },
    unopenedPacks: { "pack-pool-shellshore-reef": 2 },
    storyItems: {
      "aquarium-blue-crab": 1,
      "caught-blue-crab": 2,
      "coral-crest": 1,
    },
    boatItems: {
      "wyeths-fishing-rod": 1,
      "shellshore-chart": 1,
    },
  },
  savedDecks: {
    "deck-legacy-deep": {
      name: "Legacy Deep",
      cards: { "queen-angelfish": 1 },
    },
    "deck-legacy-hybrid": {
      name: "Legacy Hybrid",
      cards: { "blue-crab": 1, "white-grunt": 2 },
    },
  },
  tutorial: {
    status: "complete",
    completedStepIds: [
      "tutorial-draw-opening-hand",
      "tutorial-play-habitat",
      "tutorial-play-creature",
    ],
  },
  fieldNotes: {
    entryIds: ["field-note-shellshore-coral", "field-note-sunpatch-bleaching"],
  },
  settings: {
    textSpeed: "instant",
    reducedMotion: true,
    highContrast: true,
    boatAutoSteer: true,
  },
  playtimeSeconds: 9876,
  rewardLedger: [
    "reward-shellshore-marina-first-win",
    "reward-elverson-fishing-rod",
    "reward-matching-card-blue-crab",
  ],
});
