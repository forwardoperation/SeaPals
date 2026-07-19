import assert from "node:assert/strict";
import test from "node:test";

import {
  AdventureDeckLegalityError,
  fingerprintDeckCards,
} from "./adventureDecks.mjs";
import { AdventureDuelResultMismatchError } from "./adventureDuel.mjs";
import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import {
  createInitialAdventureSave,
  grantReward,
  normalizeAdventureSave,
  validateAdventureSave,
} from "./adventureProgression.mjs";
import {
  isAdventureEncounterAvailable,
  recordAdventureDuelResult,
} from "./adventureSession.mjs";
import { createAdventureStorageAdapter } from "./adventureStorage.mjs";
import {
  AdventureTournamentStateError,
  CHAMPIONS_WAKE_QUEST_ID,
  CHAMPIONS_WAKE_REQUIRED_FIELD_NOTE_IDS,
  CHAMPIONS_WAKE_REQUIRED_TIDE_MARK_IDS,
  CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS,
  CHAMPIONS_WAKE_TOURNAMENT_VICTORY_TARGET,
  getChampionsWakeTournamentAvailability,
  getChampionsWakeTournamentLaunch,
  getChampionsWakeTournamentProgress,
  getChampionsWakeTournamentRoundAvailability,
  recordChampionsWakeTournamentResult,
  recoverChampionsWakeTournamentState,
  registerChampionsWakeTournament,
} from "./adventureTournament.mjs";

const CHAMPIONSHIP_REWARD_ID = "reward-tournament-champion";
const CHAMPIONSHIP_STORY_ITEM_ID = "seapals-championship-cup";
const CHAMPIONSHIP_FIELD_NOTE_ID = "field-note-archipelago-reflection";

function cardId(number) {
  return `tournament-card-${String(number).padStart(2, "0")}`;
}

function syntheticCatalog() {
  return Object.fromEntries(Array.from({ length: 16 }, (_, index) => {
    const id = cardId(index + 1);
    return [id, {
      id,
      name: `Tournament Card ${index + 1}`,
      kind: index < 2 ? "coral" : "creature",
      stage: index < 2 ? 0 : 1,
      victoryPoints: { value: 1 },
    }];
  }));
}

function deckCards(start = 1) {
  return Object.fromEntries(Array.from({ length: 15 }, (_, index) => [
    cardId(start + index),
    4,
  ]));
}

function eligibleSave(profileId = "tournament-profile") {
  const save = createInitialAdventureSave(profileId);
  save.progression.quests[CHAMPIONS_WAKE_QUEST_ID] = {
    status: "active",
    flags: {},
  };
  save.progression.tideMarkIds = [...CHAMPIONS_WAKE_REQUIRED_TIDE_MARK_IDS];
  save.fieldNotes.entryIds = [...CHAMPIONS_WAKE_REQUIRED_FIELD_NOTE_IDS];
  save.inventory.cards = Object.fromEntries(
    Array.from({ length: 16 }, (_, index) => [cardId(index + 1), 4]),
  );
  save.savedDecks["wake-team"] = {
    name: "Wake Team",
    cards: deckCards(1),
  };
  save.savedDecks["alternate-team"] = {
    name: "Alternate Team",
    cards: deckCards(2),
  };
  save.player.activeDeckId = "wake-team";
  return normalizeAdventureSave(save);
}

function registeredSave(profileId = "tournament-profile") {
  return registerChampionsWakeTournament(
    eligibleSave(profileId),
    syntheticCatalog(),
  ).save;
}

function duelResult(launch, outcome = "victory", overrides = {}) {
  const victory = outcome === "victory";
  return {
    contractVersion: 1,
    encounterId: launch.encounterId,
    outcome,
    winner: victory ? "player" : "opponent",
    completionReason: "vp-target",
    scores: {
      playerVp: victory ? 30 : 14,
      opponentVp: victory ? 18 : 30,
      targetVp: launch.victoryTarget,
    },
    playerDeckId: launch.playerDeckSnapshot.id,
    playerDeckFingerprint: launch.playerDeckSnapshot.fingerprint,
    opponent: {
      id: launch.opponentId,
      deckId: launch.opponentDeckId,
    },
    round: 8,
    turn: 15,
    message: victory ? "You reached 30 VP." : "Your opponent reached 30 VP.",
    ...overrides,
  };
}

