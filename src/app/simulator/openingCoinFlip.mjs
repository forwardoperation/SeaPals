export const OpeningCoinSide = Object.freeze({
  HEADS: "heads",
  TAILS: "tails",
});

export const OpeningPlayer = Object.freeze({
  PLAYER: "player",
  OPPONENT: "opponent",
});

export const OpeningCoinPhase = Object.freeze({
  CALL: "opening-coin-call",
  READY: "opening-coin-ready",
  FLIPPING: "opening-coin-flipping",
  RESULT: "opening-coin-result",
});

export const OPENING_COIN_FLIP_FALLBACK_MS = 1550;
export const OPENING_COIN_REDUCED_MOTION_MS = 120;

function normalizeCoinSide(value) {
  return value === OpeningCoinSide.TAILS ? OpeningCoinSide.TAILS : OpeningCoinSide.HEADS;
}

function oppositeCoinSide(side) {
  return side === OpeningCoinSide.HEADS ? OpeningCoinSide.TAILS : OpeningCoinSide.HEADS;
}

export function formatOpeningCoinSide(side) {
  return normalizeCoinSide(side) === OpeningCoinSide.TAILS ? "Tails" : "Heads";
}

export function getOpeningCoinFlipRevealDelay({ reducedMotion = false } = {}) {
  return reducedMotion ? OPENING_COIN_REDUCED_MOTION_MS : OPENING_COIN_FLIP_FALLBACK_MS;
}

export function createOpeningCoinCallOverlay({ tutorial = false, guideName = "Mr. Easterling" } = {}) {
  return Object.freeze({
    type: OpeningCoinPhase.CALL,
    title: "Heads or tails?",
    message: tutorial
      ? `${guideName} hands you the aquarium workshop coin. Make your call, then give it a toss to decide the opening turn.`
      : "Make your call, then toss the coin. If your call matches, you choose who takes the first turn after setup.",
  });
}

export function createOpeningCoinReadyOverlay({ call = OpeningCoinSide.HEADS } = {}) {
  const normalizedCall = normalizeCoinSide(call);
  return Object.freeze({
    type: OpeningCoinPhase.READY,
    title: `You called ${formatOpeningCoinSide(normalizedCall)}.`,
    message: "The coin is in your hand. Press Enter or select Flip the Coin when you are ready.",
    coinCall: normalizedCall,
  });
}

export function createOpeningCoinFlippingOverlay({ result, flipId, tutorial = false } = {}) {
  if (!result) return null;
  return Object.freeze({
    type: OpeningCoinPhase.FLIPPING,
    title: "Up it goes!",
    message: tutorial
      ? "You send the workshop coin spinning above the table."
      : "The opening coin is spinning above the table.",
    coinCall: result.call,
    coinLanded: result.landed,
    coinWinner: result.winner,
    flipId,
  });
}

export function createOpeningCoinResultOverlay({ result, opponentName = "The opponent" } = {}) {
  if (!result) return null;
  const landed = formatOpeningCoinSide(result.landed);
  const call = formatOpeningCoinSide(result.call);
  const playerWon = result.winner === OpeningPlayer.PLAYER;
  return Object.freeze({
    type: OpeningCoinPhase.RESULT,
    title: playerWon ? `${landed}! You won the flip.` : `${landed}! ${opponentName} won the flip.`,
    message: playerWon
      ? `You called ${call}, and the coin landed ${landed}.`
      : `You called ${call}, but the coin landed ${landed}.`,
    coinCall: result.call,
    coinLanded: result.landed,
    coinWinner: result.winner,
  });
}

/**
 * Resolve the pre-game coin flip. A tutorial may force the winner while still
 * preserving the player's visible heads-or-tails call.
 */
export function resolveOpeningCoinFlip({
  call = OpeningCoinSide.HEADS,
  random = Math.random,
  forcedWinner = null,
} = {}) {
  const normalizedCall = normalizeCoinSide(call);
  const normalizedForcedWinner = Object.values(OpeningPlayer).includes(forcedWinner)
    ? forcedWinner
    : null;
  const landed = normalizedForcedWinner === OpeningPlayer.PLAYER
    ? normalizedCall
    : normalizedForcedWinner === OpeningPlayer.OPPONENT
      ? oppositeCoinSide(normalizedCall)
      : Number(random()) < 0.5
        ? OpeningCoinSide.HEADS
        : OpeningCoinSide.TAILS;

  return Object.freeze({
    call: normalizedCall,
    landed,
    winner: landed === normalizedCall ? OpeningPlayer.PLAYER : OpeningPlayer.OPPONENT,
  });
}

/**
 * The flip winner chooses the opening player. The AI takes the first turn when
 * it wins; a guided tutorial always keeps the prepared player-first route.
 */
export function chooseOpeningPlayer({ winner, playerChoice, tutorial = false } = {}) {
  if (tutorial) return OpeningPlayer.PLAYER;
  if (winner === OpeningPlayer.OPPONENT) return OpeningPlayer.OPPONENT;
  return playerChoice === OpeningPlayer.OPPONENT ? OpeningPlayer.OPPONENT : OpeningPlayer.PLAYER;
}
