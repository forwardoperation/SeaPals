export class AdventureDuelResultMismatchError extends Error {
  constructor(message) {
    super(message);
    this.name = "AdventureDuelResultMismatchError";
  }
}

function mismatch(message) {
  throw new AdventureDuelResultMismatchError(message);
}

/**
 * Fails closed at the Simulator-to-adventure boundary. A stale callback or a
 * result from another opponent, target, or deck can never grant progression.
 */
export function assertAdventureDuelResultMatchesLaunch(result, expected) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    mismatch("Duel result must be an object.");
  }
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) {
    throw new TypeError("Expected duel launch identity must be an object.");
  }
  const snapshot = expected.playerDeckSnapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new TypeError("Expected duel launch identity requires a player deck snapshot.");
  }

  const comparisons = [
    ["encounter id", result.encounterId, expected.encounterId],
    ["opponent id", result.opponent?.id, expected.opponentId],
    ["opponent deck", result.opponent?.deckId, expected.opponentDeckId],
    ["victory target", result.scores?.targetVp, expected.victoryTarget],
    ["player deck id", result.playerDeckId, snapshot.id],
    ["player deck fingerprint", result.playerDeckFingerprint, snapshot.fingerprint],
  ];
  for (const [label, actual, required] of comparisons) {
    if (actual !== required) {
      mismatch(`Duel result ${label} did not match the locked launch identity.`);
    }
  }
  return result;
}
