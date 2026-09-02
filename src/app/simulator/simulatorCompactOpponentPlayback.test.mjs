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

test("the compact round-condition banner waits for an explicit Continue", () => {
  const stageEffect = sourceSection(
    simulatorSource,
    "if (stage.kind === CompactTurnStage.TURN)",
    "let cancelled = false;",
  );
  const compactBanner = sourceSection(
    simulatorSource,
    "{compactTurnSequence && [CompactTurnStage.TURN, CompactTurnStage.CONDITION]",
    "{compactRpFlights.length ? (",
  );

  const conditionBranch = stageEffect.slice(stageEffect.indexOf("if (stage.kind === CompactTurnStage.CONDITION)"));
  assert.doesNotMatch(
    conditionBranch,
    /scheduleCompactTurnTimer\(/,
    "Reading time must be controlled by the player, not a timeout.",
  );
  assert.match(compactBanner, /data-compact-condition-continue/);
  assert.match(compactBanner, /type="button"/);
  assert.match(compactBanner, />Continue<\/button>/);
  assert.match(
    compactBanner,
    /onClick=\{[^}]*?(?:continueCompactCondition|advanceCompactTurnSequence)/,
  );
  const conditionMarkup = compactBanner.slice(
    compactBanner.indexOf('className="seapals-compact-turn-banner is-condition'),
    compactBanner.indexOf("{compactOpponentCardReader ? ("),
  );
  assert.doesNotMatch(
    conditionMarkup,
    /aria-hidden="true"/,
    "An interactive condition banner cannot be hidden from assistive technology.",
  );
});

test("V2 permanent plays commit immediately and animate from top-center to their reef destination", () => {
  const presenter = sourceSection(
    simulatorSource,
    "function presentQueuedEvent(event, remainingEvents = [],",
    "function closeEventOverlay()",
  );

  assert.match(
    presenter,
    /compactTurnPresentationEnabled[\s\S]*?event\.type === "opponent-play"[\s\S]*?event\.permanentPlacementCue/,
  );
  const compactPlayBranch = presenter.slice(presenter.indexOf('event.type === "opponent-play"'));
  assert.ok(
    compactPlayBranch.indexOf("commitEventState(event)") < compactPlayBranch.indexOf("beginOpponentPlacementAnimation"),
    "The destination must exist on the board before it is measured and animated.",
  );
  assert.match(compactPlayBranch, /setEventOverlay\(null\)/);
  assert.match(
    compactPlayBranch,
    /beginOpponentPlacementAnimation\([\s\S]*?continueAfterPresentedEvent\(event, pendingEventsRef\.current\)/,
  );
  assert.match(simulatorSource, /data-opponent-placement-flight/);
  assert.match(simulatorSource, /window\.innerWidth\s*\/\s*2/);
  assert.match(simulatorSource, /permanentPlacementCue/);
  assert.match(simulatorSource, /@keyframes seapalsOpponentPlacement/);

  const placementLayer = sourceSection(
    simulatorSource,
    "data-opponent-placement-flight",
    "data-compact-rp-flight-layer",
  );
  assert.doesNotMatch(placementLayer, /aria-modal="true"|role="dialog"|backdrop-blur/);
});

test("opponent Support and important read events use a compact flip reader with Continue", () => {
  const presenter = sourceSection(
    simulatorSource,
    "function presentQueuedEvent(event, remainingEvents = [],",
    "function closeEventOverlay()",
  );
  assert.match(
    presenter,
    /compactTurnPresentationEnabled[\s\S]*?(?:requiresCardReader|shouldShowCompactOpponentCardReader)/,
  );
  assert.match(presenter, /setEventOverlay\(null\)/);
  assert.match(
    presenter,
    /(?:beginCompactOpponentCardReader|setCompactOpponentCardReader)[\s\S]*?continueAfterPresentedEvent\(event, pendingEventsRef\.current\)/,
  );

  const reader = sourceSection(
    simulatorSource,
    "data-opponent-card-reader",
    "{combatResultCheckpoint ? (",
  );
  assert.match(reader, /cardsById\[[^\]]+sourceCardId[^\]]*\]/);
  assert.match(reader, /type="button"/);
  assert.match(reader, />Continue<\/button>/);
  assert.match(reader, /role="dialog"/);
  assert.match(reader, /aria-labelledby=/);
  assert.doesNotMatch(reader, /aria-modal="true"|fixed inset-0|backdrop-blur/);
  assert.match(simulatorSource, /@keyframes seapalsOpponentCardFlip/);
});

