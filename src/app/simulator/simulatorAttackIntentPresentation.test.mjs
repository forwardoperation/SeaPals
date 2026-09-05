import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ATTACK_INTENT_MISSING_ANCHOR_MS,
  ATTACK_INTENT_REDUCED_MOTION_MS,
  ATTACK_INTENT_WINDUP_MS,
  createAttackVectorGeometry,
  getAttackIntentWindupDuration,
} from "./attackIntentPresentation.mjs";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const boardCombatSource = await readFile(new URL("./BoardCombatPresentation.jsx", import.meta.url), "utf8");
const boardCombatStyles = await readFile(new URL("./BoardCombatPresentation.module.css", import.meta.url), "utf8");
const presentationSource = `${simulatorSource}\n${boardCombatSource}\n${boardCombatStyles}`;

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

function eventWindow(source, type, occurrence = 0, windowSize = 1800) {
  let start = -1;
  for (let index = 0; index <= occurrence; index += 1) {
    start = source.indexOf(`type: "${type}"`, start + 1);
    assert.ok(start >= 0, `Missing ${type} ready event #${occurrence + 1}`);
  }
  return source.slice(start, start + windowSize);
}

test("attack-vector geometry points from the attacker's outside edge to the target's outside edge", () => {
  const geometry = createAttackVectorGeometry({
    rootRect: { left: 0, top: 0, right: 800, bottom: 900, width: 800, height: 900 },
    attackerRect: { left: 120, top: 560, right: 220, bottom: 700, width: 100, height: 140 },
    targetRect: { left: 560, top: 160, right: 660, bottom: 300, width: 100, height: 140 },
    edgeGap: 10,
  });

  assert.ok(geometry);
  assert.ok(geometry.start.x > 220, "The tail should begin beyond the attacking card's facing edge");
  assert.ok(geometry.end.x < 560, "The arrowhead should stop before covering the target artwork");
  assert.ok(geometry.start.y < 700 && geometry.start.y > 560);
  assert.ok(geometry.end.y < 300 && geometry.end.y > 160);
  assert.match(geometry.path, /^M [\d.]+ [\d.]+ C /);

  const reverse = createAttackVectorGeometry({
    rootRect: { left: 0, top: 0, right: 800, bottom: 900, width: 800, height: 900 },
    attackerRect: { left: 560, top: 160, right: 660, bottom: 300, width: 100, height: 140 },
    targetRect: { left: 120, top: 560, right: 220, bottom: 700, width: 100, height: 140 },
  });
  assert.ok(reverse.start.x < 560, "Reversing owners should reverse the arrow tail");
  assert.ok(reverse.end.x > 220, "Reversing owners should point at the new target");

  const vertical = createAttackVectorGeometry({
    rootRect: { left: 0, top: 0, right: 390, bottom: 800, width: 390, height: 800 },
    attackerRect: { left: 155, top: 590, right: 235, bottom: 710, width: 80, height: 120 },
    targetRect: { left: 155, top: 90, right: 235, bottom: 210, width: 80, height: 120 },
  });
  assert.ok(vertical.start.y < 590 && vertical.end.y > 210, "A vertical mobile matchup should point up from attacker to target");
  assert.ok(!vertical.path.includes("NaN"));

  const rightRailVertical = createAttackVectorGeometry({
    rootRect: { left: 0, top: 0, right: 390, bottom: 800, width: 390, height: 800 },
    attackerRect: { left: 270, top: 590, right: 350, bottom: 710, width: 80, height: 120 },
    targetRect: { left: 270, top: 90, right: 350, bottom: 210, width: 80, height: 120 },
  });
  assert.ok(
    rightRailVertical.control1.x < rightRailVertical.start.x,
    "A right-side vertical matchup should bend toward board center, away from the deck rail",
  );

  const overlappingCenters = createAttackVectorGeometry({
    rootRect: { left: 0, top: 0, right: 390, bottom: 800, width: 390, height: 800 },
    attackerRect: { left: 155, top: 320, right: 235, bottom: 440, width: 80, height: 120 },
    targetRect: { left: 155, top: 320, right: 235, bottom: 440, width: 80, height: 120 },
  });
  assert.ok(overlappingCenters);
  assert.ok(!overlappingCenters.path.includes("NaN"), "Overlapping positions must still produce finite fail-safe geometry");
});

