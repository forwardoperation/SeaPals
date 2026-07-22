import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { calculateRpBankCap } from "./gameRules.mjs";
import { getEffectiveSchoolDensityRequirement } from "./conditionRules.mjs";
import {
  SCRIPTED_TUTORIAL_CONDITION_ORDER,
  SCRIPTED_TUTORIAL_FINISH_PLAN,
  SCRIPTED_TUTORIAL_FOUNDATION_OPENING_ORDER,
  SCRIPTED_TUTORIAL_OPPONENT_TABLEAU,
  SCRIPTED_TUTORIAL_OPPONENT_TARGET_CARD_IDS,
  SCRIPTED_TUTORIAL_PLACEMENT_PLAN,
  SCRIPTED_TUTORIAL_PALS_OPENING_ORDER,
  SCRIPTED_TUTORIAL_PALS_ORDER,
  SCRIPTED_TUTORIAL_SEARCH_SEQUENCE,
  createScriptedTutorialScenario,
  getScriptedTutorialDiscardEntries,
  getScriptedTutorialFoundationDrawCardId,
  getScriptedTutorialSearchTargetCardId,
  getScriptedTutorialTurnDraw,
  isScriptedTutorialSearchTarget,
  shouldForceScriptedTutorialToxicSurvival,
} from "./tutorialScenario.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});
const { cardsById } = jiti(path.join(projectRoot, "src/data/cards/index.js"));
const { conditionCards } = jiti(path.join(projectRoot, "src/data/cards/conditions.js"));
const { CardCategory, CardKind, canCardOccupySlot } = jiti(path.join(projectRoot, "src/data/cards/types.js"));
const { prebuiltDecks } = jiti(path.join(projectRoot, "src/data/tournaments/prebuiltDecks.js"));

const conditionIds = conditionCards.map((condition) => condition.id);

function expandDeck(deck) {
  return deck.cards.flatMap((entry) => (
    cardsById[entry.cardId]
      ? Array.from({ length: entry.quantity }, () => entry.cardId)
      : []
  ));
}

function isFoundationCard(card) {
  return card?.kind === CardKind.CORAL
    || (card?.kind === CardKind.CREATURE && card.tags?.includes("creature-school"));
}

function splitDeck(deck) {
  const cards = expandDeck(deck);
  return {
    foundationCards: cards.filter((cardId) => isFoundationCard(cardsById[cardId])),
    palsCards: cards.filter((cardId) => !isFoundationCard(cardsById[cardId])),
  };
}

function conditionById(conditionId) {
  return conditionCards.find((condition) => condition.id === conditionId) ?? null;
}

function startTurnIncome(foundationCardIds, conditionId = null) {
  const condition = conditionById(conditionId);
  return 1 + foundationCardIds.reduce((total, cardId) => {
    const card = cardsById[cardId];
    const blocked = (condition?.effects ?? []).some((effect) => (
      effect.type === "preventRpGeneration"
      && effect.targetKind === CardKind.CORAL
      && effect.targetWeaknesses?.some((weakness) => card.weaknesses?.includes(weakness))
    ));
    if (blocked) return total;
    return total + (card.passives ?? []).reduce((cardTotal, passive) => (
      cardTotal + (
        passive?.effect?.type === "gainResource" && passive.effect.resource === "rp"
          ? Number(passive.effect.amount ?? 0)
          : 0
      )
    ), 0);
  }, 0);
}

function playCost(cardId, conditionId = null) {
  const card = cardsById[cardId];
  const condition = conditionById(conditionId);
  return Math.max(0, Number(card.cost?.rp ?? 0) + (condition?.effects ?? []).reduce(
    (total, effect) => total + (
      effect.type === "modifyPlayCost"
      && (!effect.targetKind || effect.targetKind === card.kind)
      && (!effect.targetCategories?.length || effect.targetCategories.includes(card.category))
        ? Number(effect.amount ?? 0)
        : 0
    ),
    0,
  ));
}

function collect(rp, foundationCardIds, creatureCardIds, conditionId) {
  const cardsInPlay = [
    ...foundationCardIds.map((cardId) => cardsById[cardId]),
    ...creatureCardIds.map((cardId) => cardsById[cardId]),
  ];
  const cap = calculateRpBankCap(cardsInPlay, conditionById(conditionId));
  return {
    cap,
    income: startTurnIncome(foundationCardIds, conditionId),
    rp: Math.min(cap, rp + startTurnIncome(foundationCardIds, conditionId)),
  };
}

