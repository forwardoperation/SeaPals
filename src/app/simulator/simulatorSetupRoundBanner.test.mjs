import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("V2 sequences the setup banner, opening-hand deal, and three RP while legacy keeps its setup event", () => {
  const chooseOpeningTurn = sourceSection(
    simulatorSource,
    "function chooseOpeningTurn()",
    "function openOpeningCoinFlip()",
  );

  assert.match(chooseOpeningTurn, /const setupRoundEvent = \{/);
  assert.match(chooseOpeningTurn, /type: "round-transition"/);
  assert.match(chooseOpeningTurn, /title: "Setup Round"/);
  assert.match(chooseOpeningTurn, /if \(compactTurnPresentationEnabled\) \{[\s\S]*?setEventOverlay\(null\);/);
  assert.match(chooseOpeningTurn, /setSetupOpeningHandVisibleCount\(0\);/);
  assert.match(chooseOpeningTurn, /beginCompactTurnSequence\(\{[\s\S]*?owner: "player"/);
  assert.match(chooseOpeningTurn, /turnLabel: setupRoundEvent\.title/);
  assert.match(chooseOpeningTurn, /includeCondition: false/);
  assert.match(chooseOpeningTurn, /includeOpeningHand: true/);
  assert.match(chooseOpeningTurn, /openingHand: \[\.\.\.hand\]/);
  assert.match(chooseOpeningTurn, /includeRp: true/);
  assert.match(chooseOpeningTurn, /rpBefore: 0/);
  assert.match(chooseOpeningTurn, /rpAfter: 3/);
  assert.match(chooseOpeningTurn, /collectedRp: 3/);
  assert.match(chooseOpeningTurn, /rpSources: \[\{ key: "round-supply", amount: 3 \}\]/);
  assert.match(chooseOpeningTurn, /setSetupOpeningHandVisibleCount\(null\);/);
  assert.match(chooseOpeningTurn, /\} else \{[\s\S]*?setEventOverlay\(setupRoundEvent\);/);
  assert.doesNotMatch(
    chooseOpeningTurn,
    /setEventOverlay\(\{[\s\S]*?type: "round-transition"/,
    "The setup event should be routed through the V2/legacy branch instead of always opening a modal.",
  );
});

test("the setup deal reveals committed hand cards by landing index before advancing to RP", () => {
  const compactStagePlayback = sourceSection(
    simulatorSource,
    "useEffect(() => {\n    const sequence = compactTurnSequence;",
    "useEffect(() => () => {\n    clearCompactTurnAsyncHandles();",
  );

  assert.match(compactStagePlayback, /stage\.kind === CompactTurnStage\.OPENING_HAND/);
  assert.match(compactStagePlayback, /startMobileDrawFlights\(openingCards, 0, \{/);
  assert.match(compactStagePlayback, /kind: "opening-hand"/);
  assert.match(compactStagePlayback, /landedIndexes\.add\(flight\.handIndex\)/);
  assert.match(compactStagePlayback, /while \(landedIndexes\.has\(next\)\) next \+= 1/);
  assert.match(compactStagePlayback, /onComplete: completeOpeningDeal/);
  assert.match(compactStagePlayback, /onCancel: completeOpeningDeal/);
  assert.match(compactStagePlayback, /advanceCompactTurnSequence\(sequence\.id\)/);
});

test("the concealed hand restores the presented deck count and remains unplayable until setup completes", () => {
  assert.match(simulatorSource, /setupOpeningHandConcealedCount = hand\.length - setupOpeningHandPresentedCount/);
  assert.match(
    simulatorSource,
    /deckCount=\{foundationDeck\.length \+ palsDeck\.length \+ setupOpeningHandConcealedCount\}/,
  );
  assert.match(simulatorSource, /arrivingIndexes=\{mobileHandArrivingIndexes\}/);
  assert.match(
    simulatorSource,
    /if \(compactTurnSequenceRef\.current\) return "Wait for the board sequence to finish before playing a card\."/,
  );
});

test("draw-flight completion is idempotent when animation and timeout finish together", () => {
  const finishFlight = sourceSection(
    simulatorSource,
    "function finishMobileDrawFlight(flightOrId)",
    "function clearMobileDrawFlightSequence",
  );

  assert.match(finishFlight, /!mobileDrawFlightTimersRef\.current\.has\(flightId\)/);
  assert.match(finishFlight, /mobileDrawSequenceCallbacksRef\.current\.onCardLanded\?\.\(flightOrId\)/);
  assert.match(finishFlight, /if \(!mobileDrawFlightTimersRef\.current\.size\)/);
  assert.match(finishFlight, /onComplete\?\.\(\)/);
});

test("opening-hand flights follow each actual card slot without forcing the rail to its end", () => {
  assert.match(
    simulatorSource,
    /if \(mobileDrawFlights\.length\) \{[\s\S]*?if \(mobileDrawFocusIndexRef\.current == null\) return undefined;[\s\S]*?handRail\?\.scrollTo\?\./,
  );
  assert.match(simulatorSource, /function prepareMobileDrawFlight\(flight, flightElement\)/);
  assert.match(simulatorSource, /targetItem\.offsetLeft \+ targetItem\.offsetWidth \/ 2 - handRail\.clientWidth \/ 2/);
  assert.match(simulatorSource, /targetCard\.getBoundingClientRect\(\)/);
  assert.match(
    simulatorSource,
    /onAnimationStart=\{\(event\) => prepareMobileDrawFlight\(flight, event\.currentTarget\)\}/,
  );
});

test("a viewport change before or during the deal fast-forwards safely to RP", () => {
  assert.match(simulatorSource, /compactDrawViewportRef\.current = viewportQuery\.matches/);
  assert.match(
    simulatorSource,
    /!previewDrawTrayEnabled[\s\S]*?\|\| !compactDrawViewportRef\.current[\s\S]*?return false/,
  );
  assert.match(simulatorSource, /clearMobileDrawFlightSequence\(\{ notifyCancel: true \}\)/);
  assert.match(simulatorSource, /onCancel: completeOpeningDeal/);
});
