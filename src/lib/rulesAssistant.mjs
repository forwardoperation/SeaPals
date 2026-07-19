const STOP_WORDS = new Set([
  "a", "an", "and", "are", "can", "card", "cards", "do", "does", "for", "from", "how", "i",
  "game", "in", "is", "it", "little", "many", "mean", "means", "of", "on", "or", "play", "the", "them",
  "to", "under", "use", "used", "what", "when", "where", "which", "with", "you", "your",
]);

const PHRASE_STOP_WORDS = new Set([...STOP_WORDS].filter((word) => word !== "game"));

export const CORE_RULES = [
  {
    title: "How to win",
    text: "The first player to reach the agreed Victory Point target wins. Use 30 VP for a recommended full game or 10 VP for a quick game. VP only counts while its card remains in play.",
  },
  {
    title: "How you can lose",
    text: "If you must draw and both your Foundation Deck and Pals Deck are depleted, you lose the game.",
  },
  {
    title: "Starting a game",
    text: "Draw 4 cards from your Foundation Deck and 4 from your Pals Deck, giving you 8 cards total. Start with 3 RP, spend setup RP to play a valid starting foundation, and redraw your Foundation hand if you cannot play one.",
  },
  {
    title: "The three decks",
    text: "Each player splits a 60-card deck into a Foundation Deck and a Pals Deck. The separate shared Conditions Deck affects everyone and reveals a new condition at the start of each round.",
  },
  {
    title: "Turn order",
    text: "A turn follows four steps: Choose, Collect, Build, Attack. Choose which personal deck to draw from; gain 1 RP and collect RP from active foundations; play cards, upgrade foundations, and use paid actions; then resolve attacks one at a time.",
  },
  {
    title: "How attacking works",
    text: "Read the attack indicator for the attack die, legal target icons, and attack count. Choose a legal target, then roll the attack die while the target rolls its defense die. The attacker must roll higher; ties go to the defender. A successful attack destroys the defender: a destroyed Apex, Filter Feeder, or Lionfish goes to its owner's Lost Zone, while other destroyed cards go to discard unless their text says otherwise.",
  },
  {
    title: "Defense rolls",
    text: "For a normal attack, the target rolls the defense die printed on its card against the attacker's attack roll. The attacker must roll higher to succeed; a tie goes to the defender. Bait balls are the exception: they do not roll defense and instead take the attack roll multiplied by 10 as damage.",
  },
  {
    title: "Repeated attacks",
    text: "Resolve every repeated attack separately. Modifiers apply to each attack, and the same target cannot be chosen twice during that attack sequence.",
  },
  {
    title: "Attacking bait balls",
    text: "Bait balls do not make a defense roll. They take damage equal to the attack roll multiplied by 10 and are discarded when they reach 0 HP.",
  },
  {
    title: "Playing Pals into slots",
    text: "Spend RP to play a Pal into a legal habitat slot. The slot must match both the Pal's habitat and class rules. Predator slots can also accept matching Fish, and Apex slots can also accept matching Predators or Fish.",
  },
  {
    title: "Upgrading coral",
    text: "To upgrade coral, have its next stage card in hand and pay the RP upgrade cost. Each coral can be upgraded only once per turn, and existing damage remains after the upgrade.",
  },
  {
    title: "What Conditions cards are used for",
    text: "The Conditions Deck is shared by all players. Reveal its next card at the start of each round and apply the printed effect to everyone for its stated duration. Conditions can change costs, play restrictions, School Density requirements, or RP production. A Condition matching a Coral weakness stops that Coral from producing RP for the round without removing it.",
  },
  {
    title: "Victory Points in play",
    text: "Only VP on cards currently in your ecosystem counts toward winning. If a VP card leaves play, subtract those points from your total.",
  },
  {
    title: "Lost Zone",
    text: "When an Apex, Filter Feeder, or Lionfish is destroyed, place that card in its owner's Lost Zone instead of the discard pile. Cards sent to the Lost Zone are no longer in play. Spearfishing discards Lionfish rather than destroying it, so Spearfishing returns Lionfish to its owner's discard pile. Other cards go to discard when destroyed unless their printed text says otherwise.",
  },
];

const SYNONYM_GROUPS = [
  ["begin", "beginning", "setup", "start", "starting"],
  ["battle", "combat", "fight", "attack", "attacking"],
  ["cost", "pay", "resource", "resources", "rp"],
  ["defend", "defense", "defensive"],
  ["draw", "drawing", "hand"],
  ["destroy", "destroyed", "dies", "discard", "remove", "removed"],
  ["die", "dice", "roll", "rolling"],
  ["damage", "health", "hp", "hurt"],
  ["goal", "victory", "win", "winning", "vp"],
  ["habitat", "place", "play", "slot", "slots"],
  ["circle", "circles", "icon", "icons", "star", "stars", "symbol", "symbols"],
  ["baitball", "bait", "density", "school", "schools"],
  ["coral", "foundation", "foundations"],
  ["effect", "ability", "action", "actions"],
  ["evolve", "stage", "upgrade", "upgrading"],
  ["ocean", "oceanic", "openwater"],
  ["people", "person", "player", "players"],
  ["poison", "toxic"],
  ["round", "turn", "turns"],
];

