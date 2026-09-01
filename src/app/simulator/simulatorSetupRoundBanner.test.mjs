import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("V2 enters setup through the compact round banner while legacy and tutorial boards keep their setup event", () => {
  const chooseOpeningTurn = sourceSection(
    simulatorSource,
    "function chooseOpeningTurn(playerChoice = OpeningPlayer.PLAYER)",
    "function openOpeningCoinFlip()",
  );

  assert.match(chooseOpeningTurn, /const setupRoundEvent = \{/);
  assert.match(chooseOpeningTurn, /type: "round-transition"/);
  assert.match(chooseOpeningTurn, /title: "Setup Round"/);
  assert.match(
    chooseOpeningTurn,
    /if \(compactTurnPresentationEnabled\) \{[\s\S]*?setEventOverlay\(null\);[\s\S]*?beginCompactTurnSequence\(\{[\s\S]*?owner: "player"[\s\S]*?turnLabel: setupRoundEvent\.title[\s\S]*?includeCondition: false[\s\S]*?includeRp: false[\s\S]*?\}\);[\s\S]*?\} else \{[\s\S]*?setEventOverlay\(setupRoundEvent\);[\s\S]*?\}/,
  );
  assert.doesNotMatch(
    chooseOpeningTurn,
    /setEventOverlay\(\{[\s\S]*?type: "round-transition"/,
    "The setup event should be routed through the V2/legacy branch instead of always opening a modal.",
  );
});
