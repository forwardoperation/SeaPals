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

const CHARACTER_INTERACTION_TYPES = new Set(["npc", "trainer"]);
const PORTAL_INTERACTION_TYPES = new Set(["enter", "exit"]);
const INTERACTION_GEOMETRY_EPSILON = 1e-9;
const CHARACTER_INTERACTION_RANGE = 0.88;
const PROP_INTERACTION_HALF_WIDTH = 0.5;
const WALKABLE_REGION_EDGE_SAMPLES = 16;
const STRUCTURAL_INTERACTION_FIXTURES = new WeakMap();

export const DIRECTIONS = Object.freeze(Object.keys(DIRECTION_DELTAS));

export const CONTINUOUS_MOVEMENT_DEFAULTS = Object.freeze({
  radius: 0.22,
  speed: 4,
  maxStepDistance: 0.1,
  // The broad range supports full-tile fixtures and characters positioned
  // behind their own counter. Target-type rules below make open-floor
  // character conversations substantially tighter.
  interactionRange: 1.35,
  interactionLateralTolerance: 0.25,
  // Portals sit in solid doorway tiles. A player with the default radius can
  // approach to roughly 0.72 tiles from their centre, making 0.82 threshold
  // contact rather than an extra tile of reach.
  doorwayRange: 0.82,
  doorwayLateralTolerance: 0.25,
});

export const TILE_LEGEND = Object.freeze({
  t: Object.freeze({ id: "tree", walkable: false }),
  g: Object.freeze({ id: "grass", walkable: true }),
  p: Object.freeze({ id: "path", walkable: true }),
  o: Object.freeze({ id: "water", walkable: true }),
  k: Object.freeze({ id: "rock-shoal", walkable: false }),
  b: Object.freeze({ id: "buoy", walkable: false }),
  H: Object.freeze({ id: "dock-portal", walkable: false }),
  c: Object.freeze({ id: "coral-home-wall", walkable: false }),
  C: Object.freeze({ id: "coral-home-door", walkable: false }),
  d: Object.freeze({ id: "deep-home-wall", walkable: false }),
  D: Object.freeze({ id: "deep-home-door", walkable: false }),
  s: Object.freeze({ id: "academy-wall", walkable: false }),
  S: Object.freeze({ id: "academy-door", walkable: false }),
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

function freezePublicValue(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freezePublicValue));
  if (value && typeof value === "object") {
    return Object.freeze(Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, freezePublicValue(entryValue)]),
    ));
  }
  return value;
}

function freezeInteraction(interaction) {
  const frozen = Object.fromEntries(
    Object.entries(interaction)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => {
        if (key === "at" || key === "spawn") return [key, freezePosition(value)];
        return [key, freezePublicValue(value)];
      }),
  );
  return Object.freeze(frozen);
}

function freezeCollisionRect(rectangle, scene, seenIds) {
  if (typeof rectangle?.id !== "string" || !rectangle.id.trim()) {
    throw new TypeError(`Scene ${scene.id} collision rectangles require a non-empty string id.`);
  }
  if (seenIds.has(rectangle.id)) {
    throw new Error(`Scene ${scene.id} uses duplicate collision rectangle id ${rectangle.id}.`);
  }

  const bounds = [rectangle.left, rectangle.top, rectangle.right, rectangle.bottom];
  if (bounds.some((value) => !Number.isFinite(value))) {
    throw new TypeError(`Scene ${scene.id} collision rectangle ${rectangle.id} requires finite bounds.`);
  }
  if (rectangle.left >= rectangle.right || rectangle.top >= rectangle.bottom) {
    throw new RangeError(`Scene ${scene.id} collision rectangle ${rectangle.id} must have positive area.`);
  }
  if (
    rectangle.left < -0.5
    || rectangle.top < -0.5
    || rectangle.right > scene.width - 0.5
    || rectangle.bottom > scene.height - 0.5
  ) {
    throw new RangeError(`Scene ${scene.id} collision rectangle ${rectangle.id} extends outside the scene.`);
  }

  seenIds.add(rectangle.id);
  return Object.freeze({
    id: rectangle.id,
    left: rectangle.left,
    top: rectangle.top,
    right: rectangle.right,
    bottom: rectangle.bottom,
  });
}

