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

test("V2 removes the quit and overflow chrome while a submenu is covering the board", () => {
  const chromeState = simulatorSource.match(
    /const\s+([A-Za-z_$][\w$]*(?:TopChrome|ChromeHidden|Submenu)[\w$]*)\s*=\s*Boolean\(\s*previewExperience\s*&&\s*\(([\s\S]*?)\)\s*\);/,
  );
  assert.ok(chromeState, "V2 should name one board-chrome visibility guard for submenu states");
  const [, chromeStateName, guardedStates] = chromeState;

  assert.match(guardedStates, /fullPageModalOpen/);
  assert.match(guardedStates, /mobileHudPanel/);
  assert.match(guardedStates, /inspectedCardData/);
  assert.match(guardedStates, /handPopoverCardId/);
  assert.match(guardedStates, /eventOverlay\?\.type\s*===\s*"new-game-setup"/);
  assert.match(guardedStates, /simulatorExitConfirmationOpen/);
  assert.match(guardedStates, /tutorialExitConfirmationOpen/);

  const escapedStateName = chromeStateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    simulatorSource,
    new RegExp(`\\{!${escapedStateName} \\? \\(\\s*<div className="seapals-simulator-header`),
    "The shared guard should unmount the whole V2 top chrome so neither quit path remains focusable",
  );
});

