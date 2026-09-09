import test from "node:test";
import assert from "node:assert/strict";
import {
  createSimulatorAnalyticsSnapshot,
  getSimulatorAnalyticsSnapshotDelta,
} from "./simulatorAnalyticsSnapshot.mjs";

const cards = {
  coral: { kind: "coral" },
  upgradedCoral: { kind: "coral" },
  school: { kind: "creature", tags: ["creature-school"] },
  habitat: { kind: "habitat" },
};
const foundation = (id, cardId, health = 60, maxHealth = 60, statuses = []) => ({ id, cardId, health, maxHealth, statuses });
const snapshot = (foundations = [], fields = {}) => ({ foundations, rp: 3, ecoBoost: 0, schoolDensity: 0, vp: 0, ...fields });
const diff = (before, after) => getSimulatorAnalyticsSnapshotDelta(before, after, cards);

test("RP spending and receipts cannot be inferred from a bank snapshot", () => {
  const delta = diff(snapshot([], { rp: 2 }), snapshot([], { rp: 8 }));
  assert.equal(Object.hasOwn(delta, "rpCollected"), false);
  assert.equal(Object.values(delta).reduce((sum, value) => sum + value, 0), 0);
});

test("capacity gains use only the positive change and ignore a missing baseline", () => {
  const before = snapshot([], { ecoBoost: 2, schoolDensity: 20 });
  const after = snapshot([], { ecoBoost: 5, schoolDensity: 60 });
  assert.equal(diff(before, after).ecoBoostGained, 3);
  assert.equal(diff(before, after).schoolDensityGained, 40);
  assert.equal(diff(after, before).ecoBoostGained, 0);
  assert.equal(diff(after, before).schoolDensityGained, 0);
  assert.equal(Object.values(diff(null, after)).reduce((sum, value) => sum + value, 0), 0);
});

test("damage distinguishes corals from schools and excludes habitat damage", () => {
  const before = snapshot([foundation("a", "coral"), foundation("b", "school"), foundation("c", "habitat")]);
  const after = snapshot([foundation("a", "coral", 40), foundation("b", "school", 30), foundation("c", "habitat", 20)]);
  assert.equal(diff(before, after).coralDamage, 20);
  assert.equal(diff(before, after).schoolDamage, 30);
  assert.deepEqual(getSimulatorAnalyticsSnapshotDelta(before, after, (id) => cards[id]), diff(before, after));
});

test("upgrades and continuous HP modifiers preserve existing damage", () => {
  const before = snapshot([foundation("a", "coral", 40, 60)]);
  const afterUpgrade = snapshot([foundation("a", "upgradedCoral", 80, 100)]);
  const afterBonusLoss = snapshot([foundation("a", "coral", 20, 40)]);
  assert.equal(diff(before, afterUpgrade).coralDamage, 0);
  assert.equal(diff(before, afterBonusLoss).coralDamage, 0);
  assert.equal(diff(before, snapshot([foundation("a", "upgradedCoral", 70, 100)])).coralDamage, 10);
});

test("Neural Network transfers do not inflate newly incurred damage", () => {
  const before = snapshot([foundation("a", "coral", 40), foundation("b", "coral")]);
  const after = snapshot([foundation("a", "coral", 50), foundation("b", "coral", 50)]);
  assert.equal(diff(before, after).coralDamage, 0);
});

test("removed and new instances do not invent destruction or play damage", () => {
  const before = snapshot([foundation("removed", "coral", 10), foundation("survivor", "coral")]);
  const after = snapshot([foundation("new", "coral", 20), foundation("survivor", "coral", 50)]);
  assert.equal(diff(before, after).coralDamage, 10);
});

test("simultaneous healing offsets observed damage only within the same kind", () => {
  const before = snapshot([foundation("a", "coral", 40), foundation("b", "coral"), foundation("c", "school")]);
  const after = snapshot([foundation("a", "coral", 50), foundation("b", "coral", 40), foundation("c", "school", 40)]);
  assert.equal(diff(before, after).coralDamage, 10, "snapshot coverage is net damage on surviving corals");
  assert.equal(diff(before, after).schoolDamage, 20);
});

test("Stunned counts coral transitions once and excludes reapplication and schools", () => {
  const stunned = [{ type: "stunned" }];
  const before = snapshot([foundation("a", "coral"), foundation("b", "coral", 60, 60, stunned), foundation("c", "school")]);
  const after = snapshot([foundation("a", "coral", 60, 60, stunned), foundation("b", "coral", 60, 60, stunned), foundation("c", "school", 60, 60, stunned)]);
  assert.equal(diff(before, after).stunsApplied, 1);
  assert.equal(diff(after, after).stunsApplied, 0);
  assert.equal(diff(after, before).stunsApplied, 0);
});

test("snapshot copying keeps an immutable baseline and only anonymous summary fields", () => {
  const source = snapshot([foundation("a", "coral", 40, 60, [{ type: "stunned", sourceCardId: "source" }])], { playerName: "Not part of analytics", rp: NaN, ecoBoost: Infinity });
  const copied = createSimulatorAnalyticsSnapshot(source);
  source.foundations[0].health = 10;
  source.foundations[0].statuses[0].type = "different";
  assert.equal(copied.foundations[0].health, 40);
  assert.deepEqual(copied.foundations[0].statuses, [{ type: "stunned" }]);
  assert.equal(copied.rp, 0);
  assert.equal(copied.ecoBoost, 0);
  assert.equal(Object.hasOwn(copied, "playerName"), false);
});

test("missing health means full health and unknown cards do not become corals", () => {
  const before = snapshot([foundation("a", "coral", null), foundation("b", "unknown")]);
  const after = snapshot([foundation("a", "coral", 50), foundation("b", "unknown", 10)]);
  assert.equal(diff(before, after).coralDamage, 10);
});
