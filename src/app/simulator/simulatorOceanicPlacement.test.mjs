import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getOpenWaterCardLayoutStyle,
  normalizeOpenWaterPlacementPosition,
} from "./openWaterPlacementRules.mjs";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

function escapePattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("Open Water placement normalizes serializable board coordinates without clamping panned space", () => {
  assert.deepEqual(normalizeOpenWaterPlacementPosition({ x: 17.123456, y: 82.987654 }), {
    x: 17.1235,
    y: 82.9877,
  });
  assert.deepEqual(
    normalizeOpenWaterPlacementPosition({ x: -12.5, y: 131.25 }),
    { x: -12.5, y: 131.25 },
    "panned/zoomed board coordinates may validly lie outside the untransformed viewport",
  );
  assert.equal(normalizeOpenWaterPlacementPosition(null), null);
  assert.equal(normalizeOpenWaterPlacementPosition({ x: 20, y: Number.NaN }), null);
});

test("Open Water layout composes a board anchor with the existing manual drag offset", () => {
  assert.deepEqual(
    getOpenWaterCardLayoutStyle({ x: 23.5, y: 67.25 }, { x: 14, y: -8 }),
    {
      left: "23.5%",
      top: "67.25%",
      transform: "translate(-50%, -50%) translate(14px, -8px)",
    },
  );
  assert.deepEqual(
    getOpenWaterCardLayoutStyle(null, { x: 14, y: -8 }),
    { transform: "translate(14px, -8px)" },
    "click-play and legacy instances should retain the centered-row behavior",
  );
});

test("an Oceanic hand drop carries its board-space release position into normal play", () => {
  const dropResolver = sourceSection(
    simulatorSource,
    "function resolveMobileHandDrop(",
    "function handleMobileHandDragStart(",
  );
  const positionAssignments = [...dropResolver.matchAll(
    /const\s+([A-Za-z_$][\w$]*(?:position|coordinates)[\w$]*)\s*=[\s\S]{0,240}?getPlacementCoordinatesFromPoint\(\s*ecosystemRef\.current,\s*clientX,\s*clientY,\s*(?:ecosystemZoom|playerCameraRef\.current\.zoom),\s*(?:ecosystemOffset|playerCameraRef\.current\.offset),?\s*\)/gi,
  )];
  const positionAssignment = positionAssignments.find((candidate) => {
    const positionName = escapePattern(candidate[1]);
    return new RegExp(`playCardFromHand\\(\\s*cardId\\s*,\\s*(?:${positionName}|\\{[\\s\\S]{0,80}?${positionName}[\\s\\S]{0,80}?\\})\\s*\\)`).test(dropResolver);
  });

  assert.ok(
    positionAssignment,
    "a valid non-foundation ecosystem drop should convert the pointer through the board camera instead of discarding clientX/clientY",
  );
  const positionName = escapePattern(positionAssignment[1]);
  assert.match(
    dropResolver,
    new RegExp(`playCardFromHand\\(\\s*cardId\\s*,\\s*(?:${positionName}|\\{[\\s\\S]{0,80}?${positionName}[\\s\\S]{0,80}?\\})\\s*\\)`),
    "the normalized board position should be handed to the ordinary card-play path",
  );
});

