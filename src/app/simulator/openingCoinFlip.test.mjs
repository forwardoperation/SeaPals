import assert from "node:assert/strict";
import test from "node:test";

import {
  OPENING_COIN_FLIP_FALLBACK_MS,
  OPENING_COIN_REDUCED_MOTION_MS,
  OpeningCoinPhase,
  OpeningCoinSide,
  OpeningPlayer,
  chooseOpeningPlayer,
  createOpeningCoinFlippingOverlay,
  createOpeningCoinReadyOverlay,
  createOpeningCoinResultOverlay,
  formatOpeningCoinSide,
  getOpeningCoinFlipRevealDelay,
  resolveOpeningCoinFlip,
} from "./openingCoinFlip.mjs";

test("the decisionless opening coin maps reef fish to player-first and blank to opponent-first", () => {
  let randomCalls = 0;
  assert.deepEqual(
    resolveOpeningCoinFlip({ random: () => { randomCalls += 1; return 0.49; } }),
    { landed: OpeningCoinSide.FISH, winner: OpeningPlayer.PLAYER },
  );
  assert.equal(randomCalls, 1, "one screen tap samples one outcome exactly once");
  assert.deepEqual(
    resolveOpeningCoinFlip({ random: () => 0.5 }),
    { landed: OpeningCoinSide.BLANK, winner: OpeningPlayer.OPPONENT },
  );
});

test("the guided tutorial forces the reef-fish side and prepared player-first route", () => {
  const result = resolveOpeningCoinFlip({
    random: () => 0.99,
    forcedWinner: OpeningPlayer.PLAYER,
  });

  assert.deepEqual(result, {
    landed: OpeningCoinSide.FISH,
    winner: OpeningPlayer.PLAYER,
  });
  assert.equal(chooseOpeningPlayer({ winner: result.winner, tutorial: true }), OpeningPlayer.PLAYER);
});

test("the landed side automatically controls who takes the opening turn", () => {
  assert.equal(chooseOpeningPlayer({ winner: OpeningPlayer.PLAYER }), OpeningPlayer.PLAYER);
  assert.equal(chooseOpeningPlayer({ winner: OpeningPlayer.OPPONENT }), OpeningPlayer.OPPONENT);
  assert.equal(
    chooseOpeningPlayer({ winner: OpeningPlayer.PLAYER, playerChoice: OpeningPlayer.OPPONENT }),
    OpeningPlayer.PLAYER,
    "a removed player-choice argument must not override the coin",
  );
  assert.equal(
    chooseOpeningPlayer({ winner: OpeningPlayer.OPPONENT, tutorial: true }),
    OpeningPlayer.PLAYER,
    "the scripted tutorial retains its prepared player-first route",
  );
});

test("opening coin presentation moves directly through ready, flipping, and result states", () => {
  const ready = createOpeningCoinReadyOverlay();
  assert.equal(ready.type, OpeningCoinPhase.READY);
  assert.match(`${ready.title} ${ready.message}`, /tap/i);
  assert.equal("coinCall" in ready, false);

  const result = resolveOpeningCoinFlip({ forcedWinner: OpeningPlayer.PLAYER });
  const flipping = createOpeningCoinFlippingOverlay({ result, flipId: 7, tutorial: true });
  assert.equal(flipping.type, OpeningCoinPhase.FLIPPING);
  assert.equal(flipping.flipId, 7);
  assert.equal(flipping.coinLanded, OpeningCoinSide.FISH);
  assert.equal(flipping.coinWinner, OpeningPlayer.PLAYER);
  assert.equal("coinCall" in flipping, false);

  const landed = createOpeningCoinResultOverlay({ result });
  assert.equal(landed.type, OpeningCoinPhase.RESULT);
  assert.match(`${landed.title} ${landed.message}`, /fish/i);
  assert.match(`${landed.title} ${landed.message}`, /you.*first/i);
  assert.equal(landed.coinLanded, OpeningCoinSide.FISH);
  assert.equal(landed.coinWinner, OpeningPlayer.PLAYER);
  assert.equal("coinCall" in landed, false);
});

test("blank result copy assigns the opponent first without inventing a player decision", () => {
  const result = resolveOpeningCoinFlip({ forcedWinner: OpeningPlayer.OPPONENT });
  const overlay = createOpeningCoinResultOverlay({ result, opponentName: "Rosie" });

  assert.equal(result.landed, OpeningCoinSide.BLANK);
  assert.equal(result.winner, OpeningPlayer.OPPONENT);
  assert.match(`${overlay.title} ${overlay.message}`, /blank/i);
  assert.match(`${overlay.title} ${overlay.message}`, /Rosie.*first/i);
  assert.equal(overlay.coinLanded, OpeningCoinSide.BLANK);
  assert.equal(overlay.coinWinner, OpeningPlayer.OPPONENT);
  assert.equal("coinCall" in overlay, false);
});

test("fish and blank labels and reveal timing remain accessible with reduced motion", () => {
  assert.equal(formatOpeningCoinSide(OpeningCoinSide.FISH), "Reef Fish side");
  assert.equal(formatOpeningCoinSide(OpeningCoinSide.BLANK), "blank side");
  assert.equal(getOpeningCoinFlipRevealDelay(), OPENING_COIN_FLIP_FALLBACK_MS);
  assert.equal(
    getOpeningCoinFlipRevealDelay({ reducedMotion: true }),
    OPENING_COIN_REDUCED_MOTION_MS,
  );
  assert.ok(OPENING_COIN_REDUCED_MOTION_MS < OPENING_COIN_FLIP_FALLBACK_MS);
});