function createSlots(cardId) {
  const card = cardsById[cardId];
  return (card.slots ?? []).flatMap((slot, slotIndex) => (
    Array.from({ length: Number(slot.count ?? 1) }, (_, copyIndex) => ({
      ...slot,
      id: `${cardId}:${slotIndex}:${copyIndex}`,
      occupiedBy: null,
    }))
  ));
}

function place(slotsByFoundation, foundationId, creatureId) {
  const slot = slotsByFoundation[foundationId].find((candidate) => (
    candidate.occupiedBy === null && canCardOccupySlot(cardsById[creatureId], candidate)
  ));
  assert.ok(slot, `${creatureId} should fit on ${foundationId}`);
  slot.occupiedBy = creatureId;
}

function composition(foundationIds, creatureIds) {
  return {
    corals: foundationIds.filter((cardId) => cardsById[cardId].kind === CardKind.CORAL).length,
    fish: creatureIds.filter((cardId) => cardsById[cardId].category === CardCategory.FISH).length,
    invertebrates: creatureIds.filter((cardId) => cardsById[cardId].category === CardCategory.INVERTEBRATE).length,
  };
}

test("academy scenario pins the complete opening, authored draws, searches, and conditions", () => {
  const deck = prebuiltDecks.find((candidate) => candidate.id === "murky-water");
  const split = splitDeck(deck);
  const scenario = createScriptedTutorialScenario({
    playerDeckId: deck.id,
    ...split,
    conditionCards: conditionIds,
  });

  assert.deepEqual(
    scenario.foundationCards.slice(0, 4),
    SCRIPTED_TUTORIAL_FOUNDATION_OPENING_ORDER,
  );
  assert.deepEqual(
    scenario.palsCards.slice(0, 4),
    SCRIPTED_TUTORIAL_PALS_OPENING_ORDER,
  );
  assert.deepEqual(scenario.conditionCards.slice(0, 7), SCRIPTED_TUTORIAL_CONDITION_ORDER);
  assert.equal(scenario.finishPlan.victoryTarget, 26);
  assert.equal(scenario.finishPlan.finishRound, 7);
  assert.equal(scenario.opponentTurnMode, "observe");
  assert.deepEqual(scenario.opponentStartingReefCardIds, SCRIPTED_TUTORIAL_OPPONENT_TARGET_CARD_IDS);
  assert.deepEqual(SCRIPTED_TUTORIAL_SEARCH_SEQUENCE, ["lettuce-coral-base", "hammerhead"]);
});

test("authored turn draws are stable by round and deck after any shuffle", () => {
  const expected = [
    [1, "foundation", "pillar-coral-base"],
    [2, "pals", "spanish-hogfish"],
    [3, "pals", "fairy-parrotfish"],
    [4, "pals", "great-barracuda"],
    [5, "foundation", "white-grunt"],
    [6, "pals", "whale-shark"],
    [7, "pals", "deep-sea-fishing"],
  ];
  for (const [round, deckType, cardId] of expected) {
    assert.deepEqual(getScriptedTutorialTurnDraw({ round }), { deckType, cardId });
    assert.equal(getScriptedTutorialTurnDraw({ round, deckType })?.cardId, cardId);
    assert.equal(
      getScriptedTutorialTurnDraw({ round, deckType: deckType === "pals" ? "foundation" : "pals" }),
      null,
    );
  }
  assert.equal(getScriptedTutorialTurnDraw({ round: 8 }), null);
  assert.equal(getScriptedTutorialFoundationDrawCardId("blue-water"), "pillar-coral-base");

  const shuffledFoundation = ["white-grunt", "lettuce-coral-base", "brain-coral-stage-2", "pillar-coral-base"].reverse();
  const shuffledPals = ["whale-shark", "great-barracuda", "deep-sea-fishing", "fairy-parrotfish", "spanish-hogfish"].reverse();
  for (const [round, deckType, cardId] of expected) {
    const deck = deckType === "foundation" ? shuffledFoundation : shuffledPals;
    assert.ok(deck.includes(cardId), `round ${round} draw remains addressable by id after a shuffle`);
  }
});

