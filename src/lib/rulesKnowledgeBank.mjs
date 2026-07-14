import { PLAYER_GLOSSARY } from "../data/rules/playerGlossary.mjs";

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
  if (card?.stageLabel) {
    const name = cleanText(card.name);
    const stage = cleanText(card.stageLabel);
    aliases.add(`${name} ${stage}`);
    // Players commonly move the stage before the card kind when speaking, for
    // example "Clubfinger Stage 1 Coral" instead of "Clubfinger Coral — Stage 1".
    if (/\s+Coral$/i.test(name)) aliases.add(name.replace(/\s+Coral$/i, ` ${stage} Coral`));
  }
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
      schoolDensity: typeof card?.schoolDensity === "number" ? card.schoolDensity : null,
      schoolDensityRequirement: typeof card?.schoolDensityRequirement === "number" ? card.schoolDensityRequirement : null,
      slots: card?.slots ?? [],
      stage: card?.stage ?? null,
      stageLabel: cleanText(card?.stageLabel),
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

function namedAbilityEntries(card) {
  const fields = [
    ["passives", "passive ability"],
    ["onPlay", "On Play ability"],
    ["actions", "action"],
    ["maintenance", "maintenance ability"],
    ["specialRules", "special rule"],
  ];
  const entries = [];
  for (const [field, type] of fields) {
    const values = Array.isArray(card?.[field]) ? card[field] : card?.[field] ? [card[field]] : [];
    for (const value of values) {
      if (typeof value === "string") {
        const match = cleanText(value).match(/^([^:]{2,64}):\s*(.+)$/);
        if (match) entries.push({ name: cleanText(match[1]), text: sentence(match[2]), type });
        continue;
      }
      if (!value || typeof value !== "object") continue;
      const name = cleanText(value.name);
      const text = sentence(value.text ?? value.description);
      if (name && text) entries.push({ name, text, type });
    }
  }
  return entries;
}

export function createNamedAbilityKnowledge(cards = []) {
  const groups = new Map();
  for (const card of cards) {
    for (const ability of namedAbilityEntries(card)) {
      const key = slug(ability.name);
      if (!key) continue;
      const group = groups.get(key) ?? { name: ability.name, occurrences: [] };
      group.occurrences.push({ ability, card });
      groups.set(key, group);
    }
  }

  return [...groups.entries()].map(([key, group]) => {
    const holders = [...new Map(group.occurrences.map(({ card }) => [card.id, card])).values()];
    const types = [...new Set(group.occurrences.map(({ ability }) => ability.type))];
    const variants = [...new Map(group.occurrences.map(({ ability }) => [normalizeAbilityText(ability.text), ability.text])).values()];
    const holderNames = holders.map(getCardDisplayName);
    const printedText = variants.length === 1
      ? variants[0]
      : group.occurrences.map(({ ability, card }) => `${getCardDisplayName(card)}: ${ability.text}`).join(" ");
    return {
      id: `ability:${key}`,
      title: group.name,
      text: `${group.name} is a ${joinAbilityTypes(types)}. ${printedText} It appears on ${joinNames(holderNames)}.`,
      aliases: [group.name, `${group.name} ability`, ...types.map((type) => `${group.name} ${type}`)],
      keywords: ["ability", "abilities", "effect", "passive", ...holderNames],
      source: "ability",
      sourceLabel: `Cards with ${group.name}`,
      sourceHref: `/gallery#card-${holders[0].id}`,
      sourceCards: holders.map((card) => ({
        id: `card:${card.id}`,
        label: `Card — ${getCardDisplayName(card)}`,
        href: `/gallery#card-${card.id}`,
      })),
      entity: { id: key, type: "ability", label: group.name },
      variants,
    };
  });
}

function normalizeAbilityText(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function joinAbilityTypes(types) {
  if (types.length <= 1) return types[0] ?? "named ability";
  return `${types.slice(0, -1).join(", ")} or ${types.at(-1)}`;
}

function joinNames(names) {
  if (names.length <= 1) return names[0] ?? "the current card data";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

function normalizeRule(rule, _index, source) {
  const normalizedSource = rule.source ?? source;
  const sourceLabels = {
    current: "How to Play",
    glossary: "SeaPals glossary",
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
    ...PLAYER_GLOSSARY.map((rule, index) => normalizeRule(rule, index, "glossary")),
    ...currentRules.map((rule, index) => normalizeRule(rule, index, "current")),
    ...coreRules.map((rule, index) => normalizeRule(rule, index, "knowledge")),
    ...simulatorRules.map((rule, index) => normalizeRule(rule, index + coreRules.length, "knowledge")),
    ...officialRulings.map((rule, index) => normalizeRule(rule, index, "ruling")),
    ...createNamedAbilityKnowledge(cards),
    ...createCardKnowledge(cards),
  ];
  const seen = new Set();
  return entries.filter((entry) => {
    if (!entry.title || !entry.text || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}
