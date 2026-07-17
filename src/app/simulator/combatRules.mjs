import { rollDie } from "./gameRules.mjs";

function passiveText(passive) {
  return typeof passive === "string"
    ? passive
    : [passive?.name, passive?.text].filter(Boolean).join(": ");
}

function passiveEffect(passive) {
  return typeof passive === "object" ? passive?.effect : null;
}

function safePositiveInteger(value, fallback = 1) {
  const numericValue = Math.floor(Number(value));
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback;
}

export function getDarknessShroudDefenseBonus(card, habitatCardIds = []) {
  if (!habitatCardIds.includes("abyss")) return 0;
  const darknessRule = (card?.passives ?? [])
    .map(passiveText)
    .find((text) => /darkness shroud/i.test(text));
  const amount = darknessRule?.match(/\+(\d+)\s*(?:to\s+)?defen[cs]e/i)?.[1];
  return Math.max(0, Number(amount ?? 0));
}

/**
 * Cloak is a defensive keyword, not a targeting restriction. Future cards
 * carrying Cloak stay legal attack targets and receive a flat +3 defense.
 * Cloak in Darkness is a separately named activated action and is therefore
 * intentionally not inferred from a card's action list here.
 */
export function getCloakDefenseBonus(card) {
  const hasCloak = (card?.passives ?? [])
    .map(passiveText)
    .some((text) => /^cloak(?:\s*:|\b)/i.test(String(text).trim()));
  return hasCloak ? 3 : 0;
}

export function getRovLightsAttackBonus(isActive, targetCard) {
  return isActive && targetCard?.zone === "deep" ? 2 : 0;
}

/**
 * Creates serializable state for an interactive repeated-attack sequence.
 * Each recorded entry represents exactly one resolved attack. A target instance
 * ID may occur only once, even when multiple copies of the same card are in play.
 */
export function createAttackSequence(repeat = 1) {
  return {
    requiredAttacks: safePositiveInteger(repeat),
    resolutions: [],
    complete: false,
  };
}

export function getUsedAttackTargetInstanceIds(sequence) {
  return (sequence?.resolutions ?? []).map((entry) => entry.targetInstanceId);
}

export function canTargetInAttackSequence(sequence, targetInstanceId) {
  if (sequence?.complete) return false;
  if (typeof targetInstanceId !== "string" || !targetInstanceId.trim()) return false;
  return !getUsedAttackTargetInstanceIds(sequence).includes(targetInstanceId);
}

/**
 * Records one already-resolved attack. Invalid/duplicate targets are rejected
 * without changing the sequence, which keeps dice resolution outside this state
 * helper and prevents one roll/result from being reused for repeated attacks.
 */
export function recordAttackResolution(sequence, { targetInstanceId, resolution } = {}) {
  const state = sequence ?? createAttackSequence();
  if (state.complete || state.resolutions.length >= state.requiredAttacks) {
    return { accepted: false, error: "This attack sequence is already complete.", sequence: state };
  }
  if (typeof targetInstanceId !== "string" || !targetInstanceId.trim()) {
    return { accepted: false, error: "Choose a target instance for this attack.", sequence: state };
  }
  if (!canTargetInAttackSequence(state, targetInstanceId)) {
    return { accepted: false, error: "Each attack in this sequence must target a different card instance.", sequence: state };
  }
  if (resolution === undefined) {
    return { accepted: false, error: "Resolve this attack before recording it.", sequence: state };
  }

  const resolutions = [
    ...state.resolutions,
    {
      attackNumber: state.resolutions.length + 1,
      targetInstanceId,
      resolution,
    },
  ];
  const nextSequence = {
    requiredAttacks: state.requiredAttacks,
    resolutions,
    complete: resolutions.length >= state.requiredAttacks,
  };
  return { accepted: true, error: "", sequence: nextSequence };
}

export function getRemainingAttackTargets(sequence, targetEntries = []) {
  const usedIds = new Set(getUsedAttackTargetInstanceIds(sequence));
  return targetEntries.filter((entry) => {
    const instanceId = typeof entry === "string" ? entry : entry?.instanceId;
    return typeof instanceId === "string" && instanceId.length > 0 && !usedIds.has(instanceId);
  });
}

