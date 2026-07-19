import { fingerprintDeckCards } from "./adventureDecks.mjs";
import { normalizeAdventureSave } from "./adventureProgression.mjs";

export const CHAMPIONS_WAKE_QUEST_ID = "quest-champions-wake";
export const CHAMPIONS_WAKE_TOURNAMENT_VICTORY_TARGET = 30;
export const CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS = Object.freeze([
  "encounter-tournament-quarterfinal",
  "encounter-tournament-semifinal",
  "encounter-tournament-final",
]);

function hasMatchingSnapshotFingerprint(snapshot) {
  if (!snapshot) return false;
  try {
    return fingerprintDeckCards(snapshot.cards) === snapshot.fingerprint;
  } catch {
    return false;
  }
}

/**
 * Single launch gate shared by the tournament controller and generic encounter
 * availability. Passing quest prerequisites alone can never launch a bracket
 * match: registration, snapshot integrity, and exact round order are required.
 */
export function getChampionsWakeTournamentRoundAvailability(saveValue, encounterIdValue) {
  const save = normalizeAdventureSave(saveValue);
  const encounterId = String(encounterIdValue ?? "").trim();
  const roundIndex = CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.indexOf(encounterId);
  const tournament = save.progression.tournament;

  if (roundIndex < 0) {
    return {
      save,
      available: false,
      reason: "unknown-tournament-round",
      activeRoundId: tournament.activeRoundId,
      lockedDeckSnapshot: tournament.lockedDeckSnapshot,
    };
  }
  if (tournament.status !== "active" || !tournament.lockedDeckSnapshot) {
    return {
      save,
      available: false,
      reason: "registration-required",
      activeRoundId: tournament.activeRoundId,
      lockedDeckSnapshot: tournament.lockedDeckSnapshot,
    };
  }
  if (!hasMatchingSnapshotFingerprint(tournament.lockedDeckSnapshot)) {
    return {
      save,
      available: false,
      reason: "invalid-locked-deck",
      activeRoundId: tournament.activeRoundId,
      lockedDeckSnapshot: tournament.lockedDeckSnapshot,
    };
  }
  const questStatus = save.progression.quests[CHAMPIONS_WAKE_QUEST_ID]?.status ?? "notStarted";
  if (questStatus !== "active") {
    return {
      save,
      available: false,
      reason: "quest-not-active",
      activeRoundId: tournament.activeRoundId,
      lockedDeckSnapshot: tournament.lockedDeckSnapshot,
    };
  }
  const expectedCompletedRoundIds = CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.slice(0, roundIndex);
  const orderIsConsistent = tournament.completedRoundIds.length === expectedCompletedRoundIds.length
    && expectedCompletedRoundIds.every((id, index) => tournament.completedRoundIds[index] === id);
  if (!orderIsConsistent || tournament.activeRoundId !== encounterId) {
    return {
      save,
      available: false,
      reason: "round-not-active",
      activeRoundId: tournament.activeRoundId,
      lockedDeckSnapshot: tournament.lockedDeckSnapshot,
    };
  }

  return {
    save,
    available: true,
    reason: null,
    activeRoundId: tournament.activeRoundId,
    lockedDeckSnapshot: tournament.lockedDeckSnapshot,
  };
}
