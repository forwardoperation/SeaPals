import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [simulatorSource, sequenceSource] = await Promise.all([
  readFile(new URL("./Simulator.jsx", import.meta.url), "utf8"),
  readFile(new URL("./compactTurnSequence.mjs", import.meta.url), "utf8"),
]);

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("compact turn presentation is limited to the V2 board without replacing scripted tutorial coaching", () => {
  assert.match(
    simulatorSource,
    /const compactTurnPresentationEnabled = previewExperience && !tutorialUsesScriptedScenario;/,
  );
  assert.match(
    simulatorSource,
    /import \{[\s\S]*?CompactTurnStage,[\s\S]*?allocateCollectedRpSources,[\s\S]*?createCompactTurnStages,[\s\S]*?\} from "\.\/compactTurnSequence\.mjs";/,
  );
});

test("turn notices stay transient while round conditions wait in a compact board-visible reader", () => {
  const compactOverlay = sourceSection(
    simulatorSource,
    "{compactTurnSequence ? <div className=\"seapals-compact-turn-guard",
    "{opponentThinking ? (",
  );

  assert.match(compactOverlay, /data-compact-turn-banner=\{compactTurnStage\.kind\}/);
  assert.match(compactOverlay, /aria-hidden="true"/);
  assert.match(compactOverlay, /<strong>\{compactTurnSequence\.turnLabel\}<\/strong>/);
  assert.match(compactOverlay, /Round \{compactTurnSequence\.roundNumber\} condition/);
  assert.match(compactOverlay, /compactTurnSequence\.condition\?\.text/);
  assert.match(compactOverlay, /role="dialog"/);
  assert.match(compactOverlay, /aria-modal="false"/);
  assert.match(compactOverlay, /data-compact-condition-continue/);
  assert.match(compactOverlay, /onClick=\{continueCompactCondition\}/);
  assert.match(compactOverlay, /className="sr-only" role="status" aria-live="polite" aria-atomic="true"/);
  assert.doesNotMatch(compactOverlay, /aria-modal="true"|bg-slate-950\/80|backdrop-blur-sm/);

  assert.match(simulatorSource, /\.seapals-compact-turn-banner \{[\s\S]*?left: 50vw;[\s\S]*?top: 50dvh;[\s\S]*?width: min\(calc\(100vw - 2rem\), 34rem\);/);
  assert.match(simulatorSource, /translate: none;[\s\S]*?transform: translate\(-50%, -50%\);/);
  assert.doesNotMatch(compactOverlay, /left-1\/2|top-1\/2|-translate-x-1\/2|-translate-y-1\/2/);
  assert.match(simulatorSource, /animation: seapalsCompactTurnBannerIn 920ms ease-in-out both;/);
  assert.match(simulatorSource, /\.seapals-compact-turn-banner\.is-condition \{[\s\S]*?animation: seapalsCompactConditionBannerIn 280ms/);
  assert.match(simulatorSource, /\.seapals-compact-turn-banner\.is-condition[\s\S]*?pointer-events: auto;/);
});

test("new-round sequencing orders turn, condition, then RP and preserves every continuation", () => {
  assert.match(
    sequenceSource,
    /return \[[\s\S]*?turnLabel \? \{ kind: CompactTurnStage\.TURN \}[\s\S]*?includeCondition && condition \? \{ kind: CompactTurnStage\.CONDITION \}[\s\S]*?includeRp \? \{ kind: CompactTurnStage\.RP \}/,
  );

  const startRound = sourceSection(
    simulatorSource,
    "function startRound(nextRound,",
    "function beginOpeningOpponentTurn()",
  );
  assert.match(startRound, /turnLabel: skipTurnBanner \? null : "Your Turn"/);
  assert.match(startRound, /includeCondition: Boolean\(condition && !reuseConditionId\)/);
  assert.match(startRound, /includeRp: true/);

  const continuation = sourceSection(
    simulatorSource,
    "function continueAfterPresentedEvent(event, remainingEvents = [])",
    "function presentQueuedEvent(event, remainingEvents = [],",
  );
  assert.match(continuation, /if \(event\?\.beginOpponentAfterClose\)/);
  assert.match(continuation, /if \(event\?\.advanceRoundAfterClose\)/);
  assert.match(continuation, /if \(event\?\.startOpeningPlayerTurnAfterClose\)/);
  assert.match(continuation, /skipTurnBanner: compactTurnPresentationEnabled/);
  assert.match(continuation, /opponentStateOverride: event\.opponentStateAfter \?\? null/);
});

test("both controllers collect RP from stable board sources into a counting RP bank", () => {
  const sourcePlan = sourceSection(
    simulatorSource,
    "function getEcosystemStartTurnRpSources(playerCorals, activeCondition = null)",
    "function getEcosystemCreatureCardIds(",
  );
  assert.match(sourcePlan, /\{ key: "round-supply", amount: 1 \}/);
  assert.match(sourcePlan, /`foundation:\$\{coral\.id\}`/);
  assert.match(sourcePlan, /`slot:\$\{slot\.id\}`/);
  assert.match(sourcePlan, /if \(slot\.invasiveOwner\) return;/);

  const flightLogic = sourceSection(
    simulatorSource,
    "function launchCompactRpFlights(sequence)",
    "useEffect(() => {\n    const sequence = compactTurnSequence;",
  );
  assert.match(flightLogic, /allocateCollectedRpSources\(sequence\.rpSources, sequence\.collectedRp\)/);
  assert.match(flightLogic, /\[data-rp-bank-target="\$\{sequence\.owner\}"\]/);
  assert.match(flightLogic, /\[data-board-owner="\$\{sequence\.owner\}"\] \[data-rp-source-key="\$\{coin\.sourceKey\}"\]/);
  assert.match(flightLogic, /const neutralSourceRect = document\.querySelector\('\[data-rp-source-key="round-supply"\]'\)/);
  assert.match(flightLogic, /const resolvedSourceRect = sourceRect\?\.width \? sourceRect : neutralSourceRect\?\.width \? neutralSourceRect : null/);
  assert.match(flightLogic, /Math\.min\([\s\S]*?sequence\.rpAfter,[\s\S]*?Number\(current\[sequence\.owner\] \?\? sequence\.rpBefore\) \+ 1/);

  assert.match(simulatorSource, /data-rp-bank-target="opponent"[\s\S]*?<strong>\{presentedOpponentRp\}<\/strong>/);
  assert.match(simulatorSource, /data-rp-bank-target="player"[\s\S]*?<strong>\{presentedPlayerRp\}<\/strong>/);
  assert.match(simulatorSource, /data-rp-source-key=\{`foundation:\$\{coral\.id\}`\}/);
  assert.match(simulatorSource, /data-rp-source-key=\{slotCard && !slot\.invasiveOwner \? `slot:\$\{slot\.id\}` : undefined\}/);
  assert.match(simulatorSource, /data-rp-source-key="round-supply"/);
  assert.match(simulatorSource, /data-compact-rp-flight-layer/);
  assert.match(simulatorSource, /data-rp-source=\{flight\.sourceKey\}/);

  const opponentTurn = sourceSection(
    simulatorSource,
    "function runOpponentTurn(current,",
    "function cancelOpeningCoinFlip()",
  );
  assert.match(opponentTurn, /const startTurnCorals = current\.corals\.map/);
  assert.match(opponentTurn, /const rpSources = getEcosystemStartTurnRpSources\(startTurnCorals, activeCondition\)\.map/);
  assert.match(opponentTurn, /bankBefore: rpBeforeCollection/);
  assert.match(opponentTurn, /rpSources,/);
});

test("mandatory draw UI stays closed until the compact sequence completes", () => {
  const drawGate = sourceSection(
    simulatorSource,
    "if (!previewDrawTrayEnabled) {",
    "if (compactDrawViewport || !mobileDrawSequenceActiveRef.current) return;",
  );
  assert.match(drawGate, /if \(compactTurnSequence \|\| eventOverlay\) \{[\s\S]*?setMobileDrawTrayOpen\(false\);[\s\S]*?return;/);
  assert.match(drawGate, /\}, \[compactTurnSequence, eventOverlay,/);
  assert.match(
    simulatorSource,
    /open=\{mobileDrawTrayOpen && modal === "turn-draw" && !eventOverlay && !compactTurnSequence\}/,
  );
  assert.match(
    simulatorSource,
    /const fullPageModalOpen = Boolean\(modal && !compactTurnSequence/,
  );

  const finishSequence = sourceSection(
    simulatorSource,
    "function finishCompactTurnSequence(sequenceId)",
    "function advanceCompactTurnSequence(sequenceId)",
  );
  assert.ok(
    finishSequence.indexOf("setCompactTurnSequence(null)") < finishSequence.indexOf("completion?.()"),
    "The compact sequence must clear before its draw/continuation callback runs.",
  );
});

test("legacy boards retain the full-page event path", () => {
  const startRound = sourceSection(
    simulatorSource,
    "function startRound(nextRound,",
    "function beginOpeningOpponentTurn()",
  );
  assert.match(startRound, /if \(condition && !compactTurnPresentationEnabled\) \{[\s\S]*?type: "condition-reveal"/);
  assert.match(startRound, /if \(compactTurnPresentationEnabled\) \{[\s\S]*?beginCompactTurnSequence\([\s\S]*?\} else \{[\s\S]*?setPendingEvents\(startTurnEvents\)/);

  const legacyOverlay = sourceSection(
    simulatorSource,
    "{eventOverlay && !boardFaceoffActive && !openingCoinBoardActive ? (",
    "{fullPageModalOpen ? (",
  );
  assert.match(legacyOverlay, /role="dialog"/);
  assert.match(legacyOverlay, /aria-modal="true"/);
  assert.match(legacyOverlay, /eventOverlay\.type === "condition-reveal"/);
  assert.match(legacyOverlay, /eventOverlay\.type === "opponent-status"/);
  assert.match(legacyOverlay, /eventOverlay\.type === "turn-transition"/);
});
