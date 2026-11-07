import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { createRequire } from "node:module";
import { createJiti } from "jiti";
import * as reef from "./reefAbilityRules.mjs";
import * as combat from "./combatRules.mjs";
import * as game from "./gameRules.mjs";
import * as ai from "./opponentCombatRules.mjs";
import * as strategy from "./opponentPlayRules.mjs";
import * as difficulty from "./opponentDifficultyRules.mjs";
import * as actions from "./opponentActionRules.mjs";
import * as special from "./specialCardRules.mjs";
import * as zone from "./zoneRules.mjs";
import * as habitat from "./habitatRules.mjs";
import * as rolls from "./combatRollPresentation.mjs";
import * as invaders from "./lionfishInvaderRules.mjs";
import * as breakdown from "./combatResultBreakdown.mjs";
import * as boardEvaluation from "./opponentBoardEvaluation.mjs";
import { createCardKnowledge, createNamedAbilityKnowledge } from "../../lib/rulesKnowledgeBank.mjs";

const jiti = createJiti(import.meta.url, { fsCache: false });
const { cardsById } = jiti("../../data/cards/index.js");
const types = jiti("../../data/cards/types.js");
const require = createRequire(import.meta.url);
const babel = require("next/dist/compiled/babel/bundle");
const source = fs.readFileSync(new URL("./Simulator.jsx", import.meta.url), "utf8");
const ast = babel.parser().parse(source, { sourceType: "module", plugins: ["jsx"] });
const functions = new Map();
babel.traverse().default(ast, { FunctionDeclaration(path) {
  const parentFunction = path.getFunctionParent();
  if (parentFunction && parentFunction.node.id?.name !== "Simulator") return;
  let jsx = false;
  path.traverse({ JSXElement() { jsx = true; }, JSXFragment() { jsx = true; } });
  if (!jsx) functions.set(path.node.id.name, source.slice(path.node.start, path.node.end));
} });

const plain = (value) => JSON.parse(JSON.stringify(value));
const state = (extras = {}) => ({ corals: [], reefCreatures: [], reefCreatureInstances: [], orphanCreatureInstances: [], orphanCreatures: [], habitats: [], habitatInstances: [], creatureStatuses: {}, discardPile: [], lostZone: [], hand: [], foundationDeck: [], palsDeck: [], resilienceUsedCardIds: [], flashingAlarmAttackBonus: null, rp: 8, ...extras });
const slot = (cardId, instanceId) => ({ id: `position-${instanceId}`, cardId, cardInstanceId: instanceId, hostedCardIds: [] });
const coral = (...slots) => ({ id: "coral", cardId: "brain-coral-base", health: 60, maxHealth: 60, slots });
const swimmer = (cardId, instanceId) => ({ cardId, instanceId });

function runtime(overrides = {}) {
  const context = vm.createContext({
    ...reef, ...combat, ...game, ...ai, ...strategy, ...difficulty, ...actions, ...special, ...zone, ...habitat, ...rolls, ...invaders, ...boardEvaluation, ...breakdown, ...types,
    cardsById, Math, Map, Set, Object, Number, String, Array, Boolean, Infinity,
    round: 3, turn: 3, rp: 8, activeCondition: null, playerHabitats: [], creatureStatuses: {}, resilienceUsedCardIds: [], blueCrabRecycleUsedTurn: null,
    opponentCombatCheckpointIdRef: { current: 0 }, opponentDifficulty: "hard", nextGameplayRandom: () => 0.99,
    assessCurrentOpponentThreat: () => ({ level: "setup" }),
    ...overrides,
  });
  for (const code of functions.values()) vm.runInContext(code, context);
  // State projection is tested independently; reaction tests focus on exact
  // event order, ownership, identity and the actual combat/action resolvers.
  Object.assign(context, {
    normalizeProjectedPlayerState: (value) => value,
    normalizeProjectedOpponentState: (value) => value,
    projectNormalizedPlayerState: (value) => ({ state: value }),
    projectNormalizedOpponentState: (value) => ({ state: value }),
    assessCurrentOpponentThreat: () => ({ level: "setup" }),
    ...overrides,
  });
  return context;
}

