export const STORY_DUEL_CONTRACT_VERSION = 1;

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value;
}

function requireText(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new TypeError(`${label} is required.`);
  return normalized;
}

function requireNonNegativeNumber(value, label) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new RangeError(`${label} must be a non-negative finite number.`);
  }
  return normalized;
}

function requirePositiveNumber(value, label) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new RangeError(`${label} must be a positive finite number.`);
  }
  return normalized;
}

function getOutcome(message) {
  if (/^Victory:/i.test(message)) return "victory";
  if (/^Defeat:/i.test(message)) return "defeat";
  throw new TypeError("A completed story duel message must begin with Victory: or Defeat:.");
}

function getCompletionReason(message) {
  if (/deck|draw/i.test(message) && /empty|deplet|could not|required/i.test(message)) {
    return "deck-depletion";
  }
  if (/\bVP\b|victory point/i.test(message)) return "vp-target";
  return "resolved-effect";
}

/**
 * Canonicalizes the serializable portion of Simulator story-mode input.
 * Callback functions intentionally stay outside this object.
 */
export function createStoryDuelConfig({
  encounterId,
  opponentId,
  opponentName,
  playerDeckId,
  opponentDeckId,
  victoryTarget,
  difficulty,
}) {
  return Object.freeze({
    contractVersion: STORY_DUEL_CONTRACT_VERSION,
    encounterId: requireText(encounterId, "Encounter id"),
    opponent: Object.freeze({
      id: requireText(opponentId, "Opponent id"),
      name: requireText(opponentName, "Opponent name"),
      deckId: requireText(opponentDeckId, "Opponent deck id"),
      difficulty: requireText(difficulty, "Opponent difficulty"),
    }),
    playerDeckId: requireText(playerDeckId, "Player deck id"),
    victoryTarget: requirePositiveNumber(victoryTarget, "Victory target"),
  });
}

/**
 * Produces the deterministic result event consumed by adventure progression.
 * Reward eligibility is deliberately not decided here; the reward ledger owns
 * first-clear checks so repeating a callback cannot duplicate a grant.
 */
export function createStoryDuelResult(input) {
  const value = requireObject(input, "Story duel result input");
  const config = createStoryDuelConfig(value);
  const message = requireText(value.message, "Result message");
  const outcome = getOutcome(message);

  return Object.freeze({
    contractVersion: STORY_DUEL_CONTRACT_VERSION,
    encounterId: config.encounterId,
    outcome,
    winner: outcome === "victory" ? "player" : "opponent",
    completionReason: getCompletionReason(message),
    scores: Object.freeze({
      playerVp: requireNonNegativeNumber(value.playerVp, "Player VP"),
      opponentVp: requireNonNegativeNumber(value.opponentVp, "Opponent VP"),
      targetVp: config.victoryTarget,
    }),
    playerDeckId: config.playerDeckId,
    opponent: config.opponent,
    round: requireNonNegativeNumber(value.round, "Round"),
    turn: requirePositiveNumber(value.turn, "Turn"),
    message,
  });
}
