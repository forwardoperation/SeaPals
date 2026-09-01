import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const boardPresentationSource = await readFile(new URL("./OpeningCoinBoardPresentation.jsx", import.meta.url), "utf8");
const boardPresentationStyles = await readFile(new URL("./OpeningCoinBoardPresentation.module.css", import.meta.url), "utf8");

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
test("the V2 opening flip is a board-native, one-tap interaction in the player ecosystem", () => {
  assert.match(simulatorSource, /import OpeningCoinBoardPresentation/);
  assert.match(simulatorSource, /active=\{openingCoinBoardActive\}/);
  assert.match(simulatorSource, /onStop=\{flipForOpeningTurn\}/);
  assert.match(simulatorSource, /onLanded=\{completeOpeningCoinFlip\}/);
  assert.match(simulatorSource, /eventOverlay && !boardFaceoffActive && !openingCoinBoardActive/);
  assert.match(boardPresentationSource, /data-opening-coin-layer/);
  assert.match(boardPresentationSource, /data-opening-coin-player-zone/);
  assert.match(boardPresentationSource, /data-flip-opening-coin/);
  assert.match(boardPresentationSource, /role="dialog"/);
  assert.match(boardPresentationSource, /aria-modal="true"/);
  assert.match(boardPresentationSource, /tabIndex=\{-1\}/);
  assert.match(boardPresentationSource, /Tap anywhere on the board, or press Enter or Space/);
  assert.match(boardPresentationSource, /onClick=\{onStop\}/);
  assert.match(boardPresentationSource, /function trapFocus/);
  assert.match(boardPresentationStyles, /\.tapCatcher\s*\{[\s\S]*position:\s*fixed;[\s\S]*inset:\s*0;[\s\S]*background:\s*transparent;[\s\S]*touch-action:\s*manipulation;/);
  assert.match(boardPresentationStyles, /\.screenBlocker\s*\{[\s\S]*position:\s*fixed;[\s\S]*inset:\s*0;[\s\S]*pointer-events:\s*auto;/);
  assert.match(boardPresentationStyles, /\.playerZone\s*\{[\s\S]*inset:\s*45% 0 0;/);
  assert.match(boardPresentationStyles, /var\(--seapals-mobile-reef-split, 50%\)/);
});

test("coin toss blocks rerolls and locks the rest of the board while active", () => {
  assert.match(simulatorSource, /openingCoinFlipActiveRef\.current = true/);
  assert.match(simulatorSource, /OpeningCoinPhase\.FLIPPING/);
  assert.match(simulatorSource, /const boardInteractionOverlayActive = boardFaceoffActive \|\| openingCoinBoardActive/);
  assert.match(simulatorSource, /data-opening-coin-active=\{openingCoinBoardActive \? "true" : undefined\}/);
  assert.match(simulatorSource, /attackContext && !boardFaceoffActive && !openingCoinBoardActive/);
  assert.equal((simulatorSource.match(/inert=\{boardInteractionOverlayActive \? true : undefined\}/g) ?? []).length, 3);
  assert.match(simulatorSource, /interactionDisabled=\{boardInteractionOverlayActive \|\|/);
  assert.match(simulatorSource, /\|\| openingCoinBoardActive[\s\S]*\|\| simulatorExitConfirmationOpen/);
  assert.match(boardPresentationSource, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(boardPresentationSource, /!previousFocus\.closest\("\[inert\]"\)/);
  assert.match(simulatorSource, /data-opening-coin-active="true"[\s\S]*\.seapals-reef-score[\s\S]*visibility:\s*hidden/);
});

test("coin animation resolves from its stored outcome with a reduced-motion fallback", () => {
  assert.match(simulatorSource, /prefers-reduced-motion: reduce/);
  assert.match(simulatorSource, /getOpeningCoinFlipRevealDelay\(\{[\s\S]*accessibilityReducedMotion \|\| systemReducedMotion/);
  assert.match(simulatorSource, /return \(\) => window\.clearTimeout\(revealTimer\)/);
  assert.match(boardPresentationSource, /onAnimationEnd=\{\(\) => onLanded\?\.\(event\.flipId\)\}/);
  assert.match(simulatorSource, /@keyframes seapalsCoinFlipHeads/);
  assert.match(simulatorSource, /@keyframes seapalsCoinFlipTails/);
  assert.match(boardPresentationSource, /seapals-opening-coin-landed-\$\{normalizedSide\}/);
  assert.match(boardPresentationStyles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("call and result controls stay compact on the board without changing opening-turn rules", () => {
  assert.match(boardPresentationSource, /isCalling[\s\S]*onCall\?\.\("heads"\)[\s\S]*onCall\?\.\("tails"\)/);
  assert.match(boardPresentationSource, /isResult[\s\S]*onChooseOpeningPlayer\?\.\(OpeningPlayer\.PLAYER\)/);
  assert.match(boardPresentationSource, /onChooseOpeningPlayer\?\.\(OpeningPlayer\.OPPONENT\)/);
  assert.match(boardPresentationSource, /tutorial \? "Begin Setup" : "Go First"/);
  assert.match(boardPresentationStyles, /width:\s*min\(25rem, 100%\)/);
  assert.match(simulatorSource, /if \(previewExperience\) setMobileReefSplit\(MOBILE_REEF_SPLIT_DEFAULT\)/);
});
