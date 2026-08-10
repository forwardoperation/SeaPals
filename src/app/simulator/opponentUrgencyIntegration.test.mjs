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

test("Hard permanent scoring consumes the public threat profile", () => {
  const opponentTurn = sourceBetween(
    "function runOpponentTurn",
    "function applyOpponentFoundationDamage",
  );
  assert.match(opponentTurn, /const threatProfile = assessCurrentOpponentThreat\(next\)/);
  assert.match(opponentTurn, /scoreHardOpponentPermanentPlay\(\{/);
  assert.match(opponentTurn, /threatLevel: threatProfile\.level/);
  assert.match(opponentTurn, /canAffordAttackAfterPlay/);
});

test("Hard can spend surplus RP on several straightforward permanent cards", () => {
  const opponentTurn = sourceBetween(
    "function runOpponentTurn",
    "function applyOpponentFoundationDamage",
  );
  assert.match(opponentTurn, /const permanentPlays = \[\{/);
  assert.match(opponentTurn, /opponentDifficulty === OpponentDifficulty\.HARD/);
  assert.match(opponentTurn, /&& !opponentOnPlayAttack/);
  assert.match(opponentTurn, /for \(let playIndex = 0; playIndex < safetyLimit; playIndex \+= 1\)/);
  assert.match(opponentTurn, /permanentPlays\.push\(\{/);
  assert.match(opponentTurn, /getAttackRpReserve\(next\)/);
  assert.match(opponentTurn, /candidate\.zone === CreatureZone\.OCEAN/);
  assert.match(opponentTurn, /createCreatureInstance\(candidate\.id, createStableInstanceId\(`opponent-reef-/);
  assert.match(opponentTurn, /discard one oceanic predator or two oceanic fish/);
});

test("Hard support play preserves a legal attack or permanent before spending RP", () => {
  const supports = sourceBetween(
    "function runOpponentSupports",
    "function runOpponentTurn",
  );
  assert.match(supports, /getReservedHardPlayRp/);
  assert.match(supports, /getHardOpponentSupportRpReserve\(\{/);
  assert.match(supports, /existingAttackPlays/);
  assert.match(supports, /if \(actionCost > state\.rp\) return \[\]/);
  assert.match(supports, /existingBoardAttacks: existingAttackPlays/);
  assert.match(supports, /canOpponentSpendSupportWithoutBreakingHardPlan\(\{/);
});

test("normal attacks filter out attackers without targets and Hard can continue to another attacker", () => {
  const attackStep = sourceBetween(
    "function runOpponentAttackStep",
    "function runOpponentAttack(",
  );
  assert.match(attackStep, /filterOpponentAttackersWithLegalTargets\(/);
  assert.match(attackStep, /collectAvailableTargets/);

  const normalAttacks = sourceBetween(
    "function runOpponentNormalAttackActions",
    "function runOpponentNormalActions",
  );
  assert.match(normalAttacks, /getOpponentNormalAttackLimit\(opponentDifficulty\)/);
  assert.match(normalAttacks, /for \(let attackIndex = 0; attackIndex < safetyLimit; attackIndex \+= 1\)/);
  assert.match(normalAttacks, /nextOpponent = resolution\.opponentState/);
});

test("Hard attack planning uses expected values without consuming combat RNG", () => {
  const targetPlanning = sourceBetween(
    "const scoreTarget = (entry, candidateAttacker)",
    "const hardAttackPlan",
  );
  assert.match(targetPlanning, /rollConditionalDie: \(expression\) => \(\{ total: getExpectedDieValue\(expression\) \}\)/);
  assert.match(targetPlanning, /cardHasAttackAdvantage/);
  assert.match(targetPlanning, /attackerHasDisadvantageFromMassive/);
  assert.match(targetPlanning, /getExpectedRepeatCount/);
  assert.doesNotMatch(targetPlanning, /Math\.random|rollDie\(/);
});

test("Hard attacks before utility actions can spend its RP", () => {
  const normalActions = sourceBetween(
    "function runOpponentNormalActions",
    "function resolvePlayerRegenerateChoice",
  );
  assert.match(normalActions, /shouldOpponentAttackBeforeUtility\(opponentDifficulty, threatProfile\.level\)/);
  const criticalBranch = sourceBetween(
    "if (attackFirst) {",
    "const utilities = runOpponentUtilityActions(opponentState, currentPlayerState);",
  );
  assert.ok(
    criticalBranch.indexOf("runOpponentNormalAttackActions") < criticalBranch.indexOf("runOpponentUtilityActions"),
    "critical branch should resolve attacks before utilities",
  );
});
