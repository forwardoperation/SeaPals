import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";
import { createCardKnowledge } from "../../lib/rulesKnowledgeBank.mjs";
import { getCreatureGameplayIntroduction, getTutorialCardReferenceRules } from "./tutorialCardLessons.mjs";

const { cardsById } = createJiti(import.meta.url, { fsCache: false })("../../data/cards/index.js");

test("Oysters matches the current printed stats and can be played before a Habitat", () => {
  const card = cardsById.oysters;
  assert.equal(card.cost.rp, 6);
  assert.equal(card.victoryPoints, 2);
  assert.equal(card.defense.dice, "D10");
  assert.deepEqual(card.playRequirements, []);
  assert.deepEqual(card.onPlay, []);
  assert.deepEqual(card.actions, []);
  const [knowledge] = createCardKnowledge([card]);
  assert.match(knowledge.text, /Eco Boost.*Add \+2.*Coral Reef.*additional \+2/);
  assert.doesNotMatch(knowledge.text, /only be played if|requires? a habitat|Add \+4/i);
  assert.equal(getTutorialCardReferenceRules(card).some((rule) => rule.label === "Requirement"), false);
});

test("Oysters tutorial explains its immediate bank bonus and extra Coral Reef benefit", () => {
  const text = getCreatureGameplayIntroduction(cardsById.oysters);
  assert.match(text, /expand your RP bank immediately/i);
  assert.match(text, /Coral Reef in either ecosystem doubles its bank bonus/i);
  assert.doesNotMatch(text, /Habitat payoff|after the ecosystem is established|Choose it when a Habitat is established/i);
});