test("Support search targets advance from the fourth Coral to the Apex", () => {
  const candidates = ["lettuce-coral-base", "hammerhead", "reef-shark"];
  assert.equal(getScriptedTutorialSearchTargetCardId({ searchCandidates: candidates }), "lettuce-coral-base");
  assert.equal(getScriptedTutorialSearchTargetCardId({
    cardsInPlay: ["lettuce-coral-base"],
    searchCandidates: candidates,
  }), "hammerhead");
  assert.equal(getScriptedTutorialSearchTargetCardId({
    cardsInPlay: ["lettuce-coral-base"],
    cardsInHand: ["hammerhead"],
    searchCandidates: candidates,
  }), null);
  assert.equal(isScriptedTutorialSearchTarget("lettuce-coral-base"), true);
  assert.equal(isScriptedTutorialSearchTarget("hammerhead"), true);
  assert.equal(isScriptedTutorialSearchTarget("spanish-hogfish"), false);
});

test("temporary academy loaners preserve every starter deck's length and source arrays", () => {
  for (const playerDeckId of ["coral-garden", "murky-water", "blue-water"]) {
    const deck = prebuiltDecks.find((candidate) => candidate.id === playerDeckId);
    const split = splitDeck(deck);
    const foundationBefore = [...split.foundationCards];
    const palsBefore = [...split.palsCards];
    const scenario = createScriptedTutorialScenario({
      playerDeckId,
      ...split,
      conditionCards: conditionIds,
    });
    assert.equal(scenario.foundationCards.length, split.foundationCards.length);
    assert.equal(scenario.palsCards.length, split.palsCards.length);
    assert.deepEqual(split.foundationCards, foundationBefore);
    assert.deepEqual(split.palsCards, palsBefore);

    const originalIds = new Set([...split.foundationCards, ...split.palsCards]);
    const requiredIds = new Set([
      ...SCRIPTED_TUTORIAL_FOUNDATION_OPENING_ORDER,
      "pillar-coral-base",
      "lettuce-coral-base",
      "white-grunt",
      ...SCRIPTED_TUTORIAL_PALS_ORDER,
    ]);
    for (const cardId of requiredIds) {
      assert.ok(
        scenario.foundationCards.includes(cardId) || scenario.palsCards.includes(cardId),
        `${playerDeckId} receives ${cardId}`,
      );
      if (!originalIds.has(cardId)) {
        assert.ok(scenario.loanerCardIds.includes(cardId), `${cardId} is marked as a loaner`);
      }
    }
  }
});

