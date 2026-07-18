export const OpeningCoinSide = Object.freeze({
  HEADS: "heads",
  TAILS: "tails",
});

export const OpeningPlayer = Object.freeze({
  PLAYER: "player",
  OPPONENT: "opponent",
});

function normalizeCoinSide(value) {
  return value === OpeningCoinSide.TAILS ? OpeningCoinSide.TAILS : OpeningCoinSide.HEADS;
}

function oppositeCoinSide(side) {
  return side === OpeningCoinSide.HEADS ? OpeningCoinSide.TAILS : OpeningCoinSide.HEADS;
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
