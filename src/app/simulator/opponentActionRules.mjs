function getActionIdentity(action, fallbackIndex = 0) {
  if (typeof action === "string") {
    return action.split(":")[0]?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || `action-${fallbackIndex}`;
  }
  return action?.id
    ?? action?.name?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
    ?? action?.actionName?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
    ?? `action-${fallbackIndex}`;
}

/**
 * Action-use identity is tied to the card instance/location, not merely card id.
 * This prevents duplicate copies of the same card from sharing a once-per-turn use.
 */
export function getOpponentActionUseKey(locationKey, action, fallbackIndex = 0) {
  return `${locationKey ?? "unknown-location"}:${getActionIdentity(action, fallbackIndex)}`;
}

export function wasOpponentActionUsedThisTurn(actionUses = {}, actionKey, turn) {
  return actionKey != null && Number(actionUses[actionKey]) === Number(turn);
}

export function markOpponentActionUsed(actionUses = {}, actionKey, turn) {
  if (!actionKey) return { ...actionUses };
  return { ...actionUses, [actionKey]: Number(turn) };
}

export function supportLocksFurtherPlays(card) {
  return Boolean(card?.locksFurtherSupportsThisTurn)
    || /cannot play another support card/i.test(card?.text ?? "");
}
