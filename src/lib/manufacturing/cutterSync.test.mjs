import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildSourceMap,
  checkCutterTemplates,
  sheetPositions,
  validateCutterTemplate,
} from "../../../scripts/manufacturing/sync-figma.mjs";
import { BACK_ART_SOURCE, BACK_TEMPLATE, PRINT_LAYOUT } from "./printPlan.mjs";
import { sha256 } from "./integration.mjs";

// Recorded geometry from the owner's two Figma die-cut guides. Keep the
// fixture independent of the production constants so incorrect offsets fail.
const measuredPositions = (back = false) => {
  const xs = back
    ? [85.702392578125, 865.702392578125, 1645.702392578125]
    : [164.702392578125, 944.702392578125, 1724.702392578125];
  const ys = back
    ? [79.316650390625, 1135.9832763671875, 2192.64990234375]
    : [61.316650390625, 1117.9832763671875, 2174.64990234375];
  return ys.flatMap((y) => xs.map((x) => ({
    x, y, width: 738.59521484375, height: 1034.0333251953125,
  })));
};
function templateNode(back = false) {
  const template = back ? BACK_TEMPLATE : PRINT_LAYOUT;
  const origin = { x: -5700, y: 18125, width: 2550, height: 3300 };
  const children = measuredPositions(back).map((p, index) => ({
    id: `slot-${index}`, type: "GROUP", name: "Group",
    absoluteBoundingBox: { ...p, x: p.x + origin.x, y: p.y + origin.y },
    children: [{ type: "TEXT", characters: `${Math.floor(index / 3) + 1}:${index % 3 + 1}` }],
  }));
  // Figma child order begins with 1:2 and puts 1:1 last in these frames.
  children.push(children.shift());
  return {
    id: template.nodeId, name: template.name, type: "FRAME",
    absoluteBoundingBox: origin,
    children: [{ name: "card_backs", type: "FRAME", children }],
  };
}
const readJson = async (relative) => JSON.parse(await readFile(new URL(relative, import.meta.url), "utf8"));
const source = buildSourceMap(
  await readJson("../../data/gallery-set-list.json"),
  await readJson("../../data/gallery-images.json"),
  await readJson("../../../scripts/manufacturing/figma-holo-sources.json"),
);

test("source mapping keeps actual back artwork and records cutter geometry separately", () => {
  assert.equal(source.sources.length, 280);
  assert.equal(source.sources.find((s) => s.id === "standard-back-sheet").nodeId, "3758:338124");
  assert.equal(BACK_ART_SOURCE.nodeId, "3758:338124");
  assert.equal(source.sources.some((s) => ["4099:61637", "4099:61666"].includes(s.nodeId)), false);
  assert.equal(source.templates.version, "figma-cutter-nine-up-v2");
  assert.deepEqual(source.templates.fronts.positions, measuredPositions());
  assert.deepEqual(source.templates.backs.positions, measuredPositions(true));
  const changed = structuredClone(source);
  changed.templates.backs.positions[0].x += 1;
  assert.notEqual(sha256(Buffer.from(JSON.stringify(changed))), sha256(Buffer.from(JSON.stringify(source))));
});

test("both cutter templates produce row-major positions regardless of Figma child order", () => {
  assert.deepEqual(validateCutterTemplate(templateNode(), PRINT_LAYOUT), measuredPositions());
  assert.deepEqual(validateCutterTemplate(templateNode(true), BACK_TEMPLATE), measuredPositions(true));
  const rounded = templateNode();
  rounded.children[0].children[0].absoluteBoundingBox.x += 0.005;
  assert.doesNotThrow(() => validateCutterTemplate(rounded, PRINT_LAYOUT), "Figma floating-point rounding within 0.01 pixel is tolerated");
});

