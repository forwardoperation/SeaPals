/**
 * Prefer permanent plays whose mandatory On Play attacks can resolve.
 *
 * A fizzling attacker may still be the correct play when it immediately wins
 * on VP, and the original pool remains available when every option would
 * fizzle so callers never lose an otherwise legal play.
 */
export function getPreferredOpponentPermanentPlayPool(
  playableCardIds = [],
  {
    isMandatoryOnPlayAttack = () => false,
    hasLegalOnPlayTarget = () => false,
    isVpWinningPlay = () => false,
  } = {},
) {
  const originalPool = [...(playableCardIds ?? [])];
  if (!originalPool.length) return originalPool;

  const preferredPool = originalPool.filter((cardId) => (
    isVpWinningPlay(cardId)
    || !isMandatoryOnPlayAttack(cardId)
    || hasLegalOnPlayTarget(cardId)
  ));

  return preferredPool.length ? preferredPool : originalPool;
}

export function preferOpponentPlaysWithResolvableOnPlayAttacks(
  playableCardIds = [],
  {
    hasOnPlayAttack = () => false,
    hasLegalTarget = () => false,
    reachesVictory = () => false,
  } = {},
) {
  return getPreferredOpponentPermanentPlayPool(playableCardIds, {
    isMandatoryOnPlayAttack: hasOnPlayAttack,
    hasLegalOnPlayTarget: hasLegalTarget,
    isVpWinningPlay: reachesVictory,
  });
}

export const OpponentThreatLevel = Object.freeze({
  SETUP: "setup",
  PRESSURE: "pressure",
  CRITICAL: "critical",
});

function toFiniteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

/**
 * Estimate how urgently the opponent needs to disrupt the visible player
 * engine. This deliberately uses only public board information: VP, RP
 * production, School Density capacity, board size, and the current round.
 */
export function getOpponentThreatProfile({
  playerVp = 0,
  opponentVp = 0,
  victoryTarget = 30,
  playerIncome = 0,
  opponentIncome = 0,
  playerSchoolDensity = 0,
  opponentSchoolDensity = 0,
  playerBoardCards = 0,
  opponentBoardCards = 0,
  round = 1,
} = {}) {
  const target = Math.max(1, toFiniteNonNegative(victoryTarget));
  const normalizedPlayerVp = toFiniteNonNegative(playerVp);
  const normalizedOpponentVp = toFiniteNonNegative(opponentVp);
  const progress = clamp01(normalizedPlayerVp / target);
  const lead = clamp01((normalizedPlayerVp - normalizedOpponentVp) / target);
  const incomeEdge = clamp01(
    (toFiniteNonNegative(playerIncome) - toFiniteNonNegative(opponentIncome) + 4) / 12,
  );
  const densityEdge = clamp01(
    (toFiniteNonNegative(playerSchoolDensity) - toFiniteNonNegative(opponentSchoolDensity) + 100) / 400,
  );
  const boardEdge = clamp01(
    (toFiniteNonNegative(playerBoardCards) - toFiniteNonNegative(opponentBoardCards) + 3) / 10,
  );
  const lateGame = clamp01((toFiniteNonNegative(round) - 3) / 7);
  const victoryDistance = Math.max(0, target - normalizedPlayerVp);

  const score = Math.round((
    progress * 40
    + lead * 25
    + incomeEdge * 15
    + densityEdge * 12
    + boardEdge * 5
    + lateGame * 8
    + (victoryDistance <= Math.max(3, target * 0.15) ? 18 : 0)
  ) * 10) / 10;

  const level = score >= 68
    ? OpponentThreatLevel.CRITICAL
    : score >= 42
      ? OpponentThreatLevel.PRESSURE
      : OpponentThreatLevel.SETUP;

  return {
    level,
    score,
    progress,
    lead,
    victoryDistance,
    playerIncome: toFiniteNonNegative(playerIncome),
    opponentIncome: toFiniteNonNegative(opponentIncome),
    playerSchoolDensity: toFiniteNonNegative(playerSchoolDensity),
    opponentSchoolDensity: toFiniteNonNegative(opponentSchoolDensity),
  };
}

/**
 * Add urgency to a permanent-card score without changing card legality.
 * Hard AI should stop polishing a slow economy when a visible opposing engine
 * is close to taking over the game.
 */
export function scoreHardOpponentPermanentPlay({
  baseScore = 0,
  threatLevel = OpponentThreatLevel.SETUP,
  printedVp = 0,
  income = 0,
  cost = 0,
  hasLegalAttack = false,
  hasAttack = false,
  isFoundation = false,
  isUpgrade = false,
  reachesVictory = false,
} = {}) {
  const normalizedVp = toFiniteNonNegative(printedVp);
  const normalizedIncome = toFiniteNonNegative(income);
  const normalizedCost = toFiniteNonNegative(cost);
  const isCritical = threatLevel === OpponentThreatLevel.CRITICAL;
  const isPressure = threatLevel === OpponentThreatLevel.PRESSURE;
  const attackBonus = hasLegalAttack
    ? isCritical ? 240 : isPressure ? 90 : 14
    : hasAttack && (isCritical || isPressure)
      ? -80
      : 0;
  const tempoVpMultiplier = isCritical ? 18 : isPressure ? 12 : 8;
  const economyMultiplier = isCritical ? 0 : isPressure ? 2 : 7;
  const slowEnginePenalty = isFoundation
    ? isCritical ? (isUpgrade ? 105 : 70) : isPressure && isUpgrade ? 30 : 0
    : 0;

  return Number(baseScore || 0)
    + (reachesVictory ? 1000 : 0)
    + normalizedVp * tempoVpMultiplier
    + normalizedIncome * economyMultiplier
    + attackBonus
    - slowEnginePenalty
    - normalizedCost;
}

export function shouldOpponentAttackBeforeUtility(difficulty, threatLevel) {
  return difficulty === "hard" && threatLevel === OpponentThreatLevel.CRITICAL;
}

export function getOpponentNormalAttackLimit(difficulty) {
  return difficulty === "hard" ? Infinity : 1;
}

/**
 * Normal attacks must be selected from attacker/target pairs, not from the
 * attacker list alone. Mandatory On Play attacks stay present so the game can
 * report that their printed effect had no legal target.
 */
export function filterOpponentAttackersWithLegalTargets(
  attackers = [],
  getLegalTargets = () => [],
  { preserveMandatoryAttack = false } = {},
) {
  const candidates = [...(attackers ?? [])];
  if (preserveMandatoryAttack) return candidates;
  return candidates.filter((attacker) => (getLegalTargets(attacker) ?? []).length > 0);
}
