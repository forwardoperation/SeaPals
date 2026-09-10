export const MOBILE_HAND_DROP_SNAP_DISTANCE = 48;

export function distanceFromClientPointToRect(clientX, clientY, rect) {
  if (!rect) return Number.POSITIVE_INFINITY;
  const left = Number(rect.left);
  const top = Number(rect.top);
  const right = Number(rect.right);
  const bottom = Number(rect.bottom);
  if (![clientX, clientY, left, top, right, bottom].every(Number.isFinite)) {
    return Number.POSITIVE_INFINITY;
  }

  const dx = Math.max(left - clientX, 0, clientX - right);
  const dy = Math.max(top - clientY, 0, clientY - bottom);
  return Math.hypot(dx, dy);
}

export function findNearestHandDropElement(
  elements,
  clientX,
  clientY,
  { maxDistance = MOBILE_HAND_DROP_SNAP_DISTANCE, isEligible = () => true } = {},
) {
  let nearestElement = null;
  let nearestDistance = Math.max(0, Number(maxDistance) || 0);

  for (const element of elements ?? []) {
    if (!isEligible(element)) continue;
    const rect = element?.getBoundingClientRect?.();
    if (!rect || Number(rect.width) <= 0 || Number(rect.height) <= 0) continue;
    const distance = distanceFromClientPointToRect(clientX, clientY, rect);
    if (distance > nearestDistance) continue;
    nearestElement = element;
    nearestDistance = distance;
  }

  return nearestElement;
}
