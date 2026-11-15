import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { getGalleryImageSrc } from "../cardImages.mjs";
import { buildPhysicalDeckContents, PHYSICAL_DECK_IDS } from "./physicalDeckContents.mjs";

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const physical = readJson("../../data/decks/physicalDecks.json");
const images = readJson("../../data/gallery-images.json");
const master = readJson("../../data/gallery-set-list.json");
const contents = buildPhysicalDeckContents(physical, images, master);
const byId = new Map(contents.map((deck) => [deck.id, deck]));

test("physical contents preserve saved Figma evidence and apply explicit current name overrides", () => {
  const evidence = readJson("../../../artifacts/deck-sync/physical-decks-2026-11-15.json");
  assert.equal(evidence.readAt, "2026-11-15");
  for (const deck of contents) {
    const page = evidence.pages.find((page) => page.id === deck.id);
    assert.equal(page.pageId, deck.pageId);
    assert.equal(deck.evidenceDate, evidence.readAt);
    assert.equal(deck.verification, "live-figma-print-sheet");
    const nodeIds = page.cards.flatMap((card) => card.nodeIds);
    assert.equal(nodeIds.length, 60);
    assert.equal(new Set(nodeIds).size, 60);
    assert.equal(page.cards.length, deck.uniqueCards);
    for (const card of deck.cards) {
      const source = page.cards.find((source) => source.cardId === card.cardId);
      assert.equal(card.quantity, source.nodeIds.length);
      assert.equal(card.quantity, source.quantity);
      const savedCard = physical.decks.find((entry) => entry.id === deck.id)
        .cards.find((entry) => entry.cardId === card.cardId);
      assert.equal(savedCard.printedName, source.title);
      assert.equal(card.name, master.nameOverrides?.[source.title] ?? source.title);
      assert.equal(card.stageLabel ?? "", source.stage);
    }
    assert.ok(page.excludedReferenceNodeIds.every((id) => !nodeIds.includes(id)));
  }
});

test("November deck refresh preserves all 420 playable identities, quantities and stages", () => {
  const before = readJson("../../../artifacts/deck-sync/physical-decks-2026-10-16.json");
  const after = readJson("../../../artifacts/deck-sync/physical-decks-2026-11-15.json");
  for (const page of after.pages) {
    const old = before.pages.find((entry) => entry.id === page.id);
    const composition = (entry) => entry.cards.map(({ cardId, quantity, stage }) => ({ cardId, quantity, stage }))
      .sort((a, b) => a.cardId.localeCompare(b.cardId));
    assert.deepEqual(composition(page), composition(old));
    assert.equal(physical.decks.find((deck) => deck.id === page.id).evidenceFile,
      "artifacts/deck-sync/physical-decks-2026-11-15.json");
    assert.match(page.sourceObservationSha256, /^[a-f0-9]{64}$/);
    assert.equal(page.sheets.length, 7);
    const allObservedNodes = page.sheets.flatMap((sheet) => [
      ...sheet.playableNodeIds, ...sheet.referenceNodeIds, ...sheet.omittedNodeIds,
    ]);
    assert.equal(new Set(allObservedNodes).size, allObservedNodes.length);
    assert.deepEqual(new Set(page.sheets.flatMap((sheet) => sheet.playableNodeIds)),
      new Set(page.cards.flatMap((card) => card.nodeIds)));
    assert.deepEqual(new Set(page.sheets.flatMap((sheet) => sheet.referenceNodeIds)),
      new Set(page.excludedReferenceNodeIds));
    assert.deepEqual(new Set(page.sheets.flatMap((sheet) => sheet.omittedNodeIds)),
      new Set(page.excludedEmptyNodeIds));
    for (const card of page.cards) {
      assert.equal(card.slots.length, card.quantity);
      assert.deepEqual(card.slots.map((slot) => slot.nodeId), card.nodeIds);
      const canonical = images.cards.find((entry) => entry.cardId === card.cardId);
      assert.ok(card.slots.every((slot) => slot.sourceNodeId === canonical.nodeId), card.cardId);
      assert.ok(card.slots.every((slot) => page.sheets.some((sheet) =>
        sheet.nodeId === slot.sheetNodeId && sheet.playableNodeIds.includes(slot.nodeId))));
    }
  }
  assert.equal(after.pages.flatMap((page) => page.cards.flatMap((card) => card.nodeIds)).length, 420);
  assert.equal(after.pages.flatMap((page) => page.excludedReferenceNodeIds).length, 15);
  assert.deepEqual(after.pages.flatMap((page) => page.excludedEmptyNodeIds).sort(),
    ["2779:45793", "2893:234348"]);
});

