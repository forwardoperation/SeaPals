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
  getSimulatorV2LessonPlacementTarget,
  getSimulatorV2PreviouslyTaughtConcepts,
  parseSimulatorV2LessonProgress,
  repairSimulatorV2LessonPlacementConflict,
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
import { evaluateCoralReefComposition, getHabitatRequirementError } from "./habitatRules.mjs";
import { createSchoolDensityBucketState } from "./schoolDensityRules.mjs";
import { createSimulatorRandomStream, sampleSimulatorRandom } from "./simulatorRandomStream.mjs";
import { getPreparedTutorialFoundationPlacement } from "./tutorialLayoutLesson.mjs";
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

const homeReefDefinition = () => ({
  foundationCardId: "mustard-hill-coral-base",
  placements: [
    { cardId: "sea-urchin", slotClass: "invertebrate" },
    { cardId: "clownfish", slotClass: "fish" },
  ],
});

function income(foundations) {
  return 1 + foundations.reduce((total, foundation) => total + (cardsById[foundation.cardId].passives ?? []).reduce((sum, passive) => sum + (
    passive.timing === "startOfTurn" && passive.effect?.type === "gainResource" && passive.effect.resource === "rp" ? passive.effect.amount : 0
  ), 0), 0);
}

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
    getSimulatorV2PreviouslyTaughtConcepts("first-attack", ["apex-predators"]),
    [],
    "out-of-order later lessons do not count as prior teaching",
  );

  assert.deepEqual(
    SIMULATOR_V2_LESSONS
      .filter((selected) => selected.contract.checkpoints.some(({ actionType }) => actionType === "rp-collected"))
      .map(({ id }) => id),
    ["first-reef", "first-attack", "apex-predators", "filter-feeder"],
    "later RP checkpoints still sequence the real round without reteaching RP",
  );

  const firstAttack = getSimulatorV2Lesson("first-attack");
  assert.equal(firstAttack.contract.checkpoints[0].actionType, "card-drawn", "Lesson 2 begins at the start-of-turn draw");
  assert.equal(firstAttack.contract.checkpoints[1].actionType, "card-built", "the drawn attacker is played before combat teaching");
  assert.equal(firstAttack.contract.checkpoints[2].actionType, "attack-resolved", "the player's attack follows setup and the primer");
  const { contract, progress } = observe("apex-predators", [build("fairy-parrotfish"), build("arrow-crab")]);
  assert.equal(
    getSimulatorTutorialCurrentCheckpoint(contract, progress).actionType,
    "card-built",
    "the final lesson must finish its Habitat composition before moving to the Apex",
  );
});

