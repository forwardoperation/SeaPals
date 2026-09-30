import test from "node:test";
import assert from "node:assert/strict";
import {
  GUIDED_ACADEMY_INTRO_BASELINE_CONCEPT_KEYS,
  GUIDED_ACADEMY_INTRO_CARD_ID,
  TUTORIAL_CARD_FOCUS_REGIONS,
  createGuidedAcademyCardLesson,
  createGuidedFoundationCardLesson,
  getCreatureGameplayIntroduction,
  getNewTutorialHandCardIds,
  getGuidedAcademyIntroductionStep,
  getNextGuidedAcademyIntroductionStep,
  getTutorialCardConcepts,
  getTutorialCardFocusRegion,
  getTutorialCardLessonSubject,
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

const clownfish = {
  id: "clownfish",
  name: "Clownfish",
  kind: "creature",
  category: "fish",
  image: "/images/cards/fish/Reef/Clownfish.png",
  cost: { rp: 2 },
  victoryPoints: 2,
  defense: { dice: "D4" },
  passives: [{ name: "Symbiosis", text: "Can be placed inside an anemone's slots." }],
};

const supportCard = {
  id: "remote-search",
  name: "Remote Search",
  kind: "support",
  text: "Search your deck for a card.",
};

const habitatCard = {
  id: "coral-reef",
  name: "Coral Reef",
  kind: "habitat",
  text: "Meet the printed ecosystem requirements before playing this Habitat.",
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
  assert.equal(coralRole.focus, "identity");
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
  assert.deepEqual(steps.slice(1).map((step) => step.focus), ["identity", "name", "cost", "rules", "health", "weaknesses", "slots"]);
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
    [undefined, "identity", "name", "class-icon", "cost", "rules", "health", "weaknesses", "slots"],
  );
  assert.equal(lesson.segments[0].title, "Corals are foundations for life");
  assert.match(lesson.segments[0].message, /ocean.*many corals.*foundations for life.*generate Resource Points \(RP\).*homes for sea creatures.*Brain Coral/i);
  assert.ok((lesson.segments[0].message.match(/!/g) ?? []).length >= 1, "Mr. Easterling should open the tour with energy");
  assert.equal(lesson.segments[0].focus, undefined);
  assert.equal(lesson.segments[1].title, "Base begins a Foundation");
  assert.match(lesson.segments[1].message, /Base means.*new Foundation branch.*Stage cards upgrade/i);
  const reefCoralIcon = lesson.segments.find((segment) => segment.id === "reef-coral-type-icon");
  assert.equal(reefCoralIcon.title, "Match the Reef Coral icon");
  assert.equal(reefCoralIcon.focus, "class-icon");
  assert.match(reefCoralIcon.message, /Coral icon.*top-right.*Reef Coral label.*rule refers to a Reef Coral.*Brain Coral qualifies/i);
  const iconRegion = getTutorialCardFocusRegion(reefCoralIcon.focus, brainCoral);
  assert.deepEqual([iconRegion.tipX, iconRegion.tipY], [348, 43]);
  const playCost = lesson.segments.find((segment) => segment.id === "play-cost");
  assert.equal(playCost.title, "Check the RP cost", "step titles remain available as accessible labels");
  assert.equal(playCost.focus, "cost");
  assert.match(playCost.message, /Brain Coral costs 1 RP.*RP bank/i);
  assert.match(lesson.segments[5].message, /Passive.*Photosynthesis.*Collect 1 RP/i);
  assert.match(lesson.segments[6].message, /10 HP.*destroyed/i);
  assert.match(lesson.segments[7].message, /Disease.*Condition.*stays in play.*RP production/i);
  assert.match(lesson.segments[8].message, /1 Fish and 1 Invertebrate.*one home.*match an open slot/i);
  assert.doesNotMatch(lesson.segments.map((segment) => `${segment.title} ${segment.message}`).join(" "), /species strip|ocean science|Meet the real coral/i);
  assert.equal(lesson.advanceLabel, "Place Brain Coral");
  assert.deepEqual(lesson.conceptKeys, GUIDED_ACADEMY_INTRO_BASELINE_CONCEPT_KEYS);
  assert.equal(createGuidedFoundationCardLesson({ ...brainCoral, stage: 1 }), null);
  assert.equal(createGuidedFoundationCardLesson({ ...brainCoral, kind: "creature" }), null);
});

