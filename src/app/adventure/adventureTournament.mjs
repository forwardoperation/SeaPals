import {
  createActiveDuelDeckSnapshot,
  fingerprintDeckCards,
} from "./adventureDecks.mjs";
import { assertAdventureDuelResultMatchesLaunch } from "./adventureDuel.mjs";
import {
  ADVENTURE_CONTENT,
  getAdventureEncounter,
} from "./adventureContent.mjs";
import {
  normalizeAdventureSave,
  transitionQuest,
} from "./adventureProgression.mjs";
import {
  completeAdventureEncounter,
  recordAdventureDuelResult,
} from "./adventureSession.mjs";
import {
  CHAMPIONS_WAKE_QUEST_ID,
  CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS,
  CHAMPIONS_WAKE_TOURNAMENT_VICTORY_TARGET,
  getChampionsWakeTournamentRoundAvailability,
} from "./adventureTournamentGate.mjs";

export {
  CHAMPIONS_WAKE_QUEST_ID,
  CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS,
  CHAMPIONS_WAKE_TOURNAMENT_VICTORY_TARGET,
  getChampionsWakeTournamentRoundAvailability,
};
export const CHAMPIONS_WAKE_REQUIRED_TIDE_MARK_IDS = Object.freeze([
  "tide-mark-sunpatch",
  "tide-mark-brackwater",
  "tide-mark-current",
  "tide-mark-kelpwatch",
  "tide-mark-trenchlight",
]);
export const CHAMPIONS_WAKE_REQUIRED_FIELD_NOTE_IDS = Object.freeze([
  "field-note-coral-observations",
  "field-note-estuary-conditions",
  "field-note-current-connections",
  "field-note-kelp-food-web",
  "field-note-deep-adaptations",
]);

export class AdventureTournamentStateError extends Error {
  constructor(message, code = "INVALID_TOURNAMENT_STATE") {
    super(message);
    this.name = "AdventureTournamentStateError";
    this.code = code;
  }
}

function tournamentError(message, code) {
  throw new AdventureTournamentStateError(message, code);
}

function getRoundEncounter(roundId) {
  const encounter = getAdventureEncounter(roundId);
  if (
    !encounter
    || encounter.questId !== CHAMPIONS_WAKE_QUEST_ID
    || encounter.role !== "tournament"
    || encounter.victoryTarget !== CHAMPIONS_WAKE_TOURNAMENT_VICTORY_TARGET
  ) {
    tournamentError(
      `Tournament content for ${roundId} is missing or is not an authored 30 VP round.`,
      "INVALID_TOURNAMENT_CONTENT",
    );
  }
  return encounter;
}

function getChampionshipReward() {
  const final = getRoundEncounter(CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.at(-1));
  const reward = final.rewardId
    ? ADVENTURE_CONTENT.rewards.find((candidate) => candidate.id === final.rewardId)
    : null;
  if (!reward) {
    tournamentError(
      "The tournament final is missing its authored championship reward.",
      "INVALID_TOURNAMENT_CONTENT",
    );
  }
  return reward;
}

function missingIds(required, actual) {
  const actualIds = new Set(actual);
  return required.filter((id) => !actualIds.has(id));
}

function recommendedInactiveStatus(save) {
  const questStatus = save.progression.quests[CHAMPIONS_WAKE_QUEST_ID]?.status ?? "notStarted";
  const missingTideMarkIds = missingIds(
    CHAMPIONS_WAKE_REQUIRED_TIDE_MARK_IDS,
    save.progression.tideMarkIds,
  );
  const missingFieldNoteIds = missingIds(
    CHAMPIONS_WAKE_REQUIRED_FIELD_NOTE_IDS,
    save.fieldNotes.entryIds,
  );
  return questStatus === "active"
    && missingTideMarkIds.length === 0
    && missingFieldNoteIds.length === 0
    ? "available"
    : "locked";
}

