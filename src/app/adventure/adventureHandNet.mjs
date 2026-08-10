import { ELVERSON_REEF_CATCHES } from "./adventureFishing.mjs";
import { ELVERSON_BAITS_BY_ID } from "./adventureBait.mjs";

export const HAND_NET_STATE_VERSION = 1;

export const HAND_NET_PHASES = Object.freeze({
  PLAYING: "playing",
  CAUGHT: "caught",
  ESCAPED: "escaped",
});

export const HAND_NET_ACTIONS = Object.freeze({
  MOVE: "move",
  STOP: "stop",
  SCOOP: "scoop",
  PLACE_BAIT: "place-bait",
});

export const HAND_NET_SCOOP_PHASES = Object.freeze({
  IDLE: "idle",
  WINDUP: "windup",
  SWING: "swing",
  IMPACT: "impact",
  RECOVERY: "recovery",
  COMPLETE: "complete",
});

export const HAND_NET_BAIT_PLACEMENT_PHASES = Object.freeze({
  IDLE: "idle",
  WINDUP: "windup",
  LOWERING: "lowering",
  SETTLING: "settling",
  COMPLETE: "complete",
});

const PHASE_SET = new Set(Object.values(HAND_NET_PHASES));
const ARENA = Object.freeze({ width: 12, height: 8 });
const PLAYER_BOUNDS = Object.freeze({ left: 0.4, top: 2, right: 11.6, bottom: 7.05 });
const CREATURE_BOUNDS = Object.freeze({ left: 0.45, top: 0.65, right: 11.55, bottom: 6.45 });
const ESCAPE_BOUNDS = Object.freeze({ left: -0.25, top: 0.2, right: 12.25, bottom: 7.8 });
export const HAND_NET_SIMULATION_STEP_MS = 20;
const WALK_FRAME_DURATION_MS = 110;
const WALK_FRAME_SEQUENCE = Object.freeze([1, 0, 2, 0]);
const ACTIVE_CREATURE_STATUSES = new Set(["wandering", "attracted", "feeding"]);
const MAX_TICK_MS = 10_000;
const UINT32_MAX = 0xffff_ffff;
const TAU = Math.PI * 2;
const EPSILON = 1e-9;

const RARITY_SPEED = Object.freeze({
  common: 0.72,
  uncommon: 0.82,
  rare: 0.92,
  legendary: 1,
});

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function finiteNumber(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
}

/**
 * Separates display-frame time from the deterministic simulation cadence.
 * The UI can retain the sub-step remainder without replacing React state on
 * frames where the simulation has no work to perform.
 */
export function consumeHandNetFrameElapsed(accumulatorMs, elapsedMs) {
  finiteNumber(accumulatorMs, "Hand-net frame accumulatorMs");
  finiteNumber(elapsedMs, "Hand-net frame elapsedMs");
  if (accumulatorMs < 0 || accumulatorMs >= HAND_NET_SIMULATION_STEP_MS) {
    throw new RangeError(
      `Hand-net frame accumulatorMs must stay between 0 and ${HAND_NET_SIMULATION_STEP_MS}.`,
    );
  }
  if (elapsedMs < 0 || elapsedMs > MAX_TICK_MS) {
    throw new RangeError(`Hand-net frame elapsedMs must stay between 0 and ${MAX_TICK_MS}.`);
  }

  const availableMs = accumulatorMs + elapsedMs;
  const stepCount = Math.floor(
    (availableMs + EPSILON) / HAND_NET_SIMULATION_STEP_MS,
  );
  const simulationElapsedMs = stepCount * HAND_NET_SIMULATION_STEP_MS;
  return {
    simulationElapsedMs,
    remainderMs: Math.max(0, availableMs - simulationElapsedMs),
  };
}

function requireState(state) {
  if (!isRecord(state) || state.version !== HAND_NET_STATE_VERSION) {
    throw new TypeError(`Hand-net state must use version ${HAND_NET_STATE_VERSION}.`);
  }
  if (!PHASE_SET.has(state.phase)) throw new RangeError(`Unknown hand-net phase: ${String(state.phase)}.`);
  if (!isRecord(state.player) || !isRecord(state.player.position) || !isRecord(state.player.intent)) {
    throw new TypeError("Hand-net state requires player position and intent.");
  }
  if (!isRecord(state.net) || !isRecord(state.net.position)) {
    throw new TypeError("Hand-net state requires net geometry.");
  }
  if (!isRecord(state.bait)) {
    throw new TypeError("Hand-net state requires bait state.");
  }
  if (!Array.isArray(state.creatures) || state.creatures.length === 0) {
    throw new TypeError("Hand-net state requires at least one creature.");
  }
  return state;
}

function copyPoint(point) {
  return { x: point.x, y: point.y };
}

/**
 * Builds the compositor-only actor positions for the current display frame.
 * Gameplay remains on the deterministic fixed-step states; rendering stays one
 * simulation step behind so every monitor refresh receives an even position.
 */
