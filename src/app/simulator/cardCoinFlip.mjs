export const CardCoinPhase = Object.freeze({
  READY: "card-coin-ready",
  FLIPPING: "card-coin-flipping",
  RESULT: "card-coin-result",
});

export const CardCoinSide = Object.freeze({
  FISH: "fish",
  BLANK: "blank",
});

export const CARD_COIN_FLIP_FALLBACK_MS = 1550;
export const CARD_COIN_REDUCED_MOTION_MS = 120;
export const OPPONENT_CARD_COIN_AUTO_START_MS = 1000;
export const OPPONENT_CARD_COIN_AUTO_CONTINUE_MS = 1400;

function normalizeCoinResult(value) {
  return value === "tails" ? "tails" : "heads";
}

function normalizeOutcomeCopy(outcomes, result, sourceCardName, success) {
  const configured = outcomes?.[result] ?? {};
  const resultLabel = result === "tails" ? "Tails" : "Heads";
  const sideMessage = result === "tails"
    ? "The blank side landed face up."
    : "The Reef Fish side landed face up.";
  return Object.freeze({
    title: configured.title
      ?? (success ? `${resultLabel}! ${sourceCardName} succeeded.` : `${resultLabel}. ${sourceCardName} had no effect.`),
    message: configured.message ?? sideMessage,
    continueLabel: configured.continueLabel ?? "Continue",
  });
}

export function getCardCoinFlipRevealDelay({ reducedMotion = false } = {}) {
  return reducedMotion ? CARD_COIN_REDUCED_MOTION_MS : CARD_COIN_FLIP_FALLBACK_MS;
}

export function createCardCoinReadyState({
  id,
  owner = "player",
  sourceCardId = null,
  sourceCardName = "Card effect",
  actionName = "Coin Flip",
  successResult = "heads",
  eyebrow = sourceCardName,
  title = `Flip for ${sourceCardName}`,
  message = "Tap anywhere to flip. Reef Fish counts as heads; blank counts as tails.",
  outcomes = null,
  continuation = null,
  automatic = false,
  neutral = false,
  forcedResult = null,
  autoStartDelay = OPPONENT_CARD_COIN_AUTO_START_MS,
  autoContinueDelay = OPPONENT_CARD_COIN_AUTO_CONTINUE_MS,
} = {}) {
  return Object.freeze({
    id,
    phase: CardCoinPhase.READY,
    owner: owner === "opponent" ? "opponent" : "player",
    sourceCardId,
    sourceCardName,
    actionName,
    successResult: normalizeCoinResult(successResult),
    eyebrow,
    title,
    message,
    outcomes,
    continuation,
    automatic: Boolean(automatic),
    neutral: Boolean(neutral),
    forcedResult: forcedResult === "heads" || forcedResult === "tails" ? forcedResult : null,
    autoStartDelay: Math.max(0, Number(autoStartDelay) || 0),
    autoContinueDelay: Math.max(0, Number(autoContinueDelay) || 0),
    result: null,
    side: CardCoinSide.FISH,
    success: null,
    continueLabel: null,
  });
}

export function startCardCoinFlip(state, {
  random = Math.random,
  forcedResult = null,
} = {}) {
  if (state?.phase !== CardCoinPhase.READY) return state;
  const result = forcedResult === "heads" || forcedResult === "tails"
    ? forcedResult
    : Number(random()) < 0.5
      ? "heads"
      : "tails";
  return Object.freeze({
    ...state,
    phase: CardCoinPhase.FLIPPING,
    result,
    side: result === "heads" ? CardCoinSide.FISH : CardCoinSide.BLANK,
    success: result === state.successResult,
  });
}

export function completeCardCoinFlip(state, id = state?.id) {
  if (state?.phase !== CardCoinPhase.FLIPPING || state.id !== id) return state;
  const copy = normalizeOutcomeCopy(state.outcomes, state.result, state.sourceCardName, state.success);
  return Object.freeze({
    ...state,
    phase: CardCoinPhase.RESULT,
    title: copy.title,
    message: copy.message,
    continueLabel: copy.continueLabel,
  });
}

export function consumeCardCoinContinuation(state, id = state?.id) {
  if (!state || state.phase !== CardCoinPhase.RESULT || state.id !== id) return null;
  return Object.freeze({
    continuation: state.continuation ?? null,
    outcome: Object.freeze({
      id: state.id,
      sourceCardId: state.sourceCardId,
      result: state.result,
      side: state.side,
      success: state.success,
    }),
  });
}

export function cancelCardCoinFlip() {
  return null;
}
