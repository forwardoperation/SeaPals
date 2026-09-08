export const OpponentDifficulty = Object.freeze({
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
});

export const OPPONENT_DIFFICULTY_OPTIONS = Object.freeze([
  {
    id: OpponentDifficulty.EASY,
    label: "Easy",
    description: "Makes straightforward plays and limits optional actions.",
  },
  {
    id: OpponentDifficulty.MEDIUM,
    label: "Medium",
    description: "Uses the simulator's balanced, rules-aware strategy.",
  },
  {
    id: OpponentDifficulty.HARD,
    label: "Hard",
    description: "Optimizes plays, draws, attackers, and high-value targets.",
  },
]);

export function normalizeOpponentDifficulty(value) {
  return Object.values(OpponentDifficulty).includes(value) ? value : OpponentDifficulty.MEDIUM;
}

export function getOpponentDifficultyProfile(value) {
  const difficulty = normalizeOpponentDifficulty(value);
  if (difficulty === OpponentDifficulty.EASY) {
    return {
      id: difficulty,
      label: "Easy",
      supportPlayLimit: 1,
      utilityActionLimit: 1,
      thinkingMultiplier: 0.7,
    };
  }
  if (difficulty === OpponentDifficulty.HARD) {
    return {
      id: difficulty,
      label: "Hard",
      supportPlayLimit: Infinity,
      utilityActionLimit: Infinity,
      thinkingMultiplier: 1.25,
    };
  }
  return {
    id: OpponentDifficulty.MEDIUM,
    label: "Medium",
    supportPlayLimit: Infinity,
    utilityActionLimit: Infinity,
    thinkingMultiplier: 1,
  };
}

function normalizeChoiceScore(value) {
  const score = Number(value);
  return value != null && Number.isFinite(score) ? score : -Infinity;
}

export function selectOpponentChoice(items, difficulty, { easyScore, mediumScore, hardScore } = {}) {
  if (!items?.length) return null;
  const normalized = normalizeOpponentDifficulty(difficulty);
  // Easy still recognizes direct value. Its smaller action budget and simpler
  // scoring keep it approachable without making hand order its strategy.
  const score = normalized === OpponentDifficulty.HARD
    ? hardScore ?? mediumScore ?? easyScore
    : normalized === OpponentDifficulty.EASY
      ? easyScore ?? mediumScore
      : mediumScore ?? easyScore;
  if (typeof score !== "function") return items[0];
  let best = items[0];
  let bestScore = normalizeChoiceScore(score(best));
  for (const candidate of items.slice(1)) {
    const candidateScore = normalizeChoiceScore(score(candidate));
    if (candidateScore > bestScore) {
      best = candidate;
      bestScore = candidateScore;
    }
  }
  return best;
}

export function orderOpponentChoices(items, difficulty, score) {
  const choices = [...(items ?? [])];
  if (typeof score !== "function") return choices;
  return choices
    .map((item, index) => ({ item, index, score: normalizeChoiceScore(score(item)) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item }) => item);
}

export function limitOpponentOptionalActions(available, difficulty, actionType) {
  const profile = getOpponentDifficultyProfile(difficulty);
  const configuredLimit = actionType === "support" ? profile.supportPlayLimit : profile.utilityActionLimit;
  return Math.max(0, Math.min(Math.max(0, Number(available) || 0), configuredLimit));
}

export function scaleOpponentThinkingDelay(delay, difficulty) {
  const multiplier = getOpponentDifficultyProfile(difficulty).thinkingMultiplier;
  return Math.max(250, Math.round((Math.max(0, Number(delay)) || 0) * multiplier));
}

export function chooseOpponentPreferredDeck({
  difficulty,
  round,
  coralCount = 0,
  emptySlotCount = 0,
  foundationCardsInHand = 0,
  usableFoundationCardsInHand,
  creaturesInHand = 0,
  placementBlockedCreaturesInHand,
  densityBlockedCreaturesInHand = 0,
  targetableAttackCardsInHand = 0,
  legalAttackCardsInHand = 0,
  placementBlockedAttackCardsInHand = 0,
  visibleAttackTargetCount = 0,
  deployedLegalAttackCount = 0,
  threatLevel = "setup",
} = {}) {
  const fallback = Number(round) % 2 === 1 ? "palsDeck" : "foundationDeck";
  const normalized = normalizeOpponentDifficulty(difficulty);
  // Upgrade cards without their previous stage cannot solve a missing reef.
  const usableFoundations = Math.max(0, Number(usableFoundationCardsInHand ?? foundationCardsInHand) || 0);
  // Callers with full placement information include Oceanic and hosted cards,
  // which may be playable even when every ordinary slot is occupied.
  const placementBlockedCreatures = Math.max(0, Number(
    placementBlockedCreaturesInHand ?? (emptySlotCount === 0 ? creaturesInHand : 0),
  ) || 0);
  if (coralCount === 0 && usableFoundations === 0) return "foundationDeck";
  if (placementBlockedCreatures > 0 && usableFoundations === 0) return "foundationDeck";
  if (creaturesInHand === 0 && (emptySlotCount > 0 || usableFoundations > 0)) return "palsDeck";
  if (coralCount < 2 && usableFoundations === 0) return "foundationDeck";
  if (normalized === OpponentDifficulty.EASY) return fallback;
  if (densityBlockedCreaturesInHand > 0 && usableFoundations === 0) return "foundationDeck";
  // Attack-heavy decks often carry one-shot On Play attacks rather than
  // reusable attack actions. A hand full of passive or currently untargeted
  // creatures is not a real combat line, so draw from Pals while the rival has
  // exposed creatures instead of blindly alternating back to Foundation.
  if (normalized === OpponentDifficulty.HARD && visibleAttackTargetCount > 0 && legalAttackCardsInHand === 0 && deployedLegalAttackCount === 0) {
    if (placementBlockedAttackCardsInHand > 0) {
      return "foundationDeck";
    }
    if (targetableAttackCardsInHand === 0) return "palsDeck";
  }
  if (["pressure", "critical"].includes(threatLevel) && creaturesInHand < 2 && coralCount > 0) return "palsDeck";
  if (emptySlotCount <= 1 && usableFoundations === 0) return "foundationDeck";
  if (emptySlotCount > 0 && creaturesInHand === 0) return "palsDeck";
  if (usableFoundations >= Math.max(2, creaturesInHand)) return "palsDeck";
  return fallback;
}