export function interpolateHandNetRenderPositions(
  previousStateValue,
  currentStateValue,
  remainderMs,
) {
  const previousState = requireState(previousStateValue);
  const currentState = requireState(currentStateValue);
  finiteNumber(remainderMs, "Hand-net render remainderMs");
  if (remainderMs < 0 || remainderMs >= HAND_NET_SIMULATION_STEP_MS) {
    throw new RangeError(
      `Hand-net render remainderMs must stay between 0 and ${HAND_NET_SIMULATION_STEP_MS}.`,
    );
  }
  if (previousState.creatures.length !== currentState.creatures.length) {
    throw new RangeError("Hand-net render states must contain the same creatures.");
  }

  const interpolationAlpha = remainderMs / HAND_NET_SIMULATION_STEP_MS;
  const interpolatePoint = (previousPoint, currentPoint) => ({
    x: previousPoint.x + ((currentPoint.x - previousPoint.x) * interpolationAlpha),
    y: previousPoint.y + ((currentPoint.y - previousPoint.y) * interpolationAlpha),
  });
  const creatures = previousState.creatures.map((previousCreature, index) => {
    const currentCreature = currentState.creatures[index];
    if (currentCreature?.id !== previousCreature.id) {
      throw new RangeError(
        `Hand-net render states are missing creature ${String(previousCreature.id)}.`,
      );
    }
    return {
      id: previousCreature.id,
      position: interpolatePoint(previousCreature.position, currentCreature.position),
    };
  });

  return deepFreeze({
    interpolationAlpha,
    player: {
      position: interpolatePoint(
        previousState.player.position,
        currentState.player.position,
      ),
    },
    creatures,
  });
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function magnitude(vector) {
  return Math.hypot(vector.x, vector.y);
}

function normalized(vector, fallback = { x: 0, y: -1 }) {
  const length = magnitude(vector);
  if (length <= EPSILON) return copyPoint(fallback);
  return { x: vector.x / length, y: vector.y / length };
}

function nextRandom(rngState) {
  const state = (Math.imul(rngState, 1_664_525) + 1_013_904_223) >>> 0;
  return { state, value: state / 0x1_0000_0000 };
}

function drawRandom(cursor) {
  const draw = nextRandom(cursor.state);
  cursor.state = draw.state;
  return draw.value;
}

function weightedCreature(randomValue) {
  const totalWeight = ELVERSON_REEF_CATCHES.reduce((total, creature) => total + creature.weight, 0);
  const roll = randomValue * totalWeight;
  let cursor = 0;
  for (const creature of ELVERSON_REEF_CATCHES) {
    cursor += creature.weight;
    if (roll < cursor) return creature;
  }
  return ELVERSON_REEF_CATCHES.at(-1);
}

function requireBaitDefinition(baitId) {
  const definition = typeof baitId === "string"
    && Object.prototype.hasOwnProperty.call(ELVERSON_BAITS_BY_ID, baitId)
    ? ELVERSON_BAITS_BY_ID[baitId]
    : null;
  if (!definition) {
    throw new RangeError(`Unknown Elverson bait: ${String(baitId)}.`);
  }
  return definition;
}

function baitMatchesCreature(definition, creature) {
  return definition.speciesIds.includes(creature.speciesId);
}

function settledBaitDefinition(state) {
  const activeBait = state.bait.active;
  if (!activeBait || activeBait.remainingMs <= 0) return null;
  const definition = ELVERSON_BAITS_BY_ID[activeBait.baitId];
  return definition ? { activeBait, definition } : null;
}

function creatureSpeed(creature, { reducedMotion }) {
  let speed = RARITY_SPEED[creature.rarity] ?? RARITY_SPEED.common;
  if (creature.id === "sea-urchin") speed = 0.2;
  else if (creature.category === "invertebrate") speed *= 0.7;
  if (reducedMotion) speed *= 0.48;
  return speed;
}

function netPosition(player, reach) {
  const facing = normalized(player.facing);
  const landingDirection = normalized({
    x: (facing.x < 0 ? -1 : 1),
    // The authored isometric atlas lands lower in front-facing rows and just
    // above the player's feet in rear-facing rows. This is the same vector
    // used for collision, so the invisible hitbox follows the painted hoop.
    y: facing.y < 0 ? -0.1 : 0.41,
  });
  return {
    x: clamp(player.position.x + landingDirection.x * reach, 0.15, ARENA.width - 0.15),
    y: clamp(player.position.y + landingDirection.y * reach, 0.15, ARENA.height - 0.15),
  };
}

function reachableBaitPosition(position, feedingRadius) {
  const closestCreaturePoint = {
    x: clamp(position.x, CREATURE_BOUNDS.left, CREATURE_BOUNDS.right),
    y: clamp(position.y, CREATURE_BOUNDS.top, CREATURE_BOUNDS.bottom),
  };
  const offset = {
    x: position.x - closestCreaturePoint.x,
    y: position.y - closestCreaturePoint.y,
  };
  const distance = magnitude(offset);
  if (distance <= feedingRadius) return copyPoint(position);

  // Project onto the rounded edge of the swim area. This keeps the bait as
  // close as possible to the painted hoop while guaranteeing that a matching
  // creature can enter its feeding radius even at the bottom shoreline.
  const reachableDistance = feedingRadius * 0.95;
  const scale = reachableDistance / distance;
  return {
    x: closestCreaturePoint.x + offset.x * scale,
    y: closestCreaturePoint.y + offset.y * scale,
  };
}

function isometricFacing(intent, currentFacing) {
  return normalized({
    x: Math.abs(intent.x) > EPSILON ? Math.sign(intent.x) : (currentFacing.x < 0 ? -1 : 1),
    y: Math.abs(intent.y) > EPSILON ? Math.sign(intent.y) : (currentFacing.y < 0 ? -1 : 1),
  });
}

function initialSchool(count, cursor, settings, requiredCreatureId) {
  const columns = Math.ceil(Math.sqrt(count * 1.5));
  const rows = Math.ceil(count / columns);
  const school = [];

  for (let index = 0; index < count; index += 1) {
    const speciesRoll = drawRandom(cursor);
    const species = index === 0 && requiredCreatureId
      ? ELVERSON_REEF_CATCHES.find(({ id }) => id === requiredCreatureId)
      : weightedCreature(speciesRoll);
    const column = index % columns;
    const row = Math.floor(index / columns);
    const jitterX = (drawRandom(cursor) - 0.5) * 0.5;
    const jitterY = (drawRandom(cursor) - 0.5) * 0.38;
    const angle = drawRandom(cursor) * TAU;
    const turnRemainingMs = 500 + Math.round(drawRandom(cursor) * 700);
    school.push({
      id: `hand-net-creature-${index + 1}`,
      speciesId: species.id,
      cardId: species.cardId,
      category: species.category,
      rarity: species.rarity,
      position: {
        x: clamp(1.1 + ((column + 0.5) / columns) * 9.8 + jitterX, CREATURE_BOUNDS.left, CREATURE_BOUNDS.right),
        y: clamp(0.75 + ((row + 0.5) / rows) * 4.6 + jitterY, CREATURE_BOUNDS.top, 5.65),
      },
      heading: { x: Math.cos(angle), y: Math.sin(angle) },
      speed: creatureSpeed(species, settings),
      radius: species.category === "invertebrate" ? 0.16 : 0.19,
      alert: 0,
      status: "wandering",
      baitTargetId: null,
      turnRemainingMs,
    });
  }
  return school;
}

function createSettings({ reducedMotion = false } = {}) {
  if (typeof reducedMotion !== "boolean") throw new TypeError("Hand-net reducedMotion must be boolean.");
  return {
    reducedMotion,
    alertRadius: 1.65,
    alertThreshold: 0.72,
    alertGainPerSecond: 1.75,
    fastApproachSpeed: 0.68,
    netRadius: 0.45,
    scoopAnimationMs: 700,
    scoopWindupEndMs: 240,
    scoopContactMs: 440,
    scoopRecoveryStartMs: 500,
    scoopContactWindowMs: HAND_NET_SIMULATION_STEP_MS,
    cooldownMs: 440,
    missAlert: 0.18,
    baitPlacementAnimationMs: 700,
    baitPlacementLoweringMs: 240,
    baitPlacementReleaseMs: 440,
    baitFeedingRadius: 0.7,
    motionScale: reducedMotion ? 0.48 : 1,
  };
}

/** Creates a frozen, serializable shallow-water hand-net attempt. */
export function createHandNetState({
  seed = 1,
  creatureCount = 5,
  requiredCreatureId = null,
  reducedMotion = false,
} = {}) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > UINT32_MAX) {
    throw new RangeError("Hand-net seed must be an unsigned 32-bit integer.");
  }
  if (!Number.isSafeInteger(creatureCount) || creatureCount < 1 || creatureCount > 8) {
    throw new RangeError("Hand-net creatureCount must be an integer from 1 through 8.");
  }
  if (
    requiredCreatureId !== null
    && !ELVERSON_REEF_CATCHES.some(({ id }) => id === requiredCreatureId)
  ) {
    throw new RangeError(`Unknown required hand-net creature: ${String(requiredCreatureId)}.`);
  }

  const settings = createSettings({ reducedMotion });
  const cursor = { state: seed >>> 0 };
  const player = {
    position: { x: ARENA.width / 2, y: 5.72 },
    intent: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
    speed: 2.6 * (reducedMotion ? 0.72 : 1),
  };
  const reach = 1.4;
  const state = {
    version: HAND_NET_STATE_VERSION,
    phase: HAND_NET_PHASES.PLAYING,
    simulationTimeMs: 0,
    accumulatorMs: 0,
    tickCount: 0,
    rngState: cursor.state,
    arena: { ...ARENA },
    settings,
    player,
    net: {
      position: netPosition(player, reach),
      reach,
      radius: settings.netRadius,
      scoopRemainingMs: 0,
      cooldownRemainingMs: 0,
      contactedCreatureId: null,
    },
    bait: {
      active: null,
      placement: null,
      placementCount: 0,
    },
    creatures: initialSchool(creatureCount, cursor, settings, requiredCreatureId),
    scoopCount: 0,
    missCount: 0,
    outcome: null,
    lastEvent: null,
    presentation: {
      waveMotion: !reducedMotion,
      motionScale: settings.motionScale,
      walkElapsedMs: 0,
      walkFrameIndex: 0,
      netImpact: null,
      scoopPhase: HAND_NET_SCOOP_PHASES.IDLE,
      scoopElapsedMs: 0,
      scoopDurationMs: settings.scoopAnimationMs,
      scoopProgress: 0,
      scoopPhaseProgress: 0,
      scoopFrameIndex: 0,
      scoopHitboxActive: false,
      baitImpact: null,
      baitPlacementPhase: HAND_NET_BAIT_PLACEMENT_PHASES.IDLE,
      baitPlacementElapsedMs: 0,
      baitPlacementDurationMs: settings.baitPlacementAnimationMs,
      baitPlacementProgress: 0,
      baitPlacementFrameIndex: 0,
    },
  };
  state.rngState = cursor.state;
  return deepFreeze(state);
}

