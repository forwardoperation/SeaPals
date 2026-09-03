export const EFFECT_ROLL_READY_TYPE = "effect-roll-ready";

export const EffectRollKind = Object.freeze({
  FOUNDATION_DAMAGE: "foundation-damage",
  FOUNDATION_HEAL: "foundation-heal",
  RESOURCE_CHECK: "resource-check",
});

function normalizePositiveNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

export function createEffectRollReadyEvent({
  rollCheckpointId,
  kind,
  dice,
  sourceCardId,
  sourceCardName = "Card effect",
  actionName = "Card effect",
  owner = "player",
  multiplier = 1,
  flatAmount = 0,
  successValues = null,
  reward = 0,
  prompt = "Tap to roll",
  ...continuation
} = {}) {
  const normalizedDice = String(dice ?? "").trim().toUpperCase();
  if (!rollCheckpointId || !Object.values(EffectRollKind).includes(kind) || !/^D\d+(?:[+-]\d+)?$/.test(normalizedDice)) return null;

  return Object.freeze({
    ...continuation,
    type: EFFECT_ROLL_READY_TYPE,
    rollCheckpointId,
    effectRollKind: kind,
    dice: normalizedDice,
    sourceCardId,
    sourceCardName,
    actionName,
    owner: owner === "opponent" ? "opponent" : "player",
    multiplier: normalizePositiveNumber(multiplier, 1),
    flatAmount: normalizePositiveNumber(flatAmount),
    successValues: Array.isArray(successValues)
      ? Object.freeze(successValues.map(Number).filter(Number.isFinite))
      : null,
    reward: normalizePositiveNumber(reward),
    prompt,
  });
}

export function resolveEffectRollEvent(event, stoppedValue) {
  if (event?.type !== EFFECT_ROLL_READY_TYPE) return null;
  const roll = Number(stoppedValue);
  if (!Number.isFinite(roll)) return null;
  const multiplier = normalizePositiveNumber(event.multiplier, 1);
  const flatAmount = normalizePositiveNumber(event.flatAmount);
  const success = event.successValues ? event.successValues.includes(roll) : true;

  return Object.freeze({
    roll,
    amount: flatAmount + roll * multiplier,
    success,
    reward: success ? normalizePositiveNumber(event.reward) : 0,
  });
}
