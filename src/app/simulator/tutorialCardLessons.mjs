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
  printed: Object.freeze({
    type: freezeRegion({ x: 11, y: 42, width: 94, height: 20, tailX: 140, tailY: 52, tipX: 105, tipY: 52, direction: "left" }),
    identity: freezeRegion({ x: 9, y: 7, width: 73, height: 38, tailX: 45, tailY: 85, tipX: 45, tipY: 45, direction: "up" }),
    name: freezeRegion({ x: 82, y: 8, width: 203, height: 34, tailX: 190, tailY: 84, tipX: 190, tipY: 42, direction: "up" }),
    cost: freezeRegion({ x: 284, y: 7, width: 79, height: 36, tailX: 324, tailY: 83, tipX: 324, tipY: 43, direction: "up" }),
    rules: freezeRegion({ x: 10, y: 273, width: 355, height: 47, tailX: 45, tailY: 233, tipX: 45, tipY: 273, direction: "down" }),
    health: freezeRegion({ x: 10, y: 465, width: 104, height: 37, tailX: 64, tailY: 425, tipX: 64, tipY: 465, direction: "down" }),
    weaknesses: freezeRegion({ x: 110, y: 465, width: 158, height: 37, tailX: 190, tailY: 425, tipX: 190, tipY: 465, direction: "down" }),
    slots: freezeRegion({ x: 268, y: 422, width: 98, height: 78, tailX: 318, tailY: 382, tipX: 318, tipY: 422, direction: "down" }),
    stats: freezeRegion({ x: 10, y: 422, width: 356, height: 80, tailX: 188, tailY: 382, tipX: 188, tipY: 422, direction: "down" }),
  }),
  normalized: Object.freeze({
    type: freezeRegion({ x: 16, y: 12, width: 116, height: 18, tailX: 170, tailY: 21, tipX: 132, tipY: 21, direction: "left" }),
    identity: freezeRegion({ x: 16, y: 12, width: 116, height: 18, tailX: 58, tailY: 70, tipX: 58, tipY: 30, direction: "up" }),
    name: freezeRegion({ x: 16, y: 34, width: 250, height: 34, tailX: 154, tailY: 108, tipX: 154, tipY: 68, direction: "up" }),
    cost: freezeRegion({ x: 285, y: 16, width: 74, height: 42, tailX: 320, tailY: 98, tipX: 320, tipY: 58, direction: "up" }),
    rules: freezeRegion({ x: 16, y: 280, width: 343, height: 168, tailX: 330, tailY: 240, tipX: 330, tipY: 280, direction: "down" }),
    health: freezeRegion({ x: 16, y: 460, width: 105, height: 50, tailX: 56, tailY: 420, tipX: 56, tipY: 460, direction: "down" }),
    weaknesses: freezeRegion({ x: 126, y: 460, width: 125, height: 50, tailX: 190, tailY: 420, tipX: 190, tipY: 460, direction: "down" }),
    slots: freezeRegion({ x: 256, y: 460, width: 103, height: 50, tailX: 316, tailY: 420, tipX: 316, tipY: 460, direction: "down" }),
    stats: freezeRegion({ x: 16, y: 460, width: 343, height: 50, tailX: 188, tailY: 420, tipX: 188, tipY: 460, direction: "down" }),
  }),
});

