import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { createJiti } from "jiti";
import * as game from "./gameRules.mjs";
import * as combat from "./combatRules.mjs";
import * as reef from "./reefAbilityRules.mjs";
import * as special from "./specialCardRules.mjs";
import * as zone from "./zoneRules.mjs";
import * as ai from "./opponentCombatRules.mjs";
import * as strategy from "./opponentPlayRules.mjs";
import * as difficulty from "./opponentDifficultyRules.mjs";
import * as actionRules from "./opponentActionRules.mjs";
import * as mimic from "./mimicRules.mjs";
import * as handLimits from "./handLimitRules.mjs";
import * as combatRolls from "./combatRollPresentation.mjs";
import * as combatBreakdown from "./combatResultBreakdown.mjs";

const jiti = createJiti(import.meta.url, { fsCache: false });
const { cardsById } = jiti("../../data/cards/index.js");
const types = jiti("../../data/cards/types.js");
const require = createRequire(import.meta.url);
const babel = require("next/dist/compiled/babel/bundle");
const source = readFileSync(new URL("./Simulator.jsx", import.meta.url), "utf8");
const ast = babel.parser().parse(source, { sourceType: "module", plugins: ["jsx"] });
const functions = new Map();
babel.traverse().default(ast, { FunctionDeclaration(path) {
  const parent = path.getFunctionParent();
  if (parent && parent.node.id?.name !== "Simulator") return;
  let jsx = false;
  path.traverse({ JSXElement() { jsx = true; }, JSXFragment() { jsx = true; } });
  if (!jsx) functions.set(path.node.id.name, source.slice(path.node.start, path.node.end));
}, VariableDeclarator(path) {
  if (["findZoneIndexBySlotId", "getPlayerReefSlotId", "getPlayerOrphanSlotId"].includes(path.node.id?.name)) {
    functions.set(path.node.id.name, `var ${path.node.id.name} = ${source.slice(path.node.init.start, path.node.init.end)};`);
  }
}, JSXElement(path) {
  if (path.node.openingElement.name?.name !== "button") return;
  const label = path.node.children.filter((child) => child.type === "JSXText").map((child) => child.value).join("").trim();
  if (label !== "Cancel Mimic") return;
  const handler = path.node.openingElement.attributes.find((attribute) => attribute.name?.name === "onClick")?.value?.expression;
  assert.ok(handler, "Mimic chooser has a working Cancel button");
  functions.set("cancelMimicChoice", `var cancelMimicChoice = ${source.slice(handler.start, handler.end)};`);
} });

const plain = (value) => JSON.parse(JSON.stringify(value));
const swimmer = (cardId, instanceId) => ({ cardId, instanceId });
const state = (overrides = {}) => ({
  corals: [], habitats: [], habitatInstances: [], reefCreatures: [], reefCreatureInstances: [],
  orphanCreatureInstances: [], orphanCreatures: [], creatureStatuses: {}, actionUses: {},
  actionCooldowns: {}, hand: [], foundationDeck: [], palsDeck: [], discardPile: [], lostZone: [],
  rp: 8, ...overrides,
});
const mimicAction = cardsById.octopus.actions.find((action) => action.id === "mimic");

