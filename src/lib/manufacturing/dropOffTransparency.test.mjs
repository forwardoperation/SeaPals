import test from "node:test";
import assert from "node:assert/strict";
import {
  checkDropOffSheetBackgrounds,
  figmaImageRoutes,
  sheetPositions,
  validateDropOffSheetBackgrounds,
} from "../../../scripts/manufacturing/sync-figma.mjs";
import { fixedArtworkSources } from "./recipes.mjs";

const sheets = fixedArtworkSources().filter((item) => /^sheet-blue-water-[1-7]$/.test(item.id));
const solid = (color = { r: 54 / 255, g: 112 / 255, b: 159 / 255, a: 1 }) => ({ type: "SOLID", color });
function documentFor(source = sheets[3]) {
  return {
    id: source.nodeId, name: "blue-water 4", type: "FRAME", fills: [],
    absoluteBoundingBox: { x: 7770, y: 0, width: 2550, height: 3300 },
    children: [{ name: "card_backs", type: "FRAME", fills: [], children:
      Array.from({ length: 9 }, (_, i) => ({
        type: "INSTANCE", name: `Card ${i + 1}`, fills: [solid()],
        absoluteBoundingBox: { x: 7937 + i % 3 * 720, y: 106 + Math.floor(i / 3) * 1008, width: 720, height: 1008 },
      })),
    }],
  };
}

test("Drop Off source checks reject opaque page and grid fills before raster flattening", () => {
  for (const target of ["page", "grid"]) {
    for (const fill of [solid(), solid({ r: 1, g: 1, b: 1, a: 1 }), { type: "IMAGE", imageRef: "backdrop" }, { type: "GRADIENT_LINEAR" }, { ...solid(), opacity: 0.1 }]) {
      const doc = documentFor();
      (target === "page" ? doc : doc.children[0]).fills = [fill];
      const before = structuredClone(doc);
      assert.throws(() => validateDropOffSheetBackgrounds(doc, sheets[3]), /sheets-drop-off-4.*visible fill.*opaque background.*water/);
      assert.deepEqual(doc, before, "Validation must never alter card artwork or parent fills");
    }
  }
});

test("clear Drop Off parents preserve card fills, alpha overlays and measured source geometry", () => {
  const doc = documentFor();
  doc.fills = [{ ...solid(), visible: false }];
  doc.children[0].fills = [{ ...solid(), opacity: 0 }, solid({ r: 1, g: 1, b: 1, a: 0 })];
  doc.children[0].children[0].fills.push({ ...solid({ r: 1, g: 1, b: 1, a: 1 }), opacity: 0.1 });
  const before = structuredClone(doc), positions = sheetPositions(doc);
  assert.doesNotThrow(() => validateDropOffSheetBackgrounds(doc, sheets[3]));
  assert.deepEqual(doc, before);
  assert.deepEqual(sheetPositions(doc), positions);
});

test("Drop Off source checks fail closed for absent sheets and absent or ambiguous grids", () => {
  for (const mutate of [
    (doc) => { doc.id = "unmapped"; },
    (doc) => { doc.visible = false; },
    (doc) => { doc.children = []; },
    (doc) => { doc.children[0].visible = false; },
    (doc) => { doc.children.push(structuredClone(doc.children[0])); },
  ]) {
    const doc = documentFor(); mutate(doc);
    assert.throws(() => validateDropOffSheetBackgrounds(doc, sheets[3]), /Drop Off sheet.*unchanged/);
  }
  assert.throws(() => validateDropOffSheetBackgrounds(undefined, sheets[3]), /source sheet is missing/);
});

test("all seven selected Drop Off ancestors are checked at the requested snapshot without fetching card contents", async () => {
  const calls = [], version = "snapshot/version+1";
  const source = { fileKey: "test-file", sources: [...sheets, { id: "sheet-murky-water-1", kind: "sheet", nodeId: "other:1" }, { id: "reef-069", kind: "card", nodeId: "193:26" }] };
  const response = { nodes: Object.fromEntries(sheets.map((item) => [item.nodeId, { document: documentFor(item) }])) };
  const result = await checkDropOffSheetBackgrounds(async (route) => { calls.push(route); return response; }, source, version);
  assert.equal(result, response);
  assert.equal(calls.length, 1);
  const url = new URL(`https://api.figma.com/v1/${calls[0]}`);
  assert.deepEqual(url.searchParams.get("ids").split(","), sheets.map((item) => item.nodeId));
  assert.equal(url.searchParams.get("depth"), "2");
  assert.equal(url.searchParams.get("version"), version);
});

test("booster and other fixed-deck scopes do not gain a Drop Off background requirement", async () => {
  const source = { sources: fixedArtworkSources().filter((item) => !sheets.some((sheet) => sheet.id === item.id)) };
  assert.equal(await checkDropOffSheetBackgrounds(() => assert.fail("No Drop Off request expected"), source, "version"), null);
});

test("transparent Drop Off exports retain full Letter bounds without changing other artwork requests", () => {
  const card = { id: "reef-069", kind: "card", nodeId: "193:26" };
  const backdrop = { id: "print-template-front-background", kind: "backdrop", nodeId: "4317:7887" };
  const otherSheet = { id: "sheet-murky-water-1", kind: "sheet", nodeId: "2241:1" };
  const version = "snapshot/version+1";
  const parse = (batch) => figmaImageRoutes("test-file", batch, version)
    .map((route) => new URL(`https://api.figma.com/v1/${route}`));
  for (const batch of [sheets, [card, backdrop, otherSheet], [sheets[0], card, sheets[1], backdrop, otherSheet]]) {
    const urls = parse(batch);
    assert.equal(urls.length, batch === sheets || batch.length === 3 ? 1 : 2);
    const actual = new Map();
    for (const url of urls) {
      assert.equal(url.pathname, "/v1/images/test-file");
      assert.equal(url.searchParams.get("format"), "png");
      assert.equal(url.searchParams.get("scale"), "1");
      assert.equal(url.searchParams.get("version"), version);
      for (const id of url.searchParams.get("ids").split(",")) {
        assert.equal(actual.has(id), false, "No node is exported twice");
        actual.set(id, url.searchParams.get("use_absolute_bounds"));
      }
    }
    assert.equal(actual.size, batch.length);
    for (const item of batch)
      assert.equal(actual.get(item.nodeId), sheets.includes(item) ? "true" : null);
  }
  assert.deepEqual(figmaImageRoutes("test-file", [], version), []);
});
