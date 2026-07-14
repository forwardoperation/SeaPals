import assert from "node:assert/strict";
import test from "node:test";

import { answerRulesQuestion } from "./rulesEngine.mjs";
import { buildRulesKnowledgeBank } from "./rulesKnowledgeBank.mjs";

const cards = [
  {
    id: "fairy-parrotfish",
    name: "Parrotfish",
    subtitle: "Fairy",
    kind: "creature",
    category: "fish",
    class: "fish",
    zone: "reef",
    cost: { rp: 2 },
    victoryPoints: 2,
    defense: { dice: "D6" },
    attackDice: "D6",
    actions: [{ name: "Eat", text: "Inflict 10 HP of damage to an opponent's coral." }],
  },
  {
    id: "spectacled-parrotfish",
    name: "Parrotfish",
    subtitle: "Spectacled",
    kind: "creature",
    category: "fish",
    class: "fish",
    zone: "reef",
    cost: { rp: 3 },
    defense: { dice: "D6" },
  },
  {
    id: "ocean-triggerfish",
    name: "Ocean Triggerfish",
    kind: "creature",
    category: "fish",
    class: "fish",
    zone: "ocean",
    cost: { rp: 2 },
  },
  {
    id: "storm-round",
    name: "Storm Round",
    kind: "condition",
    category: "condition",
    text: "Storm weaknesses stop affected Coral from producing RP this round.",
  },
];

const simulatorRules = [
  {
    title: "Habitat and class matching for Reef Fish and Deep slots",
    text: "A creature must match a slot's habitat and an accepted class. Predator slots accept Fish or Predators.",
    source: "knowledge",
  },
  {
    title: "Toxic creatures",
    text: "Toxic When Eaten affects the consuming creature according to its printed coin flip.",
    source: "knowledge",
  },
  {
    title: "Starting a game",
    text: "Draw 4 cards from each personal deck and begin with 3 RP.",
    source: "knowledge",
  },
  {
    title: "Coral upgrades",
    text: "Upgrading preserves existing damage rather than healing it.",
    source: "knowledge",
  },
  {
    title: "Cloak and Transparency",
    text: "Cloak grants defense but does not prevent targeting.",
    source: "knowledge",
  },
  {
    title: "How normal attacks resolve",
    text: "The attack must be higher than defense; a tie goes to the defender.",
    source: "knowledge",
  },
];

const rules = buildRulesKnowledgeBank({ cards, simulatorRules });

test("answers card questions from structured data and cites the card", () => {
  const answer = answerRulesQuestion("How much does Fairy Parrotfish cost?", rules);
  assert.equal(answer.kind, "answer");
  assert.match(answer.text, /2 RP/);
  assert.deepEqual(answer.sources.map((source) => source.id), ["card:fairy-parrotfish"]);
  assert.equal(answer.sources[0].href, "/gallery#card-fairy-parrotfish");
});

test("retains card context across two follow-up questions", () => {
  const first = answerRulesQuestion("What does Fairy Parrotfish do?", rules);
  const second = answerRulesQuestion("How much does it cost?", rules, first.context);
  const third = answerRulesQuestion("Can it go in a Predator slot?", rules, second.context);

  assert.match(second.text, /2 RP/);
  assert.match(third.text, /^Yes/);
  assert.match(third.text, /Reef habitat/);
  assert.deepEqual(third.sources.map((source) => source.id), [
    "card:fairy-parrotfish",
    "knowledge:habitat-and-class-matching-for-reef-fish-and-deep-slots",
  ]);
});

test("uses the new mechanic in a contextual what-if instead of repeating the card summary", () => {
  const first = answerRulesQuestion("What does Fairy Parrotfish do?", rules);
  const answer = answerRulesQuestion("What if it has Toxic?", rules, first.context);
  assert.equal(answer.title, "Toxic creatures");
  assert.match(answer.text, /consuming creature/i);
});

test("asks for clarification when a card name has multiple matches", () => {
  const answer = answerRulesQuestion("What does Parrotfish do?", rules);
  assert.equal(answer.kind, "clarification");
  assert.deepEqual(answer.options, ["Fairy Parrotfish", "Spectacled Parrotfish"]);
});

test("refuses unrelated questions rather than guessing", () => {
  const answer = answerRulesQuestion("Who designed the logo?", rules);
  assert.equal(answer.kind, "unknown");
  assert.equal(answer.sources.length, 0);
});

test("automatically reflects changed card data when the bank is rebuilt", () => {
  const changedCards = [{ ...cards[0], cost: { rp: 7 } }];
  const changedRules = buildRulesKnowledgeBank({ cards: changedCards, simulatorRules });
  const answer = answerRulesQuestion("How much does Fairy Parrotfish cost?", changedRules);
  assert.match(answer.text, /7 RP/);
});

