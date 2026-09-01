import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const boardPresentationSource = await readFile(new URL("./OpeningCoinBoardPresentation.jsx", import.meta.url), "utf8");
const boardPresentationStyles = await readFile(new URL("./OpeningCoinBoardPresentation.module.css", import.meta.url), "utf8");

function textBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

function sourceBetween(startMarker, endMarker) {
  return textBetween(simulatorSource, startMarker, endMarker);
}

test("opening coin flow starts ready and needs only one player-triggered toss", () => {
  const flow = sourceBetween("function cancelOpeningCoinFlip", "function chooseOpeningTurn");
  const openFlow = sourceBetween("function openOpeningCoinFlip", "function finishTutorialIntroduction");

  assert.doesNotMatch(flow, /function prepareOpeningCoinFlip|createOpeningCoinCallOverlay/);
  assert.match(flow, /function flipForOpeningTurn\(\)/);
  assert.match(flow, /eventOverlay\?\.type !== OpeningCoinPhase\.READY/);
  assert.match(flow, /openingCoinFlipActiveRef\.current/);
  assert.match(flow, /resolveOpeningCoinFlip\(\{[\s\S]*?random: Math\.random,[\s\S]*?forcedWinner:/);
  assert.doesNotMatch(flow, /call:|coinCall/);
  assert.match(flow, /createOpeningCoinFlippingOverlay/);
  assert.match(openFlow, /createOpeningCoinReadyOverlay\(\)/);
  assert.doesNotMatch(openFlow, /createOpeningCoinCallOverlay/);
});

test("the V2 opening flip remains a board-native, one-tap interaction in the player ecosystem", () => {
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

test("the board never asks the player to call a side or choose the opening player", () => {
  assert.doesNotMatch(boardPresentationSource, /\bonCall\b|\bonChangeCall\b/);
  assert.doesNotMatch(boardPresentationSource, />\s*Heads\s*</i);
  assert.doesNotMatch(boardPresentationSource, />\s*Tails\s*</i);
  assert.doesNotMatch(boardPresentationSource, /Change call|>\s*Go First\s*<|Let Opponent Go First/i);
  assert.equal((boardPresentationSource.match(/Begin Setup/g) ?? []).length, 1);
  assert.match(
    boardPresentationSource,
    /onClick=\{onBeginSetup\}[\s\S]*?>\s*Begin Setup\s*</,
  );
  assert.doesNotMatch(simulatorSource, /onCall=|onChangeCall=/);
  assert.match(simulatorSource, /onBeginSetup=\{chooseOpeningTurn\}/);
});

test("the coin uses reef-fish and blank faces with a win-only light burst", () => {
  assert.match(boardPresentationSource, /src="\/images\/icons\/reef-fish-icon\.png"/);
  assert.match(boardPresentationSource, /seapals-opening-coin-fish/);
  assert.match(boardPresentationSource, /seapals-opening-coin-blank/);
  assert.match(boardPresentationSource, /celebrate=\{playerWon\}/);
  assert.match(boardPresentationSource, /data-opening-coin-win-burst/);
  assert.match(boardPresentationStyles, /@keyframes boardCoinBurstHalo/);
  assert.match(boardPresentationStyles, /@keyframes boardCoinBurstRay/);
  assert.match(boardPresentationStyles, /\.reducedMotion \.burstHalo[\s\S]*?opacity:/);
  assert.match(boardPresentationStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.burstSpark/);
});

test("the opening coin flips vertically end over end instead of turning side to side", () => {
  const boardMotion = textBetween(
    boardPresentationStyles,
    "@keyframes boardCoinSpin",
    "@keyframes boardCoinBurstHalo",
  );
  const legacyMotion = textBetween(
    simulatorSource,
    "@keyframes seapalsCoinReady",
    "@keyframes seapalsCoinShadow",
  );
  const faceGeometry = textBetween(
    simulatorSource,
    ".seapals-opening-coin-fish { transform:",
    ".seapals-opening-coin-shadow",
  );

  assert.match(boardMotion, /rotateX\(1080deg\)/);
  assert.match(boardMotion, /rotateX\(1980deg\)/);
  assert.doesNotMatch(boardMotion, /rotateY\(/);
  assert.match(legacyMotion, /rotateX\(1800deg\)/);
  assert.match(legacyMotion, /rotateX\(1980deg\)/);
  assert.doesNotMatch(legacyMotion, /rotateY\(/);
  assert.match(faceGeometry, /opening-coin-blank \{ transform: rotateX\(180deg\)/);
  assert.match(faceGeometry, /opening-coin-landed-blank \{ transform: rotateX\(180deg\)/);
  assert.doesNotMatch(faceGeometry, /rotateY\(/);
});

test("the landed side is handed directly to setup as the automatic starter", () => {
  const chooseFlow = sourceBetween("function chooseOpeningTurn", "function openOpeningCoinFlip");
  assert.match(chooseFlow, /function chooseOpeningTurn\(\)/);
  assert.match(chooseFlow, /winner: eventOverlay\?\.coinWinner/);
  assert.doesNotMatch(chooseFlow, /playerChoice/);
  assert.match(chooseFlow, /setStartingPlayer\(chosenStarter\)/);
  assert.match(chooseFlow, /chooseOpeningPlayer\(\{[\s\S]*?tutorial: tutorialUsesScriptedScenario/);
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

test("tutorial and reduced-motion tosses still land deterministically without skipping resolution", () => {
  const flipFlow = sourceBetween("function flipForOpeningTurn", "function completeOpeningCoinFlip");
  assert.match(flipFlow, /forcedWinner: tutorialUsesScriptedScenario \? OpeningPlayer\.PLAYER : null/);
  assert.match(simulatorSource, /prefers-reduced-motion: reduce/);
  assert.match(simulatorSource, /getOpeningCoinFlipRevealDelay\(\{[\s\S]*accessibilityReducedMotion \|\| systemReducedMotion/);
  assert.match(simulatorSource, /return \(\) => window\.clearTimeout\(revealTimer\)/);
  assert.match(boardPresentationSource, /onAnimationEnd=\{\(\) => onLanded\?\.\(event\.flipId\)\}/);
  assert.match(boardPresentationSource, /seapals-opening-coin-landed-\$\{normalizedSide\}/);
  assert.match(boardPresentationStyles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("opening the toss still favors Your Reef on constrained mobile screens", () => {
  const openFlow = sourceBetween("function openOpeningCoinFlip", "function finishTutorialIntroduction");
  assert.match(openFlow, /if \(previewExperience\) setMobileReefSplit\(MOBILE_REEF_SPLIT_DEFAULT\)/);
  assert.match(boardPresentationStyles, /width:\s*min\(25rem, 100%\)/);
});
