import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyUnfinishedArtworkPolicy,
  buildSourceMap,
  parseProducts,
  selectProductArtwork,
} from "../../../scripts/manufacturing/sync-figma.mjs";
import { contentHash, generateBooster } from "./boosters.mjs";
import { requireOrderArtwork, validateRelease } from "./integration.mjs";
import { PRINT_BACKGROUNDS } from "./backdrops.mjs";
import { BOOSTER_PRODUCTS, FIXED_PRODUCTS, fixedSheetAssets } from "./recipes.mjs";

const read = async (relative) => JSON.parse(await readFile(new URL(relative, import.meta.url), "utf8"));
const [setList, gallery, holos, policy] = await Promise.all([
  read("../../data/gallery-set-list.json"), read("../../data/gallery-images.json"),
  read("../../../scripts/manufacturing/figma-holo-sources.json"),
  read("../../../scripts/manufacturing/figma-unfinished-printings.json"),
]);
const source = applyUnfinishedArtworkPolicy(buildSourceMap(setList, gallery, holos), policy);
const ids = (items) => items.map((item) => item.id).sort();
function releaseFor(selected) {
  return {
    releaseId: `test-${contentHash(selected).slice(0, 8)}`, figmaVersion: "test-version",
    catalog: selected.catalog, printTemplates: selected.templates,
    exportScope: selected.exportScope,
    assets: Object.fromEntries(selected.sources.filter((item) => item.nodeId).map((item) => {
      const background = Object.values(PRINT_BACKGROUNDS).find((value) => value.assetId === item.id);
      const hash = contentHash(item.id);
      return [item.id, {
        nodeId: item.nodeId, sha256: hash, path: `manufacturing/sha256/${hash}.png`,
        width: background?.assetWidth ?? background?.width ?? (item.kind === "card" ? 750 : 2550),
        height: background?.assetHeight ?? background?.height ?? (item.kind === "card" ? 1050 : 3300),
        ...(item.kind === "sheet" ? { positions: Array.from({ length: ["sheet-murky-water-7", "sheet-stinging-fortress-7", "sheet-disruption-7"].includes(item.id) ? 8 : 9 }, (_, index) => ({ x: 167 + index % 3 * 720, y: 106 + Math.floor(index / 3) * 1008, width: 720, height: 1008 })) } : {}),
      }];
    })),
  };
}

test("omitting products preserves the full export and its existing cache hash", () => {
  assert.equal(parseProducts([]), null);
  assert.equal(selectProductArtwork(source), source);
  assert.equal(source.sources.length, 272);
  assert.equal(source.exportScope, undefined);
});

test("Reef export includes all 95 eligible printings and four shared template assets without shrinking the catalog", () => {
  const before = structuredClone(source);
  const selected = selectProductArtwork(source, ["reef-dive-pack"]);
  const reef = source.catalog.filter((card) => card.set === "reef");
  assert.equal(selected.sources.length, 99);
  assert.deepEqual(ids(selected.sources), [
    ...reef.map((card) => card.printingId), "standard-back-sheet",
    "print-template-front-background", "print-template-holo-front-background", "holographic-back-sheet",
  ].sort());
  assert.deepEqual(selected.catalog, source.catalog);
  assert.equal(selected.catalog.length, 217);
  assert.deepEqual(selected.excludedUnfinished, source.excludedUnfinished);
  assert.deepEqual(selected.templates, source.templates);
  assert.deepEqual(selected.exportScope, { products: ["reef-dive-pack"] });
  assert.deepEqual(source, before, "Selecting a product must not mutate the full source map");
  assert.deepEqual(Object.fromEntries(["Common", "Uncommon", "Rare", "Holo Rare"].map((rarity) =>
    [rarity, reef.filter((card) => card.rarity === rarity).length])),
  { Common: 32, Uncommon: 30, Rare: 18, "Holo Rare": 15 });
  assert.notEqual(contentHash(selected), contentHash(source));
});

test("Reef release validates and supports both rare outcomes while other product artwork remains blocked", () => {
  const selected = selectProductArtwork(source, ["reef-dive-pack"]);
  const release = validateRelease(releaseFor(selected));
  requireOrderArtwork([{ productId: "reef-dive-pack", quantity: 1 }], release);
  for (const roll of [0, 9999]) {
    let first = true;
    const pack = generateBooster({ catalog: release.catalog, set: "reef", randomIndex: () => {
      if (first) { first = false; return roll; }
      return 0;
    } });
    assert.equal(pack.cards.length, 9);
    assert.equal(pack.cards[8].rarity, roll === 0 ? "Holo Rare" : "Rare");
    assert.ok(pack.cards.every((card) => release.assets[card.printingId]));
  }
  for (const productId of ["deep-dive-pack", "oceanic-dive-pack", "coral-garden", "starter-kit"]) {
    assert.throws(() => requireOrderArtwork([{ productId, quantity: 1 }], release), productId.endsWith("-dive-pack") ? /No booster draw was created/ : /No print sheets were prepared/);
  }
});

