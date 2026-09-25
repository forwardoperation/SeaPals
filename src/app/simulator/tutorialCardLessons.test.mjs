import test from "node:test";
import assert from "node:assert/strict";
import {
  GUIDED_ACADEMY_INTRO_BASELINE_CONCEPT_KEYS,
  GUIDED_ACADEMY_INTRO_CARD_ID,
  TUTORIAL_CARD_FOCUS_REGIONS,
  createGuidedAcademyCardLesson,
  createGuidedFoundationCardLesson,
  getNewTutorialHandCardIds,
  getGuidedAcademyIntroductionStep,
  getNextGuidedAcademyIntroductionStep,
  getTutorialCardConcepts,
  getTutorialCardFocusRegion,
  getTutorialCardReferenceRules,
  mergeTutorialSeenCardIds,
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

const brainCoral = {
  id: "brain-coral-base",
  name: "Brain Coral",
  kind: "coral",
  stage: 0,
  stageLabel: "Base",
  cost: { rp: 1 },
  health: 10,
  slots: [
    { slotType: "fish", count: 1 },
    { slotType: "invertebrate", count: 1 },
  ],
  weaknesses: ["disease"],
  passives: [{ name: "Photosynthesis", text: "Collect 1 RP at the start of your turn." }],
};

test("guided Academy opens with a welcome, then teaches the gameplay parts of the first card", () => {
  const steps = Array.from({ length: 8 }, (_, index) => (
    getGuidedAcademyIntroductionStep(index, { card: mustardHillCoral })
  ));
  const [welcome, coralRole, name, cost, rules, health, weaknesses, slots] = steps;

  assert.equal(welcome.title, "Welcome to Sea Realm!");
  assert.equal(welcome.cardVisible, false);
  assert.equal(welcome.focus, undefined);
  assert.equal(welcome.referenceMode, "printed");
  assert.match(welcome.message, /living ocean ecosystem.*read your first card/i);
  assert.equal(coralRole.cardVisible, true);
  assert.equal(coralRole.focus, "type");
  assert.match(coralRole.message, /Coral card.*foundations that stay in Your Reef.*provide homes for compatible creatures/i);
  assert.doesNotMatch(coralRole.message, /colonies|tiny animals|ocean science/i);
  assert.match(coralRole.message, /Base.*begin a new foundation.*no VP.*later cards/i);
  assert.equal(name.focus, "name");
  assert.match(name.message, /card's name.*Mustard Hill Coral/i);
  assert.equal(cost.focus, "cost");
  assert.match(cost.message, /cost to play.*2 Resource Points.*RP bank/i);
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
  assert.deepEqual(steps.slice(1).map((step) => step.focus), ["type", "name", "cost", "rules", "health", "weaknesses", "slots"]);
  assert.doesNotMatch(steps.map((step) => `${step.title} ${step.message}`).join(" "), /species strip|ocean science|Meet the real coral/i);
  assert.equal(getNextGuidedAcademyIntroductionStep(0), 1);
  assert.equal(getNextGuidedAcademyIntroductionStep(7), null);
});

test("guided Academy introduction rejects missing and invalid steps", () => {
  assert.equal(getGuidedAcademyIntroductionStep(null), null);
  assert.equal(getGuidedAcademyIntroductionStep(-1), null);
  assert.equal(getGuidedAcademyIntroductionStep(8), null);
  assert.equal(getGuidedAcademyIntroductionStep(1.5), null);
});

test("the first embedded lesson tours every gameplay-relevant part of Brain Coral before board play", () => {
  const lesson = createGuidedFoundationCardLesson(brainCoral);

  assert.equal(lesson.cardId, "brain-coral-base");
  assert.equal(lesson.referenceMode, "printed");
  assert.equal(lesson.eyebrow, "Foundation card tour");
  assert.deepEqual(
    lesson.segments.map((segment) => segment.focus),
    [undefined, "identity", "name", "cost", "rules", "health", "weaknesses", "slots"],
  );
  assert.equal(lesson.segments[0].title, "Corals are foundations for life");
  assert.match(lesson.segments[0].message, /ocean.*many corals.*foundations for life.*generate Resource Points \(RP\).*homes for sea creatures.*Brain Coral/i);
  assert.ok((lesson.segments[0].message.match(/!/g) ?? []).length >= 1, "Mr. Easterling should open the tour with energy");
  assert.equal(lesson.segments[0].focus, undefined);
  assert.equal(lesson.segments[1].title, "Base begins a Foundation");
  assert.match(lesson.segments[1].message, /Base means.*new Foundation branch.*Stage cards upgrade/i);
  assert.match(lesson.segments[3].message, /Brain Coral costs 1 RP.*RP bank/i);
  assert.match(lesson.segments[4].message, /Passive.*Photosynthesis.*Collect 1 RP/i);
  assert.match(lesson.segments[5].message, /10 HP.*destroyed/i);
  assert.match(lesson.segments[6].message, /Disease.*Condition.*stays in play.*RP production/i);
  assert.match(lesson.segments[7].message, /1 Fish and 1 Invertebrate.*one home.*match an open slot/i);
  assert.doesNotMatch(lesson.segments.map((segment) => `${segment.title} ${segment.message}`).join(" "), /species strip|ocean science|Meet the real coral/i);
  assert.equal(lesson.advanceLabel, "Place Brain Coral");
  assert.deepEqual(lesson.conceptKeys, GUIDED_ACADEMY_INTRO_BASELINE_CONCEPT_KEYS);
  assert.equal(createGuidedFoundationCardLesson({ ...brainCoral, stage: 1 }), null);
  assert.equal(createGuidedFoundationCardLesson({ ...brainCoral, kind: "creature" }), null);
});

test("every card cue uses a short pointer that lands on its printed field", () => {
  const focusKeys = ["type", "identity", "name", "cost", "rules", "health", "weaknesses", "slots", "stats"];
  for (const key of focusKeys) {
    for (const referenceMode of ["printed", "normalized"]) {
      const region = getTutorialCardFocusRegion(key, { referenceMode });
      assert.ok(region, `${key} should map for ${referenceMode} cards`);
      assert.ok(region.x >= 0 && region.y >= 0);
      assert.ok(region.width > 0 && region.height > 0);
      assert.ok(region.x + region.width <= 375);
      assert.ok(region.y + region.height <= 525);
      for (const coordinate of [region.tailX, region.tipX]) assert.ok(coordinate >= 0 && coordinate <= 375);
      for (const coordinate of [region.tailY, region.tipY]) assert.ok(coordinate >= 0 && coordinate <= 525);
      assert.ok(["up", "down", "left", "right"].includes(region.direction));
      const length = Math.hypot(region.tipX - region.tailX, region.tipY - region.tailY);
      assert.ok(length >= 34 && length <= 42, `${referenceMode} ${key} pointer should stay short and consistent`);
      const tipOnHorizontalBorder = (
        (region.tipY === region.y || region.tipY === region.y + region.height)
        && region.tipX >= region.x
        && region.tipX <= region.x + region.width
      );
      const tipOnVerticalBorder = (
        (region.tipX === region.x || region.tipX === region.x + region.width)
        && region.tipY >= region.y
        && region.tipY <= region.y + region.height
      );
      assert.equal(tipOnHorizontalBorder || tipOnVerticalBorder, true, `${referenceMode} ${key} pointer should touch its highlight`);
    }
  }
  const printedIdentity = TUTORIAL_CARD_FOCUS_REGIONS.printed.identity;
  const printedName = TUTORIAL_CARD_FOCUS_REGIONS.printed.name;
  const printedRules = TUTORIAL_CARD_FOCUS_REGIONS.printed.rules;
  assert.ok(
    printedIdentity.x + printedIdentity.width <= printedName.x,
    "the Base pointer should target only the Base label rather than the full header",
  );
  assert.ok(
    printedRules.tipX < printedRules.x + (printedRules.width / 3),
    "the rules pointer should identify the Passive label rather than empty space at the right edge",
  );
  assert.equal(getTutorialCardFocusRegion("missing"), null);
  assert.equal(getTutorialCardFocusRegion("rules", { referenceMode: "missing" }), null);
  assert.equal(new Set(Object.keys(TUTORIAL_CARD_FOCUS_REGIONS.printed)).size, Object.keys(TUTORIAL_CARD_FOCUS_REGIONS.printed).length);
  assert.deepEqual(Object.keys(TUTORIAL_CARD_FOCUS_REGIONS.normalized), Object.keys(TUTORIAL_CARD_FOCUS_REGIONS.printed));
});

test("every new Support gets a card-specific fullscreen lesson even after its generic type is known", () => {
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
  assert.deepEqual(lesson.segments.map((segment) => segment.focus), ["type", "cost", "rules"]);
  assert.match(lesson.segments[0].message, /Support Action.*resolves once.*discard pile/i);
  assert.match(lesson.segments[2].message, /Search your deck for a Coral/i);
  const knownType = createGuidedAcademyCardLesson(card, {
    seenConceptKeys: [...GUIDED_ACADEMY_INTRO_BASELINE_CONCEPT_KEYS, "kind:support"],
  });
  assert.ok(knownType, "generic concept deduplication must not suppress this card's own rules");
  assert.deepEqual(knownType.conceptKeys, []);
  assert.equal(createGuidedAcademyCardLesson(card, { seenCardIds: [card.id] }), null);
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
  assert.deepEqual(partlySeen.segments.map((segment) => segment.focus), ["type", "cost", "rules", "stats", "stats"]);
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
  const toxic = lesson.segments.find((segment) => segment.title === "Passive: Toxic");
  assert.equal(toxic.focus, "rules");
  assert.match(toxic.message, /Passive.*stays active.*If eaten/i);
  const crunch = lesson.segments.find((segment) => segment.title === "Action: Crunch");
  assert.match(crunch.message, /costs 1 RP.*D4.*Invertebrate/i);
  assert.match(lesson.segments.find((segment) => segment.title === "Defense: D4").message, /tie goes to the defender/i);
  assert.match(lesson.segments.find((segment) => segment.title === "Victory Points: 2").message, /2 VP/i);
});

test("Blue Crab and Great Barracuda keep every named ability after generic concepts are learned", () => {
  const allGenericConcepts = [
    "kind:creature",
    "class:invertebrate",
    "class:predator",
    "label:passive",
    "label:action",
    "label:on-play",
    "label:attack",
    "stat:defense",
    "stat:victory-points",
  ];
  const blueCrab = createGuidedAcademyCardLesson({
    id: "blue-crab",
    name: "Blue Crab",
    kind: "creature",
    category: "invertebrate",
    cost: { rp: 2 },
    victoryPoints: 1,
    passives: [
      { id: "eco-boost", name: "Eco Boost", text: "Increase your maximum RP bank by 1." },
      { id: "recycle", name: "Recycle", text: "When one of your fish is eaten, collect half its cost rounded up." },
    ],
    actions: [{ id: "scavenge", name: "Scavenge", text: "Choose a card from your discard and put it into your hand.", cost: { rp: 2 } }],
    defense: { dice: "D4" },
  }, { seenConceptKeys: allGenericConcepts, cardClassLabel: "Reef Invertebrate" });
  assert.deepEqual(
    blueCrab.segments.filter((segment) => /^(Passive|Action):/.test(segment.title)).map((segment) => segment.title),
    ["Passive: Eco Boost", "Passive: Recycle", "Action: Scavenge"],
  );
  assert.match(blueCrab.segments.find((segment) => segment.title === "Action: Scavenge").message, /costs 2 RP.*discard.*hand/i);
  assert.ok(blueCrab.segments.some((segment) => segment.title === "Defense: D4"));
  assert.ok(blueCrab.segments.some((segment) => segment.title === "Victory Points: 1"));

  const barracuda = createGuidedAcademyCardLesson({
    id: "great-barracuda",
    name: "Great Barracuda",
    kind: "creature",
    category: "predator",
    cost: { rp: 3 },
    victoryPoints: 3,
    onPlay: [{
      id: "quick-strike",
      name: "Quick Strike",
      text: "1 Bite. If Coral Reef is in play, perform a second Bite.",
      effects: [{ type: "attack", attackDice: "D6", target: { categories: ["fish", "predator"] } }],
    }],
    defense: { dice: "D6" },
  }, { seenConceptKeys: allGenericConcepts, cardClassLabel: "Reef Predator" });
  const quickStrike = barracuda.segments.find((segment) => segment.title === "On Play: Quick Strike");
  assert.match(quickStrike.message, /immediately.*second Bite/i);
  assert.match(quickStrike.message, /D6.*Fish or Predator/i);
  assert.ok(barracuda.segments.some((segment) => segment.title === "Defense: D6"));
  assert.ok(barracuda.segments.some((segment) => segment.title === "Victory Points: 3"));
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

test("upgrade costs and structured placement or removal rules are included in new-card tours", () => {
  const brainLesson = createGuidedAcademyCardLesson({
    id: "brain-coral-base",
    name: "Brain Coral",
    kind: "coral",
    cost: { rp: 1 },
    upgrade: {
      nextCardId: "brain-coral-stage-1",
      cost: { rp: 2 },
      text: "Upgrade to Brain Coral Stage 1.",
    },
  }, { cardClassLabel: "Base Reef Coral" });
  assert.match(
    brainLesson.segments.find((segment) => segment.title === "Upgrade").message,
    /upgrade costs 2 RP.*Brain Coral Stage 1/i,
  );

  const lionfish = {
    id: "lionfish",
    name: "Lionfish",
    kind: "creature",
    category: "fish",
    specialPlacement: {
      controller: "opponent",
      zone: "opponent-reef",
      acceptsAnyCoralSlot: true,
    },
    removalRules: {
      methods: ["specializedSupport", "successfulAttack"],
      specializedSupportCardIds: ["spearfishing"],
    },
  };
  const lionfishLesson = createGuidedAcademyCardLesson(lionfish, { cardClassLabel: "Reef Fish" });
  assert.match(
    lionfishLesson.segments.find((segment) => segment.title === "Special Placement").message,
    /opponent's ecosystem.*any open Coral slot/i,
  );
  assert.match(
    lionfishLesson.segments.find((segment) => segment.title === "Removal").message,
    /successful legal attack.*Spearfishing/i,
  );
  assert.deepEqual(
    getTutorialCardReferenceRules(lionfish).map((rule) => rule.label),
    ["Special Placement", "Removal"],
  );
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

test("Mustard Hill is toured when it is new and duplicate copies do not repeat", () => {
  assert.ok(createGuidedAcademyCardLesson(mustardHillCoral));
  assert.equal(createGuidedAcademyCardLesson(mustardHillCoral, {
    seenCardIds: [mustardHillCoral.id],
  }), null);
});

test("seen concept merging is stable and unique", () => {
  assert.deepEqual(
    mergeTutorialSeenConcepts(["kind:coral", "label:passive"], ["label:passive", "kind:support"]),
    ["kind:coral", "label:passive", "kind:support"],
  );
  assert.deepEqual(
    mergeTutorialSeenCardIds(["sea-urchin", "blue-crab"], ["blue-crab", "great-barracuda"]),
    ["sea-urchin", "blue-crab", "great-barracuda"],
  );
});

test("new hand cards queue once in arrival order and ignore known or pending copies", () => {
  assert.deepEqual(
    getNewTutorialHandCardIds(
      ["sea-urchin"],
      ["sea-urchin", "porcupine-fish", "blue-crab", "porcupine-fish"],
      { seenCardIds: ["sea-urchin"], pendingCardIds: ["blue-crab"] },
    ),
    ["porcupine-fish"],
  );
  assert.deepEqual(
    getNewTutorialHandCardIds([], ["porcupine-fish", "blue-crab", "great-barracuda"]),
    ["porcupine-fish", "blue-crab", "great-barracuda"],
  );
});