test("Oceanic placement survives both direct play and the sacrifice confirmation round trip", () => {
  const playCard = sourceSection(
    simulatorSource,
    "function playCardFromHand(",
    "function completeInvasivePlacement",
  );
  const playSignature = playCard.match(
    /function playCardFromHand\(\s*cardId\s*,\s*(?:\{\s*)?([A-Za-z_$][\w$]*)\s*=\s*null\s*(?:\}\s*=\s*\{\})?\s*\)/,
  );
  assert.ok(playSignature, "playCardFromHand should accept an optional board placement position");
  const playPositionName = escapePattern(playSignature[1]);

  assert.match(
    playCard,
    new RegExp(`setSearchContext\\(\\{[\\s\\S]*?mode:\\s*"oceanic-sacrifice"[\\s\\S]*?\\b${playPositionName}\\b[\\s\\S]*?\\}\\)`),
    "an Apex sacrifice prompt must retain the pending placement position",
  );
  assert.match(
    playCard,
    new RegExp(`completePlayerOceanicPlay\\(\\s*card\\.id\\s*,\\s*null\\s*,\\s*(?:${playPositionName}|[A-Za-z_$][\\w$]*PlacementPosition)\\s*\\)`),
    "an Oceanic card without a sacrifice should receive the same position immediately",
  );
  assert.match(
    simulatorSource,
    /completePlayerOceanicPlay\(\s*searchContext\.cardId\s*,\s*choice\.id\s*,\s*searchContext\.[A-Za-z_$][\w$]*\s*\)/,
    "confirming an Oceanic sacrifice should restore the retained placement position",
  );
});

test("the played Oceanic instance owns its normalized position", () => {
  const oceanicPlay = sourceSection(
    simulatorSource,
    "function completePlayerOceanicPlay(",
    "function returnFromSupportFlowToBoard(",
  );
  const completionSignature = oceanicPlay.match(
    /function completePlayerOceanicPlay\(\s*cardId\s*,\s*choiceId\s*=\s*null\s*,\s*([A-Za-z_$][\w$]*)\s*=\s*null\s*\)/,
  );
  assert.ok(completionSignature, "Oceanic completion should accept the optional normalized position");
  const completionPositionName = escapePattern(completionSignature[1]);
  const normalizedAssignment = oceanicPlay.match(
    new RegExp(`const\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*normalizeOpenWaterPlacementPosition\\(\\s*${completionPositionName}\\s*\\)`),
  );
  const storedPositionName = escapePattern(normalizedAssignment?.[1] ?? completionSignature[1]);

  assert.match(
    oceanicPlay,
    new RegExp(`createCreatureInstance\\([\\s\\S]*?\\{[\\s\\S]*?position:\\s*${storedPositionName}\\b[\\s\\S]*?\\}\\)`),
    "position belongs to the stable creature instance so later insertions, removals, and saves cannot retarget it",
  );
  assert.match(
    oceanicPlay,
    new RegExp(`if \\(\\s*${storedPositionName}\\s*\\) setPlayerViewportTouched\\(true\\)`),
    "auto-fit must not immediately move the camera after an explicit spatial drop",
  );
});

test("positioned Oceanic cards render at board coordinates while click-play and legacy cards keep the centered fallback", () => {
  const playerOpenWater = sourceSection(
    simulatorSource,
    "{playerReefCreatureInstances.length ? (",
    "{playerOrphanCreatures.length ? (",
  );

  assert.match(
    playerOpenWater,
    /playerReefCreatureInstances\.map\(\(instance, index\)[\s\S]*?instance\.position/,
    "rendering should read placement from the stable Oceanic creature instance",
  );
  assert.match(playerOpenWater, /getOpenWaterCardLayoutStyle\([^,]+,\s*offset\)/);
  assert.match(
    playerOpenWater,
    /(?:className|position)[\s\S]{0,240}(?:absolute|"absolute")/,
    "a card with explicit board coordinates should leave the centered flex flow",
  );
  assert.match(
    playerOpenWater,
    /floatingCardOffsets\[key\]\s*\?\?\s*\{\s*x:\s*0,\s*y:\s*0\s*\}/,
    "manual in-play dragging should remain additive to the persisted placement",
  );
  assert.match(
    playerOpenWater,
    /placementPosition\s*\?\s*"absolute"\s*:\s*"relative"/,
    "cards played by button/keyboard and legacy saves have no explicit position and must remain in the centered row",
  );
  assert.match(
    simulatorSource,
    /seapals-player-floating-row[^"\n]*absolute[^"\n]*bottom-0[^"\n]*top-0/,
    "percentage anchors need a full-board containing block instead of the old content-height row",
  );
});
