import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [simulatorSource, handDockSource, handPopoverSource, edgeZonesSource, cameraSource] = await Promise.all([
  readFile(new URL("./Simulator.jsx", import.meta.url), "utf8"),
  readFile(new URL("./MobileHandDock.jsx", import.meta.url), "utf8"),
  readFile(new URL("./MobileHandCardPopover.jsx", import.meta.url), "utf8"),
  readFile(new URL("./MobileEdgeZones.jsx", import.meta.url), "utf8"),
  readFile(new URL("./ecosystemCamera.mjs", import.meta.url), "utf8"),
]);

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
    "{fullPageModalOpen ? (",
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
  assert.match(simulatorSource, /\{!previewExperience \? <div className="seapals-mobile-dock[\s\S]*?Open Hand/);
  assert.match(handDockSource, /selectedIndex/);
  assert.match(handDockSource, /entry\.index === selectedIndex/);
  assert.match(handDockSource, /data-simulator-hand-card-rail/);
  assert.match(handDockSource, /key=\{`\$\{entry\.cardId\}-\$\{entry\.index\}`\}/);
  assert.match(
    handDockSource,
    /onClick=\{\(event\) => handleCardClick\(entry, event\)\}/,
  );
  assert.match(handDockSource, /function handleCardClick\(entry, event\)[\s\S]*?onInspect\(entry\.cardId, entry\.index, event\.currentTarget\)/);
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

test("mobile hand cards distinguish an upward placement drag from horizontal hand scrolling", () => {
  assert.match(
    handDockSource,
    /onDragStart[\s\S]*?onDragMove[\s\S]*?onDragEnd[\s\S]*?onDragCancel/,
    "the dock should expose the full drag lifecycle without replacing tap inspection",
  );
  assert.match(handDockSource, /onPointerDown=/);
  assert.match(handDockSource, /onPointerMove=/);
  assert.match(handDockSource, /onPointerUp=/);
  assert.match(handDockSource, /onPointerCancel=/);
  assert.match(handDockSource, /onLostPointerCapture=/);
  assert.match(handDockSource, /data-mobile-hand-card-index=\{entry\.index\}/);

  const pointerStart = functionSectionContaining(
    handDockSource,
    [/pointerId/, /clientX/, /clientY/, /candidate|origin/i],
    "mobile hand drag candidate",
  );
  assert.doesNotMatch(
    pointerStart,
    /preventDefault\(\)|setPointerCapture/,
    "pointerdown must leave native horizontal rail scrolling available",
  );

  const pointerMove = functionSectionContaining(
    handDockSource,
    [/Math\.abs\([^)]*(?:dx|deltaX)[^)]*\)/i, /Math\.abs\([^)]*(?:dy|deltaY)[^)]*\)/i, /onDragStart/, /preventDefault\(\)/],
    "mobile hand axis-lock",
  );
  assert.match(pointerMove, /(?:dy|deltaY)\s*<=?\s*-\s*(?:[A-Z_$][\w$]*|\d+)/i, "only an upward gesture should promote the candidate to a card drag");
  assert.match(
    pointerMove,
    /(?:absY|verticalDistance)[\s\S]{0,100}(?:absX|horizontalDistance)[\s\S]{0,60}(?:1\.1[5-9]|[A-Z_$][\w$]*)/i,
    "vertical intent should dominate horizontal movement before placement begins",
  );
  assert.match(pointerMove, /setPointerCapture/);
  assert.match(simulatorSource, /\.seapals-mobile-hand-rail\s*\{[\s\S]*?touch-action:\s*pan-x;/);
});

test("the touched hand-card source owns the pan-x policy instead of relying on an ancestor", () => {
  const handListItemStyles = sourceSection(
    simulatorSource,
    ".seapals-mobile-hand-list > li {",
    ".seapals-mobile-hand-list > li + li",
  );
  const handCardStyles = sourceSection(
    simulatorSource,
    ".seapals-mobile-hand-card {",
    ".seapals-mobile-hand-list > li:nth-child(even)",
  );

  assert.match(
    handListItemStyles,
    /touch-action:\s*pan-x;/,
    "mobile Safari must see the horizontal-only touch policy on the element that receives pointerdown",
  );
  assert.match(
    handCardStyles,
    /touch-action:\s*pan-x;/,
    "the touched button must advertise the same horizontal-only gesture policy before Safari chooses implicit capture",
  );
});

