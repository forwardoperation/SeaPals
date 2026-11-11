import { CUTTER_LAYOUT_V8, CUTTER_LAYOUT_V9 } from "./backdrops.mjs";

// Source crops measured across all 51 fixed sheets at Figma version
// 2409981651040810260. These are independent of the cutter's output geometry.
const FIXED_CARD_SIZES = [
  [720, 1008],
  [705, 987],
  [720, 1009.9199829101562],
  [720.00341796875, 1010.6964111328125],
];
// These final deck pages have an intentionally empty bottom-right slot.
// Accept their asset IDs at release/preflight and node IDs during Figma sync.
const EIGHT_CARD_SOURCES = new Set([
  "sheet-murky-water-7", "2241:485700",
  "sheet-stinging-fortress-7", "2363:268999",
  "sheet-disruption-7", "2404:533973",
]);

// These larger source cards are measured only on the October 28 Coral sheets.
// Keep historic Coral crops valid and do not widen other decks' accepted sizes.
const CORAL_SOURCES = new Set(["4316:271759","4316:271767","4316:271774","4316:271781","4316:271788","4316:271795","4316:271802"]);
const CORAL_CARD_SIZES = [[738.6000366210938, 1034.0400390625], [738.7000122070312, 1034.179931640625], [739.5848388671875, 1034.0400390625]];

const CONDITION_OUTPUT_SOURCES = {
  "sheet-conditions-1": { nodeId: "4335:335039", exportNodeId: "4335:335041" },
  "sheet-conditions-2": { nodeId: "4335:335350", exportNodeId: "4335:335352" },
};
const CONDITION_CARD_SIZE = [698.4000244140625, 977.760009765625];
const nativeConditionSize = p => p && Math.abs(p.width - CONDITION_CARD_SIZE[0]) <= 0.01 &&
  Math.abs(p.height - CONDITION_CARD_SIZE[1]) <= 0.01;

// Conditions source artwork was moved back to its original nine-card grids on
// November 5. Calibration is preserved exactly from published release
// decks-composite-20261104-8aaaf79e3b94 (manifest SHA256
// 058f2e4a56d1efbeac076a695bc10c1d67cfe88f9ecdea1f6c76ea7602444969).
// Source crop bounds and output reference bounds describe different grids.
const MAPPED_CONDITION_SOURCES = {
  "sheet-conditions-1": {
    "nodeId": "2366:320222",
    "exportNodeId": "2366:320223",
    "outputProfile": "conditions-original-grid-v1",
    "sourceBounds": {
      "x": 167,
      "y": 106,
      "width": 2216,
      "height": 3088
    },
    "outputReferenceBounds": {
      "x": 150,
      "y": 65.6435546875,
      "width": 2330,
      "height": 3170
    },
    "outputPositions": [
      {
        "x": 189.13330078125,
        "y": 105.0966796875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      },
      {
        "x": 965.800048828125,
        "y": 105.0966796875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      },
      {
        "x": 1742.4666748046875,
        "y": 105.0966796875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      },
      {
        "x": 189.13330078125,
        "y": 1161.763671875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      },
      {
        "x": 965.800048828125,
        "y": 1161.763671875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      },
      {
        "x": 1742.4666748046875,
        "y": 1161.763671875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      },
      {
        "x": 189.13330078125,
        "y": 2218.4296875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      },
      {
        "x": 965.800048828125,
        "y": 2218.4296875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      },
      {
        "x": 1742.4666748046875,
        "y": 2218.4296875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      }
    ]
  },
  "sheet-conditions-2": {
    "nodeId": "2366:320233",
    "exportNodeId": "2366:320234",
    "outputProfile": "conditions-original-grid-v1",
    "sourceBounds": {
      "x": 167,
      "y": 106,
      "width": 2216,
      "height": 3088
    },
    "outputReferenceBounds": {
      "x": 150,
      "y": 65.6435546875,
      "width": 2330,
      "height": 3170
    },
    "outputPositions": [
      {
        "x": 189.1331787109375,
        "y": 105.0966796875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      },
      {
        "x": 965.8001708984375,
        "y": 105.0966796875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      },
      {
        "x": 1742.4666748046875,
        "y": 105.0966796875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      },
      {
        "x": 189.1331787109375,
        "y": 1161.763671875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      },
      {
        "x": 965.8001708984375,
        "y": 1161.763671875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      },
      {
        "x": 1742.4666748046875,
        "y": 1161.763671875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      },
      {
        "x": 189.1331787109375,
        "y": 2218.4296875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      },
      {
        "x": 965.8001708984375,
        "y": 2218.4296875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      },
      {
        "x": 1742.4666748046875,
        "y": 2218.4296875,
        "width": 698.4000244140625,
        "height": 977.760009765625
      }
    ]
  }
};

