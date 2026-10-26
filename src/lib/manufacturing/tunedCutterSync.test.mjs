import test from "node:test";
import assert from "node:assert/strict";
import { checkCutterTemplates, validateCutterTemplate } from "../../../scripts/manufacturing/sync-figma.mjs";
import { V4_BACK_TEMPLATE as BACK_TEMPLATE, V4_PRINT_LAYOUT as PRINT_LAYOUT } from "./printPlan.mjs";

// Geometry-only fixtures transcribed from pinned Figma version
// 2412156090472208619. They contain no image references, vector paths, or card
// artwork. Native sizes/transforms deliberately differ from rotated bounds.
const C = 0.9999813437461853, S = 0.00610861461609602,
  white = () => ({ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }),
  move = (x = 0, y = 0) => [[1, 0, x], [0, 1, y]],
  turned = (x, y) => [[C, -S, x], [S, C, y]],
  expectedFronts = [
    [153.89588928222656, 54.32331466674805],
    [930.5480346679688, 59.06767272949219],
    [1707.200439453125, 63.812034606933594],
    [147.4411163330078, 1110.97021484375],
    [924.09326171875, 1115.714599609375],
    [1700.7457275390625, 1120.458984375],
    [140.9864044189453, 2167.6171875],
    [917.6384887695312, 2172.361572265625],
    [1694.2908935546875, 2177.10595703125],
  ];
