import { resolveOpposedRoll } from "./gameRules.mjs";

export const LIONFISH_CARD_ID = "lionfish";
export const LIONFISH_INVADER_ATTACK_DICE = "D4-1";

function getAbilityController(entry) {
  const controller = entry?.controller ?? null;
  const invasiveOwner = entry?.invasiveOwner ?? null;
  if (controller && invasiveOwner && controller !== invasiveOwner) return null;
  return invasiveOwner ?? controller;
}

function getOtherController(controller) {
  if (controller === "player") return "opponent";
  if (controller === "opponent") return "player";
  return null;
}

function isController(controller) {
  return controller === "player" || controller === "opponent";
}

/**
 * Finds foreign Lionfish physically present in the controller whose turn is
 * starting. Foundation/slot order is preserved, followed by orphan order.
 */
export function collectHostTurnLionfishInvaders({
  foundations = [],
  orphanEntries = [],
  hostController,
} = {}) {
  if (!isController(hostController)) return [];
  const slotted = foundations.flatMap((foundation) => (foundation?.slots ?? []).flatMap((slot) => {
    const controller = getAbilityController(slot);
    if (slot?.cardId !== LIONFISH_CARD_ID || !controller || controller === hostController) return [];
    return [{
      location: "slot",
      coralId: foundation.id,
      slotId: slot.id,
      instanceId: slot.cardInstanceId ?? slot.instanceId ?? `${foundation.id}:${slot.id}:${slot.cardId}`,
      cardId: slot.cardId,
      controller,
    }];
  }));

  const orphaned = orphanEntries.flatMap((entry, orphanIndex) => {
    const controller = getAbilityController(entry);
    if (entry?.cardId !== LIONFISH_CARD_ID || !controller || controller === hostController) return [];
    return [{
      location: "orphan",
      orphanIndex,
      instanceId: entry.instanceId ?? entry.cardInstanceId ?? `orphan:${orphanIndex}:${entry.cardId}`,
      cardId: entry.cardId,
      controller,
    }];
  });

  return [...slotted, ...orphaned];
}

/** One mandatory Invader flip. The caller supplies deterministic RNG in tests. */
export function resolveLionfishInvaderCoin(random = Math.random) {
  return random() < 0.5 ? "heads" : "tails";
}

/** Heads attacks the ability owner's opponent; tails attacks its owner. */
export function getLionfishInvaderTargetController({ invaderController, coinResult } = {}) {
  if (coinResult === "tails") return isController(invaderController) ? invaderController : null;
  if (coinResult === "heads") return getOtherController(invaderController);
  return null;
}

/**
 * Selects one stable candidate while excluding the source. `scoreTarget` is
 * optional; ties keep input order so UI and AI callers receive deterministic
 * behavior. Passing no scorer returns the first legal candidate.
 */
export function selectLionfishInvaderTarget(
  targets = [],
  { sourceInstanceId = null, scoreTarget = null } = {},
) {
  const seen = new Set();
  const candidates = targets.filter((target) => {
    if (!target?.instanceId || target.instanceId === sourceInstanceId || seen.has(target.instanceId)) return false;
    seen.add(target.instanceId);
    return true;
  });
  if (!candidates.length) return null;
  if (typeof scoreTarget !== "function") return candidates[0];

  let bestTarget = candidates[0];
  let bestScore = Number(scoreTarget(bestTarget, 0));
  for (let index = 1; index < candidates.length; index += 1) {
    const score = Number(scoreTarget(candidates[index], index));
    if (Number.isFinite(score) && (!Number.isFinite(bestScore) || score > bestScore)) {
      bestTarget = candidates[index];
      bestScore = score;
    }
  }
  return bestTarget;
}

/**
 * Filters already-normalized attack targets after the coin has chosen a
 * controller. Input order and first occurrence win; there is no cross-branch
 * fallback. Callers may provide their normal attack-legality predicate.
 */
export function getLionfishInvaderTargetCandidates({
  targets = [],
  targetController,
  sourceInstanceId = null,
  isLegalFishTarget = (target) => target?.category === "fish",
} = {}) {
  const seen = new Set();
  return targets.filter((target) => {
    if (!target?.instanceId || target.instanceId === sourceInstanceId || seen.has(target.instanceId)) return false;
    seen.add(target.instanceId);
    if (target.controller !== targetController || !isLegalFishTarget(target)) return false;
    return true;
  });
}

/**
 * Checks both coin branches before beginning Invader. The Lionfish itself is
 * never enough to trigger its own mandatory coin flip.
 */
export function hasAnyLionfishInvaderTarget({
  invader,
  targets = [],
  isLegalFishTarget,
} = {}) {
  if (!invader?.instanceId || !isController(invader?.controller)) return false;
  return ["player", "opponent"].some((targetController) => getLionfishInvaderTargetCandidates({
    targets,
    targetController,
    sourceInstanceId: invader.instanceId,
    ...(isLegalFishTarget ? { isLegalFishTarget } : {}),
  }).length > 0);
}

/**
 * Plans one trigger. A coin is consumed only when at least one branch has a
 * legal Fish target. After the flip, an empty selected branch still fizzles
 * without falling back to the other ecosystem.
 */
export function planLionfishInvaderTrigger({
  invader,
  targets = [],
  random = Math.random,
  isLegalFishTarget,
} = {}) {
  if (!invader?.instanceId || !isController(invader?.controller)) {
    return { resolved: false, coinResult: null, targetController: null, candidates: [], noLegalTarget: true };
  }
  if (!hasAnyLionfishInvaderTarget({ invader, targets, isLegalFishTarget })) {
    return { resolved: false, coinResult: null, targetController: null, candidates: [], noLegalTarget: true };
  }
  const coinResult = resolveLionfishInvaderCoin(random);
  const targetController = getLionfishInvaderTargetController({
    invaderController: invader.controller,
    coinResult,
  });
  const candidates = getLionfishInvaderTargetCandidates({
    targets,
    targetController,
    sourceInstanceId: invader.instanceId,
    ...(isLegalFishTarget ? { isLegalFishTarget } : {}),
  });
  return {
    resolved: Boolean(targetController),
    coinResult,
    targetController,
    candidates,
    noLegalTarget: candidates.length === 0,
  };
}

/**
 * Resolves only the ordinary opposed roll after a legal candidate is chosen.
 * State mutation, survival effects, Toxic, and zone routing remain with the
 * shared Simulator combat pipeline.
 */
export function resolveLionfishInvaderOpposedRoll({
  target,
  candidates = [],
  defenseDice,
  attackRandom = Math.random,
  defenseRandom = Math.random,
} = {}) {
  if (!target?.instanceId || !candidates.some((candidate) => candidate.instanceId === target.instanceId)) {
    return { resolved: false, attack: null, defense: null, attackerWins: false };
  }
  let rollIndex = 0;
  return resolveOpposedRoll(
    LIONFISH_INVADER_ATTACK_DICE,
    defenseDice,
    () => (rollIndex++ === 0 ? attackRandom() : defenseRandom()),
  );
}