function winActiveRound(save) {
  const launch = getChampionsWakeTournamentLaunch(save);
  return recordChampionsWakeTournamentResult(save, duelResult(launch));
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

test("the tournament domain is bound to the three authored 30 VP encounters and final reward", () => {
  assert.equal(CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.length, 3);
  for (const [index, roundId] of CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.entries()) {
    const encounter = ADVENTURE_CONTENT.encounters.find(({ id }) => id === roundId);
    assert.ok(encounter, `Missing round ${roundId}.`);
    assert.equal(encounter.questId, CHAMPIONS_WAKE_QUEST_ID);
    assert.equal(encounter.role, "tournament");
    assert.equal(encounter.victoryTarget, CHAMPIONS_WAKE_TOURNAMENT_VICTORY_TARGET);
    assert.equal(encounter.rewardId, index === 2 ? CHAMPIONSHIP_REWARD_ID : null);
  }
});

test("availability requires the active quest, every Tide Mark, and every ecosystem Field Note", () => {
  const initial = getChampionsWakeTournamentAvailability(
    createInitialAdventureSave("availability-initial"),
  );
  assert.equal(initial.available, false);
  assert.equal(initial.reason, "quest-not-active");
  assert.deepEqual(initial.missingTideMarkIds, CHAMPIONS_WAKE_REQUIRED_TIDE_MARK_IDS);
  assert.deepEqual(initial.missingFieldNoteIds, CHAMPIONS_WAKE_REQUIRED_FIELD_NOTE_IDS);

  const eligible = getChampionsWakeTournamentAvailability(eligibleSave("availability-ready"));
  assert.equal(eligible.available, true);
  assert.equal(eligible.requirementsMet, true);
  assert.equal(eligible.save.progression.tournament.status, "available");

  for (const tideMarkId of CHAMPIONS_WAKE_REQUIRED_TIDE_MARK_IDS) {
    const save = eligibleSave(`missing-${tideMarkId}`);
    save.progression.tideMarkIds = save.progression.tideMarkIds.filter((id) => id !== tideMarkId);
    const result = getChampionsWakeTournamentAvailability(save);
    assert.equal(result.available, false);
    assert.equal(result.reason, "missing-tide-marks");
    assert.deepEqual(result.missingTideMarkIds, [tideMarkId]);
  }

  for (const fieldNoteId of CHAMPIONS_WAKE_REQUIRED_FIELD_NOTE_IDS) {
    const save = eligibleSave(`missing-${fieldNoteId}`);
    save.fieldNotes.entryIds = save.fieldNotes.entryIds.filter((id) => id !== fieldNoteId);
    // The Academy note is intentionally not one of the five ecosystem notes.
    save.fieldNotes.entryIds.push("field-note-harbor-basics");
    const result = getChampionsWakeTournamentAvailability(save);
    assert.equal(result.available, false);
    assert.equal(result.reason, "missing-field-notes");
    assert.deepEqual(result.missingFieldNoteIds, [fieldNoteId]);
  }

  for (const [index, status] of ["notStarted", "readyToTurnIn", "complete"].entries()) {
    const save = eligibleSave(`quest-status-${index}`);
    save.progression.quests[CHAMPIONS_WAKE_QUEST_ID].status = status;
    const result = getChampionsWakeTournamentAvailability(save);
    assert.equal(result.available, false);
    assert.equal(result.reason, "quest-not-active");
  }
});

test("registration rejects locked progress and illegal decks", () => {
  assert.throws(
    () => registerChampionsWakeTournament(
      createInitialAdventureSave("locked-registration"),
      syntheticCatalog(),
    ),
    (error) => error instanceof AdventureTournamentStateError
      && error.code === "TOURNAMENT_LOCKED",
  );

  const illegal = eligibleSave("illegal-registration");
  illegal.savedDecks["wake-team"].cards[cardId(15)] = 3;
  assert.throws(
    () => registerChampionsWakeTournament(illegal, syntheticCatalog()),
    (error) => error instanceof AdventureDeckLegalityError
      && error.validation.issues.some(({ code }) => code === "deck-size"),
  );
});

test("registration persists the exact legal active deck and is idempotent", () => {
  const source = eligibleSave("registration-snapshot");
  const expectedCards = deckCards(1);
  const registered = registerChampionsWakeTournament(source, syntheticCatalog());
  const snapshot = registered.save.progression.tournament.lockedDeckSnapshot;

  assert.equal(registered.registered, true);
  assert.equal(registered.activeRoundId, CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[0]);
  assert.deepEqual(
    registered.save.progression.tournament.roundAttemptBaselines,
    Object.fromEntries(CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.map((roundId) => [roundId, 0])),
  );
  assert.deepEqual(registered.save.progression.tournament.roundVictoryAttemptCounts, {});
  assert.deepEqual(snapshot, {
    id: "wake-team",
    name: "Wake Team",
    cards: Object.entries(expectedCards).map(([cardIdValue, quantity]) => ({
      cardId: cardIdValue,
      quantity,
    })),
    fingerprint: fingerprintDeckCards(expectedCards),
  });
  assert.equal(Object.isFrozen(registered.lockedDeckSnapshot), true);
  assert.equal(Object.isFrozen(registered.lockedDeckSnapshot.cards), true);
  assert.equal(registered.lockedDeckSnapshot.cards.every(Object.isFrozen), true);
  assert.equal(source.progression.tournament.lockedDeckSnapshot, null);

  const changed = normalizeAdventureSave({
    ...registered.save,
    player: { ...registered.save.player, activeDeckId: "alternate-team" },
    savedDecks: {
      ...registered.save.savedDecks,
      "wake-team": {
        name: "Edited After Registration",
        cards: deckCards(2),
      },
    },
  });
  const repeated = registerChampionsWakeTournament(changed, syntheticCatalog());
  assert.equal(repeated.registered, false);
  assert.equal(repeated.alreadyRegistered, true);
  assert.deepEqual(repeated.lockedDeckSnapshot, snapshot);
  assert.notEqual(
    repeated.lockedDeckSnapshot.fingerprint,
    fingerprintDeckCards(changed.savedDecks["wake-team"].cards),
  );
});

test("the shared encounter gate blocks unregistered, stale, and out-of-order tournament launches", () => {
  const eligible = eligibleSave("shared-round-gate");
  const quarterfinalId = CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[0];
  const semifinalId = CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[1];

  const beforeRegistration = getChampionsWakeTournamentRoundAvailability(
    eligible,
    quarterfinalId,
  );
  assert.equal(beforeRegistration.available, false);
  assert.equal(beforeRegistration.reason, "registration-required");
  assert.deepEqual(isAdventureEncounterAvailable(eligible, quarterfinalId), {
    available: false,
    reason: "Register a legal deck for the tournament before entering this round.",
  });

  let save = registerChampionsWakeTournament(eligible, syntheticCatalog()).save;
  assert.equal(
    getChampionsWakeTournamentRoundAvailability(save, quarterfinalId).available,
    true,
  );
  assert.equal(isAdventureEncounterAvailable(save, quarterfinalId).available, true);
  assert.equal(
    getChampionsWakeTournamentRoundAvailability(save, semifinalId).reason,
    "round-not-active",
  );
  assert.equal(isAdventureEncounterAvailable(save, semifinalId).available, false);

  save = winActiveRound(save).save;
  assert.equal(isAdventureEncounterAvailable(save, quarterfinalId).available, false);
  assert.equal(isAdventureEncounterAvailable(save, semifinalId).available, true);

  const stale = structuredClone(save);
  stale.progression.tournament.lockedDeckSnapshot.fingerprint = "deck-v1-0000000000000000";
  const staleGate = getChampionsWakeTournamentRoundAvailability(stale, semifinalId);
  assert.equal(staleGate.available, false);
  assert.equal(staleGate.reason, "invalid-locked-deck");
  assert.equal(isAdventureEncounterAvailable(stale, semifinalId).available, false);
});

test("canonical saves default, validate, sort, and round-trip the locked snapshot safely", () => {
  const legacyV2 = createInitialAdventureSave("old-v2-tournament");
  delete legacyV2.progression.tournament.lockedDeckSnapshot;
  delete legacyV2.progression.tournament.roundAttemptBaselines;
  delete legacyV2.progression.tournament.roundVictoryAttemptCounts;
  assert.equal(normalizeAdventureSave(legacyV2).progression.tournament.lockedDeckSnapshot, null);
  assert.deepEqual(normalizeAdventureSave(legacyV2).progression.tournament.roundAttemptBaselines, {});
  assert.deepEqual(
    normalizeAdventureSave(legacyV2).progression.tournament.roundVictoryAttemptCounts,
    {},
  );

  const registered = registeredSave("snapshot-roundtrip");
  const reloaded = normalizeAdventureSave(JSON.parse(JSON.stringify(registered)));
  assert.deepEqual(reloaded, registered);
  assert.equal(validateAdventureSave(reloaded).valid, true);

  const duplicateCard = structuredClone(registered);
  duplicateCard.progression.tournament.lockedDeckSnapshot.cards.push(
    { ...duplicateCard.progression.tournament.lockedDeckSnapshot.cards[0] },
  );
  assert.throws(() => normalizeAdventureSave(duplicateCard), /duplicates card identifier/);

  const malformedFingerprint = structuredClone(registered);
  malformedFingerprint.progression.tournament.lockedDeckSnapshot.fingerprint = "not-a-deck";
  assert.throws(() => normalizeAdventureSave(malformedFingerprint), /deck-v1/);
});

test("a loss records the attempt while preserving the current round and locked deck across reload", () => {
  const registered = registeredSave("loss-retry");
  const snapshot = structuredClone(registered.progression.tournament.lockedDeckSnapshot);
  const launch = getChampionsWakeTournamentLaunch(registered);
  const loss = recordChampionsWakeTournamentResult(registered, duelResult(launch, "defeat"));

  assert.equal(loss.applied, true);
  assert.equal(loss.attemptRecorded, true);
  assert.equal(loss.roundAdvanced, false);
  assert.equal(loss.activeRoundId, launch.encounterId);
  assert.equal(loss.save.progression.encounterResults[launch.encounterId].attempts, 1);
  assert.equal(loss.save.progression.encounterResults[launch.encounterId].latest.outcome, "defeat");
  assert.deepEqual(loss.save.progression.tournament.completedRoundIds, []);
  assert.deepEqual(loss.save.progression.tournament.lockedDeckSnapshot, snapshot);

  const reloaded = normalizeAdventureSave(JSON.parse(JSON.stringify(loss.save)));
  assert.deepEqual(reloaded, loss.save);
  assert.deepEqual(getChampionsWakeTournamentLaunch(reloaded), launch);

  const secondLoss = recordChampionsWakeTournamentResult(reloaded, duelResult(launch, "defeat"));
  assert.equal(secondLoss.save.progression.encounterResults[launch.encounterId].attempts, 2);
  assert.equal(secondLoss.activeRoundId, launch.encounterId);
  assert.deepEqual(secondLoss.save.progression.tournament.lockedDeckSnapshot, snapshot);
});

test("round victories advance strictly in order and keep the registration snapshot after deck edits", () => {
  let save = registeredSave("ordered-rounds");
  const locked = structuredClone(save.progression.tournament.lockedDeckSnapshot);
  const quarterfinal = winActiveRound(save);
  save = quarterfinal.save;

  assert.equal(quarterfinal.roundAdvanced, true);
  assert.equal(quarterfinal.activeRoundId, CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[1]);
  assert.deepEqual(save.progression.tournament.completedRoundIds, [
    CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[0],
  ]);
  assert.ok(save.progression.completedEncounterIds.includes(CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[0]));

  save = normalizeAdventureSave({
    ...save,
    player: { ...save.player, activeDeckId: "alternate-team" },
  });
  const semifinalLaunch = getChampionsWakeTournamentLaunch(save);
  assert.equal(semifinalLaunch.encounterId, CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[1]);
  assert.deepEqual(semifinalLaunch.playerDeckSnapshot, locked);
  assert.notEqual(
    semifinalLaunch.playerDeckSnapshot.fingerprint,
    fingerprintDeckCards(save.savedDecks["alternate-team"].cards),
  );

  const finalEncounter = ADVENTURE_CONTENT.encounters.find(
    ({ id }) => id === CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[2],
  );
  const outOfOrder = duelResult({
    ...semifinalLaunch,
    encounterId: finalEncounter.id,
    opponentId: finalEncounter.opponentId,
    opponentDeckId: finalEncounter.opponentDeckId,
  });
  assert.throws(
    () => recordChampionsWakeTournamentResult(save, outOfOrder),
    AdventureDuelResultMismatchError,
  );
  assert.equal(save.progression.encounterResults[finalEncounter.id], undefined);

  const semifinal = recordChampionsWakeTournamentResult(save, duelResult(semifinalLaunch));
  assert.equal(semifinal.activeRoundId, CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[2]);
  assert.deepEqual(semifinal.save.progression.tournament.lockedDeckSnapshot, locked);
});

test("saving and reloading between every round preserves a stable bracket", () => {
  let save = registeredSave("between-round-reloads");
  const locked = structuredClone(save.progression.tournament.lockedDeckSnapshot);

  for (let index = 0; index < CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.length; index += 1) {
    const before = normalizeAdventureSave(JSON.parse(JSON.stringify(save)));
    assert.deepEqual(before, save);
    const launch = getChampionsWakeTournamentLaunch(before);
    assert.equal(launch.encounterId, CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[index]);
    assert.deepEqual(launch.playerDeckSnapshot, locked);
    save = recordChampionsWakeTournamentResult(before, duelResult(launch)).save;
  }

  const finalReload = normalizeAdventureSave(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(finalReload, save);
  assert.equal(getChampionsWakeTournamentProgress(finalReload).complete, true);
});

test("the storage adapter preserves the locked deck and next round checkpoint", () => {
  const adapter = createAdventureStorageAdapter({
    backend: new MemoryStorage(),
    now: () => new Date("2026-07-18T12:00:00.000Z"),
  });
  let save = registeredSave("profile-1");
  save = winActiveRound(save).save;
  const persisted = adapter.manualSave("profile-1", save);
  assert.equal(persisted.ok, true);

  const loaded = adapter.loadProfile("profile-1");
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.save, save);
  const launch = getChampionsWakeTournamentLaunch(loaded.save);
  assert.equal(launch.encounterId, CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[1]);
  assert.deepEqual(
    launch.playerDeckSnapshot,
    save.progression.tournament.lockedDeckSnapshot,
  );
});

test("stale duplicate victory callbacks are no-ops and wrong deck fingerprints fail closed", () => {
  let save = registeredSave("idempotent-wins");
  const quarterfinalLaunch = getChampionsWakeTournamentLaunch(save);
  const result = duelResult(quarterfinalLaunch);
  save = recordChampionsWakeTournamentResult(save, result).save;
  const afterFirst = structuredClone(save);
  const attempts = save.progression.encounterResults[quarterfinalLaunch.encounterId].attempts;

  const duplicate = recordChampionsWakeTournamentResult(save, result);
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.attemptRecorded, false);
  assert.equal(duplicate.duplicateVictory, true);
  assert.deepEqual(duplicate.save, afterFirst);
  assert.equal(
    duplicate.save.progression.encounterResults[quarterfinalLaunch.encounterId].attempts,
    attempts,
  );

  const semifinalLaunch = getChampionsWakeTournamentLaunch(save);
  const mismatched = duelResult(semifinalLaunch, "victory", {
    playerDeckFingerprint: fingerprintDeckCards(deckCards(2)),
  });
  assert.throws(
    () => recordChampionsWakeTournamentResult(save, mismatched),
    AdventureDuelResultMismatchError,
  );
  assert.deepEqual(save, afterFirst);
});