test("every standard-card cue uses a short pointer that lands on its printed field", () => {
  const requiredFocusKeys = [
    "type",
    "identity",
    "victory",
    "name",
    "cost",
    "class-icon",
    "rules",
    "health",
    "weaknesses",
    "slots",
    "defense",
    "density-supply",
    "density-requirement",
  ];
  const focusKeys = Object.keys(TUTORIAL_CARD_FOCUS_REGIONS);
  requiredFocusKeys.forEach((key) => assert.ok(focusKeys.includes(key), `${key} should have a dedicated focus region`));
  assert.equal(focusKeys.includes("stats"), false, "the map should not retain an ambiguous all-purpose stats region");
  for (const key of focusKeys) {
    const region = getTutorialCardFocusRegion(key, clownfish);
    assert.ok(region, `${key} should map to the printed card`);
    assert.ok(region.x >= 0 && region.y >= 0);
    assert.ok(region.width > 0 && region.height > 0);
    assert.ok(region.x + region.width <= 375);
    assert.ok(region.y + region.height <= 525);
    for (const coordinate of [region.tailX, region.tipX]) assert.ok(coordinate >= 0 && coordinate <= 375);
    for (const coordinate of [region.tailY, region.tipY]) assert.ok(coordinate >= 0 && coordinate <= 525);
    assert.ok(["up", "down", "left", "right"].includes(region.direction));
    const length = Math.hypot(region.tipX - region.tailX, region.tipY - region.tailY);
    assert.ok(length >= 34 && length <= 42, `${key} pointer should stay short and consistent`);
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
    assert.equal(tipOnHorizontalBorder || tipOnVerticalBorder, true, `${key} pointer should touch its printed field`);
  }
  const printedIdentity = TUTORIAL_CARD_FOCUS_REGIONS.identity;
  const printedVictory = TUTORIAL_CARD_FOCUS_REGIONS.victory;
  const printedName = TUTORIAL_CARD_FOCUS_REGIONS.name;
  const printedRules = TUTORIAL_CARD_FOCUS_REGIONS.rules;
  assert.notStrictEqual(printedVictory, printedIdentity, "Victory Points should have their own focus-region entry");
  assert.deepEqual(printedVictory, printedIdentity, "Victory Points should point to the printed upper-left header");
  assert.ok(
    printedIdentity.x + printedIdentity.width <= printedName.x,
    "the Base pointer should target only the Base label rather than the full header",
  );
  assert.ok(
    printedRules.tipX < printedRules.x + (printedRules.width / 3),
    "the rules pointer should identify the Passive label rather than empty space at the right edge",
  );
  assert.equal(getTutorialCardFocusRegion("missing"), null);
  assert.equal(getTutorialCardFocusRegion("stats", clownfish), null, "ambiguous stats cues should not survive the printed-card audit");
  assert.equal(new Set(Object.keys(TUTORIAL_CARD_FOCUS_REGIONS)).size, Object.keys(TUTORIAL_CARD_FOCUS_REGIONS).length);
});

