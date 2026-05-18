import { cardsById } from "@/data/cards";
import { EffectType } from "@/data/cards/types";

const CLASS_LABELS = {
  apex: "Apex",
  predator: "Predator",
  fish: "Fish",
  invertebrate: "Invertebrate",
  "filter-feeder": "Filter Feeder",
};

const OFFENSE_EFFECTS = new Set([
  EffectType.ATTACK,
  EffectType.DAMAGE,
  EffectType.DISCARD_RANDOM_CARD,
  EffectType.STUN_CORAL,
  EffectType.PREVENT_CARD_PLAY,
  "attack",
  "damage",
  "discardRandomCard",
  "stunCoral",
  "preventCardPlay",
  "grantAdvantage",
]);

const ECONOMY_EFFECTS = new Set([
  EffectType.GAIN_RESOURCE,
  EffectType.MODIFY_PLAY_COST,
  EffectType.MODIFY_RP_BANK_CAP,
  EffectType.MODIFY_RP_GENERATION,
  EffectType.RECYCLE_ON_EATEN,
  EffectType.ROLL_DICE_FOR_RESOURCE,
  "gainResource",
  "modifyPlayCost",
  "modifyRpBankCap",
  "modifyRpGeneration",
  "recycleOnEaten",
  "rollDiceForResource",
]);

const CONSISTENCY_EFFECTS = new Set([
  EffectType.DRAW_CARDS,
  EffectType.SEARCH_DECK,
  EffectType.RECOVER_CARD_FROM_DISCARD,
  EffectType.MOVE_CARD,
  "drawCards",
  "searchDeck",
  "recoverCardFromDiscard",
  "moveCard",
  "peekAndReorderDeck",
  "chooseFromTopDeck",
  "discardThenSearchDeck",
]);

const DEFENSE_EFFECTS = new Set([
  EffectType.GRANT_DEFENSE_ADVANTAGE,
  EffectType.MODIFY_DEFENSE_ROLL,
  EffectType.MODIFY_HEALTH,
  EffectType.GRANT_CONDITION,
  EffectType.IGNORE_EFFECT,
  "grantDefenseAdvantage",
  "modifyDefenseRoll",
  "modifyHealth",
  "grantCondition",
  "ignoreEffect",
  "heal",
]);

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeTraitScore(score, totalCards) {
  if (!totalCards) return 0;

  return clampScore((score / totalCards) * 10);
}