/**
 * Card data currently has both printed Massive variants. Creature Schools make
 * attacks roll with disadvantage, while whale-style Massive rolls defense with
 * advantage. Returning the mode avoids treating the two as interchangeable.
 */
export function getMassiveDefenseMode(card) {
  const texts = (card?.passives ?? []).map(passiveText);
  if (texts.some((text) => /\bmassive\b.*advantage on defensive (?:dice )?rolls?/i.test(text))) {
    return "defenseAdvantage";
  }
  if (texts.some((text) => /\bmassive\b.*attacks? have disadvantage/i.test(text))) {
    return "attackDisadvantage";
  }
  return null;
}

export function hasDefenseAdvantage({ targetCard, statuses = [], ignoreDefensiveBonuses = false } = {}) {
  if (ignoreDefensiveBonuses) return false;
  return getMassiveDefenseMode(targetCard) === "defenseAdvantage"
    || statuses.some((status) => status?.type === "defenseAdvantage" || status?.type === "grantDefenseAdvantage");
}

export function attackerHasDisadvantageFromMassive(targetCard) {
  return getMassiveDefenseMode(targetCard) === "attackDisadvantage";
}

/**
 * Some creatures restrict the size of the attack die that may target them.
 * The printed die, rather than a flat modifier, determines whether the target
 * is legal (for example, D4+2 is still a D4 attack for Transparency).
 */
export function attackDieCanTargetCard(attackExpression, targetCard) {
  const restriction = (targetCard?.passives ?? [])
    .map(passiveText)
    .map((text) => text.match(/attack rolls? of more than a D(\d+) cannot target this creature/i))
    .find(Boolean);
  if (!restriction) return true;

  const attackFaces = String(attackExpression ?? "").match(/D(\d+)/i)?.[1];
  if (!attackFaces) return false;
  return Number(attackFaces) <= Number(restriction[1]);
}

export function attackCanTargetCard(targetCard, attack) {
  if (!targetCard || !attackDieCanTargetCard(attack?.attackDice, targetCard)) return false;
  const categories = attack?.target?.categories ?? [];
  const targetTags = attack?.targetTags ?? attack?.target?.tags ?? [];
  const targetZone = attack?.targetZone ?? attack?.target?.zone ?? null;
  if (categories.length && !categories.includes(targetCard.category)) return false;
  if (targetTags.length && !targetTags.some((tag) => targetCard.tags?.includes(tag))) return false;
  // The caller selects which player's board is searched. Card definitions use
  // these values to describe board ownership, not a creature's ecological zone.
  if (targetZone === "yourReef" || targetZone === "opponentReef") return true;
  return !targetZone || targetCard.zone === targetZone;
}

/** Rolls a defense die once, or twice and keeps the higher result with advantage. */
export function resolveDefenseRoll(
  defenseExpression,
  {
    targetCard = null,
    statuses = [],
    ignoreDefensiveBonuses = false,
    flatModifier = 0,
    random = Math.random,
  } = {},
) {
  const first = rollDie(defenseExpression, random);
  if (!first) return { resolved: false, rolls: [], total: 0, hasAdvantage: false };

  const advantage = hasDefenseAdvantage({ targetCard, statuses, ignoreDefensiveBonuses });
  const second = advantage ? rollDie(defenseExpression, random) : null;
  const chosen = second && second.total > first.total ? second : first;
  const modifier = ignoreDefensiveBonuses ? 0 : Number(flatModifier) || 0;
  return {
    resolved: true,
    rolls: second ? [first, second] : [first],
    total: Math.max(0, chosen.total + modifier),
    hasAdvantage: advantage,
  };
}

export function isToxicWhenConsumed(card) {
  return (card?.passives ?? []).some((passive) => {
    const effect = passiveEffect(passive);
    return effect?.type === "toxicWhenEaten"
      || /if eaten.*consuming creature/i.test(passiveText(passive));
  });
}