function withTournament(save, tournament) {
  return normalizeAdventureSave({
    ...save,
    progression: {
      ...save.progression,
      tournament,
    },
  });
}

function resetTournament(save) {
  return withTournament(save, {
    status: recommendedInactiveStatus(save),
    activeRoundId: null,
    completedRoundIds: [],
    lockedDeckSnapshot: null,
    roundAttemptBaselines: {},
    roundVictoryAttemptCounts: {},
  });
}

function snapshotFingerprintMatches(snapshot) {
  if (!snapshot) return false;
  try {
    return fingerprintDeckCards(snapshot.cards) === snapshot.fingerprint;
  } catch {
    return false;
  }
}

function freezeSnapshot(snapshot) {
  const cards = Object.freeze(snapshot.cards.map((entry) => Object.freeze({ ...entry })));
  return Object.freeze({
    id: snapshot.id,
    name: snapshot.name,
    cards,
    fingerprint: snapshot.fingerprint,
  });
}

function getRoundAttemptCount(save, roundId) {
  return save.progression.encounterResults[roundId]?.attempts ?? 0;
}

function captureRoundAttemptBaselines(save) {
  return Object.fromEntries(CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.map((roundId) => [
    roundId,
    getRoundAttemptCount(save, roundId),
  ]));
}

function resultSummaryMatchesRound(summary, encounter, snapshot) {
  return summary?.outcome === "victory"
    && summary.playerDeckId === snapshot.id
    && summary.playerDeckFingerprint === snapshot.fingerprint
    && summary.opponentId === encounter.opponentId
    && summary.targetVp === CHAMPIONS_WAKE_TOURNAMENT_VICTORY_TARGET;
}

function hasCompleteAttemptBaselines(save) {
  const baselines = save.progression.tournament.roundAttemptBaselines;
  const keys = Object.keys(baselines);
  return keys.length === CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.length
    && CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.every((roundId) => (
      Number.isSafeInteger(baselines[roundId])
      && baselines[roundId] >= 0
      && baselines[roundId] <= getRoundAttemptCount(save, roundId)
    ));
}

function deriveLegacyAttemptBaselines(save, snapshot) {
  const claimed = new Set(save.progression.tournament.completedRoundIds);
  return Object.fromEntries(CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.map((roundId) => {
    const attempts = getRoundAttemptCount(save, roundId);
    const encounter = getRoundEncounter(roundId);
    const resultRecord = save.progression.encounterResults[roundId];
    const currentBracketWin = claimed.has(roundId)
      && attempts > 0
      && (
        resultSummaryMatchesRound(resultRecord?.latest, encounter, snapshot)
        || resultSummaryMatchesRound(resultRecord?.firstVictory, encounter, snapshot)
      );
    return [roundId, currentBracketWin ? attempts - 1 : attempts];
  }));
}

function getAttemptBaselines(save, snapshot) {
  return hasCompleteAttemptBaselines(save)
    ? save.progression.tournament.roundAttemptBaselines
    : deriveLegacyAttemptBaselines(save, snapshot);
}

function hasCompleteVictoryAttemptCounts(save, attemptBaselines) {
  const completedRoundIds = save.progression.tournament.completedRoundIds;
  const counts = save.progression.tournament.roundVictoryAttemptCounts;
  const keys = Object.keys(counts);
  return keys.length === completedRoundIds.length
    && completedRoundIds.every((roundId) => (
      CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.includes(roundId)
      && Number.isSafeInteger(counts[roundId])
      && counts[roundId] > attemptBaselines[roundId]
      && counts[roundId] <= getRoundAttemptCount(save, roundId)
    ));
}