test("Death Sting requires a Coral Reef in play and targets only Fish/Invertebrates", () => {
  const r = runtime();
  const attack = r.getOnPlayAttackEffect(cardsById["box-jellyfish"]);
  assert.equal(attack.attackDice, "D10");
  assert.equal(reef.onPlayAttackIsAvailable(attack, [], []), false);
  assert.equal(reef.onPlayAttackIsAvailable(attack, ["coral-reef"], []), true);
  assert.equal(reef.onPlayAttackIsAvailable(attack, [], ["coral-reef"]), true);
  for (const id of ["winter-flounder", "longhorn-cowfish", "box-jellyfish"]) assert.equal(combat.attackCanTargetCard(cardsById[id], attack), true, id);
  for (const id of ["nurse-shark", "yellow-lipped-sea-krait"]) assert.equal(combat.attackCanTargetCard(cardsById[id], attack), false, id);
  assert.deepEqual(plain(r.getOnPlaySupportBlock(cardsById["box-jellyfish"])), { actionName: "Deadly Sighting", aidesOnly: true });
});

test("Day Octopus knowledge uses the current stats, habitat bonus and Mimic instead of Cunning Hunter", () => {
  const card = cardsById.octopus;
  assert.equal(card.name, "Day Octopus");
  assert.equal(card.cost.rp, 4);
  assert.equal(card.victoryPoints, 4);
  assert.equal(card.defense.dice, "D6");
  assert.deepEqual(card.playRequirements, []);
  assert.deepEqual(card.onPlay, []);
  const [knowledge] = createCardKnowledge([card]);
  assert.ok(knowledge.aliases.includes("octopus"));
  assert.match(knowledge.text, /King of Camouflage.*\+4 Defense/);
  assert.match(knowledge.text, /Mimic:.*Cost: 3 RP/);
  assert.doesNotMatch(knowledge.text, /Cunning Hunter|1 Bite/);
  const abilities = createNamedAbilityKnowledge([card]);
  assert.match(abilities.find((entry) => entry.id === "ability:mimic").text, /Cost: 3 RP/);
});

test("Day Octopus gains camouflage from either ecosystem and loses it when stunned or bonuses are ignored", () => {
  for (const scenario of [
    { habitats: [], opposingHabitats: [], wins: true },
    { habitats: ["coral-reef"], opposingHabitats: [], wins: false },
    { habitats: [], opposingHabitats: ["coral-reef"], wins: false },
    { habitats: ["coral-reef"], opposingHabitats: [], stunned: true, wins: true },
    { habitats: ["coral-reef"], opposingHabitats: [], ignore: true, wins: true },
  ]) {
    const opponent = state({ reefCreatureInstances: [swimmer("nurse-shark", "nurse")], reefCreatures: ["nurse-shark"], habitats: scenario.opposingHabitats });
    const statuses = scenario.stunned ? reef.stunCreatureAbilities({}, "octopus-copy", "yellow-lipped-sea-krait") : {};
    const r = runtime({ playerHabitats: scenario.habitats });
    const result = r.runOpponentAttackStep(opponent, [], [swimmer("octopus", "octopus-copy")], [], {
      cardId: "nurse-shark", reefInstanceId: "nurse",
      attack: { actionName: "Opportunist", attackDice: "D4", actionCost: 0, target: { categories: ["invertebrate"] }, text: scenario.ignore ? "Ignore defensive bonuses." : "" },
    }, [], { creatureStatuses: statuses }, { attack: 4, defense: 1 });
    assert.equal(result.attackerWins, scenario.wins, JSON.stringify(scenario));
    if (!scenario.wins) assert.match(result.summary, /\+4 King of Camouflage/);
  }
});

test("Death Sting without its Habitat preserves Highlight while Deadly Sighting still resolves", () => {
  let opponent = state();
  let bonusSpent = false;
  const r = runtime({ opponent, nextOnPlayAttackBonus: { amount: 2 },
    setNextOnPlayAttackBonus: () => { bonusSpent = true; },
    setOpponent: (update) => { opponent = update(opponent); },
    setEventOverlay: () => {}, pushLog: () => {}, trackSimulatorAbility: () => {},
  });
  assert.equal(r.beginOnPlayAttack(cardsById["box-jellyfish"], null, null), false);
  assert.equal(bonusSpent, false);
  assert.equal(r.applyPlayerOnPlaySupportBlock(cardsById["box-jellyfish"]), true);
  assert.equal(opponent.aideBlockedUntilRound, 3);
  assert.equal(opponent.supportBlockedUntilRound, undefined);
});

