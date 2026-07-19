import test from "node:test";
import assert from "node:assert/strict";
import {
  addHostedCardId,
  addCardsToHandWithLimit,
  canHostSpecialPlacement,
  createCreatureInstance,
  getOceanicApexSacrificeChoices,
  getPersonalDeckType,
  getHostedCardCapacity,
  getSpecialPlacementHostTags,
  normalizeCreatureInstances,
  moveSlottedCreatureBetweenFoundations,
  placeCardInSpecialHost,
  removeCreatureInstance,
  removeCreatureInstances,
  resolveDestructionRecoveryWaves,
} from "./zoneRules.mjs";

const clownfishCard = {
  id: "clownfish",
  tags: ["creature", "fish", "clownfish"],
  passives: [{
    effect: {
      type: "specialPlacement",
      allowedHostTags: ["anemone"],
    },
  }],
};

const anemoneCard = {
  id: "anemone",
  tags: ["creature", "invertebrate", "anemone", "host"],
  clownSlots: 2,
};

test("personal deck routing keeps corals and Creature Schools in Foundation", () => {
  assert.equal(getPersonalDeckType({ kind: "coral" }), "foundation");
  assert.equal(getPersonalDeckType({ kind: "creature", tags: ["creature-school"] }), "foundation");
  assert.equal(getPersonalDeckType({ kind: "creature", tags: ["reef"] }), "pals");
  assert.equal(getPersonalDeckType({ kind: "support" }), "pals");
  assert.equal(getPersonalDeckType(null), null);
});

test("special placement matches candidate host tags and rejects unrelated hosts", () => {
  assert.deepEqual(getSpecialPlacementHostTags(clownfishCard), ["anemone"]);
  assert.equal(canHostSpecialPlacement(anemoneCard, clownfishCard, []), true);
  assert.equal(canHostSpecialPlacement({ ...anemoneCard, tags: ["sponge"] }, clownfishCard, []), false);
  assert.equal(canHostSpecialPlacement(anemoneCard, { id: "ordinary-fish", passives: [] }, []), false);

  const directSchemaCard = { specialPlacement: { allowedHostTags: ["anemone", "sponge"] } };
  assert.deepEqual(getSpecialPlacementHostTags(directSchemaCard), ["anemone", "sponge"]);
});

test("host capacity counts only non-null hosted IDs and supports the generic capacity field", () => {
  assert.equal(getHostedCardCapacity(anemoneCard), 2);
  assert.equal(getHostedCardCapacity({ hostCapacity: 3, clownSlots: 1 }), 3);
  assert.equal(getHostedCardCapacity({ clownSlots: -1 }), 0);
  assert.equal(canHostSpecialPlacement(anemoneCard, clownfishCard, ["first-clown", null]), true);
  assert.equal(canHostSpecialPlacement(anemoneCard, clownfishCard, ["first-clown", "second-clown", null]), false);
});

test("host insertion fills the first null slot without mutating its source", () => {
  const hostedCardIds = ["first-clown", null, undefined];
  const result = addHostedCardId(hostedCardIds, "second-clown", 2);
  assert.deepEqual(result, ["first-clown", "second-clown", undefined]);
  assert.deepEqual(hostedCardIds, ["first-clown", null, undefined]);

  const appended = addHostedCardId(["first-clown"], "second-clown", 2);
  assert.deepEqual(appended, ["first-clown", "second-clown"]);
});

test("complete hosted placement enforces matching tags and printed capacity", () => {
  const original = ["first-clown", null];
  assert.deepEqual(placeCardInSpecialHost(anemoneCard, clownfishCard, original), ["first-clown", "clownfish"]);
  assert.deepEqual(original, ["first-clown", null]);
  assert.equal(placeCardInSpecialHost(anemoneCard, clownfishCard, ["first-clown", "second-clown"]), null);
  assert.equal(placeCardInSpecialHost({ ...anemoneCard, tags: ["sponge"] }, clownfishCard, []), null);
});

test("Jointed Structure moves stable creature state between compatible coral slots", () => {
  const foundations = [
    {
      id: "black-coral",
      slots: [{ id: "source-slot", cardId: "anemone", cardInstanceId: "anemone-7", hostedCardIds: ["clownfish"], controller: "opponent", invasiveOwner: "opponent", position: { left: "10%" } }],
    },
    {
      id: "bamboo-coral",
      slots: [{ id: "destination-slot", cardId: null, cardInstanceId: null, hostedCardIds: [], position: { left: "80%" }, accepts: ["invertebrate"] }],
    },
  ];
  const result = moveSlottedCreatureBetweenFoundations(
    foundations,
    { sourceFoundationId: "black-coral", sourceSlotId: "source-slot", destinationFoundationId: "bamboo-coral", destinationSlotId: "destination-slot" },
    (cardId, slot) => cardId === "anemone" && slot.accepts.includes("invertebrate"),
  );

  assert.equal(result.moved, true);
  assert.deepEqual(result.foundations[0].slots[0], {
    id: "source-slot",
    cardId: null,
    cardInstanceId: null,
    hostedCardIds: [],
    position: { left: "10%" },
  });
  assert.deepEqual(result.foundations[1].slots[0], {
    id: "destination-slot",
    cardId: "anemone",
    cardInstanceId: "anemone-7",
    hostedCardIds: ["clownfish"],
    controller: "opponent",
    invasiveOwner: "opponent",
    position: { left: "80%" },
    accepts: ["invertebrate"],
  });
  assert.equal(foundations[0].slots[0].cardId, "anemone", "the input remains immutable");
});