test("the seven-round curriculum is legal, teaches Coral Reef, School Density, Filter Feeders, and reaches exactly 26 VP", () => {
  const plan = SCRIPTED_TUTORIAL_FINISH_PLAN;
  let rp = 3;
  let foundations = [];
  const creatures = [];

  // Setup: Mustard Hill starts the economy.
  rp -= playCost(plan.setupCardId);
  foundations.push(plan.setupCardId);
  assert.equal(rp, 1);

  // Round 1: Pillar Coral adds income and the future Predator slot.
  let turn = collect(rp, foundations, creatures, "abundant-sunlight");
  assert.deepEqual(turn, { cap: 10, income: 3, rp: 4 });
  rp = turn.rp - playCost(plan.economyCardId, "abundant-sunlight");
  foundations.push(plan.economyCardId);
  assert.equal(rp, 1);

  // Round 2: Coral Gardener finds Lettuce; two inexpensive Corals broaden the reef.
  turn = collect(rp, foundations, creatures, "clear-water");
  assert.deepEqual(turn, { cap: 8, income: 5, rp: 6 });
  rp = turn.rp;
  assert.equal(playCost(plan.reefBuilderCardId, "clear-water"), 1);
  assert.equal(playCost(plan.searchedCoralCardId, "clear-water"), 1);
  rp -= playCost(plan.reefBuilderCardId, "clear-water");
  rp -= playCost(plan.searchedCoralCardId, "clear-water");
  foundations.push(plan.reefBuilderCardId, plan.searchedCoralCardId);
  assert.equal(rp, 4);
  assert.equal(foundations.length, plan.coralRequirement.corals);

  // Round 3: two Invertebrates, one Fish, Crunch, and the first mature upgrade.
  turn = collect(rp, foundations, creatures, "algae-bloom");
  assert.deepEqual(turn, { cap: 8, income: 7, rp: 8 });
  rp = turn.rp;
  for (const cardId of [plan.bankBoostCardId, plan.utilityCardId, plan.attackCardId]) {
    rp -= playCost(cardId, "algae-bloom");
    creatures.push(cardId);
  }
  const crunch = cardsById[plan.attackCardId].actions.find((action) => action.id === "crunch");
  assert.equal(crunch.effect.type, "attack");
  assert.deepEqual(crunch.effect.target.categories, [CardCategory.INVERTEBRATE]);
  rp -= Number(crunch.cost.rp);
  assert.ok(3 > 2, "Brain Coral remained in play for a full round before Stage 1");
  rp -= Number(cardsById[plan.reefBuilderCardId].upgrade.cost.rp);
  foundations = foundations.map((cardId) => (
    cardId === plan.reefBuilderCardId ? plan.reefBuilderStageOneCardId : cardId
  ));
  assert.equal(rp, 1);

  const beforeSecondFish = composition(foundations, creatures);
  assert.deepEqual(beforeSecondFish, { corals: 4, fish: 1, invertebrates: 2 });
  assert.ok(beforeSecondFish.fish < plan.coralRequirement.fish);

  // Round 4: the second Fish unlocks Coral Reef; Murky Water makes the
  // Barracuda + Stage 2 package exactly affordable.
  turn = collect(rp, foundations, creatures, "murky-water");
  assert.deepEqual(turn, { cap: 9, income: 8, rp: 9 });
  rp = turn.rp;
  rp -= playCost(plan.reefFishCardId, "murky-water");
  creatures.push(plan.reefFishCardId);
  assert.deepEqual(composition(foundations, creatures), plan.coralRequirement);

  const habitat = cardsById[plan.habitatCardId];
  const requirement = habitat.playRequirements.find((entry) => entry.type === "ecosystemComposition");
  assert.deepEqual(
    [requirement.minimumReefCorals, requirement.minimumReefFish, requirement.minimumReefInvertebrates],
    [4, 2, 2],
  );
  rp -= playCost(plan.habitatCardId, "murky-water");
  assert.equal(playCost(plan.predatorCardId, "murky-water"), 2);
  rp -= playCost(plan.predatorCardId, "murky-water");
  creatures.push(plan.predatorCardId);
  assert.ok(4 > 3, "Brain Coral Stage 1 matured before Stage 2");
  rp -= Number(cardsById[plan.reefBuilderStageOneCardId].upgrade.cost.rp);
  foundations = foundations.map((cardId) => (
    cardId === plan.reefBuilderStageOneCardId ? plan.reefBuilderStageTwoCardId : cardId
  ));
  assert.equal(rp, 0);

  // Round 5: bleaching suppresses vulnerable Coral income, but White Grunt
  // starts a Creature School and establishes 30 School Density.
  turn = collect(rp, foundations, creatures, "severe-coral-bleaching");
  assert.deepEqual(turn, { cap: 9, income: 8, rp: 8 });
  rp = turn.rp;
  assert.ok(cardsById[plan.creatureSchoolCardId].tags.includes("creature-school"));
  assert.equal(cardsById[plan.creatureSchoolCardId].schoolDensity, plan.creatureSchoolDensity);
  rp -= playCost(plan.creatureSchoolCardId, "severe-coral-bleaching");
  foundations.push(plan.creatureSchoolCardId);
  assert.equal(rp, 6);

  // Round 6: Krill Bloom reduces Whale Shark's School Density requirement
  // from 180 to the White Grunt school's exact 30. Coral Reef satisfies its
  // habitat requirement, and its Ocean zone needs no coral slot.
  turn = collect(rp, foundations, creatures, "krill-ball");
  assert.deepEqual(turn, { cap: 9, income: 12, rp: 9 });
  rp = turn.rp;
  const filterFeeder = cardsById[plan.filterFeederCardId];
  assert.equal(filterFeeder.category, CardCategory.FILTER_FEEDER);
  assert.equal(filterFeeder.zone, "ocean");
  assert.ok(filterFeeder.playRequirements.some((entry) => (
    typeof entry === "string" && /Open Ocean or Coral Reef Habitat/i.test(entry)
  )));
  assert.deepEqual(
    getEffectiveSchoolDensityRequirement(filterFeeder, ["krill-ball"]),
    {
      printedRequirement: plan.filterFeederPrintedDensityRequirement,
      effectiveRequirement: plan.creatureSchoolDensity,
      discount: {
        conditionId: "krill-ball",
        amount: plan.filterFeederDensityDiscount,
        label: "Krill Bloom",
      },
    },
  );
  rp -= playCost(plan.filterFeederCardId, "krill-ball");
  creatures.push(plan.filterFeederCardId);
  assert.equal(rp, 0);

  // Round 7: Bleak Overcast demonstrates a smaller bank without blocking the
  // zero-cost search Support or the final Apex. Hammerhead caps the lesson.
  turn = collect(rp, foundations, creatures, "bleak-overcast");
  assert.deepEqual(turn, { cap: 7, income: 12, rp: 7 });
  rp = turn.rp;
  assert.equal(cardsById[plan.apexSearchSupportCardId].kind, CardKind.SUPPORT);
  assert.deepEqual(cardsById[plan.apexSearchSupportCardId].effects[0].targetCategories, [
    CardCategory.PREDATOR,
    CardCategory.APEX,
  ]);
  rp -= playCost(plan.apexCardId, "bleak-overcast");
  creatures.push(plan.apexCardId);
  assert.equal(rp, 1);

  const slots = Object.fromEntries(foundations.map((cardId) => [cardId, createSlots(cardId)]));
  place(slots, plan.setupCardId, plan.bankBoostCardId);
  place(slots, plan.setupCardId, plan.attackCardId);
  place(slots, plan.economyCardId, plan.utilityCardId);
  place(slots, plan.economyCardId, plan.reefFishCardId);
  place(slots, plan.economyCardId, plan.predatorCardId);
  place(slots, plan.reefBuilderStageTwoCardId, plan.apexCardId);

  const vp = creatures.reduce(
    (total, cardId) => total + Number(cardsById[cardId].victoryPoints ?? 0),
    0,
  );
  assert.equal(vp - Number(cardsById[plan.apexCardId].victoryPoints), plan.preApexVp);
  assert.equal(Number(cardsById[plan.apexCardId].victoryPoints), plan.apexVp);
  assert.equal(vp, plan.victoryTarget);
});

