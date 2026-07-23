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

test("Algae Bloom queues a mandatory whole-hand discard choice", () => {
  const choiceEffect = sourceBetween(
    'if (!["draw", "main"].includes(gamePhase) || !Number.isFinite(activeHandLimit)) return;',
    "  function notifyTutorialCallback",
  );
  assert.match(choiceEffect, /createHandLimitChoice\(\{ hand, handLimit: activeHandLimit \}\)/);
  assert.match(choiceEffect, /pendingEvents\.some\(\(event\) => event\.type === "choose-hand-limit-discard"\)/);
  assert.match(choiceEffect, /Choose from your entire hand/);
  assert.doesNotMatch(choiceEffect, /shuffle\(/);
});

test("the hand-limit overlay requires an exact selection and has no cancel path", () => {
  const overlay = sourceBetween(
    ') : eventOverlay.type === "choose-hand-limit-discard" ? (',
    ') : eventOverlay.type === "choose-regenerate" ? (',
  );
  assert.match(overlay, /aria-pressed=\{selected\}/);
  assert.match(overlay, /handLimitDiscardSelection\.length !== eventOverlay\.handLimitChoice\.requiredDiscardCount/);
  assert.match(overlay, /Discard Selected &amp; Continue/);
  assert.doesNotMatch(overlay, /Cancel|closeEventOverlay/);
});

test("player draws enter the hand before the choice resolves", () => {
  const normalDraw = sourceBetween("  function confirmTurnDraw()", "  function getPlayerOceanicSacrificeChoices");
  assert.match(normalDraw, /drawWithHandLimit\(drawnCards, hand\.length, drawnCards\.length, Infinity\)/);
  assert.match(normalDraw, /setHand\(\(current\) => \[\.\.\.current, \.\.\.drawResult\.cardsToHand\]\)/);
  assert.doesNotMatch(normalDraw, /activeCondition.*setHandLimit/);
});

test("newly revealed hand limits no longer auto-slice the player's hand", () => {
  const startRound = sourceBetween("  function startRound(", "  function beginOpeningOpponentTurn");
  assert.doesNotMatch(startRound, /setHand\(\(current\) => current\.slice/);
  assert.match(startRound, /Your hand is .* over the limit; choose what to discard/);
  assert.match(startRound, /applyAutomatedHandLimitToState\(opponent/);
});

test("the opponent makes a deterministic scored discard choice", () => {
  const helper = sourceBetween("function getAutomatedHandKeepScore", "function getOpposingPlayCostModifier");
  assert.match(helper, /selectAutomatedHandLimitDiscards/);
  assert.match(helper, /getCardStartTurnRp/);
  assert.doesNotMatch(helper, /Math\.random|shuffle/);
});
