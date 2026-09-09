import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  SIMULATOR_V2_LESSON_MODULES,
  SIMULATOR_V2_LESSONS,
  createSimulatorV2LessonRuntime,
  createSimulatorV2LessonSeed,
  getSimulatorV2Lesson,
  getSimulatorV2ExpectedDraw,
  getSimulatorV2LessonHelp,
  getSimulatorV2LessonActionBlock,
  parseSimulatorV2LessonProgress,
  recordSimulatorV2LessonCompletion,
} from "./simulatorV2Lessons.mjs";
import {
  createSimulatorTutorialProgress,
  createSimulatorTutorialEvent,
  observeSimulatorTutorialEvent,
  getSimulatorTutorialCurrentCheckpoint,
} from "./tutorialContract.mjs";
import { addResourceWithinCap, calculateRpBankCap, calculateVictoryPoints, determineVictoryResult, resolveOpposedRoll } from "./gameRules.mjs";
import { attackCanTargetCard } from "./combatRules.mjs";
import { getHabitatRequirementError } from "./habitatRules.mjs";
import { createSchoolDensityBucketState } from "./schoolDensityRules.mjs";
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

test("ten lessons form four ordered modules and supply legal real-engine seeds", () => {
  assert.equal(SIMULATOR_V2_LESSONS.length, 10);
  assert.deepEqual(
    Object.fromEntries(SIMULATOR_V2_LESSONS.map(({ id, victoryTarget }) => [id, victoryTarget])),
    {
      "first-reef": 1,
      "reef-pals": 3,
      "first-attack": 3,
      "under-attack": 3,
      "support-search": 1,
      "clear-stun": 1,
      "school-density": 1,
      "filter-feeder": 8,
      "apex-predators": 13,
      "winning-turn": 5,
    },
  );
  assert.deepEqual(
    SIMULATOR_V2_LESSON_MODULES.map(({ id, lessonIds }) => ({ id, lessonIds })),
    [
      { id: "reef-basics", lessonIds: ["first-reef", "reef-pals"] },
      { id: "battle-basics", lessonIds: ["first-attack", "under-attack"] },
      { id: "smart-plays", lessonIds: ["support-search", "clear-stun"] },
      { id: "build-to-victory", lessonIds: ["school-density", "filter-feeder", "apex-predators", "winning-turn"] },
    ],
  );
  assert.deepEqual(
    SIMULATOR_V2_LESSON_MODULES.flatMap(({ lessonIds }) => lessonIds),
    SIMULATOR_V2_LESSONS.map(({ id }) => id),
    "module order and curriculum order stay aligned",
  );
  for (const selected of SIMULATOR_V2_LESSONS) {
    const runtime = createSimulatorV2LessonRuntime(selected.id);
    const seed = createSimulatorV2LessonSeed(selected.id);
    assert.equal(runtime.scriptedDecks, false);
    assert.equal(runtime.lesson, selected);
    assert.equal(runtime.contract, selected.contract);
    assert.equal(runtime.guide.name, "Mr. Easterling");
    assert.match(selected.celebration, /!$/);
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
      selected.id === "apex-predators" ? selected.contract.checkpoints.length - 2 : selected.contract.checkpoints.length - 1,
      `${selected.id} celebrates only after the scoring play and any mandatory on-play resolution`,
    );
    const module = SIMULATOR_V2_LESSON_MODULES.find(({ id }) => id === selected.moduleId);
    assert.ok(module?.lessonIds.includes(selected.id), `${selected.id} belongs to its declared module`);
    assert.equal(selected.number, SIMULATOR_V2_LESSONS.indexOf(selected) + 1);
    materializeTableau(seed.playerTableau);
    materializeTableau(seed.opponentTableau);
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
    assert.equal(seed.opponentTurnMode, selected.id === "under-attack" ? "play" : "observe");
    assert.equal(Object.hasOwn(seed, "forcedWinner"), false);
    assert.equal(Object.hasOwn(seed, "combatRolls"), false);
    const condition = cardsById[seed.activeConditionId];
    for (const cardId of [...seed.hand, ...seed.palsDeck]) {
      const card = cardsById[cardId];
      assert.equal((condition?.effects ?? []).some((effect) => effect.type === "modifyPlayCost" && effect.targetKind === card.kind && effect.targetCategories.includes(card.category)), false);
    }
  }
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

test("first lesson advances through real setup, collection, Pals draw and completed creature placement", () => {
  const selected = getSimulatorV2Lesson("first-reef");
  assert.equal(selected.seed.rp, 3);
  assert.equal(selected.seed.gamePhase, "setup");
  assert.deepEqual(getSimulatorV2ExpectedDraw(selected), { deckType: "pals", cardId: "sea-urchin" });
  const coralCost = cardsById[selected.setupCardId].cost.rp;
  const prepared = materializeTableau([{ foundationCardId: selected.setupCardId, placements: [] }]);
  const afterCollection = addResourceWithinCap(selected.seed.rp - coralCost, income(prepared), calculateRpBankCap(allCardsInPlay(prepared)));
  assert.equal(afterCollection, 4);
  assert.equal(afterCollection - cardsById["sea-urchin"].cost.rp, 3);
  const route = [
    { ...build(selected.setupCardId), phase: "setup" },
    { actionType: "match-ready", phase: "setup", details: { foundationCount: 1 } },
    rp, draw, build("sea-urchin"), vp(1, 1),
  ];
  assert.equal(observe(selected.id, route).progress.status, "complete");
  assert.equal(observe(selected.id, route.slice(0, -1)).progress.status, "active", "the lesson finishes only when the live VP change reaches its goal");
  assert.equal(determineVictoryResult(1, 0, selected.victoryTarget).winner, "player");
});

test("the two-creature lesson has exact affordable legal slots and requires the real VP change", () => {
  const selected = getSimulatorV2Lesson("reef-pals");
  const [foundation] = materializeTableau(selected.seed.playerTableau);
  let bank = selected.seed.rp;
  for (const cardId of selected.seed.hand) {
    const card = cardsById[cardId];
    const slot = foundation.slots.find((entry) => !entry.cardId && canCardOccupySlot(card, entry));
    assert.ok(slot);
    slot.cardId = cardId;
    bank -= card.cost.rp;
    assert.ok(bank >= 0);
  }
  assert.equal(bank, 0);
  assert.equal(calculateVictoryPoints(allCardsInPlay([foundation])), 3);
  assert.equal(determineVictoryResult(3, 0, selected.victoryTarget).winner, "player");
  assert.equal(observe(selected.id, [build("sea-urchin"), build("clownfish")]).progress.status, "active");
  assert.equal(observe(selected.id, [build("sea-urchin"), vp(1, 1), build("clownfish"), vp(3, 2)]).progress.status, "complete");
  assert.equal(observe(selected.id, [build("clownfish"), vp(2, 2)]).progress.completedCheckpointIds.length, 0, "the wrong card cannot skip the Invertebrate lesson");
});

test("the real Crunch can hit, miss or tie before Sea Urchin reaches the attack lesson's 3 VP goal", () => {
  const selected = getSimulatorV2Lesson("first-attack");
  const attacker = cardsById[selected.attackCardId];
  const defender = cardsById[selected.attackTargetCardId];
  const finisher = cardsById["sea-urchin"];
  const action = attacker.actions.find((entry) => entry.effect?.type === "attack");
  assert.equal(action.cost.rp, 1);
  assert.equal(selected.seed.rp, action.cost.rp + finisher.cost.rp);
  assert.deepEqual(selected.seed.hand, [finisher.id]);
  assert.equal(attackCanTargetCard(defender, action.effect), true);
  assert.equal(calculateVictoryPoints(allCardsInPlay(materializeTableau(selected.seed.playerTableau))), 2);
  assert.equal(determineVictoryResult(2, 1, selected.victoryTarget), null, "the lesson cannot win before the attack");
  for (const [attackRandom, defenseRandom] of [[0.999, 0], [0, 0.999], [0, 0]]) {
    const sequence = [attackRandom, defenseRandom];
    const resolution = resolveOpposedRoll(action.effect.attackDice, defender.defense.dice, () => sequence.shift());
    assert.equal(resolution.resolved, true);
    const event = { actionType: "attack-resolved", details: { accepted: true, attackerCardId: attacker.id, onPlay: false, resolution } };
    assert.equal(observe(selected.id, [event]).progress.status, "active", "the faceoff unlocks the scoring play but does not skip it");
    assert.equal(observe(selected.id, [event, build(finisher.id)]).progress.status, "active", "placing the card still waits for the real VP update");
    assert.equal(observe(selected.id, [event, build(finisher.id), vp(3, 1)]).progress.status, "complete");
    assert.equal(observe(selected.id, [{ ...event, actor: "opponent" }]).progress.status, "active");
    assert.equal(observe(selected.id, [{ ...event, details: { ...event.details, accepted: false } }]).progress.status, "active");
  }
});

test("the defense lesson requires a committed opponent attack before the player can rebuild", () => {
  const selected = getSimulatorV2Lesson("under-attack");
  const attacker = cardsById["spanish-hogfish"];
  const defender = cardsById["arrow-crab"];
  const action = attacker.actions.find((entry) => entry.effect?.type === "attack");
  assert.equal(selected.seed.opponentTurnMode, "play");
  assert.equal(selected.seed.opponent.rp, 0);
  assert.deepEqual(getSimulatorV2ExpectedDraw(selected), { deckType: "pals", cardId: "flounder" });
  assert.equal(attackCanTargetCard(defender, action.effect), true);
  assert.equal(calculateVictoryPoints(allCardsInPlay(materializeTableau(selected.seed.playerTableau))), 1);
  assert.equal(cardsById.flounder.victoryPoints, selected.victoryTarget);

  const pass = { actionType: "turn-ended", details: {} };
  const opponentAttack = {
    actionType: "attack-resolved",
    actor: "opponent",
    details: { accepted: true, attackerCardId: attacker.id, onPlay: false },
  };
  const route = [pass, opponentAttack, draw, build("flounder"), vp(3, 3)];
  assert.equal(observe(selected.id, route).progress.status, "complete");
  assert.equal(observe(selected.id, [pass, { ...opponentAttack, actor: "player" }, draw, build("flounder"), vp(3, 3)]).progress.completedCheckpointIds.length, 1);
  assert.equal(observe(selected.id, [pass, { ...opponentAttack, details: { ...opponentAttack.details, accepted: false } }]).progress.completedCheckpointIds.length, 1);
  assert.equal(observe(selected.id, route.slice(0, -1)).progress.status, "active");
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

  const support = { actionType: "support-played", details: { accepted: true, cardId: gardener.id } };
  const route = [
    support,
    build("brain-coral-base", "foundation"),
    build("sea-urchin"),
    vp(1, 1),
  ];
  assert.equal(observe(selected.id, route).progress.status, "complete");
  assert.equal(observe(selected.id, [{ ...support, details: { ...support.details, accepted: false } }, ...route.slice(1)]).progress.completedCheckpointIds.length, 0);
  assert.equal(observe(selected.id, [support, build("brain-coral-base", "foundation-upgrade")]).progress.completedCheckpointIds.length, 1);
});

test("the Stunned lesson clears the seeded status before a legal paid upgrade", () => {
  const selected = getSimulatorV2Lesson("clear-stun");
  const [foundationDefinition] = selected.seed.playerTableau;
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

  const support = { actionType: "support-played", details: { accepted: true, cardId: heal.id } };
  const route = [
    support,
    build("brain-coral-stage-1", "foundation-upgrade"),
    build("sea-urchin"),
    vp(1, 1),
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

  const route = [build(school.id, "foundation"), build(fish.id, "open-water"), vp(1, 1)];
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
  assert.equal(sunfish.victoryPoints, selected.victoryTarget);
  const afterPlay = createSchoolDensityBucketState(foundations, sunfish.schoolDensityRequirement, cardsById);
  assert.equal(afterPlay.available, 20);
  assert.equal(afterPlay.overCapacity, 0);

  assert.equal(observe(selected.id, [build(sunfish.id, "open-water"), vp(8, 8)]).progress.status, "complete");
  assert.equal(observe(selected.id, [build(sunfish.id, "foundation")]).progress.completedCheckpointIds.length, 0);
  assert.equal(observe(selected.id, [build(sunfish.id, "open-water")]).progress.status, "active");
});

test("the Apex lesson legally upgrades, opens an Apex slot, resolves Ravage twice, and reaches 13 VP", () => {
  const selected = getSimulatorV2Lesson("apex-predators");
  const foundations = materializeTableau(selected.seed.playerTableau);
  const startingCards = allCardsInPlay(foundations);
  const upgrade = cardsById["brain-coral-stage-2"];
  const hammerhead = cardsById.hammerhead;
  const apexSlot = upgrade.slots.find((slot) => slot.slotClass === "apex");
  const ravage = hammerhead.onPlay.find((action) => action.id === "ravage");
  const attackEffect = ravage.effects.find((effect) => effect.type === "attack");
  assert.equal(calculateVictoryPoints(startingCards), 7);
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

  const upgradeEvent = build(upgrade.id, "foundation-upgrade");
  const apexEvent = build(hammerhead.id);
  const ravageEvent = {
    actionType: "attack-resolved",
    details: { accepted: true, attackerCardId: hammerhead.id, onPlay: true, resolvedCount: 2 },
  };
  const route = [upgradeEvent, apexEvent, vp(13, 6), ravageEvent];
  assert.equal(observe(selected.id, route).progress.status, "complete");
  assert.equal(observe(selected.id, [upgradeEvent, apexEvent, vp(13, 6), { ...ravageEvent, details: { ...ravageEvent.details, resolvedCount: 1 } }]).progress.completedCheckpointIds.length, 3);
  assert.equal(observe(selected.id, [upgradeEvent, apexEvent, vp(13, 6), { ...ravageEvent, details: { ...ravageEvent.details, onPlay: false } }]).progress.completedCheckpointIds.length, 3);
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
  const creatureLesson = getSimulatorV2Lesson("reef-pals");
  const current = creatureLesson.contract.checkpoints[0];
  assert.equal(block(creatureLesson, current, "play-card", { cardId: "sea-urchin", gamePhase: "main" }), "");
  assert.ok(block(creatureLesson, current, "end-turn", { gamePhase: "main" }));
  assert.ok(block(creatureLesson, current, "attack", { cardId: "porcupine-fish" }));
  assert.ok(block(creatureLesson, current, "utility"));
  assert.ok(block(creatureLesson, null, "play-card", { cardId: "clownfish" }));
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
  assert.equal(help(setup, { gamePhase: "setup", hasCoralInPlay: true }).target, "turn-button");
  const drawStep = first.contract.checkpoints[2];
  assert.equal(help(drawStep, { gamePhase: "draw", modal: "turn-draw", drawSelected: 0, drawTarget: 1 }).targetDeck, "pals");
  assert.equal(help(drawStep, { gamePhase: "draw", modal: "turn-draw", drawSelected: 1, drawTarget: 1 }).target, "confirm-draw");
  assert.equal(help(first.contract.checkpoints[3], { modal: "draw-result" }).target, "continue-actions");
  assert.equal(help(first.contract.checkpoints[3], { playingCardId: "sea-urchin" }).target, "placement");
  const attack = getSimulatorV2Lesson("first-attack");
  const attackStep = attack.contract.checkpoints[0];
  assert.equal(getSimulatorV2LessonHelp(attack, attackStep, { readyAttack: { actionKey: "live-crunch" } }).targetActionKey, "live-crunch");
  assert.equal(getSimulatorV2LessonHelp(attack, attackStep, { inspectedAttack: { ready: true, actionKey: "live-crunch" }, inspectedPlayerCard: true }).target, "attack-button");
  assert.equal(getSimulatorV2LessonHelp(attack, attackStep, { attackContext: true }).target, "opponent-board");
  assert.equal(getSimulatorV2LessonHelp(attack, attackStep, { attackContext: true, inspectedCardOpen: true }).target, "close-modal");
  const scoreStep = attack.contract.checkpoints[1];
  const scoreHelp = getSimulatorV2LessonHelp(attack, scoreStep, { gamePhase: "main", hand: ["sea-urchin"] });
  assert.equal(scoreHelp.targetCardId, "sea-urchin");
  assert.equal(scoreHelp.interaction, "drag");
  assert.equal(getSimulatorV2LessonHelp(first, null, {}), null);
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
  assert.equal(initial.targetCardId, "mustard-hill-coral-base");
  assert.equal(initial.interaction, "drag");
  assert.match(initial.action, /Drag Mustard Hill Coral from your hand into your ecosystem/);
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

  const slotsLesson = getSimulatorV2Lesson("reef-pals");
  for (const [index, cardId, expectedClass] of [[0, "sea-urchin", "Invertebrate"], [1, "clownfish", "Fish"]]) {
    const current = slotsLesson.contract.checkpoints[index];
    const instruction = getSimulatorV2LessonHelp(slotsLesson, current, { gamePhase: "main", hand: [cardId] });
    assert.equal(instruction.interaction, "drag");
    assert.equal(instruction.targetCardId, cardId);
    assert.match(instruction.action, new RegExp(`Drag ${cardsById[cardId].name} from your hand into (?:a|the) highlighted ${expectedClass} slot`));
    const placement = getSimulatorV2LessonHelp(slotsLesson, current, { gamePhase: "main", playingCardId: cardId });
    assert.equal(placement.target, "placement");
    assert.notEqual(placement.interaction, "drag");
    assert.match(placement.action, new RegExp(`Choose a glowing ${expectedClass} slot`));
  }
  const final = getSimulatorV2Lesson("winning-turn");
  const chooseEither = getSimulatorV2LessonHelp(final, final.contract.checkpoints[2], { gamePhase: "main", hand: ["clownfish", "porcupine-fish"] });
  assert.equal(chooseEither.interaction, "drag");
  assert.match(chooseEither.action, /Drag either Fish from your hand into a highlighted Fish slot/);
  assert.deepEqual(new Set(chooseEither.targetCardIds), new Set(["clownfish", "porcupine-fish"]));
  const drawHelp = getSimulatorV2LessonHelp(first, first.contract.checkpoints[2], { gamePhase: "draw", drawSelected: 0, drawTarget: 1 });
  assert.notEqual(drawHelp.interaction, "drag", "draw controls do not advertise a card placement gesture");
  const attack = getSimulatorV2Lesson("first-attack");
  assert.notEqual(getSimulatorV2LessonHelp(attack, attack.contract.checkpoints[0], {}).interaction, "drag", "board attacks retain their existing interaction");
});

test("seed copies, restarts, and saved lesson progress stay independent", () => {
  const first = createSimulatorV2LessonSeed("first-attack");
  first.playerTableau[0].placements[0].cardId = "clownfish";
  assert.equal(createSimulatorV2LessonSeed("first-attack").playerTableau[0].placements[0].cardId, "porcupine-fish");
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
