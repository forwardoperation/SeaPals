import { explainDieNotation, findRelevantRules } from "./rulesAssistant.mjs";

const FOLLOW_UP_PATTERN = /^(and\b|also\b|but\b|then\b|(?:okay|ok)(?:,?\s+(?:and|but))?\b|what about\b|how about\b|what if\b|does (?:it|that|this)\b|do (?:they|those)\b|can (?:it|that|they)\b|could (?:it|that|they)\b|is (?:it|that|this)\b|are (?:they|those)\b|where (?:does|do|is|are)\b|why (?:does|do|is|are)\b)/i;
const CARD_FACT_PATTERN = /\b(cost|rp|victory|vp|points?|health|hp|defen[cs]e|attack|dice|die|kind|type|class|category|zone|habitat|slot|fit|place|weakness|ability|abilities|effect|printed|do|does|work)\b/i;
const SPECIFIC_CARD_FACT_PATTERN = /\b(cost|rp|victory|vp|points?|health|hp|defen[cs]e|attack|dice|die|kind|type|class|category|zone|habitat|slot|fit|place|weakness|ability|abilities|effect|printed)\b/i;
const OUT_OF_SCOPE_PATTERN = /\b(artist|artwork|author|creator|designed the (?:logo|website)|designer|logo|music|programmer|website)\b/i;
const INTENT_ROUTES = [
  {
    question: /(?=.*\b(?:begin|start|starting|sit down)\b)(?=.*\b(?:cards?|hand|rp|resources?)\b)/i,
    title: /^Starting a game$/i,
  },
  {
    question: /(?=.*\b(?:upgrade|upgraded|upgrading)\b)(?=.*\bcoral\b)(?=.*\b(?:damage|damaged|heal|healed|hurt)\b)/i,
    title: /^Coral upgrades$/i,
  },
  {
    question: /\bcloak(?:ed)?\b/i,
    title: /^Cloak and Transparency$/i,
  },
  {
    question: /(?=.*\battack\b)(?=.*\bdefen[cs]e\b)(?=.*\b(?:equal|equals|match|same|tie|ties|tied)\b)/i,
    title: /^How normal attacks resolve$/i,
  },
];

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCase(value) {
  return String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sourceFor(rule) {
  return {
    id: rule.id,
    label: rule.sourceLabel ?? rule.title,
    href: rule.sourceHref ?? "/instructions",
  };
}

function nextContext(question, answer, previous = {}, mentionedRules = [], roles = {}) {
  const turn = Number(previous.turn ?? 0) + 1;
  const previousEntities = Array.isArray(previous.entities) ? previous.entities : [];
  const entities = previousEntities.map((entity) => ({ ...entity }));
  const additions = [...mentionedRules];
  if (answer.entity && !additions.some((rule) => rule.entity?.id === answer.entity.id)) {
    additions.push({ entity: answer.entity, facts: {} });
  }

  for (const rule of additions) {
    if (!rule?.entity?.id) continue;
    const existing = entities.find((entity) => entity.id === rule.entity.id);
    const details = {
      id: rule.entity.id,
      label: rule.entity.label ?? rule.title,
      type: rule.entity.type ?? "card",
      kind: rule.facts?.kind ?? existing?.kind ?? "",
      category: rule.facts?.category ?? existing?.category ?? "",
      mentionedAt: turn,
    };
    if (existing) Object.assign(existing, details);
    else entities.push(details);
  }

  const active = additions.at(-1)?.entity ?? answer.entity ?? null;
  const condition = [...additions].reverse().find((rule) =>
    rule?.entity?.id && (rule.facts?.kind === "condition" || rule.facts?.category === "condition"),
  );
  const history = [...(Array.isArray(previous.history) ? previous.history : []), {
    question,
    ruleIds: (answer.sources ?? []).map((source) => source.id).filter(Boolean),
  }].slice(-6);

  return {
    activeEntityId: active?.id ?? previous.activeEntityId ?? null,
    activeEntityLabel: active?.label ?? previous.activeEntityLabel ?? null,
    attackerId: roles.attackerId ?? previous.attackerId ?? null,
    defenderId: roles.defenderId ?? previous.defenderId ?? null,
    previousConditionId: condition?.entity.id ?? previous.previousConditionId ?? null,
    entities: entities.slice(-10),
    history,
    lastQuestion: question,
    lastRuleIds: (answer.sources ?? []).map((source) => source.id).filter(Boolean),
    turn,
  };
}

function candidateMatches(question, rules) {
  const normalizedQuestion = ` ${normalize(question)} `;
  const matches = [];
  for (const rule of rules) {
    if (rule.entity?.type !== "card") continue;
    const matchingAliases = (rule.aliases ?? [rule.title])
      .map((alias) => normalize(alias))
      .filter((alias) => alias && normalizedQuestion.includes(` ${alias} `));
    if (matchingAliases.length) {
      matches.push({ rule, matchLength: Math.max(...matchingAliases.map((alias) => alias.length)) });
    }
  }
  const exactTitleMatches = matches.filter(({ rule }) => normalizedQuestion.includes(` ${normalize(rule.title)} `));
  const pool = exactTitleMatches.length ? exactTitleMatches : matches;
  const longest = Math.max(0, ...pool.map((match) => match.matchLength));
  return pool.filter((match) => match.matchLength === longest).map((match) => match.rule);
}

function explicitCardMatches(question, rules) {
  const normalizedQuestion = normalize(question);
  const cardRules = rules.filter((rule) => rule.entity?.type === "card");
  const spans = [];
  for (const rule of cardRules) {
    const title = normalize(rule.title);
    if (!title) continue;
    let start = normalizedQuestion.indexOf(title);
    while (start >= 0) {
      const end = start + title.length;
      const leftBoundary = start === 0 || normalizedQuestion[start - 1] === " ";
      const rightBoundary = end === normalizedQuestion.length || normalizedQuestion[end] === " ";
      if (leftBoundary && rightBoundary) spans.push({ end, length: title.length, rule, start });
      start = normalizedQuestion.indexOf(title, start + 1);
    }
  }
  if (spans.length) {
    const accepted = [];
    for (const span of spans.sort((a, b) => b.length - a.length || a.start - b.start)) {
      if (accepted.some((candidate) => span.start < candidate.end && span.end > candidate.start)) continue;
      accepted.push(span);
    }
    return accepted.sort((a, b) => a.start - b.start).map((span) => span.rule);
  }
  return candidateMatches(question, rules);
}

function isCardFocusedQuestion(question, cardRule) {
  if (/\b(maintenance|general rule|rules? for)\b/i.test(question)) return false;
  const normalizedQuestion = normalize(question);
  const aliases = (cardRule.aliases ?? [cardRule.title]).map(normalize).sort((a, b) => b.length - a.length);
  const alias = aliases.find((candidate) => ` ${normalizedQuestion} `.includes(` ${candidate} `));
  const remainder = normalize(normalizedQuestion.replace(alias ?? "", ""))
    .split(" ")
    .filter((word) => word && !["a", "about", "can", "card", "do", "does", "explain", "for", "give", "how", "is", "me", "of", "on", "please", "practical", "rundown", "tell", "the", "through", "to", "walk", "what", "work", "works", "you"].includes(word));
  return remainder.length === 0 || SPECIFIC_CARD_FACT_PATTERN.test(question);
}

function isFollowUp(question) {
  const normalized = String(question ?? "").trim();
  return FOLLOW_UP_PATTERN.test(normalized) || normalize(normalized).split(" ").length <= 8 && /\b(it|its|that|this|they|those|one)\b/i.test(normalized);
}

function findIntentRule(question, rules) {
  const route = INTENT_ROUTES.find((candidate) => candidate.question.test(question));
  return route ? rules.find((rule) => route.title.test(rule.title)) ?? null : null;
}

function cardById(id, rules) {
  if (!id) return null;
  return rules.find((rule) => rule.entity?.type === "card" && rule.entity.id === id) ?? null;
}

function findContextCard(context, rules) {
  return cardById(context?.activeEntityId, rules);
}

function referencedContextCards(question, context, rules) {
  const entities = (context?.entities ?? []).map((entity) => cardById(entity.id, rules)).filter(Boolean);
  const references = [];
  const add = (rule) => {
    if (rule && !references.some((candidate) => candidate.entity.id === rule.entity.id)) references.push(rule);
  };

  if (/\b(?:the\s+)?first\s+(?:one|card|pal)\b/i.test(question)) add(entities[0]);
  if (/\b(?:the\s+)?second\s+(?:one|card|pal)\b/i.test(question)) add(entities[1]);
  if (/\b(?:the\s+)?third\s+(?:one|card|pal)\b/i.test(question)) add(entities[2]);
  if (/\b(?:that|the|previous)\s+attacker\b/i.test(question)) add(cardById(context?.attackerId, rules));
  if (/\b(?:that|the|previous)\s+(?:defender|target)\b/i.test(question)) add(cardById(context?.defenderId, rules));
  if (/\b(?:the\s+)?previous\s+condition\b/i.test(question)) add(cardById(context?.previousConditionId, rules));
  if (!references.length && isFollowUp(question)) add(findContextCard(context, rules));
  return references;
}

function inferRoles(question, cards, context = {}) {
  if (!/\b(?:attack|attacks|attacking|fight|fights|target|targets)\b/i.test(question)) return {};
  if (cards.length >= 2) return { attackerId: cards[0].entity.id, defenderId: cards[1].entity.id };
  if (cards.length === 1 && /\b(?:attacker|attacks|attacking)\b/i.test(question)) {
    return { attackerId: cards[0].entity.id, defenderId: context.defenderId ?? null };
  }
  return {};
}

function joinList(items) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function cardType(facts) {
  return [facts.zone, facts.subtype, facts.class || facts.category, facts.kind === "creature" ? "creature" : "card"]
    .filter(Boolean)
    .map(titleCase)
    .join(" ");
}

function cardAnswer(question, rule, rules) {
  const facts = rule.facts ?? {};
  const q = normalize(question);
  let text = "";

  if (/\b(cost|rp)\b/.test(q)) {
    text = facts.cost === null || facts.cost === undefined
      ? `${rule.title} does not have a documented RP play cost in the current card data.`
      : `${rule.title} costs ${facts.cost} RP to play.`;
  } else if (/\b(victory|vp|points?)\b/.test(q)) {
    text = facts.victoryPoints === null || facts.victoryPoints === undefined
      ? `${rule.title} does not have printed Victory Points in the current card data.`
      : `${rule.title} is worth ${facts.victoryPoints} VP while it remains in play.`;
  } else if (/\b(health|hp)\b/.test(q)) {
    text = facts.health === null || facts.health === undefined
      ? `${rule.title} does not have a documented HP value.`
      : `${rule.title} has ${facts.health} HP.`;
  } else if (/\bdefen[cs]e\b/.test(q)) {
    text = facts.defense
      ? `${rule.title} rolls ${facts.defense} for defense.`
      : `${rule.title} does not have a defense die in the current card data.`;
  } else if (/\b(attack|attack die|attack dice)\b/.test(q)) {
    text = facts.attackDice
      ? `${rule.title} attacks with ${facts.attackDice}. ${facts.printedRules?.length ? facts.printedRules.join(" ") : "Resolve the attack using its printed targets and count."}`
      : `${rule.title} does not have a documented attack die. ${facts.printedRules?.join(" ") ?? ""}`.trim();
  } else if (/\b(kind|type|class|category|zone|habitat)\b/.test(q)) {
    text = `${rule.title} is a ${cardType(facts)}.`;
  } else if (/\b(slot|fit|place|played? into)\b/.test(q)) {
    return placementAnswer(question, rule, rules);
  } else if (/\bweakness/.test(q)) {
    text = facts.weaknesses?.length
      ? `${rule.title} is weak to ${joinList(facts.weaknesses.map(titleCase))}.`
      : `${rule.title} has no documented weaknesses in the current card data.`;
  } else {
    text = rule.text;
  }

  return {
    kind: "answer",
    title: rule.title,
    text,
    entity: rule.entity,
    sources: [sourceFor(rule)],
  };
}

function placementAnswer(question, rule, rules) {
  const q = normalize(question);
  const facts = rule.facts ?? {};
  const placementQuery = normalize(q.replace(normalize(rule.title), " "));
  const slotMatch = placementQuery.match(/\b(filter feeder|invertebrate|predator|apex|fish)\s+slot\b/);
  const zoneMatches = [...placementQuery.matchAll(/\b(reef|ocean|oceanic|deep)\b/g)];
  const zoneMatch = zoneMatches.at(-1);
  if (!slotMatch) {
    return {
      kind: "answer",
      title: rule.title,
      text: `${rule.title} is a ${cardType(facts)}. Its destination must match both the slot's habitat zone and the classes that slot accepts.`,
      entity: rule.entity,
      sources: placementSources(rule, rules),
    };
  }

  const slotClass = slotMatch[1].replace(" ", "_");
  const accepted = {
    apex: ["fish", "predator", "apex"],
    filter_feeder: ["filter_feeder"],
    fish: ["fish"],
    invertebrate: ["invertebrate"],
    predator: ["fish", "predator"],
  }[slotClass] ?? [slotClass];
  const requestedZone = zoneMatch?.[1] === "oceanic" ? "ocean" : zoneMatch?.[1];
  const classFits = accepted.includes(facts.class);
  const zoneFits = !requestedZone || requestedZone === facts.zone;

  if (classFits && zoneFits) {
    const condition = requestedZone
      ? `because its ${titleCase(facts.zone)} habitat and ${titleCase(facts.class)} class both match`
      : `provided that the slot is also in the ${titleCase(facts.zone)} habitat`;
    return {
      kind: "answer",
      title: `${rule.title} placement`,
      text: `Yes. ${rule.title} can use that ${titleCase(slotClass)} slot ${condition}.`,
      entity: rule.entity,
      sources: placementSources(rule, rules),
    };
  }

  const reason = !zoneFits
    ? `${rule.title} is ${titleCase(facts.zone)}, not ${titleCase(requestedZone)}`
    : `a ${titleCase(slotClass)} slot does not accept the ${titleCase(facts.class)} class`;
  return {
    kind: "answer",
    title: `${rule.title} placement`,
    text: `No. ${reason}. A creature has to match both the slot's habitat and an accepted class.`,
    entity: rule.entity,
    sources: placementSources(rule, rules),
  };
}

function placementSources(cardRule, rules) {
  const placementRule = rules.find((rule) => /Habitat and class matching/i.test(rule.title))
    ?? rules.find((rule) => /Playing Pals into slots/i.test(rule.title));
  return [cardRule, placementRule].filter(Boolean).map(sourceFor);
}

function uniqueRules(rules) {
  const seen = new Set();
  return rules.filter((rule) => {
    if (!rule?.id || seen.has(rule.id)) return false;
    seen.add(rule.id);
    return true;
  });
}

function requestedFactField(question) {
  const q = normalize(question);
  if (/\b(cost|rp)\b/.test(q)) return { key: "cost", label: "RP cost" };
  if (/\b(victory|vp|points?)\b/.test(q)) return { key: "victoryPoints", label: "Victory Points" };
  if (/\b(health|hp)\b/.test(q)) return { key: "health", label: "HP" };
  if (/\bdefen[cs]e\b/.test(q)) return { key: "defense", label: "defense die" };
  if (/\battack(?:\s+(?:die|dice))?\b/.test(q)) return { key: "attackDice", label: "attack die" };
  return null;
}

function missingScenarioFacts(question, cardRules, roles = {}) {
  const requested = requestedFactField(question);
  if (!requested || cardRules.length < 2) return [];
  const requirements = /\battack(?:s|ing)?\b/i.test(question) && roles.attackerId && roles.defenderId
    ? cardRules.flatMap((rule) => {
      if (rule.entity.id === roles.attackerId) return [{ rule, key: "attackDice", label: "attack die" }];
      if (rule.entity.id === roles.defenderId) return [{ rule, key: "defense", label: "defense die" }];
      return [];
    })
    : cardRules.map((rule) => ({ rule, ...requested }));
  return requirements.filter(({ rule, key }) => {
    const value = rule.facts?.[key];
    return value === null || value === undefined || value === "";
  }).map(({ rule, label }) => `${rule.title}'s ${label}`);
}

function conflictingRules(rules) {
  const groups = new Map();
  for (const rule of rules) {
    if (!rule.conflictKey || rule.conflictValue === undefined) continue;
    const group = groups.get(rule.conflictKey) ?? [];
    group.push(rule);
    groups.set(rule.conflictKey, group);
  }
  for (const group of groups.values()) {
    if (new Set(group.map((rule) => JSON.stringify(rule.conflictValue))).size > 1) return group;
  }
  return [];
}

function concise(text, maxLength = 280) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [];
  let result = "";
  for (const sentence of sentences) {
    if (`${result} ${sentence}`.trim().length > maxLength) break;
    result = `${result} ${sentence}`.trim();
  }
  return result || `${clean.slice(0, maxLength - 1).trim()}…`;
}

