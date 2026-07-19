import test from "node:test";
import assert from "node:assert/strict";
import { DAMAGE_COUNTER_HP, DEFAULT_RP_BANK_CAP, addResourceWithinCap, applyDamage, calculateAttachedCardRpBonus, calculateAttachedCreatureDefenseBonus, calculateAttachedHostHealthBonus, calculateRpBankCap, calculateVictoryPoints, conditionPreventsCardPlay, createSeededRandom, determineVictoryResult, drawWithHandLimit, getCardRpBankCapModifier, getConditionRpBankCapModifier, getDrawCountFromActions, getRequiredDrawShortfall, getResourceGainFromActions, halfCostRoundedUp, healMostDamagedCoral, isEcosystemConditionMet, moveFoundationDamageCounter, parseDieExpression, parseLegacyAttackText, parseLegacyUtilityText, preserveDamageOnUpgrade, reconcileContinuousHealth, redistributeOrphans, resolveBlueCrabRecycle, resolveConditionalDiceDamage, resolveOpposedRoll, resolveResourceTransfer, rollDie } from "./gameRules.mjs";

test("parses dice and modifiers", () => {
  assert.deepEqual(parseDieExpression("D6"), { sides: 6, modifier: 0 });
  assert.deepEqual(parseDieExpression("D4-2"), { sides: 4, modifier: -2 });
  assert.equal(parseDieExpression("coin"), null);
});

test("rollDie clamps a modified roll at zero", () => {
  assert.deepEqual(rollDie("D4-2", () => 0), {
    expression: "D4-2",
    natural: 1,
    modifier: -2,
    total: 0,
  });
});

test("defender wins opposed-roll ties", () => {
  const rolls = [0.5, 0.5];
  const result = resolveOpposedRoll("D6", "D6", () => rolls.shift());
  assert.equal(result.attack.total, result.defense.total);
  assert.equal(result.attackerWins, false);
});

test("damage never creates negative health", () => {
  assert.deepEqual(applyDamage(30, 40), { appliedDamage: 40, remainingHealth: 0, destroyed: true });
  assert.deepEqual(applyDamage(30, -5), { appliedDamage: 0, remainingHealth: 30, destroyed: false });
});

test("automatic Coral Heal targets the most damaged legal Coral and caps at max HP", () => {
  const foundations = [
    { id: "school", cardId: "school-card", health: 10, maxHealth: 50 },
    { id: "light-damage", cardId: "coral-a", health: 25, maxHealth: 30 },
    { id: "heavy-damage", cardId: "coral-b", health: 5, maxHealth: 40 },
  ];
  const result = healMostDamagedCoral(foundations, 60, {
    "school-card": { kind: "foundation" },
    "coral-a": { kind: "coral" },
    "coral-b": { kind: "coral" },
  });

  assert.equal(result.targetFoundationId, "heavy-damage");
  assert.equal(result.appliedHealing, 35);
  assert.equal(result.foundations[2].health, 40);
  assert.equal(result.foundations[0].health, 10, "Creature Schools are not legal Coral Heal targets");
  assert.equal(foundations[2].health, 5, "the input remains immutable");
});

test("automatic Coral Heal is a no-op when no Coral is damaged", () => {
  const foundations = [{ id: "healthy", cardId: "coral", health: 30, maxHealth: 30 }];
  const result = healMostDamagedCoral(foundations, 20, { coral: { kind: "coral" } });
  assert.equal(result.targetFoundationId, null);
  assert.equal(result.appliedHealing, 0);
  assert.equal(result.foundations, foundations);
});

test("Neural Network moves one damage counter between foundations without changing total damage", () => {
  const foundations = [
    { id: "source", health: 30, maxHealth: 50 },
    { id: "destination", health: 30, maxHealth: 40 },
  ];
  const result = moveFoundationDamageCounter(foundations, {
    sourceFoundationId: "source",
    destinationFoundationId: "destination",
  });

  assert.equal(DAMAGE_COUNTER_HP, 10);
  assert.equal(result.moved, true);
  assert.equal(result.amount, 10);
  assert.deepEqual(result.foundations, [
    { id: "source", health: 40, maxHealth: 50 },
    { id: "destination", health: 20, maxHealth: 40 },
  ]);
  assert.deepEqual(foundations, [
    { id: "source", health: 30, maxHealth: 50 },
    { id: "destination", health: 30, maxHealth: 40 },
  ], "the input state remains immutable");
});