function runtime(overrides = {}) {
  const assignments = [];
  const context = vm.createContext({
    ...game, ...combat, ...reef, ...special, ...zone, ...ai, ...strategy, ...difficulty, ...actionRules, ...mimic, ...handLimits, ...combatRolls, ...combatBreakdown, ...types,
    cardsById, round: 3, turn: 3, rp: 8, activeCondition: null,
    gameResult: null, gamePhase: "main", attackContext: null, playingCardId: null,
    inspectedCard: { owner: "player", cardId: "octopus", slotId: "reef-octopus-one" },
    inspectedActionKey: "reef-octopus-one", inspectedFoundationIsStunned: false,
    playerCorals: [], playerHabitats: [], playerHabitatInstances: [],
    playerReefCreatureInstances: [swimmer("octopus", "octopus-one")], playerReefCreatures: ["octopus"],
    playerOrphanCreatures: [], creatureStatuses: {}, usedCreatureActions: [], usedAttackers: [], actionCooldowns: {},
    opponent: state(), opponentCoralCards: [], opponentDifficulty: "hard",
    hand: [], foundationDeck: ["brain-coral-base"], palsDeck: ["blue-crab"], discardPile: [], lostZone: [],
    resilienceUsedCardIds: [], blueCrabRecycleUsedTurn: null, flashingAlarmAttackBonus: null,
    poisonImmunityNextPredatorAttack: false, supportBlockedUntilRound: 0, aideBlockedUntilRound: 0,
    pendingCreatureAction: null, eventOverlay: null, turnDrawSelection: null,
    scriptedFinishRoute: null, tutorialHelp: null, tutorialGuide: { name: "Guide" },
    embeddedLesson: null, tutorialCurrentCheckpoint: null, log: [], spendEvents: [], abilityEvents: [],
    getEmbeddedLessonBlock: () => "", getAcademyActionBlock: () => "",
    nextGameplayRandom: () => 0.99, assessCurrentOpponentThreat: () => ({ level: "setup" }),
    SIMULATOR_TUTORIAL_ACTION_TYPES: { ABILITY_RESOLVED: "ability-resolved" },
    emitTutorialEvent: () => {},
    ...overrides,
  });
  for (const code of functions.values()) vm.runInContext(code, context);
  // React setters apply after the current callback returns. Preserve that
  // snapshot behavior so existing completion handlers can read their pending
  // action after queuing its removal, just as they do in the real component.
  for (const [setter, key] of Object.entries({
    setRp: "rp", setUsedCreatureActions: "usedCreatureActions", setUsedAttackers: "usedAttackers",
    setActionCooldowns: "actionCooldowns", setPendingCreatureAction: "pendingCreatureAction",
    setInspectedCard: "inspectedCard", setEventOverlay: "eventOverlay", setAttackContext: "attackContext",
    setFoundationDeck: "foundationDeck", setPalsDeck: "palsDeck", setHand: "hand", setDiscardPile: "discardPile",
    setTurnDrawSelection: "turnDrawSelection", setOpponent: "opponent", setOpponentState: "opponent",
    setPoisonImmunityNextPredatorAttack: "poisonImmunityNextPredatorAttack",
    setNextOnPlayAttackBonus: "nextOnPlayAttackBonus", setGameResult: "gameResult", setPendingEvents: "pendingEvents",
  })) {
    context[setter] = (value, details) => {
      if (setter === "setRp") context.spendEvents.push(details ?? null);
      assignments.push(() => { context[key] = typeof value === "function" ? value(context[key]) : value; });
    };
  }
  Object.assign(context, {
    getEmbeddedLessonBlock: () => "", getAcademyActionBlock: () => "",
    pushLog: (message) => context.log.push(message),
    trackSimulatorAbility: (...args) => context.abilityEvents.push(args),
    getPlayerRpSpendPresentation: (card, amount, details) => ({ sourceCardId: card.id, spendAmount: amount, ...details }),
    getPlayerAttackTargets: () => [{ cardId: "blue-crab", instanceId: "target-one", coralId: null, slotId: "reef-target-one" }],
    assessCurrentOpponentThreat: () => ({ level: "setup" }),
  });
  context.invoke = (name, ...args) => {
    const result = context[name](...args);
    while (assignments.length) assignments.shift()();
    return result;
  };
  return context;
}

function donorBoard(cardId, instanceId = "donor-one") {
  return state({ reefCreatures: [cardId], reefCreatureInstances: [swimmer(cardId, instanceId)] });
}

