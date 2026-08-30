import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const handDockSource = await readFile(new URL("./MobileHandDock.jsx", import.meta.url), "utf8");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("mobile tutorial copy scrolls independently from persistent tour actions", () => {
  const guideCard = sourceSection(
    simulatorSource,
    "function ProfessorGuideCard(",
    "const TUTORIAL_POINTER_TARGETS",
  );
  const mobileStyles = sourceSection(
    simulatorSource,
    "@media (max-width: 767px)",
    "`}</style>",
  );

  assert.match(
    guideCard,
    /className="seapals-professor-card-scroll"[\s\S]*?<\/div>\s*\{onRevealTarget \? \([\s\S]*?\{onAdvance \? \(\s*<div className="seapals-professor-actions/,
  );
  assert.match(
    guideCard,
    /<div key=\{speechKey\} className="seapals-professor-card-scroll">/,
  );
  assert.match(guideCard, /seapals-professor-actions[\s\S]*?min-h-11[\s\S]*?onClick=\{onAdvance\}/);
  assert.match(guideCard, /onClick=\{onRevealTarget\}[\s\S]*?min-h-11[\s\S]*?\{revealTargetLabel\}[\s\S]*?&darr;/);
  assert.match(simulatorSource, /\.seapals-professor-card-scroll\s*\{[\s\S]*?overflow-y:\s*auto;/);
  assert.match(simulatorSource, /\.seapals-professor-actions\s*\{[\s\S]*?flex:\s*0 0 auto;/);
  assert.match(mobileStyles, /\.seapals-professor-card\s*\{[\s\S]*?max-height:\s*min\(34dvh, 15rem\);/);
  assert.match(
    simulatorSource,
    /@media \(max-width: 767px\) and \(max-height: 500px\)[\s\S]*?max-height:\s*min\(calc\(100dvh - var\(--seapals-mobile-dock-clearance\) - 1rem - env\(safe-area-inset-bottom\)\), 15rem\);/,
  );
});

test("desktop board-tour progress and Skip Tour keep separate header space", () => {
  const guideCard = sourceSection(
    simulatorSource,
    "function ProfessorGuideCard(",
    "const TUTORIAL_POINTER_TARGETS",
  );
  const headerStyles = sourceSection(
    simulatorSource,
    ".seapals-professor-card-header {",
    ".seapals-professor-card-content {",
  );
  const dismissStyles = sourceSection(
    simulatorSource,
    ".seapals-professor-hide {",
    ".seapals-professor-hide:hover,",
  );

  assert.match(
    guideCard,
    /<div className="seapals-professor-card-header">[\s\S]*?\{onDismiss \? \([\s\S]*?className="seapals-professor-hide"[\s\S]*?\) : null\}\s*<\/div>\s*<div className="seapals-professor-card-content/,
  );
  assert.match(
    guideCard,
    /className="shrink-0 whitespace-nowrap rounded-full[\s\S]*?help\.progressLabel/,
  );
  assert.doesNotMatch(headerStyles, /padding-right/);
  assert.match(dismissStyles, /position:\s*static;/);
  assert.match(dismissStyles, /flex:\s*0 0 auto;/);
  assert.match(dismissStyles, /white-space:\s*nowrap;/);
  assert.match(
    guideCard,
    /seapals-professor-dismiss-label-mobile[\s\S]*?dismissLabel === "Skip tour" \? "Skip" : dismissLabel/,
  );
});

test("mobile guidance keeps one target arrow while the full setup coach is anchored", () => {
  assert.match(simulatorSource, /tutorialHelpFloating \? " seapals-tutorial-help-floating"/);
  assert.match(simulatorSource, /tutorialHelpInline \? " seapals-tutorial-help-inline"/);
  assert.match(
    simulatorSource,
    /@media \(max-width: 767px\)[\s\S]*?\.seapals-tutorial-help-floating \.seapals-target-beacon,\s*\.seapals-tutorial-help-inline \.seapals-target-beacon \{[\s\S]*?z-index:\s*161;[\s\S]*?width:\s*0;[\s\S]*?height:\s*0;[\s\S]*?background:\s*transparent;/,
  );
  assert.match(
    simulatorSource,
    /\.seapals-tutorial-help-floating \.seapals-target-beacon-copy,[\s\S]*?\.seapals-tutorial-help-inline \.seapals-target-beacon-copy \{ display: none; \}/,
  );
  assert.match(simulatorSource, /className="seapals-target-beacon-arrow"/);
  assert.match(
    simulatorSource,
    /active=\{tutorialTargetBeaconOpen && !tutorialBoardTourOpen && !tutorialSetupHelpAnchored\}/,
  );
});

test("the guided hand keeps new copy at the top and offers a direct jump to its target", () => {
  const targetFinder = sourceSection(
    simulatorSource,
    "function getVisibleTutorialTargets(",
    "function ProfessorTargetBeacon(",
  );
  const targetScrollEffect = sourceSection(
    simulatorSource,
    "if (modal !== \"hand\" || !tutorialHelpInline) return undefined;",
    "if (!tutorialBoardTourOpen) return;",
  );
  const handModal = sourceSection(
    simulatorSource,
    "{modal ? (",
    "</main>",
  );

  assert.match(targetFinder, /includeOffscreen = false/);
  assert.match(targetFinder, /help\.target === "hand" && help\.targetCardId/);
  assert.match(targetFinder, /function scrollTutorialTargetWithinContainer/);
  assert.match(targetScrollEffect, /modalScrollRef\.current\?\.scrollTo\(\{[\s\S]*?top:\s*0,[\s\S]*?getTutorialScrollBehavior\(accessibilityReducedMotion\)/);
  assert.match(targetScrollEffect, /const targetCardId = tutorialHelp\.target === "hand" \? tutorialHelp\.targetCardId : null/);
  assert.match(targetScrollEffect, /target\.closest\("\[data-simulator-hand-card-rail\]"\)[\s\S]*?scrollTutorialTargetWithinContainer/);
  assert.match(simulatorSource, /findTutorialTarget\(tutorialHelp, \{ includeOffscreen: true \}\)[\s\S]*?scrollIntoView\(\{[\s\S]*?block:\s*"center"/);
  assert.match(simulatorSource, /tutorialHelp\?\.target === "hand"[\s\S]*?`Show \$\{cardsById\[tutorialHelp\.targetCardId\]\?\.name/);
  assert.match(handModal, /ref=\{modalScrollRef\}[\s\S]*?data-simulator-modal-scroll/);
  assert.match(handModal, /onRevealTarget=\{tutorialHandRevealLabel \? revealHandTutorialTarget : null\}/);
  assert.match(handModal, /data-simulator-hand-card-rail/);
});

test("pending placement cannot reopen the mobile hand or replay the same card", () => {
  const playCard = sourceSection(
    simulatorSource,
    "function playCardFromHand(cardId)",
    "function completeInvasivePlacement",
  );
  assert.ok(
    playCard.indexOf("if (playingCardId === cardId)") < playCard.indexOf("const academyBlock = getAcademyCardPlayBlock"),
    "the already-pending card should return to placement before the tutorial guard runs",
  );
  assert.match(simulatorSource, /if \(playingCardId && modal === "hand"\)[\s\S]*?setModal\(null\)/);
  assert.match(
    simulatorSource,
    /onClick=\{\(\) => \{ if \(!playingCardId\) setModal\("hand"\); \}\} disabled=\{Boolean\(playingCardId\)\}[\s\S]*?Place card first/,
  );
});

test("V2 uses a persistent occurrence-safe hand rail while legacy keeps Open Hand", () => {
  assert.match(simulatorSource, /const mobileHandDockVisible = Boolean\([\s\S]*?previewExperience[\s\S]*?!tutorialBoardTourOpen[\s\S]*?\);/);
  assert.match(simulatorSource, /mobileHandDockVisible \? <MobileHandDock/);
  assert.match(simulatorSource, /!previewExperience \? <button[\s\S]*?Open Hand/);
  assert.match(handDockSource, /selectedIndex/);
  assert.match(handDockSource, /entry\.index === selectedIndex/);
  assert.match(handDockSource, /data-simulator-hand-card-rail/);
  assert.match(handDockSource, /data-tutorial-target="rp-bank"/);
  assert.match(handDockSource, /aria-live="polite"/);
  assert.match(simulatorSource, /document\.querySelector\("\[data-mobile-hand-dock\]"\)/);
  assert.match(simulatorSource, /visibleHeight = Math\.max\(96, rect\.height - occludedHeight\)/);
});

test("V2 keeps both mobile reefs mounted and compacts the context reef", () => {
  assert.match(simulatorSource, /data-board-owner="opponent"[\s\S]*data-board-focus=/);
  assert.match(simulatorSource, /data-board-owner="player"[\s\S]*data-board-focus=/);
  assert.match(simulatorSource, /h-\[66%\][\s\S]*h-\[34%\]/);
  assert.match(simulatorSource, /\[data-board-focus="context"\] \.seapals-board-camera-controls[\s\S]*display: none/);
});

test("V2 reclaims the visible reef switcher and focuses a reef from its own surface", () => {
  assert.match(
    simulatorSource,
    /className=\{previewExperience \? "seapals-board-tabs sr-only xl:hidden" : "seapals-board-tabs mb-2 grid/,
  );
  assert.match(
    simulatorSource,
    /function focusMobileBoard\(owner\) \{[\s\S]*?mobileBoardView === owner[\s\S]*?owner === "opponent" && playingCardId[\s\S]*?setMobileBoardView\(owner\)/,
  );
  assert.match(
    simulatorSource,
    /const MobileScoreControl = previewExperience \? "button" : "div";/,
  );
  assert.match(
    simulatorSource,
    /<MobileScoreControl[\s\S]*?aria-controls=\{previewExperience \? "simulator-player-reef" : undefined\}[\s\S]*?data-tutorial-coach-anchor=\{previewExperience \? "player-board-tab" : undefined\}/,
  );
  assert.match(
    simulatorSource,
    /<MobileScoreControl[\s\S]*?aria-controls=\{previewExperience \? "simulator-opponent-reef" : undefined\}[\s\S]*?data-tutorial-coach-anchor=\{previewExperience \? "opponent-board-tab" : undefined\}/,
  );
  assert.match(
    simulatorSource,
    /id="simulator-opponent-reef"[\s\S]*?onClickCapture=\{\(\) => focusMobileBoard\("opponent"\)\}[\s\S]*?onFocusCapture=\{\(\) => focusMobileBoard\("opponent"\)\}/,
  );
  assert.match(
    simulatorSource,
    /id="simulator-player-reef"[\s\S]*?onClickCapture=\{\(\) => focusMobileBoard\("player"\)\}[\s\S]*?onFocusCapture=\{\(\) => focusMobileBoard\("player"\)\}/,
  );
});

test("V2 keeps all focused-reef camera controls clear of the hand", () => {
  const mobileStyles = sourceSection(
    simulatorSource,
    "@media (max-width: 767px)",
    "`}</style>",
  );

  assert.match(
    mobileStyles,
    /\[data-board-focus="focused"\] \.seapals-board-camera-controls \{[\s\S]*?top:\s*\.5rem;[\s\S]*?left:\s*\.5rem;[\s\S]*?flex-direction:\s*row;[\s\S]*?transform:\s*none;/,
  );
  assert.match(
    mobileStyles,
    /\[data-board-focus="focused"\] \.seapals-board-camera-controls > button:nth-child\(2\) \{[\s\S]*?border-right:[\s\S]*?border-left:/,
  );
  assert.match(simulatorSource, /aria-label="Zoom in on opponent ecosystem"/);
  assert.match(simulatorSource, /aria-label="Fit opponent ecosystem to view"/);
  assert.match(simulatorSource, /aria-label="Zoom out on opponent ecosystem"/);
  assert.match(simulatorSource, /aria-label="Zoom in on your ecosystem"/);
  assert.match(simulatorSource, /aria-label="Fit your ecosystem to view"/);
  assert.match(simulatorSource, /aria-label="Zoom out on your ecosystem"/);
});

test("V2 marks every legal setup card in the persistent mobile hand", () => {
  assert.match(
    simulatorSource,
    /const playError = getPlayError\(card\);[\s\S]*?playError,[\s\S]*?setupPlayable: isSetup && !playingCardId && !playError/,
  );
  assert.match(handDockSource, /data-setup-playable=\{entry\.setupPlayable \? "true" : undefined\}/);
  assert.match(handDockSource, /entry\.setupPlayable \? " seapals-setup-playable-card" : ""/);
  assert.match(handDockSource, /seapals-mobile-hand-card-setup-badge">Setup/);
  assert.match(
    simulatorSource,
    /\.seapals-reduced-motion \.seapals-mobile-hand-card\.seapals-setup-playable-card \{[\s\S]*?border-color:\s*#fde68a;[\s\S]*?box-shadow:/,
  );
});

test("V2 removes both ecosystem label rows while preserving action overlays", () => {
  const labels = simulatorSource.match(/className="seapals-board-pane-label/g) ?? [];
  const fullHeightOceans = simulatorSource.match(/previewExperience \? "h-full" : "h-\[calc\(100%-40px\)\]"/g) ?? [];
  assert.equal(labels.length, 2);
  assert.equal(fullHeightOceans.length, 2);
  assert.match(simulatorSource, /\.seapals-simulator-preview \.seapals-board-pane-label \{ display: none; \}/);
  assert.match(
    simulatorSource,
    /\.seapals-simulator-preview \.seapals-board-pane-header \{[\s\S]*?position: absolute;[\s\S]*?pointer-events: none;/,
  );
  assert.match(
    simulatorSource,
    /\.seapals-simulator-preview \.seapals-board-pane-header \[role="status"\] \{[\s\S]*?pointer-events: auto;/,
  );
  assert.match(simulatorSource, /Choose a highlighted target[\s\S]*?Cancel/);
  assert.match(simulatorSource, /Click to place your[\s\S]*?Cancel/);
});

test("V2 mirrors only the rival ecosystem layout while keeping card faces and gestures upright", () => {
  const opponentPane = sourceSection(
    simulatorSource,
    'data-board-owner="opponent"',
    'data-board-owner="player"',
  );
  const playerPane = sourceSection(
    simulatorSource,
    'data-board-owner="player"',
    '{mobileHandDockVisible ? <MobileHandDock',
  );

  assert.match(opponentPane, /style=\{\{ transform: `translate[\s\S]*?seapals-opponent-ecosystem-content/);
  assert.match(opponentPane, /data-opponent-orientation=\{previewExperience \? "mirrored" : "standard"\}/);
  assert.match(opponentPane, /previewExperience \? "bottom-4 right-4 justify-end" : "left-4 top-4"/);
  assert.match(opponentPane, /previewExperience \? "bottom-4" : "top-4"/);
  assert.match(opponentPane, /previewExperience \? "bottom-4 left-4 justify-start" : "right-4 top-4 justify-end"/);
  assert.match(opponentPane, /getOpponentSlotPositions\(coral\.slots\.length, previewExperience\)/);
  assert.match(opponentPane, /getOpponentCoralGridOffset\(coralIndex, opponentCorals\.length, previewExperience\)/);
  assert.match(opponentPane, /previewExperience \? -360 : 360/);
  assert.doesNotMatch(playerPane, /data-opponent-orientation|seapals-opponent-ecosystem-content/);
  assert.match(simulatorSource, /function getOpponentSlotPositions\(count, mirrored = false\)[\s\S]*?mirrored \? Math\.PI : 0/);
  assert.match(simulatorSource, /function getOpponentCoralGridOffset\(index, total, mirrored = false\)[\s\S]*?mirrored \? \{ x: -offset\.x, y: -offset\.y \} : offset/);
  assert.match(simulatorSource, /const mirrorOpponentLayout = isOpponent && previewExperience;/);
  assert.match(simulatorSource, /mirrorOpponentLayout \? -360 : 360/);
  assert.doesNotMatch(simulatorSource, /seapals-opponent-ecosystem-content[\s\S]{0,120}rotate\(180deg\)/);
});

test("V2 gives the portrait hand the space reclaimed from the ecosystem labels", () => {
  const mobileStyles = sourceSection(
    simulatorSource,
    "@media (max-width: 767px)",
    "`}</style>",
  );

  assert.match(mobileStyles, /--seapals-mobile-hand-height:\s*13rem;/);
  assert.match(mobileStyles, /--seapals-mobile-dock-clearance:\s*calc\(var\(--seapals-mobile-hand-height\) \+ 3\.9rem\);/);
  assert.match(mobileStyles, /\.seapals-mobile-hand-dock \{ height: var\(--seapals-mobile-hand-height\); \}/);
  assert.match(mobileStyles, /\.seapals-mobile-hand-card \{[\s\S]*?width:\s*5\.75rem;[\s\S]*?height:\s*8\.15rem;/);
  assert.match(
    simulatorSource,
    /@media \(max-width: 767px\) and \(max-height: 650px\)[\s\S]*?--seapals-mobile-hand-height:\s*10rem;[\s\S]*?width:\s*4\.5rem;[\s\S]*?height:\s*6\.35rem;/,
  );
});

test("the player reef starts fitted and stops auto-fitting after manual camera input", () => {
  assert.match(simulatorSource, /const \[playerViewportTouched, setPlayerViewportTouched\] = useState\(false\)/);
  assert.match(simulatorSource, /const playerLayoutSignature = \[/);
  assert.match(
    simulatorSource,
    /if \(!playerLayoutSignature \|\| playerViewportTouched\) return undefined;[\s\S]*?new ResizeObserver\(fitPlayerBoard\)[\s\S]*?zoomEcosystemToFit\("player"\)/,
  );
  assert.match(
    simulatorSource,
    /\[playerLayoutSignature, playerViewportTouched, mobileBoardView, mobileHandDockVisible\]/,
  );
  assert.match(
    simulatorSource,
    /const sparsePlayerBoardMaxZoom = !isOpponent && corals\.length === 1 && !floatingCardsPresent[\s\S]*?rect\.width \* 0\.34/,
  );
  assert.doesNotMatch(
    sourceSection(simulatorSource, "function handleEcosystemPointerDown", "function handleEcosystemPointerMove"),
    /setPlayerViewportTouched\(true\)/,
  );
  assert.match(
    sourceSection(simulatorSource, "function handleEcosystemPointerMove", "function handleEcosystemPointerUp"),
    /Math\.abs\(dx\) \+ Math\.abs\(dy\) > 4[\s\S]*?setPlayerViewportTouched\(true\)/,
  );
  assert.match(
    simulatorSource,
    /attachCursorZoom\(ecosystemRef\.current, setEcosystemZoom, setEcosystemOffset, \(\) => setPlayerViewportTouched\(true\)\)/,
  );
  assert.match(simulatorSource, /setPlayerViewportTouched\(false\)[\s\S]*?setOpponentViewportTouched\(false\)/);
});

test("the narrow HUD uses safe areas, compact rows, and 44px primary tap targets", () => {
  const mobileStyles = sourceSection(
    simulatorSource,
    "@media (max-width: 767px)",
    "`}</style>",
  );

  assert.match(mobileStyles, /height:\s*100dvh;/);
  assert.match(mobileStyles, /padding-top:\s*max\(\.5rem, env\(safe-area-inset-top\)\)/);
  assert.match(mobileStyles, /padding-bottom:\s*max\(\.5rem, env\(safe-area-inset-bottom\)\)/);
  assert.match(mobileStyles, /\.seapals-simulator-header\s*\{[\s\S]*?display:\s*grid;/);
  assert.match(mobileStyles, /\.seapals-simulator-controls\s*\{\s*display:\s*contents;/);
  assert.match(mobileStyles, /\.seapals-board-tabs > button\s*\{[\s\S]*?min-height:\s*2\.75rem;/);
  assert.match(mobileStyles, /\.seapals-mobile-dock\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(simulatorSource, /className=\{`flex h-11 w-11[\s\S]*?aria-label="Zoom in on your ecosystem"/);
  assert.match(simulatorSource, /className=\{`min-h-11 w-11[\s\S]*?aria-label="Fit your ecosystem to view"/);
});
