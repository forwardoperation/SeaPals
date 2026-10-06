import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildGalleryData, getGalleryArtProgress } from "./galleryData.mjs";
import { buildSetListData, filterSetListRows } from "./setListData.mjs";

const master = JSON.parse(readFileSync(new URL("../data/gallery-set-list.json", import.meta.url)));
const images = JSON.parse(readFileSync(new URL("../data/gallery-images.json", import.meta.url)));
const gallery = buildGalleryData(master, images, []);
const { rows, sets } = buildSetListData(gallery);

test("set list preserves every numbered printing, including separate Holo Rare versions", () => {
  assert.equal(rows.length, 228);
  assert.equal(new Set(rows.map((row) => row.id)).size, 228);
  assert.equal(new Set(rows.map((row) => row.cardId)).size, 193);
  assert.equal(rows.filter((row) => row.rarity === "Holo Rare").length, 35);
  for (const set of sets) {
    assert.deepEqual(rows.filter((row) => row.zone === set.zone).map((row) => row.number),
      Array.from({ length: set.totalPrintings }, (_, index) => index + 1));
  }
  assert.deepEqual(rows.filter((row) => row.cardId === "giant-isopod").map(({ number, rarity }) => ({ number, rarity })), [
    { number: 9, rarity: "Holo Rare" }, { number: 24, rarity: "Uncommon" },
  ]);
});

test("rarity totals match the revised master set list", () => {
  assert.deepEqual(sets.map(({ zone, rarities }) => ({ zone, rarities })), [
    { zone: "reef", rarities: { Common: 39, Uncommon: 30, Rare: 18, "Holo Rare": 15 } },
    { zone: "ocean", rarities: { Common: 26, Uncommon: 18, Rare: 15, "Holo Rare": 5 } },
    { zone: "deep", rarities: { Common: 21, Uncommon: 15, Rare: 11, "Holo Rare": 15 } },
  ]);
  const revised = {
    "frilled-shark": "Uncommon", "giant-isopod": "Uncommon", "vampire-squid": "Uncommon",
    "barrel-eye-fish": "Uncommon", "tripod-fish": "Common", "deep-sea-skate": "Common",
    "peacock-squid": "Common", "bloody-belly-comb-jelly": "Common", "ocean-sunfish": "Uncommon",
    "bluefin-tuna": "Rare", "thresher-shark": "Uncommon", remora: "Common",
    "barracuda-oceanic": "Common", "mahi-mahi": "Common", "king-mackerel": "Common",
    tripletail: "Common", "african-pompano": "Common", "yellowtail-amberjack": "Common",
    "chum-bucket": "Uncommon",
  };
  for (const [cardId, rarity] of Object.entries(revised)) {
    assert.equal(rows.find((row) => row.cardId === cardId && row.rarity !== "Holo Rare")?.rarity, rarity, cardId);
  }
});

test("search combines set and rarity filters and keeps baitball stages distinct", () => {
  assert.equal(filterSetListRows(rows, { zone: "deep", rarity: "Common" }).length, 21);
  assert.equal(filterSetListRows(rows, { zone: "ocean", rarity: "Holo Rare" }).length, 5);
  assert.deepEqual(filterSetListRows(rows, { query: "  THRESHER 17/64 ", zone: "ocean", rarity: "Uncommon" }).map((row) => row.cardId), ["thresher-shark"]);
  assert.equal(filterSetListRows(rows, { query: "galapagos shark" }).length, 1);
  const stage = filterSetListRows(rows, { query: "sardine stage 2" });
  assert.equal(stage.length, 1);
  assert.equal(stage[0].stageLabel, "Stage 2");
  assert.equal(filterSetListRows(rows, { query: "no matching creature" }).length, 0);
  assert.equal(filterSetListRows(rows).length, 228);
});

test("rarity updates do not promote prerelease or missing artwork to completed cards", () => {
  const artwork = (id) => rows.find((row) => row.cardId === id).artwork;
  assert.equal(artwork("thresher-shark"), "Complete");
  assert.equal(artwork("frilled-shark"), "Prerelease");
  assert.equal(artwork("chum-bucket"), "Coming soon");
  assert.equal(artwork("bloody-belly-comb-jelly"), "Coming soon");
  assert.equal(getGalleryArtProgress(gallery).completedCards, 74);
});