function cloneState(state) {
  return {
    ...state,
    arena: { ...state.arena },
    settings: { ...state.settings },
    player: {
      ...state.player,
      position: copyPoint(state.player.position),
      intent: copyPoint(state.player.intent),
      velocity: copyPoint(state.player.velocity),
      facing: copyPoint(state.player.facing),
    },
    net: { ...state.net, position: copyPoint(state.net.position) },
    bait: {
      ...state.bait,
      active: state.bait.active
        ? { ...state.bait.active, position: copyPoint(state.bait.active.position) }
        : null,
      placement: state.bait.placement
        ? { ...state.bait.placement, position: copyPoint(state.bait.placement.position) }
        : null,
    },
    creatures: state.creatures.map((creature) => ({
      ...creature,
      position: copyPoint(creature.position),
      heading: copyPoint(creature.heading),
    })),
    outcome: state.outcome ? { ...state.outcome, speciesIds: state.outcome.speciesIds?.slice() } : null,
    lastEvent: state.lastEvent
      ? {
          ...state.lastEvent,
          ...(state.lastEvent.speciesIds
            ? { speciesIds: state.lastEvent.speciesIds.slice() }
            : {}),
          ...(state.lastEvent.position
            ? { position: copyPoint(state.lastEvent.position) }
            : {}),
        }
      : null,
    presentation: {
      ...state.presentation,
      netImpact: state.presentation.netImpact
        ? {
            ...state.presentation.netImpact,
            position: copyPoint(state.presentation.netImpact.position),
          }
        : null,
      baitImpact: state.presentation.baitImpact
        ? {
            ...state.presentation.baitImpact,
            position: copyPoint(state.presentation.baitImpact.position),
          }
        : null,
    },
  };
}

