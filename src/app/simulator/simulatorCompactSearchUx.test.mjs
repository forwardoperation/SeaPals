import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = (
  await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8")
).replaceAll("\r\n", "\n");

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

function eventSearchBranch(type, nextType) {
  return sourceBetween(
    simulatorSource,
    `                ) : eventOverlay.type === "${type}" ? (`,
    `                ) : eventOverlay.type === "${nextType}" ? (`,
  );
}

test("all five event searches and the generic Support search use the compact shell", () => {
  const routing = sourceBetween(
    simulatorSource,
    "  const compactDeckSearchEvent = Boolean(previewExperience && [",
    "  const compactDeckSearchSourceCard =",
  );
  const routedTypes = [...routing.matchAll(/"([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(routedTypes, [
    "choose-onplay-multi-search",
    "choose-school-momentum",
    "choose-explorer-card",
    "choose-action-search-card",
    "choose-creature-action-search",
  ]);

  const eventDialog = sourceBetween(
    simulatorSource,
    "      {eventOverlay && boardTargetingPresentationActive && !openingCoinBoardActive ? (",
    "      {fullPageModalOpen ? (",
  );
  assert.match(eventDialog, /data-compact-deck-search=\{compactDeckSearchEvent \? eventOverlay\.type : undefined\}/);
  assert.match(eventDialog, /compactDeckSearchEvent \? "seapals-compact-search-event max-w-3xl"/);

  const supportDialog = sourceBetween(
    simulatorSource,
    "      {fullPageModalOpen ? (",
    "    </main>",
  );
  assert.match(supportDialog, /data-compact-deck-search=\{modal === "search" \? "support" : undefined\}/);
  assert.match(supportDialog, /modal === "search" \? "seapals-compact-search-modal max-w-3xl"/);
  assert.match(supportDialog, /\) : modal === "search" \? \(\n\s*<div className="seapals-compact-search-body">/);
});

test("compact search omits full-size source art and locks chrome around the choice rail", () => {
  const eventDialog = sourceBetween(
    simulatorSource,
    "      {eventOverlay && boardTargetingPresentationActive && !openingCoinBoardActive ? (",
    "      {fullPageModalOpen ? (",
  );
  assert.match(
    eventDialog,
    /eventOverlay\.sourceCardId && !compactDrawResultEvent && !compactDeckSearchEvent \? <div/,
    "full-size source art must be gated off for compact deck searches",
  );

  const compactHeader = sourceBetween(
    eventDialog,
    "                {compactDeckSearchEvent ? (",
    "                ) : (",
  );
  assert.match(compactHeader, /<header className="seapals-compact-search-context">/);
  assert.match(compactHeader, /className="seapals-compact-search-source rounded-lg bg-white object-contain"/);
  assert.doesNotMatch(compactHeader, /\bh-80\b/, "compact search must not restore the large source-card image");

  const compactCss = sourceBetween(
    simulatorSource,
    "        .seapals-event-card.seapals-compact-search-event,",
    "        .seapals-hand-card-popover-layer",
  );
  const shellRule = sourceBetween(
    compactCss,
    "        .seapals-event-card.seapals-compact-search-event,",
    "        .seapals-compact-search-layout,",
  );
  assert.match(shellRule, /height: min\(34rem, calc\(100dvh - 1\.5rem\)\);/);
  assert.match(shellRule, /max-height: calc\(100dvh - 1\.5rem\);/);
  assert.match(shellRule, /overflow: hidden;/);
  assert.match(shellRule, /flex-direction: column;/);

  const layoutRule = sourceBetween(
    compactCss,
    "        .seapals-compact-search-layout,",
    "        .seapals-compact-search-context",
  );
  assert.match(layoutRule, /min-height: 0;/);
  assert.match(layoutRule, /flex: 1 1 auto;/);

  const headerRule = sourceBetween(
    compactCss,
    "        .seapals-compact-search-context",
    "        .seapals-compact-search-source",
  );
  assert.match(headerRule, /flex: 0 0 auto;/, "the instruction header should not scroll away");

  const chromeRule = sourceBetween(
    compactCss,
    "        .seapals-compact-search-facts,",
    "        .seapals-compact-search-rail",
  );
  assert.match(chromeRule, /\.seapals-compact-search-footer/);
  assert.match(chromeRule, /flex: 0 0 auto;/, "facts, toolbar, and footer should stay outside the scrolling rail");
});