test("loads maintained official rulings as cited authoritative answers", () => {
  const rulingRules = buildRulesKnowledgeBank({
    officialRulings: [{
      id: "ruling:simultaneous-victory",
      title: "Simultaneous victory ruling",
      text: "If both players reach the target together, compare their current VP totals.",
      sourceLabel: "Official ruling — Simultaneous victory",
      sourceHref: "/instructions",
    }],
  });
  const answer = answerRulesQuestion("How does the simultaneous victory ruling work?", rulingRules);
  assert.equal(answer.kind, "answer");
  assert.match(answer.text, /compare their current VP totals/i);
  assert.deepEqual(answer.sources.map((source) => source.id), ["ruling:simultaneous-victory"]);
});

test("understands possessive card names and conversational card-summary wording", () => {
  const possessive = answerRulesQuestion("Walk me through Fairy Parrotfish's printed ability.", rules);
  const rundown = answerRulesQuestion("Give me the practical rundown on Fairy Parrotfish.", rules);
  assert.equal(possessive.sources[0].id, "card:fairy-parrotfish");
  assert.equal(rundown.sources[0].id, "card:fairy-parrotfish");
});

test("recognizes okay-style cost follow-ups", () => {
  const first = answerRulesQuestion("Give me the practical rundown on Fairy Parrotfish.", rules);
  const followUp = answerRulesQuestion("Okay, and what's its cost?", rules, first.context);
  assert.match(followUp.text, /2 RP/);
  assert.equal(followUp.sources[0].id, "card:fairy-parrotfish");
});

test("reads the requested slot habitat separately from a habitat word in the card name", () => {
  const answer = answerRulesQuestion("Could I legally place Ocean Triggerfish in a Reef Fish slot?", rules);
  assert.match(answer.text, /^No/);
  assert.match(answer.text, /Ocean, not Reef/);
});

test("routes specific gameplay intents before loose lexical matches", () => {
  const cases = [
    ["I just sat down to play—what cards and RP do I begin with?", "Starting a game"],
    ["If my upgraded Coral was already hurt, does it heal?", "Coral upgrades"],
    ["Can a cloaked creature still be chosen as an attack target?", "Cloak and Transparency"],
    ["My attack total equals their defense total. Did it land?", "How normal attacks resolve"],
  ];
  cases.forEach(([question, title]) => assert.equal(answerRulesQuestion(question, rules).title, title));
});

test("combines multiple named cards with general rules and exact citations", () => {
  const answer = answerRulesQuestion(
    "How do Fairy Parrotfish and Spectacled Parrotfish interact during an attack?",
    rules,
  );
  assert.equal(answer.kind, "answer");
  assert.equal(answer.title, "How these rules work together");
  assert.match(answer.text, /Fairy Parrotfish/);
  assert.match(answer.text, /Spectacled Parrotfish/);
  assert.ok(answer.sources.length >= 2 && answer.sources.length <= 4);
  assert.ok(answer.sources.some((source) => source.href === "/gallery#card-fairy-parrotfish"));
  assert.ok(answer.sources.some((source) => source.href === "/gallery#card-spectacled-parrotfish"));
});

test("maintains six turns of multiple-card, role, ordinal, and Condition context", () => {
  const questions = [
    "What does Fairy Parrotfish do?",
    "What does Spectacled Parrotfish do?",
    "How much does the first one cost?",
    "Can the first one attack the second one?",
    "What does Storm Round do?",
    "How does the previous Condition interact with that attacker?",
  ];
  let context = {};
  const answers = questions.map((question) => {
    const answer = answerRulesQuestion(question, rules, context);
    context = answer.context;
    return answer;
  });

  assert.match(answers[2].text, /Fairy Parrotfish costs 2 RP/);
  assert.equal(answers[3].title, "How these rules work together");
  assert.equal(answers[5].title, "How these rules work together");
  assert.match(answers[5].text, /Fairy Parrotfish/);
  assert.match(answers[5].text, /Storm Round/);
  assert.equal(context.attackerId, "fairy-parrotfish");
  assert.equal(context.defenderId, "spectacled-parrotfish");
  assert.equal(context.previousConditionId, "storm-round");
  assert.equal(context.history.length, 6);
});

test("clarifies incomplete multi-card facts instead of guessing", () => {
  const answer = answerRulesQuestion(
    "Compare the defense of Fairy Parrotfish and Ocean Triggerfish.",
    rules,
  );
  assert.equal(answer.kind, "clarification");
  assert.match(answer.text, /Ocean Triggerfish's defense die/);
  assert.equal(answer.sources.length, 2);
});

test("surfaces conflicting maintained sources instead of silently choosing one", () => {
  const conflictRules = buildRulesKnowledgeBank({
    cards,
    simulatorRules: [
      {
        title: "Interaction timing alpha",
        text: "Resolve the interaction before defense.",
        source: "knowledge",
        conflictKey: "interaction timing",
        conflictValue: "before defense",
      },
      {
        title: "Interaction timing beta",
        text: "Resolve the interaction after defense.",
        source: "knowledge",
        conflictKey: "interaction timing",
        conflictValue: "after defense",
      },
    ],
  });
  const answer = answerRulesQuestion(
    "What happens if Fairy Parrotfish uses the interaction timing rule?",
    conflictRules,
  );
  assert.equal(answer.kind, "clarification");
  assert.match(answer.text, /conflicting published values/i);
  assert.equal(answer.sources.length, 2);
});
