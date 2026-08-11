import test from "node:test";
import assert from "node:assert/strict";
import {
  LIONFISH_INVADER_ATTACK_DICE,
  collectHostTurnLionfishInvaders,
  getLionfishInvaderTargetCandidates,
  getLionfishInvaderTargetController,
  planLionfishInvaderTrigger,
  resolveLionfishInvaderCoin,
  resolveLionfishInvaderOpposedRoll,
  selectLionfishInvaderTarget,
} from "./lionfishInvaderRules.mjs";

test("host-turn discovery finds foreign slotted and orphaned Lionfish in stable board order", () => {
  const foundations = [
    {
      id: "coral-a",
      slots: [
        { id: "local", cardId: "lionfish", cardInstanceId: "local-lionfish", controller: "player", invasiveOwner: "player" },
        { id: "foreign-a", cardId: "lionfish", cardInstanceId: "opponent-lionfish-a", controller: "opponent", invasiveOwner: "opponent" },
        { id: "not-lionfish", cardId: "frogfish", cardInstanceId: "frogfish-a", controller: "opponent", invasiveOwner: "opponent" },
      ],
    },
    {
      id: "coral-b",
      slots: [
        { id: "foreign-b", cardId: "lionfish", controller: "opponent", invasiveOwner: "opponent" },
        { id: "ambiguous", cardId: "lionfish", controller: "opponent", invasiveOwner: "player" },
      ],
    },
  ];
  const orphanEntries = [
    { cardId: "lionfish", instanceId: "local-orphan", controller: "player", invasiveOwner: "player" },
    { cardId: "lionfish", instanceId: "opponent-orphan", controller: "opponent", invasiveOwner: "opponent" },
    { cardId: "lionfish", controller: "opponent", invasiveOwner: "opponent" },
  ];

  assert.deepEqual(collectHostTurnLionfishInvaders({
    foundations,
    orphanEntries,
    hostController: "player",
  }), [
    {
      location: "slot",
      coralId: "coral-a",
      slotId: "foreign-a",
      instanceId: "opponent-lionfish-a",
      cardId: "lionfish",
      controller: "opponent",
    },
    {
      location: "slot",
      coralId: "coral-b",
      slotId: "foreign-b",
      instanceId: "coral-b:foreign-b:lionfish",
      cardId: "lionfish",
      controller: "opponent",
    },
    {
      location: "orphan",
      orphanIndex: 1,
      instanceId: "opponent-orphan",
      cardId: "lionfish",
      controller: "opponent",
    },
    {
      location: "orphan",
      orphanIndex: 2,
      instanceId: "orphan:2:lionfish",
      cardId: "lionfish",
      controller: "opponent",
    },
  ]);
});

test("host-turn discovery is symmetric and ignores ordinary or ambiguously owned Lionfish", () => {
  const foundations = [{
    id: "opponent-coral",
    slots: [
      { id: "foreign", cardId: "lionfish", controller: "player", invasiveOwner: "player" },
      { id: "host-owned", cardId: "lionfish", controller: "opponent", invasiveOwner: "opponent" },
      { id: "ordinary", cardId: "lionfish" },
      { id: "conflict", cardId: "lionfish", controller: "player", invasiveOwner: "opponent" },
    ],
  }];

  const result = collectHostTurnLionfishInvaders({
    foundations,
    hostController: "opponent",
  });
  assert.deepEqual(result.map((entry) => [entry.slotId, entry.controller]), [["foreign", "player"]]);
  assert.deepEqual(collectHostTurnLionfishInvaders({ foundations, hostController: "spectator" }), []);
});

test("Invader coin and branch controller mapping are deterministic", () => {
  let calls = 0;
  assert.equal(resolveLionfishInvaderCoin(() => { calls += 1; return 0.499; }), "heads");
  assert.equal(resolveLionfishInvaderCoin(() => { calls += 1; return 0.5; }), "tails");
  assert.equal(calls, 2);

  for (const invaderController of ["player", "opponent"]) {
    const rival = invaderController === "player" ? "opponent" : "player";
    assert.equal(getLionfishInvaderTargetController({ invaderController, coinResult: "heads" }), rival);
    assert.equal(getLionfishInvaderTargetController({ invaderController, coinResult: "tails" }), invaderController);
  }
  assert.equal(getLionfishInvaderTargetController({ invaderController: "spectator", coinResult: "heads" }), null);
  assert.equal(getLionfishInvaderTargetController({ invaderController: "player", coinResult: "edge" }), null);
});

