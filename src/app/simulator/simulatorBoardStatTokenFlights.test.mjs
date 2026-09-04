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

test("routine V2 density creature plays stay on the board instead of opening the generic event page", () => {
  const oceanicPlay = sourceSection(
    simulatorSource,
    "function completePlayerOceanicPlay(",
    "function returnFromSupportFlowToBoard(",
  );
  const routineResult = oceanicPlay.slice(oceanicPlay.indexOf("const finalRoundMilestone"));

  assert.match(
    routineResult,
    /previewExperience[\s\S]{0,240}boardStatPresentationStarted[\s\S]{0,360}setEventOverlay\(null\)/,
    "a routine School Density play should keep the V2 reef visible",
  );
  assert.doesNotMatch(
    routineResult.slice(0, routineResult.indexOf("setEventOverlay(null)") + "setEventOverlay(null)".length),
    /CardCategory\.FILTER_FEEDER/,
    "the board-native path must include ordinary density-bearing invertebrates such as Market Squid, not only Filter Feeders",
  );
  assert.ok(
    routineResult.indexOf("finalRoundMilestone") < routineResult.indexOf("setEventOverlay(null)"),
    "authored tutorial milestones should still be handled before routine play feedback is suppressed",
  );
});

test("board stat flights measure the exact placed instance and the owning HUD anchors", () => {
  assert.match(simulatorSource, /data-school-density-target="player"/);
  assert.match(simulatorSource, /data-school-density-target="opponent"/);
  assert.match(simulatorSource, /data-vp-bank-target="player"/);
  assert.match(simulatorSource, /data-vp-bank-target="opponent"/);

  assert.match(
    simulatorSource,
    /querySelector\([^\n]*data-board-owner[^\n]*\$\{[^}]*(?:owner|boardOwner|cardBoardOwner)[^}]*\}[^\n]*data-card-instance-id[^\n]*\$\{[^}]*cardInstanceId[^}]*\}/,
    "flight geometry must resolve the actual card occurrence rather than the first matching card id",
  );
  assert.match(
    simulatorSource,
    /querySelector\([^\n]*data-school-density-target[^\n]*\$\{[^}]*owner[^}]*\}/,
    "School Density flights need the correct owner's indicator as an endpoint",
  );
  assert.match(
    simulatorSource,
    /querySelector\([^\n]*data-vp-bank-target[^\n]*\$\{[^}]*owner[^}]*\}/,
    "Victory Point flights need the correct owner's indicator as an endpoint",
  );

  const layerTag = openingTagContaining(simulatorSource, "data-board-stat-flight-layer");
  assert.match(layerTag, /aria-hidden="true"/);
  assert.match(layerTag, /pointer-events-none/);
  assert.match(simulatorSource, /data-board-stat-flight(?!-layer)/);
  assert.match(simulatorSource, /data-stat-kind=\{flight\.kind\}/);
  assert.match(simulatorSource, /data-flight-from=\{flight\.from\}/);
  assert.match(simulatorSource, /data-flight-to=\{flight\.to\}/);
  assert.match(simulatorSource, /(?:data-card-instance-id|data-flight-card-instance)=\{flight\.cardInstanceId\}/);
});

test("School Density and VP use the requested directional token choreography", () => {
  assert.match(
    simulatorSource,
    /kind:\s*"sd"[\s\S]{0,220}from:\s*"school-density"[\s\S]{0,160}to:\s*"card"/,
    "committing density should distribute an SD token from the HUD to the newly placed creature",
  );
  assert.match(
    simulatorSource,
    /kind:\s*"sd"[\s\S]{0,220}from:\s*"card"[\s\S]{0,160}to:\s*"school-density"/,
    "a Creature School or other density source should send its capacity token into the SD indicator",
  );
  assert.match(
    simulatorSource,
    /kind:\s*"vp"[\s\S]{0,220}from:\s*"card"[\s\S]{0,160}to:\s*"vp"/,
    "printed VP should visibly travel from the played card to the VP indicator",
  );
});

test("stat counters hold their pre-play values until each token lands", () => {
  const playerScore = sourceSection(
    simulatorSource,
    'className="seapals-reef-score seapals-reef-score-player"',
    "ref={ecosystemRef}",
  );
  const opponentScore = sourceSection(
    simulatorSource,
    'className="seapals-reef-score seapals-reef-score-opponent"',
    "ref={opponentEcosystemRef}",
  );

  assert.match(playerScore, /\{presentedPlayerSchoolDensity\.committed\}\s*\/\s*\{presentedPlayerSchoolDensity\.capacity\}/);
  assert.match(opponentScore, /\{presentedOpponentSchoolDensity\.committed\}\s*\/\s*\{presentedOpponentSchoolDensity\.capacity\}/);
  assert.match(playerScore, /<AnimatedVpBadge[\s\S]{0,180}value=\{presentedPlayerVp\}/);
  assert.match(opponentScore, /<AnimatedVpBadge[\s\S]{0,180}value=\{presentedOpponentVp\}/);

  assert.match(
    simulatorSource,
    /(?:finish|complete|land)[A-Za-z]*BoardStat[A-Za-z]*Flight[\s\S]{0,900}setPresented/i,
    "landing a flight should release the matching held counter value",
  );
});

test("board stat motion has a reduced-motion fast path and cannot leave stale flights or timers", () => {
  assert.match(simulatorSource, /prefers-reduced-motion:\s*reduce/);
  assert.match(
    simulatorSource,
    /accessibilityReducedMotion\s*\|\|\s*systemReducedMotion[\s\S]{0,500}setPresented/i,
    "reduced motion should settle held counters immediately",
  );
  assert.match(simulatorSource, /@keyframes\s+seapalsBoardStatFlight/i);
  assert.match(
    simulatorSource,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.seapals-board-stat-flight[\s\S]*?animation(?:-duration)?:/i,
  );
  assert.match(
    simulatorSource,
    /(?:boardStat[^\n]*(?:Timer|Timeout)[^\n]*Ref|clearBoardStat[^\n]*(?:Timer|Timeout))[\s\S]{0,1200}clearTimeout/,
    "flight fallback timers need an explicit cleanup path",
  );
  assert.match(
    simulatorSource,
    /setBoardStatFlights\(\(current\)\s*=>\s*current\.filter/,
    "completed flight tokens should be removed without clearing unrelated in-flight tokens",
  );
});
