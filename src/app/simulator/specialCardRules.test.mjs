import test from "node:test";
import assert from "node:assert/strict";
import {
  canSpearfishReefCard,
  clearStunnedFromFoundationsAtControllerTurnEnd,
  coralCanUseOwnAbilities,
  coralIsStunned,
  createStunnedStatus,
  getInvasiveCreatureTargets,
  getInvasiveOrphanTargets,
  getLocallyControlledOrphans,
  getReefCardOwner,
  placeInvasiveCreature,
  removeInvasiveCreature,
  removeInvasiveOrphan,
  resolveEnsnareForAttack,
  resolveParasiteCollection,
  resolveSpearfishingInvaderRemoval,
  resolveStunnedAtControllerTurnBoundary,
} from "./specialCardRules.mjs";

test("reef location controls Spearfishing eligibility while invasive ownership controls discard routing", () => {
  assert.equal(getReefCardOwner({ cardId: "blue-crab" }, "player"), "player");
  assert.equal(getReefCardOwner({ cardId: "lionfish", controller: "opponent", invasiveOwner: "opponent" }, "player"), "opponent");
  assert.equal(getReefCardOwner({ cardId: "lionfish", controller: "player", invasiveOwner: "player" }, "opponent"), "player");
  assert.equal(canSpearfishReefCard({ cardId: "lionfish", controller: "opponent", invasiveOwner: "opponent" }, "player", ["lionfish"]), true);
  assert.equal(canSpearfishReefCard({ cardId: "blue-crab", controller: "opponent", invasiveOwner: "opponent" }, "player", ["lionfish"]), false);
});

test("Spearfishing removes slotted and orphaned Lionfish in both ownership directions", () => {
  for (const actor of ["player", "opponent"]) {
    const invader = actor === "player" ? "opponent" : "player";
    const placed = placeInvasiveCreature([{
      id: `${actor}-coral`,
      slots: [{ id: `${actor}-slot`, cardId: null }],
    }], {
      coralId: `${actor}-coral`,
      slotId: `${actor}-slot`,
      cardId: "lionfish",
      cardInstanceId: `${invader}-lionfish-slot`,
      controller: invader,
    }).foundations;

    const slotted = resolveSpearfishingInvaderRemoval({
      foundations: placed,
      orphanEntries: [],
      target: { location: "slot", coralId: `${actor}-coral`, slotId: `${actor}-slot`, cardId: "lionfish" },
      invaderController: invader,
      eligibleCardIds: ["lionfish"],
      actorDiscardPile: ["actor-old"],
      invaderDiscardPile: ["owner-old"],
      actorRp: 2,
      actorRpCap: 5,
      supportCost: 1,
      recoveredRp: 4,
    });
    assert.equal(slotted.success, true);
    assert.equal(slotted.foundations[0].slots[0].cardId, null);
    assert.deepEqual(slotted.actorDiscardPile, ["spearfishing", "actor-old"]);
    assert.deepEqual(slotted.invaderDiscardPile, ["lionfish", "owner-old"]);
    assert.equal(slotted.actorRp, 5, "RP recovery respects the acting player's bank cap");

    const orphaned = resolveSpearfishingInvaderRemoval({
      foundations: [{ id: `${actor}-coral`, slots: [] }],
      orphanEntries: [{ cardId: "lionfish", instanceId: `${invader}-lionfish-orphan`, controller: invader, invasiveOwner: invader, hostedCardIds: [] }],
      target: { location: "orphan", instanceId: `${invader}-lionfish-orphan`, cardId: "lionfish" },
      invaderController: invader,
      eligibleCardIds: ["lionfish"],
      actorDiscardPile: [],
      invaderDiscardPile: [],
      actorRp: 0,
      actorRpCap: 8,
      recoveredRp: 4,
    });
    assert.equal(orphaned.success, true);
    assert.deepEqual(orphaned.orphanEntries, []);
    assert.deepEqual(orphaned.actorDiscardPile, ["spearfishing"]);
    assert.deepEqual(orphaned.invaderDiscardPile, ["lionfish"]);
    assert.equal(orphaned.actorRp, 4);
  }
});

test("Stunned remains visible until the affected controller ends their next turn", () => {
  const coral = {
    id: "coral-a",
    statuses: [{ type: "bleached" }, createStunnedStatus("crown-of-thorns")],
  };
  assert.equal(coralIsStunned(coral), true);

  const result = clearStunnedFromFoundationsAtControllerTurnEnd([coral, { id: "coral-b", statuses: [] }]);
  assert.deepEqual(result.recoveredFoundationIds, ["coral-a"]);
  assert.deepEqual(result.foundations[0].statuses, [{ type: "bleached" }], "unrelated effects survive Stunned expiry");
  assert.equal(coralIsStunned(result.foundations[0]), false);
});

