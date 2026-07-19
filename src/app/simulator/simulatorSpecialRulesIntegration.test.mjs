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

test("Stunned is enforced by live income, action, destruction, and turn-boundary paths", () => {
  const income = sourceBetween("function getEcosystemStartTurnRp", "function getParasiteRequestedRp");
  assert.match(income, /coralIsStunned\(coral\)/);

  const destruction = sourceBetween(
    "function resolveFoundationDestructionTriggers",
    "function getSchoolDensity",
  );
  assert.match(destruction, /!coralCanUseOwnAbilities\(foundation\)/);

  const playerAction = sourceBetween(
    "function beginCreatureUtilityAction",
    "function completeCreatureDrawAction",
  );
  assert.match(playerAction, /if \(inspectedFoundationIsStunned\)/);

  const opponentTurn = sourceBetween("function resolveOpponentTurn", "function flipForOpeningTurn");
  assert.match(opponentTurn, /resolveStunnedAtControllerTurnBoundary\([\s\S]*turnComplete: !hasPendingRegenerate/);

  const regenerateChoice = sourceBetween(
    "function resolvePlayerRegenerateChoice",
    "function endTurn",
  );
  assert.match(regenerateChoice, /resolveStunnedAtControllerTurnBoundary\([\s\S]*turnComplete: !remainingRegenerate/);
});

test("Ensnare resolves inside each real player and opponent attack step", () => {
  const playerAttack = sourceBetween(
    "function resolvePlayerAttack",
    "function applyPlayerOnPlayDeckDiscard",
  );
  assert.match(playerAttack, /if \(rollNow && attack\?\.ensnare\)/);
  assert.match(playerAttack, /resolveEnsnareForAttack\(attack, Math\.random\)/);

  const opponentSequence = sourceBetween(
    "function runOpponentAttack(opponentState",
    "function buildOpponentAttackEventSequence",
  );
  assert.match(opponentSequence, /if \(onPlayAttack\?\.attack\?\.ensnare\)/);
  assert.match(opponentSequence, /resolveEnsnareForAttack\(onPlayAttack\.attack, Math\.random\)/);
});

test("Cookie Cutter uses the shared board-supply fallback for both controllers", () => {
  const playerRound = sourceBetween("function startRound", "function beginOpeningOpponentTurn");
  assert.match(playerRound, /resolveParasiteCollection\(/);
  assert.match(playerRound, /recipientRp: rp/);
  assert.match(playerRound, /const rpBeforeCollection = parasiteTransfer\.recipientAfter/);

  const opponentTurn = sourceBetween("function resolveOpponentTurn", "function flipForOpeningTurn");
  assert.match(opponentTurn, /resolveParasiteCollection\(/);
  assert.match(opponentTurn, /recipientRp: opponent\.rp/);
  assert.match(opponentTurn, /opponentParasiteTransfer\.recipientAfter/);
});