test("Neural Network may move damage onto an already-damaged foundation and may be used repeatedly", () => {
  const first = moveFoundationDamageCounter([
    { id: "source", health: 20, maxHealth: 50 },
    { id: "destination", health: 30, maxHealth: 50 },
  ], { sourceFoundationId: "source", destinationFoundationId: "destination" });
  const second = moveFoundationDamageCounter(first.foundations, {
    sourceFoundationId: "source",
    destinationFoundationId: "destination",
  });

  assert.equal(first.moved, true);
  assert.equal(second.moved, true);
  assert.equal(second.foundations[0].health, 40);
  assert.equal(second.foundations[1].health, 10);
});

test("Neural Network rejects illegal counter moves without mutating Foundation state", () => {
  const foundations = [
    { id: "undamaged", health: 50, maxHealth: 50 },
    { id: "partially-damaged", health: 45, maxHealth: 50 },
    { id: "donor", health: 30, maxHealth: 50 },
    { id: "fragile", health: 10, maxHealth: 40 },
  ];
  const scenarios = [
    { sourceFoundationId: "undamaged", destinationFoundationId: "fragile" },
    { sourceFoundationId: "partially-damaged", destinationFoundationId: "undamaged" },
    { sourceFoundationId: "donor", destinationFoundationId: "fragile" },
    { sourceFoundationId: "undamaged", destinationFoundationId: "undamaged" },
    { sourceFoundationId: "missing", destinationFoundationId: "undamaged" },
    { sourceFoundationId: "fragile", destinationFoundationId: "missing" },
    { sourceFoundationId: "fragile", destinationFoundationId: "undamaged", counterHp: 0 },
  ];

  scenarios.forEach((choice) => {
    const result = moveFoundationDamageCounter(foundations, choice);
    assert.equal(result.moved, false);
    assert.equal(result.foundations, foundations);
    assert.ok(result.error);
  });
});

test("Fishing Nets blocks Filter Feeders and Apex but not Predators", () => {
  const fishingNets = { effects: [{ type: "preventCardPlay", targetKind: "creature", targetCategories: ["filter-feeder", "apex"] }] };
  assert.equal(conditionPreventsCardPlay({ kind: "creature", category: "filter-feeder" }, fishingNets), true);
  assert.equal(conditionPreventsCardPlay({ kind: "creature", category: "apex" }, fishingNets), true);
  assert.equal(conditionPreventsCardPlay({ kind: "creature", category: "predator" }, fishingNets), false);
});

test("coral upgrades preserve existing damage", () => {
  assert.equal(preserveDamageOnUpgrade(5, 10, 30), 25);
  assert.equal(preserveDamageOnUpgrade(0, 10, 30), 20);
});

test("draws enforce a hand limit without losing cards", () => {
  assert.deepEqual(drawWithHandLimit(["a", "b", "c"], 6, 2, 7), {
    drawnCards: ["a", "b"],
    cardsToHand: ["a"],
    cardsToDiscard: ["b"],
    remainingDeck: ["c"],
  });
});

test("mandatory draws report partial and complete deck depletion", () => {
  assert.equal(getRequiredDrawShortfall(2, 1), 1);
  assert.equal(getRequiredDrawShortfall(2, 2), 0);
  assert.equal(getRequiredDrawShortfall(1, 0), 1);
  assert.equal(getRequiredDrawShortfall(-1, 0), 0);
});

test("resource gains stop at the current bank cap", () => {
  assert.equal(addResourceWithinCap(7, 4, 8), 8);
  assert.equal(addResourceWithinCap(7, 4, 11), 11);
});

test("Foundation attachment income counts each matching attached card", () => {
  const cardLookup = {
    "deep-sea-vent": {
      name: "Deep Sea Vent",
      passives: ["Symbiosis: Collect 2RP for each Giant Tube Worm attached to this card."],
    },
    "giant-tube-worm": { name: "Giant Tube Worm" },
    "deep-fish": { name: "Bristlemouth" },
  };
  const foundation = {
    cardId: "deep-sea-vent",
    slots: [
      { cardId: "giant-tube-worm", hostedCardIds: [] },
      { cardId: "deep-fish", hostedCardIds: ["giant-tube-worm"] },
      { cardId: null, hostedCardIds: [] },
    ],
  };

  assert.equal(calculateAttachedCardRpBonus(foundation, cardLookup), 4);
  assert.equal(calculateAttachedCardRpBonus({ ...foundation, cardId: "deep-fish" }, cardLookup), 0);
});