test("the curriculum covers every core Reef card kind/class and both attack and utility rules text", () => {
  const plan = SCRIPTED_TUTORIAL_FINISH_PLAN;
  const lessonIds = [
    plan.setupCardId,
    plan.coralSearchSupportCardId,
    plan.bankBoostCardId,
    plan.utilityCardId,
    plan.secondInvertebrateCardId,
    plan.attackCardId,
    plan.reefFishCardId,
    plan.habitatCardId,
    plan.predatorCardId,
    plan.creatureSchoolCardId,
    plan.filterFeederCardId,
    plan.apexSearchSupportCardId,
    plan.apexCardId,
  ];
  const lessonCards = lessonIds.map((cardId) => cardsById[cardId]);
  assert.deepEqual(new Set(lessonCards.map((card) => card.kind)), new Set([
    CardKind.CORAL,
    CardKind.SUPPORT,
    CardKind.CREATURE,
    CardKind.HABITAT,
  ]));
  for (const category of [
    CardCategory.INVERTEBRATE,
    CardCategory.FISH,
    CardCategory.PREDATOR,
    CardCategory.FILTER_FEEDER,
    CardCategory.APEX,
  ]) {
    assert.ok(lessonCards.some((card) => card.category === category), `${category} is taught`);
  }

  assert.ok(cardsById[plan.bankBoostCardId].passives.some((passive) => passive.id === "eco-boost"));
  const munchAction = cardsById[plan.utilityCardId].actions.find((action) => action.id === "munch");
  assert.equal(munchAction.effect.type, "flipCoin");
  assert.equal(Number(munchAction.cost.rp), 0);
  assert.ok(cardsById[plan.attackCardId].actions.some((action) => action.effect?.type === "attack"));
  assert.ok(cardsById[plan.predatorCardId].onPlay.some((ability) => (
    ability.effects?.some((effect) => effect.type === "attack")
  )));
  assert.ok(cardsById[plan.creatureSchoolCardId].tags.includes("creature-school"));
  assert.equal(cardsById[plan.filterFeederCardId].schoolDensityRequirement, 180);
  assert.ok(cardsById[plan.apexCardId].onPlay.some((ability) => (
    ability.effects?.some((effect) => effect.type === "damage")
  )));
  assert.ok(cardsById[plan.apexCardId].onPlay.some((ability) => (
    ability.effects?.some((effect) => effect.type === "attack" && Number(effect.repeat) === 2)
  )));
});

