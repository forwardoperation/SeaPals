import {
  getAdventureStartLocation,
  getRuntimeAdventureScenes,
} from "./adventureContent.mjs";

const DIRECTION_DELTAS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

export const DIRECTIONS = Object.freeze(Object.keys(DIRECTION_DELTAS));

export const CONTINUOUS_MOVEMENT_DEFAULTS = Object.freeze({
  radius: 0.22,
  speed: 4,
  maxStepDistance: 0.1,
  interactionRange: 1.35,
  interactionLateralTolerance: 0.65,
});

export const TILE_LEGEND = Object.freeze({
  t: Object.freeze({ id: "tree", walkable: false }),
  g: Object.freeze({ id: "grass", walkable: true }),
  p: Object.freeze({ id: "path", walkable: true }),
  c: Object.freeze({ id: "coral-home-wall", walkable: false }),
  C: Object.freeze({ id: "coral-home-door", walkable: false }),
  d: Object.freeze({ id: "deep-home-wall", walkable: false }),
  D: Object.freeze({ id: "deep-home-door", walkable: false }),
  w: Object.freeze({ id: "interior-wall", walkable: false }),
  f: Object.freeze({ id: "interior-floor", walkable: true }),
  r: Object.freeze({ id: "rug", walkable: true }),
  a: Object.freeze({ id: "furniture", walkable: false }),
  n: Object.freeze({ id: "trainer", walkable: false }),
  E: Object.freeze({ id: "exit-door", walkable: false }),
});

function freezePosition(position) {
  return Object.freeze({ x: position.x, y: position.y });
}

function freezeInteraction(interaction) {
  return Object.freeze({
    ...interaction,
    at: freezePosition(interaction.at),
    ...(interaction.spawn ? { spawn: freezePosition(interaction.spawn) } : {}),
  });
}

function defineScene({ id, name, kind, theme, tiles, spawn, interactions }) {
  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;

  if (!width || tiles.some((row) => row.length !== width)) {
    throw new Error(`Scene ${id} must use a non-empty rectangular tile map.`);
  }
  for (const row of tiles) {
    for (const tile of row) {
      if (!TILE_LEGEND[tile]) throw new Error(`Scene ${id} uses unknown tile symbol ${tile}.`);
    }
  }

  return Object.freeze({
    id,
    name,
    kind,
    theme,
    width,
    height,
    tiles: Object.freeze([...tiles]),
    spawn: freezePosition(spawn),
    interactions: Object.freeze(interactions.map(freezeInteraction)),
  });
}

export const SCENES = Object.freeze(Object.fromEntries(
  getRuntimeAdventureScenes().map((scene) => [
    scene.id,
    defineScene({
      id: scene.id,
      name: scene.world.name,
      kind: scene.world.worldKind,
      theme: scene.world.theme,
      tiles: scene.world.tiles,
      spawn: scene.world.spawn,
      interactions: scene.world.interactions,
    }),
  ]),
));

const START_LOCATION = getAdventureStartLocation();

export const START_STATE = Object.freeze({
  sceneId: START_LOCATION.sceneId,
  position: freezePosition(START_LOCATION.position),
  facing: START_LOCATION.facing,
});

function requireScene(sceneId) {
  const scene = SCENES[sceneId];
  if (!scene) throw new RangeError(`Unknown adventure scene: ${sceneId}`);
  return scene;
}

function requirePosition(position) {
  if (!Number.isInteger(position?.x) || !Number.isInteger(position?.y)) {
    throw new TypeError("Adventure positions require integer x and y coordinates.");
  }
  return position;
}

function requireContinuousPosition(position) {
  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) {
    throw new TypeError("Continuous adventure positions require finite x and y coordinates.");
  }
  return position;
}

function requirePositiveNumber(value, label, { allowZero = false } = {}) {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new RangeError(`${label} must be a ${allowZero ? "non-negative" : "positive"} finite number.`);
  }
  return value;
}

function publicInteraction(interaction) {
  if (interaction.type === "trainer") {
    return {
      type: "trainer",
      interactionId: interaction.id,
      trainerId: interaction.trainerId,
      npcId: interaction.npcId,
      conversationId: interaction.conversationId,
      encounterId: interaction.encounterId,
    };
  }
  return {
    type: interaction.type,
    interactionId: interaction.id,
    targetScene: interaction.targetScene,
    spawn: { x: interaction.spawn.x, y: interaction.spawn.y },
  };
}

export function isInBounds(sceneId, position) {
  const scene = requireScene(sceneId);
  requirePosition(position);
  return position.x >= 0 && position.x < scene.width && position.y >= 0 && position.y < scene.height;
}

export function getTile(sceneId, position) {
  const scene = requireScene(sceneId);
  requirePosition(position);
  if (!isInBounds(sceneId, position)) return null;
  const symbol = scene.tiles[position.y][position.x];
  return Object.freeze({ symbol, ...TILE_LEGEND[symbol] });
}

export function isWalkable(sceneId, position) {
  return getTile(sceneId, position)?.walkable === true;
}

/**
 * Tests a circular player body against the tile map. Fractional positions use
 * the same coordinate system as grid positions: each integer is a tile center.
 */