function deriveLegacyVictoryAttemptCounts(save, snapshot, attemptBaselines) {
  const counts = {};
  for (const roundId of CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS) {
    if (!save.progression.tournament.completedRoundIds.includes(roundId)) break;
    const resultRecord = save.progression.encounterResults[roundId];
    const encounter = getRoundEncounter(roundId);
    const hasMatchingVictory = resultSummaryMatchesRound(resultRecord?.latest, encounter, snapshot)
      || resultSummaryMatchesRound(resultRecord?.firstVictory, encounter, snapshot);
    if (
      !hasMatchingVictory
      || resultRecord.attempts <= attemptBaselines[roundId]
    ) break;
    counts[roundId] = resultRecord.attempts;
  }
  return counts;
}

function getVictoryAttemptCounts(save, snapshot, attemptBaselines) {
  return hasCompleteVictoryAttemptCounts(save, attemptBaselines)
    ? save.progression.tournament.roundVictoryAttemptCounts
    : deriveLegacyVictoryAttemptCounts(save, snapshot, attemptBaselines);
}

function isVerifiedCompletedRound(save, roundId, attemptBaselines, victoryAttemptCounts) {
  if (!save.progression.completedEncounterIds.includes(roundId)) return false;
  const victoryAttempt = victoryAttemptCounts[roundId];
  return Number.isSafeInteger(victoryAttempt)
    && victoryAttempt > attemptBaselines[roundId]
    && victoryAttempt <= getRoundAttemptCount(save, roundId);
}

function getVerifiedCompletedPrefix(save, attemptBaselines, victoryAttemptCounts) {
  const claimed = new Set(save.progression.tournament.completedRoundIds);
  const completed = [];
  for (const roundId of CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS) {
    if (
      !claimed.has(roundId)
      || !isVerifiedCompletedRound(
        save,
        roundId,
        attemptBaselines,
        victoryAttemptCounts,
      )
    ) break;
    completed.push(roundId);
  }
  return completed;
}

function getPersistedCompletedProof(save) {
  if (!hasCompleteAttemptBaselines(save)) return null;
  const roundAttemptBaselines = save.progression.tournament.roundAttemptBaselines;
  if (!hasCompleteVictoryAttemptCounts(save, roundAttemptBaselines)) return null;
  const roundVictoryAttemptCounts = save.progression.tournament.roundVictoryAttemptCounts;
  const completedRoundIds = getVerifiedCompletedPrefix(
    save,
    roundAttemptBaselines,
    roundVictoryAttemptCounts,
  );
  if (completedRoundIds.length !== CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.length) return null;
  return {
    completedRoundIds,
    roundAttemptBaselines,
    roundVictoryAttemptCounts,
  };
}

function completeTournamentQuest(saveValue) {
  let save = normalizeAdventureSave(saveValue);
  let status = save.progression.quests[CHAMPIONS_WAKE_QUEST_ID]?.status ?? "notStarted";
  if (status === "active") {
    save = transitionQuest(save, CHAMPIONS_WAKE_QUEST_ID, "readyToTurnIn");
    status = "readyToTurnIn";
  }
  if (status === "readyToTurnIn") {
    save = transitionQuest(save, CHAMPIONS_WAKE_QUEST_ID, "complete");
  }
  return save;
}

/**
 * Repairs only tournament-owned state. In particular, an active bracket whose
 * exact deck snapshot is missing or whose fingerprint no longer matches is
 * reset to registration instead of launching with the player's current deck.
 */