test("opponent search readers show a left-to-right source, arrow, and revealed result", () => {
  const reader = sourceSection(
    simulatorSource,
    "data-opponent-card-reader",
    "{combatResultCheckpoint ? (",
  );
  const readerStyles = sourceSection(
    simulatorSource,
    ".seapals-opponent-card-reader {",
    ".seapals-compact-rp-flight-layer",
  );
  const flowStyles = sourceSection(
    readerStyles,
    ".seapals-opponent-card-reader-flow {",
    "}",
  );

  const flowIndex = reader.indexOf("data-opponent-reader-flow");
  const sourceIndex = reader.indexOf("data-opponent-reader-source");
  const arrowIndex = reader.indexOf("data-opponent-reader-arrow");
  const resultIndex = reader.indexOf("data-opponent-reader-result");

  assert.ok(flowIndex >= 0, "The reader needs one compact source-to-result row.");
  assert.ok(
    flowIndex < sourceIndex && sourceIndex < arrowIndex && arrowIndex < resultIndex,
    "The support card must render left of the arrow, with the revealed card on the right.",
  );
  assert.match(
    reader.slice(sourceIndex, arrowIndex),
    /sourceCardId/,
    "The left card must be the Support that caused the search.",
  );
  const arrowMarkup = reader.slice(arrowIndex, resultIndex);
  assert.match(arrowMarkup, /aria-hidden="true"/);
  assert.match(
    arrowMarkup,
    /(?:\u2192|&rarr;|&#8594;|&#x2192;|ArrowRight|data-direction="right")/,
    "The relationship needs a visible, decorative right-pointing arrow.",
  );
  assert.match(
    reader.slice(resultIndex),
    /revealedCards/,
    "The right card must come from the opponent event's revealed search result.",
  );
  const usesThreeColumnGrid = /display:\s*grid;/.test(flowStyles)
    && /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\);/.test(flowStyles);
  const usesHorizontalFlex = /display:\s*flex;/.test(flowStyles)
    && !/flex-direction:\s*column;/.test(flowStyles);
  assert.ok(
    usesThreeColumnGrid || usesHorizontalFlex,
    "The source and result should share one bounded horizontal row.",
  );
});

