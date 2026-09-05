import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = (await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8"))
  .replaceAll("\r\n", "\n");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("RP spending is an explicit semantic event and never inferred from a net counter delta", () => {
  const setRp = sourceSection(
    simulatorSource,
    "function setRp(update, presentation = null)",
    "function getPlayerRpSpendPresentation",
  );
  const queueSpend = sourceSection(
    simulatorSource,
    "function queueRpSpendPresentation(",
    "function setRp(update, presentation = null)",
  );

  assert.match(setRp, /presentation\?\.spendAmount/);
  assert.match(setRp, /queueRpSpendPresentation\(/);
  assert.match(setRp, /setRpState\(update\)/, "the rules value should commit independently of cosmetic timing");
  assert.doesNotMatch(setRp, /current\s*-\s*(?:next|update)|previous|delta/i);
  assert.match(queueSpend, /normalizedAmount\s*<=\s*0\)\s*return false/);
  assert.match(queueSpend, /seenRpSpendTransactionIdsRef\.current\.has\(normalizedTransactionId\)/);
  assert.match(queueSpend, /scheduleRpSpendFrame\(\(\) => launchRpSpendPresentation\(transaction\), 2\)/);
});

test("spent RP travels out of the correct badge toward the exact card without blocking play", () => {
  const geometry = sourceSection(
    simulatorSource,
    "function findRpSpendCardRect(",
    "function setRp(update, presentation = null)",
  );

  assert.match(geometry, /data-rp-bank-target="\$\{transaction\.owner\}"/);
  assert.match(geometry, /element\.dataset\.cardInstanceId === cardInstanceId/);
  assert.match(geometry, /transaction\.capturedTargetRect/);
  assert.match(geometry, /if \(owner === "player"\)[\s\S]{0,220}tutorialHandCardId/);
  assert.match(geometry, /transaction\.boardOwner === "opponent" \|\| transaction\.boardOwner === "player"/);
  assert.match(geometry, /data-board-owner="\$\{boardOwner\}"/);
  assert.match(geometry, /const startX = sourceCenter\.x - tokenOffset/);
  assert.match(geometry, /const endX = targetCenter\.x - tokenOffset/);

  const layer = sourceSection(
    simulatorSource,
    "{rpSpendFlights.length ? (",
    "{boardStatFlights.length ? (",
  );
  assert.match(layer, /data-rp-spend-flight-layer/);
  assert.match(layer, /pointer-events-none/);
  assert.match(layer, /aria-hidden="true"/);
  assert.match(layer, /data-rp-spend-owner=\{flight\.owner\}/);
  assert.match(layer, /<b>RP<\/b>/);
  assert.match(layer, /<small>\{flight\.amount\}<\/small>/);
});

test("both RP indicators pulse red, show the amount spent, and announce one useful result", () => {
  assert.match(simulatorSource, /data-rp-bank-target="opponent"[^\n]*is-spending[^\n]*seapals-rp-spend-delta/);
  assert.match(simulatorSource, /data-rp-bank-target="player"[^\n]*is-spending[^\n]*seapals-rp-spend-delta/);
  assert.match(simulatorSource, /\.seapals-reef-score-card\.is-rp\.is-spending\s*\{[\s\S]{0,240}#ffe4e6/);
  assert.match(simulatorSource, /@keyframes seapalsRpBankSpend/);
  assert.match(simulatorSource, /@keyframes seapalsRpSpendDelta/);
  assert.match(simulatorSource, /\.seapals-reef-score-opponent \.seapals-rp-spend-delta\s*\{[\s\S]{0,160}bottom:/);
  assert.match(simulatorSource, /key=\{rpSpendAnnouncement\?\.id[\s\S]{0,160}role="status" aria-live="polite" aria-atomic="true"[\s\S]{0,100}rpSpendAnnouncement\?\.text/);
  assert.match(simulatorSource, /You spent[\s\S]{0,100}Opponent spent/);
});

test("bundled costs animate their gross spend even when the same resolution also gains RP", () => {
  const slotPlay = sourceSection(
    simulatorSource,
    "function placeCardToSlot(",
    "function placeCoralInEcosystem(",
  );
  const oceanicPlay = sourceSection(
    simulatorSource,
    "function completePlayerOceanicPlay(",
    "function returnFromSupportFlowToBoard(",
  );
  const spearfishing = sourceSection(
    simulatorSource,
    "function completeSpearfishing(",
    "function completeWhirlpool(",
  );
  const resourceRoll = sourceSection(
    simulatorSource,
    "function resolvePlayerEffectRoll(",
    "function stopBoardEffectRoll(",
  );

  assert.match(slotPlay, /setRp\(rpAfterOnPlayGain,\s*\{[\s\S]{0,120}spendAmount:\s*playCost/);
  assert.match(oceanicPlay, /setRp\(rpAfterOnPlayGain,\s*\{[\s\S]{0,120}spendAmount:\s*playCost/);
  assert.match(spearfishing, /addResourceWithinCap\(Math\.max\(0, current - supportCost\), recoveredRp[\s\S]{0,180}getPlayerRpSpendPresentation\(supportCard, supportCost\)/);
  assert.match(resourceRoll, /current - Number\(readyEvent\.actionCost \?\? 0\)[\s\S]{0,180}getPlayerRpSpendPresentation\([^\n]*readyEvent\.actionCost/);
});

test("opponent Supports, permanents, utilities, attacks, and Regenerate carry one gross-cost transaction", () => {
  for (const marker of [
    "opponent-support:",
    "opponent-permanent:",
    "opponent-utility:",
    "opponent-attack:",
    "opponent-regenerate:",
  ]) {
    assert.ok(simulatorSource.includes(`transactionId: \`${marker}`), `Missing spend transaction: ${marker}`);
  }
  assert.match(simulatorSource, /attackSpendAmount\s*=\s*stepIndex === 0 && !actionCostAlreadyPaid/);
  assert.match(simulatorSource, /boardOwner:\s*permanentPlacementCue\.board/);
  assert.match(simulatorSource, /rpSpendAmount\s*=\s*Math\.max\(0, Number\(opponentUtility\.actionCost \?\? 0\)\)/);
  assert.match(simulatorSource, /transactionScope:\s*`lionfish-(?:player|opponent)-turn-\$\{/);
  assert.match(simulatorSource, /opponent-regenerate:\$\{round\}:\$\{turn\}:\$\{attackerInstanceId/);
  assert.match(simulatorSource, /player-regenerate:\$\{round\}:\$\{turn\}:\$\{pending\.attackerLocation/);
  assert.match(simulatorSource, /commitEventState\(event\)[\s\S]{0,180}event\?\.rpSpend|event\?\.rpSpend[\s\S]{0,220}commitEventState/);
});

test("player utility RP spends follow the exact inspected card instance through deferred resolution", () => {
  const inspectedIdentity = sourceSection(
    simulatorSource,
    "function getInspectedPlayerCardInstanceId(cardInspection = inspectedCard)",
    "function getPendingCreatureActionRpSpendPresentation(",
  );
  const pendingSpend = sourceSection(
    simulatorSource,
    "function getPendingCreatureActionRpSpendPresentation(",
    "function beginCreatureUtilityAction(action)",
  );
  const beginUtility = sourceSection(
    simulatorSource,
    "function beginCreatureUtilityAction(action)",
    "function completeCreatureDrawAction()",
  );
  const deferredUtilityResolvers = sourceSection(
    simulatorSource,
    "function completeCreatureDrawAction()",
    "function completeSymbiosis(",
  );

  assert.match(inspectedIdentity, /return `foundation:\$\{cardInspection\.coralId\}`/);
  assert.match(inspectedIdentity, /return `hosted:\$\{cardInspection\.hostedBySlotId\}:\$\{hostedIndex\}`/);
  assert.match(inspectedIdentity, /return getLionfishSlotInstanceId\(coral, slot\)/);
  assert.match(inspectedIdentity, /playerReefCreatureInstances\[reefIndex\]\?\.instanceId/);
  assert.match(inspectedIdentity, /playerOrphanCreatures\[orphanIndex\]\?\.instanceId/);
  assert.match(pendingSpend, /cardInstanceId:\s*pendingAction\?\.sourceCardInstanceId/);
  assert.match(beginUtility, /sourceCardInstanceId\s*=\s*getInspectedPlayerCardInstanceId\(inspectedCard\)/);
  assert.match(beginUtility, /setPendingCreatureAction\(\{[\s\S]{0,360}\bsourceCardInstanceId\b/);
  assert.match(
    deferredUtilityResolvers,
    /getPendingCreatureActionRpSpendPresentation\((?:pendingCreatureAction|pendingAction),/,
    "a deferred utility payment should target the same physical card that opened the action",
  );
});

test("opponent utility RP spends retain the exact acting permanent instance", () => {
  const opponentUtility = sourceSection(
    simulatorSource,
    "function runOpponentUtilityAction(opponentState, currentPlayerState)",
    "function runOpponentUtilityActions(opponentState, currentPlayerState)",
  );
  const utilityEvents = sourceSection(
    simulatorSource,
    "function buildOpponentUtilityEvents(utilities)",
    "function runOpponentNormalAttackActions(",
  );

  assert.match(opponentUtility, /sourceCardInstanceId:\s*getLionfishSlotInstanceId\(coral, slot\)/);
  assert.match(opponentUtility, /sourceCardInstanceId:\s*opponentState\.reefCreatureInstances\?\.\[reefIndex\]\?\.instanceId/);
  assert.match(opponentUtility, /sourceCardInstanceId:\s*entry\.instanceId/);
  assert.match(opponentUtility, /sourceCardInstanceId:\s*entry\.sourceCardInstanceId/);
  assert.match(utilityEvents, /cardInstanceId:\s*opponentUtility\.sourceCardInstanceId/);
});

test("opponent permanent play RP spends target the newly placed instance, including follow-up plays", () => {
  const opponentTurn = sourceSection(
    simulatorSource,
    "function runOpponentTurn(current, { startTurnAlreadyBegun = false } = {})",
    "function applyOpponentFoundationDamage(",
  );
  const permanentEvents = sourceSection(
    simulatorSource,
    "const opponentPermanentPlays = opponentResult.permanentPlays",
    "if (opponentResult.supportBlock)",
  );

  assert.ok(
    (opponentTurn.match(/\bplayedCardInstanceId\s*:/g) ?? []).length >= 2,
    "the primary and each follow-up permanent play should record the instance they just placed",
  );
  assert.match(permanentEvents, /playedCardInstanceId:\s*opponentResult\.playedCardInstanceId/);
  assert.match(permanentEvents, /cardInstanceId:\s*play\.playedCardInstanceId/);
});

test("ordinary player attack RP spends target the exact attacker DOM instance", () => {
  const beginAttack = sourceSection(
    simulatorSource,
    "function attackWithCreature(coralId, slotId)",
    "function beginOnPlayAttack(",
  );
  const commitAttack = sourceSection(
    simulatorSource,
    "function commitPlayerAttackCost(context, attacker, attack)",
    "function completePlayerAttackStep(",
  );

  assert.match(beginAttack, /attackerInstanceId\s*=\s*attackerSlot[\s\S]{0,180}getLionfishSlotInstanceId\(/);
  assert.match(beginAttack, /playerReefCreatureInstances\[attackerReefIndex\]\?\.instanceId/);
  assert.match(beginAttack, /playerOrphanCreatures\[attackerOrphanIndex\]\?\.instanceId/);
  assert.match(
    beginAttack,
    /createPlayerAttackContext\(\{[\s\S]{0,260}\battackerInstanceId\b/,
    "the selected board instance should be persisted before target selection begins",
  );
  assert.match(commitAttack, /cardInstanceId:\s*context\.attackerInstanceId/);
});

test("opponent attack RP spend falls back to the combat-plan attacker instance", () => {
  const opponentAttackEvents = sourceSection(
    simulatorSource,
    "function buildOpponentAttackEventSequence(attackResult, initialPlayerState, initialOpponentState, { actionCostAlreadyPaid = false } = {})",
    "function preserveOpponentNormalActionsAfterOnPlay(",
  );

  assert.match(
    opponentAttackEvents,
    /step\.attackerInstanceId\s*\?\?\s*step\.combatPlan\?\.attackerInstanceId/,
  );
  assert.match(
    opponentAttackEvents,
    /cardInstanceId:\s*(?:step\.attackerInstanceId\s*\?\?\s*step\.combatPlan\?\.attackerInstanceId|attackSpendAttackerInstanceId)/,
  );
});

test("repeatable targeted coin actions get a fresh spend transaction on every real payment", () => {
  const coinEffect = sourceSection(
    simulatorSource,
    "function completeCoinCoralEffect(",
    "function completeSymbiosis(",
  );
  assert.match(coinEffect, /getPendingCreatureActionRpSpendPresentation\(pendingAction, cost\)/);
  assert.doesNotMatch(coinEffect, /transactionId:/);
  assert.match(coinEffect, /pendingAction\.costCommitted/);
});

test("spend motion cleans up and respects both reduced-motion controls", () => {
  const clearSpend = sourceSection(
    simulatorSource,
    "function clearRpSpendPresentation(",
    "function getVisibleRect(",
  );
  assert.match(clearSpend, /window\.clearTimeout/);
  assert.match(clearSpend, /window\.cancelAnimationFrame/);
  assert.match(clearSpend, /setRpSpendFlights\(\[\]\)/);
  assert.match(simulatorSource, /accessibilityReducedMotion \|\| systemReducedMotion[\s\S]{0,240}setRpSpendPulse/);
  assert.match(simulatorSource, /prefers-reduced-motion:\s*reduce[\s\S]*?\.seapals-rp-spend-flight[\s\S]{0,180}animation:\s*none !important/);
});
