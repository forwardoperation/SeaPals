import test from "node:test";
import assert from "node:assert/strict";
import {
  addHabitatInstance,
  createHabitatInstance,
  damageHabitatInstance,
  evaluateCoralReefComposition,
  getHabitatRequirementError,
  removeHabitatInstance,
  resolveEndOfTurnHabitatMaintenance,
} from "./habitatRules.mjs";

const cards = {
  "coral-reef": {
    id: "coral-reef",
    kind: "habitat",
    health: 40,
    maintenance: { timing: "endOfTurn", damage: 10, whileRequirementUnmet: true },
  },
  "rock-arch": { id: "rock-arch", kind: "habitat" },
  coral: { id: "coral", kind: "coral", category: "coral" },
  school: { id: "school", kind: "creature", class: "coral", category: "coral" },
  "fish-school": { id: "fish-school", kind: "creature", category: "fish", tags: ["creature-school"] },
  "invert-school": { id: "invert-school", kind: "creature", category: "invertebrate", tags: ["creature-school"] },
  fish: { id: "fish", kind: "creature", category: "fish" },
  invert: { id: "invert", kind: "creature", class: "invertebrate" },
};

test("creates a Coral Reef with its printed 40 health", () => {
  assert.deepEqual(createHabitatInstance("coral-reef", "habitat-17", cards), {
    instanceId: "habitat-17",
    cardId: "coral-reef",
    currentHealth: 40,
    maxHealth: 40,
  });
  assert.throws(() => createHabitatInstance("coral-reef", "", cards), /instanceId/);
});

test("add and remove helpers preserve duplicate Habitat copies", () => {
  const first = createHabitatInstance("coral-reef", "reef-a", cards);
  const second = createHabitatInstance("coral-reef", "reef-b", cards);
  const habitats = addHabitatInstance(addHabitatInstance([], first), second);
  assert.deepEqual(habitats.map(({ instanceId, cardId }) => ({ instanceId, cardId })), [
    { instanceId: "reef-a", cardId: "coral-reef" },
    { instanceId: "reef-b", cardId: "coral-reef" },
  ]);

  const result = removeHabitatInstance(habitats, "reef-a");
  assert.equal(result.removed.instanceId, "reef-a");
  assert.deepEqual(result.habitats.map((habitat) => habitat.instanceId), ["reef-b"]);
  assert.deepEqual(habitats.map((habitat) => habitat.instanceId), ["reef-a", "reef-b"]);
  assert.throws(() => addHabitatInstance(habitats, first), /already in play/);
});

test("damage targets one Habitat instance rather than every copy of a card", () => {
  const habitats = [
    createHabitatInstance("coral-reef", "reef-a", cards),
    createHabitatInstance("coral-reef", "reef-b", cards),
  ];
  const result = damageHabitatInstance(habitats, "reef-b", 12);
  assert.equal(result.habitats[0].currentHealth, 40);
  assert.equal(result.habitats[1].currentHealth, 28);
  assert.equal(result.result.appliedDamage, 12);
});

test("alternative Habitat requirements accept either printed option without becoming Open Ocean only", () => {
  const openOceanOrCoralReef = [
    "Manta Ray",
    "Whale Shark",
    "Ocean Sunfish",
  ].map((name) => ({
    name,
    playRequirements: ["Requires Open Ocean or Coral Reef Habitat in your ecosystem."],
  }));
  openOceanOrCoralReef.forEach((card) => {
    assert.equal(getHabitatRequirementError(card, ["open-ocean"]), "", `${card.name} with Open Ocean`);
    assert.equal(getHabitatRequirementError(card, ["coral-reef"]), "", `${card.name} with Coral Reef`);
    assert.match(getHabitatRequirementError(card, []), /requires Open Ocean or Coral Reef/i, `${card.name} with no Habitat`);
    assert.match(getHabitatRequirementError(card, ["abyss"]), /requires Open Ocean or Coral Reef/i, `${card.name} with Abyss`);
  });

  const openOceanOrAbyss = ["Bluefin Tuna", "Swordfish"].map((name) => ({
    name,
    playRequirements: ["Requires Open Ocean or Abyss Habitat in your ecosystem."],
  }));
  openOceanOrAbyss.forEach((card) => {
    assert.equal(getHabitatRequirementError(card, ["open-ocean"]), "", `${card.name} with Open Ocean`);
    assert.equal(getHabitatRequirementError(card, ["abyss"]), "", `${card.name} with Abyss`);
    assert.match(getHabitatRequirementError(card, []), /requires Open Ocean or Abyss/i, `${card.name} with no Habitat`);
    assert.match(getHabitatRequirementError(card, ["coral-reef"]), /requires Open Ocean or Abyss/i, `${card.name} with Coral Reef`);
  });
});

