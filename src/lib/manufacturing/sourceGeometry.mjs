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