export function getTutorialCardFocusRegion(focus, { referenceMode = "printed" } = {}) {
  if (!focus) return null;
  return TUTORIAL_CARD_FOCUS_REGIONS[referenceMode]?.[focus] ?? null;
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

function cardIdentityMessage(card, cardClassLabel) {
  const kind = normalizeToken(card.kind);
  const isSchool = asList(card.tags).map(normalizeToken).includes("creature-school");
  if (isSchool) {
    return `${card.name} is a ${cardClassLabel}. Creature Schools are Foundations that supply School Density; they do not use a Coral's creature slot.`;
  }
  if (kind === "creature") {
    return `${card.name} is a ${cardClassLabel}. Its zone and class determine which open slot can house it and which rules can target it.`;
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

function createRuleSegment(card, rule, label, index) {
  const normalized = toCardReferenceRule(rule, label, index);
  if (!normalized) return null;
  const cost = getRuleCost(rule);
  const attackSummary = getAttackRuleSummary(rule);
  const name = normalized.name || label;
  const timingCopy = label === "Passive"
    ? `${name} is a Passive, so it stays active while ${card.name} remains in your ecosystem.`
    : label === "On Play"
      ? `${name} is an On Play ability, so it resolves immediately after ${card.name} enters play.`
      : label === "Action"
        ? `${name} is an Action you choose during your turn.${cost > 0 ? ` It costs ${cost} RP to use.` : ""}`
        : label === "Requirement"
          ? `This requirement must be true before you can play ${card.name}.`
          : label === "Restriction"
            ? `This restriction limits when or how ${card.name} can be played.`
            : label === "Maintenance"
              ? `Maintenance is checked after ${card.name} enters your ecosystem.`
              : label === "Upgrade"
                ? `${cost > 0 ? `This upgrade costs ${cost} RP. ` : ""}This tells you the next stage available from ${card.name}.`
                : label === "Special Placement"
                  ? `This card uses a special placement rule instead of ordinary slot placement.`
                  : label === "Removal"
                    ? `This explains how ${card.name} can be removed from play.`
                    : label === "Rules"
                      ? `This printed rule explains what ${card.name} does.`
                      : `Read this ${label.toLowerCase()} before using ${card.name}.`;
  return {
    id: `card:${card.id}:${normalizeToken(label)}:${normalizeToken(normalized.key)}`,
    title: normalized.name ? `${label}: ${normalized.name}` : label,
    message: [timingCopy, normalized.text, attackSummary].filter(Boolean).join(" "),
    focus: "rules",
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
  const segments = [
    {
      id: `card:${card.id}:identity`,
      title: `Meet ${card.name}`,
      message: cardIdentityMessage(card, cardClassLabel),
      focus: "type",
    },
    {
      id: `card:${card.id}:cost`,
      title: cost > 0 ? `Play cost: ${cost} RP` : "No RP play cost",
      message: cost > 0
        ? `Playing ${card.name} costs ${cost} RP from your bank. Ability costs are separate and appear with the ability that uses them.`
        : `${card.name} costs 0 RP to play, but every printed requirement must still be met.`,
      focus: "cost",
    },
  ];

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
  ruleGroups.forEach(([label, rules]) => {
    rules.forEach((rule, index) => {
      const segment = createRuleSegment(card, rule, label, index);
      if (segment) segments.push(segment);
    });
  });

  if (defense) {
    segments.push({
      id: `card:${card.id}:defense`,
      title: `Defense: ${defense}`,
      message: `${defense} is ${card.name}'s defense die when an opposing attack legally targets it. The higher final roll wins; a tie goes to the defender.`,
      focus: "stats",
    });
  }
  if (vp > 0) {
    segments.push({
      id: `card:${card.id}:victory-points`,
      title: `Victory Points: ${vp}`,
      message: `${card.name} contributes ${vp} VP toward your goal while it remains in your ecosystem.`,
      focus: "stats",
    });
  }
  if (health > 0) {
    segments.push({
      id: `card:${card.id}:health`,
      title: `Health: ${health} HP`,
      message: `${card.name} can take ${health} damage before it is destroyed. Track damage against this printed Health value.`,
      focus: "health",
    });
  }
  if (Object.prototype.hasOwnProperty.call(card, "weaknesses")) {
    segments.push({
      id: `card:${card.id}:weaknesses`,
      title: "Weaknesses",
      message: weaknesses
        ? `${card.name} has ${weaknesses} printed as a weakness. Conditions and other effects can check these symbols.`
        : `${card.name} has no printed weakness.`,
      focus: "weaknesses",
    });
  }
  if (slots) {
    segments.push({
      id: `card:${card.id}:slots`,
      title: "Creature homes",
      message: `${card.name} provides ${slots} slots. Each creature needs an open, compatible home before it can be placed.`,
      focus: "slots",
    });
  }
  if (schoolDensity > 0) {
    const suppliesDensity = Number(card.schoolDensity ?? 0) > 0;
    segments.push({
      id: `card:${card.id}:school-density`,
      title: `School Density: ${schoolDensity}`,
      message: suppliesDensity
        ? `${card.name} supplies ${schoolDensity} School Density for open-water creatures.`
        : `${card.name} commits ${schoolDensity} available School Density while it remains in play.`,
      focus: "stats",
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
      focus: "type",
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
    concepts.push(concept(
      "mechanic:school-density",
      "New resource: School Density",
      Number(card.schoolDensity ?? 0) > 0
        ? "This foundation supplies School Density for larger open-water creatures."
        : "This creature commits the printed amount of open School Density while it remains in play.",
      "stats",
    ));
  }
  if (defense) {
    concepts.push(concept(
      "stat:defense",
      "Defense die",
      `${defense} is this card's defense die when an opposing attack targets it.`,
      "stats",
    ));
  }
  if (vp > 0) {
    concepts.push(concept(
      "stat:victory-points",
      "Victory Points",
      `${vp} VP counts toward your match goal while this card remains in your ecosystem.`,
      "stats",
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
} = {}) {
  if (!card?.id || seenCardIds.includes(card.id)) return null;
  const seen = new Set(seenConceptKeys);
  const callouts = getTutorialCardConcepts(card).filter((entry) => !seen.has(entry.key));
  const segments = getCardSpecificLessonSegments(card, cardClassLabel);
  return {
    id: `guided-academy-card-lesson:${card.id}`,
    cueId: `guided-academy-card-lesson:${card.id}`,
    cardId: card.id,
    conceptKeys: callouts.map((entry) => entry.key),
    title: `Meet ${card.name}`,
    eyebrow: "New card lesson",
    cardClassLabel,
    referenceMode: "normalized",
    message: `Before you use ${card.name}, read its gameplay type, cost, abilities, and stats. You will return to the same tutorial step when you finish.`,
    callouts,
    segments,
    advanceLabel: `Continue with ${card.name}`,
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
