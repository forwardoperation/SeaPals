export const ADVENTURE_WALK_ANIMATION_DEFAULTS = Object.freeze({
  // The four-pose sequence is left foot, neutral, right foot, neutral. One
  // complete sequence therefore represents one world tile of travel.
  cycleDistance: 1,
  displacementEpsilon: 0.0005,
});

function requirePositiveFinite(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number.`);
  }
  return value;
}

function requireFinitePosition(position, label) {
  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) {
    throw new TypeError(`${label} requires finite x and y coordinates.`);
  }
  return position;
}

/**
 * Converts world movement speed into the matching sprite-sheet cadence.
 * Keeping this relationship in world units prevents a slow patrol from
 * shuffling as quickly as the player and keeps diagonal movement in sync.
 */
export function getAdventureWalkCycleDurationMs(
  speed,
  { cycleDistance = ADVENTURE_WALK_ANIMATION_DEFAULTS.cycleDistance } = {},
) {
  requirePositiveFinite(speed, "Adventure walk speed");
  requirePositiveFinite(cycleDistance, "Adventure walk cycle distance");
  return (cycleDistance / speed) * 1000;
}

/**
 * Walking artwork follows actual world displacement, not held input. This
 * makes a blocked player settle immediately instead of marching into a wall.
 */
export function hasAdventureWalkDisplacement(
  previousPosition,
  nextPosition,
  { epsilon = ADVENTURE_WALK_ANIMATION_DEFAULTS.displacementEpsilon } = {},
) {
  requireFinitePosition(previousPosition, "Adventure previous walk position");
  requireFinitePosition(nextPosition, "Adventure next walk position");
  if (!Number.isFinite(epsilon) || epsilon < 0) {
    throw new RangeError("Adventure walk displacement epsilon must be a non-negative finite number.");
  }
  return Math.hypot(
    nextPosition.x - previousPosition.x,
    nextPosition.y - previousPosition.y,
  ) > epsilon;
}