function defineMovementProfile(movement = {}) {
  if (!movement || typeof movement !== "object" || Array.isArray(movement)) {
    throw new TypeError("Scene movement profile must be an object.");
  }
  const profile = {
    ...CONTINUOUS_MOVEMENT_DEFAULTS,
    ...movement,
  };
  for (const field of ["radius", "speed", "maxStepDistance", "interactionRange", "doorwayRange"]) {
    requirePositiveNumber(profile[field], `Scene movement ${field}`);
  }
  for (const field of ["interactionLateralTolerance", "doorwayLateralTolerance"]) {
    requirePositiveNumber(profile[field], `Scene movement ${field}`, { allowZero: true });
  }
  return Object.freeze(profile);
}

function defineScene({
  id,
  name,
  kind,
  theme,
  artPath = null,
  routeId = null,
  movement,
  tiles,
  spawn,
  interactions,
  collisionRects = [],
  walkableRegions = [],
  layeredObjects = [],
}) {
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

  if (!Array.isArray(collisionRects)) {
    throw new TypeError(`Scene ${id} collisionRects must be an array.`);
  }
  const sceneBounds = { id, width, height };
  const collisionRectIds = new Set();
  const frozenCollisionRects = collisionRects.map((rectangle) => (
    freezeCollisionRect(rectangle, sceneBounds, collisionRectIds)
  ));
  if (!Array.isArray(walkableRegions)) {
    throw new TypeError(`Scene ${id} walkableRegions must be an array.`);
  }
  if (!Array.isArray(layeredObjects)) {
    throw new TypeError(`Scene ${id} layeredObjects must be an array.`);
  }
  const walkableRegionIds = new Set();
  const frozenWalkableRegions = walkableRegions.map((rectangle) => (
    freezeCollisionRect(rectangle, sceneBounds, walkableRegionIds)
  ));
  const frozenLayeredObjects = Object.freeze(layeredObjects.map(freezePublicValue));

  for (const interaction of interactions) {
    if (interaction.facing !== undefined && !DIRECTION_DELTAS[interaction.facing]) {
      throw new RangeError(`Scene ${id} interaction ${interaction.id} uses unknown facing ${interaction.facing}.`);
    }
  }

  return Object.freeze({
    id,
    name,
    kind,
    theme,
    artPath,
    routeId,
    movement: defineMovementProfile(movement),
    width,
    height,
    tiles: Object.freeze([...tiles]),
    spawn: freezePosition(spawn),
    interactions: Object.freeze(interactions.map(freezeInteraction)),
    collisionRects: Object.freeze(frozenCollisionRects),
    walkableRegions: Object.freeze(frozenWalkableRegions),
    layeredObjects: frozenLayeredObjects,
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
      artPath: scene.world.artPath,
      routeId: scene.routeId ?? scene.world.routeId ?? null,
      movement: scene.world.movement,
      tiles: scene.world.tiles,
      spawn: scene.world.spawn,
      interactions: scene.world.interactions,
      collisionRects: scene.world.collisionRects ?? [],
      walkableRegions: scene.world.walkableRegions ?? [],
      layeredObjects: scene.world.layeredObjects ?? [],
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

export function getSceneMovementProfile(sceneId) {
  return requireScene(sceneId).movement;
}

export function getSceneInteractions(sceneId) {
  return Object.freeze(requireScene(sceneId).interactions.map(publicInteraction));
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
  const result = {
    type: interaction.type,
    interactionId: interaction.id,
  };
  for (const [key, value] of Object.entries(interaction)) {
    if (key === "id" || key === "type" || key === "at" || value === undefined) continue;
    result[key] = freezePublicValue(value);
  }
  return Object.freeze(result);
}

function circleIntersectsRectangle(position, radiusSquared, rectangle) {
  const nearestX = Math.max(rectangle.left, Math.min(position.x, rectangle.right));
  const nearestY = Math.max(rectangle.top, Math.min(position.y, rectangle.bottom));
  const distanceX = position.x - nearestX;
  const distanceY = position.y - nearestY;
  return distanceX * distanceX + distanceY * distanceY < radiusSquared - Number.EPSILON;
}

function requireDynamicBlockers(dynamicBlockers) {
  if (!Array.isArray(dynamicBlockers)) {
    throw new TypeError("Dynamic adventure blockers must be an array.");
  }

  return dynamicBlockers.map((blocker, index) => {
    requireContinuousPosition(blocker?.position);
    requirePositiveNumber(blocker?.radius, `Dynamic adventure blocker ${index} radius`);
    return blocker;
  });
}

function circlesIntersect(position, radius, blocker) {
  const distanceX = position.x - blocker.position.x;
  const distanceY = position.y - blocker.position.y;
  const combinedRadius = radius + blocker.radius;
  return distanceX * distanceX + distanceY * distanceY
    < combinedRadius * combinedRadius - Number.EPSILON;
}

function squaredDistanceToBlocker(position, blocker) {
  const distanceX = position.x - blocker.position.x;
  const distanceY = position.y - blocker.position.y;
  return distanceX * distanceX + distanceY * distanceY;
}

function movementSegmentIntersectsBlocker(start, end, radius, blocker) {
  const movementX = end.x - start.x;
  const movementY = end.y - start.y;
  const movementLengthSquared = movementX * movementX + movementY * movementY;
  if (movementLengthSquared <= Number.EPSILON) return circlesIntersect(end, radius, blocker);

  const startX = start.x - blocker.position.x;
  const startY = start.y - blocker.position.y;
  const closestProgress = Math.max(0, Math.min(1, -(
    startX * movementX + startY * movementY
  ) / movementLengthSquared));
  const closest = {
    x: start.x + movementX * closestProgress,
    y: start.y + movementY * closestProgress,
  };
  return circlesIntersect(closest, radius, blocker);
}

/**
 * Dynamic actors normally behave as swept circles. If an actor begins a step
 * already overlapping one or more blockers, however, continuing to reject all
 * overlap would permanently pin it in place. Recovery steps are allowed only
 * when their entire segment moves monotonically away from every blocker that
 * currently overlaps the actor. Once separation is restored, ordinary swept
 * collision immediately applies again.
 */
function dynamicBlockersAllowStep(start, end, radius, dynamicBlockers) {
  const movementX = end.x - start.x;
  const movementY = end.y - start.y;

  return dynamicBlockers.every((blocker) => {
    if (!circlesIntersect(start, radius, blocker)) {
      return !movementSegmentIntersectsBlocker(start, end, radius, blocker);
    }

    const startDistanceSquared = squaredDistanceToBlocker(start, blocker);
    const endDistanceSquared = squaredDistanceToBlocker(end, blocker);
    if (endDistanceSquared <= startDistanceSquared + Number.EPSILON) return false;

    // A non-negative initial derivative makes squared separation monotonic for
    // this straight segment. This rejects a large step that crosses through a
    // blocker and merely happens to finish farther away on its opposite side.
    const startOffsetX = start.x - blocker.position.x;
    const startOffsetY = start.y - blocker.position.y;
    return startOffsetX * movementX + startOffsetY * movementY >= -Number.EPSILON;
  });
}

function circleFitsWalkableRegionUnion(position, radius, regions) {
  if (!regions.length) return true;
  const points = [{ x: position.x, y: position.y }];
  for (let index = 0; index < WALKABLE_REGION_EDGE_SAMPLES; index += 1) {
    const angle = (index / WALKABLE_REGION_EDGE_SAMPLES) * Math.PI * 2;
    points.push({
      x: position.x + Math.cos(angle) * radius,
      y: position.y + Math.sin(angle) * radius,
    });
  }
  return points.every((point) => regions.some((region) => (
    point.x >= region.left - INTERACTION_GEOMETRY_EPSILON
    && point.x <= region.right + INTERACTION_GEOMETRY_EPSILON
    && point.y >= region.top - INTERACTION_GEOMETRY_EPSILON
    && point.y <= region.bottom + INTERACTION_GEOMETRY_EPSILON
  )));
}

function resolveInteractionPosition(interaction, positionOverrides) {
  if (positionOverrides === undefined || positionOverrides === null) return interaction.at;
  if (
    !(positionOverrides instanceof Map)
    && (typeof positionOverrides !== "object" || Array.isArray(positionOverrides))
  ) {
    throw new TypeError("Adventure interaction positionOverrides must be an object or Map.");
  }

  const override = positionOverrides instanceof Map
    ? positionOverrides.get(interaction.id)
    : Object.hasOwn(positionOverrides, interaction.id)
      ? positionOverrides[interaction.id]
      : undefined;
  return override === undefined ? interaction.at : requireContinuousPosition(override);
}

function rectangleContainsPosition(rectangle, position) {
  return position.x >= rectangle.left - INTERACTION_GEOMETRY_EPSILON
    && position.x <= rectangle.right + INTERACTION_GEOMETRY_EPSILON
    && position.y >= rectangle.top - INTERACTION_GEOMETRY_EPSILON
    && position.y <= rectangle.bottom + INTERACTION_GEOMETRY_EPSILON;
}

function getStructuralInteractionFixtures(scene) {
  const cached = STRUCTURAL_INTERACTION_FIXTURES.get(scene);
  if (cached) return cached;
  const fixtures = [...scene.collisionRects];
  for (let tileY = 0; tileY < scene.height; tileY += 1) {
    for (let tileX = 0; tileX < scene.width; tileX += 1) {
      const symbol = scene.tiles[tileY][tileX];
      if (TILE_LEGEND[symbol].walkable || symbol === "n") continue;
      // Detailed rectangles replace coarse furniture tiles in these scenes.
      if (symbol === "a" && scene.collisionRects.length) continue;
      fixtures.push({
        left: tileX - 0.5,
        top: tileY - 0.5,
        right: tileX + 0.5,
        bottom: tileY + 0.5,
      });
    }
  }
  const frozen = Object.freeze(fixtures);
  STRUCTURAL_INTERACTION_FIXTURES.set(scene, frozen);
  return frozen;
}

function segmentIntersectsRectangle(start, end, rectangle) {
  const delta = { x: end.x - start.x, y: end.y - start.y };
  let entry = 0;
  let exit = 1;

  for (const axis of ["x", "y"]) {
    const minimum = axis === "x" ? rectangle.left : rectangle.top;
    const maximum = axis === "x" ? rectangle.right : rectangle.bottom;
    if (Math.abs(delta[axis]) <= INTERACTION_GEOMETRY_EPSILON) {
      if (start[axis] < minimum || start[axis] > maximum) return false;
      continue;
    }
    const first = (minimum - start[axis]) / delta[axis];
    const second = (maximum - start[axis]) / delta[axis];
    entry = Math.max(entry, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (entry > exit) return false;
  }

  return exit > INTERACTION_GEOMETRY_EPSILON
    && entry < 1 - INTERACTION_GEOMETRY_EPSILON;
}

function characterBlocksInteractionPath(
  scene,
  start,
  target,
  targetInteraction,
  positionOverrides,
) {
  const segment = { x: target.x - start.x, y: target.y - start.y };
  const lengthSquared = segment.x * segment.x + segment.y * segment.y;
  if (lengthSquared <= INTERACTION_GEOMETRY_EPSILON) return false;

  return scene.interactions.some((interaction) => {
    if (interaction.id === targetInteraction.id || !CHARACTER_INTERACTION_TYPES.has(interaction.type)) {
      return false;
    }
    const position = resolveInteractionPosition(interaction, positionOverrides);
    const projection = (
      (position.x - start.x) * segment.x
      + (position.y - start.y) * segment.y
    ) / lengthSquared;
    if (projection <= 0 || projection >= 1) return false;
    const closest = {
      x: start.x + segment.x * projection,
      y: start.y + segment.y * projection,
    };
    return Math.hypot(position.x - closest.x, position.y - closest.y) <= 0.33;
  });
}

function hasClearInteractionPath(
  scene,
  start,
  target,
  targetInteraction,
  positionOverrides,
) {
  if (!hasClearStructuralInteractionPath(scene, start, target)) return false;
  return !characterBlocksInteractionPath(
    scene,
    start,
    target,
    targetInteraction,
    positionOverrides,
  );
}

function hasClearStructuralInteractionPath(scene, start, target) {
  const fixtures = getStructuralInteractionFixtures(scene);
  return !fixtures.some((fixture) => (
    !rectangleContainsPosition(fixture, target)
    && segmentIntersectsRectangle(start, target, fixture)
  ));
}

function interactionUsesOwnFixture(scene, position) {
  return getStructuralInteractionFixtures(scene).some((fixture) => (
    rectangleContainsPosition(fixture, position)
  ));
}

function getManualInteractionRange(scene, interaction, position, explicitRange) {
  if (explicitRange !== undefined) return explicitRange;
  if (PORTAL_INTERACTION_TYPES.has(interaction.type)) {
    return Math.min(scene.movement.interactionRange, scene.movement.doorwayRange);
  }
  if (
    CHARACTER_INTERACTION_TYPES.has(interaction.type)
    && !interactionUsesOwnFixture(scene, position)
  ) {
    return Math.min(scene.movement.interactionRange, CHARACTER_INTERACTION_RANGE);
  }
  return scene.movement.interactionRange;
}

function getManualInteractionLateralTolerance(scene, interaction, explicitTolerance) {
  if (explicitTolerance !== undefined) return explicitTolerance;
  if (CHARACTER_INTERACTION_TYPES.has(interaction.type) || PORTAL_INTERACTION_TYPES.has(interaction.type)) {
    return scene.movement.interactionLateralTolerance;
  }
  // Stations, signs, and other props occupy a full tile. Measure alignment
  // against that visible footprint rather than requiring its exact centre.
  return Math.max(scene.movement.interactionLateralTolerance, PROP_INTERACTION_HALF_WIDTH);
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
  options = {},
) {
  const scene = requireScene(sceneId);
  requireContinuousPosition(position);
  requirePositiveNumber(radius, "Collision radius");
  const dynamicBlockers = requireDynamicBlockers(options?.dynamicBlockers ?? []);
  const ignoreActorTiles = options?.ignoreActorTiles ?? false;
  if (typeof ignoreActorTiles !== "boolean") {
    throw new TypeError("Adventure ignoreActorTiles must be a boolean.");
  }

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

  if (!circleFitsWalkableRegionUnion(position, radius, scene.walkableRegions)) return false;

  const minTileX = Math.max(0, Math.floor(position.x - radius + 0.5));
  const maxTileX = Math.min(scene.width - 1, Math.floor(position.x + radius + 0.5));
  const minTileY = Math.max(0, Math.floor(position.y - radius + 0.5));
  const maxTileY = Math.min(scene.height - 1, Math.floor(position.y + radius + 0.5));
  const radiusSquared = radius * radius;

  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      const tileSymbol = scene.tiles[tileY][tileX];
      if (TILE_LEGEND[tileSymbol].walkable) continue;

      // Once an actor is driven by runtime patrol state, its authored anchor
      // stops being geometry and the caller supplies its live circular blocker.
      if (ignoreActorTiles && tileSymbol === "n") continue;

      // Authored rectangles replace the deliberately coarse furniture tiles,
      // while walls, doors, trainers, and other structural tiles stay solid.
      if (tileSymbol === "a" && scene.collisionRects.length) continue;

      if (circleIntersectsRectangle(position, radiusSquared, {
        left: tileX - 0.5,
        top: tileY - 0.5,
        right: tileX + 0.5,
        bottom: tileY + 0.5,
      })) {
        return false;
      }
    }
  }

  if (scene.collisionRects.some((rectangle) => (
    circleIntersectsRectangle(position, radiusSquared, rectangle)
  ))) {
    return false;
  }

  if (dynamicBlockers.some((blocker) => circlesIntersect(position, radius, blocker))) {
    return false;
  }

  return true;
}

/** Uses the scene-authored collision radius while preserving the legacy helper's default. */
export function canOccupyScenePosition(sceneId, position, options = {}) {
  return canOccupyContinuousPosition(
    sceneId,
    position,
    getSceneMovementProfile(sceneId).radius,
    options,
  );
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
  options = {},
) {
  requireScene(sceneId);
  requireContinuousPosition(position);
  requireContinuousPosition(movement);
  const profile = getSceneMovementProfile(sceneId);
  const radius = options.radius ?? profile.radius;
  const speed = options.speed ?? profile.speed;
  const maxStepDistance = options.maxStepDistance ?? profile.maxStepDistance;
  const dynamicBlockers = options.dynamicBlockers ?? [];
  const ignoreActorTiles = options.ignoreActorTiles ?? false;
  requirePositiveNumber(elapsedMs, "Elapsed time", { allowZero: true });
  requirePositiveNumber(radius, "Collision radius");
  requirePositiveNumber(speed, "Movement speed", { allowZero: true });
  requirePositiveNumber(maxStepDistance, "Maximum movement step");

  const inputMagnitude = Math.hypot(movement.x, movement.y);
  if (!inputMagnitude || !elapsedMs || !speed) return { x: position.x, y: position.y };
  const resolvedDynamicBlockers = requireDynamicBlockers(dynamicBlockers);

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
      const clearsStaticGeometry = canOccupyContinuousPosition(sceneId, candidate, radius, {
        ignoreActorTiles,
      });
      if (
        clearsStaticGeometry
        && dynamicBlockersAllowStep(next, candidate, radius, resolvedDynamicBlockers)
      ) next = candidate;
    }
  }

  return next;
}

