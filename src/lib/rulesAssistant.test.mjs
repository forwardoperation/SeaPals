import assert from "node:assert/strict";
import test from "node:test";

import { findRulesAnswer } from "./rulesAssistant.mjs";

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

