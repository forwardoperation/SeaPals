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
    "data-opponent-placement-flight",
  );
  assert.match(reader, /cardsById\[[^\]]+sourceCardId[^\]]*\]/);
  assert.match(reader, /type="button"/);
  assert.match(reader, />Continue<\/button>/);
  assert.match(reader, /role="dialog"/);
  assert.match(reader, /aria-labelledby=/);
  assert.doesNotMatch(reader, /aria-modal="true"|fixed inset-0|backdrop-blur/);
  assert.match(simulatorSource, /@keyframes seapalsOpponentCardFlip/);
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
