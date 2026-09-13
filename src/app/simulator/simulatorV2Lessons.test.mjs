import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  SIMULATOR_V2_LESSON_CONCEPTS,
  SIMULATOR_V2_LESSON_PROGRESS_KEY,
  SIMULATOR_V2_LESSON_MODULES,
  SIMULATOR_V2_LESSONS,
  createSimulatorV2LessonRuntime,
  createSimulatorV2LessonSeed,
  getSimulatorV2Lesson,
  getSimulatorV2ExpectedDraw,
  getSimulatorV2LessonHelp,
  getSimulatorV2LessonActionBlock,
  getSimulatorV2PreviouslyTaughtConcepts,
  parseSimulatorV2LessonProgress,
  recordSimulatorV2LessonCompletion,
  simulatorV2LessonIntroduces,
} from "./simulatorV2Lessons.mjs";
import {
  createSimulatorTutorialProgress,
  createSimulatorTutorialEvent,
  observeSimulatorTutorialEvent,
  getSimulatorTutorialCurrentCheckpoint,
} from "./tutorialContract.mjs";
import { addResourceWithinCap, calculateRpBankCap, calculateVictoryPoints, determineVictoryResult } from "./gameRules.mjs";
import { attackCanTargetCard } from "./combatRules.mjs";
import { createCombatRollPacket } from "./combatRollPresentation.mjs";
import { getHabitatRequirementError } from "./habitatRules.mjs";
import { createSchoolDensityBucketState } from "./schoolDensityRules.mjs";
import { createSimulatorRandomStream, sampleSimulatorRandom } from "./simulatorRandomStream.mjs";
import { getPersonalDeckType } from "./zoneRules.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, { fsCache: false, alias: { "@": path.join(projectRoot, "src") } });
const { cardsById } = jiti(path.join(projectRoot, "src/data/cards/index.js"));
const { CardKind, canCardOccupySlot } = jiti(path.join(projectRoot, "src/data/cards/types.js"));

function observe(lessonId, events) {
  const { contract } = getSimulatorV2Lesson(lessonId);
  let progress = createSimulatorTutorialProgress(contract);
  for (const [index, input] of events.entries()) {
    const event = createSimulatorTutorialEvent({
      eventId: `${contract.id}:${index}`, tutorialId: contract.id,
      actor: "player", phase: "main", round: 1, turn: 1, ...input,
    });
    progress = observeSimulatorTutorialEvent(contract, progress, event).progress;
  }
  return { contract, progress };
}

const build = (cardId, placement = undefined) => ({ actionType: "card-built", details: { cardId, cardKind: cardsById[cardId].kind, placement, cost: cardsById[cardId].cost.rp, accepted: true } });
const rp = { actionType: "rp-collected", phase: "draw", details: { collected: 4 } };
const draw = { actionType: "card-drawn", phase: "draw", details: { count: 1, palsCount: 1 } };
const vp = (to, delta) => ({ actionType: "vp-earned", details: { to, delta } });

function materializeTableau(definitions) {
  return definitions.map((definition, index) => {
    const card = cardsById[definition.foundationCardId];
    assert.ok(card, "every prepared foundation exists");
    assert.equal(getPersonalDeckType(card), "foundation", `${card.id} is legal in the Foundation zone`);
    const slots = (card.slots ?? []).flatMap((slot) => Array.from({ length: slot.count ?? 1 }, () => ({ ...slot, count: 1, cardId: null })));
    for (const placement of definition.placements) {
      const attached = cardsById[placement.cardId];
      const slot = slots.find((entry) => !entry.cardId && entry.slotClass === placement.slotClass && canCardOccupySlot(attached, entry));
      assert.ok(slot, `${placement.cardId} needs a legal ${placement.slotClass} slot on ${card.id}`);
      slot.cardId = attached.id;
    }
    return { id: `seed-${index}`, cardId: card.id, slots };
  });
}

function allCardsInPlay(foundations) {
  return foundations.flatMap((foundation) => [cardsById[foundation.cardId], ...foundation.slots.map((slot) => cardsById[slot.cardId])]).filter(Boolean);
}

function income(foundations) {
  return 1 + foundations.reduce((total, foundation) => total + (cardsById[foundation.cardId].passives ?? []).reduce((sum, passive) => sum + (
    passive.timing === "startOfTurn" && passive.effect?.type === "gainResource" && passive.effect.resource === "rp" ? passive.effect.amount : 0
  ), 0), 0);
}

const homeReefDefinition = () => ({
  foundationCardId: "mustard-hill-coral-base",
  placements: [
    { cardId: "sea-urchin", slotClass: "invertebrate" },
    { cardId: "clownfish", slotClass: "fish" },
  ],
});

test("each concept has one teaching owner and the first two lessons own their expanded curriculum", () => {
  const owners = new Map();
  for (const selected of SIMULATOR_V2_LESSONS) {
    assert.equal(
      new Set(selected.introducedConcepts).size,
      selected.introducedConcepts.length,
      `${selected.id} does not repeat its own concept metadata`,
    );
    for (const concept of selected.introducedConcepts) {
      owners.set(concept, [...(owners.get(concept) ?? []), selected.id]);
    }
  }

  assert.deepEqual(
    [...owners.keys()].sort(),
    Object.values(SIMULATOR_V2_LESSON_CONCEPTS).sort(),
    "every authored concept has exactly one teaching lesson",
  );
  assert.deepEqual(owners.get(SIMULATOR_V2_LESSON_CONCEPTS.ROUND_CONDITIONS), ["first-reef"]);
  assert.deepEqual(owners.get(SIMULATOR_V2_LESSON_CONCEPTS.RESOURCE_POINTS), ["first-reef"]);
  for (const [concept, lessonIds] of owners) {
    assert.equal(lessonIds.length, 1, `${concept} has one teaching owner`);
  }
  assert.deepEqual(owners.get(SIMULATOR_V2_LESSON_CONCEPTS.CORAL_UPGRADES), ["first-reef"]);
  assert.deepEqual(owners.get(SIMULATOR_V2_LESSON_CONCEPTS.ATTACKING), ["first-attack"]);
  assert.deepEqual(owners.get(SIMULATOR_V2_LESSON_CONCEPTS.DEFENDING), ["first-attack"]);
  assert.deepEqual(owners.get(SIMULATOR_V2_LESSON_CONCEPTS.PASSIVE_ABILITIES), ["first-attack"]);
  assert.deepEqual(owners.get(SIMULATOR_V2_LESSON_CONCEPTS.ON_PLAY_ABILITIES), ["first-attack"]);
  assert.deepEqual(owners.get(SIMULATOR_V2_LESSON_CONCEPTS.NON_ATTACK_ACTIONS), ["first-attack"]);
  assert.equal(simulatorV2LessonIntroduces("first-reef", SIMULATOR_V2_LESSON_CONCEPTS.RESOURCE_POINTS), true);
  assert.equal(simulatorV2LessonIntroduces("first-attack", SIMULATOR_V2_LESSON_CONCEPTS.RESOURCE_POINTS), false);
  assert.equal(simulatorV2LessonIntroduces("missing", SIMULATOR_V2_LESSON_CONCEPTS.RESOURCE_POINTS), false);
  assert.deepEqual(getSimulatorV2PreviouslyTaughtConcepts("first-attack", []), []);
  assert.deepEqual(
    new Set(getSimulatorV2PreviouslyTaughtConcepts("first-attack", ["first-reef"])),
    new Set(getSimulatorV2Lesson("first-reef").introducedConcepts),
  );
  assert.deepEqual(
    getSimulatorV2PreviouslyTaughtConcepts("first-attack", ["winning-turn"]),
    [],
    "out-of-order later lessons do not count as prior teaching",
  );

  assert.deepEqual(
    SIMULATOR_V2_LESSONS
      .filter((selected) => selected.contract.checkpoints.some(({ actionType }) => actionType === "rp-collected"))
      .map(({ id }) => id),
    ["first-reef", "first-attack", "winning-turn"],
    "later RP checkpoints still sequence the real round without reteaching RP",
  );

  const firstAttack = getSimulatorV2Lesson("first-attack");
  assert.equal(firstAttack.contract.checkpoints[0].actionType, "turn-ended", "the continuation begins from Lesson 1's live board");
  const { contract, progress } = observe("winning-turn", [rp]);
  assert.equal(
    getSimulatorTutorialCurrentCheckpoint(contract, progress).actionType,
    "card-drawn",
    "the final lesson advances from familiar RP collection directly to its draw",
  );
});