test("opponent RP collection bypasses the generic opponent thinking delay", () => {
  const presenter = sourceSection(
    simulatorSource,
    "function presentQueuedEvent(event, remainingEvents = [],",
    "function closeEventOverlay()",
  );
  const delayedGateIndex = presenter.search(/if\s*\(\s*!delayForOpponent/);
  assert.ok(delayedGateIndex >= 0, "The queued-event presenter should retain an explicit immediate-presentation gate");
  const delayedTail = presenter.slice(delayedGateIndex);

  assert.match(
    delayedTail,
    /if\s*\([\s\S]*?!delayForOpponent[\s\S]*?\|\|\s*\(\s*compactTurnPresentationEnabled\s*&&\s*event\.type\s*===\s*"opponent-status"\s*\)[\s\S]*?\)\s*\{\s*present\(\);\s*return;/,
    "The start-of-turn collection event should present immediately instead of showing a thinking beat",
  );
  assert.ok(
    delayedTail.indexOf('event.type === "opponent-status"') < delayedTail.indexOf("setOpponentThinking(true)"),
    "The RP fast path must run before the generic thinking state and timer",
  );
  assert.match(delayedTail, /setOpponentThinking\(true\)[\s\S]*?setTimeout\(/, "Other opponent decisions should retain their pacing");
});

test("compact V2 begins the opponent turn immediately while legacy keeps its thinking timer", () => {
  const continuation = sourceSection(
    simulatorSource,
    "function continueAfterPresentedEvent(event, remainingEvents = [])",
    "function presentQueuedEvent(event, remainingEvents = [],",
  );
  const opponentBranch = sourceSection(
    continuation,
    "if (event?.beginOpponentAfterClose)",
    "if (event?.advanceRoundAfterClose)",
  );

  assert.match(
    opponentBranch,
    /if\s*\(compactTurnPresentationEnabled\)\s*\{[\s\S]*?setOpponentThinking\(false\);[\s\S]*?resolveOpponentTurnRef\.current\?\.\(\);[\s\S]*?return;[\s\S]*?\}/,
    "After the compact turn banner, V2 should move straight into start-of-turn collection",
  );
  assert.ok(
    opponentBranch.indexOf("resolveOpponentTurnRef.current?.()") < opponentBranch.indexOf("setOpponentThinking(true)"),
    "The compact fast path must resolve before the fallback thinking state",
  );
  assert.match(
    opponentBranch,
    /setOpponentThinking\(true\);[\s\S]*?opponentThinkingTimerRef\.current\s*=\s*setTimeout\([\s\S]*?resolveOpponentTurnRef\.current\?\.\(\)[\s\S]*?scaleOpponentThinkingDelay\(/,
    "Legacy presentation should retain its paced thinking fallback",
  );
});

test("V2 attack targeting tints the board red and drops crosshairs only on legal targets", () => {
  assert.match(
    simulatorSource,
    /data-v2-attack-mode=\{previewExperience\s*&&\s*attackContext\s*&&\s*!boardFaceoffActive\s*\?\s*"true"\s*:\s*undefined\}/,
    "The red targeting treatment must be scoped to V2 and to an active attack context",
  );

  const legalTargetMarkers = simulatorSource.match(
    /data-attack-target=\{(?:previewExperience\s*&&\s*)?(?:isTarget|isFoundationTarget|hostedIsTarget|isInvaderTarget)\s*\?\s*"true"\s*:\s*undefined\}/g,
  ) ?? [];
  assert.ok(
    legalTargetMarkers.length >= 5,
    `Expected legal-target markers across every opponent creature location; found ${legalTargetMarkers.length}`,
  );
  assert.doesNotMatch(
    simulatorSource,
    /<button[^>]*data-attack-target="true"/,
    "Crosshair eligibility cannot be hard-coded onto cards that are not in attackContext.targets",
  );
  assert.match(
    simulatorSource,
    /\[data-v2-attack-mode="true"\][\s\S]*?(?:background|box-shadow|filter):[^;]*(?:rose|red|rgba\(2(?:20|39)|#(?:ef4444|f43f5e))/i,
    "Attack mode should visibly wash the board with a red treatment",
  );
  assert.match(
    simulatorSource,
    /\[data-v2-attack-mode="true"\][\s\S]*?\[data-attack-target="true"\]/,
    "Crosshair styling must remain scoped beneath the active V2 attack board",
  );
  assert.match(simulatorSource, /\.seapals-attack-target-layer\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?z-index:\s*88;/);
  assert.match(simulatorSource, /@keyframes\s+seapalsAttackReticleLand/i);
});

test("an actually consumed defender gets a V2-only flight to its rules-correct owner pile", () => {
  const consumeFlight = sourceSection(
    simulatorSource,
    "function queueConsumedAttackFlight(",
    "function getPlayerAttackTargets(",
  );
  assert.match(consumeFlight, /if\s*\(!previewExperience\)\s*return/);
  assert.match(consumeFlight, /destinationOwner/);
  assert.match(consumeFlight, /destinationZone/);
  assert.match(consumeFlight, /data-zone-owner=\[?['"`]\$\{destinationOwner\}/);
  assert.match(consumeFlight, /data-mobile-zone=[^\n]*\$\{destinationZone\}/);
  assert.match(consumeFlight, /setConsumedAttackFlight\(/);

  const attackResolution = sourceSection(
    simulatorSource,
    "function resolvePlayerAttack(",
    "function applyPlayerOnPlayDeckDiscard(",
  );
  const successfulResolution = attackResolution.slice(attackResolution.indexOf("if (attackerWins)"));
  assert.match(
    successfulResolution,
    /!defenderKept[\s\S]*?queueConsumedAttackFlight\([\s\S]*?destinationOwner:\s*"opponent"[\s\S]*?destinationZone:\s*destroyedCardGoesToLostZone\(targetEntry\.card\)\s*\?\s*"lost"\s*:\s*"discard"/,
    "Only a genuinely removed defender should launch a flight, and existing Lost Zone routing must win over presentation",
  );
  assert.match(successfulResolution, /setOpponent\(nextOpponentState\)/, "The existing rules engine must still commit the resolved opponent state");

  assert.match(simulatorSource, /data-consumed-attack-flight/);
  assert.match(simulatorSource, /@keyframes\s+seapalsConsumedAttackToDiscard/i);
  assert.match(
    simulatorSource,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.seapals-consumed-attack-flight[\s\S]*?animation[^;]*(?:none|1ms)/,
    "The decorative consume travel should respect reduced motion",
  );
});
