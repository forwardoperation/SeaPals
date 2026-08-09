const LAYER_ORDER = Object.freeze({
  ground: 0,
  depth: 1,
  overhead: 2,
});

const GEOMETRY_EPSILON = 1e-9;
const WALKABLE_REGION_EDGE_SAMPLES = 32;

export const LAYERED_SCENE_LAYERS = Object.freeze(Object.keys(LAYER_ORDER));

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requirePlainObject(value, label) {
  if (!isPlainObject(value)) throw new TypeError(`${label} must be an object.`);
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value;
}

function requireFiniteNumber(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
}

function requirePositiveNumber(value, label) {
  requireFiniteNumber(value, label);
  if (value <= 0) throw new RangeError(`${label} must be positive.`);
  return value;
}

function requirePosition(value, label) {
  requirePlainObject(value, label);
  requireFiniteNumber(value.x, `${label}.x`);
  requireFiniteNumber(value.y, `${label}.y`);
  return value;
}

function freezePosition(value) {
  return Object.freeze({ x: value.x, y: value.y });
}

function freezeBounds(value) {
  return Object.freeze({
    left: value.left,
    top: value.top,
    right: value.right,
    bottom: value.bottom,
  });
}

function requireBounds(value, label) {
  requirePlainObject(value, label);
  for (const field of ["left", "top", "right", "bottom"]) {
    requireFiniteNumber(value[field], `${label}.${field}`);
  }
  if (value.left >= value.right || value.top >= value.bottom) {
    throw new RangeError(`${label} must have positive area.`);
  }
  return value;
}

function requireLayer(value, label) {
  const layer = value ?? "depth";
  if (!Object.hasOwn(LAYER_ORDER, layer)) {
    throw new RangeError(`${label} must be ground, depth, or overhead.`);
  }
  return layer;
}

function requireDepthBias(value, label) {
  const bias = value ?? 0;
  requireFiniteNumber(bias, label);
  if (!Number.isInteger(bias)) throw new TypeError(`${label} must be an integer.`);
  return bias;
}

function normalizeSprite(sprite, label) {
  requirePlainObject(sprite, label);
  const src = requireNonEmptyString(sprite.src, `${label}.src`);
  const width = requirePositiveNumber(sprite.width, `${label}.width`);
  const height = requirePositiveNumber(sprite.height, `${label}.height`);
  const anchorX = sprite.anchorX ?? 0.5;
  const anchorY = sprite.anchorY ?? 1;
  requireFiniteNumber(anchorX, `${label}.anchorX`);
  requireFiniteNumber(anchorY, `${label}.anchorY`);
  if (anchorX < 0 || anchorX > 1 || anchorY < 0 || anchorY > 1) {
    throw new RangeError(`${label} anchors must stay between 0 and 1.`);
  }
  if (!src.startsWith("/")) throw new TypeError(`${label}.src must be root-relative.`);
  return Object.freeze({ src, width, height, anchorX, anchorY });
}

function normalizeCollider(collider, label) {
  requireBounds(collider, label);
  return Object.freeze({
    id: requireNonEmptyString(collider.id, `${label}.id`),
    ...freezeBounds(collider),
  });
}

function normalizeArchetypes(archetypes) {
  requirePlainObject(archetypes, "Layered scene archetypes");
  return Object.freeze(Object.fromEntries(Object.entries(archetypes).map(([id, archetype]) => {
    requireNonEmptyString(id, "Layered scene archetype id");
    requirePlainObject(archetype, `Layered scene archetype ${id}`);
    if (archetype.colliders !== undefined && !Array.isArray(archetype.colliders)) {
      throw new TypeError(`Layered scene archetype ${id}.colliders must be an array.`);
    }
    const colliderIds = new Set();
    const colliders = (archetype.colliders ?? []).map((collider, index) => {
      const normalized = normalizeCollider(collider, `Layered scene archetype ${id}.colliders[${index}]`);
      if (colliderIds.has(normalized.id)) {
        throw new Error(`Layered scene archetype ${id} uses duplicate collider id ${normalized.id}.`);
      }
      colliderIds.add(normalized.id);
      return normalized;
    });
    const depthOffsetY = archetype.depthOffsetY ?? 0;
    requireFiniteNumber(depthOffsetY, `Layered scene archetype ${id}.depthOffsetY`);
    return [id, Object.freeze({
      id,
      sprite: normalizeSprite(archetype.sprite, `Layered scene archetype ${id}.sprite`),
      colliders: Object.freeze(colliders),
      layer: requireLayer(archetype.layer, `Layered scene archetype ${id}.layer`),
      depthOffsetY,
      depthBias: requireDepthBias(archetype.depthBias, `Layered scene archetype ${id}.depthBias`),
    })];
  })));
}

