import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [simulatorSource, handDockSource, handPopoverSource, cameraSource] = await Promise.all([
  readFile(new URL("./Simulator.jsx", import.meta.url), "utf8"),
  readFile(new URL("./MobileHandDock.jsx", import.meta.url), "utf8"),
  readFile(new URL("./MobileHandCardPopover.jsx", import.meta.url), "utf8"),
  readFile(new URL("./ecosystemCamera.mjs", import.meta.url), "utf8"),
]);

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

test("V2 uses a headerless, occurrence-safe hand rail that opens a dedicated card popout", () => {
  const mobileHandDock = sourceSection(
    simulatorSource,
    "{mobileHandDockVisible ? <MobileHandDock",
    "{mobileHudPanel ? (",
  );

  assert.match(simulatorSource, /const mobileHandDockVisible = Boolean\([\s\S]*?previewExperience[\s\S]*?!tutorialBoardTourOpen[\s\S]*?\);/);
  assert.match(simulatorSource, /mobileHandDockVisible \? <MobileHandDock/);
  assert.match(simulatorSource, /!previewExperience \? <button[\s\S]*?Open Hand/);
  assert.match(handDockSource, /selectedIndex/);
  assert.match(handDockSource, /entry\.index === selectedIndex/);
  assert.match(handDockSource, /data-simulator-hand-card-rail/);
  assert.match(handDockSource, /key=\{`\$\{entry\.cardId\}-\$\{entry\.index\}`\}/);
  assert.match(
    handDockSource,
    /onClick=\{\(event\) => onInspect\(entry\.cardId, entry\.index, event\.currentTarget\)\}/,
  );
  assert.doesNotMatch(handDockSource, /onSelect/);
  assert.doesNotMatch(handDockSource, /seapals-mobile-hand-summary|Swipe cards|tap one to lift/i);
  assert.match(mobileHandDock, /onInspect=\{openHandCardPopover\}/);
  assert.match(
    simulatorSource,
    /function openHandCardPopover\(cardId, index = null, returnTarget = null\) \{[\s\S]*?hand\[index\] !== cardId\) return;[\s\S]*?returnTarget instanceof HTMLElement[\s\S]*?handPopoverReturnFocusRef\.current = returnTarget;[\s\S]*?setMobileSelectedHandIndex\(Number\.isInteger\(index\) \? index : null\);[\s\S]*?setSelectedHandCard\(cardId\);[\s\S]*?setHandPopoverCardId\(cardId\);[\s\S]*?\}/,
  );
  assert.doesNotMatch(mobileHandDock, /setModal\("hand"\)/);
  assert.match(simulatorSource, /\.seapals-mobile-hand-rail\s*\{[\s\S]*?height:\s*100%;/);
  assert.match(simulatorSource, /document\.querySelector\("\[data-mobile-hand-dock\]"\)/);
  assert.match(simulatorSource, /visibleHeight = Math\.max\(96, rect\.height - occludedHeight\)/);
});

test("closing a V2 hand-card popout clears every selected and lifted card state", () => {
  const closeHandler = sourceSection(
    simulatorSource,
    "function closeHandCardPopover",
    "function playHandPopoverCard",
  );
  const playHandler = sourceSection(
    simulatorSource,
    "function playHandPopoverCard",
    "function inspectSearchResult",
  );

  assert.match(closeHandler, /setHandPopoverCardId\(null\)/);
  assert.match(closeHandler, /setSelectedHandCard\(null\)/);
  assert.match(closeHandler, /setMobileSelectedHandIndex\(null\)/);
  assert.match(closeHandler, /setPlayError\(""\)/);
  assert.ok(
    (handPopoverSource.match(/onClick=\{onClose\}/g) ?? []).length >= 2,
    "both the dimmed backdrop and close button should delegate to the shared parent reset path",
  );
  assert.match(simulatorSource, /<MobileHandCardPopover[\s\S]*?onClose=\{closeHandCardPopover\}[\s\S]*?onPlay=\{playHandPopoverCard\}/);
  assert.match(playHandler, /closeHandCardPopover\(\{ restoreFocus: false \}\);[\s\S]*?playCardFromHand\(cardId\)/);
});

