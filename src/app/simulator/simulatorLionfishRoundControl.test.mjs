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

test("one round-button tap owns the complete Lionfish and opponent-turn pipeline", () => {
  const endTurn = sourceBetween("  function endTurn()", "  function resolveOpponentTurn({");
  const phaseGuard = endTurn.indexOf('if (gamePhase !== "setup" && gamePhase !== "main") return;');
  const oneShotGuard = endTurn.indexOf("if (turnAdvanceRequestedRef.current) return;");
  const oneShotClaim = endTurn.indexOf("turnAdvanceRequestedRef.current = true;");
  const transitionCommit = endTurn.indexOf('setGamePhase("transition")');

  assert.ok(phaseGuard >= 0 && phaseGuard < oneShotGuard && oneShotGuard < oneShotClaim && oneShotClaim < transitionCommit);
  assert.match(simulatorSource, /const turnControlPhaseLocked = gamePhase !== "setup" && gamePhase !== "main";/);
  assert.match(simulatorSource, /const turnControlDisabled = Boolean\(gameResult\)[\s\S]*?\|\| opponentTurnInProgress[\s\S]*?\|\| turnControlPhaseLocked/);
  assert.equal(
    (simulatorSource.match(/disabled=\{turnControlDisabled\}/g) ?? []).length,
    3,
    "every non-divider turn control should share the phase lock",
  );
  assert.equal(
    (simulatorSource.match(/disabled=\{boardInteractionOverlayActive \|\| turnControlDisabled\}/g) ?? []).length,
    1,
    "the divider turn control should add its board-overlay lock",
  );
});

test("Lionfish completion resumes internally instead of asking for another round tap", () => {
  const opponentTurn = sourceBetween("  function resolveOpponentTurn({", "  function flipForOpeningTurn");
  const queuedPresenter = sourceBetween("  function presentQueuedEvent(", "  function closeEventOverlay()");

  assert.match(opponentTurn, /createLiveLionfishTurnEvents\(\{[\s\S]*?onComplete:[\s\S]*?resolveOpponentTurnRef\.current\?\.\(\{[\s\S]*?skipLionfish: true[\s\S]*?forcePresentQueuedEvents: true/);
  assert.match(queuedPresenter, /event\.type === "live-lionfish-continuation"[\s\S]*?event\.continueLiveLionfish\?\.\(\)/);
  assert.doesNotMatch(opponentTurn, /onComplete:[\s\S]*?endTurn\(\)/);
});

test("the terminal Lionfish continuation is one-shot and cannot strand the resumed queue", () => {
  const lionfishEvents = sourceBetween(
    "  function createLiveLionfishTurnEvents({",
    "  function createLiveOpponentAttackStepEvents({",
  );
  const queueEvents = sourceBetween("  function queueEvents(", "  function commitEventState(");
  const opponentTurn = sourceBetween("  function resolveOpponentTurn({", "  function flipForOpeningTurn");

  assert.match(lionfishEvents, /let continuationConsumed = false;[\s\S]*?if \(continuationConsumed\) return;[\s\S]*?continuationConsumed = true;/);
  assert.match(queueEvents, /\{ forcePresent = false \}[\s\S]*?if \(!forcePresent && \(/);
  assert.match(opponentTurn, /forcePresentQueuedEvents = false/);
  assert.equal(
    (opponentTurn.match(/\{ forcePresent: forcePresentQueuedEvents \}/g) ?? []).length,
    3,
    "every resumed opponent-turn exit must honor the terminal continuation's forced drain",
  );
});