const SYNONYM_CANONICAL = new Map(
  SYNONYM_GROUPS.flatMap((group) =>
    group.map((word) => [word, group[0]]),
  ),
);

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function decodeHtmlEntities(value) {
  const namedEntities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => namedEntities[name.toLowerCase()] ?? entity);
}

function htmlToText(value) {
  return decodeHtmlEntities(
    value
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

const VOID_HTML_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr",
]);

function stripRulesIgnoredHtml(value) {
  const source = String(value ?? "");
  const tagPattern = /<\/?([a-z][a-z0-9:-]*)\b[^>]*>/gi;
  const output = [];
  const ignoredStack = [];
  let copyFrom = 0;
  let match;

  while ((match = tagPattern.exec(source))) {
    const rawTag = match[0];
    const tagName = match[1].toLowerCase();
    const isClosing = /^<\//.test(rawTag);
    const isSelfClosing = /\/\s*>$/.test(rawTag) || VOID_HTML_TAGS.has(tagName);
    const startsIgnoredRegion =
      !isClosing && /\bdata-rules-ignore(?:\s|=|>|\/)/i.test(rawTag);

    if (!ignoredStack.length) {
      if (!startsIgnoredRegion) continue;

      output.push(source.slice(copyFrom, match.index));
      copyFrom = match.index + rawTag.length;
      if (!isSelfClosing) ignoredStack.push(tagName);
      continue;
    }

    if (!isClosing && !isSelfClosing) {
      ignoredStack.push(tagName);
      continue;
    }

    if (isClosing) {
      const matchingIndex = ignoredStack.lastIndexOf(tagName);
      if (matchingIndex >= 0) ignoredStack.length = matchingIndex;

      if (!ignoredStack.length) copyFrom = match.index + rawTag.length;
    }
  }

  if (!ignoredStack.length) output.push(source.slice(copyFrom));
  return output.join(" ");
}

export function extractRulesChunksFromHtml(html) {
  const source = stripRulesIgnoredHtml(html);
  const main = source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? source;
  const headingPattern = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings = [...main.matchAll(headingPattern)];
  const seen = new Set();

  return headings
    .map((heading, index) => {
      const title = htmlToText(heading[2]);
      const contentStart = Number(heading.index) + heading[0].length;
      const contentEnd = index + 1 < headings.length ? Number(headings[index + 1].index) : main.length;
      const text = htmlToText(main.slice(contentStart, contentEnd)).replace(
        /\s+(?:Game Goal|Setup|Walkthrough|Cards|Turn Flow|Attack|Creature Language|Slots|Coral|Reference)$/i,
        "",
      );
      const key = `${normalize(title)}:${normalize(text)}`;

      if (!title || !text || seen.has(key)) return null;
      seen.add(key);
      return { title, text, source: "current" };
    })
    .filter(Boolean);
}

function tokenize(value) {
  const words = normalize(value).split(/\s+/).filter(Boolean);
  const usefulWords = words.filter((word) => !STOP_WORDS.has(word));
  return [...new Set(usefulWords.map((word) => SYNONYM_CANONICAL.get(word) ?? word))];
}

function stem(word) {
  if (word.endsWith("ing") && word.length > 5) {
    let root = word.slice(0, -3);
    if (root.at(-1) === root.at(-2)) root = root.slice(0, -1);
    return root;
  }
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
  return word;
}

function lexicalTokens(value) {
  return [...new Set(
    normalize(value)
      .split(/\s+/)
      .filter((word) => word && !STOP_WORDS.has(word))
      .map(stem),
  )];
}

function intentPhrase(value) {
  return normalize(value)
    .split(/\s+/)
    .filter((word) => word && !PHRASE_STOP_WORDS.has(word))
    .map(stem)
    .join(" ");
}

function scoreChunk(question, chunk) {
  const queryTokens = tokenize(question);
  const searchableTitle = [chunk.title, ...(chunk.aliases ?? [])].join(" ");
  const searchableText = [chunk.text, ...(chunk.keywords ?? [])].join(" ");
  const titleTokens = new Set(tokenize(searchableTitle));
  const textTokens = new Set(tokenize(searchableText));
  const exactQueryTokens = lexicalTokens(question);
  const exactTitleTokens = new Set(lexicalTokens(searchableTitle));
  const exactTextTokens = new Set(lexicalTokens(searchableText));
  const exactPhrase = normalize(chunk.text).includes(normalize(question)) ? 8 : 0;
  const queryIntent = intentPhrase(question);
  const titleIntent = intentPhrase(chunk.title);
  const titlePhrase = queryIntent.includes(" ") && titleIntent.includes(queryIntent) ? 16 : 0;

  const semanticScore = queryTokens.reduce((score, token) => {
    if (titleTokens.has(token)) return score + 4;
    if (textTokens.has(token)) return score + 1;
    return score;
  }, exactPhrase + titlePhrase);

  return exactQueryTokens.reduce((score, token) => {
    if (exactTitleTokens.has(token)) return score + 8;
    if (exactTextTokens.has(token)) return score + 2;
    return score;
  }, semanticScore);
}

