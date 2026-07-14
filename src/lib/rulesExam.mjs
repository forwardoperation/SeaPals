import { answerRulesQuestion } from "./rulesEngine.mjs";

function requiredRule(rules, pattern) {
  const rule = rules.find((candidate) => pattern.test(candidate.title));
  if (!rule) throw new Error(`The rules exam requires a source matching ${pattern}.`);
  return rule;
}

function expected(question, rule, extra = {}) {
  return {
    id: `exam:${question.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    question,
    expectedKind: "answer",
    expectedSourceId: rule.id,
    ...extra,
  };
}

export function createRulesExam(rules, size = 500) {
  if (!Number.isInteger(size) || size < 1) throw new Error("Rules exam size must be a positive integer.");

  const setup = requiredRule(rules, /^Starting a game$/i);
  const attack = requiredRule(rules, /^How attacking works$/i);
  const conditions = requiredRule(rules, /^What Conditions cards are used for$/i);
  const players = requiredRule(rules, /^How many players can play/i);
  const icons = requiredRule(rules, /^Star icons and colored circles/i);
  const toxic = requiredRule(rules, /^Toxic creatures$/i);
  const habitat = requiredRule(rules, /^Habitat and class matching/i);
  const fairyParrotfish = requiredRule(rules, /^Fairy Parrotfish$/i);
  const coralDestruction = requiredRule(rules, /^Foundation destruction/i);
  const oceanicApex = requiredRule(rules, /^Oceanic Apex additional cost$/i);
  const coralReef = requiredRule(rules, /^Coral Reef Habitat maintenance$/i);
  const defense = requiredRule(rules, /^Defense rolls$/i);
  const win = requiredRule(rules, /^How to win$/i);
  const rp = requiredRule(rules, /^Collecting RP$/i);
  const draw = requiredRule(rules, /^Choose and draw$/i);
  const upgrade = requiredRule(rules, /^Coral upgrades$/i);
  const massive = requiredRule(rules, /^Massive, advantage/i);
  const cloak = requiredRule(rules, /^Cloak and Transparency$/i);
  const schoolDensity = requiredRule(rules, /^School Density requirements$/i);

  const questions = [
    expected("How do I start a game?", setup),
    expected("How does attacking work?", attack),
    expected("What are Condition cards for?", conditions),
    expected("How many people can play SeaPals?", players),
    expected("What do the colored star circles mean?", icons),
    expected("What happens when a Toxic creature is eaten?", toxic),
    expected("Can Reef Fish use Predator slots?", habitat),
    expected("What happens if my coral dies?", coralDestruction),
    expected("What do I sacrifice to play an Oceanic Apex?", oceanicApex),
    expected("Why is my Coral Reef taking damage?", coralReef, {
      expectedSourceIds: [coralReef.id, "card:coral-reef"],
    }),
    expected("Can a Reef Fish use a Deep slot?", habitat),
    expected("What is defense in this game?", defense),
    expected("How do I win?", win),
    expected("How do I collect RP?", rp),
    expected("When and where do I draw a card?", draw),
    expected("How do I upgrade Coral?", upgrade),
    expected("Can I attack a creature with Cloak?", cloak),
    expected("How does Massive change combat?", massive),
    expected("What is School Density for?", schoolDensity),
    expected("What does Fairy Parrotfish do?", fairyParrotfish, { conversationId: "fairy-follow-up", order: 1 }),
    expected("How much does it cost?", fairyParrotfish, { conversationId: "fairy-follow-up", order: 2 }),
    expected("Can it go in a Predator slot?", fairyParrotfish, { conversationId: "fairy-follow-up", order: 3 }),
    expected("What if it has Toxic?", toxic, { conversationId: "fairy-follow-up", order: 4 }),
    {
      id: "exam:unknown-logo-designer",
      question: "Who designed the SeaPals logo?",
      expectedKind: "unknown",
    },
    {
      id: "exam:ambiguous-parrotfish",
      question: "What does Parrotfish do?",
      expectedKind: "clarification",
    },
    {
      id: "exam:d20-notation",
      question: "What does D20 mean?",
      expectedKind: "answer",
      expectedSourceId: "how-to:dice-reference",
    },
  ];

  const generalRules = rules.filter((rule) => {
    if (rule.source === "card" || rule.source === "current") return false;
    const title = rule.title.toLowerCase();
    return !rules.some((candidate) => (
      candidate !== rule
      && candidate.source !== "card"
      && candidate.title.toLowerCase().includes(title)
      && candidate.title.length > rule.title.length
    ));
  });
  const cardRules = rules.filter((rule) => rule.source === "card");
  const titleCounts = new Map();
  cardRules.forEach((rule) => titleCounts.set(rule.title.toLowerCase(), (titleCounts.get(rule.title.toLowerCase()) ?? 0) + 1));
  const uniqueCardRules = cardRules.filter((card) => titleCounts.get(card.title.toLowerCase()) === 1);

  // Guarantee baseline coverage of every maintained general rule and card
  // before adding paraphrases and fact-specific questions.
  generalRules.forEach((rule) => questions.push(expected(`Explain ${rule.title}.`, rule)));
  uniqueCardRules.forEach((rule) => questions.push(expected(`What does ${rule.title} do?`, rule)));

  for (const rule of generalRules) {
    for (const question of [
      `How does ${rule.title} work?`,
      `What are the rules for ${rule.title}?`,
      `Tell me about ${rule.title}.`,
    ]) questions.push(expected(question, rule));
  }

  for (const rule of uniqueCardRules) {
    const facts = rule.facts ?? {};
    const cardQuestions = [
      `What type of card is ${rule.title}?`,
    ];
    if (facts.cost !== null && facts.cost !== undefined) cardQuestions.push(`How much RP does ${rule.title} cost?`);
    if (facts.victoryPoints !== null && facts.victoryPoints !== undefined) cardQuestions.push(`How many VP is ${rule.title} worth?`);
    if (facts.defense) cardQuestions.push(`What defense die does ${rule.title} use?`);
    if (facts.health !== null && facts.health !== undefined) cardQuestions.push(`How much HP does ${rule.title} have?`);
    cardQuestions.forEach((question) => questions.push(expected(question, rule)));
  }

  const seen = new Set();
  const deduplicated = questions.filter((question) => {
    if (seen.has(question.id)) return false;
    seen.add(question.id);
    return true;
  });
  if (deduplicated.length < size) {
    throw new Error(`Only ${deduplicated.length} grounded exam questions could be generated; ${size} are required.`);
  }
  return deduplicated.slice(0, size);
}

export function runRulesExam(exam, rules) {
  const contexts = new Map();
  const results = exam.map((item) => {
    const context = item.conversationId ? contexts.get(item.conversationId) ?? {} : {};
    const answer = answerRulesQuestion(item.question, rules, context);
    if (item.conversationId) contexts.set(item.conversationId, answer?.context ?? context);
    const sourceIds = (answer?.sources ?? []).map((source) => source.id);
    const kindMatches = answer?.kind === item.expectedKind;
    const expectedSourceIds = item.expectedSourceIds ?? (item.expectedSourceId ? [item.expectedSourceId] : []);
    const sourceMatches = !expectedSourceIds.length || expectedSourceIds.some((sourceId) => sourceIds.includes(sourceId));
    return {
      ...item,
      actualKind: answer?.kind ?? "none",
      actualSourceIds: sourceIds,
      answer,
      passed: kindMatches && sourceMatches,
    };
  });
  const passed = results.filter((result) => result.passed).length;
  return {
    accuracy: results.length ? passed / results.length : 0,
    failed: results.filter((result) => !result.passed),
    passed,
    results,
    total: results.length,
  };
}
