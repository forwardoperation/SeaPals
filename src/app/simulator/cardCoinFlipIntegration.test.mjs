import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const cardCoinPresentationSource = await readFile(new URL("./CardCoinBoardPresentation.jsx", import.meta.url), "utf8");
const openingCoinStylesSource = await readFile(new URL("./OpeningCoinBoardPresentation.module.css", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = simulatorSource.indexOf(startMarker);
  const end = simulatorSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return simulatorSource.slice(start, end);
}

function countMatches(source, expression) {
  return source.match(expression)?.length ?? 0;
}

test("card flips use dedicated state without replacing the opening event-overlay flow", () => {
  assert.match(simulatorSource, /from "\.\/cardCoinFlip\.mjs"/);
  for (const symbol of [
    "CardCoinPhase",
    "cancelCardCoinFlip",
    "completeCardCoinFlip",
    "consumeCardCoinContinuation",
    "createCardCoinReadyState",
    "getCardCoinFlipRevealDelay",
    "startCardCoinFlip",
  ]) {
    assert.match(simulatorSource, new RegExp(`\\b${symbol}\\b`), `Simulator should use ${symbol}`);
  }
  assert.match(simulatorSource, /const \[cardCoinFlip, setCardCoinFlip\] = useState\(null\)/);

  const openingFlow = sourceBetween("function cancelOpeningCoinFlip", "function chooseOpeningTurn");
  assert.match(openingFlow, /eventOverlay\?\.type !== OpeningCoinPhase\.READY/);
  assert.match(openingFlow, /forcedWinner: tutorialUsesScriptedScenario \? OpeningPlayer\.PLAYER : null/);
  assert.doesNotMatch(openingFlow, /cardCoinFlip|CardCoinPhase/);
});

test("one V2 card tap samples once and reduced motion still lands through an ID-guarded fallback", () => {
  assert.match(
    simulatorSource,
    /startCardCoinFlip\([\s\S]{0,350}?random:\s*nextGameplayRandom/,
    "the player tap should consume the persisted gameplay stream rather than ambient randomness",
  );
  assert.match(simulatorSource, /cardCoinFlip\?\.phase !== CardCoinPhase\.FLIPPING/);
  assert.match(simulatorSource, /const (?:flipId|cardCoinFlipId) = cardCoinFlip\.id/);
  assert.match(
    simulatorSource,
    /getCardCoinFlipRevealDelay\(\{[\s\S]{0,250}?accessibilityReducedMotion \|\| systemReducedMotion/,
  );
  assert.match(simulatorSource, /completeCardCoinFlip\([\s\S]{0,180}?(?:flipId|cardCoinFlipId)/);
  assert.match(simulatorSource, /return \(\) => window\.clearTimeout\((?:revealTimer|timer)\)/);

  const startCall = simulatorSource.indexOf("startCardCoinFlip(");
  const surroundingFlow = simulatorSource.slice(Math.max(0, startCall - 700), startCall + 900);
  assert.doesNotMatch(
    surroundingFlow,
    /forcedWinner|tutorialUsesScriptedScenario/,
    "only the opening toss may be tutorial-forced; card outcomes remain real coin flips",
  );
});

test("Recovery commits once, snapshots the old discard pile, and defers only the V2 outcome", () => {
  const playCard = sourceBetween("function playCardFromHand(cardId)", "function completeInvasivePlacement");
  const recovery = playCard.slice(
    playCard.indexOf('if (card.id === "recovery")'),
    playCard.indexOf('if (card.id === "scientist-jes")'),
  );
  assert.ok(recovery.length > 0, "missing Recovery Support branch");

  const snapshotIndex = recovery.indexOf("const recoveredCandidates = [...new Set(discardPile)]");
  const discardCommitIndex = recovery.indexOf("setDiscardPile(");
  assert.ok(snapshotIndex >= 0 && snapshotIndex < discardCommitIndex, "eligible cards must be captured before Recovery enters discard");

  assert.equal(countMatches(recovery, /setHand\(/g), 1, "Recovery leaves the hand once");
  assert.equal(countMatches(recovery, /setDiscardPile\(/g), 1, "Recovery enters discard once");
  assert.equal(countMatches(recovery, /setRp\(/g), 1, "Recovery charges its RP cost once");
  assert.equal(countMatches(recovery, /applyExplicitSupportLock\(/g), 1, "a printed Support lock is committed once");

  assert.match(recovery, /\(card\.effects \?\? \[\]\)\.find\([^\n]*EffectType\.FLIP_COIN/);
  assert.match(
    recovery,
    /if \(previewExperience\) \{[\s\S]*?beginCardCoinFlipPresentation\(\{[\s\S]*?sourceCardId:\s*card\.id[\s\S]*?successResult:[\s\S]*?continuation:\s*\{[\s\S]*?type:\s*"recover-from-discard"[\s\S]*?candidates:\s*recoveredCandidates[\s\S]*?\}\)[\s\S]*?return;[\s\S]*?\}\s*if \(nextGameplayRandom\(\) < 0\.5\)/,
    "V2 should stage the board toss without sampling; the legacy presentation path still consumes the persisted stream",
  );
  assert.doesNotMatch(
    recovery.slice(recovery.indexOf("if (previewExperience)"), recovery.indexOf("if (nextGameplayRandom()")),
    /Math\.random/,
  );
});

test("Recovery heads resumes its original picker while tails returns to the V2 reef", () => {
  assert.match(simulatorSource, /consumeCardCoinContinuation\(/);
  assert.match(
    simulatorSource,
    /continuation\?\.type === "recover-from-discard"[\s\S]{0,700}?outcome\.success[\s\S]{0,700}?setSearchContext\(\{[\s\S]{0,500}?mode:\s*"recover"[\s\S]{0,500}?candidates:\s*continuation\.candidates[\s\S]{0,500}?setModal\("recover"\)/,
    "heads should enter the existing discard-card chooser using the pre-play snapshot",
  );
  assert.match(
    simulatorSource,
    /continuation\?\.type === "recover-from-discard"[\s\S]{0,1800}?returnFromSupportFlowToBoard\(\)/,
    "tails should reuse the existing V2-aware return helper",
  );

  const continuationStart = simulatorSource.search(/function (?:continue|resolve)CardCoinFlip/);
  assert.ok(continuationStart >= 0, "missing card-coin continuation resolver");
  const continuationEnd = simulatorSource.indexOf("\n  function ", continuationStart + 12);
  const continuationFlow = simulatorSource.slice(
    continuationStart,
    continuationEnd > continuationStart ? continuationEnd : continuationStart + 5000,
  );
  assert.doesNotMatch(continuationFlow, /Math\.random|setRp\(|applyExplicitSupportLock\(/, "continuation consumes the stored packet and never repays or rerolls");
  const staleGuard = continuationFlow.search(/cardCoinFlipIdRef\.current !== cardCoinFlip\.id/);
  const consume = continuationFlow.indexOf("consumeCardCoinContinuation(cardCoinFlip)");
  assert.ok(staleGuard >= 0 && staleGuard < consume, "Continue must reject a stale or already-consumed flip before replaying its descriptor");
});

test("the generic card presentation reuses the opening coin visual as one accessible board tap", () => {
  assert.match(cardCoinPresentationSource, /import \{ OpeningCoinVisual \} from "\.\/OpeningCoinBoardPresentation"/);
  assert.match(cardCoinPresentationSource, /data-card-coin-layer/);
  assert.match(cardCoinPresentationSource, /role=\{isAutomatic \? "status" : "dialog"\}/);
  assert.match(cardCoinPresentationSource, /aria-modal=\{isAutomatic \? undefined : "true"\}/);
  assert.match(cardCoinPresentationSource, /data-flip-card-coin/);
  assert.match(cardCoinPresentationSource, /onClick=\{onStop\}/);
  assert.match(cardCoinPresentationSource, /Tap anywhere on the board, or press Enter or Space/);
  assert.match(cardCoinPresentationSource, /onAnimationEnd=\{\(\) => onLanded\?\.\(event\.id\)\}/);
  assert.match(cardCoinPresentationSource, /data-continue-card-coin[\s\S]*onClick=\{onContinue\}/);
  assert.match(cardCoinPresentationSource, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(cardCoinPresentationSource, /reducedMotion \|\| isAutomatic \? "ready" : "spinning"/);
  assert.doesNotMatch(cardCoinPresentationSource, /onCancel|Cancel Flip/);
});

test("card results stay reachable at extreme mobile splits and failed flips restore board focus", () => {
  assert.match(cardCoinPresentationSource, /isResult \? ` \$\{styles\.cardCoinResultZone\}`/);
  assert.match(
    openingCoinStylesSource,
    /\.cardCoinResultZone\s*\{[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/,
  );
  assert.match(
    openingCoinStylesSource,
    /@media \(min-width: 0px\)[\s\S]*?\.cardCoinResultZone\s*\{[\s\S]*?inset-block-start:\s*min\([\s\S]*?50%\);/,
    "a high divider split must leave the result at least half of the board height",
  );
  assert.match(simulatorSource, /function focusBoardAfterCardCoinResult\(\)/);
  assert.match(
    simulatorSource,
    /\.find\(\(candidate\) => \([\s\S]*?candidate\?\.getClientRects\?\.\(\)\.length > 0[\s\S]*?!candidate\.closest\('\[inert\]'\)/,
    "focus restoration must skip hidden desktop/mobile variants and inert controls",
  );
  assert.match(
    simulatorSource,
    /returnFromSupportFlowToBoard\(\);\s*focusBoardAfterCardCoinResult\(\);\s*pushLog\("Recovery coin flip: tails/,
    "tails should move focus to a surviving board control after removing Continue",
  );
});

test("the committed card coin locks every V2 board surface until its continuation is consumed", () => {
  assert.match(simulatorSource, /const cardCoinBoardActive = Boolean\(previewExperience && cardCoinFlip\)/);
  assert.match(
    simulatorSource,
    /const boardInteractionOverlayActive = boardFaceoffActive \|\| openingCoinBoardActive \|\| cardCoinBoardActive/,
  );
  assert.match(simulatorSource, /data-card-coin-active=\{cardCoinBoardActive \? "true" : undefined\}/);
  assert.match(simulatorSource, /active=\{cardCoinBoardActive && !boardStatPresentationActive\}[\s\S]{0,500}?(?:event|coin|state)=\{cardCoinFlip\}/);
  assert.match(simulatorSource, /v2TopChromeHidden[\s\S]{0,700}?\|\| cardCoinBoardActive/);
  assert.equal(
    countMatches(simulatorSource, /inert=\{boardInteractionOverlayActive \? true : undefined\}/g),
    3,
    "opponent reef, divider, and player reef stay inert",
  );
  assert.match(simulatorSource, /interactionDisabled=\{boardInteractionOverlayActive \|\|/);
  assert.match(
    simulatorSource,
    /disabled=\{boardInteractionOverlayActive \|\| turnControlDisabled\}/,
    "the divider turn control should combine modal locking with the shared phase-safe round lock",
  );
});

test("restart cancellation invalidates a card toss, while legacy Recovery and opening tutorial behavior remain", () => {
  const restart = sourceBetween("function restartGame(", "function openNewGameSetup");
  assert.match(restart, /cancelCardCoinFlipPresentation\(\)/);
  const cancellation = sourceBetween("function cancelCardCoinFlipPresentation", "function beginCardCoinFlipPresentation");
  assert.match(cancellation, /cardCoinFlipIdRef\.current \+= 1/);
  assert.match(cancellation, /cardCoinFlipActiveRef\.current = false/);
  assert.match(cancellation, /setCardCoinFlip\(cancelCardCoinFlip\(\)\)/);

  const playCard = sourceBetween("function playCardFromHand(cardId)", "function completeInvasivePlacement");
  const recovery = playCard.slice(
    playCard.indexOf('if (card.id === "recovery")'),
    playCard.indexOf('if (card.id === "scientist-jes")'),
  );
  assert.match(recovery, /if \(nextGameplayRandom\(\) < 0\.5\)[\s\S]*?setModal\("recover"\)/);
  assert.match(recovery, /else \{[\s\S]*?returnFromSupportFlowToBoard\(\)/);

  const openingFlip = sourceBetween("function flipForOpeningTurn", "function completeOpeningCoinFlip");
  assert.match(openingFlip, /forcedWinner: tutorialUsesScriptedScenario \? OpeningPlayer\.PLAYER : null/);
  assert.doesNotMatch(openingFlip, /cardCoinFlip|CardCoinPhase/);
});
