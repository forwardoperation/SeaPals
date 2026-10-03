import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createJiti } from "jiti";
import { buildGalleryData, getGalleryArtProgress } from "./galleryData.mjs";

const master = JSON.parse(readFileSync(new URL("../data/gallery-set-list.json", import.meta.url)));
const images = JSON.parse(readFileSync(new URL("../data/gallery-images.json", import.meta.url)));
const { allCards } = await createJiti(import.meta.url).import("../data/cards/index.js");
const gallery = buildGalleryData(master, images, allCards);
const cards = gallery.flatMap((set) => set.images);
const byId = new Map(cards.map((card) => [card.cardId, card]));

test("gallery follows all 228 master printings, combining finishes into 193 cards and stages", () => {
  assert.deepEqual(gallery.map((set) => [set.zone, set.images.length]), [
    ["reef", 87], ["ocean", 59], ["deep", 47],
  ]);
  assert.equal(cards.length, 193);
  assert.equal(byId.size, 193);
  assert.equal(cards.reduce((total, card) => total + card.printings.length, 0), 228);
  assert.equal(cards.filter((card) => !card.hasImage).length, 13);
  for (const set of gallery) {
    assert.deepEqual(
      new Set(set.groups.flatMap((group) => group.images.map((card) => card.cardId))),
      new Set(set.images.map((card) => card.cardId))
    );
  }
  assert.deepEqual(byId.get("great-white").printings, [
    { number: 2, rarity: "Holo Rare" }, { number: 17, rarity: "Rare" },
  ]);
});

test("retired placeholders and off-list previews cannot leak from the playable catalog", () => {
  for (const id of ["rock-arch", "drop-off", "ship-wreck", "marine-sanctuary",
    "boxfish", "twinspot-butterflyfish", "winter-flounder", "white-grunt",
    "clear-water", "whirlpool", "super-whirlpool", "coral-heal", "explorer-jordan"]) {
    assert.ok(!byId.has(id), id);
  }
  assert.equal(byId.get("longhorn-cowfish").name, "Longhorn Cowfish");
  assert.equal(byId.get("spotfin-butterflyfish").name, "Spotfin Butterflyfish");
  assert.equal(byId.get("manta-ray").name, "Reef Manta Ray");
  assert.equal(byId.get("manta-ray").card.name, "Reef Manta Ray");
  assert.ok(byId.has("ocean-jake"));
});

test("master set placement and baitball stages override catalog classifications", () => {
  for (const id of ["sperm-whale", "pilot-whale-oceanic", "rov-lights"]) {
    assert.equal(byId.get(id).zone, "deep", id);
  }
  assert.equal(byId.get("cast-net").zone, "ocean");
  const baitballs = gallery.find((set) => set.zone === "ocean").groups.find((group) => group.slug === "ocean-baitballs");
  assert.equal(baitballs.images.length, 15);
  assert.equal(byId.get("sardine-ball-stage1").name, "Sardine School");
  assert.equal(byId.get("sardine-ball-stage1").stageLabel, "Stage 1");
});

test("visible Prerelease labels exclude cards from all completed counts but not totals", () => {
  const progress = getGalleryArtProgress(gallery);
  assert.equal(cards.filter((card) => card.prerelease).length, 93);
  assert.equal(progress.totalCards, 193);
  assert.equal(progress.completedCards, 87);
  assert.deepEqual(progress.categoryStats.map((set) => [set.zone, set.complete]), [
    ["reef", 77], ["ocean", 6], ["deep", 4],
  ]);
  assert.equal(byId.get("nurse-shark").prerelease, true);
  assert.equal(byId.get("humpback-whale").prerelease, true);
  assert.equal(byId.get("colossal-squid").prerelease, false);
  const marked = gallery.map((set) => ({ ...set, images: set.images.map((card) => ({ ...card, prerelease: true })) }));
  assert.equal(getGalleryArtProgress(marked).completedCards, 0);
  assert.equal(getGalleryArtProgress(marked).totalCards, 193);
});

test("updated artwork changes the gallery URL without increasing image resolution", () => {
  const current = byId.get("great-white");
  assert.match(current.src, /great-white\.png\?v=[a-f0-9]{12}$/);
  const updated = { ...images, cards: images.cards.map((image) => image.cardId === "great-white" ? { ...image, contentHash: "0123456789ab" } : image) };
  const next = buildGalleryData(master, updated, allCards).flatMap((set) => set.images).find((card) => card.cardId === "great-white");
  assert.notEqual(next.src, current.src);
  assert.deepEqual([next.width, next.height], [375, 525]);
});
