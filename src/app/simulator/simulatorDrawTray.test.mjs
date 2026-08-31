import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const edgeZonesSource = await readFile(new URL("./MobileEdgeZones.jsx", import.meta.url), "utf8");
const drawTraySource = await readFile(new URL("./MobileDrawTray.jsx", import.meta.url), "utf8").catch(() => "");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

function functionSectionContaining(source, requiredPatterns, label) {
  const starts = [...source.matchAll(/(?:^|\n)\s*function\s+[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{/g)];
  const sections = starts.map((match, index) => source.slice(
    match.index,
    starts[index + 1]?.index ?? source.length,
  ));
  const section = sections.find((candidate) => requiredPatterns.every((pattern) => pattern.test(candidate)));
  assert.ok(section, `Missing ${label} function with contracts: ${requiredPatterns.map(String).join(", ")}`);
  return section;
}

test("V2 replaces the blocking turn-draw pages with a tray anchored beside the player's deck", () => {
  assert.match(simulatorSource, /import MobileDrawTray from "\.\/MobileDrawTray";/);
  assert.ok(drawTraySource.length > 0, "the V2 draw affordance should live in a dedicated MobileDrawTray component");

  const playerPane = sourceSection(
    simulatorSource,
    'id="simulator-player-reef"',
    "{mobileHandDockVisible ? <MobileHandDock",
  );
  const drawTrayIndex = playerPane.indexOf("<MobileDrawTray");
  const edgeZonesIndex = playerPane.indexOf("<MobileEdgeZones");
  assert.ok(edgeZonesIndex >= 0 && drawTrayIndex > edgeZonesIndex, "the draw tray should be rendered with the player's anchored pile controls");
  assert.match(playerPane, /<MobileDrawTray[\s\S]*?open=\{mobileDrawTrayOpen[^}]*\}/);
  assert.match(playerPane, /selection=\{turnDrawSelection\}/);
  assert.match(playerPane, /foundationCount=\{foundationDeck\.length\}/);
  assert.match(playerPane, /palsCount=\{palsDeck\.length\}/);
  assert.match(playerPane, /onAdjust=\{adjustTurnDraw\}/);
  assert.match(playerPane, /onConfirm=\{confirmTurnDraw\}/);
  assert.doesNotMatch(playerPane, /onClose=/);

  assert.match(drawTraySource, /data-mobile-draw-tray/);
  assert.match(drawTraySource, /aria-label="Choose cards to draw"/);
  assert.match(drawTraySource, /id="seapals-mobile-draw-tray"/);
  assert.doesNotMatch(drawTraySource, /fixed\s+inset-0|backdrop-blur|aria-modal="true"/, "the anchored tray must not recreate a full-screen modal");
  assert.match(
    simulatorSource,
    /\.seapals-mobile-draw-tray\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?right:\s*calc\(var\(--seapals-edge-card-width\)[^;]*;[\s\S]*?transform-origin:\s*right\s+(?:center|top);/,
  );
  assert.match(simulatorSource, /@keyframes seapalsMobileDrawTrayIn/);

  const fullPageModalFlag = simulatorSource.match(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*Boolean\(modal\s*&&\s*!compactTurnSequence\s*&&\s*\(!previewDrawTrayEnabled\s*\|\|\s*!\["turn-draw",\s*"draw-result"\]\.includes\(modal\)\)\);/,
  );
  assert.ok(fullPageModalFlag, "V2 draw and compact turn presentation states should be excluded from the full-page modal while legacy keeps its dialogs");
  assert.match(simulatorSource, new RegExp(`\\{${fullPageModalFlag?.[1] ?? "fullPageModalOpen"} \\? \\(`));

  // The old interface still relies on these dialogs, so this change must remain V2-only.
  assert.match(simulatorSource, /modal === "turn-draw"[\s\S]*?data-tutorial-target="draw-controls"/);
  assert.match(simulatorSource, /modal === "draw-result"[\s\S]*?data-tutorial-target="continue-actions"/);
  assert.match(simulatorSource, /window\.matchMedia\("\(max-width: 1279px\)"\)/);
  assert.match(simulatorSource, /const previewDrawTrayEnabled = Boolean\(previewExperience && compactDrawViewport\)/);
});

test("the anchored draw tray preserves both personal-deck choices and the existing allocation rules", () => {
  assert.ok(drawTraySource.length > 0, "MobileDrawTray.jsx should provide the V2 draw controls");
  assert.match(drawTraySource, /foundation/);
  assert.match(drawTraySource, /pals/);
  assert.match(drawTraySource, /data-tutorial-target="draw-controls"/);
  assert.match(drawTraySource, /data-tutorial-draw-deck=\{deck\.id\}/);
  assert.match(drawTraySource, /data-tutorial-draw-remove=\{deck\.id\}/);
  assert.match(drawTraySource, /data-tutorial-draw-add=\{deck\.id\}/);
  assert.match(drawTraySource, /onAdjust\(deck\.id,\s*-1\)/);
  assert.match(drawTraySource, /onAdjust\(deck\.id,\s*1\)/);
  assert.match(drawTraySource, /deck\.count/);
  assert.match(drawTraySource, /deck\.selected/);
  assert.match(drawTraySource, /selection\.foundation\s*\+\s*selection\.pals\s*!==\s*selection\.target/);
  assert.match(drawTraySource, /data-tutorial-target="confirm-draw"/);
  assert.match(drawTraySource, /onClick=\{onConfirm\}/);
  assert.match(drawTraySource, /selection\?\.shortfall\s*>\s*0[\s\S]*?role="alert"/);

  const adjustDraw = functionSectionContaining(
    simulatorSource,
    [/setTurnDrawSelection/, /foundationDeck\.length/, /palsDeck\.length/, /current\.target/],
    "shared personal-deck draw allocation",
  );
  assert.match(adjustDraw, /tutorialUsesScriptedScenario/);
  assert.match(adjustDraw, /getScriptedTutorialTurnDraw/);
});

test("the mandatory compact draw step has no dismissible status chrome", () => {
  assert.match(simulatorSource, /const \[mobileDrawTrayOpen, setMobileDrawTrayOpen\] = useState\(false\);/);
  assert.doesNotMatch(
    drawTraySource,
    /<strong>\s*Draw\s+\{selection\.target\}\s*<\/strong>|remainingChoices|Ready to draw|seapals-mobile-draw-tray-status/,
    "the tray should not repeat the mandatory draw count or choices-left status",
  );
  assert.doesNotMatch(drawTraySource, /seapals-mobile-draw-tray-header|aria-describedby=/);
  assert.doesNotMatch(drawTraySource, /aria-label="Close draw tray"|\bonClose\b/);
  assert.doesNotMatch(drawTraySource, /event\.key\s*!==\s*"Escape"|addEventListener\("keydown"/);
  assert.doesNotMatch(simulatorSource, /function\s+closeMobileDrawTray\s*\(/);

  const openDeckControl = functionSectionContaining(
    simulatorSource,
    [/gamePhase === "draw"/, /turnDrawSelection/, /setMobileDrawTrayOpen\(true\)/, /setMobileHudPanel/],
    "player deck control",
  );
  assert.match(simulatorSource, /onOpenDecks=\{[A-Za-z_$][\w$]*\}/);
  assert.match(drawTraySource, /querySelector\([\s\S]*?data-tutorial-draw-add[\s\S]*?firstChoice\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(edgeZonesSource, /onClick=\{onOpenDecks\}/);
  assert.match(edgeZonesSource, /aria-controls="seapals-mobile-draw-tray"/);
  assert.match(edgeZonesSource, /aria-expanded=\{deckExpanded\}/);
  assert.match(openDeckControl, /setModal\("turn-draw"\)/, "opening the deck must restore draw mode after viewing another pile");

  const beginDraw = functionSectionContaining(
    simulatorSource,
    [/setGamePhase\("draw"\)/, /setTurnDrawSelection/, /availableDraws/],
    "round-start draw setup",
  );
  assert.match(beginDraw, /setMobileDrawTrayOpen\(false\)/, "round setup should keep the mandatory draw tray closed until the compact turn sequence finishes");
  assert.match(
    simulatorSource,
    /if \(compactTurnSequence \|\| eventOverlay\) \{[\s\S]*?setMobileDrawTrayOpen\(false\);[\s\S]*?return;/,
    "turn banners and RP collection must finish before the mandatory draw tray can reopen",
  );
  assert.match(openDeckControl, /setMobileHudPanel\(\(current\) => current === "decks" \? null : "decks"\)/);
  assert.match(
    simulatorSource,
    /!modal[\s\S]*?gamePhase === "draw"[\s\S]*?!hasDrawnThisTurn[\s\S]*?turnDrawSelection\?\.target[\s\S]*?setMobileDrawTrayOpen\(true\);[\s\S]*?setModal\("turn-draw"\);/,
    "closing an auxiliary pile must restore the mandatory draw step automatically",
  );
});

test("the mandatory draw confirmation stays visible while only the choices scroll", () => {
  const trayStyles = sourceSection(
    simulatorSource,
    ".seapals-mobile-draw-tray {",
    ".seapals-mobile-draw-tray-body {",
  );
  const bodyStyles = sourceSection(
    simulatorSource,
    ".seapals-mobile-draw-tray-body {",
    ".seapals-mobile-draw-shortfall {",
  );
  const optionStyles = sourceSection(
    simulatorSource,
    ".seapals-mobile-draw-option {",
    ".seapals-mobile-draw-option.is-pals",
  );
  const confirmStyles = sourceSection(
    simulatorSource,
    ".seapals-mobile-draw-confirm {",
    ".seapals-mobile-draw-confirm:disabled {",
  );

  assert.match(trayStyles, /display:\s*flex;/);
  assert.match(trayStyles, /flex-direction:\s*column;/);
  assert.match(trayStyles, /overflow:\s*hidden;/);
  assert.match(trayStyles, /max-height:\s*calc\(100% - var\(--seapals-mobile-draw-tray-top\) - var\(--seapals-mobile-dock-clearance\)/);
  assert.match(bodyStyles, /flex:\s*1\s+1\s+auto;/);
  assert.match(bodyStyles, /min-height:\s*0;/);
  assert.match(bodyStyles, /overflow-y:\s*auto;/);
  assert.match(optionStyles, /min-height:\s*2\.75rem;/);
  assert.match(confirmStyles, /flex:\s*0\s+0\s+auto;/);
  assert.doesNotMatch(confirmStyles, /position:\s*(?:absolute|fixed|sticky)|margin-(?:top|bottom):\s*-/);

  const bodyIndex = drawTraySource.indexOf('className="seapals-mobile-draw-tray-body"');
  const confirmIndex = drawTraySource.indexOf('className="seapals-mobile-draw-confirm"');
  assert.ok(bodyIndex >= 0 && confirmIndex > bodyIndex, "confirmation must remain outside and after the scrolling choice body");
  assert.match(drawTraySource, />\s*Confirm selection\s*</);
});

test("compact draw guidance stays attached only while its visible tray can be used", () => {
  assert.match(
    simulatorSource,
    /const tutorialDrawTrayHelpAnchored = Boolean\([\s\S]*?previewDrawTrayEnabled[\s\S]*?mobileDrawTrayOpen[\s\S]*?!eventOverlay[\s\S]*?tutorialHelpOpen/,
  );
  assert.match(
    simulatorSource,
    /if \(modal === "turn-draw"\) setMobileDrawTrayOpen\(true\);[\s\S]*?else if \(modal === "draw-result"\) \{[\s\S]*?setMobileDrawTrayOpen\(false\);[\s\S]*?setModal\(null\);/,
    "resizing a desktop result state into the compact layout must not leave an invisible blocking modal",
  );
  assert.match(
    simulatorSource,
    /deckExpanded=\{mobileDrawTrayOpen && modal === "turn-draw" && !eventOverlay && !compactTurnSequence\}/,
  );
});

test("confirmed V2 draws animate each real card continuously from the deck rail into the hand", () => {
  assert.match(simulatorSource, /const \[mobileDrawFlights, setMobileDrawFlights\] = useState\(\[\]\);/);

  const confirmDraw = functionSectionContaining(
    simulatorSource,
    [/function confirmTurnDraw/, /drawResult\.cardsToHand/, /setHand/, /setTurnDrawResult/],
    "turn draw confirmation",
  );
  assert.match(confirmDraw, /startMobileDrawFlights\(revealed,\s*hand\.length\)/);
  assert.match(confirmDraw, /setMobileDrawTrayOpen\(false\)/);
  assert.match(confirmDraw, /setModal\(previewDrawTrayEnabled \? null : "draw-result"\)/);
  assert.match(confirmDraw, /setGamePhase\(mobileFlightsStarted \? "draw" : "main"\)/);

  assert.match(simulatorSource, /data-mobile-draw-flight/);
  assert.match(simulatorSource, /mobileDrawFlights\.map\(\(flight\) =>/);
  assert.match(simulatorSource, /src=\{cardsById\[flight\.cardId\]\?\.image\}/);
  assert.match(simulatorSource, /data-draw-source=\{flight\.source\}/);
  assert.match(simulatorSource, /animationDelay:\s*`\$\{flight\.delay\}ms`/);
  assert.match(simulatorSource, /onAnimationEnd=\{\(\) => finishMobileDrawFlight\(flight\.id\)\}/);
  assert.match(simulatorSource, /data-mobile-hand-dock/);
  assert.match(simulatorSource, /interactionDisabled=\{mobileDrawFlights\.length > 0 \|\| Boolean\(compactTurnSequence\) \|\| compactOpponentPlaybackLocked\}/);

  assert.match(
    simulatorSource,
    /@keyframes seapalsDeckToHand[\s\S]*?0%\s*\{[\s\S]*?(?:35|40|45|50)%\s*\{[\s\S]*?100%\s*\{/,
    "the flight should have an arcing middle pose instead of simply fading between two points",
  );
  assert.match(
    simulatorSource,
    /\.seapals-mobile-draw-flight\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?pointer-events:\s*none;[\s\S]*?animation:\s*seapalsDeckToHand/,
  );
  assert.match(
    simulatorSource,
    /\.seapals-reduced-motion \.seapals-mobile-draw-flight\s*\{[\s\S]*?animation:\s*seapalsDrawReduced[^;]*!important;/,
  );
});