export function recoverChampionsWakeTournamentState(saveValue) {
  let save = normalizeAdventureSave(saveValue);
  const before = JSON.stringify(save);
  const tournament = save.progression.tournament;

  if (["locked", "available"].includes(tournament.status)) {
    save = resetTournament(save);
  } else if (!snapshotFingerprintMatches(tournament.lockedDeckSnapshot)) {
    const completedProof = tournament.status === "complete"
      ? getPersistedCompletedProof(save)
      : null;
    if (!completedProof) {
      save = resetTournament(save);
    } else {
      // A completed bracket no longer needs its deck list to launch a round.
      // Preserve verified attempt-scoped wins when an old/corrupt save loses
      // only that archival snapshot, and repair the exact-once reward boundary.
      const finalEncounter = getRoundEncounter(CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.at(-1));
      save = completeAdventureEncounter(save, {
        encounterId: finalEncounter.id,
        opponentId: finalEncounter.opponentId,
        chapterEncounterIds: CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS,
      });
      save = completeTournamentQuest(save);
      save = withTournament(save, {
        status: "complete",
        activeRoundId: null,
        completedRoundIds: completedProof.completedRoundIds,
        lockedDeckSnapshot: null,
        roundAttemptBaselines: completedProof.roundAttemptBaselines,
        roundVictoryAttemptCounts: completedProof.roundVictoryAttemptCounts,
      });
    }
  } else {
    const snapshot = tournament.lockedDeckSnapshot;
    const roundAttemptBaselines = getAttemptBaselines(save, snapshot);
    const roundVictoryAttemptCounts = getVictoryAttemptCounts(
      save,
      snapshot,
      roundAttemptBaselines,
    );
    const completedRoundIds = getVerifiedCompletedPrefix(
      save,
      roundAttemptBaselines,
      roundVictoryAttemptCounts,
    );
    const verifiedVictoryAttemptCounts = Object.fromEntries(
      completedRoundIds.map((roundId) => [roundId, roundVictoryAttemptCounts[roundId]]),
    );
    const bracketComplete = completedRoundIds.length === CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.length;

    if (bracketComplete) {
      // Re-enter the existing encounter boundary to repair an interrupted
      // reward-ledger write without introducing a second championship grant.
      const finalEncounter = getRoundEncounter(CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.at(-1));
      save = completeAdventureEncounter(save, {
        encounterId: finalEncounter.id,
        opponentId: finalEncounter.opponentId,
        chapterEncounterIds: CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS,
      });
      save = completeTournamentQuest(save);
      save = withTournament(save, {
        status: "complete",
        activeRoundId: null,
        completedRoundIds,
        lockedDeckSnapshot: snapshot,
        roundAttemptBaselines,
        roundVictoryAttemptCounts: verifiedVictoryAttemptCounts,
      });
    } else {
      const questStatus = save.progression.quests[CHAMPIONS_WAKE_QUEST_ID]?.status ?? "notStarted";
      if (questStatus !== "active") {
        save = resetTournament(save);
      } else {
        save = withTournament(save, {
          status: "active",
          activeRoundId: CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[completedRoundIds.length],
          completedRoundIds,
          lockedDeckSnapshot: snapshot,
          roundAttemptBaselines,
          roundVictoryAttemptCounts: verifiedVictoryAttemptCounts,
        });
      }
    }
  }

  const after = JSON.stringify(save);
  return {
    save,
    recovered: before !== after,
    reason: before !== after ? "tournament-state-reconciled" : null,
  };
}

export function getChampionsWakeTournamentAvailability(saveValue) {
  const recovered = recoverChampionsWakeTournamentState(saveValue);
  const save = recovered.save;
  const questStatus = save.progression.quests[CHAMPIONS_WAKE_QUEST_ID]?.status ?? "notStarted";
  const missingTideMarkIds = missingIds(
    CHAMPIONS_WAKE_REQUIRED_TIDE_MARK_IDS,
    save.progression.tideMarkIds,
  );
  const missingFieldNoteIds = missingIds(
    CHAMPIONS_WAKE_REQUIRED_FIELD_NOTE_IDS,
    save.fieldNotes.entryIds,
  );
  const requirementsMet = questStatus === "active"
    && missingTideMarkIds.length === 0
    && missingFieldNoteIds.length === 0;
  const canRegister = requirementsMet && save.progression.tournament.status === "available";

  let reason = null;
  if (save.progression.tournament.status === "complete") reason = "tournament-complete";
  else if (save.progression.tournament.status === "active") reason = "tournament-active";
  else if (questStatus !== "active") reason = "quest-not-active";
  else if (missingTideMarkIds.length > 0) reason = "missing-tide-marks";
  else if (missingFieldNoteIds.length > 0) reason = "missing-field-notes";

  return {
    save,
    available: canRegister,
    requirementsMet,
    reason,
    questStatus,
    missingTideMarkIds,
    missingFieldNoteIds,
  };
}

