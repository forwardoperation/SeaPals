export const GUIDED_ACADEMY_INTRO_CARD_ID = "mustard-hill-coral-base";

export const GUIDED_ACADEMY_INTRO_BASELINE_CONCEPT_KEYS = Object.freeze([
  "kind:coral",
  "stage:base-coral",
  "label:cost",
  "label:passive",
  "stat:health",
  "stat:slots",
  "stat:weakness",
]);

function freezeRegion(region) {
  return Object.freeze(region);
}

export const TUTORIAL_CARD_FOCUS_REGIONS = Object.freeze({
  type: freezeRegion({ x: 12, y: 44, width: 105, height: 18, tailX: 55, tailY: 101, tipX: 55, tipY: 62, direction: "up" }),
  identity: freezeRegion({ x: 10, y: 6, width: 70, height: 39, tailX: 45, tailY: 84, tipX: 45, tipY: 45, direction: "up" }),
  victory: freezeRegion({ x: 10, y: 6, width: 70, height: 39, tailX: 45, tailY: 84, tipX: 45, tipY: 45, direction: "up" }),
  name: freezeRegion({ x: 80, y: 6, width: 205, height: 39, tailX: 182, tailY: 84, tipX: 182, tipY: 45, direction: "up" }),
  cost: freezeRegion({ x: 285, y: 6, width: 80, height: 39, tailX: 325, tailY: 84, tipX: 325, tipY: 45, direction: "up" }),
  "class-icon": freezeRegion({ x: 334, y: 7, width: 31, height: 36, tailX: 348, tailY: 82, tipX: 348, tipY: 43, direction: "up" }),
  rules: freezeRegion({ x: 14, y: 271, width: 347, height: 65, tailX: 45, tailY: 233, tipX: 45, tipY: 271, direction: "down" }),
  "rules-secondary": freezeRegion({ x: 14, y: 338, width: 347, height: 58, tailX: 45, tailY: 300, tipX: 45, tipY: 338, direction: "down" }),
  "rules-tertiary": freezeRegion({ x: 14, y: 405, width: 347, height: 58, tailX: 45, tailY: 367, tipX: 45, tipY: 405, direction: "down" }),
  maintenance: freezeRegion({ x: 14, y: 338, width: 347, height: 58, tailX: 45, tailY: 300, tipX: 45, tipY: 338, direction: "down" }),
  health: freezeRegion({ x: 10, y: 465, width: 82, height: 41, tailX: 51, tailY: 425, tipX: 51, tipY: 465, direction: "down" }),
  defense: freezeRegion({ x: 10, y: 465, width: 82, height: 41, tailX: 51, tailY: 425, tipX: 51, tipY: 465, direction: "down" }),
  weaknesses: freezeRegion({ x: 110, y: 465, width: 158, height: 41, tailX: 189, tailY: 425, tipX: 189, tipY: 465, direction: "down" }),
  slots: freezeRegion({ x: 268, y: 425, width: 97, height: 80, tailX: 317, tailY: 385, tipX: 317, tipY: 425, direction: "down" }),
  "density-supply": freezeRegion({ x: 286, y: 465, width: 76, height: 41, tailX: 324, tailY: 425, tipX: 324, tipY: 465, direction: "down" }),
  "density-requirement": freezeRegion({ x: 286, y: 24, width: 76, height: 21, tailX: 324, tailY: 84, tipX: 324, tipY: 45, direction: "up" }),
});

const STACKED_DENSITY_COST_FOCUS_REGION = freezeRegion({
  x: 285,
  y: 5,
  width: 48,
  height: 19,
  tailX: 245,
  tailY: 15,
  tipX: 285,
  tipY: 15,
  direction: "right",
});

const TUTORIAL_CARD_TEMPLATE_FOCUS_OVERRIDES = Object.freeze({
  support: Object.freeze({
    type: freezeRegion({ x: 12, y: 9, width: 228, height: 33, tailX: 126, tailY: 81, tipX: 126, tipY: 42, direction: "up" }),
    name: freezeRegion({ x: 13, y: 43, width: 348, height: 32, tailX: 187, tailY: 114, tipX: 187, tipY: 75, direction: "up" }),
    cost: null,
    rules: freezeRegion({ x: 20, y: 374, width: 338, height: 82, tailX: 49, tailY: 335, tipX: 49, tipY: 374, direction: "down" }),
    "rules-secondary": null,
    "rules-tertiary": null,
  }),
  habitat: Object.freeze({
    type: freezeRegion({ x: 326, y: 14, width: 40, height: 43, tailX: 346, tailY: 95, tipX: 346, tipY: 57, direction: "up" }),
    name: freezeRegion({ x: 18, y: 17, width: 284, height: 40, tailX: 160, tailY: 95, tipX: 160, tipY: 57, direction: "up" }),
    cost: null,
    rules: freezeRegion({ x: 20, y: 70, width: 337, height: 177, tailX: 71, tailY: 31, tipX: 71, tipY: 70, direction: "down" }),
    "rules-secondary": null,
    "rules-tertiary": null,
    maintenance: freezeRegion({ x: 20, y: 255, width: 337, height: 57, tailX: 45, tailY: 216, tipX: 45, tipY: 255, direction: "down" }),
    health: freezeRegion({ x: 17, y: 465, width: 82, height: 42, tailX: 58, tailY: 425, tipX: 58, tipY: 465, direction: "down" }),
  }),
  "filter-feeder": Object.freeze({
    type: null,
    rules: freezeRegion({ x: 14, y: 65, width: 347, height: 75, tailX: 55, tailY: 26, tipX: 55, tipY: 65, direction: "down" }),
    "rules-secondary": freezeRegion({ x: 14, y: 142, width: 347, height: 50, tailX: -26, tailY: 152, tipX: 14, tipY: 152, direction: "right" }),
    "rules-tertiary": null,
  }),
});

const REEF_APEX_RULE_FOCUS_REGIONS = Object.freeze([
  TUTORIAL_CARD_FOCUS_REGIONS.rules,
  TUTORIAL_CARD_FOCUS_REGIONS["rules-secondary"],
  freezeRegion({ x: 14, y: 386, width: 347, height: 77, tailX: 45, tailY: 348, tipX: 45, tipY: 386, direction: "down" }),
]);

const CARD_RULE_FOCUS_OVERRIDES = Object.freeze({
  "brain-coral-stage-2": Object.freeze([
    TUTORIAL_CARD_FOCUS_REGIONS.rules,
    freezeRegion({ x: 14, y: 315, width: 347, height: 58, tailX: 45, tailY: 277, tipX: 45, tipY: 315, direction: "down" }),
  ]),
  "porcupine-fish": Object.freeze([
    TUTORIAL_CARD_FOCUS_REGIONS.rules,
    freezeRegion({ x: 14, y: 341, width: 347, height: 58, tailX: 45, tailY: 303, tipX: 45, tipY: 341, direction: "down" }),
  ]),
  halfbeak: Object.freeze([
    TUTORIAL_CARD_FOCUS_REGIONS.rules,
    freezeRegion({ x: 14, y: 340, width: 347, height: 58, tailX: 45, tailY: 302, tipX: 45, tipY: 340, direction: "down" }),
    freezeRegion({ x: 14, y: 405, width: 347, height: 58, tailX: 45, tailY: 367, tipX: 45, tipY: 405, direction: "down" }),
  ]),
  "anchovy-ball-stage1": Object.freeze([
    freezeRegion({ x: 14, y: 275, width: 347, height: 70, tailX: 45, tailY: 237, tipX: 45, tipY: 275, direction: "down" }),
    freezeRegion({ x: 14, y: 350, width: 347, height: 50, tailX: 45, tailY: 312, tipX: 45, tipY: 350, direction: "down" }),
    freezeRegion({ x: 14, y: 405, width: 347, height: 58, tailX: 45, tailY: 367, tipX: 45, tipY: 405, direction: "down" }),
  ]),
  "great-white": REEF_APEX_RULE_FOCUS_REGIONS,
  "tiger-shark": REEF_APEX_RULE_FOCUS_REGIONS,
  hammerhead: REEF_APEX_RULE_FOCUS_REGIONS,
  "bull-shark": REEF_APEX_RULE_FOCUS_REGIONS,
  "bottlenose-dolphin": REEF_APEX_RULE_FOCUS_REGIONS,
});

const CARD_RULE_ORDER_OVERRIDES = Object.freeze({
  "blue-sea-dragon": Object.freeze(["Requirement:0", "Passive:1", "Passive:0", "Action:0"]),
  "giant-phantom-jelly": Object.freeze(["Special Rule:0", "Special Rule:1", "Action:0", "Passive:0"]),
});

function getTutorialCardTemplate(card) {
  const kind = normalizeToken(card?.kind);
  if (kind === "support") return "support";
  if (kind === "habitat") return "habitat";
  const category = normalizeToken(card?.category ?? card?.class);
  return category === "filter-feeder" ? "filter-feeder" : "standard";
}

export function getTutorialCardFocusRegion(focus, card = null) {
  if (!focus) return null;
  if (/SeaPalsTCGLogoWhite\.svg$/i.test(String(card?.image ?? ""))) return null;
  if (focus === "cost" && Number(card?.schoolDensityRequirement ?? 0) > 0) {
    return STACKED_DENSITY_COST_FOCUS_REGION;
  }
  const ruleIndex = focus === "rules" ? 0 : focus === "rules-secondary" ? 1 : focus === "rules-tertiary" ? 2 : null;
  if (ruleIndex != null) {
    const override = CARD_RULE_FOCUS_OVERRIDES[card?.id]?.[ruleIndex];
    if (override) return override;
  }
  const templateOverrides = TUTORIAL_CARD_TEMPLATE_FOCUS_OVERRIDES[getTutorialCardTemplate(card)];
  if (templateOverrides && Object.prototype.hasOwnProperty.call(templateOverrides, focus)) {
    return templateOverrides[focus];
  }
  return TUTORIAL_CARD_FOCUS_REGIONS[focus] ?? null;
}