test("card cue coordinates follow each printed card template", () => {
  const standardName = getTutorialCardFocusRegion("name", clownfish);
  const standardRules = getTutorialCardFocusRegion("rules", clownfish);
  const standardDefense = getTutorialCardFocusRegion("defense", clownfish);
  assert.ok(standardName.y < standardRules.y, "the creature name belongs in the top header");
  assert.ok(standardDefense.y > standardRules.y, "the creature defense die belongs at the bottom of the card");
  assert.ok(standardDefense.x + standardDefense.width < 150, "the defense cue should land on the bottom-left defense field");

  const supportName = getTutorialCardFocusRegion("name", supportCard);
  const supportRules = getTutorialCardFocusRegion("rules", supportCard);
  assert.ok(supportName);
  assert.ok(supportRules);
  assert.notDeepEqual(supportName, standardName, "Support names use a different printed position");
  assert.notDeepEqual(supportRules, standardRules, "Support rules use a different printed position");
  assert.equal(getTutorialCardFocusRegion("cost", supportCard), null, "Support cards have no printed RP play-cost field");

  const habitatName = getTutorialCardFocusRegion("name", habitatCard);
  const habitatType = getTutorialCardFocusRegion("type", habitatCard);
  const habitatRules = getTutorialCardFocusRegion("rules", habitatCard);
  assert.ok(habitatName);
  assert.ok(habitatType);
  assert.ok(habitatRules);
  assert.notDeepEqual(habitatName, standardName, "Habitat names use a different printed position");
  assert.notDeepEqual(habitatType, getTutorialCardFocusRegion("type", clownfish), "Habitat type labels use a different printed position");
  assert.notDeepEqual(habitatRules, standardRules, "Habitat rules use a different printed position");
  assert.equal(getTutorialCardFocusRegion("cost", habitatCard), null, "Habitat cards have no printed RP play-cost field");

  const stackedCost = getTutorialCardFocusRegion("cost", { ...clownfish, schoolDensityRequirement: 10 });
  const stackedDensity = getTutorialCardFocusRegion("density-requirement", { ...clownfish, schoolDensityRequirement: 10 });
  assert.deepEqual([stackedCost.tipX, stackedCost.tipY], [285, 15]);
  assert.equal(stackedCost.direction, "right", "the RP cue should approach from the name side instead of covering the class icon");
  assert.notDeepEqual(
    [stackedCost.tipX, stackedCost.tipY],
    [stackedDensity.tipX, stackedDensity.tipY],
    "RP cost and School Density need separate targets when both are stacked in the header",
  );

  const placeholderCard = { ...clownfish, image: "/images/brand/SeaPalsTCGLogoWhite.svg" };
  assert.equal(getTutorialCardFocusRegion("name", placeholderCard), null);
  assert.equal(getTutorialCardFocusRegion("defense", placeholderCard), null);
});

test("the Clownfish tour points to each printed field on the 375 by 525 card", () => {
  const lesson = createGuidedAcademyCardLesson(clownfish, { cardClassLabel: "Reef Fish" });
  const expectedTargets = [
    { title: "Meet the clownfish", focus: "name", tip: [182, 45], bounds: [80, 285, 6, 45] },
    { title: "Read the Reef Fish label", focus: "type", tip: [55, 62], bounds: [12, 117, 44, 62] },
    { title: "Match the Reef Fish icon", focus: "class-icon", tip: [348, 43], bounds: [334, 365, 7, 43] },
    { title: "Play cost: 2 RP", focus: "cost", tip: [325, 45], bounds: [285, 365, 6, 45] },
    { title: "Passive: Symbiosis", focus: "rules", tip: [45, 271], bounds: [14, 361, 271, 336] },
    { title: "Defense: D4", focus: "defense", tip: [51, 465], bounds: [10, 92, 465, 506] },
    { title: "Victory Points: 2", focus: "victory", tip: [45, 45], bounds: [10, 80, 6, 45] },
  ];

  for (const expected of expectedTargets) {
    const segment = lesson.segments.find((candidate) => candidate.title === expected.title);
    assert.equal(segment?.focus, expected.focus, `${expected.title} should use its dedicated cue`);
    const region = getTutorialCardFocusRegion(segment.focus, clownfish);
    assert.deepEqual([region.tipX, region.tipY], expected.tip);
    const [minX, maxX, minY, maxY] = expected.bounds;
    assert.ok(region.tipX >= minX && region.tipX <= maxX, `${expected.title} should land inside its printed horizontal bounds`);
    assert.ok(region.tipY >= minY && region.tipY <= maxY, `${expected.title} should land inside its printed vertical bounds`);
  }

  const genericCost = lesson.segments.find((segment) => segment.focus === "cost");
  assert.equal(genericCost.title, "Play cost: 2 RP");

  const defense = lesson.segments.find((segment) => segment.title === "Defense: D4");
  const defenseRegion = getTutorialCardFocusRegion(defense.focus, clownfish);
  assert.equal(defenseRegion.direction, "down");
  assert.notDeepEqual([defenseRegion.tipX, defenseRegion.tipY], [188, 422], "Defense must never fall back to the old centered stats cue");
});