test("player copies a draw action, pays Mimic's 3 RP once, and keeps Octopus as the acting creature", () => {
  const r = runtime({ opponent: donorBoard("emerald-crab") });
  r.invoke("beginCreatureUtilityAction", mimicAction);
  assert.equal(r.rp, 8);
  assert.equal(r.pendingCreatureAction.candidates.length, 1);
  r.invoke("completeMimicAction", "donor-one:0");
  assert.equal(r.rp, 8, "choosing a donor does not prepay the copied utility");
  assert.equal(r.pendingCreatureAction.sourceCardId, "octopus");
  assert.equal(r.pendingCreatureAction.sourceCardInstanceId, "octopus-one");
  assert.equal(r.pendingCreatureAction.cost, 3);
  r.turnDrawSelection = { requested: 2, target: 2, foundation: 1, pals: 1 };
  r.invoke("completeCreatureDrawAction");
  assert.equal(r.rp, 5);
  assert.deepEqual(plain(r.hand), ["brain-coral-base", "blue-crab"]);
  assert.deepEqual(plain(r.usedCreatureActions), ["reef-octopus-one:mimic"]);
  assert.equal(r.eventOverlay.sourceCardId, "octopus");
  assert.equal(r.spendEvents.length, 1);
  assert.equal(r.spendEvents[0].spendAmount, 3);
  assert.equal(r.spendEvents[0].cardInstanceId, "octopus-one");
  assert.equal(cardsById["emerald-crab"].actions[0].cost.rp, 2);
  r.invoke("completeCreatureDrawAction");
  assert.equal(r.rp, 5, "stale completion cannot pay or draw twice");
});

test("a copied attack belongs to Octopus and inherits donor targeting and next-turn cooldown", () => {
  const r = runtime({ opponent: donorBoard("mantis-shrimp") });
  r.invoke("beginCreatureUtilityAction", mimicAction);
  r.invoke("completeMimicAction", "donor-one:0");
  const context = r.attackContext;
  assert.equal(r.rp, 8);
  assert.equal(context.attackerCardId, "octopus");
  assert.equal(context.attackerInstanceId, "octopus-one");
  assert.equal(context.attackOverride.actionCost, 3);
  assert.deepEqual(plain(context.attackOverride.target.categories), ["invertebrate"]);
  r.invoke("commitPlayerAttackCost", context, cardsById.octopus, context.attackOverride);
  assert.equal(r.rp, 5);
  assert.deepEqual(plain(r.usedCreatureActions), ["reef-octopus-one:mimic"]);
  assert.deepEqual(plain(r.usedAttackers), []);
  assert.equal(r.actionCooldowns["reef-octopus-one:mimic"], 5);
  assert.equal(r.actionCooldowns["reef-donor-one"], undefined);
  assert.equal(r.spendEvents[0].sourceCardId, "octopus");
  assert.equal(r.spendEvents[0].cardInstanceId, "octopus-one");
  r.invoke("commitPlayerAttackCost", { ...context, costCommitted: true }, cardsById.octopus, context.attackOverride);
  assert.equal(r.rp, 5, "already committed repeat attacks do not repay Mimic");
});

test("invalid or stale donor choices spend nothing, including removed and newly stunned donors", () => {
  for (const change of [
    (r) => { r.opponent = state(); },
    (r) => { r.opponent.creatureStatuses = reef.stunCreatureAbilities({}, "donor-one", "yellow-lipped-sea-krait"); },
    (r) => { r.playerReefCreatureInstances = []; r.playerReefCreatures = []; },
    (r) => { r.creatureStatuses = reef.stunCreatureAbilities({}, "octopus-one", "yellow-lipped-sea-krait"); },
  ]) {
    const r = runtime({ opponent: donorBoard("emerald-crab") });
    r.invoke("beginCreatureUtilityAction", mimicAction);
    r.invoke("completeMimicAction", "unknown-donor:0");
    assert.equal(r.rp, 8);
    change(r);
    r.invoke("completeMimicAction", "donor-one:0");
    assert.equal(r.rp, 8);
    assert.deepEqual(plain(r.usedCreatureActions), []);
    assert.equal(r.attackContext, null);
  }
});