function normalizedIntent(x, y) {
  finiteNumber(x, "Hand-net move x");
  finiteNumber(y, "Hand-net move y");
  if (x < -1 || x > 1 || y < -1 || y > 1) {
    throw new RangeError("Hand-net move components must stay between -1 and 1.");
  }
  const length = Math.hypot(x, y);
  if (length <= 1) return { x, y };
  return { x: x / length, y: y / length };
}

/** Applies one UI action without advancing simulation time. */
export function applyHandNetAction(stateValue, action) {
  const state = requireState(stateValue);
  if (!isRecord(action) || typeof action.type !== "string") {
    throw new TypeError("Hand-net action requires a type.");
  }
  if (state.phase !== HAND_NET_PHASES.PLAYING) return state;

  if (action.type === HAND_NET_ACTIONS.MOVE) {
    const intent = normalizedIntent(action.x, action.y);
    if (state.bait.placement) return state;
    if (
      Math.abs(intent.x - state.player.intent.x) <= EPSILON
      && Math.abs(intent.y - state.player.intent.y) <= EPSILON
    ) return state;
    const next = cloneState(state);
    const wasMoving = magnitude(state.player.intent) > EPSILON;
    next.player.intent = intent;
    const isMoving = magnitude(intent) > EPSILON;
    if (isMoving) next.player.facing = isometricFacing(intent, next.player.facing);
    if (!wasMoving && isMoving) {
      next.presentation.walkElapsedMs = 0;
      next.presentation.walkFrameIndex = WALK_FRAME_SEQUENCE[0];
    } else if (!isMoving) {
      next.presentation.walkElapsedMs = 0;
      next.presentation.walkFrameIndex = 0;
    }
    next.net.position = netPosition(next.player, next.net.reach);
    return deepFreeze(next);
  }
  if (action.type === HAND_NET_ACTIONS.STOP) {
    if (magnitude(state.player.intent) <= EPSILON) return state;
    const next = cloneState(state);
    next.player.intent = { x: 0, y: 0 };
    next.player.velocity = { x: 0, y: 0 };
    next.presentation.walkElapsedMs = 0;
    next.presentation.walkFrameIndex = 0;
    return deepFreeze(next);
  }
  if (action.type === HAND_NET_ACTIONS.SCOOP) {
    if (
      state.bait.placement
      || state.net.scoopRemainingMs > 0
      || state.net.cooldownRemainingMs > 0
    ) return state;
    const next = cloneState(state);
    next.net.scoopRemainingMs = state.settings.scoopAnimationMs;
    next.net.contactedCreatureId = null;
    next.scoopCount += 1;
    next.presentation.netImpact = null;
    next.presentation.scoopPhase = HAND_NET_SCOOP_PHASES.WINDUP;
    next.presentation.scoopElapsedMs = 0;
    next.presentation.scoopDurationMs = state.settings.scoopAnimationMs;
    next.presentation.scoopProgress = 0;
    next.presentation.scoopPhaseProgress = 0;
    next.presentation.scoopFrameIndex = 3;
    next.presentation.scoopHitboxActive = false;
    next.lastEvent = { type: "scoop-started", atMs: next.simulationTimeMs };
    return deepFreeze(next);
  }
  if (action.type === HAND_NET_ACTIONS.PLACE_BAIT) {
    const definition = requireBaitDefinition(action.baitId);
    if (
      state.bait.active
      || state.bait.placement
      || state.net.scoopRemainingMs > 0
      || state.net.cooldownRemainingMs > 0
    ) return state;
    const next = cloneState(state);
    const sequence = next.bait.placementCount + 1;
    next.player.intent = { x: 0, y: 0 };
    next.player.velocity = { x: 0, y: 0 };
    next.presentation.walkElapsedMs = 0;
    next.presentation.walkFrameIndex = 0;
    next.bait.placementCount = sequence;
    next.bait.placement = {
      baitId: definition.id,
      position: reachableBaitPosition(next.net.position, next.settings.baitFeedingRadius),
      elapsedMs: 0,
      remainingMs: next.settings.baitPlacementAnimationMs,
      deployed: false,
      sequence,
    };
    next.presentation.baitImpact = null;
    next.presentation.baitPlacementPhase = HAND_NET_BAIT_PLACEMENT_PHASES.WINDUP;
    next.presentation.baitPlacementElapsedMs = 0;
    next.presentation.baitPlacementDurationMs = next.settings.baitPlacementAnimationMs;
    next.presentation.baitPlacementProgress = 0;
    next.presentation.baitPlacementFrameIndex = 3;
    next.lastEvent = {
      type: "bait-placement-started",
      baitId: definition.id,
      position: copyPoint(next.bait.placement.position),
      atMs: next.simulationTimeMs,
    };
    return deepFreeze(next);
  }
  throw new RangeError(`Unknown hand-net action: ${action.type}.`);
}

