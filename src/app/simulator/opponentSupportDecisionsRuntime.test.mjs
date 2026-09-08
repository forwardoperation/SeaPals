import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  OpponentDifficulty, chooseOpponentPreferredDeck, limitOpponentOptionalActions,
  orderOpponentChoices, selectOpponentChoice,
} from "./opponentDifficultyRules.mjs";
import {
  canOpponentSpendSupportWithoutBreakingHardPlan, getHardOpponentSupportRpReserve,
  scoreHardOpponentSearchCandidate, selectProductiveOpponentSearchTargets,
} from "./opponentPlayRules.mjs";

const source = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const start = source.indexOf("function runOpponentSupports(opponentState)");
const end = source.indexOf("function runOpponentTurn(", start);
assert.ok(start >= 0 && end > start);
const supportSource = source.slice(start, end);

const support = (id, effects = [], cost = 0) => ({ id, name: id, kind: "support", effects, cost: { rp: cost } });
const creature = (id, vp = 1, cost = 1) => ({ id, name: id, kind: "creature", category: "fish", zone: "ocean", victoryPoints: vp, cost: { rp: cost } });
const cards = {
  "poison-heal": support("poison-heal"),
  "rov-lights": support("rov-lights"),
  "spearfishing": support("spearfishing"),
  "dr-evans": support("dr-evans", [{ type: "draw", amount: 7 }]),
  "scientist-jes": support("scientist-jes", [{ type: "search", targetKind: "habitat", amount: 1 }, { type: "draw", amount: 3 }]),
  "explorer-jordan": support("explorer-jordan", [{ type: "search", amount: 1 }]),
  "robotic-survey": support("robotic-survey", [{ type: "chooseFromTopDeck", amount: 5, targetKind: "creature" }]),
  "recovery": support("recovery"),
  "ocean-jake": support("ocean-jake"),
  "reef": { id: "reef", name: "reef", kind: "coral", cost: { rp: 1 } },
  "fish": creature("fish"),
  "useful-fish": creature("useful-fish", 3, 2),
  "locked-fish": { ...creature("locked-fish", 12, 2), locked: true },
  "expensive-fish": creature("expensive-fish", 9, 20),
  "habitat": { id: "habitat", name: "habitat", kind: "habitat", cost: { rp: 1 } },
};

function state(overrides = {}) {
  return {
    corals: [], habitats: [], hand: [], palsDeck: [], foundationDeck: [],
    reefCreatures: [], reefCreatureInstances: [], orphanCreatures: [],
    discardPile: [], lostZone: [], rp: 5, supportBlockedUntilRound: 0,
    ...overrides,
  };
}

