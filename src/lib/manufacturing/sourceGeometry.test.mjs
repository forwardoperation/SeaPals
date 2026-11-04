import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { buildPrintingCatalog } from "./boosters.mjs";
import { createManufacturingManifest, preflightPrintAssets } from "./printPlan.mjs";
import { validateRelease } from "./integration.mjs";
import { validFixedSheetPositions } from "./sourceGeometry.mjs";
import { normalizeFixedSheetExport, sheetPositions, validateFixedSheetBackgrounds } from "../../../scripts/manufacturing/sync-figma.mjs";
import { fixedArtworkSources, EMPTY_FIXED_SHEET_RECTANGLES } from "./recipes.mjs";

const read = async (name) => JSON.parse(await readFile(new URL(`../../data/${name}`, import.meta.url), "utf8"));
const catalog = buildPrintingCatalog(await read("gallery-set-list.json"), await read("gallery-images.json"));
const partials = [
  ["sheet-murky-water-7", "2241:485700"],
  ["sheet-stinging-fortress-7", "2363:268999"],
  ["sheet-disruption-7", "2404:533973"],
];
const positions = () => Array.from({ length: 9 }, (_, i) => ({
  x: 167 + (i % 3) * 720, y: 106 + Math.floor(i / 3) * 1008,
  width: 720, height: 1008,
}));
const measuredSizes = [
  [720, 1008], [720.9599609375, 1008.0001220703125], [705, 987],
  [720, 1009.9199829101562], [720.00341796875, 1010.6964111328125],
];
function documentFor(crops, nodeId) {
  return {
    id: nodeId,
    absoluteBoundingBox: { x: -4000, y: 500, width: 2550, height: 3300 },
    children: [{ name: "card_backs", children: crops.map((p) => ({
      absoluteBoundingBox: p && { ...p, x: p.x - 4000, y: p.y + 500 },
    })) }],
  };
}
function fixture(assetId, crops) {
  const productId = assetId.replace(/^sheet-/, "").replace(/-\d+$/, "");
  const manifest = createManufacturingManifest({
    request: { orderId: "10000000-0000-4000-8000-000000000001", orderNumber: "GEOMETRY-TEST", items: [{ productId, quantity: 1 }] },
    catalog, artworkRelease: "geometry-test", randomIndex: () => 0,
  });
  const assets = {};
  for (const id of manifest.sheets.flatMap((s) => [s.fronts.assetId, s.backs.assetId])) {
    assets[id] = {
      width: 2550, height: 3300, sha256: "a".repeat(64),
      path: `manufacturing/sha256/${"a".repeat(64)}.png`,
      ...(id.startsWith("sheet-") ? { positions: positions().slice(0, partials.some(([name]) => name === id) ? 8 : 9) } : {}),
    };
  }
  assets[assetId].positions = crops;
  return { manifest, release: { releaseId: manifest.artworkRelease, figmaVersion: "2409981651040810260", catalog, assets } };
}

test("fixed-sheet sync preserves every audited source size without normalizing its crop", () => {
  for (const [width, height] of measuredSizes) {
    const crops = positions();
    crops[7] = { ...crops[7], width, height };
    const original = structuredClone(crops);
    assert.equal(validFixedSheetPositions(crops, "sheet-blue-water-1"), true);
    assert.deepEqual(sheetPositions(documentFor(crops, "2224:257783")), crops);
    assert.deepEqual(crops, original);
  }
});

test("only the three audited final pages accept exactly eight actual source cards", () => {
  for (const [assetId, nodeId] of partials) {
    for (const count of [7, 8, 9]) {
      const crops = positions().slice(0, count);
      assert.equal(validFixedSheetPositions(crops, assetId), count === 8);
      assert.equal(validFixedSheetPositions(crops, nodeId), count === 8);
      if (count === 8) assert.deepEqual(sheetPositions(documentFor(crops, nodeId)), crops);
      else assert.throws(() => sheetPositions(documentFor(crops, nodeId)), /fixed sheet/);
    }
  }
  for (const id of [undefined, "sheet-blue-water-1", "2224:257783", "sheet-murky-water-6", "unknown"])
    assert.equal(validFixedSheetPositions(positions().slice(0, 8), id), false);
});

