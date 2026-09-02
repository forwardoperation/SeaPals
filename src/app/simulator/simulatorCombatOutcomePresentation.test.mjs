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

test("a consumed defender pauses on its result checkpoint before discard travel", () => {
  const attackResolution = sourceSection(
    simulatorSource,
    "function resolvePlayerAttack(",
    "function applyPlayerOnPlayDeckDiscard(",
  );
  assert.doesNotMatch(
    attackResolution,
    /queueConsumedAttackFlight\(/,
    "Attack resolution must not begin discard travel before the player has read the result",
  );
  assert.match(
    attackResolution,
    /beginCombatResultCheckpoint\(resultOverlay,\s*\{[\s\S]*?discardCue:/,
    "Successful removals should carry their pending discard into the result checkpoint",
  );
  assert.match(attackResolution, /continueAttackSequence:\s*sequenceResult\.continues/);
});

test("opponent removals carry a discard cue through the same post-checkpoint animation path", () => {
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
  const discardBranch = presenter.indexOf('event.type === "faceoff-result"');
  const genericReader = presenter.indexOf("shouldShowCompactOpponentCardReader(event)");
  assert.ok(discardBranch >= 0 && discardBranch < genericReader, "Opponent combat must reach the checkpoint before the generic reader");
  const combatCheckpointBranch = presenter.slice(discardBranch, genericReader);
  assert.match(combatCheckpointBranch, /beginCombatResultCheckpoint\(event,/);
  assert.match(combatCheckpointBranch, /discardCue:\s*event\.combatDiscardCue\s*\?\?\s*null/);
  assert.match(combatCheckpointBranch, /commit:\s*\(\)\s*=>\s*commitEventState\(event\)/);
  assert.doesNotMatch(combatCheckpointBranch, /queueConsumedAttackFlight\(/);
});

test("discard travel can locate a card on either reef before state mutation", () => {
  const flightPlan = sourceSection(
    simulatorSource,
    "function createConsumedAttackFlightPlan(",
    "function beginCombatResultCheckpoint(",
  );
  const queuedFlight = sourceSection(
    simulatorSource,
    "function queueConsumedAttackFlight(",
    "function getPlayerAttackTargets(",
  );
  assert.match(flightPlan, /sourceOwner\s*=\s*null/);
  assert.match(flightPlan, /\[data-board-owner="\$\{sourceOwner\}"\]/);
  assert.match(flightPlan, /sourceBoard\?\.querySelectorAll\("\[data-card-id\]"\)/);
  assert.match(flightPlan, /node\.dataset\.cardId === cardId/);
  assert.match(queuedFlight, /(?:flightPlan|sourceGeometry) \?\? createConsumedAttackFlightPlan\(/);
  assert.match(
    simulatorSource,
    /faceoffRolling \|\| consumedAttackFlight \|\| eventRequiresResolution/,
    "A terminal victory should wait until the consumed card visibly reaches its pile",
  );
});
