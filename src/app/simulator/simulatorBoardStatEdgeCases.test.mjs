import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = (await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8"))
  .replaceAll("\r\n", "\n");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("Symbiosis-hosted Clownfish animates its VP from the exact hosted card without a result blocker", () => {
  const symbiosis = sourceSection(
    simulatorSource,
    "function completeSymbiosis(",
    "function completeTerritorialTarget(",
  );
  const successStart = symbiosis.indexOf("if (cardId && searchContext.candidates.includes(cardId)");
  const failureStart = symbiosis.indexOf("\n    const message = cardId", successStart);
  assert.ok(successStart >= 0 && failureStart > successStart, "Could not isolate successful Symbiosis resolution");
  const success = symbiosis.slice(successStart, failureStart);

  assert.match(
    success,
    /getPlayerBoardStatSnapshot\s*\(\s*\{[\s\S]*?corals\s*:/,
    "the hosted Clownfish must be included in the post-play VP snapshot",
  );
  assert.match(
    success,
    /beginBoardStatPresentation\s*\(\s*\{[\s\S]*?cardInstanceId\s*:[\s\S]*?cardName\s*:[\s\S]*?before\s*:\s*getCurrentPlayerBoardStats\(\)[\s\S]*?after\s*:/,
    "the successful attachment should launch the same held-counter VP presentation as other card plays",
  );
  assert.ok(
    /getHostedTargetSlotId\(\s*sourceSlot\.id\s*,/.test(success)
      || /`hosted:\$\{sourceSlot\.id\}:\$\{[^}]*[Ii]ndex[^}]*\}`/.test(success),
    "the flight must target the exact hosted-card DOM instance rather than the Anemone",
  );
  assert.match(success, /setEventOverlay\(null\)/, "the mandatory chooser should close back to the board");
  assert.doesNotMatch(
    success,
    /setEventOverlay\(\s*\{\s*type:\s*"utility-result"/,
    "a successful Symbiosis attachment should not replace the VP flight with the old generic result page",
  );
});

test("any no-On-Play open-water stat presentation suppresses the generic result page", () => {
  const oceanicPlay = sourceSection(
    simulatorSource,
    "function completePlayerOceanicPlay(",
    "function returnFromSupportFlowToBoard(",
  );
  const presentationAssignment = oceanicPlay.match(
    /const\s+(\w*(?:boardStat|statPresentation)\w*)\s*=\s*beginBoardStatPresentation\s*\(/i,
  );
  assert.ok(
    presentationAssignment,
    "open-water play should retain whether a board-stat presentation actually started",
  );

  const nullIndex = oceanicPlay.lastIndexOf("setEventOverlay(null)");
  const conditionStart = oceanicPlay.lastIndexOf("} else if (", nullIndex);
  const conditionEnd = oceanicPlay.indexOf(") {", conditionStart);
  assert.ok(conditionStart >= 0 && conditionEnd > conditionStart, "Could not isolate generic-result suppression guard");
  const suppressionGuard = oceanicPlay.slice(conditionStart, conditionEnd + 3);

  assert.match(suppressionGuard, /previewExperience/);
  assert.match(
    suppressionGuard,
    new RegExp(`\\b${presentationAssignment[1]}\\b`),
    "suppression should follow the actual SD/VP presentation, including VP-only cards and discounted zero-SD cards",
  );
  assert.doesNotMatch(
    suppressionGuard,
    /densityRequirementAtPlay\s*>\s*0|CardCategory\./,
    "the board-native path must not depend on positive effective density or a hard-coded card category",
  );
  assert.match(
    suppressionGuard,
    /card\.onPlay[\s\S]*?length\s*===\s*0/,
    "readable On Play effects must keep their own presentation instead of being suppressed",
  );
});

test("wide HUD derives any open-density suffix from the same presented values as its used/capacity total", () => {
  const wideHud = sourceSection(
    simulatorSource,
    'className={`grid grid-cols-2 overflow-hidden rounded-xl',
    '<button type="button" disabled={!activeCondition}',
  );

  assert.doesNotMatch(
    wideHud,
    /playerSchoolDensityState\.available/,
    "the player wide HUD must not append canonical availability to a temporarily held presented total",
  );
  assert.doesNotMatch(
    wideHud,
    /opponentSchoolDensityState\.available/,
    "the opponent wide HUD must not append canonical availability to a temporarily held presented total",
  );

  const openSuffixes = wideHud.match(/\$\{[^}]+\}\s*open/g) ?? [];
  openSuffixes.forEach((suffix) => {
    assert.match(
      suffix,
      /presented(?:Player|Opponent)SchoolDensity/,
      "a retained 'open' suffix must use the presented committed/capacity snapshot",
    );
  });
});