function cardScenarioText(question, rule) {
  const facts = rule.facts ?? {};
  const requested = requestedFactField(question);
  if (requested && facts[requested.key] !== null && facts[requested.key] !== undefined && facts[requested.key] !== "") {
    const value = facts[requested.key];
    const suffix = {
      attackDice: `attacks with ${value}`,
      cost: `costs ${value} RP`,
      defense: `defends with ${value}`,
      health: `has ${value} HP`,
      victoryPoints: `is worth ${value} VP while in play`,
    }[requested.key];
    return `${rule.title} ${suffix}.`;
  }
  return concise(rule.text, 230);
}

function scenarioAnswer(question, cardRules, rules, context, roles) {
  const missing = missingScenarioFacts(question, cardRules, roles);
  if (missing.length) {
    const result = {
      kind: "clarification",
      title: "The current sources are incomplete",
      text: `I can identify the cards, but the current card data does not document ${joinList(missing)}. I need that printed value or an official ruling before I can resolve this interaction without guessing.`,
      options: [],
      sources: cardRules.map(sourceFor),
    };
    result.context = nextContext(question, result, context, cardRules, roles);
    return result;
  }

  const relevant = findRelevantRules(question, rules, { limit: 10, minScore: 4 })
    .filter((rule) => !cardRules.some((card) => card.id === rule.id));
  const supporting = uniqueRules([...cardRules, ...relevant]).slice(0, 4);
  const conflicts = conflictingRules(supporting);
  if (conflicts.length) {
    const result = {
      kind: "clarification",
      title: "The current sources disagree",
      text: `I found conflicting published values for ${conflicts[0].conflictKey}. I won't choose one silently; please confirm which edition or ruling applies.`,
      options: conflicts.map((rule) => rule.sourceLabel ?? rule.title),
      sources: conflicts.map(sourceFor),
    };
    result.context = nextContext(question, result, context, cardRules, roles);
    return result;
  }

  const pieces = supporting.map((rule) =>
    rule.entity?.type === "card"
      ? `${rule.title}: ${cardScenarioText(question, rule)}`
      : `${rule.title}: ${concise(rule.text)}`,
  );
  const result = {
    kind: "answer",
    title: "How these rules work together",
    text: `Here is the grounded interaction. ${pieces.join(" ")} Apply those parts together in that order; if a printed card instruction is more specific than the general rule, follow the printed instruction.`,
    entity: cardRules.at(-1)?.entity,
    sources: supporting.map(sourceFor),
  };
  result.context = nextContext(question, result, context, cardRules, roles);
  return result;
}

