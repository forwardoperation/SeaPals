function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function sentence(value) {
  const text = cleanText(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function titleCase(value) {
  return String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slug(value) {
  return String(value ?? "rule")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function numericValue(value) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    for (const key of ["rp", "value", "amount"]) {
      if (typeof value[key] === "number") return value[key];
    }
  }
  return null;
}

function diceValue(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  return cleanText(value.dice ?? value.value ?? value.expression);
}

function collectPrintedText(value, output = []) {
  if (!value) return output;
  if (typeof value === "string") {
    const text = cleanText(value);
    if (text) output.push(text);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectPrintedText(item, output));
    return output;
  }
  if (typeof value !== "object") return output;

  const name = cleanText(value.name);
  const text = cleanText(value.text ?? value.description);
  if (text) output.push(name && !text.toLowerCase().startsWith(name.toLowerCase()) ? `${name}: ${text}` : text);
  return output;
}

export function getCardDisplayName(card) {
  const name = cleanText(card?.name) || "Unnamed card";
  const subtitle = cleanText(card?.subtitle);
  const stage = cleanText(card?.stageLabel);
  if (subtitle && !name.toLowerCase().includes(subtitle.toLowerCase())) return `${subtitle} ${name}`;
  if (stage) return `${name} — ${stage}`;
  return name;
}

export function getCardAliases(card) {
  const aliases = new Set([
    cleanText(card?.name),
    getCardDisplayName(card),
    cleanText(card?.bio?.commonName),
    cleanText(card?.id).replace(/-/g, " "),
  ]);
  if (card?.subtitle) {
    aliases.add(`${cleanText(card.subtitle)} ${cleanText(card.name)}`);
    aliases.add(`${cleanText(card.name)} ${cleanText(card.subtitle)}`);
  }
  if (card?.stageLabel) aliases.add(`${cleanText(card.name)} ${cleanText(card.stageLabel)}`);
  return [...aliases].filter(Boolean);
}

export function describeCard(card) {
  const displayName = getCardDisplayName(card);
  const kind = titleCase(card?.kind ?? "card");
  const category = titleCase(card?.category);
  const zone = titleCase(card?.zone);
  const creatureClass = titleCase(card?.class);
  const subtype = titleCase(card?.subtype);
  const cost = numericValue(card?.cost);
  const vp = numericValue(card?.victoryPoints ?? card?.vp);
  const health = numericValue(card?.health);
  const defense = diceValue(card?.defense);
  const attackDice = diceValue(card?.attackDice)
    || (card?.actions ?? []).map((action) => diceValue(action?.attackDice ?? action?.dice)).find(Boolean)
    || (card?.effects ?? []).map((effect) => diceValue(effect?.attackDice ?? effect?.dice)).find(Boolean)
    || "";
  const rulesText = [
    card?.text,
    card?.bonusVictoryPoints,
    card?.onPlay,
    card?.passives,
    card?.actions,
    card?.specialRules,
    card?.maintenance,
    card?.playRequirements,
    card?.playRestrictions,
    card?.removalRules,
    card?.specialPlacement,
  ].flatMap((value) => collectPrintedText(value));
  const uniqueRules = [...new Set(rulesText)];

  const identity = [zone, subtype, creatureClass || category, kind === "Creature" ? "Creature" : ""].filter(Boolean).join(" ");
  const facts = [];
  facts.push(`${displayName} is ${/^([aeiou])/i.test(identity || kind) ? "an" : "a"} ${identity || category || kind} card.`);
  if (cost !== null) facts.push(`It costs ${cost} RP to play.`);
  if (vp !== null) facts.push(`It is worth ${vp} VP while it remains in play.`);
  if (health !== null) facts.push(`It has ${health} HP.`);
  if (defense) facts.push(`Its defense die is ${defense}.`);
  if (attackDice) facts.push(`Its attack uses ${attackDice}.`);
  if (typeof card?.schoolDensity === "number") facts.push(`Its School Density is ${card.schoolDensity}.`);
  if (typeof card?.schoolDensityRequirement === "number") facts.push(`It requires ${card.schoolDensityRequirement} School Density to play.`);
  if (card?.weaknesses?.length) facts.push(`Its weaknesses are ${card.weaknesses.map(titleCase).join(", ")}.`);
  if (uniqueRules.length) facts.push(`Its printed rules say: ${uniqueRules.map(sentence).join(" ")}`);

  return {
    text: cleanText(facts.join(" ")),
    facts: {
      attackDice,
      category: card?.category ?? "",
      class: card?.class ?? "",
      cost,
      defense,
      health,
      kind: card?.kind ?? "",
      printedRules: uniqueRules,
      slots: card?.slots ?? [],
      subtype: card?.subtype ?? "",
      victoryPoints: vp,
      weaknesses: card?.weaknesses ?? [],
      zone: card?.zone ?? "",
    },
  };
}

export function createCardKnowledge(cards = []) {
  return cards.map((card) => {
    const description = describeCard(card);
    const title = getCardDisplayName(card);
    return {
      id: `card:${card.id}`,
      title,
      text: description.text,
      aliases: getCardAliases(card),
      keywords: [...new Set([
        card.id,
        card.kind,
        card.category,
        card.zone,
        card.class,
        card.subtype,
        ...(card.tags ?? []),
      ].filter(Boolean))],
      source: "card",
      sourceLabel: `Card — ${title}`,
      sourceHref: `/gallery#card-${card.id}`,
      entity: { id: card.id, type: "card", label: title },
      facts: description.facts,
    };
  });
}

function normalizeRule(rule, _index, source) {
  const normalizedSource = rule.source ?? source;
  const sourceLabels = {
    current: "How to Play",
    knowledge: "SeaPals rules reference",
    ruling: "Official ruling",
  };
  return {
    ...rule,
    id: rule.id ?? `${normalizedSource}:${slug(rule.title)}`,
    text: cleanText(rule.text),
    aliases: rule.aliases ?? [],
    keywords: rule.keywords ?? [],
    source: normalizedSource,
    sourceLabel: rule.sourceLabel ?? `${sourceLabels[normalizedSource] ?? "SeaPals source"} — ${rule.title}`,
    sourceHref: rule.sourceHref ?? "/instructions",
  };
}

export function buildRulesKnowledgeBank({
  cards = [],
  coreRules = [],
  currentRules = [],
  officialRulings = [],
  simulatorRules = [],
} = {}) {
  const entries = [
    ...currentRules.map((rule, index) => normalizeRule(rule, index, "current")),
    ...coreRules.map((rule, index) => normalizeRule(rule, index, "knowledge")),
    ...simulatorRules.map((rule, index) => normalizeRule(rule, index + coreRules.length, "knowledge")),
    ...officialRulings.map((rule, index) => normalizeRule(rule, index, "ruling")),
    ...createCardKnowledge(cards),
  ];
  const seen = new Set();
  return entries.filter((entry) => {
    if (!entry.title || !entry.text || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}