test("planning flips first, keeps stable controller-aware Fish candidates, and excludes the source", () => {
  const order = [];
  const invader = { instanceId: "lionfish-source", controller: "player" };
  const targets = [
    { instanceId: "rival-hidden", cardId: "viperfish", controller: "opponent", category: "fish", hiddenByAbyss: true },
    { instanceId: "rival-fish-a", cardId: "frogfish", controller: "opponent", category: "fish" },
    { instanceId: "lionfish-source", cardId: "lionfish", controller: "player", category: "fish" },
    { instanceId: "owner-fish", cardId: "porcupine-fish", controller: "player", category: "fish" },
    { instanceId: "rival-predator", cardId: "goliath-grouper", controller: "opponent", category: "predator" },
    { instanceId: "rival-fish-a", cardId: "duplicate", controller: "opponent", category: "fish" },
    { instanceId: "rival-school", cardId: "sardine-ball-base", controller: "opponent", category: "foundation", targetableAsFish: true },
  ];
  const plan = planLionfishInvaderTrigger({
    invader,
    targets,
    random: () => { order.push("coin"); return 0.1; },
    isLegalFishTarget: (target) => {
      order.push(target.instanceId);
      return (target.category === "fish" || target.targetableAsFish) && !target.hiddenByAbyss;
    },
  });

  assert.equal(order[0], "coin", "the branch is chosen before legal targets are evaluated");
  assert.equal(plan.coinResult, "heads");
  assert.equal(plan.targetController, "opponent");
  assert.deepEqual(plan.candidates.map((target) => target.instanceId), ["rival-fish-a", "rival-school"]);
  assert.equal(plan.noLegalTarget, false);
});

test("tails targets only the Invader owner's Fish and never includes the source", () => {
  const plan = planLionfishInvaderTrigger({
    invader: { instanceId: "lionfish-source", controller: "opponent" },
    targets: [
      { instanceId: "player-fish", controller: "player", category: "fish" },
      { instanceId: "lionfish-source", controller: "opponent", category: "fish" },
      { instanceId: "opponent-fish-a", controller: "opponent", category: "fish" },
      { instanceId: "opponent-fish-b", controller: "opponent", category: "fish" },
    ],
    random: () => 0.9,
  });

  assert.equal(plan.coinResult, "tails");
  assert.equal(plan.targetController, "opponent");
  assert.deepEqual(plan.candidates.map((target) => target.instanceId), ["opponent-fish-a", "opponent-fish-b"]);
});

test("a selected branch with no legal target does not fall back or consume combat rolls", () => {
  let coinCalls = 0;
  let attackCalls = 0;
  let defenseCalls = 0;
  const plan = planLionfishInvaderTrigger({
    invader: { instanceId: "lionfish-source", controller: "player" },
    targets: [{ instanceId: "owner-fish", controller: "player", category: "fish" }],
    random: () => { coinCalls += 1; return 0.1; },
  });

  assert.equal(plan.coinResult, "heads");
  assert.equal(plan.targetController, "opponent");
  assert.deepEqual(plan.candidates, []);
  assert.equal(plan.noLegalTarget, true);

  const roll = resolveLionfishInvaderOpposedRoll({
    target: null,
    candidates: plan.candidates,
    defenseDice: "D4",
    attackRandom: () => { attackCalls += 1; return 0.9; },
    defenseRandom: () => { defenseCalls += 1; return 0.1; },
  });
  assert.deepEqual(roll, { resolved: false, attack: null, defense: null, attackerWins: false });
  assert.equal(coinCalls, 1);
  assert.equal(attackCalls, 0);
  assert.equal(defenseCalls, 0);
});

