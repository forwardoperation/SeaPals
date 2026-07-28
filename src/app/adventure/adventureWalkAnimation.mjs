export const ADVENTURE_WALK_ANIMATION_DEFAULTS = Object.freeze({
  // The four-pose sequence is left foot, neutral, right foot, neutral. One
  // complete sequence therefore represents one world tile of travel.
  cycleDistance: 1,
  displacementEpsilon: 0.0005,
});

export const ADVENTURE_ACTOR_ANIMATION_MODES = Object.freeze({
  STILL: "still",
  WALKING: "walking",
  STEPPING_IN_PLACE: "stepping-in-place",
});

const createFrameRegistration = ([frameA, neutral, frameB]) => Object.freeze({
  frameA,
  neutral,
  frameB,
});

const createFacingRegistrations = ({ down, left, right, up }) => Object.freeze({
  down: createFrameRegistration(down),
  left: createFrameRegistration(left),
  right: createFrameRegistration(right),
  up: createFrameRegistration(up),
});

/**
 * The authored walk frames are not registered to an identical horizontal
 * center. These calibrated background positions keep each character's
 * head/torso centered while their arms and legs alternate naturally.
 */
export const ADVENTURE_WALK_FRAME_REGISTRATIONS = Object.freeze({
  player: createFacingRegistrations({
    down: [12.1, 49.9, 87.7],
    left: [12.8, 50.6, 88],
    right: [10.7, 48.4, 86.2],
    up: [11.5, 49.6, 87.4],
  }),
  marina: createFacingRegistrations({
    down: [12.3, 50.1, 87.7],
    left: [13.2, 50.9, 88.5],
    right: [11.5, 49.1, 86.4],
    up: [11.6, 49.2, 86.7],
  }),
  dorian: createFacingRegistrations({
    down: [12.2, 49.6, 86.9],
    left: [13.2, 50.8, 87.8],
    right: [10.9, 48.3, 85],
    up: [12, 49.4, 86.6],
  }),
  "fisherman-wyeth": createFacingRegistrations({
    down: [12.3, 49.9, 87.6],
    left: [11.9, 49.6, 87.2],
    right: [12, 49.8, 87.3],
    up: [11.8, 49.5, 87.2],
  }),
  "teacher-caroline": createFacingRegistrations({
    down: [13.2, 50.2, 88.3],
    left: [13.4, 50.1, 88],
    right: [12.5, 48.8, 86.8],
    up: [12.7, 49.3, 87.6],
  }),
  ivy: createFacingRegistrations({
    down: [13.4, 49.6, 83.4],
    left: [12.4, 49.7, 85.1],
    right: [12.1, 49, 85.5],
    up: [13.1, 49.2, 84.8],
  }),
  "explorer-jordan": createFacingRegistrations({
    down: [12.3, 49.8, 86.8],
    left: [13.2, 50.7, 87.5],
    right: [11.2, 48.6, 85.5],
    up: [12, 49.4, 86.6],
  }),
  "marine-biologist-jonah": createFacingRegistrations({
    down: [14.1, 50, 86],
    left: [13.4, 49.2, 85.2],
    right: [13.4, 49.5, 85.5],
    up: [13.3, 49.3, 85.2],
  }),
  "programmer-harlan": createFacingRegistrations({
    down: [12.8, 50, 87.1],
    left: [13.1, 49.9, 87.3],
    right: [11.6, 48.5, 85.6],
    up: [12.6, 49.6, 86.9],
  }),
  "town-adult": createFacingRegistrations({
    down: [12.2, 49, 85.4],
    left: [10.7, 48.7, 86.5],
    right: [11.3, 48.7, 85.9],
    up: [11.9, 49.1, 85.9],
  }),
  "town-elder": createFacingRegistrations({
    down: [13.4, 50, 86.8],
    left: [13.1, 49.9, 86.7],
    right: [13.5, 50.2, 87],
    up: [12.8, 49.7, 86.6],
  }),
  "academy-mentor": createFacingRegistrations({
    down: [4.4, 49.5, 94.7],
    left: [3.7, 48.4, 93.6],
    right: [3.9, 48.2, 93.8],
    up: [3.8, 48.9, 94.3],
  }),
});

export function getAdventureWalkFrameRegistration({
  profile = "player",
  facing = "down",
} = {}) {
  const profileRegistrations = ADVENTURE_WALK_FRAME_REGISTRATIONS[profile]
    ?? ADVENTURE_WALK_FRAME_REGISTRATIONS.player;
  return profileRegistrations[facing] ?? profileRegistrations.down;
}

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
 * Starts the walk cycle from input intent rather than waiting for the movement
 * RAF to displace the player. This keeps short taps visible and lets a held
 * direction continue animating naturally while the player's feet meet a wall.
 */
export function isAdventurePlayerWalking({
  isMoving,
  boatMode = false,
  movementPaused = false,
} = {}) {
  return Boolean(isMoving && !boatMode && !movementPaused);
}

/**
 * Keeps authored stationary residents visually alive without changing their
 * runtime position or pretending that a paused patrol is still travelling.
 */
export function getAdventureActorAnimationMode({
  hasPatrol = false,
  isMoving = false,
  isEngaged = false,
  movementPaused = false,
  pageVisible = true,
  reducedMotion = false,
} = {}) {
  if (isEngaged || movementPaused || !pageVisible || reducedMotion) {
    return ADVENTURE_ACTOR_ANIMATION_MODES.STILL;
  }
  if (isMoving) return ADVENTURE_ACTOR_ANIMATION_MODES.WALKING;
  if (hasPatrol) return ADVENTURE_ACTOR_ANIMATION_MODES.STILL;
  return ADVENTURE_ACTOR_ANIMATION_MODES.STEPPING_IN_PLACE;
}

/**
 * Detects physical travel independently from presentation-only idle cycles.
 * Movement systems can therefore keep runtime state honest while residents
 * still look alive at a fixed authored position.
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
