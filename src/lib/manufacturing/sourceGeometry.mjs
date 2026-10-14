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

export function validFixedSheetPositions(positions, sourceId) {
  const count = EIGHT_CARD_SOURCES.has(sourceId) ? 8 : 9;
  return Array.isArray(positions) && positions.length === count && positions.every((p) =>
    p && [p.x, p.y, p.width, p.height].every(Number.isFinite) &&
    p.x >= 0 && p.y >= 0 && p.width > 0 && p.height > 0 &&
    p.x + p.width <= 2550 && p.y + p.height <= 3300 &&
    Math.abs(p.width / p.height - 5 / 7) <= 0.003 &&
    FIXED_CARD_SIZES.some(([width, height]) =>
      Math.abs(p.width - width) <= 1 && Math.abs(p.height - height) <= 1));
}