test("candidate filtering preserves first occurrence and supports normal legality callbacks", () => {
  const candidates = getLionfishInvaderTargetCandidates({
    targetController: "player",
    sourceInstanceId: "source",
    targets: [
      { instanceId: "source", controller: "player", category: "fish" },
      { instanceId: "fish-a", controller: "player", category: "fish", hiddenByAbyss: true },
      { instanceId: "fish-a", controller: "player", category: "fish" },
      { instanceId: "school", controller: "player", targetableAsFish: true },
      { instanceId: "rival", controller: "opponent", category: "fish" },
    ],
    isLegalFishTarget: (target) => (target.category === "fish" || target.targetableAsFish) && !target.hiddenByAbyss,
  });
  assert.deepEqual(candidates.map((target) => target.instanceId), ["school"], "the first stable fish-a entry remains authoritative even when hidden");
});

test("target selection excludes the source, deduplicates, scores once, and keeps ties stable", () => {
  const source = { instanceId: "source", value: 100 };
  const first = { instanceId: "first", value: 3 };
  const second = { instanceId: "second", value: 8 };
  const tied = { instanceId: "tied", value: 8 };
  const scoreCalls = [];

  assert.equal(selectLionfishInvaderTarget([source, first, first, second], { sourceInstanceId: "source" }), first);
  assert.equal(selectLionfishInvaderTarget([], { sourceInstanceId: "source" }), null);
  assert.equal(selectLionfishInvaderTarget(
    [source, first, second, tied],
    {
      sourceInstanceId: "source",
      scoreTarget: (target) => { scoreCalls.push(target.instanceId); return target.value; },
    },
  ), second);
  assert.deepEqual(scoreCalls, ["first", "second", "tied"]);
});

test("D4-1 Invader combat uses distinct attack and defense rolls and defender wins ties", () => {
  assert.equal(LIONFISH_INVADER_ATTACK_DICE, "D4-1");
  const target = { instanceId: "target" };
  let attackCalls = 0;
  let defenseCalls = 0;
  const success = resolveLionfishInvaderOpposedRoll({
    target,
    candidates: [target],
    defenseDice: "D4",
    attackRandom: () => { attackCalls += 1; return 0.999; },
    defenseRandom: () => { defenseCalls += 1; return 0; },
  });
  assert.equal(success.attack.expression, "D4-1");
  assert.equal(success.attack.natural, 4);
  assert.equal(success.attack.total, 3);
  assert.equal(success.defense.total, 1);
  assert.equal(success.attackerWins, true);
  assert.equal(attackCalls, 1);
  assert.equal(defenseCalls, 1);

  const tie = resolveLionfishInvaderOpposedRoll({
    target,
    candidates: [target],
    defenseDice: "D4",
    attackRandom: () => 0.49,
    defenseRandom: () => 0,
  });
  assert.equal(tie.attack.total, 1);
  assert.equal(tie.defense.total, 1);
  assert.equal(tie.attackerWins, false);
});

test("multiple Invaders consume independent coins without sharing a branch result", () => {
  const outcomes = [0.1, 0.9];
  const invaders = [
    { instanceId: "lionfish-a", controller: "player" },
    { instanceId: "lionfish-b", controller: "player" },
  ];
  const targets = [
    { instanceId: "rival-fish", controller: "opponent", category: "fish" },
    { instanceId: "owner-fish", controller: "player", category: "fish" },
  ];
  const plans = invaders.map((invader) => planLionfishInvaderTrigger({
    invader,
    targets,
    random: () => outcomes.shift(),
  }));

  assert.deepEqual(plans.map((plan) => plan.coinResult), ["heads", "tails"]);
  assert.deepEqual(plans.map((plan) => plan.candidates[0].instanceId), ["rival-fish", "owner-fish"]);
  assert.deepEqual(outcomes, []);
});

test("an invalid Invader cannot consume a coin or produce candidates", () => {
  let calls = 0;
  assert.deepEqual(planLionfishInvaderTrigger({
    invader: { controller: "player" },
    targets: [{ instanceId: "fish", controller: "opponent", category: "fish" }],
    random: () => { calls += 1; return 0; },
  }), {
    resolved: false,
    coinResult: null,
    targetController: null,
    candidates: [],
    noLegalTarget: true,
  });
  assert.equal(calls, 0);

  const invalidController = planLionfishInvaderTrigger({
    invader: { instanceId: "lionfish", controller: "spectator" },
    targets: [],
    random: () => { calls += 1; return 0; },
  });
  assert.equal(invalidController.resolved, false);
  assert.equal(invalidController.coinResult, null);
  assert.equal(calls, 0);
});