/** Supports source-specific immunity such as Giant Triton versus Crown of Thorns. */
export function hasExplicitToxicImmunity(attackerCard, toxicSourceCard) {
  return (attackerCard?.passives ?? []).some((passive) => {
    const effect = passiveEffect(passive);
    if (effect?.type !== "ignoreEffect" || effect?.ignoredEffectType !== "toxicWhenEaten") return false;
    return !effect.sourceCardId || effect.sourceCardId === toxicSourceCard?.id;
  });
}

/**
 * Resolves Toxic only after a target was consumed. Any creature can be a
 * consuming attacker. Poison Heal protects the next attacker regardless of
 * class, while structured card immunity can be source-specific.
 */
export function resolveToxicConsumption(
  {
    attackerCard = null,
    toxicSourceCard = null,
    consumed = false,
    poisonHealActive = false,
  } = {},
  random = Math.random,
) {
  const toxic = consumed && isToxicWhenConsumed(toxicSourceCard);
  if (!toxic) {
    return {
      triggered: false,
      protected: false,
      protectionSource: null,
      coinResult: null,
      discardAttacker: false,
    };
  }

  if (hasExplicitToxicImmunity(attackerCard, toxicSourceCard)) {
    return {
      triggered: true,
      protected: true,
      protectionSource: "cardImmunity",
      coinResult: null,
      discardAttacker: false,
    };
  }

  if (poisonHealActive) {
    return {
      triggered: true,
      protected: true,
      protectionSource: "poisonHeal",
      coinResult: null,
      discardAttacker: false,
    };
  }

  const coinResult = random() < 0.5 ? "tails" : "heads";
  return {
    triggered: true,
    protected: false,
    protectionSource: null,
    coinResult,
    discardAttacker: coinResult === "tails",
  };
}

export function shouldSelfDiscardAfterConsume({ attackerCard = null, defenderCard = null, consumed = false } = {}) {
  if (!consumed || !attackerCard || !defenderCard) return false;
  const explicitCategories = attackerCard.selfDiscardAfterConsumeCategories;
  if (Array.isArray(explicitCategories)) return explicitCategories.includes(defenderCard.category);
  const rule = (attackerCard.onPlay ?? []).map((action) => typeof action === "string" ? action : action?.text ?? "").find((text) => /successfully consume.*discard this card/i.test(text));
  if (!rule) return false;
  const categories = [];
  if (/consume[^.]*\bapex\b/i.test(rule)) categories.push("apex");
  if (/consume[^.]*\bpredator\b/i.test(rule)) categories.push("predator");
  if (/consume[^.]*filter feeder/i.test(rule)) categories.push("filter-feeder");
  return categories.length ? categories.includes(defenderCard.category) : /consume (?:a|any) card/i.test(rule);
}

export function cardHasRegenerate(card) {
  return (card?.passives ?? []).some((passive) => /\bregenerate\b.*may spend\s*1\s*rp.*keep this card/i.test(passiveText(passive)));
}

/**
 * Returns a pending choice; it never spends RP or keeps the defender by itself.
 */
export function createRegenerateDecision(
  {
    defenderCard = null,
    defenderWasDefeated = false,
    controllerRp = 0,
    survivalAlreadyApplied = false,
  } = {},
) {
  const available = Boolean(
    defenderWasDefeated
      && !survivalAlreadyApplied
      && cardHasRegenerate(defenderCard)
      && Number(controllerRp) >= 1,
  );
  return {
    available,
    pending: available,
    cost: 1,
    defenderCardId: defenderCard?.id ?? null,
    reason: available
      ? "Choose whether to spend 1 RP to keep this card in play."
      : "Regenerate is not available for this resolution.",
  };
}

export function resolveRegenerateDecision(decision, choice) {
  if (!decision?.available || !decision?.pending) {
    return { resolved: false, error: "There is no pending Regenerate choice.", keepDefender: false, rpCost: 0 };
  }
  if (choice !== "regenerate" && choice !== "discard") {
    return { resolved: false, error: "Choose Regenerate or discard.", keepDefender: false, rpCost: 0 };
  }
  return choice === "regenerate"
    ? { resolved: true, error: "", keepDefender: true, rpCost: decision.cost }
    : { resolved: true, error: "", keepDefender: false, rpCost: 0 };
}
