import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const mobileEdgeZonesSource = await readFile(new URL("./MobileEdgeZones.jsx", import.meta.url), "utf8");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

function keyframeSteps(source, animationName, nextAnimationName) {
  const keyframes = sourceSection(
    source,
    `@keyframes ${animationName} {`,
    `@keyframes ${nextAnimationName} {`,
  );
  const stepPattern = /((?:(?:from|to|\d+(?:\.\d+)?%)\s*(?:,\s*)?)+)\s*\{([^{}]*)\}/g;
  return [...keyframes.matchAll(stepPattern)].flatMap((match) => {
    const percentages = [...match[1].matchAll(/from|to|(\d+(?:\.\d+)?)%/g)].map((label) => {
      if (label[0] === "from") return 0;
      if (label[0] === "to") return 100;
      return Number(label[1]);
    });
    return percentages.map((percentage) => ({ percentage, body: match[2] }));
  });
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
  assert.match(
    finishFlight,
    /if \([\s\S]*?!mobileDrawFlightTimersRef\.current\.size[\s\S]*?&& !mobileDrawHandoffFramesRef\.current\.size[\s\S]*?&& !mobileDrawLandingAnimationsRef\.current\.size[\s\S]*?\) \{[\s\S]*?onComplete\?\.\(\)/,
    "completion must wait until timers, paint-boundary handoffs, and live-card animations are all idle",
  );
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

test("overlapping setup flights do not invalidate an earlier card's measured hand-slot landing", () => {
  const startDrawFlights = sourceSection(
    simulatorSource,
    "function startMobileDrawFlights(revealed, baseHandLength, {",
    "function confirmTurnDraw()",
  );
  const prepareFlight = sourceSection(
    simulatorSource,
    "function prepareMobileDrawFlight(flight, flightElement)",
    "function finishMobileDrawFlight",
  );
  const finishFlight = sourceSection(
    simulatorSource,
    "function finishMobileDrawFlight(flightOrId)",
    "function clearMobileDrawFlightSequence",
  );
  const timing = startDrawFlights.match(
    /const duration = reducedMotion \? \d+ : openingHandDeal \? (\d+) : \d+;[\s\S]*?const stagger = reducedMotion \?[^;]+: (\d+);/,
  );

  assert.ok(timing, "setup draw timing should remain explicit so overlap is reviewable");
  assert.ok(
    Number(timing[1]) > Number(timing[2]),
    "this regression applies while setup cards intentionally overlap in flight",
  );
  assert.match(
    prepareFlight,
    /handRail\.scrollTo\?\.\(\{[\s\S]*?left: targetScrollLeft,[\s\S]*?behavior: flight\.reducedMotion \? "auto" : "smooth",[\s\S]*?\}\);/,
    "the fast overlapping deal should not snap the hand rail between airborne cards",
  );
  assert.match(
    finishFlight,
    /data-mobile-hand-card-index="\$\{flightOrId\.handIndex\}"/,
    "landing should resolve the live indexed hand item after intervening rail movement",
  );
  assert.match(finishFlight, /data-mobile-draw-flight-id="\$\{flightId\}"/);
  assert.match(finishFlight, /const targetRect = targetItem\?\.getBoundingClientRect\(\)/);
  assert.match(finishFlight, /const targetCardRect = targetCard\?\.getBoundingClientRect\(\)/);
  assert.match(finishFlight, /const flightRect = flightElement\?\.getBoundingClientRect\(\)/);
  assert.match(
    finishFlight,
    /const landingScale = Math\.max\(0\.1, flightRect\.width \/ targetCardRect\.width\);[\s\S]*?flightRect\.left[\s\S]*?- targetRect\.left[\s\S]*?- landingScale \* \(targetCardRect\.left - targetRect\.left\)[\s\S]*?flightRect\.top[\s\S]*?- targetRect\.top[\s\S]*?- landingScale \* \(targetCardRect\.top - targetRect\.top\)/,
    "the FLIP should compensate for the visible button's built-in lift and rotation inside its list item",
  );
  assert.match(
    finishFlight,
    /targetItem\.animate\(\[[\s\S]*?translate3d\(\$\{offsetX\}px, \$\{offsetY\}px, 0\) scale\(\$\{landingScale\}\)[\s\S]*?translate3d\(0, 0, 0\) scale\(1\)/,
    "the live hand item should FLIP from the overlay's current screen position into its moved rail slot",
  );
});

test("a setup landing reveals the real hand card before retiring its flight overlay", () => {
  const finishFlight = sourceSection(
    simulatorSource,
    "function finishMobileDrawFlight(flightOrId)",
    "function clearMobileDrawFlightSequence",
  );
  const revealIndex = finishFlight.indexOf("onCardLanded?.(flightOrId)");
  const retireIndex = finishFlight.indexOf("setMobileDrawFlights");

  assert.ok(revealIndex >= 0, "flight completion should reveal its committed indexed hand card");
  assert.ok(retireIndex >= 0, "flight completion should eventually retire the overlay");
  assert.ok(
    revealIndex < retireIndex,
    "the real indexed card must be present at the landing coordinate before the overlay is removed",
  );
  assert.match(
    finishFlight,
    /handoffFrames\.first = window\.requestAnimationFrame\(\(\) => \{[\s\S]*?handoffFrames\.second = window\.requestAnimationFrame\(\(\) => \{[\s\S]*?flightElement\?\.isConnected[\s\S]*?retireFlight\(\)/,
    "the overlay should remain through two paint boundaries while the live hand card appears beneath it",
  );
  assert.match(finishFlight, /landingAnimation\.pause\(\);[\s\S]*?landingAnimation\.currentTime = 0;/);
  assert.match(
    finishFlight,
    /landingFinished = landingAnimation\.finished\.catch\(\(\) => undefined\);/,
    "cancellation must be handled as soon as the paused landing animation is created",
  );
  const hideOverlayIndex = finishFlight.indexOf('flightElement.style.visibility = "hidden"');
  const playLandingIndex = finishFlight.indexOf("landingAnimation.play()");
  const secondPaintIndex = finishFlight.indexOf("handoffFrames.second = window.requestAnimationFrame");
  const landingMeasureIndex = finishFlight.indexOf("const targetRect = targetItem?.getBoundingClientRect()");
  assert.ok(
    secondPaintIndex >= 0 && landingMeasureIndex > secondPaintIndex && hideOverlayIndex > landingMeasureIndex,
    "the moving rail must be remeasured in the final handoff frame immediately before the overlay is hidden",
  );
  assert.ok(playLandingIndex > hideOverlayIndex);
});

test("setup completion preserves its landing rail position instead of applying turn-draw focus scrolling", () => {
  const drawSequenceEffect = sourceSection(
    simulatorSource,
    "useEffect(() => {\n    if (!mobileDrawSequenceActiveRef.current) return undefined;",
    "useEffect(() => () => {\n    for (const timerId of mobileDrawFlightTimersRef.current.values())",
  );
  const completionBranch = sourceSection(
    drawSequenceEffect,
    "mobileDrawSequenceActiveRef.current = false;",
    "return undefined;",
  );
  const focusGuardIndex = completionBranch.indexOf("if (mobileDrawFocusIndexRef.current != null)");
  const completionScrollIndex = completionBranch.indexOf("scrollTo?.(");

  assert.ok(focusGuardIndex >= 0, "ordinary draws should still focus and reveal their landed card");
  assert.ok(
    completionScrollIndex < 0 || completionScrollIndex > focusGuardIndex,
    "opening-hand deals use a null focus index and must not be moved by the ordinary draw completion scroll",
  );
});

test("opening-hand cards lift from the visible player's top deck card instead of a viewport-center fallback", () => {
  const startDrawFlights = sourceSection(
    simulatorSource,
    "function startMobileDrawFlights(revealed, baseHandLength, {",
    "function confirmTurnDraw()",
  );
  const flightGeometry = sourceSection(
    simulatorSource,
    "function getMobileDrawFlightGeometry({",
    "function setMobileDrawFlightGeometry",
  );

  assert.match(
    startDrawFlights,
    /document\.querySelector\([\s\S]*?\[data-mobile-edge-zones\]\[data-zone-owner="player"\] \[data-mobile-zone="deck"\] \[data-mobile-deck-flight-origin\]/,
    "setup deal geometry should be measured from the visible player deck",
  );
  assert.match(
    mobileEdgeZonesSource,
    /className="seapals-mobile-edge-zone-art seapals-mobile-deck-back"[\s\S]*?data-mobile-deck-flight-origin/,
    "the measured origin must be the visible top-card artwork, not the whole edge-zone button",
  );
  assert.match(
    flightGeometry,
    /const startX = sourceRect\.left \+ \(sourceRect\.width - flightWidth\) \/ 2;/,
  );
  assert.match(
    flightGeometry,
    /const startY = sourceRect\.top \+ \(sourceRect\.height - flightHeight\) \/ 2;/,
    "the flight card should be centered over the visible top card before launch",
  );
  assert.match(
    startDrawFlights,
    /getMobileDrawFlightGeometry\(\{[\s\S]*?sourceRect,[\s\S]*?flightWidth,[\s\S]*?viewportHeight,[\s\S]*?\}\)/,
  );
  assert.doesNotMatch(
    flightGeometry,
    /viewport(?:Width|Height)\s*\*\s*0\.5\d*/,
    "opening cards must not fall back to the middle of the viewport",
  );
});

test("the first visible opening-hand pose is held on the player deck before the card starts moving", () => {
  const steps = keyframeSteps(simulatorSource, "seapalsDeckToHand", "seapalsDrawReduced")
    .sort((left, right) => left.percentage - right.percentage);
  const openingPose = steps.find(({ percentage }) => percentage === 0);
  assert.ok(openingPose, "the deck-to-hand animation needs an explicit opening pose");
  assert.match(
    openingPose.body,
    /opacity:\s*1(?:\.0+)?\s*;/,
    "the first animated frame must be visible while it is still sitting on top of the deck",
  );
  assert.match(openingPose.body, /var\(--seapals-draw-start-x\)/);
  assert.match(openingPose.body, /var\(--seapals-draw-start-y\)/);

  const firstVisiblePose = steps.find(({ body }) => {
    const opacity = body.match(/opacity:\s*(\d*\.?\d+)/);
    return opacity && Number(opacity[1]) > 0;
  });
  assert.ok(firstVisiblePose, "the deck-to-hand animation needs a visible pose");
  assert.ok(firstVisiblePose.percentage <= 8, "the card should become visible promptly at the deck");
  assert.match(firstVisiblePose.body, /opacity:\s*1(?:\.0+)?\s*;/);
  assert.match(firstVisiblePose.body, /var\(--seapals-draw-start-x\)/);
  assert.match(firstVisiblePose.body, /var\(--seapals-draw-start-y\)/);

  const heldPose = steps.find(({ percentage, body }) => (
    percentage > firstVisiblePose.percentage
    && percentage <= 20
    && /var\(--seapals-draw-start-x\)/.test(body)
    && /var\(--seapals-draw-start-y\)/.test(body)
  ));
  assert.ok(
    heldPose,
    "an early keyframe should hold the visible card at the measured deck origin before its arc begins",
  );
  assert.match(heldPose.body, /opacity:\s*1(?:\.0+)?\s*;/);
});

test("the deck-to-hand path has multiple curved samples before landing in the indexed hand slot", () => {
  const steps = keyframeSteps(simulatorSource, "seapalsDeckToHand", "seapalsDrawReduced");
  const flightGeometry = sourceSection(
    simulatorSource,
    "function getMobileDrawFlightGeometry({",
    "function setMobileDrawFlightGeometry",
  );
  const heldPercentages = steps
    .filter(({ body }) => (
      /var\(--seapals-draw-start-x\)/.test(body)
      && /var\(--seapals-draw-start-y\)/.test(body)
    ))
    .map(({ percentage }) => percentage);
  const holdEnd = Math.max(0, ...heldPercentages.filter((percentage) => percentage < 100));
  const arcSamples = steps.filter(({ percentage, body }) => (
    percentage > holdEnd
    && percentage < 100
    && /transform:\s*translate3d\(/.test(body)
  ));
  const distinctTransforms = new Set(
    arcSamples.map(({ body }) => body.match(/transform:\s*(translate3d\([^;]+\)[^;]*);/)?.[1]).filter(Boolean),
  );

  assert.ok(
    arcSamples.length >= 2,
    "a clear bezier-like flight needs at least two interior samples after the deck hold",
  );
  assert.ok(
    distinctTransforms.size >= 2,
    "the interior samples must describe different poses rather than repeating one midpoint",
  );
  assert.match(flightGeometry, /const controlX = \(startX \+ endX\) \/ 2;/);
  assert.match(flightGeometry, /const controlY = Math\.max\(/);
  assert.match(flightGeometry, /const pointOnArc = \(progress\) => \{/);
  assert.match(
    flightGeometry,
    /x: inverse \* inverse \* startX \+ 2 \* inverse \* progress \* controlX \+ progress \* progress \* endX/,
  );
  assert.match(
    flightGeometry,
    /y: inverse \* inverse \* startY \+ 2 \* inverse \* progress \* controlY \+ progress \* progress \* endY/,
  );
  assert.ok(
    (flightGeometry.match(/pointOnArc\(0\.\d+\)/g) ?? []).length >= 2,
    "the quadratic curve should be sampled at multiple progress points",
  );

  const landingPose = steps.find(({ percentage }) => percentage === 100);
  assert.ok(landingPose, "the flight needs an explicit landing pose");
  assert.match(landingPose.body, /opacity:\s*1(?:\.0+)?\s*;/);
  assert.match(landingPose.body, /var\(--seapals-draw-end-x\)/);
  assert.match(landingPose.body, /var\(--seapals-draw-end-y\)/);
  assert.match(landingPose.body, /scale\(var\(--seapals-draw-end-scale\)\)/);

  const flightStyles = sourceSection(
    simulatorSource,
    ".seapals-mobile-draw-flight {",
    ".seapals-mobile-draw-flight > img",
  );
  assert.match(flightStyles, /opacity:\s*0\s*;/, "delayed flights should remain hidden before their animation starts");
  assert.match(
    flightStyles,
    /animation:\s*seapalsDeckToHand\s+680ms\s+linear\s+forwards;/,
    "sampled positions should run continuously and retain their indexed landing pose",
  );
  assert.doesNotMatch(simulatorSource, /animation:\s*seapalsDeckToHand[^;]*steps\(/);
});

test("every opening-hand flight resolves its own indexed hand-slot endpoint", () => {
  const startDrawFlights = sourceSection(
    simulatorSource,
    "function startMobileDrawFlights(revealed, baseHandLength, {",
    "function confirmTurnDraw()",
  );
  const prepareFlight = sourceSection(
    simulatorSource,
    "function prepareMobileDrawFlight(flight, flightElement)",
    "function finishMobileDrawFlight",
  );

  assert.match(startDrawFlights, /cardsToHand\.map\(\(entry, index\) => \(\{/);
  assert.match(startDrawFlights, /handIndex: baseHandLength \+ index/);
  assert.match(prepareFlight, /data-mobile-hand-card-index="\$\{flight\.handIndex\}"/);
  assert.match(prepareFlight, /const endX = targetRect\.left \+ \(targetRect\.width - flight\.width\) \/ 2;/);
  assert.match(prepareFlight, /const endY = targetRect\.top \+/);
  assert.match(
    prepareFlight,
    /setMobileDrawFlightGeometry\(flightElement, getMobileDrawFlightGeometry\(\{[\s\S]*?sourceRect,[\s\S]*?endX,[\s\S]*?endY,/,
  );
  assert.match(simulatorSource, /setProperty\("--seapals-draw-end-x", `\$\{geometry\.endX\}px`\)/);
  assert.match(simulatorSource, /setProperty\("--seapals-draw-end-y", `\$\{geometry\.endY\}px`\)/);
  assert.match(
    prepareFlight,
    /endScale: Math\.min\(1\.18, Math\.max\(0\.68, targetRect\.width \/ flight\.width\)\)/,
    "the landing card should match the measured indexed-slot card width",
  );
  assert.match(simulatorSource, /setProperty\("--seapals-draw-end-scale", geometry\.endScale\)/);
  assert.match(simulatorSource, /"--seapals-draw-end-scale": flight\.endScale/);
});

test("setup cards overlap into a roughly twice-fast deal without shortening ordinary or reduced-motion draws", () => {
  const startDrawFlights = sourceSection(
    simulatorSource,
    "function startMobileDrawFlights(revealed, baseHandLength, {",
    "function confirmTurnDraw()",
  );

  const durationMatch = startDrawFlights.match(
    /const duration = reducedMotion \? (\d+) : openingHandDeal \? (\d+) : (\d+);/,
  );
  assert.ok(durationMatch, "draw durations should keep explicit reduced, opening-hand, and ordinary branches");
  const [, reducedDuration, openingDuration, ordinaryDuration] = durationMatch.map(Number);
  assert.equal(reducedDuration, 140);
  assert.equal(openingDuration, 520, "the deck launch should stay visible long enough to read");
  assert.equal(ordinaryDuration, 680, "ordinary turn draws must retain their existing travel time");

  const staggerMatch = startDrawFlights.match(
    /const stagger = reducedMotion \? openingHandDeal \? (\d+) : (\d+) : (?:openingHandDeal \? )?(\d+)(?: : (\d+))?;/,
  );
  assert.ok(staggerMatch, "draw staggering should preserve explicit reduced-motion timing");
  const reducedOpeningStagger = Number(staggerMatch[1]);
  const reducedOrdinaryStagger = Number(staggerMatch[2]);
  const openingStagger = Number(staggerMatch[3]);
  const ordinaryStagger = Number(staggerMatch[4] ?? staggerMatch[3]);
  assert.equal(reducedOpeningStagger, 80);
  assert.equal(reducedOrdinaryStagger, 20);
  assert.equal(openingStagger, 150, "opening cards should overlap instead of racing one-by-one");
  assert.equal(ordinaryStagger, 150, "ordinary turn-draw staggering must remain unchanged");

  const eightCardDealTime = Number(openingDuration) + 7 * openingStagger;
  const previousEightCardDealTime = 360 + 7 * 400;
  assert.ok(
    eightCardDealTime >= previousEightCardDealTime * 0.45
      && eightCardDealTime <= previousEightCardDealTime * 0.55,
    `the eight-card deal should remain roughly twice as fast (${eightCardDealTime}ms vs ${previousEightCardDealTime}ms)`,
  );
  const reducedDrawStyles = sourceSection(
    simulatorSource,
    ".seapals-reduced-motion .seapals-mobile-draw-flight {",
    ".seapals-reduced-motion .seapals-mobile-draw-tray",
  );
  assert.match(
    reducedDrawStyles,
    /animation-name:\s*seapalsDrawReduced !important;[\s\S]*?animation-duration:\s*140ms !important;[\s\S]*?animation-timing-function:\s*ease-out !important;[\s\S]*?animation-fill-mode:\s*both !important;[\s\S]*?animation-delay:\s*var\(--seapals-draw-delay, 0ms\) !important;[\s\S]*?animation-play-state:\s*var\(--seapals-draw-play-state, running\) !important;/,
  );
  assert.doesNotMatch(
    reducedDrawStyles,
    /animation:\s*[^;]+!important;/,
    "reduced-motion CSS must not reset the inline per-card delay or pause state",
  );
  assert.match(simulatorSource, /setProperty\("--seapals-draw-play-state", "paused"\)/);
  assert.match(simulatorSource, /setProperty\("--seapals-draw-play-state", "running"\)/);
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