test("eight continuous lessons form four ordered modules and supply legal deterministic real-engine seeds", () => {
  assert.equal(SIMULATOR_V2_LESSON_PROGRESS_KEY, "seapals-simulator-v2-lessons-v2");
  assert.equal(SIMULATOR_V2_LESSONS.length, 8);
  assert.deepEqual(
    Object.fromEntries(SIMULATOR_V2_LESSONS.map(({ id, victoryTarget }) => [id, victoryTarget])),
    {
      "first-reef": 1,
      "first-attack": 7,
      "support-search": 4,
      "clear-stun": 4,
      "school-density": 4,
      "filter-feeder": 11,
      "apex-predators": 14,
      "winning-turn": 5,
    },
  );
  assert.deepEqual(
    SIMULATOR_V2_LESSON_MODULES.map(({ id, lessonIds }) => ({ id, lessonIds })),
    [
      { id: "reef-basics", lessonIds: ["first-reef"] },
      { id: "battle-basics", lessonIds: ["first-attack"] },
      { id: "smart-plays", lessonIds: ["support-search", "clear-stun"] },
      { id: "build-to-victory", lessonIds: ["school-density", "filter-feeder", "apex-predators", "winning-turn"] },
    ],
  );
  assert.deepEqual(
    SIMULATOR_V2_LESSON_MODULES.flatMap(({ lessonIds }) => lessonIds),
    SIMULATOR_V2_LESSONS.map(({ id }) => id),
    "module order and curriculum order stay aligned",
  );
  const randomSeeds = new Set();
  for (const selected of SIMULATOR_V2_LESSONS) {
    const runtime = createSimulatorV2LessonRuntime(selected.id);
    const seed = createSimulatorV2LessonSeed(selected.id);
    assert.equal(Number.isInteger(selected.randomSeed), true, `${selected.id} has an integer replay seed`);
    assert.ok(selected.randomSeed >= 0 && selected.randomSeed <= 0xffffffff, `${selected.id} has a uint32 replay seed`);
    assert.equal(randomSeeds.has(selected.randomSeed), false, `${selected.id} has a unique replay seed`);
    randomSeeds.add(selected.randomSeed);
    assert.equal(runtime.scriptedDecks, false);
    assert.equal(runtime.lesson, selected);
    assert.equal(runtime.lesson.randomSeed, selected.randomSeed);
    assert.equal(JSON.parse(JSON.stringify(selected)).randomSeed, selected.randomSeed);
    assert.equal(runtime.contract, selected.contract);
    assert.deepEqual(runtime.previouslyTaughtConcepts, []);
    assert.equal(runtime.guide.name, "Mr. Easterling");
    assert.match(selected.celebration, /!$/);
    assert.match(selected.introduction, /^In this lesson, you(?: will|[’']ll) learn\b/, `${selected.id} opens in Mr. Easterling's teaching voice`);
    assert.ok(selected.introduction.length < 240, `${selected.id} keeps its introduction brief`);
    const victoryCheckpointIndex = selected.contract.checkpoints.findIndex(({ actionType }) => actionType === "vp-earned");
    assert.ok(victoryCheckpointIndex >= 0, `${selected.id} has a real VP checkpoint`);
    assert.equal(
      selected.contract.checkpoints[victoryCheckpointIndex].requirements.some(({ path, operator, value }) => (
        path === "details.to" && operator === "at-least" && value === selected.victoryTarget
      )),
      true,
      `${selected.id} requires its declared VP target`,
    );
    assert.equal(
      victoryCheckpointIndex,
      selected.id === "apex-predators"
        ? selected.contract.checkpoints.length - 2
        : selected.contract.checkpoints.length - 1,
      `${selected.id} celebrates only after the scoring play and any mandatory on-play resolution`,
    );
    const module = SIMULATOR_V2_LESSON_MODULES.find(({ id }) => id === selected.moduleId);
    assert.ok(module?.lessonIds.includes(selected.id), `${selected.id} belongs to its declared module`);
    assert.equal(selected.number, SIMULATOR_V2_LESSONS.indexOf(selected) + 1);
    const preparedPlayer = materializeTableau(seed.playerTableau);
    const preparedOpponent = materializeTableau(seed.opponentTableau);
    assert.equal(
      determineVictoryResult(
        calculateVictoryPoints(allCardsInPlay(preparedPlayer)),
        calculateVictoryPoints(allCardsInPlay(preparedOpponent)),
        selected.victoryTarget,
      ),
      null,
      `${selected.id} starts below its victory target on both sides`,
    );
    for (const cardId of [...seed.hand, ...seed.foundationDeck, ...seed.palsDeck, ...seed.conditionDeck]) assert.ok(cardsById[cardId], cardId);
    for (const habitat of seed.playerHabitats ?? []) {
      const cardId = typeof habitat === "string" ? habitat : habitat.cardId;
      assert.equal(cardsById[cardId]?.kind, CardKind.HABITAT, `${cardId} is a real Habitat`);
    }
    for (const key of ["hand", "foundationDeck", "palsDeck", "habitats", "reefCreatures", "orphanCreatures"]) {
      for (const entry of seed.opponent?.[key] ?? []) {
        const cardId = typeof entry === "string" ? entry : entry.cardId;
        assert.ok(cardsById[cardId], `${selected.id} opponent ${key} includes ${cardId}`);
      }
    }
    assert.equal(seed.startingPlayer, "player");
    assert.equal(seed.opponentTurnMode, selected.id === "first-attack" ? "play" : "observe");
    assert.equal(Object.hasOwn(seed, "forcedWinner"), false);
    assert.equal(Object.hasOwn(seed, "combatRolls"), false);
    const condition = cardsById[seed.activeConditionId];
    for (const cardId of [...seed.hand, ...seed.palsDeck]) {
      const card = cardsById[cardId];
      assert.equal((condition?.effects ?? []).some((effect) => effect.type === "modifyPlayCost" && effect.targetKind === card.kind && effect.targetCategories.includes(card.category)), false);
    }
  }
  assert.equal(randomSeeds.size, SIMULATOR_V2_LESSONS.length);
  assert.equal(getSimulatorV2Lesson("first-attack").randomSeed, 0x5EA910CC);
});

test("Simulator's actual prepared-foundation factory supplies visible player artwork, finite camera coordinates and distinct live identities", () => {
  const simulatorSource = readFileSync(path.join(projectRoot, "src/app/simulator/Simulator.jsx"), "utf8");
  const extractFunction = (functionName, followingFunctionName) => {
    const start = simulatorSource.indexOf(`function ${functionName}(`);
    const end = simulatorSource.indexOf(`function ${followingFunctionName}(`, start + 1);
    assert.ok(start >= 0 && end > start, `Find the actual ${functionName} factory`);
    return simulatorSource.slice(start, end);
  };
  // Execute the production factory and production slot expansion with the
  // actual card catalog and validator. This catches missing player-only fields
  // that a separately reconstructed scenario fixture would silently hide.
  const createPreparedFoundations = new Function("cardsById", "canCardOccupySlot", "getPersonalDeckType", [
    "const isFoundationCard = (card) => getPersonalDeckType(card) === 'foundation';",
    extractFunction("createCoralSlots", "getSlotIdentity"),
    extractFunction("createScriptedTutorialOpponentCorals", "getOnPlayCoralDamage"),
    "return createScriptedTutorialOpponentCorals;",
  ].join("\n"))(cardsById, canCardOccupySlot, getPersonalDeckType);

  for (const lesson of SIMULATOR_V2_LESSONS) {
    const player = createPreparedFoundations(lesson.seed.playerTableau, "player");
    const opponent = createPreparedFoundations(lesson.seed.opponentTableau, "opponent");
    const identities = [];
    for (const foundation of player) {
      assert.equal(foundation.name, cardsById[foundation.cardId].name);
      assert.equal(foundation.image, cardsById[foundation.cardId].image);
      assert.ok(foundation.image.length > 0, "player JSX reads the instance artwork directly");
      assert.ok(Number.isFinite(foundation.x) && Number.isFinite(foundation.y), "percentage positioning and camera fitting require finite coordinates");
      assert.ok(Number.isFinite(foundation.x / 100 * 360) && Number.isFinite(foundation.y / 100 * 300), "mobile camera bounds stay finite");
    }
    assert.deepEqual(
      player.map(({ statuses }) => statuses),
      lesson.seed.playerTableau.map(({ statuses = [] }) => statuses),
      `${lesson.id}: prepared statuses survive hydration`,
    );
    if (player.length > 1) assert.equal(new Set(player.map((foundation) => `${foundation.x}:${foundation.y}`)).size, player.length, "prepared Corals occupy distinct locations");
    for (const foundation of [...player, ...opponent]) {
      identities.push(foundation.id);
      for (const slot of foundation.slots) {
        identities.push(slot.id);
        assert.equal(slot.count, 1);
        assert.deepEqual(slot.hostedCardIds, []);
        if (!slot.cardId) continue;
        assert.equal(canCardOccupySlot(cardsById[slot.cardId], slot), true);
        assert.ok(slot.cardInstanceId, "combat and action controls need a creature instance identity");
        identities.push(slot.cardInstanceId);
      }
    }
    assert.equal(new Set(identities).size, identities.length, "player and opponent anchors must not collide");
  }
});

test("actual prepared initial games preserve every normal opponent default outside their deliberate board, hand and bank overrides", () => {
  const simulatorSource = readFileSync(path.join(projectRoot, "src/app/simulator/Simulator.jsx"), "utf8");
  const extract = (name, nextName) => {
    const start = simulatorSource.indexOf(`function ${name}(`);
    const end = simulatorSource.indexOf(`function ${nextName}(`, start + 1);
    assert.ok(start >= 0 && end > start, `Find production ${name}`);
    return simulatorSource.slice(start, end);
  };
  const openingFoundationCards = Array.from({ length: 8 }, () => "mustard-hill-coral-base");
  const openingPalsCards = Array.from({ length: 8 }, () => "clownfish");
  // Only deck sampling is stubbed. Initial-game defaults and both foundation
  // factories are the production implementations, so new normal-game defaults
  // must automatically survive lesson preparation too.
  const createInitialGame = new Function("cardsById", "canCardOccupySlot", "CardKind", "getPersonalDeckType", "dependencies", [
    "const { createFoundationOpening, createDeck, shuffle, conditionCards, removeOneCard } = dependencies;",
    "const defaultDeckId = 'audit-deck';",
    "const isFoundationCard = (card) => getPersonalDeckType(card) === 'foundation';",
    "const createScriptedTutorialScenario = () => { throw new Error('Prepared lessons must not start the academy scenario.'); };",
    extract("createCoralSlots", "getSlotIdentity"),
    extract("createOpponentStartingCorals", "createScriptedTutorialOpponentCorals"),
    extract("createScriptedTutorialOpponentCorals", "getOnPlayCoralDamage"),
    extract("createInitialGameState", "createOpponentStartingCorals"),
    "return createInitialGameState;",
  ].join("\n"))(cardsById, canCardOccupySlot, CardKind, getPersonalDeckType, {
    createFoundationOpening: () => [...openingFoundationCards],
    createDeck: () => [...openingPalsCards],
    shuffle: (cards) => [...cards],
    conditionCards: [cardsById["clear-water"]],
    removeOneCard: (cards, cardId) => {
      const next = [...cards];
      const index = next.indexOf(cardId);
      if (index >= 0) next.splice(index, 1);
      return next;
    },
  });
  const normal = createInitialGame("player-deck", "opponent-deck", () => 0.5);
  for (const lesson of SIMULATOR_V2_LESSONS) {
    const prepared = createInitialGame("player-deck", "opponent-deck", () => 0.5, { preparedLesson: lesson });
    const opponentSeed = lesson.seed.opponent ?? {};
    const deliberateOpponentOverrides = new Set(["hand", "corals", "rp", ...Object.keys(opponentSeed)]);
    assert.deepEqual(Object.keys(prepared.opponent).sort(), Object.keys(normal.opponent).sort(), `${lesson.id}: preserve the complete normal opponent shape`);
    for (const key of Object.keys(normal.opponent)) {
      if (deliberateOpponentOverrides.has(key)) continue;
      assert.deepEqual(prepared.opponent[key], normal.opponent[key], `${lesson.id}: normal default ${key} must survive`);
    }
    assert.notEqual(prepared.opponent.actionCooldowns, normal.opponent.actionCooldowns, "separate games do not share mutable action state");
    assert.deepEqual(prepared.opponent.hand, opponentSeed.hand ?? []);
    assert.notEqual(prepared.opponent.hand, opponentSeed.hand, "the live opponent hand does not share a seeded array");
    assert.equal(prepared.opponent.rp, Number.isFinite(opponentSeed.rp) ? opponentSeed.rp : 3);
    for (const key of ["foundationDeck", "palsDeck", "habitats", "habitatInstances", "reefCreatures", "reefCreatureInstances", "orphanCreatures"]) {
      const expected = opponentSeed[key] ?? normal.opponent[key];
      assert.deepEqual(prepared.opponent[key], expected, `${lesson.id}: hydrate the intended opponent ${key}`);
      assert.notEqual(prepared.opponent[key], expected, `${lesson.id}: copy opponent ${key}`);
    }
    assert.equal(prepared.opponent.corals.length, lesson.seed.opponentTableau.length);
    assert.equal(prepared.playerCorals.length, lesson.seed.playerTableau.length);
    assert.deepEqual(prepared.playerHabitatInstances.map(({ cardId }) => cardId), lesson.seed.playerHabitats);
    assert.ok(prepared.playerHabitatInstances.every(({ instanceId, currentHealth, maxHealth }) => (
      instanceId && Number.isFinite(currentHealth) && currentHealth === maxHealth
    )), `${lesson.id}: prepared Habitats have stable live identities and health`);
    assert.equal(prepared.scriptedTutorialScenario, null);
    for (const key of ["hand", "foundationDeck", "palsDeck", "conditionDeck"]) {
      assert.deepEqual(prepared[key], lesson.seed[key]);
      assert.notEqual(prepared[key], lesson.seed[key], "live decks and hand are copied from frozen lesson descriptors");
    }
    for (const key of ["rp", "gamePhase", "round", "turn", "startingPlayer", "hasDrawnThisTurn", "activeConditionId"]) assert.equal(prepared[key], lesson.seed[key]);
  }
});

test("lesson one builds, tests, and upgrades a two-Coral ecosystem before releasing its deferred 1 VP win", () => {
  const selected = getSimulatorV2Lesson("first-reef");
  const brainBase = cardsById["brain-coral-base"];
  const brainStageOne = cardsById["brain-coral-stage-1"];
  const mustard = cardsById["mustard-hill-coral-base"];
  const seaUrchin = cardsById["sea-urchin"];
  const coralDisease = cardsById["coral-disease"];
  const checkpointIds = selected.contract.checkpoints.map(({ id }) => id);

  assert.equal(selected.introduction, "In this lesson, you will learn the basics of setting up your ecosystem. Let’s get started!");
  assert.equal(selected.preVictoryMessage, "Excellent! Your ecosystem is really starting to build momentum.");
  assert.equal(selected.victoryTarget, 1);
  assert.equal(selected.setupCardId, brainBase.id);
  assert.deepEqual(checkpointIds, [
    "tutorial-setup",
    "tutorial-collect-rp",
    "tutorial-draw-card",
    "tutorial-build-card",
    "v2-place-resistant-coral",
    "v2-watch-coral-disease",
    "v2-collect-under-coral-disease",
    "v2-draw-first-upgrade",
    "v2-upgrade-first-coral",
    "tutorial-earn-vp",
  ]);
  assert.equal(selected.seed.rp, 3);
  assert.equal(selected.seed.gamePhase, "setup");
  assert.equal(selected.seed.round, 0);
  assert.equal(selected.seed.hasDrawnThisTurn, false);
  assert.equal(selected.seed.activeConditionId, null);
  assert.deepEqual(selected.seed.hand, [brainBase.id, mustard.id]);
  assert.deepEqual(selected.seed.foundationDeck, [brainStageOne.id]);
  assert.deepEqual(selected.seed.palsDeck, [seaUrchin.id]);
  assert.deepEqual(selected.seed.conditionDeck, ["clear-water", coralDisease.id]);
  assert.deepEqual(selected.seed.playerTableau, []);
  assert.deepEqual(getSimulatorV2ExpectedDraw(selected, "tutorial-draw-card"), { deckType: "pals", cardId: seaUrchin.id });
  assert.deepEqual(getSimulatorV2ExpectedDraw(selected, "v2-draw-first-upgrade"), { deckType: "foundation", cardId: brainStageOne.id });

  const diseaseEffect = coralDisease.effects.find(({ type }) => type === "preventRpGeneration");
  assert.deepEqual(diseaseEffect.targetWeaknesses, ["disease"]);
  assert.equal(brainBase.weaknesses.includes("disease"), true, "Brain Coral demonstrates a matching Condition weakness");
  assert.equal(mustard.weaknesses.includes("disease"), false, "Mustard Hill Coral demonstrates unaffected production");
  assert.equal(brainBase.health, 10);
  assert.equal(brainStageOne.health, 20);
  assert.equal(brainBase.passives.find(({ effect }) => effect?.type === "gainResource").effect.amount, 1);
  assert.equal(brainStageOne.passives.find(({ effect }) => effect?.type === "gainResource").effect.amount, 2);
  assert.deepEqual(
    Object.fromEntries(brainStageOne.slots.map(({ slotClass, count }) => [slotClass, count])),
    { fish: 1, predator: 1, invertebrate: 2 },
    "the upgrade keeps the Fish home while opening a Predator and another Invertebrate slot",
  );
  assert.ok(brainStageOne.slots.some((slot) => slot.slotClass === "predator" && canCardOccupySlot(cardsById["great-barracuda"], slot)));

  const firstRoundBank = addResourceWithinCap(
    selected.seed.rp - brainBase.cost.rp,
    1 + brainBase.passives[0].effect.amount,
    calculateRpBankCap([brainBase]),
  );
  assert.equal(firstRoundBank, 4);
  const beforeDisease = firstRoundBank - seaUrchin.cost.rp - mustard.cost.rp;
  assert.equal(beforeDisease, 1);
  const diseaseRoundCollection = 1 + mustard.passives[0].effect.amount;
  assert.equal(diseaseRoundCollection, 3, "the round RP and unaffected Mustard production remain while Brain is blocked");
  assert.equal(beforeDisease + diseaseRoundCollection - brainStageOne.cost.rp, 2, "the authored route can afford its upgrade");
  const completedReef = materializeTableau([
    { foundationCardId: brainStageOne.id, placements: [{ cardId: seaUrchin.id, slotClass: "invertebrate" }] },
    { foundationCardId: mustard.id, placements: [] },
  ]);
  assert.equal(calculateVictoryPoints(allCardsInPlay(completedReef)), 1);

  const matchReady = { actionType: "match-ready", phase: "setup", details: { foundationCount: 1 } };
  const firstCollect = {
    actionType: "rp-collected",
    phase: "draw",
    round: 1,
    details: { collected: 2, bankBefore: 2, bankAfter: 4, conditionId: "clear-water" },
  };
  const firstDraw = { actionType: "card-drawn", phase: "draw", details: { count: 1, palsCount: 1 } };
  const diseaseCollect = {
    actionType: "rp-collected",
    phase: "draw",
    round: 2,
    details: {
      collected: 3,
      bankBefore: 1,
      bankAfter: 4,
      conditionId: coralDisease.id,
      blockedFoundationCount: 1,
      producingFoundationCount: 1,
    },
  };
  const upgradeDraw = { actionType: "card-drawn", phase: "draw", details: { count: 1, foundationCount: 1 } };
  const throughEarlyScore = [matchReady, firstCollect, firstDraw, build(seaUrchin.id), vp(1, 1)];
  const throughUpgradePrompt = [
    ...throughEarlyScore,
    build(mustard.id, "foundation"),
    { actionType: "turn-ended", details: {} },
    diseaseCollect,
    upgradeDraw,
  ];
  const beforeUpgrade = observe(selected.id, throughUpgradePrompt);
  assert.equal(getSimulatorTutorialCurrentCheckpoint(beforeUpgrade.contract, beforeUpgrade.progress).id, "v2-upgrade-first-coral");
  assert.equal(beforeUpgrade.progress.deferredCheckpointEvents["tutorial-earn-vp"].details.to, 1, "Sea Urchin's VP waits until every teaching step is complete");
  const complete = observe(selected.id, [...throughUpgradePrompt, build(brainStageOne.id, "foundation-upgrade")]);
  assert.equal(complete.progress.status, "complete");
  assert.deepEqual(complete.progress.completedCheckpointIds, checkpointIds);
  assert.equal(determineVictoryResult(1, 0, selected.victoryTarget).winner, "player");
  assert.equal(observe(selected.id, [build(mustard.id, "foundation"), vp(1, 1)]).progress.completedCheckpointIds.length, 0, "later cards and VP cannot skip first-Coral setup");
});

test("lesson two continues Lesson 1 and deterministically teaches defense, attack, passive, recovery, and On Play", () => {
  const selected = getSimulatorV2Lesson("first-attack");
  const porcupine = cardsById["porcupine-fish"];
  const seaUrchin = cardsById["sea-urchin"];
  const blueCrab = cardsById["blue-crab"];
  const hogfish = cardsById["spanish-hogfish"];
  const barracuda = cardsById["great-barracuda"];
  const porcupineAttack = porcupine.actions.find(({ id }) => id === "crunch");
  const hogfishAttack = hogfish.actions.find(({ id }) => id === "crunch");
  const scavenge = blueCrab.actions.find(({ id }) => id === "scavenge");
  const ecoBoost = blueCrab.passives.find(({ effect }) => effect?.type === "modifyRpBankCap");
  const quickStrike = barracuda.onPlay.find(({ id }) => id === "quick-strike");
  const quickStrikeAttack = quickStrike.effects.find(({ type }) => type === "attack");
  const checkpointIds = selected.contract.checkpoints.map(({ id }) => id);

  assert.deepEqual(selected.introducedConcepts, [
    SIMULATOR_V2_LESSON_CONCEPTS.ATTACKING,
    SIMULATOR_V2_LESSON_CONCEPTS.OPPONENT_TURNS,
    SIMULATOR_V2_LESSON_CONCEPTS.DEFENDING,
    SIMULATOR_V2_LESSON_CONCEPTS.PASSIVE_ABILITIES,
    SIMULATOR_V2_LESSON_CONCEPTS.ON_PLAY_ABILITIES,
    SIMULATOR_V2_LESSON_CONCEPTS.NON_ATTACK_ACTIONS,
  ]);
  assert.deepEqual(checkpointIds, [
    "v2-pass-to-counterattack",
    "v2-defend-attack",
    "tutorial-collect-rp",
    "tutorial-draw-card",
    "v2-place-attacker",
    "v2-place-passive",
    "tutorial-attack",
    "v2-recover-sea-urchin",
    "v2-pass-to-predator",
    "v2-collect-for-predator",
    "v2-draw-predator",
    "v2-replay-sea-urchin",
    "v2-place-predator",
    "v2-predator-attack",
    "tutorial-earn-vp",
  ]);
  assert.equal(selected.randomSeed, 0x5EA910CC);
  assert.equal(selected.victoryTarget, 7);
  assert.equal(selected.seed.gamePhase, "main");
  assert.equal(selected.seed.round, 2);
  assert.equal(selected.seed.turn, 2);
  assert.equal(selected.seed.hasDrawnThisTurn, true);
  assert.equal(selected.seed.activeConditionId, "coral-disease");
  assert.equal(selected.seed.rp, 2);
  assert.deepEqual(selected.seed.hand, []);
  assert.deepEqual(selected.seed.foundationDeck, []);
  assert.deepEqual(selected.seed.palsDeck, [porcupine.id, blueCrab.id, barracuda.id]);
  assert.deepEqual(selected.seed.conditionDeck, ["undertow", "murky-water"]);
  assert.deepEqual(selected.seed.playerTableau, [
    { foundationCardId: "brain-coral-stage-1", placements: [{ cardId: seaUrchin.id, slotClass: "invertebrate" }] },
    { foundationCardId: "mustard-hill-coral-base", placements: [] },
  ], "Lesson 2 starts from Lesson 1's exact finished board");
  assert.deepEqual(selected.seed.opponentTableau, [
    { foundationCardId: "mustard-hill-coral-base", placements: [{ cardId: seaUrchin.id, slotClass: "invertebrate" }] },
  ]);
  assert.equal(selected.seed.opponentTurnMode, "play");
  assert.deepEqual(selected.seed.opponent, {
    hand: [hogfish.id],
    foundationDeck: ["brain-coral-stage-2"],
    palsDeck: ["blue-whale", "blue-whale"],
    rp: 0,
  });
  assert.deepEqual(getSimulatorV2ExpectedDraw(selected, "v2-defend-attack"), { deckType: "pals", cardId: porcupine.id });
  assert.deepEqual(getSimulatorV2ExpectedDraw(selected, "tutorial-draw-card"), { deckType: "pals", cardId: porcupine.id });
  assert.deepEqual(getSimulatorV2ExpectedDraw(selected, "v2-pass-to-predator"), { deckType: "pals", cardId: barracuda.id });
  assert.deepEqual(getSimulatorV2ExpectedDraw(selected, "v2-draw-predator"), { deckType: "pals", cardId: barracuda.id });

  assert.equal(hogfishAttack.effect.attackDice, "D6");
  assert.equal(seaUrchin.defense.dice, "D6");
  assert.equal(porcupineAttack.effect.attackDice, "D4");
  assert.equal(porcupineAttack.cost.rp, 1);
  assert.equal(quickStrikeAttack.attackDice, "D6");
  assert.equal(attackCanTargetCard(seaUrchin, hogfishAttack.effect), true);
  assert.equal(attackCanTargetCard(seaUrchin, porcupineAttack.effect), true);
  assert.equal(attackCanTargetCard(hogfish, quickStrikeAttack), true);
  assert.equal(ecoBoost.effect.amount, 1, "Blue Crab's passive raises the next round's bank cap without an action");
  assert.equal(scavenge.cost.rp, 2);
  assert.deepEqual(scavenge.effect, { type: "recoverCardFromDiscard", controller: "you", destination: "hand", amount: 1 });
  assert.equal(selected.abilityCardId, blueCrab.id);
  assert.deepEqual(selected.abilityRecoveryTargets, { "v2-recover-sea-urchin": seaUrchin.id });

  const undertow = cardsById["undertow"].effects.find(({ type }) => type === "modifyTurnDraw");
  const murkyDiscount = cardsById["murky-water"].effects.find(({ type }) => type === "modifyPlayCost");
  assert.equal(undertow.amount, 1, "Undertow makes the authored two-card draw legal");
  assert.equal(murkyDiscount.amount, -1);
  assert.equal(murkyDiscount.targetCategories.includes("predator"), true);

  const openingReef = materializeTableau(selected.seed.playerTableau);
  assert.equal(calculateVictoryPoints(allCardsInPlay(openingReef)), 1);
  assert.equal(income(openingReef), 5);
  assert.equal(calculateRpBankCap(allCardsInPlay(openingReef), cardsById["undertow"]), 8);
  const roundThreeBank = addResourceWithinCap(selected.seed.rp, income(openingReef), 8);
  assert.equal(roundThreeBank, 7);
  assert.equal(roundThreeBank - porcupine.cost.rp - blueCrab.cost.rp - porcupineAttack.cost.rp - scavenge.cost.rp, 0);
  const plannedReef = materializeTableau([
    {
      foundationCardId: "brain-coral-stage-1",
      placements: [
        { cardId: porcupine.id, slotClass: "fish" },
        { cardId: blueCrab.id, slotClass: "invertebrate" },
      ],
    },
    { foundationCardId: "mustard-hill-coral-base", placements: [] },
  ]);
  assert.equal(calculateVictoryPoints(allCardsInPlay(plannedReef)), 3);
  assert.equal(calculateRpBankCap(allCardsInPlay(plannedReef), cardsById["murky-water"]), 9);
  const roundFourBank = addResourceWithinCap(0, income(plannedReef), 9);
  assert.equal(roundFourBank, 5);
  assert.equal(roundFourBank - seaUrchin.cost.rp - (barracuda.cost.rp + murkyDiscount.amount), 2);
  const completedReef = materializeTableau([
    {
      foundationCardId: "brain-coral-stage-1",
      placements: [
        { cardId: porcupine.id, slotClass: "fish" },
        { cardId: blueCrab.id, slotClass: "invertebrate" },
        { cardId: barracuda.id, slotClass: "predator" },
      ],
    },
    { foundationCardId: "mustard-hill-coral-base", placements: [{ cardId: seaUrchin.id, slotClass: "invertebrate" }] },
  ]);
  assert.equal(calculateVictoryPoints(allCardsInPlay(completedReef)), 7);

  let randomStream = createSimulatorRandomStream(selected.randomSeed);
  const nextCombatRandom = () => {
    const sample = sampleSimulatorRandom(randomStream);
    randomStream = sample.state;
    return sample.value;
  };
  const combatPackets = [
    createCombatRollPacket(hogfishAttack.effect.attackDice, seaUrchin.defense.dice, nextCombatRandom),
    createCombatRollPacket(porcupineAttack.effect.attackDice, seaUrchin.defense.dice, nextCombatRandom),
    createCombatRollPacket(quickStrikeAttack.attackDice, hogfish.defense.dice, nextCombatRandom),
  ];
  assert.deepEqual(
    combatPackets.map(({ attack, defense }) => [attack, defense]),
    [[4, 3], [4, 1], [6, 1]],
    "the replay seed guarantees Sea Urchin's defeat and both player attack wins",
  );

  const opponentAttack = {
    actionType: "attack-resolved",
    actor: "opponent",
    phase: "opponent",
    details: {
      accepted: true,
      attackerCardId: hogfish.id,
      defenderCardId: seaUrchin.id,
      outcome: "defense-broken",
      resolution: { attackerWins: true },
      discardedCardId: seaUrchin.id,
      destinationZone: "discard",
    },
  };
  const collectRoundThree = {
    actionType: "rp-collected",
    phase: "draw",
    round: 3,
    details: { collected: 5, bankBefore: 2, bankAfter: 7, cap: 8, conditionId: "undertow" },
  };
  const drawPair = { actionType: "card-drawn", phase: "draw", details: { count: 2, palsCount: 2 } };
  const porcupineResolved = {
    actionType: "attack-resolved",
    details: { accepted: true, attackerCardId: porcupine.id, defenderCardId: seaUrchin.id, onPlay: false },
  };
  const scavengeResolved = {
    actionType: "ability-resolved",
    details: {
      accepted: true,
      sourceCardId: blueCrab.id,
      actionId: scavenge.id,
      actionName: scavenge.name,
      targetCardId: seaUrchin.id,
    },
  };
  const collectRoundFour = {
    actionType: "rp-collected",
    phase: "draw",
    round: 4,
    details: { collected: 5, bankBefore: 0, bankAfter: 5, cap: 9, conditionId: "murky-water" },
  };
  const predatorDraw = { actionType: "card-drawn", phase: "draw", details: { count: 1, palsCount: 1 } };
  const predatorResolved = {
    actionType: "attack-resolved",
    details: { accepted: true, attackerCardId: barracuda.id, defenderCardId: hogfish.id, onPlay: true },
  };
  const throughPredatorBuild = [
    { actionType: "turn-ended", details: {} },
    opponentAttack,
    collectRoundThree,
    drawPair,
    build(porcupine.id),
    vp(2, 2),
    build(blueCrab.id),
    vp(3, 1),
    porcupineResolved,
    scavengeResolved,
    { actionType: "turn-ended", details: {} },
    collectRoundFour,
    predatorDraw,
    build(seaUrchin.id),
    vp(4, 1),
    build(barracuda.id),
    vp(7, 3),
  ];
  const beforeOnPlay = observe(selected.id, throughPredatorBuild);
  assert.equal(beforeOnPlay.progress.status, "active");
  assert.equal(getSimulatorTutorialCurrentCheckpoint(beforeOnPlay.contract, beforeOnPlay.progress).id, "v2-predator-attack");
  assert.equal(beforeOnPlay.progress.deferredCheckpointEvents["tutorial-earn-vp"].details.to, 7, "the 7 VP win waits for Quick Strike to resolve");
  const complete = observe(selected.id, [...throughPredatorBuild, predatorResolved]);
  assert.equal(complete.progress.status, "complete");
  assert.deepEqual(complete.progress.completedCheckpointIds, checkpointIds);
  assert.equal(observe(selected.id, [
    { actionType: "turn-ended", details: {} },
    { ...opponentAttack, actor: "player" },
  ]).progress.completedCheckpointIds.length, 1, "the defense checkpoint requires the opponent's attack");
  assert.equal(observe(selected.id, [
    { actionType: "turn-ended", details: {} },
    opponentAttack,
    { ...collectRoundThree, details: { ...collectRoundThree.details, bankAfter: 6 } },
  ]).progress.completedCheckpointIds.length, 2, "the first collection records its exact deterministic economy");
  const throughAttack = throughPredatorBuild.slice(0, 9);
  assert.equal(observe(selected.id, [...throughAttack, {
    ...scavengeResolved,
    details: { ...scavengeResolved.details, targetCardId: "clownfish" },
  }]).progress.completedCheckpointIds.length, 7, "Scavenge must recover the defeated Sea Urchin");
  assert.equal(observe(selected.id, [...throughPredatorBuild, {
    ...predatorResolved,
    details: { ...predatorResolved.details, onPlay: false },
  }]).progress.status, "active", "a regular attack cannot replace Great Barracuda's On Play ability");
});

test("the Support search lesson resolves the real one-time search before building its result", () => {
  const selected = getSimulatorV2Lesson("support-search");
  const gardener = cardsById["coral-gardener"];
  const search = gardener.effects.find((effect) => effect.type === "searchDeck");
  assert.equal(gardener.kind, CardKind.SUPPORT);
  assert.equal(search.targetKind, CardKind.CORAL);
  assert.equal(search.destination, "hand");
  assert.equal(search.revealToOpponent, true);
  assert.equal(gardener.locksFurtherSupportsThisTurn, true);
  assert.deepEqual(selected.seed.foundationDeck, [selected.searchCardId]);
  assert.equal(
    cardsById["brain-coral-base"].cost.rp + cardsById["sea-urchin"].cost.rp,
    selected.seed.rp,
    "the searched Coral and scoring creature are affordable after the zero-cost Support",
  );
  assert.equal(calculateVictoryPoints(allCardsInPlay(materializeTableau(selected.seed.playerTableau))), 3);

  const support = { actionType: "support-played", details: { accepted: true, cardId: gardener.id } };
  const route = [
    support,
    build("brain-coral-base", "foundation"),
    build("sea-urchin"),
    vp(4, 1),
  ];
  assert.equal(observe(selected.id, route).progress.status, "complete");
  assert.equal(observe(selected.id, [{ ...support, details: { ...support.details, accepted: false } }, ...route.slice(1)]).progress.completedCheckpointIds.length, 0);
  assert.equal(observe(selected.id, [support, build("brain-coral-base", "foundation-upgrade")]).progress.completedCheckpointIds.length, 1);
});

test("the Stunned lesson clears the seeded status before a legal paid upgrade", () => {
  const selected = getSimulatorV2Lesson("clear-stun");
  const foundationDefinition = selected.seed.playerTableau.find(({ foundationCardId }) => foundationCardId === "brain-coral-base");
  const heal = cardsById["coral-heal"];
  const removeStatuses = heal.effects.find((effect) => effect.type === "removeStatusEffects");
  assert.deepEqual(foundationDefinition.statuses, [{ type: "stunned", sourceCardId: "crown-of-thorns" }]);
  assert.equal(removeStatuses.removeAll, true);
  assert.equal(removeStatuses.target.kind, CardKind.CORAL);
  assert.equal(removeStatuses.target.controller, "you");
  assert.equal(
    cardsById["brain-coral-stage-1"].cost.rp + cardsById["sea-urchin"].cost.rp,
    selected.seed.rp,
  );
  const upgradeSlot = (cardsById["brain-coral-stage-1"].slots ?? []).find((slot) => slot.slotClass === "invertebrate");
  assert.equal(canCardOccupySlot(cardsById["sea-urchin"], upgradeSlot), true);
  assert.equal(calculateVictoryPoints(allCardsInPlay(materializeTableau(selected.seed.playerTableau))), 3);
  const upgradeCheckpoint = selected.contract.checkpoints.find(({ id }) => id === "v2-upgrade-after-stun");
  const upgradeHelp = getSimulatorV2LessonHelp(selected, upgradeCheckpoint, { hand: ["brain-coral-stage-1"] });
  assert.match(upgradeHelp.message, /20 HP of resilience.*2 RP each round.*Predator slot.*Invertebrate slot/s);

  const support = { actionType: "support-played", details: { accepted: true, cardId: heal.id } };
  const route = [
    support,
    build("brain-coral-stage-1", "foundation-upgrade"),
    build("sea-urchin"),
    vp(4, 1),
  ];
  assert.equal(observe(selected.id, route).progress.status, "complete");
  assert.equal(observe(selected.id, [support, build("brain-coral-stage-1", "foundation")]).progress.completedCheckpointIds.length, 1);
  assert.equal(observe(selected.id, route.slice(0, -1)).progress.status, "active");
});

test("the School Density lesson creates and fully commits a ten-point capacity bucket", () => {
  const selected = getSimulatorV2Lesson("school-density");
  const school = cardsById["sardine-ball-base"];
  const fish = cardsById.halfbeak;
  assert.equal(getPersonalDeckType(school), "foundation");
  assert.ok(school.tags.includes("creature-school"));
  assert.equal(school.schoolDensity, 10);
  assert.equal(fish.schoolDensityRequirement, 10);
  assert.equal(school.cost.rp + fish.cost.rp, selected.seed.rp);
  const [foundation] = materializeTableau([{ foundationCardId: school.id, placements: [] }]);
  assert.deepEqual(
    createSchoolDensityBucketState([foundation], 0, cardsById),
    {
      capacity: 10,
      committed: 0,
      available: 10,
      coveredCommitment: 0,
      overCapacity: 0,
      buckets: [{ foundationId: foundation.id, cardId: school.id, capacity: 10, used: 0, available: 10, fillPercent: 0, full: false }],
      byFoundationId: {
        [foundation.id]: { foundationId: foundation.id, cardId: school.id, capacity: 10, used: 0, available: 10, fillPercent: 0, full: false },
      },
    },
  );
  const committed = createSchoolDensityBucketState([foundation], fish.schoolDensityRequirement, cardsById);
  assert.equal(committed.capacity, 10);
  assert.equal(committed.committed, 10);
  assert.equal(committed.available, 0);
  assert.equal(committed.buckets[0].full, true);

  assert.equal(calculateVictoryPoints(allCardsInPlay(materializeTableau(selected.seed.playerTableau))), 3);
  const route = [build(school.id, "foundation"), build(fish.id, "open-water"), vp(4, 1)];
  assert.equal(observe(selected.id, route).progress.status, "complete");
  assert.equal(observe(selected.id, [build(school.id, "open-water")]).progress.completedCheckpointIds.length, 0);
  assert.equal(observe(selected.id, [build(school.id, "foundation"), build(fish.id, "foundation")]).progress.completedCheckpointIds.length, 1);
});

test("the Filter Feeder lesson supplies its Habitat, RP, and 170-point Density pool", () => {
  const selected = getSimulatorV2Lesson("filter-feeder");
  const sunfish = cardsById["ocean-sunfish"];
  const foundations = materializeTableau(selected.seed.playerTableau);
  const density = createSchoolDensityBucketState(foundations, 0, cardsById);
  assert.deepEqual(selected.seed.playerHabitats, ["open-ocean"]);
  assert.match(getHabitatRequirementError(sunfish, []), /Open Ocean or Coral Reef/);
  assert.equal(getHabitatRequirementError(sunfish, selected.seed.playerHabitats), "");
  assert.equal(density.capacity, 170);
  assert.equal(density.available, 170);
  assert.equal(sunfish.schoolDensityRequirement, 150);
  assert.equal(sunfish.cost.rp, selected.seed.rp);
  const startingVp = calculateVictoryPoints(allCardsInPlay(foundations));
  assert.equal(startingVp, 3);
  assert.equal(startingVp + sunfish.victoryPoints, selected.victoryTarget);
  const afterPlay = createSchoolDensityBucketState(foundations, sunfish.schoolDensityRequirement, cardsById);
  assert.equal(afterPlay.available, 20);
  assert.equal(afterPlay.overCapacity, 0);

  assert.equal(observe(selected.id, [build(sunfish.id, "open-water"), vp(11, 8)]).progress.status, "complete");
  assert.equal(observe(selected.id, [build(sunfish.id, "foundation")]).progress.completedCheckpointIds.length, 0);
  assert.equal(observe(selected.id, [build(sunfish.id, "open-water")]).progress.status, "active");
});

test("the Apex lesson keeps the home reef, legally upgrades, opens an Apex slot, resolves Ravage twice, and reaches 14 VP", () => {
  const selected = getSimulatorV2Lesson("apex-predators");
  const foundations = materializeTableau(selected.seed.playerTableau);
  const startingCards = allCardsInPlay(foundations);
  const upgrade = cardsById["brain-coral-stage-2"];
  const hammerhead = cardsById.hammerhead;
  const apexSlot = upgrade.slots.find((slot) => slot.slotClass === "apex");
  const ravage = hammerhead.onPlay.find((action) => action.id === "ravage");
  const attackEffect = ravage.effects.find((effect) => effect.type === "attack");
  assert.equal(calculateVictoryPoints(startingCards), 8);
  assert.equal(calculateRpBankCap(startingCards), 11, "three Arrow Crabs raise the RP bank cap from 8 to 11");
  assert.equal(upgrade.cost.rp + hammerhead.cost.rp, selected.seed.rp);
  assert.equal(canCardOccupySlot(hammerhead, apexSlot), true);
  assert.deepEqual(selected.seed.playerHabitats, ["coral-reef"]);
  const habitatRequirement = hammerhead.playRequirements.find((requirement) => requirement.type === "cardInPlay");
  assert.deepEqual(
    { requiredKind: habitatRequirement.requiredKind, cardId: habitatRequirement.cardId, zone: habitatRequirement.zone },
    { requiredKind: CardKind.HABITAT, cardId: "coral-reef", zone: "yourReef" },
  );
  assert.ok(selected.seed.playerHabitats.includes(habitatRequirement.cardId));
  assert.equal(attackEffect.attackDice, "D8");
  assert.equal(attackEffect.repeat, 2);
  assert.equal(materializeTableau(selected.seed.opponentTableau)[0].slots.filter(({ cardId }) => cardId === "clownfish").length, 2);
  assert.equal(calculateVictoryPoints([...startingCards, hammerhead]), selected.victoryTarget);
  const upgradeCheckpoint = selected.contract.checkpoints.find(({ id }) => id === "v2-upgrade-apex-coral");
  const upgradeHelp = getSimulatorV2LessonHelp(selected, upgradeCheckpoint, { hand: [upgrade.id] });
  assert.match(upgradeHelp.message, /5 RP.*resilience rises from 20 to 60 HP.*2 to 5 RP each round.*two Predator.*one Apex.*three Invertebrate.*no Fish slot/s);

  const upgradeEvent = build(upgrade.id, "foundation-upgrade");
  const apexEvent = build(hammerhead.id);
  const ravageEvent = {
    actionType: "attack-resolved",
    details: { accepted: true, attackerCardId: hammerhead.id, onPlay: true, resolvedCount: 2 },
  };
  const route = [upgradeEvent, apexEvent, vp(14, 6), ravageEvent];
  assert.equal(observe(selected.id, route).progress.status, "complete");
  assert.equal(observe(selected.id, [upgradeEvent, apexEvent, vp(14, 6), { ...ravageEvent, details: { ...ravageEvent.details, resolvedCount: 1 } }]).progress.completedCheckpointIds.length, 3);
  assert.equal(observe(selected.id, [upgradeEvent, apexEvent, vp(14, 6), { ...ravageEvent, details: { ...ravageEvent.details, onPlay: false } }]).progress.completedCheckpointIds.length, 3);
  assert.equal(observe(selected.id, route.slice(0, -1)).progress.status, "active");
});

test("the last lesson affords both Fish in either order and both legal slot assignments reach exactly 5 VP", () => {
  const selected = getSimulatorV2Lesson("winning-turn");
  for (const hand of [["porcupine-fish", "clownfish"], ["clownfish", "porcupine-fish"]]) {
    for (const foundationOrder of [[0, 1], [1, 0]]) {
      const foundations = materializeTableau(selected.seed.playerTableau);
      assert.equal(calculateVictoryPoints(allCardsInPlay(foundations)), 1);
      assert.equal(income(foundations), 4);
      let bank = addResourceWithinCap(selected.seed.rp, income(foundations), calculateRpBankCap(allCardsInPlay(foundations)));
      assert.equal(bank, 5);
      for (const [index, cardId] of hand.entries()) {
        const card = cardsById[cardId];
        const slot = foundations[foundationOrder[index]].slots.find((entry) => !entry.cardId && canCardOccupySlot(card, entry));
        assert.ok(slot);
        slot.cardId = cardId;
        bank -= card.cost.rp;
      }
      assert.equal(bank, 1);
      const playerVp = calculateVictoryPoints(allCardsInPlay(foundations));
      assert.equal(playerVp, 5);
      assert.equal(determineVictoryResult(playerVp, 0, selected.victoryTarget).winner, "player");
      assert.equal(observe(selected.id, [rp, draw, build(hand[0]), vp(3, 2), build(hand[1]), vp(5, 2)]).progress.status, "complete");
      assert.equal(observe(selected.id, [vp(1, 1), rp, draw, build(hand[0]), vp(3, 2)]).progress.status, "active", "the seed's VP never completes the final goal");
    }
  }
});

test("sequencing gates block spending or passing out of order while leaving actual rules to the Simulator", () => {
  const setupLesson = getSimulatorV2Lesson("first-reef");
  const setupCheckpoint = setupLesson.contract.checkpoints[0];
  const block = (lesson, checkpoint, action, details) => getSimulatorV2LessonActionBlock({ lesson, checkpoint, action, ...details });
  assert.equal(block(setupLesson, setupCheckpoint, "play-card", { cardId: setupLesson.setupCardId, gamePhase: "setup" }), "");
  assert.ok(block(setupLesson, setupCheckpoint, "play-card", { cardId: "clownfish", gamePhase: "setup" }));
  assert.ok(block(setupLesson, setupCheckpoint, "end-turn", { gamePhase: "setup" }), "layout practice comes before Begin Round");
  assert.ok(block(setupLesson, setupCheckpoint, "end-turn", {
    gamePhase: "setup",
    layoutLessonProgress: { "move-foundation": true },
  }), "both layout gestures are required");
  assert.equal(block(setupLesson, setupCheckpoint, "end-turn", {
    gamePhase: "setup",
    layoutLessonProgress: { "move-foundation": true, "move-slot": true },
  }), "");
  const lessonStep = (lesson, id) => lesson.contract.checkpoints.find((checkpoint) => checkpoint.id === id);
  const invertebrateStep = lessonStep(setupLesson, "tutorial-build-card");
  assert.equal(block(setupLesson, invertebrateStep, "play-card", { cardId: "sea-urchin", gamePhase: "main" }), "");
  assert.ok(block(setupLesson, invertebrateStep, "play-card", { cardId: "clownfish", gamePhase: "main" }));
  assert.ok(block(setupLesson, invertebrateStep, "end-turn", { gamePhase: "main" }));
  assert.ok(block(setupLesson, invertebrateStep, "attack", { cardId: "porcupine-fish" }));
  assert.ok(block(setupLesson, invertebrateStep, "utility"));
  const resistantCoral = lessonStep(setupLesson, "v2-place-resistant-coral");
  assert.equal(block(setupLesson, resistantCoral, "play-card", { cardId: "mustard-hill-coral-base", gamePhase: "main" }), "");
  assert.ok(block(setupLesson, resistantCoral, "play-card", { cardId: "clownfish", gamePhase: "main" }));
  assert.equal(block(setupLesson, lessonStep(setupLesson, "v2-watch-coral-disease"), "end-turn", { gamePhase: "main" }), "");
  const firstUpgradeDraw = lessonStep(setupLesson, "v2-draw-first-upgrade");
  assert.equal(block(setupLesson, firstUpgradeDraw, "draw", { deckType: "foundation" }), "");
  assert.ok(block(setupLesson, firstUpgradeDraw, "draw", { deckType: "pals" }));
  const firstUpgrade = lessonStep(setupLesson, "v2-upgrade-first-coral");
  assert.equal(block(setupLesson, firstUpgrade, "play-card", { cardId: "brain-coral-stage-1", gamePhase: "main" }), "");
  assert.ok(block(setupLesson, firstUpgrade, "play-card", { cardId: "great-barracuda", gamePhase: "main" }));
  assert.ok(block(setupLesson, null, "play-card", { cardId: "clownfish" }));

  const attackLesson = getSimulatorV2Lesson("first-attack");
  assert.equal(block(attackLesson, lessonStep(attackLesson, "v2-pass-to-counterattack"), "end-turn", { gamePhase: "main" }), "");
  assert.ok(block(attackLesson, lessonStep(attackLesson, "v2-defend-attack"), "attack", { cardId: "spanish-hogfish" }), "the opponent owns the defense demonstration");
  const abilityDraw = lessonStep(attackLesson, "tutorial-draw-card");
  assert.equal(block(attackLesson, abilityDraw, "draw", { deckType: "pals" }), "");
  assert.ok(block(attackLesson, abilityDraw, "draw", { deckType: "foundation" }));
  assert.equal(block(attackLesson, lessonStep(attackLesson, "v2-place-attacker"), "play-card", { cardId: "porcupine-fish", gamePhase: "main" }), "");
  assert.equal(block(attackLesson, lessonStep(attackLesson, "v2-place-passive"), "play-card", { cardId: "blue-crab", gamePhase: "main" }), "");
  const playerAttack = lessonStep(attackLesson, "tutorial-attack");
  assert.equal(block(attackLesson, playerAttack, "attack", { cardId: "porcupine-fish", gamePhase: "main" }), "");
  assert.ok(block(attackLesson, playerAttack, "attack", { cardId: "great-barracuda", gamePhase: "main" }));
  const recovery = lessonStep(attackLesson, "v2-recover-sea-urchin");
  assert.equal(block(attackLesson, recovery, "utility", { cardId: "blue-crab", actionId: "scavenge", actionName: "Scavenge" }), "");
  assert.ok(block(attackLesson, recovery, "utility", { cardId: "blue-crab", actionId: "recycle", actionName: "Recycle" }));
  const predatorDraw = lessonStep(attackLesson, "v2-draw-predator");
  assert.equal(block(attackLesson, predatorDraw, "draw", { deckType: "pals" }), "");
  assert.ok(block(attackLesson, predatorDraw, "draw", { deckType: "foundation" }));
  assert.equal(block(attackLesson, lessonStep(attackLesson, "v2-replay-sea-urchin"), "play-card", { cardId: "sea-urchin", gamePhase: "main" }), "");
  assert.equal(block(attackLesson, lessonStep(attackLesson, "v2-place-predator"), "play-card", { cardId: "great-barracuda", gamePhase: "main" }), "");
  const predatorAttack = lessonStep(attackLesson, "v2-predator-attack");
  assert.equal(block(attackLesson, predatorAttack, "attack", { cardId: "great-barracuda", gamePhase: "main" }), "");
  assert.ok(block(attackLesson, predatorAttack, "attack", { cardId: "porcupine-fish", gamePhase: "main" }));
  const final = getSimulatorV2Lesson("winning-turn");
  assert.equal(block(final, final.contract.checkpoints[0], "end-turn", { gamePhase: "setup" }), "");
  assert.ok(block(final, final.contract.checkpoints[1], "draw", { deckType: "foundation" }));
  assert.equal(block(final, final.contract.checkpoints[1], "draw", { deckType: "pals" }), "");
  assert.equal(block(null, null, "play-card", { cardId: "anything" }), "", "regular matches are unaffected");
});

test("live coaching follows hand, placement, draw confirmation, result and active attack controls", () => {
  const first = getSimulatorV2Lesson("first-reef");
  const setup = first.contract.checkpoints[0];
  const help = (current, ui) => getSimulatorV2LessonHelp(first, current, ui);
  assert.equal(help(setup, { gamePhase: "setup", hasCoralInPlay: false }).target, "hand");
  assert.equal(help(setup, { gamePhase: "setup", selectedHandCard: first.setupCardId, handPopoverOpen: true }).target, "play-card");
  assert.equal(help(setup, { gamePhase: "setup", playingCardId: first.setupCardId }).target, "placement");
  assert.equal(help(setup, { gamePhase: "setup", hasCoralInPlay: true }).target, "foundation-drag");
  assert.equal(help(setup, {
    gamePhase: "setup",
    hasCoralInPlay: true,
    layoutLessonProgress: { "move-foundation": true },
  }).target, "slot-drag");
  assert.equal(help(setup, {
    gamePhase: "setup",
    hasCoralInPlay: true,
    layoutLessonProgress: { "move-foundation": true, "move-slot": true },
  }).target, "turn-button");
  const drawStep = first.contract.checkpoints[2];
  assert.equal(help(drawStep, { gamePhase: "draw", modal: "turn-draw", drawSelected: 0, drawTarget: 1 }).targetDeck, "pals");
  assert.equal(help(drawStep, { gamePhase: "draw", modal: "turn-draw", drawSelected: 1, drawTarget: 1 }).target, "confirm-draw");
  assert.equal(help(first.contract.checkpoints[3], { modal: "draw-result" }).target, "continue-actions");
  assert.equal(help(first.contract.checkpoints[3], { playingCardId: "sea-urchin" }).target, "placement");
  const attack = getSimulatorV2Lesson("first-attack");
  const attackDrawStep = attack.contract.checkpoints.find(({ id }) => id === "tutorial-draw-card");
  assert.match(getSimulatorV2LessonHelp(attack, attackDrawStep, { gamePhase: "draw", drawSelected: 0, drawTarget: 1 }).message, /Porcupine Fish/);
  const attackStep = attack.contract.checkpoints.find(({ id }) => id === "tutorial-attack");
  assert.equal(getSimulatorV2LessonHelp(attack, attackStep, { readyAttack: { actionKey: "live-crunch" } }).targetActionKey, "live-crunch");
  assert.equal(getSimulatorV2LessonHelp(attack, attackStep, { inspectedAttack: { ready: true, actionKey: "live-crunch" }, inspectedPlayerCard: true }).target, "attack-button");
  assert.equal(getSimulatorV2LessonHelp(attack, attackStep, { attackContext: true }).target, "opponent-board");
  assert.equal(getSimulatorV2LessonHelp(attack, attackStep, { attackContext: true, inspectedCardOpen: true }).target, "close-modal");
  const defenseStep = attack.contract.checkpoints.find(({ id }) => id === "v2-defend-attack");
  assert.equal(getSimulatorV2LessonHelp(attack, defenseStep, {}), null, "the teacher stays off the live opponent attack and dice");
  const transitioningUpgradeDrawHelp = getSimulatorV2LessonHelp(attack, defenseStep, {
    gamePhase: "draw",
    modal: "turn-draw",
    drawSelected: 0,
    drawTarget: 2,
    discardPileCardIds: ["sea-urchin"],
  });
  assert.equal(transitioningUpgradeDrawHelp.targetDeck, "pals");
  assert.match(transitioningUpgradeDrawHelp.message, /Undertow lets you draw two cards.*Porcupine Fish.*Blue Crab/is);
  const upgradeDraw = first.contract.checkpoints.find(({ id }) => id === "v2-draw-first-upgrade");
  const upgradeDrawHelp = getSimulatorV2LessonHelp(first, upgradeDraw, {
    gamePhase: "draw",
    drawSelected: 0,
    drawTarget: 1,
  });
  assert.equal(upgradeDrawHelp.targetDeck, "foundation");
  assert.equal(upgradeDrawHelp.action, "Choose one card from the Foundation Deck.");
  assert.match(upgradeDrawHelp.message, /Brain Coral Stage 1.*Foundation Deck/is);
  const upgradeStep = first.contract.checkpoints.find(({ id }) => id === "v2-upgrade-first-coral");
  assert.match(getSimulatorV2LessonHelp(first, upgradeStep, { hand: ["brain-coral-stage-1"] }).message, /resilience rises from 10 to 20 HP.*2 RP instead of 1.*Predator slot.*another Invertebrate slot/s);
  const passiveStep = attack.contract.checkpoints.find(({ id }) => id === "v2-place-passive");
  assert.match(getSimulatorV2LessonHelp(attack, passiveStep, { hand: ["blue-crab"] }).message, /Eco Boost is a Passive ability.*automatically.*maximum RP bank by 1/s);
  const recoveryStep = attack.contract.checkpoints.find(({ id }) => id === "v2-recover-sea-urchin");
  const recoveryHelp = getSimulatorV2LessonHelp(attack, recoveryStep, {});
  assert.equal(recoveryHelp.target, "player-board");
  assert.equal(recoveryHelp.targetCardId, "blue-crab");
  assert.match(recoveryHelp.message, /Action rather than an attack.*recover the defeated Sea Urchin.*next round/s);
  const inspectedRecoveryHelp = getSimulatorV2LessonHelp(attack, recoveryStep, {
    inspectedUtilityAction: { cardId: "blue-crab", actionKey: "blue-crab:scavenge" },
  });
  assert.equal(inspectedRecoveryHelp.target, "utility-action-button");
  assert.equal(inspectedRecoveryHelp.targetActionKey, "blue-crab:scavenge");
  const predatorDraw = attack.contract.checkpoints.find(({ id }) => id === "v2-draw-predator");
  const predatorDrawHelp = getSimulatorV2LessonHelp(attack, predatorDraw, {
    gamePhase: "draw",
    drawSelected: 0,
    drawTarget: 1,
    discardPileCardIds: ["sea-urchin"],
  });
  assert.equal(predatorDrawHelp.targetDeck, "pals");
  assert.match(predatorDrawHelp.message, /Scavenge brought Sea Urchin back.*Great Barracuda.*On Play attack/s);
  const predatorBuildStep = attack.contract.checkpoints.find(({ id }) => id === "v2-place-predator");
  assert.equal(getSimulatorV2LessonHelp(attack, predatorBuildStep, { hand: ["great-barracuda"] }).targetCardId, "great-barracuda");
  const predatorAttackStep = attack.contract.checkpoints.find(({ id }) => id === "v2-predator-attack");
  const predatorAttackHelp = getSimulatorV2LessonHelp(attack, predatorAttackStep, {});
  assert.equal(predatorAttackHelp.target, "opponent-board");
  assert.match(predatorAttackHelp.message, /Bite uses a D6.*Crunch used a D4/s);
  const scoreStep = attack.contract.checkpoints.find(({ actionType }) => actionType === "vp-earned");
  assert.equal(getSimulatorV2LessonHelp(attack, scoreStep, {}).target, "vp-score");
  const condition = getSimulatorV2Lesson("clear-stun");
  const conditionStep = condition.contract.checkpoints.find(({ id }) => id === "v2-clear-stunned");
  assert.equal(
    getSimulatorV2LessonHelp(condition, conditionStep, {}).message,
    "Stunned pauses Brain Coral. Coral Heal clears the Condition so it can upgrade again.",
  );
  assert.equal(getSimulatorV2LessonHelp(first, null, {}), null);
});

test("later lessons direct familiar actions without repeating their introductory explanations", () => {
  const first = getSimulatorV2Lesson("first-reef");
  const firstVp = first.contract.checkpoints.find(({ actionType }) => actionType === "vp-earned");
  assert.match(getSimulatorV2LessonHelp(first, firstVp, {}).message, /Victory Points come from cards/);

  const attack = getSimulatorV2Lesson("first-attack");
  const attackVp = attack.contract.checkpoints.find(({ actionType }) => actionType === "vp-earned");
  const previouslyTaughtConcepts = getSimulatorV2PreviouslyTaughtConcepts(attack, ["first-reef"]);
  assert.equal(getSimulatorV2LessonHelp(attack, attackVp, { previouslyTaughtConcepts }).message, "");

  const attackDraw = attack.contract.checkpoints.find(({ id }) => id === "tutorial-draw-card");
  const drawHelp = getSimulatorV2LessonHelp(attack, attackDraw, {
    gamePhase: "draw",
    drawSelected: 0,
    drawTarget: 2,
    previouslyTaughtConcepts,
  });
  assert.match(drawHelp.message, /Undertow lets you draw two cards.*Porcupine Fish.*Blue Crab/s, "the later lesson keeps scenario-specific direction");
  assert.doesNotMatch(drawHelp.message, /holds creatures and other Pals cards/i);

  assert.match(
    getSimulatorV2LessonHelp(attack, attackDraw, {
      gamePhase: "draw",
      drawSelected: 0,
      drawTarget: 2,
      previouslyTaughtConcepts: [],
    }).message,
    /Pals Deck holds creatures and other Pals cards/,
  );
  const replaySeaUrchin = attack.contract.checkpoints.find(({ id }) => id === "v2-replay-sea-urchin");
  const replayHelp = getSimulatorV2LessonHelp(attack, replaySeaUrchin, {
    gamePhase: "main",
    hand: ["sea-urchin"],
    previouslyTaughtConcepts,
  });
  assert.match(replayHelp.message, /Scavenge recovered Sea Urchin instead of attacking.*Spines passive/s);

  const sequentialRuntime = createSimulatorV2LessonRuntime("first-attack", {
    completedLessonIds: ["first-reef"],
  });
  assert.deepEqual(new Set(sequentialRuntime.previouslyTaughtConcepts), new Set(previouslyTaughtConcepts));

  const support = getSimulatorV2Lesson("support-search");
  const searchedCoral = support.contract.checkpoints.find(({ id }) => id === "v2-build-searched-coral");
  assert.match(
    getSimulatorV2LessonHelp(support, searchedCoral, { gamePhase: "main", hand: ["brain-coral-base"] }).message,
    /searched Brain Coral/,
    "new search follow-through keeps its lesson-specific explanation",
  );
});

test("final coaching tracks either selection and the remaining real card after a placement", () => {
  const selected = getSimulatorV2Lesson("winning-turn");
  for (const cardId of ["porcupine-fish", "clownfish"]) {
    const picked = getSimulatorV2LessonHelp(selected, selected.contract.checkpoints[2], { hand: ["porcupine-fish", "clownfish"], selectedHandCard: cardId, handPopoverOpen: true });
    assert.equal(picked.target, "play-card");
    assert.equal(picked.targetCardId, cardId);
    const remaining = cardId === "clownfish" ? "porcupine-fish" : "clownfish";
    const followup = getSimulatorV2LessonHelp(selected, selected.contract.checkpoints[3], { hand: [remaining], playerVp: 3 });
    assert.equal(followup.targetCardId, remaining);
    assert.deepEqual(followup.targetCardIds, [remaining]);
    assert.equal(getSimulatorV2LessonActionBlock({ lesson: selected, checkpoint: selected.contract.checkpoints[3], action: "play-card", cardId: remaining }), "");
  }
});

test("hand play guidance teaches the real upward drag and matching drop destination while preserving click placement fallback", () => {
  const first = getSimulatorV2Lesson("first-reef");
  const setup = first.contract.checkpoints[0];
  const initial = getSimulatorV2LessonHelp(first, setup, { gamePhase: "setup", hasCoralInPlay: false });
  assert.equal(initial.target, "hand");
  assert.equal(initial.targetCardId, "brain-coral-base");
  assert.equal(initial.interaction, "drag");
  assert.match(initial.action, /Drag Brain Coral from your hand into your ecosystem/);
  assert.match(initial.hint, /upward.*release/);
  assert.match(initial.hint, /select (?:it|the card), choose Play/);
  const inspected = getSimulatorV2LessonHelp(first, setup, { gamePhase: "setup", selectedHandCard: first.setupCardId, handPopoverOpen: true });
  assert.equal(inspected.interaction, "tap", "the gesture follows the actual Play Card control once details are open");
  assert.equal(inspected.target, "play-card", "the inspector retains the accessible Play control");
  assert.match(inspected.action, /Choose Play Card/);
  assert.match(inspected.hint, /choose a compatible|choose open water/i);
  const clickPlacement = getSimulatorV2LessonHelp(first, setup, { gamePhase: "setup", playingCardId: first.setupCardId });
  assert.equal(clickPlacement.target, "placement");
  assert.notEqual(clickPlacement.interaction, "drag");
  assert.match(clickPlacement.action, /Choose an open space/);

  const creatureStep = first.contract.checkpoints.find(({ id }) => id === "tutorial-build-card");
  const creatureInstruction = getSimulatorV2LessonHelp(first, creatureStep, { gamePhase: "main", hand: ["sea-urchin"] });
  assert.equal(creatureInstruction.interaction, "drag");
  assert.equal(creatureInstruction.targetCardId, "sea-urchin");
  assert.match(creatureInstruction.action, /Drag Sea Urchin from your hand into the highlighted Invertebrate slot/);
  const creaturePlacement = getSimulatorV2LessonHelp(first, creatureStep, { gamePhase: "main", playingCardId: "sea-urchin" });
  assert.equal(creaturePlacement.target, "placement");
  assert.notEqual(creaturePlacement.interaction, "drag");
  assert.match(creaturePlacement.action, /Choose a glowing Invertebrate slot/);
  const secondCoralStep = first.contract.checkpoints.find(({ id }) => id === "v2-place-resistant-coral");
  const secondCoralInstruction = getSimulatorV2LessonHelp(first, secondCoralStep, { gamePhase: "main", hand: ["mustard-hill-coral-base"] });
  assert.equal(secondCoralInstruction.interaction, "drag");
  assert.equal(secondCoralInstruction.targetCardId, "mustard-hill-coral-base");
  assert.match(secondCoralInstruction.action, /Drag Mustard Hill Coral from your hand into a highlighted open ecosystem space/);
  assert.match(secondCoralInstruction.message, /no Disease weakness.*2 RP production/s);
  const final = getSimulatorV2Lesson("winning-turn");
  const chooseEither = getSimulatorV2LessonHelp(final, final.contract.checkpoints[2], { gamePhase: "main", hand: ["clownfish", "porcupine-fish"] });
  assert.equal(chooseEither.interaction, "drag");
  assert.match(chooseEither.action, /Drag either Fish from your hand into a highlighted Fish slot/);
  assert.deepEqual(new Set(chooseEither.targetCardIds), new Set(["clownfish", "porcupine-fish"]));
  const drawHelp = getSimulatorV2LessonHelp(first, first.contract.checkpoints.find(({ id }) => id === "tutorial-draw-card"), { gamePhase: "draw", drawSelected: 0, drawTarget: 1 });
  assert.notEqual(drawHelp.interaction, "drag", "draw controls do not advertise a card placement gesture");
  const attack = getSimulatorV2Lesson("first-attack");
  const attackStep = attack.contract.checkpoints.find(({ id }) => id === "tutorial-attack");
  assert.notEqual(getSimulatorV2LessonHelp(attack, attackStep, {}).interaction, "drag", "board attacks retain their existing interaction");
});

test("seed copies, restarts, and saved lesson progress stay independent", () => {
  const first = createSimulatorV2LessonSeed("first-attack");
  first.playerTableau[0].placements[0].cardId = "clownfish";
  assert.equal(createSimulatorV2LessonSeed("first-attack").playerTableau[0].placements[0].cardId, "sea-urchin");
  assert.throws(() => createSimulatorV2LessonRuntime("missing"), RangeError);
  assert.equal(getSimulatorV2Lesson("missing"), null);
  const blank = { version: 1, completedLessonIds: [] };
  assert.deepEqual(parseSimulatorV2LessonProgress("{bad"), blank);
  assert.deepEqual(parseSimulatorV2LessonProgress({ version: 0, completedLessonIds: ["first-reef"] }), blank);
  const saved = parseSimulatorV2LessonProgress(JSON.stringify({ version: 1, completedLessonIds: ["winning-turn", "first-reef", "first-reef", "unknown"] }));
  assert.deepEqual(saved.completedLessonIds, ["first-reef", "winning-turn"]);
  assert.deepEqual(recordSimulatorV2LessonCompletion(saved, "first-reef"), saved);
  const after = recordSimulatorV2LessonCompletion(saved, "first-attack");
  assert.deepEqual(after.completedLessonIds, ["first-reef", "first-attack", "winning-turn"]);
  assert.deepEqual(createSimulatorTutorialProgress(getSimulatorV2Lesson("first-attack").contract).completedCheckpointIds, []);
  const { contract, progress } = observe("winning-turn", [rp, draw]);
  assert.equal(getSimulatorTutorialCurrentCheckpoint(contract, progress).id, "v2-first-winning-fish");
});