/** Locks one legal active-deck snapshot for all three bracket rounds. */
export function registerChampionsWakeTournament(saveValue, cardCatalog, rules = {}) {
  const recovered = recoverChampionsWakeTournamentState(saveValue);
  const save = recovered.save;
  const tournament = save.progression.tournament;

  if (tournament.status === "active") {
    return {
      save,
      registered: false,
      alreadyRegistered: true,
      lockedDeckSnapshot: freezeSnapshot(tournament.lockedDeckSnapshot),
      activeRoundId: tournament.activeRoundId,
      status: tournament.status,
    };
  }
  if (tournament.status === "complete") {
    tournamentError("The completed tournament cannot be registered again.", "TOURNAMENT_COMPLETE");
  }

  const availability = getChampionsWakeTournamentAvailability(save);
  if (!availability.available) {
    tournamentError(
      "Tournament registration requires the active Champion's Wake quest, all five Tide Marks, and all five ecosystem Field Notes.",
      "TOURNAMENT_LOCKED",
    );
  }

  const lockedDeckSnapshot = createActiveDuelDeckSnapshot(save, cardCatalog, rules);
  const roundAttemptBaselines = captureRoundAttemptBaselines(save);
  const nextSave = withTournament(save, {
    status: "active",
    activeRoundId: CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[0],
    completedRoundIds: [],
    lockedDeckSnapshot,
    roundAttemptBaselines,
    roundVictoryAttemptCounts: {},
  });
  return {
    save: nextSave,
    registered: true,
    alreadyRegistered: false,
    lockedDeckSnapshot: freezeSnapshot(nextSave.progression.tournament.lockedDeckSnapshot),
    activeRoundId: CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[0],
    status: "active",
  };
}

export function getChampionsWakeTournamentProgress(saveValue) {
  const recovered = recoverChampionsWakeTournamentState(saveValue);
  const save = recovered.save;
  const tournament = save.progression.tournament;
  const roundIndex = tournament.activeRoundId === null
    ? null
    : CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.indexOf(tournament.activeRoundId);
  return {
    save,
    status: tournament.status,
    activeRoundId: tournament.activeRoundId,
    activeRoundNumber: roundIndex < 0 || roundIndex === null ? null : roundIndex + 1,
    completedRoundIds: [...tournament.completedRoundIds],
    lockedDeckSnapshot: tournament.lockedDeckSnapshot
      ? freezeSnapshot(tournament.lockedDeckSnapshot)
      : null,
    complete: tournament.status === "complete",
  };
}

/** Returns the exact identity the Simulator must use for the current round. */
export function getChampionsWakeTournamentLaunch(saveValue) {
  const progress = getChampionsWakeTournamentProgress(saveValue);
  const roundAvailability = getChampionsWakeTournamentRoundAvailability(
    progress.save,
    progress.activeRoundId,
  );
  if (!roundAvailability.available || !progress.activeRoundId || !progress.lockedDeckSnapshot) {
    tournamentError("Register a legal deck before launching a tournament round.", "TOURNAMENT_NOT_ACTIVE");
  }
  const encounter = getRoundEncounter(progress.activeRoundId);
  return Object.freeze({
    encounterId: encounter.id,
    opponentId: encounter.opponentId,
    opponentDeckId: encounter.opponentDeckId,
    victoryTarget: encounter.victoryTarget,
    playerDeckSnapshot: progress.lockedDeckSnapshot,
  });
}

function assertResultMatchesRound(result, roundId, snapshot) {
  const encounter = getRoundEncounter(roundId);
  assertAdventureDuelResultMatchesLaunch(result, {
    encounterId: encounter.id,
    opponentId: encounter.opponentId,
    opponentDeckId: encounter.opponentDeckId,
    victoryTarget: encounter.victoryTarget,
    playerDeckSnapshot: snapshot,
  });
  return encounter;
}

