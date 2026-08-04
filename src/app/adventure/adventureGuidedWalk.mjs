export const GUIDED_WALK_PLAN_VERSION = 1;

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

/** Validates and compiles one immutable leader/follower route. */
export function createGuidedWalkPlan({
  path,
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
  const effectiveSpeed = reducedMotion ? reducedMotionSpeed : speed;
  const leaderDurationMs = (totalDistance / effectiveSpeed) * 1000;
  const durationMs = leaderDurationMs + followerDelayMs;
  if (!Number.isFinite(durationMs)) {
    throw new RangeError("Guided walk duration must be finite.");
  }

  return deepFreeze({
    version: GUIDED_WALK_PLAN_VERSION,
    path: points,
    segments,
    totalDistance,
    speed: effectiveSpeed,
    standardSpeed: speed,
    reducedMotionSpeed,
    reducedMotion,
    followerDelayMs,
    leaderDurationMs,
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

function samplePosition(plan, distance) {
  if (distance <= 0) {
    return { position: { ...plan.path[0] }, facing: plan.segments[0].facing };
  }
  if (distance >= plan.totalDistance) {
    return {
      position: { ...plan.path.at(-1) },
      facing: plan.segments.at(-1).facing,
    };
  }

  const segment = plan.segments.find(({ endDistance }) => distance < endDistance);
  const progress = (distance - segment.startDistance) / segment.length;
  return {
    position: {
      x: segment.start.x + segment.dx * progress,
      y: segment.start.y + segment.dy * progress,
    },
    facing: segment.facing,
  };
}

function sampleActor(plan, elapsedMs, started) {
  const complete = elapsedMs >= plan.leaderDurationMs;
  const distance = complete
    ? plan.totalDistance
    : plan.speed * (elapsedMs / 1000);
  return {
    ...samplePosition(plan, distance),
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
  const leader = sampleActor(plan, Math.min(sampledElapsedMs, plan.leaderDurationMs), true);
  const followerStarted = sampledElapsedMs >= plan.followerDelayMs;
  const followerElapsedMs = Math.max(0, sampledElapsedMs - plan.followerDelayMs);
  const follower = sampleActor(plan, followerElapsedMs, followerStarted);
  return deepFreeze({
    elapsedMs: sampledElapsedMs,
    durationMs: plan.durationMs,
    leader,
    follower,
    moving: leader.moving || follower.moving,
    complete: leader.complete && follower.complete,
  });
}
