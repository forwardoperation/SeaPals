import * as reefAbilities from "./reefAbilityRules.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createJiti } from "jiti";
import {
  applyDamage, calculateRpBankCap, conditionPreventsCardPlay,
  isEcosystemConditionMet, parseLegacyAttackText, parseLegacyUtilityText, rollDie,
} from "./gameRules.mjs";
import {
  attackCanTargetCard, attackerHasDisadvantageFromMassive,
  getDarknessShroudDefenseBonus, getNightVisionAttackBonus, isToxicWhenConsumed,
} from "./combatRules.mjs";
import { getCombatDieOutcomes } from "./opponentCombatRules.mjs";
import { getOpponentActionUseKey, markOpponentActionUsed, wasOpponentActionUsedThisTurn } from "./opponentActionRules.mjs";
import { resolveDestructionRecoveryWaves, resolvePlenteousDestruction } from "./zoneRules.mjs";
import { getHabitatRequirementError } from "./habitatRules.mjs";
import { createCardKnowledge } from "../../lib/rulesKnowledgeBank.mjs";

const jiti = createJiti(import.meta.url, { fsCache: false });
const { cardsById } = jiti("../../data/cards/index.js");
const { CardKind, EffectType } = jiti("../../data/cards/types.js");
const source = fs.readFileSync(new URL("./Simulator.jsx", import.meta.url), "utf8");
const isCreatureSchool = (card) => card?.tags?.includes("creature-school") ?? false;
const common = {
    ...reefAbilities, cardsById, CardKind, EffectType, isCreatureSchool, rollDie, applyDamage, getNightVisionAttackBonus, isEcosystemConditionMet,
  parseLegacyAttackAction: parseLegacyAttackText, parseLegacyUtilityAction: parseLegacyUtilityText,
  getSlotCardIds: (slot) => [slot.cardId, ...(slot.hostedCardIds ?? [])].filter(Boolean),
};
function runtime(name, dependencies = {}) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, marker);
  const match = /\n(?:  )?function /.exec(source.slice(start + marker.length));
  const end = start + marker.length + match.index;
  const scope = { ...common, ...dependencies };
  return new Function(...Object.keys(scope), `${source.slice(start, end)}; return ${name};`)(...Object.values(scope));
}
const getBasicAttackEffect = runtime("getBasicAttackEffect");
const getOnPlayAttackEffect = runtime("getOnPlayAttackEffect");
const getActionEffects = runtime("getActionEffects");
const getSupportedUtilityEffect = runtime("getSupportedUtilityEffect", { getActionEffects });

test("current Sunfish and Bluefin artwork requires Open Ocean for gameplay and Finn", () => {
  for (const id of ["ocean-sunfish", "bluefin-tuna"]) {
    const card = cardsById[id];
    assert.equal(getHabitatRequirementError(card, ["open-ocean"]), "");
    for (const habitats of [[], ["coral-reef"], ["abyss"], ["coral-reef", "abyss"]]) {
      assert.equal(getHabitatRequirementError(card, habitats), `${card.name} requires Open Ocean in your ecosystem.`);
    }
    const [knowledge] = createCardKnowledge([card]);
    assert.ok(knowledge.facts.printedRules.includes("Requires Open Ocean Habitat in your ecosystem."));
    assert.doesNotMatch(knowledge.text, /Open Ocean or (?:Coral Reef|Abyss)/);
  }
  assert.equal(getHabitatRequirementError(cardsById["whale-shark"], ["coral-reef"]), "");
  assert.equal(getHabitatRequirementError(cardsById.swordfish, ["abyss"]), "");
});
const getActionCost = runtime("getActionCost");
const getActionName = runtime("getActionName");

test("October gallery stat corrections stay in the playable catalog", () => {
  for (const [id, cost, vp, defense] of [
    ["lionfish", 4, 0, "D6"], ["french-angelfish", 3, 3, "D6"],
    ["queen-angelfish", 4, 4, "D6"], ["blue-crab", 1, 1, "D4"],
    ["giant-triton", 3, 3, "D8"], ["manta-ray", 4, 6, "D8"],
    ["barrel-eye-fish", 3, 3, "D4-2"],
  ]) {
    const card = cardsById[id];
    assert.deepEqual([card.cost.rp, card.victoryPoints, card.defense.dice], [cost, vp, defense], id);
  }
  assert.equal(cardsById["giant-clam"].defense.dice, "D6");
  assert.equal(cardsById["basking-shark"].defense.dice, "D20");
  assert.equal(cardsById["tripod-fish"].defense.dice, "D4");
  assert.equal(cardsById["sargeant-major"].victoryPoints, 2);
  assert.equal(cardsById["manta-ray"].schoolDensityRequirement, 135);
  assert.match(cardsById["manta-ray"].playRequirements.join(" "), /Coral Reef/);
  assert.doesNotMatch(cardsById["manta-ray"].playRequirements.join(" "), /Open Ocean/);
});