test("geometry drift, wrong pages, missing groups and invalid bounds stop a cutter sync", () => {
  for (const field of ["x", "y", "width", "height"]) {
    const changed = templateNode();
    changed.children[0].children[0].absoluteBoundingBox[field] += 0.02;
    assert.throws(() => validateCutterTemplate(changed, PRINT_LAYOUT), /differs.*0\.01 pixel/);
  }
  for (const field of ["width", "height"]) {
    const changed = templateNode();
    changed.absoluteBoundingBox[field] -= 1;
    assert.throws(() => validateCutterTemplate(changed, PRINT_LAYOUT), /2550 × 3300/);
  }
  const missing = templateNode();
  missing.children[0].children.pop();
  assert.throws(() => validateCutterTemplate(missing, PRINT_LAYOUT), /nine visible card groups/);
  const outside = templateNode();
  outside.children[0].children[0].absoluteBoundingBox.x = outside.absoluteBoundingBox.x - 1;
  assert.throws(() => validateCutterTemplate(outside, PRINT_LAYOUT), /outside the page/);
  const invalid = templateNode();
  invalid.children[0].children[0].absoluteBoundingBox.width = Number.NaN;
  assert.throws(() => validateCutterTemplate(invalid, PRINT_LAYOUT), /invalid bounds/);
  const noBounds = templateNode();
  delete noBounds.children[0].children[0].absoluteBoundingBox;
  assert.throws(() => validateCutterTemplate(noBounds, PRINT_LAYOUT), /invalid bounds/);
});

test("missing, renamed or hidden templates and grids cannot silently fall back", () => {
  assert.throws(() => validateCutterTemplate(undefined, PRINT_LAYOUT), /missing or renamed/);
  for (const change of [
    (node) => { node.id = BACK_TEMPLATE.nodeId; },
    (node) => { node.name = "Different template"; },
    (node) => { node.visible = false; },
  ]) {
    const node = templateNode();
    change(node);
    assert.throws(() => validateCutterTemplate(node, PRINT_LAYOUT), /missing or renamed/);
  }
  for (const change of [
    (node) => { node.children[0].name = "Renamed grid"; },
    (node) => { node.children[0].visible = false; },
    (node) => { node.children.push(structuredClone(node.children[0])); },
  ]) {
    const node = templateNode();
    change(node);
    assert.throws(() => validateCutterTemplate(node, PRINT_LAYOUT), /one visible card_backs/);
  }
});

test("sync reads both guides at the pinned artwork version and never exports their placeholder images", async () => {
  const calls = [];
  await checkCutterTemplates(async (route) => {
    calls.push(route);
    const url = new URL(`https://api.figma.com/v1/${route}`);
    assert.equal(url.pathname, `/v1/files/${source.fileKey}/nodes`);
    assert.equal(url.searchParams.get("version"), "saved/version+123");
    assert.equal(url.searchParams.get("ids"), "4099:61637,4099:61666");
    return { nodes: {
      [PRINT_LAYOUT.nodeId]: { document: templateNode() },
      [BACK_TEMPLATE.nodeId]: { document: templateNode(true) },
    } };
  }, source, "saved/version+123");
  assert.equal(calls.length, 1);
  await assert.rejects(checkCutterTemplates(async () => ({ nodes: {} }), source, "123"), /missing or renamed/);
  await assert.rejects(checkCutterTemplates(async () => assert.fail("Must not request an unpinned version"), source, ""), /pinned Figma version/);
  const wrongFile = structuredClone(source);
  wrongFile.templates.backs.fileKey = "another-file";
  await assert.rejects(checkCutterTemplates(async () => assert.fail("Must not mix Figma files"), wrongFile, "123"), /same versioned Figma file/);
});

test("fixed deck source geometry remains compatible with its original 720 × 1008 crops", () => {
  const positions = Array.from({ length: 9 }, (_, i) => ({
    x: 195 + (i % 3) * 720, y: 138 + Math.floor(i / 3) * 1008,
    width: 720, height: 1008,
  }));
  const document = {
    absoluteBoundingBox: { x: -4000, y: 500, width: 2550, height: 3300 },
    children: [{ name: "card_backs", children: positions.map((p) => ({
      absoluteBoundingBox: { ...p, x: p.x - 4000, y: p.y + 500 },
    })) }],
  };
  assert.deepEqual(sheetPositions(document), positions);
});
