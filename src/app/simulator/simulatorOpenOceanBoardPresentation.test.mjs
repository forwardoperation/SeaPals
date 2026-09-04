import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

function openingTagContaining(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert.ok(markerIndex >= 0, `Missing opening-tag marker: ${marker}`);
  const start = source.lastIndexOf("<", markerIndex);
  const end = source.indexOf(">", markerIndex);
  assert.ok(start >= 0 && end > markerIndex, `Could not isolate opening tag for: ${marker}`);
  return source.slice(start, end + 1);
}

function assertTransparentZoneWrapper(tag, label) {
  assert.doesNotMatch(tag, /(?:^|\s)border(?:-|\s|$)/, `${label} must not draw a slot border`);
  assert.doesNotMatch(tag, /(?:^|\s)bg-(?!transparent(?:\s|$))/, `${label} must not draw a panel background`);
  assert.doesNotMatch(tag, /(?:^|\s)(?:p|px|py)-\d/, `${label} must not add slot-like padding`);
  assert.doesNotMatch(tag, /(?:^|\s)shadow(?:-(?!none(?:\s|$))|\s|$)/, `${label} must not draw a panel shadow`);
}

test("routine V2 density placement stays on the board without masking meaningful On Play flows", () => {
  const oceanicPlay = sourceSection(
    simulatorSource,
    "function completePlayerOceanicPlay(",
    "function returnFromSupportFlowToBoard(",
  );

  assert.match(oceanicPlay, /emitPlayerBuild\(card,\s*playCost,\s*"open-water"\)/);
  assert.match(
    oceanicPlay,
    /if \(finalRoundMilestone\)\s*\{[\s\S]*?setEventOverlay\(finalRoundMilestone\)[\s\S]*?else if \([\s\S]*?previewExperience[\s\S]*?boardStatPresentationStarted[\s\S]*?\(card\.onPlay \?\? \[\]\)\.length === 0[\s\S]*?setEventOverlay\(null\)/,
    "Only a routine density result should disappear; tutorial milestones and printed On Play effects remain presentable",
  );
  assert.match(
    oceanicPlay,
    /!beganTerritorialChoice\s*&&\s*!beganOnPlayDamage\s*&&\s*!beganOnPlayAttack\s*&&\s*!beganOnPlaySearch\s*&&\s*!beganOnPlayDraw\s*&&\s*!discardedOpponentDeck\s*&&\s*!blockedOpponentSupports/,
    "The routine-result branch must run only after all interactive and readable On Play paths decline the event",
  );
  assert.ok(
    oceanicPlay.indexOf("beginPlayerOnPlaySearch") < oceanicPlay.lastIndexOf("boardStatPresentationStarted"),
    "On Play search must be offered before the routine density overlay is suppressed",
  );
  assert.ok(
    oceanicPlay.indexOf("beginOnPlayAttack") < oceanicPlay.lastIndexOf("boardStatPresentationStarted"),
    "On Play attacks must be offered before the routine density overlay is suppressed",
  );
});

test("Open Water cards float in transparent player and opponent groups without zone labels", () => {
  const playerWrapper = openingTagContaining(simulatorSource, '<div className="seapals-player-open-water');
  const opponentWrapper = openingTagContaining(simulatorSource, '<div className="seapals-opponent-open-water');
  assertTransparentZoneWrapper(playerWrapper, "Player Open Water wrapper");
  assertTransparentZoneWrapper(opponentWrapper, "Opponent Open Water wrapper");

  const playerLeadIn = sourceSection(
    simulatorSource,
    '<div className="seapals-player-open-water',
    "{playerReefCreatures.map((cardId, index) => {",
  );
  const opponentLeadIn = sourceSection(
    simulatorSource,
    '<div className="seapals-opponent-open-water',
    "{opponent.reefCreatures.map((cardId, index) => {",
  );
  assert.doesNotMatch(playerLeadIn, />\s*Open Water\s*</i);
  assert.doesNotMatch(opponentLeadIn, />\s*Open Water\s*</i);
  assert.match(simulatorSource, /seapals-player-floating-row[^"\n]*inset-x-0[^"\n]*flex-wrap[^"\n]*justify-center/);
  assert.match(simulatorSource, /seapals-opponent-floating-row[^"\n]*inset-x-0[^"\n]*flex-wrap[^"\n]*justify-center/);
  assert.match(simulatorSource, /seapals-opponent-habitats contents/);
  assert.match(simulatorSource, /seapals-opponent-open-water contents/);
});

test("floating Habitat and Open Water art matches each owner's ordinary visible board-card size", () => {
  const opponentHabitats = sourceSection(
    simulatorSource,
    "{opponent.habitats.length ? (",
    "{(opponent.reefCreatures ?? []).length ? (",
  );
  const opponentOpenWater = sourceSection(
    simulatorSource,
    "{(opponent.reefCreatures ?? []).length ? (",
    "{(opponent.orphanCreatures ?? []).length ? (",
  );
  const opponentFoundations = sourceSection(
    simulatorSource,
    "{opponentCorals.length ? opponentCorals.map((coral, coralIndex) => {",
    'id="simulator-player-reef"',
  );
  for (const [label, section] of [
    ["opponent Habitat", opponentHabitats],
    ["opponent Open Water", opponentOpenWater],
    ["opponent foundation", opponentFoundations],
  ]) {
    assert.match(section, /h-\[150px\][^"\n]*w-\[120px\]/, `${label} should render at 120x150`);
  }

  const playerHabitats = sourceSection(
    simulatorSource,
    "{playerHabitats.length ? (",
    "{playerReefCreatures.length ? (",
  );
  const playerOpenWater = sourceSection(
    simulatorSource,
    "{playerReefCreatures.length ? (",
    "{playerOrphanCreatures.length ? (",
  );
  const playerFoundations = sourceSection(
    simulatorSource,
    "{playerCorals.map((coral) => {",
    '<BoardBubbleBursts bursts={bubbleBursts} board="player"',
  );
  for (const [label, section] of [
    ["player Habitat", playerHabitats],
    ["player Open Water", playerOpenWater],
    ["player foundation", playerFoundations],
  ]) {
    assert.match(section, /h-\[220px\][^"\n]*w-\[180px\]/, `${label} should render at 180x220`);
  }
});

test("placing Open Water and Habitat cards briefly flashes the owning ecosystem perimeter", () => {
  const oceanicPlay = sourceSection(
    simulatorSource,
    "function completePlayerOceanicPlay(",
    "function returnFromSupportFlowToBoard(",
  );
  const cardPlay = sourceSection(
    simulatorSource,
    "function playCardFromHand(cardId)",
    "function completeInvasivePlacement",
  );
  const flashController = sourceSection(
    simulatorSource,
    "function flashPlayerEcosystemPerimeter(tone)",
    "function queueBubbleBurstAtClientPoint(",
  );

  assert.match(oceanicPlay, /emitPlayerBuild\(card,\s*playCost,\s*"open-water"\)[\s\S]{0,180}flashPlayerEcosystemPerimeter\("open-water"\)/);
  assert.match(cardPlay, /emitPlayerBuild\(card,\s*playCost,\s*"habitat"\)[\s\S]{0,180}flashPlayerEcosystemPerimeter\("habitat"\)/);
  assert.match(flashController, /tone === "habitat" \? "habitat" : "open-water"/);
  assert.match(flashController, /prefers-reduced-motion:\s*reduce/);
  assert.match(flashController, /accessibilityReducedMotion \|\| systemReducedMotion \? \d+ : 1700/);
  assert.match(flashController, /setEcosystemPerimeterFlash\(\(current\) => current\?\.id === id \? null : current\)/);

  assert.match(
    simulatorSource,
    /data-ecosystem-perimeter-flash=\{ecosystemPerimeterFlash\.tone\}[\s\S]{0,100}aria-hidden="true"/,
  );
  assert.match(simulatorSource, /@keyframes seapalsEcosystemPerimeterFlash/);
  assert.match(simulatorSource, /\.seapals-ecosystem-perimeter-flash\s*\{[^}]*position:\s*absolute[^}]*pointer-events:\s*none[^}]*animation:\s*seapalsEcosystemPerimeterFlash\s+1700ms/s);
  assert.match(simulatorSource, /\.seapals-ecosystem-perimeter-flash\.is-open-water\s*\{[^}]*(?:34,\s*211,\s*238|56,\s*189,\s*248|#(?:22d3ee|38bdf8))/is, "Open Water should flash cyan-blue");
  assert.match(simulatorSource, /\.seapals-ecosystem-perimeter-flash\.is-habitat\s*\{[^}]*(?:255,\s*255,\s*255|#fff(?:fff)?)/is, "Habitats should flash white");
  assert.match(simulatorSource, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.seapals-ecosystem-perimeter-flash[\s\S]*?animation(?:-duration)?:/);
});