export function getInteraction(sceneId, position, facing, options = {}) {
  const scene = requireScene(sceneId);
  requirePosition(position);
  const delta = DIRECTION_DELTAS[facing];
  if (!delta) throw new RangeError(`Unknown facing direction: ${facing}`);

  const target = {
    x: position.x + delta.x,
    y: position.y + delta.y,
  };
  const interaction = scene.interactions.find((candidate) => {
    const candidatePosition = resolveInteractionPosition(candidate, options?.positionOverrides);
    // The legacy grid API treats every authored point as occupying its nearest
    // tile. Runtime movement uses getContinuousInteraction instead, but this
    // keeps grid callers compatible with art-aligned fractional anchors.
    return Math.round(candidatePosition.x) === target.x
      && Math.round(candidatePosition.y) === target.y;
  });

  if (!interaction) return null;
  return publicInteraction(interaction);
}

/** Finds the closest interaction inside a short forward-facing corridor. */
export function getContinuousInteraction(
  sceneId,
  position,
  facing,
  options = {},
) {
  const scene = requireScene(sceneId);
  requireContinuousPosition(position);
  const facingVector = DIRECTION_DELTAS[facing];
  if (!facingVector) throw new RangeError(`Unknown facing direction: ${facing}`);
  const explicitRange = options.range;
  const explicitLateralTolerance = options.lateralTolerance;
  const positionOverrides = options.positionOverrides;
  if (explicitRange !== undefined) requirePositiveNumber(explicitRange, "Interaction range");
  if (explicitLateralTolerance !== undefined) {
    requirePositiveNumber(explicitLateralTolerance, "Interaction lateral tolerance", { allowZero: true });
  }
  const broadRange = explicitRange ?? scene.movement.interactionRange;
  const broadLateralTolerance = explicitLateralTolerance
    ?? Math.max(scene.movement.interactionLateralTolerance, PROP_INTERACTION_HALF_WIDTH);

  const candidates = scene.interactions
    .map((interaction) => {
      const interactionPosition = resolveInteractionPosition(interaction, positionOverrides);
      const offsetX = interactionPosition.x - position.x;
      const offsetY = interactionPosition.y - position.y;
      const forwardDistance = offsetX * facingVector.x + offsetY * facingVector.y;
      const lateralDistance = Math.abs(offsetX * facingVector.y - offsetY * facingVector.x);
      const distance = Math.hypot(offsetX, offsetY);
      return {
        interaction,
        interactionPosition,
        distance,
        forwardDistance,
        lateralDistance,
      };
    })
    .filter((candidate) => (
      candidate.forwardDistance > INTERACTION_GEOMETRY_EPSILON
      && candidate.forwardDistance <= broadRange + INTERACTION_GEOMETRY_EPSILON
      && candidate.lateralDistance <= broadLateralTolerance + INTERACTION_GEOMETRY_EPSILON
      && candidate.lateralDistance <= candidate.forwardDistance * 0.5 + INTERACTION_GEOMETRY_EPSILON
    ))
    .map((candidate) => ({
      ...candidate,
      range: getManualInteractionRange(
        scene,
        candidate.interaction,
        candidate.interactionPosition,
        explicitRange,
      ),
      lateralTolerance: getManualInteractionLateralTolerance(
        scene,
        candidate.interaction,
        explicitLateralTolerance,
      ),
    }))
    .filter((candidate) => (
      candidate.forwardDistance <= candidate.range + INTERACTION_GEOMETRY_EPSILON
      && candidate.lateralDistance <= candidate.lateralTolerance + INTERACTION_GEOMETRY_EPSILON
      && hasClearInteractionPath(
        scene,
        position,
        candidate.interactionPosition,
        candidate.interaction,
        positionOverrides,
      )
    ))
    .sort((left, right) => left.distance - right.distance);

  return candidates.length ? publicInteraction(candidates[0].interaction) : null;
}