const corruptions = [
  ["missing card", (p) => p.pop()],
  ["extra card", (p) => p.push({ ...p[0] })],
  ["null rectangle", (p) => { p[0] = null; }],
  ["nonfinite x", (p) => { p[0].x = NaN; }],
  ["nonfinite height", (p) => { p[0].height = Infinity; }],
  ["negative origin", (p) => { p[0].x = -0.1; }],
  ["right overflow", (p) => { p[0].x = 2000; }],
  ["bottom overflow", (p) => { p[0].y = 3000; }],
  ["zero width", (p) => { p[0].width = 0; }],
  ["hybrid aspect", (p) => { p[0].width = 705; }],
  ["unapproved smaller crop", (p) => { Object.assign(p[0], { width: 690, height: 966 }); }],
  ["unapproved larger crop", (p) => { Object.assign(p[0], { width: 750, height: 1050 }); }],
];
test("source extraction rejects missing, malformed, and unapproved crop geometry", () => {
  for (const [name, corrupt] of corruptions) {
    const crops = positions(); corrupt(crops);
    assert.equal(validFixedSheetPositions(crops, "sheet-blue-water-1"), false, name);
    assert.throws(() => sheetPositions(documentFor(crops, "2224:257783")), /fixed sheet/, name);
  }
});

test("release validation and print preflight share the same measured crop and exact-count rules", () => {
  for (const assetId of ["sheet-blue-water-1", ...partials.map(([id]) => id)]) {
    const partial = partials.some(([id]) => id === assetId);
    const crops = positions().slice(0, partial ? 8 : 9);
    measuredSizes.forEach(([width, height], i) => Object.assign(crops[i], { width, height }));
    const { release, manifest } = fixture(assetId, crops);
    assert.equal(validateRelease(release), release);
    assert.equal(preflightPrintAssets(manifest, release).ready, true);
    for (const count of partial ? [7, 9] : [8, 10]) {
      release.assets[assetId].positions = [...positions(), { ...positions()[0] }].slice(0, count);
      assert.throws(() => validateRelease(release), /card positions/);
      assert.equal(preflightPrintAssets(manifest, release).ready, false);
    }
  }
  for (const [name, corrupt] of corruptions) {
    const crops = positions(); corrupt(crops);
    const { release, manifest } = fixture("sheet-blue-water-1", crops);
    assert.throws(() => validateRelease(release), /card positions/, name);
    assert.equal(preflightPrintAssets(manifest, release).ready, false, name);
  }
});

test("smaller fixed-sheet crops do not lower standalone booster-artwork resolution", () => {
  const { release } = fixture("sheet-blue-water-1", positions());
  release.assets["reef-001"] = {
    width: 705, height: 987, sha256: "a".repeat(64),
    path: `manufacturing/sha256/${"a".repeat(64)}.png`,
  };
  assert.throws(() => validateRelease(release), /Incorrect card dimensions/);
});

const omittedSources = fixedArtworkSources().filter(source =>
  ["sheet-darkness-shroud-1", "sheet-open-ocean-hunt-1"].includes(source.id));
function documentWithReviewedBlank(source) {
  const doc = documentFor(positions(), source.nodeId);
  doc.children[0].children.forEach((child, index) => Object.assign(child, { id: `card-${index}`, type: "INSTANCE" }));
  Object.assign(doc.children[0].children[2], { id: source.omittedNodeIds[0], type: "FRAME", name: "Frame 3", children: [],
    fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }], strokes: [], effects: [], opacity: 1 });
  return doc;
}