function updatePlayer(state, elapsedSeconds) {
  const intent = state.player.intent;
  state.player.velocity = {
    x: intent.x * state.player.speed,
    y: intent.y * state.player.speed,
  };
  state.player.position.x = clamp(
    state.player.position.x + state.player.velocity.x * elapsedSeconds,
    PLAYER_BOUNDS.left,
    PLAYER_BOUNDS.right,
  );
  state.player.position.y = clamp(
    state.player.position.y + state.player.velocity.y * elapsedSeconds,
    PLAYER_BOUNDS.top,
    PLAYER_BOUNDS.bottom,
  );
  if (magnitude(intent) > EPSILON) state.player.facing = isometricFacing(intent, state.player.facing);
  state.net.position = netPosition(state.player, state.net.reach);
}

function updateWalkPresentation(state, elapsedMs) {
  if (magnitude(state.player.intent) <= EPSILON) {
    state.presentation.walkElapsedMs = 0;
    state.presentation.walkFrameIndex = 0;
    return;
  }
  state.presentation.walkElapsedMs += elapsedMs;
  const sequenceIndex = Math.floor(
    state.presentation.walkElapsedMs / WALK_FRAME_DURATION_MS,
  ) % WALK_FRAME_SEQUENCE.length;
  state.presentation.walkFrameIndex = WALK_FRAME_SEQUENCE[sequenceIndex];
}

function creatureDistanceToNet(state, creature) {
  return Math.hypot(
    creature.position.x - state.net.position.x,
    creature.position.y - state.net.position.y,
  );
}

function effectiveCatchRadius(state, creature) {
  const creatureCatchRadius = creature.radius * 0.5;
  const baseRadius = state.net.radius + creatureCatchRadius;
  const settledBait = settledBaitDefinition(state);
  if (
    creature.status !== "feeding"
    || !settledBait
    || creature.baitTargetId !== settledBait.activeBait.baitId
    || !baitMatchesCreature(settledBait.definition, creature)
  ) return baseRadius;
  return state.net.radius
    + creatureCatchRadius * Math.max(1, settledBait.definition.hitboxMultiplier);
}

/** Returns the net collision envelope, including a feeding creature's bait bonus. */
export function getHandNetEffectiveCatchRadius(stateValue, creatureValue) {
  const state = requireState(stateValue);
  if (!isRecord(creatureValue) || !Number.isFinite(creatureValue.radius) || creatureValue.radius < 0) {
    throw new TypeError("Hand-net catch radius requires a creature with a non-negative finite radius.");
  }
  return effectiveCatchRadius(state, creatureValue);
}

function makeCreatureFlee(state, creature) {
  if (!ACTIVE_CREATURE_STATUSES.has(creature.status)) return;
  creature.status = "fleeing";
  creature.baitTargetId = null;
  creature.alert = 1;
  creature.heading = normalized({
    x: creature.position.x - state.net.position.x,
    y: creature.position.y - state.net.position.y,
  }, creature.heading);
  state.lastEvent = {
    type: "creature-fled",
    creatureId: creature.id,
    speciesId: creature.speciesId,
    atMs: state.simulationTimeMs,
  };
}

function updateCreatureAlert(state, creature, elapsedSeconds) {
  if (!ACTIVE_CREATURE_STATUSES.has(creature.status)) return;
  const offset = {
    x: creature.position.x - state.player.position.x,
    y: creature.position.y - state.player.position.y,
  };
  const distance = magnitude(offset);
  const toward = normalized(offset);
  const closingSpeed = state.player.velocity.x * toward.x + state.player.velocity.y * toward.y;
  const approachingQuickly = distance < state.settings.alertRadius
    && closingSpeed > state.settings.fastApproachSpeed;
  if (approachingQuickly) {
    const proximity = 1 - distance / state.settings.alertRadius;
    creature.alert = Math.min(
      1,
      creature.alert + state.settings.alertGainPerSecond * (0.55 + proximity) * elapsedSeconds,
    );
  } else {
    creature.alert = Math.max(0, creature.alert - 0.12 * elapsedSeconds);
  }
  if (creature.alert >= state.settings.alertThreshold) makeCreatureFlee(state, creature);
}

function turnWanderingCreature(state, creature) {
  const cursor = { state: state.rngState };
  const turn = (drawRandom(cursor) - 0.5) * 1.8;
  const currentAngle = Math.atan2(creature.heading.y, creature.heading.x);
  const angle = currentAngle + turn;
  creature.heading = { x: Math.cos(angle), y: Math.sin(angle) };
  creature.turnRemainingMs = 550 + Math.round(drawRandom(cursor) * 750);
  state.rngState = cursor.state;
}

function moveWanderingCreature(state, creature, elapsedMs, elapsedSeconds) {
  creature.turnRemainingMs -= elapsedMs;
  if (creature.turnRemainingMs <= 0) turnWanderingCreature(state, creature);

  let nextX = creature.position.x + creature.heading.x * creature.speed * elapsedSeconds;
  let nextY = creature.position.y + creature.heading.y * creature.speed * elapsedSeconds;
  if (nextX < CREATURE_BOUNDS.left || nextX > CREATURE_BOUNDS.right) {
    creature.heading.x *= -1;
    nextX = clamp(nextX, CREATURE_BOUNDS.left, CREATURE_BOUNDS.right);
  }
  if (nextY < CREATURE_BOUNDS.top || nextY > CREATURE_BOUNDS.bottom) {
    creature.heading.y *= -1;
    nextY = clamp(nextY, CREATURE_BOUNDS.top, CREATURE_BOUNDS.bottom);
  }
  creature.position = { x: nextX, y: nextY };
}

