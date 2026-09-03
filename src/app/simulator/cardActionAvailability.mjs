function blocked(blockType, status, reason) {
  return {
    ready: false,
    blockType,
    status,
    reason,
  };
}

export function evaluateCardActionAvailability({
  actionName = "Action",
  actionCost = 0,
  availableRp = 0,
  gamePhase = "main",
  gameOver = false,
  interactionBlocked = false,
  sourceStunned = false,
  usedThisTurn = false,
  currentTurn = 0,
  cooldownUntil = 0,
  specificBlock = null,
} = {}) {
  const cost = Math.max(0, Number(actionCost) || 0);
  const rp = Math.max(0, Number(availableRp) || 0);

  if (gameOver) {
    return blocked("game-over", "Game over", "The duel has already ended.");
  }
  if (interactionBlocked) {
    return blocked(
      "interaction",
      "Finish current action",
      typeof interactionBlocked === "string"
        ? interactionBlocked
        : "Finish the current card action first.",
    );
  }
  if (gamePhase !== "main") {
    return blocked(
      "phase",
      "Action phase only",
      `${actionName} can only be used during your action phase.`,
    );
  }
  if (sourceStunned) {
    return blocked("stunned", "Stunned", `${actionName} cannot be used while this card is Stunned.`);
  }
  if (usedThisTurn) {
    return blocked("used", "Used this turn", `${actionName} has already been used this turn.`);
  }
  if (Number(cooldownUntil) > Number(currentTurn)) {
    return blocked("cooldown", "Ready next turn", `${actionName} is unavailable this turn.`);
  }
  if (rp < cost) {
    const shortfall = cost - rp;
    return blocked(
      "rp",
      `Need ${shortfall} more RP`,
      `${actionName} costs ${cost} RP, but you have ${rp} RP.`,
    );
  }
  if (specificBlock) {
    return blocked(
      specificBlock.blockType ?? "unavailable",
      specificBlock.status ?? "Unavailable",
      specificBlock.reason ?? `${actionName} cannot be used right now.`,
    );
  }

  return {
    ready: true,
    blockType: null,
    status: "Ready",
    reason: `${actionName} is ready to use.`,
  };
}