test("the choice rail is horizontal-only, touch friendly, and keeps a 44px short-viewport choice target", () => {
  const choice = sourceBetween(
    simulatorSource,
    "function DeckSearchChoice({",
    "function CompactSearchToolbar",
  );
  const rail = sourceBetween(
    simulatorSource,
    "function CompactSearchRail({",
    "function isFoundationCard",
  );

  assert.match(rail, /role="list"/);
  assert.match(rail, /tabIndex=\{0\}/);
  assert.match(rail, /snap-x snap-mandatory/);
  assert.match(rail, /overflow-x-auto overflow-y-hidden/);
  assert.match(rail, /overscroll-x-contain/);
  assert.match(rail, /touch-pan-x/);
  assert.doesNotMatch(rail, /overflow-y-auto/);
  assert.match(choice, /className=\{`mt-2 min-h-11 w-full/);

  const shortViewportCss = sourceBetween(
    simulatorSource,
    "        @media (max-height: 31rem) {",
    "        .seapals-hand-card-popover-layer",
  );
  const shortChoiceRule = shortViewportCss.match(
    /\.seapals-compact-search-choice \[data-compact-search-control\]:last-child \{([^}]*)\}/,
  );
  assert.ok(shortChoiceRule, "short viewports should retain an explicit compact choice target rule");
  const minHeight = shortChoiceRule[1].match(/min-height:\s*([\d.]+)rem/);
  assert.ok(minHeight, "short viewport target should declare a rem min-height");
  assert.ok(Number(minHeight[1]) >= 2.75, "short viewport choice target must remain at least 44px");

  assert.match(choice, /seapals-compact-search-details/, "inspection must have a visible Details affordance");
  const toolbar = sourceBetween(
    simulatorSource,
    "function CompactSearchToolbar({",
    "function CompactSearchRail({",
  );
  assert.match(toolbar, /className="grid size-11/, "rail arrow controls should remain 44px");
  assert.match(toolbar, /disabled=\{edges\.start\}/);
  assert.match(toolbar, /disabled=\{edges\.end\}/);

  assert.match(shortViewportCss, /@media \(max-height: 31rem\) and \(min-aspect-ratio: 6 \/ 5\)/);
  assert.match(shortViewportCss, /grid-template-columns: minmax\(11rem, \.72fr\) minmax\(0, 1\.28fr\)/);
  assert.match(shortViewportCss, /\.seapals-compact-search-content > \.seapals-compact-search-body/);
});

test("every compact search keeps inspection separate from choosing or resolving", () => {
  const branchSpecs = [
    ["choose-onplay-multi-search", "choose-school-momentum", /onChoose=\{\(\) => toggleOnPlaySearchCard\(cardId\)\}/],
    ["choose-school-momentum", "choose-inspection-deck", /onChoose=\{\(\) => completeSchoolMomentum\(cardId\)\}/],
    ["choose-explorer-card", "choose-clear-status-target", /onChoose=\{\(\) => commitDeckInspection\(cardId\)\}/],
    ["choose-action-search-card", "choose-creature-action-search", /onChoose=\{\(\) => completeActionDeckSearch\(cardId\)\}/],
    ["choose-creature-action-search", "choose-action-discard", /onChoose=\{\(\) => completeCreatureActionSearch\(cardId\)\}/],
  ];

  for (const [type, nextType, resolver] of branchSpecs) {
    const branch = eventSearchBranch(type, nextType);
    assert.match(branch, /className="seapals-compact-search-body"/, `${type} should use the compact body`);
    assert.match(branch, /<CompactSearchRail/, `${type} should use the shared horizontal rail`);
    assert.match(branch, /onInspect=\{\(\) => inspectSearchResult\(cardId\)\}/, `${type} should inspect without resolving`);
    assert.match(branch, resolver, `${type} should keep a distinct choose callback`);
    assert.match(branch, /\bcompact\b/, `${type} should render compact choices`);
  }

  const supportBranch = sourceBetween(
    simulatorSource,
    "            ) : modal === \"search\" ? (",
    "            ) : (\n              <div className=\"space-y-3\">",
  );
  assert.match(supportBranch, /onInspect=\{\(\) => inspectSearchResult\(cardId\)\}/);
  assert.match(
    supportBranch,
    /onChoose=\{\(\) => searchContext\?\.maxSelect > 1 \? toggleSupportSearchCard\(cardId\) : completeSupportSearch\(cardId\)\}/,
  );

  const compactChoice = sourceBetween(
    simulatorSource,
    "  if (compact) {",
    "  return (\n    <div",
  );
  assert.match(compactChoice, /onClick=\{\(event\) => onInspect\(card\.id, event\)\}/);
  assert.match(compactChoice, /onClick=\{onChoose\}/);
  assert.ok(
    compactChoice.indexOf("onInspect(card.id, event)") < compactChoice.indexOf("onClick={onChoose}"),
    "inspect and choose should remain two ordered controls",
  );
});

test("zero, one, and many-result searches remain understandable and escapable", () => {
  const toolbar = sourceBetween(
    simulatorSource,
    "function CompactSearchToolbar({",
    "function CompactSearchRail({",
  );
  assert.match(toolbar, /\{count\} \{count === 1 \? "choice" : "choices"\}/);
  assert.match(toolbar, /\{count > 1 \? \(/, "pagination controls should appear only when there are multiple choices");

  const modalHeader = sourceBetween(
    simulatorSource,
    "      {fullPageModalOpen ? (",
    "            {tutorialHelpInline && modal && modal !== \"search\" ? (",
  );
  assert.match(modalHeader, /modal === "search" && !modalCards\.length/);
  assert.match(modalHeader, /if \(modal === "search"[^\n]+cancelSupportSearch\(\)/);
  assert.match(modalHeader, />\s*Close\s*<\/button>/s);

  const supportBranch = sourceBetween(
    simulatorSource,
    "            ) : modal === \"search\" ? (",
    "            ) : (\n              <div className=\"space-y-3\">",
  );
  assert.match(supportBranch, /\{modalCards\.length \? \(/);
  assert.match(supportBranch, /role="status"/);
  assert.match(supportBranch, /<CompactSearchEmpty detail="Close this search/);
  assert.match(supportBranch, /Nothing will be spent/);
  assert.match(supportBranch, /autoFocus=\{cardIndex === 0\}/, "the first of one or many choices should receive focus");
  assert.match(supportBranch, /disabled=\{!searchContext\.selected\.length\}/, "multi-select confirmation should not resolve an empty selection");

  const explorerBranch = eventSearchBranch("choose-explorer-card", "choose-clear-status-target");
  assert.match(explorerBranch, /autoFocus=\{!searchContext\?\.candidates\?\.length\}/);
  assert.match(explorerBranch, /onClick=\{\(\) => commitDeckInspection\(\)\}/);
  assert.match(explorerBranch, />Choose None<\/button>/);
});

test("search headings name the eligible card type and keep decisions out of paragraph copy", () => {
  const targetNouns = sourceBetween(
    simulatorSource,
    "function getSearchTargetNouns(",
    "function DeckSearchChoice({",
  );
  assert.match(targetNouns, /effect\?\.targetCardId/);
  assert.match(targetNouns, /targetTags\.includes\("creature-school"\)/);
  assert.match(targetNouns, /\[stagePrefix, "Creature School"\]/);
  assert.match(targetNouns, /effect\?\.targetCategories/);
  assert.match(targetNouns, /effect\?\.targetZone/);

  const presentation = sourceBetween(
    simulatorSource,
    "  const compactDeckSearchPresentation = compactDeckSearchEvent ? (() => {",
    "  const v2NewGameSetupActive = Boolean(",
  );
  assert.match(presentation, /title: "Choose a Creature School"/);
  assert.match(presentation, /title: `Choose up to \$\{maximum\} \$\{maximum === 1 \? targetNouns\.singular : targetNouns\.plural\}`/);
  assert.match(presentation, /title: `Choose one \$\{targetNouns\.singular\}`/);
  assert.match(presentation, /facts: \["Optional", "Adds to hand", "Decks shuffle"\]/);

  const supportHeader = sourceBetween(
    simulatorSource,
    "            <div className={`${modal === \"search\" ? \"seapals-compact-search-modal-header mb-2\"",
    "            {tutorialHelpInline && modal && modal !== \"search\" ? (",
  );
  assert.match(supportHeader, /modalSearchTargetNouns\?\.plural/);
  assert.match(supportHeader, /modalSearchTargetNouns\?\.singular/);
  assert.match(supportHeader, /Nothing is spent until you confirm a choice/);
});

test("mandatory empty searches resolve instead of trapping the turn", () => {
  const momentumBranch = eventSearchBranch("choose-school-momentum", "choose-inspection-deck");
  assert.match(momentumBranch, /<CompactSearchEmpty/);
  assert.match(momentumBranch, /onAction=\{completeEmptySchoolMomentumSearch\}/);

  const committedBranch = eventSearchBranch("choose-action-search-card", "choose-creature-action-search");
  assert.match(committedBranch, /<CompactSearchEmpty/);
  assert.match(committedBranch, /onAction=\{completeEmptyCommittedActionSearch\}/);

  const multiBranch = eventSearchBranch("choose-onplay-multi-search", "choose-school-momentum");
  assert.match(multiBranch, /disabled=\{!searchContext\?\.selected\.length\}/);
  assert.match(multiBranch, /autoFocus=\{!searchContext\?\.candidates\?\.length\}/);
});

test("duplicate card IDs aggregate into one choice while exposing copy counts", () => {
  const supportSearchSetup = sourceBetween(
    simulatorSource,
    "      const searchEffect = (card.effects ?? []).find((effect) => effect.type === EffectType.SEARCH_DECK);",
    "      setSelectedHandCard(null);",
  );
  assert.match(supportSearchSetup, /const candidates = \[\.\.\.new Set\(\[\.\.\.foundationDeck, \.\.\.palsDeck\]\.filter/);

  const onPlaySetup = sourceBetween(
    simulatorSource,
    "  function beginPlayerOnPlaySearch(card, locationKey)",
    "  function beginPlayerOnPlayDraw",
  );
  assert.match(onPlaySetup, /const candidates = \[\.\.\.new Set\(\[\.\.\.foundationDeck, \.\.\.palsDeck\]\.filter/);

  const supportBranch = sourceBetween(
    simulatorSource,
    "            ) : modal === \"search\" ? (",
    "            ) : (\n              <div className=\"space-y-3\">",
  );
  assert.match(supportBranch, /const selectedCopies = searchContext\?\.selected\?\.filter/);
  assert.match(supportBranch, /const availableCopies = \[\.\.\.foundationDeck, \.\.\.palsDeck\]\.filter/);
  assert.match(supportBranch, /key=\{cardId\}/);
  assert.match(supportBranch, /`\$\{availableCopies\} copies available`/);

  const onPlayBranch = eventSearchBranch("choose-onplay-multi-search", "choose-school-momentum");
  assert.match(onPlayBranch, /const selectedCopies = searchContext\.selected\.filter/);
  assert.match(onPlayBranch, /const availableCopies = \[\.\.\.foundationDeck, \.\.\.palsDeck\]\.filter/);
  assert.match(onPlayBranch, /`\$\{availableCopies\} copies available`/);

  const explorerBranch = eventSearchBranch("choose-explorer-card", "choose-clear-status-target");
  assert.match(explorerBranch, /\[\.\.\.new Set\(searchContext\.candidates\)\]\.map/);
  assert.match(explorerBranch, /`\$\{availableCopies\} copies in the top 5`/);
});

test("compact search supplies rail keys, focus traps, and inspector focus restoration", () => {
  const rail = sourceBetween(
    simulatorSource,
    "function CompactSearchRail({",
    "function isFoundationCard",
  );
  assert.match(rail, /\["ArrowLeft", "ArrowRight", "Home", "End"\]/);
  assert.match(rail, /querySelectorAll\("\[data-search-choice-card\]"\)/);
  assert.match(rail, /querySelectorAll\("\[data-compact-search-control\]:not\(:disabled\)"\)/);
  assert.match(rail, /keyboardEvent\.preventDefault\(\)/);
  assert.match(rail, /target\.focus\(\)/);
  assert.match(rail, /scrollIntoView\(\{ block: "nearest", inline: "nearest" \}\)/);

  const eventDialog = sourceBetween(
    simulatorSource,
    "      {eventOverlay && boardTargetingPresentationActive && !openingCoinBoardActive ? (",
    "      {fullPageModalOpen ? (",
  );
  assert.match(eventDialog, /keyboardEvent\.key !== "Tab"/);
  assert.match(eventDialog, /getCompactDialogFocusableControls\(keyboardEvent\.currentTarget\)/);
  assert.match(eventDialog, /keyboardEvent\.shiftKey && document\.activeElement === first/);
  assert.match(eventDialog, /document\.activeElement === last/);
  assert.match(eventDialog, /aria-hidden=\{inspectedCardData/);
  assert.match(eventDialog, /inert=\{inspectedCardData/);

  const supportDialog = sourceBetween(
    simulatorSource,
    "      {fullPageModalOpen ? (",
    "    </main>",
  );
  assert.match(supportDialog, /if \(modal !== "search" \|\| keyboardEvent\.key !== "Tab"\) return;/);
  assert.match(supportDialog, /getCompactDialogFocusableControls\(keyboardEvent\.currentTarget\)/);
  assert.match(supportDialog, /aria-hidden=\{inspectedCardData \? "true" : undefined\}/);
  assert.match(supportDialog, /inert=\{inspectedCardData \|\| undefined\}/);

  const focusableHelper = sourceBetween(
    simulatorSource,
    "function getCompactDialogFocusableControls(",
    "function isFoundationCard",
  );
  assert.match(focusableHelper, /button:not\(:disabled\)/);
  assert.match(focusableHelper, /\[tabindex\]:not\(\[tabindex="-1"\]\)/);
  assert.match(focusableHelper, /getClientRects\(\)\.length > 0/);

  const inspectorFunctions = sourceBetween(
    simulatorSource,
    "  function inspectSearchResult(cardId)",
    "  function inspectFloatingCard",
  );
  assert.match(inspectorFunctions, /document\.activeElement instanceof HTMLElement/);
  assert.match(inspectorFunctions, /inspectorReturnFocusRef\.current = document\.activeElement/);
  assert.match(inspectorFunctions, /const returnTarget = inspectorReturnFocusRef\.current/);
  assert.match(inspectorFunctions, /if \(returnTarget\?\.isConnected\)/);
  assert.match(inspectorFunctions, /window\.requestAnimationFrame\(\(\) => returnTarget\.focus\(\)\)/);
});