function clearCreatureBaitBehavior(creature) {
  if (creature.status === "attracted" || creature.status === "feeding") {
    creature.status = "wandering";
  }
  creature.baitTargetId = null;
}

function updateCreatureBaitBehavior(state, creature, elapsedSeconds) {
  if (!ACTIVE_CREATURE_STATUSES.has(creature.status)) {
    creature.baitTargetId = null;
    return false;
  }
  const settledBait = settledBaitDefinition(state);
  if (!settledBait || !baitMatchesCreature(settledBait.definition, creature)) {
    clearCreatureBaitBehavior(creature);
    return false;
  }

  const offset = {
    x: settledBait.activeBait.position.x - creature.position.x,
    y: settledBait.activeBait.position.y - creature.position.y,
  };
  const distance = magnitude(offset);
  if (distance > settledBait.definition.attractionRadius) {
    clearCreatureBaitBehavior(creature);
    return false;
  }

  const towardBait = normalized(offset, creature.heading);
  creature.heading = towardBait;
  creature.baitTargetId = settledBait.activeBait.baitId;
  if (distance <= state.settings.baitFeedingRadius + EPSILON) {
    creature.status = "feeding";
    return true;
  }

  creature.status = "attracted";
  const remainingTravelSeconds = Math.max(
    HAND_NET_SIMULATION_STEP_MS / 1000,
    settledBait.activeBait.remainingMs / 1000,
  );
  const arrivalSpeed = distance / Math.max(0.1, remainingTravelSeconds * 0.8);
  const approachSpeed = Math.max(
    creature.speed * settledBait.definition.approachSpeedMultiplier,
    arrivalSpeed,
  );
  const travel = Math.min(
    approachSpeed * elapsedSeconds,
    Math.max(0, distance - state.settings.baitFeedingRadius),
  );
  creature.position = {
    x: clamp(
      creature.position.x + towardBait.x * travel,
      CREATURE_BOUNDS.left,
      CREATURE_BOUNDS.right,
    ),
    y: clamp(
      creature.position.y + towardBait.y * travel,
      CREATURE_BOUNDS.top,
      CREATURE_BOUNDS.bottom,
    ),
  };
  if (
    Math.hypot(
      creature.position.x - settledBait.activeBait.position.x,
      creature.position.y - settledBait.activeBait.position.y,
    ) <= state.settings.baitFeedingRadius + EPSILON
  ) creature.status = "feeding";
  return true;
}

function moveFleeingCreature(state, creature, elapsedSeconds) {
  creature.heading = normalized({
    x: creature.position.x - state.net.position.x,
    y: creature.position.y - state.net.position.y,
  }, creature.heading);
  const fleeSpeed = Math.max(1.15, creature.speed * 2.25);
  creature.position.x += creature.heading.x * fleeSpeed * elapsedSeconds;
  creature.position.y += creature.heading.y * fleeSpeed * elapsedSeconds;
  if (
    creature.position.x < ESCAPE_BOUNDS.left
    || creature.position.x > ESCAPE_BOUNDS.right
    || creature.position.y < ESCAPE_BOUNDS.top
    || creature.position.y > ESCAPE_BOUNDS.bottom
  ) {
    creature.status = "escaped";
    state.lastEvent = {
      type: "creature-escaped",
      creatureId: creature.id,
      speciesId: creature.speciesId,
      atMs: state.simulationTimeMs,
    };
  }
}

function updateCreatures(state, elapsedMs) {
  const elapsedSeconds = elapsedMs / 1000;
  for (const creature of state.creatures) {
    updateCreatureAlert(state, creature, elapsedSeconds);
    if (updateCreatureBaitBehavior(state, creature, elapsedSeconds)) continue;
    if (creature.status === "wandering") {
      moveWanderingCreature(state, creature, elapsedMs, elapsedSeconds);
    } else if (creature.status === "fleeing") {
      moveFleeingCreature(state, creature, elapsedSeconds);
    }
  }
}

function finishCatch(state, creature) {
  creature.status = "caught";
  creature.baitTargetId = null;
  state.phase = HAND_NET_PHASES.CAUGHT;
  state.player.intent = { x: 0, y: 0 };
  state.player.velocity = { x: 0, y: 0 };
  state.net.scoopRemainingMs = 0;
  state.net.cooldownRemainingMs = 0;
  state.net.contactedCreatureId = null;
  state.outcome = {
    type: "caught",
    creatureId: creature.id,
    speciesId: creature.speciesId,
    cardId: creature.cardId,
    atMs: state.simulationTimeMs,
  };
  state.lastEvent = { ...state.outcome };
}

function finishEscapeIfNeeded(state) {
  if (state.net.scoopRemainingMs > 0 || state.net.contactedCreatureId) return;
  if (state.creatures.some(({ status }) => (
    ACTIVE_CREATURE_STATUSES.has(status) || status === "fleeing"
  ))) return;
  const speciesIds = state.creatures.map(({ speciesId }) => speciesId);
  state.phase = HAND_NET_PHASES.ESCAPED;
  state.player.intent = { x: 0, y: 0 };
  state.player.velocity = { x: 0, y: 0 };
  state.net.scoopRemainingMs = 0;
  state.outcome = {
    type: "escaped",
    speciesIds,
    atMs: state.simulationTimeMs,
  };
  state.lastEvent = { ...state.outcome, speciesIds: speciesIds.slice() };
}

