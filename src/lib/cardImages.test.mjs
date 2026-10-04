import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createJiti } from "jiti";
import { applyGalleryImages } from "./cardImages.mjs";
import { buildGalleryData } from "./galleryData.mjs";

const master = JSON.parse(readFileSync(new URL("../data/gallery-set-list.json", import.meta.url)));
const images = JSON.parse(readFileSync(new URL("../data/gallery-images.json", import.meta.url)));
const { allCards, cardsById, getCardImage } = await createJiti(import.meta.url).import("../data/cards/index.js");
const gallery = buildGalleryData(master, images, allCards).flatMap((set) => set.images);

test("playable cards use the same versioned previews as the gallery", () => {
  for (const entry of gallery.filter((card) => card.hasImage && cardsById[card.cardId])) {
    assert.equal(cardsById[entry.cardId].image, entry.src, entry.cardId);
  }

  for (const id of ["brain-coral-base", "coral-reef", "queen-angelfish", "arrow-crab", "great-white", "thresher-shark"]) {
    assert.match(cardsById[id].image, /\.png\?v=[a-f0-9]{12}$/, id);
  }
  assert.match(cardsById["clear-water"].image, /^\/images\/cards\/conditions\/clear-water\.png\?v=[a-f0-9]{12}$/);
});

test("renamed gallery cards supply artwork for legacy deck IDs", () => {
  for (const [legacyId, galleryId] of [
    ["boxfish", "longhorn-cowfish"],
    ["twinspot-butterflyfish", "spotfin-butterflyfish"],
  ]) {
    assert.equal(cardsById[legacyId].id, legacyId);
    assert.equal(cardsById[legacyId].image, gallery.find((card) => card.cardId === galleryId).src);
  }
});

test("a gallery artwork refresh updates simulator URLs without changing gameplay data", () => {
  const card = Object.freeze({ id: "great-white", image: "/old.png", cost: { rp: 8 }, victoryPoints: 8 });
  const refreshedImages = {
    ...images,
    cards: images.cards.map((image) => image.cardId === card.id ? { ...image, contentHash: "0123456789ab" } : image),
  };
  const [updated] = applyGalleryImages([card], refreshedImages);
  const refreshedGallery = buildGalleryData(master, refreshedImages, [card])
    .flatMap((set) => set.images).find((entry) => entry.cardId === card.id);

  assert.equal(updated.image, refreshedGallery.src);
  assert.notEqual(updated.image, cardsById[card.id].image);
  assert.deepEqual(updated, { ...card, image: refreshedGallery.src });
  assert.equal(card.image, "/old.png");
});

test("cards without an available gallery image keep their existing fallback", () => {
  const cards = [
    { id: "missing", image: "/fallback.svg" },
    { id: "hidden", image: "/fallback.svg" },
    { id: "unversioned", image: "/fallback.svg" },
  ];
  const result = applyGalleryImages(cards, { cards: [
    { cardId: "hidden", src: "/hidden.png", contentHash: "abc", hidden: true },
    { cardId: "unversioned", src: "/preview.png" },
  ] });

  assert.equal(result[0], cards[0]);
  assert.equal(result[1], cards[1]);
  assert.equal(result[2].image, "/preview.png");
});

test("resumed foundations resolve current artwork instead of their saved image URL", () => {
  const savedCoral = Object.freeze({
    id: "player-coral-17",
    cardId: "brain-coral-base",
    image: "/images/cards/coral/Reef/brain-coral-base.webp",
  });

  assert.equal(getCardImage(savedCoral), gallery.find((card) => card.cardId === savedCoral.cardId).src);
  assert.equal(getCardImage(cardsById["great-white"]), cardsById["great-white"].image);
  assert.equal(getCardImage({ cardId: "unknown", image: "/fallback.svg" }), "/fallback.svg");
  assert.equal(getCardImage(null), undefined);
});
