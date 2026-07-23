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

export function selectOpponentChoice(items, difficulty, { mediumScore, hardScore = mediumScore } = {}) {
  if (!items?.length) return null;
  const normalized = normalizeOpponentDifficulty(difficulty);
  if (normalized === OpponentDifficulty.EASY || typeof mediumScore !== "function") return items[0];
  const score = normalized === OpponentDifficulty.HARD && typeof hardScore === "function" ? hardScore : mediumScore;
  return items.reduce((best, candidate) => score(candidate) > score(best) ? candidate : best, items[0]);
}

export function orderOpponentChoices(items, difficulty, score) {
  const choices = [...(items ?? [])];
  if (normalizeOpponentDifficulty(difficulty) === OpponentDifficulty.EASY || typeof score !== "function") return choices;
  return choices.sort((left, right) => score(right) - score(left));
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
  creaturesInHand = 0,
  threatLevel = "setup",
} = {}) {
  const fallback = Number(round) % 2 === 1 ? "palsDeck" : "foundationDeck";
  if (normalizeOpponentDifficulty(difficulty) !== OpponentDifficulty.HARD) return fallback;
  if (coralCount < 2 && foundationCardsInHand === 0) return "foundationDeck";
  if (emptySlotCount === 0 && foundationCardsInHand === 0) return "foundationDeck";
  if (["pressure", "critical"].includes(threatLevel) && creaturesInHand < 2 && coralCount > 0) return "palsDeck";
  if (emptySlotCount <= 1 && foundationCardsInHand === 0) return "foundationDeck";
  if (emptySlotCount > 0 && creaturesInHand === 0) return "palsDeck";
  return fallback;
}