function finishMiss(state) {
  state.net.scoopRemainingMs = 0;
  state.net.cooldownRemainingMs = state.settings.cooldownMs;
  state.net.contactedCreatureId = null;
  state.missCount += 1;
  for (const creature of state.creatures) {
    if (!ACTIVE_CREATURE_STATUSES.has(creature.status) || creatureDistanceToNet(state, creature) > 2.25) continue;
    creature.alert = Math.min(1, creature.alert + state.settings.missAlert);
    if (creature.alert >= state.settings.alertThreshold) makeCreatureFlee(state, creature);
  }
  state.lastEvent = { type: "scoop-missed", atMs: state.simulationTimeMs };
}

function progressBetween(value, start, end) {
  if (end <= start) return 1;
  return clamp((value - start) / (end - start), 0, 1);
}

function updateBaitPlacementPresentation(state, elapsedMs) {
  const durationMs = state.settings.baitPlacementAnimationMs;
  let phase;
  let frameIndex;
  if (elapsedMs >= durationMs) {
    phase = HAND_NET_BAIT_PLACEMENT_PHASES.COMPLETE;
    frameIndex = 0;
  } else if (elapsedMs >= state.settings.baitPlacementReleaseMs) {
    phase = HAND_NET_BAIT_PLACEMENT_PHASES.SETTLING;
    frameIndex = 5;
  } else if (elapsedMs >= state.settings.baitPlacementLoweringMs) {
    phase = HAND_NET_BAIT_PLACEMENT_PHASES.LOWERING;
    frameIndex = 4;
  } else {
    phase = HAND_NET_BAIT_PLACEMENT_PHASES.WINDUP;
    frameIndex = 3;
  }
  state.presentation.baitPlacementPhase = phase;
  state.presentation.baitPlacementElapsedMs = elapsedMs;
  state.presentation.baitPlacementDurationMs = durationMs;
  state.presentation.baitPlacementProgress = progressBetween(elapsedMs, 0, durationMs);
  state.presentation.baitPlacementFrameIndex = frameIndex;
}

function resetCompletedBaitPlacementPresentation(state) {
  state.presentation.baitPlacementPhase = HAND_NET_BAIT_PLACEMENT_PHASES.IDLE;
  state.presentation.baitPlacementElapsedMs = 0;
  state.presentation.baitPlacementProgress = 0;
  state.presentation.baitPlacementFrameIndex = 0;
}

function updateBait(state, elapsedMs) {
  if (state.bait.active) {
    state.bait.active.remainingMs = Math.max(
      0,
      state.bait.active.remainingMs - elapsedMs,
    );
    if (state.bait.active.remainingMs === 0) {
      const expired = state.bait.active;
      state.bait.active = null;
      state.lastEvent = {
        type: "bait-expired",
        baitId: expired.baitId,
        position: copyPoint(expired.position),
        atMs: state.simulationTimeMs,
      };
    }
  }

  const placement = state.bait.placement;
  if (!placement) {
    if (
      state.presentation.baitPlacementPhase
      === HAND_NET_BAIT_PLACEMENT_PHASES.COMPLETE
    ) resetCompletedBaitPlacementPresentation(state);
    return;
  }

  const elapsedBeforeStep = placement.elapsedMs;
  const placementElapsedMs = Math.min(
    state.settings.baitPlacementAnimationMs,
    elapsedBeforeStep + elapsedMs,
  );
  placement.elapsedMs = placementElapsedMs;
  placement.remainingMs = Math.max(
    0,
    state.settings.baitPlacementAnimationMs - placementElapsedMs,
  );
  updateBaitPlacementPresentation(state, placementElapsedMs);

  const released = !placement.deployed
    && elapsedBeforeStep < state.settings.baitPlacementReleaseMs
    && placementElapsedMs >= state.settings.baitPlacementReleaseMs;
  if (released) {
    const definition = requireBaitDefinition(placement.baitId);
    placement.deployed = true;
    state.bait.active = {
      baitId: definition.id,
      position: copyPoint(placement.position),
      remainingMs: definition.durationMs,
      durationMs: definition.durationMs,
      placedAtMs: state.simulationTimeMs,
      sequence: placement.sequence,
    };
    state.presentation.baitImpact = {
      sequence: placement.sequence,
      baitId: definition.id,
      position: copyPoint(placement.position),
    };
    state.lastEvent = {
      type: "bait-placed",
      baitId: definition.id,
      position: copyPoint(placement.position),
      atMs: state.simulationTimeMs,
    };
  }

  if (placement.remainingMs === 0) state.bait.placement = null;
}