/**
 * Records one bracket attempt. Defeats keep the round and registered deck;
 * first victories advance, while repeated victory callbacks are true no-ops.
 */
export function recordChampionsWakeTournamentResult(saveValue, resultValue) {
  const recovered = recoverChampionsWakeTournamentState(saveValue);
  let save = recovered.save;
  const tournament = save.progression.tournament;
  const resultEncounterId = String(resultValue?.encounterId ?? "").trim();

  if (
    resultValue?.outcome === "victory"
    && tournament.completedRoundIds.includes(resultEncounterId)
    && tournament.lockedDeckSnapshot
  ) {
    assertResultMatchesRound(resultValue, resultEncounterId, tournament.lockedDeckSnapshot);
    // Validate every persisted result field, but discard the incremented copy.
    recordAdventureDuelResult(save, resultValue);
    return {
      save,
      applied: false,
      attemptRecorded: false,
      duplicateVictory: true,
      roundAdvanced: false,
      tournamentComplete: tournament.status === "complete",
      rewardApplied: false,
      outcome: "victory",
      roundId: resultEncounterId,
      activeRoundId: tournament.activeRoundId,
      nextRoundId: tournament.activeRoundId,
      status: tournament.status,
    };
  }

  if (tournament.status !== "active" || !tournament.activeRoundId || !tournament.lockedDeckSnapshot) {
    tournamentError("No registered tournament round is active.", "TOURNAMENT_NOT_ACTIVE");
  }

  const encounter = assertResultMatchesRound(
    resultValue,
    tournament.activeRoundId,
    tournament.lockedDeckSnapshot,
  );
  const recorded = recordAdventureDuelResult(save, resultValue);
  save = recorded.save;

  if (resultValue.outcome !== "victory") {
    return {
      save,
      applied: true,
      attemptRecorded: true,
      duplicateVictory: false,
      roundAdvanced: false,
      tournamentComplete: false,
      rewardApplied: false,
      outcome: resultValue.outcome,
      roundId: tournament.activeRoundId,
      activeRoundId: tournament.activeRoundId,
      nextRoundId: tournament.activeRoundId,
      status: "active",
    };
  }

  const reward = encounter.rewardId === null ? null : getChampionshipReward();
  const rewardWasApplied = reward ? save.rewardLedger.includes(reward.grantId) : false;
  save = completeAdventureEncounter(save, {
    encounterId: encounter.id,
    opponentId: encounter.opponentId,
    chapterEncounterIds: CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS,
  });
  const completedRoundIds = [
    ...tournament.completedRoundIds,
    encounter.id,
  ];
  const roundVictoryAttemptCounts = {
    ...tournament.roundVictoryAttemptCounts,
    [encounter.id]: recorded.attempts,
  };
  const complete = completedRoundIds.length === CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.length;
  const activeRoundId = complete
    ? null
    : CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS[completedRoundIds.length];
  save = withTournament(save, {
    status: complete ? "complete" : "active",
    activeRoundId,
    completedRoundIds,
    lockedDeckSnapshot: tournament.lockedDeckSnapshot,
    roundAttemptBaselines: tournament.roundAttemptBaselines,
    roundVictoryAttemptCounts,
  });
  if (complete) save = completeTournamentQuest(save);

  return {
    save,
    applied: true,
    attemptRecorded: true,
    duplicateVictory: false,
    roundAdvanced: true,
    tournamentComplete: complete,
    rewardApplied: reward ? !rewardWasApplied && save.rewardLedger.includes(reward.grantId) : false,
    outcome: resultValue.outcome,
    roundId: encounter.id,
    activeRoundId,
    nextRoundId: activeRoundId,
    status: complete ? "complete" : "active",
  };
}