test("the two audited middle-slot placeholders are omitted without changing PNG pixels or remaining crops", () => {
  assert.deepEqual(omittedSources.map(source => [source.id, source.nodeId, source.omittedNodeIds]), [
    ["sheet-darkness-shroud-1", "2298:446032", ["2893:234348"]],
    ["sheet-open-ocean-hunt-1", "2296:82569", ["2779:45793"]],
  ]);
  for (const source of omittedSources) {
    const doc = documentWithReviewedBlank(source), before = structuredClone(doc), expected = positions().filter((_, index) => index !== 2);
    assert.deepEqual(sheetPositions(doc), expected);
    const bytes = Buffer.from("Previously verified native PNG bytes");
    const normalized = normalizeFixedSheetExport(bytes, doc, source);
    assert.equal(normalized.bytes, bytes, "Source selection must not change the saved PNG bytes");
    assert.deepEqual(normalized.positions, expected);
    assert.deepEqual(normalized.omittedNodeIds, source.omittedNodeIds);
    assert.deepEqual(doc, before, "Figma page models and card artwork remain unchanged");
    assert.equal(validFixedSheetPositions(expected, source.nodeId), true);
    assert.equal(validFixedSheetPositions(positions(), source.nodeId), false);
    for (const crops of [expected, positions()]) {
      const { release, manifest } = fixture(source.id, crops);
      assert.equal(validateRelease(release), release);
      assert.equal(preflightPrintAssets(manifest, release).ready, true);
    }
    assert.equal(validFixedSheetPositions(expected.slice(0, 7), source.id), false);
  }
});

test("an audited placeholder gaining image, text, color, stroke or effects blocks extraction and cache guards", () => {
  const mutations = [
    node => { node.fills = [{ type: "IMAGE", imageRef: "new-art" }]; },
    node => { node.children.push({ type: "TEXT", characters: "A newly finished card" }); },
    node => { node.fills[0].color.r = 0.9; },
    node => { node.strokes = [{ type: "SOLID" }]; },
    node => { node.effects = [{ type: "DROP_SHADOW" }]; },
    node => { node.type = "INSTANCE"; },
    node => { delete node.children; },
  ];
  for (const source of omittedSources) for (const mutate of mutations) {
    const doc = documentWithReviewedBlank(source); mutate(doc.children[0].children[2]);
    assert.throws(() => sheetPositions(doc), /now contains artwork or effects.*silently omitted/);
    assert.throws(() => validateFixedSheetBackgrounds(doc, source), /now contains artwork or effects.*silently omitted/);
  }
});

test("placeholder omission is limited to its reviewed page and node identities", () => {
  const doc = documentWithReviewedBlank(omittedSources[0]);
  doc.id = "2224:257783";
  assert.deepEqual(sheetPositions(doc), positions(), "An identical-looking frame on another page is not excluded");
  doc.id = omittedSources[0].nodeId;
  doc.children[0].children[2].id = "unreviewed-placeholder";
  assert.throws(() => sheetPositions(doc), /supported card-count/);
  for (const id of ["sheet-darkness-shroud-2", "sheet-open-ocean-hunt-2", "2298:446827", "2296:82830"])
    assert.equal(validFixedSheetPositions(positions().slice(0, 8), id), false);
});

const rectangleSources = fixedArtworkSources().filter(source => Object.hasOwn(EMPTY_FIXED_SHEET_RECTANGLES, source.id));
function documentWithReviewedRectangle(source) {
  const doc = documentFor(positions(), source.nodeId), grid = doc.children[0];
  Object.assign(grid, { id: source.exportNodeId ?? "grid", type: "FRAME", fills: [],
    absoluteBoundingBox: { x: -3900, y: 600, width: 2330, height: 3170 } });
  grid.children.forEach((child, index) => Object.assign(child, { id: "real-card-" + index, type: "INSTANCE" }));
  Object.assign(grid.children[8], { id: source.omittedNodeIds[0], name: "Rectangle 17", type: "RECTANGLE", blendMode: "PASS_THROUGH",
    fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }], strokes: [], effects: [], opacity: 1 });
  if (source.exportNodeId) Object.assign(grid.children[8].absoluteBoundingBox, {
    width: 776.6666870117188, height: 1056.6666259765625,
  });
  return doc;
}