test("current printed Nursery, Day Octopus and Anemone copies use their verified source identities", () => {
  const evidence = readJson("../../../artifacts/deck-sync/physical-decks-2026-11-15.json");
  const nursery = evidence.pages.flatMap((page) => page.cards.filter((card) => card.cardId === "coral-gardener"));
  assert.equal(nursery.length, 6);
  assert.equal(nursery.reduce((sum, card) => sum + card.quantity, 0), 15);
  for (const card of nursery) {
    assert.equal(card.title, "Coral Nursery");
    assert.ok(card.slots.every((slot) => slot.sourceNodeId === "259:692"));
    assert.ok(card.slots.every((slot) => slot.collectorNumbers.length === 1 && slot.collectorNumbers[0] === "86/102"));
  }
  const octopus = evidence.pages.find((page) => page.id === "blue-water").cards.find((card) => card.cardId === "octopus");
  assert.equal(octopus.title, "Day Octopus");
  assert.equal(octopus.quantity, 2);
  assert.ok(octopus.slots.every((slot) => slot.sourceNodeId === "746:146691" && slot.collectorNumbers[0] === "46/102"));
  const anemone = evidence.pages.find((page) => page.id === "stinging-fortress").cards.find((card) => card.cardId === "anemone");
  assert.equal(anemone.quantity, 3);
  assert.ok(anemone.slots.every((slot) => slot.sourceNodeId === "241:848" && slot.collectorNumbers[0] === "43/102"));
  assert.ok(!anemone.nodeIds.includes("3581:647599"), "the stale detached Anemone is no longer a print source");
});


