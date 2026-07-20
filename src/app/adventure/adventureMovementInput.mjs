export const ADVENTURE_CARDINAL_DIRECTIONS = Object.freeze([
  "up",
  "right",
  "down",
  "left",
]);

export const ADVENTURE_CARDINAL_VECTORS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  right: Object.freeze({ x: 1, y: 0 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
});

function directionValues(orderedDirections) {
  if (orderedDirections === undefined || orderedDirections === null) return [];
  if (typeof orderedDirections === "string") {
    throw new TypeError("Adventure movement input must be an ordered iterable, not a string.");
  }
  if (orderedDirections instanceof Map) return orderedDirections.values();
  if (typeof orderedDirections[Symbol.iterator] !== "function") {
    throw new TypeError("Adventure movement input must be an ordered iterable.");
  }
  return orderedDirections;
}

/**
 * Resolves held overworld controls to exactly one cardinal step.
 *
 * `orderedDirections` is oldest-to-newest across every input source. It can be
 * an Array/Set of directions or the keyboard direction Map already used by the
 * adventure screen (Map values are read in insertion order). Keeping one
 * shared order for keyboard and touch means the latest deliberate press wins
 * instead of producing a diagonal or cancelling an opposing pair.
 */
export function resolveAdventureMovementInput(orderedDirections) {
  let direction = null;

  for (const candidate of directionValues(orderedDirections)) {
    if (!Object.prototype.hasOwnProperty.call(ADVENTURE_CARDINAL_VECTORS, candidate)) {
      throw new RangeError(`Unknown adventure movement direction: ${String(candidate)}`);
    }
    direction = candidate;
  }

  const vector = direction === null
    ? { x: 0, y: 0 }
    : { ...ADVENTURE_CARDINAL_VECTORS[direction] };

  return { direction, vector };
}
