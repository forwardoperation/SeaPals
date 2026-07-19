import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVENTURE_CONTENT,
  getAdventureRoute,
  resolveAdventureInteraction,
} from "./adventureContent.mjs";
import { validateAdventureContent } from "./adventureContentValidation.mjs";
import {
  createInitialAdventureSave,
  normalizeAdventureSave,
  setQuestFlag,
  validateAdventureSave,
} from "./adventureProgression.mjs";
import {
  enterAdventureScene,
  isAdventureEncounterAvailable,
  recoverAdventureResume,
} from "./adventureSession.mjs";
import { createAdventureStorageAdapter } from "./adventureStorage.mjs";
import {
  CHAMPIONS_WAKE_QUEST_ID,
  CHAMPIONS_WAKE_REQUIRED_FIELD_NOTE_IDS,
  CHAMPIONS_WAKE_REQUIRED_TIDE_MARK_IDS,
  CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS,
  CHAMPIONS_WAKE_TOURNAMENT_VICTORY_TARGET,
  getChampionsWakeTournamentAvailability,
  getChampionsWakeTournamentLaunch,
  getChampionsWakeTournamentProgress,
  recordChampionsWakeTournamentResult,
  registerChampionsWakeTournament,
} from "./adventureTournament.mjs";
import {
  boardAdventureRoute,
  dockAdventureRoute,
  getRouteTravelState,
} from "./adventureTravel.mjs";

const ROUTE_ID = "route-trenchlight-champions-wake";
const REGISTRATION_SCENE_ID = "champions-wake-registration-hall";
const REGISTRATION_INTERACTION_ID = "interaction-champions-wake-director";
const CHAMPIONSHIP_REWARD_ID = "reward-tournament-champion";
const CHAMPIONSHIP_STORY_ITEM_ID = "seapals-championship-cup";
const CHAMPIONSHIP_FIELD_NOTE_ID = "field-note-archipelago-reflection";

function cardId(number) {
  return `champions-loop-card-${String(number).padStart(2, "0")}`;
}

function syntheticCatalog() {
  return Object.fromEntries(Array.from({ length: 15 }, (_, index) => {
    const id = cardId(index + 1);
    return [id, {
      id,
      name: `Champions Loop Card ${index + 1}`,
      kind: index < 2 ? "coral" : "creature",
      stage: index < 2 ? 0 : 1,
      victoryPoints: { value: 1 },
    }];
  }));
}

function legalDeckCards() {
  return Object.fromEntries(Array.from({ length: 15 }, (_, index) => [
    cardId(index + 1),
    4,
  ]));
}

function resultForLaunch(launch) {
  return {
    contractVersion: 1,
    encounterId: launch.encounterId,
    outcome: "victory",
    winner: "player",
    completionReason: "vp-target",
    scores: {
      playerVp: CHAMPIONS_WAKE_TOURNAMENT_VICTORY_TARGET,
      opponentVp: 24,
      targetVp: launch.victoryTarget,
    },
    playerDeckId: launch.playerDeckSnapshot.id,
    playerDeckFingerprint: launch.playerDeckSnapshot.fingerprint,
    opponent: {
      id: launch.opponentId,
      deckId: launch.opponentDeckId,
    },
    round: 11,
    turn: 21,
    message: "You reached 30 VP.",
  };
}

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function saveAndReload(adapter, save, checkpointId) {
  const written = adapter.autosave(save.profileId, save, checkpointId);
  assert.equal(written.ok, true, written.error?.message);
  assert.equal(written.checkpointId, checkpointId);

  const loaded = adapter.loadProfile(save.profileId);
  assert.equal(loaded.ok, true, loaded.error?.message);
  assert.equal(loaded.metadata.checkpointId, checkpointId);
  const resumed = recoverAdventureResume(loaded.save);
  assert.equal(resumed.fallback, null);
  assert.equal(validateAdventureSave(resumed.save).valid, true);
  return resumed.save;
}