test("Deadly Sighting blocks player Aides, permits Items, and expires after the blocked turn", () => {
  const r = runtime({
    gameResult: null, boardStatSequenceRef: { current: null }, compactTurnSequenceRef: { current: null }, attackContext: null,
    gamePhase: "main", isSetup: false, cardsBlockedFromPlayThisTurn: [], hand: [], tutorialUsesScriptedScenario: false,
    playerCorals: [], playerReefCreatures: [], playerOrphanCreatures: [],
    getCompositionRequirementError: () => "", getPlayerSchoolDensityRequirement: () => ({ effectiveRequirement: 0 }),
    getPlayerSchoolDensityAvailableForPlay: () => 0, getPlayerCardPlayCost: (card) => card.cost?.rp ?? 0,
    supportBlockedUntilRound: 0, aideBlockedUntilRound: 3, supportLockSourceId: null,
    poisonImmunityNextPredatorAttack: false, foundationDeck: ["brain-coral-base"], palsDeck: [],
  });
  assert.match(r.getPlayError(cardsById["dr-evans"]), /Deadly Sighting/);
  assert.equal(r.getPlayError(cardsById["poison-heal"]), "");
  r.round = 4;
  assert.equal(r.getPlayError(cardsById["dr-evans"]), "");
});

test("Stun is per copy, survives save/restore and movement, and ends at controller turn end", () => {
  const original = { buff: [{ type: "defenseBonusDice", dice: "D4", expiresTurn: 9 }] };
  const statuses = reef.stunCreatureAbilities(original, "copy-1", "yellow-lipped-sea-krait");
  assert.equal(reef.creatureAbilitiesAreStunned(statuses, "slot-card:copy-1"), true);
  assert.equal(reef.creatureAbilitiesAreStunned(statuses, "copy-2"), false);
  assert.deepEqual(reef.creatureAbilityCard(cardsById["box-jellyfish"], plain(statuses), "copy-1").passives, []);
  assert.equal(combat.attackerHasDisadvantageFromMassive(reef.creatureAbilityCard(cardsById["box-jellyfish"], statuses, "copy-1")), false);
  assert.equal(combat.attackerHasDisadvantageFromMassive(reef.creatureAbilityCard(cardsById["box-jellyfish"], statuses, "copy-2")), true);
  assert.deepEqual(reef.clearCreatureAbilityStuns(statuses), original);
  const moved = reef.collectReefAbilityCreatures({ player: state({ orphanCreatureInstances: [swimmer("box-jellyfish", "copy-1")], creatureStatuses: statuses }) }, cardsById);
  assert.equal(moved[0].card.abilitiesStunned, true);
});

test("the inspector resolves stunned physical cards on both reefs and hosted positions", () => {
  const playerCorals = [coral(slot("yellow-lipped-sea-krait", "own"))];
  const opponent = state({ corals: [coral(slot("yellow-lipped-sea-krait", "other"))] });
  const r = runtime({ playerCorals, playerReefCreatureInstances: [], playerOrphanCreatures: [], opponent });
  assert.equal(r.getInspectedCreatureInstanceId({ owner: "player", coralId: "coral", slotId: "position-own" }), "own");
  assert.equal(r.getInspectedCreatureInstanceId({ owner: "opponent", coralId: "coral", slotId: "position-other" }), "other");
  assert.equal(r.getInspectedCreatureInstanceId({ owner: "player", coralId: "coral", slotId: "hosted:position-own:1", hostedBySlotId: "position-own" }), "hosted:position-own:1");
  assert.equal(r.getInspectedCreatureInstanceId({ owner: "opponent", slotId: "orphan-hosted:fish:0" }), "orphan-hosted:fish:0");
});

test("stunned economy and health passives are suppressed without removing printed stats", () => {
  const r = runtime();
  const foundation = coral(slot("spotfin-butterflyfish", "one"), slot("spotfin-butterflyfish", "two"));
  const statuses = reef.stunCreatureAbilities({}, "one", "yellow-lipped-sea-krait");
  assert.equal(r.getEcosystemRpCap([foundation]), 10);
  assert.equal(r.getEcosystemRpCap([foundation], [], null, { creatureStatuses: statuses }), 9);
  const school = { id: "school", cardId: "white-grunt", health: 30, maxHealth: 30, slots: [] };
  assert.equal(r.getEcosystemStartTurnRp([school]), 1);
  assert.equal(r.getEcosystemStartTurnRp([school], null, reef.stunCreatureAbilities({}, "foundation:school", "yellow-lipped-sea-krait")), 0);
  assert.equal(reef.creatureAbilityCard(cardsById["spotfin-butterflyfish"], statuses, "one").victoryPoints, 2);
});