export function conditionOutputMapping(assetId) {
  const mapping = Object.hasOwn(MAPPED_CONDITION_SOURCES, assetId ?? "") ? MAPPED_CONDITION_SOURCES[assetId] : null;
  return mapping ? structuredClone(mapping) : null;
}

const sameRect = (a, b) => a && b && ["x", "y", "width", "height"].every(key =>
  Number.isFinite(a[key]) && a[key] === b[key]);
const samePoint = (a, b) => a && b && ["x", "y"].every(key =>
  Number.isFinite(a[key]) && a[key] === b[key]);

function validMappedConditionOutputPositions(asset, assetId) {
  const expected = conditionOutputMapping(assetId), geometry = asset?.sourceGeometry;
  if (!expected || asset?.nodeId !== expected.nodeId || geometry?.mode !== "mapped-grid-letter" ||
      geometry.outputProfile !== expected.outputProfile || geometry.exportNodeId !== expected.exportNodeId ||
      !sameRect(geometry.sourceBounds, expected.sourceBounds) ||
      !sameRect(geometry.outputReferenceBounds, expected.outputReferenceBounds)) return false;
  const bounds = geometry.sourceBounds, padding = { x: Math.round(bounds.x), y: Math.round(bounds.y) },
    delta = { x: padding.x - bounds.x, y: padding.y - bounds.y },
    originals = geometry.sourcePositions, crops = asset.positions, output = asset.outputPositions;
  if (!samePoint(geometry.padding, padding) || !samePoint(geometry.cropTranslation, delta) ||
      !Array.isArray(originals) || originals.length !== 9 || !Array.isArray(crops) || crops.length !== 9 ||
      !Array.isArray(output) || output.length !== 9 || !validFixedSheetPositions(crops, assetId)) return false;
  for (const [index, p] of originals.entries()) {
    if (!p || p.width !== 720 || p.height !== 1008 || (p.rotation ?? 0) !== 0 ||
        !sameRect(crops[index], { ...p, x: p.x + delta.x, y: p.y + delta.y }) ||
        !sameRect(output[index], expected.outputPositions[index]) || (output[index].rotation ?? 0) !== 0 ||
        p.x < bounds.x || p.y < bounds.y || p.x + p.width > bounds.x + bounds.width ||
        p.y + p.height > bounds.y + bounds.height) return false;
    if (index && (p.y < originals[index - 1].y - 1 ||
        Math.abs(p.y - originals[index - 1].y) < 1 && p.x <= originals[index - 1].x)) return false;
    if (originals.slice(index + 1).some(q => !q || p.x < q.x + q.width && p.x + p.width > q.x &&
      p.y < q.y + q.height && p.y + p.height > q.y)) return false;
  }
  return true;
}

export function validFixedSheetPositions(positions, sourceId) {
  const coral = CORAL_SOURCES.has(sourceId) || /^sheet-coral-garden-[1-7]$/.test(sourceId ?? "");
  const conditions = Object.hasOwn(CONDITION_OUTPUT_SOURCES, sourceId ?? "") ||
    Object.values(CONDITION_OUTPUT_SOURCES).some(source => source.nodeId === sourceId);
  // Preserve saved releases that included a now-audited empty crop.
  const counts = ["sheet-coral-garden-7", "sheet-darkness-shroud-1", "sheet-open-ocean-hunt-1"].includes(sourceId) ? [8, 9]
    : EIGHT_CARD_SOURCES.has(sourceId) || ["4316:271802", "2298:446032", "2296:82569"].includes(sourceId) ? [8] : [9];
  return Array.isArray(positions) && counts.includes(positions.length) && positions.every((p) =>
    p && [p.x, p.y, p.width, p.height].every(Number.isFinite) &&
    p.x >= 0 && p.y >= 0 && p.width > 0 && p.height > 0 &&
    p.x + p.width <= 2550 && p.y + p.height <= 3300 &&
    Math.abs(p.width / p.height - 5 / 7) <= 0.003 &&
    (FIXED_CARD_SIZES.some(([width, height]) =>
      Math.abs(p.width - width) <= 1 && Math.abs(p.height - height) <= 1) ||
      coral && CORAL_CARD_SIZES.some(([width, height]) =>
        Math.abs(p.width - width) <= 0.01 && Math.abs(p.height - height) <= 0.01) ||
      conditions && nativeConditionSize(p)));
}