function createRuntime(difficulty, extraDependencies = {}) {
  const removeOneCard = (items, id) => {
    const copy = [...items];
    const index = copy.indexOf(id);
    if (index >= 0) copy.splice(index, 1);
    return copy;
  };
  const dependencies = {
    opponentDifficulty: difficulty, OpponentDifficulty, round: 3, turn: 6,
    opponentVp: 0, victoryTarget: 30, activeCondition: null, schoolDensityConditionIds: [],
    playerCorals: [], playerCoralCards: [], playerReefCreatures: [], playerReefCreatureInstances: [], playerOrphanCreatures: [], playerOrphanCreatureInstances: [],
    cardsById: cards,
    CardKind: { SUPPORT: "support", CREATURE: "creature", CORAL: "coral", HABITAT: "habitat" },
    CardCategory: { FISH: "fish", PREDATOR: "predator" }, CreatureZone: { OCEAN: "ocean" },
    EffectType: { SEARCH_DECK: "search", DRAW_CARDS: "draw" },
    chooseOpponentPreferredDeck, limitOpponentOptionalActions, orderOpponentChoices, selectOpponentChoice,
    getHardOpponentSupportRpReserve, canOpponentSpendSupportWithoutBreakingHardPlan,
    scoreHardOpponentSearchCandidate, selectProductiveOpponentSearchTargets,
    getEcosystemSchoolDensityCommitted: () => 0,
    createSchoolDensityBucketState: () => ({ available: 10 }),
    getEffectiveSchoolDensityRequirement: () => ({ effectiveRequirement: 0 }),
    getLocallyControlledOrphans: (orphans) => orphans.filter((entry) => entry.invasiveOwner !== "player"),
    getCardPlayCost: (card) => card.cost?.rp ?? 0,
    getOpposingPlayCostModifier: () => 0,
    getConditionPlayRestriction: () => "",
    getHabitatRequirementError: () => "",
    getCompositionRequirementError: (card) => card.locked ? "Missing requirement" : "",
    getOceanicPlaySacrifices: () => [],
    getCardStartTurnRp: () => 0,
    getOnPlayAttackEffect: () => null, getBasicAttackEffect: () => null,
    runOpponentAttackStep: () => ({ profitableAttacks: [] }),
    isFoundationCard: (card) => card?.kind === "coral", isCreatureSchool: () => false,
    cardIsBlockedFromPlayThisTurn: (current, cardId) => current.cardsBlockedFromPlayThisTurn?.includes(cardId),
    cardUsesOpponentReef: () => false, coralIsStunned: () => false,
    canCardOccupySlot: () => true, canHostSpecialPlacement: () => false,
    getSlotActionKey: (slot) => slot.id,
    getReefCardOwner: (entry, owner) => entry.invasiveOwner ?? owner,
    cardCanBeSpearfished: (card) => card?.category === "fish",
    cardMatchesSearchCriteria: (card, effect) => card && (!effect.targetKind || effect.targetKind === card.kind),
    removeOneCard, shuffle: (items) => [...items], nextGameplayRandom: () => 0,
    getRequiredDrawShortfall: (requested, drawn) => Math.max(0, requested - drawn),
    applyAutomatedHandLimitToState: (current, _limit, _options, incoming = []) => ({
      state: { ...current, hand: [...current.hand, ...incoming] },
      cardsToDiscard: [], incomingCardsToHand: incoming, incomingCardsToDiscard: [],
    }),
    supportExplicitlyLocksFurtherSupports: () => false,
    reconcileOpponentInstances: (_previous, current) => current,
    ...extraDependencies,
  };
  const names = Object.keys(dependencies);
  return new Function(...names, `"use strict"; ${supportSource}; return runOpponentSupports;`)(...names.map((key) => dependencies[key]));
}

for (const difficulty of Object.values(OpponentDifficulty)) {
  test(`${difficulty} retains duplicate defensive supports and its own Fish`, () => {
    const initial = state({
      hand: ["poison-heal", "rov-lights", "spearfishing"],
      poisonImmunityNextPredatorAttack: true, rovLightsActive: true,
      reefCreatures: ["fish"], reefCreatureInstances: [{ cardId: "fish", instanceId: "fish-1" }],
    });
    const result = createRuntime(difficulty)(initial);
    assert.equal(result.events.length, 0);
    assert.deepEqual(result.state.hand, initial.hand);
    assert.deepEqual(result.state.reefCreatures, ["fish"]);
  });

  test(`${difficulty} declines an optional draw that would lose by deck depletion`, () => {
    const result = createRuntime(difficulty)(state({ hand: ["dr-evans", "scientist-jes"], palsDeck: ["fish", "fish"] }));
    assert.equal(result.events.length, 0);
    assert.equal(result.lost, false);
    assert.deepEqual(result.state.palsDeck, ["fish", "fish"]);
  });

  test(`${difficulty} searches for an affordable ready play ahead of a locked trophy`, () => {
    const result = createRuntime(difficulty)(state({ hand: ["explorer-jordan"], palsDeck: ["locked-fish", "expensive-fish", "useful-fish"] }));
    assert.deepEqual(result.state.hand, ["useful-fish"]);
  });

  test(`${difficulty} recovers a useful play instead of a redundant support`, () => {
    const result = createRuntime(difficulty)(state({ hand: ["recovery"], discardPile: ["poison-heal", "expensive-fish", "useful-fish"], poisonImmunityNextPredatorAttack: true }));
    assert.deepEqual(result.state.hand, ["useful-fish"]);
    assert.equal(result.events[0].opponentCoinFlip.result, "heads");
  });

  test(`${difficulty} protects the RP needed for an immediate winning creature before searching`, () => {
    const paidCards = { ...cards, "explorer-jordan": support("explorer-jordan", [{ type: "search", amount: 1 }], 1) };
    const result = createRuntime(difficulty, {
      cardsById: paidCards, opponentVp: 27,
      getBasicAttackEffect: (card) => card?.id === "useful-fish" ? { actionCost: 2 } : null,
      opponentAttackHasVisibleTarget: () => true,
    })(state({ hand: ["explorer-jordan", "useful-fish"], palsDeck: ["fish"], rp: 2 }));
    assert.equal(result.events.length, 0);
    assert.equal(result.state.rp, 2);
    assert.deepEqual(result.state.hand, ["explorer-jordan", "useful-fish"]);
  });
}

