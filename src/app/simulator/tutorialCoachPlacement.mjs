export const TUTORIAL_COACH_SIDES = Object.freeze({
  ABOVE: "above",
  BELOW: "below",
  LEFT: "left",
  RIGHT: "right",
});

const DEFAULT_MARGIN = 12;
const DEFAULT_GAP = 36;
const DEFAULT_ARROW_INSET = 32;
const DEFAULT_BEACON_ARROW_LENGTH = 24;

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, minimum, maximum) {
  if (maximum <= minimum) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeRect(rect) {
  if (!rect || typeof rect !== "object") return null;
  const left = finiteNumber(rect.left ?? rect.x);
  const top = finiteNumber(rect.top ?? rect.y);
  const explicitWidth = finiteNumber(rect.width);
  const explicitHeight = finiteNumber(rect.height);
  const right = finiteNumber(rect.right)
    ?? (left != null && explicitWidth != null ? left + explicitWidth : null);
  const bottom = finiteNumber(rect.bottom)
    ?? (top != null && explicitHeight != null ? top + explicitHeight : null);
  if ([left, top, right, bottom].some((value) => value == null)) return null;
  if (right <= left || bottom <= top) return null;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function getPreferredSides(target, viewportWidth, viewportHeight) {
  const centerX = target.left + target.width / 2;
  const centerY = target.top + target.height / 2;
  const verticalPreference = centerY >= viewportHeight * 0.56
    ? [TUTORIAL_COACH_SIDES.ABOVE, TUTORIAL_COACH_SIDES.BELOW]
    : [TUTORIAL_COACH_SIDES.BELOW, TUTORIAL_COACH_SIDES.ABOVE];

  if (centerX >= viewportWidth * 0.64) {
    return [
      TUTORIAL_COACH_SIDES.LEFT,
      ...verticalPreference,
      TUTORIAL_COACH_SIDES.RIGHT,
    ];
  }
  if (centerX <= viewportWidth * 0.36) {
    return [
      TUTORIAL_COACH_SIDES.RIGHT,
      ...verticalPreference,
      TUTORIAL_COACH_SIDES.LEFT,
    ];
  }
  return [
    verticalPreference[0],
    TUTORIAL_COACH_SIDES.LEFT,
    TUTORIAL_COACH_SIDES.RIGHT,
    verticalPreference[1],
  ];
}

function arrowOffsetForTarget(targetCenter, overlayStart, overlayLength, arrowInset) {
  const effectiveInset = Math.min(arrowInset, overlayLength / 2);
  return clamp(targetCenter - overlayStart, effectiveInset, overlayLength - effectiveInset);
}

/**
 * Positions the full Professor coach card beside the highlighted tutorial target.
 * The card stays inside the viewport and its arrow remains clear of rounded corners.
 */
export function getTutorialCoachPlacement({
  targetRect,
  coachRect,
  viewportWidth,
  viewportHeight,
  margin = DEFAULT_MARGIN,
  gap = DEFAULT_GAP,
  arrowInset = DEFAULT_ARROW_INSET,
} = {}) {
  const target = normalizeRect(targetRect);
  const coach = normalizeRect(coachRect);
  const width = finiteNumber(viewportWidth);
  const height = finiteNumber(viewportHeight);
  const safeMargin = Math.max(0, finiteNumber(margin) ?? DEFAULT_MARGIN);
  const safeGap = Math.max(0, finiteNumber(gap) ?? DEFAULT_GAP);
  const safeArrowInset = Math.max(0, finiteNumber(arrowInset) ?? DEFAULT_ARROW_INSET);
  if (!target || !coach || !width || !height || width <= 0 || height <= 0) return null;

  const visibleTarget = {
    left: clamp(target.left, 0, width),
    top: clamp(target.top, 0, height),
    right: clamp(target.right, 0, width),
    bottom: clamp(target.bottom, 0, height),
  };
  visibleTarget.width = visibleTarget.right - visibleTarget.left;
  visibleTarget.height = visibleTarget.bottom - visibleTarget.top;
  if (visibleTarget.width <= 0 || visibleTarget.height <= 0) return null;

  const coachWidth = Math.min(coach.width, Math.max(1, width - safeMargin * 2));
  const coachHeight = Math.min(coach.height, Math.max(1, height - safeMargin * 2));
  const spaces = {
    [TUTORIAL_COACH_SIDES.ABOVE]: visibleTarget.top - safeGap - safeMargin,
    [TUTORIAL_COACH_SIDES.BELOW]: height - visibleTarget.bottom - safeGap - safeMargin,
    [TUTORIAL_COACH_SIDES.LEFT]: visibleTarget.left - safeGap - safeMargin,
    [TUTORIAL_COACH_SIDES.RIGHT]: width - visibleTarget.right - safeGap - safeMargin,
  };
  const required = {
    [TUTORIAL_COACH_SIDES.ABOVE]: coachHeight,
    [TUTORIAL_COACH_SIDES.BELOW]: coachHeight,
    [TUTORIAL_COACH_SIDES.LEFT]: coachWidth,
    [TUTORIAL_COACH_SIDES.RIGHT]: coachWidth,
  };
  const preferredSides = getPreferredSides(visibleTarget, width, height);
  const side = preferredSides.find((candidate) => spaces[candidate] >= required[candidate])
    ?? [...preferredSides].sort((left, right) => (
      (spaces[right] / Math.max(1, required[right]))
      - (spaces[left] / Math.max(1, required[left]))
    ))[0];

  const targetCenterX = visibleTarget.left + visibleTarget.width / 2;
  const targetCenterY = visibleTarget.top + visibleTarget.height / 2;
  let left;
  let top;

  if (side === TUTORIAL_COACH_SIDES.ABOVE || side === TUTORIAL_COACH_SIDES.BELOW) {
    left = clamp(
      targetCenterX - coachWidth / 2,
      safeMargin,
      width - safeMargin - coachWidth,
    );
    top = side === TUTORIAL_COACH_SIDES.ABOVE
      ? visibleTarget.top - safeGap - coachHeight
      : visibleTarget.bottom + safeGap;
  } else {
    left = side === TUTORIAL_COACH_SIDES.LEFT
      ? visibleTarget.left - safeGap - coachWidth
      : visibleTarget.right + safeGap;
    top = clamp(
      targetCenterY - coachHeight / 2,
      safeMargin,
      height - safeMargin - coachHeight,
    );
  }

  left = clamp(left, safeMargin, width - safeMargin - coachWidth);
  top = clamp(top, safeMargin, height - safeMargin - coachHeight);
  const arrowOffset = side === TUTORIAL_COACH_SIDES.ABOVE || side === TUTORIAL_COACH_SIDES.BELOW
    ? arrowOffsetForTarget(targetCenterX, left, coachWidth, safeArrowInset)
    : arrowOffsetForTarget(targetCenterY, top, coachHeight, safeArrowInset);

  return Object.freeze({
    side,
    left,
    top,
    width: coachWidth,
    height: coachHeight,
    arrowOffset,
    constrained: spaces[side] < required[side],
  });
}

/**
 * Anchors the compact Professor cue to the exact centerline of its target.
 * `left` remains the cue's clamped center, while `arrowShift` corrects the
 * arrow independently so edge-clamped cues still point at the real control.
 */
export function getTutorialBeaconAnchor({
  targetRect,
  viewportWidth,
  viewportHeight,
  broadPlacementTarget = false,
  arrowLength = DEFAULT_BEACON_ARROW_LENGTH,
} = {}) {
  const target = normalizeRect(targetRect);
  const width = finiteNumber(viewportWidth);
  const height = finiteNumber(viewportHeight);
  const safeArrowLength = Math.max(12, finiteNumber(arrowLength) ?? DEFAULT_BEACON_ARROW_LENGTH);
  if (!target || !width || !height || width <= 0 || height <= 0) return null;

  const visibleTarget = {
    left: clamp(target.left, 0, width),
    top: clamp(target.top, 0, height),
    right: clamp(target.right, 0, width),
    bottom: clamp(target.bottom, 0, height),
  };
  visibleTarget.width = visibleTarget.right - visibleTarget.left;
  visibleTarget.height = visibleTarget.bottom - visibleTarget.top;
  if (visibleTarget.width <= 0 || visibleTarget.height <= 0) return null;

  const targetX = visibleTarget.left + visibleTarget.width / 2;
  const targetY = broadPlacementTarget
    ? visibleTarget.top + visibleTarget.height * 0.58
    : visibleTarget.top;
  const direction = targetY > 190 ? TUTORIAL_COACH_SIDES.ABOVE : TUTORIAL_COACH_SIDES.BELOW;
  const horizontalPadding = Math.min(152, Math.max(104, width / 2 - 8));
  const left = clamp(targetX, horizontalPadding, width - horizontalPadding);
  const targetEdgeY = direction === TUTORIAL_COACH_SIDES.ABOVE
    ? targetY
    : visibleTarget.bottom;
  const top = direction === TUTORIAL_COACH_SIDES.ABOVE
    ? targetEdgeY - safeArrowLength
    : targetEdgeY + safeArrowLength;

  return Object.freeze({
    direction,
    left,
    top,
    arrowShift: targetX - left,
    arrowLength: safeArrowLength,
    targetX,
    targetY: targetEdgeY,
  });
}