test("the final completes the quest and grants the authored championship reward exactly once", () => {
  let save = registeredSave("championship-final");
  save = winActiveRound(save).save;
  save = winActiveRound(save).save;
  const finalLaunch = getChampionsWakeTournamentLaunch(save);
  const finalResult = duelResult(finalLaunch);
  const completed = recordChampionsWakeTournamentResult(save, finalResult);

  assert.equal(completed.tournamentComplete, true);
  assert.equal(completed.rewardApplied, true);
  assert.equal(completed.activeRoundId, null);
  assert.equal(completed.save.progression.tournament.status, "complete");
  assert.deepEqual(
    completed.save.progression.tournament.completedRoundIds,
    CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS,
  );
  assert.equal(
    completed.save.progression.quests[CHAMPIONS_WAKE_QUEST_ID].status,
    "complete",
  );
  assert.equal(completed.save.inventory.storyItems[CHAMPIONSHIP_STORY_ITEM_ID], 1);
  assert.ok(completed.save.fieldNotes.entryIds.includes(CHAMPIONSHIP_FIELD_NOTE_ID));
  assert.equal(
    completed.save.rewardLedger.filter((id) => id === CHAMPIONSHIP_REWARD_ID).length,
    1,
  );

  const stable = structuredClone(completed.save);
  const duplicate = recordChampionsWakeTournamentResult(completed.save, finalResult);
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.rewardApplied, false);
  assert.equal(duplicate.tournamentComplete, true);
  assert.deepEqual(duplicate.save, stable);
  assert.equal(duplicate.save.inventory.storyItems[CHAMPIONSHIP_STORY_ITEM_ID], 1);
  assert.equal(
    duplicate.save.rewardLedger.filter((id) => id === CHAMPIONSHIP_REWARD_ID).length,
    1,
  );
});

