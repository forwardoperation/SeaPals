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

  const mobileHudPanelMarkup = sourceBetween(
    simulatorSource,
    "{mobileHudPanel ? (",
    '{!previewExperience ? <div className="seapals-mobile-dock',
  );
  assert.match(mobileHudPanelMarkup, /className="seapals-mobile-hud-panel absolute/);
  assert.doesNotMatch(
    mobileHudPanelMarkup,
    /className="seapals-mobile-hud-panel[^"]*\bxl:hidden\b/,
    "desktop edge-zone controls must be able to reveal their shared HUD panel",
  );
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

test("desktop V2 chrome fluidly approaches the comfortable 175 percent zoom scale", () => {
  const desktopScaleStyles = sourceBetween(
    simulatorSource,
    "        @media (min-width: 1280px) {",
    "        @media (max-width: 767px) {",
  );

  assert.match(
    desktopScaleStyles,
    /\.seapals-game-shell\.seapals-simulator-preview\s*\{[\s\S]*?--seapals-desktop-control-size:\s*clamp\(2\.75rem, 6\.875dvh, 4\.8125rem\);[\s\S]*?--seapals-desktop-edge-gap:\s*clamp\(\.25rem, \.625dvh, \.4375rem\);[\s\S]*?--seapals-desktop-header-inset:\s*clamp\(\.75rem, 1\.875dvh, 1\.3125rem\);/,
    "desktop controls should scale from their 100 percent size to an exact 175 percent cap",
  );
  assert.match(
    desktopScaleStyles,
    /--seapals-desktop-score-height:\s*clamp\(2\.7rem, 6\.75dvh, 4\.725rem\);[\s\S]*?--seapals-desktop-score-inset:\s*clamp\(\.45rem, 1\.125dvh, \.7875rem\);[\s\S]*?--seapals-desktop-score-width:\s*clamp\(2\.35rem, 5\.875dvh, 4\.1125rem\);/,
    "the score rail should use the same 1x-to-1.75x height-driven scale",
  );
  assert.match(
    desktopScaleStyles,
    /--seapals-desktop-hand-card-min:\s*clamp\(5\.15rem, 12\.875dvh, 9\.0125rem\);[\s\S]*?--seapals-desktop-hand-card-max:\s*clamp\(7\.25rem, 18\.125dvh, 12\.6875rem\);[\s\S]*?--seapals-edge-card-width:\s*var\(--seapals-desktop-control-size\);[\s\S]*?--seapals-mobile-hand-height:\s*min\(19\.25rem, max\(17dvh, clamp\(7\.5rem, 18\.75dvh, 13\.125rem\)\)\);[\s\S]*?--seapals-mobile-hand-bottom:\s*clamp\(\.2rem, \.5dvh, \.35rem\);[\s\S]*?--seapals-mobile-dock-clearance:\s*calc\(var\(--seapals-mobile-hand-height\) \+ var\(--seapals-mobile-hand-bottom\)\);/,
    "the dock and hand should fluidly enlarge without exceeding their zoom-equivalent caps",
  );

  assert.match(
    desktopScaleStyles,
    /\.seapals-simulator-preview \.seapals-back-control,[\s\S]*?\.seapals-simulator-preview \.seapals-menu-control > summary\s*\{[\s\S]*?width:\s*var\(--seapals-desktop-control-size\);[\s\S]*?height:\s*var\(--seapals-desktop-control-size\);[\s\S]*?min-height:\s*var\(--seapals-desktop-control-size\);/,
  );
  assert.match(
    desktopScaleStyles,
    /\.seapals-simulator-preview \.seapals-board-camera-controls > button\s*\{[\s\S]*?width:\s*var\(--seapals-desktop-control-size\);[\s\S]*?height:\s*var\(--seapals-desktop-control-size\);[\s\S]*?min-height:\s*var\(--seapals-desktop-control-size\);/,
  );
  assert.match(
    desktopScaleStyles,
    /\.seapals-simulator-preview \.seapals-board-camera-controls > button:not\(:nth-child\(2\)\)\s*\{[\s\S]*?font-size:\s*clamp\(1\.25rem, 3\.125dvh, 2\.1875rem\);/,
  );
  assert.match(
    desktopScaleStyles,
    /\.seapals-simulator-preview \.seapals-board-camera-controls > button:nth-child\(2\)\s*\{[\s\S]*?font-size:\s*clamp\(\.5625rem, 1\.40625dvh, \.984375rem\);/,
  );

  assert.match(
    desktopScaleStyles,
    /\.seapals-simulator-preview \.seapals-mobile-edge-zones\s*\{[\s\S]*?right:\s*var\(--seapals-desktop-edge-gap\);[\s\S]*?gap:\s*var\(--seapals-desktop-edge-gap\);/,
    "the edge rail should stay aligned to its fluid inset",
  );
  assert.match(
    desktopScaleStyles,
    /\.seapals-simulator-preview \.seapals-mobile-edge-zones\.is-player\s*\{[\s\S]*?top:\s*calc\(var\(--seapals-desktop-score-inset\) \+ var\(--seapals-desktop-score-height\) \+ var\(--seapals-desktop-edge-gap\)\);/,
  );
  assert.match(
    desktopScaleStyles,
    /\.seapals-simulator-preview \.seapals-mobile-edge-zones\.is-opponent\s*\{[\s\S]*?bottom:\s*calc\(var\(--seapals-desktop-score-inset\) \+ var\(--seapals-desktop-score-height\) \+ var\(--seapals-desktop-edge-gap\)\);/,
  );
  assert.match(
    desktopScaleStyles,
    /\.seapals-simulator-preview \.seapals-reef-score\s*\{[\s\S]*?right:\s*var\(--seapals-desktop-score-inset\);[\s\S]*?gap:\s*var\(--seapals-desktop-edge-gap\);/,
  );
  assert.match(
    desktopScaleStyles,
    /\.seapals-simulator-preview \.seapals-reef-score-card\s*\{[\s\S]*?width:\s*var\(--seapals-desktop-score-width\);[\s\S]*?height:\s*var\(--seapals-desktop-score-height\);/,
    "score-card width and inset preserve the same center line as the edge rail",
  );
  assert.match(
    desktopScaleStyles,
    /\.seapals-simulator-preview \.seapals-mobile-draw-tray\s*\{[\s\S]*?--seapals-mobile-draw-tray-top:\s*calc\(var\(--seapals-desktop-score-inset\) \+ var\(--seapals-desktop-score-height\) \+ var\(--seapals-desktop-edge-gap\)\);[\s\S]*?right:\s*calc\(var\(--seapals-edge-card-width\) \+ clamp\(\.65rem, 1\.625dvh, 1\.1375rem\)\);/,
    "the draw tray should clear both the score row and the fluid edge rail",
  );

  assert.match(
    desktopScaleStyles,
    /\.seapals-simulator-preview \.seapals-mobile-hand-dock\s*\{[\s\S]*?right:\s*var\(--seapals-desktop-header-inset\);[\s\S]*?bottom:\s*var\(--seapals-mobile-hand-bottom\);[\s\S]*?left:\s*var\(--seapals-desktop-header-inset\);/,
  );
  assert.match(
    desktopScaleStyles,
    /\.seapals-simulator-preview \.seapals-mobile-hud-panel\s*\{\s*bottom:\s*var\(--seapals-mobile-dock-clearance\);/,
    "desktop deck and zone panels should stay attached to the fluid hand dock",
  );
  assert.match(
    desktopScaleStyles,
    /\.seapals-simulator-preview \.seapals-mobile-hand-list\s*\{[\s\S]*?padding-top:\s*clamp\(\.2rem, \.5dvh, \.35rem\);[\s\S]*?padding-right:\s*clamp\(5\.75rem, 14\.375dvh, 10\.0625rem\);[\s\S]*?padding-left:\s*clamp\(3\.75rem, 9\.375dvh, 6\.5625rem\);/,
    "the hand should retain fluid clear gutters around the camera and pile controls",
  );
  assert.match(
    desktopScaleStyles,
    /\.seapals-simulator-preview \.seapals-mobile-hand-card\s*\{[\s\S]*?width:\s*clamp\(var\(--seapals-desktop-hand-card-min\), min\(6vw, 11\.5dvh\), var\(--seapals-desktop-hand-card-max\)\);[\s\S]*?height:\s*auto;[\s\S]*?aspect-ratio:\s*63 \/ 88;[\s\S]*?transform:\s*translateY\(clamp\(\.5rem, 1\.25dvh, \.875rem\)\) rotate\(-1deg\);/,
  );
  assert.match(
    desktopScaleStyles,
    /\.seapals-simulator-preview \.seapals-mobile-hand-card\.is-selected,[\s\S]*?transform:\s*translateY\(0\) rotate\(0deg\) scale\(1\.02\);/,
    "desktop sizing must preserve the selected-card lift",
  );
  assert.match(
    desktopScaleStyles,
    /\.seapals-simulator-preview \.seapals-mobile-hand-card\.is-dragging,[\s\S]*?transform:\s*translateY\(clamp\(\.35rem, \.875dvh, \.6125rem\)\) rotate\(0deg\) scale\(\.94\);/,
    "desktop sizing must preserve visible drag feedback",
  );
  assert.match(
    desktopScaleStyles,
    /\.seapals-simulator-preview \.seapals-player-orphans\s*\{\s*right:\s*clamp\(8\.75rem, 21\.875dvh, 15\.3125rem\);/,
  );

  const desktopScaleHelper = sourceBetween(
    simulatorSource,
    "export function getSimulatorDesktopUiScale",
    "function createTutorialHistoryGuardState",
  );
  assert.match(desktopScaleHelper, /viewportWidth < 1280\) return 1;/);
  assert.match(desktopScaleHelper, /Math\.min\(1\.75, Math\.max\(1, safeHeight \/ 640\)\)/);

  const startDrawFlights = sourceBetween(
    simulatorSource,
    "  function startMobileDrawFlights(revealed, baseHandLength, {",
    "  function confirmTurnDraw()",
  );
  assert.match(startDrawFlights, /const uiScale = getSimulatorDesktopUiScale\(viewportWidth, viewportHeight\);/);
  assert.match(
    startDrawFlights,
    /const flightWidth = Math\.min\(84 \* uiScale, Math\.max\(64 \* uiScale, viewportWidth \* 0\.2\)\);/,
    "deal flights should grow with the same desktop UI scale as the receiving hand",
  );
  assert.match(startDrawFlights, /handRect\.left \+ 12 \* uiScale/);
  assert.match(startDrawFlights, /flightWidth - 18 \* uiScale/);
  assert.match(startDrawFlights, /Math\.min\(20 \* uiScale, handRect\.height \* 0\.12\)/);
});

test("short desktop reef panes reflow their pile rail instead of clipping it", () => {
  assert.match(
    simulatorSource,
    /\.seapals-simulator-preview \.seapals-board-pane\s*\{[^}]*container-type:\s*size;[^}]*container-name:\s*seapals-reef-pane;/,
  );

  const shortPaneStyles = sourceBetween(
    simulatorSource,
    "@container seapals-reef-pane (max-height: 31.25rem)",
    "        @media (max-width: 767px) {",
  );

  assert.match(
    shortPaneStyles,
    /\.seapals-simulator-preview \.seapals-mobile-edge-zones,[\s\S]*?\.is-opponent\s*\{[^}]*width:\s*max-content;[^}]*flex-direction:\s*row-reverse;/,
    "all three zones should stay available in a short opponent or player reef",
  );
  assert.match(
    shortPaneStyles,
    /right:\s*calc\([\s\S]*?var\(--seapals-edge-card-width\)[\s\S]*?var\(--seapals-edge-card-width\)[\s\S]*?var\(--seapals-edge-card-width\)[\s\S]*?var\(--seapals-desktop-edge-gap\)[\s\S]*?var\(--seapals-desktop-edge-gap\)[\s\S]*?clamp\(\.65rem, 1\.625dvh, 1\.1375rem\)[\s\S]*?\);/,
    "the draw tray should move left of the complete horizontal pile row",
  );
  assert.match(
    shortPaneStyles,
    /max-height:\s*calc\(100% - var\(--seapals-mobile-draw-tray-top\) - \.2rem\);/,
    "the mandatory draw tray may overlay the dock when the adjusted player reef is unusually short",
  );
});

test("the fluid desktop scale tier leaves phone hand and dock geometry unchanged", () => {
  const phoneStyles = sourceBetween(
    simulatorSource,
    "        @media (max-width: 767px) {",
    "        @media (max-width: 767px) and (max-height: 500px) {",
  );
  const shortPhoneStyles = sourceBetween(
    simulatorSource,
    "        @media (max-width: 767px) and (max-height: 650px) {",
    "      `}</style>",
  );

  assert.match(simulatorSource, /--seapals-edge-card-width:\s*2\.75rem;/);
  assert.match(simulatorSource, /--seapals-mobile-hand-height:\s*clamp\(7\.5rem, 17dvh, 11rem\);/);
  assert.match(
    phoneStyles,
    /\.seapals-game-shell\.seapals-simulator-preview\s*\{[\s\S]*?--seapals-mobile-hand-height:\s*9rem;[\s\S]*?--seapals-mobile-hand-bottom:\s*\.2rem;[\s\S]*?--seapals-mobile-dock-clearance:\s*calc\(var\(--seapals-mobile-hand-height\) \+ var\(--seapals-mobile-hand-bottom\)\);/,
  );
  assert.match(phoneStyles, /\.seapals-mobile-hand-dock\s*\{\s*height:\s*var\(--seapals-mobile-hand-height\);/);
  assert.match(phoneStyles, /\.seapals-mobile-hand-card\s*\{[\s\S]*?width:\s*6\.25rem;[\s\S]*?height:\s*8\.85rem;/);
  assert.match(
    shortPhoneStyles,
    /\.seapals-game-shell\.seapals-simulator-preview\s*\{[\s\S]*?--seapals-mobile-hand-height:\s*7\.25rem;[\s\S]*?--seapals-mobile-hand-bottom:\s*\.1rem;[\s\S]*?--seapals-mobile-dock-clearance:\s*calc\(var\(--seapals-mobile-hand-height\) \+ var\(--seapals-mobile-hand-bottom\)\);/,
  );
  assert.match(shortPhoneStyles, /\.seapals-mobile-hand-card\s*\{[\s\S]*?width:\s*5rem;[\s\S]*?height:\s*7\.1rem;/);
});
