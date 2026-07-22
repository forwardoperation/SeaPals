import test from "node:test";
import assert from "node:assert/strict";
import {
  addHabitatInstance,
  createHabitatInstance,
  damageHabitatInstance,
  evaluateCoralReefComposition,
  evaluateHabitatComposition,
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
  abyss: {
    id: "abyss",
    kind: "habitat",
    health: 40,
    maintenance: { timing: "endOfTurn", damage: 10, whileRequirementUnmet: true },
  },
  "open-ocean": {
    id: "open-ocean",
    kind: "habitat",
    health: 40,
    maintenance: { timing: "endOfTurn", damage: 10, whileRequirementUnmet: true },
  },
  "rock-arch": { id: "rock-arch", kind: "habitat" },
  coral: { id: "coral", kind: "coral", category: "coral", zone: "reef" },
  "deep-coral": { id: "deep-coral", kind: "coral", category: "coral", zone: "deep" },
  school: { id: "school", kind: "creature", class: "coral", category: "coral" },
  "fish-school": { id: "fish-school", kind: "creature", category: "fish", zone: "ocean", tags: ["creature-school"] },
  "invert-school": { id: "invert-school", kind: "creature", category: "invertebrate", zone: "ocean", tags: ["creature-school"] },
  fish: { id: "fish", kind: "creature", category: "fish", zone: "reef" },
  invert: { id: "invert", kind: "creature", class: "invertebrate", zone: "reef" },
  "deep-fish": { id: "deep-fish", kind: "creature", category: "fish", zone: "deep" },
  "deep-invert": { id: "deep-invert", kind: "creature", class: "invertebrate", zone: "deep" },
  "ocean-fish": { id: "ocean-fish", kind: "creature", category: "fish", zone: "ocean" },
  "ocean-invert": { id: "ocean-invert", kind: "creature", class: "invertebrate", zone: "ocean" },
  "ocean-predator": { id: "ocean-predator", kind: "creature", category: "predator", zone: "ocean" },
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

test("the generic evaluator applies each Habitat's own zone and composition", () => {
  const reef = evaluateHabitatComposition("coral-reef", [
    "coral", "coral", "coral", "coral",
    "fish", "fish",
    "invert", "invert",
    // Other zones never satisfy Reef requirements.
    "deep-coral", "deep-fish", "deep-invert",
  ], cards);
  assert.equal(reef.valid, true);
  assert.deepEqual(reef.counts, { corals: 4, fish: 2, invertebrates: 2 });

  const abyss = evaluateHabitatComposition("abyss", [
    "deep-coral", "deep-coral", "deep-coral", "deep-coral",
    "deep-fish", "deep-fish",
    "deep-invert", "deep-invert",
    // Reef cards never satisfy Deep requirements.
    "coral", "fish", "invert",
  ], cards);
  assert.equal(abyss.valid, true);
  assert.deepEqual(abyss.counts, { corals: 4, fish: 2, invertebrates: 2 });

  const openOcean = evaluateHabitatComposition("open-ocean", [
    "fish-school", "fish-school", "fish-school", "invert-school",
    "ocean-fish", "ocean-fish",
    "ocean-invert", "ocean-invert",
    // Neither a Predator nor a Reef Fish satisfies the printed gold icon.
    "ocean-predator", "fish",
  ], cards);
  assert.equal(openOcean.valid, true);
  assert.deepEqual(openOcean.counts, {
    creatureSchools: 4,
    fish: 2,
    invertebrates: 2,
  });
});

test("Creature Schools never double-count as ordinary Open Ocean Fish or Invertebrates", () => {
  const result = evaluateHabitatComposition("open-ocean", [
    "fish-school", "fish-school", "fish-school", "invert-school",
    "ocean-fish",
    "ocean-invert",
    "ocean-predator", "ocean-predator",
  ], cards);

  assert.equal(result.valid, false);
  assert.deepEqual(result.counts, {
    creatureSchools: 4,
    fish: 1,
    invertebrates: 1,
  });
  assert.deepEqual(result.missing, {
    creatureSchools: 0,
    fish: 1,
    invertebrates: 1,
  });
});

test("unknown Habitats have no implicit composition requirement", () => {
  assert.deepEqual(evaluateHabitatComposition("rock-arch", [], cards), {
    habitatId: "rock-arch",
    valid: true,
    counts: {},
    required: {},
    missing: {},
  });
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

test("end-turn maintenance evaluates each Habitat against its own composition", () => {
  const habitats = [
    createHabitatInstance("coral-reef", "reef-a", cards),
    createHabitatInstance("abyss", "abyss-a", cards),
    createHabitatInstance("open-ocean", "ocean-a", cards),
  ];
  const result = resolveEndOfTurnHabitatMaintenance(habitats, {
    cardsInPlay: [
      // Coral Reef is complete.
      "coral", "coral", "coral", "coral",
      "fish", "fish", "invert", "invert",
      // Open Ocean is complete.
      "fish-school", "fish-school", "fish-school", "invert-school",
      "ocean-fish", "ocean-fish", "ocean-invert", "ocean-invert",
      // Abyss remains incomplete.
      "deep-coral", "deep-fish", "deep-invert",
    ],
    cardLookup: cards,
  });

  assert.deepEqual(result.events.map(({ instanceId, appliedDamage }) => ({ instanceId, appliedDamage })), [
    { instanceId: "abyss-a", appliedDamage: 10 },
  ]);
  assert.deepEqual(result.habitats.map(({ instanceId, currentHealth }) => ({ instanceId, currentHealth })), [
    { instanceId: "reef-a", currentHealth: 40 },
    { instanceId: "abyss-a", currentHealth: 30 },
    { instanceId: "ocean-a", currentHealth: 40 },
  ]);
  assert.equal(result.compositions["coral-reef"].valid, true);
  assert.equal(result.compositions.abyss.valid, false);
  assert.equal(result.compositions["open-ocean"].valid, true);
});

test("Abyss and Open Ocean each take 10 damage when their requirements are unmet", () => {
  const habitats = [
    createHabitatInstance("abyss", "abyss-a", cards),
    { ...createHabitatInstance("open-ocean", "ocean-a", cards), currentHealth: 10 },
  ];
  const result = resolveEndOfTurnHabitatMaintenance(habitats, {
    cardsInPlay: [],
    cardLookup: cards,
  });

  assert.deepEqual(result.events.map(({ instanceId, currentHealth, destroyed }) => ({ instanceId, currentHealth, destroyed })), [
    { instanceId: "abyss-a", currentHealth: 30, destroyed: false },
    { instanceId: "ocean-a", currentHealth: 0, destroyed: true },
  ]);
  assert.deepEqual(result.habitats.map((habitat) => habitat.instanceId), ["abyss-a"]);
  assert.deepEqual(result.destroyedHabitats.map((habitat) => habitat.instanceId), ["ocean-a"]);
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
