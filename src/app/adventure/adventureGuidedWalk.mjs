export const GUIDED_WALK_PLAN_VERSION = 1;
export const GUIDED_WALK_CLOCK_VERSION = 1;

const EPSILON = 1e-9;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireFinite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
}

function requirePositive(value, label) {
  requireFinite(value, label);
  if (value <= 0) throw new RangeError(`${label} must be greater than zero.`);
  return value;
}

function facingForOffset(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "down" : "up";
}

function compilePath(path) {
  if (!Array.isArray(path) || path.length < 2) {
    throw new TypeError("Guided walk path must contain at least two points.");
  }

  const points = path.map((point, index) => {
    if (!point || typeof point !== "object" || Array.isArray(point)) {
      throw new TypeError(`Guided walk path[${index}] must be a point.`);
    }
    return {
      x: requireFinite(point.x, `Guided walk path[${index}].x`),
      y: requireFinite(point.y, `Guided walk path[${index}].y`),
    };
  });

  let totalDistance = 0;
  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (!Number.isFinite(length)) {
      throw new RangeError(`Guided walk segment ${index} length must be finite.`);
    }
    if (length <= EPSILON) {
      throw new RangeError(`Guided walk path points ${index} and ${index + 1} must differ.`);
    }
    segments.push({
      start,
      end,
      dx,
      dy,
      length,
      startDistance: totalDistance,
      endDistance: totalDistance + length,
      facing: facingForOffset(dx, dy),
    });
    totalDistance += length;
  }

  return { points, segments, totalDistance };
}

/** Validates and compiles immutable leader and follower routes. */
export function createGuidedWalkPlan({
  path,
  followerPath = path,
  speed = 2,
  followerDelayMs = 450,
  reducedMotion = false,
  reducedMotionSpeed = speed * 2,
} = {}) {
  requirePositive(speed, "Guided walk speed");
  requirePositive(reducedMotionSpeed, "Guided walk reducedMotionSpeed");
  requireFinite(followerDelayMs, "Guided walk followerDelayMs");
  if (followerDelayMs < 0) {
    throw new RangeError("Guided walk followerDelayMs must be zero or greater.");
  }
  if (typeof reducedMotion !== "boolean") {
    throw new TypeError("Guided walk reducedMotion must be boolean.");
  }

  const { points, segments, totalDistance } = compilePath(path);
  const {
    points: followerPoints,
    segments: followerSegments,
    totalDistance: followerTotalDistance,
  } = followerPath === path
    ? { points, segments, totalDistance }
    : compilePath(followerPath);
  const effectiveSpeed = reducedMotion ? reducedMotionSpeed : speed;
  const leaderDurationMs = (totalDistance / effectiveSpeed) * 1000;
  const followerDurationMs = (followerTotalDistance / effectiveSpeed) * 1000;
  const durationMs = Math.max(leaderDurationMs, followerDelayMs + followerDurationMs);
  if (!Number.isFinite(durationMs)) {
    throw new RangeError("Guided walk duration must be finite.");
  }

  return deepFreeze({
    version: GUIDED_WALK_PLAN_VERSION,
    path: points,
    segments,
    totalDistance,
    followerPath: followerPoints,
    followerSegments,
    followerTotalDistance,
    speed: effectiveSpeed,
    standardSpeed: speed,
    reducedMotionSpeed,
    reducedMotion,
    followerDelayMs,
    leaderDurationMs,
    followerDurationMs,
    durationMs,
  });
}

function requirePlan(plan) {
  if (
    !plan
    || typeof plan !== "object"
    || plan.version !== GUIDED_WALK_PLAN_VERSION
    || !Array.isArray(plan.path)
    || !Array.isArray(plan.segments)
  ) {
    throw new TypeError(`Guided walk plan must use version ${GUIDED_WALK_PLAN_VERSION}.`);
  }
  return plan;
}

