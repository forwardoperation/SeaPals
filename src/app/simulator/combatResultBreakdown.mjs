function toFiniteNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeContributor(contributor, index) {
  if (!contributor) return null;
  const value = toFiniteNumber(contributor.value);
  if (value == null) return null;
  const label = String(contributor.label ?? "Modifier").trim() || "Modifier";
  return {
    id: String(contributor.id ?? `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`),
    label,
    value,
    kind: contributor.kind === "roll" || contributor.kind === "result" ? contributor.kind : "modifier",
    detail: contributor.detail ? String(contributor.detail) : "",
    count: Math.max(1, Number(contributor.count) || 1),
  };
}

function aggregateContributors(contributors) {
  const aggregated = [];
  const modifierIndexes = new Map();

  contributors.forEach((contributor) => {
    if (contributor.kind !== "modifier") {
      aggregated.push(contributor);
      return;
    }
    const key = `${contributor.label}\u0000${contributor.detail}`;
    const existingIndex = modifierIndexes.get(key);
    if (existingIndex == null) {
      modifierIndexes.set(key, aggregated.length);
      aggregated.push(contributor);
      return;
    }
    const existing = aggregated[existingIndex];
    aggregated[existingIndex] = {
      ...existing,
      value: existing.value + contributor.value,
      count: existing.count + contributor.count,
    };
  });

  return aggregated;
}

export function combatContributorsFromDetails(details = []) {
  return details.map((detail, index) => {
    const text = String(detail ?? "").trim();
    const match = text.match(/^([+-]?\d+)\s+(?:from\s+)?(.+)$/i);
    if (!match) return null;
    const value = Number(match[1]);
    const label = match[2].trim();
    return normalizeContributor({
      id: `detail-${index}-${label}`,
      label,
      value,
      kind: "modifier",
    }, index);
  }).filter(Boolean);
}

function buildSideBreakdown({ explicitSide, total, primaryRoll, side }) {
  const resolvedTotal = toFiniteNumber(explicitSide?.total ?? total);
  const explicitContributors = Array.isArray(explicitSide?.contributors)
    ? explicitSide.contributors.map(normalizeContributor).filter(Boolean)
    : [];
  const resolvedPrimaryRoll = toFiniteNumber(primaryRoll);
  const contributors = aggregateContributors(explicitContributors.length
    ? explicitContributors
    : resolvedPrimaryRoll == null
      ? resolvedTotal == null
        ? []
        : [normalizeContributor({ id: `${side}-result`, label: "Result", value: resolvedTotal, kind: "result" }, 0)]
      : [normalizeContributor({ id: `${side}-roll`, label: "Roll", value: resolvedPrimaryRoll, kind: "roll" }, 0)]);

  if (!contributors.length && resolvedTotal == null) return null;

  const contributorSum = contributors.reduce((sum, contributor) => sum + contributor.value, 0);
  if (resolvedTotal != null && contributorSum !== resolvedTotal) {
    contributors.push(normalizeContributor({
      id: `${side}-remainder`,
      label: side === "defense" && resolvedTotal === 0 && contributorSum < 0
        ? "Minimum total"
        : "Other modifiers",
      value: resolvedTotal - contributorSum,
      kind: "modifier",
    }, contributors.length));
  }

  return {
    cardId: explicitSide?.cardId ? String(explicitSide.cardId) : null,
    actionName: explicitSide?.actionName ? String(explicitSide.actionName) : "",
    name: explicitSide?.name || explicitSide?.label ? String(explicitSide.name ?? explicitSide.label) : "",
    contributors,
    total: resolvedTotal ?? contributorSum,
  };
}

export function buildCombatResultBreakdown(event = {}) {
  const explicitBreakdown = event.combatBreakdown ?? {};
  return {
    attack: buildSideBreakdown({
      explicitSide: explicitBreakdown.attack,
      total: event.attackTotal,
      primaryRoll: event.primaryAttackRoll,
      side: "attack",
    }),
    defense: buildSideBreakdown({
      explicitSide: explicitBreakdown.defense,
      total: event.defenseTotal,
      primaryRoll: event.primaryDefenseRoll,
      side: "defense",
    }),
  };
}

export function formatCombatContributorValue(contributor) {
  const value = Number(contributor?.value ?? 0);
  if (contributor?.kind === "roll" || contributor?.kind === "result" || value <= 0) return String(value);
  return `+${value}`;
}

function normalizeConsequence(consequence, index) {
  if (!consequence) return null;
  if (typeof consequence === "string") {
    const label = consequence.trim();
    return label ? { id: `combat-consequence-${index}`, label, detail: "" } : null;
  }
  const label = String(consequence.label ?? "").trim();
  const detail = String(consequence.detail ?? "").trim();
  if (!label && !detail) return null;
  return {
    id: String(consequence.id ?? `combat-consequence-${index}`),
    label,
    detail,
  };
}

export function buildCombatResultConsequences(event = {}, { defaultConsequence = null } = {}) {
  const explicit = Array.isArray(event.combatConsequences)
    ? event.combatConsequences
    : event.resultNote
      ? [event.resultNote]
      : [];
  const seen = new Set();

  return [...explicit, defaultConsequence]
    .map(normalizeConsequence)
    .filter((consequence) => {
      if (!consequence) return false;
      const semanticKey = `${consequence.label.trim().toLowerCase()}\u0000${consequence.detail.trim().toLowerCase()}`;
      if (seen.has(semanticKey)) return false;
      seen.add(semanticKey);
      return true;
    });
}