function normalizeTerrain(rows, legend, width, height) {
  if (!Array.isArray(rows) || rows.length !== height) {
    throw new RangeError(`Layered scene terrain must contain exactly ${height} rows.`);
  }
  requirePlainObject(legend, "Layered scene terrain legend");
  const normalizedLegend = Object.freeze(Object.fromEntries(Object.entries(legend).map(([symbol, tile]) => {
    if (symbol.length !== 1) throw new TypeError("Layered scene terrain symbols must be one character.");
    requirePlainObject(tile, `Layered scene terrain legend ${symbol}`);
    if (typeof tile.walkable !== "boolean") {
      throw new TypeError(`Layered scene terrain legend ${symbol}.walkable must be boolean.`);
    }
    return [symbol, Object.freeze({ walkable: tile.walkable })];
  })));

  const normalizedRows = rows.map((row, y) => {
    if (typeof row !== "string" || row.length !== width) {
      throw new RangeError(`Layered scene terrain row ${y} must contain exactly ${width} symbols.`);
    }
    for (const symbol of row) {
      if (!Object.hasOwn(normalizedLegend, symbol)) {
        throw new RangeError(`Layered scene terrain row ${y} uses unknown symbol ${symbol}.`);
      }
    }
    return row;
  });

  return Object.freeze({
    rows: Object.freeze(normalizedRows),
    legend: normalizedLegend,
  });
}

function normalizeWalkableRegions(regions, width, height) {
  if (regions === undefined) return Object.freeze([]);
  if (!Array.isArray(regions) || !regions.length) {
    throw new TypeError("Layered scene walkableRegions must be a non-empty array when supplied.");
  }
  const ids = new Set();
  return Object.freeze(regions.map((region, index) => {
    const label = `Layered scene walkableRegions[${index}]`;
    requireBounds(region, label);
    const id = requireNonEmptyString(region.id, `${label}.id`);
    if (ids.has(id)) throw new Error(`Layered scene uses duplicate walkable region id ${id}.`);
    if (!boundsInsideScene(region, width, height)) {
      throw new RangeError(`Layered scene walkable region ${id} extends outside the scene.`);
    }
    ids.add(id);
    return Object.freeze({ id, ...freezeBounds(region) });
  }));
}

function boundsInsideScene(bounds, width, height) {
  return bounds.left >= -0.5 - GEOMETRY_EPSILON
    && bounds.top >= -0.5 - GEOMETRY_EPSILON
    && bounds.right <= width - 0.5 + GEOMETRY_EPSILON
    && bounds.bottom <= height - 0.5 + GEOMETRY_EPSILON;
}

function scaleRelativeBounds(bounds, at, scale) {
  return {
    left: at.x + bounds.left * scale,
    top: at.y + bounds.top * scale,
    right: at.x + bounds.right * scale,
    bottom: at.y + bounds.bottom * scale,
  };
}

function compileObject(instance, archetypes, width, height, index) {
  const label = `Layered scene object ${index}`;
  requirePlainObject(instance, label);
  const id = requireNonEmptyString(instance.id, `${label}.id`);
  const archetypeId = requireNonEmptyString(instance.archetype, `${label}.archetype`);
  const archetype = archetypes[archetypeId];
  if (!archetype) throw new RangeError(`${label} uses unknown archetype ${archetypeId}.`);
  const at = requirePosition(instance.at, `${label}.at`);
  const scale = instance.scale ?? 1;
  requirePositiveNumber(scale, `${label}.scale`);
  const sprite = instance.spriteSrc === undefined
    ? archetype.sprite
    : Object.freeze({
        ...archetype.sprite,
        src: requireNonEmptyString(instance.spriteSrc, `${label}.spriteSrc`),
      });
  const spriteWidth = sprite.width * scale;
  const spriteHeight = sprite.height * scale;
  const visualBounds = freezeBounds({
    left: at.x - spriteWidth * sprite.anchorX,
    top: at.y - spriteHeight * sprite.anchorY,
    right: at.x + spriteWidth * (1 - sprite.anchorX),
    bottom: at.y + spriteHeight * (1 - sprite.anchorY),
  });
  const collisionRects = archetype.colliders.map((collider) => {
    const bounds = scaleRelativeBounds(collider, at, scale);
    if (!boundsInsideScene(bounds, width, height)) {
      throw new RangeError(`Layered scene object ${id} collider ${collider.id} extends outside the scene.`);
    }
    return Object.freeze({
      id: `${id}:${collider.id}`,
      ...freezeBounds(bounds),
    });
  });
  const interactionId = instance.interactionId === undefined
    ? null
    : requireNonEmptyString(instance.interactionId, `${label}.interactionId`);
  return Object.freeze({
    id,
    renderId: `object:${id}`,
    kind: "object",
    archetype: archetypeId,
    at: freezePosition(at),
    sprite,
    scale,
    layer: archetype.layer,
    depthY: at.y + archetype.depthOffsetY * scale,
    depthBias: archetype.depthBias,
    visualBounds,
    collisionRects: Object.freeze(collisionRects),
    interactionId,
  });
}