test("Stun suppresses global attacks, Parasite, Recycle and bonus VP only for the selected copies", () => {
  const r = runtime();
  const creatures = [swimmer("giant-phantom-jelly", "phantom"), swimmer("cookie-cutter-shark", "parasite"), swimmer("blue-crab", "crab"), swimmer("coelacanth", "ancient")];
  const reefCreatures = creatures.map((entry) => entry.cardId);
  const statuses = creatures.reduce((result, entry) => reef.stunCreatureAbilities(result, entry.instanceId, "yellow-lipped-sea-krait"), {});
  const normal = state({ reefCreatureInstances: creatures, reefCreatures });
  const stunned = { ...normal, creatureStatuses: statuses };
  const attack = { attackDice: "D4" };
  assert.equal(r.getAttackConditionalModifier(cardsById["nurse-shark"], cardsById["winter-flounder"], [], [], reefCreatures, attack, [], { abilityState: normal }).flat, 3);
  assert.equal(r.getAttackConditionalModifier(cardsById["nurse-shark"], cardsById["winter-flounder"], [], [], reefCreatures, attack, [], { abilityState: stunned }).flat, 0);
  assert.equal(r.getParasiteRequestedRp([], reefCreatures, [], [], ["nurse-shark"], [], normal), 1);
  assert.equal(r.getParasiteRequestedRp([], reefCreatures, [], [], ["nurse-shark"], [], stunned), 0);
  assert.equal(r.ecosystemHasCard([], reefCreatures, "blue-crab", [], stunned), false);
  assert.equal(r.getEcosystemVictoryPoints([], ["abyss"], reefCreatures, { abilityState: normal }) - r.getEcosystemVictoryPoints([], ["abyss"], reefCreatures, { abilityState: stunned }), 2);
  const duplicateCrab = { ...stunned, reefCreatureInstances: [...creatures, swimmer("blue-crab", "other-crab")] };
  assert.equal(r.ecosystemHasCard([], [...reefCreatures, "blue-crab"], "blue-crab", [], duplicateCrab), true);
});

test("player Stun Strike spends exactly 3 RP only after selecting a valid physical target", () => {
  const target = swimmer("nurse-shark", "target");
  let opponent = state({ reefCreatureInstances: [target], reefCreatures: [target.cardId] });
  let rp = 5;
  let used = [];
  const pending = { effect: { type: "stunCreature" }, cost: 3, action: cardsById["yellow-lipped-sea-krait"].actions[0], actionKey: "krait:stun-strike", sourceCardId: "yellow-lipped-sea-krait", candidates: [target] };
  const r = runtime({ pendingCreatureAction: pending, rp,
    getReefAbilityStates: () => ({ player: state(), opponent }),
    setRp: (update) => { rp = update(rp); }, setOpponent: (update) => { opponent = update(opponent); },
    setUsedCreatureActions: (update) => { used = update(used); }, setPendingCreatureAction: () => {}, setEventOverlay: () => {}, pushLog: () => {}, getPendingCreatureActionRpSpendPresentation: () => null,
  });
  r.completeCreatureStun("missing");
  assert.equal(rp, 5);
  assert.deepEqual(used, []);
  r.completeCreatureStun("target");
  assert.equal(rp, 2);
  assert.deepEqual(plain(used), ["krait:stun-strike"]);
  assert.equal(reef.creatureAbilitiesAreStunned(opponent.creatureStatuses, "target"), true);
});

test("AI Stun Strike pays its cost and cannot use a stunned Sea Krait", () => {
  const krait = swimmer("yellow-lipped-sea-krait", "krait");
  const target = swimmer("nurse-shark", "nurse");
  const opponent = state({ reefCreatureInstances: [krait], reefCreatures: [krait.cardId], rp: 5 });
  const player = state({ reefCreatureInstances: [target] });
  const r = runtime();
  const result = r.runOpponentUtilityAction(opponent, player);
  assert.equal(result.state.rp, 2);
  assert.equal(reef.creatureAbilitiesAreStunned(result.playerState.creatureStatuses, "nurse"), true);
  assert.equal(r.runOpponentUtilityAction({ ...opponent, creatureStatuses: reef.stunCreatureAbilities({}, "krait", krait.cardId) }, player), null);
});

