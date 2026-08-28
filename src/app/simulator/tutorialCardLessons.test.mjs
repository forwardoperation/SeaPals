import test from "node:test";
import assert from "node:assert/strict";
import {
  GUIDED_ACADEMY_INTRO_BASELINE_CONCEPT_KEYS,
  GUIDED_ACADEMY_INTRO_CARD_ID,
  TUTORIAL_CARD_FOCUS_REGIONS,
  createGuidedAcademyCardLesson,
  getGuidedAcademyIntroductionStep,
  getNextGuidedAcademyIntroductionStep,
  getTutorialCardConcepts,
  getTutorialCardFocusRegion,
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
  bio: { role: "Reef Builder" },
  weaknesses: [],
  passives: [{ name: "Photosynthesis", text: "Collect 2 RP at the start of your turn." }],
};

test("guided Academy opens with a welcome, then teaches the real first card top to bottom", () => {
  const steps = Array.from({ length: 9 }, (_, index) => (
    getGuidedAcademyIntroductionStep(index, { card: mustardHillCoral })
  ));
  const [welcome, coralRole, name, cost, species, rules, health, weaknesses, slots] = steps;

  assert.equal(welcome.title, "Welcome to Sea Realm!");
  assert.equal(welcome.cardVisible, false);
  assert.equal(welcome.focus, undefined);
  assert.equal(welcome.referenceMode, "printed");
  assert.match(welcome.message, /living ocean ecosystem.*read your first card/i);
  assert.equal(coralRole.cardVisible, true);
  assert.equal(coralRole.focus, "type");
  assert.match(coralRole.message, /card is one playable game piece.*Coral card.*foundations that stay in Your Reef.*provide homes for compatible creatures/i);
  assert.match(coralRole.message, /Base.*begin a new foundation.*no VP.*later cards/i);
  assert.equal(name.focus, "name");
  assert.match(name.message, /card's name.*Mustard Hill Coral/i);
  assert.equal(cost.focus, "cost");
  assert.match(cost.message, /cost to play.*2 Resource Points.*RP bank/i);
  assert.equal(species.focus, "species");
  assert.match(species.message, /real organism.*Coral group.*size.*weight.*region/i);
  assert.equal(rules.focus, "rules");
  assert.match(rules.message, /Passive.*Photosynthesis/i);
  assert.equal(health.focus, "health");
  assert.match(health.message, /30 HP.*damage.*destroyed/i);
  assert.equal(weaknesses.focus, "weaknesses");
  assert.match(weaknesses.message, /area is blank.*no printed Weakness/i);
  assert.doesNotMatch(weaknesses.message, /Disease/i);
  assert.equal(slots.focus, "slots");
  assert.match(slots.message, /1 Fish and 1 Invertebrate.*match an open slot/i);
  assert.equal(slots.advanceLabel, "Start the board tour");
  assert.deepEqual(steps.slice(1).map((step) => step.focus), ["type", "name", "cost", "species", "rules", "health", "weaknesses", "slots"]);
  assert.equal(getNextGuidedAcademyIntroductionStep(0), 1);
  assert.equal(getNextGuidedAcademyIntroductionStep(8), null);
});

test("guided Academy introduction rejects missing and invalid steps", () => {
  assert.equal(getGuidedAcademyIntroductionStep(null), null);
  assert.equal(getGuidedAcademyIntroductionStep(-1), null);
  assert.equal(getGuidedAcademyIntroductionStep(9), null);
  assert.equal(getGuidedAcademyIntroductionStep(1.5), null);
});

test("every card cue maps to printed and normalized regions without covering its target", () => {
  const focusKeys = ["type", "name", "cost", "species", "rules", "health", "weaknesses", "slots", "stats"];
  for (const key of focusKeys) {
    for (const referenceMode of ["printed", "normalized"]) {
      const region = getTutorialCardFocusRegion(key, { referenceMode });
      assert.ok(region, `${key} should map for ${referenceMode} cards`);
      assert.ok(region.x >= 0 && region.y >= 0);
      assert.ok(region.width > 0 && region.height > 0);
      assert.ok(region.x + region.width <= 375);
      assert.ok(region.y + region.height <= 525);
      assert.ok(region.targetX >= 0 && region.targetX <= 375);
      assert.ok(region.targetY >= 0 && region.targetY <= 525);
      assert.match(region.path, /^M\d+/);
      const targetCoversText = region.targetX >= region.x
        && region.targetX <= region.x + region.width
        && region.targetY >= region.y
        && region.targetY <= region.y + region.height;
      assert.equal(targetCoversText, false, `${referenceMode} ${key} arrow should stop outside its text region`);
    }
  }
  assert.equal(getTutorialCardFocusRegion("missing"), null);
  assert.equal(getTutorialCardFocusRegion("rules", { referenceMode: "missing" }), null);
  assert.equal(new Set(Object.keys(TUTORIAL_CARD_FOCUS_REGIONS.printed)).size, Object.keys(TUTORIAL_CARD_FOCUS_REGIONS.printed).length);
  assert.deepEqual(Object.keys(TUTORIAL_CARD_FOCUS_REGIONS.normalized), Object.keys(TUTORIAL_CARD_FOCUS_REGIONS.printed));
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
  assert.equal(lesson.referenceMode, "normalized");
  assert.deepEqual(lesson.conceptKeys, ["kind:support"]);
  assert.match(lesson.callouts[0].text, /resolve once.*Discard pile.*never take a space/i);
  assert.deepEqual(lesson.segments, [{
    id: "kind:support",
    title: "New card type: Support",
    message: lesson.callouts[0].text,
    focus: "type",
  }]);
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
  assert.deepEqual(partlySeen.segments.map((segment) => segment.focus), ["type", "rules", "stats"]);
});

test("Porcupine Fish teaches Toxic separately from its paid Crunch attack", () => {
  const lesson = createGuidedAcademyCardLesson({
    id: "porcupine-fish",
    name: "Porcupine Fish",
    kind: "creature",
    category: "fish",
    cost: { rp: 2 },
    victoryPoints: 2,
    defense: { dice: "D4" },
    passives: [{ id: "toxic", name: "Toxic", text: "If eaten, flip a coin; on tails, discard the consuming card." }],
    actions: [{ id: "crunch", name: "Crunch", text: "Perform a D4 attack against an Invertebrate.", cost: { rp: 1 }, effect: { type: "attack" } }],
  }, { seenConceptKeys: GUIDED_ACADEMY_INTRO_BASELINE_CONCEPT_KEYS });

  assert.ok(lesson.conceptKeys.includes("mechanic:toxic"));
  assert.ok(lesson.conceptKeys.includes("label:action"));
  assert.ok(lesson.conceptKeys.includes("label:attack"));
  const toxic = lesson.segments.find((segment) => segment.id === "mechanic:toxic");
  assert.equal(toxic.focus, "rules");
  assert.match(toxic.message, /stays active.*If eaten.*Crunch is a separate paid attack/i);
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
