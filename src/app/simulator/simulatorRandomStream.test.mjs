import assert from "node:assert/strict";
import test from "node:test";

import { createSeededRandom } from "./gameRules.mjs";
import { createCombatRollPacket } from "./combatRollPresentation.mjs";
import { createCardCoinReadyState, startCardCoinFlip } from "./cardCoinFlip.mjs";
import { resolveOpeningCoinFlip } from "./openingCoinFlip.mjs";
import {
  createSimulatorRandomSeed,
  createSimulatorRandomStream,
  isSimulatorRandomStreamState,
  sampleSimulatorRandom,
} from "./simulatorRandomStream.mjs";

test("a saved seed and cursor replay the exact same gameplay samples", () => {
  const checkpoint = createSimulatorRandomStream(0x1234ABCD, 0);
  const firstCoin = sampleSimulatorRandom(checkpoint);
  const firstDice = sampleSimulatorRandom(firstCoin.state);

  const restored = createSimulatorRandomStream(checkpoint.seed, checkpoint.cursor);
  const replayCoin = sampleSimulatorRandom(restored);
  const replayDice = sampleSimulatorRandom(replayCoin.state);

  assert.equal(replayCoin.value, firstCoin.value);
  assert.equal(replayDice.value, firstDice.value);
  assert.deepEqual(replayDice.state, firstDice.state);
});

test("refreshing the same checkpoint replays opening, card, and dice outcomes", () => {
  const savedCheckpoint = JSON.parse(JSON.stringify(createSimulatorRandomStream(0xC0A1BEEF, 11)));
  const playFromCheckpoint = () => {
    let stream = createSimulatorRandomStream(savedCheckpoint.seed, savedCheckpoint.cursor);
    const random = () => {
      const sampled = sampleSimulatorRandom(stream);
      stream = sampled.state;
      return sampled.value;
    };
    const opening = resolveOpeningCoinFlip({ random });
    const cardCoin = startCardCoinFlip(createCardCoinReadyState({
      id: 1,
      sourceCardName: "Recovery",
    }), { random });
    const combat = createCombatRollPacket("D4", "D8", random);
    const effect = createCombatRollPacket("D6", null, random);
    return {
      opening,
      cardCoin: { result: cardCoin.result, success: cardCoin.success },
      combat,
      effect,
      stream,
    };
  };

  assert.deepEqual(playFromCheckpoint(), playFromCheckpoint());
});

test("the stateless stream matches the simulator's seeded random sequence", () => {
  const seed = 0x5EA9A15;
  const expected = createSeededRandom(seed);
  let stream = createSimulatorRandomStream(seed);

  for (let index = 0; index < 8; index += 1) {
    const sampled = sampleSimulatorRandom(stream);
    assert.equal(sampled.value, expected());
    stream = sampled.state;
  }
});

test("only valid serializable stream snapshots are accepted", () => {
  assert.equal(isSimulatorRandomStreamState(createSimulatorRandomStream(7, 3)), true);
  for (const invalid of [
    null,
    {},
    { seed: -1, cursor: 0 },
    { seed: 0x100000000, cursor: 0 },
    { seed: 1.5, cursor: 0 },
    { seed: 1, cursor: -1 },
    { seed: 1, cursor: 0.5 },
    { seed: 1, cursor: Number.POSITIVE_INFINITY },
  ]) assert.equal(isSimulatorRandomStreamState(invalid), false);
});

test("new-match seed creation mixes its entropy sources into a uint32", () => {
  const seed = createSimulatorRandomSeed(() => 0.25, 1_725_000_000_000);
  assert.equal(Number.isInteger(seed), true);
  assert.ok(seed >= 0 && seed < 0x100000000);
  assert.notEqual(seed, 0);
});
