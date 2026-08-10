import assert from "node:assert/strict";
import test from "node:test";
import {
  AdventureDuelResultMismatchError,
  assertAdventureDuelResultMatchesLaunch,
} from "./adventureDuel.mjs";

const SNAPSHOT = Object.freeze({
  id: "harbor-custom",
  fingerprint: "deck-v1-0123456789abcdef",
});

const EXPECTED = Object.freeze({
  encounterId: "encounter-shellshore-marina",
  opponentId: "marina",
  opponentDeckId: "coral-garden",
  victoryTarget: 30,
  playerDeckSnapshot: SNAPSHOT,
});

function result(overrides = {}) {
  return {
    encounterId: EXPECTED.encounterId,
    playerDeckId: SNAPSHOT.id,
    playerDeckFingerprint: SNAPSHOT.fingerprint,
    opponent: { id: EXPECTED.opponentId, deckId: EXPECTED.opponentDeckId },
    scores: { playerVp: 30, opponentVp: 3, targetVp: EXPECTED.victoryTarget },
    ...overrides,
  };
}

test("a result matching every locked launch identity is accepted", () => {
  const value = result();
  assert.equal(assertAdventureDuelResultMatchesLaunch(value, EXPECTED), value);
});

test("encounter, opponent, target, deck id, and fingerprint mismatches fail closed", () => {
  const mismatches = [
    result({ encounterId: "encounter-shellshore-dorian" }),
    result({ opponent: { id: "dorian", deckId: EXPECTED.opponentDeckId } }),
    result({ opponent: { id: EXPECTED.opponentId, deckId: "murky-water" } }),
    result({ scores: { playerVp: 30, opponentVp: 3, targetVp: 10 } }),
    result({ playerDeckId: "different-deck" }),
    result({ playerDeckFingerprint: "deck-v1-fedcba9876543210" }),
  ];
  for (const candidate of mismatches) {
    assert.throws(
      () => assertAdventureDuelResultMatchesLaunch(candidate, EXPECTED),
      AdventureDuelResultMismatchError,
    );
  }
});