/**
 * Compiles a scene whose base layer owns terrain navigation and whose reusable
 * object archetypes own sprite geometry, base collision, and depth anchors.
 * Object collision rectangles deliberately match adventureWorld's existing
 * absolute rectangle format so scenes can migrate one object family at a time.
 */
export function compileLayeredScene({
  id,
  width,
  height,
  groundPath = null,
  terrainRows,
  terrainLegend,
  walkableRegions,
  archetypes,
  objects,
}) {
  requireNonEmptyString(id, "Layered scene id");
  requirePositiveNumber(width, "Layered scene width");
  requirePositiveNumber(height, "Layered scene height");
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new TypeError("Layered scene width and height must be integers.");
  }
  if (!Array.isArray(objects)) throw new TypeError("Layered scene objects must be an array.");

  const normalizedArchetypes = normalizeArchetypes(archetypes);
  const terrain = normalizeTerrain(terrainRows, terrainLegend, width, height);
  const normalizedGroundPath = groundPath === null
    ? null
    : requireNonEmptyString(groundPath, "Layered scene groundPath");
  if (normalizedGroundPath !== null && !normalizedGroundPath.startsWith("/")) {
    throw new TypeError("Layered scene groundPath must be root-relative.");
  }
  const normalizedWalkableRegions = normalizeWalkableRegions(walkableRegions, width, height);
  const objectIds = new Set();
  const compiledObjects = objects.map((instance, index) => {
    const object = compileObject(instance, normalizedArchetypes, width, height, index);
    if (objectIds.has(object.id)) throw new Error(`Layered scene uses duplicate object id ${object.id}.`);
    objectIds.add(object.id);
    return object;
  });
  const collisionRects = compiledObjects.flatMap((object) => object.collisionRects);

  return Object.freeze({
    id,
    width,
    height,
    groundPath: normalizedGroundPath,
    terrain,
    walkableRegions: normalizedWalkableRegions,
    archetypes: normalizedArchetypes,
    objects: Object.freeze(compiledObjects),
    collisionRects: Object.freeze(collisionRects),
  });
}

function circleIntersectsRectangle(position, radiusSquared, rectangle) {
  const nearestX = Math.max(rectangle.left, Math.min(position.x, rectangle.right));
  const nearestY = Math.max(rectangle.top, Math.min(position.y, rectangle.bottom));
  const distanceX = position.x - nearestX;
  const distanceY = position.y - nearestY;
  return distanceX * distanceX + distanceY * distanceY < radiusSquared - Number.EPSILON;
}

function circlesIntersect(position, radius, blocker) {
  const distanceX = position.x - blocker.position.x;
  const distanceY = position.y - blocker.position.y;
  const combinedRadius = radius + blocker.radius;
  return distanceX * distanceX + distanceY * distanceY
    < combinedRadius * combinedRadius - Number.EPSILON;
}

function circleFitsWalkableRegionUnion(position, radius, regions) {
  if (!regions.length) return true;
  const pointIsInside = (point) => regions.some((region) => (
    point.x >= region.left - GEOMETRY_EPSILON
    && point.x <= region.right + GEOMETRY_EPSILON
    && point.y >= region.top - GEOMETRY_EPSILON
    && point.y <= region.bottom + GEOMETRY_EPSILON
  ));
  if (!pointIsInside(position)) return false;
  for (let index = 0; index < WALKABLE_REGION_EDGE_SAMPLES; index += 1) {
    const angle = (index / WALKABLE_REGION_EDGE_SAMPLES) * Math.PI * 2;
    if (!pointIsInside({
      x: position.x + Math.cos(angle) * radius,
      y: position.y + Math.sin(angle) * radius,
    })) return false;
  }
  return true;
}

