export const OpeningCoinSide = Object.freeze({
  FISH: "fish",
  BLANK: "blank",
});

export const OpeningPlayer = Object.freeze({
  PLAYER: "player",
  OPPONENT: "opponent",
});

export const OpeningCoinPhase = Object.freeze({
  READY: "opening-coin-ready",
  FLIPPING: "opening-coin-flipping",
  RESULT: "opening-coin-result",
});

export const OPENING_COIN_FLIP_FALLBACK_MS = 1550;
export const OPENING_COIN_REDUCED_MOTION_MS = 120;

function normalizeCoinSide(value) {
  return value === OpeningCoinSide.BLANK ? OpeningCoinSide.BLANK : OpeningCoinSide.FISH;
}

export function formatOpeningCoinSide(side) {
  return normalizeCoinSide(side) === OpeningCoinSide.BLANK ? "blank side" : "Reef Fish side";
}

export function getOpeningCoinFlipRevealDelay({ reducedMotion = false } = {}) {
  return reducedMotion ? OPENING_COIN_REDUCED_MOTION_MS : OPENING_COIN_FLIP_FALLBACK_MS;
}

export function createOpeningCoinReadyOverlay() {
  return Object.freeze({
    type: OpeningCoinPhase.READY,
    title: "Opening toss",
    message: "Tap anywhere to land the coin. Reef Fish means you go first; blank means the opponent goes first.",
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
    coinLanded: result.landed,
    coinWinner: result.winner,
    flipId,
  });
}

export function createOpeningCoinResultOverlay({ result, opponentName = "The opponent" } = {}) {
  if (!result) return null;
  const playerWon = result.winner === OpeningPlayer.PLAYER;
  return Object.freeze({
    type: OpeningCoinPhase.RESULT,
    title: playerWon ? "Reef Fish! You go first." : `Blank side. ${opponentName} goes first.`,
    message: playerWon
      ? "The Reef Fish surfaced in a burst of color, so you will take the first turn after setup."
      : "The blank side surfaced, so the opponent will take the first turn after setup.",
    coinLanded: result.landed,
    coinWinner: result.winner,
  });
}

/**
 * Resolve the pre-game coin flip. The Reef Fish side starts the player and the
 * blank side starts the opponent. A guided tutorial may force the Reef Fish.
 */
export function resolveOpeningCoinFlip({
  random = Math.random,
  forcedWinner = null,
} = {}) {
  const normalizedForcedWinner = Object.values(OpeningPlayer).includes(forcedWinner)
    ? forcedWinner
    : null;
  const landed = normalizedForcedWinner === OpeningPlayer.PLAYER
    ? OpeningCoinSide.FISH
    : normalizedForcedWinner === OpeningPlayer.OPPONENT
      ? OpeningCoinSide.BLANK
      : Number(random()) < 0.5
        ? OpeningCoinSide.FISH
        : OpeningCoinSide.BLANK;

  return Object.freeze({
    landed,
    winner: landed === OpeningCoinSide.FISH ? OpeningPlayer.PLAYER : OpeningPlayer.OPPONENT,
  });
}

/**
 * The visible coin side directly determines the opening player. A guided
 * tutorial always keeps the prepared player-first route.
 */
export function chooseOpeningPlayer({ winner, tutorial = false } = {}) {
  if (tutorial) return OpeningPlayer.PLAYER;
  return winner === OpeningPlayer.OPPONENT ? OpeningPlayer.OPPONENT : OpeningPlayer.PLAYER;
}
