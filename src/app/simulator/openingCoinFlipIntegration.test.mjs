import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = simulatorSource.indexOf(startMarker);
  const end = simulatorSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return simulatorSource.slice(start, end);
}

test("opening coin flow waits for a call and a separate player-triggered toss", () => {
  const flow = sourceBetween("function cancelOpeningCoinFlip", "function chooseOpeningTurn");
  assert.match(flow, /function prepareOpeningCoinFlip\(call\)/);
  assert.match(flow, /createOpeningCoinReadyOverlay\(\{ call \}\)/);
  assert.match(flow, /function flipForOpeningTurn\(\)/);
  assert.match(flow, /eventOverlay\?\.type !== OpeningCoinPhase\.READY/);
  assert.match(flow, /openingCoinFlipActiveRef\.current/);
  assert.match(flow, /createOpeningCoinFlippingOverlay/);
  assert.doesNotMatch(flow, /setEventOverlay\(\{\s*type: ["']opening-coin-result/);
});
test("coin toss is keyboard operable and blocks rerolls while the coin is airborne", () => {
  assert.match(simulatorSource, /aria-keyshortcuts="Enter Space"/);
  assert.match(simulatorSource, /autoFocus[\s\S]{0,240}onClick=\{flipForOpeningTurn\}/);
  assert.match(simulatorSource, /openingCoinFlipActiveRef\.current = true/);
  assert.match(simulatorSource, /OpeningCoinPhase\.FLIPPING/);
  assert.match(simulatorSource, /role="status" aria-live="polite">Coin flipping/);
});

test("coin animation resolves from its stored outcome with a reduced-motion fallback", () => {
  assert.match(simulatorSource, /prefers-reduced-motion: reduce/);
  assert.match(simulatorSource, /getOpeningCoinFlipRevealDelay\(\{[\s\S]*accessibilityReducedMotion \|\| systemReducedMotion/);
  assert.match(simulatorSource, /return \(\) => window\.clearTimeout\(revealTimer\)/);
  assert.match(simulatorSource, /onAnimationEnd=\{\(\) => completeOpeningCoinFlip\(eventOverlay\.flipId\)\}/);
  assert.match(simulatorSource, /@keyframes seapalsCoinFlipHeads/);
  assert.match(simulatorSource, /@keyframes seapalsCoinFlipTails/);
  assert.match(simulatorSource, /seapals-opening-coin-landed-tails/);
});