test("resource transfers respect both the source bank and recipient cap", () => {
  assert.deepEqual(resolveResourceTransfer({ requested: 3, sourceAmount: 5, recipientAmount: 4, recipientCap: 8 }), {
    requested: 3,
    transferred: 3,
    uncollected: 0,
    sourceAfter: 2,
    recipientAfter: 7,
  });
  assert.deepEqual(resolveResourceTransfer({ requested: 4, sourceAmount: 2, recipientAmount: 7, recipientCap: 8 }), {
    requested: 4,
    transferred: 1,
    uncollected: 3,
    sourceAfter: 1,
    recipientAfter: 8,
  });
});

test("RP bank cap defaults to 8 and applies active condition modifiers", () => {
  const abundantSunlight = { effects: [{ type: "modifyRpBankCap", amount: 2 }] };
  const bleakOvercast = { effects: [{ type: "modifyRpBankCap", amount: -2 }] };

  assert.equal(DEFAULT_RP_BANK_CAP, 8);
  assert.equal(calculateRpBankCap(), 8);
  assert.equal(getConditionRpBankCapModifier(abundantSunlight), 2);
  assert.equal(calculateRpBankCap([], abundantSunlight), 10);
  assert.equal(calculateRpBankCap([], bleakOvercast), 6);
});

test("RP bank cap includes structured and legacy EcoBoost cards in the ecosystem", () => {
  const structuredEcoBoost = {
    passives: [{
      text: "Add +1 to your max resource bank while this card is in play.",
      effect: { type: "modifyRpBankCap", amount: 1 },
    }],
  };
  const legacyEcoBoost = { passives: ["EcoBoost: +3 RP to your bank cap."] };
  const alternateLegacySpacing = { passives: ["Eco Boost: Add +1 to your max resource bank while this card is in play."] };

  assert.equal(getCardRpBankCapModifier(structuredEcoBoost), 1);
  assert.equal(getCardRpBankCapModifier(legacyEcoBoost), 3);
  assert.equal(getCardRpBankCapModifier(alternateLegacySpacing), 1);
  assert.equal(calculateRpBankCap([structuredEcoBoost, legacyEcoBoost], null), 12);
  assert.equal(calculateRpBankCap([structuredEcoBoost, legacyEcoBoost], { effects: [{ type: "modifyRpBankCap", amount: 2 }] }), 14);
  assert.equal(calculateRpBankCap([], null), 8, "removed EcoBoost cards stop increasing the live cap");
});

test("victory points include conditional and per-card reef bonuses", () => {
  const cards = [
    { id: "coral-reef" },
    { id: "angel", victoryPoints: 3, bonusVictoryPoints: { amount: 2, condition: { type: "cardInPlay", cardId: "coral-reef" } } },
    { id: "twin", victoryPoints: 2, bonusVictoryPoints: { type: "perCardOnReef", amount: 1, targetCardId: "twin", condition: { type: "cardInPlay", cardId: "coral-reef" } } },
    { id: "twin", victoryPoints: 2 },
  ];
  assert.equal(calculateVictoryPoints(cards), 11);

  const coelacanth = { id: "coelacanth", victoryPoints: 2, bonusVictoryPoints: { amount: 2, condition: { type: "cardInPlay", cardId: "abyss" } } };
  assert.equal(calculateVictoryPoints([coelacanth], ["coelacanth"]), 2);
  assert.equal(calculateVictoryPoints([{ id: "abyss" }, coelacanth], ["abyss", "coelacanth"]), 4);
});

test("victory target resolves normal and simultaneous finishes", () => {
  assert.equal(determineVictoryResult(9, 8, 10), null);
  assert.equal(determineVictoryResult(10, 7, 10).winner, "player");
  assert.equal(determineVictoryResult(8, 10, 10).winner, "opponent");
  assert.equal(determineVictoryResult(12, 11, 10).winner, "player");
  assert.equal(determineVictoryResult(10, 12, 10).winner, "opponent");
});

test("continuous health bonuses preserve damage and can destroy when removed", () => {
  assert.deepEqual(reconcileContinuousHealth(20, 30, 40, 10), { health: 40, maxHealth: 50, destroyed: false });
  assert.deepEqual(reconcileContinuousHealth(5, 20, 10, 0), { health: 0, maxHealth: 10, destroyed: true });
});

test("conditional dice damage uses the roll only when its condition is met", () => {
  assert.equal(resolveConditionalDiceDamage({ dice: "D4", multiplier: 10, fallbackAmount: 10, conditionMet: true }, () => 0.5).damage, 30);
  assert.deepEqual(resolveConditionalDiceDamage({ dice: "D4", multiplier: 10, fallbackAmount: 10, conditionMet: false }, () => 0.5), { damage: 10, roll: null });
});

test("half-cost recycling rounds up", () => {
  assert.equal(halfCostRoundedUp(1), 1);
  assert.equal(halfCostRoundedUp(5), 3);
});