test("creature tours introduce the printed name with strategy before teaching the class", () => {
  assert.equal(getTutorialCardLessonSubject(clownfish), "the clownfish");
  const clownfishLesson = createGuidedAcademyCardLesson(clownfish, { cardClassLabel: "Reef Fish" });
  assert.equal(clownfishLesson.title, "Meet the clownfish");
  assert.equal(clownfishLesson.segments[0].title, "Meet the clownfish");
  assert.match(clownfishLesson.message, /^Before you use the clownfish,/);
  assert.match(clownfishLesson.segments[0].message, /^The clownfish is .*ecosystem/i);
  assert.match(clownfishLesson.segments[0].message, /Symbiosis.*Anemone.*partnership/i);
  assert.match(clownfishLesson.segments[0].message, /Choose it when/i);
  assert.doesNotMatch(clownfishLesson.segments[0].message, /Reef Fish|\b2\s*(?:RP|VP)\b|\bD4\b/i);
  assert.equal(clownfishLesson.segments[0].focus, "name");
  assert.equal(clownfishLesson.segments[1].focus, "type");
  assert.equal(clownfishLesson.segments[2].focus, "class-icon");
  assert.match(clownfishLesson.segments[1].message, /Reef is the zone.*Fish is the class/i);
  assert.match(clownfishLesson.segments[2].message, /matching Reef Fish icon.*top-right.*open creature slots.*targeting rules/i);
  assert.match(clownfishLesson.segments.find((segment) => segment.title === "Play cost: 2 RP").message, /^Playing the clownfish costs 2 RP/);
  assert.match(clownfishLesson.segments.find((segment) => segment.title === "Passive: Symbiosis").message, /while the clownfish remains/);
  assert.match(clownfishLesson.segments.find((segment) => segment.title === "Defense: D4").message, /^D4 is the defense die for the clownfish/);
  assert.match(clownfishLesson.segments.find((segment) => segment.title === "Victory Points: 2").message, /^The clownfish contributes 2 VP/);
  assert.equal(clownfishLesson.advanceLabel, "Continue with the clownfish");
  const clownfishNarration = [
    clownfishLesson.message,
    ...clownfishLesson.segments.map((segment) => segment.message),
  ].join(" ");
  assert.doesNotMatch(clownfishNarration, /\bClownfish(?:['’]s|\s+(?:is|costs|contributes|remains))/);

  const arrowCrabLesson = createGuidedAcademyCardLesson({
    id: "arrow-crab",
    name: "Arrow Crab",
    kind: "creature",
    category: "invertebrate",
  }, { cardClassLabel: "Reef Invertebrate" });
  assert.equal(getTutorialCardLessonSubject({ name: "Arrow Crab", kind: "creature" }), "the arrow crab");
  assert.equal(arrowCrabLesson.segments[0].title, "Meet the arrow crab");
  assert.match(arrowCrabLesson.segments[0].message, /^The arrow crab is a utility piece/i);
  assert.doesNotMatch(arrowCrabLesson.segments[0].message, /Reef Invertebrate/i);
});

test("creature introductions pitch strategy while leaving exact specs for later steps", () => {
  const examples = [
    {
      label: "Reef Fish",
      card: clownfish,
      expected: [/ecosystem builder/i, /Symbiosis.*Anemone.*partnership/i],
    },
    {
      label: "Reef Invertebrate",
      card: {
        id: "blue-crab",
        name: "Blue Crab",
        kind: "creature",
        category: "invertebrate",
        cost: { rp: 2 },
        victoryPoints: 1,
        defense: { dice: "D4" },
        passives: [{ name: "Eco Boost", text: "Add +1 to your max resource bank while this card is in play." }],
        actions: [{ name: "Scavenge", text: "Choose a card from your discard and put it into your hand.", cost: { rp: 2 } }],
      },
      expected: [/utility engine.*resources.*right cards/i, /Scavenge.*recovers.*card.*hand/i, /Eco Boost.*RP engine/i],
    },
    {
      label: "Reef Predator",
      card: {
        id: "great-barracuda",
        name: "Great Barracuda",
        kind: "creature",
        category: "predator",
        cost: { rp: 3 },
        victoryPoints: 3,
        defense: { dice: "D6" },
        onPlay: [{
          name: "Quick Strike",
          text: "Perform one Bite. If Coral Reef is in play, perform a second Bite.",
          effects: [{ type: "attack", attackDice: "D6", target: { categories: ["fish", "predator"] } }],
        }],
      },
      expected: [/proactive hunter/i, /Quick Strike.*pressure.*Fish.*Predators/i],
    },
    {
      label: "Reef Apex",
      card: {
        id: "hammerhead",
        name: "Hammerhead",
        kind: "creature",
        category: "apex",
        cost: { rp: 6 },
        victoryPoints: 6,
        defense: { dice: "D12" },
        playRequirements: [{ text: "Can only be played if a Coral Reef Habitat is in your ecosystem." }],
        passives: [{ name: "Intimidation", text: "Opponent's fish cost +1 RP to play." }],
        onPlay: [{ name: "Ravage", text: "Damage a Coral, then perform a D8 attack twice." }],
      },
      expected: [/sturdy finisher/i, /Ravage.*foundations.*creatures/i, /Intimidation.*Fish more expensive/i],
    },
    {
      label: "Oceanic Filter Feeder",
      card: {
        id: "ocean-sunfish",
        name: "Ocean Sunfish",
        kind: "creature",
        category: "filter-feeder",
        class: "filter_feeder",
        cost: { rp: 8 },
        victoryPoints: 8,
        defense: { dice: "D8" },
        schoolDensityRequirement: 150,
        playRequirements: [
          "Requires 150 School Density.",
          "Requires Open Ocean or Coral Reef Habitat in your ecosystem.",
        ],
      },
      expected: [/late-game scoring payoff/i, /ocean engine.*major scoring play/i],
    },
    {
      label: "Oceanic Creature School",
      card: {
        id: "anchovy-ball-stage1",
        name: "Anchovy Ball",
        kind: "creature",
        category: "fish",
        tags: ["creature-school"],
        schoolDensity: 50,
        passives: ["Eco Foundation: Collect 3 RP at the start of your turn."],
        onPlay: ["Momentum: Search your deck for a Creature School."],
      },
      expected: [/foundation engine.*ocean ecosystem/i, /Momentum.*consistency/i, /Eco Foundation.*RP engine/i],
    },
  ];

  for (const { card, label, expected } of examples) {
    const introduction = getCreatureGameplayIntroduction(card, label);
    for (const pattern of expected) assert.match(introduction, pattern, `${card.id} should explain its strategic role`);
    assert.match(introduction, /Choose it when [^.]+\.$/, `${card.id} should end with a reason to play it`);
    assert.doesNotMatch(introduction, /\d|\bD(?:4|6|8|10|12|20)\b/i, `${card.id} should reserve exact specs for later steps`);
  }

  const porcupineIntroduction = getCreatureGameplayIntroduction({
    id: "porcupine-fish",
    name: "Porcupine Fish",
    kind: "creature",
    category: "fish",
    cost: { rp: 2 },
    victoryPoints: 2,
    defense: { dice: "D4" },
    passives: [{ name: "Toxic", text: "If eaten, flip a coin; on tails, discard the consuming card." }],
    actions: [{
      name: "Crunch",
      text: "Perform a D4 attack against an Invertebrate.",
      cost: { rp: 1 },
      effect: { type: "attack", attackDice: "D4", target: { categories: ["invertebrate"] } },
    }],
  }, "Reef Fish");
  assert.match(porcupineIntroduction, /Crunch.*Invertebrates/i);
  assert.match(porcupineIntroduction, /Invertebrates.*search.*recovery/i);
  assert.match(porcupineIntroduction, /Toxic.*consum.*(?:risky|dangerous)/i);
  assert.doesNotMatch(porcupineIntroduction, /\d|\bRP\b|\bVP\b|\bD4\b/i);

  const anemoneIntroduction = getCreatureGameplayIntroduction({
    id: "anemone",
    name: "Anemone",
    kind: "creature",
    category: "invertebrate",
    onPlay: [{ name: "Symbiosis", text: "Search your hand for a Clownfish and attach it inside this Anemone." }],
    passives: [{ name: "Stinging Fortress", text: "Adds defensive protection to any Clownfish inside the Anemone." }],
  }, "Reef Invertebrate");
  assert.match(anemoneIntroduction, /Symbiosis.*recruits a clownfish.*hosts it inside the anemone/i);
  assert.match(anemoneIntroduction, /Stinging Fortress.*adds protection.*clownfish/i);

  const blueCrabIntroduction = getCreatureGameplayIntroduction({
    id: "blue-crab",
    name: "Blue Crab",
    kind: "creature",
    category: "invertebrate",
    passives: [
      { name: "Eco Boost", text: "Add +1 to your max resource bank while this card is in play." },
      { name: "Recycle", text: "When one of your fish is eaten, collect half its cost rounded up." },
    ],
    actions: [{ name: "Scavenge", text: "Choose a card from your discard and put it into your hand." }],
  }, "Reef Invertebrate");
  assert.match(blueCrabIntroduction, /Recycle.*loss.*Fish.*economy/i);
  assert.match(blueCrabIntroduction, /Scavenge.*recovers.*card.*hand/i);

  const flyingFishIntroduction = getCreatureGameplayIntroduction({
    id: "flying-fish",
    name: "Flying Fish",
    kind: "creature",
    category: "fish",
    passives: [
      "Take to the Skies: If being targeted, flip a coin. If heads, the attack fails.",
      "EcoBoost: +1 RP to your bank cap.",
    ],
  }, "Oceanic Fish");
  assert.match(flyingFishIntroduction, /Take to the Skies.*incoming attack miss/i);
  assert.doesNotMatch(flyingFishIntroduction, /proactive hunter|pressure opposing/i);

  const blackMarlinIntroduction = getCreatureGameplayIntroduction({
    id: "black-marlin",
    name: "Black Marlin",
    kind: "creature",
    category: "apex",
    onPlay: ["Quick Strikes: Perform 4 D6 attacks targeting fish."],
  }, "Oceanic Apex");
  assert.match(blackMarlinIntroduction, /Quick Strikes.*(?:pressure|overwhelm).*Fish/i);
  assert.doesNotMatch(blackMarlinIntroduction, /Quick Strikes.*immediate value/i);

  assert.equal(getCreatureGameplayIntroduction(supportCard, "Support Action"), "");
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
  assert.equal(lesson.referenceMode, "printed");
  assert.deepEqual(lesson.conceptKeys, ["kind:support"]);
  assert.match(lesson.callouts[0].text, /resolve once.*Discard pile.*never take a space/i);
  assert.deepEqual(lesson.segments.map((segment) => segment.focus), ["name", "type", "cost", "rules"]);
  assert.match(lesson.segments[0].message, /Support Action.*resolves once.*discard pile/i);
  assert.match(lesson.segments.find((segment) => segment.focus === "rules").message, /Search your deck for a Coral/i);
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
  assert.equal(concepts.find((entry) => entry.key === "stat:victory-points").focus, "victory");
  assert.deepEqual(partlySeen.segments.map((segment) => segment.focus), ["name", "type", "cost", "rules", "defense", "victory"]);
});

test("Porcupine Fish teaches Toxic separately from its paid Crunch attack", () => {
  const lesson = createGuidedAcademyCardLesson({
    id: "porcupine-fish",
    name: "Porcupine Fish",
    kind: "creature",
    category: "fish",
    image: "/images/cards/fish/Reef/Porcupinefish.png",
    cost: { rp: 2 },
    victoryPoints: 2,
    defense: { dice: "D4" },
    passives: [{ id: "toxic", name: "Toxic", text: "If eaten, flip a coin; on tails, discard the consuming card." }],
    actions: [{ id: "crunch", name: "Crunch", text: "Perform a D4 attack against an Invertebrate.", cost: { rp: 1 }, effect: { type: "attack" } }],
  }, { seenConceptKeys: GUIDED_ACADEMY_INTRO_BASELINE_CONCEPT_KEYS, cardClassLabel: "Reef Fish" });

  assert.ok(lesson.conceptKeys.includes("mechanic:toxic"));
  assert.ok(lesson.conceptKeys.includes("label:action"));
  assert.ok(lesson.conceptKeys.includes("label:attack"));
  const typeLabel = lesson.segments.find((segment) => segment.focus === "type");
  assert.match(typeLabel.message, /Reef is the zone.*Fish is the class/i);
  const classIcon = lesson.segments.find((segment) => segment.focus === "class-icon");
  assert.equal(classIcon.title, "Match the Reef Fish icon");
  assert.match(classIcon.message, /top-right.*open creature slots.*targeting rules/i);
  const toxic = lesson.segments.find((segment) => segment.title === "Passive: Toxic");
  assert.equal(toxic.focus, "rules");
  assert.match(toxic.message, /Passive.*stays active.*If eaten/i);
  const crunch = lesson.segments.find((segment) => segment.title === "Action: Crunch");
  assert.equal(crunch.focus, "rules-secondary");
  assert.match(crunch.message, /costs 1 RP.*D4.*Invertebrate/i);
  const defense = lesson.segments.find((segment) => segment.title === "Defense: D4");
  assert.equal(defense.focus, "defense");
  assert.match(defense.message, /tie goes to the defender/i);
  const victoryPoints = lesson.segments.find((segment) => segment.title === "Victory Points: 2");
  assert.equal(victoryPoints.focus, "victory");
  assert.match(victoryPoints.message, /2 VP/i);
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
    stageLabel: "Base",
    cost: { rp: 1 },
    upgrade: {
      nextCardId: "brain-coral-stage-1",
      cost: { rp: 2 },
      text: "Upgrade to Brain Coral Stage 1.",
    },
  }, { cardClassLabel: "Base Reef Coral" });
  const upgradeSegment = brainLesson.segments.find((segment) => segment.title === "Current stage: Base");
  assert.equal(upgradeSegment.focus, "identity");
  assert.match(
    upgradeSegment.message,
    /Base.*current place.*next stage costs 2 RP.*Brain Coral Stage 1.*next card/i,
  );
  const coralTypeSegment = brainLesson.segments.find((segment) => segment.id === "card:brain-coral-base:identity");
  assert.equal(coralTypeSegment.title, "Read the Reef Coral label");
  assert.equal(coralTypeSegment.focus, "type");
  assert.match(coralTypeSegment.message, /printed Reef Coral strip.*Coral Foundation/i);
  assert.doesNotMatch(coralTypeSegment.message, /Base.*header/i);

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

test("Creature Schools distinguish School Density supply from creature requirements", () => {
  const supplyCard = {
    id: "white-grunt",
    name: "White Grunt",
    kind: "creature",
    category: "fish",
    tags: ["creature-school"],
    schoolDensity: 30,
  };
  const supplyConcepts = getTutorialCardConcepts(supplyCard);
  assert.ok(supplyConcepts.some((entry) => entry.key === "structure:creature-school"));
  assert.equal(supplyConcepts.find((entry) => entry.key === "mechanic:school-density").focus, "density-supply");
  assert.equal(
    createGuidedAcademyCardLesson(supplyCard).segments.find((segment) => segment.title === "School Density: 30").focus,
    "density-supply",
  );

  const requirementCard = {
    id: "ocean-sunfish",
    name: "Ocean Sunfish",
    kind: "creature",
    category: "filter-feeder",
    schoolDensityRequirement: 20,
  };
  assert.equal(
    getTutorialCardConcepts(requirementCard).find((entry) => entry.key === "mechanic:school-density").focus,
    "density-requirement",
  );
  assert.equal(
    createGuidedAcademyCardLesson(requirementCard).segments.find((segment) => segment.title === "School Density: 20").focus,
    "density-requirement",
  );
});

test("authored rule cues stay on the printed block when one block explains several data rules", () => {
  const brainCoralStageOne = {
    id: "brain-coral-stage-1",
    name: "Brain Coral",
    kind: "coral",
    category: "coral",
    stage: 1,
    stageLabel: "Stage 1",
    upgrade: { text: "Upgrade to Brain Coral Stage 2.", cost: { rp: 5 } },
    passives: [{ name: "Photosynthesis", text: "Collect 2 RP at the start of your turn." }],
  };
  const brainStageOneLesson = createGuidedAcademyCardLesson(brainCoralStageOne, { cardClassLabel: "Stage 1 - Reef Coral" });
  assert.deepEqual(
    brainStageOneLesson.segments.slice(3).map((segment) => segment.focus),
    ["identity", "rules"],
    "unprinted upgrade metadata belongs on the Stage 1 header and must not shift Photosynthesis",
  );

  const hammerhead = {
    id: "hammerhead",
    name: "Hammerhead",
    kind: "creature",
    category: "apex",
    playRequirements: ["Requires Coral Reef."],
    specialRules: ["If destroyed, place this card in your Lost Zone."],
    passives: [{ name: "Intimidation", text: "Opponent's fish cost +1 RP." }],
    onPlay: [{ name: "Ravage", text: "Attack twice." }],
  };
  const hammerheadLesson = createGuidedAcademyCardLesson(hammerhead, { cardClassLabel: "Reef Apex Predator" });
  assert.deepEqual(
    hammerheadLesson.segments.slice(3).map((segment) => segment.focus),
    ["rules", "rules", "rules-secondary", "rules-tertiary"],
    "both Special Rules explanations should point to the same printed block before Passive and On Play",
  );
  assert.equal(getTutorialCardFocusRegion("rules-tertiary", hammerhead).tipY, 386);

  const halfbeak = {
    id: "halfbeak",
    name: "Halfbeak",
    kind: "creature",
    category: "fish",
    playRequirements: ["Requires 10 School Density."],
    schoolDensityRequirement: 10,
    passives: ["Take to the Skies: Avoid an attack on heads.", "EcoBoost: +1 RP to your bank cap."],
    actions: [{ name: "Call for Family", text: "Search for a Creature School." }],
  };
  const halfbeakLesson = createGuidedAcademyCardLesson(halfbeak, { cardClassLabel: "Oceanic Fish" });
  assert.deepEqual(
    halfbeakLesson.segments.slice(3, 7).map((segment) => segment.focus),
    ["density-requirement", "rules", "rules-secondary", "rules-tertiary"],
    "the density requirement belongs in the header and must not shift the three printed abilities",
  );

  const anchovyBall = {
    id: "anchovy-ball-stage1",
    name: "Anchovy Ball",
    kind: "creature",
    category: "fish",
    tags: ["creature-school"],
    specialRules: ["Creature Schools can be attacked as fish."],
    upgrade: { text: "Upgrade to Anchovy Ball Stage 2." },
    passives: ["Eco Foundation: Collect 3 RP."],
    onPlay: ["Momentum: Search for a Creature School."],
  };
  const anchovyLesson = createGuidedAcademyCardLesson(anchovyBall, { cardClassLabel: "Creature School" });
  assert.deepEqual(
    anchovyLesson.segments.slice(3).map((segment) => segment.focus),
    ["identity", "rules", "rules-secondary", "rules-tertiary"],
    "the header upgrade is taught first before the arrow walks down the printed abilities",
  );

  const oceanSunfish = {
    id: "ocean-sunfish",
    name: "Ocean Sunfish",
    kind: "creature",
    category: "filter-feeder",
    playRequirements: [
      "Requires 150 School Density.",
      "Requires Open Ocean or Coral Reef Habitat.",
    ],
    specialRules: ["If destroyed, place this card in your Lost Zone."],
    schoolDensityRequirement: 150,
  };
  const sunfishLesson = createGuidedAcademyCardLesson(oceanSunfish, { cardClassLabel: "Filter Feeder" });
  assert.equal(sunfishLesson.segments[1].title, "Know the Filter Feeder class");
  assert.equal(getTutorialCardFocusRegion(sunfishLesson.segments[1].focus, oceanSunfish), null);
  assert.deepEqual(
    sunfishLesson.segments.slice(3, 6).map((segment) => segment.focus),
    ["density-requirement", "rules", "rules"],
    "School Density belongs in the header while both full-art Special Rules explanations share their printed block",
  );
});

test("Hammerhead's printed abilities move the arrow down the card in order", () => {
  const hammerhead = {
    id: "hammerhead",
    name: "Hammerhead",
    kind: "creature",
    category: "apex",
    cost: { rp: 6 },
    victoryPoints: 6,
    playRequirements: [{ type: "cardInPlay", cardId: "coral-reef", text: "Requires Coral Reef." }],
    passives: [{ name: "Intimidation", text: "Opponent's fish cost +1 RP to play." }],
    onPlay: [{ name: "Ravage", text: "Inflict 1D4 x 10 damage to coral. Then perform a D8 attack twice." }],
    defense: { dice: "D12" },
  };
  const lesson = createGuidedAcademyCardLesson(hammerhead, { cardClassLabel: "Reef Apex Predator" });
  const abilitySegments = lesson.segments.filter((segment) => (
    segment.title === "Requirement"
      || segment.title === "Passive: Intimidation"
      || segment.title === "On Play: Ravage"
  ));

  assert.deepEqual(
    abilitySegments.map((segment) => segment.focus),
    ["rules", "rules-secondary", "rules-tertiary"],
  );
  const tipPositions = abilitySegments.map((segment) => getTutorialCardFocusRegion(segment.focus, hammerhead).tipY);
  assert.deepEqual(tipPositions, [271, 338, 386]);
  assert.equal(new Set(tipPositions).size, 3, "each printed ability needs its own arrow landing point");
  assert.ok(tipPositions.every((position, index) => index === 0 || position > tipPositions[index - 1]));
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
