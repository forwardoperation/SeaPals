import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const globalStyles = await readFile(new URL("../../styles/globals.css", import.meta.url), "utf8");

function sourceSection(startMarker, endMarker) {
  const start = simulatorSource.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = simulatorSource.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return simulatorSource.slice(start, end);
}

test("every persistent board HP or HP/SD rail sits above its card artwork", () => {
  const board = sourceSection(
    '<div className="seapals-opponent-habitats contents">',
    "{inspectedCardData ? (",
  );
  const vitalsTags = [...board.matchAll(/<span\b(?=[^>]*data-board-card-vitals="above")[^>]*>/g)]
    .map((match) => match[0]);

  assert.equal(vitalsTags.length, 4, "both owners' Habitat and Foundation cards need external vitals");
  vitalsTags.forEach((tag) => {
    assert.match(tag, /pointer-events-none/, "external vitals must not block card interaction");
    assert.doesNotMatch(tag, /\b(?:top|bottom|m[bt])-[^\s\"]+/, "vertical placement should have one CSS source of truth");
  });

  const placementRule = globalStyles.match(
    /\.seapals-game-shell\s+\[data-board-card-vitals="above"\]\s*\{([^}]*)\}/,
  );
  assert.ok(placementRule, "board vitals need an explicit global placement rule");
  assert.match(placementRule[1], /position:\s*absolute/);
  assert.match(placementRule[1], /top:\s*auto\s*!important/);
  assert.match(placementRule[1], /bottom:\s*calc\(100%\s*\+\s*0\.5rem\)\s*!important/);
  assert.match(placementRule[1], /pointer-events:\s*none/);

  assert.equal((board.match(/<FoundationVitals\b/g) ?? []).length, 2);
  assert.match(board, /FoundationVitals foundation=\{coral\} densityBucket=\{densityBucket\} owner="opponent" compact/);
  assert.match(board, /FoundationVitals foundation=\{coral\} densityBucket=\{densityBucket\} compact/);
  assert.equal((board.match(/habitatInstance\.currentHealth\}\/\{habitatInstance\.maxHealth\} HP/g) ?? []).length, 2);
});

test("health-bearing cards place hover names below, away from their vitals rail", () => {
  assert.match(
    simulatorSource,
    /function InPlayHoverLabel\(\{ card, zoom = 1, placement = "above" \}\)/,
  );
  assert.match(
    simulatorSource,
    /placement === "below" \? " seapals-in-play-hover-label--below" : ""/,
  );
  assert.equal(
    (simulatorSource.match(/<InPlayHoverLabel\b[^>]*placement="below"/g) ?? []).length,
    4,
    "the two Habitat and two Foundation render paths should avoid the above-card rail",
  );
});

test("Fit reserves space for external foundation and Habitat vitals", () => {
  const fit = sourceSection("function zoomEcosystemToFit(owner)", "function canUseSlotWithCard");

  assert.match(simulatorSource, /const BOARD_FOUNDATION_VITALS_CLEARANCE = 60/);
  assert.match(
    fit,
    /minY: centerY - coralHeight \/ 2 - BOARD_FOUNDATION_VITALS_CLEARANCE/,
  );
  assert.match(fit, /const floatingTopClearance = isOpponent[\s\S]*?opponent\.habitats\.length \? 40 : 16[\s\S]*?playerHabitats\.length \? 48 : 24/);
  assert.match(fit, /const floatingTopRowHeight = floatingTopClearance \+ floatingRowCount \* floatingCardHeight/);
  assert.match(simulatorSource, /opponent\.habitats\.length \? "top-10" : "top-4"/);
  assert.match(simulatorSource, /playerHabitats\.length \? "top-12" : "top-6"/);
});

test("the card inspector keeps its vitals in normal document flow", () => {
  const inspector = sourceSection("{inspectedFoundation ? (", "{inspectedCard.owner === \"player\"");
  assert.match(inspector, /<div className="mt-4">\s*<FoundationVitals/);
  assert.doesNotMatch(inspector, /data-board-card-vitals/);
});
