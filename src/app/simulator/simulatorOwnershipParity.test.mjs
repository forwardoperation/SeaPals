import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = simulatorSource.indexOf(startMarker);
  const end = simulatorSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return simulatorSource.slice(start, end);
}

test("coral upgrade and destruction paths preserve invasive controller metadata", () => {
  const orphanExtraction = sourceBetween(
    "function getOrphanEntriesFromFoundation",
    "function redistributeOrphanCreatures",
  );
  assert.match(orphanExtraction, /controller[\s\S]*slot\.controller/);
  assert.match(orphanExtraction, /invasiveOwner[\s\S]*slot\.invasiveOwner/);

  const upgradeMerge = sourceBetween(
    "function mergeUpgradedCoralSlots",
    "function removeOneCard",
  );
  assert.match(upgradeMerge, /controller[\s\S]*existingSlot\.controller/);
  assert.match(upgradeMerge, /invasiveOwner[\s\S]*existingSlot\.invasiveOwner/);
});

test("foreign invasive orphan paths remain unscored, unusable, and attack-removable", () => {
  const scoring = sourceBetween(
    "function getEcosystemVictoryPoints",
    "function ecosystemHasCard",
  );
  assert.match(scoring, /getLocallyControlledOrphans\(ownership\?\.localOrphans/);
  assert.match(scoring, /getInvasiveOrphanTargets\(ownership\?\.rivalOrphans/);

  const playerTargets = sourceBetween(
    "function getPlayerAttackTargets",
    "function createPlayerAttackContext",
  );
  assert.match(playerTargets, /__own_invader_orphan__/);
  assert.match(playerTargets, /getInvasiveOrphanTargets\(ownOrphans, "opponent"\)/);

  const opponentAttack = sourceBetween(
    "function runOpponentAttackStep",
    "function runOpponentAttack(",
  );
  assert.match(opponentAttack, /getInvasiveOrphanTargets\(opponentState\.orphanCreatures, "player"\)/);
  assert.match(opponentAttack, /removeInvasiveOrphan\(opponentState\.orphanCreatures/);
});

test("own-reef invader removal shares Blue Crab math without bypassing Toxic or self-discard", () => {
  const invaderRemoval = sourceBetween(
    "if (targetEntry.targetsOwnInvader)",
    "const resilienceTriggered",
  );
  assert.match(invaderRemoval, /resolveToxicConsumption/);
  assert.match(invaderRemoval, /shouldSelfDiscardAfterConsume/);
  assert.match(invaderRemoval, /resolveBlueCrabRecycle/);
  assert.match(invaderRemoval, /blueCrabRecycleUsedTurn:\s*blueCrabRecycle\.recycleUsedTurnAfter/);
  assert.match(invaderRemoval, /Opponent's Blue Crab recycled/);

  const playerAttack = sourceBetween(
    "function resolvePlayerAttack",
    "function applyPlayerOnPlayDeckDiscard",
  );
  assert.ok((playerAttack.match(/resolveBlueCrabRecycle\(/g) ?? []).length >= 2, "ordinary and invasive defender paths should share the resolver");
});