function templateNode(rear = false) {
  const origin = rear ? 2842 : 0,
    xs = rear ? [19.033355712890625, 795.7000732421875, 1572.36669921875]
      : [19.035736083984375, 795.702392578125, 1572.369140625],
    ys = rear ? [11.31329345703125, 1067.97998046875, 2124.646484375]
      : [11.316650390625, 1067.9832763671875, 2124.64990234375];
  return {
    id: rear ? "4244:451219" : "4099:61637",
    name: rear ? "die-cut-rear-canon" : "die-cut-front-epson",
    type: "FRAME", size: { x: 2550, y: 3300 },
    absoluteBoundingBox: { x: origin, y: 0, width: 2550, height: 3300 },
    relativeTransform: move(origin, 0), fills: [white()],
    children: [{
      id: rear ? "4244:451220" : "4116:234587", type: "RECTANGLE",
      size: rear ? { x: 2417, y: 3255 } : { x: 2419, y: 3224 },
      relativeTransform: rear ? move(36, 20) : turned(101.8696517944336, 19.641708374023438),
      absoluteBoundingBox: rear
        ? { x: 2878, y: 20, width: 2417, height: 3255 }
        : { x: 82.17547827214003, y: 19.641708374023438, width: 2438.649044044316, height: 3238.7165909940377 },
      fills: [{ type: "IMAGE", blendMode: "NORMAL", scaleMode: "TILE" }],
    }, {
      name: "card_backs", type: "FRAME", size: { x: 2330, y: 3170 }, fills: [],
      relativeTransform: rear ? move(75, 68) : turned(134.9296875, 42.890625),
      children: ys.flatMap((y) => xs.map((x) => ({
        type: rear ? "INSTANCE" : "GROUP", relativeTransform: move(x, y),
        size: rear ? { x: 738.5999755859375, y: 1034.0400390625 }
          : { x: 738.59521484375, y: 1034.0333251953125 },
        fills: [], ...(rear ? { componentId: "540:2527" } : {}),
        children: rear ? [{
          // The inherited original card image is hidden in the tuned template.
          type: "INSTANCE", name: "card-back", visible: false,
          fills: [{ type: "IMAGE" }],
        }, {
          type: "INSTANCE", name: "searealm-tcg-logo", fills: [],
          effects: [{ type: "DROP_SHADOW", blendMode: "NORMAL", radius: 3.939199924468994,
            offset: { x: 0, y: 3.939199924468994 }, color: { r: 0, g: 0, b: 0, a: 0.25 } }],
          children: [
            { type: "TEXT", name: "TRADING CARD GAME", fills: [white()] },
            { type: "GROUP", fills: [], children: [{ type: "BOOLEAN_OPERATION", fills: [white()],
              children: [{ type: "VECTOR", fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }] }] }] },
          ],
        }] : [{
          type: "RECTANGLE", size: { x: 738.59521484375, y: 1034.0333251953125 },
          relativeTransform: move(-0.00005153835081728175, -0.00002970209789054934),
          absoluteBoundingBox: { x: 147.5793781984081, y: 54.32331466674805, width: 744.897946507774, height: 1038.525827531918 },
        }, { type: "TEXT", characters: "Front guide only" }],
      }))),
    }],
  };
}
const grid = (node) => node.children[1];
const first = (node) => grid(node).children[0];
const logo = (node) => first(node).children[1];
function close(actual, expected, label, tolerance = 0.001) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} != ${expected}`);
}

test("v4 native front transforms retain the inherited angle and all nine measured origins", () => {
  const node = templateNode();
  grid(node).children.reverse();
  const positions = validateCutterTemplate(node, PRINT_LAYOUT);
  positions.forEach((p, index) => {
    close(p.x, expectedFronts[index][0], `slot ${index + 1} x`);
    close(p.y, expectedFronts[index][1], `slot ${index + 1} y`);
    close(p.rotation, 0.35000001238844786, `slot ${index + 1} inherited rotation`, 1e-6);
    assert.equal(p.width, 738.59521484375);
    assert.equal(p.height, 1034.0333251953125);
    assert.notEqual(p.width, first(node).children[0].absoluteBoundingBox.width);
    assert.notEqual(p.height, first(node).children[0].absoluteBoundingBox.height);
  });
});

test("v4 composes grid, group and rectangle transforms instead of using enclosing boxes", () => {
  const node = templateNode(), before = validateCutterTemplate(node, PRINT_LAYOUT);
  // Moving a rectangle within its group and compensating its group placement
  // preserves its page origin after the parent's 0.35 degree rotation.
  first(node).relativeTransform[0][2] -= 5;
  first(node).relativeTransform[1][2] += 3;
  first(node).children[0].relativeTransform[0][2] += 5;
  first(node).children[0].relativeTransform[1][2] -= 3;
  first(node).children[0].absoluteBoundingBox.width += 20;
  const after = validateCutterTemplate(node, PRINT_LAYOUT);
  for (const key of ["x", "y", "width", "height", "rotation"])
    close(after[0][key], before[0][key], key, 1e-9);
});

test("v4 missing native geometry, dimension changes, rotation drift and affine distortion block sync", () => {
  const changes = [
    [(node) => { delete node.relativeTransform; }, /native transforms.*geometry=paths/],
    [(node) => { delete grid(node).relativeTransform; }, /native transforms/],
    [(node) => { delete first(node).children[0].relativeTransform; }, /native transforms/],
    [(node) => { delete first(node).children[0].size; }, /differs from the saved geometry/],
    [(node) => { first(node).children[0].size.x = 744.897946507774; }, /differs from the saved geometry/],
    [(node) => { grid(node).size.x += 1; }, /native grid size/],
    [(node) => { first(node).relativeTransform[0][2] += 0.02; }, /differs from the saved geometry/],
    [(node) => {
      const r = 0.45 * Math.PI / 180, m = grid(node).relativeTransform;
      grid(node).relativeTransform = [[Math.cos(r), -Math.sin(r), m[0][2]], [Math.sin(r), Math.cos(r), m[1][2]]];
    }, /differs from the saved geometry/],
    [(node) => { first(node).relativeTransform[0][0] = 1.01; }, /scaling, mirroring, or shear/],
    [(node) => { first(node).relativeTransform[0][0] = -1; }, /scaling, mirroring, or shear/],
    [(node) => { first(node).relativeTransform[0][1] = 0.1; }, /scaling, mirroring, or shear/],
    [(node) => { node.size.y = 3299; }, /2550.*3300/],
    [(node) => { node.relativeTransform = turned(0, 0); }, /page itself must not be rotated/],
  ];
  for (const [change, message] of changes) {
    const node = templateNode();
    change(node);
    assert.throws(() => validateCutterTemplate(node, PRINT_LAYOUT), message);
  }
});

test("v4 front and full rear pages reject hidden, contaminated or displaced water backgrounds", () => {
  const changes = [
    (node) => { node.children[0].visible = false; },
    (node) => { node.children.reverse(); },
    (node) => { node.children[0].id = "unexpected-source"; },
    (node) => { node.children[0].fills = [white()]; },
    (node) => { node.children[0].fills[0].opacity = 0.5; },
    (node) => { node.children[0].fills[0].blendMode = "MULTIPLY"; },
    (node) => { node.children[0].children = [{ type: "TEXT", characters: "1:1" }]; },
    (node) => { node.children[0].strokes = [white()]; },
    (node) => { node.children[0].effects = [{ type: "DROP_SHADOW" }]; },
    (node) => { node.children[0].isMask = true; },
    (node) => { node.children[0].absoluteBoundingBox.x += 0.02; },
    (node) => { node.children[0].relativeTransform = turned(0, 0); },
    (node) => { node.fills[0].color.b = 0; },
    (node) => { node.fills[0].opacity = 0.5; },
    (node) => { node.fills[0].blendMode = "MULTIPLY"; },
    (node) => { node.fills[0].color.a = 0.5; },
    (node) => { grid(node).fills = [white()]; },
    (node) => { node.children.push({ type: "TEXT", characters: "Print guide" }); },
  ];
  for (const rear of [false, true]) {
    const template = rear ? BACK_TEMPLATE : PRINT_LAYOUT;
    for (const [index, change] of changes.entries()) {
      // The existing front matrix is intentionally rotated; setting it to the
      // same angle only changes translation, which is checked via raster bounds.
      if (!rear && index === 11) continue;
      const node = templateNode(rear);
      change(node);
      assert.throws(() => validateCutterTemplate(node, template), /Cutter template/, `${rear ? "rear" : "front"} contamination ${index}`);
    }
  }
});

test("v4 Canon template permits only the nine transparent white logos over its ocean", () => {
  const positions = validateCutterTemplate(templateNode(true), BACK_TEMPLATE);
  assert.equal(positions.length, 9);
  close(positions[0].x, 94.033447265625, "rear first x");
  close(positions[8].y, 2192.646484375, "rear last y");
  positions.forEach((p) => {
    assert.equal(p.rotation, 0);
    assert.equal(p.width, 738.5999755859375);
    assert.equal(p.height, 1034.0400390625);
  });
  const changes = [
    (node) => { first(node).fills = [white()]; },
    (node) => { first(node).componentId = "unexpected-card"; },
    (node) => { first(node).children[0].visible = true; },
    (node) => { logo(node).name = "Another logo"; },
    (node) => { logo(node).visible = false; },
    (node) => { logo(node).children[0].fills[0].color.r = 0; },
    (node) => { logo(node).children[0].fills[0].opacity = 0.5; },
    (node) => { logo(node).children[0].fills[0].blendMode = "MULTIPLY"; },
    (node) => { logo(node).children[0].fills[0].color.a = 0.5; },
    (node) => { logo(node).children[0].fills = [{ type: "IMAGE" }]; },
    (node) => { logo(node).effects[0].radius += 1; },
    (node) => { logo(node).children[0].effects = [{ type: "DROP_SHADOW" }]; },
    (node) => { first(node).children.push({ type: "TEXT", characters: "1:1 Back" }); },
    (node) => { grid(node).children.pop(); },
  ];
  for (const [index, change] of changes.entries()) {
    const node = templateNode(true);
    change(node);
    assert.throws(() => validateCutterTemplate(node, BACK_TEMPLATE), /Cutter template/, `rear contamination ${index}`);
  }
});

test("v4 template reads pin the Figma version and request native transform geometry", async () => {
  const source = {
    fileKey: "xeol2YE0jCE0N5vAD6tjzx",
    templates: { version: "figma-cutter-nine-up-v4", fronts: PRINT_LAYOUT, backs: BACK_TEMPLATE },
  }, calls = [];
  await checkCutterTemplates(async (route) => {
    calls.push(route);
    const url = new URL(`https://api.figma.com/v1/${route}`);
    assert.equal(url.searchParams.get("ids"), "4099:61637,4244:451219");
    assert.equal(url.searchParams.get("geometry"), "paths");
    assert.equal(url.searchParams.get("version"), "pinned/version+123");
    return { nodes: {
      "4099:61637": { document: templateNode() },
      "4244:451219": { document: templateNode(true) },
    } };
  }, source, "pinned/version+123");
  assert.equal(calls.length, 1);
  await assert.rejects(checkCutterTemplates(async () => ({ nodes: {} }), source, "123"), /missing or renamed/);
});
