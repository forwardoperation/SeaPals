import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applyDamage, reconcileContinuousHealth } from "./gameRules.mjs";
import { resolveDestructionRecoveryWaves } from "./zoneRules.mjs";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = simulatorSource.indexOf(startMarker);
  const end = simulatorSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return simulatorSource.slice(start, end).trim();
}

function loadFoundationHealthReconcilers() {
  const source = sourceBetween(
    "function reconcileGlobalCoralHealth",
    "function getFragmentRecoveryEffect",
  );
  return Function(
    "cardsById",
    "CardKind",
    "getGlobalCoralHealthBonus",
    "isCreatureSchool",
    "calculateAttachedHostHealthBonus",
    "reconcileContinuousHealth",
    "redistributeOrphanCreatures",
    "getOrphanEntriesFromFoundation",
    `"use strict"; ${source}; return { reconcileGlobalCoralHealth, reconcileFoundationHealthToFixedPoint };`,
  );
}

const schoolCard = Object.freeze({
  id: "test-school",
  kind: "creature",
  health: 40,
  tags: ["creature-school"],
});

function createSchool(instanceId, health = schoolCard.health) {
  return {
    id: instanceId,
    cardId: schoolCard.id,
    health,
    maxHealth: schoolCard.health,
    slots: [],
  };
}

function loadOpponentProjection() {
  const { reconcileFoundationHealthToFixedPoint } = loadFoundationHealthReconcilers()(
    { [schoolCard.id]: schoolCard },
    { CORAL: "coral" },
    () => 0,
    (card) => card?.tags?.includes("creature-school"),
    () => 0,
    reconcileContinuousHealth,
    (foundations, orphans) => ({ corals: foundations, orphans }),
    () => [],
  );
  const projectionSource = sourceBetween(
    "function projectNormalizedOpponentState",
    "function normalizeProjectedOpponentState",
  );
  return Function(
    "reconcileFoundationHealthToFixedPoint",
    "activeCondition",
    "getEcosystemRpCap",
    "resolveFoundationDestructionTriggers",
    `"use strict"; ${projectionSource}; return projectNormalizedOpponentState;`,
  )(
    reconcileFoundationHealthToFixedPoint,
    null,
    () => 8,
    (destructionWaves, hand, discardPile, handLimit) => resolveDestructionRecoveryWaves(
      destructionWaves,
      hand,
      discardPile,
      handLimit,
      () => null,
    ),
  );
}

function createOpponentState(corals, discardPile = ["existing-discard"]) {
  return {
    corals,
    habitats: [],
    habitatInstances: [],
    reefCreatures: [],
    reefCreatureInstances: [],
    orphanCreatures: [],
    hand: [],
    discardPile,
    rp: 0,
  };
}

function applySchoolDamage(opponentState, instanceId, amount) {
  const target = opponentState.corals.find((foundation) => foundation.id === instanceId);
  assert.ok(target, `missing Creature School instance: ${instanceId}`);
  const damage = applyDamage(target.health ?? target.maxHealth, amount);
  return {
    damage,
    state: {
      ...opponentState,
      corals: opponentState.corals.map((foundation) => foundation.id === instanceId
        ? { ...foundation, health: damage.remainingHealth }
        : foundation),
    },
  };
}

test("the opponent projection discards a Creature School after lethal or overkill damage", () => {
  const projectOpponent = loadOpponentProjection();

  for (const amount of [40, 70]) {
    const damaged = applySchoolDamage(
      createOpponentState([createSchool(`opponent-school-${amount}`)]),
      `opponent-school-${amount}`,
      amount,
    );
    const projected = projectOpponent(damaged.state);

    assert.equal(damaged.damage.destroyed, true);
    assert.deepEqual(projected.state.corals, []);
    assert.deepEqual(projected.state.discardPile, [schoolCard.id, "existing-discard"]);
    assert.deepEqual(projected.collateral?.destroyed, [{
      id: `opponent-school-${amount}`,
      cardId: schoolCard.id,
    }]);
  }
});

test("the opponent projection preserves a nonlethally damaged Creature School", () => {
  const projectOpponent = loadOpponentProjection();
  const school = createSchool("opponent-school-nonlethal");
  const damaged = applySchoolDamage(createOpponentState([school]), school.id, 30);
  const projected = projectOpponent(damaged.state);

  assert.equal(damaged.damage.destroyed, false);
  assert.equal(damaged.damage.remainingHealth, 10);
  assert.equal(projected.state.corals.length, 1);
  assert.equal(projected.state.corals[0].id, school.id);
  assert.equal(projected.state.corals[0].health, 10);
  assert.deepEqual(projected.state.discardPile, ["existing-discard"]);
  assert.equal(projected.collateral, null);
});

test("lethal damage removes only the targeted duplicate school instance and discards it exactly once", () => {
  const projectOpponent = loadOpponentProjection();
  const defeated = createSchool("opponent-school-defeated");
  const survivor = createSchool("opponent-school-survivor");
  const damaged = applySchoolDamage(
    createOpponentState([defeated, survivor]),
    defeated.id,
    defeated.health,
  );
  const firstProjection = projectOpponent(damaged.state);
  const secondProjection = projectOpponent(firstProjection.state);

  assert.deepEqual(firstProjection.state.corals.map((foundation) => foundation.id), [survivor.id]);
  assert.equal(firstProjection.state.corals[0].health, schoolCard.health);
  assert.deepEqual(firstProjection.state.discardPile, [schoolCard.id, "existing-discard"]);
  assert.equal(firstProjection.state.discardPile.filter((cardId) => cardId === schoolCard.id).length, 1);
  assert.deepEqual(secondProjection.state.corals.map((foundation) => foundation.id), [survivor.id]);
  assert.deepEqual(secondProjection.state.discardPile, firstProjection.state.discardPile);
  assert.strictEqual(secondProjection.state, firstProjection.state);
  assert.equal(secondProjection.collateral, null);
});
