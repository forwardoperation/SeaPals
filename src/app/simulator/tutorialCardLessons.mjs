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

const INTRO_STEP_COUNT = 4;

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

function concept(key, title, text) {
  return { key, title, text };
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
  const weaknessSummary = getWeaknessSummary(card) || "printed Weakness";
  const shared = {
    id: `guided-academy-intro-${step}`,
    cueId: `guided-academy-intro-${step}`,
    index: step,
    totalSteps: INTRO_STEP_COUNT,
    progressLabel: `Welcome lesson - ${step + 1}/${INTRO_STEP_COUNT}`,
  };

  if (step === 0) {
    return {
      ...shared,
      title: "Welcome to Sea Realm!",
      message: `Welcome, Reefkeeper. In Sea Realm, you build a living ocean ecosystem one card at a time. Grow a reef whose cards support one another, manage your Resource Points, and be the first to reach the Victory Point goal. ${guideName} will teach you as you play.`,
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
      title: `Meet ${cardName}`,
      message: `This is a Base Coral - a foundation for your reef. It costs ${cost} RP to play. Its ${passiveName} produces RP, and its slot icons show which creatures it can support.`,
      cardVisible: true,
      focus: "identity",
      callouts: [
        { title: "Identity", text: `${cardName} - Base Coral` },
        { title: "Cost", text: `${cost} RP to play` },
        { title: "Species profile", text: "The artwork and species details connect the game rules to a real ocean organism." },
        { title: "Role", text: "Starts the foundation of Your Reef" },
      ],
      advanceLabel: "Learn to read it",
    };
  }

  if (step === 2) {
    return {
      ...shared,
      title: "Read the rules box",
      message: `Ability labels tell you how a rule behaves. ${passiveName} is a Passive, so it stays active while this Coral is in play. Its timing tells you exactly when it happens.`,
      cardVisible: true,
      focus: "rules",
      callouts: [
        { title: `Passive - ${passiveName}`, text: passiveText },
        { title: "Timing", text: "Resolve the ability at the time printed on the card." },
        { title: "Later cards", text: "New labels such as On Play, Action, and Attack will be explained when they first matter." },
      ],
      advanceLabel: "Read its board role",
    };
  }

  return {
    ...shared,
    title: "See what it supports",
    message: `At the bottom of the card, ${health} HP tells you how much damage the Coral can take. Its ${slotSummary} slots show the creatures it can support, and ${weaknessSummary} identifies an interaction other cards may check. This economy-first Coral has no VP, but it helps make later plays possible.`,
    cardVisible: true,
    focus: "fit",
    callouts: [
      { title: "Health", text: `${health} HP` },
      { title: "Creature slots", text: slotSummary },
      { title: "Weakness", text: `${weaknessSummary} - other rules may check this icon.` },
      { title: "Victory Points", text: "0 VP - this card builds your economy instead." },
    ],
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
  const onPlay = asList(card.onPlay);
  const actions = asList(card.actions);
  const playRequirements = asList(card.playRequirements);
  const vp = getCardVp(card);
  const defense = getCardDefense(card);

  if (kind === "support") {
    concepts.push(concept(
      "kind:support",
      "New card type: Support",
      "Support cards resolve once from your hand, then move to the Discard pile. They never take a space in Your Reef.",
    ));
  } else if (kind === "habitat") {
    concepts.push(concept(
      "kind:habitat",
      "New card type: Habitat",
      "Habitats describe the environment your ecosystem has built. They stay in play and can unlock creatures with Habitat requirements.",
    ));
  } else if (kind === "creature") {
    concepts.push(concept(
      "kind:creature",
      "New card type: Creature",
      "Creatures stay in play, add VP, and use their class or zone to find a legal place in your ecosystem.",
    ));
  } else if (kind === "coral" && stage > 0) {
    concepts.push(concept(
      "stage:coral-upgrade",
      "New Coral stage: Upgrade",
      "An upgraded Coral replaces the matching earlier stage in the same position. Read its new cost, HP, slots, and abilities before upgrading.",
    ));
  }

  if (kind === "creature" && cardClass) concepts.push(classConcept(card, cardClass));

  if (tags.includes("creature-school")) {
    concepts.push(concept(
      "structure:creature-school",
      "New structure: Creature School",
      "A Creature School is a foundation, not a creature for a Coral slot. Its School Density supports larger open-water animals.",
    ));
  }

  if (onPlay.length) {
    concepts.push(concept(
      "label:on-play",
      "New label: On Play",
      "An On Play ability resolves immediately after the card enters play. Finish that sequence before taking another action.",
    ));
  }
  if (actions.length) {
    concepts.push(concept(
      "label:action",
      "New label: Action",
      "An Action is optional during your action phase. Read its own RP cost and target before choosing it.",
    ));
  }
  if (containsAttack([...onPlay, ...actions])) {
    concepts.push(concept(
      "label:attack",
      "New action: Attack",
      "An Attack names its legal target and attack die. Compare the attack result with the defender's die to resolve it.",
    ));
  }
  if (playRequirements.length) {
    concepts.push(concept(
      "label:play-requirements",
      "Check Play Requirements",
      "Requirements must already be true before you can pay for and place this card.",
    ));
  }
  if (Number(card.schoolDensity ?? 0) > 0 || Number(card.schoolDensityRequirement ?? 0) > 0) {
    concepts.push(concept(
      "mechanic:school-density",
      "New resource: School Density",
      Number(card.schoolDensity ?? 0) > 0
        ? "This foundation supplies School Density for larger open-water creatures."
        : "This creature commits the printed amount of open School Density while it remains in play.",
    ));
  }
  if (defense) {
    concepts.push(concept(
      "stat:defense",
      "Defense die",
      `${defense} is this card's defense die when an opposing attack targets it.`,
    ));
  }
  if (vp > 0) {
    concepts.push(concept(
      "stat:victory-points",
      "Victory Points",
      `${vp} VP counts toward your match goal while this card remains in your ecosystem.`,
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
    message: `Before you use ${card.name}, read the parts this card introduces. You will return to the highlighted tutorial action when you continue.`,
    callouts,
    advanceLabel: `Continue with ${card.name}`,
  };
}

export function mergeTutorialSeenConcepts(seenConceptKeys = [], addedConceptKeys = []) {
  return [...new Set([...seenConceptKeys, ...addedConceptKeys])];
}