test("Professor Current starts with enough legal targets for every authored attack", () => {
  const targets = SCRIPTED_TUTORIAL_OPPONENT_TARGET_CARD_IDS.map((cardId) => cardsById[cardId]);
  assert.equal(
    targets.filter((card) => card.category === CardCategory.INVERTEBRATE).length,
    1,
  );
  assert.equal(
    targets.filter((card) => [CardCategory.FISH, CardCategory.PREDATOR].includes(card.category)).length,
    4,
  );
  assert.ok(targets.every(Boolean));
});

test("the authored Porcupine Fish lesson cannot randomly discard required finishers", () => {
  assert.equal(shouldForceScriptedTutorialToxicSurvival({
    attackerCardId: "hammerhead",
    toxicSourceCardId: "porcupine-fish",
  }), true);
  assert.equal(shouldForceScriptedTutorialToxicSurvival({
    attackerCardId: "great-barracuda",
    toxicSourceCardId: "porcupine-fish",
  }), true);
  assert.equal(shouldForceScriptedTutorialToxicSurvival({
    attackerCardId: "reef-shark",
    toxicSourceCardId: "porcupine-fish",
  }), false);
  assert.equal(shouldForceScriptedTutorialToxicSurvival({
    attackerCardId: "great-barracuda",
    toxicSourceCardId: "frogfish",
  }), false);
});

test("Professor Current's practice targets occupy legal slots and preserve Ravage", () => {
  const placedCardIds = [];
  for (const definition of SCRIPTED_TUTORIAL_OPPONENT_TABLEAU) {
    const foundation = cardsById[definition.foundationCardId];
    assert.ok(foundation, `${definition.foundationCardId} resolves`);
    assert.ok(Number(foundation.health ?? 0) > 10, `${foundation.name} survives Parrotfish Eat`);
    const slots = (foundation.slots ?? []).flatMap((slot) => (
      Array.from({ length: Number(slot.count ?? 1) }, () => ({ ...slot, occupied: false }))
    ));
    for (const placement of definition.placements) {
      const creature = cardsById[placement.cardId];
      const slot = slots.find((candidate) => (
        !candidate.occupied
        && candidate.slotClass === placement.slotClass
        && canCardOccupySlot(creature, candidate)
      ));
      assert.ok(slot, `${placement.cardId} legally fits ${definition.foundationCardId}`);
      slot.occupied = true;
      placedCardIds.push(placement.cardId);
    }
  }
  assert.deepEqual(new Set(placedCardIds), new Set(SCRIPTED_TUTORIAL_OPPONENT_TARGET_CARD_IDS));
});

test("the authored placement plan reserves Predator and Apex slots", () => {
  assert.deepEqual(SCRIPTED_TUTORIAL_PLACEMENT_PLAN["great-barracuda"], {
    foundationCardId: "pillar-coral-base",
    slotClass: "predator",
  });
  assert.deepEqual(SCRIPTED_TUTORIAL_PLACEMENT_PLAN.hammerhead, {
    foundationCardId: "brain-coral-stage-2",
    slotClass: "apex",
  });
  assert.deepEqual(
    Object.keys(SCRIPTED_TUTORIAL_PLACEMENT_PLAN).sort(),
    [
      "arrow-crab",
      "fairy-parrotfish",
      "great-barracuda",
      "hammerhead",
      "nudibranch",
      "spanish-hogfish",
    ],
  );
});

test("legacy Scavenge discard helper refuses every protected curriculum card", () => {
  const entries = [
    { cardId: "brain-coral-stage-2", index: 0 },
    { cardId: "coral-reef", index: 1 },
    { cardId: "great-barracuda", index: 2 },
    { cardId: "remote-search", index: 3 },
    { cardId: "dr-evans", index: 4 },
  ];
  assert.deepEqual(getScriptedTutorialDiscardEntries(entries).map((entry) => entry.cardId), [
    "remote-search",
    "dr-evans",
  ]);
});
