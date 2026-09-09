import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { applyDamage } from "./gameRules.mjs";

const source = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
function evaluateFunction(name, nextName, context) {
  const start = source.indexOf(`  function ${name}(`);
  const end = source.indexOf(`  function ${nextName}(`, start);
  assert.ok(start >= 0 && end > start);
  return new Function(...Object.keys(context), `${source.slice(start, end)}; return ${name};`)(...Object.values(context));
}

const cards = {
  coral: { id: "coral", kind: "coral", name: "Coral" },
  school: { id: "school", kind: "creature", tags: ["creature-school"], name: "School" },
  actor: { id: "actor", kind: "creature", name: "Actor", actions: [] },
};
const baseContext = {
  cardsById: cards,
  CardKind: { CORAL: "coral" },
  EffectType: { STUN_CORAL: "stunCoral", DAMAGE: "damage", FLIP_COIN: "flipCoin" },
  applyDamage,
  isCreatureSchool: (card) => card?.tags?.includes("creature-school"),
  selectOpponentFoundationEffectTarget: (candidates) => candidates[0],
  getCardStartTurnRp: () => 1,
  redistributeOrphanCreatures: (corals, orphans) => ({ corals, orphans }),
  getOrphanEntriesFromFoundation: () => [],
  resolveFoundationDestructionTriggers: (_waves, hand, discardPile) => ({ hand, discardPile, triggers: [] }),
  projectNormalizedPlayerState: (state) => ({ state }),
  getContinuousHealthCollapseMessage: () => "",
  activeCondition: null,
  turn: 2,
  round: 2,
  nextGameplayRandom: () => 0,
  getLocallyControlledOrphans: (entries) => entries ?? [],
  coralIsStunned: (coral) => coral.statuses?.some((status) => status.type === "stunned"),
  createStunnedStatus: (sourceCardId) => ({ type: "stunned", sourceCardId }),
  getSupportedUtilityEffect: (action) => action.effect,
  getActionCost: () => 1,
  getActionName: (action) => action.name,
  actionIsOncePerTurn: () => true,
  getOpponentActionUseKey: (_location, action) => action.name,
  wasOpponentActionUsedThisTurn: () => false,
  markOpponentActionUsed: (_uses, key) => ({ [key]: 2 }),
  getPassiveCoralHeal: () => null,
  getDamageCounterMove: () => null,
};
const foundation = (cardId = "coral", health = 15) => ({ id: "target", cardId, health, maxHealth: 60, slots: [], statuses: [] });
const opponent = { corals: [], reefCreatures: ["actor"], reefCreatureInstances: [{ instanceId: "actor-instance" }], rp: 5, hand: [] };
const player = { corals: [foundation()], hand: [], discardPile: [], orphanCreatureInstances: [] };

test("AI foundation damage records actual HP removed, including destroyed corals and schools", () => {
  const resolveDamage = evaluateFunction("applyOpponentFoundationDamage", "runOpponentUtilityAction", baseContext);
  for (const [cardId, key] of [["coral", "coralDamage"], ["school", "schoolDamage"]]) {
    const result = resolveDamage([foundation(cardId)], [], { amount: 80, targetType: cardId === "school" ? "creature-school" : "coral" }, "Actor", [], []);
    assert.deepEqual(result.analyticsMetrics, [{ side: "player", metrics: { [key]: 15 } }]);
    assert.equal(result.corals.length, 0);
  }
  const surviving = resolveDamage([foundation("coral", 40)], [], { amount: 10 }, "Actor", [], []);
  assert.deepEqual(surviving.analyticsMetrics, [{ side: "player", metrics: { coralDamage: 10 } }]);
  assert.equal(surviving.corals[0].health, 30);
});

test("AI Stunned applications remain countable when an existing stun is refreshed", () => {
  const context = { ...baseContext, cardsById: { ...cards, actor: { ...cards.actor, actions: [{ name: "Stun", effect: { type: "stunCoral" } }] } } };
  const resolveUtility = evaluateFunction("runOpponentUtilityAction", "runOpponentUtilityActions", context);
  const alreadyStunned = { ...player, corals: [{ ...foundation(), statuses: [{ type: "stunned" }] }] };
  const result = resolveUtility(opponent, alreadyStunned);
  assert.deepEqual(result.analyticsMetrics, [{ side: "player", metrics: { stunsApplied: 1 } }]);
  assert.equal(result.playerState.corals[0].statuses.length, 1);
  assert.equal(result.state.rp, 4);
});

test("a failed AI coin ability records usage without inventing damage", () => {
  const action = { name: "Risk", effect: { type: "flipCoin", onSuccess: { type: "damage", amount: 50 } } };
  const context = {
    ...baseContext,
    cardsById: { ...cards, actor: { ...cards.actor, actions: [action] } },
    resolveTargetedCoinFlip: () => ({ success: false, coinResult: "tails" }),
  };
  const result = evaluateFunction("runOpponentUtilityAction", "runOpponentUtilityActions", context)(opponent, player);
  const events = evaluateFunction("buildOpponentUtilityEvents", "runOpponentNormalAttackActions", context)({ actions: [result] });
  assert.deepEqual(events[0].analyticsMetrics, []);
  assert.deepEqual(events[0].analyticsAbility, { counter: "actions", name: "Risk" });
  assert.equal(events[0].success, false);
  assert.equal(result.state.rp, 4);
});

