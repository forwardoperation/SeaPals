import assert from "node:assert/strict";
import test from "node:test";

import {
  CORE_RULES,
  extractRulesChunksFromHtml,
  findRulesAnswer,
  findRelevantRules,
  shouldSynthesizeWithModel,
} from "./rulesAssistant.mjs";
import { SIMULATOR_RULES } from "./seapalsRulesKnowledge.mjs";

const chunks = [
  {
    title: "Starting a Game",
    text: "Draw 4 cards from your Foundation Deck and 4 cards from your Pals Deck. Each player starts with 3 RP.",
  },
  {
    title: "Attack",
    text: "The attacker rolls its attack die and the target rolls its defense die. The attack succeeds only when the attack total is higher.",
  },
  {
    title: "Game Goal",
    text: "The first player to reach the agreed Victory Point target wins. Victory Points only count while the card is in play.",
  },
];

test("finds setup rules using natural wording and synonyms", () => {
  const answer = findRulesAnswer("How many cards are in my starting hand?", chunks);
  assert.equal(answer?.title, "Starting a Game");
  assert.match(answer?.text ?? "", /4 cards from your Foundation Deck/);
});

test("finds combat rules when the visitor says fight", () => {
  const answer = findRulesAnswer("How does a fight work?", chunks);
  assert.equal(answer?.title, "Attack");
});

test("returns a friendly greeting without searching", () => {
  const answer = findRulesAnswer("Hi", chunks);
  assert.equal(answer?.confidence, "greeting");
});

test("does not invent an answer when the rules have no match", () => {
  assert.equal(findRulesAnswer("Who designed the logo?", chunks), null);
});

test("extracts nested rules by heading boundaries", () => {
  const html = `
    <main>
      <section>
        <div><h2>Three Decks Drive the Game</h2><p>Each player splits their deck.</p></div>
        <div><h3>Starting a Game</h3><ol><li>Draw 4 Foundation cards.</li><li>Draw 4 Pals cards.</li></ol></div>
      </section>
      <section>
        <div><h2>Read the Card, Pick a Target, Roll</h2><p>The attack indicator shows the attack die.</p></div>
        <div><h3>Example Attack</h3><div><p>Attacker must roll higher.</p><p>Ties go to the defender.</p></div></div>
      </section>
    </main>`;

  const extracted = extractRulesChunksFromHtml(html);
  assert.deepEqual(extracted[1], {
    title: "Starting a Game",
    text: "Draw 4 Foundation cards. Draw 4 Pals cards.",
    source: "current",
  });
  assert.match(extracted[3].text, /Ties go to the defender/);
});

test("every proposed question has a useful built-in answer", () => {
  const proposedQuestions = [
    "How do I start a game?",
    "How does attacking work?",
    "How do I win?",
  ];

  for (const question of proposedQuestions) {
    const answer = findRulesAnswer(question, CORE_RULES);
    assert.ok(answer, `Expected an answer for: ${question}`);
    assert.ok(answer.text.length > 50, `Expected a useful answer for: ${question}`);
  }
});
test("defense questions cannot be hijacked by the generic word game", () => {
  const rules = [
    {
      title: "Three Decks Drive the Game",
      text: "Each player splits their deck into two personal decks.",
      source: "current",
    },
    ...CORE_RULES,
  ];

  const answer = findRulesAnswer("What is defense in this game?", rules);
  assert.equal(answer?.title, "Defense rolls");
  assert.match(answer?.text ?? "", /tie goes to the defender/i);
});

test("start a game prefers the full setup over a narrower starting-hand rule", () => {
  const rules = [
    {
      title: "Draw Your Starting Hand",
      text: "Draw 4 cards from each personal deck.",
      source: "current",
    },
    {
      title: "Starting a Game",
      text: "Draw your cards, take 3 RP, play a valid foundation, and begin once every player has a foundation.",
      source: "current",
    },
  ];

  assert.equal(findRulesAnswer("How do I start a game?", rules)?.title, "Starting a Game");
});

test("rich simulator rules retrieve advanced how-to-play mechanics", () => {
  const questions = [
    ["What happens if my coral dies?", /Foundation destruction/i],
    ["How does toxic work when eaten?", /Toxic creatures/i],
    ["What do I sacrifice for an Oceanic Apex?", /Oceanic Apex/i],
    ["Why is my Coral Reef taking damage?", /Coral Reef Habitat maintenance/i],
    ["Can a reef fish use a deep slot?", /Habitat and class matching/i],
  ];

  for (const [question, expectedTitle] of questions) {
    const relevant = findRelevantRules(question, SIMULATOR_RULES, { limit: 3 });
    assert.match(relevant[0]?.title ?? "", expectedTitle, question);
  }
});

test("screenshot questions return direct, complete rules instead of model guesses", () => {
  const rules = [
    ...CORE_RULES.map((rule) => ({ ...rule, source: "knowledge" })),
    ...SIMULATOR_RULES,
  ];
  const cases = [
    ["what are conditions cards used for?", /What Conditions cards are used for/i, /shared by all players/i],
    ["how many players can play?", /How many players can play/i, /2 to 4 players/i],
    ["what do the little circles with stars in them mean under on play?", /Star icons and colored circles/i, /any subtype/i],
  ];

  for (const [question, title, answerText] of cases) {
    const relevant = findRelevantRules(question, rules, { limit: 4 });
    const answer = findRulesAnswer(question, rules);
    assert.match(relevant[0]?.title ?? "", title, question);
    assert.match(answer?.text ?? "", answerText, question);
    assert.equal(shouldSynthesizeWithModel(relevant), false, question);
  }
});

test("explains D20 and modified dice notation without relying on the model", () => {
  const rules = SIMULATOR_RULES.map((rule) => ({ ...rule, source: "knowledge" }));
  const relevant = findRelevantRules("What does D20 mean?", rules, { limit: 4 });
  const d20 = findRulesAnswer("What does D20 mean?", rules);
  const bonus = findRulesAnswer("How does D20+2 work?", rules);
  const penalty = findRulesAnswer("What does D6-1 mean?", rules);
  const multiplied = findRulesAnswer("What does 1D4 * 10 mean?", rules);

  assert.match(relevant[0]?.title ?? "", /D20 mean/i);
  assert.equal(d20?.title, "Dice notation: D20");
  assert.match(d20?.text ?? "", /20-sided die/i);
  assert.match(d20?.text ?? "", /1 through 20/i);
  assert.match(bonus?.text ?? "", /add 2/i);
  assert.match(penalty?.text ?? "", /subtract 1/i);
  assert.equal(multiplied?.title, "Dice notation: 1D4 × 10");
  assert.match(multiplied?.text ?? "", /multiply that result by 10/i);
  assert.match(multiplied?.text ?? "", /10 through 40/i);
  assert.equal(shouldSynthesizeWithModel(relevant), false);
});
