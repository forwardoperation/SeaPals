import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { createJiti } from "jiti";
import { parseLegacyAttackText, parseLegacyUtilityText } from "./gameRules.mjs";
import { collectMimicChoices, createMimicAction, isMimicAction } from "./mimicRules.mjs";

const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, { fsCache: false });
const { cardsById, allCards } = jiti("../../data/cards/index.js");
const types = jiti("../../data/cards/types.js");
const source = fs.readFileSync(new URL("./Simulator.jsx", import.meta.url), "utf8");
const babel = require("next/dist/compiled/babel/bundle");
const ast = babel.parser().parse(source, { sourceType: "module", plugins: ["jsx"] });
const names = new Set([
  "getActionEffects", "getActionName", "getActionCost", "actionIsOncePerTurn",
  "parseLegacyUtilityAction", "getSupportedUtilityEffect", "parseLegacyAttackAction", "getBasicAttackEffect",
]);
const functions = [];
babel.traverse().default(ast, { FunctionDeclaration(path) {
  if (names.has(path.node.id.name)) functions.push(source.slice(path.node.start, path.node.end));
} });
const r = vm.createContext({ cardsById, ...types, parseLegacyAttackText, parseLegacyUtilityText });
for (const code of functions) vm.runInContext(code, r);
const mimic = cardsById.octopus.actions.find((action) => action.id === "mimic");
const entry = (cardId, instanceId, controller = "opponent", card = cardsById[cardId]) => ({ cardId, instanceId, controller, card });
const choices = (entries) => collectMimicChoices(entries, "player", mimic, { getAttack: r.getBasicAttackEffect, getUtility: r.getSupportedUtilityEffect });
const plain = (value) => JSON.parse(JSON.stringify(value));

test("Day Octopus Mimic is a supported 3 RP action", () => {
  assert.equal(mimic.name, "Mimic");
  assert.equal(mimic.cost.rp, 3);
  assert.equal(isMimicAction(mimic), true);
  assert.equal(r.getSupportedUtilityEffect(mimic).type, "mimicAction");
});

test("copying replaces the donor price and usage while retaining its effects, targets and cooldown", () => {
  const donor = { ...cardsById["mantis-shrimp"].actions[0], cost: { rp: 9 }, oncePerTurn: false };
  const before = structuredClone(donor);
  const copied = createMimicAction(mimic, donor, { cardId: "mantis-shrimp", instanceId: "mantis-one", actionIndex: 0 });
  assert.deepEqual(donor, before, "copying must not modify the donor's printed action");
  assert.equal(copied.id, "mimic");
  assert.equal(copied.cost.rp, 3);
  assert.equal(copied.oncePerTurn, true);
  assert.deepEqual(copied.effect, donor.effect);
  assert.deepEqual(copied.cooldown, { duration: "yourNextTurn" });
  assert.equal(copied.mimic.donorCardId, "mantis-shrimp");
  assert.equal(copied.mimic.donorInstanceId, "mantis-one");
});

test("choices preserve duplicate physical donors and each printed action, excluding allies and recursion", () => {
  const result = choices([
    entry("crown-of-thorns", "crown-one"), entry("crown-of-thorns", "crown-two"),
    entry("blue-crab", "friendly-crab", "player"), entry("octopus", "rival-octopus"),
    entry("nurse-shark", "nurse-with-only-passive"), entry("brain-coral-base", "foundation"),
  ]);
  assert.deepEqual(result.map((choice) => choice.key), ["crown-one:0", "crown-one:1", "crown-two:0", "crown-two:1"]);
  assert.ok(result.every((choice) => choice.action.id === "mimic" && choice.action.cost.rp === 3));
  assert.deepEqual(new Set(result.map((choice) => choice.effect.onSuccess.type)), new Set(["stunCoral", "damage"]));
});

test("stunned donors and actions without an executable effect are unavailable", () => {
  const disabled = { ...cardsById["emerald-crab"], abilitiesStunned: true };
  const unsupported = { ...cardsById["emerald-crab"], actions: [{ id: "unknown", effect: { type: "futureUnknownEffect" } }] };
  assert.equal(choices([entry("emerald-crab", "stunned", "opponent", disabled)]).length, 0);
  assert.equal(choices([entry("emerald-crab", "unknown", "opponent", unsupported)]).length, 0);
});

test("copied attacks retain their own target and cooldown rules at Mimic's cost", () => {
  const result = choices([entry("giant-triton", "triton"), entry("greenland-shark", "shark")]);
  assert.equal(result.length, 2);
  const triton = result.find((choice) => choice.donorCardId === "giant-triton");
  assert.equal(triton.attack.advantageAgainstCardId, undefined);
  assert.deepEqual(plain(triton.attack.target.categories), ["invertebrate"]);
  assert.deepEqual(plain(triton.attack.targetTags), ["starfish", "sea-urchin"]);
  assert.equal(triton.attack.attackDice, "D8");
  assert.equal(triton.attack.skipNextTurn, false);
  assert.equal(result.find((choice) => choice.donorCardId === "greenland-shark").attack.skipNextTurn, true);
  for (const choice of result) {
    assert.equal(choice.attack.actionCost, 3);
    assert.equal(choice.attack.mimic.donorInstanceId, choice.donorInstanceId);
  }
});

test("every current printed creature Action except Mimic itself can be offered for copying", () => {
  const creatures = allCards.filter((card) => card.kind === "creature");
  const entries = creatures.map((card) => entry(card.id, `copy-${card.id}`));
  const offered = new Set(choices(entries).map((choice) => `${choice.donorCardId}:${choice.actionIndex}`));
  for (const card of creatures) {
    (card.actions ?? []).forEach((action, index) => {
      assert.equal(offered.has(`${card.id}:${index}`), !isMimicAction(action), `${card.name}: ${typeof action === "string" ? action : action.name}`);
    });
  }
});