test("the three new reviewed white rectangles leave exactly eight real card crops", () => {
  assert.deepEqual(rectangleSources.map(source => [source.id, source.omittedNodeIds]), [
    ["sheet-coral-garden-7", ["4499:508122"]],
    ["sheet-murky-water-7", ["4500:191319"]],
    ["sheet-stinging-fortress-7", ["4500:301116"]],
  ]);
  for (const source of rectangleSources) {
    const doc = documentWithReviewedRectangle(source), original = structuredClone(doc);
    const expected = positions().slice(0, 8);
    validateFixedSheetBackgrounds(doc, source);
    assert.deepEqual(sheetPositions(doc), expected);
    const bytes = source.exportNodeId
      ? PNG.sync.write(new PNG({ width: 2330, height: 3170 }))
      : Buffer.from("Verified complete-page pixels remain unchanged");
    const normalized = normalizeFixedSheetExport(bytes, doc, source);
    assert.deepEqual(normalized.positions, expected);
    assert.deepEqual(normalized.omittedNodeIds, source.omittedNodeIds,
      "Isolated Coral exports must preserve the omission metadata too");
    if (!source.exportNodeId) assert.equal(normalized.bytes, bytes);
    else {
      assert.deepEqual(normalized.sourceGeometry.sourcePositions, expected);
      const png = PNG.sync.read(normalized.bytes);
      assert.equal(png.width, 2550); assert.equal(png.height, 3300);
    }
    assert.deepEqual(doc, original, "Source card artwork, placement and Figma metadata are not modified");
  }
});

test("new rectangle omissions reject any artwork, effects, mask or nonwhite rendering change", () => {
  const mutations = [
    node => { node.fills = [{ type: "IMAGE", imageRef: "new-art" }]; },
    node => { node.children = [{ type: "TEXT", characters: "New card" }]; },
    node => { node.children = null; },
    node => { node.fills[0].color.r = 0.9; },
    node => { node.fills[0].color.a = 0.5; },
    node => { node.fills[0].opacity = 0.5; },
    node => { node.fills[0].visible = false; },
    node => { node.fills[0].blendMode = "MULTIPLY"; },
    node => { node.fills = []; },
    node => { node.background = [{ type: "IMAGE", imageRef: "hidden-art" }]; },
    node => { node.strokes = [{ type: "SOLID" }]; },
    node => { node.effects = [{ type: "DROP_SHADOW" }]; },
    node => { node.isMask = true; },
    node => { node.opacity = 0.5; },
    node => { node.blendMode = "MULTIPLY"; },
    node => { node.type = "FRAME"; node.children = []; },
    node => { node.type = "INSTANCE"; },
  ];
  for (const source of rectangleSources) for (const mutate of mutations) {
    const doc = documentWithReviewedRectangle(source); mutate(doc.children[0].children[8]);
    assert.throws(() => sheetPositions(doc), /now contains artwork or effects.*silently omitted/);
    assert.throws(() => validateFixedSheetBackgrounds(doc, source), /now contains artwork or effects.*silently omitted/);
  }
});

test("rectangle omission cannot broaden historic frame rules or discard unreviewed white nodes", () => {
  for (const source of omittedSources) {
    const doc = documentWithReviewedBlank(source);
    doc.children[0].children[2].type = "RECTANGLE";
    assert.throws(() => sheetPositions(doc), /now contains artwork or effects.*silently omitted/);
  }
  for (const source of rectangleSources) {
    const doc = documentWithReviewedRectangle(source);
    doc.children[0].children[8].id = "unreviewed-white-rectangle";
    assert.throws(() => sheetPositions(doc), /supported card-count/);
  }
  const doc = documentWithReviewedRectangle(rectangleSources.find(source => source.id === "sheet-murky-water-7"));
  doc.id = "2224:257783";
  assert.deepEqual(sheetPositions(doc), positions(), "The same rectangle identity on another page is not omitted");
});
