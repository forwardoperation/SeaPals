import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});

const { allCards } = jiti(path.join(projectRoot, "src/data/cards/index.js"));
const {
  CardKind,
  CreatureClass,
  CreatureZone,
  getAcceptedClassesForSlot,
} = jiti(path.join(projectRoot, "src/data/cards/types.js"));

// These totals were audited against every available Coral card face. Pillar Coral
// and the two Lettuce Coral cards currently use placeholder art, so this manifest
// records their existing game-design values until final card faces are available.
const auditedSlotInventory = {
  "elkhorn-coral-base": { "reef:fish": 1, "reef:invertebrate": 1 },
  "elkhorn-coral-stage-1": {
    "reef:fish": 1,
    "reef:invertebrate": 2,
    "reef:predator": 1,
  },
  "elkhorn-coral-stage-2": {
    "reef:apex": 1,
    "reef:invertebrate": 3,
    "reef:predator": 2,
  },
  "boulder-star-coral-base": { "reef:fish": 2, "reef:invertebrate": 2 },
  "boulder-star-coral-stage-1": {
    "reef:fish": 1,
    "reef:invertebrate": 3,
    "reef:predator": 2,
  },
  "boulder-star-coral-stage-2": {
    "reef:apex": 2,
    "reef:invertebrate": 3,
    "reef:predator": 2,
  },
  "pillar-coral-base": {
    "reef:fish": 1,
    "reef:invertebrate": 2,
    "reef:predator": 1,
  },
  "brain-coral-base": { "reef:fish": 1, "reef:invertebrate": 1 },
  "brain-coral-stage-1": {
    "reef:fish": 1,
    "reef:invertebrate": 2,
    "reef:predator": 1,
  },
  "brain-coral-stage-2": {
    "reef:apex": 1,
    "reef:invertebrate": 3,
    "reef:predator": 2,
  },
  "lettuce-coral-base": { "reef:fish": 1, "reef:invertebrate": 1 },
  "lettuce-coral-stage-1": {
    "reef:fish": 1,
    "reef:invertebrate": 1,
    "reef:predator": 1,
  },
  "staghorn-coral-base": { "reef:fish": 1, "reef:invertebrate": 1 },
  "clubfinger-coral-base": { "reef:fish": 1, "reef:invertebrate": 1 },
  "clubfinger-coral-stage-1": {
    "reef:fish": 3,
    "reef:invertebrate": 3,
  },
  "mustard-hill-coral-base": { "reef:fish": 1, "reef:invertebrate": 1 },
  bamboo_coral_base: { "deep:fish": 1, "deep:invertebrate": 1 },
  bamboo_coral_stage1: {
    "deep:fish": 1,
    "deep:invertebrate": 2,
    "deep:predator": 1,
  },
  bamboo_coral_stage2: {
    "deep:apex": 1,
    "deep:invertebrate": 3,
    "deep:predator": 2,
  },
  black_coral_base: { "deep:fish": 1, "deep:invertebrate": 1 },
  black_coral_stage1: {
    "deep:fish": 1,
    "deep:invertebrate": 2,
    "deep:predator": 1,
  },
  black_coral_stage2: {
    "deep:apex": 1,
    "deep:fish": 1,
    "deep:invertebrate": 3,
    "deep:predator": 1,
  },
  deep_mushroom_base: { "deep:fish": 1, "deep:invertebrate": 1 },
  deep_mushroom_stage1: {
    "deep:invertebrate": 2,
    "deep:predator": 2,
  },
  deep_mushroom_stage2: {
    "deep:apex": 2,
    "deep:invertebrate": 3,
    "deep:predator": 1,
  },
  deep_sea_vent: {
    "deep:fish": 1,
    "deep:invertebrate": 2,
    "deep:predator": 1,
  },
};

function getSlotInventory(card) {
  const inventory = {};

  for (const slot of card.slots ?? []) {
    const key = `${slot.zone}:${slot.slotClass}`;
    inventory[key] = (inventory[key] ?? 0) + (slot.count ?? 1);
  }

  return Object.fromEntries(
    Object.entries(inventory).sort(([left], [right]) => left.localeCompare(right)),
  );
}

test("every Coral matches the audited printed slot inventory", () => {
  const corals = allCards.filter((card) => card.kind === CardKind.CORAL);

  assert.deepEqual(
    corals.map((card) => card.id).sort(),
    Object.keys(auditedSlotInventory).sort(),
    "New or removed Corals must be reflected in the audited slot manifest",
  );

  for (const card of corals) {
    assert.deepEqual(
      getSlotInventory(card),
      auditedSlotInventory[card.id],
      `${card.name} (${card.id}) must match its printed slot icons`,
    );
  }
});

test("every Coral slot has valid count and acceptance metadata", () => {
  const validZones = new Set([CreatureZone.REEF, CreatureZone.DEEP]);
  const validClasses = new Set(Object.values(CreatureClass));
  const corals = allCards.filter((card) => card.kind === CardKind.CORAL);

  for (const card of corals) {
    const expectedZone = card.zone ?? CreatureZone.REEF;

    for (const slot of card.slots ?? []) {
      assert.ok(validZones.has(slot.zone), `${card.id} has invalid slot zone ${slot.zone}`);
      assert.equal(slot.zone, expectedZone, `${card.id} has a slot in the wrong ecosystem`);
      assert.ok(
        validClasses.has(slot.slotClass),
        `${card.id} has invalid slot class ${slot.slotClass}`,
      );
      assert.ok(
        Number.isInteger(slot.count) && slot.count > 0,
        `${card.id} slot counts must be positive integers`,
      );
      assert.deepEqual(
        slot.accepts,
        getAcceptedClassesForSlot(slot.slotClass),
        `${card.id} ${slot.slotClass} slot has stale acceptance rules`,
      );
    }
  }
});
