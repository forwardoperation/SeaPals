import assert from "node:assert/strict";
import test from "node:test";

import {
  OPENING_COIN_FLIP_FALLBACK_MS,
  OPENING_COIN_REDUCED_MOTION_MS,
  OpeningCoinPhase,
  OpeningCoinSide,
  OpeningPlayer,
  chooseOpeningPlayer,
  createOpeningCoinCallOverlay,
  createOpeningCoinFlippingOverlay,
  createOpeningCoinReadyOverlay,
  createOpeningCoinResultOverlay,
  formatOpeningCoinSide,
  getOpeningCoinFlipRevealDelay,
  resolveOpeningCoinFlip,
} from "./openingCoinFlip.mjs";

test("opening coin flip honors the player's call in a normal game", () => {
  const heads = resolveOpeningCoinFlip({ call: OpeningCoinSide.HEADS, random: () => 0.49 });
  assert.deepEqual(heads, { call: "heads", landed: "heads", winner: "player" });

  const tails = resolveOpeningCoinFlip({ call: OpeningCoinSide.HEADS, random: () => 0.5 });
  assert.deepEqual(tails, { call: "heads", landed: "tails", winner: "opponent" });
});

test("guided tutorial forces a player win for either visible call", () => {
  for (const call of Object.values(OpeningCoinSide)) {
    const result = resolveOpeningCoinFlip({
      call,
      random: () => (call === OpeningCoinSide.HEADS ? 0.99 : 0),
      forcedWinner: OpeningPlayer.PLAYER,
    });
    assert.equal(result.call, call);
    assert.equal(result.landed, call);
    assert.equal(result.winner, OpeningPlayer.PLAYER);
  }
});

test("the flip winner controls who takes the opening turn", () => {
  assert.equal(chooseOpeningPlayer({ winner: "player", playerChoice: "player" }), "player");
  assert.equal(chooseOpeningPlayer({ winner: "player", playerChoice: "opponent" }), "opponent");
  assert.equal(chooseOpeningPlayer({ winner: "opponent", playerChoice: "player" }), "opponent");
  assert.equal(chooseOpeningPlayer({ winner: "opponent", tutorial: true }), "player");
});

test("opening coin presentation moves through call, ready, flipping, and result states", () => {
  const call = createOpeningCoinCallOverlay({ tutorial: true, guideName: "Mr. Easterling" });
  assert.equal(call.type, OpeningCoinPhase.CALL);
  assert.match(call.message, /make your call.*give it a toss/i);

  const ready = createOpeningCoinReadyOverlay({ call: OpeningCoinSide.TAILS });
  assert.deepEqual(ready, {
    type: OpeningCoinPhase.READY,
    title: "You called Tails.",
    message: "The coin is in your hand. Press Enter or select Flip the Coin when you are ready.",
    coinCall: OpeningCoinSide.TAILS,
  });

  const result = resolveOpeningCoinFlip({
    call: ready.coinCall,
    forcedWinner: OpeningPlayer.PLAYER,
  });
  const flipping = createOpeningCoinFlippingOverlay({ result, flipId: 7, tutorial: true });
  assert.equal(flipping.type, OpeningCoinPhase.FLIPPING);
  assert.equal(flipping.flipId, 7);
  assert.equal(flipping.coinLanded, OpeningCoinSide.TAILS);

  const landed = createOpeningCoinResultOverlay({ result });
  assert.equal(landed.type, OpeningCoinPhase.RESULT);
  assert.equal(landed.title, "Tails! You won the flip.");
  assert.match(landed.message, /called Tails.*landed Tails/i);
});

test("opening coin labels and reveal timing remain accessible with reduced motion", () => {
  assert.equal(formatOpeningCoinSide("heads"), "Heads");
  assert.equal(formatOpeningCoinSide("tails"), "Tails");
  assert.equal(getOpeningCoinFlipRevealDelay(), OPENING_COIN_FLIP_FALLBACK_MS);
  assert.equal(
    getOpeningCoinFlipRevealDelay({ reducedMotion: true }),
    OPENING_COIN_REDUCED_MOTION_MS,
  );
  assert.ok(OPENING_COIN_REDUCED_MOTION_MS < OPENING_COIN_FLIP_FALLBACK_MS);
});

test("opponent coin result copy names the winner without changing the stored outcome", () => {
  const result = resolveOpeningCoinFlip({
    call: OpeningCoinSide.HEADS,
    random: () => 0.9,
  });
  const overlay = createOpeningCoinResultOverlay({ result, opponentName: "Rosie" });
  assert.equal(overlay.title, "Tails! Rosie won the flip.");
  assert.equal(overlay.coinCall, OpeningCoinSide.HEADS);
  assert.equal(overlay.coinLanded, OpeningCoinSide.TAILS);
  assert.equal(overlay.coinWinner, OpeningPlayer.OPPONENT);
});