test("Champion's Wake supports arrival, registration, three persisted 30 VP wins, and exact-once completion", () => {
  assert.equal(validateAdventureContent(ADVENTURE_CONTENT).valid, true);
  const route = getAdventureRoute(ROUTE_ID);
  assert.ok(route);

  const cards = legalDeckCards();
  let save = createInitialAdventureSave("profile-1");
  save = normalizeAdventureSave({
    ...save,
    player: {
      ...save.player,
      activeDeckId: "championship-deck",
    },
    world: {
      ...save.world,
      townId: route.fromTownId,
      sceneId: "trenchlight-station-town",
      position: { x: 8, y: 8 },
      facing: "up",
      lastSafeDockId: route.fromDockId,
      unlockedRouteIds: [ROUTE_ID],
    },
    inventory: {
      ...save.inventory,
      cards: { ...cards },
    },
    savedDecks: {
      "championship-deck": {
        name: "Archipelago Team",
        cards: { ...cards },
      },
    },
    progression: {
      ...save.progression,
      tideMarkIds: [...CHAMPIONS_WAKE_REQUIRED_TIDE_MARK_IDS],
    },
    fieldNotes: {
      ...save.fieldNotes,
      entryIds: [...CHAMPIONS_WAKE_REQUIRED_FIELD_NOTE_IDS],
    },
  });

  const travel = getRouteTravelState(save, ROUTE_ID);
  assert.equal(travel.runtimeReady, true);
  assert.equal(travel.endpointSide, "from");
  assert.equal(travel.canBoardManual, true);

  save = boardAdventureRoute(save, {
    routeId: ROUTE_ID,
    originDockId: route.fromDockId,
  });
  assert.equal(save.world.sceneId, "trenchlight-champions-wake-sea");
  save = normalizeAdventureSave({
    ...save,
    world: {
      ...save.world,
      position: { x: 14, y: 5 },
      facing: "right",
    },
  });
  save = dockAdventureRoute(save, {
    routeId: ROUTE_ID,
    destinationDockId: route.toDockId,
  });
  assert.equal(save.world.townId, "champions-wake");
  assert.equal(save.world.sceneId, "champions-wake-town");
  assert.equal(save.world.lastSafeDockId, "champions-wake-dock");
  assert.ok(save.world.completedRouteIds.includes(ROUTE_ID));
  assert.equal(
    save.progression.quests[CHAMPIONS_WAKE_QUEST_ID]?.status ?? "notStarted",
    "notStarted",
  );

  save = enterAdventureScene(save, {
    sceneId: REGISTRATION_SCENE_ID,
    position: { x: 5, y: 6 },
    facing: "up",
  });
  const registration = resolveAdventureInteraction(
    REGISTRATION_SCENE_ID,
    REGISTRATION_INTERACTION_ID,
  );
  assert.ok(registration);
  assert.equal(registration.tournamentAction, "registration");
  assert.equal(registration.questId, CHAMPIONS_WAKE_QUEST_ID);
  assert.deepEqual(
    registration.requiredTideMarkIds,
    CHAMPIONS_WAKE_REQUIRED_TIDE_MARK_IDS,
  );
  assert.equal(
    save.progression.quests[CHAMPIONS_WAKE_QUEST_ID]?.status,
    "active",
    "entering a safe non-route Champion's Wake scene must begin the final quest",
  );
  const availability = getChampionsWakeTournamentAvailability(save);
  assert.equal(availability.available, true);
  save = availability.save;

  const registered = registerChampionsWakeTournament(save, syntheticCatalog());
  assert.equal(registered.registered, true);
  assert.equal(registered.lockedDeckSnapshot.id, "championship-deck");
  const lockedFingerprint = registered.lockedDeckSnapshot.fingerprint;
  save = registered.save;

  const adapter = createAdventureStorageAdapter({
    backend: new MemoryStorage(),
    now: () => new Date("2026-07-18T18:00:00.000Z"),
  });
  save = saveAndReload(adapter, save, "champions-wake:registered");

  let finalResult = null;
  for (const [index, encounterId] of CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.entries()) {
    assert.deepEqual(isAdventureEncounterAvailable(save, encounterId), {
      available: true,
      reason: null,
    });
    const launch = getChampionsWakeTournamentLaunch(save);
    assert.equal(launch.encounterId, encounterId);
    assert.equal(launch.victoryTarget, CHAMPIONS_WAKE_TOURNAMENT_VICTORY_TARGET);
    assert.equal(launch.playerDeckSnapshot.fingerprint, lockedFingerprint);

    const result = resultForLaunch(launch);
    const recorded = recordChampionsWakeTournamentResult(save, result);
    assert.equal(recorded.applied, true);
    assert.equal(recorded.attemptRecorded, true);
    assert.equal(recorded.roundAdvanced, true);
    assert.equal(recorded.tournamentComplete, index === 2);
    save = saveAndReload(
      adapter,
      recorded.save,
      `champions-wake:round-${index + 1}-victory`,
    );
    if (index === 2) finalResult = result;
  }

  const progress = getChampionsWakeTournamentProgress(save);
  assert.equal(progress.complete, true);
  assert.equal(progress.status, "complete");
  assert.equal(progress.activeRoundId, null);
  assert.deepEqual(progress.completedRoundIds, CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS);
  assert.equal(save.progression.quests[CHAMPIONS_WAKE_QUEST_ID].status, "complete");

  for (const encounterId of CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS) {
    const evidence = save.progression.encounterResults[encounterId];
    assert.equal(evidence.attempts, 1);
    assert.equal(evidence.latest.targetVp, CHAMPIONS_WAKE_TOURNAMENT_VICTORY_TARGET);
    assert.equal(evidence.firstVictory.targetVp, CHAMPIONS_WAKE_TOURNAMENT_VICTORY_TARGET);
    assert.equal(evidence.firstVictory.playerDeckFingerprint, lockedFingerprint);
  }
  assert.equal(save.inventory.storyItems[CHAMPIONSHIP_STORY_ITEM_ID], 1);
  assert.equal(
    save.fieldNotes.entryIds.filter((id) => id === CHAMPIONSHIP_FIELD_NOTE_ID).length,
    1,
  );
  assert.equal(
    save.rewardLedger.filter((id) => id === CHAMPIONSHIP_REWARD_ID).length,
    1,
  );
  for (const encounterId of CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS) {
    const beforeEnding = isAdventureEncounterAvailable(save, encounterId);
    assert.equal(beforeEnding.available, false);
    assert.match(beforeEnding.reason, /ceremony.*reflection.*practice/i);
  }

  for (const endingFlag of [
    "championship-ceremony-complete",
    "championship-epilogue-complete",
    "championship-credits-complete",
    "postgame-unlocked",
  ]) {
    save = setQuestFlag(save, CHAMPIONS_WAKE_QUEST_ID, endingFlag, true);
  }
  save = saveAndReload(adapter, save, "champions-wake:postgame-unlocked");
  for (const encounterId of CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS) {
    assert.deepEqual(isAdventureEncounterAvailable(save, encounterId), {
      available: true,
      reason: null,
      practiceOnly: true,
    });
  }

  const beforeDuplicate = structuredClone(save);
  const duplicate = recordChampionsWakeTournamentResult(save, finalResult);
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.attemptRecorded, false);
  assert.equal(duplicate.rewardApplied, false);
  assert.deepEqual(duplicate.save, beforeDuplicate);
  assert.equal(duplicate.save.inventory.storyItems[CHAMPIONSHIP_STORY_ITEM_ID], 1);
  assert.equal(
    duplicate.save.fieldNotes.entryIds.filter((id) => id === CHAMPIONSHIP_FIELD_NOTE_ID).length,
    1,
  );
});