test("Eco Boost applies to the revised Reef Fish, with no old Crab bonuses", () => {
  for (const id of ["cleaner-wrasse", "picasso-triggerfish", "french-angelfish", "blue-tang"]) {
    assert.equal(calculateRpBankCap([cardsById[id]]), 9, id);
  }
  assert.equal(calculateRpBankCap([cardsById["queen-angelfish"]]), 10);
  for (const id of ["blue-crab", "emerald-crab", "arrow-crab"]) assert.equal(calculateRpBankCap([cardsById[id]]), 8, id);
  assert.deepEqual(cardsById["blue-tang"].playRequirements, []);
  for (const id of ["queen-angelfish", "french-angelfish"]) assert.equal(cardsById[id].bonusVictoryPoints, undefined);
});

test("Venomous changes attack dice without Toxic consumption or a pre-attack coin", () => {
  const avoidance = runtime("getTargetAvoidance");
  for (const id of ["lionfish", "crown-of-thorns", "man-o-war", "blue-sea-dragon"]) {
    assert.equal(attackerHasDisadvantageFromMassive(cardsById[id]), true, id);
    assert.equal(isToxicWhenConsumed(cardsById[id]), false, id);
    assert.equal(avoidance(cardsById[id]), null, id);
  }
  assert.equal(isToxicWhenConsumed(cardsById.nudibranch), true);
});

test("Social Hunter counts every friendly dolphin including itself across locations", () => {
  const modifier = runtime("getAttackConditionalModifier");
  const dolphin = cardsById["bottlenose-dolphin"];
  const attack = getOnPlayAttackEffect(dolphin);
  assert.equal(attack.attackDice, "D10");
  assert.equal(attack.actionName, "Social Hunter");
  for (const category of ["apex", "predator", "fish"]) assert.equal(attackCanTargetCard({ category }, attack), true);
  assert.equal(attackCanTargetCard({ category: "invertebrate" }, attack), false);
  assert.equal(modifier(dolphin, cardsById.frogfish, [], [{ cardId: "brain-coral-stage-2", slots: [{ cardId: dolphin.id }] }], [], attack).flat, 2);
  const result = modifier(dolphin, cardsById.frogfish, [], [], [dolphin.id, "spinner-dolphins"], attack, [{ cardId: "spinner-dolphins" }]);
  assert.equal(result.flat, 6);
  assert.equal(runtime("cardHasAttackAdvantage")(dolphin, cardsById.frogfish, [], attack), false);
});

test("Moray needs Coral Reef and Giant Triton attacks any Invertebrate with a cooldown", () => {
  const modifier = runtime("getAttackConditionalModifier");
  const moray = cardsById["green-moray-eel"];
  const attack = getOnPlayAttackEffect(moray);
  const options = { rollConditionalDie: () => ({ total: 4 }) };
  assert.equal(modifier(moray, cardsById.frogfish, ["abyss"], [], [], attack, [], options).flat, 0);
  assert.equal(modifier(moray, cardsById.frogfish, ["coral-reef"], [], [], attack, [], options).flat, 4);
  const triton = cardsById["giant-triton"];
  const hunt = getBasicAttackEffect(triton);
  assert.equal(hunt.skipNextTurn, true);
  assert.equal(hunt.actionCost, 1);
  assert.equal(attackCanTargetCard(cardsById["sea-urchin"], hunt), true);
  const advantage = runtime("cardHasAttackAdvantage");
  assert.equal(advantage(triton, cardsById["crown-of-thorns"], [], hunt), true);
  assert.equal(advantage(triton, cardsById["sea-urchin"], [], hunt), false);
  assert.equal(triton.passives.length, 0);
  const shark = cardsById["reef-shark"];
  const sharkAttack = getOnPlayAttackEffect(shark);
  const repeats = runtime("getDynamicAttackRepeat");
  assert.equal(repeats(shark, sharkAttack, [], [shark.id, shark.id], ["abyss"]), 1);
  assert.equal(repeats(shark, sharkAttack, [], [shark.id, shark.id], ["coral-reef"]), 3);
});

