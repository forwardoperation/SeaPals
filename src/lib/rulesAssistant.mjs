const STOP_WORDS = new Set([
  "a", "an", "and", "are", "can", "do", "does", "for", "from", "how", "i",
  "in", "is", "it", "of", "on", "or", "the", "to", "what", "when", "where",
  "which", "with", "you", "your",
]);

const SYNONYM_GROUPS = [
  ["begin", "beginning", "setup", "start", "starting"],
  ["battle", "combat", "fight", "attack", "attacking"],
  ["cost", "pay", "resource", "resources", "rp"],
  ["draw", "drawing", "hand"],
  ["goal", "victory", "win", "winning", "vp"],
  ["habitat", "place", "play", "slot", "slots"],
  ["round", "turn", "turns"],
  ["rules", "play", "game"],
];

const SYNONYMS = new Map(
  SYNONYM_GROUPS.flatMap((group) =>
    group.map((word) => [word, group.filter((candidate) => candidate !== word)]),
  ),
);

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value) {
  const words = normalize(value).split(/\s+/).filter(Boolean);
  const usefulWords = words.filter((word) => !STOP_WORDS.has(word));
  const expanded = usefulWords.flatMap((word) => [word, ...(SYNONYMS.get(word) ?? [])]);
  return [...new Set(expanded)];
}

function scoreChunk(question, chunk) {
  const queryTokens = tokenize(question);
  const titleTokens = new Set(tokenize(chunk.title));
  const textTokens = new Set(tokenize(chunk.text));
  const exactPhrase = normalize(chunk.text).includes(normalize(question)) ? 8 : 0;

  return queryTokens.reduce((score, token) => {
    if (titleTokens.has(token)) return score + 4;
    if (textTokens.has(token)) return score + 1;
    return score;
  }, exactPhrase);
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

  const ranked = chunks
    .map((chunk) => ({ ...chunk, score: scoreChunk(question, chunk) }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score || a.text.length - b.text.length);

  const best = ranked[0];
  if (!best || best.score < 2) return null;

  return {
    title: best.title,
    text: shorten(best.text),
    confidence: best.score >= 5 ? "high" : "related",
  };
}

