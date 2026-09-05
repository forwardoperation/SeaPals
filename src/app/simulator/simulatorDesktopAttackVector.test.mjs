import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createAttackVectorGeometry } from "./attackIntentPresentation.mjs";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const boardCombatSource = await readFile(new URL("./BoardCombatPresentation.jsx", import.meta.url), "utf8");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

function assertPointInside(point, rect, label) {
  assert.ok(point.x >= rect.left && point.x <= rect.right, `${label} x should remain inside the desktop board`);
  assert.ok(point.y >= rect.top && point.y <= rect.bottom, `${label} y should remain inside the desktop board`);
}

test("desktop attack geometry survives a nonzero board inset at the effective 175% zoom viewport", () => {
  // A 1920x1080 display viewed at 175% browser zoom exposes roughly this many
  // CSS pixels. The simulator board is inset by its shell padding and border.
  const rootRect = {
    left: 8,
    top: 8,
    right: 1089,
    bottom: 609,
    width: 1081,
    height: 601,
  };
  const opponentAttacker = {
    left: 462,
    top: 62,
    right: 548,
    bottom: 182,
    width: 86,
    height: 120,
  };
  const playerDefender = {
    left: 331,
    top: 390,
    right: 437,
    bottom: 538,
    width: 106,
    height: 148,
  };

  const geometry = createAttackVectorGeometry({
    rootRect,
    attackerRect: opponentAttacker,
    targetRect: playerDefender,
  });

  assert.ok(geometry, "A visible desktop attacker and defender must produce an arrow");
  assertPointInside(geometry.start, rootRect, "arrow tail");
  assertPointInside(geometry.end, rootRect, "arrow head");
  assertPointInside(geometry.control1, rootRect, "first control point");
  assertPointInside(geometry.control2, rootRect, "second control point");
  assert.ok(
    geometry.start.y > opponentAttacker.bottom,
    "The arrow should leave below an opponent card attacking toward the player reef",
  );
  assert.ok(
    geometry.end.y < playerDefender.top,
    "The arrowhead should stop above the defending card instead of obscuring it",
  );
  assert.ok(geometry.end.y > geometry.start.y, "The direction must run from opponent to player");
  assert.doesNotMatch(geometry.path, /NaN|Infinity/);
});

test("desktop attack geometry remains directional across a wide board", () => {
  const rootRect = {
    left: 12,
    top: 10,
    right: 1896,
    bottom: 1068,
    width: 1884,
    height: 1058,
  };
  const attackerRect = {
    left: 1340,
    top: 164,
    right: 1470,
    bottom: 346,
    width: 130,
    height: 182,
  };
  const targetRect = {
    left: 390,
    top: 684,
    right: 555,
    bottom: 915,
    width: 165,
    height: 231,
  };

  const geometry = createAttackVectorGeometry({ rootRect, attackerRect, targetRect });
  const reverse = createAttackVectorGeometry({
    rootRect,
    attackerRect: targetRect,
    targetRect: attackerRect,
  });

  assert.ok(geometry && reverse);
  assert.ok(geometry.start.x > geometry.end.x, "The forward arrow should travel toward the left-side defender");
  assert.ok(geometry.start.y < geometry.end.y, "The forward arrow should travel toward the lower player reef");
  assert.ok(reverse.start.x < reverse.end.x, "Reversing ownership should reverse horizontal direction");
  assert.ok(reverse.start.y > reverse.end.y, "Reversing ownership should reverse vertical direction");
});

test("the shared attack vector stays above desktop cards and below the tappable dice layer", () => {
  const intentStyles = sourceSection(
    simulatorSource,
    ".seapals-combat-attack-intent {",
    ".seapals-combat-dice-layer {",
  );
  const diceStyles = sourceSection(
    simulatorSource,
    ".seapals-combat-dice-layer {",
    ".seapals-combat-roll-catcher {",
  );
  const intentZ = Number(intentStyles.match(/z-index:\s*(\d+)/)?.[1]);
  const diceZ = Number(diceStyles.match(/z-index:\s*(\d+)/)?.[1]);

  assert.match(intentStyles, /position:\s*fixed;/);
  assert.match(intentStyles, /inset:\s*0;/);
  assert.match(intentStyles, /overflow:\s*hidden;/);
  assert.ok(intentZ > 58, "The vector should paint above highlighted board cards");
  assert.ok(diceZ > intentZ, "The transparent dice interaction layer should remain above the decoration");

  const component = sourceSection(
    boardCombatSource,
    "export function AttackIntentLayer(",
    "function measureAttackTargets(",
  );
  assert.match(component, /const viewportWidth[\s\S]*?window\.innerWidth/);
  assert.match(component, /const viewportHeight[\s\S]*?window\.innerHeight/);
  assert.match(component, /viewBox=\{`0 0 \$\{viewportWidth\} \$\{viewportHeight\}`\}/);
  assert.match(component, /preserveAspectRatio="none"/);
  assert.match(component, /data-combat-attack-vector/);
});

