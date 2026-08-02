const GEOMETRY_EPSILON = 1e-9;

export const ADVENTURE_RENDER_OVERSCAN_TILES = 2.5;

// A character cell is one tile, while the sprite and interaction marker reach
// beyond it. These conservative bounds keep the whole actor mounted until it
// is comfortably outside the camera's overscan area.
export const ADVENTURE_ACTOR_VISUAL_EXTENTS = Object.freeze({
  left: 0.75,
  top: 1.25,
  right: 0.75,
  bottom: 0.75,
});

function requirePlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value;
}

function requireFinite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
}

function requireNonNegative(value, label) {
  requireFinite(value, label);
  if (value < 0) throw new RangeError(`${label} must not be negative.`);
  return value;
}

function requirePositive(value, label) {
  requireFinite(value, label);
  if (value <= 0) throw new RangeError(`${label} must be positive.`);
  return value;
}

function requireBounds(value, label) {
  requirePlainObject(value, label);
  for (const field of ["left", "top", "right", "bottom"]) {
    requireFinite(value[field], `${label}.${field}`);
  }
  if (value.left >= value.right || value.top >= value.bottom) {
    throw new RangeError(`${label} must have positive area.`);
  }
  return value;
}

/**
 * Converts the camera's CSS-space origin into the centered tile coordinates
 * used by layered-object visual bounds, then adds an invisible safety margin.
 */
export function getAdventureCameraRenderBounds(
  camera,
  { overscanTiles = ADVENTURE_RENDER_OVERSCAN_TILES } = {},
) {
  requirePlainObject(camera, "Adventure camera");
  const originX = requireFinite(camera.originX, "Adventure camera.originX");
  const originY = requireFinite(camera.originY, "Adventure camera.originY");
  const viewWidth = requirePositive(camera.viewWidth, "Adventure camera.viewWidth");
  const viewHeight = requirePositive(camera.viewHeight, "Adventure camera.viewHeight");
  const overscan = requireNonNegative(overscanTiles, "Adventure render overscanTiles");

  return Object.freeze({
    left: originX - 0.5 - overscan,
    top: originY - 0.5 - overscan,
    right: originX + viewWidth - 0.5 + overscan,
    bottom: originY + viewHeight - 0.5 + overscan,
  });
}

/** Includes edge-touching bounds so rounding at the camera edge cannot pop. */
export function adventureRenderBoundsIntersect(firstBounds, secondBounds) {
  const first = requireBounds(firstBounds, "First adventure render bounds");
  const second = requireBounds(secondBounds, "Second adventure render bounds");
  return first.right + GEOMETRY_EPSILON >= second.left
    && second.right + GEOMETRY_EPSILON >= first.left
    && first.bottom + GEOMETRY_EPSILON >= second.top
    && second.bottom + GEOMETRY_EPSILON >= first.top;
}

export function isAdventureLayeredObjectInRenderBounds(object, renderBounds) {
  requirePlainObject(object, "Adventure layered object");
  return adventureRenderBoundsIntersect(object.visualBounds, renderBounds);
}

export function getAdventureActorVisualBounds(position) {
  requirePlainObject(position, "Adventure actor position");
  const x = requireFinite(position.x, "Adventure actor position.x");
  const y = requireFinite(position.y, "Adventure actor position.y");
  return Object.freeze({
    left: x - ADVENTURE_ACTOR_VISUAL_EXTENTS.left,
    top: y - ADVENTURE_ACTOR_VISUAL_EXTENTS.top,
    right: x + ADVENTURE_ACTOR_VISUAL_EXTENTS.right,
    bottom: y + ADVENTURE_ACTOR_VISUAL_EXTENTS.bottom,
  });
}

export function isAdventureActorInRenderBounds(position, renderBounds) {
  return adventureRenderBoundsIntersect(
    getAdventureActorVisualBounds(position),
    renderBounds,
  );
}