test("revealed opponent search readers keep concise copy and Continue visible without internal scrolling", () => {
  const reader = sourceSection(
    simulatorSource,
    "data-opponent-card-reader",
    "{combatResultCheckpoint ? (",
  );
  const readerStyles = sourceSection(
    simulatorSource,
    ".seapals-opponent-card-reader {",
    ".seapals-compact-rp-flight-layer",
  );
  const flowIndex = reader.indexOf("data-opponent-reader-flow");
  const summaryIndex = reader.indexOf("data-opponent-reader-summary");
  const continueIndex = reader.indexOf("seapals-opponent-card-reader-continue");
  const revealBranchStart = reader.indexOf("{compactOpponentReaderHasReveal ? (");
  const singleBranchStart = reader.indexOf(") : (", revealBranchStart);
  const revealBranch = revealBranchStart >= 0 && singleBranchStart > revealBranchStart
    ? reader.slice(revealBranchStart, singleBranchStart)
    : "";
  const continueStart = reader.lastIndexOf("<button", continueIndex);
  const continueEnd = reader.indexOf("</button>", continueIndex);
  const continueButton = continueStart >= 0 && continueEnd > continueStart
    ? reader.slice(continueStart, continueEnd + "</button>".length)
    : "";
  const summaryStyles = sourceSection(
    readerStyles,
    ".seapals-opponent-card-reader-summary {",
    "}",
  );
  const revealedSummaryStyles = sourceSection(
    readerStyles,
    ".seapals-opponent-card-reader.has-reveal .seapals-opponent-card-reader-summary {",
    "}",
  );
  const copyStyles = sourceSection(
    readerStyles,
    ".seapals-opponent-card-reader-copy {",
    "}",
  );
  const continueStyles = sourceSection(
    readerStyles,
    ".seapals-opponent-card-reader-continue {",
    "}",
  );

  assert.ok(
    flowIndex >= 0 && flowIndex < summaryIndex && summaryIndex < continueIndex,
    "A short description belongs below the two cards, with Continue last in normal flow.",
  );
  assert.match(
    simulatorSource,
    /seapals-opponent-card-reader\$\{compactOpponentReaderHasReveal\s*\?\s*" has-reveal"\s*:\s*" is-single"\}/,
  );
  assert.match(revealBranch, /data-opponent-reader-flow/);
  assert.match(revealBranch, /data-opponent-reader-summary/);
  assert.doesNotMatch(
    revealBranch,
    /seapals-opponent-card-reader-scroll|overflow(?:-[xy])?-(?:auto|scroll)/,
    "The revealed search branch must not render an internal scroller.",
  );
  assert.doesNotMatch(
    copyStyles,
    /overflow(?:-[xy])?:\s*(?:auto|scroll);/,
    "The shared copy region must not make revealed search results scroll.",
  );
  assert.doesNotMatch(
    readerStyles,
    /\.seapals-opponent-card-reader\.has-reveal[^{}]*\{[^}]*overflow(?:-[xy])?:\s*(?:auto|scroll);/,
    "The has-reveal branch must keep both cards, its summary, and Continue in one fixed view.",
  );
  assert.doesNotMatch(
    summaryStyles,
    /(?:-webkit-)?line-clamp:\s*[0-9]+;/,
    "The shared summary style must not truncate the full-detail fallback.",
  );
  assert.match(
    revealedSummaryStyles,
    /(?:-webkit-)?line-clamp:\s*[23];/,
    "A revealed search description should be clamped to a compact two or three lines.",
  );
  assert.match(continueButton, /type="button"/);
  assert.match(continueButton, /onClick=\{continueCompactOpponentCardReader\}/);
  assert.match(continueButton, />Continue<\/button>/);
  assert.match(
    continueStyles,
    /(?:flex:\s*0\s+0\s+auto|flex-shrink:\s*0);/,
    "Continue must reserve its own non-shrinking space at the bottom of the reader.",
  );
});

test("single-card opponent readers preserve full detail in a scrollable fallback above fixed Continue", () => {
  const reader = sourceSection(
    simulatorSource,
    "data-opponent-card-reader",
    "{combatResultCheckpoint ? (",
  );
  const readerStyles = sourceSection(
    simulatorSource,
    ".seapals-opponent-card-reader {",
    ".seapals-compact-rp-flight-layer",
  );
  const fallbackStart = reader.indexOf(") : (", reader.indexOf("{compactOpponentReaderHasReveal ? ("));
  const continueIndex = reader.indexOf("seapals-opponent-card-reader-continue", fallbackStart);
  const continueStart = reader.lastIndexOf("<button", continueIndex);
  const singleBranch = fallbackStart >= 0 && continueStart > fallbackStart
    ? reader.slice(fallbackStart, continueStart)
    : "";
  const singleCopyStyles = sourceSection(
    readerStyles,
    ".seapals-opponent-card-reader.is-single .seapals-opponent-card-reader-copy {",
    "}",
  );
  const scrollStyles = sourceSection(
    readerStyles,
    ".seapals-opponent-card-reader-scroll {",
    "}",
  );
  const continueStyles = sourceSection(
    readerStyles,
    ".seapals-opponent-card-reader-continue {",
    "}",
  );

  assert.match(singleBranch, /seapals-opponent-card-reader-scroll/);
  assert.match(singleBranch, /compactOpponentCardReader\.event\.title/);
  assert.match(singleBranch, /compactOpponentCardReader\.event\.message/);
  assert.doesNotMatch(
    singleBranch,
    /data-opponent-reader-summary|seapals-opponent-card-reader-summary/,
    "The scrollable fallback must retain the event's full descriptive text.",
  );
  assert.match(singleCopyStyles, /flex:\s*1\s+1\s+auto;/);
  assert.match(singleCopyStyles, /overflow:\s*hidden;/);
  assert.match(scrollStyles, /overflow-y:\s*auto;/);
  assert.match(scrollStyles, /overscroll-behavior:\s*contain;/);
  assert.match(
    reader,
    /\)\}\s*<button[^>]*className="seapals-opponent-card-reader-continue"/,
    "Continue must remain outside the is-single copy scroller.",
  );
  assert.match(
    continueStyles,
    /(?:flex:\s*0\s+0\s+auto|flex-shrink:\s*0);/,
    "Continue must stay fixed while full single-card details scroll above it.",
  );
});

