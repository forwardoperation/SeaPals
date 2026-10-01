import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { addResourceWithinCap, calculateRpBankCap, calculateVictoryPoints } from "./gameRules.mjs";
import { getSimulatorV2Lesson } from "./simulatorV2Lessons.mjs";
import {
  createSimulatorTutorialEvent,
  createSimulatorTutorialProgress,
  observeSimulatorTutorialEvent,
} from "./tutorialContract.mjs";
import { createGuidedAcademyCardLesson } from "./tutorialCardLessons.mjs";

const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(filename, { fsCache: false, alias: { "@": path.join(projectRoot, "src") } });
const { cardsById } = jiti(path.join(projectRoot, "src/data/cards/index.js"));
const { CardKind, EffectType } = jiti(path.join(projectRoot, "src/data/cards/types.js"));
const source = readFileSync(path.join(projectRoot, "src/app/simulator/Simulator.jsx"), "utf8");

function productionFunction(name, nextName, dependencies) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start);
  assert.ok(start >= 0 && end > start, `production function ${name} exists`);
  return new Function(...Object.keys(dependencies), `${source.slice(start, end)}; return ${name};`)(...Object.values(dependencies));
}

const getCardStartTurnRp = productionFunction("getCardStartTurnRp", "conditionPreventsCoralIncome", { CardKind });
const getCardPlayCost = productionFunction("getCardPlayCost", "getAutomatedHandKeepScore", { EffectType });

test("the complete open-water route advances using actual capped RP collections, including zero at a full bank", () => {
  const lesson = getSimulatorV2Lesson("filter-feeder");
  const condition = cardsById[lesson.seed.activeConditionId];
  const foundations = [];
  const permanents = [];
  const collections = new Map();
  let bank = lesson.seed.rp;
  let progress = createSimulatorTutorialProgress(lesson.contract);
  let round = lesson.seed.round;
  for (const [index, checkpoint] of lesson.contract.checkpoints.entries()) {
    assert.equal(progress.nextCheckpointId, checkpoint.id, "every prior step must have completed with the real economy");
    let details = {};
    if (checkpoint.actionType === "card-built") {
      const cardId = checkpoint.requirements.find(({ path }) => path === "details.cardId")?.value;
      const card = cardsById[cardId];
      const cost = getCardPlayCost(card, condition);
      assert.ok(bank >= cost, `${checkpoint.id} can afford ${card.name}: ${bank} RP available, ${cost} needed`);
      bank -= cost;
      const placement = checkpoint.requirements.find(({ path }) => path === "details.placement")?.value;
      if (placement === "foundation-upgrade") {
        const previous = foundations.findIndex(({ id }) => id === card.upgrade.evolvesFrom);
        assert.ok(previous >= 0, `${card.id} has its earlier stage in play`);
        foundations[previous] = card;
      } else if (placement === "foundation") foundations.push(card);
      else permanents.push(card);
      details = { cardId, cardKind: card.kind, placement, cost, accepted: true };
    } else if (checkpoint.actionType === "rp-collected") {
      const cap = calculateRpBankCap([...foundations, ...permanents], condition);
      const available = 1 + foundations.reduce((total, card) => total + getCardStartTurnRp(card), 0);
      const bankBefore = bank;
      bank = addResourceWithinCap(bank, available, cap);
      details = { collected: Math.max(0, bank - Math.min(bankBefore, cap)), available, bankBefore, bankAfter: bank, cap, conditionId: condition.id };
      collections.set(checkpoint.id, details);
    } else if (checkpoint.actionType === "card-drawn") {
      const draw = lesson.expectedDraws[checkpoint.id];
      details = { count: 1, foundationCount: draw.deckType === "foundation" ? 1 : 0, palsCount: draw.deckType === "pals" ? 1 : 0 };
    } else if (checkpoint.actionType === "turn-ended") round += 1;
    else if (checkpoint.actionType === "vp-earned") {
      const to = calculateVictoryPoints([...foundations, ...permanents]);
      details = { to, delta: cardsById["ocean-sunfish"].victoryPoints };
    }
    const event = createSimulatorTutorialEvent({
      eventId: `economic-audit:${index}`, tutorialId: lesson.contract.id,
      actor: "player", phase: "main", round, turn: round,
      actionType: checkpoint.actionType, details,
    });
    const observation = observeSimulatorTutorialEvent(lesson.contract, progress, event);
    assert.equal(observation.reason, "checkpoint-completed", `${checkpoint.id} must accept ${JSON.stringify(details)}`);
    progress = observation.progress;
  }
  const finalCollection = collections.get("v2-collect-for-ocean-sunfish");
  assert.equal(finalCollection.bankBefore, 13);
  assert.equal(finalCollection.bankAfter, 13);
  assert.equal(finalCollection.collected, 0, "the free Open Ocean play leaves no room for additional RP next turn");
  assert.equal(progress.status, "complete");
});

