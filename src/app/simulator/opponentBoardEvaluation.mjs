import { calculateVictoryPoints } from "./gameRules.mjs";

// Evaluate the whole visible ecosystem so replacing an upgrade, paying a
// sacrifice, and completing a card's VP synergy all use the actual game rules.
export function projectOpponentPermanentVp({
  boardCardIds = [],
  cardId,
  replacedCardId = null,
  sacrificedCardIds = [],
  attachedCardIds = [],
  cardsById = {},
  victoryTarget = Infinity,
} = {}) {
  const projectedIds = [...boardCardIds];
  for (const removedId of [replacedCardId, ...sacrificedCardIds].filter(Boolean)) {
    const index = projectedIds.indexOf(removedId);
    if (index >= 0) projectedIds.splice(index, 1);
  }
  if (cardId) projectedIds.push(cardId);
  projectedIds.push(...attachedCardIds);
  const currentVp = calculateVictoryPoints(boardCardIds.map((id) => cardsById[id]), boardCardIds);
  const projectedVp = calculateVictoryPoints(projectedIds.map((id) => cardsById[id]), projectedIds);
  return { currentVp, projectedVp, vpGain: projectedVp - currentVp, reachesVictory: projectedVp >= victoryTarget };
}

export function getOpponentOwnedBoardCardIds(state = {}, rivalFoundations = [], rivalOrphans = []) {
  const ownedCreatures = (entries, remote = false) => (entries ?? []).flatMap((entry) => {
    const owned = remote ? entry.invasiveOwner === "opponent" : !entry.invasiveOwner || entry.invasiveOwner === "opponent";
    return owned ? [entry.cardId, ...(entry.hostedCardIds ?? [])].filter(Boolean) : [];
  });
  return [
    ...(state.habitats ?? []),
    ...(state.reefCreatures ?? []),
    ...(state.corals ?? []).flatMap((foundation) => [foundation.cardId, ...ownedCreatures(foundation.slots)]),
    ...ownedCreatures(state.orphanCreatures),
    ...rivalFoundations.flatMap((foundation) => ownedCreatures(foundation.slots, true)),
    ...ownedCreatures(rivalOrphans, true),
  ].filter(Boolean);
}

export function selectOpponentFoundationEffectTarget(foundations = [], {
  effect = "damage",
  amount = 0,
  cardsById = {},
  getIncome = () => 0,
  isStunned = () => false,
} = {}) {
  let best = null;
  let bestScore = 0;
  for (const foundation of foundations) {
    const card = cardsById[foundation.cardId];
    const income = Math.max(0, Number(getIncome(foundation)) || 0);
    const vp = Math.max(0, Number(card?.victoryPoints) || 0);
    const density = Math.max(0, Number(card?.schoolDensity) || 0);
    const occupied = (foundation.slots ?? []).filter((slot) => slot.cardId).length;
    const value = vp * 30 + income * 20 + density * 0.2 + occupied * 5;
    let score = 0;
    if (effect === "damage") {
      const health = Number(foundation.health ?? foundation.maxHealth ?? card?.health ?? 0);
      if (amount > 0 && health > 0) score = amount >= health ? 1000 + value : amount / health * 50 + value * 0.1;
    } else if (effect === "stun" && !isStunned(foundation)) {
      score = 1 + income * 20 + (card?.passives?.length ?? 0) * 8 + (card?.upgrade?.canUpgrade ? 5 : 0);
    } else if (effect === "income" && !isStunned(foundation)) {
      score = Math.min(Math.abs(amount), Math.max(0, income - Number(foundation.rpPenaltyNextTurn ?? 0))) * 20;
    }
    if (score > bestScore) { best = foundation; bestScore = score; }
  }
  return best;
}