test("Blue Crab recycle uses one shared eligibility and bank-cap result", () => {
  assert.deepEqual(resolveBlueCrabRecycle({
    defeatedCardIsFish: true,
    defeatedCardRpCost: 5,
    controllerHasBlueCrab: true,
    recycleUsedTurn: 2,
    currentTurn: 3,
    currentRp: 6,
    rpCap: 8,
  }), {
    triggered: true,
    nominalRecoveredRp: 3,
    recoveredRp: 2,
    rpAfter: 8,
    recycleUsedTurnAfter: 3,
  });
  assert.equal(resolveBlueCrabRecycle({ defeatedCardIsFish: true, controllerHasBlueCrab: true, recycleUsedTurn: 3, currentTurn: 3, currentRp: 4, rpCap: 8 }).triggered, false);
  assert.equal(resolveBlueCrabRecycle({ defeatedCardIsFish: false, controllerHasBlueCrab: true, currentTurn: 3, currentRp: 4, rpCap: 8 }).triggered, false);
});

test("structured in-play conditions recognize habitats and named cards", () => {
  const cards = [{ id: "blue-crab", kind: "creature" }];
  assert.equal(isEcosystemConditionMet({ type: "kindInPlay", requiredKind: "habitat" }, ["coral-reef"], cards), true);
  assert.equal(isEcosystemConditionMet({ type: "cardInPlay", cardId: "blue-crab" }, [], cards), true);
  assert.equal(isEcosystemConditionMet({ type: "cardInPlay", cardId: "abyss" }, ["coral-reef"], cards), false);
});

test("attached host health bonuses honor unique-per-host stacking", () => {
  const urchin = { id: "sea-urchin", passives: [{ id: "spines", effect: { type: "modifyHealth", target: { relationship: "attachedHost" }, amount: 20, stacking: "uniquePerHost" } }] };
  const protector = { id: "sargeant-major", passives: [{ id: "coral-protector", effect: { type: "modifyHealth", target: { relationship: "attachedHost" }, amount: 10 } }] };
  assert.equal(calculateAttachedHostHealthBonus([urchin, urchin, protector, protector]), 40);
});

test("foundation shelter text grants attached creatures a flat defense bonus", () => {
  assert.equal(calculateAttachedCreatureDefenseBonus({ passives: ["Shelter: Creatures attached to this coral gain +1 on their defensive dice rolls."] }), 1);
  assert.equal(calculateAttachedCreatureDefenseBonus({ passives: [] }), 0);
});

test("orphan creatures fill compatible empty slots and preserve hosted cards and invasive ownership", () => {
  const foundations = [{ id: "coral-a", slots: [{ id: "fish-slot", accepts: "fish", cardId: null }, { id: "occupied", accepts: "fish", cardId: "resident" }, { id: "predator-slot", accepts: "predator", cardId: null }] }];
  const orphans = [{ cardId: "fish-a", instanceId: "fish-a-instance", hostedCardIds: ["clownfish"], controller: "opponent", invasiveOwner: "opponent" }, { cardId: "fish-b" }, { cardId: "predator-a", instanceId: "predator-instance" }];
  const result = redistributeOrphans(foundations, orphans, (cardId, slot) => cardId.startsWith(slot.accepts));
  assert.equal(result.corals[0].slots[0].cardId, "fish-a");
  assert.equal(result.corals[0].slots[0].cardInstanceId, "fish-a-instance");
  assert.deepEqual(result.corals[0].slots[0].hostedCardIds, ["clownfish"]);
  assert.equal(result.corals[0].slots[0].controller, "opponent");
  assert.equal(result.corals[0].slots[0].invasiveOwner, "opponent");
  assert.equal(result.corals[0].slots[1].cardId, "resident");
  assert.equal(result.corals[0].slots[2].cardId, "predator-a");
  assert.equal(result.corals[0].slots[2].cardInstanceId, "predator-instance");
  assert.deepEqual(result.orphans, [{ cardId: "fish-b", hostedCardIds: [] }]);
});

test("seeded random sequences are stable for hydration-safe initialization", () => {
  const first = createSeededRandom(0x5ea9a15);
  const second = createSeededRandom(0x5ea9a15);
  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
});