test("Frigate Tuna Snap is a paid action and Deep bonuses match the new wording", () => {
  assert.equal(getOnPlayAttackEffect(cardsById["frigate-tuna"]), null);
  assert.equal(getBasicAttackEffect(cardsById["frigate-tuna"]).attackDice, "D4-1");
  assert.equal(getBasicAttackEffect(cardsById["frigate-tuna"]).actionCost, 1);
  assert.equal(getDarknessShroudDefenseBonus(cardsById["gulper-eel"], ["abyss"]), 4);
  const highlight = cardsById["deep-sea-jelly"].actions.find((action) => String(action).startsWith("Highlight:"));
  assert.equal(getSupportedUtilityEffect(highlight).type, "grantNextOnPlayAttackBonus");
  assert.match(source.slice(source.indexOf("function endTurn()"), source.indexOf("function resolveOpponentTurn(")), /setNextOnPlayAttackBonus\(null\)/);
  assert.match(source, /endFlashingAlarmTurn\(opponentStateWithInstances.flashingAlarmAttackBonus\),\s+nextOnPlayAttackBonus: null/);
});

test("searches and Support types follow gallery restrictions", () => {
  const matches = runtime("cardMatchesSearchCriteria");
  const rov = cardsById["rov-lights"];
  assert.equal(rov.effects[0].amount, 2);
  assert.equal(matches(cardsById["viperfish"], rov.effects[0]), true);
  assert.equal(matches(cardsById.frogfish, rov.effects[0]), false);
  assert.equal(matches(cardsById["deep-cucumber"], rov.effects[0]), false);
  const grunt = cardsById["bluestriped-grunt"].onPlay.flatMap((ability) => ability.effects).find((effect) => effect.type === "searchDeck");
  assert.equal(matches(cardsById.frogfish, grunt), true);
  assert.equal(matches(cardsById["viperfish"], grunt), false);
  assert.equal(cardsById["dr-evans"].effects.find((effect) => effect.type === "drawCards").amount, 8);
  assert.equal(cardsById["dr-evans"].supportType, "aide");
  assert.equal(rov.supportType, "item");
  assert.equal(cardsById.recovery.cost.rp, 2);
  assert.equal(cardsById.recovery.effects[0].targetKind, "support");
  assert.doesNotMatch(source, /getRovLightsAttackBonus\(/);
});

test("Fishing Nets blocks Schools and large creatures while allowing ordinary Fish", () => {
  const nets = cardsById["fishing-nets"];
  for (const id of ["krill-bloom-base", "sardine-ball-stage2", "bottlenose-dolphin", "manta-ray"]) assert.equal(conditionPreventsCardPlay(cardsById[id], nets), true, id);
  for (const id of ["frogfish", "frigate-tuna", "sea-urchin"]) assert.equal(conditionPreventsCardPlay(cardsById[id], nets), false, id);
});

test("Plenteous returns the destroyed stage and leaves unrelated discard copies alone", () => {
  for (const id of ["krill-bloom-base", "krill-bloom-stage1", "krill-bloom-stage2"]) {
    const discard = [id, "krill-bloom-base", "frogfish"];
    const result = resolvePlenteousDestruction([cardsById[id]], discard, ["white-grunt"], () => 0);
    assert.deepEqual(result.discardPile, ["krill-bloom-base", "frogfish"]);
    assert.deepEqual(result.foundationDeck.sort(), [id, "white-grunt"].sort());
    assert.deepEqual(discard, [id, "krill-bloom-base", "frogfish"]);
  }
  const unchanged = resolvePlenteousDestruction([], ["krill-bloom-stage2"], [], () => 0);
  assert.deepEqual(unchanged.discardPile, ["krill-bloom-stage2"], "discarding a card is not destruction");
});

test("destruction from losing a health bonus does not trigger attack-only Plenteous", () => {
  const resolve = runtime("resolveFoundationDestructionTriggers", {
    resolveDestructionRecoveryWaves,
    coralCanUseOwnAbilities: () => true,
    getFragmentRecoveryEffect: runtime("getFragmentRecoveryEffect"),
  });
  const result = resolve([[{ id: "damaged-school", cardId: "krill-bloom-stage2" }]], [], ["krill-bloom-base"]);
  assert.deepEqual(result.discardPile, ["krill-bloom-stage2", "krill-bloom-base"]);
  assert.deepEqual(result.triggers, []);
});

test("player Recovery spends two RP, recovers a Support, and rejects a creature target", () => {
  const initialHand = ["recovery", "frogfish"];
  const initialDiscard = ["fishing", "krill-bloom-stage2"];
  for (const targetId of initialDiscard) {
    let state = { hand: initialHand, discard: initialDiscard, rp: 5 };
    let handSizeAtRecovery = null;
    let completedSupport = null;
    const complete = runtime("completeRecovery", {
      searchContext: { mode: "recover", supportCardId: "recovery", candidates: initialDiscard },
      hand: initialHand, discardPile: initialDiscard, rp: 5,
      getPlayerCardPlayCost: (card) => card.cost?.rp ?? 0,
      getPlayerRpSpendPresentation: () => null,
      applyCurrentHandLimit: (incoming, handSize) => { handSizeAtRecovery = handSize; return { cardsToHand: incoming, cardsToDiscard: [] }; },
      removeOneCard: (cards, id) => { const copy = [...cards]; copy.splice(copy.indexOf(id), 1); return copy; },
      setHand: (update) => { state.hand = update(state.hand); },
      setDiscardPile: (update) => { state.discard = update(state.discard); },
      setRp: (update) => { state.rp = update(state.rp); },
      applyExplicitSupportLock: (card) => { completedSupport = card.id; },
      setSearchContext: () => {}, returnFromSupportFlowToBoard: () => {}, pushLog: () => {},
    });
    complete(targetId);
    if (targetId === "fishing") {
      assert.deepEqual(state, { hand: ["frogfish", "fishing"], discard: ["recovery", "krill-bloom-stage2"], rp: 3 });
      assert.equal(handSizeAtRecovery, 1, "the spent Support frees a hand slot before overflow is calculated");
      assert.equal(completedSupport, "recovery");
    } else {
      assert.deepEqual(state, { hand: initialHand, discard: initialDiscard, rp: 5 });
      assert.equal(completedSupport, null);
    }
  }
});

test("Deadly Poison deals zero to two HP and charges two RP for either controller", () => {
  const card = cardsById["man-o-war"];
  const action = card.actions.find((entry) => entry.id === "deadly-poison");
  const effect = getSupportedUtilityEffect(action);
  assert.equal(effect.type, "damage");
  const target = { id: "target", cardId: "mustard-hill-coral-base", health: 10, maxHealth: 10, slots: [] };
  for (const [random, expected] of [[0, 0], [0.999, 2]]) {
    let bank = 5;
    let opponent = { corals: [target] };
    let rolls = 0;
    const nextGameplayRandom = () => { rolls++; return random; };
    const complete = runtime("completeCoinCoralEffect", {
      pendingCreatureAction: { sourceCardId: card.id, action, effect, cost: 2, candidates: [target.id] },
      opponentCorals: [target], previewExperience: false, getActionCost, getActionName,
      setRp: (update) => { bank = update(bank); },
      setOpponent: (update) => { opponent = update(opponent); },
      getPendingCreatureActionRpSpendPresentation: () => null, actionIsOncePerTurn: () => false,
      trackSimulatorAnalytics: () => {}, setPendingCreatureAction: () => {}, setEventOverlay: () => {}, pushLog: () => {}, nextGameplayRandom,
    });
    complete(target.id);
    assert.equal(bank, 3);
    assert.equal(opponent.corals[0].health, 10 - expected);
    assert.equal(rolls, 1, "this action rolls a die without flipping a coin");

    const actionKey = getOpponentActionUseKey("reef-man", card.actions[0], 0);
    const run = runtime("runOpponentUtilityAction", {
      activeCondition: null, turn: 4, getCombatDieOutcomes, getSupportedUtilityEffect, getActionCost, getActionName,
      getOpponentActionUseKey, markOpponentActionUsed, wasOpponentActionUsedThisTurn, nextGameplayRandom,
      getLocallyControlledOrphans: (items) => items ?? [], getCardStartTurnRp: () => 1,
      coralIsStunned: () => false, actionIsOncePerTurn: () => true,
      selectOpponentFoundationEffectTarget: (candidates) => candidates[0],
    });
    const result = run({ corals: [], reefCreatures: [card.id], reefCreatureInstances: [{ instanceId: "man" }], orphanCreatures: [], rp: 5, actionUses: { [actionKey]: 4 } }, { corals: [target] });
    assert.equal(result.actionName, "Deadly Poison");
    assert.equal(result.state.rp, 3);
    assert.equal(result.playerState.corals[0].health, 10 - expected);
    assert.equal(rolls, 2);
  }
});
