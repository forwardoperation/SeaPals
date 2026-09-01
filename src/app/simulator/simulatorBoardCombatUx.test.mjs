import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const simulatorUrl = new URL("./Simulator.jsx", import.meta.url);
const simulatorSource = await readFile(simulatorUrl, "utf8");
const simulatorDirectory = new URL("./", import.meta.url);
const boardCombatSource = await readFile(new URL("./BoardCombatPresentation.jsx", import.meta.url), "utf8");
const mobileHandDockSource = await readFile(new URL("./MobileHandDock.jsx", import.meta.url), "utf8");
const presentationFiles = (await readdir(simulatorDirectory))
  .filter((name) => /\.(?:css|jsx|mjs|js)$/.test(name) && !name.endsWith(".test.mjs"));
const presentationSource = (
  await Promise.all(
    presentationFiles.map(async (name) => readFile(new URL(name, simulatorDirectory), "utf8")),
  )
).join("\n");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("V2 attack targeting enters the reef directly without the old pre-attack event page", () => {
  const ordinaryAttack = sourceSection(
    simulatorSource,
    "function attackWithCreature(",
    "function beginOnPlayAttack(",
  );
  const onPlayAttack = sourceSection(
    simulatorSource,
    "function beginOnPlayAttack(",
    "function resolvePlayerAttack(",
  );

  assert.match(ordinaryAttack, /setAttackContext\(createPlayerAttackContext\(/);
  assert.doesNotMatch(ordinaryAttack, /setEventOverlay\(|queueEvents\(/);
  assert.match(onPlayAttack, /setAttackContext\(createPlayerAttackContext\(/);
  const previewGate = onPlayAttack.indexOf("if (!previewExperience)");
  const legacyPrompt = onPlayAttack.indexOf('type: "onplay-target-prompt"');
  assert.ok(
    previewGate >= 0 && legacyPrompt > previewGate,
    "The old On Play target prompt may remain only behind the non-V2 compatibility gate",
  );
  assert.ok(
    onPlayAttack.indexOf("setAttackContext(") < previewGate,
    "V2 should enter targeting before bypassing the legacy prompt",
  );
  assert.doesNotMatch(onPlayAttack.slice(0, previewGate), /targetPromptEvent|onplay-target-prompt/);
});

test("every legal target receives a red inward-arrow reticle that travels from viewport center", () => {
  assert.match(simulatorSource, /data-v2-attack-mode=\{previewExperience\s*&&\s*attackContext/);
  assert.match(presentationSource, /querySelectorAll\([\s\S]{0,240}data-attack-target(?:=|\\\")/);
  assert.match(
    presentationSource,
    /(?:attackTarget|attackReticle)[\s\S]{0,2400}getBoundingClientRect\(\)[\s\S]{0,2400}window\.innerWidth\s*\/\s*2[\s\S]{0,800}window\.innerHeight\s*\/\s*2/i,
    "Reticle geometry should measure legal cards and use the viewport center as the shared origin",
  );

  assert.match(presentationSource, /data-attack-target-layer/);
  assert.match(presentationSource, /data-attack-reticle/);
  assert.match(presentationSource, /data-target-instance=\{[^}]*instanceId/);
  assert.match(presentationSource, /<svg[^>]*seapals-attack-reticle-glyph/);
  assert.match(
    presentationSource,
    /<svg[^>]*seapals-attack-reticle-glyph[\s\S]*?(?:<path|<polyline)[\s\S]*?(?:<path|<polyline)[\s\S]*?(?:<path|<polyline)[\s\S]*?(?:<path|<polyline)/,
    "The reticle should be a code-native four-arrow glyph, rather than the old circular crosshair",
  );
  assert.match(presentationSource, /@keyframes\s+seapalsAttackReticleLand/i);
  assert.match(presentationSource, /@keyframes\s+seapalsAttackReticlePulse/i);
  assert.match(
    presentationSource,
    /\.seapals-attack-reticle-glyph\s*\{[\s\S]*?animation:[^;]*seapalsAttackReticlePulse[^;]*infinite/i,
    "The landed inward-arrow glyph should keep a subtle pulse",
  );
  assert.match(
    presentationSource,
    /\[data-v2-attack-mode="true"\][\s\S]*?(?:border-color|outline|box-shadow):[^;]*(?:#(?:ef4444|f43f5e|fb7185)|rgba\(2(?:20|39),\s*(?:38|68),\s*(?:38|68))/i,
    "The active target/reef border should turn red during targeting",
  );
  assert.doesNotMatch(
    presentationSource,
    /\[data-v2-attack-mode="true"\][^}]*\[data-attack-target="true"\]::after[\s\S]*?border-radius:\s*9999px/,
    "The old circular crosshair must not remain as the targeting affordance",
  );
});

test("target reticles and dice keep reduced-motion behavior accessible", () => {
  assert.match(
    presentationSource,
    /\.seapals-reduced-motion[\s\S]{0,400}seapals-attack-reticle[\s\S]{0,400}seapals-attack-reticle-glyph[\s\S]{0,400}seapals-combat-die[\s\S]{0,200}animation:\s*none/i,
  );
  assert.match(presentationSource, /@media \(prefers-reduced-motion: reduce\)/);
});

test("combat dice are a transparent board-context dialog, not the full-page event presentation", () => {
  assert.match(presentationSource, /data-board-faceoff/);
  assert.match(presentationSource, /data-combat-dice-layer/);
  assert.match(presentationSource, /data-combat-die/);
  assert.match(presentationSource, /data-purpose=\{purpose\}/);
  assert.match(presentationSource, /purpose="attack"/);
  assert.match(presentationSource, /purpose="defense"/);
  assert.match(presentationSource, /data-owner=\{owner\}/);
  assert.match(presentationSource, /owner=\{attackerOwner\}/);
  assert.match(presentationSource, /owner=\{defenderOwner\}/);
  assert.match(presentationSource, /data-stop-combat-roll/);
  assert.match(presentationSource, /aria-label=\{rollControlLabel\}/i);
  assert.match(boardCombatSource, /role="dialog"[\s\S]{0,120}aria-modal="true"[\s\S]{0,120}aria-label="Attack roll off"/);
  assert.match(presentationSource, /aria-live="polite"/);
  assert.match(
    presentationSource,
    /(?:\[data-stop-combat-roll\]|\.seapals-combat-roll-catcher)\s*\{[\s\S]*?(?:position:\s*absolute;[\s\S]*?inset:\s*0|position:\s*fixed;[\s\S]*?inset:\s*0)/,
    "The stop control should cover the active board so one screen tap resolves the roll",
  );

  const combatLayerStart = presentationSource.indexOf("data-combat-dice-layer");
  const combatLayer = presentationSource.slice(
    Math.max(0, combatLayerStart - 1200),
    combatLayerStart + 7000,
  );
  assert.doesNotMatch(combatLayer, /bg-slate-950\/80|backdrop-blur-sm/);
  assert.doesNotMatch(combatLayer, /Start Rolling|Stop & Resolve|Cancel Faceoff/);

  assert.match(
    simulatorSource,
    /\{eventOverlay\s*&&\s*!boardFaceoffActive\s*&&\s*!openingCoinBoardActive\s*\?\s*\(/,
    "V2 faceoffs must be excluded from the generic fixed, aria-modal event overlay",
  );
});

test("the board roll gives the local player a centered attack or defense tap prompt", () => {
  assert.match(
    boardCombatSource,
    /attackerOwner === "player"[\s\S]{0,120}?"attack"[\s\S]{0,160}?defenderOwner === "player"[\s\S]{0,120}?"defend"/,
    "The prompt should describe the local player's role in either direction of combat",
  );
  assert.match(boardCombatSource, /`Tap to \$\{playerRollIntent\}`/);
  assert.match(boardCombatSource, /data-combat-roll-prompt/);
  assert.match(boardCombatSource, /data-roll-intent=\{playerRollIntent\}/);
  assert.match(
    boardCombatSource,
    /data-combat-roll-prompt[\s\S]{0,180}?aria-hidden="true"/,
    "The visual prompt should not duplicate the accessible full-board control",
  );
  assert.match(boardCombatSource, /aria-label=\{rollControlLabel\}/);
  assert.match(boardCombatSource, /\$\{rollPrompt\}\. Stop the dice and resolve the attack\./);

  assert.match(
    presentationSource,
    /\.rollPrompt\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset-block-start:\s*50%;[\s\S]*?inset-inline-start:\s*50%;[\s\S]*?pointer-events:\s*none;[\s\S]*?translate3d\(-50%,\s*-50%,\s*0\)/,
    "The copy should remain centered over the board without intercepting the tap catcher",
  );
  assert.match(presentationSource, /@media \(max-width:\s*640px\)[\s\S]*?\.rollPrompt/);
  assert.match(presentationSource, /\.rollPromptReduced\s*\{[\s\S]*?animation:\s*none;/);
  assert.match(presentationSource, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.rollPrompt[\s\S]*?animation:\s*none;/);
});

test("the board roll dialog focuses after dice exist and isolates reef and hand controls", () => {
  assert.match(
    boardCombatSource,
    /if \(!active \|\| !preview \|\| locked\) return undefined;[\s\S]*?requestAnimationFrame\(\(\) => stopButtonRef\.current\?\.focus\(\{ preventScroll: true \}\)\)/,
    "Focus should move only after the stop control has a visible roll to commit",
  );
  assert.match(
    boardCombatSource,
    /previousFocusRef\.current = document\.activeElement;[\s\S]*?previousFocus\.focus\(\{ preventScroll: true \}\)[\s\S]*?data-simulator-back-control/,
    "Closing the roll dialog should restore the prior control or a stable simulator fallback",
  );
  assert.match(
    boardCombatSource,
    /querySelectorAll\('\[role="dialog"\]\[aria-modal="true"\]'\)[\s\S]*?successorDialog\.querySelector[\s\S]*?focusable\?\.focus/,
    "A successor result or decision dialog should receive focus instead of restoring focus behind it",
  );
  assert.match(
    boardCombatSource,
    /previousFocus !== document\.body[\s\S]*?previousFocus !== document\.documentElement[\s\S]*?!previousFocus\.closest\("\[inert\]"\)/,
    "Focus restoration must reject body, document root, and controls hidden inside inert board regions",
  );

  const inertReefs = simulatorSource.match(
    /id="simulator-(?:opponent|player)-reef"[\s\S]{0,1000}?inert=\{boardInteractionOverlayActive \? true : undefined\}/g,
  ) ?? [];
  assert.equal(inertReefs.length, 2, "Both reef panes must be inert while the roll dialog owns interaction");
  assert.match(
    simulatorSource,
    /interactionDisabled=\{boardInteractionOverlayActive \|\| mobileDrawFlights\.length > 0/,
    "The hand must receive the same isolation signal as the board",
  );
  assert.match(
    mobileHandDockSource,
    /inert=\{interactionDisabled \? true : undefined\}/,
    "The hand isolation signal must become native inert behavior",
  );
});

test("each combat value sits inside the transparent outline for its actual die type", () => {
  assert.match(presentationSource, /data-die-kind=\{[^}]*\}/);
  assert.match(presentationSource, /data-die-outline/);
  assert.match(presentationSource, /<svg[^>]*data-die-outline/);
  assert.match(presentationSource, /<svg[^>]*data-die-outline[\s\S]*?(?:<polygon|<polyline|<path)/);
  assert.match(presentationSource, /(?:fill="none"|fill:\s*none|fill="transparent"|fill:\s*transparent)/);
  assert.match(presentationSource, /(?:stroke=|stroke:)/);
  assert.match(presentationSource, /data-die-value/);
  assert.match(
    presentationSource,
    /D\(\\d\+\)|match\(\/D\(\\d\+\)/i,
    "The visible polyhedron must derive from the printed D4/D6/D8/etc expression",
  );
});

test("both dice cycle automatically until one board tap commits exactly one stopped packet", () => {
  assert.match(
    simulatorSource,
    /(?:setInterval|requestAnimationFrame)\([\s\S]*?(?:rollDie|random)[\s\S]*?(?:attackDice|defenseDice)/,
  );
  assert.match(
    simulatorSource,
    /function\s+(?:stop|commit|resolve)[A-Za-z0-9_$]*(?:Board|Combat)?Faceoff\s*\(/i,
  );
  assert.match(
    simulatorSource,
    /(?:faceoff|combatRoll)[A-Za-z0-9_$]*(?:Commit|Resolved|Resolving)[A-Za-z0-9_$]*Ref/,
    "A ref-backed one-shot guard should prevent a tap/click double commit",
  );
  assert.match(
    simulatorSource,
    /if\s*\([^)]*(?:Commit|Resolved|Resolving)[^)]*\.current[^)]*\)\s*return/i,
  );
  assert.match(
    simulatorSource,
    /(?:resolvePlayerAttack|resumeOpponentAttack|continueOpponentAttack)[\s\S]*?(?:attackRolls|attack)[\s\S]*?(?:defenseRolls|defense)/,
    "The stopped packet must commit both attack and defense, not reroll defense after the tap",
  );
  assert.match(
    presentationSource,
    /attackRolls\s*:[\s\S]{0,240}defenseRolls\s*:/,
    "The committed packet should retain every visible advantage/disadvantage or bonus roll, not just one base value",
  );
});

test("opponent attacks defer for the player's visible defensive roll and resolve from that stopped packet", () => {
  const opponentStep = sourceSection(
    simulatorSource,
    "function runOpponentAttackStep(",
    "function runOpponentAttack(",
  );
  const opponentAttack = sourceSection(
    simulatorSource,
    "function runOpponentAttack(",
    "function buildOpponentAttackEventSequence(",
  );

  const opponentStepEntry = opponentStep.slice(0, 3200);
  assert.match(
    opponentStepEntry,
    /(?:faceoff|stopped|rollPacket|combatRoll)/i,
    "Opponent resolution must accept the same user-stopped roll packet as player attacks",
  );
  const liveStep = sourceSection(
    simulatorSource,
    "function createLiveOpponentAttackStepEvents(",
    "function createLiveOpponentNormalActionEvents(",
  );
  assert.match(liveStep, /type:\s*"opponent-roll-ready"[\s\S]*?combatResume\s*:/);
  assert.match(
    liveStep,
    /attackerOwner:\s*"opponent"[\s\S]*?defenderOwner:\s*"player"/,
  );
  assert.match(
    simulatorSource,
    /boardFaceoffActive[\s\S]{0,500}opponent-roll-ready|opponent-roll-ready[\s\S]{0,500}boardFaceoffActive/,
    "The opponent checkpoint must use the same non-modal board dice layer as a player attack",
  );
  assert.match(liveStep, /resolve:\s*\(stoppedPacket\)\s*=>\s*\{[\s\S]*?runSingleStep\(stoppedPacket, plannedCombat\)/);
  assert.match(
    opponentStep,
    /(?:stopped|rollPacket|combatRoll)[\s\S]*?(?:attackRolls|attack)[\s\S]*?(?:defenseRolls|defense)/i,
  );
});

test("the V2 opponent turn enters the live combat pipeline without precomputing combat", () => {
  const opponentTurn = sourceSection(
    simulatorSource,
    "function resolveOpponentTurn({",
    "function cancelOpeningCoinFlip()",
  );
  assert.match(
    opponentTurn,
    /const playerStateBeforeCombat = stagedPlayerState;[\s\S]*?const opponentOnPlayAttack = previewExperience \|\|/,
    "V2 must preserve the exact state before combat and skip the legacy eager attack",
  );
  assert.match(
    opponentTurn,
    /if \(previewExperience\) \{[\s\S]*?createLiveOpponentTurnCombatEvents\(\{[\s\S]*?playerState: playerStateBeforeCombat,[\s\S]*?onPlayAttack: opponentResult\.onPlayAttack,[\s\S]*?queueEvents\([\s\S]*?return;/,
    "V2 must queue live combat from its pre-combat snapshot and return before the legacy suffix",
  );
});

test("one defensive-roll tap freezes the visible packet and passes it to the live resolver", () => {
  const faceoffCommit = sourceSection(
    simulatorSource,
    "function stopBoardFaceoff()",
    "  return (",
  );

  assert.match(
    faceoffCommit,
    /if \(!boardFaceoffActive \|\| !faceoffPreview \|\| faceoffRollCommitRef\.current\) return;[\s\S]*?faceoffRollCommitRef\.current = true;/,
    "The board tap must be guarded before any delayed resolution is scheduled",
  );
  assert.match(
    faceoffCommit,
    /const readyEvent = eventOverlay;[\s\S]*?const stoppedPacket = \{ \.\.\.faceoffPreview \};[\s\S]*?window\.setTimeout\(\(\) => \{/,
    "The ready checkpoint and exact visible packet must be captured before the lock animation",
  );
  assert.match(
    faceoffCommit,
    /if \(readyEvent\.type === "opponent-roll-ready"\) \{[\s\S]*?readyEvent\.combatResume\?\.resolve\?\.\(stoppedPacket\)[\s\S]*?presentQueuedEvent\(nextEvent \?\? null, remainingEvents, \{ delayForOpponent: false \}\);[\s\S]*?return;/,
    "The delayed callback must resolve the captured event from the visible dice, not a locked result",
  );
  assert.doesNotMatch(
    faceoffCommit.slice(faceoffCommit.indexOf("window.setTimeout")),
    /combatResume\?\.resolve\?\.\(faceoffPreview\)|lockedPacket|present-precomputed/,
    "A render during the lock animation must not swap in another event checkpoint",
  );
});

test("repeated attacks and Regenerate continuations create fresh live checkpoints", () => {
  const liveStep = sourceSection(
    simulatorSource,
    "function createLiveOpponentAttackStepEvents(",
    "function createLiveOpponentNormalActionEvents(",
  );
  const regenerateChoice = sourceSection(
    simulatorSource,
    "function resolvePlayerRegenerateChoice(",
    "function endTurn(",
  );

  assert.match(
    liveStep,
    /const checkpointId = `\$\{checkpointPrefix\}-\$\{\+\+opponentCombatCheckpointIdRef\.current\}`/,
    "Every live combat step must own a unique checkpoint",
  );
  assert.match(
    liveStep,
    /const continuationAfterResolvedStep = resolvedAttack\.nextContinuation[\s\S]*?resolvedStep\.pendingRegenerate\?\.continuation[\s\S]*?if \(continuationAfterResolvedStep && !attackerDiscarded\) \{[\s\S]*?createLiveOpponentAttackStepEvents\(\{[\s\S]*?continuation: continuationAfterResolvedStep/,
    "Each repeat must return to the ready phase instead of resolving unseen dice",
  );
  assert.match(
    liveStep,
    /pendingRegenerate = \{[\s\S]*?liveResume:[\s\S]*?continueAfterResolvedStep\(/,
    "A Regenerate decision must retain the live continuation rather than an eager result",
  );
  assert.match(
    regenerateChoice,
    /const liveCombatResume = previewExperience && typeof pending\.liveResume === "function";[\s\S]*?pending\.liveResume\(\{[\s\S]*?pendingEventsRef\.current = nextEvents;[\s\S]*?setPendingEvents\(nextEvents\);/,
    "Resolving Regenerate must replace both queue representations with the live continuation",
  );
  assert.doesNotMatch(
    liveStep,
    /lockedPacket|present-precomputed|insertOpponentRollCheckpoints/,
    "The live step must never fall back to a precomputed combat packet",
  );
});

test("live repeats retain the paid action while each new opponent action pays once", () => {
  const liveStep = sourceSection(
    simulatorSource,
    "function createLiveOpponentAttackStepEvents(",
    "function createLiveOpponentNormalActionEvents(",
  );
  const projector = sourceSection(
    simulatorSource,
    "function buildOpponentAttackEventSequence(",
    "function preserveOpponentNormalActionsAfterOnPlay(",
  );

  assert.match(
    liveStep,
    /buildOpponentAttackEventSequence\([\s\S]*?\{ actionCostAlreadyPaid: Boolean\(continuation\) \}/,
    "The initial live action must pay, while its continuation is explicitly marked paid",
  );
  assert.match(
    projector,
    /if \(stepIndex === 0 && !actionCostAlreadyPaid\) \{[\s\S]*?rp: Math\.max\(0, nextOpponent\.rp - Number\(attackResult\.actionCost \?\? step\.actionCost \?\? 0\)\)/,
    "Only the first step of a newly selected opponent action may spend its RP cost",
  );
});