test("resume recovery resets unsafe brackets and repairs only verified ordered progress", () => {
  const eligible = eligibleSave("unsafe-recovery");
  eligible.progression.tournament = {
    status: "active",
    activeRoundId: CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[1],
    completedRoundIds: [CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[0]],
    lockedDeckSnapshot: null,
  };
  const missingSnapshot = recoverChampionsWakeTournamentState(eligible);
  assert.equal(missingSnapshot.recovered, true);
  assert.deepEqual(missingSnapshot.save.progression.tournament, {
    status: "available",
    activeRoundId: null,
    completedRoundIds: [],
    lockedDeckSnapshot: null,
    roundAttemptBaselines: {},
    roundVictoryAttemptCounts: {},
  });

  const fingerprintMismatch = registeredSave("fingerprint-recovery");
  fingerprintMismatch.progression.tournament.lockedDeckSnapshot.fingerprint =
    "deck-v1-0000000000000000";
  const reset = recoverChampionsWakeTournamentState(fingerprintMismatch);
  assert.equal(reset.recovered, true);
  assert.equal(reset.save.progression.tournament.status, "available");
  assert.equal(reset.save.progression.tournament.lockedDeckSnapshot, null);

  let oneWin = winActiveRound(registeredSave("ordered-recovery")).save;
  oneWin.progression.tournament.completedRoundIds.push(
    CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[2],
  );
  oneWin.progression.tournament.activeRoundId = CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[2];
  const repaired = recoverChampionsWakeTournamentState(oneWin);
  assert.equal(repaired.recovered, true);
  assert.deepEqual(repaired.save.progression.tournament.completedRoundIds, [
    CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[0],
  ]);
  assert.equal(
    repaired.save.progression.tournament.activeRoundId,
    CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[1],
  );
});