/** Finds the closest automatic enter/exit portal in a tight forward corridor. */
export function getDoorwayTransition(
  sceneId,
  position,
  facing,
  options = {},
) {
  const scene = requireScene(sceneId);
  requireContinuousPosition(position);
  const facingVector = DIRECTION_DELTAS[facing];
  if (!facingVector) throw new RangeError(`Unknown facing direction: ${facing}`);
  const range = options.range ?? scene.movement.doorwayRange;
  const lateralTolerance = options.lateralTolerance ?? scene.movement.doorwayLateralTolerance;
  requirePositiveNumber(range, "Doorway range");
  requirePositiveNumber(lateralTolerance, "Doorway lateral tolerance", { allowZero: true });

  const candidates = scene.interactions
    .filter((interaction) => interaction.type === "enter" || interaction.type === "exit")
    .map((interaction) => {
      const offsetX = interaction.at.x - position.x;
      const offsetY = interaction.at.y - position.y;
      const forwardDistance = offsetX * facingVector.x + offsetY * facingVector.y;
      const lateralDistance = Math.abs(offsetX * facingVector.y - offsetY * facingVector.x);
      const distance = Math.hypot(offsetX, offsetY);
      return { interaction, distance, forwardDistance, lateralDistance };
    })
    .filter((candidate) => (
      candidate.forwardDistance > INTERACTION_GEOMETRY_EPSILON
      && candidate.forwardDistance <= range + INTERACTION_GEOMETRY_EPSILON
      && candidate.lateralDistance <= lateralTolerance + INTERACTION_GEOMETRY_EPSILON
      && candidate.lateralDistance <= candidate.forwardDistance * 0.5 + INTERACTION_GEOMETRY_EPSILON
      && hasClearStructuralInteractionPath(scene, position, candidate.interaction.at)
    ))
    .sort((left, right) => left.distance - right.distance);

  return candidates.length ? publicInteraction(candidates[0].interaction) : null;
}
