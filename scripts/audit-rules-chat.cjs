const crypto = require("node:crypto");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createJiti } = require("jiti");

const seedArgument = process.argv.find((argument) => argument.startsWith("--seed="))?.slice("--seed=".length);
const SEED = seedArgument ? Number(seedArgument) : 0x5ea5a1;
if (!Number.isInteger(SEED) || SEED < 0) throw new Error(`Invalid audit seed: ${seedArgument}`);

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function titleCase(value) {
  return String(value ?? "").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalize(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function gradeFor(accuracy) {
  if (accuracy >= 0.97) return "A+";
  if (accuracy >= 0.93) return "A";
  if (accuracy >= 0.90) return "A-";
  if (accuracy >= 0.87) return "B+";
  if (accuracy >= 0.83) return "B";
  if (accuracy >= 0.80) return "B-";
  if (accuracy >= 0.77) return "C+";
  if (accuracy >= 0.73) return "C";
  if (accuracy >= 0.70) return "C-";
  if (accuracy >= 0.60) return "D";
  return "F";
}

async function main() {
  const workspace = path.resolve(__dirname, "..");
  const moduleUrl = (...parts) => pathToFileURL(path.join(workspace, ...parts)).href;
  const jiti = createJiti(__filename, { fsCache: false });
  const { allCards } = jiti(path.join(workspace, "src", "data", "cards", "index.js"));
  const [{ CORE_RULES }, { answerRulesQuestion }, { buildRulesKnowledgeBank }, { SIMULATOR_RULES }] = await Promise.all([
    import(moduleUrl("src", "lib", "rulesAssistant.mjs")),
    import(moduleUrl("src", "lib", "rulesEngine.mjs")),
    import(moduleUrl("src", "lib", "rulesKnowledgeBank.mjs")),
    import(moduleUrl("src", "lib", "seapalsRulesKnowledge.mjs")),
  ]);

  const rules = buildRulesKnowledgeBank({ cards: allCards, coreRules: CORE_RULES, simulatorRules: SIMULATOR_RULES });
  const cards = rules.filter((entry) => entry.source === "card");
  const random = randomGenerator(SEED);
  const cases = [];
  const add = (difficulty, question, expected = {}) => cases.push({
    id: `random-${String(cases.length + 1).padStart(3, "0")}`,
    difficulty,
    question,
    expectedKind: "answer",
    ...expected,
  });
  const source = (card) => ({ expectedSourceIds: [card.id] });

  const costCards = shuffled(cards.filter((card) => card.facts.cost !== null), random).slice(0, 10);
  costCards.forEach((card) => add("easy", `What's the RP price for ${card.title}?`, {
    ...source(card),
    textIncludes: [String(card.facts.cost), "RP"],
  }));

  const vpCards = shuffled(cards.filter((card) => card.facts.victoryPoints !== null), random).slice(0, 10);
  vpCards.forEach((card) => add("easy", `While ${card.title} is in play, how many victory points does it count for?`, {
    ...source(card),
    textIncludes: [String(card.facts.victoryPoints), "VP"],
  }));

  const defenseCards = shuffled(cards.filter((card) => card.facts.defense), random).slice(0, 10);
  defenseCards.forEach((card) => add("easy", `Which defense die should ${card.title} roll?`, {
    ...source(card),
    textIncludes: [card.facts.defense],
  }));

  const typeCards = shuffled(cards, random).slice(0, 10);
  typeCards.forEach((card) => add("easy", `What type of card is ${card.title}?`, {
    ...source(card),
    textIncludes: [titleCase(card.facts.class || card.facts.category || card.facts.kind)],
  }));

  const requiredRule = (pattern) => {
    const match = rules.find((rule) => pattern.test(rule.title));
    if (!match) throw new Error(`Missing audit source ${pattern}.`);
    return match;
  };
  const mediumRules = [
    ["I just sat down to play—what cards and RP do I begin with?", /^Starting a game$/i],
    ["What's the order of decisions on my turn?", /^Turn order$/i],
    ["Where do Coral cards go when I build my deck?", /^Foundation and Pals deck routing$/i],
    ["If both combat rolls match, who gets the benefit?", /^Defense rolls$/i],
    ["What happens to extra cards when my hand is full?", /^Hand limits and overflow$/i],
    ["When does the shared Condition change?", /^What Conditions cards are used for$/i],
    ["If my upgraded Coral was already hurt, does it heal?", /^Coral upgrades$/i],
    ["What happens when I have to draw but both decks are empty?", /^How you can lose$/i, [/^Choose and draw$/i]],
    ["Do repeated attacks share one roll and target?", /^Repeated attacks$/i],
    ["How do I qualify to play an Oceanic Apex?", /^Oceanic Apex additional cost$/i],
    ["Does moving a creature refresh its once-per-turn action?", /^Action timing and cooldowns$/i],
    ["Can a cloaked creature still be chosen as an attack target?", /^Cloak and Transparency$/i],
    ["How is attacking a Creature School different?", /^Creature Schools and bait balls$/i],
    ["When does a Toxic When Eaten ability trigger?", /^Toxic creatures$/i],
    ["What does advantage do to a roll?", /^Massive, advantage, and disadvantage$/i],
  ];
  shuffled(mediumRules, random).forEach(([question, pattern, alternatives = []]) => {
    const rule = requiredRule(pattern);
    add("medium", question, { expectedSourceIds: [rule.id, ...alternatives.map((alternative) => requiredRule(alternative).id)] });
  });

  const abilityCards = shuffled(cards.filter((card) => card.facts.printedRules.length), random).slice(0, 10);
  abilityCards.forEach((card) => add("medium", `Walk me through ${card.title}'s printed ability.`, {
    ...source(card),
    textIncludes: [card.facts.printedRules[0].split(/[:.!?]/)[0]],
  }));

  const slotClasses = ["fish", "predator", "apex", "invertebrate", "filter_feeder"];
  const acceptedBySlot = {
    apex: ["fish", "predator", "apex"],
    filter_feeder: ["filter_feeder"],
    fish: ["fish"],
    invertebrate: ["invertebrate"],
    predator: ["fish", "predator"],
  };
  const placeableCards = shuffled(cards.filter((card) => card.facts.kind === "creature" && card.facts.zone && card.facts.class), random).slice(0, 10);
  placeableCards.forEach((card, index) => {
    const sameZone = index % 2 === 0;
    const zone = sameZone ? card.facts.zone : ["reef", "ocean", "deep"].find((candidate) => candidate !== card.facts.zone);
    const slotClass = slotClasses[Math.floor(random() * slotClasses.length)];
    const allowed = zone === card.facts.zone && acceptedBySlot[slotClass].includes(card.facts.class);
    add("medium", `Could I legally place ${card.title} in a ${titleCase(zone)} ${titleCase(slotClass)} slot?`, {
      ...source(card),
      textStartsWith: allowed ? "Yes" : "No",
    });
  });

  const followUpCards = shuffled(cards.filter((card) => card.facts.cost !== null && card.facts.defense), random).slice(0, 5);
  followUpCards.forEach((card, index) => {
    const conversationId = `hard-follow-up-${index + 1}`;
    add("hard", `Give me the practical rundown on ${card.title}.`, {
      ...source(card),
      conversationId,
    });
    add("hard", index % 2 ? "And what does it roll on defense?" : "Okay, and what's its cost?", {
      ...source(card),
      conversationId,
      textIncludes: index % 2 ? [card.facts.defense] : [String(card.facts.cost), "RP"],
    });
  });

  const aliasGroups = new Map();
  cards.forEach((card) => card.aliases.forEach((alias) => {
    const key = normalize(alias);
    if (!aliasGroups.has(key)) aliasGroups.set(key, { alias, cards: [] });
    aliasGroups.get(key).cards.push(card);
  }));
  const ambiguousGroups = [...aliasGroups.values()].map(({ alias, cards: matches }) => ({
    alias,
    cards: [...new Map(matches.map((card) => [card.id, card])).values()],
  }));
  const ambiguous = shuffled(ambiguousGroups.filter(({ alias, cards: matches }) => (
    matches.length > 1 && !matches.some((card) => normalize(card.title) === normalize(alias))
  )), random).slice(0, 3);
  ambiguous.forEach(({ alias }) => add("hard", `What does ${alias} do?`, { expectedKind: "clarification" }));

  add("hard", "Who composed the music for the SeaPals website?", { expectedKind: "unknown" });
  add("hard", "What year was the SeaPals logo designed?", { expectedKind: "unknown" });

  const hardRules = [
    ["My attack total equals their defense total exactly. Did my attack land?", /^How normal attacks resolve$/i],
    ["Does Cloak hide a creature completely, or can the opponent still target it?", /^Cloak and Transparency$/i],
    ["For Transparency, do I compare the printed die size or the total after modifiers?", /^Cloak and Transparency$/i],
    ["A creature ate something Toxic but has explicit Toxic immunity. Do I still flip?", /^Toxic creatures$/i],
    ["I upgrade damaged Coral from 10 max HP to 20 max HP. Is its old damage erased?", /^Coral upgrades$/i],
    ["My Coral Reef no longer has four Corals, two Fish, and two Invertebrates. What happens at turn end?", /^Coral Reef Habitat maintenance$/i, ["card:coral-reef"]],
    ["Can two copies with the same card name count as the two Fish sacrificed for an Oceanic Apex?", /^Oceanic Apex additional cost$/i],
    ["A required draw finds both of my personal decks empty. Is that an immediate loss?", /^Choose and draw$/i],
    ["If I move a card after using its action, may that physical card use the action again this turn?", /^Action timing and cooldowns$/i],
    ["An effect ignores defensive bonuses. Does the defender still receive Massive advantage?", /^Massive, advantage, and disadvantage$/i],
  ];
  hardRules.forEach(([question, pattern, alternativeIds = []]) => {
    const rule = requiredRule(pattern);
    add("hard", question, { expectedSourceIds: [rule.id, ...alternativeIds] });
  });

  if (cases.length !== 100) throw new Error(`Audit generated ${cases.length} questions instead of 100.`);

  const contexts = new Map();
  const results = cases.map((item) => {
    const context = item.conversationId ? contexts.get(item.conversationId) ?? {} : {};
    const answer = answerRulesQuestion(item.question, rules, context);
    if (item.conversationId) contexts.set(item.conversationId, answer?.context ?? context);
    const sourceIds = (answer?.sources ?? []).map((entry) => entry.id);
    const kindPass = answer?.kind === item.expectedKind;
    const sourcePass = !item.expectedSourceIds?.length || item.expectedSourceIds.some((id) => sourceIds.includes(id));
    const text = answer?.text ?? "";
    const includesPass = !item.textIncludes?.length || item.textIncludes.every((needle) => text.toLowerCase().includes(String(needle).toLowerCase()));
    const startsPass = !item.textStartsWith || text.toLowerCase().startsWith(item.textStartsWith.toLowerCase());
    return {
      ...item,
      answer,
      sourceIds,
      passed: kindPass && sourcePass && includesPass && startsPass,
      checks: { kindPass, sourcePass, includesPass, startsPass },
    };
  });

  const difficulty = Object.fromEntries(["easy", "medium", "hard"].map((level) => {
    const subset = results.filter((result) => result.difficulty === level);
    const passed = subset.filter((result) => result.passed).length;
    return [level, { passed, total: subset.length, accuracy: passed / subset.length }];
  }));
  const passed = results.filter((result) => result.passed).length;
  const citedAnswers = results.filter((result) => result.answer?.kind === "answer");
  const cited = citedAnswers.filter((result) => result.sourceIds.length).length;
  const conversationIds = [...new Set(results.map((result) => result.conversationId).filter(Boolean))];
  const successfulConversations = conversationIds.filter((conversationId) => (
    results.filter((result) => result.conversationId === conversationId).every((result) => result.passed)
  )).length;
  const clarificationCases = results.filter((result) => result.expectedKind === "clarification");
  const refusalCases = results.filter((result) => result.expectedKind === "unknown");
  const clarificationRate = clarificationCases.filter((result) => result.passed).length / clarificationCases.length;
  const refusalRate = refusalCases.filter((result) => result.passed).length / refusalCases.length;
  const citationRate = citedAnswers.length ? cited / citedAnswers.length : 0;
  const conversationRate = conversationIds.length ? successfulConversations / conversationIds.length : 0;
  const gates = {
    citation: citationRate === 1,
    clarification: clarificationRate === 1,
    easy: difficulty.easy.accuracy >= 0.97,
    followUp: conversationRate >= 0.90,
    hard: difficulty.hard.accuracy >= 0.93,
    medium: difficulty.medium.accuracy >= 0.93,
    refusal: refusalRate === 1,
  };
  const summary = {
    seed: `0x${SEED.toString(16)}`,
    questionSet: crypto.createHash("sha256").update(cases.map((item) => item.question).join("\n")).digest("hex").slice(0, 12),
    cardsInBank: cards.length,
    passed,
    total: results.length,
    accuracy: passed / results.length,
    grade: gradeFor(passed / results.length),
    citationRate,
    conversationRate,
    clarificationRate,
    refusalRate,
    difficulty,
    gates,
    goalPassed: Object.values(gates).every(Boolean),
    failures: results.filter((result) => !result.passed).map((result) => ({
      id: result.id,
      difficulty: result.difficulty,
      question: result.question,
      expectedKind: result.expectedKind,
      expectedSources: result.expectedSourceIds ?? [],
      actualKind: result.answer?.kind ?? "none",
      actualTitle: result.answer?.title ?? "",
      actualSources: result.sourceIds,
      answer: result.answer?.text ?? "",
      checks: result.checks,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));
  if (process.argv.includes("--enforce") && !summary.goalPassed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