test("invalid snapshot recovery starts a new attempt without erasing the old first victory", () => {
  const historicalReward = ADVENTURE_CONTENT.rewards.find(
    ({ id }) => id === "reward-shellshore-marina-first-win",
  );
  assert.ok(historicalReward);
  let save = grantReward(
    eligibleSave("attempt-scoped-reregistration"),
    historicalReward,
  ).save;
  save = registerChampionsWakeTournament(save, syntheticCatalog()).save;
  const firstLaunch = getChampionsWakeTournamentLaunch(save);
  save = recordChampionsWakeTournamentResult(save, duelResult(firstLaunch)).save;

  const quarterfinalId = CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[0];
  const originalFirstVictory = structuredClone(
    save.progression.encounterResults[quarterfinalId].firstVictory,
  );
  const originalCompletedEncounterIds = [...save.progression.completedEncounterIds];
  const originalRewardLedger = [...save.rewardLedger];
  const originalPacks = structuredClone(save.inventory.unopenedPacks);
  assert.equal(save.progression.encounterResults[quarterfinalId].attempts, 1);

  const invalidSnapshot = structuredClone(save);
  invalidSnapshot.progression.tournament.lockedDeckSnapshot = null;
  const recovered = recoverChampionsWakeTournamentState(invalidSnapshot);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.save.progression.tournament.status, "available");
  assert.deepEqual(recovered.save.progression.tournament.completedRoundIds, []);
  assert.deepEqual(recovered.save.progression.tournament.roundAttemptBaselines, {});
  assert.deepEqual(recovered.save.progression.tournament.roundVictoryAttemptCounts, {});
  assert.deepEqual(recovered.save.progression.completedEncounterIds, originalCompletedEncounterIds);
  assert.deepEqual(
    recovered.save.progression.encounterResults[quarterfinalId].firstVictory,
    originalFirstVictory,
  );
  assert.deepEqual(recovered.save.rewardLedger, originalRewardLedger);
  assert.deepEqual(recovered.save.inventory.unopenedPacks, originalPacks);

  const alternate = normalizeAdventureSave({
    ...recovered.save,
    player: {
      ...recovered.save.player,
      activeDeckId: "alternate-team",
    },
  });
  const reRegistered = registerChampionsWakeTournament(alternate, syntheticCatalog());
  assert.equal(reRegistered.registered, true);
  assert.equal(
    reRegistered.save.progression.tournament.roundAttemptBaselines[quarterfinalId],
    1,
  );
  assert.deepEqual(reRegistered.save.progression.tournament.roundVictoryAttemptCounts, {});
  const secondLaunch = getChampionsWakeTournamentLaunch(reRegistered.save);
  assert.equal(secondLaunch.encounterId, quarterfinalId);
  assert.equal(secondLaunch.playerDeckSnapshot.id, "alternate-team");
  assert.notEqual(
    secondLaunch.playerDeckSnapshot.fingerprint,
    originalFirstVictory.playerDeckFingerprint,
  );

  const replayedQuarterfinal = recordChampionsWakeTournamentResult(
    reRegistered.save,
    duelResult(secondLaunch),
  );
  assert.equal(replayedQuarterfinal.roundAdvanced, true);
  assert.equal(
    replayedQuarterfinal.activeRoundId,
    CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[1],
  );
  assert.equal(
    replayedQuarterfinal.save.progression.encounterResults[quarterfinalId].attempts,
    2,
  );
  assert.equal(
    replayedQuarterfinal.save.progression.tournament.roundVictoryAttemptCounts[quarterfinalId],
    2,
  );
  assert.deepEqual(
    replayedQuarterfinal.save.progression.encounterResults[quarterfinalId].firstVictory,
    originalFirstVictory,
  );
  assert.equal(
    replayedQuarterfinal.save.progression.encounterResults[quarterfinalId].latest
      .playerDeckFingerprint,
    secondLaunch.playerDeckSnapshot.fingerprint,
  );

  const reloaded = normalizeAdventureSave(
    JSON.parse(JSON.stringify(replayedQuarterfinal.save)),
  );
  const resumed = getChampionsWakeTournamentProgress(reloaded);
  assert.equal(resumed.activeRoundId, CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[1]);
  assert.deepEqual(resumed.completedRoundIds, [quarterfinalId]);

  save = winActiveRound(resumed.save).save;
  save = winActiveRound(save).save;
  assert.equal(save.progression.tournament.status, "complete");
  assert.equal(save.inventory.storyItems[CHAMPIONSHIP_STORY_ITEM_ID], 1);
  assert.equal(
    save.rewardLedger.filter((id) => id === CHAMPIONSHIP_REWARD_ID).length,
    1,
  );
  assert.equal(
    save.rewardLedger.filter((id) => id === historicalReward.grantId).length,
    1,
  );
  assert.deepEqual(save.inventory.unopenedPacks, originalPacks);
});