test("attack intent timing sharply shortens reduced-motion and missing-anchor paths", () => {
  assert.equal(getAttackIntentWindupDuration(), ATTACK_INTENT_WINDUP_MS);
  assert.equal(
    getAttackIntentWindupDuration({ reducedMotion: true }),
    ATTACK_INTENT_REDUCED_MOTION_MS,
  );
  assert.equal(
    getAttackIntentWindupDuration({ anchorsAvailable: false }),
    ATTACK_INTENT_MISSING_ANCHOR_MS,
  );
  assert.ok(ATTACK_INTENT_REDUCED_MOTION_MS < ATTACK_INTENT_WINDUP_MS / 4);
  assert.ok(ATTACK_INTENT_MISSING_ANCHOR_MS < ATTACK_INTENT_WINDUP_MS / 4);
  assert.equal(
    createAttackVectorGeometry({
      rootRect: { width: 800, height: 900 },
      attackerRect: { width: 0, height: 140 },
      targetRect: { width: 100, height: 140 },
    }),
    null,
    "Bad geometry should be explicit so the presenter can fail open",
  );
});

test("player, opponent, and Lionfish roll checkpoints retain owner-scoped instance identities", () => {
  const playerAttack = sourceSection(
    simulatorSource,
    "function resolvePlayerAttack(",
    "function applyPlayerOnPlayDeckDiscard(",
  );
  const playerFaceoff = eventWindow(playerAttack, "faceoff-ready");
  const playerSchoolAttack = eventWindow(playerAttack, "school-attack-ready");
  const playerIdentity = sourceSection(
    playerAttack,
    "const createPlayerCombatPresentation = () => ({",
    "const flashingAlarmBonus =",
  );
  assert.match(playerIdentity, /rollCheckpointId:\s*`player-combat-\$\{\+\+playerCombatCheckpointIdRef\.current\}`/);
  assert.match(playerIdentity, /attackerInstanceId,/);
  assert.match(playerIdentity, /targetInstanceId:\s*selectedTarget\.instanceId/);
  assert.match(playerIdentity, /attackerBoardOwner:\s*"player"/);
  assert.match(playerIdentity, /targetBoardOwner:\s*targetsOwnInvader\s*\?\s*"player"\s*:\s*"opponent"/);
  assert.match(playerIdentity, /attackerOwner:\s*"player"/);
  assert.match(playerIdentity, /defenderOwner:\s*"opponent"/);
  assert.match(playerFaceoff, /\.\.\.createPlayerCombatPresentation\(\)/);
  assert.match(playerSchoolAttack, /\.\.\.createPlayerCombatPresentation\(\)/);

  const liveLionfish = sourceSection(
    simulatorSource,
    "function createLiveLionfishTurnEvents(",
    "function createLiveOpponentAttackStepEvents(",
  );
  const lionfishReady = eventWindow(liveLionfish, "opponent-roll-ready");
  assert.match(lionfishReady, /rollCheckpointId:\s*checkpointId/);
  assert.match(lionfishReady, /attackerInstanceId:\s*plan\.invaderInstanceId/);
  assert.match(lionfishReady, /targetInstanceId:\s*plan\.targetInstanceId/);
  assert.match(lionfishReady, /attackerBoardOwner:\s*plan\.invaderPhysicalController\s*\?\?\s*hostController/);
  assert.match(lionfishReady, /targetBoardOwner:\s*plan\.targetPhysicalController\s*\?\?\s*null/);
  assert.match(lionfishReady, /attackerOwner:\s*plannedEvent\.combatAttackerOwner\s*\?\?\s*plan\.invaderController/);
  assert.match(lionfishReady, /defenderOwner:\s*plannedEvent\.combatDefenderOwner\s*\?\?\s*plan\.targetController/);

  const liveOpponent = sourceSection(
    simulatorSource,
    "function createLiveOpponentAttackStepEvents(",
    "function createLiveOpponentNormalActionEvents(",
  );
  const opponentReady = eventWindow(liveOpponent, "opponent-roll-ready");
  assert.match(opponentReady, /rollCheckpointId:\s*checkpointId/);
  assert.match(opponentReady, /attackerInstanceId:\s*plannedCombat\.attackerInstanceId/);
  assert.match(opponentReady, /targetInstanceId:\s*plannedCombat\.targetInstanceId/);
  assert.match(opponentReady, /attackerBoardOwner:\s*plannedCombat\.attackerBoardOwner/);
  assert.match(opponentReady, /targetBoardOwner:\s*plannedCombat\.targetBoardOwner/);
  assert.match(opponentReady, /attackerOwner:\s*"opponent"/);
  assert.match(opponentReady, /defenderOwner:\s*"player"/);

  const opponentPlanner = sourceSection(
    simulatorSource,
    "function runOpponentAttackStep(",
    "function runOpponentAttack(",
  );
  assert.match(
    opponentPlanner,
    /instanceId:\s*getLionfishSlotInstanceId\(coral,\s*slot\)/,
    "Slotted opponent attackers need the same stable instance identity used by their rendered card",
  );
  assert.match(opponentPlanner, /captureCombatPlan\?\.\(\{[\s\S]*?attackerInstanceId:\s*attackerEntry\.instanceId/);
  assert.match(opponentPlanner, /targetInstanceId:\s*targetEntry\.instanceId/);
});

test("each ready checkpoint gets a keyed pre-roll wind-up before combat dice become tappable", () => {
  const presentationKey = sourceSection(
    simulatorSource,
    "function getCombatIntentPresentationKey(",
    "function getHostedDefenseBonusDice(",
  );
  assert.match(presentationKey, /event\.rollCheckpointId/);
  assert.match(presentationKey, /event\.attackerInstanceId/);
  assert.match(presentationKey, /event\.targetInstanceId/);
  assert.match(
    simulatorSource,
    /const presentationKey = getCombatIntentPresentationKey\(eventOverlay\);[\s\S]{0,500}faceoffIntentKeyRef\.current = presentationKey;[\s\S]{0,500}setFaceoffRolling\(false\);[\s\S]{0,200}setFaceoffIntentReadyKey\(null\)/,
    "A newly selected target should enter a wind-up phase with dice stopped",
  );
  const completion = sourceSection(
    simulatorSource,
    "function completeBoardAttackIntent(",
    "function stopBoardFaceoff(",
  );
  assert.match(
    completion,
    /faceoffIntentKeyRef\.current !== presentationKey\) return;[\s\S]*?setFaceoffIntentReadyKey\(presentationKey\);[\s\S]*?setFaceoffRolling\(true\)/,
    "Completing the wind-up should be the operation that starts dice cycling",
  );
  assert.match(
    simulatorSource,
    /<BoardCombatDice[\s\S]{0,220}?active=\{combatBoardFaceoffActive\s*&&\s*combatIntentReady\s*&&\s*!boardStatPresentationActive\}/,
    "The full-board roll catcher must not activate until the wind-up has completed",
  );
  assert.match(
    simulatorSource,
    /<AttackIntentLayer[\s\S]{0,400}?presentationKey=\{combatIntentPresentationKey\}/,
    "The presentation layer should receive the unique roll checkpoint key",
  );
  assert.match(boardCombatSource, /data-combat-presentation-key=\{presentationKey\}/);
});

test("the attacking card winds up with several alternating rotations without moving the live card", () => {
  assert.match(boardCombatSource, /data-combat-attacker-windup/);
  assert.match(
    boardCombatSource,
    /findCombatAnchorNode\([\s\S]{0,600}instanceId:\s*anchorOptions\.attackerInstanceId[\s\S]{0,300}boardOwner:\s*anchorOptions\.attackerBoardOwner/,
    "The wobble must bind to one owner-scoped card instance, not every copy of a card ID",
  );
  assert.match(presentationSource, /@keyframes\s+(?:seapals)?(?:Attack|Combat)[A-Za-z]*(?:Windup|Wobble)/i);

  const keyframeStart = presentationSource.search(/@keyframes\s+(?:seapals)?(?:Attack|Combat)[A-Za-z]*(?:Windup|Wobble)/i);
  const keyframeSource = presentationSource.slice(keyframeStart, keyframeStart + 1600);
  const negativeTurns = keyframeSource.match(/rotate:\s*-\d+(?:\.\d+)?deg/gi) ?? [];
  const positiveTurns = keyframeSource.match(/rotate:\s*(?!0(?:\.0+)?deg)\+?\d+(?:\.\d+)?deg/gi) ?? [];
  assert.ok(negativeTurns.length >= 2, "The attacker should lean left more than once during the wind-up");
  assert.ok(positiveTurns.length >= 2, "The attacker should lean right more than once during the wind-up");
  const windupRule = sourceSection(
    simulatorSource,
    '[data-combat-attacker-windup="true"] {',
    ".seapals-combat-attack-intent {",
  );
  assert.match(windupRule, /animation:\s*seapalsCombatAttackerWindup/);
  assert.match(windupRule, /will-change:\s*rotate,\s*scale,\s*filter/);
  assert.doesNotMatch(
    windupRule,
    /\btransform:/,
    "Use individual rotate/scale properties so existing pan, zoom, and drag transforms are preserved",
  );
  assert.match(
    boardCombatSource,
    /setAttribute\("data-combat-attacker-windup",\s*"true"\)[\s\S]{0,300}removeAttribute\("data-combat-attacker-windup"\)/,
    "The transient wobble marker must be removed after the pre-roll phase",
  );
});

test("a directional SVG arrow connects attacker to target and remains visible while dice roll", () => {
  assert.match(boardCombatSource, /data-combat-attack-vector/);
  assert.match(boardCombatSource, /<svg[\s\S]{0,400}data-combat-attack-vector|data-combat-attack-vector[\s\S]{0,400}<svg/);
  assert.match(boardCombatSource, /<(?:path|line)[^>]*data-combat-vector-path/);
  assert.match(
    boardCombatSource,
    /<marker\s+id="seapals-combat-vector-arrowhead"[\s\S]{0,500}<path/,
    "The vector should have a visible arrowhead rather than an ambiguous line",
  );
  assert.match(
    boardCombatSource,
    /markerUnits="userSpaceOnUse"[\s\S]{0,120}markerWidth="20"[\s\S]{0,80}markerHeight="20"/,
    "The arrowhead should stay a compact screen-space size instead of scaling with its stroke width",
  );
  assert.match(boardCombatSource, /markerEnd="url\(#seapals-combat-vector-arrowhead\)"/);
  assert.match(
    boardCombatSource,
    /createAttackVectorGeometry\(\{[\s\S]{0,300}attackerRect:\s*attackerNode\.getBoundingClientRect\(\)[\s\S]{0,200}targetRect:\s*targetNode\.getBoundingClientRect\(\)/,
    "Arrow geometry should be derived from both card rectangles and preserve attacker-to-target direction",
  );
  assert.match(
    simulatorSource,
    /<AttackIntentLayer[\s\S]{0,220}active=\{combatBoardFaceoffActive && !boardStatPresentationActive\}[\s\S]{0,180}windup=\{!combatIntentReady\}/,
    "The relationship layer should stay mounted through the rolling phase, not vanish when the wobble ends",
  );
  assert.match(boardCombatSource, /const phase = windup \? "windup" : "rolling"/);
  const gatedSelectionMarkers = simulatorSource.match(
    /const (?:isTarget|hostedIsTarget|isFoundationTarget|isInvaderTarget) = Boolean\([^;]+\) && boardTargetingPresentationActive;/g,
  ) ?? [];
  assert.ok(
    gatedSelectionMarkers.length >= 8,
    "Once one target is chosen, old legal-target rings should yield to the single attack vector",
  );
});

test("missing or clipped card anchors fail open to the dice instead of trapping combat", () => {
  assert.match(
    boardCombatSource,
    /getAttackIntentWindupDuration\(\{[\s\S]{0,260}anchorsAvailable:\s*Boolean\(measured\.attackerNode\s*&&\s*measured\.targetNode\)/,
    "The pre-roll delay should explicitly detect unavailable exact-instance anchors",
  );
  assert.match(
    boardCombatSource,
    /windupTimerRef\.current = window\.setTimeout\(\(\) => \{[\s\S]{0,260}completeRef\.current\?\.\(presentationKey\)[\s\S]{0,100}\},\s*delay\)/,
    "The same completion callback must run after the short missing-anchor delay",
  );
  assert.match(
    boardCombatSource,
    /window\.clearTimeout\(windupTimerRef\.current\)/,
    "Replacing or leaving a checkpoint must cancel its stale fail-open timer",
  );
  assert.match(
    boardCombatSource,
    /\[data-combat-anchor-ids\][\s\S]{0,500}dataset\.combatAnchorIds[\s\S]{0,120}includes\(instanceId\)/,
    "Canonical aliases should resolve hosted targets whose rules identity differs from their visible proxy",
  );
  assert.match(
    simulatorSource,
    /const hostedCombatAnchorIds = \(entry\.hostedCardIds[\s\S]{0,1400}data-combat-anchor-ids=\{hostedCombatAnchorIds \|\| undefined\}/,
    "A hidden hosted card under a player orphan should use its visible host as the target proxy",
  );
  assert.match(
    boardCombatSource,
    /closest\?\.\("\.seapals-ecosystem-ocean"\)[\s\S]{0,500}visibleLeft[\s\S]{0,300}visibleBottom/,
    "Visibility should respect the owning clipped reef instead of only the full board stack",
  );
});

test("leaving an attack checkpoint clears every pre-roll and dice presentation flag", () => {
  const faceoffLifecycle = sourceSection(
    simulatorSource,
    "const boardFaceoffReady = previewExperience",
    "const presentationKey = getCombatIntentPresentationKey(eventOverlay);",
  );
  assert.match(faceoffLifecycle, /if \(!boardFaceoffReady\)/);
  assert.match(faceoffLifecycle, /faceoffRollCommitRef\.current = false/);
  assert.match(faceoffLifecycle, /setFaceoffIntentReadyKey\(null\)/);
  assert.match(faceoffLifecycle, /setFaceoffLocked\(false\)/);
  assert.match(faceoffLifecycle, /setFaceoffPreview\(null\)/);
  assert.match(faceoffLifecycle, /setFaceoffRolling\(false\)/);
  assert.match(
    simulatorSource,
    /\{attackContext && boardTargetingPresentationActive \? \([\s\S]{0,300}Choose a card marked by a red target reticle/,
    "Target-selection instructions should leave with the target-selection phase",
  );
});

test("wind-up and vector motion honor reduced motion without hiding attack direction", () => {
  const intentMount = sourceSection(
    simulatorSource,
    "<AttackIntentLayer",
    "<AttackTargetLayer",
  );
  assert.match(
    intentMount,
    /reducedMotion=\{accessibilityReducedMotion\}/,
  );
  assert.match(
    boardCombatSource,
    /getAttackIntentWindupDuration\(\{[\s\S]{0,220}reducedMotion:\s*reducedMotion\s*\|\|\s*systemReducedMotion/,
    "Both the app preference and operating-system preference should shorten the wobble",
  );
  assert.match(presentationSource, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(
    presentationSource,
    /prefers-reduced-motion:[\s\S]{0,1200}\[data-combat-attacker-windup="true"\][\s\S]{0,500}\.seapals-combat-attack-vector-path[\s\S]{0,300}animation:\s*none/i,
  );
  assert.doesNotMatch(
    boardCombatSource,
    /reducedMotion\s*\?\s*null\s*:[\s\S]{0,300}data-combat-attack-vector/,
    "Reduced motion should retain the static attacker-to-target relationship",
  );
});

test("the board-context attack intent is noninteractive and announced once", () => {
  assert.match(
    boardCombatSource,
    /data-combat-attack-intent[\s\S]{0,220}aria-hidden="true"/,
  );
  assert.match(
    boardCombatSource,
    /<span className="sr-only" role="status" aria-live="polite" aria-atomic="true">[\s\S]{0,160}\{attackerName\} attacks \{targetName\}/,
    "Assistive technology should hear who is attacking whom",
  );
  assert.match(
    presentationSource,
    /\.seapals-combat-attack-intent\s*\{[\s\S]{0,220}pointer-events:\s*none/,
    "The presentation must not intercept target, dice, or board controls",
  );
  assert.match(presentationSource, /\.seapals-combat-attack-vector\s*\{[\s\S]{0,220}pointer-events:\s*none/);
});