/** Tests a circular actor body against authored ground, object bases, and live actors. */
export function canOccupyLayeredScenePosition(
  scene,
  position,
  radius,
  { dynamicBlockers = [] } = {},
) {
  requirePlainObject(scene, "Layered scene");
  requirePosition(position, "Layered scene position");
  requirePositiveNumber(radius, "Layered scene collision radius");
  if (!Array.isArray(dynamicBlockers)) {
    throw new TypeError("Layered scene dynamicBlockers must be an array.");
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
  ) return false;
  if (!circleFitsWalkableRegionUnion(position, radius, scene.walkableRegions ?? [])) return false;

  const radiusSquared = radius * radius;
  const minTileX = Math.max(0, Math.floor(position.x - radius + 0.5));
  const maxTileX = Math.min(scene.width - 1, Math.floor(position.x + radius + 0.5));
  const minTileY = Math.max(0, Math.floor(position.y - radius + 0.5));
  const maxTileY = Math.min(scene.height - 1, Math.floor(position.y + radius + 0.5));
  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      const symbol = scene.terrain.rows[tileY][tileX];
      if (scene.terrain.legend[symbol].walkable) continue;
      if (circleIntersectsRectangle(position, radiusSquared, {
        left: tileX - 0.5,
        top: tileY - 0.5,
        right: tileX + 0.5,
        bottom: tileY + 0.5,
      })) return false;
    }
  }

  if (scene.collisionRects.some((rectangle) => (
    circleIntersectsRectangle(position, radiusSquared, rectangle)
  ))) return false;

  for (const [index, blocker] of dynamicBlockers.entries()) {
    requirePosition(blocker?.position, `Layered scene dynamic blocker ${index}.position`);
    requirePositiveNumber(blocker?.radius, `Layered scene dynamic blocker ${index}.radius`);
    if (circlesIntersect(position, radius, blocker)) return false;
  }
  return true;
}

export function createLayeredActorRenderable({ id, position, depthOffsetY = 0, depthBias = 0 }) {
  requireNonEmptyString(id, "Layered actor id");
  requirePosition(position, `Layered actor ${id}.position`);
  requireFiniteNumber(depthOffsetY, `Layered actor ${id}.depthOffsetY`);
  return Object.freeze({
    id,
    renderId: `actor:${id}`,
    kind: "actor",
    layer: "depth",
    depthY: position.y + depthOffsetY,
    depthBias: requireDepthBias(depthBias, `Layered actor ${id}.depthBias`),
    position: freezePosition(position),
  });
}

function requireRenderable(renderable, index) {
  requirePlainObject(renderable, `Layered renderable ${index}`);
  requireNonEmptyString(renderable.renderId, `Layered renderable ${index}.renderId`);
  requireLayer(renderable.layer, `Layered renderable ${index}.layer`);
  requireFiniteNumber(renderable.depthY, `Layered renderable ${index}.depthY`);
  requireDepthBias(renderable.depthBias, `Layered renderable ${index}.depthBias`);
  return renderable;
}

/**
 * Returns back-to-front DOM order. A tree/building at y=8 renders over actors
 * north of its base and under actors south of its base without special cases.
 */
export function sortLayeredSceneRenderables(renderables) {
  if (!Array.isArray(renderables)) {
    throw new TypeError("Layered scene renderables must be an array.");
  }
  return Object.freeze(renderables
    .map((renderable, index) => ({ renderable: requireRenderable(renderable, index), index }))
    .sort((left, right) => (
      LAYER_ORDER[left.renderable.layer] - LAYER_ORDER[right.renderable.layer]
      || left.renderable.depthY - right.renderable.depthY
      || left.renderable.depthBias - right.renderable.depthBias
      || left.index - right.index
    ))
    .map(({ renderable }) => renderable));
}

export function getLayeredSceneZIndex(renderable) {
  requireRenderable(renderable, 0);
  if (renderable.layer === "ground") return 10 + renderable.depthBias;
  if (renderable.layer === "overhead") return 100_000 + renderable.depthBias;
  return 1_000 + Math.round((renderable.depthY + 0.5) * 1_000) + renderable.depthBias;
}

/** Converts world-space visual bounds into the mapWorld percentage system. */
export function getLayeredSceneObjectStyle(object, scene) {
  requirePlainObject(object, "Layered scene object");
  requireBounds(object.visualBounds, "Layered scene object visualBounds");
  requirePlainObject(scene, "Layered scene");
  requirePositiveNumber(scene.width, "Layered scene width");
  requirePositiveNumber(scene.height, "Layered scene height");
  const { visualBounds } = object;
  return Object.freeze({
    left: `${((visualBounds.left + 0.5) / scene.width) * 100}%`,
    top: `${((visualBounds.top + 0.5) / scene.height) * 100}%`,
    width: `${((visualBounds.right - visualBounds.left) / scene.width) * 100}%`,
    height: `${((visualBounds.bottom - visualBounds.top) / scene.height) * 100}%`,
    zIndex: getLayeredSceneZIndex(object),
  });
}