test("five continuous lessons form ordered modules and supply legal deterministic real-engine seeds", () => {
  assert.equal(SIMULATOR_V2_LESSON_PROGRESS_KEY, "seapals-simulator-v2-lessons-v2");
  assert.equal(SIMULATOR_V2_LESSONS.length, 5);
  assert.deepEqual(
    Object.fromEntries(SIMULATOR_V2_LESSONS.map(({ id, victoryTarget }) => [id, victoryTarget])),
    {
      "first-reef": 1,
      "first-attack": 7,
      "support-search": 4,
      "apex-predators": 12,
      "filter-feeder": 21,
    },
  );
  assert.deepEqual(
    SIMULATOR_V2_LESSON_MODULES.map(({ id, lessonIds }) => ({ id, lessonIds })),
    [
      { id: "reef-basics", lessonIds: ["first-reef"] },
      { id: "battle-basics", lessonIds: ["first-attack"] },
      { id: "support-recovery", lessonIds: ["support-search"] },
      { id: "habitat-apex", lessonIds: ["apex-predators"] },
      { id: "open-water", lessonIds: ["filter-feeder"] },
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
    assert.match(selected.introduction, /^In (?:this|our next) lesson, (?:you|we)(?: will|[’']ll) learn\b/, `${selected.id} opens in Mr. Easterling's teaching voice`);
    assert.ok(selected.introduction.length <= 340, `${selected.id} keeps its introduction focused`);
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
  assert.equal(getSimulatorV2Lesson("first-attack").randomSeed, 0x5EA9101C);
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
  const createPreparedFoundations = new Function("cardsById", "canCardOccupySlot", "getPersonalDeckType", "getPreparedTutorialFoundationPlacement", [
    "const isFoundationCard = (card) => getPersonalDeckType(card) === 'foundation';",
    extractFunction("createCoralSlots", "getSlotIdentity"),
    extractFunction("createScriptedTutorialOpponentCorals", "getOnPlayCoralDamage"),
    "return createScriptedTutorialOpponentCorals;",
  ].join("\n"))(cardsById, canCardOccupySlot, getPersonalDeckType, getPreparedTutorialFoundationPlacement);

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
    if (player.length >= 3) assert.ok(new Set(player.map(({ y }) => y)).size > 1, `${lesson.id}: prepared Corals use more than one row`);
    for (let left = 0; left < player.length; left += 1) {
      for (let right = left + 1; right < player.length; right += 1) {
        const horizontal = Math.abs(player[left].x - player[right].x) / 100 * 375;
        const vertical = Math.abs(player[left].y - player[right].y) / 100 * 350;
        assert.ok(
          horizontal >= 240 || vertical >= 280,
          `${lesson.id}: prepared Foundation ${left + 1} clears Foundation ${right + 1} on a narrow board`,
        );
      }
    }
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
  const createInitialGame = new Function("cardsById", "canCardOccupySlot", "CardKind", "getPersonalDeckType", "getPreparedTutorialFoundationPlacement", "dependencies", [
    "const { createFoundationOpening, createDeck, shuffle, conditionCards, removeOneCard } = dependencies;",
    "const defaultDeckId = 'audit-deck';",
    "const isFoundationCard = (card) => getPersonalDeckType(card) === 'foundation';",
    "const createScriptedTutorialScenario = () => { throw new Error('Prepared lessons must not start the academy scenario.'); };",
    extract("createCoralSlots", "getSlotIdentity"),
    extract("createOpponentStartingCorals", "createScriptedTutorialOpponentCorals"),
    extract("createScriptedTutorialOpponentCorals", "getOnPlayCoralDamage"),
    extract("createInitialGameState", "createOpponentStartingCorals"),
    "return createInitialGameState;",
  ].join("\n"))(cardsById, canCardOccupySlot, CardKind, getPersonalDeckType, getPreparedTutorialFoundationPlacement, {
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

test("lesson two starts a full turn, teaches faceoff fundamentals, then covers defense, passive, recovery, and On Play", () => {
  const selected = getSimulatorV2Lesson("first-attack");
  const porcupine = cardsById["porcupine-fish"];
  const seaUrchin = cardsById["sea-urchin"];
  const blueCrab = cardsById["blue-crab"];
  const hogfish = cardsById["spanish-hogfish"];
  const barracuda = cardsById["great-barracuda"];
  const brainStageOne = cardsById["brain-coral-stage-1"];
  const brainStageTwo = cardsById["brain-coral-stage-2"];
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
    "v2-draw-opening-attacker",
    "v2-place-opening-attacker",
    "tutorial-attack",
    "v2-pass-to-counterattack",
    "v2-defend-attack",
    "tutorial-collect-rp",
    "tutorial-draw-card",
    "v2-place-passive",
    "v2-recover-sea-urchin",
    "v2-pass-to-predator",
    "v2-collect-for-predator",
    "v2-draw-predator",
    "v2-replay-sea-urchin",
    "v2-place-predator",
    "v2-predator-attack",
    "tutorial-earn-vp",
  ]);
  assert.equal(selected.randomSeed, 0x5EA9101C);
  assert.equal(selected.victoryTarget, 7);
  assert.equal(selected.fitAllPlayerSlots, true, "Interactions opens with both complete Foundation branches visible");
  assert.equal(
    selected.preVictoryMessage,
    "Excellent work! You followed the food web from Fish to Predator, used an Action, defended a faceoff, saw a Passive ability work, recovered a discarded creature, and triggered an On Play attack. Great Barracuda showed how a creature’s class controls both where it lives and what it can hunt. You’re ready for the next lesson!",
  );
  assert.equal(selected.seed.gamePhase, "draw");
  assert.equal(selected.seed.round, 2);
  assert.equal(selected.seed.turn, 2);
  assert.equal(selected.seed.hasDrawnThisTurn, false);
  assert.deepEqual(selected.seed.turnDrawSelection, {
    requested: 1,
    target: 1,
    shortfall: 0,
    foundation: 0,
    pals: 0,
  });
  assert.equal(selected.seed.activeConditionId, "coral-disease");
  assert.equal(selected.seed.rp, 4);
  assert.deepEqual(selected.seed.hand, []);
  assert.deepEqual(selected.seed.foundationDeck, []);
  assert.deepEqual(selected.seed.palsDeck, [porcupine.id, blueCrab.id, barracuda.id]);
  assert.deepEqual(selected.seed.conditionDeck, ["clear-water", "murky-water"]);
  assert.deepEqual(selected.seed.playerTableau, [
    {
      foundationCardId: "brain-coral-stage-1",
      placements: [
        { cardId: seaUrchin.id, slotClass: "invertebrate" },
      ],
      x: -10,
      y: 50,
    },
    { foundationCardId: "mustard-hill-coral-base", placements: [], x: 110, y: 50 },
  ], "Lesson 2 carries Lesson 1's reef forward with an open Fish slot for the card drawn this turn");
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
  assert.deepEqual(getSimulatorV2ExpectedDraw(selected, "v2-draw-opening-attacker"), { deckType: "pals", cardId: porcupine.id });
  assert.deepEqual(getSimulatorV2ExpectedDraw(selected, "v2-place-opening-attacker"), { deckType: "pals", cardId: blueCrab.id });
  assert.deepEqual(getSimulatorV2ExpectedDraw(selected, "v2-defend-attack"), { deckType: "pals", cardId: blueCrab.id });
  assert.deepEqual(getSimulatorV2ExpectedDraw(selected, "tutorial-draw-card"), { deckType: "pals", cardId: blueCrab.id });
  assert.deepEqual(getSimulatorV2ExpectedDraw(selected, "v2-pass-to-predator"), { deckType: "pals", cardId: barracuda.id });
  assert.deepEqual(getSimulatorV2ExpectedDraw(selected, "v2-draw-predator"), { deckType: "pals", cardId: barracuda.id });
  assert.deepEqual(getSimulatorV2LessonPlacementTarget(selected, selected.contract.checkpoints[1], porcupine.id), {
    cardId: porcupine.id,
    foundationCardId: "brain-coral-stage-1",
    slotClass: "fish",
    slotOrdinal: 0,
    blockMessage: "Place Porcupine Fish in Brain Coral's highlighted Fish slot so the Predator slot stays open for Great Barracuda later.",
  });
  assert.deepEqual(getSimulatorV2LessonPlacementTarget(selected, "v2-place-predator", barracuda.id), {
    cardId: barracuda.id,
    foundationCardId: brainStageOne.id,
    slotClass: "predator",
    slotOrdinal: 0,
    blockMessage: "Great Barracuda is a Reef Predator, so it cannot use a Fish slot. Place it in Brain Coral's highlighted Predator slot.",
  });

  assert.equal(selected.preFaceoffPrimer.checkpointId, "tutorial-attack");
  assert.equal(selected.preFaceoffPrimer.steps.length, 3, "the player gets three paced explanations before the first faceoff");
  assert.deepEqual(selected.preFaceoffPrimer.steps[0].visualAid, {
    kind: "dice-ladder",
    dice: ["D4", "D6", "D8", "D10", "D12", "D20"],
  });
  assert.match(selected.preFaceoffPrimer.steps[0].message, /just played Porcupine Fish.*Crunch Action.*opponent's Sea Urchin.*Invertebrate.*Porcupine Fish attacks with a D4.*Sea Urchin defends with a D6.*six faceoff dice.*D4.*D6.*D8.*D10.*D12.*D20.*number.*sides.*range.*D4 rolls 1.4.*D20 rolls 1.20.*larger die can roll higher/is);
  assert.match(selected.preFaceoffPrimer.steps[1].message, /attacker rolls.*ability.*defender rolls.*Defense die.*higher total wins.*tie.*defender wins/is);
  assert.match(selected.preFaceoffPrimer.steps[2].message, /porcupinefish hunt hard-shelled.*snails.*crabs.*sea urchins.*fused teeth.*beak.*crack shells.*Crunch.*opposing Invertebrate.*Sea Urchin.*legal target/is);

  assert.equal(hogfishAttack.effect.attackDice, "D6");
  assert.equal(seaUrchin.defense.dice, "D6");
  assert.equal(porcupineAttack.effect.attackDice, "D4");
  assert.equal(porcupineAttack.cost.rp, 1);
  assert.equal(quickStrikeAttack.attackDice, "D6");
  assert.equal(barracuda.zone, "reef");
  assert.equal(barracuda.class, "predator", "Great Barracuda's printed type is Reef Predator");
  const fishSlot = brainStageOne.slots.find(({ slotClass }) => slotClass === "fish");
  const predatorSlot = brainStageOne.slots.find(({ slotClass }) => slotClass === "predator");
  const apexSlot = brainStageTwo.slots.find(({ slotClass }) => slotClass === "apex");
  assert.equal(canCardOccupySlot(porcupine, predatorSlot), true, "a Predator slot accepts a Reef Fish");
  assert.equal(canCardOccupySlot(barracuda, predatorSlot), true, "a Predator slot accepts a Reef Predator");
  assert.equal(canCardOccupySlot(barracuda, fishSlot), false, "a Fish slot does not accept a Reef Predator");
  assert.equal(canCardOccupySlot(barracuda, apexSlot), true, "an Apex slot accepts a Reef Predator");
  assert.deepEqual(quickStrikeAttack.target.categories, ["fish", "predator"]);
  assert.equal(attackCanTargetCard(seaUrchin, hogfishAttack.effect), true);
  assert.equal(attackCanTargetCard(seaUrchin, porcupineAttack.effect), true);
  assert.equal(attackCanTargetCard(hogfish, quickStrikeAttack), true);
  assert.equal(attackCanTargetCard(barracuda, quickStrikeAttack), true, "Bite can target Predators");
  assert.equal(attackCanTargetCard(seaUrchin, quickStrikeAttack), false, "Bite cannot target Invertebrates");
  assert.equal(ecoBoost.effect.amount, 1, "Blue Crab's passive raises the next round's bank cap without an action");
  assert.equal(scavenge.cost.rp, 2);
  assert.deepEqual(scavenge.effect, { type: "recoverCardFromDiscard", controller: "you", destination: "hand", amount: 1 });
  assert.equal(selected.abilityCardId, blueCrab.id);
  assert.deepEqual(selected.abilityRecoveryTargets, { "v2-recover-sea-urchin": seaUrchin.id });

  const murkyDiscount = cardsById["murky-water"].effects.find(({ type }) => type === "modifyPlayCost");
  assert.equal(murkyDiscount.amount, -1);
  assert.equal(murkyDiscount.targetCategories.includes("predator"), true);

  const startingReef = materializeTableau(selected.seed.playerTableau);
  assert.equal(calculateVictoryPoints(allCardsInPlay(startingReef)), 1);
  assert.equal(income(startingReef), 5);
  assert.equal(calculateRpBankCap(allCardsInPlay(startingReef), cardsById["clear-water"]), 8);
  const openingReef = materializeTableau([
    {
      foundationCardId: "brain-coral-stage-1",
      placements: [
        { cardId: seaUrchin.id, slotClass: "invertebrate" },
        { cardId: porcupine.id, slotClass: "fish" },
      ],
    },
    { foundationCardId: "mustard-hill-coral-base", placements: [] },
  ]);
  assert.equal(calculateVictoryPoints(allCardsInPlay(openingReef)), 3);
  assert.equal(porcupine.cost.rp, 2);
  const bankAfterOpeningPlayAndCrunch = selected.seed.rp - porcupine.cost.rp - porcupineAttack.cost.rp;
  assert.equal(bankAfterOpeningPlayAndCrunch, 1, "playing Porcupine Fish and using Crunch preserve the prior downstream economy");
  const roundThreeBank = addResourceWithinCap(bankAfterOpeningPlayAndCrunch, income(openingReef), 8);
  assert.equal(roundThreeBank, 6);
  assert.equal(roundThreeBank - blueCrab.cost.rp - scavenge.cost.rp, 2);
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
  const roundFourBank = addResourceWithinCap(2, income(plannedReef), 9);
  assert.equal(roundFourBank, 7);
  assert.equal(roundFourBank - seaUrchin.cost.rp - (barracuda.cost.rp + murkyDiscount.amount), 4);
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
    createCombatRollPacket(porcupineAttack.effect.attackDice, seaUrchin.defense.dice, nextCombatRandom),
    createCombatRollPacket(hogfishAttack.effect.attackDice, seaUrchin.defense.dice, nextCombatRandom),
    createCombatRollPacket(quickStrikeAttack.attackDice, hogfish.defense.dice, nextCombatRandom),
  ];
  assert.deepEqual(
    combatPackets.map(({ attack, defense }) => [attack, defense]),
    [[4, 3], [5, 2], [6, 1]],
    "the replay seed guarantees the player's opening win, Sea Urchin's later defeat, and the On Play win",
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
    details: { collected: 5, bankBefore: 1, bankAfter: 6, cap: 8, conditionId: "clear-water" },
  };
  const drawBlueCrab = { actionType: "card-drawn", phase: "draw", details: { count: 1, palsCount: 1 } };
  const drawPorcupine = { actionType: "card-drawn", phase: "draw", details: { count: 1, palsCount: 1 } };
  const buildPorcupine = build(porcupine.id);
  const porcupineResolved = {
    actionType: "attack-resolved",
    details: { accepted: true, attackerCardId: porcupine.id, defenderCardId: seaUrchin.id, onPlay: false },
  };
  const throughOpeningAttack = [
    drawPorcupine,
    buildPorcupine,
    vp(3, 2),
    porcupineResolved,
  ];
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
    details: { collected: 5, bankBefore: 2, bankAfter: 7, cap: 9, conditionId: "murky-water" },
  };
  const predatorDraw = { actionType: "card-drawn", phase: "draw", details: { count: 1, palsCount: 1 } };
  const predatorResolved = {
    actionType: "attack-resolved",
    details: { accepted: true, attackerCardId: barracuda.id, defenderCardId: hogfish.id, onPlay: true },
  };
  const throughPredatorBuild = [
    ...throughOpeningAttack,
    { actionType: "turn-ended", details: {} },
    opponentAttack,
    collectRoundThree,
    drawBlueCrab,
    build(blueCrab.id),
    vp(3, 1),
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
  assert.equal(
    observe(selected.id, [{ actionType: "turn-ended", details: {} }]).progress.completedCheckpointIds.length,
    0,
    "the player must draw and set up before the opponent turn begins",
  );
  assert.equal(observe(selected.id, [drawPorcupine, buildPorcupine, {
    ...porcupineResolved,
    details: { ...porcupineResolved.details, attackerCardId: barracuda.id },
  }]).progress.completedCheckpointIds.length, 2, "only Porcupine Fish can complete the opening attack");
  assert.equal(observe(selected.id, [drawPorcupine, buildPorcupine, {
    ...porcupineResolved,
    details: { ...porcupineResolved.details, defenderCardId: hogfish.id },
  }]).progress.completedCheckpointIds.length, 2, "the opening attack must target the opposing Sea Urchin");
  assert.equal(observe(selected.id, [drawPorcupine, buildPorcupine, {
    ...porcupineResolved,
    details: { ...porcupineResolved.details, onPlay: true },
  }]).progress.completedCheckpointIds.length, 2, "an On Play attack cannot replace the opening Action");
  assert.equal(observe(selected.id, [
    ...throughOpeningAttack,
    { actionType: "turn-ended", details: {} },
    { ...opponentAttack, actor: "player" },
  ]).progress.completedCheckpointIds.length, 4, "the defense checkpoint requires the opponent's attack");
  assert.equal(observe(selected.id, [
    ...throughOpeningAttack,
    { actionType: "turn-ended", details: {} },
    opponentAttack,
    { ...collectRoundThree, details: { ...collectRoundThree.details, bankAfter: 5 } },
  ]).progress.completedCheckpointIds.length, 5, "the first collection records its exact deterministic economy");
  const throughPassive = throughPredatorBuild.slice(0, 10);
  assert.equal(observe(selected.id, [...throughPassive, {
    ...scavengeResolved,
    details: { ...scavengeResolved.details, targetCardId: "clownfish" },
  }]).progress.completedCheckpointIds.length, 8, "Scavenge must recover the defeated Sea Urchin");
  assert.equal(observe(selected.id, [...throughPredatorBuild, {
    ...predatorResolved,
    details: { ...predatorResolved.details, onPlay: false },
  }]).progress.status, "active", "a regular attack cannot replace Great Barracuda's On Play ability");
});

test("the combined Support lesson heals before a one-time search, then upgrades and rebuilds", () => {
  const selected = getSimulatorV2Lesson("support-search");
  const gardener = cardsById["coral-gardener"];
  const heal = cardsById["coral-heal"];
  const search = gardener.effects.find((effect) => effect.type === "searchDeck");
  const removeStatuses = heal.effects.find((effect) => effect.type === "removeStatusEffects");
  const foundationDefinition = selected.seed.playerTableau.find(({ foundationCardId }) => foundationCardId === "brain-coral-base");
  assert.equal(gardener.kind, CardKind.SUPPORT);
  assert.equal(search.targetKind, CardKind.CORAL);
  assert.equal(search.destination, "hand");
  assert.equal(search.revealToOpponent, true);
  assert.equal(gardener.locksFurtherSupportsThisTurn, true, "Coral Heal must be played before Gardener's Support lock");
  assert.deepEqual(foundationDefinition.statuses, [{ type: "stunned", sourceCardId: "crown-of-thorns" }]);
  assert.equal(removeStatuses.removeAll, true);
  assert.equal(removeStatuses.target.kind, CardKind.CORAL);
  assert.equal(removeStatuses.target.controller, "you");
  assert.deepEqual(selected.seed.foundationDeck, [selected.searchCardId]);
  assert.equal(
    cardsById["brain-coral-stage-1"].cost.rp + cardsById["sea-urchin"].cost.rp,
    selected.seed.rp,
    "the searched upgrade and scoring creature are affordable after the zero-cost Supports",
  );
  assert.equal(calculateVictoryPoints(allCardsInPlay(materializeTableau(selected.seed.playerTableau))), 3);
  const upgradeSlot = (cardsById["brain-coral-stage-1"].slots ?? []).find((slot) => slot.slotClass === "invertebrate");
  assert.equal(canCardOccupySlot(cardsById["sea-urchin"], upgradeSlot), true);
  const upgradeCheckpoint = selected.contract.checkpoints.find(({ id }) => id === "v2-upgrade-after-stun");
  const upgradeHelp = getSimulatorV2LessonHelp(selected, upgradeCheckpoint, { hand: ["brain-coral-stage-1"] });
  assert.match(upgradeHelp.message, /20 HP of resilience.*2 RP each round.*Predator slot.*Invertebrate slot/s);

  const healEvent = { actionType: "support-played", details: { accepted: true, cardId: heal.id } };
  const gardenerEvent = { actionType: "support-played", details: { accepted: true, cardId: gardener.id } };
  const route = [
    healEvent,
    gardenerEvent,
    build("brain-coral-stage-1", "foundation-upgrade"),
    build("sea-urchin"),
    vp(4, 1),
  ];
  assert.equal(observe(selected.id, route).progress.status, "complete");
  assert.equal(observe(selected.id, [{ ...healEvent, details: { ...healEvent.details, accepted: false } }, ...route.slice(1)]).progress.completedCheckpointIds.length, 0);
  assert.equal(observe(selected.id, [gardenerEvent]).progress.completedCheckpointIds.length, 0, "Gardener cannot replace the opening Heal checkpoint");
  assert.equal(observe(selected.id, [healEvent, gardenerEvent, build("brain-coral-stage-1", "foundation")]).progress.completedCheckpointIds.length, 2);
  assert.equal(observe(selected.id, route.slice(0, -1)).progress.status, "active");
});

test("the combined Open Water lesson budgets Density, upgrades its School, and then plays a Filter Feeder", () => {
  const selected = getSimulatorV2Lesson("filter-feeder");
  const halfbeak = cardsById.halfbeak;
  const anchovyStageOne = cardsById["anchovy-ball-stage1"];
  const sunfish = cardsById["ocean-sunfish"];
  const foundations = materializeTableau(selected.seed.playerTableau);
  const density = createSchoolDensityBucketState(foundations, 0, cardsById);
  assert.deepEqual(selected.seed.playerHabitats, ["coral-reef"]);
  assert.equal(evaluateCoralReefComposition(allCardsInPlay(foundations)).valid, true, "the completed Apex reef remains able to sustain its Habitat");
  assert.ok(allCardsInPlay(foundations).some(({ id }) => id === "hammerhead"), "the Apex creature remains visible in the next lesson");
  assert.match(getHabitatRequirementError(sunfish, []), /Open Ocean or Coral Reef/);
  assert.equal(getHabitatRequirementError(sunfish, selected.seed.playerHabitats), "");
  assert.equal(density.capacity, 130);
  assert.equal(density.available, 130);
  assert.equal(halfbeak.schoolDensityRequirement, 10);
  assert.equal(anchovyStageOne.schoolDensity, 50);
  assert.equal(sunfish.schoolDensityRequirement, 150);
  assert.ok(selected.seed.rp >= halfbeak.cost.rp + anchovyStageOne.cost.rp, "the opening teaches capacity before the next round's costly Sunfish");
  const startingVp = calculateVictoryPoints(allCardsInPlay(foundations));
  assert.equal(startingVp, 12);
  assert.equal(startingVp + halfbeak.victoryPoints + sunfish.victoryPoints, selected.victoryTarget);
  const afterHalfbeak = createSchoolDensityBucketState(foundations, halfbeak.schoolDensityRequirement, cardsById);
  assert.equal(afterHalfbeak.available, 120);
  assert.equal(afterHalfbeak.available < sunfish.schoolDensityRequirement, true, "the player needs more capacity before the Filter Feeder");
  const expanded = materializeTableau(selected.seed.playerTableau.map((entry) => entry.foundationCardId === "anchovy-ball-base"
    ? { ...entry, foundationCardId: anchovyStageOne.id }
    : entry));
  const afterPlay = createSchoolDensityBucketState(expanded, halfbeak.schoolDensityRequirement + sunfish.schoolDensityRequirement, cardsById);
  assert.equal(afterPlay.capacity, 170);
  assert.equal(afterPlay.available, 10);
  assert.equal(afterPlay.overCapacity, 0);
  assert.deepEqual(getSimulatorV2ExpectedDraw(selected, "v2-draw-filter-feeder"), { deckType: "pals", cardId: sunfish.id });

  const route = [
    build(halfbeak.id, "open-water"),
    build(anchovyStageOne.id, "foundation-upgrade"),
    { actionType: "turn-ended", details: {} },
    { actionType: "rp-collected", phase: "draw", details: { collected: 4 } },
    { actionType: "card-drawn", phase: "draw", details: { count: 1, palsCount: 1 } },
    build(sunfish.id, "open-water"),
    vp(21, 8),
  ];
  assert.equal(observe(selected.id, route).progress.status, "complete");
  assert.equal(observe(selected.id, [build(sunfish.id, "open-water")]).progress.completedCheckpointIds.length, 0, "Sunfish cannot skip the capacity lesson");
  assert.equal(observe(selected.id, [build(halfbeak.id, "foundation")]).progress.completedCheckpointIds.length, 0);
  assert.equal(observe(selected.id, route.slice(0, -1)).progress.status, "active");
});

test("the Apex lesson completes a Coral Reef Habitat before upgrading, funding, and playing its Apex", () => {
  const selected = getSimulatorV2Lesson("apex-predators");
  const foundations = materializeTableau(selected.seed.playerTableau);
  const startingCards = allCardsInPlay(foundations);
  const habitat = cardsById["coral-reef"];
  const clownfish = cardsById.clownfish;
  const arrowCrab = cardsById["arrow-crab"];
  const upgrade = cardsById["brain-coral-stage-2"];
  const hammerhead = cardsById.hammerhead;
  const apexSlot = upgrade.slots.find((slot) => slot.slotClass === "apex");
  const ravage = hammerhead.onPlay.find((action) => action.id === "ravage");
  const attackEffect = ravage.effects.find((effect) => effect.type === "attack");
  assert.equal(calculateVictoryPoints(startingCards), 3);
  assert.equal(calculateRpBankCap(startingCards), 8);
  assert.deepEqual(selected.seed.playerHabitats, [], "the player must actually build the Habitat");
  assert.equal(habitat.kind, CardKind.HABITAT);
  assert.deepEqual(evaluateCoralReefComposition(startingCards), {
    valid: false,
    counts: { corals: 4, fish: 1, invertebrates: 1 },
    required: { corals: 4, fish: 2, invertebrates: 2 },
    missing: { corals: 0, fish: 1, invertebrates: 1 },
  });
  assert.equal(evaluateCoralReefComposition([...startingCards, clownfish]).valid, false, "a second Fish alone does not satisfy Habitat composition");
  assert.equal(evaluateCoralReefComposition([...startingCards, clownfish, arrowCrab]).valid, true);
  assert.equal(calculateRpBankCap([...startingCards, clownfish, arrowCrab]), 9, "Arrow Crab's passive expands the RP bank before the costly Apex turn");
  assert.equal(clownfish.cost.rp + arrowCrab.cost.rp + upgrade.cost.rp, selected.seed.rp);
  assert.deepEqual(getSimulatorV2ExpectedDraw(selected, "v2-draw-hammerhead"), { deckType: "pals", cardId: hammerhead.id });
  const fishTarget = getSimulatorV2LessonPlacementTarget(selected, "v2-add-habitat-fish", clownfish.id);
  const invertebrateTarget = getSimulatorV2LessonPlacementTarget(selected, "v2-add-habitat-invertebrate", arrowCrab.id);
  const pillar = foundations.find(({ cardId }) => cardId === "pillar-coral-base");
  assert.equal(fishTarget.foundationCardId, pillar.cardId);
  assert.equal(invertebrateTarget.foundationCardId, pillar.cardId);
  assert.ok(pillar.slots.some((slot) => slot.slotClass === fishTarget.slotClass && canCardOccupySlot(clownfish, slot)));
  assert.ok(pillar.slots.some((slot) => slot.slotClass === invertebrateTarget.slotClass && canCardOccupySlot(arrowCrab, slot)));
  const upgradedFoundations = materializeTableau(selected.seed.playerTableau.map((entry) => entry.foundationCardId === "brain-coral-stage-1"
    ? { ...entry, foundationCardId: upgrade.id }
    : entry));
  assert.equal(income(upgradedFoundations), 11, "four healthy Corals replenish the next turn's Apex budget");
  assert.ok(addResourceWithinCap(0, income(upgradedFoundations), calculateRpBankCap([...startingCards, clownfish, arrowCrab], cardsById["abundant-sunlight"])) >= hammerhead.cost.rp);
  assert.equal(canCardOccupySlot(hammerhead, apexSlot), true);
  const habitatRequirement = hammerhead.playRequirements.find((requirement) => requirement.type === "cardInPlay");
  assert.deepEqual(
    { requiredKind: habitatRequirement.requiredKind, cardId: habitatRequirement.cardId, zone: habitatRequirement.zone },
    { requiredKind: CardKind.HABITAT, cardId: "coral-reef", zone: "yourReef" },
  );
  assert.equal(getHabitatRequirementError(hammerhead, []), "", "the explicit card-in-play rule is checked by the Simulator separately");
  assert.equal(attackEffect.attackDice, "D8");
  assert.equal(attackEffect.repeat, 2);
  assert.equal(materializeTableau(selected.seed.opponentTableau)[0].slots.filter(({ cardId }) => cardId === "clownfish").length, 2);
  assert.equal(calculateVictoryPoints([...startingCards, clownfish, arrowCrab, hammerhead]), selected.victoryTarget);
  const upgradeCheckpoint = selected.contract.checkpoints.find(({ id }) => id === "v2-upgrade-apex-coral");
  const upgradeHelp = getSimulatorV2LessonHelp(selected, upgradeCheckpoint, { hand: [upgrade.id] });
  assert.match(upgradeHelp.message, /5 RP.*resilience rises from 20 to 60 HP.*2 to 5 RP each round.*two Predator.*one Apex.*three Invertebrate.*no Fish slot/s);

  const fishEvent = build(clownfish.id);
  const invertEvent = build(arrowCrab.id);
  const habitatEvent = build(habitat.id, "habitat");
  const upgradeEvent = build(upgrade.id, "foundation-upgrade");
  const turnEvent = { actionType: "turn-ended", details: {} };
  const collectEvent = { actionType: "rp-collected", phase: "draw", details: { collected: 11 } };
  const drawEvent = { actionType: "card-drawn", phase: "draw", details: { count: 1, palsCount: 1 } };
  const apexEvent = build(hammerhead.id);
  const ravageEvent = {
    actionType: "attack-resolved",
    details: { accepted: true, attackerCardId: hammerhead.id, onPlay: true, resolvedCount: 2 },
  };
  const route = [fishEvent, invertEvent, habitatEvent, upgradeEvent, turnEvent, collectEvent, drawEvent, apexEvent, vp(12, 6), ravageEvent];
  assert.equal(observe(selected.id, route).progress.status, "complete");
  assert.equal(observe(selected.id, [habitatEvent]).progress.completedCheckpointIds.length, 0, "Habitat cannot skip the composition steps");
  assert.equal(observe(selected.id, [fishEvent, invertEvent, upgradeEvent]).progress.completedCheckpointIds.length, 2, "an Apex upgrade cannot skip the Habitat placement");
  assert.equal(observe(selected.id, [...route.slice(0, -1), { ...ravageEvent, details: { ...ravageEvent.details, resolvedCount: 1 } }]).progress.completedCheckpointIds.length, 9);
  assert.equal(observe(selected.id, [...route.slice(0, -1), { ...ravageEvent, details: { ...ravageEvent.details, onPlay: false } }]).progress.completedCheckpointIds.length, 9);
  assert.equal(observe(selected.id, route.slice(0, -1)).progress.status, "active");
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
    layoutLessonProgress: { "move-slot": true },
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
  const weaknessStep = lessonStep(setupLesson, "v2-watch-coral-disease");
  assert.match(
    block(setupLesson, weaknessStep, "end-turn", { gamePhase: "main" }),
    /Read Brain Coral's weaknesses/i,
    "the Condition should not advance before its weakness close-up",
  );
  assert.equal(block(setupLesson, weaknessStep, "end-turn", {
    gamePhase: "main",
    weaknessTourAcknowledged: true,
  }), "");
  const firstUpgradeDraw = lessonStep(setupLesson, "v2-draw-first-upgrade");
  assert.equal(block(setupLesson, firstUpgradeDraw, "draw", { deckType: "foundation" }), "");
  assert.ok(block(setupLesson, firstUpgradeDraw, "draw", { deckType: "pals" }));
  const firstUpgrade = lessonStep(setupLesson, "v2-upgrade-first-coral");
  assert.equal(block(setupLesson, firstUpgrade, "play-card", { cardId: "brain-coral-stage-1", gamePhase: "main" }), "");
  assert.ok(block(setupLesson, firstUpgrade, "play-card", { cardId: "great-barracuda", gamePhase: "main" }));
  assert.ok(block(setupLesson, null, "play-card", { cardId: "clownfish" }));

  const attackLesson = getSimulatorV2Lesson("first-attack");
  const openingDraw = lessonStep(attackLesson, "v2-draw-opening-attacker");
  assert.equal(block(attackLesson, openingDraw, "draw", { deckType: "pals" }), "");
  assert.ok(block(attackLesson, openingDraw, "draw", { deckType: "foundation" }));
  assert.ok(block(attackLesson, openingDraw, "attack", { cardId: "porcupine-fish", gamePhase: "draw" }), "the start-of-turn draw comes before combat");
  const openingBuild = lessonStep(attackLesson, "v2-place-opening-attacker");
  assert.equal(block(attackLesson, openingBuild, "play-card", { cardId: "porcupine-fish", gamePhase: "main" }), "");
  assert.ok(block(attackLesson, openingBuild, "play-card", { cardId: "blue-crab", gamePhase: "main" }));
  assert.ok(block(attackLesson, openingBuild, "attack", { cardId: "porcupine-fish", gamePhase: "main" }), "Porcupine Fish must enter its slot before attacking");
  const playerAttack = lessonStep(attackLesson, "tutorial-attack");
  assert.ok(block(attackLesson, playerAttack, "end-turn", { gamePhase: "main" }), "the opening attack comes before the opponent turn");
  assert.match(
    block(attackLesson, playerAttack, "attack", { cardId: "porcupine-fish", gamePhase: "main" }),
    /faceoff dice and rules/i,
    "the three-part primer must finish before the attack can begin",
  );
  assert.equal(block(attackLesson, playerAttack, "attack", {
    cardId: "porcupine-fish",
    gamePhase: "main",
    preFaceoffPrimerAcknowledged: true,
  }), "");
  assert.ok(block(attackLesson, playerAttack, "attack", { cardId: "great-barracuda", gamePhase: "main" }));
  assert.ok(block(attackLesson, playerAttack, "play-card", { cardId: "blue-crab", gamePhase: "main" }));
  assert.equal(block(attackLesson, lessonStep(attackLesson, "v2-pass-to-counterattack"), "end-turn", { gamePhase: "main" }), "");
  assert.ok(block(attackLesson, lessonStep(attackLesson, "v2-defend-attack"), "attack", { cardId: "spanish-hogfish" }), "the opponent owns the defense demonstration");
  const abilityDraw = lessonStep(attackLesson, "tutorial-draw-card");
  assert.equal(block(attackLesson, abilityDraw, "draw", { deckType: "pals" }), "");
  assert.ok(block(attackLesson, abilityDraw, "draw", { deckType: "foundation" }));
  assert.equal(block(attackLesson, lessonStep(attackLesson, "v2-place-passive"), "play-card", { cardId: "blue-crab", gamePhase: "main" }), "");
  const recovery = lessonStep(attackLesson, "v2-recover-sea-urchin");
  assert.equal(block(attackLesson, recovery, "utility", { cardId: "blue-crab", actionId: "scavenge", actionName: "Scavenge" }), "");
  assert.ok(block(attackLesson, recovery, "utility", { cardId: "blue-crab", actionId: "recycle", actionName: "Recycle" }));
  const predatorDraw = lessonStep(attackLesson, "v2-draw-predator");
  assert.equal(block(attackLesson, predatorDraw, "draw", { deckType: "pals" }), "");
  assert.ok(block(attackLesson, predatorDraw, "draw", { deckType: "foundation" }));
  assert.equal(block(attackLesson, lessonStep(attackLesson, "v2-replay-sea-urchin"), "play-card", { cardId: "sea-urchin", gamePhase: "main" }), "");
  assert.equal(block(attackLesson, lessonStep(attackLesson, "v2-place-predator"), "play-card", { cardId: "great-barracuda", gamePhase: "main" }), "");
  assert.equal(block(attackLesson, lessonStep(attackLesson, "v2-place-predator"), "place-card", {
    cardId: "great-barracuda",
    foundationCardId: "brain-coral-stage-1",
    slotClass: "predator",
    slotOrdinal: 0,
  }), "");
  const predatorAttack = lessonStep(attackLesson, "v2-predator-attack");
  assert.equal(block(attackLesson, predatorAttack, "attack", { cardId: "great-barracuda", gamePhase: "main" }), "");
  assert.ok(block(attackLesson, predatorAttack, "attack", { cardId: "porcupine-fish", gamePhase: "main" }));
  const apex = getSimulatorV2Lesson("apex-predators");
  assert.equal(block(apex, apex.contract.checkpoints[0], "play-card", { cardId: "clownfish", gamePhase: "main" }), "");
  assert.ok(block(apex, apex.contract.checkpoints[0], "play-card", { cardId: "coral-reef", gamePhase: "main" }));
  assert.equal(block(apex, apex.contract.checkpoints[2], "play-card", { cardId: "coral-reef", gamePhase: "main" }), "");
  assert.ok(block(apex, apex.contract.checkpoints[2], "play-card", { cardId: "hammerhead", gamePhase: "main" }));
  assert.equal(block(null, null, "play-card", { cardId: "anything" }), "", "regular matches are unaffected");
});

test("Lesson 2 repairs a Porcupine Fish that already occupies Great Barracuda's slot", () => {
  const fishSlot = {
    id: "brain-fish",
    slotClass: "fish",
    cardId: null,
    cardInstanceId: null,
    hostedCardIds: [],
    position: { left: "20%", top: "30%" },
  };
  const predatorSlot = {
    id: "brain-predator",
    slotClass: "predator",
    cardId: "porcupine-fish",
    cardInstanceId: "porcupine-instance",
    hostedCardIds: ["hosted-test-card"],
    hostedSchoolDensityRequirements: [3],
    controller: "player",
    position: { left: "70%", top: "40%" },
  };
  const otherFoundation = { id: "mustard", cardId: "mustard-hill-coral-base", slots: [] };
  const broken = [{
    id: "brain",
    cardId: "brain-coral-stage-1",
    slots: [fishSlot, predatorSlot],
  }, otherFoundation];
  const lesson = getSimulatorV2Lesson("first-attack");
  const checkpoint = lesson.contract.checkpoints.find(({ id }) => id === "v2-place-predator");

  const repaired = repairSimulatorV2LessonPlacementConflict({ lesson, checkpoint, foundations: broken });
  assert.notEqual(repaired, broken);
  assert.equal(repaired[1], otherFoundation, "unrelated foundations keep their identity");
  assert.deepEqual(repaired[0].slots[0], {
    ...fishSlot,
    cardId: "porcupine-fish",
    cardInstanceId: "porcupine-instance",
    hostedCardIds: ["hosted-test-card"],
    hostedSchoolDensityRequirements: [3],
    controller: "player",
  });
  assert.deepEqual(repaired[0].slots[1], {
    id: "brain-predator",
    slotClass: "predator",
    cardId: null,
    cardInstanceId: null,
    hostedCardIds: [],
    hostedSchoolDensityRequirements: [],
    position: { left: "70%", top: "40%" },
  });
  assert.equal(
    repairSimulatorV2LessonPlacementConflict({ lesson, checkpoint, foundations: repaired }),
    repaired,
    "repair is idempotent",
  );
  assert.equal(
    repairSimulatorV2LessonPlacementConflict({
      lesson,
      checkpoint: lesson.contract.checkpoints.find(({ id }) => id === "v2-replay-sea-urchin"),
      foundations: broken,
    }),
    broken,
    "other checkpoints are untouched",
  );
  const noOpenFishSlot = [{
    ...broken[0],
    slots: [{ ...fishSlot, cardId: "clownfish" }, predatorSlot],
  }];
  assert.equal(
    repairSimulatorV2LessonPlacementConflict({ lesson, checkpoint, foundations: noOpenFishSlot }),
    noOpenFishSlot,
    "repair never displaces a legitimate Fish-slot occupant",
  );
});

test("Lesson 2 coaches the opening draw, placement, dice primer, and attack before later abilities", () => {
  const lesson = getSimulatorV2Lesson("first-attack");
  assert.equal(lesson.autoEndOpeningTurn, true);
  assert.match(
    lesson.introduction,
    /relationships between different sea creatures.*well defined food web.*fish may hunt invertebrates.*predators may consume both.*always a bigger fish.*get started/is,
  );

  const openingDraw = lesson.contract.checkpoints.find(({ id }) => id === "v2-draw-opening-attacker");
  const openingDrawHelp = getSimulatorV2LessonHelp(lesson, openingDraw, {
    gamePhase: "draw",
    drawSelected: 0,
    drawTarget: 1,
  });
  assert.equal(openingDrawHelp.target, "draw-controls");
  assert.equal(openingDrawHelp.targetDeck, "pals");
  assert.match(openingDrawHelp.message, /turn begins.*required draw.*Porcupine Fish.*Pals Deck.*food web/is);
  assert.match(openingDrawHelp.action, /Choose one card from the Pals Deck/i);

  const openingBuild = lesson.contract.checkpoints.find(({ id }) => id === "v2-place-opening-attacker");
  const openingBuildHelp = getSimulatorV2LessonHelp(lesson, openingBuild, { hand: ["porcupine-fish"] });
  assert.equal(openingBuildHelp.target, "hand");
  assert.equal(openingBuildHelp.targetCardId, "porcupine-fish");
  assert.equal(openingBuildHelp.interaction, "drag");
  assert.match(openingBuildHelp.message, /Reef Fish.*Brain Coral's open Fish slot.*2 RP.*Crunch Action.*faceoff die/is);
  assert.match(openingBuildHelp.action, /Drag Porcupine Fish.*highlighted Fish slot/i);

  const primer = lesson.preFaceoffPrimer;
  assert.equal(primer.steps.length, 3);
  assert.deepEqual(primer.steps[0].visualAid.dice, ["D4", "D6", "D8", "D10", "D12", "D20"]);
  assert.deepEqual(
    primer.steps[0].visualAid.dice.map((label) => `${label}: 1–${Number(label.slice(1))}`),
    ["D4: 1–4", "D6: 1–6", "D8: 1–8", "D10: 1–10", "D12: 1–12", "D20: 1–20"],
  );
  assert.match(primer.steps[1].message, /higher total wins.*tie.*defender wins/is);
  assert.match(primer.steps[2].message, /fused teeth.*beak.*crack shells.*Crunch.*opposing Invertebrate.*Sea Urchin.*legal target/is);

  const counterattack = lesson.contract.checkpoints.find(({ id }) => id === "v2-pass-to-counterattack");
  const counterattackHelp = getSimulatorV2LessonHelp(lesson, counterattack, {});
  assert.equal(counterattackHelp.target, "turn-button");
  assert.match(
    counterattackHelp.message,
    /completed every step of an attack.*opponent.*Spanish Hogfish.*Crunch.*Sea Urchin.*defender.*side/is,
  );

  const crunch = lesson.contract.checkpoints.find(({ id }) => id === "tutorial-attack");
  const crunchHelp = getSimulatorV2LessonHelp(lesson, crunch, {});
  assert.equal(crunchHelp.target, "player-board");
  assert.match(crunchHelp.message, /Crunch is an Action.*choose during your turn.*once each turn/is);
  assert.match(crunchHelp.action, /Your turn to attack.*Select Porcupine Fish/is);

  const selectedCrunchHelp = getSimulatorV2LessonHelp(lesson, crunch, {
    inspectedAttack: { ready: true, actionKey: "live-crunch" },
    inspectedPlayerCard: true,
  });
  assert.equal(selectedCrunchHelp.target, "attack-button");
  assert.equal(selectedCrunchHelp.targetActionKey, "live-crunch");
  assert.match(selectedCrunchHelp.message, /Porcupine Fish is your attacker.*costs 1 RP.*opposing Invertebrate/is);
  assert.match(selectedCrunchHelp.action, /Porcupine Fish is selected.*Choose Crunch.*commit 1 RP.*begin the attack/is);

  const targetCrunchHelp = getSimulatorV2LessonHelp(lesson, crunch, { attackContext: true });
  assert.equal(targetCrunchHelp.target, "opponent-board");
  assert.equal(targetCrunchHelp.targetCardId, "sea-urchin");
  assert.match(targetCrunchHelp.message, /Sea Urchin.*type line.*opposing Invertebrate.*legal target.*defender/is);
  assert.match(targetCrunchHelp.action, /choose the target.*Sea Urchin.*D4 attack die.*D6 defense die.*lock both results/is);

  const recovery = lesson.contract.checkpoints.find(({ id }) => id === "v2-recover-sea-urchin");
  const recoveryHelp = getSimulatorV2LessonHelp(lesson, recovery, {});
  assert.match(
    recoveryHelp.message,
    /not every ability is an attack.*Action.*waits for your command.*decide when to use it.*pay any RP cost.*Scavenge costs 2 RP.*Sea Urchin.*discard pile.*bring it home/is,
  );

  const predatorDraw = lesson.contract.checkpoints.find(({ id }) => id === "v2-draw-predator");
  const predatorDrawHelp = getSimulatorV2LessonHelp(lesson, predatorDraw, {
    gamePhase: "draw",
    drawSelected: 0,
    drawTarget: 1,
    discardPileCardIds: ["sea-urchin"],
  });
  assert.equal(predatorDrawHelp.targetDeck, "pals");
  assert.match(
    predatorDrawHelp.message,
    /Great Barracuda.*type line says Reef Predator.*Reef tells.*ecosystem zone and slots.*Predator.*creature class.*class controls placement and targeting/is,
  );

  const predatorBuild = lesson.contract.checkpoints.find(({ id }) => id === "v2-place-predator");
  const predatorBuildHelp = getSimulatorV2LessonHelp(lesson, predatorBuild, { hand: ["great-barracuda"] });
  assert.match(
    predatorBuildHelp.message,
    /type line identifies.*Reef Predator.*Predator slot can house a Reef Fish or Reef Predator.*Reef Predator cannot use a Fish slot.*highlighted Predator slot.*3 RP.*Quick Strike.*D6 Bite.*opposing Fish or Predator.*no separate Action button.*extra RP cost/is,
  );

  const predatorAttack = lesson.contract.checkpoints.find(({ id }) => id === "v2-predator-attack");
  const predatorAttackHelp = getSimulatorV2LessonHelp(lesson, predatorAttack, {});
  assert.match(
    predatorAttackHelp.message,
    /Quick Strike.*Unlike an Action.*On Play ability.*automatically.*Bite can target an opposing Fish or Predator.*not an Invertebrate or Apex.*Spanish Hogfish.*Reef Fish.*legal.*Sea Urchin would not/is,
  );
  assert.match(predatorAttackHelp.action, /Spanish Hogfish.*Great Barracuda.*D6 Bite/is);
});

test("Lesson 1 speaks the new-player mental model before asking for each action", () => {
  const lesson = getSimulatorV2Lesson("first-reef");
  const step = (id) => lesson.contract.checkpoints.find((checkpoint) => checkpoint.id === id);
  const setup = step("tutorial-setup");
  const initial = getSimulatorV2LessonHelp(lesson, setup, {
    gamePhase: "setup",
    hasCoralInPlay: false,
  });
  assert.equal(lesson.openingCardTourId, "brain-coral-base");
  assert.equal(initial.action, "Great! Now that we know how to read Foundation cards, drag Brain Coral into your ecosystem for a cost of 1 RP.");
  assert.equal(initial.pointerPrompt, "Drag Brain Coral into the highlighted open water.");

  const selectedInitial = getSimulatorV2LessonHelp(lesson, setup, {
    gamePhase: "setup",
    hasCoralInPlay: false,
    selectedHandCard: "brain-coral-base",
    handPopoverOpen: true,
  });
  const placingInitial = getSimulatorV2LessonHelp(lesson, setup, {
    gamePhase: "setup",
    playingCardId: "brain-coral-base",
  });
  assert.equal(selectedInitial.action, initial.action, "selection should not replace the teaching with generic copy");
  assert.equal(placingInitial.action, initial.action, "placement should preserve the same spoken explanation");
  assert.equal(selectedInitial.cueId, initial.cueId, "the dialogue should not restart when the pointer changes target");
  assert.equal(placingInitial.cueId, initial.cueId);

  const moveSlot = getSimulatorV2LessonHelp(lesson, setup, {
    gamePhase: "setup",
    hasCoralInPlay: true,
  });
  assert.equal(moveSlot.target, "slot-drag", "the finger starts on a connected slot while slots are introduced");
  assert.equal(moveSlot.actionId, "move-slot");
  assert.match(moveSlot.action, /^Nice work! The connected circles are creature slots.*Press and hold.*slot.*left or right.*release in open water/is);
  assert.match(moveSlot.pointerPrompt, /slot.*left or right/i);
  assert.doesNotMatch(`${moveSlot.action} ${moveSlot.pointerPrompt} ${moveSlot.targetLabel}`, /MOVE HERE|dotted path/i);
  const moveFoundation = getSimulatorV2LessonHelp(lesson, setup, {
    gamePhase: "setup",
    hasCoralInPlay: true,
    layoutLessonProgress: { "move-slot": true },
  });
  assert.equal(moveFoundation.target, "foundation-drag", "the finger moves to Brain Coral when its branch is explained");
  assert.equal(moveFoundation.actionId, "move-foundation");
  assert.match(moveFoundation.action, /^Brain Coral.*whole branch.*Press and hold Brain Coral.*left or right.*release in open water.*connected slots move with it/is);
  assert.match(moveFoundation.pointerPrompt, /Brain Coral.*left or right/i);
  assert.doesNotMatch(`${moveFoundation.action} ${moveFoundation.pointerPrompt} ${moveFoundation.targetLabel}`, /MOVE HERE|dotted path/i);
  assert.notEqual(moveFoundation.cueId, moveSlot.cueId, "the new instruction starts a new cue");
  const beginRound = getSimulatorV2LessonHelp(lesson, setup, {
    gamePhase: "setup",
    hasCoralInPlay: true,
    layoutLessonProgress: { "move-foundation": true, "move-slot": true },
  });
  assert.match(beginRound.action, /start of every round.*Condition.*both ecosystems.*collect RP.*draw.*Press Begin Round/is);

  const seaUrchinDraw = getSimulatorV2LessonHelp(lesson, step("tutorial-draw-card"), {
    gamePhase: "draw",
    modal: "turn-draw",
    drawSelected: 0,
    drawTarget: 1,
  });
  assert.match(seaUrchinDraw.action, /Foundation Deck.*Corals.*upgrades.*Pals Deck.*creatures.*Habitats.*Support cards.*Sea Urchin.*Pals Deck/is);
  const confirmSeaUrchin = getSimulatorV2LessonHelp(lesson, step("tutorial-draw-card"), {
    gamePhase: "draw",
    modal: "turn-draw",
    drawSelected: 1,
    drawTarget: 1,
  });
  assert.equal(confirmSeaUrchin.action, seaUrchinDraw.action);
  assert.equal(confirmSeaUrchin.cueId, seaUrchinDraw.cueId);

  const seaUrchin = getSimulatorV2LessonHelp(lesson, step("tutorial-build-card"), {
    hand: ["sea-urchin"],
  });
  assert.match(seaUrchin.action, /round symbols.*inherits its Coral's habitat.*icon shows the creature class.*match both.*Fish slots accept Fish.*Predator slots accept Fish or Predators.*Predators cannot use Fish slots.*Apex slots accept Fish, Predators, or Apex creatures.*Invertebrate and Filter Feeder slots.*matching class/is);
  assert.match(seaUrchin.action, /Sea Urchin is a Reef Invertebrate.*printed 1 VP.*stays in your ecosystem.*glowing Reef Invertebrate slot/is);
  const placingSeaUrchin = getSimulatorV2LessonHelp(lesson, step("tutorial-build-card"), {
    playingCardId: "sea-urchin",
  });
  assert.equal(placingSeaUrchin.action, seaUrchin.action);
  assert.equal(placingSeaUrchin.cueId, seaUrchin.cueId);

  const secondCoral = getSimulatorV2LessonHelp(lesson, step("v2-place-resistant-coral"), {
    hand: ["mustard-hill-coral-base"],
  });
  assert.match(secondCoral.action, /Base Coral.*separate Foundation.*Stage card upgrades.*beside Brain Coral.*instead of on top.*2 RP.*no Disease weakness/is);
  const disease = getSimulatorV2LessonHelp(lesson, step("v2-watch-coral-disease"), {});
  assert.match(disease.action, /Brain Coral.*Weaknesses.*Disease.*Coral Disease.*stops its RP.*Coral stays in play/is);
  assert.match(disease.action, /Storm.*swirl.*High Temperature.*thermometer.*Hurricane.*Severe Coral Bleaching.*matching symbols/is);
  assert.match(disease.action, /Mustard Hill.*no weakness icon.*2 RP.*safe/is);
  for (const weaknessType of ["Storm", "High Temperature", "Disease"]) {
    assert.match(disease.action, new RegExp(weaknessType, "i"), `${weaknessType} should be explained`);
  }
  assert.equal(disease.target, "coral-weakness", "the finger should point to the weakness print on the in-play Coral");
  assert.equal(disease.targetCardId, "brain-coral-base", "the explanation should focus Brain Coral rather than an unrelated card");
  assert.equal(
    getSimulatorV2LessonHelp(lesson, step("v2-watch-coral-disease"), { inspectedCardOpen: true }).target,
    "coral-weakness",
    "clicking a card must not move the teaching cue to an unrelated inspector control",
  );
  const afterWeaknessTour = getSimulatorV2LessonHelp(lesson, step("v2-watch-coral-disease"), {
    weaknessTourAcknowledged: true,
  });
  assert.equal(afterWeaknessTour.target, "turn-button", "End Turn becomes the target only after the weakness close-up");
  assert.match(afterWeaknessTour.action, /End (?:your )?turn/i);
  assert.notEqual(afterWeaknessTour.cueId, disease.cueId, "advancing the dialogue should start a new finger cue");

  const upgradeDraw = getSimulatorV2LessonHelp(lesson, step("v2-draw-first-upgrade"), {
    gamePhase: "draw",
    modal: "turn-draw",
    drawSelected: 0,
    drawTarget: 1,
  });
  assert.match(upgradeDraw.action, /Coral stages.*Foundation Deck.*matching next Stage.*survived a full turn/is);
  const upgrade = getSimulatorV2LessonHelp(lesson, step("v2-upgrade-first-coral"), {
    hand: ["brain-coral-stage-1"],
  });
  assert.match(upgrade.action, /matching next Stage.*existing damage.*compatible residents.*10 to 20 HP.*withstand more damage.*1 to 2 RP.*Predator slot.*second Invertebrate slot.*more creatures can live there/is);
  const placingUpgrade = getSimulatorV2LessonHelp(lesson, step("v2-upgrade-first-coral"), {
    playingCardId: "brain-coral-stage-1",
  });
  assert.equal(placingUpgrade.action, upgrade.action);
  assert.equal(placingUpgrade.cueId, upgrade.cueId);
});

test("live coaching follows hand, placement, draw confirmation, result and active attack controls", () => {
  const first = getSimulatorV2Lesson("first-reef");
  const setup = first.contract.checkpoints[0];
  const help = (current, ui) => getSimulatorV2LessonHelp(first, current, ui);
  assert.equal(help(setup, { gamePhase: "setup", hasCoralInPlay: false }).target, "hand");
  assert.equal(help(setup, { gamePhase: "setup", selectedHandCard: first.setupCardId, handPopoverOpen: true }).target, "play-card");
  assert.equal(help(setup, { gamePhase: "setup", playingCardId: first.setupCardId }).target, "placement");
  const slotMoveHelp = help(setup, { gamePhase: "setup", hasCoralInPlay: true });
  assert.equal(slotMoveHelp.target, "slot-drag");
  assert.equal(slotMoveHelp.interaction, "drag");
  assert.equal(slotMoveHelp.dragDestination, "clear-water");
  const foundationMoveHelp = help(setup, {
    gamePhase: "setup",
    hasCoralInPlay: true,
    layoutLessonProgress: { "move-slot": true },
  });
  assert.equal(foundationMoveHelp.target, "foundation-drag");
  assert.equal(foundationMoveHelp.interaction, "drag");
  assert.equal(foundationMoveHelp.dragDestination, "clear-water");
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
  assert.match(getSimulatorV2LessonHelp(attack, attackDrawStep, { gamePhase: "draw", drawSelected: 0, drawTarget: 1 }).message, /Blue Crab.*Passive.*Scavenge/is);
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
    drawTarget: 1,
    discardPileCardIds: ["sea-urchin"],
  });
  assert.equal(transitioningUpgradeDrawHelp.targetDeck, "pals");
  assert.match(transitioningUpgradeDrawHelp.message, /Blue Crab.*Passive.*Scavenge/is);
  const upgradeDraw = first.contract.checkpoints.find(({ id }) => id === "v2-draw-first-upgrade");
  const upgradeDrawHelp = getSimulatorV2LessonHelp(first, upgradeDraw, {
    gamePhase: "draw",
    drawSelected: 0,
    drawTarget: 1,
  });
  assert.equal(upgradeDrawHelp.targetDeck, "foundation");
  assert.match(upgradeDrawHelp.action, /Coral stages live in the Foundation Deck.*matching next Stage.*survived a full turn.*confirm your draw/is);
  assert.match(upgradeDrawHelp.message, /Brain Coral Stage 1.*Foundation Deck/is);
  const upgradeStep = first.contract.checkpoints.find(({ id }) => id === "v2-upgrade-first-coral");
  assert.match(getSimulatorV2LessonHelp(first, upgradeStep, { hand: ["brain-coral-stage-1"] }).message, /resilience rises from 10 to 20 HP.*2 RP instead of 1.*Predator slot.*another Invertebrate slot/s);
  const passiveStep = attack.contract.checkpoints.find(({ id }) => id === "v2-place-passive");
  assert.match(getSimulatorV2LessonHelp(attack, passiveStep, { hand: ["blue-crab"] }).message, /Eco Boost is a Passive ability.*automatically.*maximum RP bank by 1/s);
  const recoveryStep = attack.contract.checkpoints.find(({ id }) => id === "v2-recover-sea-urchin");
  const recoveryHelp = getSimulatorV2LessonHelp(attack, recoveryStep, {});
  assert.equal(recoveryHelp.target, "player-board");
  assert.equal(recoveryHelp.targetCardId, "blue-crab");
  assert.match(recoveryHelp.message, /Action.*waits for your command.*decide when to use it.*Scavenge costs 2 RP.*Sea Urchin.*discard pile/is);
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
  assert.match(predatorDrawHelp.message, /Scavenge brought Sea Urchin back.*Great Barracuda.*Reef Predator.*ecosystem zone and slots.*creature class.*placement and targeting/is);
  const predatorBuildStep = attack.contract.checkpoints.find(({ id }) => id === "v2-place-predator");
  const predatorBuildHelp = getSimulatorV2LessonHelp(attack, predatorBuildStep, { hand: ["great-barracuda"] });
  assert.equal(predatorBuildHelp.targetCardId, "great-barracuda");
  assert.match(predatorBuildHelp.message, /Reef Predator.*Reef Fish or Reef Predator.*cannot use a Fish slot.*Predator slot.*Quick Strike.*D6 Bite.*Fish or Predator/is);
  const predatorAttackStep = attack.contract.checkpoints.find(({ id }) => id === "v2-predator-attack");
  const predatorAttackHelp = getSimulatorV2LessonHelp(attack, predatorAttackStep, {});
  assert.equal(predatorAttackHelp.target, "opponent-board");
  assert.match(predatorAttackHelp.message, /Quick Strike.*On Play.*Bite can target.*Fish or Predator.*not an Invertebrate or Apex.*Spanish Hogfish.*Reef Fish.*legal.*Sea Urchin would not/is);
  const scoreStep = attack.contract.checkpoints.find(({ actionType }) => actionType === "vp-earned");
  assert.equal(getSimulatorV2LessonHelp(attack, scoreStep, {}).target, "vp-score");
  const condition = getSimulatorV2Lesson("support-search");
  const conditionStep = condition.contract.checkpoints.find(({ id }) => id === "v2-clear-stunned");
  assert.match(
    getSimulatorV2LessonHelp(condition, conditionStep, {}).message,
    /Stunned is a status.*separate from.*Condition.*blocks upgrading.*Coral Heal first.*Coral Gardener prevents more Supports/s,
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
    drawTarget: 1,
    previouslyTaughtConcepts,
  });
  assert.match(drawHelp.message, /Blue Crab.*Passive.*Scavenge/is, "the later lesson keeps scenario-specific direction");
  assert.doesNotMatch(drawHelp.message, /holds creatures and other Pals cards/i);

  assert.match(
    getSimulatorV2LessonHelp(attack, attackDraw, {
      gamePhase: "draw",
      drawSelected: 0,
      drawTarget: 1,
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
  const searchedCoral = support.contract.checkpoints.find(({ id }) => id === "v2-upgrade-after-stun");
  assert.match(
    getSimulatorV2LessonHelp(support, searchedCoral, { gamePhase: "main", hand: ["brain-coral-stage-1"] }).message,
    /Coral Heal cleared Stunned.*Brain Coral can upgrade.*Predator slot/s,
    "new search follow-through keeps its lesson-specific explanation",
  );
});

test("Apex coaching points to the Habitat prerequisites before inviting an Apex play", () => {
  const selected = getSimulatorV2Lesson("apex-predators");
  const steps = selected.contract.checkpoints;
  const fish = getSimulatorV2LessonHelp(selected, steps[0], { hand: ["clownfish", "arrow-crab", "coral-reef"] });
  assert.equal(fish.targetCardId, "clownfish");
  const invertebrate = getSimulatorV2LessonHelp(selected, steps[1], { hand: ["arrow-crab", "coral-reef"] });
  assert.equal(invertebrate.targetCardId, "arrow-crab");
  const habitat = getSimulatorV2LessonHelp(selected, steps[2], { hand: ["coral-reef"] });
  assert.equal(habitat.targetCardId, "coral-reef");
  assert.match(habitat.message, /four.*Coral.*two.*Fish.*two.*Invertebrate|4.*Coral.*2.*Fish.*2.*Invertebrate/is);
});

test("hand play guidance teaches the real upward drag and matching drop destination while preserving click placement fallback", () => {
  const first = getSimulatorV2Lesson("first-reef");
  const setup = first.contract.checkpoints[0];
  const initial = getSimulatorV2LessonHelp(first, setup, { gamePhase: "setup", hasCoralInPlay: false });
  assert.equal(initial.target, "hand");
  assert.equal(initial.targetCardId, "brain-coral-base");
  assert.equal(initial.interaction, "drag");
  assert.equal(initial.action, "Great! Now that we know how to read Foundation cards, drag Brain Coral into your ecosystem for a cost of 1 RP.");
  assert.match(initial.hint, /upward.*release/);
  assert.match(initial.hint, /select (?:it|the card), choose Play/);
  const inspected = getSimulatorV2LessonHelp(first, setup, { gamePhase: "setup", selectedHandCard: first.setupCardId, handPopoverOpen: true });
  assert.equal(inspected.interaction, "tap", "the gesture follows the actual Play Card control once details are open");
  assert.equal(inspected.target, "play-card", "the inspector retains the accessible Play control");
  assert.equal(inspected.pointerPrompt, "Choose Play Card.");
  assert.equal(inspected.action, initial.action, "opening the card should not replace or restart the spoken lesson");
  assert.match(inspected.hint, /choose a compatible|choose open water/i);
  const clickPlacement = getSimulatorV2LessonHelp(first, setup, { gamePhase: "setup", playingCardId: first.setupCardId });
  assert.equal(clickPlacement.target, "placement");
  assert.notEqual(clickPlacement.interaction, "drag");
  assert.equal(clickPlacement.action, initial.action);
  assert.equal(clickPlacement.pointerPrompt, "Choose the highlighted open water.");

  const creatureStep = first.contract.checkpoints.find(({ id }) => id === "tutorial-build-card");
  const creatureInstruction = getSimulatorV2LessonHelp(first, creatureStep, { gamePhase: "main", hand: ["sea-urchin"] });
  assert.equal(creatureInstruction.interaction, "drag");
  assert.equal(creatureInstruction.targetCardId, "sea-urchin");
  assert.match(creatureInstruction.action, /Sea Urchin is a Reef Invertebrate.*drag it into the glowing Reef Invertebrate slot/is);
  const creaturePlacement = getSimulatorV2LessonHelp(first, creatureStep, { gamePhase: "main", playingCardId: "sea-urchin" });
  assert.equal(creaturePlacement.target, "placement");
  assert.notEqual(creaturePlacement.interaction, "drag");
  assert.equal(creaturePlacement.action, creatureInstruction.action);
  assert.equal(creaturePlacement.pointerPrompt, "Choose the glowing Reef Invertebrate slot.");
  const secondCoralStep = first.contract.checkpoints.find(({ id }) => id === "v2-place-resistant-coral");
  const secondCoralInstruction = getSimulatorV2LessonHelp(first, secondCoralStep, { gamePhase: "main", hand: ["mustard-hill-coral-base"] });
  assert.equal(secondCoralInstruction.interaction, "drag");
  assert.equal(secondCoralInstruction.targetCardId, "mustard-hill-coral-base");
  assert.match(secondCoralInstruction.action, /Base Coral begins a separate Foundation.*place it in empty water beside Brain Coral.*Drag it into the highlighted open water/is);
  assert.match(secondCoralInstruction.message, /no Disease weakness.*2 RP production/s);
  const apex = getSimulatorV2Lesson("apex-predators");
  const habitatHelp = getSimulatorV2LessonHelp(apex, apex.contract.checkpoints[2], { gamePhase: "main", hand: ["coral-reef"] });
  assert.equal(habitatHelp.targetCardId, "coral-reef");
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
  const blank = { version: 2, completedLessonIds: [] };
  assert.deepEqual(parseSimulatorV2LessonProgress("{bad"), blank);
  assert.deepEqual(parseSimulatorV2LessonProgress({ version: 0, completedLessonIds: ["first-reef"] }), blank);
  const saved = parseSimulatorV2LessonProgress(JSON.stringify({
    version: 1,
    completedLessonIds: ["winning-turn", "apex-predators", "filter-feeder", "school-density", "clear-stun", "support-search", "first-attack", "first-reef", "first-reef", "unknown"],
  }));
  assert.deepEqual(saved.completedLessonIds, ["first-reef", "first-attack", "support-search", "filter-feeder"], "legacy completions carry forward only when the whole merged lesson was covered; the expanded Apex lesson reopens");
  assert.deepEqual(parseSimulatorV2LessonProgress({ version: 1, completedLessonIds: ["support-search", "filter-feeder"] }), blank, "a single half of a merged lesson does not skip its new content");
  assert.deepEqual(recordSimulatorV2LessonCompletion(saved, "first-reef"), saved);
  const after = recordSimulatorV2LessonCompletion(saved, "apex-predators");
  assert.deepEqual(after.completedLessonIds, ["first-reef", "first-attack", "support-search", "apex-predators", "filter-feeder"]);
  assert.deepEqual(parseSimulatorV2LessonProgress(JSON.stringify(after)), after, "new Apex completion survives reload");
  assert.deepEqual(createSimulatorTutorialProgress(getSimulatorV2Lesson("first-attack").contract).completedCheckpointIds, []);
});