test("Neurotoxic Defense flips independently, includes Cowfish and returns invaders to their owner", () => {
  const states = {
    player: state({ corals: [coral(slot("longhorn-cowfish", "cow"), slot("spotfin-butterflyfish", "fish"), { ...slot("lionfish", "invader"), invasiveOwner: "opponent" })] }),
    opponent: state({ reefCreatureInstances: [swimmer("nurse-shark", "attacker")], reefCreatures: ["nurse-shark"] }),
  };
  const before = plain(states);
  const outcomes = [0.1, 0.9, 0.1, 0.1];
  const r = runtime({ nextGameplayRandom: () => outcomes.shift() });
  const events = r.createReefPostCombatEvents(states, { attackerOwner: "opponent", attackerInstanceId: "attacker", targetInstanceId: "slot-card:cow", success: false }, () => []);
  const results = events.filter((event) => event.type === "utility-result");
  assert.equal(results.length, 4);
  assert.deepEqual(plain(results.map((event) => event.opponentCoinFlip.result)), ["heads", "tails", "heads", "heads"]);
  const final = results.at(-1);
  assert.deepEqual(plain(final.playerStateAfter.discardPile), ["spotfin-butterflyfish"]);
  assert.deepEqual(plain(final.opponentStateAfter.discardPile).sort(), ["lionfish", "nurse-shark"]);
  assert.equal(final.playerStateAfter.corals[0].slots[0].cardId, "longhorn-cowfish");
  assert.deepEqual(plain(states), before, "planning must not mutate the original board");
});

test("Neurotoxic Defense does not discard an attacking Fish or trigger after a successful attack", () => {
  const states = { player: state({ corals: [coral(slot("longhorn-cowfish", "cow"))] }), opponent: state({ reefCreatureInstances: [swimmer("lionfish", "fish")] }) };
  const creatures = reef.collectReefAbilityCreatures(states, cardsById);
  assert.equal(reef.getNeurotoxicDefenseFlips(creatures[0], creatures[1], creatures, () => 0).length, 1);
  const r = runtime();
  assert.deepEqual(plain(r.createReefPostCombatEvents(states, { attackerOwner: "opponent", attackerInstanceId: "fish", targetInstanceId: "cow", success: true }, () => [])), []);
});

test("Opportunist excludes the attacking copy, respects stun, and allows later attacks to retrigger", () => {
  const states = { player: state({ corals: [coral(slot("nurse-shark", "one"), slot("nurse-shark", "two"), slot("nurse-shark", "three"))], creatureStatuses: reef.stunCreatureAbilities({}, "three", "yellow-lipped-sea-krait") }) };
  const creatures = reef.collectReefAbilityCreatures(states, cardsById);
  const triggers = reef.getOpportunistTriggers(creatures, "player", "slot-card:one");
  assert.deepEqual(triggers.map((entry) => entry.instanceId), ["two"]);
  assert.equal(triggers[0].attack.actionCost, 0);
  assert.equal(combat.attackCanTargetCard(cardsById["nurse-shark"], triggers[0].attack), false);
  assert.equal(combat.attackCanTargetCard(cardsById["winter-flounder"], triggers[0].attack), true);
  assert.deepEqual(reef.getOpportunistTriggers(creatures, "player", "two").map((entry) => entry.instanceId), ["one"]);
});

test("Defensive Strike queues a free D8 attack against the exact attacker for either controller", () => {
  for (const owner of ["player", "opponent"]) {
    const other = owner === "player" ? "opponent" : "player";
    const states = { [owner]: state({ reefCreatureInstances: [swimmer("yellow-lipped-sea-krait", "krait")], reefCreatures: ["yellow-lipped-sea-krait"] }), [other]: state({ reefCreatureInstances: [swimmer("nurse-shark", "attacker")], reefCreatures: ["nurse-shark"] }) };
    let queued;
    const r = runtime({ createReefReactionEvents: (_states, reactions) => { queued = reactions; return []; } });
    r.createReefPostCombatEvents(states, { attackerOwner: other, attackerInstanceId: "attacker", targetInstanceId: "krait", success: false }, () => []);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].attack.attackDice, "D8");
    assert.equal(queued[0].attack.forcedTargetInstanceId, "attacker");
    assert.equal(queued[0].controller, owner);
    states[owner].creatureStatuses = reef.stunCreatureAbilities({}, "krait", "yellow-lipped-sea-krait");
    r.createReefPostCombatEvents(states, { attackerOwner: other, attackerInstanceId: "attacker", targetInstanceId: "krait", success: false }, () => []);
    assert.equal(queued.length, 0);
  }
});