test("desktop combat falls back by card ID only after owner-scoped exact-instance lookup", () => {
  const anchorLookup = sourceSection(
    boardCombatSource,
    "function findCombatAnchorNode(",
    "function measureAttackIntent(",
  );
  assert.match(
    anchorLookup,
    /const ownerRoot\s*=\s*boardOwner[\s\S]{0,160}root\.querySelector\(`\[data-board-owner="\$\{boardOwner\}"\]`\)[\s\S]{0,80}:\s*root;\s*if\s*\(!ownerRoot\)\s*return null/,
    "Both exact and fallback lookup must remain inside the physical owner's reef",
  );
  assert.match(
    anchorLookup,
    /(?:fallback)?[Cc]ardId/,
    "The lookup needs a card-ID fallback for legacy or stale instance identities",
  );
  assert.match(
    anchorLookup,
    /dataset\.cardId\s*===\s*(?:fallback)?[Cc]ardId/,
    "Fallback candidates should match the requested visible card",
  );

  const firstInstanceMatch = Math.min(
    ...[
      anchorLookup.indexOf("dataset.attackTargetInstance === instanceId"),
      anchorLookup.indexOf("dataset.combatTargetId === instanceId"),
      anchorLookup.indexOf("dataset.cardInstanceId === instanceId"),
    ].filter((index) => index >= 0),
  );
  const firstCardMatch = anchorLookup.search(/dataset\.cardId\s*===\s*(?:fallback)?[Cc]ardId/);
  assert.ok(firstInstanceMatch >= 0, "Exact-instance matching should remain the primary lookup");
  assert.ok(firstCardMatch > firstInstanceMatch, "Card-ID matching must be a last-resort fallback");
  const exactResolution = anchorLookup.search(/(?:exact|instance)\w*\s*=\s*chooseMatch\(/i);
  assert.ok(exactResolution >= 0, "Exact-instance candidates should be resolved before fallback");
  const exactResolutionBlock = anchorLookup.slice(exactResolution, firstCardMatch);
  assert.match(
    exactResolutionBlock,
    /if\s*\(\s*(?:exact|instance)\w*\s*\)\s*return\s+(?:exact|instance)\w*/i,
    "A successful exact lookup should return before duplicate-prone card-ID fallback",
  );

  const intentMeasurement = sourceSection(
    boardCombatSource,
    "function measureAttackIntent(",
    "export function AttackIntentLayer(",
  );
  assert.match(
    intentMeasurement,
    /instanceId:\s*anchorOptions\.attackerInstanceId[\s\S]{0,180}(?:fallback)?[Cc]ardId:\s*anchorOptions\.attackerCardId/,
  );
  assert.match(
    intentMeasurement,
    /instanceId:\s*anchorOptions\.targetInstanceId[\s\S]{0,220}(?:fallback)?[Cc]ardId:\s*anchorOptions\.targetCardId/,
  );

  const intentComponent = sourceSection(
    boardCombatSource,
    "export function AttackIntentLayer(",
    "function measureAttackTargets(",
  );
  assert.match(intentComponent, /attackerCardId/);
  assert.match(intentComponent, /targetCardId/);

  const intentMount = sourceSection(
    simulatorSource,
    "<AttackIntentLayer",
    "<AttackTargetLayer",
  );
  assert.match(
    intentMount,
    /attackerCardId=\{eventOverlay\?\.sourceCardId\}/,
    "The live checkpoint should provide the attacking card as its fallback identity",
  );
  assert.match(
    intentMount,
    /targetCardId=\{eventOverlay\?\.defenderCardId\}/,
    "The live checkpoint should provide the defending card as its fallback identity",
  );
});
