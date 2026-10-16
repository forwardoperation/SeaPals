import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { getGalleryImageSrc } from "../cardImages.mjs";
import { getStoreBannerCards, STORE_BANNER_CARD_IDS } from "./bannerCards.mjs";

const manifest = JSON.parse(readFileSync(new URL("../../data/gallery-images.json", import.meta.url), "utf8"));
const master = JSON.parse(readFileSync(new URL("../../data/gallery-set-list.json", import.meta.url), "utf8"));

test("the reviewed banner cards are released public artwork across all three sets", () => {
  const cards = getStoreBannerCards(manifest, master);
  assert.equal(STORE_BANNER_CARD_IDS.length, 12);
  assert.equal(new Set(STORE_BANNER_CARD_IDS).size, STORE_BANNER_CARD_IDS.length);
  assert.deepEqual(cards.map((card) => card.id), [...STORE_BANNER_CARD_IDS]);
  const sets = new Set();
  const categories = new Set();
  for (const card of cards) {
    const image = manifest.cards.find((entry) => entry.cardId === card.id);
    const set = master.sets.find((entry) => entry.cards.some((entryCard) => entryCard.cardId === card.id));
    const publicCard = set.cards.find((entry) => entry.cardId === card.id);
    sets.add(set.zone);
    categories.add(publicCard.category);
    assert.equal(image.prerelease, false, card.id);
    assert.ok(!image.hidden, card.id);
    assert.equal(card.name, publicCard.name);
    assert.equal(card.src, getGalleryImageSrc(image));
    assert.deepEqual(Object.keys(card), ["id", "name", "src", "width", "height"]);
    assert.ok(card.width > 0 && card.height > 0, card.id);
    assert.ok(existsSync(new URL(`../../../public${image.src}`, import.meta.url)), `${card.id} artwork is missing`);
  }
  assert.deepEqual([...sets].sort(), ["deep", "ocean", "reef"]);
  assert.ok(categories.size >= 4, "The fan should show a variety of card types.");
});

test("a banner card requires explicit released status, visibility, and public master membership", () => {
  const id = STORE_BANNER_CARD_IDS[0];
  const entry = manifest.cards.find((card) => card.cardId === id);
  const publicCard = master.sets.flatMap((set) => set.cards).find((card) => card.cardId === id);
  const masterFixture = { sets: [{ cards: [publicCard] }] };
  for (const changed of [
    { ...entry, prerelease: true },
    { ...entry, prerelease: undefined },
    { ...entry, prerelease: null },
    { ...entry, prerelease: "false" },
    { ...entry, hidden: true },
  ]) {
    assert.deepEqual(getStoreBannerCards({ cards: [changed] }, masterFixture), []);
  }
  assert.deepEqual(getStoreBannerCards({ cards: [entry] }, { sets: [{ cards: [] }] }), []);
  assert.deepEqual(getStoreBannerCards({ cards: [entry] }), []);
  assert.deepEqual(getStoreBannerCards({ cards: [] }, masterFixture), []);
  assert.deepEqual(getStoreBannerCards(null, masterFixture), []);
  const unknownId = "unreviewed-banner-art";
  assert.deepEqual(getStoreBannerCards({ cards: [{ ...entry, cardId: unknownId }] },
    { sets: [{ cards: [{ ...publicCard, cardId: unknownId }] }] }), []);
});

test("the banner follows the current gallery version without mutating supplied data", () => {
  const imageManifest = structuredClone(manifest);
  const masterSetList = structuredClone(master);
  const id = STORE_BANNER_CARD_IDS[0];
  const image = imageManifest.cards.find((entry) => entry.cardId === id);
  image.contentHash = "new-reviewed-artwork-version";
  const before = structuredClone({ imageManifest, masterSetList });
  const cards = getStoreBannerCards(imageManifest, masterSetList);
  assert.equal(cards[0].src, `${image.src}?v=new-reviewed-artwork-version`);
  assert.deepEqual({ imageManifest, masterSetList }, before);
  for (const changed of [{ src: "https://example.invalid/image.png" }, { width: 0 }, { height: null }]) {
    assert.ok(!getStoreBannerCards({ cards: [{ ...image, ...changed }] }, masterSetList).some((card) => card.id === id));
  }
});
