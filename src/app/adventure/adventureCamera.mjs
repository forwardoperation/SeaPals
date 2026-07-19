export const ADVENTURE_CAMERA_DEFAULTS = Object.freeze({
  viewportAspect: 16 / 9,
  tilesAcross: 11,
  playerAnchorX: 0.5,
  playerAnchorY: 0.58,
});

const CAMERA_OPTION_KEYS = new Set(Object.keys(ADVENTURE_CAMERA_DEFAULTS));
const STABLE_PRECISION = 1_000_000_000;

function requirePlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

function requireFinite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
}

function requirePositive(value, label) {
  requireFinite(value, label);
  if (value <= 0) throw new RangeError(`${label} must be greater than zero.`);
}

function requireUnitInterval(value, label) {
  requireFinite(value, label);
  if (value < 0 || value > 1) throw new RangeError(`${label} must be between zero and one.`);
}

function requireWorldCoordinate(value, maximum, label) {
  requireFinite(value, label);
  if (value < 0 || value > maximum) {
    throw new RangeError(`${label} must be within the world bounds.`);
  }
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

// Camera values are passed directly to CSS. Rounding removes insignificant
// floating-point drift while also ensuring an edge clamp returns 0, not -0.
function stableNumber(value) {
  const rounded = Math.round(value * STABLE_PRECISION) / STABLE_PRECISION;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function resolveOptions(options) {
  requirePlainObject(options, "Camera options");
  for (const key of Object.keys(options)) {
    if (!CAMERA_OPTION_KEYS.has(key)) throw new RangeError(`Unknown camera option: ${key}`);
  }

  const resolved = { ...ADVENTURE_CAMERA_DEFAULTS, ...options };
  requirePositive(resolved.viewportAspect, "Camera viewportAspect");
  requirePositive(resolved.tilesAcross, "Camera tilesAcross");
  requireUnitInterval(resolved.playerAnchorX, "Camera playerAnchorX");
  requireUnitInterval(resolved.playerAnchorY, "Camera playerAnchorY");
  return resolved;
}

/**
 * Calculates the crop and inner-layer percentages for a square-tile world.
 *
 * The viewport keeps a fixed aspect ratio. At the default zoom it shows 11
 * logical tiles across, unless the scene itself is narrower or too short to
 * fill that crop. The desired player anchor is used away from the edges;
 * origins clamp to every edge so the camera never exposes space beyond the
 * world.
 */
export function getAdventureCameraLayout(
  { worldWidth, worldHeight, playerX, playerY } = {},
  options = {},
) {
  requirePositive(worldWidth, "Camera worldWidth");
  requirePositive(worldHeight, "Camera worldHeight");
  requireWorldCoordinate(playerX, worldWidth, "Camera playerX");
  requireWorldCoordinate(playerY, worldHeight, "Camera playerY");

  const { viewportAspect, tilesAcross, playerAnchorX, playerAnchorY } = resolveOptions(options);
  const viewWidth = Math.min(worldWidth, tilesAcross, worldHeight * viewportAspect);
  const viewHeight = viewWidth / viewportAspect;
  const maximumOriginX = Math.max(0, worldWidth - viewWidth);
  const maximumOriginY = Math.max(0, worldHeight - viewHeight);
  const originX = clamp(playerX - (viewWidth * playerAnchorX), 0, maximumOriginX);
  const originY = clamp(playerY - (viewHeight * playerAnchorY), 0, maximumOriginY);

  return Object.freeze({
    viewWidth: stableNumber(viewWidth),
    viewHeight: stableNumber(viewHeight),
    originX: stableNumber(originX),
    originY: stableNumber(originY),
    worldWidthPercent: stableNumber((worldWidth / viewWidth) * 100),
    worldHeightPercent: stableNumber((worldHeight / viewHeight) * 100),
    leftPercent: stableNumber(-(originX / viewWidth) * 100),
    topPercent: stableNumber(-(originY / viewHeight) * 100),
    viewportAspect: stableNumber(viewportAspect),
  });
}
