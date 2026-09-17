import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = (
  await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8")
).replaceAll("\r\n", "\n");

function sourceBetween(startMarker, endMarker) {
  const start = simulatorSource.indexOf(startMarker);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  const end = simulatorSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return simulatorSource.slice(start, end);
}

function assertSplitSearchResultControls({ label, source, resolvePattern }) {
  assert.match(
    source,
    /on(?:Click|Inspect)=\{\(\) => inspectSearchResult\(cardId\)\}/,
    `${label} should open the shared reference preview from its inspect control`,
  );
  assert.match(
    source,
    resolvePattern,
    `${label} should retain a separate add/select control for its resolver`,
  );
}

test("deck searches share a mutation-free reference-card preview", () => {
  const inspectSearchResult = sourceBetween(
    "  function inspectSearchResult(cardId)",
    "  function inspectFloatingCard",
  );

  assert.match(inspectSearchResult, /setInspectedCard\(\{[\s\S]*owner: "reference"/);
  assert.match(inspectSearchResult, /cardId/);
  assert.match(inspectSearchResult, /reference: true/);
  assert.doesNotMatch(
    inspectSearchResult,
    /set(?:FoundationDeck|PalsDeck|Hand|DiscardPile|Rp|SearchContext|PendingCreatureAction|EventOverlay)\(/,
    "inspection must not resolve, spend, select, or otherwise mutate a search",
  );

  const cardInspector = sourceBetween(
    "      {inspectedCardData ? (",
    "      {eventOverlay && boardTargetingPresentationActive && !openingCoinBoardActive ? (",
  );
  assert.match(cardInspector, /inspectedCard\.reference/);
  assert.match(cardInspector, /inspectedCardData\.image/);
  assert.match(cardInspector, /inspectedCardData\.text/);
});

test("all seven deck-search resolution paths split inspection from add or selection", () => {
  const supportResults = sourceBetween(
    'data-tutorial-search-card-id={modal === "search" ? cardId : undefined}',
    '                {modal === "restock" ? (',
  );
  const onPlayMultiResults = sourceBetween(
    'eventOverlay.type === "choose-onplay-multi-search"',
    'eventOverlay.type === "choose-school-momentum"',
  );
  const momentumResults = sourceBetween(
    'eventOverlay.type === "choose-school-momentum"',
    'eventOverlay.type === "choose-inspection-deck"',
  );
  const explorerResults = sourceBetween(
    'eventOverlay.type === "choose-explorer-card"',
    'eventOverlay.type === "choose-clear-status-target"',
  );
  const committedActionSearchResults = sourceBetween(
    'eventOverlay.type === "choose-action-search-card"',
    'eventOverlay.type === "choose-creature-action-search"',
  );
  const creatureActionSearchResults = sourceBetween(
    'eventOverlay.type === "choose-creature-action-search"',
    'eventOverlay.type === "choose-action-discard"',
  );

  for (const path of [
    {
      label: "single-card Support search",
      source: supportResults,
      resolvePattern: /completeSupportSearch\(cardId\)/,
    },
    {
      label: "multi-card Support search",
      source: supportResults,
      resolvePattern: /toggleSupportSearchCard\(cardId\)/,
    },
    {
      label: "multi-card On Play search",
      source: onPlayMultiResults,
      resolvePattern: /on(?:Click|Choose)=\{\(\) => toggleOnPlaySearchCard\(cardId\)\}/,
    },
    {
      label: "Creature School Momentum search",
      source: momentumResults,
      resolvePattern: /on(?:Click|Choose)=\{\(\) => completeSchoolMomentum\(cardId\)\}/,
    },
    {
      label: "Explorer Jordan top-five search",
      source: explorerResults,
      resolvePattern: /on(?:Click|Choose)=\{\(\) => commitDeckInspection\(cardId\)\}/,
    },
    {
      label: "committed discard-then-search action",
      source: committedActionSearchResults,
      resolvePattern: /on(?:Click|Choose)=\{\(\) => completeActionDeckSearch\(cardId\)\}/,
    },
    {
      label: "single On Play or creature-action search",
      source: creatureActionSearchResults,
      resolvePattern: /on(?:Click|Choose)=\{\(\) => completeCreatureActionSearch\(cardId\)\}/,
    },
  ]) {
    assertSplitSearchResultControls(path);
  }
});

test("guided lesson searches use the Add to Hand button as the hand cue and hide the coach bubble", () => {
  const coachGate = sourceBetween(
    "  const embeddedLessonSearchChoiceOpen = Boolean(",
    "  const tutorialDrawTrayHelpAnchored = Boolean(",
  );
  assert.match(coachGate, /embeddedLesson\s*&& modal === "search"\s*&& tutorialHelp\?\.target === "search-card"/);
  assert.match(coachGate, /!embeddedLessonPresentationBlocked/);
  assert.match(coachGate, /!embeddedLessonAttackControlsOpen/);
  assert.match(coachGate, /&& !embeddedLessonSearchChoiceOpen/);

  const guidedSearch = sourceBetween(
    '            ) : modal === "search" ? (',
    '            ) : (\n              <div className="space-y-3">',
  );
  assert.match(guidedSearch, /tutorialTarget=\{tutorialChoice \? "search-card" : undefined\}/);
  assert.match(guidedSearch, /chooseLabel=\{searchContext\?\.maxSelect > 1 \?[^\n]+: "Add to Hand"\}/);

  const targetFinder = sourceBetween("function findTutorialTarget(", "function scrollTutorialTargetWithinContainer(");
  const guidedButtonSelector = targetFinder.indexOf("data-tutorial-search-action-card-id");
  const cardFallbackSelector = targetFinder.indexOf("data-tutorial-search-card-id");
  assert.ok(guidedButtonSelector >= 0 && guidedButtonSelector < cardFallbackSelector, "guided search must find Add to Hand before the card wrapper");
  assert.match(targetFinder, /help\.target === "search-card"/);

  const searchChoice = sourceBetween("function DeckSearchChoice({", "function getDeckOrderOccurrenceKey(");
  const compactChoice = searchChoice.slice(searchChoice.indexOf("  if (compact) {"), searchChoice.indexOf("  return (\n    <div"));
  const regularChoice = searchChoice.slice(searchChoice.indexOf("  return (\n    <div"));
  for (const [label, choice] of [["compact", compactChoice], ["regular", regularChoice]]) {
    const wrapper = choice.slice(0, choice.indexOf("<button"));
    const chooseButtonStart = choice.lastIndexOf("<button");
    const chooseButton = choice.slice(chooseButtonStart, choice.indexOf("</button>", chooseButtonStart));
    assert.match(wrapper, /data-tutorial-target=\{tutorialTarget\}/, `${label} wrapper keeps scripted search targeting`);
    assert.match(wrapper, /data-tutorial-search-card-id=\{tutorialSearchCardId\}/);
    assert.match(chooseButton, /data-tutorial-search-action-card-id=\{[^}]*tutorialSearchCardId[^}]*\}/);
    assert.match(chooseButton, /aria-label=\{`\$\{chooseLabel\} \$\{card\.name\}`\}/);
    assert.match(chooseButton, /onClick=\{onChoose\}/);
  }

  const handCue = sourceBetween("          <EmbeddedLessonActionCue\n            help={tutorialHelp}", "          {embeddedLessonActionReady && !embeddedLessonPresentationBlocked ? (");
  assert.match(handCue, /active=\{embeddedLessonActionReady && !embeddedLessonPresentationBlocked && tutorialTargetBeaconOpen\}/);
  const targetFocus = sourceBetween(
    "  useEffect(() => {\n    if (!(embeddedLessonCoachOpen || embeddedLessonSearchChoiceOpen)",
    "  const tutorialAnnouncementHelp =",
  );
  assert.match(targetFocus, /findTutorialTarget\(tutorialHelp, \{ includeOffscreen: true \}\)/);
  assert.match(targetFocus, /target\.element\.focus\?\.\(\{ preventScroll: true \}\)/);
});