test("the V2 hand-card popout dims the board, animates independently, and exposes Play Card", () => {
  assert.match(simulatorSource, /@keyframes seapalsHandCardPopoverIn[\s\S]*?opacity:\s*0;[\s\S]*?scale\(\.[0-9]+\)[\s\S]*?opacity:\s*1;[\s\S]*?scale\(1\)/);
  assert.match(simulatorSource, /\.seapals-hand-card-popover\s*\{[\s\S]*?animation:\s*seapalsHandCardPopoverIn/);
  assert.match(
    simulatorSource,
    /\.seapals-reduced-motion :is\([^)]*\.seapals-hand-card-popover[^)]*\)\s*\{[\s\S]*?animation:\s*none !important;/,
  );
  assert.match(handPopoverSource, /seapals-hand-card-popover-backdrop/);
  assert.ok(
    /seapals-hand-card-popover-backdrop[^"\n]*(?:bg-slate-950\/(?:6[5-9]|[7-9][0-9])|backdrop-blur)/.test(handPopoverSource)
      || /\.seapals-hand-card-popover-backdrop\s*\{[\s\S]*?(?:rgba\([^)]*,\s*\.(?:6[5-9]|[7-9][0-9])\)|backdrop-filter:\s*blur)/.test(simulatorSource),
    "the dedicated backdrop should visibly dim or blur the board",
  );
  assert.match(simulatorSource, /<MobileHandCardPopover/);
  assert.match(handPopoverSource, /className="[^"]*seapals-hand-card-popover[^"]*"/);
  assert.match(handPopoverSource, /role="dialog"[\s\S]*?aria-modal="true"/);
  assert.match(handPopoverSource, /tabIndex=\{-1\}[\s\S]*?className="seapals-hand-card-popover-backdrop"/);
  assert.match(handPopoverSource, /function keepFocusInDialog\(event\)[\s\S]*?event\.key !== "Tab"[\s\S]*?querySelectorAll\("button:not\(:disabled\)[\s\S]*?last\.focus\(\)[\s\S]*?first\.focus\(\)/);
  assert.match(handPopoverSource, /ref=\{dialogRef\}[\s\S]*?onKeyDown=\{keepFocusInDialog\}/);
  assert.match(handPopoverSource, /aria-label="Close hand card popout"[\s\S]*?<span aria-hidden="true">×<\/span>/);
  assert.match(handPopoverSource, /src=\{card\.image\}[\s\S]*?alt=\{card\.name\}/);
  assert.match(
    handPopoverSource,
    /disabled=\{Boolean\((?:playError|handPopoverPlayError)\)\}[\s\S]*?data-tutorial-target="play-card"[\s\S]*?>\s*Play card\s*<\/button>/i,
  );
  assert.doesNotMatch(handPopoverSource, /seapals-card-drawer|modal === "hand"/);
});

test("V2 keeps both reefs mounted around an accessible 24-to-68 percent divider", () => {
  const responsiveStyles = sourceSection(
    simulatorSource,
    "@media (max-width: 1279px)",
    "@media (max-width: 767px)",
  );

  assert.match(simulatorSource, /const MOBILE_REEF_SPLIT_MIN = 24;/);
  assert.match(simulatorSource, /const MOBILE_REEF_SPLIT_MAX = 68;/);
  assert.match(simulatorSource, /const \[mobileReefSplit, setMobileReefSplit\] = useState\(40\)/);
  assert.match(
    simulatorSource,
    /id="simulator-opponent-reef"[\s\S]*?previewExperience \? "block" : mobileBoardView === "opponent" \? "h-full" : "hidden"/,
  );
  assert.match(
    simulatorSource,
    /id="simulator-player-reef"[\s\S]*?previewExperience \? "block" : mobileBoardView === "player" \? "h-full" : "hidden"/,
  );
  assert.match(simulatorSource, /"--seapals-mobile-reef-split": `\$\{mobileReefSplit\}%`/);
  assert.match(
    simulatorSource,
    /className=\{`seapals-reef-divider[\s\S]*?role="separator"[\s\S]*?aria-orientation="horizontal"[\s\S]*?aria-valuemin=\{MOBILE_REEF_SPLIT_MIN\}[\s\S]*?aria-valuemax=\{MOBILE_REEF_SPLIT_MAX\}[\s\S]*?aria-valuenow=\{Math\.round\(mobileReefSplit\)\}[\s\S]*?tabIndex=\{0\}/,
  );
  assert.match(
    simulatorSource,
    /onKeyDown=\{handleReefDividerKeyDown\}[\s\S]*?onPointerDown=\{handleReefDividerPointerDown\}[\s\S]*?onPointerMove=\{handleReefDividerPointerMove\}[\s\S]*?onPointerUp=\{handleReefDividerPointerUp\}[\s\S]*?onPointerCancel=\{handleReefDividerPointerUp\}/,
  );
  assert.match(
    sourceSection(simulatorSource, "function handleReefDividerKeyDown", "function getBoardGesture"),
    /ArrowUp[\s\S]*?ArrowDown[\s\S]*?Home[\s\S]*?MOBILE_REEF_SPLIT_MIN[\s\S]*?End[\s\S]*?MOBILE_REEF_SPLIT_MAX[\s\S]*?clampMobileReefSplit/,
  );
  assert.match(responsiveStyles, /\.seapals-simulator-preview \.seapals-board-stack\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/);
  assert.match(responsiveStyles, /data-board-owner="opponent"\][\s\S]*?calc\(var\(--seapals-mobile-reef-split\) - 1\.375rem\)/);
  assert.match(responsiveStyles, /\.seapals-reef-divider\s*\{[\s\S]*?flex:\s*0 0 2\.75rem;[\s\S]*?touch-action:\s*none;/);
  assert.doesNotMatch(simulatorSource, /h-\[66%\]|h-\[34%\]|data-board-focus=/);
});

test("V2 removes its reef switcher while legacy retains explicit reef tabs", () => {
  assert.match(
    simulatorSource,
    /\{!previewExperience \? <div className="seapals-board-tabs[\s\S]*?aria-label="Choose ecosystem to view"/,
  );
  assert.match(simulatorSource, /data-tutorial-coach-anchor="player-board-tab"[\s\S]*?onClick=\{\(\) => setMobileBoardView\("player"\)\}/);
  assert.match(simulatorSource, /data-tutorial-coach-anchor="opponent-board-tab"[\s\S]*?onClick=\{\(\) => setMobileBoardView\("opponent"\)\}/);
  assert.doesNotMatch(simulatorSource, /focusMobileBoard|MobileScoreControl/);
});

test("V2 puts number-only VP and RP badges at the right edge around the divider", () => {
  const opponentScore = sourceSection(
    simulatorSource,
    'className="seapals-reef-score seapals-reef-score-opponent"',
    "ref={opponentEcosystemRef}",
  );
  const playerScore = sourceSection(
    simulatorSource,
    'className="seapals-reef-score seapals-reef-score-player"',
    "ref={ecosystemRef}",
  );
  const responsiveStyles = sourceSection(
    simulatorSource,
    "@media (max-width: 1279px)",
    "@media (max-width: 767px)",
  );

  assert.match(opponentScore, /data-tutorial-coach-anchor="opponent-board-tab"/);
  assert.match(opponentScore, /is-vp"><small>VP<\/small><strong>\{opponentVp\}<\/strong>/);
  assert.match(opponentScore, /is-rp"><small>RP<\/small><strong>\{opponent\.rp\}<\/strong>/);
  assert.doesNotMatch(opponentScore, /victoryTarget|opponentRpCap|School Density|\/\{/);
  assert.match(playerScore, /data-tutorial-coach-anchor="player-board-tab"/);
  assert.match(playerScore, /data-tutorial-target="vp-score"[\s\S]*?<strong>\{playerVp\}<\/strong>/);
  assert.match(playerScore, /data-tutorial-target="rp-bank"[\s\S]*?<strong>\{rp\}<\/strong>/);
  assert.doesNotMatch(playerScore, /victoryTarget|playerRpCap|School Density|\/\{/);
  assert.match(responsiveStyles, /\.seapals-reef-score\s*\{[\s\S]*?right:\s*\.45rem;/);
  assert.match(responsiveStyles, /\.seapals-reef-score-opponent\s*\{\s*bottom:\s*\.45rem;/);
  assert.match(responsiveStyles, /\.seapals-reef-score-player\s*\{\s*top:\s*\.45rem;/);
});

test("V2 keeps vertical camera controls left and above the hand except on short screens", () => {
  const responsiveStyles = sourceSection(
    simulatorSource,
    "@media (max-width: 1279px)",
    "@media (max-width: 1279px) and (max-height: 650px)",
  );
  const shortStyles = sourceSection(
    simulatorSource,
    "@media (max-width: 1279px) and (max-height: 650px)",
    "@media (max-width: 767px)",
  );

  assert.match(
    responsiveStyles,
    /data-board-owner="opponent"\] \.seapals-board-camera-controls\s*\{[\s\S]*?z-index:\s*65;[\s\S]*?right:\s*auto;[\s\S]*?bottom:\s*\.5rem;[\s\S]*?left:\s*\.5rem;[\s\S]*?flex-direction:\s*column;[\s\S]*?translate:\s*0 0 !important;[\s\S]*?transform:\s*none;/,
  );
  assert.match(
    responsiveStyles,
    /data-board-owner="player"\] \.seapals-board-camera-controls\s*\{[\s\S]*?z-index:\s*65;[\s\S]*?top:\s*\.5rem;[\s\S]*?right:\s*auto;[\s\S]*?left:\s*\.5rem;[\s\S]*?flex-direction:\s*column;[\s\S]*?translate:\s*0 0 !important;[\s\S]*?transform:\s*none;/,
  );
  assert.match(responsiveStyles, /\.seapals-board-camera-controls > button:nth-child\(2\)[\s\S]*?border-top:\s*1px[\s\S]*?border-right:\s*0;[\s\S]*?border-bottom:\s*1px[\s\S]*?border-left:\s*0;/);
  assert.match(shortStyles, /data-board-owner\] \.seapals-board-camera-controls\s*\{[\s\S]*?flex-direction:\s*row;/);
  assert.match(shortStyles, /\.seapals-board-camera-controls > button:nth-child\(2\)[\s\S]*?border-top:\s*0;[\s\S]*?border-right:\s*1px[\s\S]*?border-bottom:\s*0;[\s\S]*?border-left:\s*1px/);
  assert.match(simulatorSource, /\.seapals-mobile-hand-dock\s*\{[\s\S]*?z-index:\s*58;/);
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

test("the hand rail reserves reachable left and right gutters around board controls", () => {
  const responsiveStyles = sourceSection(
    simulatorSource,
    "@media (max-width: 1279px)",
    "@media (max-width: 1279px) and (max-height: 650px)",
  );
  const shortStyles = sourceSection(
    simulatorSource,
    "@media (max-width: 1279px) and (max-height: 650px)",
    "@media (max-width: 767px)",
  );

  assert.match(
    responsiveStyles,
    /\.seapals-simulator-preview \.seapals-mobile-hand-list\s*\{[\s\S]*?padding-right:\s*5\.75rem;[\s\S]*?padding-left:\s*3\.75rem;/,
  );
  assert.match(shortStyles, /\.seapals-simulator-preview \.seapals-mobile-hand-list\s*\{\s*padding-left:\s*9rem;/);
});

test("the V2 hand tray is transparent and compact enough to return space to the reef", () => {
  const responsiveStyles = sourceSection(
    simulatorSource,
    "@media (max-width: 1279px)",
    "@media (max-width: 1279px) and (max-height: 650px)",
  );
  const mobileStyles = sourceSection(
    simulatorSource,
    "@media (max-width: 767px)",
    "`}</style>",
  );
  const basePreview = sourceSection(
    simulatorSource,
    ".seapals-game-shell.seapals-simulator-preview {",
    ".seapals-hud-panel {",
  );
  const regularPhone = sourceSection(
    mobileStyles,
    ".seapals-game-shell.seapals-simulator-preview {",
    ".seapals-arena-frame {",
  );
  const shortPhone = sourceSection(
    simulatorSource,
    "@media (max-width: 767px) and (max-height: 650px)",
    "`}</style>",
  );
  const panelRule = responsiveStyles.match(/\.seapals-simulator-preview \.seapals-mobile-hand-panel\s*\{([^}]*)\}/)?.[1] ?? "";
  const baseHeight = Number(basePreview.match(/--seapals-mobile-hand-height:\s*([\d.]+)rem/)?.[1]);
  const regularHeight = Number(regularPhone.match(/--seapals-mobile-hand-height:\s*([\d.]+)rem/)?.[1] ?? baseHeight);
  const shortHeight = Number(shortPhone.match(/--seapals-mobile-hand-height:\s*([\d.]+)rem/)?.[1] ?? regularHeight);

  assert.match(panelRule, /background:\s*transparent;/);
  assert.match(panelRule, /border:\s*0;/);
  assert.match(panelRule, /box-shadow:\s*none;/);
  assert.match(panelRule, /backdrop-filter:\s*none;/);
  assert.ok(Number.isFinite(regularHeight) && regularHeight < 13, "regular phone hand height should reclaim space from the old 13rem tray");
  assert.ok(Number.isFinite(shortHeight) && shortHeight < 10, "short phone hand height should reclaim space from the old 10rem tray");
  assert.match(simulatorSource, /--seapals-mobile-dock-clearance:\s*calc\(var\(--seapals-mobile-hand-height\) \+ (?:[\d.]+rem|var\(--seapals-mobile-hand-bottom\))\);/);
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

test("V2 uses a hybrid inverted rival perspective while keeping peripheral zones outermost", () => {
  const opponentPane = sourceSection(
    simulatorSource,
    'id="simulator-opponent-reef"',
    'id="simulator-player-reef"',
  );
  const playerPane = sourceSection(
    simulatorSource,
    'id="simulator-player-reef"',
    '{mobileHandDockVisible ? <MobileHandDock',
  );

  assert.match(opponentPane, /style=\{\{ transform: `translate[\s\S]*?seapals-opponent-ecosystem-content/);
  assert.match(opponentPane, /data-opponent-orientation=\{previewExperience \? "inverted" : "standard"\}/);
  assert.match(opponentPane, /seapals-opponent-habitats absolute left-4 top-4/);
  assert.match(opponentPane, /seapals-opponent-open-water absolute left-1\/2 top-4/);
  assert.match(opponentPane, /seapals-opponent-orphans absolute right-4 top-4/);
  assert.match(opponentPane, /getOpponentSlotPositions\(coral\.slots\.length, previewExperience\)/);
  assert.match(opponentPane, /getOpponentCoralGridOffset\(coralIndex, opponentCorals\.length, previewExperience\)/);
  assert.match(opponentPane, /getOpponentSlotPosition\(slot\.position, previewExperience\) \?\? anchorPositions\[slotIndex\]/);
  assert.match(opponentPane, /const opponentFloatingOffset = hasFloatingOpponentCards \? 360 : 0/);
  assert.doesNotMatch(playerPane, /data-opponent-orientation|seapals-opponent-ecosystem-content/);
  assert.match(simulatorSource, /function getOpponentSlotPositions\(count, mirrored = false\)[\s\S]*?mirrored \? Math\.PI : 0/);
  assert.match(simulatorSource, /function getOpponentCoralGridOffset\(index, total, mirrored = false\)[\s\S]*?mirrored \? \{ x: -offset\.x, y: -offset\.y \} : offset/);
  assert.match(simulatorSource, /function getOpponentSlotPosition\(position, mirrored = false\)[\s\S]*?100 - parsed[\s\S]*?top: mirrorCoordinate\(position\.top\)[\s\S]*?left: mirrorCoordinate\(position\.left\)/);
  assert.match(simulatorSource, /function roundLayoutNumber\(value, precision = 4\)[\s\S]*?toFixed\(precision\)/);
  assert.match(simulatorSource, /function getSlotConnectorStyle\(position\)[\s\S]*?roundLayoutNumber\(angle, 6\)/);
  assert.match(simulatorSource, /const invertOpponentSlots = isOpponent && previewExperience;/);
  assert.match(simulatorSource, /const floatingOffset = floatingCardsPresent \? 360 : 0/);
  assert.match(
    sourceSection(simulatorSource, "if (event?.permanentPlacementCue)", "const eventLogMessages"),
    /queueBubbleBurst\(x, y, board\)/,
  );
  assert.doesNotMatch(
    sourceSection(simulatorSource, "if (event?.permanentPlacementCue)", "const eventLogMessages"),
    /mirrorOpponentCue|100 - x|100 - y/,
  );
  assert.match(simulatorSource, /\.seapals-opponent-ocean-backdrop\s*\{[\s\S]*?transform:\s*scaleY\(-1\);/);
  assert.doesNotMatch(simulatorSource, /seapals-opponent-ecosystem-content[\s\S]{0,120}rotate\(180deg\)/);
});

test("capture-phase two-touch pinch and focal wheel zoom share camera helpers", () => {
  const gestureHandlers = sourceSection(
    simulatorSource,
    "function beginTrackedPinch",
    "function handleEcosystemPointerDown",
  );
  const wheelEffect = sourceSection(
    simulatorSource,
    "const attachCursorZoom = (owner, element, onAdjusted) => {",
    "function pushLog",
  );

  assert.match(
    simulatorSource,
    /import \{[\s\S]*?beginPinchCamera,[\s\S]*?getVisibleAreaFitOffset,[\s\S]*?updatePinchCamera,[\s\S]*?zoomCameraAtPoint,[\s\S]*?\} from "\.\/ecosystemCamera\.mjs";/,
  );
  assert.match(cameraSource, /export function beginPinchCamera/);
  assert.match(cameraSource, /export function updatePinchCamera/);
  assert.match(cameraSource, /export function zoomCameraAtPoint/);
  assert.match(gestureHandlers, /gesture\.pointers\.size >= 2[\s\S]*?beginTrackedPinch\(owner, gesture, rect\)/);
  assert.match(gestureHandlers, /gesture\.pinch = beginPinchCamera\([\s\S]*?gesture\.pinching = true/);
  assert.match(gestureHandlers, /const nextCamera = updatePinchCamera\(gesture\.pinch, first, second\)[\s\S]*?commitBoardCamera\(owner, nextCamera\)/);
  assert.match(gestureHandlers, /boardClickSuppressionRef\.current\[owner\] = Date\.now\(\) \+ 500/);
  assert.match(gestureHandlers, /function suppressBoardGestureClick[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\)/);
  assert.match(simulatorSource, /onPointerDownCapture=\{\(event\) => handleBoardPointerDownCapture\("opponent", event\)\}/);
  assert.match(simulatorSource, /onPointerMoveCapture=\{\(event\) => handleBoardPointerMoveCapture\("player", event\)\}/);
  assert.match(simulatorSource, /data-board-owner="opponent"[\s\S]*?onClickCapture=\{\(event\) => suppressBoardGestureClick\("opponent", event\)\}/);
  assert.match(simulatorSource, /data-board-owner="player"[\s\S]*?onClickCapture=\{\(event\) => suppressBoardGestureClick\("player", event\)\}/);
  assert.match(wheelEffect, /addEventListener\("wheel", onWheel, \{ passive: false, capture: true \}\)/);
  assert.match(wheelEffect, /zoomCameraAtPoint\([\s\S]*?event\.clientX - rect\.left[\s\S]*?event\.clientY - rect\.top/);
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
  assert.doesNotMatch(
    sourceSection(simulatorSource, "function handleOpponentPointerDown", "function handleOpponentPointerMove"),
    /setOpponentViewportTouched\(true\)/,
  );
  assert.match(
    sourceSection(simulatorSource, "function handleOpponentPointerMove", "function handleOpponentPointerUp"),
    /const dx = event\.clientX - opponentPanStart\.x;[\s\S]*?const dy = event\.clientY - opponentPanStart\.y;[\s\S]*?Math\.abs\(dx\) \+ Math\.abs\(dy\) > 4[\s\S]*?setOpponentViewportTouched\(true\)/,
  );
  assert.match(
    simulatorSource,
    /attachCursorZoom\("player", ecosystemRef\.current, \(\) => setPlayerViewportTouched\(true\)\)/,
  );
  assert.match(simulatorSource, /setPlayerViewportTouched\(false\)[\s\S]*?setOpponentViewportTouched\(false\)/);
});

test("V2 card inspection fills the viewport with an animated card and a simple x", () => {
  const responsiveStyles = sourceSection(
    simulatorSource,
    "@media (max-width: 1279px)",
    "@media (max-width: 767px)",
  );
  const inspector = sourceSection(
    simulatorSource,
    "{inspectedCardData ? (",
    "{eventOverlay ? (",
  );

  assert.match(simulatorSource, /@keyframes seapalsCardInspectorIn[\s\S]*?scale\(\.94\)[\s\S]*?scale\(1\)/);
  assert.match(responsiveStyles, /\.seapals-simulator-preview \.seapals-card-drawer\s*\{[\s\S]*?inset:\s*0;[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;[\s\S]*?animation:\s*seapalsCardInspectorIn/);
  assert.match(responsiveStyles, /\.seapals-simulator-preview \.seapals-card-inspector-close\s*\{[\s\S]*?width:\s*2\.75rem;[\s\S]*?height:\s*2\.75rem;/);
  assert.match(responsiveStyles, /\.seapals-simulator-preview \.seapals-card-inspector-image\s*\{[\s\S]*?height:\s*min\(62dvh, 42rem\);[\s\S]*?animation:\s*seapalsCardInspectorIn/);
  assert.match(inspector, /role="dialog"[\s\S]*?aria-modal="true"/);
  assert.match(inspector, /aria-label="Close card inspector"[\s\S]*?seapals-card-inspector-close[\s\S]*?<span aria-hidden="true">×<\/span>/);
});

test("V2 removes Finn from its header while legacy still renders the guide", () => {
  assert.match(simulatorSource, /\{!previewExperience \? <div className="seapals-finn-control">[\s\S]*?<RulesChat/);
  assert.match(simulatorSource, /\.seapals-simulator-preview \.seapals-finn-control\s*\{\s*display:\s*none;/);
  assert.match(
    simulatorSource,
    /\.seapals-simulator-preview \.seapals-simulator-header\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;[\s\S]*?grid-template-rows:\s*auto auto;/,
  );
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
  assert.match(mobileStyles, /\.seapals-simulator-preview \.seapals-simulator-header\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;/);
  assert.match(mobileStyles, /\.seapals-simulator-controls\s*\{\s*display:\s*contents;/);
  assert.match(mobileStyles, /\.seapals-board-tabs > button\s*\{[\s\S]*?min-height:\s*2\.75rem;/);
  assert.match(mobileStyles, /\.seapals-mobile-dock\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(simulatorSource, /className=\{`flex h-11 w-11[\s\S]*?aria-label="Zoom in on your ecosystem"/);
  assert.match(simulatorSource, /className=\{`min-h-11 w-11[\s\S]*?aria-label="Fit your ecosystem to view"/);
});
