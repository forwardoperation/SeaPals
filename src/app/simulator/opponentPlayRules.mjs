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
 * Keep automated deck searches productive. A search card may be allowed by
 * the tabletop rules to find another copy of itself, but doing so provides no
 * new option and can make an automated turn cycle through every copy. The
 * human search UI remains unrestricted; this is only an AI choice policy.
 *
 * A scorer is optional. When supplied, higher-scoring cards are preferred and
 * equal scores retain deck order so seeded games stay deterministic.
 */
export function selectProductiveOpponentSearchTargets(
  candidateIds = [],
  {
    sourceCardId = null,
    amount = 1,
    isCandidateProductive = () => true,
    scoreCandidate = null,
  } = {},
) {
  const requestedAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (!requestedAmount) return [];

  const candidates = (candidateIds ?? [])
    .map((cardId, index) => ({ cardId, index }))
    .filter(({ cardId }) => (
      Boolean(cardId)
      && cardId !== sourceCardId
      && isCandidateProductive(cardId)
    ));

  if (typeof scoreCandidate === "function") {
    candidates.sort((left, right) => {
      const leftScore = Number(scoreCandidate(left.cardId));
      const rightScore = Number(scoreCandidate(right.cardId));
      const normalizedLeft = Number.isFinite(leftScore) ? leftScore : -Infinity;
      const normalizedRight = Number.isFinite(rightScore) ? rightScore : -Infinity;
      return normalizedRight - normalizedLeft || left.index - right.index;
    });
  }

  return candidates.slice(0, requestedAmount).map(({ cardId }) => cardId);
}

/**
 * Prices hazards that can waste an attack or remove the attacker. The result
 * is a penalty, not a legality filter: Hard can still take a calculated risk
 * when a Toxic target is important enough or is the only legal target.
 */
export function getHardOpponentAttackRiskPenalty({
  targetIsToxic = false,
  attackerHasToxicProtection = false,
  attackerSelfDiscardsAfterConsume = false,
  attackerRetentionValue = 0,
  consumeSuccessProbability = 1,
  targetAvoidanceProbability = 0,
  actionOpportunityValue = 0,
} = {}) {
  const avoidanceProbability = clamp01(targetAvoidanceProbability);
  const successfulConsumeProbability = clamp01(consumeSuccessProbability)
    * (1 - avoidanceProbability);
  const retentionValue = toFiniteNonNegative(attackerRetentionValue);
  const opportunityValue = toFiniteNonNegative(actionOpportunityValue);

  let penalty = avoidanceProbability * opportunityValue;
  if (attackerSelfDiscardsAfterConsume) {
    penalty += successfulConsumeProbability * retentionValue;
  } else if (targetIsToxic && !attackerHasToxicProtection) {
    // Toxic discards the consuming attacker on one of the two coin faces.
    penalty += successfulConsumeProbability * 0.5 * retentionValue;
  }
  return penalty;
}

/**
 * Scores an automatic attack from the attacker's point of view. Enemy losses
 * are upside, friendly losses are downside, and both are weighted by how
 * likely the attack is to resolve. Attacker hazards always remain downside.
 */
export function scoreAutomatedAttackTargetOutcome({
  targetValue = 0,
  targetBelongsToAttacker = false,
  resolutionProbability = 1,
  attackerRiskPenalty = 0,
} = {}) {
  const signedTargetValue = (targetBelongsToAttacker ? -1 : 1)
    * toFiniteNonNegative(targetValue)
    * clamp01(resolutionProbability);
  return signedTargetValue - toFiniteNonNegative(attackerRiskPenalty);
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
    ? isCritical ? 280 : isPressure ? 190 : 110
    : hasAttack
      ? isCritical || isPressure ? -90 : -25
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
  return difficulty === "hard" && Object.values(OpponentThreatLevel).includes(threatLevel);
}

export function getOpponentNormalAttackLimit(difficulty) {
  return difficulty === "hard" ? Infinity : 1;
}