test("successful AI coin damage is carried through its committed utility event", () => {
  const action = { name: "Risk", effect: { type: "flipCoin", onSuccess: { type: "damage", amount: 50 } } };
  const context = {
    ...baseContext,
    cardsById: { ...cards, actor: { ...cards.actor, actions: [action] } },
    resolveTargetedCoinFlip: () => ({ success: true, coinResult: "heads" }),
  };
  const result = evaluateFunction("runOpponentUtilityAction", "runOpponentUtilityActions", context)(opponent, player);
  const build = evaluateFunction("buildOpponentUtilityEvents", "runOpponentNormalAttackActions", context);
  const first = build({ actions: [result] })[0];
  const next = build({ actions: [result] })[0];
  assert.deepEqual(first.analyticsMetrics, [{ side: "player", metrics: { coralDamage: 15 } }]);
  assert.equal(first.playerStateAfter.corals.length, 0);
  assert.ok(first.analyticsEventId);
  assert.notEqual(first.analyticsEventId, next.analyticsEventId, "event IDs belong to commit candidates, not card identities");
});

test("AI healing counts a passive resolution rather than an ordinary action", () => {
  const healingCoral = { ...cards.coral, passives: [{ id: "recovery", name: "Recovery" }] };
  const context = { ...baseContext, cardsById: { ...cards, coral: healingCoral }, getPassiveCoralHeal: () => ({ actionName: "Recovery", amount: 10 }) };
  const result = evaluateFunction("runOpponentUtilityAction", "runOpponentUtilityActions", context)({ ...opponent, corals: [foundation()] }, player);
  const event = evaluateFunction("buildOpponentUtilityEvents", "runOpponentNormalAttackActions", context)({ actions: [result] })[0];
  assert.deepEqual(event.analyticsAbility, { counter: "passives", name: "Recovery", id: "recovery" });
  assert.deepEqual(event.analyticsMetrics, []);
  assert.equal(event.opponentStateAfter.corals[0].health, 25);
});

test("repeated AI attacks count one activation and cap every step at remaining school HP", () => {
  const context = {
    ...baseContext,
    normalizeProjectedPlayerState: (state) => state,
    normalizeProjectedOpponentState: (state) => state,
    reconcileOpponentInstances: (_previous, state) => state,
    reconcileCreatureZone: (_previous, state) => state,
    projectNormalizedOpponentState: (state) => ({ state }),
    triggerFlashingAlarm: (state) => state,
    destroyedCardGoesToLostZone: () => false,
    cardHasPlenteous: () => false,
    buildContinuousHealthCollapseEvent: () => null,
    getBasicAttackEffect: () => ({ actionName: "Hunt" }),
    getOnPlayAttackEffect: () => ({ actionName: "Ravage" }),
  };
  const board = {
    ...player,
    corals: [foundation("school", 60)],
    reefCreatureInstances: [],
    orphanCreatureInstances: [],
    foundationDeck: [],
    lostZone: [],
    resilienceUsedCardIds: [],
    creatureStatuses: {},
  };
  const build = evaluateFunction("buildOpponentAttackEventSequence", "preserveOpponentNormalActionsAfterOnPlay", context);
  const steps = [
    { attackerCardId: "actor", defenderCardId: "school", targetInstanceId: "foundation:target", damage: 30, corals: [foundation("school", 30)], summary: "First attack." },
    { attackerCardId: "actor", defenderCardId: "school", targetInstanceId: "foundation:target", damage: 80, corals: [], summary: "Second attack." },
  ];
  const result = build({ steps, opponentAttackActionKey: "hunt" }, board, opponent);
  assert.deepEqual(result.events.map((event) => event.analyticsMetrics), [
    [{ side: "player", metrics: { schoolDamage: 30 } }],
    [{ side: "player", metrics: { schoolDamage: 30 } }],
  ]);
  assert.deepEqual(result.events[0].analyticsAbility, { counter: "actions", cardId: "actor", name: "Hunt" });
  assert.equal(result.events[1].analyticsAbility, null);
  const resumed = build({ steps: [steps[1]], opponentAttackActionKey: "hunt" }, { ...board, corals: [foundation("school", 30)] }, opponent, { actionCostAlreadyPaid: true });
  assert.equal(resumed.events[0].analyticsAbility, null);
  const onPlay = build({ steps: [steps[0]] }, board, opponent);
  assert.deepEqual(onPlay.events[0].analyticsAbility, { counter: "onPlay", cardId: "actor", name: "Ravage" });
});
