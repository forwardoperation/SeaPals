const CANONICAL_BOAT_HEADINGS = Object.freeze({
  down: 0,
  right: 90,
  up: 180,
  left: 270,
});

export const BOAT_MOTION_DEFAULTS = Object.freeze({
  maxForwardSpeed: 3.2,
  maxReverseSpeed: 1.15,
  forwardAcceleration: 2.45,
  reverseAcceleration: 1.55,
  brakingDeceleration: 4.4,
  coastDeceleration: 0.72,
  turnRateDegrees: 118,
  lowSpeedTurnFactor: 0.18,
  stoppedSpeed: 0.025,
  maxIntegrationMs: 16,
  maxStepDistance: 0.06,
});

function requireFinite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
}

function requirePositive(value, label, { allowZero = false } = {}) {
  requireFinite(value, label);
  if (allowZero ? value < 0 : value <= 0) {
    throw new RangeError(`${label} must be ${allowZero ? "zero or greater" : "greater than zero"}.`);
  }
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function approach(value, target, amount) {
  if (value < target) return Math.min(target, value + amount);
  if (value > target) return Math.max(target, value - amount);
  return target;
}

function validatePosition(position, label = "Boat position") {
  if (!position || typeof position !== "object") throw new TypeError(`${label} must be an object.`);
  requireFinite(position.x, `${label} x`);
  requireFinite(position.y, `${label} y`);
}

function resolveOptions(options) {
  const resolved = { ...BOAT_MOTION_DEFAULTS, ...options };
  for (const key of [
    "maxForwardSpeed",
    "maxReverseSpeed",
    "forwardAcceleration",
    "reverseAcceleration",
    "brakingDeceleration",
    "coastDeceleration",
    "turnRateDegrees",
    "maxIntegrationMs",
    "maxStepDistance",
  ]) {
    requirePositive(resolved[key], `Boat ${key}`);
  }
  requirePositive(resolved.lowSpeedTurnFactor, "Boat lowSpeedTurnFactor", { allowZero: true });
  requirePositive(resolved.stoppedSpeed, "Boat stoppedSpeed", { allowZero: true });
  if (resolved.lowSpeedTurnFactor > 1) {
    throw new RangeError("Boat lowSpeedTurnFactor cannot exceed one.");
  }
  if (resolved.canOccupy !== undefined && typeof resolved.canOccupy !== "function") {
    throw new TypeError("Boat canOccupy must be a function.");
  }
  return resolved;
}

function sweepBoatPosition(position, displacement, canOccupy, maxStepDistance) {
  const distance = Math.hypot(displacement.x, displacement.y);
  const stepCount = Math.max(1, Math.ceil(distance / maxStepDistance));
  const step = {
    x: displacement.x / stepCount,
    y: displacement.y / stepCount,
  };
  let next = { x: position.x, y: position.y };
  let collided = false;

  for (let index = 0; index < stepCount; index += 1) {
    const candidate = { x: next.x + step.x, y: next.y + step.y };
    if (canOccupy(candidate)) {
      next = candidate;
      continue;
    }

    collided = true;
    // Let the hull glance along a shoreline instead of sticking to it, while
    // never accepting a position the scene collision map rejected.
    const axes = Math.abs(step.x) >= Math.abs(step.y) ? ["x", "y"] : ["y", "x"];
    for (const axis of axes) {
      if (!step[axis]) continue;
      const slidingCandidate = { ...next, [axis]: next[axis] + step[axis] };
      if (canOccupy(slidingCandidate)) next = slidingCandidate;
    }
    break;
  }

  return { position: next, collided };
}

/**
 * Returns an equivalent heading no more than half a turn from the current one.
 * Keeping an accumulated angle lets CSS interpolate across north without ever
 * sending the boat through an unnecessary 270-degree turn.
 */
export function getContinuousBoatHeading(previousHeading, facing) {
  if (!Object.prototype.hasOwnProperty.call(CANONICAL_BOAT_HEADINGS, facing)) {
    throw new RangeError(`Unknown boat facing: ${facing}`);
  }

  const canonicalHeading = CANONICAL_BOAT_HEADINGS[facing];
  if (previousHeading === null || previousHeading === undefined) return canonicalHeading;
  if (!Number.isFinite(previousHeading)) {
    throw new TypeError("Previous boat heading must be a finite number.");
  }

  return canonicalHeading + (Math.round((previousHeading - canonicalHeading) / 360) * 360);
}

/** Returns the closest four-way facing used by interaction and save contracts. */
export function getBoatFacingFromHeading(heading) {
  requireFinite(heading, "Boat heading");
  const index = ((Math.round(heading / 90) % 4) + 4) % 4;
  return ["down", "right", "up", "left"][index];
}

export function createBoatMotionState({ position, heading, speed = 0 } = {}) {
  validatePosition(position);
  requireFinite(heading, "Boat heading");
  requireFinite(speed, "Boat speed");
  return {
    position: { x: position.x, y: position.y },
    heading,
    speed,
    collided: false,
  };
}

/**
 * Advances a small top-down boat simulation.
 *
 * Up/down are throttle and brake/reverse; left/right move the rudder. A boat
 * therefore keeps its momentum when the controls are released and can only
 * turn effectively while water is moving past its rudder. Integration and
 * collision sweeps are subdivided, so a slow frame cannot jump through a buoy
 * or shoreline.
 */
export function stepBoatMotion(state, controls, elapsedMs, options = {}) {
  validatePosition(state?.position);
  requireFinite(state?.heading, "Boat heading");
  requireFinite(state?.speed, "Boat speed");
  requirePositive(elapsedMs, "Elapsed time", { allowZero: true });
  const resolved = resolveOptions(options);
  const throttle = clamp(Number(controls?.throttle) || 0, -1, 1);
  const rudder = clamp(Number(controls?.rudder) || 0, -1, 1);
  const canOccupy = resolved.canOccupy ?? (() => true);
  if (!elapsedMs) return { ...createBoatMotionState(state), throttle, rudder };

  const integrationCount = Math.max(1, Math.ceil(elapsedMs / resolved.maxIntegrationMs));
  const deltaSeconds = (elapsedMs / integrationCount) / 1000;
  let position = { x: state.position.x, y: state.position.y };
  let heading = state.heading;
  let speed = clamp(state.speed, -resolved.maxReverseSpeed, resolved.maxForwardSpeed);
  let collided = false;

  for (let index = 0; index < integrationCount; index += 1) {
    if (throttle > 0) {
      speed = speed < 0
        ? approach(speed, 0, resolved.brakingDeceleration * throttle * deltaSeconds)
        : approach(speed, resolved.maxForwardSpeed, resolved.forwardAcceleration * throttle * deltaSeconds);
    } else if (throttle < 0) {
      speed = speed > 0
        ? approach(speed, 0, resolved.brakingDeceleration * -throttle * deltaSeconds)
        : approach(speed, -resolved.maxReverseSpeed, resolved.reverseAcceleration * -throttle * deltaSeconds);
    } else {
      speed = approach(speed, 0, resolved.coastDeceleration * deltaSeconds);
    }

    if (Math.abs(speed) <= resolved.stoppedSpeed && throttle === 0) speed = 0;

    const speedRange = speed >= 0 ? resolved.maxForwardSpeed : resolved.maxReverseSpeed;
    const waterFlow = clamp(Math.abs(speed) / speedRange, 0, 1);
    const steeringAuthority = waterFlow
      ? resolved.lowSpeedTurnFactor + ((1 - resolved.lowSpeedTurnFactor) * waterFlow)
      : 0;
    const travelDirection = speed < 0 ? -1 : 1;
    heading += rudder
      * resolved.turnRateDegrees
      * steeringAuthority
      * travelDirection
      * deltaSeconds;

    if (!speed) continue;
    const radians = heading * (Math.PI / 180);
    const distance = speed * deltaSeconds;
    const swept = sweepBoatPosition(
      position,
      { x: Math.sin(radians) * distance, y: Math.cos(radians) * distance },
      canOccupy,
      resolved.maxStepDistance,
    );
    position = swept.position;
    if (swept.collided) {
      collided = true;
      speed = 0;
      break;
    }
  }

  return { position, heading, speed, collided, throttle, rudder };
}