test("legacy attack text exposes base combat rules", () => {
  const attack = parseLegacyAttackText("Enduring Attack: D8 attack targeting Apex, Predator, or Fish. Cannot be used on your next turn. Cost: 4RP.");
  assert.equal(attack.attackDice, "D8");
  assert.deepEqual(attack.target.categories, ["apex", "predator", "fish"]);
  assert.equal(attack.actionCost, 4);
  assert.equal(attack.skipNextTurn, true);
  const consumeAttack = parseLegacyAttackText("Eyes Bigger Than Stomach: D4-1 attack targeting Predator, Apex, or Filter Feeder. If you successfully consume an Apex or Predator, discard this card.");
  assert.equal(consumeAttack.unsupportedDetails, "");
});

test("legacy Deep attacks retain their zone restriction", () => {
  const deepAttack = parseLegacyAttackText("Crunch: Two D6 attacks targeting Deep Invertebrates.");
  assert.deepEqual(deepAttack.target.categories, ["invertebrate"]);
  assert.equal(deepAttack.targetZone, "deep");
  assert.deepEqual(deepAttack.targetTags, []);

  const generalAttack = parseLegacyAttackText("Crunch: Two D6 attacks targeting Invertebrates.");
  assert.equal(generalAttack.targetZone, null);
  assert.deepEqual(generalAttack.targetTags, []);
});

test("legacy utility text parses draws, searches, and recovery destinations", () => {
  assert.deepEqual(parseLegacyUtilityText("Nutrient Rich: Gain 1 RP."), { type: "gainResource", resource: "rp", amount: 1 });
  assert.deepEqual(parseLegacyUtilityText("Frenzy: Deal 20 HP damage to an opponent's Creature School."), { type: "damageFoundation", amount: 20, targetType: "creature-school" });
  assert.deepEqual(parseLegacyUtilityText("Echo Locate: Draw 2 cards."), { type: "drawCards", amount: 2 });
  assert.deepEqual(parseLegacyUtilityText("Scavenge: Draw three cards. Cost: 2 RP."), { type: "drawCards", amount: 3 });
  assert.deepEqual(parseLegacyUtilityText("Darkness Scan: Search your deck for a Deep Invertebrate and place it in your hand."), { type: "searchDeck", targetKind: "creature", targetCategories: ["invertebrate"], targetZone: "deep", amount: 1 });
  assert.deepEqual(parseLegacyUtilityText("Tuna School: Search your deck for a Tuna and place it into your hand."), { type: "searchDeck", targetKind: "creature", targetCategories: [], targetZone: null, targetNameIncludes: "tuna", amount: 1 });
  assert.deepEqual(parseLegacyUtilityText("Scavenge: Search your discard pile for a card and shuffle it into your deck. Cost: 1RP."), { type: "recoverCardFromDiscard", amount: 1, destination: "deck" });
  assert.deepEqual(parseLegacyUtilityText("Filter Feed: Discard up to two cards, draw as many cards as you discarded. Cost: 0RP."), { type: "discardThenDraw", discard: { min: 1, max: 2 } });
  assert.deepEqual(parseLegacyUtilityText("Sift: Discard two cards from your hand. If you do, search your deck for a card and place it into your hand."), { type: "discardThenSearchDeck", discard: { amount: 2 }, search: { amount: 1 } });
  assert.deepEqual(parseLegacyUtilityText("Vantage Point: Look at the top three cards of either of your decks and rearrange them."), { type: "reorderTopDeck", amount: 3 });
  assert.deepEqual(parseLegacyUtilityText("Highlight: Your next On Play attack has +2 on its attack roll. Cost: 2RP."), { type: "grantNextOnPlayAttackBonus", amount: 2 });
  assert.deepEqual(parseLegacyUtilityText("Nerve Agent: Flip a coin. If heads, your opponent's coral is now stunned. Cost: 2 RP."), { type: "flipCoin", successResult: "heads", onSuccess: { type: "stunCoral" } });
});

test("On Play resource gains support legacy and structured cards without double counting", () => {
  assert.equal(getResourceGainFromActions(["Nutrient Rich: Gain 1 RP."]), 1);
  assert.equal(getResourceGainFromActions([{ text: "Gain 5 RP.", effects: [{ type: "gainResource", resource: "rp", amount: 2 }] }]), 2);
  assert.equal(addResourceWithinCap(7, getResourceGainFromActions(["Nutrient Rich: Gain 1 RP."]), 8), 8);
  assert.equal(addResourceWithinCap(8, getResourceGainFromActions(["Nutrient Rich: Gain 1 RP."]), 8), 8);
});

test("On Play draw totals support structured and legacy actions without double counting", () => {
  assert.equal(getDrawCountFromActions([
    "Echo Locate: Draw 2 cards.",
    { name: "Migration", text: "Draw 4 cards.", effects: [{ type: "drawCards", amount: 1 }] },
  ]), 3);
});
