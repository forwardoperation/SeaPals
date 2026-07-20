const CARDINAL_STEP_VECTORS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  right: Object.freeze({ x: 1, y: 0 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
});

export const ADVENTURE_SCENE_TRANSITION_PHASES = Object.freeze({
  departing: "departing",
  arriving: "arriving",
});

export const ADVENTURE_SCENE_TRANSITION_DURATIONS_MS = Object.freeze({
  departing: 220,
  arriving: 280,
});

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requireCardinalDirection(direction, label) {
  if (!Object.prototype.hasOwnProperty.call(CARDINAL_STEP_VECTORS, direction)) {
    throw new RangeError(`${label} must be up, right, down, or left.`);
  }
  return direction;
}

function requireTransitionPhase(phase) {
  if (!Object.prototype.hasOwnProperty.call(ADVENTURE_SCENE_TRANSITION_DURATIONS_MS, phase)) {
    throw new RangeError(`Unknown adventure scene-transition phase: ${phase}`);
  }
  return phase;
}

function requireTransition(transition) {
  if (!transition || typeof transition !== "object" || Array.isArray(transition)) {
    throw new TypeError("Adventure scene transition must be an object.");
  }

  requireTransitionPhase(transition.phase);
  requireNonEmptyString(transition.sourceSceneId, "Adventure transition sourceSceneId");
  requireNonEmptyString(transition.targetSceneId, "Adventure transition targetSceneId");
  requireNonEmptyString(transition.interactionId, "Adventure transition interactionId");
  requireNonEmptyString(transition.type, "Adventure transition type");
  requireCardinalDirection(
    transition.departureDirection,
    "Adventure transition departureDirection",
  );
  requireCardinalDirection(
    transition.arrivalDirection,
    "Adventure transition arrivalDirection",
  );
  requireCardinalDirection(transition.direction, "Adventure transition direction");

  const expectedDirection = transition.phase === ADVENTURE_SCENE_TRANSITION_PHASES.departing
    ? transition.departureDirection
    : transition.arrivalDirection;
  if (transition.direction !== expectedDirection) {
    throw new RangeError(
      `Adventure transition direction must match its ${transition.phase} phase direction.`,
    );
  }

  return transition;
}

/**
 * Creates the visible departure half of a scene transition. The destination
 * scene is intentionally not committed here: callers keep the current scene
 * mounted until the departure animation has completed.
 */
export function createAdventureSceneTransition({
  sourceSceneId,
  targetSceneId,
  interactionId,
  type,
  departureDirection,
  arrivalDirection,
} = {}) {
  const transition = {
    phase: ADVENTURE_SCENE_TRANSITION_PHASES.departing,
    sourceSceneId: requireNonEmptyString(
      sourceSceneId,
      "Adventure transition sourceSceneId",
    ),
    targetSceneId: requireNonEmptyString(
      targetSceneId,
      "Adventure transition targetSceneId",
    ),
    interactionId: requireNonEmptyString(
      interactionId,
      "Adventure transition interactionId",
    ),
    type: requireNonEmptyString(type, "Adventure transition type"),
    departureDirection: requireCardinalDirection(
      departureDirection,
      "Adventure transition departureDirection",
    ),
    arrivalDirection: requireCardinalDirection(
      arrivalDirection,
      "Adventure transition arrivalDirection",
    ),
    direction: departureDirection,
  };

  return Object.freeze(transition);
}

/**
 * Advances a completed departure to its arrival phase. An override supports
 * destinations that resolve their final facing at commit time.
 */
export function advanceAdventureSceneTransition(
  transition,
  { arrivalDirection = transition?.arrivalDirection } = {},
) {
  requireTransition(transition);
  if (transition.phase !== ADVENTURE_SCENE_TRANSITION_PHASES.departing) {
    throw new RangeError("Only a departing adventure scene transition can begin arriving.");
  }

  const nextArrivalDirection = requireCardinalDirection(
    arrivalDirection,
    "Adventure transition arrivalDirection",
  );
  return Object.freeze({
    ...transition,
    phase: ADVENTURE_SCENE_TRANSITION_PHASES.arriving,
    arrivalDirection: nextArrivalDirection,
    direction: nextArrivalDirection,
  });
}

/** Returns the phase delay used by the React timer, or zero for reduced motion. */
export function getAdventureSceneTransitionDurationMs(
  phase,
  { reducedMotion = false } = {},
) {
  requireTransitionPhase(phase);
  if (typeof reducedMotion !== "boolean") {
    throw new TypeError("Adventure transition reducedMotion must be a boolean.");
  }
  return reducedMotion ? 0 : ADVENTURE_SCENE_TRANSITION_DURATIONS_MS[phase];
}

/** Returns a frozen unit vector suitable for directional CSS custom properties. */
export function getAdventureDoorStepVector(direction) {
  requireCardinalDirection(direction, "Adventure doorway direction");
  return CARDINAL_STEP_VECTORS[direction];
}