function updateScoopPresentation(state, elapsedMs, contactActive) {
  const durationMs = state.settings.scoopAnimationMs;
  const windupEndMs = state.settings.scoopWindupEndMs;
  const contactMs = state.settings.scoopContactMs;
  const recoveryStartMs = state.settings.scoopRecoveryStartMs;
  let phase;
  let phaseProgress;
  let frameIndex;
  if (elapsedMs >= durationMs) {
    phase = HAND_NET_SCOOP_PHASES.COMPLETE;
    phaseProgress = 1;
    frameIndex = 6;
  } else if (elapsedMs >= recoveryStartMs) {
    phase = HAND_NET_SCOOP_PHASES.RECOVERY;
    phaseProgress = progressBetween(elapsedMs, recoveryStartMs, durationMs);
    frameIndex = 6;
  } else if (elapsedMs >= contactMs) {
    phase = HAND_NET_SCOOP_PHASES.IMPACT;
    phaseProgress = progressBetween(elapsedMs, contactMs, recoveryStartMs);
    frameIndex = 5;
  } else if (elapsedMs >= windupEndMs) {
    phase = HAND_NET_SCOOP_PHASES.SWING;
    phaseProgress = progressBetween(elapsedMs, windupEndMs, contactMs);
    frameIndex = 4;
  } else {
    phase = HAND_NET_SCOOP_PHASES.WINDUP;
    phaseProgress = progressBetween(elapsedMs, 0, windupEndMs);
    frameIndex = 3;
  }
  state.presentation.scoopPhase = phase;
  state.presentation.scoopElapsedMs = elapsedMs;
  state.presentation.scoopDurationMs = durationMs;
  state.presentation.scoopProgress = progressBetween(elapsedMs, 0, durationMs);
  state.presentation.scoopPhaseProgress = phaseProgress;
  state.presentation.scoopFrameIndex = frameIndex;
  state.presentation.scoopHitboxActive = contactActive;
}

function resetCompletedScoopPresentation(state) {
  state.presentation.scoopPhase = HAND_NET_SCOOP_PHASES.IDLE;
  state.presentation.scoopElapsedMs = 0;
  state.presentation.scoopProgress = 0;
  state.presentation.scoopPhaseProgress = 0;
  state.presentation.scoopFrameIndex = 0;
  state.presentation.scoopHitboxActive = false;
}

function updateNet(state, elapsedMs) {
  const previousCooldownMs = state.net.cooldownRemainingMs;
  state.net.cooldownRemainingMs = Math.max(0, previousCooldownMs - elapsedMs);
  if (state.net.scoopRemainingMs <= 0) {
    if (
      previousCooldownMs > 0
      && state.net.cooldownRemainingMs === 0
      && state.presentation.scoopPhase === HAND_NET_SCOOP_PHASES.COMPLETE
    ) resetCompletedScoopPresentation(state);
    return;
  }

  const elapsedBeforeStep = state.settings.scoopAnimationMs - state.net.scoopRemainingMs;
  const scoopElapsedMs = Math.min(
    state.settings.scoopAnimationMs,
    elapsedBeforeStep + elapsedMs,
  );
  const contactActive = elapsedBeforeStep < state.settings.scoopContactMs
    && scoopElapsedMs >= state.settings.scoopContactMs
    && !state.net.contactedCreatureId;
  state.net.scoopRemainingMs = Math.max(0, state.settings.scoopAnimationMs - scoopElapsedMs);
  updateScoopPresentation(state, scoopElapsedMs, contactActive);

  if (
    contactActive
    && !state.presentation.netImpact
  ) {
    state.presentation.netImpact = {
      sequence: state.scoopCount,
      position: copyPoint(state.net.position),
    };
  }

  if (state.presentation.scoopHitboxActive) {
    const caught = state.creatures.find((creature) => (
      ACTIVE_CREATURE_STATUSES.has(creature.status)
      && creatureDistanceToNet(state, creature) <= effectiveCatchRadius(state, creature)
    ));
    if (caught) {
      caught.status = "caught";
      caught.baitTargetId = null;
      state.net.contactedCreatureId = caught.id;
      state.lastEvent = {
        type: "creature-netted",
        creatureId: caught.id,
        speciesId: caught.speciesId,
        atMs: state.simulationTimeMs,
      };
    }
  }

  if (state.net.scoopRemainingMs > 0) return;
  const contacted = state.net.contactedCreatureId
    ? state.creatures.find(({ id }) => id === state.net.contactedCreatureId)
    : null;
  if (contacted) finishCatch(state, contacted);
  else finishMiss(state);
}

function simulationStep(state) {
  const elapsedSeconds = HAND_NET_SIMULATION_STEP_MS / 1000;
  state.simulationTimeMs += HAND_NET_SIMULATION_STEP_MS;
  state.tickCount += 1;
  updatePlayer(state, elapsedSeconds);
  updateWalkPresentation(state, HAND_NET_SIMULATION_STEP_MS);
  updateBait(state, HAND_NET_SIMULATION_STEP_MS);
  updateCreatures(state, HAND_NET_SIMULATION_STEP_MS);
  updateNet(state, HAND_NET_SIMULATION_STEP_MS);
  if (state.phase === HAND_NET_PHASES.PLAYING) finishEscapeIfNeeded(state);
}

/** Advances the simulation in fixed deterministic steps without mutating input. */
export function tickHandNetState(stateValue, elapsedMs) {
  const state = requireState(stateValue);
  finiteNumber(elapsedMs, "Hand-net elapsedMs");
  if (elapsedMs < 0 || elapsedMs > MAX_TICK_MS) {
    throw new RangeError(`Hand-net elapsedMs must stay between 0 and ${MAX_TICK_MS}.`);
  }
  if (elapsedMs === 0 || state.phase !== HAND_NET_PHASES.PLAYING) return state;

  const next = cloneState(state);
  let availableMs = next.accumulatorMs + elapsedMs;
  while (availableMs + EPSILON >= HAND_NET_SIMULATION_STEP_MS && next.phase === HAND_NET_PHASES.PLAYING) {
    simulationStep(next);
    availableMs -= HAND_NET_SIMULATION_STEP_MS;
  }
  next.accumulatorMs = next.phase === HAND_NET_PHASES.PLAYING
    ? Math.max(0, availableMs)
    : 0;
  return deepFreeze(next);
}
