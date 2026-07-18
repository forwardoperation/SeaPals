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

function requireDeckFingerprint(value) {
  const fingerprint = requireText(value, "Player deck snapshot fingerprint");
  if (!/^deck-v1-[0-9a-f]{16}$/.test(fingerprint)) {
    throw new TypeError(
      "Player deck snapshot fingerprint must use the canonical deck-v1-<16 lowercase hex> format.",
    );
  }
  return fingerprint;
}

function requirePositiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer.`);
  }
  return value;
}

/**
 * Clones, canonicalizes, and deeply freezes a validated adventure deck at the
 * story/simulator boundary. Card order is deliberately canonical so the
 * supplied composition fingerprint always travels with one stable manifest.
 */
export function normalizeStoryPlayerDeckSnapshot(value) {
  const snapshot = requireObject(value, "Player deck snapshot");
  if (!Array.isArray(snapshot.cards) || snapshot.cards.length === 0) {
    throw new TypeError("Player deck snapshot cards must be a non-empty array.");
  }

  const seenCardIds = new Set();
  const cards = snapshot.cards.map((rawEntry, index) => {
    const entry = requireObject(rawEntry, `Player deck snapshot card ${index + 1}`);
    const cardId = requireText(entry.cardId, `Player deck snapshot card ${index + 1} id`);
    if (seenCardIds.has(cardId)) {
      throw new TypeError(`Player deck snapshot contains duplicate card id \"${cardId}\".`);
    }
    seenCardIds.add(cardId);
    return Object.freeze({
      cardId,
      quantity: requirePositiveSafeInteger(
        entry.quantity,
        `Player deck snapshot card \"${cardId}\" quantity`,
      ),
    });
  }).sort((left, right) => left.cardId.localeCompare(right.cardId));

  return Object.freeze({
    id: requireText(snapshot.id, "Player deck snapshot id"),
    name: requireText(snapshot.name, "Player deck snapshot name"),
    cards: Object.freeze(cards),
    fingerprint: requireDeckFingerprint(snapshot.fingerprint),
  });
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
  playerDeckSnapshot,
  opponentDeckId,
  victoryTarget,
  difficulty,
}) {
  const normalizedPlayerDeckSnapshot = playerDeckSnapshot == null
    ? null
    : normalizeStoryPlayerDeckSnapshot(playerDeckSnapshot);
  const normalizedPlayerDeckId = playerDeckId == null || String(playerDeckId).trim() === ""
    ? normalizedPlayerDeckSnapshot?.id
    : requireText(playerDeckId, "Player deck id");

  if (!normalizedPlayerDeckId) {
    throw new TypeError("Player deck id is required when no player deck snapshot is supplied.");
  }
  if (normalizedPlayerDeckSnapshot && normalizedPlayerDeckSnapshot.id !== normalizedPlayerDeckId) {
    throw new TypeError(
      `Player deck id \"${normalizedPlayerDeckId}\" does not match snapshot id \"${normalizedPlayerDeckSnapshot.id}\".`,
    );
  }

  return Object.freeze({
    contractVersion: STORY_DUEL_CONTRACT_VERSION,
    encounterId: requireText(encounterId, "Encounter id"),
    opponent: Object.freeze({
      id: requireText(opponentId, "Opponent id"),
      name: requireText(opponentName, "Opponent name"),
      deckId: requireText(opponentDeckId, "Opponent deck id"),
      difficulty: requireText(difficulty, "Opponent difficulty"),
    }),
    playerDeckId: normalizedPlayerDeckId,
    ...(normalizedPlayerDeckSnapshot
      ? { playerDeckSnapshot: normalizedPlayerDeckSnapshot }
      : {}),
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
    ...(config.playerDeckSnapshot
      ? { playerDeckFingerprint: config.playerDeckSnapshot.fingerprint }
      : {}),
    opponent: config.opponent,
    round: requireNonNegativeNumber(value.round, "Round"),
    turn: requirePositiveNumber(value.turn, "Turn"),
    message,
  });
}

/**
 * Returns true only for the scored victory required by the academy lesson.
 * Other legal match endings (such as opponent deck depletion) remain valid
 * story results, but do not prove that the player reached the VP target.
 * When expected encounter facts are supplied, mismatches fail closed so a
 * result from another match or target cannot unlock academy progression.
 */
export function isStoryDuelVpTargetVictory(result, expected = null) {
  const playerVp = Number(result?.scores?.playerVp);
  const targetVp = Number(result?.scores?.targetVp);
  const baseMatch = result?.outcome === "victory"
    && result?.winner === "player"
    && result?.completionReason === "vp-target"
    && Number.isFinite(playerVp)
    && Number.isFinite(targetVp)
    && targetVp > 0
    && playerVp >= targetVp;
  if (!baseMatch) return false;
  if (expected == null) return true;
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) return false;

  if (Object.hasOwn(expected, "encounterId")) {
    const expectedEncounterId = String(expected.encounterId ?? "").trim();
    if (!expectedEncounterId || result?.encounterId !== expectedEncounterId) return false;
  }
  if (Object.hasOwn(expected, "victoryTarget")) {
    const expectedTargetVp = Number(expected.victoryTarget);
    if (!Number.isFinite(expectedTargetVp) || expectedTargetVp <= 0) return false;
    if (targetVp !== expectedTargetVp || playerVp < expectedTargetVp) return false;
  }
  return true;
}