/**
 * Supports resolve before permanent cards in the automated turn. Hard must
 * reserve the cumulative cost of every currently legal deployed attack,
 * otherwise one paid search can silently remove a later attack from Hard's
 * turn. Hand cards are alternative primary lines, so reserve only the highest
 * priority affordable combat permanent in addition to those board attacks.
 * If none is available, keep the cheapest legal permanent so Hard still
 * advances its board.
 */
export function getHardOpponentSupportRpReserve({
  difficulty,
  availableRp = 0,
  existingBoardAttacks = [],
  permanentPlays = [],
  getCost = (play) => play?.cost,
  isCombatPlay = (play) => Boolean(play?.hasLegalAttack),
  getPriority = (play) => play?.priority,
} = {}) {
  if (difficulty !== "hard") return 0;
  const bank = Math.max(0, Number(availableRp) || 0);
  const normalizeCost = (play) => Math.max(0, Number(getCost(play)) || 0);
  const boardAttackReserve = Math.min(
    bank,
    (existingBoardAttacks ?? []).reduce((total, attack) => total + normalizeCost(attack), 0),
  );
  const remainingForPermanent = Math.max(0, bank - boardAttackReserve);
  const affordable = (permanentPlays ?? []).map((play, index) => ({
    play,
    cost: normalizeCost(play),
    index,
  })).filter(({ cost }) => cost <= remainingForPermanent);
  if (!affordable.length) return boardAttackReserve;
  const combat = affordable.filter(({ play }) => isCombatPlay(play));
  if (combat.length) {
    const selectedCombatLine = combat.reduce((best, candidate) => {
      const candidatePriority = Number(getPriority(candidate.play));
      const bestPriority = Number(getPriority(best.play));
      const normalizedCandidatePriority = Number.isFinite(candidatePriority) ? candidatePriority : candidate.cost;
      const normalizedBestPriority = Number.isFinite(bestPriority) ? bestPriority : best.cost;
      if (normalizedCandidatePriority !== normalizedBestPriority) {
        return normalizedCandidatePriority > normalizedBestPriority ? candidate : best;
      }
      if (candidate.cost !== best.cost) return candidate.cost > best.cost ? candidate : best;
      return candidate.index < best.index ? candidate : best;
    }, combat[0]);
    return boardAttackReserve + selectedCombatLine.cost;
  }
  return boardAttackReserve + Math.min(...affordable.map(({ cost }) => cost));
}

export function canOpponentSpendSupportWithoutBreakingHardPlan({
  difficulty,
  availableRp = 0,
  supportCost = 0,
  reservedRp = 0,
} = {}) {
  const bank = Math.max(0, Number(availableRp) || 0);
  const cost = Math.max(0, Number(supportCost) || 0);
  if (cost > bank) return false;
  if (difficulty !== "hard" || cost === 0) return true;
  return bank - cost >= Math.max(0, Number(reservedRp) || 0);
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

/**
 * Hard attack selection is a joint attacker/target decision. Ranking an
 * attacker before looking at what it can actually hit can choose a large die
 * that only reaches a disposable card while overlooking a smaller attacker
 * that can remove the opponent's engine.
 */
export function selectHardOpponentAttackPlan(
  attackers = [],
  getLegalTargets = () => [],
  {
    scoreAttacker = () => 0,
    scoreTarget = () => 0,
    scorePair = null,
  } = {},
) {
  const plans = (attackers ?? []).flatMap((attacker, attackerIndex) => (
    (getLegalTargets(attacker) ?? []).map((target, targetIndex) => ({
      attacker,
      target,
      attackerIndex,
      targetIndex,
    }))
  ));
  if (!plans.length) return null;

  const getScore = (plan) => Number(
    typeof scorePair === "function"
      ? scorePair(plan.attacker, plan.target)
      : scoreAttacker(plan.attacker) + scoreTarget(plan.target, plan.attacker),
  ) || 0;
  return plans.reduce((best, candidate) => (
    getScore(candidate) > getScore(best) ? candidate : best
  ), plans[0]);
}
