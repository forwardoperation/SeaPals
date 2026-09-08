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

function functionSection(name) {
  const marker = `function ${name}(`;
  const start = simulatorSource.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  const nextFunction = simulatorSource.indexOf("\nfunction ", start + marker.length);
  assert.notEqual(nextFunction, -1, `missing function after ${name}`);
  return simulatorSource.slice(start, nextFunction);
}

function localFunctionSection(name) {
  const marker = `  function ${name}(`;
  const start = simulatorSource.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  const nextFunction = simulatorSource.indexOf("\n  function ", start + marker.length);
  assert.notEqual(nextFunction, -1, `missing function after ${name}`);
  return simulatorSource.slice(start, nextFunction);
}

function eventBranch(type, nextType) {
  return sourceBetween(
    simulatorSource,
    `                ) : eventOverlay.type === "${type}" ? (`,
    `                ) : eventOverlay.type === "${nextType}" ? (`,
  );
}

test("deck ordering uses one compact list for Support and creature-action reorders", () => {
  const supportBranch = eventBranch("reorder-deck", "choose-explorer-card");
  const creatureBranch = eventBranch("reorder-creature-action-deck", "choose-action-deck");

  for (const [label, branch] of [
    ["Support", supportBranch],
    ["creature action", creatureBranch],
  ]) {
    assert.match(branch, /<CompactDeckOrderList\b/, `${label} reorder should use the shared compact list`);
    assert.doesNotMatch(branch, /<img\b/, `${label} reorder should not repeat full card artwork`);
    assert.doesNotMatch(branch, /\bh-40\b/, `${label} reorder should not retain the tall card grid`);
    assert.doesNotMatch(branch, />Earlier</, `${label} reorder should not require large per-card Earlier controls`);
    assert.doesNotMatch(branch, />Later</, `${label} reorder should not require large per-card Later controls`);
  }

  assert.match(supportBranch, /searchContext\?\.topCards\s*\?\?\s*\[\]/);
  assert.match(supportBranch, /moveInspectedDeckCard/);
  assert.match(creatureBranch, /pendingCreatureAction\?\.topCards\s*\?\?\s*\[\]/);
  assert.match(creatureBranch, /moveCreatureActionDeckCard/);
});

test("ordering gets a bounded compact dialog instead of the full source-card reader", () => {
  const routing = sourceBetween(
    simulatorSource,
    "  const compactDeckOrderEvent = Boolean([",
    "  const compactDeckSearchSourceCard =",
  );
  assert.match(routing, /"reorder-deck"/);
  assert.match(routing, /"reorder-creature-action-deck"/);

  const dialog = sourceBetween(
    simulatorSource,
    "      {eventOverlay && boardTargetingPresentationActive && !openingCoinBoardActive ? (",
    "      {fullPageModalOpen ? (",
  );
  assert.match(dialog, /compactDialogEvent\s*=|!compactDialogEvent/);
  assert.match(dialog, /eventOverlay\.sourceCardId && !compactDialogEvent/);
  assert.match(dialog, /seapals-compact-order-event max-w-xl/);
  assert.match(dialog, /Top card draws first[^<]*[·â€“-][^<]*Drag a row to reorder/);

  const css = sourceBetween(
    simulatorSource,
    "        .seapals-event-card.seapals-compact-order-event {",
    "        .seapals-event-card.seapals-compact-search-event,",
  );
  assert.match(css, /height:\s*min\(/, "the compact reorder should fit within the viewport");
  assert.match(css, /overflow:\s*hidden;/, "only the ordered rows should scroll");
  assert.match(css, /\.seapals-deck-order-list\s*\{[\s\S]*?overflow-y:\s*auto;/);
  assert.match(css, /\.seapals-compact-order-footer\s*\{[\s\S]*?flex:\s*0 0 auto;/);
});

test("compact order rows show only position and card name in flattened draggable slots", () => {
  const list = functionSection("CompactDeckOrderList");

  assert.match(list, /cardsById\[cardId\]/, "rows should resolve each ordered card by id");
  assert.match(list, /card\?\.name|card\.name/, "the card name should remain the row's primary label");
  assert.match(list, /index\s*\+\s*1/, "rows should plainly communicate top-to-bottom position");
  assert.doesNotMatch(list, /<img\b|card\?*\.image|card\.image/, "name-only rows must omit card artwork");
  assert.match(list, /<ol\b|role="list"/, "the ordered collection should expose list semantics");
  assert.match(list, /<li\b|role="listitem"/, "each flattened slot should expose list-item semantics");
  assert.match(list, /draggable/, "mouse users should be able to drag a row");
  assert.match(list, /onDragStart/);
  assert.match(list, /onDrop/);
  assert.match(list, /onPointerDown/);
  assert.match(list, /onPointerMove/);
  assert.match(list, /onPointerUp|onPointerCancel/);
  assert.match(list, /return rows\.length;/, "dragging below the last row should expose an end insertion slot");
  assert.match(list, /getDeckOrderDestinationIndex\(/, "drop slots should normalize after the dragged row is removed");
  assert.match(list, /is-drop-target-after/, "an end drop should show its marker below the final row");
});

test("compact drag ordering retains an accessible non-drag fallback", () => {
  const list = functionSection("CompactDeckOrderList");

  assert.match(
    list,
    /aria-label=\{?[^\n]*(?:earlier|up)/i,
    "each row should offer an accessible move-earlier control",
  );
  assert.match(
    list,
    /aria-label=\{?[^\n]*(?:later|down)/i,
    "each row should offer an accessible move-later control",
  );
  assert.match(list, /disabled=\{[^}]*index[^}]*\}/, "edge movement controls should be disabled");
});

test("confirming keeps the visible top-to-bottom order and leaves the deck tail untouched", () => {
  const supportCommit = localFunctionSection("commitDeckInspection");
  const creatureCommit = localFunctionSection("commitCreatureActionReorder");

  assert.match(
    supportCommit,
    /replacementTop\s*=\s*searchContext\.topCards[\s\S]*?nextDeck\s*=\s*\[\.\.\.replacementTop,\s*\.\.\.deck\.slice\(searchContext\.topCards\.length\)\]/,
    "Support reorder should commit the displayed order as the deck top",
  );
  assert.match(
    creatureCommit,
    /nextDeck\s*=\s*\[\.\.\.pendingCreatureAction\.topCards,\s*\.\.\.deck\.slice\(pendingCreatureAction\.topCards\.length\)\]/,
    "Smooth Operator should commit the displayed order as the deck top",
  );
});