test("card introductions return to the actual next step instead of promising an unavailable placement", () => {
  const school = cardsById["herring-ball-stage2"];
  const upcoming = createGuidedAcademyCardLesson(school, { introductionOnly: true, nextStep: "lesson" });
  assert.equal(upcoming.advanceLabel, "Return to the lesson", "Momentum can fetch the next stage before it is legal to play");
  const ready = createGuidedAcademyCardLesson(school, { introductionOnly: true, nextStep: "placement" });
  assert.equal(ready.advanceLabel, "Continue to placement");
  const support = createGuidedAcademyCardLesson(cardsById["dr-evans"], { introductionOnly: true, nextStep: "support" });
  assert.equal(support.advanceLabel, "Continue to the Support effect");
  const cycled = createGuidedAcademyCardLesson(cardsById["spearfishing"], { introductionOnly: true, nextStep: "lesson" });
  assert.equal(cycled.advanceLabel, "Return to the lesson", "a refreshed hand can include cards saved for later turns");
});

test("the Sunfish collection accepts a full bank but cannot advance with insufficient RP", () => {
  const lesson = getSimulatorV2Lesson("filter-feeder");
  const checkpointIndex = lesson.contract.checkpoints.findIndex(({ id }) => id === "v2-collect-for-ocean-sunfish");
  const progress = createSimulatorTutorialProgress(lesson.contract, {
    completedCheckpointIds: lesson.contract.checkpoints.slice(0, checkpointIndex).map(({ id }) => id),
  });
  for (const [index, { details, completes }] of [
    { details: { collected: 0, bankAfter: 13 }, completes: true },
    { details: { collected: 0, bankAfter: 8 }, completes: true },
    { details: { collected: 1, bankAfter: 8 }, completes: true },
    { details: { collected: 0, bankAfter: 7 }, completes: false },
    { details: { collected: 7, bankAfter: 7 }, completes: false },
    { details: { collected: -1, bankAfter: 8 }, completes: false },
    { details: { collected: 12 }, completes: false },
  ].entries()) {
    const event = createSimulatorTutorialEvent({
      eventId: `sunfish-funds:${index}`, tutorialId: lesson.contract.id,
      actor: "player", phase: "draw", round: 8, turn: 8,
      actionType: "rp-collected", details,
    });
    const observation = observeSimulatorTutorialEvent(lesson.contract, progress, event);
    assert.equal(observation.reason === "checkpoint-completed", completes, JSON.stringify(details));
  }
});

function productionBoolean(name, parameters) {
  const match = source.match(new RegExp(`const ${name} = Boolean\\(([\\s\\S]*?)\\n  \\);`));
  assert.ok(match, `${name} is defined`);
  return new Function(...parameters, `return Boolean(${match[1]});`);
}

