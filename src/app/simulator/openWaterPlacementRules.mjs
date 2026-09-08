const PLACEMENT_PRECISION = 4;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * Keeps an explicit board-space placement serializable across play prompts and
 * resume checkpoints. Values may sit outside 0–100 when the camera is panned;
 * clamping them would make the card jump away from the release point.
 */
export function normalizeOpenWaterPlacementPosition(position) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: Number(x.toFixed(PLACEMENT_PRECISION)),
    y: Number(y.toFixed(PLACEMENT_PRECISION)),
  };
}

/** Builds the inline layout shared by newly placed and legacy floating cards. */
export function getOpenWaterCardLayoutStyle(position, offset = {}) {
  const normalizedPosition = normalizeOpenWaterPlacementPosition(position);
  const offsetX = finiteNumber(offset?.x);
  const offsetY = finiteNumber(offset?.y);
  if (!normalizedPosition) {
    return { transform: `translate(${offsetX}px, ${offsetY}px)` };
  }
  return {
    left: `${normalizedPosition.x}%`,
    top: `${normalizedPosition.y}%`,
    transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`,
  };
}