test("postgame practice results cannot reopen or re-reward a completed bracket", () => {
  let save = registeredSave("postgame-attempt-history");
  const quarterfinalLaunch = getChampionsWakeTournamentLaunch(save);
  save = winActiveRound(save).save;
  save = winActiveRound(save).save;
  save = winActiveRound(save).save;
  const completedTournament = structuredClone(save.progression.tournament);
  const completedRewardLedger = [...save.rewardLedger];
  const completedCupCount = save.inventory.storyItems[CHAMPIONSHIP_STORY_ITEM_ID];

  const alternateSnapshot = {
    id: "alternate-team",
    name: "Alternate Team",
    cards: Object.entries(deckCards(2)).map(([cardIdValue, quantity]) => ({
      cardId: cardIdValue,
      quantity,
    })),
    fingerprint: fingerprintDeckCards(deckCards(2)),
  };
  const practiceLoss = duelResult({
    ...quarterfinalLaunch,
    playerDeckSnapshot: alternateSnapshot,
  }, "defeat");
  save = recordAdventureDuelResult(save, practiceLoss).save;
  assert.equal(
    save.progression.encounterResults[CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[0]].latest.outcome,
    "defeat",
  );

  const recovered = recoverChampionsWakeTournamentState(save);
  assert.equal(recovered.save.progression.tournament.status, "complete");
  assert.deepEqual(recovered.save.progression.tournament, completedTournament);
  assert.deepEqual(recovered.save.rewardLedger, completedRewardLedger);
  assert.equal(
    recovered.save.inventory.storyItems[CHAMPIONSHIP_STORY_ITEM_ID],
    completedCupCount,
  );
});