test("pointer capture is established before drag-start state causes a parent rerender", () => {
  const pointerMove = functionSectionContaining(
    handDockSource,
    [/onDragStart/, /setPointerCapture/, /phase\s*=\s*"dragging"/],
    "mobile hand drag promotion",
  );
  const captureIndex = pointerMove.indexOf("setPointerCapture");
  const dragStartIndex = pointerMove.indexOf("onDragStart");

  assert.ok(captureIndex >= 0 && dragStartIndex >= 0);
  assert.ok(
    captureIndex < dragStartIndex,
    "capture the pointer before onDragStart updates Simulator state and rerenders the hand dock",
  );
  assert.match(
    pointerMove,
    /sourceElement\.setPointerCapture\?\.\(event\.pointerId\)/,
    "capture must stay attached to the exact element Safari implicitly captured on pointerdown",
  );
  const pointerStart = functionSectionContaining(
    handDockSource,
    [/handleCardPointerDown/, /sourceElement/, /event\.target/],
    "exact mobile hand pointer source",
  );
  assert.match(pointerStart, /sourceElement:\s*event\.target/);
});

test("pointercancel is terminal but bubbled lost-capture from a different element cannot snap back the drag", () => {
  const pointerCancel = functionSectionContaining(
    handDockSource,
    [/handleCardPointerCancel/, /clearHandDragGesture/],
    "mobile hand pointer cancellation",
  );
  const lostCapture = functionSectionContaining(
    handDockSource,
    [/handleCardLostPointerCapture/, /gestureRef\.current/],
    "mobile hand lost-capture handling",
  );

  assert.match(pointerCancel, /clearHandDragGesture\(\{\s*cancel:\s*true/);
  assert.match(
    lostCapture,
    /event\.target\s*!==\s*gesture\.sourceElement[\s\S]*?return/,
    "Safari can bubble lostpointercapture while implicit capture moves between the touched card and its list item",
  );
  assert.match(lostCapture, /clearHandDragGesture\(\{\s*cancel:\s*true/);
});

test("the active source remains interactive when drag state rerenders the hand", () => {
  assert.match(
    handDockSource,
    /disabled=\{placementPending\s*&&\s*!dragging\}/,
    "disabling the captured source during a parent render can make mobile Safari cancel and snap the gesture back",
  );
  assert.match(
    handDockSource,
    /key=\{`\$\{entry\.cardId\}-\$\{entry\.index\}`\}/,
    "drag state must not enter the source key and replace the captured DOM node",
  );
  assert.match(
    handDockSource,
    /const callbacksRef = useRef[\s\S]*?callbacksRef\.current\s*=\s*\{\s*onDragStart,\s*onDragMove,\s*onDragEnd,\s*onDragCancel\s*\}/,
    "fresh parent callbacks should be observed without rebuilding the gesture tracker",
  );
});

test("a mobile hand drag starts direct placement without opening the tap popover", () => {
  const mobileHandDock = sourceSection(
    simulatorSource,
    "{mobileHandDockVisible ? <MobileHandDock",
    "{mobileHudPanel ? (",
  );
  assert.match(mobileHandDock, /onInspect=\{openHandCardPopover\}/, "tap and keyboard inspection must remain available");
  assert.match(mobileHandDock, /onDragStart=\{[A-Za-z_$][\w$]*\}/);
  assert.match(mobileHandDock, /onDragMove=\{[A-Za-z_$][\w$]*\}/);
  assert.match(mobileHandDock, /onDragEnd=\{[A-Za-z_$][\w$]*\}/);
  assert.match(mobileHandDock, /onDragCancel=\{[A-Za-z_$][\w$]*\}/);

  const dragStart = functionSectionContaining(
    simulatorSource,
    [/hand\[index\]\s*!==\s*cardId/, /getPlayError\(card\)/, /setMobileHandDrag\(/],
    "direct mobile hand drag start",
  );
  assert.doesNotMatch(dragStart, /openHandCardPopover|setHandPopoverCardId/);
  assert.doesNotMatch(dragStart, /setPlayingCardId\(cardId\)|playCardFromHand\(cardId\)/, "drag preview must not commit immediate-play cards before release");
  assert.match(dragStart, /setMobileSelectedHandIndex\(null\)/, "dragging must stay separate from the popover's lifted-card state");
});

test("mobile hand drops reuse the normal ecosystem, foundation, and slot placement rules", () => {
  const playerPane = sourceSection(
    simulatorSource,
    'id="simulator-player-reef"',
    "{mobileHandDockVisible ? <MobileHandDock",
  );
  assert.match(playerPane, /data-hand-drop-zone="ecosystem"/);
  assert.match(playerPane, /data-hand-drop-(?:coral|foundation)-id=\{coral\.id\}/);
  assert.match(playerPane, /data-hand-drop-slot-id=\{slot\.id\}/);
  assert.match(playerPane, /data-hand-drop-valid=/);

  const dragDrop = functionSectionContaining(
    simulatorSource,
    [/document\.elementsFromPoint\(/, /closest\("\[data-hand-drop-/, /placeCardToSlot\(/, /placeCoralInEcosystem\(/, /upgradeCoral\(/, /playCardFromHand\(/],
    "mobile hand drop resolver",
  );
  assert.match(dragDrop, /placeCardToSlot\([^,]+,\s*cardId\)/, "slot drops should commit the exact dragged occurrence through existing slot validation");
  assert.match(dragDrop, /upgradeCoral\([^,]+,\s*cardId\)/, "upgrade drops should reuse normal foundation upgrade rules");
  assert.match(dragDrop, /placeCoralInEcosystem\([^,]+,\s*[^,]+,\s*cardId\)/, "base foundations should use the board placement path with the dragged card id");
  assert.match(dragDrop, /playCardFromHand\(cardId\)/, "general ecosystem drops should preserve support, habitat, ocean, and targeted-card rules");
});

test("invalid, canceled, and interrupted mobile hand drops share one complete cleanup path", () => {
  const cleanup = functionSectionContaining(
    simulatorSource,
    [/setMobileHandDrag\(null\)/, /setMobileSelectedHandIndex\(null\)/, /cancelCardPlay\(\)/],
    "mobile hand drag cleanup",
  );
  assert.match(cleanup, /setPlayError\(/);

  const dragDrop = functionSectionContaining(
    simulatorSource,
    [/document\.elementsFromPoint\(/, /setMobileHandDrag\(null\)|cancelMobileHand/i],
    "mobile hand drop completion",
  );
  assert.match(dragDrop, /if\s*\([^)]*!.*(?:drop|target|valid)[^)]*\)[\s\S]*?(?:cancelMobileHand|cancelCardPlay)/i, "an invalid spatial target should snap back without spending the card");
  assert.match(handDockSource, /onPointerCancel=\{\(event\) => handleCardPointerCancel\(entry, event\)\}/);
  assert.match(handDockSource, /onLostPointerCapture=\{\(event\) => handleCardLostPointerCapture\(entry, event\)\}/);
  assert.match(handDockSource, /function clearHandDragGesture[\s\S]*?onDragCancel/);
  assert.match(handDockSource, /useEffect\([\s\S]*?return\s*\(\)\s*=>[\s\S]*?(?:reset|cancel|clear)/i, "unmounting the hand must not leave a captured or lifted card behind");
});

test("an active mobile hand drag renders a ghost and visibly marks only legal drop targets", () => {
  assert.match(simulatorSource, /data-mobile-hand-drag-ghost/);
  assert.match(simulatorSource, /mobileHandDrag[\s\S]*?clientX[\s\S]*?clientY/);
  assert.match(simulatorSource, /data-hand-drop-valid=\{[^}]+\}/);
  assert.match(simulatorSource, /is-hand-drag-(?:target|valid)|seapals-hand-drop-(?:target|valid)/);
  assert.match(
    simulatorSource,
    /\.seapals-mobile-hand-drag-ghost\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?pointer-events:\s*none;[\s\S]*?z-index:/,
  );
  assert.match(simulatorSource, /\.seapals-hand-drop-(?:target|valid)|\.is-hand-drag-(?:target|valid)[\s\S]*?(?:box-shadow|filter|outline|border)/);
  assert.match(simulatorSource, /data-mobile-hand-drag-ghost[\s\S]{0,220}aria-hidden="true"|aria-hidden="true"[\s\S]{0,220}data-mobile-hand-drag-ghost/, "the visual ghost must stay outside the accessibility tree");
});

test("drag and drop preserves the existing tap and keyboard Play Card fallback", () => {
  assert.match(handDockSource, /<button[\s\S]*?type="button"[\s\S]*?aria-haspopup="dialog"/);
  assert.match(
    handDockSource,
    /onClick=\{\(event\) => handleCardClick\(entry, event\)\}/,
  );
  assert.match(handDockSource, /function handleCardClick\(entry, event\)[\s\S]*?onInspect\(entry\.cardId, entry\.index, event\.currentTarget\)/);
  assert.match(handDockSource, /(?:suppress|ignore|drag)[\w$.]*(?:Click|click)/, "the synthetic click after a completed drag should be ignored exactly once");
  assert.match(handPopoverSource, /data-tutorial-target="play-card"[\s\S]*?>\s*Play card\s*<\/button>/i);
  assert.match(simulatorSource, /function playHandPopoverCard[\s\S]*?playCardFromHand\(cardId\)/);
});

test("V2 keeps both reefs mounted around an accessible 24-to-68 percent divider", () => {
  const responsiveStyles = sourceSection(
    simulatorSource,
    "@media (max-width: 1279px)",
    "@media (max-width: 767px)",
  );

  assert.match(simulatorSource, /const MOBILE_REEF_SPLIT_MIN = 24;/);
  assert.match(simulatorSource, /const MOBILE_REEF_SPLIT_MAX = 68;/);
  assert.match(simulatorSource, /const MOBILE_REEF_SPLIT_DEFAULT = 40;/);
  assert.match(simulatorSource, /const \[mobileReefSplit, setMobileReefSplit\] = useState\(MOBILE_REEF_SPLIT_DEFAULT\)/);
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

test("moving the V2 divider continuously refits both reef cameras to their new allocation", () => {
  const splitDependency = [...simulatorSource.matchAll(/\}, \[([^\]]*mobileReefSplit[^\]]*)\]\);/g)]
    .find((match) => /previewExperience/.test(match[1]));
  assert.ok(splitDependency, "the divider allocation should drive a dedicated responsive-camera effect");
  const effectStart = simulatorSource.lastIndexOf("useEffect(() => {", splitDependency.index);
  assert.ok(effectStart >= 0, "the divider camera dependency should belong to a useEffect");
  const splitFitEffect = simulatorSource.slice(effectStart, splitDependency.index + splitDependency[0].length);

  assert.match(splitFitEffect, /if \(!previewExperience\) return undefined;/);
  assert.match(splitFitEffect, /requestAnimationFrame\(\(\) => \{/);
  assert.match(splitFitEffect, /zoomEcosystemToFit\("opponent"\)/);
  assert.match(splitFitEffect, /zoomEcosystemToFit\("player"\)/);
  assert.match(splitDependency[1], /previewExperience/);
  assert.match(splitDependency[1], /mobileReefSplit/);
  assert.doesNotMatch(splitFitEffect, /playerViewportTouched|opponentViewportTouched/);
  assert.match(splitFitEffect, /cancelAnimationFrame/);

  const splitZoomFactor = sourceSection(
    simulatorSource,
    "function getMobileReefZoomFactor(owner, split)",
    "function createEcosystemGestureState",
  );
  const fitFunction = sourceSection(
    simulatorSource,
    "function zoomEcosystemToFit(owner)",
    "function canUseSlotWithCard",
  );
  assert.match(splitZoomFactor, /const opponentShare = clampMobileReefSplit\(split\)/);
  assert.match(splitZoomFactor, /owner === "opponent" \? opponentShare : 100 - opponentShare/);
  assert.match(splitZoomFactor, /owner === "opponent" \? MOBILE_REEF_SPLIT_DEFAULT : 100 - MOBILE_REEF_SPLIT_DEFAULT/);
  assert.match(splitZoomFactor, /Math\.sqrt\(currentShare \/ defaultShare\)/);
  assert.match(splitZoomFactor, /Math\.min\(MOBILE_REEF_ZOOM_FACTOR_MAX, Math\.max\(MOBILE_REEF_ZOOM_FACTOR_MIN, factor\)\)/);
  assert.match(fitFunction, /const mobileSplitZoomFactor = previewExperience[\s\S]*?getMobileReefZoomFactor\(owner, mobileReefSplit\)/);
  assert.match(fitFunction, /sparsePlayerBoardMaxZoom \* mobileSplitZoomFactor/);
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
  assert.match(opponentScore, /data-rp-bank-target="opponent"[\s\S]*?<small>RP<\/small><strong>\{presentedOpponentRp\}<\/strong>/);
  assert.doesNotMatch(opponentScore, /victoryTarget|opponentRpCap|School Density|\/\{/);
  assert.match(playerScore, /data-tutorial-coach-anchor="player-board-tab"/);
  assert.match(playerScore, /data-tutorial-target="vp-score"[\s\S]*?<strong>\{playerVp\}<\/strong>/);
  assert.match(playerScore, /data-rp-bank-target="player"[\s\S]*?data-tutorial-target="rp-bank"[\s\S]*?<strong>\{presentedPlayerRp\}<\/strong>/);
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
  const baseBottom = Number(basePreview.match(/--seapals-mobile-hand-bottom:\s*([\d.]+)rem/)?.[1]);
  const regularBottom = Number(regularPhone.match(/--seapals-mobile-hand-bottom:\s*([\d.]+)rem/)?.[1] ?? baseBottom);
  const shortBottom = Number(shortPhone.match(/--seapals-mobile-hand-bottom:\s*([\d.]+)rem/)?.[1] ?? regularBottom);

  assert.match(panelRule, /background:\s*transparent;/);
  assert.match(panelRule, /border:\s*0;/);
  assert.match(panelRule, /box-shadow:\s*none;/);
  assert.match(panelRule, /backdrop-filter:\s*none;/);
  assert.ok(Number.isFinite(regularHeight) && regularHeight < 13, "regular phone hand height should reclaim space from the old 13rem tray");
  assert.ok(Number.isFinite(shortHeight) && shortHeight < 10, "short phone hand height should reclaim space from the old 10rem tray");
  assert.ok(Number.isFinite(regularBottom) && regularBottom <= .5, "the regular-phone hand should sit against the arena bottom");
  assert.ok(Number.isFinite(shortBottom) && shortBottom <= .5, "the short-phone hand should sit against the arena bottom");
  assert.match(simulatorSource, /--seapals-mobile-dock-clearance:\s*calc\(var\(--seapals-mobile-hand-height\) \+ (?:[\d.]+rem|var\(--seapals-mobile-hand-bottom\))\);/);
});

test("V2 aligns label-free mirrored pile columns beneath each reef's RP badge", () => {
  const opponentPane = sourceSection(
    simulatorSource,
    'id="simulator-opponent-reef"',
    '<div className="seapals-reef-divider">',
  );
  const playerPane = sourceSection(
    simulatorSource,
    'id="simulator-player-reef"',
    "{mobileHandDockVisible ? <MobileHandDock",
  );
  const edgeRule = simulatorSource.match(/\.seapals-mobile-edge-zones\s*\{([^}]*)\}/)?.[1] ?? "";
  const zoneRule = simulatorSource.match(/\.seapals-mobile-edge-zone\s*\{([^}]*)\}/)?.[1] ?? "";
  const scoreRule = simulatorSource.match(/\.seapals-reef-score\s*\{(?=[^}]*right:)([^}]*)\}/)?.[1] ?? "";
  const scoreCardRule = simulatorSource.match(/\.seapals-reef-score-card\s*\{(?=[^}]*width:)([^}]*)\}/)?.[1] ?? "";
  const mobileZoneIds = [...edgeZonesSource.matchAll(/data-mobile-zone="([^"]+)"/g)].map((match) => match[1]);

  assert.match(opponentPane, /<MobileEdgeZones[\s\S]*?owner="opponent"/);
  assert.match(opponentPane, /deckCount=\{opponent\.foundationDeck\.length \+ opponent\.palsDeck\.length\}/);
  assert.match(opponentPane, /discardCard=\{cardsById\[opponent\.discardPile\[0\]\] \?\? null\}/);
  assert.doesNotMatch(opponentPane, /onOpenDecks=/);
  assert.match(opponentPane, /onOpenDiscard=\{\(\) => setModal\("opponent-discard"\)\}/);
  assert.match(opponentPane, /onOpenLost=\{\(\) => setModal\("opponent-lost"\)\}/);
  assert.match(playerPane, /previewExperience && mobileHandDockVisible \? \([\s\S]*?<MobileEdgeZones/);
  assert.match(playerPane, /owner="player"/);
  assert.match(playerPane, /deckCount=\{foundationDeck\.length \+ palsDeck\.length\}/);
  assert.match(playerPane, /discardCard=\{cardsById\[discardPile\[0\]\] \?\? null\}/);
  assert.match(playerPane, /onOpenDiscard=\{\(\) => setModal\("discard"\)\}/);
  assert.match(playerPane, /onOpenLost=\{\(\) => setModal\("lost"\)\}/);
  assert.match(edgeZonesSource, /data-mobile-edge-zones/);
  assert.match(edgeZonesSource, /data-zone-owner=\{owner\}/);
  assert.match(edgeZonesSource, /data-tutorial-target=\{owner === "player" \? "zones" : undefined\}/);
  assert.deepEqual([...new Set(mobileZoneIds)], ["deck", "discard", "lost"]);
  assert.equal(mobileZoneIds.filter((zoneId) => zoneId === "deck").length, 2, "the inert opponent deck and interactive player deck should render separately");
  assert.equal((edgeZonesSource.match(/seapals-mobile-edge-zone-count/g) ?? []).length, 1, "only the face-down deck should show a visible count");
  assert.doesNotMatch(edgeZonesSource, /seapals-mobile-edge-zone-label/);
  assert.match(edgeZonesSource, /seapals-mobile-deck-back/);
  assert.match(edgeZonesSource, /discardCard\?\.image/);
  assert.match(edgeZonesSource, /seapals-mobile-lost-empty/);
  const directOpponentBranchStart = edgeZonesSource.indexOf('owner === "opponent" ? (');
  const namedOpponentBranchStart = edgeZonesSource.indexOf("opponentDeckHidden ? (");
  const opponentDeckBranchStart = Math.max(directOpponentBranchStart, namedOpponentBranchStart);
  const discardZoneStart = edgeZonesSource.indexOf('data-mobile-zone="discard"');
  assert.ok(opponentDeckBranchStart >= 0 && discardZoneStart > opponentDeckBranchStart, "the deck should branch by owner before the discard control");
  if (namedOpponentBranchStart >= 0) {
    assert.match(edgeZonesSource, /const opponentDeckHidden = owner === "opponent";/);
  }
  const deckOwnerBranch = edgeZonesSource.slice(opponentDeckBranchStart, discardZoneStart);
  const branchDivider = deckOwnerBranch.indexOf(") : (");
  assert.ok(branchDivider > 0, "the opponent and player deck presentations should be explicit branches");
  const opponentDeckPresentation = deckOwnerBranch.slice(0, branchDivider);
  const playerDeckPresentation = deckOwnerBranch.slice(branchDivider);
  assert.match(opponentDeckPresentation, /<div[\s\S]*?data-mobile-zone="deck"/);
  assert.match(opponentDeckPresentation, /role="img"/);
  assert.doesNotMatch(opponentDeckPresentation, /<button|onClick|onPointerDown|tabIndex|\bOpen\b/);
  assert.match(playerDeckPresentation, /<button[\s\S]*?data-mobile-zone="deck"/);
  assert.match(playerDeckPresentation, /onClick=\{onOpenDecks\}/);
  assert.match(playerDeckPresentation, /onPointerDown=/);
  assert.match(edgeZonesSource, /<button[\s\S]*?data-mobile-zone="discard"[\s\S]*?onClick=\{onOpenDiscard\}/);
  assert.match(edgeZonesSource, /<button[\s\S]*?data-mobile-zone="lost"[\s\S]*?onClick=\{onOpenLost\}/);
  assert.match(edgeRule, /position:\s*absolute;/);
  assert.match(edgeRule, /z-index:\s*59;/);
  assert.match(edgeRule, /right:\s*\.25rem;/);
  assert.match(edgeRule, /width:\s*var\(--seapals-edge-card-width\);/);
  assert.match(edgeRule, /flex-direction:\s*column;/);
  assert.match(edgeRule, /align-items:\s*center;/);
  assert.doesNotMatch(edgeRule, /grid-template|grid-column|grid-row|height:\s*min\(/);
  const edgeRight = Number(edgeRule.match(/right:\s*([\d.]+)rem/)?.[1]);
  const edgeWidth = Number(simulatorSource.match(/--seapals-edge-card-width:\s*([\d.]+)rem/)?.[1]);
  const scoreRight = Number(scoreRule.match(/right:\s*([\d.]+)rem/)?.[1]);
  const scoreWidth = Number(scoreCardRule.match(/width:\s*([\d.]+)rem/)?.[1]);
  assert.equal(edgeRight + edgeWidth / 2, scoreRight + scoreWidth / 2, "the pile rail and RP badge must share one horizontal centerline");
  assert.match(zoneRule, /min-width:\s*2\.75rem;/);
  assert.match(zoneRule, /min-height:\s*2\.75rem;/);
  assert.match(zoneRule, /aspect-ratio:\s*63\s*\/\s*88;/);
  assert.match(
    simulatorSource,
    /\.seapals-mobile-edge-zones\.is-player\s*\{\s*top:\s*calc\(\.45rem \+ 2\.7rem \+ \.25rem\);\s*\}/,
  );
  assert.match(
    simulatorSource,
    /\.seapals-mobile-edge-zones\.is-opponent\s*\{[\s\S]*?bottom:\s*calc\(\.45rem \+ 2\.7rem \+ \.25rem\);[\s\S]*?flex-direction:\s*column-reverse;/,
  );
  assert.match(
    simulatorSource,
    /\.seapals-mobile-edge-zone\.is-lost\s*\{[\s\S]*?align-self:\s*center;[\s\S]*?width:\s*2\.75rem;[\s\S]*?height:\s*2\.75rem;[\s\S]*?min-height:\s*2\.75rem;[\s\S]*?aspect-ratio:\s*1;/,
  );
  const lostRule = simulatorSource.match(/\.seapals-mobile-edge-zone\.is-lost\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.doesNotMatch(lostRule, /position:\s*absolute|grid-column|grid-row|left:|right:|top:|bottom:/);
});

test("V2 keeps only the draggable divider and round action while the old footer stays legacy-only", () => {
  const divider = sourceSection(
    simulatorSource,
    '<div className="seapals-reef-divider">',
    'id="simulator-player-reef"',
  );
  const legacyDock = sourceSection(
    simulatorSource,
    '{!previewExperience ? <div className="seapals-mobile-dock',
    "</div> : null}",
  );

  assert.doesNotMatch(divider, /seapals-reef-divider-guide|data-tutorial-target="event-feed"|>\s*Guide\s*</);
  assert.match(divider, /seapals-reef-divider-handle[\s\S]*?role="separator"/);
  assert.match(divider, /data-mobile-turn-control/);
  assert.match(divider, /onClick=\{endTurn\}/);
  assert.match(divider, /disabled=\{Boolean\(gameResult\) \|\| opponentThinking \|\| Boolean\(compactTurnSequence\) \|\| \(isSetup && !hasCoralInPlay\) \|\| isStartOfTurn\}/);
  assert.match(divider, /data-tutorial-target="turn-button"/);
  assert.match(divider, /\{turnControlLabel\}/);
  assert.doesNotMatch(divider, /Opponent First|Round 1|End Turn/);
  assert.match(simulatorSource, /const turnControlLabel = opponentThinking \? "Opponent Turn" : isSetup \? "Begin Round" : "Next Round";/);
  assert.match(
    simulatorSource,
    /\.seapals-reef-divider-control\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*50%;[\s\S]*?height:\s*calc\(100% - \.5rem\);[\s\S]*?min-height:\s*2\.25rem;[\s\S]*?transform:\s*translateY\(-50%\);/,
  );
  assert.match(simulatorSource, /\.seapals-reef-divider-turn\s*\{[\s\S]*?border-radius:\s*\.75rem;/);
  const dividerRule = simulatorSource.match(/\.seapals-reef-divider\s*\{([^}]*)\}/)?.[1] ?? "";
  const turnControlRule = simulatorSource.match(/\.seapals-reef-divider-control\s*\{([^}]*)\}/)?.[1] ?? "";
  const dividerHeight = Number(dividerRule.match(/flex:\s*0 0 ([\d.]+)rem/)?.[1]);
  const turnControlMinHeight = Number(turnControlRule.match(/min-height:\s*([\d.]+)rem/)?.[1]);
  assert.ok(
    Number.isFinite(dividerHeight) && Number.isFinite(turnControlMinHeight) && turnControlMinHeight < dividerHeight,
    "the centered round action should leave visible divider padding above and below",
  );
  assert.match(legacyDock, /Open Hand/);
  assert.match(legacyDock, /data-tutorial-target="turn-button"/);
  assert.equal((legacyDock.match(/previewExperience \?/g) ?? []).length, 1, "only the legacy wrapper should branch on previewExperience");
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
  const initialZoom = Number(simulatorSource.match(/const PREVIEW_ECOSYSTEM_INITIAL_ZOOM = ([\d.]+);/)?.[1]);
  assert.ok(Number.isFinite(initialZoom) && initialZoom > 0 && initialZoom <= .8, "the V2 camera should start comfortably zoomed out");
  assert.match(simulatorSource, /const initialEcosystemZoom = previewExperience \? PREVIEW_ECOSYSTEM_INITIAL_ZOOM : 1;/);
  assert.match(simulatorSource, /const \[ecosystemZoom, setEcosystemZoom\] = useState\(initialEcosystemZoom\)/);
  assert.match(simulatorSource, /const playerCameraRef = useRef\(\{ zoom: initialEcosystemZoom, offset: \{ x: 0, y: 0 \} \}\)/);
  assert.match(simulatorSource, /commitBoardCamera\("player", \{ zoom: initialEcosystemZoom, offset: \{ x: 0, y: 0 \} \}\s*\);/);
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
  const fitFunction = sourceSection(
    simulatorSource,
    "function zoomEcosystemToFit(owner)",
    "function canUseSlotWithCard",
  );
  const sparseRatioToken = fitFunction.match(/const sparsePlayerBoardMaxZoom = !isOpponent && corals\.length === 1 && !floatingCardsPresent[\s\S]*?rect\.width \* ([A-Za-z_$][\w$]*|(?:0?\.)?\d+)/)?.[1];
  assert.ok(sparseRatioToken, "a sparse player reef should have an explicit width cap");
  const sparseRatio = Number.isFinite(Number(sparseRatioToken))
    ? Number(sparseRatioToken)
    : Number(simulatorSource.match(new RegExp(`const ${sparseRatioToken} = ((?:0?\\.)?\\d+);`))?.[1]);
  assert.ok(Number.isFinite(sparseRatio) && sparseRatio <= .28, "a single player card should begin at no more than 28% of the reef width");
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
});

test("V2 overlays a compact back-and-menu header without consuming board height", () => {
  const responsiveStyles = sourceSection(
    simulatorSource,
    "@media (max-width: 1279px)",
    "@media (max-width: 1279px) and (max-height: 650px)",
  );
  const overlayControlsRule = responsiveStyles.match(/\.seapals-simulator-preview \.seapals-back-control,\s*\.seapals-simulator-preview \.seapals-menu-control\s*\{([^}]*)\}/)?.[1] ?? "";
  const overlayBackRule = responsiveStyles.match(/\.seapals-simulator-preview \.seapals-back-control\s*\{([^}]*)\}/)?.[1] ?? "";
  const overlayMenuRule = [...responsiveStyles.matchAll(/\.seapals-simulator-preview \.seapals-menu-control\s*\{([^}]*)\}/g)]
    .map((match) => match[1])
    .find((rule) => /right:\s*\.75rem;/.test(rule)) ?? "";

  assert.match(simulatorSource, /data-mobile-overlay-header=\{previewExperience \? "true" : undefined\}/);
  assert.equal((simulatorSource.match(/data-simulator-back-control/g) ?? []).length, 2);
  assert.match(simulatorSource, /data-simulator-menu-control/);
  assert.match(simulatorSource, /<summary[^>]*data-tutorial-target={previewExperience \? "condition-panel" : undefined}/);
  assert.match(simulatorSource, /data-tutorial-target={!previewExperience \? "condition-panel" : undefined}/);
  assert.match(
    responsiveStyles,
    /\.seapals-simulator-preview \.seapals-simulator-header\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;[\s\S]*?display:\s*block;[\s\S]*?margin:\s*0;[\s\S]*?pointer-events:\s*none;/,
  );
  assert.match(
    responsiveStyles,
    /\.seapals-simulator-preview :is\(\.seapals-simulator-title, \.seapals-phase-chip\)\s*\{[\s\S]*?position:\s*absolute !important;[\s\S]*?width:\s*1px !important;[\s\S]*?height:\s*1px !important;[\s\S]*?clip:\s*rect\(0, 0, 0, 0\) !important;[\s\S]*?clip-path:\s*inset\(50%\) !important;/,
  );
  assert.doesNotMatch(
    responsiveStyles,
    /\.seapals-simulator-preview :is\(\.seapals-simulator-title, \.seapals-phase-chip\)\s*\{[^}]*display:\s*none;/,
  );
  assert.match(overlayControlsRule, /position:\s*absolute;/);
  assert.match(overlayControlsRule, /top:\s*\.75rem;/);
  assert.match(overlayControlsRule, /margin:\s*0;/);
  assert.match(overlayControlsRule, /pointer-events:\s*auto;/);
  assert.match(overlayBackRule, /left:\s*\.75rem;/);
  assert.match(overlayMenuRule, /right:\s*\.75rem;/);
  assert.match(
    responsiveStyles,
    /\.seapals-simulator-preview \.seapals-back-control,\s*\.seapals-simulator-preview \.seapals-menu-control > summary\s*\{[\s\S]*?width:\s*2\.75rem;[\s\S]*?height:\s*2\.75rem;[\s\S]*?min-height:\s*2\.75rem;/,
  );
});

test("every simulator exit asks for confirmation before leaving the game", () => {
  const headerBackControls = sourceSection(
    simulatorSource,
    '<div className="seapals-simulator-header',
    '<div className="seapals-simulator-title">',
  );
  const menuExitControls = sourceSection(
    simulatorSource,
    '<details className="seapals-menu-control',
    '<div className="hidden items-center gap-1',
  );
  const requestExit = sourceSection(
    simulatorSource,
    "function requestSimulatorExit()",
    "function confirmSimulatorExit()",
  );
  const confirmExit = sourceSection(
    simulatorSource,
    "function confirmSimulatorExit()",
    "function confirmTutorialExit()",
  );
  const exitDialog = sourceSection(
    simulatorSource,
    "{simulatorExitConfirmationOpen ? (",
    "{eventOverlay ? (",
  );

  assert.equal((headerBackControls.match(/onClick=\{requestSimulatorExit\}/g) ?? []).length, 2, "both header back branches must request confirmation");
  assert.equal((headerBackControls.match(/data-simulator-back-control/g) ?? []).length, 2);
  assert.equal((menuExitControls.match(/onClick=\{requestSimulatorExit\}/g) ?? []).length, 2, "both menu exit branches must request confirmation");
  assert.match(requestExit, /setSimulatorExitConfirmationOpen\(true\)/);
  assert.match(confirmExit, /setSimulatorExitConfirmationOpen\(false\)[\s\S]*?window\.location\.assign\("\/"\)/);
  assert.match(exitDialog, /role="dialog"[\s\S]*?aria-modal="true"/);
  assert.match(exitDialog, />Are you sure you want to quit the game\?<\/h2>/);
  assert.match(exitDialog, /onClick=\{confirmSimulatorExit\}[\s\S]*?>\s*Quit Game\s*<\/button>/);
  assert.match(exitDialog, /onClick=\{\(\) => setSimulatorExitConfirmationOpen\(false\)\}[\s\S]*?>\s*Keep Playing\s*<\/button>/);
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
  assert.match(mobileStyles, /\.seapals-simulator-controls\s*\{\s*display:\s*contents;/);
  assert.match(mobileStyles, /\.seapals-board-tabs > button\s*\{[\s\S]*?min-height:\s*2\.75rem;/);
  assert.match(mobileStyles, /\.seapals-mobile-dock\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(simulatorSource, /className=\{`flex h-11 w-11[\s\S]*?aria-label="Zoom in on your ecosystem"/);
  assert.match(simulatorSource, /className=\{`min-h-11 w-11[\s\S]*?aria-label="Fit your ecosystem to view"/);
});
