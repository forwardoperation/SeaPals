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
    identity: freezeRegion({ x: 9, y: 7, width: 357, height: 55, tailX: 118, tailY: 104, tipX: 118, tipY: 62, direction: "up" }),
    name: freezeRegion({ x: 82, y: 8, width: 203, height: 34, tailX: 190, tailY: 84, tipX: 190, tipY: 42, direction: "up" }),
    cost: freezeRegion({ x: 284, y: 7, width: 79, height: 36, tailX: 324, tailY: 83, tipX: 324, tipY: 43, direction: "up" }),
    rules: freezeRegion({ x: 10, y: 273, width: 355, height: 47, tailX: 330, tailY: 235, tipX: 330, tipY: 273, direction: "down" }),
    health: freezeRegion({ x: 10, y: 465, width: 104, height: 37, tailX: 64, tailY: 425, tipX: 64, tipY: 465, direction: "down" }),
    weaknesses: freezeRegion({ x: 110, y: 465, width: 158, height: 37, tailX: 190, tailY: 425, tipX: 190, tipY: 465, direction: "down" }),
    slots: freezeRegion({ x: 268, y: 422, width: 98, height: 78, tailX: 318, tailY: 382, tipX: 318, tipY: 422, direction: "down" }),
    stats: freezeRegion({ x: 10, y: 422, width: 356, height: 80, tailX: 188, tailY: 382, tipX: 188, tipY: 422, direction: "down" }),
  }),
  normalized: Object.freeze({
    type: freezeRegion({ x: 16, y: 12, width: 116, height: 18, tailX: 170, tailY: 21, tipX: 132, tipY: 21, direction: "left" }),
    identity: freezeRegion({ x: 12, y: 10, width: 351, height: 70, tailX: 118, tailY: 120, tipX: 118, tipY: 80, direction: "up" }),
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

export function getTutorialCardReferenceRules(card) {
  if (!card) return [];
  return [
    ...(card.text ? [{ key: "card-text", label: "Rules", name: "", text: card.text }] : []),
    ...asList(card.playRequirements ?? card.requirements).map((rule, index) => toCardReferenceRule(rule, "Requirement", index)),
    ...asList(card.passives).map((rule, index) => toCardReferenceRule(rule, "Passive", index)),
    ...asList(card.onPlay).map((rule, index) => toCardReferenceRule(rule, "On Play", index)),
    ...asList(card.actions).map((rule, index) => toCardReferenceRule(rule, "Action", index)),
  ].filter(Boolean);
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
        message: `In the ocean, there are many corals. They are one of the foundations for life in the sea. In Sea Realm, Corals generate Resource Points (RP) and provide homes for sea creatures. Let’s walk through an example with this ${card.name}.`,
      },
      {
        id: "foundation-identity",
        title: "Start with the Foundation header",
        message: "The header identifies this as a Base Coral Foundation. Base Corals can begin a new branch of your ecosystem; later Stage cards upgrade that same Coral.",
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
  cardClassLabel = "Card",
} = {}) {
  if (!card?.id || card.id === GUIDED_ACADEMY_INTRO_CARD_ID) return null;
  const seen = new Set(seenConceptKeys);
  const callouts = getTutorialCardConcepts(card).filter((entry) => !seen.has(entry.key));
  if (!callouts.length) return null;
  return {
    id: `guided-academy-card-lesson:${card.id}`,
    cueId: `guided-academy-card-lesson:${card.id}:${callouts.map((entry) => entry.key).join("|")}`,
    cardId: card.id,
    conceptKeys: callouts.map((entry) => entry.key),
    title: `Meet ${card.name}`,
    eyebrow: "New card lesson",
    cardClassLabel,
    referenceMode: "normalized",
    message: `Before you use ${card.name}, read the parts this card introduces. You will return to the highlighted tutorial action when you continue.`,
    callouts,
    segments: callouts.map((entry) => ({
      id: entry.key,
      title: entry.title,
      message: entry.text,
      focus: entry.focus,
    })),
    advanceLabel: `Continue with ${card.name}`,
  };
}

export function mergeTutorialSeenConcepts(seenConceptKeys = [], addedConceptKeys = []) {
  return [...new Set([...seenConceptKeys, ...addedConceptKeys])];
}