test("strict Open Ocean requirements still reject other Habitats", () => {
  for (const name of ["Basking Shark", "Blue Whale"]) {
    const card = {
      name,
      playRequirements: ["Requires Open Ocean Habitat in your ecosystem."],
    };
    assert.equal(getHabitatRequirementError(card, ["open-ocean"]), "");
    assert.match(getHabitatRequirementError(card, ["coral-reef"]), /requires Open Ocean/i);
    assert.match(getHabitatRequirementError(card, ["abyss"]), /requires Open Ocean/i);
  }
});

test("Coral Reef requires four true Corals, two Fish, and two Invertebrates", () => {
  const valid = evaluateCoralReefComposition([
    "coral", "coral", "coral", "coral",
    "fish", "fish",
    "invert", "invert",
    "school",
  ], cards);
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.counts, { corals: 4, fish: 2, invertebrates: 2 });

  const invalid = evaluateCoralReefComposition([
    "coral", "coral", "coral", "school",
    "fish", "fish",
    "invert", "invert",
  ], cards);
  assert.equal(invalid.valid, false);
  assert.deepEqual(invalid.missing, { corals: 1, fish: 0, invertebrates: 0 });

  const schoolsDoNotSatisfyCreatureCounts = evaluateCoralReefComposition([
    "coral", "coral", "coral", "coral",
    "fish", "fish-school",
    "invert", "invert-school",
  ], cards);
  assert.equal(schoolsDoNotSatisfyCreatureCounts.valid, false);
  assert.deepEqual(schoolsDoNotSatisfyCreatureCounts.missing, { corals: 0, fish: 1, invertebrates: 1 });
});

test("end-turn maintenance damages each Coral Reef by 10 while composition is unmet", () => {
  const habitats = [
    createHabitatInstance("coral-reef", "reef-a", cards),
    { ...createHabitatInstance("coral-reef", "reef-b", cards), currentHealth: 10 },
    createHabitatInstance("rock-arch", "arch-a", cards),
  ];
  const result = resolveEndOfTurnHabitatMaintenance(habitats, {
    cardsInPlay: ["coral", "coral", "fish", "invert"],
    cardLookup: cards,
  });

  assert.deepEqual(result.events.map(({ instanceId, currentHealth, destroyed }) => ({ instanceId, currentHealth, destroyed })), [
    { instanceId: "reef-a", currentHealth: 30, destroyed: false },
    { instanceId: "reef-b", currentHealth: 0, destroyed: true },
  ]);
  assert.deepEqual(result.habitats.map(({ instanceId, currentHealth }) => ({ instanceId, currentHealth })), [
    { instanceId: "reef-a", currentHealth: 30 },
    { instanceId: "arch-a", currentHealth: 0 },
  ]);
  assert.deepEqual(result.destroyedHabitats.map((habitat) => habitat.instanceId), ["reef-b"]);
  assert.equal(habitats[0].currentHealth, 40);
});

test("end-turn maintenance does not damage Coral Reef while composition remains valid", () => {
  const habitat = createHabitatInstance("coral-reef", "reef-a", cards);
  const result = resolveEndOfTurnHabitatMaintenance([habitat], {
    cardsInPlay: ["coral", "coral", "coral", "coral", "fish", "fish", "invert", "invert"],
    cardLookup: cards,
  });
  assert.equal(result.habitats[0].currentHealth, 40);
  assert.deepEqual(result.events, []);
  assert.deepEqual(result.destroyedHabitats, []);
});
