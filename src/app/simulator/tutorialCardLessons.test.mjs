import test from "node:test";
import assert from "node:assert/strict";
import {
  GUIDED_ACADEMY_INTRO_BASELINE_CONCEPT_KEYS,
  GUIDED_ACADEMY_INTRO_CARD_ID,
  createGuidedAcademyCardLesson,
  getGuidedAcademyIntroductionStep,
  getNextGuidedAcademyIntroductionStep,
  getTutorialCardConcepts,
  getTutorialCardReferenceRules,
  mergeTutorialSeenConcepts,
} from "./tutorialCardLessons.mjs";

const mustardHillCoral = {
  id: GUIDED_ACADEMY_INTRO_CARD_ID,
  name: "Mustard Hill Coral",
  kind: "coral",
  stage: 0,
  stageLabel: "Base",
  cost: { rp: 2 },
  health: 30,
  slots: [
    { slotType: "fish", count: 1 },
    { slotType: "invertebrate", count: 1 },
  ],
  weaknesses: ["disease"],
  passives: [{ name: "Photosynthesis", text: "Collect 2 RP at the start of your turn." }],
};

test("guided Academy opens with a welcome, then teaches the real first card top to bottom", () => {
  const welcome = getGuidedAcademyIntroductionStep(0, { card: mustardHillCoral });
  const identity = getGuidedAcademyIntroductionStep(1, { card: mustardHillCoral });
  const rules = getGuidedAcademyIntroductionStep(2, { card: mustardHillCoral });
  const fit = getGuidedAcademyIntroductionStep(3, { card: mustardHillCoral });

  assert.equal(welcome.title, "Welcome to Sea Realm!");
  assert.equal(welcome.cardVisible, false);
  assert.match(welcome.message, /living ocean ecosystem.*Resource Points.*Victory Point/i);
  assert.equal(identity.cardVisible, true);
  assert.equal(identity.focus, "identity");
  assert.match(identity.message, /Base Coral.*2 RP/i);
  assert.equal(rules.focus, "rules");
  assert.match(rules.message, /Photosynthesis.*Passive/i);
  assert.equal(fit.focus, "fit");
  assert.match(fit.message, /30 HP.*1 Fish and 1 Invertebrate.*Disease.*no VP/i);
  assert.equal(fit.advanceLabel, "Start the board tour");
  assert.equal(getNextGuidedAcademyIntroductionStep(0), 1);
  assert.equal(getNextGuidedAcademyIntroductionStep(3), null);
});

test("guided Academy introduction rejects missing and invalid steps", () => {
  assert.equal(getGuidedAcademyIntroductionStep(null), null);
  assert.equal(getGuidedAcademyIntroductionStep(-1), null);
  assert.equal(getGuidedAcademyIntroductionStep(4), null);
  assert.equal(getGuidedAcademyIntroductionStep(1.5), null);
});

test("a first Support card creates one fullscreen lesson and does not repeat learned basics", () => {
  const card = {
    id: "coral-gardener",
    name: "Coral Gardener",
    kind: "support",
    text: "Search your deck for a Coral and place it into your hand.",
  };
  const lesson = createGuidedAcademyCardLesson(card, {
    seenConceptKeys: GUIDED_ACADEMY_INTRO_BASELINE_CONCEPT_KEYS,
    cardClassLabel: "Support Action",
  });

  assert.equal(lesson.cardId, card.id);
  assert.deepEqual(lesson.conceptKeys, ["kind:support"]);
  assert.match(lesson.callouts[0].text, /resolve once.*Discard pile.*never take a space/i);
  assert.equal(createGuidedAcademyCardLesson(card, {
    seenConceptKeys: [...GUIDED_ACADEMY_INTRO_BASELINE_CONCEPT_KEYS, "kind:support"],
  }), null);
});

test("new concepts on one creature are bundled and deduplicated", () => {
  const card = {
    id: "arrow-crab",
    name: "Arrow Crab",
    kind: "creature",
    category: "invertebrate",
    cost: { rp: 1 },
    victoryPoints: 1,
    defense: { dice: "D4" },
    actions: [{ name: "Scavenge", effect: { type: "discardThenSearchDeck" } }],
  };
  const concepts = getTutorialCardConcepts(card);
  const keys = concepts.map((entry) => entry.key);

  assert.deepEqual(keys, [
    "kind:creature",
    "class:invertebrate",
    "label:action",
    "stat:defense",
    "stat:victory-points",
  ]);
  const partlySeen = createGuidedAcademyCardLesson(card, {
    seenConceptKeys: ["kind:creature", "stat:defense"],
  });
  assert.deepEqual(partlySeen.conceptKeys, [
    "class:invertebrate",
    "label:action",
    "stat:victory-points",
  ]);
});

test("placeholder card references show every rule the lesson marks as learned", () => {
  const rules = getTutorialCardReferenceRules({
    text: "Printed overview.",
    passives: [{ id: "eco-boost", name: "Eco Boost", text: "Increase the RP bank cap." }],
    onPlay: [{ id: "arrive", name: "Arrive", text: "Resolve immediately." }],
    actions: [{ id: "scavenge", name: "Scavenge", text: "Discard two, then search." }],
  });
  assert.deepEqual(rules.map((rule) => rule.label), ["Rules", "Passive", "On Play", "Action"]);
  assert.match(rules.find((rule) => rule.name === "Scavenge").text, /discard two.*search/i);
});

test("Creature Schools bundle their foundation placement and School Density rules", () => {
  const concepts = getTutorialCardConcepts({
    id: "white-grunt",
    name: "White Grunt",
    kind: "creature",
    category: "fish",
    tags: ["creature-school"],
    schoolDensity: 30,
  });
  assert.ok(concepts.some((entry) => entry.key === "structure:creature-school"));
  assert.ok(concepts.some((entry) => entry.key === "mechanic:school-density"));
});

test("Mustard Hill does not reopen as a later first-encounter lesson", () => {
  assert.equal(createGuidedAcademyCardLesson(mustardHillCoral), null);
});

test("seen concept merging is stable and unique", () => {
  assert.deepEqual(
    mergeTutorialSeenConcepts(["kind:coral", "label:passive"], ["label:passive", "kind:support"]),
    ["kind:coral", "label:passive", "kind:support"],
  );
});
