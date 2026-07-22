import assert from "node:assert/strict";
import test from "node:test";

import { answerRulesQuestion } from "./rulesEngine.mjs";
import { buildRulesKnowledgeBank } from "./rulesKnowledgeBank.mjs";
import { SIMULATOR_RULES } from "./seapalsRulesKnowledge.mjs";

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
  {
    id: "great-white",
    name: "Great White",
    kind: "creature",
    category: "apex",
    class: "apex",
    zone: "reef",
    cost: { rp: 8 },
    passives: [{ name: "Intimidation", text: "Opponent's fish cost +1 RP to play." }],
  },
  {
    id: "tiger-shark",
    name: "Tiger Shark",
    kind: "creature",
    category: "apex",
    class: "apex",
    zone: "reef",
    passives: [{ name: "Intimidation", text: "Opponent's fish cost +1 RP to play." }],
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

function buildWeakPointRules() {
  return buildRulesKnowledgeBank({
    cards: [...cards, {
      id: "black-marlin",
      name: "Black Marlin",
      kind: "creature",
      category: "apex",
      class: "apex",
      zone: "ocean",
      onPlay: ["Quick Strikes: Perform 4 D6 attacks targeting fish. Defending Fish have -1 Defense against these attacks."],
      defense: "D12",
    }],
    simulatorRules: SIMULATOR_RULES,
  });
}

function buildStrategyGapRules() {
  const strategyCards = [
    { id: "crown-of-thorns", name: "Crown of Thorns", kind: "creature", category: "invertebrate", actions: [{ name: "Stun", text: "Flip a coin. If heads, choose one of your opponent's corals and it is now stunned." }], passives: [{ name: "Toxic", text: "If eaten, flip a coin. If tails, discard the consuming creature." }] },
    { id: "giant-phantom-jelly", name: "Giant Phantom Jelly", kind: "creature", category: "apex", actions: ["Cloak in Darkness: Choose one of your opponent's coral. That coral is now stunned. You may only perform this once per turn. Cost: 0RP."] },
    { id: "man-o-war", name: "Man O' War", kind: "creature", category: "invertebrate", actions: ["Nerve Agent: Flip a coin. If heads, your opponent's coral is now stunned. Cost: 2 RP."] },
    { id: "coral-heal", name: "Coral Heal", kind: "support", text: "Choose one of your corals, remove all effects from it." },
    { id: "poison-heal", name: "Poison Heal", kind: "support", text: "On your next attack, ignore any effects from Toxic." },
    { id: "giant-triton", name: "Giant Triton", kind: "creature", category: "invertebrate", passives: [{ name: "Toxic Immunity", text: "Immune to Crown of Thorns toxic effect." }] },
    { id: "sea-urchin", name: "Sea Urchin", kind: "creature", category: "invertebrate", passives: [{ name: "Spines", text: "Add +20 HP to any coral attached to." }] },
    { id: "sargeant-major", name: "Sargeant Major", kind: "creature", category: "fish", passives: [{ name: "Coral Protector", text: "Any coral this fish is attached to gains +10 HP." }] },
    { id: "boulder-star-coral-stage-2", name: "Boulder Star Coral", stageLabel: "Stage 2", kind: "coral", health: 80, passives: [{ name: "Sturdy", text: "All corals on your reef gain +10 HP." }] },
    { id: "coral-cement", name: "Coral Cement", kind: "support", text: "Heal 20 HP on one of your corals." },
    { id: "green-sea-turtle", name: "Green Sea Turtle", kind: "creature", category: "predator", onPlay: [{ name: "Coral Heal", text: "Choose one of your corals and restore 1D6 × 10 HP." }] },
    { id: "deep_mushroom_stage2", name: "Deep Mushroom", stageLabel: "Stage 2", kind: "coral", health: 60, passives: ["Recovery: Once per turn, you may heal 10 HP of any coral on your reef."] },
    { id: "manta-ray", name: "Manta Ray", kind: "creature", category: "filter_feeder", schoolDensityRequirement: 170, cost: { rp: 8 } },
  ];
  return buildRulesKnowledgeBank({ cards: strategyCards, simulatorRules: SIMULATOR_RULES });
}

test("answers card questions from structured data and cites the card", () => {
  const answer = answerRulesQuestion("How much does Fairy Parrotfish cost?", rules);
  assert.equal(answer.kind, "answer");
  assert.match(answer.text, /2 RP/);
  assert.deepEqual(answer.sources.map((source) => source.id), ["card:fairy-parrotfish"]);
  assert.equal(answer.sources[0].href, "/gallery#card-fairy-parrotfish");
});

test("routes an exact named passive before generic ability rules", () => {
  const answer = answerRulesQuestion("what does the passive ability Intimidation do?", rules);
  assert.equal(answer.kind, "answer");
  assert.equal(answer.title, "Intimidation");
  assert.match(answer.text, /Opponent's fish cost \+1 RP to play/i);
  assert.match(answer.text, /passive ability/i);
  assert.deepEqual(answer.sources.map((source) => source.id), ["ability:intimidation", "card:tiger-shark"]);
  assert.ok(answer.sources.every((source) => source.href.startsWith("/gallery#card-")));
});

test("defines the Special Rules card label instead of substituting special hosts", () => {
  const answer = answerRulesQuestion("Can you explain to me what special rules are?", rules);
  assert.equal(answer.kind, "answer");
  assert.equal(answer.title, "Special Rules");
  assert.match(answer.text, /card-specific instructions/i);
  assert.match(answer.text, /does not mean attachments or special hosts/i);
  assert.deepEqual(answer.sources.map((source) => source.id), ["glossary:special-rules"]);
});

test("clarifies an undocumented definition instead of returning a related rule", () => {
  const answer = answerRulesQuestion("What are pressure markers?", rules);
  assert.equal(answer.kind, "clarification");
  assert.match(answer.text, /don't want to substitute a merely related rule/i);
  assert.equal(answer.sources.length, 0);
});

test("keeps the active card after explaining one of its named abilities", () => {
  const card = answerRulesQuestion("What does Great White do?", rules);
  const ability = answerRulesQuestion("What does its passive ability Intimidation do?", rules, card.context);
  const followUp = answerRulesQuestion("Okay, and what does it cost?", rules, ability.context);
  assert.equal(ability.title, "Intimidation");
  assert.match(followUp.text, /Great White costs 8 RP/);
  assert.equal(followUp.sources[0].id, "card:great-white");
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
    ["How do I start playing?", "Starting a game"],
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

test("explains that a card may use Actions on the turn it is played", () => {
  const answer = answerRulesQuestion(
    "Can I use a card's Action on the same turn I play it?",
    buildRulesKnowledgeBank({ cards, simulatorRules: SIMULATOR_RULES }),
  );

  assert.equal(answer.kind, "answer");
  assert.match(answer.text, /same turn it enters/i);
  assert.doesNotMatch(answer.text, /wait until (?:your )?next turn/i);
});

test("answers the seven reported targeting, deck-building, modifier, and attack-count questions directly", () => {
  const screenshotRules = buildWeakPointRules();
  const cases = [
    {
      question: "how do I know what can be attacked by an on play ability?",
      includes: [/target icons/i, /(?:legal|allowed) (?:card )?famil/i, /restriction/i],
    },
    {
      question: "how do I know if an attack can target a fish?",
      includes: [/fish/i, /only if/i, /target/i],
    },
    {
      question: "can you tell me the difference between a reef predator and a deep predator?",
      includes: [/(?:predator is (?:the same |a )?creature class|share the predator class)/i, /reef (?:habitat|slots?)/i, /deep (?:habitat|slots?)/i],
    },
    {
      question: "what makes a good deck?",
      includes: [/60[- ]cards?/i, /habitat/i, /foundation/i, /support/i],
    },
    {
      question: "can you help me build a new deck?",
      includes: [/choose/i, /strategy|theme/i, /60 cards/i, /4 copies/i],
    },
    {
      question: "If a defense has -2 on it, what does that mean?",
      includes: [/subtract 2/i, /defense roll/i, /die size/i],
    },
    {
      question: "what does the x4 mean for the black marlin attack?",
      includes: [/four separate attacks/i, /d6/i, /fish/i, /-1 defense/i],
    },
  ];

  for (const { question, includes } of cases) {
    const answer = answerRulesQuestion(question, screenshotRules);
    assert.equal(answer.kind, "answer", question);
    assert.ok(answer.sources.length > 0, `${question} must cite its rules`);
    for (const pattern of includes) assert.match(answer.text, pattern, question);
  }
});

test("generalizes the seven reported weak points across fresh player phrasings", () => {
  const screenshotRules = buildWeakPointRules();
  const groups = [
    {
      questions: [
        "Where do I look to see which creatures an On Play effect can hit?",
        "What tells me whether an ability is allowed to affect an Apex?",
        "Can an attack hit any Fish just because it shows Fish?",
        "How are legal targets chosen for an attack?",
        "Which icons decide who an ability can target?",
      ],
      includes: [/target/i, /restriction/i],
    },
    {
      questions: [
        "How is a Deep Fish different from a Reef Fish?",
        "Compare an Oceanic Apex with a Reef Apex.",
        "Are Reef Predators and Deep Predators the same class?",
        "What changes between a Reef Predator and an Oceanic Predator?",
        "Deep Fish versus Reef Fish: is that habitat or class?",
      ],
      includes: [/habitat zone/i, /class/i],
    },
    {
      questions: [
        "How should I put together a strong deck?",
        "Please help me create my first deck.",
        "Do you have deck-building tips for a beginner?",
        "How do I make a consistent deck?",
        "I want to start a new deck. Where do I begin?",
      ],
      includes: [/60[- ]cards?/i, /foundation/i],
    },
    {
      questions: [
        "What does +3 Attack mean?",
        "How does -1 Defense apply?",
        "Does -2 Defense shrink the die? What does it do?",
        "If an attack shows +4, how do I use that?",
        "How does a +2 roll modifier work?",
      ],
      includes: [/(?:add|subtract) \d+/i, /not the die size/i],
    },
    {
      questions: [
        "Black Marlin shows x4. What is that symbol?",
        "Does x4 on Black Marlin mean multiply the damage?",
        "For Black Marlin, how many attacks is x4?",
        "What does \u00d74 on Black Marlin do?",
        "On Black Marlin, is x4 one big attack or several attacks?",
      ],
      includes: [/four separate attacks/i, /d6/i],
    },
  ];

  for (const group of groups) {
    for (const question of group.questions) {
      const answer = answerRulesQuestion(question, screenshotRules);
      assert.equal(answer.kind, "answer", question);
      assert.ok(answer.sources.length > 0, `${question} must cite its rules`);
      for (const pattern of group.includes) assert.match(answer.text, pattern, question);
    }
  }
});

test("answers the reported Deep Fish versus Reef Fish comparison with the requested class", () => {
  const screenshotRules = buildWeakPointRules();
  const answer = answerRulesQuestion("what's the difference between a deep fish and a reef fish?", screenshotRules);

  assert.equal(answer.kind, "answer");
  assert.equal(answer.title, "Deep Fish vs. Reef Fish");
  assert.match(answer.text, /both are Fish creatures/i);
  assert.match(answer.text, /Deep habitat/i);
  assert.match(answer.text, /Reef habitat/i);
  assert.match(answer.text, /Deep Fish, Predator, or Apex slot/i);
  assert.match(answer.text, /Reef Fish, Predator, or Apex slot/i);
  assert.doesNotMatch(answer.text, /Reef Predator and a Deep Predator/i);
  assert.ok(answer.sources.length >= 2);
});

test("answers the five reported strategy and card-notation gaps directly", () => {
  const strategyRules = buildStrategyGapRules();
  const cases = [
    {
      question: "how can a coral become stunned?",
      title: "How a Coral becomes Stunned",
      includes: [/printed card effect/i, /Crown of Thorns/i, /Giant Phantom Jelly/i, /Man O' War/i, /Coral Heal/i],
    },
    {
      question: "how can you defeat a creature with toxic?",
      title: "Playing around Toxic",
      includes: [/does not make the creature immune/i, /Poison Heal/i, /Giant Triton/i, /non-consuming/i],
    },
    {
      question: "how can you best protect coral from attacks?",
      title: "Protecting Coral from attacks",
      includes: [/maximum HP/i, /Sea Urchin/i, /Sargeant Major/i, /Boulder Star Coral/i, /Coral Cement/i, /Green Sea Turtle/i, /Deep Mushroom/i],
    },
    {
      question: "what does 1d4 * 10 mean?",
      title: "Dice notation: 1D4 × 10",
      includes: [/roll one 4-sided die/i, /multiply that result by 10/i, /10 through 40/i],
    },
    {
      question: "If a cards has 170SD written on it, what does that mean?",
      title: "170 SD requirement",
      includes: [/School Density/i, /at least 170/i, /checked, not spent/i, /Manta Ray/i],
    },
  ];

  for (const { question, title, includes } of cases) {
    const answer = answerRulesQuestion(question, strategyRules);
    assert.equal(answer.kind, "answer", question);
    assert.equal(answer.title, title, question);
    assert.ok(answer.sources.length > 0, `${question} must cite its rules or cards`);
    for (const pattern of includes) assert.match(answer.text, pattern, question);
  }
});

test("generalizes the five reported strategy and notation gaps across player phrasing", () => {
  const strategyRules = buildStrategyGapRules();
  const groups = [
    { title: "How a Coral becomes Stunned", questions: ["What effects can Stun my Coral?", "How does an opponent get a coral stunned?", "Which cards can make Corals become stunned?"] },
    { title: "Playing around Toxic", questions: ["What's the safest way to attack something Toxic?", "How do I counter a Toxic creature?", "Can I get past Toxic and still beat it?"] },
    { title: "Protecting Coral from attacks", questions: ["What cards help my Coral survive damage?", "How should I defend my corals from an opponent?", "What are good ways to keep Coral safe from attacks?"] },
    { title: "Dice notation: 1D4 × 10", questions: ["How does 1D4 x10 work?", "Explain 1d4×10", "What is 1 d4 * 10 on a card?"] },
    { title: "170 SD requirement", questions: ["What is the 170 SD symbol?", "A card says 170 school density—what do I need?", "Do I spend 170SD to play the card?"] },
  ];

  for (const group of groups) {
    for (const question of group.questions) {
      const answer = answerRulesQuestion(question, strategyRules);
      assert.equal(answer.kind, "answer", question);
      assert.equal(answer.title, group.title, question);
      assert.ok(answer.sources.length > 0, `${question} must cite its rules or cards`);
    }
  }
});

test("answers every Habitat's zone-specific setup and end-turn maintenance", () => {
  const habitatRules = buildRulesKnowledgeBank({ cards: [], simulatorRules: SIMULATOR_RULES });
  const cases = [
    {
      question: "What does Coral Reef need, and when does it take maintenance damage?",
      title: "Coral Reef Habitat maintenance",
      includes: [/4 Reef Corals/i, /2 Reef Fish/i, /2 Reef Invertebrates/i, /end of .*controller's turn/i, /10 HP/i],
    },
    {
      question: "Why is my Open Ocean taking damage?",
      title: "Open Ocean Habitat maintenance",
      includes: [/4 Creature Schools/i, /2 Oceanic Fish/i, /2 Oceanic Invertebrates/i, /10 HP/i],
    },
    {
      question: "What does Abyss need to stay healthy?",
      title: "Abyss Habitat maintenance",
      includes: [/4 Deep Corals/i, /2 Deep Fish/i, /2 Deep Invertebrates/i, /10 HP/i],
    },
  ];

  for (const { question, title, includes } of cases) {
    const answer = answerRulesQuestion(question, habitatRules);
    assert.equal(answer.kind, "answer", question);
    assert.equal(answer.title, title, question);
    assert.ok(answer.sources.length > 0, `${question} must cite its rules`);
    for (const pattern of includes) assert.match(answer.text, pattern, question);
  }

  const comparison = answerRulesQuestion("How do maintenance requirements differ across all Habitats?", habitatRules);
  assert.equal(comparison.kind, "answer");
  assert.equal(comparison.title, "Habitats");
  assert.match(comparison.text, /Coral Reef.*4 Reef Corals.*2 Reef Fish.*2 Reef Invertebrates/i);
  assert.match(comparison.text, /Open Ocean.*4 Creature Schools.*2 Oceanic Fish.*2 Oceanic Invertebrates/i);
  assert.match(comparison.text, /Abyss.*4 Deep Corals.*2 Deep Fish.*2 Deep Invertebrates/i);
  assert.match(comparison.text, /end of .*controller's turn/i);
  assert.match(comparison.text, /10 HP/i);
});

test("answers the reconciled Oceanic requirements and printed bonuses", () => {
  const oceanicRules = buildRulesKnowledgeBank({ cards: [], simulatorRules: SIMULATOR_RULES });
  const cases = [
    {
      question: "Do Oceanic Apex cards always sacrifice fish, or what requirements do they use?",
      title: "Oceanic Apex additional cost",
      includes: [/card-specific/i, /Killer Whale/i, /Shortfin Mako/i, /2 Oceanic Predators/i, /not sacrificed|stay in play/i, /Bluefin Tuna.*Open Ocean/i, /Swordfish.*Open Ocean or Abyss/i],
    },
    {
      question: "How much HP does Territorial give a Creature School, and can I transfer it?",
      title: "Ocean Triggerfish Territorial",
      includes: [/\+30 HP/i, /one|1/i, /not transferable/i],
    },
    {
      question: "Does Thresher Shark's Stun Strike need Open Ocean for its +2 bonus?",
      title: "Thresher Shark requirements and Stun Strike",
      includes: [/3 Oceanic Fish/i, /roll is 4 or higher/i, /\+2/i, /does not require Open Ocean/i],
    },
  ];

  for (const { question, title, includes } of cases) {
    const answer = answerRulesQuestion(question, oceanicRules);
    assert.equal(answer.kind, "answer", question);
    assert.equal(answer.title, title, question);
    assert.ok(answer.sources.length > 0, `${question} must cite its rules`);
    for (const pattern of includes) assert.match(answer.text, pattern, question);
  }

  const protection = answerRulesQuestion("How can I protect a Creature School from attacks?", oceanicRules);
  assert.equal(protection.kind, "answer");
  assert.match(protection.text, /Territorial.*\+30 HP/i);
  assert.doesNotMatch(protection.text, /\+10 HP/i);
});
