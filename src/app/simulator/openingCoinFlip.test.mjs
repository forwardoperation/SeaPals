import assert from "node:assert/strict";
import test from "node:test";

import {
  OpeningCoinSide,
  OpeningPlayer,
  chooseOpeningPlayer,
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
