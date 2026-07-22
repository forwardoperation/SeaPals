import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});
const { cardsById } = jiti(path.join(projectRoot, "src/data/cards/index.js"));

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const fishCardSource = await readFile(new URL("../../data/cards/creatures/fish.js", import.meta.url), "utf8");
const supportCardSource = await readFile(new URL("../../data/cards/support.js", import.meta.url), "utf8");

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

test("an On Play attack targets the reconciled reef after its foundation damage", () => {
  const impact = sourceBetween(
    "function damageOpponentFoundation",
    "function attackWithCreature",
  );
  assert.match(impact, /let opponentStateAfterDamage = opponent/);
  assert.match(impact, /beginOnPlayAttack\([\s\S]*opponentStateAfterDamage\)/);

  const onPlayAttack = sourceBetween(
    "function beginOnPlayAttack",
    "function resolvePlayerAttack",
  );
  assert.match(onPlayAttack, /opponentState = opponent/);
  assert.match(onPlayAttack, /getPlayerAttackTargets\(card, attack, opponentState\)/);
});

test("mandatory On Play attacks cannot be canceled before they resolve", () => {
  const onPlayAttack = sourceBetween(
    "function beginOnPlayAttack",
    "function resolvePlayerAttack",
  );
  assert.match(onPlayAttack, /mandatory On Play sequence must finish/);
  assert.match(simulatorSource, /!attackContext\.costCommitted && !attackContext\.onPlay \? <button[\s\S]*?>Cancel<\/button>/);
  assert.match(simulatorSource, /!faceoffRolling && !attackContext\?\.costCommitted && !attackContext\?\.onPlay \? <button[\s\S]*?>Cancel Faceoff<\/button>/);
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

test("authored Lionfish and Spearfishing data identify the specialized removal route", () => {
  const lionfishStart = fishCardSource.indexOf('id: "lionfish"');
  const lionfishEnd = fishCardSource.indexOf('id: "flounder"', lionfishStart);
  const lionfish = fishCardSource.slice(lionfishStart, lionfishEnd);
  assert.match(lionfish, /discard it with Spearfishing or destroy it with a successful attack/);
  assert.match(lionfish, /destroyedDestination: "lost-zone"/);
  assert.match(lionfish, /specializedSupportCardIds: \["spearfishing"\]/);

  assert.equal(cardsById.lionfish.destroyedDestination, "lost-zone");
  assert.match(cardsById.lionfish.specialRules.join(" "), /If destroyed, place this card in your Lost Zone\./);
  assert.equal(cardsById.flounder.destroyedDestination, "discard", "ordinary Fish still discard when destroyed");

  const spearfishingStart = supportCardSource.indexOf('id: "spearfishing"');
  const spearfishingEnd = supportCardSource.indexOf("\n  {", spearfishingStart + 1);
  const spearfishing = supportCardSource.slice(spearfishingStart, spearfishingEnd);
  assert.match(spearfishing, /from: Zone\.YOUR_REEF/);
  assert.match(spearfishing, /to: Zone\.DISCARD/);
  assert.match(spearfishing, /includesOpponentOwnedInvasiveCardIds: \["lionfish"\]/);
});
