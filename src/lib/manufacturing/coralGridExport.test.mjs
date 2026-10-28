import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { fixedArtworkSources, DECK_FRAMES, CORAL_GRID_FRAMES } from "./recipes.mjs";
import { validFixedSheetPositions } from "./sourceGeometry.mjs";
import { figmaImageRoutes, normalizeFixedSheetExport, sheetPositions, validateFixedSheetBackgrounds } from "../../../scripts/manufacturing/sync-figma.mjs";

const fixture = JSON.parse(await readFile(new URL("./test-fixtures/coral-source-geometry-2026-10-28.json", import.meta.url), "utf8"));
const sources = fixedArtworkSources().filter(source => source.id.startsWith("sheet-coral-garden-"));
function documentFor(source = sources[0]) {
  const doc = structuredClone(fixture.documents[source.nodeId]);
  if (source.id === "sheet-coral-garden-7")
    doc.children[0].children.find(child => child.id === source.exportNodeId).children.find(child => child.id === "4316:334225").visible = false;
  return doc;
}
const gridFor = (doc, source) => doc.children[0].children.find(child => child.id === source.exportNodeId);

test("Coral maps only the seven replacement pages and measured isolated grids", () => {
  assert.deepEqual(DECK_FRAMES["coral-garden"], Object.keys(fixture.documents));
  assert.deepEqual(sources.map(source => source.exportNodeId), CORAL_GRID_FRAMES);
  const route = new URL("https://api.figma.com/v1/" + figmaImageRoutes("file", sources, fixture.version)[0]);
  assert.deepEqual(route.searchParams.get("ids").split(","), CORAL_GRID_FRAMES);
  assert.equal(route.searchParams.get("use_absolute_bounds"), "true");
  for (const source of sources) {
    const doc = documentFor(source), positions = sheetPositions(doc);
    assert.equal(positions.length, source.id.endsWith("-7") ? 8 : 9);
    assert.equal(validFixedSheetPositions(positions, source.id), true);
    assert.equal(validFixedSheetPositions(positions, source.nodeId), true);
    assert.equal(validFixedSheetPositions(positions, "sheet-blue-water-1"), false);
  }
});

test("isolated Coral export preserves opaque page, water, marks and card fills outside its export ancestors", () => {
  for (const source of sources) {
    const doc = documentFor(source), grid = gridFor(doc, source);
    grid.children[0].fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }];
    const before = structuredClone(doc);
    assert.doesNotThrow(() => validateFixedSheetBackgrounds(doc, source));
    assert.deepEqual(doc, before);
    grid.fills = [{ type: "IMAGE" }];
    assert.throws(() => validateFixedSheetBackgrounds(doc, source), /card_backs has a visible fill/);
  }
});

test("isolated grid mapping cannot bypass missing, hidden, ambiguous or unreviewed export roots", () => {
  const source = sources[0];
  for (const mutate of [
    doc => { gridFor(doc, source).id = "wrong-grid"; },
    doc => { gridFor(doc, source).visible = false; },
    doc => { doc.children[0].visible = false; },
    doc => { doc.children.push(structuredClone(gridFor(doc, source))); },
  ]) {
    const doc = documentFor(source); mutate(doc);
    assert.throws(() => validateFixedSheetBackgrounds(doc, source), /fixed sheet|Fixed sheet/);
  }
  assert.throws(() => validateFixedSheetBackgrounds(documentFor(source), { ...source, id: "sheet-blue-water-1" }), /not a reviewed/);
});

test("Coral native crop sizes stay scoped, and saved nine-slot Coral releases remain readable", () => {
  const doc = documentFor(sources[6]), positions = sheetPositions(doc);
  assert.equal(validFixedSheetPositions(positions, "sheet-coral-garden-7"), true);
  const historical = [...positions, { x: 1707.3671875, y: 2190.2900390625, width: 738.5999755859375, height: 1034.0400390625 }];
  assert.equal(validFixedSheetPositions(historical, "sheet-coral-garden-7"), true);
  assert.equal(validFixedSheetPositions(historical, sources[6].nodeId), false);
  for (const corrupt of [
    p => { p[0].width = 750; p[0].height = 1050; },
    p => { p[0].width = 738.7; p[0].height = 1034.04; },
    p => { p.pop(); },
  ]) {
    const bad = sheetPositions(documentFor()); corrupt(bad);
    assert.equal(validFixedSheetPositions(bad, sources[0].nodeId), false);
  }
});

test("transparent Letter padding preserves every native grid pixel and records the fractional crop translation", () => {
  const raw = new PNG({ width: 2330, height: 3170 });
  for (let y = 0; y < raw.height; y++) for (let x = 0; x < raw.width; x++) {
    const p = (y * raw.width + x) * 4;
    raw.data[p] = x % 251; raw.data[p + 1] = y % 251; raw.data[p + 2] = (x + y) % 251; raw.data[p + 3] = x % 3 ? 255 : 80;
  }
  const rawBytes = PNG.sync.write(raw);
  for (const source of [sources[0], sources[4]]) {
    const doc = documentFor(source), before = structuredClone(doc), grid = gridFor(doc, source), measured = sheetPositions(doc);
    const result = normalizeFixedSheetExport(rawBytes, doc, source), padded = PNG.sync.read(result.bytes, { checkCRC: true });
    const origin = { x: grid.absoluteBoundingBox.x - doc.absoluteBoundingBox.x, y: grid.absoluteBoundingBox.y - doc.absoluteBoundingBox.y };
    const padding = { x: Math.round(origin.x), y: Math.round(origin.y) };
    assert.deepEqual({ width: padded.width, height: padded.height }, { width: 2550, height: 3300 });
    assert.deepEqual(result.sourceGeometry, { mode: "isolated-grid-letter", exportNodeId: source.exportNodeId,
      sourceBounds: { ...origin, width: 2330, height: 3170 }, padding,
      cropTranslation: { x: padding.x - origin.x, y: padding.y - origin.y }, sourcePositions: measured });
    assert.deepEqual(result.positions, measured.map(p => ({ ...p, x: p.x + padding.x - origin.x, y: p.y + padding.y - origin.y })));
    for (let y = 0; y < raw.height; y++) {
      const start = ((y + padding.y) * padded.width + padding.x) * 4;
      assert.ok(padded.data.subarray(start, start + raw.width * 4).equals(raw.data.subarray(y * raw.width * 4, (y + 1) * raw.width * 4)));
    }
    assert.equal(padded.data[3], 0);
    assert.equal(padded.data[((padding.y - 1) * padded.width + padding.x) * 4 + 3], 0);
    assert.equal(padded.data[((padding.y + raw.height) * padded.width + padding.x) * 4 + 3], 0);
    assert.deepEqual(doc, before, "Normalization cannot edit the Figma source model");
  }
  const clipped = documentFor(); gridFor(clipped, sources[0]).absoluteBoundingBox.x += 30;
  assert.throws(() => normalizeFixedSheetExport(rawBytes, clipped, sources[0]), /clips one or more/);
  const bad = PNG.sync.write(new PNG({ width: 20, height: 20 }));
  assert.throws(() => normalizeFixedSheetExport(bad, documentFor(), sources[0]), /match its measured bounds/);
});
