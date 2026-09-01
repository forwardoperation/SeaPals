import assert from "node:assert/strict";
import test from "node:test";

import { rollDie } from "./gameRules.mjs";
import {
  createCombatResolutionRandom,
  createCombatRollPacket,
} from "./combatRollPresentation.mjs";

test("a stopped opposed-roll packet owns both visible dice", () => {
  const packet = createCombatRollPacket("D6", "D4", () => 0.314159);

  assert.equal(packet.attackRolls.length, 1);
  assert.equal(packet.defenseRolls.length, 1);
  assert.equal(packet.attack, packet.attackRolls[0].total);
  assert.equal(packet.defense, packet.defenseRolls[0].total);
  assert.equal(packet.attackRolls[0].expression, "D6");
  assert.equal(packet.defenseRolls[0].expression, "D4");
});

test("every follow-up combat die is fixed by the packet stopped on screen", () => {
  const firstPacket = createCombatRollPacket("D8", "D6", () => 0.75);
  const secondPacket = createCombatRollPacket("D8", "D6", () => 0.75);
  const firstRandom = createCombatResolutionRandom(firstPacket);
  const secondRandom = createCombatResolutionRandom(secondPacket);

  assert.deepEqual(rollDie("D12", firstRandom), rollDie("D12", secondRandom));
  assert.deepEqual(rollDie("D4", firstRandom), rollDie("D4", secondRandom));
  assert.deepEqual(rollDie("D20", firstRandom), rollDie("D20", secondRandom));
});

test("Creature School attacks retain a one-die packet", () => {
  const packet = createCombatRollPacket("D10", null, () => 0.125);

  assert.equal(packet.attackRolls.length, 1);
  assert.deepEqual(packet.defenseRolls, []);
  assert.equal(packet.defense, 0);
});
