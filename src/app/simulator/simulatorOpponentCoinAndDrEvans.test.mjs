import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const cardCoinSource = await readFile(new URL("./CardCoinBoardPresentation.jsx", import.meta.url), "utf8");
const cardCoinStyles = await readFile(new URL("./OpeningCoinBoardPresentation.module.css", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = simulatorSource.indexOf(startMarker);
  const end = simulatorSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return simulatorSource.slice(start, end);
}

test("opponent Recovery and targeted coin actions retain their already-resolved outcome", () => {
  const supports = sourceBetween("function runOpponentSupports", "function runOpponentTurn");
  const recoveryStart = supports.indexOf('} else if (card.id === "recovery") {');
  const recoveryEnd = supports.indexOf('} else if (card.id === "ocean-jake") {', recoveryStart);
  const recovery = supports.slice(recoveryStart, recoveryEnd);
  assert.match(recovery, /const coin = nextGameplayRandom\(\) < 0\.5 \? "heads" : "tails"/);
  assert.match(recovery, /opponentCoinFlip = \{[\s\S]*?result: coin[\s\S]*?successResult: "heads"/);
  assert.match(supports, /type: "opponent-play"[\s\S]*?opponentCoinFlip,/);

  const utility = sourceBetween("function runOpponentUtilityAction", "function runOpponentUtilityActions");
  assert.match(utility, /const coinResolution = resolveTargetedCoinFlip/);
  assert.match(utility, /coinFlip: \{[\s\S]*?result: coinResolution\.coinResult[\s\S]*?successResult/);
  const utilityEvents = sourceBetween("function buildOpponentUtilityEvents", "function runOpponentNormalAttackActions");
  assert.match(utilityEvents, /opponentCoinFlip: opponentUtility\.coinFlip \?\? null/);
});

test("compact playback inserts one automatic opponent-reef coin beat before resuming the original event", () => {
  const presenter = sourceBetween("function beginQueuedOpponentCoinPresentation", "function closeEventOverlay");
  assert.match(presenter, /owner: "opponent"/);
  assert.match(presenter, /automatic: true/);
  assert.match(presenter, /forcedResult: presentation\.result/);
  assert.match(presenter, /type: "resume-opponent-event"/);
  assert.match(presenter, /opponentCoinFlipPresented: true/);
  assert.match(presenter, /event\.opponentCoinFlip[\s\S]*?!event\.opponentCoinFlipPresented[\s\S]*?beginQueuedOpponentCoinPresentation\(event\)/);
  assert.match(simulatorSource, /forcedResult: cardCoinFlip\.forcedResult/);
  assert.match(simulatorSource, /continuation\?\.type === "resume-opponent-event"[\s\S]*?presentQueuedEvent\(continuation\.event, pendingEventsRef\.current, \{ delayForOpponent: false \}\)/);

  assert.match(cardCoinSource, /event\.owner === "opponent" \? ` \$\{styles\.opponentZone\}`/);
  assert.match(cardCoinSource, /phase === CardCoinPhase\.READY[\s\S]*?event\.autoStartDelay/);
  assert.match(cardCoinSource, /isWaiting && !isAutomatic/);
  assert.match(cardCoinSource, /data-card-coin-automatic/);
  assert.match(cardCoinStyles, /\.playerZone\.opponentZone\s*\{[\s\S]*?height:\s*calc\(var\(--seapals-mobile-reef-split, 50%\) - 1\.375rem\)/);
});

test("Dr. Evans uses concise structured copy and a horizontal, non-wrapping card rail", () => {
  const completion = sourceBetween("function completeDrEvans", "function getInspectedPlayerCardInstanceId");
  assert.match(completion, /compactDrawResult: \{/);
  assert.match(completion, /discardedHandCount: discardedHand\.length/);
  assert.match(completion, /foundationDrawn: foundationCards\.length/);
  assert.match(completion, /palsDrawn: palsCards\.length/);
  assert.match(completion, /pendingHandLimitDiscardCount/);
  assert.match(completion, /pushLog\(message\)/, "the detailed resolution remains available in history");

  assert.match(simulatorSource, /eventOverlay\.sourceCardId && !compactDrawResultEvent/);
  assert.match(simulatorSource, /data-compact-draw-result/);
  assert.match(simulatorSource, /<ol[\s\S]*?data-compact-draw-rail[\s\S]*?overflow-x-auto overflow-y-hidden/);
  assert.match(simulatorSource, /shrink-0 snap-start/);
  assert.match(simulatorSource, /Scroll left or right/);
  assert.match(simulatorSource, /aria-label="Show previous drawn cards"[\s\S]*?scrollCompactDrawRail\(-1\)/);
  assert.match(simulatorSource, /aria-label="Show next drawn cards"[\s\S]*?scrollCompactDrawRail\(1\)/);
  assert.match(simulatorSource, /rail\.scrollBy\(\{[\s\S]*?rail\.clientWidth \* 0\.72/);
  assert.match(simulatorSource, /seapals-event-card\.seapals-compact-draw-event\s*\{[\s\S]*?height:\s*min\(40rem, calc\(100dvh - 1\.5rem\)\)[\s\S]*?overflow:\s*hidden/);
  assert.match(simulatorSource, /\.seapals-compact-draw-rail\s*\{[\s\S]*?min-height:\s*5\.75rem;[\s\S]*?flex:\s*1 1 auto/);
  assert.match(simulatorSource, /\.seapals-compact-draw-card\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\) auto auto/);
  assert.match(simulatorSource, /\.seapals-compact-draw-card-image\s*\{[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0/);
  assert.match(simulatorSource, /@media \(max-height: 31rem\)/);
  assert.match(simulatorSource, /data-compact-draw-continue[\s\S]*?onClick=\{closeEventOverlay\}/);
  const railIndex = simulatorSource.indexOf("data-compact-draw-rail");
  const continueIndex = simulatorSource.indexOf("data-compact-draw-continue", railIndex);
  assert.ok(continueIndex > railIndex, "Continue stays outside and after the horizontal card rail");
});