test("Jointed Structure rejects same-coral, occupied, and incompatible moves", () => {
  const foundations = [
    { id: "a", slots: [{ id: "source", cardId: "fish", cardInstanceId: "fish-1" }, { id: "same-empty", cardId: null }] },
    { id: "b", slots: [{ id: "occupied", cardId: "other" }, { id: "empty", cardId: null }] },
  ];
  assert.match(moveSlottedCreatureBetweenFoundations(foundations, {
    sourceFoundationId: "a", sourceSlotId: "source", destinationFoundationId: "a", destinationSlotId: "same-empty",
  }, () => true).error, /different corals/i);
  assert.match(moveSlottedCreatureBetweenFoundations(foundations, {
    sourceFoundationId: "a", sourceSlotId: "source", destinationFoundationId: "b", destinationSlotId: "occupied",
  }, () => true).error, /occupied/i);
  assert.match(moveSlottedCreatureBetweenFoundations(foundations, {
    sourceFoundationId: "a", sourceSlotId: "source", destinationFoundationId: "b", destinationSlotId: "empty",
  }, () => false).error, /not compatible/i);
});

test("creature instances preserve stable identity and clone hosted-card state", () => {
  const hostedCardIds = ["remora"];
  const instance = createCreatureInstance("mahi-mahi", "creature-41", { zone: "open-water", hostedCardIds });
  hostedCardIds.push("pilot-fish");
  assert.deepEqual(instance, {
    instanceId: "creature-41",
    cardId: "mahi-mahi",
    zone: "open-water",
    hostedCardIds: ["remora"],
  });
});

test("legacy reef and orphan entries normalize once without replacing existing IDs", () => {
  const instances = normalizeCreatureInstances([
    "mahi-mahi",
    { cardId: "bluefish", hostedCardIds: ["remora"] },
    { instanceId: "existing-7", cardId: "needlefish", position: { x: 12, y: 8 } },
  ], ({ index }) => `generated-${index}`);

  assert.deepEqual(instances.map(({ instanceId, cardId }) => ({ instanceId, cardId })), [
    { instanceId: "generated-0", cardId: "mahi-mahi" },
    { instanceId: "generated-1", cardId: "bluefish" },
    { instanceId: "existing-7", cardId: "needlefish" },
  ]);
  assert.deepEqual(instances[1].hostedCardIds, ["remora"]);
  assert.deepEqual(instances[2].position, { x: 12, y: 8 });
});

test("normalization rejects missing factories and duplicate identities", () => {
  assert.throws(() => normalizeCreatureInstances(["mahi-mahi"]), /instanceId must be a non-empty string/);
  assert.throws(() => normalizeCreatureInstances([
    { instanceId: "same", cardId: "mahi-mahi" },
    { instanceId: "same", cardId: "bluefish" },
  ]), /Duplicate creature instanceId/);
});

test("identity-based removal does not retarget survivors when an earlier entry leaves", () => {
  const entries = [
    createCreatureInstance("a", "instance-a"),
    createCreatureInstance("b", "instance-b"),
    createCreatureInstance("c", "instance-c"),
  ];
  const result = removeCreatureInstance(entries, "instance-a");
  assert.equal(result.removed, entries[0]);
  assert.deepEqual(result.instances.map((entry) => entry.instanceId), ["instance-b", "instance-c"]);
  assert.equal(result.instances[0], entries[1]);
  assert.equal(result.instances[1], entries[2]);

  const absent = removeCreatureInstance(result.instances, "missing");
  assert.equal(absent.instances, result.instances);
  assert.equal(absent.removed, null);
});

test("multi-removal reports missing IDs and retains survivor identity", () => {
  const entries = [
    createCreatureInstance("a", "instance-a"),
    createCreatureInstance("b", "instance-b"),
    createCreatureInstance("c", "instance-c"),
  ];
  const result = removeCreatureInstances(entries, ["instance-c", "missing", "instance-a"]);
  assert.deepEqual(result.instances.map((entry) => entry.instanceId), ["instance-b"]);
  assert.equal(result.instances[0], entries[1]);
  assert.deepEqual(result.removed.map((entry) => entry.instanceId), ["instance-a", "instance-c"]);
  assert.deepEqual(result.missingInstanceIds, ["missing"]);
});

