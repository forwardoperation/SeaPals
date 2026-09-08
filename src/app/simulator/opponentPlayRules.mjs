/**
 * Prefer permanent plays whose mandatory On Play attacks can resolve.
 *
 * An immediate VP win takes precedence at every difficulty. The original
 * pool remains available when every option would fizzle so callers never
 * lose an otherwise legal play.
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

  const winningPool = originalPool.filter(isVpWinningPlay);
  if (winningPool.length) return winningPool;

  const preferredPool = originalPool.filter((cardId) => (
    !isMandatoryOnPlayAttack(cardId)
    || hasLegalOnPlayTarget(cardId)
  ));

  return preferredPool.length ? preferredPool : originalPool;
}

/** Immediate wins are a basic rule-aware decision, including on Easy. */
export function preferOpponentWinningPlays(
  playableCardIds = [],
  { reachesVictory = () => false } = {},
) {
  const candidates = [...(playableCardIds ?? [])];
  const winning = candidates.filter(reachesVictory);
  return winning.length ? winning : candidates;
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

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
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
 * Rank a Hard opponent's search result by how quickly it can affect the
 * current board. This keeps high-VP but locked cards from crowding an
 * affordable attack out of the hand when the rival has a legal target.
 */
export function scoreHardOpponentSearchCandidate({
  baseScore = 0,
  playCost = 0,
  availableRp = 0,
  hasAttack = false,
  hasLegalAttack = false,
  meetsRequirements = true,
  hasPlacement = true,
} = {}) {
  const cost = toFiniteNonNegative(playCost);
  const bank = toFiniteNonNegative(availableRp);
  const costGap = Math.max(0, cost - bank);
  const canPlayNow = Boolean(meetsRequirements && hasPlacement && costGap === 0);
  const attackTempo = hasLegalAttack
    ? (canPlayNow ? 320 : 140)
    : hasAttack && canPlayNow
      ? 30
      : 0;
  const immediatePlayValue = canPlayNow ? 60 : 0;
  const requirementPenalty = meetsRequirements ? 0 : 120;
  const placementPenalty = hasPlacement ? 0 : 100;

  return Number(baseScore || 0)
    + attackTempo
    + immediatePlayValue
    - costGap * 35
    - requirementPenalty
    - placementPenalty;
}

/**
 * Preserve flexible Predator and Apex slots for cards that actually need
 * them. Callers pass only empty compatible slots; ties retain board order so
 * seeded games remain deterministic.
 */
export function selectBestOpponentCreatureSlot(candidates = [], creatureClass = null) {
  const entries = [...(candidates ?? [])];
  if (!entries.length) return null;
  const rank = (entry) => {
    const slot = entry?.slot ?? entry;
    const exactPenalty = slot?.slotClass === creatureClass ? 0 : 1;
    const flexibility = Array.isArray(slot?.accepts) ? slot.accepts.length : Number.MAX_SAFE_INTEGER;
    return exactPenalty * 100 + flexibility;
  };
  return entries.reduce((best, candidate) => (
    rank(candidate) < rank(best) ? candidate : best
  ), entries[0]);
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

  // A player one ordinary scoring play from winning is urgent even when
  // both boards are even or the AI currently has a small lead.
  const playerNearVictory = victoryDistance <= Math.max(3, target * 0.15);
  const level = playerNearVictory || score >= 68
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

/**
 * Evaluate what this play adds to the current board, rather than valuing an
 * upgrade's entire printed card a second time. Net VP includes replaced or
 * sacrificed cards and conditional ecosystem scoring, supplied by the caller.
 * Extra slots and density matter most when they unlock cards already in hand.
 * Easy weighs immediate gains; Medium and Hard also plan their next plays.
 */
export function scoreOpponentPermanentPlay({
  difficulty = "medium",
  threatLevel = OpponentThreatLevel.SETUP,
  vpGain = 0,
  incomeGain = 0,
  cost = 0,
  rpGain = 0,
  slotGain = 0,
  openSlots = 0,
  creaturesInHand = 0,
  schoolDensityGain = 0,
  schoolDensityNeeded = 0,
  unlocksCards = 0,
  affordableUnlocks = 0,
  actionCount = 0,
  hasAttack = false,
  hasLegalAttack = false,
  attackValue = null,
  isFirstFoundation = false,
  reachesVictory = false,
} = {}) {
  const easy = difficulty === "easy";
  const hard = difficulty === "hard";
  const critical = threatLevel === OpponentThreatLevel.CRITICAL;
  const pressure = threatLevel === OpponentThreatLevel.PRESSURE;
  const planningWeight = easy ? 0.45 : hard ? 1.25 : 1;
  const economyWeight = critical ? 5 : pressure ? 12 : 22;
  const vpWeight = critical ? 28 : pressure ? 21 : 16;
  const attackWeight = critical ? 135 : pressure ? 90 : 55;
  const usefulSlots = Math.min(
    toFiniteNonNegative(slotGain),
    Math.max(0, toFiniteNonNegative(creaturesInHand) - toFiniteNonNegative(openSlots)),
  );
  const usefulDensity = Math.min(
    toFiniteNonNegative(schoolDensityGain),
    toFiniteNonNegative(schoolDensityNeeded),
  );
  const infrastructureValue = usefulSlots * 18
    + Math.min(120, usefulDensity) * 0.35
    + Math.min(4, toFiniteNonNegative(unlocksCards)) * 14
    + Math.min(3, toFiniteNonNegative(affordableUnlocks)) * 32;
  const immediateAttackValue = hasLegalAttack
    ? attackValue == null
      ? attackWeight
      : Math.max(-attackWeight, Math.min(attackWeight * 2, toFiniteNumber(attackValue)))
    : hasAttack ? -12 : 0;

  return (reachesVictory ? 100000 : 0)
    + toFiniteNumber(vpGain) * (easy ? 14 : vpWeight)
    + toFiniteNumber(incomeGain) * (easy ? 12 : economyWeight)
    + toFiniteNonNegative(rpGain) * 8
    + infrastructureValue * planningWeight
    + immediateAttackValue * (easy ? 0.55 : hard ? 1.15 : 1)
    + Math.min(3, toFiniteNonNegative(actionCount)) * (easy ? 2 : 4)
    + (isFirstFoundation ? 55 : 0)
    - toFiniteNonNegative(cost) * (easy ? 3 : 4);
}

export function shouldOpponentAttackBeforeUtility(difficulty, threatLevel) {
  return difficulty !== "easy" && Object.values(OpponentThreatLevel).includes(threatLevel);
}

export function getOpponentNormalAttackLimit(difficulty) {
  return difficulty === "easy" ? 1 : Infinity;
}

/**
 * Supports resolve before permanent cards in the automated turn. Reserve
 * the cumulative cost of currently legal deployed attacks,
 * otherwise one paid search can silently remove a later attack from the AI's
 * turn. Hand cards are alternative primary lines, so reserve only the highest
 * priority affordable combat permanent in addition to those board attacks.
 * Immediate wins override the attack budget. Easy budgets one normal attack;
 * Medium and Hard budget all of them. The legacy export name is retained.
 */
export function getHardOpponentSupportRpReserve({
  difficulty,
  availableRp = 0,
  existingBoardAttacks = [],
  permanentPlays = [],
  getCost = (play) => play?.cost,
  isCombatPlay = (play) => Boolean(play?.hasLegalAttack),
  getPriority = (play) => play?.priority,
  isWinningPlay = (play) => Boolean(play?.reachesVictory),
} = {}) {
  const bank = toFiniteNonNegative(availableRp);
  const normalizeCost = (play) => toFiniteNonNegative(getCost(play));
  const winningPlays = (permanentPlays ?? []).filter((play) => (
    isWinningPlay(play) && normalizeCost(play) <= bank
  ));
  if (winningPlays.length) return Math.min(...winningPlays.map(normalizeCost));
  const attacks = [...(existingBoardAttacks ?? [])];
  if (difficulty === "easy") {
    attacks.sort((left, right) => (
      toFiniteNumber(getPriority(right)) - toFiniteNumber(getPriority(left))
      || normalizeCost(left) - normalizeCost(right)
    ));
  }
  const boardAttackReserve = Math.min(
    bank,
    attacks.slice(0, getOpponentNormalAttackLimit(difficulty))
      .reduce((total, attack) => total + normalizeCost(attack), 0),
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
  const rankedPermanents = affordable.filter(({ play }) => Number.isFinite(Number(getPriority(play))));
  if (rankedPermanents.length) {
    const bestPermanent = rankedPermanents.reduce((best, candidate) => (
      Number(getPriority(candidate.play)) > Number(getPriority(best.play)) ? candidate : best
    ));
    return boardAttackReserve + bestPermanent.cost;
  }
  return boardAttackReserve + Math.min(...affordable.map(({ cost }) => cost));
}

export function canOpponentSpendSupportWithoutBreakingHardPlan({
  difficulty,
  availableRp = 0,
  supportCost = 0,
  reservedRp = 0,
} = {}) {
  const bank = toFiniteNonNegative(availableRp);
  const cost = toFiniteNonNegative(supportCost);
  if (cost > bank) return false;
  if (cost === 0) return true;
  return bank - cost >= toFiniteNonNegative(reservedRp);
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
