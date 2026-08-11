export function parseDieExpression(expression) {
  const match = String(expression ?? "").trim().toUpperCase().match(/^D(\d+)(?:\s*([+-])\s*(\d+))?$/);
  if (!match) return null;
  const sides = Number(match[1]);
  const modifier = match[2] ? Number(`${match[2]}${match[3]}`) : 0;
  return sides > 0 ? { sides, modifier } : null;
}

export function rollDie(expression, random = Math.random) {
  const die = parseDieExpression(expression);
  if (!die) return null;
  const natural = Math.floor(random() * die.sides) + 1;
  return { expression, natural, modifier: die.modifier, total: Math.max(0, natural + die.modifier) };
}

export function resolveOpposedRoll(attackExpression, defenseExpression, random = Math.random) {
  const attack = rollDie(attackExpression, random);
  const defense = rollDie(defenseExpression, random);
  if (!attack || !defense) return { resolved: false, attack, defense, attackerWins: false };
  return {
    resolved: true,
    attack,
    defense,
    attackerWins: attack.total > defense.total,
  };
}

export function conditionPreventsCardPlay(card, activeCondition = null) {
  return (activeCondition?.effects ?? []).some((effect) => {
    if (effect.type !== "preventCardPlay") return false;
    if (effect.targetKind && effect.targetKind !== card?.kind) return false;
    return !effect.targetCategories?.length || effect.targetCategories.includes(card?.category);
  });
}

export function parseLegacyAttackText(action) {
  if (typeof action !== "string" || !/\battacks?\b/i.test(action)) return null;
  const diceMatch = action.match(/\b(?:1)?(D\d+(?:\s*[+-]\s*\d+)?)\b/i);
  if (!diceMatch) return null;
  const targetText = action.match(/targeting\s+([^.]*)/i)?.[1] ?? "";
  const categories = [];
  if (/\bapex\b/i.test(targetText)) categories.push("apex");
  if (/\bpredators?\b/i.test(targetText)) categories.push("predator");
  if (/\bfish\b/i.test(targetText)) categories.push("fish");
  if (/\binvertebrates?\b/i.test(targetText)) categories.push("invertebrate");
  if (/filter feeders?/i.test(targetText)) categories.push("filter-feeder");
  const repeatMatch = action.match(/perform\s+(\d+)\s+(?:(?:D\d+(?:\s*[+-]\s*\d+)?)\s+)?attacks?/i);
  const wordRepeat = /\bthree\s+[^.]*attacks?/i.test(action) ? 3 : /\btwo\s+[^.]*attacks?/i.test(action) ? 2 : 1;
  const targetZone = /\bdeep\s+(?:fish|predators?|invertebrates?|apex|filter feeders?)\b/i.test(targetText) ? "deep" : null;
  const unresolvedText = action.replace(/if you successfully consume[^.]*discard this card\.?/i, "");
  return { attackDice: diceMatch[1].replace(/\s+/g, "").toUpperCase(), actionName: action.split(":")[0]?.trim() || "Attack", actionCost: Number(action.match(/cost:\s*(\d+)\s*rp/i)?.[1] ?? 0), target: { categories }, targetTags: [], targetZone, repeat: Number(repeatMatch?.[1] ?? wordRepeat), skipNextTurn: /cannot .*next turn/i.test(action), text: action, unsupportedDetails: /\bif\b|\badd\b|advantage|additional/i.test(unresolvedText) ? "This printed attack may have conditional modifiers; supported modifiers were applied and any remaining text is informational." : "" };
}