test("Scientist Jes chooses its legal search when drawing would lose, even with a habitat already deployed", () => {
  const result = createRuntime("hard")(state({ hand: ["scientist-jes"], habitats: ["habitat"], foundationDeck: ["habitat"] }));
  assert.equal(result.lost, false);
  assert.deepEqual(result.state.hand, ["habitat"]);
  assert.equal(result.events.length, 1);
});

test("top-card inspection chooses a deck from board needs without peeking at both decks", () => {
  const corals = [1, 2, 3].map((id) => ({ id: `reef-${id}`, cardId: "reef", slots: [{ id: `slot-${id}` }] }));
  const result = createRuntime("hard")(state({ hand: ["robotic-survey"], corals, palsDeck: ["fish"], foundationDeck: ["useful-fish"] }));
  assert.deepEqual(result.state.hand, ["fish"]);
  assert.deepEqual(result.state.foundationDeck, ["useful-fish"]);
});

test("recovery-only cycles have no productive target and do not consume supports", () => {
  const result = createRuntime("hard")(state({ hand: ["recovery", "ocean-jake"], discardPile: ["recovery"], lostZone: ["ocean-jake"] }));
  assert.equal(result.events.length, 0);
  assert.deepEqual(result.state.hand, ["recovery", "ocean-jake"]);
});

test("Ocean Jake recovers a useful card while preserving its printed next-turn restriction", () => {
  const result = createRuntime("hard")(state({ hand: ["ocean-jake"], lostZone: ["ocean-jake", "locked-fish", "useful-fish"] }));
  assert.deepEqual(result.state.hand, ["useful-fish"]);
  assert.deepEqual(result.state.cardsBlockedFromPlayThisTurn, ["useful-fish"]);
  assert.deepEqual(result.state.lostZone, ["ocean-jake", "ocean-jake", "locked-fish"]);
});

test("support spending reserves profitable deployed attacks and releases RP when combat would pass", () => {
  const paidCards = { ...cards, "explorer-jordan": support("explorer-jordan", [{ type: "search", amount: 1 }], 1) };
  const initial = state({ hand: ["explorer-jordan"], palsDeck: ["useful-fish"], rp: 2 });
  let planningCalls = 0;
  const withProfitableAttack = createRuntime("hard", {
    cardsById: paidCards,
    runOpponentAttackStep: (_state, _corals, reefInstances, orphanInstances, forced, exhausted, options) => {
      planningCalls += 1;
      assert.deepEqual(reefInstances, []);
      assert.deepEqual(orphanInstances, []);
      assert.equal(forced, null);
      assert.deepEqual(exhausted, []);
      assert.equal(options.planOnly, true);
      return { profitableAttacks: [{ actionCost: 2, value: 20 }] };
    },
  })(initial);
  assert.equal(withProfitableAttack.events.length, 0);
  assert.equal(planningCalls, 1);
  const withUnprofitableAttack = createRuntime("hard", { cardsById: paidCards })(initial);
  assert.equal(withUnprofitableAttack.events.length, 1);
  assert.deepEqual(withUnprofitableAttack.state.hand, ["useful-fish"]);
});

test("support candidates reuse the combat reserve until the state changes", () => {
  const paidCards = {
    ...cards,
    "explorer-jordan": support("explorer-jordan", [{ type: "search", amount: 1 }], 1),
    "robotic-survey": support("robotic-survey", [{ type: "chooseFromTopDeck", amount: 5 }], 1),
  };
  let planningCalls = 0;
  const result = createRuntime("hard", {
    cardsById: paidCards,
    runOpponentAttackStep: () => {
      planningCalls += 1;
      return { profitableAttacks: [{ actionCost: 2, value: 20 }] };
    },
  })(state({ hand: ["explorer-jordan", "robotic-survey"], palsDeck: ["fish"], rp: 2 }));
  assert.equal(result.events.length, 0);
  assert.equal(planningCalls, 1);
});