test("the seven physical contents lists preserve stable IDs, exact quantities and source provenance", () => {
  assert.deepEqual(contents.map((deck) => deck.id), [...PHYSICAL_DECK_IDS]);
  assert.equal(physical.fileKey, "xeol2YE0jCE0N5vAD6tjzx");
  assert.deepEqual(contents.map((deck) => [deck.id, deck.totalCards, deck.uniqueCards]), [
    ["coral-garden", 60, 32], ["blue-water", 60, 29],
    ["darkness-shroud", 60, 29], ["open-ocean-hunt", 60, 32],
    ["murky-water", 60, 28], ["stinging-fortress", 60, 24],
    ["disruption", 60, 31],
  ]);
  for (const deck of contents) {
    const original = physical.decks.find((entry) => entry.id === deck.id);
    assert.deepEqual(deck.cards.map(({ cardId, quantity }) => ({ cardId, quantity })),
      original.cards.map(({ cardId, quantity }) => ({ cardId, quantity })));
    assert.equal(deck.groups.reduce((sum, group) => sum + group.count, 0), 60);
    assert.deepEqual(new Set(deck.groups.flatMap((group) => group.cards.map((card) => card.cardId))), new Set(original.cards.map((card) => card.cardId)));
    assert.match(deck.pageId, /^\d+:\d+$/);
    assert.match(deck.evidenceDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(deck.verification && deck.evidenceFile);
  }
  assert.equal(byId.get("coral-garden").cards.find((card) => card.cardId === "restocking").quantity, 3);
  assert.equal(byId.get("blue-water").cards.find((card) => card.cardId === "winter-flounder").quantity, 3);
  assert.equal(byId.get("darkness-shroud").cards.find((card) => card.cardId === "owlfish").quantity, 2);
  assert.equal(byId.get("open-ocean-hunt").cards.find((card) => card.cardId === "oceanic-manta-ray").quantity, 1);
});

test("all 119 physical card IDs resolve names, categories, stages and existing artwork without gameplay records", () => {
  const uniqueCards = new Map(contents.flatMap((deck) => deck.cards).map((card) => [card.cardId, card]));
  const physicalEntries = new Map(physical.decks.flatMap((deck) => deck.cards).map((card) => [card.cardId, card]));
  assert.equal(uniqueCards.size, 119);
  for (const card of uniqueCards.values()) {
    const image = images.cards.find((entry) => entry.cardId === card.cardId);
    const publicCard = master.sets.flatMap((set) => set.cards).find((entry) => entry.cardId === card.cardId);
    const printedName = physicalEntries.get(card.cardId).printedName ?? (publicCard ?? image).name;
    assert.equal(card.name, master.nameOverrides?.[printedName] ?? printedName);
    assert.equal(card.category, (publicCard ?? image).category);
    assert.equal(card.image, getGalleryImageSrc(image));
    assert.ok(card.name && card.categoryLabel);
    assert.ok(existsSync(new URL(`../../../public${image.src}`, import.meta.url)), card.cardId);
  }
  for (const id of ["spotfin-butterflyfish", "winter-flounder", "oceanic-manta-ray", "yellow-lipped-sea-krait", "box-jellyfish", "longhorn-cowfish", "nurse-shark"]) {
    assert.ok(uniqueCards.get(id)?.image, `${id} must not depend on a playable-card record`);
  }
  assert.equal(uniqueCards.get("winter-flounder").name, "Winter Flounder");
  assert.equal(uniqueCards.get("boulder-star-coral-base").displayName, `${uniqueCards.get("boulder-star-coral-base").name} — Base`);
  assert.equal(uniqueCards.get("boulder-star-coral-stage-1").displayName, `${uniqueCards.get("boulder-star-coral-stage-1").name} — Stage 1`);
  assert.equal(uniqueCards.get("boulder-star-coral-stage-2").displayName, `${uniqueCards.get("boulder-star-coral-stage-2").name} — Stage 2`);
  assert.equal(uniqueCards.get("sardine-ball-stage1").category, "baitball");
  assert.equal(uniqueCards.get("sardine-ball-stage1").stageLabel, "Stage 1");
});

test("verified printed names override display copy while canonical categories and stages remain intact", () => {
  const changed = structuredClone(physical);
  for (const deck of changed.decks) {
    for (const card of deck.cards) {
      delete card.printedName;
      if (card.cardId.startsWith("boulder-star-coral-")) card.printedName = "Boulder Star";
      if (card.cardId === "fishing") card.printedName = "  Fishing Rod  ";
    }
  }
  const resolved = buildPhysicalDeckContents(changed, images, master);
  const cards = resolved.flatMap((deck) => deck.cards);
  assert.equal(cards.find((card) => card.cardId === "fishing").displayName, "Fishing Rod");
  assert.equal(cards.find((card) => card.cardId === "fishing").category, "support");
  assert.equal(cards.find((card) => card.cardId === "boulder-star-coral-base").displayName, "Boulder Star — Base");
  assert.equal(cards.find((card) => card.cardId === "boulder-star-coral-stage-1").displayName, "Boulder Star — Stage 1");
  assert.equal(cards.find((card) => card.cardId === "boulder-star-coral-stage-2").displayName, "Boulder Star — Stage 2");
  const fallback = cards.find((card) => card.cardId === "coral-gardener");
  assert.equal(fallback.name, master.sets.flatMap((set) => set.cards).find((card) => card.cardId === "coral-gardener").name);
  assert.deepEqual(resolved.map((deck) => deck.totalCards), contents.map((deck) => deck.totalCards));
  for (const printedName of ["", "  ", null, undefined, 123]) {
    const invalid = structuredClone(physical);
    invalid.decks[0].cards[0].printedName = printedName;
    assert.throws(() => buildPhysicalDeckContents(invalid, images, master), /printed name/);
  }
});

test("Day Octopus keeps its physical card identity and historical printed-name evidence", () => {
  const before = structuredClone(physical);
  const deck = byId.get("blue-water");
  const card = deck.cards.find((entry) => entry.cardId === "octopus");
  const source = physical.decks.find((entry) => entry.id === deck.id)
    .cards.find((entry) => entry.cardId === "octopus");
  assert.equal(source.printedName, "Day Octopus");
  const historical = readJson("../../../artifacts/deck-sync/physical-decks-2026-10-16.json");
  assert.equal(historical.pages.find((page) => page.id === deck.id).cards.find((entry) => entry.cardId === "octopus").title, "Octopus");
  assert.equal(card.name, "Day Octopus");
  assert.equal(card.displayName, "Day Octopus");
  assert.equal(card.quantity, source.quantity);
  assert.equal(card.category, "invertebrate");
  assert.equal(card.image, getGalleryImageSrc(images.cards.find((entry) => entry.cardId === "octopus")));
  assert.equal(deck.totalCards, 60);
  assert.deepEqual(physical, before);
});

test("physical contents retain prerelease artwork that is actually included in the deck", () => {
  const nurse = byId.get("disruption").cards.find((card) => card.cardId === "nurse-shark");
  assert.equal(nurse.quantity, 3);
  assert.equal(nurse.prerelease, true);
  const markedImages = structuredClone(images);
  for (const image of markedImages.cards) image.prerelease = true;
  const marked = buildPhysicalDeckContents(physical, markedImages, master);
  assert.deepEqual(marked.map((deck) => deck.cards.map(({ cardId, quantity }) => ({ cardId, quantity }))),
    contents.map((deck) => deck.cards.map(({ cardId, quantity }) => ({ cardId, quantity }))));
});

test("invalid deck membership or quantities fail instead of silently changing a physical list", () => {
  for (const mutate of [
    (data) => data.decks.pop(),
    (data) => { data.decks[0].id = "the-abyss"; },
    (data) => { data.decks[1].id = data.decks[0].id; },
    (data) => { data.decks[0].cards[0].quantity += 1; },
    (data) => { data.decks[0].cards[0].quantity = 0; },
    (data) => { data.decks[0].cards[0].quantity = 1.5; },
    (data) => { data.decks[0].cards[1].cardId = data.decks[0].cards[0].cardId; },
  ]) {
    const changed = structuredClone(physical);
    mutate(changed);
    assert.throws(() => buildPhysicalDeckContents(changed, images, master), /Physical contents|physical deck|Physical deck/);
  }
});

test("missing image, name, category or stage metadata fails instead of printing a raw card ID", () => {
  const firstId = physical.decks[0].cards[0].cardId;
  assert.throws(() => buildPhysicalDeckContents(physical, { cards: images.cards.filter((card) => card.cardId !== firstId) }, master), /image metadata/);
  for (const changed of [{ name: "" }, { category: "unknown" }]) {
    const namedPhysical = structuredClone(physical);
    namedPhysical.decks[0].cards[0].printedName = "Verified printed name";
    const changedMaster = structuredClone(master);
    Object.assign(changedMaster.sets.flatMap((set) => set.cards).find((card) => card.cardId === firstId), changed);
    assert.throws(() => buildPhysicalDeckContents(namedPhysical, images, changedMaster), /card name|category metadata/);
  }
  const changedMaster = structuredClone(master);
  delete changedMaster.sets.flatMap((set) => set.cards).find((card) => card.cardId === "boulder-star-coral-stage-1").stageLabel;
  assert.throws(() => buildPhysicalDeckContents(physical, images, changedMaster), /stage metadata/);
});

test("rendering physical contents does not mutate the saved source or gallery metadata", () => {
  const before = structuredClone({ physical, images, master });
  buildPhysicalDeckContents(physical, images, master);
  assert.deepEqual({ physical, images, master }, before);
});