test("Oceanic Apex sacrifice choices include each predator and each distinct fish pair", () => {
  const cards = {
    predatorA: { category: "predator", tags: ["oceanic"] },
    predatorB: { category: "predator", subtype: "oceanic" },
    fishA: { category: "fish", tags: ["oceanic"] },
    fishB: { category: "fish", tags: ["oceanic"] },
    fishC: { category: "fish", tags: ["oceanic"] },
    reefFish: { category: "fish", tags: ["reef"] },
    apex: { category: "apex", tags: ["oceanic"] },
  };
  const candidates = [
    createCreatureInstance("predatorA", "p-a", { location: "slot" }),
    createCreatureInstance("predatorB", "p-b", { location: "orphan" }),
    createCreatureInstance("fishA", "f-a", { location: "open-water" }),
    createCreatureInstance("fishB", "f-b", { location: "slot" }),
    createCreatureInstance("fishC", "f-c", { location: "orphan" }),
    createCreatureInstance("reefFish", "reef-f"),
    createCreatureInstance("apex", "apex-a"),
  ];

  const choices = getOceanicApexSacrificeChoices(candidates, cards);
  assert.deepEqual(choices.map(({ kind, instanceIds }) => ({ kind, instanceIds })), [
    { kind: "predator", instanceIds: ["p-a"] },
    { kind: "predator", instanceIds: ["p-b"] },
    { kind: "fish-pair", instanceIds: ["f-a", "f-b"] },
    { kind: "fish-pair", instanceIds: ["f-a", "f-c"] },
    { kind: "fish-pair", instanceIds: ["f-b", "f-c"] },
  ]);
  assert.equal(choices[0].candidates[0], candidates[0]);
});

test("Oceanic Apex sacrifice choices reject ambiguous duplicate identities", () => {
  const cards = { fish: { category: "fish", tags: ["oceanic"] } };
  assert.throws(() => getOceanicApexSacrificeChoices([
    createCreatureInstance("fish", "same"),
    createCreatureInstance("fish", "same"),
  ], cards), /Duplicate creature instanceId/);
});

test("opponent additions respect hand limits and discard overflow in order", () => {
  const hand = ["h1", "h2", "h3", "h4", "h5", "h6"];
  const discardPile = ["old-top", "old-bottom"];
  const result = addCardsToHandWithLimit(hand, ["searched", "recovered", "drawn"], discardPile, 7);
  assert.deepEqual(result.hand, [...hand, "searched"]);
  assert.deepEqual(result.cardsToHand, ["searched"]);
  assert.deepEqual(result.cardsToDiscard, ["recovered", "drawn"]);
  assert.deepEqual(result.discardPile, ["recovered", "drawn", ...discardPile]);
  assert.deepEqual(hand, ["h1", "h2", "h3", "h4", "h5", "h6"]);
  assert.deepEqual(discardPile, ["old-top", "old-bottom"]);
});

test("hand-limit additions discard everything when already full and allow unlimited hands", () => {
  assert.deepEqual(addCardsToHandWithLimit(["h1", "h2"], ["a"], ["old"], 2), {
    hand: ["h1", "h2"],
    discardPile: ["a", "old"],
    cardsToHand: [],
    cardsToDiscard: ["a"],
  });
  assert.deepEqual(addCardsToHandWithLimit([], ["a", "b"], [], Infinity).hand, ["a", "b"]);
});

test("destruction enters discard before Fragment recovery resolves", () => {
  const baseElkhorn = { cardId: "elkhorn-base" };
  const result = resolveDestructionRecoveryWaves([[baseElkhorn]], [], ["old-card"], Infinity, (foundation, discardPile) => ({
    targetCardId: "elkhorn-base",
    recoveredIds: discardPile.filter((cardId) => cardId === foundation.cardId).slice(0, 1),
  }));

  assert.deepEqual(result.hand, ["elkhorn-base"]);
  assert.deepEqual(result.discardPile, ["old-card"]);
  assert.deepEqual(result.triggers[0].cardsToHand, ["elkhorn-base"]);
});

test("later destruction waves can recover cards discarded by an earlier wave", () => {
  const result = resolveDestructionRecoveryWaves(
    [[{ cardId: "elkhorn-base" }], [{ cardId: "elkhorn-stage-2" }]],
    [],
    ["old-card"],
    Infinity,
    (foundation, discardPile) => foundation.cardId === "elkhorn-stage-2"
      ? { targetCardId: "elkhorn-base", recoveredIds: discardPile.filter((cardId) => cardId === "elkhorn-base").slice(0, 1) }
      : null,
  );

  assert.deepEqual(result.hand, ["elkhorn-base"]);
  assert.deepEqual(result.discardPile, ["elkhorn-stage-2", "old-card"]);
});

test("Fragment hand-limit overflow remains on top of discard", () => {
  const result = resolveDestructionRecoveryWaves(
    [[{ cardId: "elkhorn-base" }]],
    ["full-hand"],
    ["old-card"],
    1,
    (_foundation, discardPile) => ({ targetCardId: "elkhorn-base", recoveredIds: discardPile.filter((cardId) => cardId === "elkhorn-base").slice(0, 1) }),
  );

  assert.deepEqual(result.hand, ["full-hand"]);
  assert.deepEqual(result.discardPile, ["elkhorn-base", "old-card"]);
  assert.deepEqual(result.triggers[0].cardsToDiscard, ["elkhorn-base"]);
});
