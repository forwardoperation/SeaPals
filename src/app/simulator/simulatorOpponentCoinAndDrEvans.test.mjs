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

test("Dr. Evans preserves its resolution and defers a successful refresh until the new hand is mounted", () => {
  const completion = sourceBetween("function completeDrEvans", "function getInspectedPlayerCardInstanceId");
  assert.match(completion, /searchContext\?\.mode !== "draw-seven"/);
  assert.match(completion, /const foundationCards = foundationDeck\.slice\(0, turnDrawSelection\.foundation\)/);
  assert.match(completion, /const palsCards = palsDeck\.slice\(0, turnDrawSelection\.pals\)/);
  assert.match(completion, /const drawnCards = \[\.\.\.foundationCards, \.\.\.palsCards\]/);
  assert.match(completion, /drawWithHandLimit\(drawnCards, 0, drawnCards\.length, Infinity\)/);
  assert.match(completion, /setFoundationDeck\(\(current\) => current\.slice\(foundationCards\.length\)\)/);
  assert.match(completion, /setPalsDeck\(\(current\) => current\.slice\(palsCards\.length\)\)/);
  assert.match(completion, /setHand\(drawResult\.cardsToHand\)/);
  assert.match(
    completion,
    /setDiscardPile\(\(current\) => \[supportCard\.id, \.\.\.discardedHand, \.\.\.drawResult\.cardsToDiscard, \.\.\.current\]\)/,
    "Dr. Evans, the old hand, and any hand-limit overflow must still enter discard in order",
  );
  assert.match(completion, /setRp\([\s\S]*?getPlayerCardPlayCost\(supportCard\)[\s\S]*?getPlayerRpSpendPresentation\(supportCard\)/);
  assert.match(completion, /applyExplicitSupportLock\(supportCard\)/);
  assert.match(completion, /setSearchContext\(null\)/);
  assert.match(completion, /setTurnDrawSelection\(null\)/);
  assert.match(completion, /setModal\(null\)/);
  assert.match(completion, /setSelectedHandCard\(null\)/, "no new hand card is selected while its arrival is pending");
  assert.match(completion, /mandatory seven-card draw[\s\S]*?deck depletion/);
  assert.match(completion, /pushLog\(message\)/, "the detailed resolution remains available in history");
  assert.match(
    completion,
    /if \(shortfall\) setGameResult\([\s\S]*?Dr\. Evans required seven cards[\s\S]*?drawnCards\.length/,
    "an incomplete mandatory refresh must still produce the existing depletion loss",
  );

  assert.match(
    completion,
    /setPendingHandArrivalFlight\(shortfall > 0 \? null : \{[\s\S]*?revealed,[\s\S]*?baseHandLength: 0,[\s\S]*?kind: "dr-evans-refresh",[\s\S]*?announcement: `Dr\. Evans drew \$\{drawResult\.cardsToHand\.length\} new cards into your hand\.`/,
    "only a successful seven-card refresh should enqueue the post-layout presentation",
  );
  assert.doesNotMatch(completion, /startMobileDrawFlights\(/, "the picker commit cannot measure an unmounted hand");
  assert.match(completion, /setEventOverlay\(null\)/);
  assert.doesNotMatch(completion, /type:\s*"utility-result"/);
  assert.doesNotMatch(completion, /compactDrawResult|drawnCards:\s*drawnCards\.map/);

  const arrivalLayoutEffect = sourceBetween(
    "if (!pendingHandArrivalFlight || modal || eventOverlay || gameResult) return;",
    "}, [eventOverlay, gameResult, modal, pendingHandArrivalFlight]);",
  );
  assert.match(arrivalLayoutEffect, /\} = pendingHandArrivalFlight/);
  assert.match(arrivalLayoutEffect, /baseHandLength = 0/);
  assert.match(arrivalLayoutEffect, /kind = "turn-draw"/);
  assert.match(
    arrivalLayoutEffect,
    /startMobileDrawFlights\(revealed, baseHandLength, \{[\s\S]*?kind,[\s\S]*?sourceZone,[\s\S]*?focusOnComplete,[\s\S]*?announcement/,
    "a pending arrival starts only after the mounted hand can provide its exact destination",
  );
  assert.match(arrivalLayoutEffect, /setPendingHandArrivalFlight\(null\)/);
  assert.match(
    arrivalLayoutEffect,
    /if \(!arrivalFlightsStarted\) \{[\s\S]*?setMobileDrawAnnouncement\(announcement\);[\s\S]*?mobileDrawFallbackFocusFrameRef\.current = window\.requestAnimationFrame[\s\S]*?data-mobile-hand-card-index="\$\{baseHandLength\}"[\s\S]*?data-tutorial-target="turn-button"/,
    "a readable announcement and surviving focus target must replace the animation when flight geometry is unavailable",
  );

  const drawCompletionEffect = sourceBetween(
    "if (!mobileDrawSequenceActiveRef.current) return undefined;",
    "useEffect(() => () => {",
  );
  assert.match(
    drawCompletionEffect,
    /focusedHandItem\.offsetLeft \+ focusedHandItem\.offsetWidth \/ 2 - handRail\.clientWidth \/ 2/,
    "completion must center the card that receives keyboard focus",
  );
  assert.match(drawCompletionEffect, /data-tutorial-target="turn-button"[^\n]+:not\(\[disabled\]\)/);
  assert.doesNotMatch(
    sourceBetween("mobileDrawSequenceActiveRef.current = false;", "return undefined;"),
    /left: handRail\.scrollWidth/,
    "Dr. Evans must not leave focus on the first card while the rail stays at its far edge",
  );

  const handLimitEffect = sourceBetween(
    'if (gameResult || !["draw", "main"].includes(gamePhase) || !Number.isFinite(activeHandLimit)) return;',
    "function getEmbeddedLessonBlock",
  );
  assert.match(
    handLimitEffect,
    /if \(pendingHandArrivalFlight \|\| mobileDrawFlights\.length\) return/,
    "the Condition hand-limit picker must wait for the pending plan and all live arrival flights",
  );
  assert.match(handLimitEffect, /mobileDrawFlights\.length[\s\S]*?pendingHandArrivalFlight\]\);/);

  const turnControlLock = sourceBetween("const turnControlDisabled =", "const turnControlLabel =");
  assert.match(
    turnControlLock,
    /Boolean\(pendingHandArrivalFlight\)[\s\S]*?mobileDrawFlights\.length > 0/,
    "turn controls stay locked from the pending refresh through the final live flight",
  );
  const reefControlLock = sourceBetween("const boardInteractionOverlayActive =", "const v2TopChromeHidden =");
  assert.match(
    reefControlLock,
    /Boolean\(pendingHandArrivalFlight\)[\s\S]*?mobileDrawFlights\.length > 0/,
    "reef controls stay locked from the pending refresh through the final live flight",
  );

  const arrivingIndexes = sourceBetween(
    "const mobileHandArrivingIndexes =",
    "const compactOpponentReaderEvent",
  );
  assert.match(
    arrivingIndexes,
    /pendingHandArrivalFlight\?\.revealed[\s\S]*?filter\(\(entry\) => !entry\.discarded\)[\s\S]*?map\(\(_,[ ]*index\) => pendingHandArrivalFlight\.baseHandLength \+ index\)/,
    "a pending plan conceals its exact appended hand positions until flight handoff",
  );
  assert.match(arrivingIndexes, /mobileDrawFlights\.map\(\(flight\) => flight\.handIndex\)/);

  const prepareFlight = sourceBetween("function prepareMobileDrawFlight", "function finishMobileDrawFlight");
  assert.match(
    prepareFlight,
    /\["opening-hand", "discard-recovery", "dr-evans-refresh", "deck-search"\]\.includes\(flight\?\.kind\)/,
  );

  const ordinaryRecovery = sourceBetween("function completeCreatureRecovery", "function completeCreatureActionSearch");
  assert.match(
    ordinaryRecovery,
    /else \{[\s\S]*?setEventOverlay\(\{ type: "utility-result"/,
    "ordinary utility resolutions must retain their result overlay",
  );
});