function samplePosition(path, segments, totalDistance, distance) {
  if (distance <= 0) {
    return { position: { ...path[0] }, facing: segments[0].facing };
  }
  if (distance >= totalDistance) {
    return {
      position: { ...path.at(-1) },
      facing: segments.at(-1).facing,
    };
  }

  const segment = segments.find(({ endDistance }) => distance < endDistance);
  const progress = (distance - segment.startDistance) / segment.length;
  return {
    position: {
      x: segment.start.x + segment.dx * progress,
      y: segment.start.y + segment.dy * progress,
    },
    facing: segment.facing,
  };
}

function sampleActor({ path, segments, totalDistance, durationMs, speed }, elapsedMs, started) {
  const complete = elapsedMs >= durationMs;
  const distance = complete
    ? totalDistance
    : speed * (elapsedMs / 1000);
  return {
    ...samplePosition(path, segments, totalDistance, distance),
    moving: started && !complete,
    complete,
  };
}

/** Samples the route without mutating the plan or retaining clock state. */
export function sampleGuidedWalk(planValue, elapsedMs) {
  const plan = requirePlan(planValue);
  requireFinite(elapsedMs, "Guided walk elapsedMs");
  if (elapsedMs < 0) throw new RangeError("Guided walk elapsedMs must be zero or greater.");

  const sampledElapsedMs = Math.min(elapsedMs, plan.durationMs);
  const leader = sampleActor({
    path: plan.path,
    segments: plan.segments,
    totalDistance: plan.totalDistance,
    durationMs: plan.leaderDurationMs,
    speed: plan.speed,
  }, Math.min(sampledElapsedMs, plan.leaderDurationMs), true);
  const followerStarted = sampledElapsedMs >= plan.followerDelayMs;
  const followerElapsedMs = Math.max(0, sampledElapsedMs - plan.followerDelayMs);
  const follower = sampleActor({
    path: plan.followerPath ?? plan.path,
    segments: plan.followerSegments ?? plan.segments,
    totalDistance: plan.followerTotalDistance ?? plan.totalDistance,
    durationMs: plan.followerDurationMs ?? plan.leaderDurationMs,
    speed: plan.speed,
  }, followerElapsedMs, followerStarted);
  return deepFreeze({
    elapsedMs: sampledElapsedMs,
    durationMs: plan.durationMs,
    leader,
    follower,
    moving: leader.moving || follower.moving,
    complete: leader.complete && follower.complete,
  });
}

/**
 * Advances animation time from requestAnimationFrame timestamps without
 * assuming that another browser clock has the same origin. A regressed frame
 * timestamp resets the baseline instead of pinning elapsed time at zero.
 */
export function advanceGuidedWalkClock(planValue, clockValue, timestampMs) {
  const plan = requirePlan(planValue);
  requireFinite(timestampMs, "Guided walk frame timestampMs");
  if (timestampMs < 0) {
    throw new RangeError("Guided walk frame timestampMs must be zero or greater.");
  }

  const clock = clockValue ?? {
    version: GUIDED_WALK_CLOCK_VERSION,
    elapsedMs: 0,
    lastTimestampMs: null,
  };
  if (!clock || typeof clock !== "object" || clock.version !== GUIDED_WALK_CLOCK_VERSION) {
    throw new TypeError(`Guided walk clock must use version ${GUIDED_WALK_CLOCK_VERSION}.`);
  }
  requireFinite(clock.elapsedMs, "Guided walk clock elapsedMs");
  if (clock.elapsedMs < 0) {
    throw new RangeError("Guided walk clock elapsedMs must be zero or greater.");
  }
  if (clock.lastTimestampMs !== null) {
    requireFinite(clock.lastTimestampMs, "Guided walk clock lastTimestampMs");
    if (clock.lastTimestampMs < 0) {
      throw new RangeError("Guided walk clock lastTimestampMs must be zero or greater.");
    }
  }

  const deltaMs = clock.lastTimestampMs === null || timestampMs < clock.lastTimestampMs
    ? 0
    : timestampMs - clock.lastTimestampMs;
  const elapsedMs = Math.min(plan.durationMs, clock.elapsedMs + deltaMs);
  return Object.freeze({
    version: GUIDED_WALK_CLOCK_VERSION,
    elapsedMs,
    lastTimestampMs: timestampMs,
    complete: elapsedMs >= plan.durationMs,
  });
}
