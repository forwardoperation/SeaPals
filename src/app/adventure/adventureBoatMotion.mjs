const CANONICAL_BOAT_HEADINGS = Object.freeze({
  down: 0,
  right: 90,
  up: 180,
  left: 270,
});

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