test("Stunned disables a Coral's own abilities and only expires after a completed controller turn", () => {
  const coral = { id: "coral-a", statuses: [createStunnedStatus("crown-of-thorns")] };
  assert.equal(coralCanUseOwnAbilities(coral), false);

  const paused = resolveStunnedAtControllerTurnBoundary([coral], { turnComplete: false });
  assert.equal(coralIsStunned(paused.foundations[0]), true, "a pending Regenerate choice does not end the controller's turn");
  assert.deepEqual(paused.recoveredFoundationIds, []);

  const completed = resolveStunnedAtControllerTurnBoundary(paused.foundations, { turnComplete: true });
  assert.equal(coralIsStunned(completed.foundations[0]), false);
  assert.deepEqual(completed.recoveredFoundationIds, ["coral-a"]);
});

test("Parasite transfers opposing RP first and fills its shortfall from supply", () => {
  assert.deepEqual(resolveParasiteCollection({
    requested: 4,
    opposingRp: 1,
    recipientRp: 2,
    recipientCap: 8,
  }), {
    requested: 4,
    transferred: 1,
    transferredFromOpponent: 1,
    collectedFromSupply: 3,
    collected: 4,
    uncollected: 0,
    sourceAfter: 0,
    recipientAfter: 6,
  });
});

test("Parasite never overfills the receiving RP bank", () => {
  const result = resolveParasiteCollection({ requested: 5, opposingRp: 4, recipientRp: 7, recipientCap: 8 });
  assert.equal(result.transferredFromOpponent, 1);
  assert.equal(result.collectedFromSupply, 0);
  assert.equal(result.uncollected, 4);
  assert.equal(result.sourceAfter, 3, "RP that cannot fit is not taken from the opponent");
  assert.equal(result.recipientAfter, 8);
});

test("Ensnare performs an independent flip for each repeated attack", () => {
  const outcomes = [0.2, 0.8, 0.1];
  const random = () => outcomes.shift();
  const attack = { attackDice: "D8", repeatAttacks: 3, ensnare: { penalty: 3 } };
  const resolutions = [0, 1, 2].map(() => resolveEnsnareForAttack(attack, random));

  assert.deepEqual(resolutions.map((result) => result.coinResult), ["heads", "tails", "heads"]);
  assert.deepEqual(resolutions.map((result) => result.attack.ensnarePenalty ?? 0), [3, 0, 3]);
  assert.equal(attack.ensnarePenalty, undefined, "one attack's result does not leak into the next attack");
});

test("Lionfish invasion placement and attack removal preserve controller identity", () => {
  const reef = [{
    id: "coral-a",
    slots: [{ id: "slot-a", cardId: null }, { id: "slot-b", cardId: "blue-crab" }],
  }];
  for (const controller of ["player", "opponent"]) {
    const otherController = controller === "player" ? "opponent" : "player";
    const placed = placeInvasiveCreature(reef, {
      coralId: "coral-a",
      slotId: "slot-a",
      cardId: "lionfish",
      cardInstanceId: `${controller}-lionfish-1`,
      controller,
    });
    assert.equal(placed.placed, true);
    assert.deepEqual(getInvasiveCreatureTargets(placed.foundations, controller), [{
      coralId: "coral-a",
      slotId: "slot-a",
      cardId: "lionfish",
      instanceId: `${controller}-lionfish-1`,
    }]);
    assert.deepEqual(getInvasiveCreatureTargets(placed.foundations, otherController), []);

    const removed = removeInvasiveCreature(placed.foundations, {
      coralId: "coral-a",
      slotId: "slot-a",
      controller,
    });
    assert.equal(removed.removedCardId, "lionfish");
    assert.equal(removed.foundations[0].slots[0].cardId, null);
    assert.equal(removed.foundations[0].slots[1].cardId, "blue-crab");
  }
});

test("foreign invasive orphans retain original indexes, stay unusable by the host, and remain owner-removable", () => {
  const orphans = [
    { cardId: "blue-crab", instanceId: "local-1", hostedCardIds: [] },
    { cardId: "lionfish", instanceId: "lionfish-9", controller: "opponent", invasiveOwner: "opponent", hostedCardIds: [] },
    { cardId: "sea-urchin", instanceId: "local-2", hostedCardIds: [] },
  ];

  assert.deepEqual(getInvasiveOrphanTargets(orphans, "opponent"), [{
    orphanIndex: 1,
    cardId: "lionfish",
    instanceId: "lionfish-9",
  }]);
  assert.deepEqual(getLocallyControlledOrphans(orphans, "player").map((entry) => entry.cardId), ["blue-crab", "sea-urchin"]);
  assert.deepEqual(removeInvasiveOrphan(orphans, { instanceId: "lionfish-9", controller: "player" }), {
    orphans,
    removedCardId: null,
  });
  const removed = removeInvasiveOrphan(orphans, { instanceId: "lionfish-9", controller: "opponent" });
  assert.equal(removed.removedCardId, "lionfish");
  assert.deepEqual(removed.orphans.map((entry) => entry.cardId), ["blue-crab", "sea-urchin"]);
});