test("each Octopus has its own Mimic use, while cost, stun and cooldown block the acting copy", () => {
  const blocked = [
    { rp: 2 },
    { creatureStatuses: reef.stunCreatureAbilities({}, "octopus-one", "yellow-lipped-sea-krait") },
    { usedCreatureActions: ["reef-octopus-one:mimic"] },
    { actionCooldowns: { "reef-octopus-one:mimic": 5 } },
  ];
  for (const overrides of blocked) {
    const r = runtime({ opponent: donorBoard("emerald-crab"), ...overrides });
    r.invoke("beginCreatureUtilityAction", mimicAction);
    assert.equal(r.pendingCreatureAction, null);
    assert.equal(r.spendEvents.length, 0);
  }
  const r = runtime({
    opponent: donorBoard("emerald-crab"), usedCreatureActions: ["reef-octopus-one:mimic"],
    inspectedCard: { owner: "player", cardId: "octopus", slotId: "reef-octopus-two" }, inspectedActionKey: "reef-octopus-two",
    playerReefCreatureInstances: [swimmer("octopus", "octopus-one"), swimmer("octopus", "octopus-two")],
    playerReefCreatures: ["octopus", "octopus"],
  });
  r.invoke("beginCreatureUtilityAction", mimicAction);
  assert.equal(r.pendingCreatureAction.sourceCardInstanceId, "octopus-two");
  assert.equal(r.pendingCreatureAction.actionKey, "reef-octopus-two:mimic");
});

test("the chooser's actual Cancel control leaves RP and Mimic available", () => {
  const r = runtime({ opponent: donorBoard("emerald-crab") });
  r.invoke("beginCreatureUtilityAction", mimicAction);
  r.invoke("cancelMimicChoice");
  assert.equal(r.pendingCreatureAction, null);
  assert.equal(r.eventOverlay, null);
  assert.equal(r.rp, 8);
  assert.deepEqual(plain(r.usedCreatureActions), []);
  r.inspectedCard = { owner: "player", cardId: "octopus", slotId: "reef-octopus-one" };
  r.invoke("beginCreatureUtilityAction", mimicAction);
  assert.equal(r.pendingCreatureAction.sourceCardInstanceId, "octopus-one");
});

test("a copied effect on its controller belongs to Octopus, never the donor", () => {
  const r = runtime({ opponent: donorBoard("deep-sea-jelly") });
  const before = plain(r.opponent);
  r.invoke("beginCreatureUtilityAction", mimicAction);
  r.invoke("completeMimicAction", "donor-one:0");
  assert.equal(r.rp, 5);
  assert.equal(r.nextOnPlayAttackBonus.amount, 2);
  assert.equal(r.nextOnPlayAttackBonus.sourceCardId, "octopus");
  assert.deepEqual(plain(r.usedCreatureActions), ["reef-octopus-one:mimic"]);
  assert.deepEqual(plain(r.opponent), before);
});

test("AI copies utilities for 3 RP under the Octopus instance's once-per-turn key", () => {
  const r = runtime();
  const aiState = state({
    reefCreatures: ["octopus"], reefCreatureInstances: [swimmer("octopus", "ai-octopus")],
    foundationDeck: ["brain-coral-base"], palsDeck: ["blue-crab"],
  });
  const player = state({ reefCreatures: ["emerald-crab"], reefCreatureInstances: [swimmer("emerald-crab", "player-crab")] });
  const result = r.invoke("runOpponentUtilityAction", aiState, player);
  assert.equal(result.sourceCardId, "octopus");
  assert.equal(result.sourceCardInstanceId, "ai-octopus");
  assert.equal(result.actionCost, 3);
  assert.equal(result.state.rp, 5);
  assert.deepEqual(plain(result.state.hand), ["blue-crab", "brain-coral-base"]);
  assert.equal(result.state.actionUses["reef-ai-octopus:mimic"], 3);
  assert.equal(r.invoke("runOpponentUtilityAction", result.state, player), null);
  assert.equal(aiState.rp, 8, "AI planning/execution returns a new state without mutating its input");
  assert.equal(r.invoke("runOpponentUtilityAction", { ...aiState, creatureStatuses: reef.stunCreatureAbilities({}, "ai-octopus", "yellow-lipped-sea-krait") }, player), null);
});

