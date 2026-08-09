/**
 * Deterministic aquarium schooling simulation.
 *
 * Coordinates are percentages of a tank (normally 0..100). The module has no
 * browser dependencies: a renderer owns the requestAnimationFrame accumulator
 * and advances this state in exact fixed steps.
 */

export const AQUARIUM_BOIDS_FIXED_STEP_SECONDS = 1 / 30;

const EPSILON = 1e-8;
const DEFAULT_BOUNDS = Object.freeze({ minX: 0, maxX: 100, minY: 0, maxY: 100 });
const SCHOOL_BEHAVIOR_KINDS = new Set([
  "contour-school",
  "shelter-school",
  "cover-school-ball",
]);

const BEHAVIOR_TUNING = Object.freeze({
  "contour-school": Object.freeze({
    maxSpeedMultiplier: 1,
    minSpeedMultiplier: 0.34,
    routeSpeedMultiplier: 0.42,
    separationWeight: 1.7,
    alignmentWeight: 1.2,
    cohesionWeight: 0.92,
    targetWeight: 1.1,
    initialSpreadMultiplier: 1,
    separationRadiusMultiplier: 1.2,
    wanderWeight: 0.3,
    wanderSpacingAmplitude: 0.045,
    steeringResponsePerSecond: 9,
    refugeStyle: null,
  }),
  "shelter-school": Object.freeze({
    maxSpeedMultiplier: 0.84,
    minSpeedMultiplier: 0.36,
    routeSpeedMultiplier: 0.3,
    separationWeight: 1.45,
    alignmentWeight: 1.05,
    cohesionWeight: 0.82,
    targetWeight: 1.05,
    initialSpreadMultiplier: 1.25,
    separationRadiusMultiplier: 1.5,
    wanderWeight: 0.38,
    wanderSpacingAmplitude: 0.09,
    steeringResponsePerSecond: 10,
    refugeStyle: "loose",
  }),
  "cover-school-ball": Object.freeze({
    maxSpeedMultiplier: 0.92,
    minSpeedMultiplier: 0.28,
    routeSpeedMultiplier: 0.25,
    separationWeight: 2.4,
    alignmentWeight: 1.15,
    cohesionWeight: 0.78,
    targetWeight: 1,
    initialSpreadMultiplier: 0.62,
    separationRadiusMultiplier: 0.82,
    wanderWeight: 0.24,
    wanderSpacingAmplitude: 0.06,
    steeringResponsePerSecond: 12,
    refugeStyle: "compact",
  }),
});

/**
 * Converts world velocity into pitch in the sprite's native-right local space.
 * Screen y grows downward, so ascending right-facing fish pitch negatively;
 * horizontal mirroring reverses that local rotation for left-facing fish.
 */
export function aquariumFishPitchDegrees(
  velocityX,
  velocityY,
  direction,
  maxPitchDegrees = 22,
) {
  if (!Number.isFinite(velocityX) || !Number.isFinite(velocityY)) return 0;
  if (Math.hypot(velocityX, velocityY) <= EPSILON) return 0;
  const facing = Number.isFinite(direction)
    ? (direction < 0 ? -1 : 1)
    : (velocityX < 0 ? -1 : 1);
  const maximum = clamp(Number.isFinite(maxPitchDegrees) ? maxPitchDegrees : 22, 0, 25);
  const worldPitch = Math.atan2(velocityY, Math.max(Math.abs(velocityX), EPSILON))
    * (180 / Math.PI);
  return clamp(worldPitch * facing, -maximum, maximum);
}

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function midpoint(range, fallback) {
  if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) return fallback;
  return (range.min + range.max) / 2;
}

function pointCoordinate(point, axis) {
  const percentName = axis === "x" ? "xPercent" : "yPercent";
  return finiteNumber(point?.[axis], point?.[percentName]);
}

function normalizedPoint(point, label, bounds) {
  const x = pointCoordinate(point, "x");
  const y = pointCoordinate(point, "y");
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new TypeError(`${label} must have finite x/y or xPercent/yPercent coordinates.`);
  }
  if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) {
    throw new RangeError(`${label} must be inside the aquarium bounds.`);
  }
  return Object.freeze({ x, y });
}

function normalizedBounds(value) {
  const bounds = {
    minX: finiteNumber(value?.minX, DEFAULT_BOUNDS.minX),
    maxX: finiteNumber(value?.maxX, DEFAULT_BOUNDS.maxX),
    minY: finiteNumber(value?.minY, DEFAULT_BOUNDS.minY),
    maxY: finiteNumber(value?.maxY, DEFAULT_BOUNDS.maxY),
  };
  if (bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) {
    throw new RangeError("Aquarium boid bounds must have positive width and height.");
  }
  return Object.freeze(bounds);
}

