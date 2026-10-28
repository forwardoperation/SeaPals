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

export function validFixedSheetPositions(positions, sourceId) {
  const coral = CORAL_SOURCES.has(sourceId) || /^sheet-coral-garden-[1-7]$/.test(sourceId ?? "");
  // Saved Coral sheet 7 releases may include the former ninth blank slot.
  const counts = sourceId === "sheet-coral-garden-7" ? [8, 9]
    : EIGHT_CARD_SOURCES.has(sourceId) || sourceId === "4316:271802" ? [8] : [9];
  return Array.isArray(positions) && counts.includes(positions.length) && positions.every((p) =>
    p && [p.x, p.y, p.width, p.height].every(Number.isFinite) &&
    p.x >= 0 && p.y >= 0 && p.width > 0 && p.height > 0 &&
    p.x + p.width <= 2550 && p.y + p.height <= 3300 &&
    Math.abs(p.width / p.height - 5 / 7) <= 0.003 &&
    (FIXED_CARD_SIZES.some(([width, height]) =>
      Math.abs(p.width - width) <= 1 && Math.abs(p.height - height) <= 1) ||
      coral && CORAL_CARD_SIZES.some(([width, height]) =>
        Math.abs(p.width - width) <= 0.01 && Math.abs(p.height - height) <= 0.01)));
}