test("completed attempt proof preserves the bracket when its archived deck snapshot is lost", () => {
  let save = registeredSave("completed-missing-snapshot");
  save = winActiveRound(save).save;
  save = winActiveRound(save).save;
  save = winActiveRound(save).save;
  const completedRoundIds = [...save.progression.tournament.completedRoundIds];
  const roundAttemptBaselines = structuredClone(
    save.progression.tournament.roundAttemptBaselines,
  );
  const roundVictoryAttemptCounts = structuredClone(
    save.progression.tournament.roundVictoryAttemptCounts,
  );
  const rewardLedger = [...save.rewardLedger];

  const missingArchive = structuredClone(save);
  missingArchive.progression.tournament.lockedDeckSnapshot = null;
  const recovered = recoverChampionsWakeTournamentState(missingArchive);

  assert.equal(recovered.recovered, false);
  assert.equal(recovered.save.progression.tournament.status, "complete");
  assert.equal(recovered.save.progression.tournament.activeRoundId, null);
  assert.equal(recovered.save.progression.tournament.lockedDeckSnapshot, null);
  assert.deepEqual(recovered.save.progression.tournament.completedRoundIds, completedRoundIds);
  assert.deepEqual(
    recovered.save.progression.tournament.roundAttemptBaselines,
    roundAttemptBaselines,
  );
  assert.deepEqual(
    recovered.save.progression.tournament.roundVictoryAttemptCounts,
    roundVictoryAttemptCounts,
  );
  assert.deepEqual(recovered.save.rewardLedger, rewardLedger);
  assert.equal(recovered.save.inventory.storyItems[CHAMPIONSHIP_STORY_ITEM_ID], 1);
  assert.ok(recovered.save.fieldNotes.entryIds.includes(CHAMPIONSHIP_FIELD_NOTE_ID));
});

