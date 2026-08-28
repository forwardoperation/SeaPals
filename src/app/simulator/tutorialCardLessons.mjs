export const GUIDED_ACADEMY_INTRO_CARD_ID = "mustard-hill-coral-base";

export const GUIDED_ACADEMY_INTRO_BASELINE_CONCEPT_KEYS = Object.freeze([
  "kind:coral",
  "stage:base-coral",
  "label:cost",
  "label:species-profile",
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
    type: freezeRegion({ x: 11, y: 42, width: 94, height: 20, path: "M122 125 C112 101 108 80 108 68", targetX: 108, targetY: 68 }),
    identity: freezeRegion({ x: 9, y: 7, width: 357, height: 55, path: "M188 126 C188 99 188 79 188 68", targetX: 188, targetY: 68 }),
    name: freezeRegion({ x: 82, y: 8, width: 203, height: 34, path: "M188 126 C188 99 188 72 188 48", targetX: 188, targetY: 48 }),
    cost: freezeRegion({ x: 284, y: 7, width: 79, height: 36, path: "M300 116 C315 91 320 68 320 49", targetX: 320, targetY: 49 }),
    species: freezeRegion({ x: 16, y: 232, width: 343, height: 31, path: "M300 190 C258 205 219 219 188 226", targetX: 188, targetY: 226 }),
    rules: freezeRegion({ x: 10, y: 273, width: 355, height: 47, path: "M292 235 C250 246 202 257 155 267", targetX: 155, targetY: 267 }),
    health: freezeRegion({ x: 10, y: 465, width: 104, height: 37, path: "M90 410 C76 430 63 446 55 459", targetX: 55, targetY: 459 }),
    weaknesses: freezeRegion({ x: 110, y: 465, width: 158, height: 37, path: "M190 410 C190 434 190 448 190 459", targetX: 190, targetY: 459 }),
    slots: freezeRegion({ x: 268, y: 422, width: 98, height: 78, path: "M245 390 C278 404 302 410 316 416", targetX: 316, targetY: 416 }),
    stats: freezeRegion({ x: 10, y: 422, width: 356, height: 80, path: "M188 386 C188 397 188 408 188 416", targetX: 188, targetY: 416 }),
  }),
  normalized: Object.freeze({
    type: freezeRegion({ x: 16, y: 12, width: 116, height: 18, path: "M170 115 C190 82 176 44 138 21", targetX: 138, targetY: 21 }),
    identity: freezeRegion({ x: 12, y: 10, width: 351, height: 70, path: "M188 145 C188 122 188 100 188 86", targetX: 188, targetY: 86 }),
    name: freezeRegion({ x: 16, y: 34, width: 250, height: 34, path: "M188 145 C188 118 170 93 154 74", targetX: 154, targetY: 74 }),
    cost: freezeRegion({ x: 285, y: 16, width: 74, height: 42, path: "M300 140 C315 112 320 86 320 64", targetX: 320, targetY: 64 }),
    species: freezeRegion({ x: 16, y: 88, width: 343, height: 180, path: "M300 310 C258 296 218 286 188 274", targetX: 188, targetY: 274 }),
    rules: freezeRegion({ x: 16, y: 280, width: 343, height: 168, path: "M365 245 C330 254 310 264 292 274", targetX: 292, targetY: 274 }),
    health: freezeRegion({ x: 16, y: 460, width: 105, height: 50, path: "M90 420 C75 436 62 445 56 454", targetX: 56, targetY: 454 }),
    weaknesses: freezeRegion({ x: 126, y: 460, width: 125, height: 50, path: "M190 420 C190 436 190 445 190 454", targetX: 190, targetY: 454 }),
    slots: freezeRegion({ x: 256, y: 460, width: 103, height: 50, path: "M245 420 C278 435 302 445 316 454", targetX: 316, targetY: 454 }),
    stats: freezeRegion({ x: 16, y: 460, width: 343, height: 50, path: "M188 410 C188 429 188 443 188 454", targetX: 188, targetY: 454 }),
  }),
});

export function getTutorialCardFocusRegion(focus, { referenceMode = "printed" } = {}) {
  if (!focus) return null;
  return TUTORIAL_CARD_FOCUS_REGIONS[referenceMode]?.[focus] ?? null;
}

const INTRO_STEP_COUNT = 9;

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
      message: `A card is one playable game piece. This is a Coral card. Real corals are colonies of tiny animals that build reef habitat; in Sea Realm, Coral cards are foundations that stay in Your Reef, produce resources, and provide homes for compatible creatures. Base means this Coral can begin a new foundation. ${cardName} scores no VP itself; its role is to make later cards possible.`,
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
      advanceLabel: "Meet the real coral",
    };
  }

  if (step === 4) {
    return {
      ...shared,
      title: "Meet the real coral",
      message: "The picture and species strip identify the real organism - its Coral group, size, weight, and region. These facts connect the game to ocean science; they affect play only when a rule specifically refers to them.",
      cardVisible: true,
      focus: "species",
      callouts: [{ title: "Species profile", text: "Stony Coral - 8 inches - 4 pounds - Caribbean" }],
      advanceLabel: "Read its ability",
    };
  }

  if (step === 5) {
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

  if (step === 6) {
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

  if (step === 7) {
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