// New Conditions cards are deliberately inset. Their output bounds are separate
// from rounded PNG crop coordinates and must remain linked to the saved source.
export function validFixedSheetOutputPositions(asset, assetId) {
  if (asset?.sourceGeometry?.mode === "mapped-grid-letter" || asset?.sourceGeometry?.outputProfile !== undefined ||
      asset?.sourceGeometry?.outputReferenceBounds !== undefined ||
      (Object.values(MAPPED_CONDITION_SOURCES).some(source => source.nodeId === asset?.nodeId) &&
        (asset?.sourceGeometry !== undefined || asset?.outputPositions !== undefined)))
    return validMappedConditionOutputPositions(asset, assetId);
  const expected = Object.hasOwn(CONDITION_OUTPUT_SOURCES, assetId ?? "") ? CONDITION_OUTPUT_SOURCES[assetId] : null, output = asset?.outputPositions;
  const newSource = Object.values(CONDITION_OUTPUT_SOURCES).some(source => source.nodeId === asset?.nodeId);
  if (output === undefined)
    return !newSource && !(expected && Array.isArray(asset?.positions) && asset.positions.some(nativeConditionSize));
  if (!expected || asset?.nodeId !== expected.nodeId || !Array.isArray(output) || output.length !== 9 ||
      !validFixedSheetPositions(output, assetId) || output.some(p => !nativeConditionSize(p) || (p.rotation ?? 0) !== 0)) return false;
  const geometry = asset.sourceGeometry, bounds = geometry?.sourceBounds, padding = geometry?.padding,
    delta = geometry?.cropTranslation, original = geometry?.sourcePositions, crops = asset.positions;
  if (geometry?.mode !== "isolated-grid-letter" || geometry.exportNodeId !== expected.exportNodeId ||
      !bounds || ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
      bounds.width !== 2330 || bounds.height !== 3170 || !padding || !delta ||
      padding.x !== Math.round(bounds.x) || padding.y !== Math.round(bounds.y) ||
      padding.x < 0 || padding.y < 0 || padding.x + bounds.width > 2550 || padding.y + bounds.height > 3300 ||
      delta.x !== padding.x - bounds.x || delta.y !== padding.y - bounds.y ||
      !Array.isArray(original) || original.length !== 9 || !Array.isArray(crops) || crops.length !== 9 ||
      !validFixedSheetPositions(crops, assetId)) return false;
  const equal = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-7;
  for (const [index, p] of output.entries()) {
    if (["x", "y", "width", "height"].some(key => !equal(p[key], original[index]?.[key])) ||
        !equal(crops[index].x, p.x + delta.x) || !equal(crops[index].y, p.y + delta.y) ||
        !equal(crops[index].width, p.width) || !equal(crops[index].height, p.height) ||
        p.x < bounds.x || p.y < bounds.y || p.x + p.width > bounds.x + bounds.width ||
        p.y + p.height > bounds.y + bounds.height) return false;
    if (output.slice(index + 1).some(q => p.x < q.x + q.width && p.x + p.width > q.x &&
      p.y < q.y + q.height && p.y + p.height > q.y)) return false;
  }
  return true;
}

// Shared by the printer renderer and staff preview; preserve historical layouts.
export function fixedSheetOutputPositions(asset, layout) {
  const reference = asset.sourceGeometry?.mode === "mapped-grid-letter"
    ? asset.sourceGeometry.outputReferenceBounds : asset.sourceGeometry?.sourceBounds;
  return asset.outputPositions?.toSorted((a, b) =>
    Math.abs(a.y - b.y) < 1 ? a.x - b.x : a.y - b.y,
  ).map(position => [CUTTER_LAYOUT_V8, CUTTER_LAYOUT_V9].includes(layout.version) ? {
    ...position,
    x: position.x + layout.grid.x - reference.x,
    y: position.y + layout.grid.y - reference.y,
  } : position);
}