test("resume recovery restores an interrupted final reward through the encounter boundary once", () => {
  let save = registeredSave("reward-recovery");
  save = winActiveRound(save).save;
  save = winActiveRound(save).save;
  save = winActiveRound(save).save;

  const interrupted = normalizeAdventureSave({
    ...save,
    rewardLedger: save.rewardLedger.filter((id) => id !== CHAMPIONSHIP_REWARD_ID),
    inventory: {
      ...save.inventory,
      storyItems: {},
    },
    fieldNotes: {
      ...save.fieldNotes,
      entryIds: save.fieldNotes.entryIds.filter((id) => id !== CHAMPIONSHIP_FIELD_NOTE_ID),
    },
  });
  const recovered = recoverChampionsWakeTournamentState(interrupted);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.save.inventory.storyItems[CHAMPIONSHIP_STORY_ITEM_ID], 1);
  assert.ok(recovered.save.fieldNotes.entryIds.includes(CHAMPIONSHIP_FIELD_NOTE_ID));
  assert.equal(
    recovered.save.rewardLedger.filter((id) => id === CHAMPIONSHIP_REWARD_ID).length,
    1,
  );

  const repeated = recoverChampionsWakeTournamentState(recovered.save);
  assert.equal(repeated.recovered, false);
  assert.deepEqual(repeated.save, recovered.save);
  assert.equal(repeated.save.inventory.storyItems[CHAMPIONSHIP_STORY_ITEM_ID], 1);
});