export function canOccupyContinuousPosition(
  sceneId,
  position,
  radius = CONTINUOUS_MOVEMENT_DEFAULTS.radius,
) {
  const scene = requireScene(sceneId);
  requireContinuousPosition(position);
  requirePositiveNumber(radius, "Collision radius");

  const worldLeft = -0.5;
  const worldTop = -0.5;
  const worldRight = scene.width - 0.5;
  const worldBottom = scene.height - 0.5;
  if (
    position.x - radius < worldLeft
    || position.x + radius > worldRight
    || position.y - radius < worldTop
    || position.y + radius > worldBottom
  ) {
    return false;
  }

  const minTileX = Math.max(0, Math.floor(position.x - radius + 0.5));
  const maxTileX = Math.min(scene.width - 1, Math.floor(position.x + radius + 0.5));
  const minTileY = Math.max(0, Math.floor(position.y - radius + 0.5));
  const maxTileY = Math.min(scene.height - 1, Math.floor(position.y + radius + 0.5));
  const radiusSquared = radius * radius;

  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      const tileSymbol = scene.tiles[tileY][tileX];
      if (TILE_LEGEND[tileSymbol].walkable) continue;

      const nearestX = Math.max(tileX - 0.5, Math.min(position.x, tileX + 0.5));
      const nearestY = Math.max(tileY - 0.5, Math.min(position.y, tileY + 0.5));
      const distanceX = position.x - nearestX;
      const distanceY = position.y - nearestY;
      if (distanceX * distanceX + distanceY * distanceY < radiusSquared - Number.EPSILON) {
        return false;
      }
    }
  }

  return true;
}

export function movePlayer(sceneId, position, direction) {
  requireScene(sceneId);
  requirePosition(position);
  const delta = DIRECTION_DELTAS[direction];
  if (!delta) throw new RangeError(`Unknown movement direction: ${direction}`);

  const destination = {
    x: position.x + delta.x,
    y: position.y + delta.y,
  };

  return isWalkable(sceneId, destination)
    ? destination
    : { x: position.x, y: position.y };
}

/**
 * Moves a fractional tile position from a normalized/analog input vector.
 * elapsedMs uses requestAnimationFrame's millisecond clock. Large deltas are
 * split into short steps to prevent tunneling, and each axis resolves
 * separately so the player naturally slides along walls.
 */
export function movePlayerContinuous(
  sceneId,
  position,
  movement,
  elapsedMs,
  {
    radius = CONTINUOUS_MOVEMENT_DEFAULTS.radius,
    speed = CONTINUOUS_MOVEMENT_DEFAULTS.speed,
    maxStepDistance = CONTINUOUS_MOVEMENT_DEFAULTS.maxStepDistance,
  } = {},
) {
  requireScene(sceneId);
  requireContinuousPosition(position);
  requireContinuousPosition(movement);
  requirePositiveNumber(elapsedMs, "Elapsed time", { allowZero: true });
  requirePositiveNumber(radius, "Collision radius");
  requirePositiveNumber(speed, "Movement speed", { allowZero: true });
  requirePositiveNumber(maxStepDistance, "Maximum movement step");

  const inputMagnitude = Math.hypot(movement.x, movement.y);
  if (!inputMagnitude || !elapsedMs || !speed) return { x: position.x, y: position.y };

  const inputScale = inputMagnitude > 1 ? 1 / inputMagnitude : 1;
  const travelScale = speed * (elapsedMs / 1000) * inputScale;
  const totalX = movement.x * travelScale;
  const totalY = movement.y * travelScale;
  const stepCount = Math.max(1, Math.ceil(Math.max(Math.abs(totalX), Math.abs(totalY)) / maxStepDistance));
  const stepX = totalX / stepCount;
  const stepY = totalY / stepCount;
  const axes = Math.abs(stepX) >= Math.abs(stepY) ? ["x", "y"] : ["y", "x"];
  let next = { x: position.x, y: position.y };

  for (let step = 0; step < stepCount; step += 1) {
    for (const axis of axes) {
      const amount = axis === "x" ? stepX : stepY;
      if (!amount) continue;
      const candidate = { ...next, [axis]: next[axis] + amount };
      if (canOccupyContinuousPosition(sceneId, candidate, radius)) next = candidate;
    }
  }

  return next;
}

export function getInteraction(sceneId, position, facing) {
  const scene = requireScene(sceneId);
  requirePosition(position);
  const delta = DIRECTION_DELTAS[facing];
  if (!delta) throw new RangeError(`Unknown facing direction: ${facing}`);

  const target = {
    x: position.x + delta.x,
    y: position.y + delta.y,
  };
  const interaction = scene.interactions.find(
    (candidate) => candidate.at.x === target.x && candidate.at.y === target.y,
  );

  if (!interaction) return null;
  return publicInteraction(interaction);
}

/** Finds the closest interaction inside a short forward-facing corridor. */
export function getContinuousInteraction(
  sceneId,
  position,
  facing,
  {
    range = CONTINUOUS_MOVEMENT_DEFAULTS.interactionRange,
    lateralTolerance = CONTINUOUS_MOVEMENT_DEFAULTS.interactionLateralTolerance,
  } = {},
) {
  const scene = requireScene(sceneId);
  requireContinuousPosition(position);
  const facingVector = DIRECTION_DELTAS[facing];
  if (!facingVector) throw new RangeError(`Unknown facing direction: ${facing}`);
  requirePositiveNumber(range, "Interaction range");
  requirePositiveNumber(lateralTolerance, "Interaction lateral tolerance", { allowZero: true });

  const candidates = scene.interactions
    .map((interaction) => {
      const offsetX = interaction.at.x - position.x;
      const offsetY = interaction.at.y - position.y;
      const forwardDistance = offsetX * facingVector.x + offsetY * facingVector.y;
      const lateralDistance = Math.abs(offsetX * facingVector.y - offsetY * facingVector.x);
      const distance = Math.hypot(offsetX, offsetY);
      return { interaction, distance, forwardDistance, lateralDistance };
    })
    .filter((candidate) => (
      candidate.forwardDistance > 0
      && candidate.distance <= range
      && candidate.lateralDistance <= lateralTolerance
    ))
    .sort((left, right) => left.distance - right.distance);

  return candidates.length ? publicInteraction(candidates[0].interaction) : null;
}