test("a missing selected card stays in the complete pool and blocks preparation", () => {
  const broken = structuredClone(source);
  broken.sources.find((item) => item.id === "reef-002").nodeId = null;
  const selected = selectProductArtwork(broken, ["reef-dive-pack"]);
  assert.ok(selected.catalog.some((card) => card.printingId === "reef-002"));
  assert.ok(selected.missing.some((item) => item.id === "reef-002"));
  const release = releaseFor(selected);
  assert.throws(() => requireOrderArtwork([{ productId: "reef-dive-pack", quantity: 1 }], release), /reef-002.*No booster draw was created/);
  delete release.assets["reef-015"];
  assert.throws(() => requireOrderArtwork([{ productId: "reef-dive-pack", quantity: 1 }], release), /reef-015/);
});

test("missing artwork outside the requested products does not block exporting Reef or remove other catalog entries", () => {
  const broken = structuredClone(source);
  broken.sources.find((item) => item.id === "deep-001").nodeId = null;
  broken.missing = [{ id: "deep-001" }];
  const selected = selectProductArtwork(broken, ["reef-dive-pack"]);
  assert.deepEqual(selected.missing, []);
  assert.deepEqual(selected.catalog, source.catalog);
  assert.ok(selected.catalog.some((card) => card.printingId === "deep-001"));
});

test("comma-separated selections are deterministic and share common back/background assets", () => {
  const products = parseProducts(["--products", "reef-dive-pack, deep-dive-pack"]);
  assert.deepEqual(products, ["deep-dive-pack", "reef-dive-pack"]);
  const selected = selectProductArtwork(source, products);
  const reversed = selectProductArtwork(source, [...products].reverse());
  assert.equal(contentHash(selected), contentHash(reversed));
  assert.notEqual(contentHash(selected), contentHash(selectProductArtwork(source, ["reef-dive-pack"])));
  assert.equal(selected.sources.length, source.catalog.filter((card) => card.set !== "ocean").length + 4);
  assert.equal(new Set(ids(selected.sources)).size, selected.sources.length);
});

test("fixed products select their complete sheets and shared assets", () => {
  const selected = selectProductArtwork(source, ["coral-garden"]);
  assert.equal(selected.sources.length, 11);
  assert.equal(selected.sources.filter((item) => item.kind === "sheet").length, 7);
  assert.ok(selected.sources.every((item) => item.kind !== "card"));
  assert.deepEqual(selected.catalog, source.catalog);
});

test("invalid products fail before a sync and missing source entries never produce a partial selected pool", () => {
  for (const args of [
    ["--products"], ["--products", "--publish"], ["--products", ""],
    ["--products", "reef-dive-pack,"], ["--products", "reef"],
    ["--products", "reef-dive-pack,reef-dive-pack"],
    ["--products", "reef-dive-pack", "--products", "deep-dive-pack"],
  ]) assert.throws(() => parseProducts(args), /--products/);
  assert.throws(() => selectProductArtwork(source, []), /--products/);
  assert.throws(() => selectProductArtwork(source, ["dice-pack"]), /no printable artwork/);
  const missing = { ...source, sources: source.sources.filter((item) => item.id !== "reef-002") };
  assert.throws(() => selectProductArtwork(missing, ["reef-dive-pack"]), /missing required artwork source entries/);
});

test("the recurring refresh retains all 15 products and every deck and Conditions sheet", async () => {
  const script = await readFile(new URL("../../../scripts/manufacturing/run-sync.ps1", import.meta.url), "utf8");
  const match = script.match(/'--products', '([^']+)'/);
  assert.ok(match, "The scheduled helper must specify its complete published scope");
  const products = parseProducts(["--products", match[1]]);
  assert.deepEqual(products, [...Object.keys(FIXED_PRODUCTS), ...Object.keys(BOOSTER_PRODUCTS)].sort());
  assert.equal(products.length, 15);
  const selected = selectProductArtwork(source, products);
  assert.equal(selected.sources.length, 272);
  assert.equal(selected.sources.filter(item => item.kind === "sheet").length, 51);
  assert.deepEqual(ids(selected.sources), ids(source.sources));
  const release = validateRelease(releaseFor(selected));
  for (const productId of products) requireOrderArtwork([{ productId, quantity: 1 }], release);
  assert.equal(fixedSheetAssets("starter-kit").length, 16);
  for (const productId of ["starter-kit", "conditions-deck", "accessory-set"]) {
    const incomplete = structuredClone(release); delete incomplete.assets["sheet-conditions-2"];
    assert.throws(() => requireOrderArtwork([{ productId, quantity: 1 }], incomplete), /sheet-conditions-2/);
  }
});