export function parseLegacyUtilityText(action) {
  if (typeof action !== "string") return null;
  if (/flip a coin.*if heads.*coral.*stunned/i.test(action)) return { type: "flipCoin", successResult: "heads", onSuccess: { type: "stunCoral" } };
  const foundationDamageMatch = action.match(/\b(?:deal|inflict)\s+(\d+)\s*hp\s+damage\s+to\s+(?:an?\s+)?opponent(?:'s|â€™s)?\s+(creature school|coral)\b/i);
  if (foundationDamageMatch) return { type: "damageFoundation", amount: Number(foundationDamageMatch[1]), targetType: /creature school/i.test(foundationDamageMatch[2]) ? "creature-school" : "coral" };
  const resourceGainMatch = action.match(/\bgain\s+(\d+)\s*rp\b/i);
  if (resourceGainMatch) return { type: "gainResource", resource: "rp", amount: Number(resourceGainMatch[1]) };
  const reorderMatch = action.match(/(?:look at|look through) the top\s+(\d+|one|two|three|five)\s+cards?[^.]*rearrange/i);
  if (reorderMatch) {
    const words = { one: 1, two: 2, three: 3, five: 5 };
    return { type: "reorderTopDeck", amount: Number(reorderMatch[1]) || words[reorderMatch[1].toLowerCase()] };
  }
  const onPlayBonus = action.match(/next on play attack has \+(\d+)/i);
  if (onPlayBonus) return { type: "grantNextOnPlayAttackBonus", amount: Number(onPlayBonus[1]) };
  if (/discard up to two cards,?\s*draw as many cards/i.test(action)) return { type: "discardThenDraw", discard: { min: 1, max: 2 } };
  if (/discard two cards.*search your deck for a card/i.test(action)) return { type: "discardThenSearchDeck", discard: { amount: 2 }, search: { amount: 1 } };
  const drawMatch = !/discard.*draw as many/i.test(action) && action.match(/\bdraw\s+(\d+|one|two|three)\s+cards?\b/i);
  if (drawMatch) {
    const words = { one: 1, two: 2, three: 3 };
    return { type: "drawCards", amount: Number(drawMatch[1]) || words[drawMatch[1].toLowerCase()] };
  }
  if (/search your deck for/i.test(action)) {
    const categories = [];
    if (/\bfish\b/i.test(action)) categories.push("fish");
    if (/invertebrate/i.test(action)) categories.push("invertebrate");
    if (/predator/i.test(action)) categories.push("predator");
    return { type: "searchDeck", targetKind: /support card/i.test(action) ? "support" : /habitat/i.test(action) ? "habitat" : "creature", targetCategories: categories, targetZone: /\bdeep\b/i.test(action) ? "deep" : null, ...(/\btuna\b/i.test(action) ? { targetNameIncludes: "tuna" } : {}), amount: 1 };
  }
  if (/search your discard pile for a card/i.test(action)) return { type: "recoverCardFromDiscard", amount: 1, destination: /shuffle it into your deck/i.test(action) ? "deck" : "hand" };
  return null;
}

/**
 * Totals draw effects from structured actions and legacy printed action text.
 * Structured effects take precedence so a migrated action is never counted twice.
 */
export function getDrawCountFromActions(actions = []) {
  return actions.reduce((total, action) => {
    const structuredAmount = (action?.effects ?? []).reduce((sum, effect) =>
      sum + (effect.type === "drawCards" ? Math.max(0, Number(effect.amount ?? 0)) : 0), 0);
    if (structuredAmount) return total + structuredAmount;
    const legacyEffect = parseLegacyUtilityText(typeof action === "string" ? action : action?.text);
    return total + (legacyEffect?.type === "drawCards" ? Math.max(0, Number(legacyEffect.amount ?? 0)) : 0);
  }, 0);
}

/**
 * Totals immediate resource gains printed in On Play actions. Structured
 * effects take precedence over matching legacy text on the same action.
 */
export function getResourceGainFromActions(actions = [], resource = "rp") {
  const getStructuredAmount = (effects = []) => effects.reduce((total, effect) => {
    const ownAmount = effect?.type === "gainResource" && (effect.resource ?? "rp") === resource
      ? Math.max(0, Number(effect.amount ?? 0))
      : 0;
    return total + ownAmount + getStructuredAmount(effect?.effects) + getStructuredAmount(effect?.then ? [effect.then] : []);
  }, 0);

  return actions.reduce((total, action) => {
    const structuredAmount = getStructuredAmount(action?.effects);
    if (structuredAmount) return total + structuredAmount;
    const legacyEffect = parseLegacyUtilityText(typeof action === "string" ? action : action?.text);
    return total + (legacyEffect?.type === "gainResource" && legacyEffect.resource === resource ? Math.max(0, Number(legacyEffect.amount ?? 0)) : 0);
  }, 0);
}

/**
 * Resolves Foundation passives that grant RP for specifically named cards
 * attached to that Foundation. The card text remains authoritative, while the
 * Foundation instance supplies the actual attachments so duplicate cards are
 * counted independently.
 */
export function calculateAttachedCardRpBonus(foundation, cardLookup = {}) {
  const foundationCard = cardLookup[foundation?.cardId];
  if (!foundationCard) return 0;
  const attachedCardIds = (foundation?.slots ?? []).flatMap((slot) => [
    slot?.cardId,
    ...(slot?.hostedCardIds ?? []),
  ]).filter(Boolean);

  return (foundationCard.passives ?? []).reduce((total, passive) => {
    const text = typeof passive === "string" ? passive : passive?.text ?? "";
    const match = text.match(/collect\s+(\d+)\s*rp\s+for each\s+(.+?)\s+attached to this card/i);
    if (!match) return total;
    const amount = Math.max(0, Number(match[1]) || 0);
    const requiredName = match[2].trim().replace(/s$/i, "").toLowerCase();
    const matchingAttachments = attachedCardIds.filter((cardId) => {
      const attachedName = String(cardLookup[cardId]?.name ?? "").trim().replace(/s$/i, "").toLowerCase();
      return attachedName === requiredName;
    }).length;
    return total + amount * matchingAttachments;
  }, 0);
}

export function applyDamage(currentHealth, damage) {
  const health = Math.max(0, Number(currentHealth) || 0);
  const appliedDamage = Math.max(0, Number(damage) || 0);
  const remainingHealth = Math.max(0, health - appliedDamage);
  return { appliedDamage, remainingHealth, destroyed: remainingHealth === 0 };
}

/**
 * Resolves a mandatory heal for an automated controller. Only actual Coral
 * cards are legal targets (Creature Schools are Foundations, but not Corals),
 * and the most damaged Coral is chosen so the effect never wastes healing when
 * a better legal target is available.
 */
export function healMostDamagedCoral(foundations = [], amount = 0, cardLookup = {}) {
  const requestedHealing = Math.max(0, Number(amount) || 0);
  const missingHealth = (foundation) => {
    const card = cardLookup[foundation?.cardId];
    return Number(foundation?.maxHealth ?? card?.health ?? 0)
      - Number(foundation?.health ?? foundation?.maxHealth ?? card?.health ?? 0);
  };
  const target = foundations
    .filter((foundation) => cardLookup[foundation?.cardId]?.kind === "coral" && missingHealth(foundation) > 0)
    .sort((left, right) => missingHealth(right) - missingHealth(left))[0];

  if (!target || requestedHealing <= 0) {
    return { foundations, targetFoundationId: null, appliedHealing: 0 };
  }

  const targetCard = cardLookup[target.cardId];
  const currentHealth = Number(target.health ?? target.maxHealth ?? targetCard?.health ?? 0);
  const maxHealth = Number(target.maxHealth ?? targetCard?.health ?? 0);
  const nextHealth = Math.min(maxHealth, currentHealth + requestedHealing);
  return {
    foundations: foundations.map((foundation) => foundation.id === target.id
      ? { ...foundation, health: nextHealth }
      : foundation),
    targetFoundationId: target.id,
    appliedHealing: nextHealth - currentHealth,
  };
}

export const DAMAGE_COUNTER_HP = 10;

/**
 * Moves one damage counter between Foundation instances without changing the
 * ecosystem's total damage. The simulator represents one printed damage
 * counter as 10 HP. A move is illegal when the source does not have a complete
 * counter to remove or when placing the counter would destroy the destination.
 */
export function moveFoundationDamageCounter(
  foundations = [],
  { sourceFoundationId, destinationFoundationId, counterHp = DAMAGE_COUNTER_HP } = {},
) {
  const amount = Number(counterHp);
  const fail = (error) => ({ moved: false, error, amount: Number.isFinite(amount) ? amount : 0, foundations });

  if (!Array.isArray(foundations)) return fail("Foundation state is unavailable.");
  if (!Number.isFinite(amount) || amount <= 0) return fail("A damage counter must represent a positive amount of HP.");
  if (!sourceFoundationId || !destinationFoundationId) return fail("Choose both a source and destination coral.");
  if (sourceFoundationId === destinationFoundationId) return fail("Choose two different corals.");

  const sourceIndex = foundations.findIndex((foundation) => foundation?.id === sourceFoundationId);
  const destinationIndex = foundations.findIndex((foundation) => foundation?.id === destinationFoundationId);
  if (sourceIndex < 0) return fail("The source coral is no longer in your ecosystem.");
  if (destinationIndex < 0) return fail("The destination coral is no longer in your ecosystem.");

  const source = foundations[sourceIndex];
  const destination = foundations[destinationIndex];
  const sourceMaxHealth = Number(source.maxHealth);
  const sourceHealth = Number(source.health ?? source.maxHealth);
  const destinationMaxHealth = Number(destination.maxHealth);
  const destinationHealth = Number(destination.health ?? destination.maxHealth);
  if (![sourceMaxHealth, sourceHealth, destinationMaxHealth, destinationHealth].every(Number.isFinite)) {
    return fail("One of the selected corals has invalid health state.");
  }
  if (sourceMaxHealth - sourceHealth < amount) {
    return fail(`The source coral does not have a full ${amount} HP damage counter to move.`);
  }
  if (destinationHealth - amount <= 0) {
    return fail("Moving that counter would destroy the destination coral.");
  }

  return {
    moved: true,
    error: "",
    amount,
    foundations: foundations.map((foundation, index) => {
      if (index === sourceIndex) return { ...foundation, health: Math.min(sourceMaxHealth, sourceHealth + amount) };
      if (index === destinationIndex) return { ...foundation, health: destinationHealth - amount };
      return foundation;
    }),
  };
}

export function preserveDamageOnUpgrade(currentHealth, currentMaxHealth, nextMaxHealth) {
  const previousMax = Math.max(0, Number(currentMaxHealth) || 0);
  const previousHealth = Math.min(previousMax, Math.max(0, Number(currentHealth) || 0));
  const upgradedMax = Math.max(0, Number(nextMaxHealth) || 0);
  return Math.max(0, upgradedMax - (previousMax - previousHealth));
}

export function drawWithHandLimit(deck, handSize, drawCount, handLimit = Infinity) {
  const safeCount = Math.max(0, Number(drawCount) || 0);
  const drawnCards = deck.slice(0, safeCount);
  const availableSpace = Number.isFinite(handLimit) ? Math.max(0, Number(handLimit) - Math.max(0, Number(handSize) || 0)) : drawnCards.length;
  return {
    drawnCards,
    cardsToHand: drawnCards.slice(0, availableSpace),
    cardsToDiscard: drawnCards.slice(availableSpace),
    remainingDeck: deck.slice(drawnCards.length),
  };
}

export function getRequiredDrawShortfall(requiredDraws, completedDraws) {
  const required = Math.max(0, Math.trunc(Number(requiredDraws) || 0));
  const completed = Math.max(0, Math.trunc(Number(completedDraws) || 0));
  return Math.max(0, required - completed);
}

export function addResourceWithinCap(current, amount, cap) {
  return Math.min(Math.max(0, Number(cap) || 0), Math.max(0, Number(current) || 0) + Math.max(0, Number(amount) || 0));
}

/**
 * Transfers a shared resource without removing more than the recipient can
 * legally store. Any remainder is reported so a secondary source that is not
 * defined by the repository rules can be explained instead of guessed.
 */
export function resolveResourceTransfer({ requested = 0, sourceAmount = 0, recipientAmount = 0, recipientCap = Infinity } = {}) {
  const wanted = Math.max(0, Math.floor(Number(requested) || 0));
  const source = Math.max(0, Number(sourceAmount) || 0);
  const recipient = Math.max(0, Number(recipientAmount) || 0);
  const numericCap = Number(recipientCap);
  const cap = Number.isFinite(numericCap) ? Math.max(0, numericCap) : Infinity;
  const transferred = Math.min(wanted, source, Math.max(0, cap - recipient));
  return {
    requested: wanted,
    transferred,
    uncollected: wanted - transferred,
    sourceAfter: source - transferred,
    recipientAfter: recipient + transferred,
  };
}

export const DEFAULT_RP_BANK_CAP = 8;

/**
 * Returns the continuous RP-bank-cap modifier printed on a card in play.
 *
 * Newer card records expose this as a structured modifyRpBankCap effect, while
 * legacy deck records still describe EcoBoost in passive text. A structured
 * effect takes precedence for that passive so migrated cards are not counted
 * twice when they retain their human-readable rules text.
 */
export function getCardRpBankCapModifier(card) {
  return (card?.passives ?? []).reduce((total, passive) => {
    const effect = typeof passive === "object" ? passive.effect : null;
    if (effect?.type === "modifyRpBankCap") {
      return total + (Number(effect.amount) || 0);
    }

    const text = typeof passive === "string" ? passive : passive?.text;
    if (!text || !/eco\s*boost/i.test(text)) return total;
    const match = text.match(/eco\s*boost\s*:\s*(?:add\s*)?\+?(\d+)(?:\s*rp)?\s*(?:to\s+your\s+bank\s+cap|to\s+your\s+max\s+resource\s+bank)/i);
    return total + (match ? Number(match[1]) : 0);
  }, 0);
}

/** Returns the RP-bank-cap modifier supplied by the currently active condition. */
export function getConditionRpBankCapModifier(activeCondition = null) {
  return (activeCondition?.effects ?? []).reduce((total, effect) =>
    total + (effect.type === "modifyRpBankCap" ? (Number(effect.amount) || 0) : 0), 0);
}

/**
 * Calculates one player's live RP bank cap from cards currently in that
 * player's ecosystem and the shared active condition.
 */
export function calculateRpBankCap(cardsInPlay = [], activeCondition = null, baseCap = DEFAULT_RP_BANK_CAP) {
  const ecosystemModifier = cardsInPlay.reduce(
    (total, card) => total + getCardRpBankCapModifier(card),
    0,
  );
  return Math.max(0, (Number(baseCap) || 0) + getConditionRpBankCapModifier(activeCondition) + ecosystemModifier);
}

export function calculateVictoryPoints(cardsInPlay, cardIdsInPlay = cardsInPlay.map((card) => card?.id)) {
  return cardsInPlay.reduce((total, card) => {
    if (!card) return total;
    const bonus = card.bonusVictoryPoints;
    const conditionMet = !bonus?.condition || bonus.condition.type !== "cardInPlay" || cardIdsInPlay.includes(bonus.condition.cardId);
    let bonusAmount = 0;
    if (bonus && conditionMet) {
      bonusAmount = bonus.type === "perCardOnReef"
        ? Number(bonus.amount ?? 0) * cardIdsInPlay.filter((cardId) => cardId === bonus.targetCardId).length
        : Number(bonus.amount ?? 0);
    }
    return total + Number(card.victoryPoints ?? 0) + bonusAmount;
  }, 0);
}

export function determineVictoryResult(playerVp, opponentVp, target) {
  const player = Math.max(0, Number(playerVp) || 0);
  const opponent = Math.max(0, Number(opponentVp) || 0);
  const goal = Math.max(1, Number(target) || 1);
  if (player < goal && opponent < goal) return null;
  if (player >= goal && opponent >= goal) {
    return player >= opponent
      ? { winner: "player", message: `Victory: you reached ${player} VP against the opponent's ${opponent} VP.` }
      : { winner: "opponent", message: `Defeat: the opponent reached ${opponent} VP against your ${player} VP.` };
  }
  return player >= goal
    ? { winner: "player", message: `Victory: you reached the ${goal} VP target.` }
    : { winner: "opponent", message: `Defeat: the opponent reached the ${goal} VP target.` };
}

export function halfCostRoundedUp(cost) {
  return Math.ceil(Math.max(0, Number(cost) || 0) / 2);
}

/**
 * Resolves Blue Crab's once-per-turn recovery for one defeated Fish. Keeping
 * the eligibility and bank-cap math together prevents special board zones
 * (such as an opponent-owned invasive creature) from drifting from ordinary
 * combat resolution.
 */
export function resolveBlueCrabRecycle({
  defeatedCardIsFish = false,
  defeatedCardIsCreatureSchool = false,
  defeatedCardRpCost = 0,
  controllerHasBlueCrab = false,
  recycleUsedTurn = null,
  currentTurn = null,
  currentRp = 0,
  rpCap = Infinity,
} = {}) {
  const triggered = Boolean(
    defeatedCardIsFish
      && !defeatedCardIsCreatureSchool
      && controllerHasBlueCrab
      && recycleUsedTurn !== currentTurn
  );
  const nominalRecoveredRp = triggered ? halfCostRoundedUp(defeatedCardRpCost) : 0;
  const rpAfter = triggered
    ? addResourceWithinCap(currentRp, nominalRecoveredRp, rpCap)
    : Math.max(0, Number(currentRp) || 0);
  return {
    triggered,
    nominalRecoveredRp,
    recoveredRp: rpAfter - Math.max(0, Number(currentRp) || 0),
    rpAfter,
    recycleUsedTurnAfter: triggered ? currentTurn : recycleUsedTurn,
  };
}

export function reconcileContinuousHealth(currentHealth, currentMaxHealth, printedMaxHealth, bonus) {
  const currentMax = Math.max(0, Number(currentMaxHealth) || 0);
  const desiredMax = Math.max(0, (Number(printedMaxHealth) || 0) + (Number(bonus) || 0));
  const health = Math.max(0, Math.min(desiredMax, (Number(currentHealth) || 0) + desiredMax - currentMax));
  return { health, maxHealth: desiredMax, destroyed: health === 0 };
}

export function resolveConditionalDiceDamage({ dice, multiplier = 1, fallbackAmount = 0, conditionMet = true }, random = Math.random) {
  if (!conditionMet) return { damage: Math.max(0, Number(fallbackAmount) || 0), roll: null };
  const roll = rollDie(dice, random);
  return { damage: roll ? roll.total * Math.max(0, Number(multiplier) || 0) : Math.max(0, Number(fallbackAmount) || 0), roll };
}

export function isEcosystemConditionMet(condition, habitatIds = [], cardsInPlay = []) {
  if (!condition?.type) return false;
  if (condition.type === "cardInPlay") return cardsInPlay.some((card) => card?.id === condition.cardId) || habitatIds.includes(condition.cardId);
  if (condition.type === "kindInPlay") {
    if (condition.requiredKind === "habitat") return habitatIds.length > 0;
    return cardsInPlay.some((card) => card?.kind === condition.requiredKind);
  }
  return false;
}

export function calculateAttachedHostHealthBonus(attachedCards = []) {
  const uniqueEffects = new Set();
  return attachedCards.reduce((total, card) => total + (card?.passives ?? []).reduce((cardTotal, passive) => {
    const effect = typeof passive === "object" ? passive.effect : null;
    if (effect?.type !== "modifyHealth" || effect.target?.relationship !== "attachedHost") return cardTotal;
    const uniqueKey = effect.stacking === "uniquePerHost" ? passive.id ?? `${card.id}:modifyHealth` : null;
    if (uniqueKey && uniqueEffects.has(uniqueKey)) return cardTotal;
    if (uniqueKey) uniqueEffects.add(uniqueKey);
    return cardTotal + Number(effect.amount ?? 0);
  }, 0), 0);
}

export function calculateAttachedCreatureDefenseBonus(foundationCard) {
  return (foundationCard?.passives ?? []).reduce((total, passive) => {
    const text = typeof passive === "string" ? passive : passive?.text ?? "";
    const match = text.match(/creatures attached to this coral gain \+(\d+) on their defensive dice rolls/i);
    return total + Number(match?.[1] ?? 0);
  }, 0);
}

export function redistributeOrphans(foundations = [], orphanEntries = [], canOccupy = () => false) {
  const remaining = orphanEntries.map((entry) => typeof entry === "string"
    ? { cardId: entry, hostedCardIds: [] }
    : { ...entry, hostedCardIds: [...(entry.hostedCardIds ?? [])] });
  const corals = foundations.map((foundation) => ({
    ...foundation,
    slots: (foundation.slots ?? []).map((slot) => {
      if (slot.cardId) return slot;
      const orphanIndex = remaining.findIndex((entry) => canOccupy(entry.cardId, slot, entry));
      if (orphanIndex < 0) return slot;
      const [orphan] = remaining.splice(orphanIndex, 1);
      const {
        controller: _previousController,
        invasiveOwner: _previousInvasiveOwner,
        ...emptySlot
      } = slot;
      return {
        ...emptySlot,
        cardId: orphan.cardId,
        cardInstanceId: orphan.instanceId ?? orphan.cardInstanceId ?? slot.cardInstanceId ?? null,
        hostedCardIds: orphan.hostedCardIds,
        hostedSchoolDensityRequirements: [...(orphan.hostedSchoolDensityRequirements ?? [])],
        ...(Object.prototype.hasOwnProperty.call(orphan, "controller") ? { controller: orphan.controller } : {}),
        ...(Object.prototype.hasOwnProperty.call(orphan, "invasiveOwner") ? { invasiveOwner: orphan.invasiveOwner } : {}),
      };
    }),
  }));
  return { corals, orphans: remaining };
}

export function createSeededRandom(seed = 1) {
  let state = Number(seed) >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