const INTRO_STEP_COUNT = 8;

function normalizeToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-");
}

function formatToken(value) {
  return normalizeToken(value)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function asList(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function getCardRp(card) {
  return Number(card?.cost?.rp ?? card?.rp ?? 0);
}

function getCardVp(card) {
  return Number(card?.victoryPoints ?? card?.vp ?? 0);
}

function getCardDefense(card) {
  return card?.defense?.dice ?? card?.defense ?? null;
}

function getCardPassive(card) {
  return asList(card?.passives)[0] ?? null;
}

function getPassiveName(passive) {
  if (!passive) return "Passive";
  if (typeof passive === "string") return passive.split(":")[0] || "Passive";
  return passive.name ?? "Passive";
}

function getPassiveText(passive) {
  if (!passive) return "";
  if (typeof passive === "string") return passive.includes(":")
    ? passive.slice(passive.indexOf(":") + 1).trim()
    : passive;
  return passive.text ?? "";
}

function getSlotSummary(card) {
  return asList(card?.slots)
    .map((slot) => {
      const count = Math.max(1, Number(slot?.count ?? 1));
      const label = formatToken(slot?.slotType ?? slot?.class ?? slot?.type ?? "creature");
      return `${count} ${label}`;
    })
    .join(" and ");
}

function getWeaknessSummary(card) {
  return asList(card?.weaknesses).map(formatToken).filter(Boolean).join(" and ");
}

function containsAttack(value, seen = new Set()) {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (normalizeToken(value.type) === "attack") return true;
  return Object.values(value).some((entry) => (
    Array.isArray(entry)
      ? entry.some((item) => containsAttack(item, seen))
      : containsAttack(entry, seen)
  ));
}

function concept(key, title, text, focus = "rules") {
  return { key, title, text, focus };
}

function toCardReferenceRule(rule, label, index) {
  if (!rule) return null;
  if (typeof rule === "string") {
    const separator = rule.indexOf(":");
    return {
      key: `${label}-${index}-${rule}`,
      label,
      name: separator > 0 ? rule.slice(0, separator).trim() : "",
      text: separator > 0 ? rule.slice(separator + 1).trim() : rule,
    };
  }
  return {
    key: `${label}-${rule.id ?? `${index}-${rule.name ?? rule.text ?? "rule"}`}`,
    label,
    name: rule.name ?? "",
    text: rule.text ?? "Read the highlighted lesson for this rule's timing and effect.",
  };
}

function describeSpecialPlacement(rule) {
  if (!rule || typeof rule !== "object") return "";
  if (rule.text) return rule.text;
  const parts = [];
  if (normalizeToken(rule.controller) === "opponent" || normalizeToken(rule.zone) === "opponent-reef") {
    parts.push("Place this card in your opponent's ecosystem.");
  } else if (rule.zone) {
    parts.push(`Place this card in the ${formatToken(rule.zone)} zone.`);
  }
  if (rule.acceptsAnyCoralSlot === true) {
    parts.push("It may use any open Coral slot type.");
  }
  const hostTags = formatList(asList(rule.allowedHostTags));
  if (hostTags) {
    parts.push(`It may be placed in an open slot provided by a ${hostTags} host.`);
  }
  return parts.join(" ") || "Follow this card's special placement rule instead of ordinary slot placement.";
}

function describeRemovalRules(rule) {
  if (!rule || typeof rule !== "object") return "";
  if (rule.text) return rule.text;
  const methods = asList(rule.methods).map(normalizeToken);
  const parts = [];
  if (methods.includes("successfulattack")) {
    parts.push("A successful legal attack can remove this card.");
  }
  if (methods.includes("specializedsupport")) {
    const supportNames = formatList(asList(rule.specializedSupportCardIds));
    parts.push(supportNames
      ? `${supportNames} can also remove it.`
      : "A specialized Support card can also remove it.");
  }
  return parts.join(" ") || "Only the removal methods printed for this card can remove it from play.";
}

function structuredRule(rule, describe) {
  if (!rule) return null;
  if (typeof rule === "string") return rule;
  return { ...rule, text: describe(rule) };
}

export function getTutorialCardReferenceRules(card) {
  if (!card) return [];
  return [
    ...(card.text ? [{ key: "card-text", label: "Rules", name: "", text: card.text }] : []),
    ...asList(card.playRequirements ?? card.requirements).map((rule, index) => toCardReferenceRule(rule, "Requirement", index)),
    ...asList(card.playRestrictions).map((rule, index) => toCardReferenceRule(rule, "Restriction", index)),
    ...asList(structuredRule(card.specialPlacement, describeSpecialPlacement)).map((rule, index) => toCardReferenceRule(rule, "Special Placement", index)),
    ...asList(card.specialRules).map((rule, index) => toCardReferenceRule(rule, "Special Rule", index)),
    ...asList(structuredRule(card.removalRules, describeRemovalRules)).map((rule, index) => toCardReferenceRule(rule, "Removal", index)),
    ...asList(card.maintenance).map((rule, index) => toCardReferenceRule(rule, "Maintenance", index)),
    ...(card.upgrade?.text ? [toCardReferenceRule(card.upgrade, "Upgrade", 0)] : []),
    ...asList(card.passives).map((rule, index) => toCardReferenceRule(rule, "Passive", index)),
    ...asList(card.onPlay).map((rule, index) => toCardReferenceRule(rule, "On Play", index)),
    ...asList(card.actions).map((rule, index) => toCardReferenceRule(rule, "Action", index)),
  ].filter(Boolean);
}

function formatList(values = []) {
  const filtered = values.map(formatToken).filter(Boolean);
  if (filtered.length <= 1) return filtered[0] ?? "";
  if (filtered.length === 2) return `${filtered[0]} or ${filtered[1]}`;
  return `${filtered.slice(0, -1).join(", ")}, or ${filtered.at(-1)}`;
}

function collectAttackEffects(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  const matches = normalizeToken(value.type) === "attack" ? [value] : [];
  return [
    ...matches,
    ...Object.values(value).flatMap((entry) => (
      Array.isArray(entry)
        ? entry.flatMap((item) => collectAttackEffects(item, seen))
        : collectAttackEffects(entry, seen)
    )),
  ];
}

function getRuleCost(rule) {
  if (!rule || typeof rule !== "object") return 0;
  return Math.max(0, Number(rule.cost?.rp ?? rule.actionCost ?? rule.effect?.actionCost ?? 0));
}

function getAttackRuleSummary(rule) {
  const effects = collectAttackEffects(rule);
  if (!effects.length) return "";
  return effects.map((effect) => {
    const dice = String(effect.attackDice ?? effect.dice ?? "").trim().toUpperCase();
    const categories = effect.target?.categories ?? effect.targetCategories ?? [];
    const targets = formatList(categories);
    const repeat = Math.max(1, Number(effect.repeat ?? effect.count ?? 1));
    const parts = [
      dice ? `rolls ${dice}` : "starts an attack",
      targets ? `can target an opposing ${targets}` : "can target an opposing creature",
      repeat > 1 ? `resolves ${repeat} attacks` : "",
    ].filter(Boolean);
    return `This attack ${parts.join(", ")}.`;
  }).join(" ");
}

function getCreatureCommonName(card) {
  return String(card?.bio?.commonName ?? card?.name ?? "creature").trim().toLowerCase() || "creature";
}

function getCardNarrativeSubject(card) {
  return normalizeToken(card?.kind) === "creature"
    ? `the ${getCreatureCommonName(card)}`
    : card?.name ?? "this card";
}

export function getTutorialCardLessonSubject(card) {
  return getCardNarrativeSubject(card);
}

function capitalizeFirst(value) {
  return String(value ?? "").replace(/^./, (letter) => letter.toUpperCase());
}

function getCardLessonTitle(card) {
  return `Meet ${getTutorialCardLessonSubject(card)}`;
}

function joinNaturalLanguage(values = []) {
  const filtered = values.map((value) => String(value ?? "").trim()).filter(Boolean);
  if (filtered.length <= 1) return filtered[0] ?? "";
  if (filtered.length === 2) return `${filtered[0]} and ${filtered[1]}`;
  return `${filtered.slice(0, -1).join(", ")}, and ${filtered.at(-1)}`;
}

function getCreatureStrategicEntries(card) {
  return [
    ["On Play", asList(card?.onPlay)],
    ["Action", asList(card?.actions)],
    ["Passive", asList(card?.passives)],
  ].flatMap(([label, rules]) => rules.map((rule, index) => ({ label, rule, index })));
}

function getStrategicRuleCorpus(rule) {
  if (!rule) return "";
  if (typeof rule === "string") return rule.toLowerCase();
  return [
    rule.name,
    rule.text,
    JSON.stringify(rule.effect ?? ""),
    JSON.stringify(rule.effects ?? ""),
  ].filter(Boolean).join(" ").toLowerCase();
}

const PLURAL_CREATURE_IDS = new Set(["oysters", "spinner-dolphins"]);

const CREATURE_STRATEGY_OVERVIEWS = {
  "great-white": "is a decisive finisher built to hit the opponent's foundations and creatures in one heavy assault",
  "tiger-shark": "is a durable finisher that combines repeated pressure with strong staying power",
  hammerhead: "is a sturdy finisher that disrupts the opponent's economy while threatening several creature classes",
  "bull-shark": "is an aggressive finisher that turns a prepared reef into immediate mixed pressure",
  "bottlenose-dolphin": "is a flexible apex play that refills your hand before applying targeted pressure",
  "cookie-cutter-shark": "is a resource thief that turns the opponent's large hunters into income for your own turns",
  "deep-sea-jelly": "is a combat setup piece that improves future attacks instead of fighting immediately",
  oysters: "are a Habitat payoff that greatly expands your economy after the ecosystem is established",
  "green-sea-turtle": "is a reef stabilizer that repairs a damaged foundation as it enters play",
  "spinner-dolphins": "are coordinated hunters that become more accurate beside Coral Reef",
  "blue-tang": "is a Habitat-gated scoring piece that rewards you for establishing Coral Reef",
  brittlestar: "is a resilient economy engine that can survive removal while expanding future turns",
  "cleaner-wrasse": "is a defensive support creature that protects a key Fish or Predator through the opponent's turn",
  "cleaner-shrimp": "is a hybrid support piece that protects an allied hunter while expanding your RP engine",
  "sargeant-major": "is a defensive reef builder that reinforces the Coral hosting it",
  "sea-urchin": "is a fortification piece that makes its host Coral harder to destroy",
  nudibranch: "is an economy disruptor that can temporarily weaken an opposing Coral's RP output",
  "ocean-triggerfish": "is a school guardian that reinforces the capacity already built into your ocean ecosystem",
  "sperm-whale": "is a matchup finisher built to challenge the opponent's largest creatures, especially giant squids",
  "pilot-whale-oceanic": "is a control finisher that blocks the opponent's Support plan before launching a broad hunt",
  "killer-whale-oceanic": "is an apex hunter focused on repeated assaults against the opponent's largest creatures",
  "black-swallower": "is a risky hunter that can challenge oversized prey but may be lost after a successful meal",
  "giant-squid": "is a finisher that softens a defender before launching a broad repeated assault",
  "colossal-squid": "is a high-commitment finisher that pairs defensive setup with heavy pressure across the board",
  "crevalle-jack": "is a burst-economy play that adds resources immediately to extend the current turn",
  "giant-tube-worm": "is a low-commitment board piece that turns an open Deep Invertebrate space into steady scoring",
};

const CREATURE_STRATEGY_CHOICES = {
  "great-white": "Choose it when you are ready for a decisive assault on both the opponent's foundations and board.",
  "tiger-shark": "Choose it when you want repeated pressure from a finisher that is difficult to answer cleanly.",
  hammerhead: "Choose it when staying power and broad board pressure matter more than one all-or-nothing strike.",
  "bull-shark": "Choose it when you want an aggressive finisher that pressures both foundations and creatures.",
  "bottlenose-dolphin": "Choose it when you need to refill your hand and challenge a dangerous opposing creature in the same play.",
  "cookie-cutter-shark": "Choose it when the opponent has invested in large hunters and you want their board to fund your turns.",
  "deep-sea-jelly": "Choose it when you are planning an attack sequence and want several ways to improve its odds.",
  oysters: "Choose it when a Habitat is established and a larger RP bank will unlock more ambitious turns.",
  "green-sea-turtle": "Choose it when Coral Reef is established and a damaged foundation needs meaningful repair.",
  "spinner-dolphins": "Choose it when Coral Reef is established and you want coordinated pressure against opposing hunters.",
  "blue-tang": "Choose it when Coral Reef is established and you want to turn that Habitat into immediate scoring value.",
  brittlestar: "Choose it when you want an RP engine that can spend part of its value to stay on the board.",
  "cleaner-wrasse": "Choose it when an important Fish or Predator needs help surviving the opponent's next attack.",
  "cleaner-shrimp": "Choose it when you want defensive support now and a larger RP bank for later turns.",
  "sargeant-major": "Choose it when an important Coral needs more durability while you continue developing its branch.",
  "sea-urchin": "Choose it when an important Coral needs more durability against sustained pressure.",
  nudibranch: "Choose it when slowing the opponent's resource engine will delay their next major play.",
  "ocean-triggerfish": "Choose it when a key Creature School needs extra durability to keep your larger plays online.",
  "sperm-whale": "Choose it when the opponent's largest creatures demand a dedicated answer, especially a Giant or Colossal Squid.",
  "pilot-whale-oceanic": "Choose it when stopping the opponent's Support cards will create a safe opening for a broad attack.",
  "killer-whale-oceanic": "Choose it when the opponent has committed major creatures and you need repeated apex pressure.",
  "black-swallower": "Choose it when removing a major threat is worth accepting the risk of losing the attacker afterward.",
  "giant-squid": "Choose it when you want to weaken a defender and follow immediately with broad repeated pressure.",
  "colossal-squid": "Choose it when your deep ecosystem is ready to commit to a heavy finishing assault.",
  "crevalle-jack": "Choose it when an immediate RP boost will unlock another important play this turn.",
  "giant-tube-worm": "Choose it when you want simple, low-commitment scoring in an open Deep Invertebrate space.",
};

function getCreatureStrategicGrammar(card) {
  const plural = PLURAL_CREATURE_IDS.has(normalizeToken(card?.id));
  return {
    subject: capitalizeFirst(getCardNarrativeSubject(card)),
    be: plural ? "are" : "is",
    object: plural ? "them" : "it",
    possessive: plural ? "their" : "its",
  };
}

function hasCoralReefScoring(card) {
  return normalizeToken(card?.bonusVictoryPoints?.condition?.cardId) === "coral-reef";
}

function hasHabitatRequirement(card) {
  return asList(card?.playRequirements ?? card?.requirements).some((requirement) => {
    const corpus = typeof requirement === "string" ? requirement : JSON.stringify(requirement ?? "");
    return /habitat|coral reef|open ocean|drop off|abyss/i.test(corpus);
  });
}

function getStrategicAttackTargets(rule, corpus) {
  const targets = new Set();
  for (const effect of collectAttackEffects(rule)) {
    for (const target of asList(effect?.target?.categories ?? effect?.targetCategories)) {
      targets.add(normalizeToken(target));
    }
  }
  const textTargets = [
    ["creature-school", /creature schools?/i],
    ["filter-feeder", /filter feeders?/i],
    ["invertebrate", /invertebrates?/i],
    ["predator", /predators?/i],
    ["apex", /\bapex\b/i],
    ["fish", /\bfish\b/i],
  ];
  for (const [target, pattern] of textTargets) {
    if (pattern.test(corpus)) targets.add(target);
  }
  return [...targets];
}

function getStrategicHabitatName(corpus) {
  const habitatPatterns = [
    ["Coral Reef", /\bcoral reef\b/i],
    ["Open Ocean", /\bopen ocean\b/i],
    ["Drop Off", /\bdrop[ -]?off\b/i],
    ["Abyss", /\babyss\b/i],
  ];
  return habitatPatterns.find(([, pattern]) => pattern.test(corpus))?.[0] ?? "";
}

function getCreatureStrategicSignals(entry, card) {
  const normalized = toCardReferenceRule(entry.rule, entry.label, entry.index);
  const corpus = getStrategicRuleCorpus(entry.rule);
  const attacks = collectAttackEffects(entry.rule);
  const activeAttackText = entry.label !== "Passive"
    && /\b(?:attacks?|bite|hunt|strike|snap|crunch|shatter|slash|ram|ravage|decimate|jaws|frenzy)\b/i.test(corpus);
  const isAttack = attacks.length > 0
    || activeAttackText;
  const name = normalized?.name || entry.label;
  const nameKey = normalizeToken(name).replaceAll(" ", "-");
  const handTrade = /discardthensearchdeck|discard.{0,80}search (?:your |the )?deck|\bsift\b/i.test(corpus);
  const toxicImmunity = /toxic immunity|immune.{0,35}toxic|ignoreeffect.{0,35}toxic/i.test(corpus);
  const attackWard = /if targeted.{0,80}attack fails|attack fails.{0,80}if targeted/i.test(corpus);
  const toxic = !toxicImmunity && !attackWard
    && /if eaten|consuming (?:card|creature)|toxicwheneaten/i.test(corpus);
  const opponentDiscard = !handTrade && !toxic
    && /discardrandomcard|discardtopcards|opponent.{0,50}discards?|(?:make|have|force) (?:your )?opponent.{0,30}discard/i.test(corpus);
  const coralHeal = /\b(?:restore|heal)\b.{0,60}coral|coral.{0,60}\b(?:restore|heal)\b/i.test(corpus);
  const coralPressure = /(?:damage|stun).{0,65}coral|coral.{0,65}(?:damage|stun)/i.test(corpus);
  const recoverToHand = /recovercardfromdiscard.{0,80}(?:destination.{0,20}hand)|discard pile.{0,100}(?:place|put).{0,40}(?:your )?hand|discard.{0,80}(?:place|put).{0,40}(?:your )?hand/i.test(corpus);
  const returnDiscardToDeck = /discard pile.{0,100}(?:shuffle|return).{0,60}(?:your )?deck|recovercardfromdiscard.{0,100}(?:destination.{0,20}deck)/i.test(corpus);
  return {
    ...entry,
    card,
    name,
    nameKey,
    corpus,
    attack: isAttack,
    attackTargets: isAttack ? getStrategicAttackTargets(entry.rule, corpus) : [],
    coralPressure,
    coralHeal,
    toxic,
    toxicImmunity,
    attackWard,
    opponentDiscard,
    handTrade,
    recoverToHand,
    returnDiscardToDeck,
    search: /search (?:your |the )?deck|look at the top|rearrange|vantage point|surface scan|darkness scan|call for family|tuna school/i.test(corpus),
    draw: /drawcards|\bdraw\b|fast swimmer|echo locate|filter feed/i.test(corpus),
    recover: !opponentDiscard && !handTrade && (
      recoverToHand
      || returnDiscardToDeck
      || /discard pile.{0,100}(?:hand|deck)|(?:hand|deck).{0,100}discard pile|\brecycle\b|\bplenteous\b/i.test(corpus)
    ),
    economy: /resource bank|bank cap|collect.{0,20}\brp\b|gain.{0,20}\brp\b|eco ?boost|eco foundation|nutrient rich|pearl hunting/i.test(corpus),
    rpSteal: /(?:collect|take|steal|drain).{0,35}\brp\b.{0,35}(?:from )?(?:your )?opponent/i.test(corpus),
    protection: !coralHeal && /defen[cs]|protection|attack fails|immune|keep (?:this|it)|camouflage|scatter|agility|fierce fighter|shroud|resilience|transparency|charm|massive|regenerate/i.test(corpus),
    survival: /regenerate|keep (?:this|it) card|remains? on your reef/i.test(corpus),
    attackSupport: /all of your attacks|all your attacks|next (?:on play )?attack|attack rolls? you perform|grantadvantage|advantage on attacks|defending creature gets/i.test(corpus),
    concealmentCounter: /hidden by the abyss|can target creatures hidden/i.test(corpus),
    counterAttack: /if targeted unsuccessfully|whatever creature attacked|counter.?attack/i.test(corpus),
    control: /opponent(?:'s)? (?:fish|creatures?|cards?) cost|opponent (?:cannot|must|re-roll)|nerve agent|intimidation|echo disruption|shred|drain|target:/i.test(corpus),
    placement: /anemone|placed inside|attach|slot/i.test(corpus),
    habitatSynergy: /habitat|coral reef|open ocean|abyss/i.test(corpus),
    habitatName: getStrategicHabitatName(corpus),
  };
}

function formatStrategicTargets(targets) {
  const labels = {
    "creature-school": "Creature Schools",
    "filter-feeder": "Filter Feeders",
    invertebrate: "Invertebrates",
    predator: "Predators",
    apex: "Apex creatures",
    fish: "Fish",
  };
  return joinNaturalLanguage(targets.map((target) => labels[target]).filter(Boolean));
}

function describeStrategicAbility(signal, grammar) {
  const { name, nameKey } = signal;
  const cardId = normalizeToken(signal.card?.id);
  const targets = formatStrategicTargets(signal.attackTargets);
  const abilityDescriptions = {
    "take-to-the-skies": `${name} can make an incoming attack miss before its dice are rolled`,
    agility: `${name} can stop an incoming attack before it reaches combat`,
    "fierce-fighter": `${name} forces the opponent to reroll their first successful attack`,
    scatter: `${name} forces the opponent to reroll their first successful attack`,
    camouflage: `${name} forces the opponent to reroll their first successful attack`,
    "stinging-tentacles": `${name} can stop an incoming attack before it lands`,
    charm: `${name} weakens every attack made against ${grammar.object}`,
    transparency: `${name} screens out attacks that rely on larger dice`,
    "toxic-immunity": `${name} lets ${grammar.object} hunt Toxic prey without risking Toxic's usual retaliation`,
    sift: `${name} trades spare cards from your hand for the specific card your plan needs`,
    target: `${name} strips an option from the opponent's hand before they can use it`,
    shred: `${name} removes upcoming cards from the opponent's deck and disrupts their future draws`,
    "ancient-presence": `${name} removes upcoming cards from the opponent's deck and disrupts their future draws`,
    drain: `${name} removes upcoming cards from the opponent's deck and disrupts their future draws`,
    eat: `${name} immediately pressures one of the opponent's Coral foundations`,
    chomp: `${name} immediately pressures one of the opponent's Coral foundations and improves beside Coral Reef`,
    "venom-spines": `${name} gives you another chance to damage an opposing Coral foundation`,
    "coral-heal": `${name} repairs a damaged Coral foundation as the card enters play`,
    "slow-eat": `${name} hunts the opponent's Sea Urchins and Anemones`,
    "starfish-hunt": `${name} hunts opposing Starfish`,
    invader: `${name} threatens a Fish each turn, but its coin flip can redirect the attack into your own reef`,
    parasite: `${name} siphons RP from an opponent who relies on Predators or Apex creatures`,
    "big-eyes": `${name} lets ${grammar.object} hunt through the concealment provided by Abyss`,
    regenerate: `${name} can spend RP to survive an attack that would otherwise remove ${grammar.object}`,
    "echo-locate": `${name} refills your hand as the creature enters play`,
    "phantom-boost": `${name} improves every attack you make while the creature remains in play`,
    massive: `${name} makes attacks against ${grammar.object} less reliable`,
    "tail-whip": `${name} softens the opponent's defense before the follow-up attack`,
    ensnare: `${name} can soften a defender before the next attack`,
    highlight: `${name} prepares a stronger On Play attack for your next creature`,
    "flashing-alarm": `${name} turns an enemy attack into a boost for your next offensive turn`,
    "expert-hunter": `${name} rewards Coral Reef by making attacks against Fish more reliable`,
    "bite-back": `${name} threatens an immediate counterattack when an opponent misses`,
    "filter-feed": `${name} turns unwanted cards into fresh options`,
    "grab-from-the-deep": `${name} delivers repeated pressure across every creature class`,
    "quick-strikes": `${name} overwhelms opposing Fish with repeated attacks`,
    "apex-hunter": `${name} delivers repeated pressure against the opponent's largest creatures`,
    intimidation: `${name} makes opposing Fish more expensive and slows the opponent's development`,
    "parasite-clean": `${name} gives a chosen Fish or Predator a defensive edge through the opponent's turn`,
    spines: `${name} increases the durability of the Coral hosting the Sea Urchin`,
    "night-vision": `${name} improves attacks against creatures whose names identify them as Deep`,
    "battle-of-the-titans": `${name} improves its matchup against Giant and Colossal Squids`,
    territorial: `${name} fortifies a chosen Creature School while this card remains in play`,
    corral: `${name} strengthens attacks aimed at opposing Creature Schools`,
    "darkness-shroud": `${name} turns Abyss into extra defensive protection`,
    "ancient-resilience": `${name} can keep the creature in play through an otherwise successful removal`,
    "eyes-bigger-than-stomach": `${name} challenges oversized prey but can cost you the attacker after a successful meal`,
  };
  if (nameKey === "scavenge") {
    if (signal.handTrade) return `${name} trades spare cards from your hand for the specific card your plan needs`;
    if (signal.recoverToHand) return `${name} recovers a spent card directly to your hand`;
    if (signal.returnDiscardToDeck) return `${name} recycles a spent card into your deck for a future draw`;
    if (signal.draw) return `${name} draws fresh cards to keep your options flowing`;
  }
  if (nameKey === "toxic" && signal.attackWard) {
    return `${name} can make an incoming attack fail before combat begins`;
  }
  if (nameKey === "toxic-immunity" && cardId === "giant-triton") {
    return `${name} specifically protects ${grammar.object} from Crown of Thorns' Toxic retaliation`;
  }
  if (nameKey === "munch") {
    return signal.attack
      ? `${name} lets ${grammar.object} hunt opposing Invertebrates and improves against Man O' War`
      : `${name} temporarily reduces an opposing Coral's RP production`;
  }
  if (nameKey === "coral-protector") {
    return `${name} reinforces the Coral hosting ${grammar.object}, making that foundation harder to destroy`;
  }
  if (nameKey === "nutrient-rich") {
    return `${name} gives you an immediate RP boost as the creature enters play`;
  }
  if (nameKey === "hover-strike") return `${name} pressures opposing Deep Fish and Deep Invertebrates`;
  if (nameKey === "quick-grab") return `${name} pressures opposing Deep Invertebrates`;
  if (nameKey === "plenteous") {
    return `${name} can return a base Krill Bloom from your discard to your deck after this School is attacked and destroyed`;
  }
  if (nameKey === "symbiosis") {
    return normalizeToken(signal.card?.id) === "anemone"
      ? `${name} recruits a clownfish from your hand and hosts it inside the anemone`
      : `${name} lets ${grammar.object} live inside an Anemone, opening a protected Anemone partnership`;
  }
  if (nameKey === "stinging-fortress") return `${name} adds protection to clownfish hosted inside the anemone`;
  if (abilityDescriptions[nameKey]) return abilityDescriptions[nameKey];
  if (signal.toxic) return `${name} makes consuming ${grammar.object} a risky way to remove ${grammar.object}`;
  if (signal.attack && signal.coralPressure) return `${name} pressures both the opponent's foundations and their creatures`;
  if (signal.attack && signal.habitatSynergy) return targets
    ? `${name} gains stronger pressure against opposing ${targets} when ${signal.habitatName || "the required Habitat"} is established`
    : `${name} gains a stronger attack when ${signal.habitatName || "the required Habitat"} is established`;
  if (signal.attack) return targets
    ? `${name} lets ${grammar.object} pressure opposing ${targets}`
    : `${name} gives ${grammar.object} a proactive way to pressure the opposing ecosystem`;
  if (normalizeToken(name) === "recycle") return `${name} softens the loss of your Fish by returning part of their value to your economy`;
  if (signal.coralPressure) return `${name} pressures the opponent's Coral foundations`;
  if (signal.coralHeal) return `${name} repairs a damaged Coral foundation`;
  if (signal.opponentDiscard) return `${name} strips options from the opponent before they can use them`;
  if (signal.handTrade) return `${name} trades expendable cards for the specific card your plan needs`;
  if (signal.recover) return `${name} recovers value from cards that have already been spent`;
  if (signal.search) return `${name} improves consistency by setting up the card your plan needs next`;
  if (signal.draw) return `${name} keeps useful options flowing into your hand`;
  if (signal.rpSteal) return `${name} drains the opponent's RP and redirects it into your own economy`;
  if (signal.economy) return `${name} strengthens the RP engine behind future turns`;
  if (signal.attackSupport) return `${name} improves the reliability of a future attack`;
  if (signal.counterAttack) return `${name} punishes an opponent whose attack misses`;
  if (signal.concealmentCounter) return `${name} counters an opponent's concealment plan`;
  if (signal.control) return `${name} disrupts the opponent's ability to carry out their plan`;
  if (signal.protection) return `${name} makes the card or its ecosystem harder to remove`;
  if (signal.placement) return `${name} creates flexible placement through a specialized ecosystem partnership`;
  if (signal.habitatSynergy) return `${name} rewards you for establishing the right Habitat first`;
  if (signal.label === "On Play") return `${name} creates immediate value as it enters play`;
  if (signal.label === "Action") return `${name} gives you an active tool for shaping the turn`;
  return `${name} supports your plan while the creature remains in play`;
}

function describeStrategicAbilityCombination(signals, grammar) {
  const phrases = signals.slice(0, 3).map((signal) => describeStrategicAbility(signal, grammar));
  if (phrases.length === 0) return "";
  if (phrases.length === 1) return `${phrases[0]}.`;
  if (phrases.length === 2) return `${phrases[0]}, while ${phrases[1]}.`;
  return `${phrases[0]}; ${phrases[1]}; and ${phrases[2]}.`;
}

function getCreatureStrategicOverview(card, signals, { specialPlacement, isSchool, isFilterFeeder, grammar }) {
  const { subject, be } = grammar;
  const category = normalizeToken(card?.class ?? card?.category);
  const attackSignals = signals.filter((signal) => signal.attack);
  const attackTargets = [...new Set(attackSignals.flatMap((signal) => signal.attackTargets))];
  const has = (key) => signals.some((signal) => signal[key]);
  const authoredOverview = CREATURE_STRATEGY_OVERVIEWS[normalizeToken(card?.id)];

  if (authoredOverview) return `${subject} ${authoredOverview}.`;
  if (specialPlacement) return `${subject} ${be} an invasive disruptor that occupies the opponent's ecosystem and forces an awkward response.`;
  if (isSchool) return `${subject} ${be} a foundation engine that expands what your ocean ecosystem can support while helping future turns keep pace.`;
  if (isFilterFeeder) return `${subject} ${be} a late-game scoring payoff that rewards a carefully developed ocean ecosystem.`;
  if (hasCoralReefScoring(card)) return `${subject} ${be} a scoring specialist that becomes more valuable beside Coral Reef.`;
  if (has("toxic") && attackTargets.includes("invertebrate")) return `${subject} ${be} a disruptive hunter built to break up an opponent's utility engine.`;
  if (has("rpSteal")) return `${subject} ${be} a resource-denial piece that turns the opponent's economy into fuel for your plan.`;
  if (has("opponentDiscard")) return `${subject} ${be} a disruption piece that reduces the opponent's future options before applying board pressure.`;
  if (has("coralHeal")) return `${subject} ${be} a defensive utility play that restores the foundation supporting your ecosystem.`;
  if (has("coralPressure") && !attackSignals.length) return `${subject} ${be} a foundation saboteur that pressures the opponent without relying on ordinary creature combat.`;
  if (attackSignals.length && (has("search") || has("draw") || has("recover") || has("economy"))) {
    return `${subject} ${be} a flexible attacker that pairs board pressure with tools for sustaining your own plan.`;
  }
  if (attackSignals.length && has("control")) return `${subject} ${be} a tempo attacker that damages the opponent's position while limiting their response.`;
  if (attackSignals.length && has("coralPressure")) return `${subject} ${be} a mixed-pressure attacker that threatens both creatures and the opponent's foundations.`;
  if (category === "apex") return `${subject} ${be} a late-game finisher that turns a developed ecosystem into immediate board pressure.`;
  if (attackSignals.length) return targetsOverview(subject, category, be);
  if ((has("search") || has("draw") || has("recover") || has("handTrade")) && has("economy")) return `${subject} ${be} a utility engine that improves both your resources and access to the right cards.`;
  if (has("handTrade")) return `${subject} ${be} a hand-shaping specialist that turns expendable cards into the option your plan needs.`;
  if (has("recover")) return `${subject} ${be} a recovery specialist that turns spent cards back into useful options.`;
  if (has("search") || has("draw")) return `${subject} ${be} an access specialist that improves consistency and helps you find the right follow-up.`;
  if (has("attackSupport")) return `${subject} ${be} an offensive support piece that makes a planned attack sequence more reliable.`;
  if (has("economy")) return `${subject} ${be} an economy engine that creates room for more ambitious turns later in the game.`;
  if (has("protection") || has("survival")) return `${subject} ${be} a defensive specialist that helps your ecosystem withstand opposing pressure.`;
  if (hasHabitatRequirement(card)) return `${subject} ${be} a Habitat payoff that converts an established ecosystem into straightforward board development.`;
  if (category === "predator") return `${subject} ${be} a proactive hunter that rewards you for keeping pressure on opposing creatures.`;
  if (category === "invertebrate") return `${subject} ${be} a utility piece that helps a developing ecosystem stay flexible.`;
  return `${subject} ${be} a dependable ecosystem builder that fills an important role while advancing your board.`;
}

function targetsOverview(subject, category, be = "is") {
  if (category === "predator") return `${subject} ${be} a proactive hunter that keeps pressure on the opponent's creatures.`;
  return `${subject} ${be} an active board-control option that turns an established creature into offensive pressure.`;
}

function getCreatureStrategicChoice(card, signals, { specialPlacement, isSchool, isFilterFeeder }) {
  const category = normalizeToken(card?.class ?? card?.category);
  const attackTargets = [...new Set(signals.filter((signal) => signal.attack).flatMap((signal) => signal.attackTargets))];
  const has = (key) => signals.some((signal) => signal[key]);
  const authoredChoice = CREATURE_STRATEGY_CHOICES[normalizeToken(card?.id)];

  if (authoredChoice) return authoredChoice;
  if (has("toxic") && attackTargets.includes("invertebrate")) {
    return "Choose it when opposing Invertebrates are powering search, recovery, or other utility and you want an attacker that is dangerous to consume.";
  }
  if (specialPlacement) return "Choose it when you want to disrupt the opponent's available space and make them spend effort cleaning up their own ecosystem.";
  if (isSchool) return "Choose it when you are building the capacity and economy needed to support larger ocean creatures.";
  if (isFilterFeeder) return "Choose it when your ocean engine is established and you are ready to convert that preparation into a major scoring play.";
  if (hasCoralReefScoring(card)) return "Choose it when Coral Reef is supporting your board and you want that Habitat to contribute extra scoring value.";
  if (has("rpSteal")) return "Choose it when the opponent's resource engine is strong and you want to turn that strength against them.";
  if (has("opponentDiscard")) return "Choose it when denying the opponent's future options is more valuable than adding another dedicated attacker.";
  if (has("coralHeal")) return "Choose it when preserving a damaged foundation will protect the rest of your ecosystem.";
  if (has("coralPressure") && !signals.some((signal) => signal.attack)) return "Choose it when you need to pressure the opponent's foundations without winning an ordinary faceoff first.";
  if (category === "apex") return "Choose it when your ecosystem is fully prepared and you want a finisher that can swing the board immediately.";
  if (attackTargets.length) return "Choose it when its prey matchup lines up with the opponent's board and you want direct removal pressure.";
  if ((has("search") || has("draw") || has("recover") || has("handTrade")) && has("economy")) return "Choose it when you want a long-term engine that improves both resources and card quality.";
  if (has("search") || has("draw") || has("recover") || has("handTrade")) return "Choose it when consistency matters and you need better access to the cards that complete your plan.";
  if (has("attackSupport")) return "Choose it when another attacker is ready and improving that faceoff is the best way to advance your turn.";
  if (has("economy")) return "Choose it when investing early in your RP engine will unlock stronger turns later.";
  if (has("toxic") || has("protection")) return "Choose it when you need a resilient board piece that makes removal costly or unreliable.";
  if (hasHabitatRequirement(card)) return "Choose it when its Habitat is established and you want to convert that setup into lasting board value.";
  if (category === "predator") return "Choose it when you want to turn an open hunting space into steady pressure on opposing creatures.";
  if (category === "invertebrate") return "Choose it when your ecosystem needs a flexible utility piece rather than another dedicated attacker.";
  return "Choose it when you need straightforward scoring and board development without another activated ability to manage.";
}

export function getCreatureGameplayIntroduction(card, _cardClassLabel = "") {
  if (!card || normalizeToken(card.kind) !== "creature") return "";
  const tags = asList(card.tags).map(normalizeToken);
  const isSchool = tags.includes("creature-school");
  const isFilterFeeder = normalizeToken(card.class ?? card.category) === "filter-feeder";
  const specialPlacement = card.specialPlacement
    && (normalizeToken(card.specialPlacement.controller) === "opponent"
      || ["opponent-reef", "opponentreef"].includes(normalizeToken(card.specialPlacement.zone)));
  const grammar = getCreatureStrategicGrammar(card);
  const signals = getCreatureStrategicEntries(card).map((entry) => getCreatureStrategicSignals(entry, card));
  const context = { specialPlacement, isSchool, isFilterFeeder, grammar };

  return [
    getCreatureStrategicOverview(card, signals, context),
    describeStrategicAbilityCombination(signals, grammar),
    getCreatureStrategicChoice(card, signals, context),
  ].filter(Boolean).join(" ");
}

function cardIdentityMessage(card, cardClassLabel) {
  const kind = normalizeToken(card.kind);
  const sentenceSubject = capitalizeFirst(getCardNarrativeSubject(card));
  if (kind === "creature") {
    return getCreatureGameplayIntroduction(card, cardClassLabel);
  }
  if (kind === "coral") {
    const stage = Number(card.stage ?? 0);
    return stage > 0
      ? `${card.name} is a ${cardClassLabel}. A Stage ${stage} Coral upgrades the matching earlier stage in the same Foundation.`
      : `${card.name} is a ${cardClassLabel}. A Base Coral begins a Foundation and provides the printed homes for creatures.`;
  }
  if (kind === "support") {
    return `${card.name} is a Support Action. It resolves once from your hand, then goes to your discard pile instead of staying in your ecosystem.`;
  }
  if (kind === "habitat") {
    return `${card.name} is a ${cardClassLabel}. A Habitat stays in your ecosystem after its play requirements are met.`;
  }
  return `${card.name} is a ${cardClassLabel}. Its type determines how it enters play and which rules can interact with it.`;
}

function cardTypeMessage(card, cardClassLabel) {
  const kind = normalizeToken(card.kind);
  const isSchool = asList(card.tags).map(normalizeToken).includes("creature-school");
  if (isSchool) {
    return `The printed Creature School label identifies this as a Foundation that supplies School Density instead of using a Coral's creature slot.`;
  }
  if (kind === "creature") {
    if (getTutorialCardTemplate(card) === "filter-feeder") {
      return `${capitalizeFirst(getCardNarrativeSubject(card))} belongs to the ${cardClassLabel} class. The matching icon in the top-right identifies that class for placement and targeting rules.`;
    }
    const classParts = String(cardClassLabel).match(/^(Reef|Oceanic|Deep)\s+(.+)$/i);
    if (classParts) {
      return `The printed ${cardClassLabel} label identifies its ecosystem zone and creature class: ${classParts[1]} is the zone, and ${classParts[2]} is the class. Together, they determine which open space can house it and which rules can target it.`;
    }
    return `The printed ${cardClassLabel} label identifies this card's creature class. That determines which open space can house it and which rules can target it.`;
  }
  if (kind === "coral") {
    return "The printed Reef Coral strip identifies this as a Coral Foundation and determines which Coral rules interact with it.";
  }
  if (kind === "support") {
    return "The SUPPORT header identifies a one-use card that resolves from your hand and then goes to your discard pile.";
  }
  if (kind === "habitat") {
    return "The Habitat icon identifies an environment card that stays in your ecosystem after its play requirements are met.";
  }
  return `The printed ${cardClassLabel} label determines how this card enters play and which rules can interact with it.`;
}

function hasTutorialClassIcon(card) {
  const kind = normalizeToken(card?.kind);
  if (!["creature", "coral"].includes(kind)) return false;
  const image = String(card?.image ?? "");
  return Boolean(image) && !/SeaPalsTCGLogoWhite\.svg$/i.test(image);
}

function getTutorialClassIconLabel(card, cardClassLabel) {
  const isSchool = asList(card?.tags).map(normalizeToken).includes("creature-school");
  if (isSchool) return "Creature School";
  if (normalizeToken(card?.kind) === "coral") {
    return String(cardClassLabel).replace(/^(?:Base|Stage\s+\d+)\s*-\s*/i, "") || "Coral";
  }
  return cardClassLabel;
}

function cardClassIconMessage(card, cardClassLabel) {
  const iconLabel = getTutorialClassIconLabel(card, cardClassLabel);
  if (normalizeToken(card?.kind) === "coral") {
    return `The matching ${iconLabel} icon in the top-right repeats the card's Coral type. Other cards use this symbol when their rules refer to ${iconLabel} cards.`;
  }
  return `The matching ${iconLabel} icon in the top-right repeats the same zone and class. Compare this symbol with open creature slots and targeting rules.`;
}

function createRuleSegment(card, rule, label, index, focus = "rules") {
  const normalized = toCardReferenceRule(rule, label, index);
  if (!normalized) return null;
  const cost = getRuleCost(rule);
  const attackSummary = getAttackRuleSummary(rule);
  const name = normalized.name || label;
  const stageLabel = String(card.stageLabel ?? "Current stage").trim();
  const nextUpgradeName = label === "Upgrade"
    ? normalized.text.match(/^Upgrade to (.+?)\.?$/i)?.[1] ?? "the next card"
    : "";
  const subject = getCardNarrativeSubject(card);
  const timingCopy = label === "Passive"
    ? `${name} is a Passive, so it stays active while ${subject} remains in your ecosystem.`
    : label === "On Play"
      ? `${name} is an On Play ability, so it resolves immediately after ${subject} enters play.`
      : label === "Action"
        ? `${name} is an Action you choose during your turn.${cost > 0 ? ` It costs ${cost} RP to use.` : ""}`
        : label === "Requirement"
          ? `This requirement must be true before you can play ${subject}.`
          : label === "Restriction"
            ? `This restriction limits when or how ${subject} can be played.`
            : label === "Maintenance"
              ? `Maintenance is checked after ${subject} enters your ecosystem.`
              : label === "Upgrade"
                ? `${stageLabel} in the top-left shows this card's current place in its upgrade chain.${cost > 0 ? ` Moving to the next stage costs ${cost} RP.` : ""} ${nextUpgradeName} is the next card in that chain.`
                : label === "Special Placement"
                  ? `This card uses a special placement rule instead of ordinary slot placement.`
                  : label === "Removal"
                    ? `This explains how ${subject} can be removed from play.`
                    : label === "Rules"
                      ? `This printed rule explains what ${subject} does.`
                      : `Read this ${label.toLowerCase()} before using ${subject}.`;
  return {
    id: `card:${card.id}:${normalizeToken(label)}:${normalizeToken(normalized.key)}`,
    title: label === "Upgrade"
      ? `Current stage: ${stageLabel}`
      : normalized.name ? `${label}: ${normalized.name}` : label,
    message: [timingCopy, label === "Upgrade" ? "" : normalized.text, attackSummary].filter(Boolean).join(" "),
    focus,
  };
}

function getCardSpecificLessonSegments(card, cardClassLabel) {
  const cost = getCardRp(card);
  const vp = getCardVp(card);
  const defense = getCardDefense(card);
  const health = Math.max(0, Number(card.health ?? 0));
  const weaknesses = getWeaknessSummary(card);
  const slots = getSlotSummary(card);
  const schoolDensity = Math.max(0, Number(card.schoolDensity ?? card.schoolDensityRequirement ?? 0));
  const subject = getCardNarrativeSubject(card);
  const sentenceSubject = capitalizeFirst(subject);
  const cardTemplate = getTutorialCardTemplate(card);
  const showsClassIcon = hasTutorialClassIcon(card);
  const filterFeederUsesIcon = cardTemplate === "filter-feeder" && showsClassIcon;
  const segments = [
    {
      id: `card:${card.id}:name`,
      title: getCardLessonTitle(card),
      message: cardIdentityMessage(card, cardClassLabel),
      focus: "name",
    },
    {
      id: `card:${card.id}:identity`,
      title: cardTemplate === "filter-feeder"
        ? filterFeederUsesIcon
          ? `Find the ${cardClassLabel} icon`
          : `Know the ${cardClassLabel} class`
        : normalizeToken(card.kind) === "coral"
          ? "Read the Reef Coral label"
          : `Read the ${cardClassLabel} label`,
      message: filterFeederUsesIcon
        ? cardClassIconMessage(card, cardClassLabel)
        : cardTypeMessage(card, cardClassLabel),
      focus: filterFeederUsesIcon ? "class-icon" : "type",
    },
  ];

  if (showsClassIcon && cardTemplate !== "filter-feeder") {
    const iconLabel = getTutorialClassIconLabel(card, cardClassLabel);
    segments.push({
      id: `card:${card.id}:class-icon`,
      title: `Match the ${iconLabel} icon`,
      message: cardClassIconMessage(card, cardClassLabel),
      focus: "class-icon",
    });
  }

  segments.push({
      id: `card:${card.id}:cost`,
      title: cost > 0 ? `Play cost: ${cost} RP` : "No RP play cost",
      message: cost > 0
        ? `Playing ${subject} costs ${cost} RP from your bank. Ability costs are separate and appear with the ability that uses them.`
        : `${sentenceSubject} costs 0 RP to play, but every printed requirement must still be met.`,
      focus: "cost",
    });

  const ruleGroups = [
    ["Rules", card.text ? [card.text] : []],
    ["Requirement", asList(card.playRequirements ?? card.requirements)],
    ["Restriction", asList(card.playRestrictions)],
    ["Special Placement", asList(structuredRule(card.specialPlacement, describeSpecialPlacement))],
    ["Special Rule", asList(card.specialRules)],
    ["Removal", asList(structuredRule(card.removalRules, describeRemovalRules))],
    ["Maintenance", asList(card.maintenance)],
    ["Upgrade", card.upgrade?.text ? [card.upgrade] : []],
    ["Passive", asList(card.passives)],
    ["On Play", asList(card.onPlay)],
    ["Action", asList(card.actions)],
  ];
  const ruleEntries = ruleGroups.flatMap(([label, rules]) => (
    rules.map((rule, index) => ({ label, rule, index }))
  ));
  const printedOrder = CARD_RULE_ORDER_OVERRIDES[card.id];
  const rank = new Map((printedOrder ?? []).map((entry, index) => [entry, index]));
  const getRuleOrder = (entry) => {
    const explicitOrder = rank.get(`${entry.label}:${entry.index}`);
    if (explicitOrder != null) return explicitOrder;
    // Stage/Upgrade lives in the printed header, so teach it before moving the
    // pointer down through the card's rule rows.
    if (entry.label === "Upgrade") return -1;
    return Number.MAX_SAFE_INTEGER;
  };
  ruleEntries.sort((left, right) => getRuleOrder(left) - getRuleOrder(right));
  let printedRuleIndex = 0;
  let sharedSpecialRulesBlockAssigned = false;
  ruleEntries.forEach(({ label, rule, index }) => {
    const isUnprintedSupportRestriction = normalizeToken(card.kind) === "support" && label === "Restriction";
    const normalizedRule = toCardReferenceRule(rule, label, index);
    const isDensityRequirement = label === "Requirement"
      && Number(card.schoolDensityRequirement ?? 0) > 0
      && /school density/i.test(normalizedRule?.text ?? "");
    const sharesSpecialRulesBlock = !isDensityRequirement
      && !isUnprintedSupportRestriction
      && ["Requirement", "Restriction", "Special Placement", "Special Rule", "Removal"].includes(label);
    const focus = isDensityRequirement
      ? "density-requirement"
      : label === "Maintenance"
        ? "maintenance"
        : label === "Upgrade"
          ? "identity"
          : isUnprintedSupportRestriction
            ? null
            : sharesSpecialRulesBlock
              ? "rules"
              : printedRuleIndex === 0
                ? "rules"
                : printedRuleIndex === 1
                  ? "rules-secondary"
                  : "rules-tertiary";
    const segment = createRuleSegment(card, rule, label, index, focus);
    if (segment) segments.push(segment);
    const advancesPrintedRule = isDensityRequirement
      ? false
      : sharesSpecialRulesBlock
        ? !sharedSpecialRulesBlockAssigned
        : !isUnprintedSupportRestriction && label !== "Maintenance" && label !== "Upgrade";
    if (sharesSpecialRulesBlock) sharedSpecialRulesBlockAssigned = true;
    if (advancesPrintedRule) printedRuleIndex += 1;
  });

  if (defense) {
    segments.push({
      id: `card:${card.id}:defense`,
      title: `Defense: ${defense}`,
      message: `${defense} is the defense die for ${subject} when an opposing attack legally targets it. The higher final roll wins; a tie goes to the defender.`,
      focus: "defense",
    });
  }
  if (vp > 0) {
    segments.push({
      id: `card:${card.id}:victory-points`,
      title: `Victory Points: ${vp}`,
      message: `${sentenceSubject} contributes ${vp} VP toward your goal while it remains in your ecosystem.`,
      focus: "victory",
    });
  }
  if (health > 0) {
    segments.push({
      id: `card:${card.id}:health`,
      title: `Health: ${health} HP`,
      message: `${sentenceSubject} can take ${health} damage before it is destroyed. Track damage against this printed Health value.`,
      focus: "health",
    });
  }
  if (Object.prototype.hasOwnProperty.call(card, "weaknesses")) {
    segments.push({
      id: `card:${card.id}:weaknesses`,
      title: "Weaknesses",
      message: weaknesses
        ? `${sentenceSubject} has ${weaknesses} printed as a weakness. Conditions and other effects can check these symbols.`
        : `${sentenceSubject} has no printed weakness.`,
      focus: "weaknesses",
    });
  }
  if (slots) {
    segments.push({
      id: `card:${card.id}:slots`,
      title: "Creature homes",
      message: `${sentenceSubject} provides ${slots} slots. Each creature needs an open, compatible home before it can be placed.`,
      focus: "slots",
    });
  }
  if (schoolDensity > 0) {
    const suppliesDensity = Number(card.schoolDensity ?? 0) > 0;
    segments.push({
      id: `card:${card.id}:school-density`,
      title: `School Density: ${schoolDensity}`,
      message: suppliesDensity
        ? `${sentenceSubject} supplies ${schoolDensity} School Density for open-water creatures.`
        : `${sentenceSubject} commits ${schoolDensity} available School Density while it remains in play.`,
      focus: suppliesDensity ? "density-supply" : "density-requirement",
    });
  }
  return segments;
}

function classConcept(card, cardClass) {
  const label = formatToken(cardClass);
  const zone = formatToken(card?.zone);
  const location = zone ? `${zone} tells you where it lives. ` : "";
  const textByClass = {
    fish: `${location}Fish tells you which Coral slot it needs before it can join your reef.`,
    invertebrate: `${location}Invertebrate tells you which Coral slot it needs before it can join your reef.`,
    predator: `${location}Predators are powerful creatures with stricter placement or ecosystem requirements.`,
    "filter-feeder": `${location}Filter Feeders need the listed Habitat and enough open School Density.`,
    apex: `${location}Apex cards are late-game finishers with demanding ecosystem requirements.`,
  };
  return concept(
    `class:${cardClass}`,
    `New class: ${label}`,
    textByClass[cardClass] ?? `${label} identifies this creature's class and the rules that can interact with it.`,
    "type",
  );
}

export function getGuidedAcademyIntroductionStep(step, { guideName = "Mr. Easterling", card } = {}) {
  if (!Number.isInteger(step) || step < 0 || step >= INTRO_STEP_COUNT) return null;
  const cardName = card?.name ?? "Mustard Hill Coral";
  const cost = getCardRp(card) || 2;
  const passive = getCardPassive(card);
  const passiveName = getPassiveName(passive) || "Photosynthesis";
  const passiveText = getPassiveText(passive) || "Collect 2 RP at the start of your turn.";
  const health = Number(card?.health ?? 30);
  const slotSummary = getSlotSummary(card) || "1 Fish and 1 Invertebrate";
  const weaknessSummary = getWeaknessSummary(card);
  const shared = {
    id: `guided-academy-intro-${step}`,
    cueId: `guided-academy-intro-${step}`,
    index: step,
    totalSteps: INTRO_STEP_COUNT,
    progressLabel: `Welcome lesson - ${step + 1}/${INTRO_STEP_COUNT}`,
    referenceMode: "printed",
  };

  if (step === 0) {
    return {
      ...shared,
      title: "Welcome to Sea Realm!",
      message: `Welcome, Reefkeeper. In Sea Realm, you build a living ocean ecosystem one card at a time. ${guideName} will show you how to read your first card, then you will play it together.`,
      cardVisible: false,
      callouts: [
        { title: "Build", text: "Play cards that create a healthy, connected ecosystem." },
        { title: "Manage", text: "Spend and bank Resource Points (RP) for future turns." },
        { title: "Win", text: "Reach the match's Victory Point (VP) goal first." },
      ],
      advanceLabel: "Meet your first card",
    };
  }

  if (step === 1) {
    return {
      ...shared,
      title: "What is a Coral card?",
      message: `This is a Coral card. Coral cards are foundations that stay in Your Reef, produce resources, and provide homes for compatible creatures. Base means this Coral can begin a new foundation. ${cardName} scores no VP itself; its role is to make later cards possible.`,
      cardVisible: true,
      focus: "identity",
      callouts: [
        { title: "Coral foundation", text: "A Base Coral stays in Your Reef and supports the ecosystem you build around it." },
      ],
      advanceLabel: "Find its name",
    };
  }

  if (step === 2) {
    return {
      ...shared,
      title: "Find the card's name",
      message: `The large text at the top is the card's name: ${cardName}. Names matter whenever a rule tells you to find, play, or upgrade a specific card.`,
      cardVisible: true,
      focus: "name",
      callouts: [
        { title: "Card name", text: cardName },
      ],
      advanceLabel: "Check its cost",
    };
  }

  if (step === 3) {
    return {
      ...shared,
      title: "Check the RP cost",
      message: `The top-right number is the cost to play this card. ${cardName} costs ${cost} Resource Points, so your RP bank needs at least ${cost} RP before you can play it.`,
      cardVisible: true,
      focus: "cost",
      callouts: [{ title: "Play cost", text: `${cost} RP` }],
      advanceLabel: "Read its ability",
    };
  }

  if (step === 4) {
    return {
      ...shared,
      title: `Read ${passiveName}`,
      message: `Passive means this ability stays active while the Coral remains in Your Reef. ${passiveName} says: ${passiveText} That steady income helps pay for later cards.`,
      cardVisible: true,
      focus: "rules",
      callouts: [{ title: `Passive - ${passiveName}`, text: passiveText }],
      advanceLabel: "Check its Health",
    };
  }

  if (step === 5) {
    return {
      ...shared,
      title: "Health shows what it can survive",
      message: `${health} HP is how much damage this Coral can take. If its remaining Health reaches zero, the Coral is destroyed and leaves Your Reef.`,
      cardVisible: true,
      focus: "health",
      callouts: [{ title: "Health", text: `${health} HP` }],
      advanceLabel: "Check its Weaknesses",
    };
  }

  if (step === 6) {
    return {
      ...shared,
      title: "Check for Weaknesses",
      message: weaknessSummary
        ? `${weaknessSummary} is printed in the Weaknesses area. Other cards and effects may check that icon.`
        : `This area is blank, so ${cardName} has no printed Weakness. Other Corals may show an icon here, and effects can check that icon.`,
      cardVisible: true,
      focus: "weaknesses",
      callouts: [{ title: "Weaknesses", text: weaknessSummary || "None printed" }],
      advanceLabel: "Read its creature slots",
    };
  }

  return {
    ...shared,
    title: "Slots show what can live here",
    message: `These icons give ${cardName} ${slotSummary} slots. A creature must match an open slot before you can place it on this Coral. That is how Corals turn empty reef space into a living ecosystem.`,
    cardVisible: true,
    focus: "slots",
    callouts: [{ title: "Creature slots", text: slotSummary }],
    advanceLabel: "Start the board tour",
  };
}

export function getNextGuidedAcademyIntroductionStep(step) {
  if (!Number.isInteger(step) || step < 0 || step >= INTRO_STEP_COUNT - 1) return null;
  return step + 1;
}

export function createGuidedFoundationCardLesson(card) {
  if (!card?.id || normalizeToken(card.kind) !== "coral" || Number(card.stage ?? 0) !== 0) return null;
  const cost = getCardRp(card);
  const passive = getCardPassive(card);
  const passiveName = getPassiveName(passive) || "Passive";
  const passiveText = getPassiveText(passive) || "Read the printed ability for its ongoing effect.";
  const health = Number(card.health ?? 0);
  const weaknessSummary = getWeaknessSummary(card) || "None printed";
  const slotSummary = getSlotSummary(card) || "No creature slots";

  return {
    id: `guided-foundation-card-lesson:${card.id}`,
    cueId: `guided-foundation-card-lesson:${card.id}`,
    cardId: card.id,
    conceptKeys: [...GUIDED_ACADEMY_INTRO_BASELINE_CONCEPT_KEYS],
    title: `How to read ${card.name}`,
    eyebrow: "Foundation card tour",
    referenceMode: "printed",
    message: `Read each highlighted part of ${card.name}, then place it in your ecosystem.`,
    segments: [
      {
        id: "foundation-introduction",
        title: "Corals are foundations for life",
        message: `In the ocean, there are many corals! They are one of the foundations for life in the sea. In Sea Realm, Corals generate Resource Points (RP) and provide homes for sea creatures. Let’s dive into an example with this ${card.name}!`,
      },
      {
        id: "foundation-identity",
        title: "Base begins a Foundation",
        message: "Base means this Coral can begin a new Foundation branch in your ecosystem. Later Stage cards upgrade that same Coral.",
        focus: "identity",
      },
      {
        id: "card-name",
        title: "Find the card's name",
        message: `The large text at the top is the card's name: ${card.name}. Card names matter whenever another rule tells you what to find, play, or upgrade.`,
        focus: "name",
      },
      {
        id: "reef-coral-type-icon",
        title: "Match the Reef Coral icon",
        message: `The Coral icon in the top-right matches the Reef Coral label beneath the header. When a rule refers to a Reef Coral, this symbol shows that ${card.name} qualifies.`,
        focus: "class-icon",
      },
      {
        id: "play-cost",
        title: "Check the RP cost",
        message: `The top-right number is the play cost. ${card.name} costs ${cost} RP, which comes out of your RP bank when you place it in your ecosystem.`,
        focus: "cost",
      },
      {
        id: "passive-ability",
        title: `Read ${passiveName}`,
        message: `Passive means this ability stays active while the Coral remains in your ecosystem. ${passiveName} says: ${passiveText}`,
        focus: "rules",
      },
      {
        id: "health",
        title: "Health shows what it can survive",
        message: `${health} HP is how much damage this Coral can take. If its remaining Health reaches zero, it is destroyed and leaves your ecosystem.`,
        focus: "health",
      },
      {
        id: "weaknesses",
        title: "Conditions can check Weaknesses",
        message: `${weaknessSummary} is printed in the Weaknesses area. When a round's Condition matches a Coral's weakness, that Coral stays in play but may lose its RP production for that round.`,
        focus: "weaknesses",
      },
      {
        id: "creature-slots",
        title: "Slots show what can live here",
        message: `The printed icons give ${card.name} ${slotSummary} slots. Each icon is one home, and a creature must match an open slot before you can place it on this Coral.`,
        focus: "slots",
      },
    ],
    advanceLabel: "Place Brain Coral",
  };
}

export function getTutorialCardConcepts(card) {
  if (!card?.id) return [];
  const concepts = [];
  const kind = normalizeToken(card.kind || (card.class ? "creature" : ""));
  const tags = asList(card.tags).map(normalizeToken);
  const cardClass = normalizeToken(card.category ?? card.class);
  const stage = Number(card.stage ?? 0);
  const passives = asList(card.passives);
  const onPlay = asList(card.onPlay);
  const actions = asList(card.actions);
  const playRequirements = asList(card.playRequirements ?? card.requirements);
  const vp = getCardVp(card);
  const defense = getCardDefense(card);

  if (kind === "support") {
    concepts.push(concept(
      "kind:support",
      "New card type: Support",
      "Support cards resolve once from your hand, then move to the Discard pile. They never take a space in Your Reef.",
      "type",
    ));
  } else if (kind === "habitat") {
    concepts.push(concept(
      "kind:habitat",
      "New card type: Habitat",
      "Habitats describe the environment your ecosystem has built. They stay in play and can unlock creatures with Habitat requirements.",
      "type",
    ));
  } else if (kind === "creature") {
    concepts.push(concept(
      "kind:creature",
      "New card type: Creature",
      "Creatures stay in play, add VP, and use their class or zone to find a legal place in your ecosystem.",
      "type",
    ));
  } else if (kind === "coral" && stage > 0) {
    concepts.push(concept(
      "stage:coral-upgrade",
      "New Coral stage: Upgrade",
      "An upgraded Coral replaces the matching earlier stage in the same position. Read its new cost, HP, slots, and abilities before upgrading.",
      "type",
    ));
  }

  if (kind === "creature" && cardClass) concepts.push(classConcept(card, cardClass));

  if (tags.includes("creature-school")) {
    concepts.push(concept(
      "structure:creature-school",
      "New structure: Creature School",
      "A Creature School is a foundation, not a creature for a Coral slot. Its School Density supports larger open-water animals.",
      "type",
    ));
  }

  const toxicPassive = passives.find((passive) => {
    const identity = typeof passive === "string" ? passive : `${passive?.id ?? ""} ${passive?.name ?? ""}`;
    return normalizeToken(identity).includes("toxic");
  });
  if (toxicPassive) {
    concepts.push(concept(
      "mechanic:toxic",
      "New Passive: Toxic",
      `Toxic stays active while this creature is in your reef. ${getPassiveText(toxicPassive)} It protects the creature when something tries to eat it; Crunch is a separate paid attack you choose to use.`,
      "rules",
    ));
  }

  if (onPlay.length) {
    concepts.push(concept(
      "label:on-play",
      "New label: On Play",
      "An On Play ability resolves immediately after the card enters play. Finish that sequence before taking another action.",
      "rules",
    ));
  }
  if (actions.length) {
    concepts.push(concept(
      "label:action",
      "New label: Action",
      "An Action is optional during your action phase. Read its own RP cost and target before choosing it.",
      "rules",
    ));
  }
  if (containsAttack([...onPlay, ...actions])) {
    concepts.push(concept(
      "label:attack",
      "New action: Attack",
      "An Attack names its legal target and attack die. Compare the attack result with the defender's die to resolve it.",
      "rules",
    ));
  }
  if (playRequirements.length) {
    concepts.push(concept(
      "label:play-requirements",
      "Check Play Requirements",
      "Requirements must already be true before you can pay for and place this card.",
      "rules",
    ));
  }
  if (Number(card.schoolDensity ?? 0) > 0 || Number(card.schoolDensityRequirement ?? 0) > 0) {
    const suppliesDensity = Number(card.schoolDensity ?? 0) > 0;
    concepts.push(concept(
      "mechanic:school-density",
      "New resource: School Density",
      suppliesDensity
        ? "This foundation supplies School Density for larger open-water creatures."
        : "This creature commits the printed amount of open School Density while it remains in play.",
      suppliesDensity ? "density-supply" : "density-requirement",
    ));
  }
  if (defense) {
    concepts.push(concept(
      "stat:defense",
      "Defense die",
      `${defense} is this card's defense die when an opposing attack targets it.`,
      "defense",
    ));
  }
  if (vp > 0) {
    concepts.push(concept(
      "stat:victory-points",
      "Victory Points",
      `${vp} VP counts toward your match goal while this card remains in your ecosystem.`,
      "victory",
    ));
  }

  return concepts.filter((entry, index, list) => (
    list.findIndex((candidate) => candidate.key === entry.key) === index
  ));
}

export function createGuidedAcademyCardLesson(card, {
  seenConceptKeys = [],
  seenCardIds = [],
  cardClassLabel = "Card",
  introductionOnly = false,
} = {}) {
  if (!card?.id || seenCardIds.includes(card.id)) return null;
  const seen = new Set(seenConceptKeys);
  const callouts = getTutorialCardConcepts(card).filter((entry) => !seen.has(entry.key));
  const detailedSegments = getCardSpecificLessonSegments(card, cardClassLabel);
  const segments = introductionOnly ? detailedSegments.slice(0, 1) : detailedSegments;
  const subject = getCardNarrativeSubject(card);
  return {
    id: `guided-academy-card-lesson:${card.id}`,
    cueId: `guided-academy-card-lesson:${card.id}`,
    cardId: card.id,
    conceptKeys: introductionOnly ? [] : callouts.map((entry) => entry.key),
    title: getCardLessonTitle(card),
    eyebrow: "New card lesson",
    cardClassLabel,
    referenceMode: "printed",
    message: `Before you use ${subject}, read its gameplay type, cost, abilities, and stats. You will return to the same tutorial step when you finish.`,
    callouts,
    segments,
    advanceLabel: introductionOnly ? "Continue to placement" : `Continue with ${subject}`,
  };
}

export function mergeTutorialSeenConcepts(seenConceptKeys = [], addedConceptKeys = []) {
  return [...new Set([...seenConceptKeys, ...addedConceptKeys])];
}

export function mergeTutorialSeenCardIds(seenCardIds = [], addedCardIds = []) {
  return [...new Set([...seenCardIds, ...addedCardIds].filter(Boolean))];
}

export function getNewTutorialHandCardIds(
  previousHand = [],
  nextHand = [],
  { seenCardIds = [], pendingCardIds = [] } = {},
) {
  const previousCounts = new Map();
  previousHand.forEach((cardId) => previousCounts.set(cardId, (previousCounts.get(cardId) ?? 0) + 1));
  const nextCounts = new Map();
  const excluded = new Set([...seenCardIds, ...pendingCardIds]);
  const additions = [];
  nextHand.forEach((cardId) => {
    const occurrence = (nextCounts.get(cardId) ?? 0) + 1;
    nextCounts.set(cardId, occurrence);
    if (occurrence <= (previousCounts.get(cardId) ?? 0) || excluded.has(cardId)) return;
    excluded.add(cardId);
    additions.push(cardId);
  });
  return additions;
}
