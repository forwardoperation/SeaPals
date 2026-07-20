import { movePlayerContinuous } from "./adventureWorld.mjs";

const CHARACTER_INTERACTION_TYPES = new Set(["npc", "trainer"]);
const FACING_DELTAS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

export const ADVENTURE_ACTOR_DEFAULTS = Object.freeze({
  // Keep collisions at a person's feet. A larger shoulder-sized circle made
  // one NPC behave like a wall across Elverson's compact streets.
  radius: 0.24,
  speed: 0.62,
  pauseMs: 1100,
  focusDwellMs: 200,
  playerPauseDistance: 1.05,
  arrivalDistance: 0.035,
  blockedRetargetMs: 900,
  maxElapsedMs: 80,
});

function requireFinitePosition(position, label) {
  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) {
    throw new TypeError(`${label} requires finite x and y coordinates.`);
  }
  return position;
}

function requireNonNegativeNumber(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number.`);
  }
  return value;
}

function copyPosition(position) {
  return { x: position.x, y: position.y };
}

function characterInteractions(interactions) {
  if (!Array.isArray(interactions)) {
    throw new TypeError("Adventure actor interactions must be an array.");
  }
  return interactions.filter((interaction) => CHARACTER_INTERACTION_TYPES.has(interaction?.type));
}

function resolvePatrol(interaction) {
  const patrol = interaction?.patrol;
  if (!patrol) return null;
  if (!Array.isArray(patrol.waypoints) || patrol.waypoints.length < 2) {
    throw new RangeError(`Adventure actor ${interaction.id} patrol requires at least two waypoints.`);
  }
  const waypoints = patrol.waypoints.map((position, index) => (
    copyPosition(requireFinitePosition(position, `Adventure actor ${interaction.id} waypoint ${index}`))
  ));
  const speed = patrol.speed ?? ADVENTURE_ACTOR_DEFAULTS.speed;
  const pauseMs = patrol.pauseMs ?? ADVENTURE_ACTOR_DEFAULTS.pauseMs;
  const playerPauseDistance = patrol.playerPauseDistance ?? ADVENTURE_ACTOR_DEFAULTS.playerPauseDistance;
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new RangeError(`Adventure actor ${interaction.id} patrol speed must be positive.`);
  }
  requireNonNegativeNumber(pauseMs, `Adventure actor ${interaction.id} patrol pauseMs`);
  requireNonNegativeNumber(
    playerPauseDistance,
    `Adventure actor ${interaction.id} patrol playerPauseDistance`,
  );
  if (patrol.mode !== undefined && !["loop", "ping-pong"].includes(patrol.mode)) {
    throw new RangeError(`Adventure actor ${interaction.id} patrol mode must be loop or ping-pong.`);
  }
  return {
    waypoints,
    speed,
    pauseMs,
    playerPauseDistance,
    mode: patrol.mode ?? "ping-pong",
  };
}

function facingToward(delta, fallback = "down") {
  if (Math.abs(delta.x) > Math.abs(delta.y)) return delta.x < 0 ? "left" : "right";
  if (Math.abs(delta.y) > 0) return delta.y < 0 ? "up" : "down";
  return FACING_DELTAS[fallback] ? fallback : "down";
}

/**
 * Returns the cardinal direction an actor at `origin` should face to look at
 * `target`. Exact diagonal ties favor the vertical direction so conversations
 * never leave a sprite between animation rows.
 */
export function getAdventureFacingToward(origin, target, fallback = "down") {
  requireFinitePosition(origin, "Adventure actor facing origin");
  requireFinitePosition(target, "Adventure actor facing target");
  return facingToward(
    { x: target.x - origin.x, y: target.y - origin.y },
    fallback,
  );
}

function distanceBetween(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function nextWaypoint(actor, patrol) {
  if (patrol.mode === "loop") {
    return {
      waypointIndex: (actor.waypointIndex + 1) % patrol.waypoints.length,
      patrolDirection: 1,
    };
  }

  let direction = actor.patrolDirection || 1;
  let waypointIndex = actor.waypointIndex + direction;
  if (waypointIndex >= patrol.waypoints.length || waypointIndex < 0) {
    direction *= -1;
    waypointIndex = actor.waypointIndex + direction;
  }
  return { waypointIndex, patrolDirection: direction };
}

export function createAdventureActorStates(interactions) {
  return Object.fromEntries(characterInteractions(interactions).map((interaction) => {
    requireFinitePosition(interaction.at, `Adventure actor ${interaction.id} anchor`);
    const patrol = resolvePatrol(interaction);
    const anchorWaypointIndex = patrol?.waypoints.findIndex((waypoint) => (
      distanceBetween(waypoint, interaction.at) <= ADVENTURE_ACTOR_DEFAULTS.arrivalDistance
    )) ?? -1;
    const startsAtPatrolEnd = patrol && anchorWaypointIndex === patrol.waypoints.length - 1;
    return [interaction.id, {
      interactionId: interaction.id,
      position: copyPosition(interaction.at),
      facing: FACING_DELTAS[interaction.facing] ? interaction.facing : "down",
      moving: false,
      waypointIndex: patrol && anchorWaypointIndex >= 0
        ? startsAtPatrolEnd
          ? Math.max(0, anchorWaypointIndex - 1)
          : (anchorWaypointIndex + 1) % patrol.waypoints.length
        : 0,
      patrolDirection: startsAtPatrolEnd ? -1 : 1,
      dwellRemainingMs: patrol ? patrol.pauseMs : 0,
      blockedMs: 0,
    }];
  }));
}

export function getAdventureActorPositionOverrides(actorStates = {}) {
  return Object.fromEntries(Object.entries(actorStates).map(([interactionId, actor]) => [
    interactionId,
    copyPosition(requireFinitePosition(actor?.position, `Adventure actor ${interactionId}`)),
  ]));
}

export function getAdventureActorBlockers(actorStates = {}, {
  excludeInteractionId = null,
  radius = ADVENTURE_ACTOR_DEFAULTS.radius,
} = {}) {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new RangeError("Adventure actor blocker radius must be positive.");
  }
  return Object.entries(actorStates)
    .filter(([interactionId]) => interactionId !== excludeInteractionId)
    .map(([interactionId, actor]) => ({
      id: interactionId,
      position: copyPosition(requireFinitePosition(actor?.position, `Adventure actor ${interactionId}`)),
      radius,
    }));
}

/**
 * Gives one live actor its conversational focus without disturbing any patrol
 * route state. Unknown interaction ids deliberately return the original state
 * object so callers can safely pass optional conversation metadata.
 */
export function focusAdventureActor(
  actorStates,
  interactionId,
  playerPosition,
  { dwellMs = ADVENTURE_ACTOR_DEFAULTS.focusDwellMs } = {},
) {
  if (!actorStates || typeof actorStates !== "object" || Array.isArray(actorStates)) {
    throw new TypeError("Adventure actor focus requires an actor state object.");
  }
  const actor = actorStates[interactionId];
  if (!actor) return actorStates;

  requireFinitePosition(actor.position, `Adventure actor ${interactionId}`);
  requireFinitePosition(playerPosition, "Adventure player position");
  requireNonNegativeNumber(dwellMs, "Adventure actor focus dwellMs");

  return {
    ...actorStates,
    [interactionId]: {
      ...actor,
      facing: getAdventureFacingToward(actor.position, playerPosition, actor.facing),
      moving: false,
      dwellRemainingMs: dwellMs,
      blockedMs: 0,
    },
  };
}

/**
 * Advances local-only actor patrols. The caller owns persistence; these small
 * ambient movements deliberately reset at the authored anchor on scene entry.
 */
export function advanceAdventureActorStates(
  sceneId,
  interactions,
  actorStates,
  elapsedMs,
  {
    playerPosition = null,
    reducedMotion = false,
    radius = ADVENTURE_ACTOR_DEFAULTS.radius,
  } = {},
) {
  if (typeof sceneId !== "string" || !sceneId) {
    throw new TypeError("Adventure actor advancement requires a scene id.");
  }
  requireNonNegativeNumber(elapsedMs, "Adventure actor elapsedMs");
  if (playerPosition) requireFinitePosition(playerPosition, "Adventure player position");
  const elapsed = Math.min(elapsedMs, ADVENTURE_ACTOR_DEFAULTS.maxElapsedMs);
  const authoredActors = characterInteractions(interactions);
  const previous = actorStates && typeof actorStates === "object"
    ? actorStates
    : createAdventureActorStates(interactions);
  const next = { ...previous };

  for (const interaction of authoredActors) {
    const patrol = resolvePatrol(interaction);
    const current = previous[interaction.id] ?? createAdventureActorStates([interaction])[interaction.id];
    if (!patrol || reducedMotion) {
      next[interaction.id] = {
        ...current,
        position: reducedMotion ? copyPosition(interaction.at) : copyPosition(current.position),
        moving: false,
        waypointIndex: reducedMotion ? 0 : current.waypointIndex,
        patrolDirection: reducedMotion ? 1 : current.patrolDirection,
        dwellRemainingMs: reducedMotion ? patrol?.pauseMs ?? 0 : current.dwellRemainingMs,
        blockedMs: 0,
      };
      continue;
    }

    const playerDistance = playerPosition ? distanceBetween(current.position, playerPosition) : Infinity;
    if (playerDistance <= patrol.playerPauseDistance) {
      next[interaction.id] = {
        ...current,
        moving: false,
        blockedMs: 0,
      };
      continue;
    }

    if (current.dwellRemainingMs > 0 || elapsed === 0) {
      next[interaction.id] = {
        ...current,
        moving: false,
        dwellRemainingMs: Math.max(0, current.dwellRemainingMs - elapsed),
        blockedMs: 0,
      };
      continue;
    }

    const target = patrol.waypoints[current.waypointIndex];
    const delta = { x: target.x - current.position.x, y: target.y - current.position.y };
    const distance = Math.hypot(delta.x, delta.y);
    if (distance <= ADVENTURE_ACTOR_DEFAULTS.arrivalDistance) {
      const waypoint = nextWaypoint(current, patrol);
      next[interaction.id] = {
        ...current,
        ...waypoint,
        position: copyPosition(target),
        moving: false,
        dwellRemainingMs: patrol.pauseMs,
        blockedMs: 0,
      };
      continue;
    }

    const otherActors = Object.fromEntries(Object.entries(previous).filter(
      ([interactionId]) => interactionId !== interaction.id,
    ));
    const dynamicBlockers = getAdventureActorBlockers(otherActors, { radius });
    if (playerPosition) {
      dynamicBlockers.push({ id: "player", position: copyPosition(playerPosition), radius: 0.3 });
    }
    const movementElapsed = Math.min(elapsed, (distance / patrol.speed) * 1000);
    const moved = movePlayerContinuous(
      sceneId,
      current.position,
      { x: delta.x / distance, y: delta.y / distance },
      movementElapsed,
      {
        speed: patrol.speed,
        radius,
        maxStepDistance: 0.04,
        dynamicBlockers,
        ignoreActorTiles: true,
      },
    );
    const travel = distanceBetween(current.position, moved);
    const blockedMs = travel <= 0.0005 ? current.blockedMs + elapsed : 0;
    const blocked = blockedMs >= ADVENTURE_ACTOR_DEFAULTS.blockedRetargetMs;
    next[interaction.id] = {
      ...current,
      ...(blocked ? nextWaypoint(current, patrol) : {}),
      position: copyPosition(moved),
      facing: facingToward(delta, current.facing),
      moving: travel > 0.0005,
      dwellRemainingMs: blocked ? Math.min(300, patrol.pauseMs) : 0,
      blockedMs: blocked ? 0 : blockedMs,
    };
  }

  return next;
}