test("Defensive Strike resolves through live AI combat against the forced duplicate, at zero RP cost", () => {
  const opponent = state({ reefCreatureInstances: [swimmer("yellow-lipped-sea-krait", "krait")], reefCreatures: ["yellow-lipped-sea-krait"], rp: 0 });
  const player = state({ reefCreatureInstances: [swimmer("nurse-shark", "first"), swimmer("nurse-shark", "second")] });
  let final;
  const r = runtime();
  const events = r.createReefPostCombatEvents({ player, opponent }, { attackerOwner: "player", attackerInstanceId: "second", targetInstanceId: "krait", success: false }, (states) => { final = states; return []; });
  assert.equal(events[0].type, "opponent-roll-ready");
  assert.equal(events[0].attackDice, "D8");
  assert.equal(events[0].targetInstanceId, "second");
  const resolved = events[0].combatResume.resolve({ attack: 8, defense: 1 });
  assert.equal(resolved[0].attackerWins, true);
  assert.deepEqual(plain(final.player.reefCreatureInstances.map((entry) => entry.instanceId)), ["first"]);
  assert.deepEqual(plain(final.player.discardPile), ["nurse-shark"]);
  assert.equal(final.opponent.rp, 0);
  assert.deepEqual(plain(final.opponent.actionUses ?? {}), {});
});

test("multiple Nurse Sharks chain through successful attacks and stop when no legal target remains", () => {
  const opponent = state({ reefCreatureInstances: [swimmer("nurse-shark", "one"), swimmer("nurse-shark", "two")], reefCreatures: ["nurse-shark", "nurse-shark"], rp: 0 });
  const player = state({ reefCreatureInstances: [swimmer("spotfin-butterflyfish", "fish-1"), swimmer("spotfin-butterflyfish", "fish-2"), swimmer("spotfin-butterflyfish", "fish-3")] });
  let final;
  const r = runtime();
  let events = r.createReefPostCombatEvents({ player, opponent }, { attackerOwner: "opponent", attackerInstanceId: "one", targetInstanceId: "previously-defeated", success: true }, (states) => { final = states; return []; });
  const attackers = [];
  let budget = 20;
  while (events.length && budget-- > 0) {
    const event = events.shift();
    if (event.type === "opponent-roll-ready") {
      attackers.push(event.attackerInstanceId);
      events.unshift(...event.combatResume.resolve({ attack: 4, defense: 1 }));
    } else if (event.type === "reef-continuation") events.unshift(...event.continueReef());
  }
  assert.ok(budget > 0, "reaction chain must terminate when targets are gone");
  assert.deepEqual(attackers, ["two", "one", "two"]);
  assert.equal(final.player.reefCreatureInstances.length, 0);
  assert.equal(final.player.discardPile.length, 3);
  assert.equal(final.opponent.rp, 0);
});

test("player Opportunist remains a mandatory player target choice, even during the opponent turn", () => {
  const player = state({ corals: [coral(slot("nurse-shark", "nurse"))] });
  const opponent = state({ reefCreatureInstances: [swimmer("spotfin-butterflyfish", "fish")] });
  let context;
  let overlay = "old-result";
  const r = runtime({ playerCorals: player.corals, playerReefCreatures: [], playerHabitats: [], setAttackContext: (value) => { context = value; }, setEventOverlay: (value) => { overlay = value; }, pushLog: () => {} });
  const events = r.createReefPostCombatEvents({ player, opponent }, { attackerOwner: "player", attackerInstanceId: "successful-counterattacker", success: true }, () => []);
  assert.equal(events[0].type, "reef-player-reaction");
  r.beginPlayerReefReaction(events[0]);
  assert.equal(context.triggered, true);
  assert.equal(context.onPlay, true, "mandatory attack cannot be cancelled");
  assert.equal(context.attackOverride.actionCost, 0);
  assert.deepEqual(plain(context.targets.map((target) => target.instanceId)), ["fish"]);
  assert.equal(overlay, null);
});
