import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const handDockSource = await readFile(new URL("./MobileHandDock.jsx", import.meta.url), "utf8");
const handPopoverSource = await readFile(new URL("./MobileHandCardPopover.jsx", import.meta.url), "utf8");
const edgeZonesSource = await readFile(new URL("./MobileEdgeZones.jsx", import.meta.url), "utf8");
const openingCoinStyles = await readFile(new URL("./OpeningCoinBoardPresentation.module.css", import.meta.url), "utf8");
const actionProxyStyles = await readFile(new URL("./CardActionProxyOverlay.module.css", import.meta.url), "utf8");

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("V2 hand, popover, edge zones, and draw flights remain enabled at desktop widths", () => {
  for (const [label, source] of [
    ["hand dock", handDockSource],
    ["hand-card popover", handPopoverSource],
    ["edge zones", edgeZonesSource],
  ]) {
    assert.doesNotMatch(source, /\bxl:hidden\b/, `${label} must not disappear at Tailwind's desktop breakpoint`);
  }

  assert.doesNotMatch(
    simulatorSource,
    /window\.matchMedia\("\(max-width:\s*1279px\)"\)/,
    "V2 behavior must not switch back to legacy when the viewport reaches 1280px",
  );
  assert.match(
    simulatorSource,
    /if \(!previewExperience\) return undefined;\s*compactDrawViewportRef\.current = true;\s*setCompactDrawViewport\(true\)/,
  );
  assert.match(simulatorSource, /const previewDrawTrayEnabled = Boolean\(previewExperience && compactDrawViewport\)/);
  assert.doesNotMatch(
    simulatorSource,
    /@media \(min-width:\s*1280px\)\s*\{[\s\S]*?\.seapals-mobile-draw-tray,[\s\S]*?\.seapals-mobile-draw-flight[\s\S]*?display:\s*none\s*!important/,
  );
  assert.match(simulatorSource, /\{previewDrawTrayEnabled \? \([\s\S]*?<MobileDrawTray/);
  assert.match(simulatorSource, /\{mobileHandDockVisible \? <MobileHandDock/);
});

test("the stacked V2 reef shell and divider apply beyond the old mobile breakpoint", () => {
  const unifiedV2Styles = sourceBetween(
    simulatorSource,
    "@media (min-width: 0px)",
    "@media (max-height: 650px)",
  );

  assert.match(unifiedV2Styles, /\.seapals-mobile-edge-zones\s*\{\s*display:\s*flex;/);
  assert.match(
    unifiedV2Styles,
    /\.seapals-simulator-preview \.seapals-simulator-header\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?pointer-events:\s*none;/,
  );
  assert.match(
    unifiedV2Styles,
    /\.seapals-simulator-preview \.seapals-board-stack\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/,
  );
  assert.match(
    unifiedV2Styles,
    /\.seapals-simulator-preview \.seapals-board-pane\[data-board-owner="opponent"\]\s*\{[\s\S]*?calc\(var\(--seapals-mobile-reef-split\) - 1\.375rem\);[\s\S]*?height:\s*auto;/,
  );
  assert.match(
    unifiedV2Styles,
    /\.seapals-simulator-preview \.seapals-board-pane\[data-board-owner="player"\]\s*\{[\s\S]*?flex:\s*1 1 0;[\s\S]*?height:\s*auto;/,
  );
  assert.match(
    unifiedV2Styles,
    /\.seapals-reef-divider\s*\{[\s\S]*?display:\s*block;[\s\S]*?flex:\s*0 0 2\.75rem;/,
  );
  assert.match(
    unifiedV2Styles,
    /\.seapals-simulator-preview \.seapals-card-drawer\s*\{[\s\S]*?inset:\s*0;[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;/,
    "desktop card inspection should use the same full-viewport reader",
  );

  assert.doesNotMatch(
    simulatorSource,
    /@media \(min-width:\s*1280px\)\s*\{[\s\S]*?\.seapals-combat-dice-zone\.is-opponent\s*\{\s*flex-basis:\s*45%/,
    "desktop dice must track the live V2 divider instead of reverting to the old 45/55 split",
  );
  assert.match(simulatorSource, /\.seapals-combat-dice-zone\.is-opponent\s*\{\s*flex:\s*0 0 calc\(var\(--seapals-mobile-reef-split\) - 1\.375rem\);/);
  assert.match(
    simulatorSource,
    /--seapals-mobile-hand-height:\s*clamp\(7\.5rem, 17dvh, 11rem\)/,
    "the desktop dock should grow with the viewport without taking over either reef",
  );
  assert.match(
    simulatorSource,
    /@media \(min-width:\s*768px\)[\s\S]*?\.seapals-simulator-preview \.seapals-mobile-hand-card\s*\{[\s\S]*?width:\s*clamp\(5\.15rem, min\(6vw, 11\.5dvh\), 7\.25rem\);[\s\S]*?aspect-ratio:\s*63 \/ 88;/,
    "desktop hand cards should scale up while remaining bounded by the available height",
  );
});

test("desktop-only legacy rails and fixed 45/55 classes cannot leak into V2", () => {
  assert.match(
    simulatorSource,
    /<section className=\{`grid h-full min-h-0 gap-3\$\{previewExperience \? "" : " xl:grid-cols-\[minmax\(0,1fr\)_20rem\] xl:grid-rows-\[minmax\(0,1fr\)_9rem_auto\]"\}`\}/,
  );
  assert.match(
    simulatorSource,
    /id="simulator-opponent-reef" className=\{`seapals-board-pane \$\{previewExperience \? "block" : `\$\{mobileBoardView === "opponent"[\s\S]*?xl:h-\[45%\]`\}/,
  );
  assert.match(
    simulatorSource,
    /id="simulator-player-reef" className=\{`seapals-board-pane \$\{previewExperience \? "block" : `\$\{mobileBoardView === "player"[\s\S]*?xl:h-\[55%\]`\}/,
  );

  assert.match(
    simulatorSource,
    /\{!previewExperience \? \(\s*<div className="seapals-hud-panel hidden min-h-0 overflow-y-auto[\s\S]*?xl:flex xl:flex-col">/,
    "V2 should suppress the legacy wide score/hand rail",
  );
  assert.match(
    simulatorSource,
    /\{!previewExperience \? \(\s*<div className=\{`seapals-hud-panel hidden rounded-2xl[\s\S]*?xl:flex[\s\S]*?data-tutorial-target="event-feed">/,
    "V2 should suppress the legacy desktop event feed",
  );
  assert.match(
    simulatorSource,
    /\{!previewExperience \? \(\s*<>\s*<button type="button" aria-label="Close hand card details"[\s\S]*?<aside className="seapals-hud-panel fixed right-\[21\.5rem\]/,
    "V2 should suppress the legacy desktop hand-card detail surfaces",
  );
  assert.match(
    simulatorSource,
    /\{!previewExperience \? \(\s*<div className="hidden xl:col-start-2 xl:row-start-3 xl:block">[\s\S]*?onClick=\{endTurn\}/,
    "V2 should suppress the duplicate legacy desktop turn button",
  );
});

test("V2 overlays use the adjustable reef split on desktop too", () => {
  for (const [label, source] of [
    ["opening/card coin", openingCoinStyles],
    ["card action proxy", actionProxyStyles],
  ]) {
    assert.match(source, /@media \(min-width:\s*0px\)/, `${label} layout should be width-independent`);
    assert.doesNotMatch(source, /@media \(max-width:\s*1279px\)/);
  }
  assert.match(
    openingCoinStyles,
    /\.playerZone\s*\{[\s\S]*?inset-block-start:\s*calc\(var\(--seapals-mobile-reef-split, 50%\) \+ 1\.375rem\);/,
  );
});