function isMultiRuleQuestion(question, cards) {
  const normalizedQuestion = ` ${normalize(question)} `;
  const explicitlyNamed = cards.filter((rule) => normalizedQuestion.includes(` ${normalize(rule.title)} `)).length;
  const contextualPair = cards.length >= 2 && /\b(first|second|third|attacker|defender|target|previous condition)\b/i.test(question);
  if (explicitlyNamed >= 2 || contextualPair) return true;
  return cards.length === 1 && /\b(interact|interaction|together|against|while|during|combined?|both|versus|vs\.?|what happens if)\b/i.test(question);
}

function clarification(question, candidates, context) {
  const names = candidates.slice(0, 6).map((candidate) => candidate.title);
  const quotedQuestion = String(question).trim().replace(/[.!?]+$/, "");
  const result = {
    kind: "clarification",
    title: "Which card do you mean?",
    text: `I found more than one card matching “${quotedQuestion}.” Please include the subtitle or stage: ${joinList(names)}.`,
    options: names,
    sources: [],
  };
  result.context = nextContext(question, result, context);
  return result;
}

export function answerRulesQuestion(question, rules, context = {}) {
  const cleanQuestion = String(question ?? "").trim();
  if (!cleanQuestion) return null;

  if (/^(hello|hey|hi|howdy)( there)?[!.?]*$/i.test(cleanQuestion)) {
    const result = {
      kind: "greeting",
      title: "Hi, fellow SeaPal!",
      text: "Ask me about setup, turns, a specific card, attacks, habitats, Conditions, or how two rules interact.",
      sources: [],
    };
    result.context = nextContext(cleanQuestion, result, context);
    return result;
  }

  if (OUT_OF_SCOPE_PATTERN.test(cleanQuestion)) {
    const result = {
      kind: "unknown",
      text: "That isn't covered by the SeaPals gameplay rules or card data I use, so I don't have a supported answer.",
      showRulesLink: false,
      sources: [],
    };
    result.context = nextContext(cleanQuestion, result, context);
    return result;
  }

  const explicitCandidates = explicitCardMatches(cleanQuestion, rules);
  const contextualReferences = referencedContextCards(cleanQuestion, context, rules);
  const mentionedCards = uniqueRules([...explicitCandidates, ...contextualReferences]);
  const roles = inferRoles(cleanQuestion, mentionedCards, context);

  if (isMultiRuleQuestion(cleanQuestion, mentionedCards)) {
    return scenarioAnswer(cleanQuestion, mentionedCards, rules, context, roles);
  }

  const intentRule = findIntentRule(cleanQuestion, rules);
  if (intentRule) {
    const result = {
      kind: "answer",
      title: intentRule.title,
      text: intentRule.text,
      sources: [sourceFor(intentRule)],
    };
    result.context = nextContext(cleanQuestion, result, context, mentionedCards, roles);
    return result;
  }

  if (explicitCandidates.length > 1 && isCardFocusedQuestion(cleanQuestion, explicitCandidates[0])) {
    return clarification(cleanQuestion, explicitCandidates, context);
  }

  const contextualCard = contextualReferences.length === 1 ? contextualReferences[0] : findContextCard(context, rules);
  const explicitCard = explicitCandidates.length === 1 && isCardFocusedQuestion(cleanQuestion, explicitCandidates[0])
    ? explicitCandidates[0]
    : null;
  const activeCard = explicitCard ?? (isFollowUp(cleanQuestion) ? contextualCard : null);
  const followUp = isFollowUp(cleanQuestion);
  const expandedQuestion = followUp && context.lastQuestion && normalize(cleanQuestion).split(" ").length <= 3
    ? `${context.lastQuestion} ${cleanQuestion}`
    : cleanQuestion;

  if (activeCard && (explicitCard || CARD_FACT_PATTERN.test(cleanQuestion)) && !/^what if\b/i.test(cleanQuestion)) {
    const result = cardAnswer(cleanQuestion, activeCard, rules);
    result.context = nextContext(cleanQuestion, result, context, [activeCard], roles);
    return result;
  }

  const dieAnswer = explainDieNotation(cleanQuestion);
  if (dieAnswer) {
    const result = {
      kind: "answer",
      ...dieAnswer,
      sources: [{ id: "how-to:dice-reference", label: "How to Play — Dice Reference", href: "/instructions" }],
      entity: activeCard?.entity,
    };
    result.context = nextContext(cleanQuestion, result, context, activeCard ? [activeCard] : mentionedCards, roles);
    return result;
  }

  const relevant = findRelevantRules(expandedQuestion, rules, { limit: 4, minScore: 6 });
  const best = relevant[0];
  if (!best) {
    const result = {
      kind: "unknown",
      text: "I couldn't find a supported answer in the current SeaPals rules or card data, and I don't want to invent one. Try naming the card or rule involved, or check the full How to Play guide.",
      showRulesLink: true,
      sources: [],
      entity: activeCard?.entity,
    };
    result.context = nextContext(cleanQuestion, result, context, activeCard ? [activeCard] : mentionedCards, roles);
    return result;
  }

  const result = {
    kind: "answer",
    title: best.title,
    text: best.text,
    sources: [sourceFor(best)],
    entity: activeCard?.entity ?? best.entity,
  };
  result.context = nextContext(cleanQuestion, result, context, activeCard ? [activeCard] : mentionedCards, roles);
  return result;
}
