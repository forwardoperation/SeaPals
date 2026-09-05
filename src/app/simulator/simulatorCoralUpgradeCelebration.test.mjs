import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = (await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8"))
  .replaceAll("\r\n", "\n");
const celebrationSource = (await readFile(new URL("./CoralUpgradeCelebration.jsx", import.meta.url), "utf8"))
  .replaceAll("\r\n", "\n");
const celebrationCss = (await readFile(new URL("./CoralUpgradeCelebration.module.css", import.meta.url), "utf8"))
  .replaceAll("\r\n", "\n");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("a legal player Coral upgrade celebrates once on the stable upgraded foundation", () => {
  const upgrade = sourceSection(
    simulatorSource,
    "function upgradeCoral(coralId, cardId = playingCardId)",
    "function cancelCardPlay()",
  );
  const basePlacement = sourceSection(
    simulatorSource,
    "function placeCoralInEcosystem(",
    "function upgradeCoral(",
  );

  assert.equal((upgrade.match(/queueCoralUpgradeCelebration\(/g) ?? []).length, 1);
  assert.match(upgrade, /setPlayerCorals\(redistributed\.corals\)[\s\S]{0,180}queueCoralUpgradeCelebration\(/);
  assert.match(upgrade, /owner:\s*"player"/);
  assert.match(upgrade, /cardInstanceId:\s*`foundation:\$\{coralId\}`/);
  assert.match(upgrade, /fromCardId:\s*currentCard\.id/);
  assert.match(upgrade, /toCardId:\s*nextCard\.id/);
  assert.doesNotMatch(basePlacement, /queueCoralUpgradeCelebration\(/, "playing a Base Coral must not fire the upgrade celebration");
});

test("primary and Hard follow-up opponent upgrades retain exact per-play metadata", () => {
  const opponentTurn = sourceSection(
    simulatorSource,
    "function runOpponentTurn(current, { startTurnAlreadyBegun = false } = {})",
    "function applyOpponentFoundationDamage(",
  );

  assert.match(opponentTurn, /let playedCoralUpgrade = null/);
  assert.match(opponentTurn, /playedCoralUpgrade = \{[\s\S]{0,260}cardInstanceId:\s*playedPermanentInstanceId[\s\S]{0,180}fromCardId:\s*upgradeTarget\.cardId[\s\S]{0,100}toCardId:\s*card\.id/);
  assert.match(opponentTurn, /coralUpgrade:\s*playedCoralUpgrade/);
  assert.match(opponentTurn, /let followUpCoralUpgrade = null/);
  assert.match(opponentTurn, /followUpCoralUpgrade = \{[\s\S]{0,280}cardInstanceId:\s*followUpPlayedInstanceId[\s\S]{0,180}fromCardId:\s*upgradeTarget\.cardId[\s\S]{0,100}toCardId:\s*candidate\.id/);
  assert.match(opponentTurn, /coralUpgrade:\s*followUpCoralUpgrade/);
});

test("opponent celebration waits for the upgraded card flight to land", () => {
  const placement = sourceSection(
    simulatorSource,
    "function beginOpponentPlacementAnimation(",
    "function showCompactOpponentCardReader(",
  );
  const eventCreation = sourceSection(
    simulatorSource,
    "const opponentPermanentPlays = opponentResult.permanentPlays",
    "if (opponentResult.supportBlock)",
  );
  const queuedPresentation = sourceSection(
    simulatorSource,
    "function presentQueuedEvent(event, remainingEvents = [], { delayForOpponent = false } = {})",
    "function closeEventOverlay(",
  );

  assert.match(eventCreation, /playedCardInstanceId:\s*play\.playedCardInstanceId/);
  assert.match(eventCreation, /coralUpgrade:\s*play\.coralUpgrade \?/);
  assert.match(eventCreation, /transactionId:\s*`opponent-coral-upgrade:/);
  assert.match(queuedPresentation, /commitEventState\(event\)[\s\S]{0,220}beginOpponentPlacementAnimation\(/);
  assert.match(placement, /const finishPlacement = \(\) => \{[\s\S]{0,260}queueCoralUpgradeCelebration\(event\.coralUpgrade\)/);
  assert.match(placement, /onLanded:\s*finishPlacement/);
  assert.match(placement, /850\s*:\s*1950/, "the next opponent play should wait until the celebration is complete");
});

test("the golden effect is card-local, bright, non-blocking, and owner scoped", () => {
  assert.match(celebrationSource, /data-coral-upgrade-celebration/);
  assert.match(celebrationSource, /data-coral-upgrade-owner=\{celebration\.owner\}/);
  assert.match(celebrationSource, /data-coral-upgrade-instance=\{celebration\.cardInstanceId\}/);
  assert.match(celebrationSource, /aria-hidden="true"/);
  assert.match(celebrationSource, /styles\.flash/);
  assert.match(celebrationSource, /styles\.rays/);
  assert.ok((celebrationSource.match(/styles\.ring/g) ?? []).length >= 2);
  assert.match(celebrationSource, /GOLD_SPARKS\.map/);
  assert.match(celebrationSource, /Upgraded!/);

  assert.match(celebrationCss, /\.celebration\s*\{[\s\S]{0,260}pointer-events:\s*none/);
  assert.match(celebrationCss, /repeating-conic-gradient/);
  assert.match(celebrationCss, /#fde047|#facc15/i);
  assert.match(celebrationCss, /drop-shadow\(/);
  assert.match(celebrationCss, /@keyframes ringExpand/);
  assert.match(celebrationCss, /@keyframes sparkLaunch/);
});

test("celebrations follow exact player and opponent foundation instances and announce accessibly", () => {
  assert.ok(
    (simulatorSource.match(/entry\.cardInstanceId === `foundation:\$\{coral\.id\}`/g) ?? []).length >= 2,
    "both physical boards should match celebration state by stable foundation instance",
  );
  assert.ok(
    (simulatorSource.match(/<CoralUpgradeCelebration/g) ?? []).length >= 2,
    "both boards should mount the same celebration component",
  );
  assert.match(simulatorSource, /zoom=\{opponentEcosystemZoom\}/);
  assert.match(simulatorSource, /zoom=\{ecosystemZoom\}/);
  assert.match(celebrationSource, /--coral-upgrade-label-scale/);
  assert.match(simulatorSource, /key=\{coralUpgradeAnnouncement\.id\}[\s\S]{0,150}role="status"[\s\S]{0,80}aria-live="polite"/);
  assert.match(simulatorSource, /upgraded to/);
});

test("upgrade presentation deduplicates events, supports reduced motion, and cleans up", () => {
  const controller = sourceSection(
    simulatorSource,
    "function clearCoralUpgradeCelebrations(",
    "function flashPlayerEcosystemPerimeter(",
  );
  assert.match(controller, /seenCoralUpgradeTransactionIdsRef\.current\.has\(normalizedTransactionId\)/);
  assert.match(controller, /seenCoralUpgradeTransactionIdsRef\.current\.add\(normalizedTransactionId\)/);
  assert.match(controller, /accessibilityReducedMotion \|\| systemReducedMotion \? 850 : 1950/);
  assert.match(controller, /coralUpgradeCelebrationTimersRef\.current\.add\(timer\)/);
  assert.match(controller, /current\.filter\(\(entry\) => entry\.id !== id\)/);
  assert.ok(
    (simulatorSource.match(/clearCoralUpgradeCelebrations\(\{ clearSeen: true \}\)/g) ?? []).length >= 2,
    "resume and restart should clear timers and transaction history",
  );
  assert.match(simulatorSource, /clearCoralUpgradeCelebrations\(\{ updateState: false \}\)/);
  assert.match(celebrationCss, /\.reduced[\s\S]{0,900}animation:\s*none/);
  assert.match(celebrationCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(celebrationCss, /\.reduced \.sparkField \{ display: none; \}/);
});
