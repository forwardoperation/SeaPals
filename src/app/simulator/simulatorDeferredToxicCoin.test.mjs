import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = simulatorSource.indexOf(startMarker);
  const end = simulatorSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return simulatorSource.slice(start, end);
}

test("live opponent attacks defer unprotected Toxic instead of sampling during combat", () => {
  const liveAttack = sourceBetween(
    "function createLiveOpponentAttackStepEvents",
    "function createLiveOpponentNormalActionEvents",
  );
  assert.match(liveAttack, /maxAttackSteps:\s*1,[\s\S]*?deferToxicResolution:\s*true/);

  const attackStep = sourceBetween("function runOpponentAttackStep", "function runOpponentAttack(");
  assert.match(
    attackStep,
    /shouldDeferToxicCoin\s*=\s*deferToxicResolution[\s\S]*?isToxicWhenConsumed\(targetEntry\.card\)[\s\S]*?!hasExplicitToxicImmunity\(attackerEntry\.card, targetEntry\.card\)[\s\S]*?!opponentState\.poisonImmunityNextPredatorAttack/,
  );
  assert.match(attackStep, /attackerDiscardedAfterConsume\s*=\s*shouldDeferToxicCoin\s*\?\s*false/);
  assert.match(attackStep, /deferredToxic\s*=\s*shouldDeferToxicCoin\s*\?/);
  assert.match(attackStep, /attackerInstanceId:\s*attackerEntry\.instanceId/);

  const attackRunner = sourceBetween("function runOpponentAttack(", "function buildOpponentAttackEventSequence");
  assert.match(
    attackRunner,
    /deferToxicResolution:\s*Boolean\(controllerState\.deferToxicResolution\)/,
    "the live-only flag must reach each concrete attack step",
  );
});

test("the attack result is followed by a distinct Toxic coin sentinel", () => {
  const liveAttack = sourceBetween(
    "function createLiveOpponentAttackStepEvents",
    "function createLiveOpponentNormalActionEvents",
  );
  assert.match(liveAttack, /if \(resolvedStep\.deferredToxic\)/);
  assert.match(liveAttack, /type:\s*"opponent-toxic-coin"/);
  assert.match(liveAttack, /return \[combatResultEvent, toxicCoinEvent\]\.filter\(Boolean\)/);
  assert.match(liveAttack, /resolveToxic:\s*\(coinResult\)\s*=>/);
  assert.match(liveAttack, /coinResult === "tails"/);
  assert.match(liveAttack, /\.\.\.postCombatEvents,[\s\S]*?\.\.\.continueAfterResolvedStep/);
});

test("the AI Toxic coin appears in the opponent ecosystem and rolls live", () => {
  const presenter = sourceBetween(
    "function beginDeferredOpponentToxicCoinPresentation",
    "function presentQueuedEvent",
  );
  assert.match(presenter, /owner:\s*"opponent"/);
  assert.match(presenter, /automatic:\s*true/);
  assert.match(presenter, /autoStartDelay:\s*180/);
  assert.match(presenter, /successResult:\s*"tails"/);
  assert.match(presenter, /type:\s*"resolve-opponent-toxic"/);
  assert.doesNotMatch(presenter, /forcedResult|Math\.random/);

  const queuePresenter = sourceBetween("function presentQueuedEvent", "function closeEventOverlay");
  assert.match(queuePresenter, /event\.type === "opponent-toxic-coin"[\s\S]*?beginDeferredOpponentToxicCoinPresentation\(event\)/);
  assert.match(queuePresenter, /\|\| event\.type === "opponent-toxic-coin"/);
});

test("the attacker stays put until the coin result is consumed, then animates to discard on tails", () => {
  const continuation = sourceBetween("function continueCardCoinFlip", "function cancelOpeningCoinFlip");
  assert.match(continuation, /continuation\?\.type === "resolve-opponent-toxic"/);
  assert.match(continuation, /continuation\.event\.resolveToxic\(outcome\.result\)/);
  assert.match(continuation, /pendingEventsRef\.current = queuedEvents;[\s\S]*?setPendingEvents\(queuedEvents\)/);

  const geometryIndex = continuation.indexOf("sourceGeometry: createConsumedAttackFlightPlan(discardCue)");
  const commitIndex = continuation.indexOf("commitEventState(toxicResolution.stateEvent)");
  assert.ok(geometryIndex >= 0 && geometryIndex < commitIndex, "discard geometry must be captured before state removes the attacker");
  assert.match(continuation, /onComplete:\s*finishToxicResolution/);
  assert.match(continuation, /if \(!discardFlightQueued\) finishToxicResolution\(\)/);
});

test("Toxic discard removes the exact slotted, open-water, or orphan attacker instance", () => {
  const discard = sourceBetween(
    "function discardOpponentAttackerAfterToxic",
    "function getLionfishOrphanInstanceId",
  );
  assert.match(discard, /attackerLocation\.coralId && attackerLocation\.slotId/);
  assert.match(discard, /getLionfishSlotInstanceId\(coral, slot\) === toxicResolution\.attackerInstanceId/);
  assert.match(discard, /slot\.id !== attackerLocation\.slotId[\s\S]*?slot\.cardId !== toxicResolution\.attackerCardId[\s\S]*?!instanceMatches/);
  assert.match(discard, /removeCreatureInstances\([\s\S]*?attackerLocation\.reefInstanceId/);
  assert.match(discard, /entry\.instanceId === attackerLocation\.orphanInstanceId/);
  assert.match(discard, /discardPile:\s*\[toxicResolution\.attackerCardId, \.\.\.nextOpponent\.discardPile\]/);
});

test("board and hand interactions stay locked through each discard flight", () => {
  assert.match(
    simulatorSource,
    /const boardInteractionOverlayActive\s*=\s*[^;]*Boolean\(consumedAttackFlight\)[^;]*;/,
  );
});
