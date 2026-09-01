import assert from "node:assert/strict";
import test from "node:test";

import {
  CARD_COIN_FLIP_FALLBACK_MS,
  CARD_COIN_REDUCED_MOTION_MS,
  CardCoinPhase,
  CardCoinSide,
  cancelCardCoinFlip,
  completeCardCoinFlip,
  consumeCardCoinContinuation,
  createCardCoinReadyState,
  getCardCoinFlipRevealDelay,
  startCardCoinFlip,
} from "./cardCoinFlip.mjs";

function createRecoveryFlip(id = 17) {
  return createCardCoinReadyState({
    id,
    sourceCardId: "recovery",
    successResult: "heads",
    title: "Recovery",
    message: "Tap anywhere to flip.",
    continueLabel: "Continue",
    continuation: {
      type: "recover-from-discard",
      supportCardId: "recovery",
      candidates: ["blue-crab", "lettuce-coral-base"],
    },
  });
}

test("card coin maps Reef Fish to heads and blank to tails with one random sample", () => {
  for (const expected of [
    { value: 0.499, side: CardCoinSide.FISH, result: "heads", success: true },
    { value: 0.5, side: CardCoinSide.BLANK, result: "tails", success: false },
  ]) {
    let randomCalls = 0;
    const ready = createRecoveryFlip(expected.side === CardCoinSide.FISH ? 1 : 2);
    const flipping = startCardCoinFlip(ready, {
      random: () => {
        randomCalls += 1;
        return expected.value;
      },
    });

    assert.equal(ready.phase, CardCoinPhase.READY);
    assert.equal(flipping.phase, CardCoinPhase.FLIPPING);
    assert.equal(flipping.side, expected.side);
    assert.equal(flipping.result, expected.result);
    assert.equal(flipping.success, expected.success);
    assert.equal(randomCalls, 1);
  }
});

test("repeated taps cannot reroll a card coin that has already started", () => {
  let randomCalls = 0;
  const random = () => {
    randomCalls += 1;
    return 0.25;
  };
  const ready = createRecoveryFlip();
  const flipping = startCardCoinFlip(ready, { random });
  const repeated = startCardCoinFlip(flipping, { random });

  assert.strictEqual(repeated, flipping, "a second tap keeps the first immutable outcome packet");
  assert.equal(repeated.result, "heads");
  assert.equal(randomCalls, 1, "one interaction may consume randomness exactly once");
});

test("success matching is data-driven for future tails-success card effects", () => {
  const ready = createCardCoinReadyState({
    id: 23,
    sourceCardId: "future-support",
    successResult: "tails",
    title: "Future Support",
    message: "Flip for the printed effect.",
    continueLabel: "Resolve",
    continuation: {
      type: "future-support-effect",
      payload: { amount: 2 },
    },
  });
  const flipping = startCardCoinFlip(ready, { random: () => 0.75 });

  assert.equal(flipping.side, CardCoinSide.BLANK);
  assert.equal(flipping.result, "tails");
  assert.equal(flipping.success, true);
  assert.equal(flipping.sourceCardId, "future-support");
  assert.deepEqual(flipping.continuation, {
    type: "future-support-effect",
    payload: { amount: 2 },
  });

  const landed = completeCardCoinFlip(flipping, 23);
  assert.match(
    landed.title,
    /tails/i,
    "default result copy should name the side that actually landed",
  );
  assert.match(
    landed.message,
    /blank/i,
    "blank remains the tails face even when a card treats tails as success",
  );
  assert.match(
    `${landed.title} ${landed.message}`,
    /succeed/i,
    "default result copy should follow successResult instead of assuming only heads can succeed",
  );
});

test("landing completion is idempotent and rejects stale flip IDs", () => {
  const ready = createRecoveryFlip(41);
  const flipping = startCardCoinFlip(ready, { random: () => 0.9 });

  const stale = completeCardCoinFlip(flipping, 40);
  assert.strictEqual(stale, flipping, "an animation callback from an older flip cannot land this coin");

  const landed = completeCardCoinFlip(flipping, 41);
  assert.equal(landed.phase, CardCoinPhase.RESULT);
  assert.equal(landed.result, "tails");
  assert.strictEqual(
    completeCardCoinFlip(landed, 41),
    landed,
    "animation-end and fallback timeout may race without completing twice",
  );
});

test("the serializable continuation survives the toss and can be consumed only from the result phase", () => {
  const ready = createRecoveryFlip(73);
  const expectedContinuation = structuredClone(ready.continuation);
  const flipping = startCardCoinFlip(ready, { random: () => 0.1 });
  const landed = completeCardCoinFlip(flipping, 73);

  assert.deepEqual(flipping.continuation, expectedContinuation);
  assert.deepEqual(landed.continuation, expectedContinuation);

  assert.equal(consumeCardCoinContinuation(flipping), null, "a landing animation cannot resolve the card effect early");
  const consumed = consumeCardCoinContinuation(landed);
  assert.deepEqual(consumed.continuation, expectedContinuation);
  assert.deepEqual(consumed.outcome, {
    id: 73,
    sourceCardId: "recovery",
    result: "heads",
    side: CardCoinSide.FISH,
    success: true,
  });
});

test("canceling clears any card-coin phase and null states stay harmless", () => {
  const ready = createRecoveryFlip(99);
  const flipping = startCardCoinFlip(ready, { random: () => 0.2 });

  assert.equal(cancelCardCoinFlip(ready), null);
  assert.equal(cancelCardCoinFlip(flipping), null);
  assert.equal(completeCardCoinFlip(null, 99), null);
  assert.equal(consumeCardCoinContinuation(null), null);
});

test("reduced motion shortens landing without bypassing the ready or result phases", () => {
  assert.equal(getCardCoinFlipRevealDelay(), CARD_COIN_FLIP_FALLBACK_MS);
  assert.equal(
    getCardCoinFlipRevealDelay({ reducedMotion: true }),
    CARD_COIN_REDUCED_MOTION_MS,
  );
  assert.ok(CARD_COIN_REDUCED_MOTION_MS > 0);
  assert.ok(CARD_COIN_REDUCED_MOTION_MS < CARD_COIN_FLIP_FALLBACK_MS);

  const ready = createRecoveryFlip(121);
  const flipping = startCardCoinFlip(ready, { random: () => 0.2 });
  const landed = completeCardCoinFlip(flipping, 121);
  assert.equal(ready.phase, CardCoinPhase.READY);
  assert.equal(flipping.phase, CardCoinPhase.FLIPPING);
  assert.equal(landed.phase, CardCoinPhase.RESULT);
});
