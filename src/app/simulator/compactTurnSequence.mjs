export const CompactTurnStage = Object.freeze({
  TURN: "turn",
  CONDITION: "condition",
  OPENING_HAND: "opening-hand",
  RP: "rp",
});

export function createCompactTurnStages({
  turnLabel = null,
  condition = null,
  includeCondition = true,
  includeOpeningHand = false,
  includeRp = true,
} = {}) {
  return [
    turnLabel ? { kind: CompactTurnStage.TURN } : null,
    includeCondition && condition ? { kind: CompactTurnStage.CONDITION } : null,
    includeOpeningHand ? { kind: CompactTurnStage.OPENING_HAND } : null,
    includeRp ? { kind: CompactTurnStage.RP } : null,
  ].filter(Boolean);
}

export function getCompactConditionBannerDuration(conditionText = "") {
  const characterCount = String(conditionText ?? "").trim().length;
  const readingSteps = Math.ceil(characterCount / 45);
  return Math.min(3800, Math.max(2200, 1750 + readingSteps * 450));
}

export function allocateCollectedRpSources(sources = [], collectedRp = 0) {
  let remaining = Math.max(0, Math.floor(Number(collectedRp) || 0));
  const allocated = [];

  for (const source of sources) {
    if (!remaining) break;
    const available = Math.max(0, Math.floor(Number(source?.amount) || 0));
    const amount = Math.min(available, remaining);
    for (let index = 0; index < amount; index += 1) {
      allocated.push({
        sourceKey: String(source?.key || "round-supply"),
        sourceIndex: index,
      });
    }
    remaining -= amount;
  }

  while (remaining > 0) {
    allocated.push({ sourceKey: "round-supply", sourceIndex: allocated.length });
    remaining -= 1;
  }

  return allocated;
}
