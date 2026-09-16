import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = (await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8"))
  .replaceAll("\r\n", "\n");

function sourceSection(startMarker, endMarker) {
  const start = simulatorSource.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = simulatorSource.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return simulatorSource.slice(start, end);
}

test("successful Arrow Crab Scavenge preserves its search mutations and stages one deck-to-hand arrival", () => {
  const completeSearch = sourceSection(
    "function completeActionDeckSearch(cardId)",
    "function completeEmptyCommittedActionSearch()",
  );

  assert.match(completeSearch, /pendingCreatureAction\?\.searchCandidates\?\.includes\(cardId\)/);
  assert.match(completeSearch, /const foundDeckType = getPersonalDeckType\(foundCard\)/);
  assert.match(
    completeSearch,
    /setFoundationDeck\(shuffle\(removeOneCard\(foundationDeck, cardId\), nextGameplayRandom\)\)/,
  );
  assert.match(
    completeSearch,
    /setPalsDeck\(shuffle\(removeOneCard\(palsDeck, cardId\), nextGameplayRandom\)\)/,
  );
  assert.match(completeSearch, /const handResult = applyCurrentHandLimit\(\[cardId\]\)/);
  assert.match(
    completeSearch,
    /if \(handResult\.cardsToHand\.length\) setHand\(\(current\) => \[\.\.\.current, cardId\]\)/,
  );
  assert.match(
    completeSearch,
    /if \(handResult\.cardsToDiscard\.length\) setDiscardPile\(\(current\) => \[cardId, \.\.\.current\]\)/,
  );
  assert.match(completeSearch, /const discardedNames = \(pendingCreatureAction\.discardedCards \?\? \[\]\)/);
  assert.match(completeSearch, /pushLog\(message\)/);
  assert.match(completeSearch, /setPendingCreatureAction\(null\)/);

  assert.match(completeSearch, /setEventOverlay\(null\)/);
  assert.doesNotMatch(completeSearch, /type:\s*"utility-result"/);
  assert.equal(
    (completeSearch.match(/setPendingHandArrivalFlight\(/g) ?? []).length,
    1,
    "a successful search should stage one arrival sequence",
  );
  assert.match(
    completeSearch,
    /setPendingHandArrivalFlight\(handResult\.cardsToHand\.length \? \{[\s\S]*?revealed: \[\{[\s\S]*?cardId,[\s\S]*?source: foundDeckType === "foundation" \? "Foundation" : "Pals",[\s\S]*?discarded: false,[\s\S]*?\}\],[\s\S]*?baseHandLength: hand\.length,[\s\S]*?kind: "deck-search",[\s\S]*?announcement: `\$\{foundCard\?\.name \?\? cardId\} was added to your hand\.`,[\s\S]*?\} : null\)/,
    "only a card that entered the hand should fly from its personal deck into the next hand index",
  );
});

test("only successful committed Scavenge drops its blocker", () => {
  const emptyCommittedSearch = sourceSection(
    "function completeEmptyCommittedActionSearch()",
    "function completeDefensiveBuff(slotId)",
  );
  assert.match(emptyCommittedSearch, /setPendingCreatureAction\(null\)/);
  assert.match(emptyCommittedSearch, /pushLog\(message\)/);
  assert.match(
    emptyCommittedSearch,
    /setEventOverlay\(\{[\s\S]*?type: "utility-result"[\s\S]*?success: false/,
    "an empty committed search should retain its explanatory result",
  );

  const ordinaryRecovery = sourceSection(
    "function completeCreatureRecovery(cardId, sourceElement = null)",
    "function completeCreatureActionSearch(cardId)",
  );
  assert.match(
    ordinaryRecovery,
    /if \(animateTutorialRecovery\) \{[\s\S]*?\} else \{[\s\S]*?setEventOverlay\(\{ type: "utility-result"[\s\S]*?success: true \}\);[\s\S]*?\}/,
    "ordinary creature recovery should retain its result overlay outside the tutorial flight",
  );
});
