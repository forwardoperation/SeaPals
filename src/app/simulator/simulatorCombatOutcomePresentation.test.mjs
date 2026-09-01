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

test("a visibly discarded defender continues play without reopening the success result", () => {
  const attackResolution = sourceSection(
    simulatorSource,
    "function resolvePlayerAttack(",
    "function applyPlayerOnPlayDeckDiscard(",
  );
  const continuations = attackResolution.match(
    /onComplete:\s*\(\)\s*=>\s*continueAfterPresentedEvent\(resultOverlay, pendingEventsRef\.current\)/g,
  ) ?? [];

  assert.equal(continuations.length, 2, "Both normal defenders and invading defenders should auto-continue after their discard flight");
  assert.doesNotMatch(
    attackResolution,
    /onComplete:\s*\(\)\s*=>\s*setEventOverlay\(resultOverlay\)/,
    "The redundant success reader must not return after the discard animation",
  );
  assert.match(
    attackResolution,
    /if \(flightQueued\)[\s\S]{0,120}setEventOverlay\(null\)[\s\S]{0,120}else setEventOverlay\(resultOverlay\)/,
    "Legacy/tutorial fallback should still explain the result when no flight was shown",
  );
});

test("opponent removals carry a discard cue through the same compact animation path", () => {
  const eventBuilder = sourceSection(
    simulatorSource,
    "function buildOpponentAttackEventSequence(",
    "function preserveOpponentNormalActionsAfterOnPlay(",
  );
  assert.match(eventBuilder, /combatDiscardCue:\s*step\.discardedCardId\s*\?/);
  assert.match(eventBuilder, /cardId:\s*step\.discardedCardId/);
  assert.match(eventBuilder, /targetInstanceId:\s*step\.targetInstanceId/);
  assert.match(eventBuilder, /destinationOwner:\s*"player"/);
  assert.match(eventBuilder, /destinationZone:\s*destroyedCardGoesToLostZone/);

  const presenter = sourceSection(
    simulatorSource,
    "function presentQueuedEvent(event, remainingEvents = [],",
    "function closeEventOverlay()",
  );
  const discardBranch = presenter.indexOf('event.type === "faceoff-result"\n        && event.combatDiscardCue');
  const genericReader = presenter.indexOf("shouldShowCompactOpponentCardReader(event)");
  assert.ok(discardBranch >= 0 && discardBranch < genericReader, "A real removal must bypass the generic opponent result reader");
  assert.match(presenter, /queueConsumedAttackFlight\(\{[\s\S]{0,240}\.\.\.event\.combatDiscardCue/);
  assert.match(presenter, /onComplete:\s*\(\)\s*=>\s*continueAfterPresentedEvent\(event, pendingEventsRef\.current\)/);
  assert.match(presenter, /if \(flightQueued\) \{[\s\S]{0,180}commitEventState\(event\);[\s\S]{0,100}setEventOverlay\(null\);/);
});

test("discard travel can locate a card on either reef before state mutation", () => {
  const flight = sourceSection(
    simulatorSource,
    "function queueConsumedAttackFlight(",
    "function getPlayerAttackTargets(",
  );
  assert.match(flight, /sourceOwner\s*=\s*null/);
  assert.match(flight, /\[data-board-owner="\$\{sourceOwner\}"\]/);
  assert.match(flight, /sourceBoard\?\.querySelectorAll\("\[data-card-id\]"\)/);
  assert.match(flight, /node\.dataset\.cardId === cardId/);
  assert.match(
    simulatorSource,
    /faceoffRolling \|\| consumedAttackFlight \|\| eventRequiresResolution/,
    "A terminal victory should wait until the consumed card visibly reaches its pile",
  );
});
