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

test("the mobile hand button blinks only until setup has a starting Foundation", () => {
  const mobileDock = sourceBetween(
    'aria-label="Mobile game command dock"',
    '<div className="seapals-hud-panel hidden min-h-0',
  );

  assert.match(
    mobileDock,
    /onClick=\{\(\) => \{ if \(!playingCardId\) setModal\("hand"\); \}\}[\s\S]*?disabled=\{Boolean\(playingCardId\)\}[\s\S]*?\$\{isSetup && !hasCoralInPlay && !playingCardId \? " seapals-setup-playable-card" : ""\}[\s\S]*?>Open Hand/,
  );
});

test("setup hand guidance respects both reduced-motion paths", () => {
  const simulatorStyles = sourceBetween(
    "@keyframes seapalsPlayableCard",
    '<section className="grid h-full',
  );

  assert.match(simulatorStyles, /\.seapals-setup-playable-card \{ animation: seapalsPlayableCard/);
  assert.match(simulatorStyles, /\.seapals-reduced-motion :is\(\.seapals-setup-playable-card/);
  assert.match(
    simulatorStyles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.seapals-setup-playable-card[^}]*animation: none !important/,
  );
});
