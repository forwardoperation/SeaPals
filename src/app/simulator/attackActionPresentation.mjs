const TARGET_FAMILY_PRESENTATION = Object.freeze({
  apex: {
    label: "Apex",
    icon: "/images/icons/apex-any.png",
  },
  predator: {
    label: "Predator",
    icon: "/images/icons/predator-any.png",
  },
  fish: {
    label: "Fish",
    icon: "/images/icons/fish-any.png",
  },
  invertebrate: {
    label: "Invertebrate",
    icon: "/images/icons/invertebrate_any.png",
  },
  "filter-feeder": {
    label: "Filter Feeder",
    icon: "/images/icons/filter-feeder-any.png",
  },
});

const ZONE_TARGET_ICONS = Object.freeze({
  reef: {
    apex: "/images/icons/reef-apex_icon.png",
    predator: "/images/icons/reef-predator-icon.png",
    fish: "/images/icons/reef-fish-icon.png",
    invertebrate: "/images/icons/reef-invertebrate-icon.png",
  },
  deep: {
    apex: "/images/icons/deep-apex-icon.png",
    predator: "/images/icons/deep-predator-icon.png",
    fish: "/images/icons/deep-fish-icon.png",
    invertebrate: "/images/icons/deep-invertebrate-icon.png",
  },
  oceanic: {
    apex: "/images/icons/oceanic-apex-icon.png",
    predator: "/images/icons/oceanic-predator-icon.png",
    fish: "/images/icons/oceanic-fish-icon.png",
    invertebrate: "/images/icons/oceanic-invertebrate-icon.png",
  },
});

const TARGET_TAG_LABELS = Object.freeze({
  anemone: "Anemone",
  "man-o-war": "Man O' War",
  "man-of-war": "Man O' War",
  "sea-urchin": "Sea Urchin",
  starfish: "Starfish",
});

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function formatList(values) {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} or ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, or ${values.at(-1)}`;
}

function normalizeZone(zone) {
  const normalized = String(zone ?? "").trim().toLowerCase();
  if (normalized === "ocean") return "oceanic";
  return ["reef", "deep", "oceanic"].includes(normalized) ? normalized : null;
}

function formatTargetTag(tag) {
  const normalized = String(tag ?? "").trim().toLowerCase();
  if (!normalized) return "";
  if (TARGET_TAG_LABELS[normalized]) return TARGET_TAG_LABELS[normalized];
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getAttackActionPresentation(action = {}) {
  const zone = normalizeZone(action.targetZone);
  const categories = unique(action.targetCategories ?? [])
    .filter((category) => TARGET_FAMILY_PRESENTATION[category]);
  const targetRestrictions = unique((action.targetTags ?? []).map(formatTargetTag));
  const targets = categories.length
    ? categories.map((category) => {
        const family = TARGET_FAMILY_PRESENTATION[category];
        const zoneIcon = ZONE_TARGET_ICONS[zone]?.[category];
        return {
          category,
          icon: zoneIcon ?? family.icon,
          label: zone ? `${zone[0].toUpperCase()}${zone.slice(1)} ${family.label}` : `any ${family.label}`,
        };
      })
    : [{
        category: "any",
        icon: "/images/icons/any-creature.png",
        label: zone ? `any ${zone[0].toUpperCase()}${zone.slice(1)} Creature` : "any Creature",
      }];
  const targetSummary = formatList(targets.map((target) => target.label));
  const restrictionSummary = targetRestrictions.length
    ? `Only ${formatList(targetRestrictions)}`
    : "";

  return {
    attackDice: String(action.attackDice ?? "").trim().toUpperCase() || "Attack",
    targets,
    targetSummary,
    restrictionSummary,
    accessibleTargetSummary: restrictionSummary
      ? `${targetSummary}, limited to ${formatList(targetRestrictions)}`
      : targetSummary,
  };
}

export function getActionAccessibleLabel(action, attackPresentation = null) {
  const cost = Number(action.cost ?? 0);
  const attackLabel = attackPresentation
    ? `, ${attackPresentation.attackDice} attack, targets ${attackPresentation.accessibleTargetSummary}`
    : "";
  const costLabel = cost > 0 ? `, costs ${cost} RP` : "";
  const stateLabel = action.availability.ready
    ? ", ready to use"
    : `, unavailable: ${action.availability.reason}`;
  return `${action.label}${attackLabel}${costLabel}${stateLabel}`;
}