function diceValue(dice) {
  if (!dice || typeof dice !== "string") return 0;
  const match = dice.match(/D(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function collectEffects(value, effects = []) {
  if (!value || typeof value !== "object") return effects;

  if (value.type) {
    effects.push(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectEffects(item, effects);
    }
    return effects;
  }

  for (const child of Object.values(value)) {
    if (child && typeof child === "object") {
      collectEffects(child, effects);
    }
  }

  return effects;
}

function getCardEffects(card) {
  return collectEffects([
    card.passives,
    card.onPlay,
    card.actions,
    card.playRequirements,
    card.effect,
    card.effects,
  ]);
}

function hasEffectType(effects, targetTypes) {
  return effects.some((effect) => targetTypes.has(effect.type));
}

function getAttackScore(effects) {
  return effects.reduce((score, effect) => {
    if (effect.type !== EffectType.ATTACK && effect.type !== "attack") {
      return score;
    }

    const repeat = Number(effect.repeat ?? 1);
    return score + diceValue(effect.attackDice) * repeat;
  }, 0);
}

function getDamageScore(effects) {
  return effects.reduce((score, effect) => {
    if (effect.type !== EffectType.DAMAGE && effect.type !== "damage") {
      return score;
    }

    const amount = effect.amount;
    if (typeof amount === "number") return score + amount / 5;
    if (amount?.type === "fixed") return score + Number(amount.value ?? 0) / 5;
    if (amount?.type === "dice") {
      return score + (diceValue(amount.dice) * Number(amount.multiplier ?? 1)) / 8;
    }

    return score + 4;
  }, 0);
}

function effectAmount(effect) {
  if (typeof effect.amount === "number") return effect.amount;
  if (typeof effect.value === "number") return effect.value;
  if (effect.amount?.type === "fixed") return Number(effect.amount.value ?? 0);
  return 0;
}

function targetsOpponent(effect) {
  return (
    effect.target?.controller === "opponent" ||
    effect.targetPlayer === "opponent"
  );
}

function targetsYou(effect) {
  return effect.target?.controller === "you" || effect.targetPlayer === "you";
}

function getCardTraitScores(card, effects, rpCost) {
  const scores = {
    offense: 0,
    defense: 0,
    economy: 0,
    consistency: 0,
    tempo: 0,
  };

  const attackScore = getAttackScore(effects);
  const damageScore = getDamageScore(effects);
  const cheapness = Math.max(0, 6 - rpCost);

  scores.offense += attackScore * 0.9 + damageScore * 1.2;
  scores.defense += diceValue(card.defense?.dice) * 0.9;
  scores.tempo += cheapness * 0.7;

  if (card.health) {
    scores.defense += Number(card.health) / 12;
  }

  if (card.kind === "support") {
    scores.tempo += 2;
  }

  if (card.category === "apex" || card.category === "predator") {
    scores.offense += Number(card.victoryPoints ?? 0) * 0.8;
  }

  if (card.category === "filter-feeder") {
    scores.defense += Number(card.victoryPoints ?? 0) * 0.45;
  }

  for (const effect of effects) {
    const amount = effectAmount(effect);

    if (OFFENSE_EFFECTS.has(effect.type)) {
      scores.offense += targetsOpponent(effect) ? 5 : 3;
    }

    if (
      effect.type === EffectType.MODIFY_RP_GENERATION ||
      effect.type === "modifyRpGeneration"
    ) {
      if (targetsOpponent(effect) && amount < 0) {
        scores.offense += Math.abs(amount) * 8;
        scores.tempo += Math.abs(amount) * 2;
      } else if (targetsYou(effect) && amount > 0) {
        scores.economy += amount * 8;
      }
    }

    if (
      effect.type === EffectType.GAIN_RESOURCE ||
      effect.type === "gainResource" ||
      effect.type === EffectType.MODIFY_RP_BANK_CAP ||
      effect.type === "modifyRpBankCap" ||
      effect.type === EffectType.RECYCLE_ON_EATEN ||
      effect.type === "recycleOnEaten" ||
      effect.type === EffectType.ROLL_DICE_FOR_RESOURCE ||
      effect.type === "rollDiceForResource"
    ) {
      scores.economy += 8;
    }

    if (
      effect.type === EffectType.MODIFY_PLAY_COST ||
      effect.type === "modifyPlayCost"
    ) {
      scores.economy += targetsYou(effect) ? 7 : 0;
      scores.offense += targetsOpponent(effect) ? 5 : 0;
    }

    if (
      effect.type === EffectType.DRAW_CARDS ||
      effect.type === "drawCards"
    ) {
      scores.consistency += Math.max(1, Number(effect.amount ?? 1)) * 5;
      scores.tempo += 2;
    }

    if (
      effect.type === EffectType.SEARCH_DECK ||
      effect.type === "searchDeck"
    ) {
      scores.consistency += Math.max(1, Number(effect.amount ?? 1)) * 7;
    }

    if (
      effect.type === EffectType.RECOVER_CARD_FROM_DISCARD ||
      effect.type === "recoverCardFromDiscard" ||
      effect.type === EffectType.MOVE_CARD ||
      effect.type === "moveCard" ||
      effect.type === "peekAndReorderDeck" ||
      effect.type === "chooseFromTopDeck" ||
      effect.type === "discardThenSearchDeck"
    ) {
      scores.consistency += 5;
    }

    if (
      effect.type === EffectType.MODIFY_HEALTH ||
      effect.type === "modifyHealth" ||
      effect.type === EffectType.GRANT_DEFENSE_ADVANTAGE ||
      effect.type === "grantDefenseAdvantage" ||
      effect.type === EffectType.MODIFY_DEFENSE_ROLL ||
      effect.type === "modifyDefenseRoll" ||
      effect.type === EffectType.IGNORE_EFFECT ||
      effect.type === "ignoreEffect" ||
      effect.type === "heal"
    ) {
      scores.defense += Math.max(6, Math.abs(amount) / 2 || 6);
    }

    if (
      effect.type === EffectType.GRANT_CONDITION ||
      effect.type === "grantCondition"
    ) {
      scores.defense += 4;
      scores.offense += effect.duration === "nextAttack" ? 4 : 0;
    }

    if (
      effect.type === EffectType.DISCARD_RANDOM_CARD ||
      effect.type === "discardRandomCard" ||
      effect.type === EffectType.PREVENT_CARD_PLAY ||
      effect.type === "preventCardPlay" ||
      effect.type === EffectType.STUN_CORAL ||
      effect.type === "stunCoral"
    ) {
      scores.offense += 7;
      scores.tempo += 3;
    }
  }

  if (card.playRequirements?.length) {
    scores.consistency -= 2;
    scores.tempo -= 2;
  }

  return scores;
}

export function getDeckAnalytics(cards = []) {
  const analytics = {
    totalCards: 0,
    totalVictoryPoints: 0,
    averageRpCost: 0,
    classBars: Object.entries(CLASS_LABELS).map(([category, label]) => ({
      category,
      label,
      victoryPoints: 0,
      percent: 0,
    })),
    traitBars: [
      { label: "Offense", value: 0 },
      { label: "Defense", value: 0 },
      { label: "Economy", value: 0 },
      { label: "Consistency", value: 0 },
      { label: "Tempo", value: 0 },
    ],
  };

  const classVp = Object.fromEntries(
    Object.keys(CLASS_LABELS).map((category) => [category, 0])
  );

  let totalCost = 0;
  let costedCards = 0;
  let offense = 0;
  let defense = 0;
  let economy = 0;
  let consistency = 0;
  let tempo = 0;

  for (const entry of cards) {
    const card = cardsById[entry.cardId];
    const quantity = Number(entry.quantity);

    if (!card || !Number.isInteger(quantity) || quantity <= 0) continue;

    const victoryPoints = Number(card.victoryPoints ?? 0) * quantity;
    const rpCost = Number(card.cost?.rp ?? 0);
    const effects = getCardEffects(card);

    analytics.totalCards += quantity;
    analytics.totalVictoryPoints += victoryPoints;
    totalCost += rpCost * quantity;
    costedCards += card.cost?.rp != null ? quantity : 0;

    if (card.category in classVp) {
      classVp[card.category] += victoryPoints;
    }

    const traitScores = getCardTraitScores(card, effects, rpCost);
    offense += traitScores.offense * quantity;
    defense += traitScores.defense * quantity;
    economy += traitScores.economy * quantity;
    consistency += traitScores.consistency * quantity;
    tempo += traitScores.tempo * quantity;
  }

  analytics.averageRpCost = costedCards ? totalCost / costedCards : 0;
  analytics.classBars = analytics.classBars
    .map((bar) => ({
      ...bar,
      victoryPoints: classVp[bar.category],
      percent: analytics.totalVictoryPoints
        ? clampScore((classVp[bar.category] / analytics.totalVictoryPoints) * 100)
        : 0,
    }))
    .sort((a, b) => b.victoryPoints - a.victoryPoints);

  offense = Math.max(0, offense);
  defense = Math.max(0, defense);
  economy = Math.max(0, economy);
  consistency = Math.max(0, consistency);
  tempo = Math.max(0, tempo);

  analytics.traitBars = [
    {
      label: "Offense",
      value: normalizeTraitScore(offense, analytics.totalCards),
    },
    {
      label: "Defense",
      value: normalizeTraitScore(defense, analytics.totalCards),
    },
    {
      label: "Economy",
      value: normalizeTraitScore(economy, analytics.totalCards),
    },
    {
      label: "Consistency",
      value: normalizeTraitScore(consistency, analytics.totalCards),
    },
    {
      label: "Tempo",
      value: normalizeTraitScore(tempo, analytics.totalCards),
    },
  ];

  return analytics;
}