function routeFromOpenWaterLane(lane, bounds) {
  const centerY = finiteNumber(lane?.y, lane?.yPercent);
  const verticalRange = finiteNumber(lane?.verticalRange, lane?.verticalRangePercent);
  if (
    !Number.isFinite(centerY)
    || !Number.isFinite(verticalRange)
    || verticalRange <= 0
    || centerY + (verticalRange / 2) < bounds.minY
    || centerY - (verticalRange / 2) > bounds.maxY
  ) {
    return null;
  }
  const width = bounds.maxX - bounds.minX;
  const xInset = Math.min(width / 3, Math.max(1, width * 0.08));
  const verticalDrift = Math.min(verticalRange * 0.12, (bounds.maxY - bounds.minY) * 0.12);
  return [
    {
      x: bounds.minX + xInset,
      y: clamp(centerY - verticalDrift, bounds.minY, bounds.maxY),
    },
    {
      x: bounds.maxX - xInset,
      y: clamp(centerY + verticalDrift, bounds.minY, bounds.maxY),
    },
  ];
}

function hashSeed(seed) {
  const text = String(seed ?? "aquarium-school");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededGenerator(seed) {
  let value = hashSeed(seed);
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000;
  };
}

function canonicalSimulationValue(value, ancestors = new Set()) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `string:${JSON.stringify(value)}`;
  if (typeof value === "boolean") return `boolean:${value}`;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "number:NaN";
    if (value === Infinity) return "number:Infinity";
    if (value === -Infinity) return "number:-Infinity";
    return `number:${Object.is(value, -0) ? 0 : value}`;
  }
  if (typeof value === "bigint") return `bigint:${value}`;
  if (typeof value !== "object") {
    throw new TypeError(`Aquarium boid simulation keys cannot contain ${typeof value} values.`);
  }
  if (ancestors.has(value)) {
    throw new TypeError("Aquarium boid simulation keys cannot contain circular values.");
  }
  ancestors.add(value);
  let canonical;
  if (Array.isArray(value)) {
    canonical = `array:[${value.map((item) => canonicalSimulationValue(item, ancestors)).join(",")}]`;
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Aquarium boid simulation keys require plain objects and arrays.");
    }
    canonical = `object:{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalSimulationValue(value[key], ancestors)}`)
      .join(",")}}`;
  }
  ancestors.delete(value);
  return canonical;
}

/**
 * Builds complete, property-order-independent identity for a live simulation.
 * Pass the same creation inputs used for createAquariumBoids plus a stable
 * `trackIdentity`; any profile, geometry, timing, tuning, count, or identity
 * change will then restart the renderer's simulation.
 */
export function createAquariumBoidsSimulationKey(options = {}) {
  return `aquarium-boids:v1:${canonicalSimulationValue(options)}`;
}

function magnitude(vector) {
  return Math.hypot(vector.x, vector.y);
}

function scaledTo(vector, length) {
  const current = magnitude(vector);
  if (current <= EPSILON) return { x: 0, y: 0 };
  const scale = length / current;
  return { x: vector.x * scale, y: vector.y * scale };
}

function limited(vector, maximum) {
  const current = magnitude(vector);
  return current > maximum ? scaledTo(vector, maximum) : vector;
}

function steeringToward(agent, target, speed, maximumForce) {
  const desired = scaledTo({ x: target.x - agent.x, y: target.y - agent.y }, speed);
  return limited({ x: desired.x - agent.vx, y: desired.y - agent.vy }, maximumForce);
}

function routeGeometry(route) {
  const segmentLengths = [];
  let totalLength = 0;
  for (let index = 0; index < route.length - 1; index += 1) {
    const segmentLength = Math.hypot(
      route[index + 1].x - route[index].x,
      route[index + 1].y - route[index].y,
    );
    segmentLengths.push(segmentLength);
    totalLength += segmentLength;
  }
  return Object.freeze({ segmentLengths: Object.freeze(segmentLengths), totalLength });
}

function pointAlongRoute(route, geometry, distance) {
  if (route.length === 1 || geometry.totalLength <= EPSILON) return route[0];
  let remaining = clamp(distance, 0, geometry.totalLength);
  for (let index = 0; index < geometry.segmentLengths.length; index += 1) {
    const segmentLength = geometry.segmentLengths[index];
    if (remaining <= segmentLength || index === geometry.segmentLengths.length - 1) {
      if (segmentLength <= EPSILON) return route[index + 1];
      const amount = clamp(remaining / segmentLength, 0, 1);
      return {
        x: route[index].x + ((route[index + 1].x - route[index].x) * amount),
        y: route[index].y + ((route[index + 1].y - route[index].y) * amount),
      };
    }
    remaining -= segmentLength;
  }
  return route.at(-1);
}

function advanceRoute(distance, direction, amount, totalLength) {
  if (totalLength <= EPSILON) return { distance: 0, direction: 1 };
  const roundTripLength = totalLength * 2;
  const currentPhase = direction > 0 ? distance : roundTripLength - distance;
  const wrappedPhase = ((currentPhase + amount) % roundTripLength + roundTripLength)
    % roundTripLength;
  return wrappedPhase < totalLength
    ? { distance: wrappedPhase, direction: 1 }
    : { distance: roundTripLength - wrappedPhase, direction: -1 };
}

function refugePhase(config, timeSeconds) {
  const refuge = config.refuge;
  if (!refuge.enabled) return { phase: "cruise", cycle: -1, withinCycle: 0 };
  if (timeSeconds < refuge.firstDartSeconds) {
    return { phase: "hover", cycle: -1, withinCycle: 0 };
  }
  const elapsed = timeSeconds - refuge.firstDartSeconds;
  const cycle = Math.floor(elapsed / refuge.cadenceSeconds);
  const withinCycle = elapsed - (cycle * refuge.cadenceSeconds);
  if (withinCycle < refuge.dartSeconds) return { phase: "dart", cycle, withinCycle };
  if (withinCycle < refuge.dartSeconds + refuge.holdSeconds) {
    return { phase: "hide", cycle, withinCycle };
  }
  if (
    withinCycle
    < refuge.dartSeconds + refuge.holdSeconds + refuge.reformSeconds
  ) {
    return { phase: "reform", cycle, withinCycle };
  }
  return { phase: "hover", cycle, withinCycle };
}

function phaseTuning(config, phase) {
  if (phase === "dart") {
    return config.refuge.style === "compact"
      ? {
        speed: 2, separation: 1, alignment: 1.35, cohesion: 1.3, target: 2.8, wander: 0.8,
      }
      : {
        speed: 1.55, separation: 0.95, alignment: 1.2, cohesion: 1.2, target: 2.1, wander: 0.85,
      };
  }
  if (phase === "hide") {
    return config.refuge.style === "compact"
      ? {
        speed: 0.42, separation: 1.1, alignment: 0.8, cohesion: 1.25, target: 3.1, wander: 0.55,
      }
      : {
        speed: 0.58, separation: 1, alignment: 0.85, cohesion: 1.15, target: 2.25, wander: 0.7,
      };
  }
  if (phase === "reform") {
    return {
      speed: 1.12, separation: 1, alignment: 1.15, cohesion: 1.35, target: 1.35, wander: 0.9,
    };
  }
  return { speed: 1, separation: 1, alignment: 1, cohesion: 1, target: 1, wander: 1 };
}

function nearestCoverIndex(coverPoints, target, cycle, seedHash) {
  if (coverPoints.length <= 1) return 0;
  let nearestIndex = 0;
  let nearestDistance = Infinity;
  for (let index = 0; index < coverPoints.length; index += 1) {
    const distance = Math.hypot(
      coverPoints[index].x - target.x,
      coverPoints[index].y - target.y,
    );
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }
  if (cycle < 1) return nearestIndex;
  return (nearestIndex + cycle + (seedHash % coverPoints.length)) % coverPoints.length;
}

function shelterOrbitTarget(coverPoint, config, timeSeconds) {
  const radius = clamp(config.separationRadius * 0.72, 1.5, 4.5);
  const seedAngle = ((config.seedHash % 4096) / 4096) * Math.PI * 2;
  const angle = seedAngle + (timeSeconds * 0.68);
  return {
    x: clamp(
      coverPoint.x + (Math.cos(angle) * radius),
      config.bounds.minX,
      config.bounds.maxX,
    ),
    y: clamp(
      coverPoint.y + (Math.sin(angle) * radius * 0.62),
      config.bounds.minY,
      config.bounds.maxY,
    ),
  };
}

function schoolCentroid(agents) {
  return agents.reduce((total, agent) => ({
    x: total.x + (agent.x / agents.length),
    y: total.y + (agent.y / agents.length),
    vx: total.vx + (agent.vx / agents.length),
    vy: total.vy + (agent.vy / agents.length),
  }), { x: 0, y: 0, vx: 0, vy: 0 });
}

function coverArrivalSpeedScale(agents, target, config, phaseState, normalScale) {
  if (phaseState.phase !== "dart" && phaseState.phase !== "hide") return normalScale;
  if (config.refuge.style !== "compact") return normalScale;
  const center = schoolCentroid(agents);
  const distance = Math.hypot(target.x - center.x, target.y - center.y);
  const arrivalWindow = Math.max(
    config.fixedStepSeconds,
    config.refuge.dartSeconds + config.refuge.holdSeconds - phaseState.withinCycle,
  );
  const requiredScale = (distance / arrivalWindow) / config.maxSpeed;
  return {
    ...normalScale,
    speed: Math.min(12, Math.max(normalScale.speed, requiredScale * 1.12)),
  };
}

function targetInsideSteeringEnvelope(target, config) {
  const horizontalMargin = Math.min(
    config.boundaryMargin,
    ((config.bounds.maxX - config.bounds.minX) / 2) - EPSILON,
  );
  const verticalMargin = Math.min(
    config.boundaryMargin,
    ((config.bounds.maxY - config.bounds.minY) / 2) - EPSILON,
  );
  return {
    x: clamp(
      target.x,
      config.bounds.minX + horizontalMargin,
      config.bounds.maxX - horizontalMargin,
    ),
    y: clamp(
      target.y,
      config.bounds.minY + verticalMargin,
      config.bounds.maxY - verticalMargin,
    ),
  };
}

function interactionFalloff(distance, radius, fullStrengthRatio) {
  if (distance >= radius) return 0;
  const fullStrengthDistance = radius * fullStrengthRatio;
  if (distance <= fullStrengthDistance) return 1;
  const progress = (distance - fullStrengthDistance) / (radius - fullStrengthDistance);
  const smoothStep = progress * progress * (3 - (2 * progress));
  return 1 - smoothStep;
}

function groupForces(agent, agentIndex, agents, config, phaseScale, timeSeconds) {
  let neighborWeight = 0;
  let separationNeighbors = 0;
  let separationPressure = 0;
  let alignmentX = 0;
  let alignmentY = 0;
  let centerX = 0;
  let centerY = 0;
  let separationX = 0;
  let separationY = 0;
  const separationRadius = config.separationRadius * (
    1 + (
      Math.sin(agent.wanderPhase + (timeSeconds * agent.wanderRate * 0.7))
      * config.wanderSpacingAmplitude
    )
  );

  for (let otherIndex = 0; otherIndex < agents.length; otherIndex += 1) {
    if (otherIndex === agentIndex) continue;
    const other = agents[otherIndex];
    const offsetX = agent.x - other.x;
    const offsetY = agent.y - other.y;
    const distanceSquared = (offsetX * offsetX) + (offsetY * offsetY);
    if (distanceSquared <= EPSILON) {
      const lowerIndex = Math.min(agentIndex, otherIndex) + 1;
      const upperIndex = Math.max(agentIndex, otherIndex) + 1;
      const angle = (lowerIndex * 2.399963229728653) + (upperIndex * 0.618033988749895);
      const sign = agentIndex < otherIndex ? -1 : 1;
      separationNeighbors += 1;
      separationPressure += 1;
      separationX += Math.cos(angle) * sign;
      separationY += Math.sin(angle) * sign;
      continue;
    }
    const distance = Math.sqrt(distanceSquared);
    const perceptionWeight = interactionFalloff(distance, config.perceptionRadius, 0.68);
    if (perceptionWeight > 0) {
      neighborWeight += perceptionWeight;
      alignmentX += other.vx * perceptionWeight;
      alignmentY += other.vy * perceptionWeight;
      centerX += other.x * perceptionWeight;
      centerY += other.y * perceptionWeight;
    }
    const separationWeight = interactionFalloff(distance, separationRadius, 0.55);
    if (separationWeight > 0) {
      separationNeighbors += 1;
      separationPressure += separationWeight;
      separationX += (offsetX / distance) * separationWeight;
      separationY += (offsetY / distance) * separationWeight;
    }
  }

  let separation = { x: 0, y: 0 };
  let alignment = { x: 0, y: 0 };
  let cohesion = { x: 0, y: 0 };
  const desiredSpeed = config.maxSpeed * phaseScale.speed;

  if (separationNeighbors > 0) {
    const desired = scaledTo({
      x: separationX / separationNeighbors,
      y: separationY / separationNeighbors,
    }, desiredSpeed);
    const pressure = separationPressure / separationNeighbors;
    separation = limited(
      {
        x: desired.x * pressure,
        y: desired.y * pressure,
      },
      config.maxForce,
    );
  }
  if (neighborWeight > 0) {
    const confidence = clamp(neighborWeight, 0, 1);
    const desiredAlignment = scaledTo({
      x: alignmentX / neighborWeight,
      y: alignmentY / neighborWeight,
    }, desiredSpeed);
    alignment = limited(
      {
        x: (desiredAlignment.x - agent.vx) * confidence,
        y: (desiredAlignment.y - agent.vy) * confidence,
      },
      config.maxForce,
    );
    const cohesionSteering = steeringToward(agent, {
      x: centerX / neighborWeight,
      y: centerY / neighborWeight,
    }, desiredSpeed, config.maxForce);
    cohesion = {
      x: cohesionSteering.x * confidence,
      y: cohesionSteering.y * confidence,
    };
  }

  return { separation, alignment, cohesion };
}

function boundarySteering(agent, config) {
  const { bounds, boundaryMargin, maxSpeed, maxForce } = config;
  let x = 0;
  let y = 0;
  const leftDistance = agent.x - bounds.minX;
  const rightDistance = bounds.maxX - agent.x;
  const topDistance = agent.y - bounds.minY;
  const bottomDistance = bounds.maxY - agent.y;
  if (leftDistance < boundaryMargin) x += (boundaryMargin - leftDistance) / boundaryMargin;
  if (rightDistance < boundaryMargin) x -= (boundaryMargin - rightDistance) / boundaryMargin;
  if (topDistance < boundaryMargin) y += (boundaryMargin - topDistance) / boundaryMargin;
  if (bottomDistance < boundaryMargin) y -= (boundaryMargin - bottomDistance) / boundaryMargin;
  if (Math.abs(x) <= EPSILON && Math.abs(y) <= EPSILON) return { x: 0, y: 0 };
  const desired = scaledTo({ x, y }, maxSpeed);
  return limited({ x: desired.x - agent.vx, y: desired.y - agent.vy }, maxForce);
}

function wanderSteering(agent, timeSeconds, config, phaseScale) {
  const angle = agent.wanderPhase + (timeSeconds * agent.wanderRate);
  const crossAngle = (agent.wanderPhase * 0.73) - (timeSeconds * agent.wanderRate * 0.61);
  const strength = config.maxForce * config.wanderWeight * phaseScale.wander;
  return {
    x: Math.cos(angle) * strength,
    y: Math.sin(crossAngle) * strength * 0.72,
  };
}

function updatedAgent(
  agent,
  agentIndex,
  agents,
  centroidSteering,
  config,
  phaseScale,
  timeSeconds,
) {
  const group = groupForces(agent, agentIndex, agents, config, phaseScale, timeSeconds);
  const desiredSpeed = config.maxSpeed * phaseScale.speed;
  const boundary = boundarySteering(agent, config);
  const wander = wanderSteering(agent, timeSeconds, config, phaseScale);
  const separationAcceleration = {
    x: group.separation.x * config.separationWeight * phaseScale.separation,
    y: group.separation.y * config.separationWeight * phaseScale.separation,
  };
  const rawSteeringAcceleration = limited({
    x: (group.alignment.x * config.alignmentWeight * phaseScale.alignment)
      + (group.cohesion.x * config.cohesionWeight * phaseScale.cohesion)
      + (centroidSteering.x * config.targetWeight * phaseScale.target)
      + (boundary.x * config.boundaryWeight)
      + wander.x,
    y: (group.alignment.y * config.alignmentWeight * phaseScale.alignment)
      + (group.cohesion.y * config.cohesionWeight * phaseScale.cohesion)
      + (centroidSteering.y * config.targetWeight * phaseScale.target)
      + (boundary.y * config.boundaryWeight)
      + wander.y,
  }, config.maxForce * phaseScale.speed);
  const responseMultiplier = clamp(phaseScale.speed, 0.75, 1.5);
  const accelerationBlend = 1 - Math.exp(
    -config.steeringResponsePerSecond * responseMultiplier * config.fixedStepSeconds,
  );
  const previousSteeringX = finiteNumber(agent.steeringAx, agent.ax);
  const previousSteeringY = finiteNumber(agent.steeringAy, agent.ay);
  const steeringAcceleration = {
    x: previousSteeringX
      + ((rawSteeringAcceleration.x - previousSteeringX) * accelerationBlend),
    y: previousSteeringY
      + ((rawSteeringAcceleration.y - previousSteeringY) * accelerationBlend),
  };
  const acceleration = limited({
    x: steeringAcceleration.x + separationAcceleration.x,
    y: steeringAcceleration.y + separationAcceleration.y,
  }, config.maxForce * phaseScale.speed);

  const previousSpeed = magnitude({ x: agent.vx, y: agent.vy });
  let velocity = {
    x: agent.vx + (acceleration.x * config.fixedStepSeconds),
    y: agent.vy + (acceleration.y * config.fixedStepSeconds),
  };
  let velocityMagnitude = magnitude(velocity);
  if (velocityMagnitude > desiredSpeed) {
    const gradualSpeedLimit = config.behaviorKind !== "cover-school-ball" && previousSpeed > desiredSpeed
      ? Math.max(desiredSpeed, previousSpeed - (config.maxForce * config.fixedStepSeconds))
      : desiredSpeed;
    velocity = limited(velocity, gradualSpeedLimit);
    velocityMagnitude = magnitude(velocity);
  }
  const minimumSpeed = Math.min(config.minSpeed, desiredSpeed);
  if (velocityMagnitude < minimumSpeed) {
    const forward = velocityMagnitude > EPSILON
      ? velocity
      : previousSpeed > EPSILON
        ? { x: agent.vx, y: agent.vy }
        : { x: Math.cos(agent.heading), y: Math.sin(agent.heading) };
    velocity = scaledTo(forward, minimumSpeed);
  }

  let x = agent.x + (velocity.x * config.fixedStepSeconds);
  let y = agent.y + (velocity.y * config.fixedStepSeconds);
  if (x < config.bounds.minX || x > config.bounds.maxX) {
    x = clamp(x, config.bounds.minX, config.bounds.maxX);
    velocity = { x: -velocity.x * 0.72, y: velocity.y };
  }
  if (y < config.bounds.minY || y > config.bounds.maxY) {
    y = clamp(y, config.bounds.minY, config.bounds.maxY);
    velocity = { x: velocity.x, y: -velocity.y * 0.72 };
  }

  const moving = magnitude(velocity) > 0.02;
  const direction = Math.abs(velocity.x) > 0.02 ? (velocity.x > 0 ? 1 : -1) : agent.direction;
  const heading = moving ? Math.atan2(velocity.y, velocity.x) : agent.heading;
  return {
    ...agent,
    x,
    y,
    vx: velocity.x,
    vy: velocity.y,
    ax: acceleration.x,
    ay: acceleration.y,
    steeringAx: steeringAcceleration.x,
    steeringAy: steeringAcceleration.y,
    heading,
    direction,
  };
}

function initialAgent(value, index, config, random, origin, forward) {
  if (value) {
    const position = normalizedPoint(value, `Initial aquarium boid ${index}`, config.bounds);
    const vx = finiteNumber(value.vx, 0);
    const vy = finiteNumber(value.vy, 0);
    if (!Number.isFinite(vx) || !Number.isFinite(vy)) {
      throw new TypeError(`Initial aquarium boid ${index} must have finite velocity.`);
    }
    const velocity = magnitude({ x: vx, y: vy }) > EPSILON
      ? limited({ x: vx, y: vy }, config.maxSpeed)
      : scaledTo(forward, config.minSpeed);
    return {
      id: value.id ?? `boid-${index}`,
      x: position.x,
      y: position.y,
      vx: velocity.x,
      vy: velocity.y,
      heading: Math.atan2(velocity.y, velocity.x),
      direction: velocity.x < 0 ? -1 : 1,
      depth: clamp(finiteNumber(value.depth, 0.25 + (random() * 0.55)), 0, 1),
      wanderPhase: finiteNumber(value.wanderPhase, random() * Math.PI * 2),
      wanderRate: finiteNumber(
        value.wanderRate,
        config.wanderRateMin + (random() * (config.wanderRateMax - config.wanderRateMin)),
      ),
      ax: finiteNumber(value.ax, 0),
      ay: finiteNumber(value.ay, 0),
      steeringAx: finiteNumber(value.steeringAx, 0),
      steeringAy: finiteNumber(value.steeringAy, 0),
    };
  }

  const goldenAngle = 2.399963229728653;
  const angle = (index * goldenAngle) + ((random() - 0.5) * 0.35);
  const radialAmount = Math.sqrt((index + 0.5) / config.memberCount);
  const radius = config.initialSpread * radialAmount;
  const x = clamp(origin.x + (Math.cos(angle) * radius), config.bounds.minX, config.bounds.maxX);
  const y = clamp(origin.y + (Math.sin(angle) * radius), config.bounds.minY, config.bounds.maxY);
  const forwardAngle = Math.atan2(forward.y, forward.x) + ((random() - 0.5) * 0.4);
  const speed = config.minSpeed + ((config.maxSpeed - config.minSpeed) * (0.4 + (random() * 0.25)));
  const vx = Math.cos(forwardAngle) * speed;
  const vy = Math.sin(forwardAngle) * speed;
  return {
    id: `boid-${index}`,
    x,
    y,
    vx,
    vy,
    heading: Math.atan2(vy, vx),
    direction: vx < 0 ? -1 : 1,
    depth: 0.25 + (random() * 0.55),
    wanderPhase: random() * Math.PI * 2,
    wanderRate: config.wanderRateMin
      + (random() * (config.wanderRateMax - config.wanderRateMin)),
    ax: 0,
    ay: 0,
    steeringAx: 0,
    steeringAy: 0,
  };
}

function buildConfig(options) {
  const profile = options?.movementProfile ?? {};
  const behaviorKind = options?.behaviorKind ?? profile.behaviorKind ?? "contour-school";
  if (!SCHOOL_BEHAVIOR_KINDS.has(behaviorKind)) {
    throw new RangeError(`Unsupported aquarium schooling behavior: ${behaviorKind}.`);
  }
  const behavior = BEHAVIOR_TUNING[behaviorKind];
  const bounds = normalizedBounds(options?.bounds);
  const habitat = options?.habitat ?? profile.habitat ?? {};
  const authoredRoute = options?.route ?? habitat.contourPath?.points;
  const openWaterRoute = routeFromOpenWaterLane(
    options?.openWaterLane ?? habitat.openWaterLane,
    bounds,
  );
  const routeSource = Array.isArray(authoredRoute) && authoredRoute.length > 0
    ? authoredRoute
    : openWaterRoute;
  if (!routeSource) {
    throw new TypeError("Aquarium boids need a habitat route or valid open-water lane.");
  }
  const route = Object.freeze(routeSource.map((point, index) => (
    normalizedPoint(point, `Aquarium route point ${index}`, bounds)
  )));
  const coverSource = options?.coverPoints ?? habitat.coverPoints ?? [];
  if (!Array.isArray(coverSource)) throw new TypeError("Aquarium coverPoints must be an array.");
  const coverPoints = Object.freeze(coverSource.map((point, index) => (
    normalizedPoint(point, `Aquarium cover point ${index}`, bounds)
  )));
  const social = options?.social ?? profile.social ?? {};
  const timing = options?.timing ?? profile.timing ?? {};
  const memberCount = options?.memberCount
    ?? options?.count
    ?? social.visualCount
    ?? profile.groupSize
    ?? 5;
  if (!Number.isSafeInteger(memberCount) || memberCount < 2 || memberCount > 24) {
    throw new RangeError("Aquarium boid memberCount must be an integer from 2 through 24.");
  }
  const fixedStepSeconds = finiteNumber(
    options?.fixedStepSeconds,
    AQUARIUM_BOIDS_FIXED_STEP_SECONDS,
  );
  if (fixedStepSeconds <= 0 || fixedStepSeconds > 0.25) {
    throw new RangeError("Aquarium boid fixedStepSeconds must be greater than 0 and at most 0.25.");
  }

  const profileSpeed = clamp(finiteNumber(profile.speed, 0.8), 0.1, 2);
  const spacing = clamp(finiteNumber(social.spacingPercent, 4.5), 1, 15);
  const cohesion = clamp(finiteNumber(social.cohesion, 0.82), 0.1, 1);
  const baseMaxSpeed = Math.max(
    0.1,
    finiteNumber(options?.maxSpeed, 3.5 + (profileSpeed * 3.1)),
  );
  const maxSpeed = baseMaxSpeed * behavior.maxSpeedMultiplier;
  const minSpeed = clamp(
    finiteNumber(options?.minSpeed, maxSpeed * behavior.minSpeedMultiplier),
    0,
    maxSpeed,
  );
  const refugeCadence = midpoint(timing.refugeCadenceSeconds, behaviorKind === "cover-school-ball" ? 28 : 14);
  const dartSeconds = midpoint(timing.burstSeconds, behaviorKind === "cover-school-ball" ? 0.8 : 1.4);
  const holdSeconds = midpoint(timing.pauseSeconds, behaviorKind === "cover-school-ball" ? 2.2 : 1.3);
  const configuredDartSeconds = Math.max(
    fixedStepSeconds,
    finiteNumber(options?.refuge?.dartSeconds, dartSeconds),
  );
  const configuredHoldSeconds = Math.max(
    fixedStepSeconds,
    finiteNumber(options?.refuge?.holdSeconds, holdSeconds),
  );
  const reformSeconds = Math.max(
    fixedStepSeconds,
    finiteNumber(options?.refuge?.reformSeconds, Math.max(1.2, holdSeconds)),
  );
  const requestedCadence = finiteNumber(options?.refuge?.cadenceSeconds, refugeCadence);
  const cadenceSeconds = Math.max(
    requestedCadence,
    configuredDartSeconds + configuredHoldSeconds + reformSeconds + fixedStepSeconds,
  );
  const refuge = Object.freeze({
    enabled: options?.refuge?.enabled ?? Boolean(behavior.refugeStyle),
    style: behavior.refugeStyle,
    firstDartSeconds: Math.max(0, finiteNumber(
      options?.refuge?.firstDartSeconds,
      cadenceSeconds * 0.42,
    )),
    cadenceSeconds,
    dartSeconds: configuredDartSeconds,
    holdSeconds: configuredHoldSeconds,
    reformSeconds,
  });
  if (refuge.enabled && coverPoints.length === 0) {
    throw new TypeError(`${behaviorKind} has enabled refuge behavior but no aquarium cover point.`);
  }

  const config = {
    seed: String(options?.seed ?? "aquarium-school"),
    seedHash: hashSeed(options?.seed),
    memberCount,
    behaviorKind,
    bounds,
    route,
    routeGeometry: routeGeometry(route),
    coverPoints,
    fixedStepSeconds,
    maxSpeed,
    minSpeed,
    maxForce: Math.max(0.1, finiteNumber(options?.maxForce, maxSpeed * 1.25)),
    routeSpeed: Math.max(0, finiteNumber(options?.routeSpeed, maxSpeed * behavior.routeSpeedMultiplier)),
    perceptionRadius: Math.max(spacing, finiteNumber(options?.perceptionRadius, spacing * 3.2)),
    separationRadius: Math.max(0.25, finiteNumber(
      options?.separationRadius,
      spacing * behavior.separationRadiusMultiplier,
    )),
    separationWeight: Math.max(0, finiteNumber(options?.separationWeight, behavior.separationWeight)),
    alignmentWeight: Math.max(0, finiteNumber(options?.alignmentWeight, behavior.alignmentWeight)),
    cohesionWeight: Math.max(0, finiteNumber(
      options?.cohesionWeight,
      behavior.cohesionWeight * (0.55 + (cohesion * 0.7)),
    )),
    targetWeight: Math.max(0, finiteNumber(options?.targetWeight, behavior.targetWeight)),
    boundaryWeight: Math.max(0, finiteNumber(options?.boundaryWeight, 2.4)),
    wanderWeight: clamp(finiteNumber(options?.wanderWeight, behavior.wanderWeight), 0, 0.6),
    wanderSpacingAmplitude: clamp(
      finiteNumber(options?.wanderSpacingAmplitude, behavior.wanderSpacingAmplitude),
      0,
      0.2,
    ),
    steeringResponsePerSecond: clamp(
      finiteNumber(
        options?.steeringResponsePerSecond,
        behavior.steeringResponsePerSecond,
      ),
      1,
      30,
    ),
    wanderRateMin: clamp(finiteNumber(options?.wanderRateMin, 0.62), 0.1, 2),
    wanderRateMax: clamp(finiteNumber(options?.wanderRateMax, 1.08), 0.1, 2),
    boundaryMargin: clamp(
      finiteNumber(options?.boundaryMargin, Math.max(3, spacing)),
      0.5,
      Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2,
    ),
    initialSpread: Math.max(0.2, finiteNumber(
      options?.initialSpread,
      spacing * behavior.initialSpreadMultiplier,
    )),
    refuge,
  };
  if (config.wanderRateMax < config.wanderRateMin) {
    [config.wanderRateMin, config.wanderRateMax] = [config.wanderRateMax, config.wanderRateMin];
  }
  return Object.freeze(config);
}

/**
 * Creates deterministic schooling state. `movementProfile` may be passed
 * directly from adventureAquariumExhibits.mjs.
 */
export function createAquariumBoids(options = {}) {
  const config = buildConfig(options);
  const random = seededGenerator(config.seed);
  const target = pointAlongRoute(config.route, config.routeGeometry, 0);
  const nextRoutePoint = config.route[1] ?? {
    x: target.x + 1,
    y: target.y,
  };
  const forward = {
    x: nextRoutePoint.x - target.x,
    y: nextRoutePoint.y - target.y,
  };
  const initialValues = options.initialAgents;
  if (initialValues !== undefined && (
    !Array.isArray(initialValues) || initialValues.length !== config.memberCount
  )) {
    throw new RangeError("initialAgents must contain exactly memberCount entries.");
  }
  const agents = Array.from({ length: config.memberCount }, (_, index) => (
    initialAgent(initialValues?.[index], index, config, random, target, forward)
  ));
  const phaseState = refugePhase(config, 0);
  return {
    config,
    timeSeconds: 0,
    stepCount: 0,
    routeDistance: 0,
    routeDirection: 1,
    phase: phaseState.phase,
    target: { ...target },
    agents,
  };
}

function singleStep(state) {
  const { config } = state;
  const timeSeconds = state.timeSeconds + config.fixedStepSeconds;
  const routeState = advanceRoute(
    state.routeDistance,
    state.routeDirection,
    config.routeSpeed * config.fixedStepSeconds,
    config.routeGeometry.totalLength,
  );
  const routeTarget = pointAlongRoute(config.route, config.routeGeometry, routeState.distance);
  const phaseState = refugePhase(config, timeSeconds);
  const seekingCover = phaseState.phase === "dart" || phaseState.phase === "hide";
  const coverIndex = seekingCover
    ? nearestCoverIndex(config.coverPoints, routeTarget, phaseState.cycle, config.seedHash)
    : -1;
  let target = seekingCover ? config.coverPoints[coverIndex] : routeTarget;
  if (config.behaviorKind === "shelter-school" && phaseState.phase === "hide") {
    target = shelterOrbitTarget(target, config, timeSeconds);
  }
  target = targetInsideSteeringEnvelope(target, config);
  const phaseScale = coverArrivalSpeedScale(
    state.agents,
    target,
    config,
    phaseState,
    phaseTuning(config, phaseState.phase),
  );
  const center = schoolCentroid(state.agents);
  const centroidSteering = steeringToward(
    center,
    target,
    config.maxSpeed * phaseScale.speed,
    config.maxForce,
  );
  const agents = state.agents.map((agent, agentIndex) => (
    updatedAgent(
      agent,
      agentIndex,
      state.agents,
      centroidSteering,
      config,
      phaseScale,
      timeSeconds,
    )
  ));
  return {
    ...state,
    timeSeconds,
    stepCount: state.stepCount + 1,
    routeDistance: routeState.distance,
    routeDirection: routeState.direction,
    phase: phaseState.phase,
    target: { ...target },
    agents,
  };
}

/**
 * Pure fixed-step advance. A browser integration should accumulate frame time,
 * then call this with the number of complete 1/30-second steps available.
 */
export function stepAquariumBoids(state, steps = 1) {
  if (!state?.config || !Array.isArray(state.agents)) {
    throw new TypeError("stepAquariumBoids needs state from createAquariumBoids.");
  }
  if (!Number.isSafeInteger(steps) || steps < 0 || steps > 10000) {
    throw new RangeError("Aquarium boid steps must be an integer from 0 through 10000.");
  }
  let nextState = state;
  for (let index = 0; index < steps; index += 1) nextState = singleStep(nextState);
  return nextState;
}