test("compact opponent playback preserves queue order and terminal continuations", () => {
  const presenter = sourceSection(
    simulatorSource,
    "function presentQueuedEvent(event, remainingEvents = [],",
    "function closeEventOverlay()",
  );
  const continuation = sourceSection(
    simulatorSource,
    "function continueAfterPresentedEvent(event, remainingEvents = [])",
    "function presentQueuedEvent(event, remainingEvents = [],",
  );

  assert.match(presenter, /pendingEventsRef\.current/);
  assert.match(continuation, /if \(event\?\.beginOpponentAfterClose\)/);
  assert.match(continuation, /if \(event\?\.advanceRoundAfterClose\)/);
  assert.match(continuation, /if \(event\?\.startOpeningPlayerTurnAfterClose\)/);
  assert.match(
    continuation,
    /presentQueuedEvent\(nextEvent \?\? null, remaining, \{ delayForOpponent: Boolean\(nextEvent\?\.opponentSequence\) \}\)/,
  );
});

test("compact playback synchronizes queued events and targets a newly rendered duplicate", () => {
  const queue = sourceSection(
    simulatorSource,
    "function queueEvents(eventsToAdd)",
    "function commitEventState(event)",
  );
  const geometry = sourceSection(
    simulatorSource,
    "function getOpponentCardFlightGeometry(event, cueOverride = null)",
    "function startOpponentCardFlight",
  );

  assert.match(queue, /pendingEventsRef\.current = nextEvents/);
  assert.match(simulatorSource, /previouslyRenderedPlacementNodes/);
  assert.match(geometry, /newlyRenderedCards\.length \? newlyRenderedCards : matchingCards/);
});

test("a required opponent reader keeps the reef visible while guarding the Continue checkpoint", () => {
  const reader = sourceSection(
    simulatorSource,
    "{compactOpponentPlaybackLocked ?",
    "{opponentPlacementFlight ? (",
  );
  const mergePlan = sourceSection(
    simulatorSource,
    "function getCompactOpponentReaderPlan(event, remainingEvents = [])",
    "function launchCompactRpFlights",
  );

  assert.match(reader, /data-compact-opponent-guard/);
  assert.match(reader, /aria-modal="false"/);
  assert.doesNotMatch(reader, /bg-black|backdrop-blur|opacity-/);
  assert.match(mergePlan, /continueAttackSequence: latestEventValue/);
  assert.match(mergePlan, /advanceRoundAfterClose: latestEventValue/);
});

test("reduced motion skips opponent travel and flip motion without skipping reading checkpoints", () => {
  assert.match(
    simulatorSource,
    /function beginOpponentPlacementAnimation\([\s\S]*?(?:accessibilityReducedMotion|prefers-reduced-motion: reduce)[\s\S]*?continueAfterPresentedEvent/,
  );
  assert.match(
    simulatorSource,
    /function (?:beginCompactOpponentCardReader|showCompactOpponentCardReader)\([\s\S]*?(?:accessibilityReducedMotion|prefers-reduced-motion: reduce)/,
  );
  assert.match(
    simulatorSource,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.seapals-opponent-placement-flight[\s\S]*?animation[^;]*none[\s\S]*?\.seapals-opponent-card-reader/,
  );

  const compactBanner = sourceSection(
    simulatorSource,
    "{compactTurnSequence && [CompactTurnStage.TURN, CompactTurnStage.CONDITION]",
    "{compactRpFlights.length ? (",
  );
  assert.match(compactBanner, /data-compact-condition-continue/);
});