test("copied conditional attack text retains Blue Sea Dragon's bonus without copying its passives", () => {
  const r = runtime({ opponent: donorBoard("blue-sea-dragon") });
  const choice = r.getMimicChoices("player", mimicAction)[0];
  assert.ok(choice?.attack);
  const targeted = r.getAttackConditionalModifier(cardsById.octopus, cardsById["man-o-war"], [], [], [], choice.attack);
  const ordinary = r.getAttackConditionalModifier(cardsById.octopus, cardsById["blue-crab"], [], [], [], choice.attack);
  assert.equal(targeted.flat, 1);
  assert.equal(ordinary.flat, 0);
  assert.match(targeted.details.join(" "), /Man O' War/);
});

test("AI plans copied attacks with Octopus's identity, Mimic's price and per-copy use key", () => {
  const r = runtime({ cardsById: { ...cardsById, "blue-crab": { ...cardsById["blue-crab"], victoryPoints: 10 } } });
  const aiState = state({ reefCreatures: ["octopus"], reefCreatureInstances: [swimmer("octopus", "ai-octopus")] });
  const playerCreatures = [swimmer("mantis-shrimp", "player-mantis"), swimmer("blue-crab", "player-crab")];
  const original = plain(aiState);
  let plan;
  const result = r.invoke("runOpponentAttackStep", aiState, [], playerCreatures, [], null, [], {
    planCombatOnly: true, captureCombatPlan: (next) => { plan = next; },
  });
  assert.ok(plan, "AI should find a copied Shatter attack");
  assert.equal(plan.forcedAttack.cardId, "octopus");
  assert.equal(plan.attackerInstanceId, "ai-octopus");
  assert.equal(plan.forcedAttack.attack.actionCost, 3);
  assert.equal(plan.forcedAttack.attack.mimic.donorCardId, "mantis-shrimp");
  assert.equal(result.opponentAttackActionKey, "reef-ai-octopus:mimic");
  assert.equal(result.opponentCooldownKey, "reef-ai-octopus");
  assert.deepEqual(plain(aiState), original, "AI planning spends no RP and does not mark usage");
  for (const blocked of [
    { rp: 2 }, { actionUses: { "reef-ai-octopus:mimic": 3 } },
    { actionCooldowns: { "reef-ai-octopus": 5 } },
    { creatureStatuses: reef.stunCreatureAbilities({}, "ai-octopus", "yellow-lipped-sea-krait") },
  ]) {
    assert.equal(r.invoke("runOpponentAttackStep", { ...aiState, ...blocked }, [], playerCreatures, [], null, [], { planCombatOnly: true }), null);
  }
});

test("copied action analytics record the catalog's Mimic key for either controller", () => {
  const r = runtime({ opponent: donorBoard("emerald-crab") });
  const events = [];
  vm.runInContext(functions.get("trackSimulatorAbility"), r);
  r.trackSimulatorAnalytics = (event) => events.push(plain(event));
  const copiedName = r.getMimicChoices("player", mimicAction)[0].action.name;
  for (const side of ["player", "opponent"]) {
    r.invoke("trackSimulatorAbility", side, "actions", "octopus", copiedName);
  }
  assert.deepEqual(events, [
    { side: "player", counter: "actions", key: "octopus::Mimic", id: null },
    { side: "opponent", counter: "actions", key: "octopus::Mimic", id: null },
  ]);
  r.invoke("trackSimulatorAbility", "player", "actions", "octopus", "Unknown copied action");
  assert.equal(events.length, 2, "unknown actions still cannot create unregistered analytics keys");
});

test("AI repeat continuations retain the chosen copied attack and Octopus identity with one cost", () => {
  // Exercise the generic repeat contract by giving the existing Shatter action
  // three attacks; its ordinary printed target and attack rules stay intact.
  const donor = structuredClone(cardsById["mantis-shrimp"]);
  const attackEffect = donor.actions[0].effects?.find((effect) => effect.type === types.EffectType.ATTACK)
    ?? donor.actions[0].effect;
  assert.equal(attackEffect.type, types.EffectType.ATTACK);
  attackEffect.repeat = 3;
  const r = runtime({ cardsById: {
    ...cardsById, "mantis-shrimp": donor,
    "blue-crab": { ...cardsById["blue-crab"], victoryPoints: 10 },
  } });
  const aiState = state({ reefCreatures: ["octopus"], reefCreatureInstances: [swimmer("octopus", "ai-octopus")] });
  const targets = [swimmer("mantis-shrimp", "player-mantis"), ...[1, 2, 3].map((index) => swimmer("blue-crab", `player-crab-${index}`))];
  const first = r.invoke("runOpponentAttack", aiState, [], targets, [], null, null, { maxAttackSteps: 1 }, { attack: 6, defense: 1 });
  assert.equal(first.attackerCardId, "octopus");
  assert.equal(first.actionCost, 3);
  assert.equal(first.nextContinuation.remainingAttacks, 2);
  assert.equal(first.nextContinuation.forcedAttack.reefInstanceId, "ai-octopus");
  assert.equal(first.nextContinuation.forcedAttack.attack.mimic.donorCardId, "mantis-shrimp");
  const committed = r.invoke("buildOpponentAttackEventSequence", first, state({ reefCreatureInstances: targets, resilienceUsedCardIds: [] }), aiState);
  const paidState = committed.opponentState;
  assert.equal(paidState.rp, 5);
  assert.equal(paidState.actionUses["reef-ai-octopus:mimic"], 3);
  assert.equal(paidState.actionCooldowns["reef-ai-octopus"], 5);
  const rest = r.invoke("runOpponentAttack", paidState, first.corals, first.reefCreatureInstances, first.orphanCreatures, null, first.nextContinuation, {}, [{ attack: 6, defense: 1 }, { attack: 6, defense: 1 }]);
  assert.equal(rest.steps.length, 2);
  assert.equal(rest.actionCost, 3, "the sequence reports its original gross price once, not a sum of repeated attacks");
  assert.equal(rest.opponentAttackActionKey, "reef-ai-octopus:mimic");
  assert.equal(rest.nextContinuation, null);
  const steps = [...first.steps, ...rest.steps];
  assert.equal(new Set(steps.map((step) => step.targetInstanceId)).size, 3, "each repeat chooses a different physical target");
  for (const step of steps) {
    assert.equal(step.attackerCardId, "octopus");
    assert.equal(step.combatPlan.forcedAttack.reefInstanceId, "ai-octopus");
    assert.equal(step.combatPlan.forcedAttack.attack.mimic.donorCardId, "mantis-shrimp");
  }
  const finished = r.invoke("buildOpponentAttackEventSequence", rest, committed.playerState, paidState, { actionCostAlreadyPaid: true });
  assert.equal(finished.opponentState.rp, 5, "the paid continuation does not charge Mimic again");
  assert.deepEqual(plain(finished.opponentState.actionUses), { "reef-ai-octopus:mimic": 3 });
  assert.equal([...committed.events, ...finished.events].filter((event) => event.rpSpend).length, 1);
  assert.equal(committed.events[0].rpSpend.amount, 3);
  assert.equal(committed.events[0].rpSpend.cardInstanceId, "ai-octopus");
});