test("lesson victory waits for the exit dialogue and a correctly completed knowledge check", () => {
  const allowed = productionBoolean("embeddedLessonVictoryGateOpen", [
    "embeddedLesson", "tutorialProgress", "embeddedLessonPreVictoryAcknowledged", "embeddedLessonKnowledgeCheckPassed",
  ]);
  const lesson = { preVictoryMessage: "Well played.", knowledgeCheck: { prompt: "What comes next?" } };
  assert.equal(allowed(lesson, { status: "active" }, true, true), false);
  assert.equal(allowed(lesson, { status: "complete" }, false, false), false);
  assert.equal(allowed(lesson, { status: "complete" }, true, false), false);
  assert.equal(allowed(lesson, { status: "complete" }, false, true), false);
  assert.equal(allowed(lesson, { status: "complete" }, true, true), true);
  assert.equal(allowed(null, null, false, false), true, "ordinary matches still finish normally");
});

test("knowledge checks wait until gameplay and its final presentations have settled", () => {
  const state = {
    embeddedLesson: { preVictoryMessage: "Well played.", knowledgeCheck: { prompt: "What comes next?" } },
    tutorialProgress: { status: "complete" }, playerVp: 13, victoryTarget: 13,
    embeddedLessonPreVictoryAcknowledged: true, embeddedLessonKnowledgeCheckPassed: false,
    embeddedLessonPresentationBlocked: false, pendingEvents: [], modal: null, inspectedCardData: null,
    playingCardId: null, attackContext: null, searchContext: null, pendingCreatureAction: null,
    consumedAttackFlight: null, faceoffRolling: false, effectRollRolling: false,
  };
  const open = productionBoolean("embeddedLessonKnowledgeCheckOpen", Object.keys(state));
  const evaluate = (updates = {}) => open(...Object.values({ ...state, ...updates }));
  assert.equal(evaluate(), true);
  for (const key of ["embeddedLessonPresentationBlocked", "modal", "inspectedCardData", "playingCardId", "attackContext", "searchContext", "pendingCreatureAction", "consumedAttackFlight", "faceoffRolling", "effectRollRolling"]) {
    assert.equal(evaluate({ [key]: true }), false, `${key} must finish first`);
  }
  assert.equal(evaluate({ pendingEvents: [{}] }), false);
  assert.equal(evaluate({ embeddedLessonPreVictoryAcknowledged: false }), false);
  assert.equal(evaluate({ embeddedLessonKnowledgeCheckPassed: true }), false);
});

test("keyboard layout practice moves the actual foundation or slot and only completes its current lesson step", () => {
  const actions = { MOVE_FOUNDATION: "move-foundation", MOVE_SLOT: "move-slot" };
  const help = { actionId: actions.MOVE_FOUNDATION };
  let corals = [{ id: "coral-1", x: 50, y: 50, slots: [{ id: "slot-1" }] }];
  const completed = [];
  const move = productionFunction("handleTutorialLayoutKeyDown", "handleEcosystemClick", {
    GUIDED_ACADEMY_LAYOUT_ACTIONS: actions,
    gamePhase: "setup",
    tutorialHelp: help,
    setPlayerCorals: (update) => { corals = update(corals); },
    completeTutorialLayoutLessonAction: (action) => completed.push(action),
  });
  let prevented = 0;
  const key = (key) => ({ key, preventDefault() { prevented += 1; }, stopPropagation() {} });
  assert.equal(move(key("Enter"), "coral-1"), false);
  assert.equal(move(key("ArrowRight"), "coral-1", "slot-1"), false, "cannot skip the foundation step by moving a slot");
  assert.deepEqual(completed, []);
  assert.equal(move(key("ArrowRight"), "coral-1"), true);
  assert.equal(corals[0].x, 55);
  assert.equal(corals[0].y, 50);
  help.actionId = actions.MOVE_SLOT;
  assert.equal(move(key("ArrowDown"), "coral-1", "slot-1", { left: "120%", top: "30%" }), true);
  assert.deepEqual(corals[0].slots[0].position, { left: "120%", top: "35%" });
  assert.equal(corals[0].x, 55, "slot movement preserves its parent foundation location");
  assert.deepEqual(completed, [actions.MOVE_FOUNDATION, actions.MOVE_SLOT]);
  assert.equal(prevented, 2, "accepted arrow movements do not scroll the page");
});