function shorten(text, maxLength = 520) {
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

export function findRulesAnswer(question, chunks) {
  const normalizedQuestion = normalize(question);
  if (!normalizedQuestion) return null;

  if (/^(hello|hey|hi|howdy)( there)?$/.test(normalizedQuestion)) {
    return {
      title: "Hi, fellow SeaPal!",
      text: "Ask me about setup, turns, attacks, card types, habitats, coral, or winning the game.",
      confidence: "greeting",
    };
  }

  const dieNotationAnswer = explainDieNotation(question);
  if (dieNotationAnswer) return dieNotationAnswer;

  const best = findRelevantRules(question, chunks, { limit: 1 })[0];

  if (!best) return null;

  return {
    title: best.title,
    text: shorten(best.text),
    confidence: best.score >= 5 ? "high" : "related",
  };
}

export function explainDieNotation(question) {
  const value = String(question ?? "");
  const matches = [...value.matchAll(/\b(\d+)?\s*D(\d+)(?:\s*([+-])\s*(\d+))?(?:\s*(?:[xX\u00d7*])\s*(\d+))?\b/gi)];
  if (new Set(matches.map((candidate) => candidate[0].replace(/\s+/g, "").toUpperCase())).size !== 1) return null;
  const match = matches[0];
  if (!match) return null;

  const count = Number(match[1] || 1);
  const sides = Number(match[2]);
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(sides) || sides < 1) return null;

  const normalizedQuestion = normalize(value);
  const asksAboutNotation =
    normalizedQuestion === normalize(match[0])
    || /\b(explain|mean|means|meaning|notation)\b/.test(normalizedQuestion)
    || /\bhow\b.*\b(work|works|roll|rolled)\b/.test(normalizedQuestion)
    || /^what\s+(?:does|is)\b/.test(normalizedQuestion);
  if (!asksAboutNotation) return null;

  const modifier = match[3] ? Number(`${match[3]}${match[4]}`) : 0;
  const multiplier = match[5] ? Number(match[5]) : 1;
  const notation = `${match[1] ? count : ""}D${sides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? modifier : ""}${multiplier !== 1 ? ` × ${multiplier}` : ""}`;
  const modifierExplanation = modifier > 0
    ? ` Then add ${modifier} to the number rolled.`
    : modifier < 0
      ? ` Then subtract ${Math.abs(modifier)} from the number rolled; the final total cannot go below zero.`
      : "";
  const rollExplanation = count === 1
    ? `roll one ${sides}-sided die`
    : `roll ${count} ${sides}-sided dice and add them together`;
  const naturalMinimum = count;
  const naturalMaximum = count * sides;
  const multiplierExplanation = multiplier !== 1
    ? ` Then multiply that result by ${multiplier}, so the possible unmodified results are ${naturalMinimum * multiplier} through ${naturalMaximum * multiplier} in steps of ${multiplier}.`
    : "";

  return {
    title: `Dice notation: ${notation}`,
    text: `${notation} means ${rollExplanation}.${modifierExplanation}${multiplierExplanation} The natural dice total can be any whole number from ${naturalMinimum} through ${naturalMaximum}. In SeaPals, use the final result for the damage, healing, attack, defense, or other effect named by the card.`,
    confidence: "high",
  };
}

export function findRelevantRules(question, chunks, { limit = 4, minScore = 2 } = {}) {
  if (!normalize(question)) return [];

  return chunks
    .map((chunk) => ({ ...chunk, score: scoreChunk(question, chunk) }))
    .filter((chunk) => chunk.score >= minScore)
    .sort((a, b) =>
      b.score - a.score
      || getSourcePriority(b.source) - getSourcePriority(a.source)
      || a.text.length - b.text.length,
    )
    .slice(0, Math.max(1, Number(limit) || 1));
}

export function shouldSynthesizeWithModel(relevantRules) {
  const [best, second] = relevantRules;
  if (!best) return false;
  if (best.source === "knowledge" && best.score >= 12) return false;
  if (best.score >= 18 && best.score - Number(second?.score ?? 0) >= 6) return false;
  return relevantRules.length > 1;
}

function getSourcePriority(source) {
  if (source === "ruling") return 4;
  if (source === "card") return 3;
  if (source === "knowledge") return 2;
  if (source === "current") return 1;
  return 0;
}

