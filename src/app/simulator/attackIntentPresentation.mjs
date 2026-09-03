export const ATTACK_INTENT_WINDUP_MS = 720;
export const ATTACK_INTENT_REDUCED_MOTION_MS = 60;
export const ATTACK_INTENT_MISSING_ANCHOR_MS = 80;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeRect(rect) {
  const left = finite(rect?.left);
  const top = finite(rect?.top);
  const width = Math.max(0, finite(rect?.width, finite(rect?.right) - left));
  const height = Math.max(0, finite(rect?.height, finite(rect?.bottom) - top));
  return {
    left,
    top,
    width,
    height,
    right: finite(rect?.right, left + width),
    bottom: finite(rect?.bottom, top + height),
  };
}

function pointOnFacingEdge(rect, toward, gap, fallbackDirection) {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = toward.x - centerX;
  const dy = toward.y - centerY;
  const distance = Math.hypot(dx, dy);
  const unitX = distance > 0.0001 ? dx / distance : fallbackDirection.x;
  const unitY = distance > 0.0001 ? dy / distance : fallbackDirection.y;
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  const xScale = Math.abs(unitX) > 0.0001 ? halfWidth / Math.abs(unitX) : Infinity;
  const yScale = Math.abs(unitY) > 0.0001 ? halfHeight / Math.abs(unitY) : Infinity;
  const edgeDistance = Math.min(xScale, yScale);
  return {
    x: centerX + unitX * (edgeDistance + gap),
    y: centerY + unitY * (edgeDistance + gap),
  };
}

/**
 * Builds a viewport-space curved arrow whose endpoints sit just outside the
 * two card rectangles. The root bounds keep the decoration on the game board.
 */
export function createAttackVectorGeometry({
  rootRect: rootInput,
  attackerRect: attackerInput,
  targetRect: targetInput,
  edgeGap = 10,
} = {}) {
  const root = normalizeRect(rootInput);
  const attacker = normalizeRect(attackerInput);
  const target = normalizeRect(targetInput);
  if (!root.width || !root.height || !attacker.width || !attacker.height || !target.width || !target.height) return null;

  const attackerCenter = {
    x: attacker.left + attacker.width / 2,
    y: attacker.top + attacker.height / 2,
  };
  const targetCenter = {
    x: target.left + target.width / 2,
    y: target.top + target.height / 2,
  };
  const start = pointOnFacingEdge(attacker, targetCenter, edgeGap, { x: 0, y: -1 });
  const end = pointOnFacingEdge(target, attackerCenter, edgeGap, { x: 0, y: 1 });
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy) || 1;
  const perpendicularX = -dy / distance;
  const perpendicularY = dx / distance;
  const curveAmount = clamp(distance * 0.14, 24, 68);
  const segmentMidpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const rootCenter = {
    x: root.left + root.width / 2,
    y: root.top + root.height / 2,
  };
  const centerwardDot = (rootCenter.x - segmentMidpoint.x) * perpendicularX
    + (rootCenter.y - segmentMidpoint.y) * perpendicularY;
  const curveDirection = centerwardDot < 0 ? -1 : 1;
  const padding = 4;
  const minX = root.left + padding;
  const maxX = root.right - padding;
  const minY = root.top + padding;
  const maxY = root.bottom - padding;
  const clampPoint = (point) => ({
    x: clamp(point.x, minX, maxX),
    y: clamp(point.y, minY, maxY),
  });
  const clampedStart = clampPoint(start);
  const clampedEnd = clampPoint(end);
  const control1 = clampPoint({
    x: start.x + dx * 0.34 + perpendicularX * curveAmount * curveDirection,
    y: start.y + dy * 0.34 + perpendicularY * curveAmount * curveDirection,
  });
  const control2 = clampPoint({
    x: start.x + dx * 0.66 + perpendicularX * curveAmount * curveDirection,
    y: start.y + dy * 0.66 + perpendicularY * curveAmount * curveDirection,
  });
  const midpoint = {
    x: (clampedStart.x + clampedEnd.x) / 2 + perpendicularX * curveAmount * 0.75 * curveDirection,
    y: (clampedStart.y + clampedEnd.y) / 2 + perpendicularY * curveAmount * 0.75 * curveDirection,
  };

  return {
    start: clampedStart,
    end: clampedEnd,
    control1,
    control2,
    midpoint: clampPoint(midpoint),
    path: `M ${clampedStart.x.toFixed(2)} ${clampedStart.y.toFixed(2)} C ${control1.x.toFixed(2)} ${control1.y.toFixed(2)}, ${control2.x.toFixed(2)} ${control2.y.toFixed(2)}, ${clampedEnd.x.toFixed(2)} ${clampedEnd.y.toFixed(2)}`,
  };
}

export function getAttackIntentWindupDuration({ reducedMotion = false, anchorsAvailable = true } = {}) {
  if (reducedMotion) return ATTACK_INTENT_REDUCED_MOTION_MS;
  return anchorsAvailable ? ATTACK_INTENT_WINDUP_MS : ATTACK_INTENT_MISSING_ANCHOR_MS;
}
