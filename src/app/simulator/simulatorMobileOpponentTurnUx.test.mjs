import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [simulatorSource, globalStyles] = await Promise.all([
  readFile(new URL("./Simulator.jsx", import.meta.url), "utf8"),
  readFile(new URL("../../styles/globals.css", import.meta.url), "utf8"),
]);

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("mobile board follows turn boundaries without blocking manual inspection", () => {
  const phaseEffect = sourceSection(
    simulatorSource,
    'if (gamePhase === "opponent")',
    "if (!tutorialHelpTargetActive) return undefined;"
  );

  assert.match(phaseEffect, /setMobileBoardView\("opponent"\)/);
  assert.match(phaseEffect, /gamePhase === "draw"/);
  assert.match(phaseEffect, /setMobileBoardView\("player"\)/);
  assert.match(phaseEffect, /\}, \[gamePhase\]\);/);

  assert.match(
    simulatorSource,
    /onClick=\{\(\) => setMobileBoardView\("player"\)\}/
  );
  assert.match(
    simulatorSource,
    /onClick=\{\(\) => setMobileBoardView\("opponent"\)\}/
  );
  assert.match(
    simulatorSource,
    /aria-pressed=\{mobileBoardView === "player"\}/
  );
  assert.match(
    simulatorSource,
    /aria-pressed=\{mobileBoardView === "opponent"\}/
  );
  assert.match(
    simulatorSource,
    /mobileBoardView === "opponent"[\s\S]*xl:block xl:h-\[45%\]/
  );
  assert.match(
    simulatorSource,
    /mobileBoardView === "player"[\s\S]*xl:block xl:h-\[55%\]/
  );
});

test("bubble bursts are scoped and rendered independently on both boards", () => {
  assert.match(
    simulatorSource,
    /function queueBubbleBurst\(x, y, board = "player"\)/
  );
  assert.match(
    simulatorSource,
    /board: board === "opponent" \? "opponent" : "player"/
  );
  assert.match(
    simulatorSource,
    /function BoardBubbleBursts\(\{ bursts, board \}\)/
  );
  assert.match(
    simulatorSource,
    /\(burst\.board \?\? "player"\) === board/
  );
  assert.match(
    simulatorSource,
    /<BoardBubbleBursts\s+bursts=\{bubbleBursts\}\s+board="opponent"/
  );
  assert.match(
    simulatorSource,
    /<BoardBubbleBursts bursts=\{bubbleBursts\} board="player" \/>/
  );
  assert.match(simulatorSource, /aria-hidden="true"/);

  assert.match(globalStyles, /\.seapals-bubble-particle\s*\{/);
  assert.match(
    globalStyles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.seapals-bubble-particle\s*\{[\s\S]*animation-duration: 500ms;[\s\S]*animation-delay: 0ms;/
  );
});

test("only committed permanent placements create AI placement cues", () => {
  const supportActions = sourceSection(
    simulatorSource,
    "function runOpponentSupports(opponentState)",
    "function runOpponentTurn(current"
  );
  const opponentTurn = sourceSection(
    simulatorSource,
    "function runOpponentTurn(current",
    "function cancelOpeningCoinFlip()"
  );
  const commitEventState = sourceSection(
    simulatorSource,
    "function commitEventState(event)",
    "function closeEventOverlay()"
  );

  assert.doesNotMatch(supportActions, /permanentPlacementCue/);
  assert.match(
    opponentTurn,
    /let opponentPlaySnapshot = reconcileOpponentInstances\(current, next\)/
  );
  assert.match(
    opponentTurn,
    /opponentPlaySnapshot = reconcileOpponentInstances\(\s*opponentPlaySnapshot,\s*next/
  );
  assert.match(
    opponentTurn,
    /opponentStateAfter: opponentPlaySnapshot/
  );
  assert.match(opponentTurn, /permanentPlacementCue: getPermanentPlacementCue/);
  assert.match(
    simulatorSource,
    /opponentStateAfter:\s*play\.opponentStateAfter \?\? opponentStateAfterPlay/
  );
  assert.match(
    simulatorSource,
    /permanentPlacementCue:\s*play\.permanentPlacementCue \?\?/
  );
  assert.match(
    commitEventState,
    /if \(event\?\.permanentPlacementCue\)[\s\S]*setMobileBoardView\(board === "opponent" \? "opponent" : "player"\)[\s\S]*queueBubbleBurst\(x, y, board\)/
  );
});
