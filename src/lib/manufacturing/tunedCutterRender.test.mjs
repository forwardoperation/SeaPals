import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { PNG } from "pngjs";
import { BOOSTER_POLICY, contentHash } from "./boosters.mjs";
import { PRINT_LAYOUT, BACK_TEMPLATE } from "./printPlan.mjs";
import { sha256 } from "./integration.mjs";
import { renderJob } from "../../../scripts/manufacturing/render.mjs";

// Independent native measurements at Figma version 2412156090472208619.
// These origins are before rotation, not each card's enclosing raster bounds.
const rotation = 0.35000001238844786,
  width = 738.59521484375, height = 1034.0333251953125,
  measuredSlots = [
    [0, 153.89588928222656, 54.32331466674805],
    [6, 140.9864044189453, 2167.6171875],
    [8, 1694.2908935546875, 2177.10595703125],
  ],
  measuredBackdrop = {
    x: 82.17547827214003, y: 19.641708374023438,
    width: 2438.649044044316, height: 3238.7165909940377,
  },
  water = [17, 99, 151],
  colors = Array.from({ length: 9 }, (_, index) => [30 + index * 20, 170 - index * 13, 55 + index * 11]),
  fixedPositions = [138, 1146, 2154].flatMap((y) =>
    [195, 918, 1641].map((x) => ({ x, y, width: 720, height: 1008 })));

function paint(png, rect, color) {
  for (let y = rect.y; y < rect.y + rect.height; y++)
    for (let x = rect.x; x < rect.x + rect.width; x++)
      png.data.set([...color, 255], (y * png.width + x) * 4);
  return png;
}
function filled(width, height, color) {
  return paint(new PNG({ width, height }), { x: 0, y: 0, width, height }, color);
}
async function fixture(dir, { fixed = false } = {}) {
  assert.equal(PRINT_LAYOUT.version, "figma-cutter-nine-up-v4");
  const order = {
    orderId: "10000000-0000-4000-8000-000000000004",
    orderNumber: "TUNED-CUTTER",
    items: [{ productId: fixed ? "coral-garden" : "reef-dive-pack", quantity: 1 }],
  },
    layout = structuredClone(PRINT_LAYOUT),
    printTemplates = { version: layout.version, fronts: layout, backs: structuredClone(BACK_TEMPLATE) },
    body = {
      schemaVersion: 1, order, requestHash: contentHash(order),
      artworkRelease: "tuned-cutter-render-test", policy: BOOSTER_POLICY,
      layout, packs: [], holoChecklist: [], accessoryChecklist: [],
      sheets: [{
        sheetId: "TUNED-CUTTER-001",
        ...(fixed ? { productId: "coral-garden" } : { set: "reef" }),
        fronts: fixed ? { assetId: "sheet-tuned" } : { assetIds: colors.map((_, index) => `reef-${index + 1}`) },
        backs: { assetId: "standard-back-sheet", template: structuredClone(BACK_TEMPLATE) },
        slots: fixed ? [] : layout.positions.map((p, index) => ({ ...p, printingId: `reef-${index + 1}`, slot: index + 1 })),
      }],
    },
    manifest = { ...body, manifestHash: contentHash(body) }, assets = {}, assetFiles = {};
  async function asset(id, png, extra = {}) {
    const bytes = PNG.sync.write(png), checksum = sha256(bytes);
    assetFiles[id] = path.join(dir, `${id}.png`);
    await writeFile(assetFiles[id], bytes);
    assets[id] = { path: `manufacturing/sha256/${checksum}.png`, sha256: checksum, width: png.width, height: png.height, ...extra };
  }
  const rear = filled(2550, 3300, water);
  // Distinct corners and nine white logo stand-ins catch cropping, reflection,
  // or rebuilding the complete rear page from just its first card.
  paint(rear, { x: 0, y: 0, width: 1, height: 3300 }, [250, 20, 30]);
  paint(rear, { x: 2549, y: 0, width: 1, height: 3300 }, [20, 30, 250]);
  for (const p of fixedPositions)
    paint(rear, { x: p.x + 200, y: p.y + 450, width: 150, height: 60 }, [255, 255, 255]);
  await asset("standard-back-sheet", rear, { nodeId: "4244:451219" });
  await asset("print-template-front-background", filled(2439, 3239, water), { nodeId: "4116:234587" });
  if (fixed) {
    const source = filled(2550, 3300, [255, 0, 255]);
    for (const [index, rect] of fixedPositions.entries()) paint(source, rect, colors[index]);
    await asset("sheet-tuned", source, { positions: fixedPositions.toReversed() });
  } else {
    for (const [index, color] of colors.entries())
      await asset(`reef-${index + 1}`, filled(750, 1050, color));
  }
  return {
    manifest, release: { releaseId: manifest.artworkRelease, assets, printTemplates },
    assetFiles, outputDir: dir, siteOrigin: "https://searealm.com",
  };
}
async function inspect(file) {
  const doc = await PDFDocument.load(await readFile(file));
  assert.equal(doc.getPageCount(), 1);
  const page = doc.getPage(0);
  assert.deepEqual(page.getSize(), { width: 612, height: 792 });
  const raw = page.node.lookup(PDFName.of("Contents")),
    streams = raw instanceof PDFArray ? raw.asArray() : [raw],
    content = streams.map((ref) => Buffer.from(decodePDFRawStream(doc.context.lookup(ref, PDFRawStream)).decode()).toString()).join("\n"),
    placements = [...content.matchAll(/\bq\s+([\s\S]*?)\s+Q\b/g)]
      .filter((match) => /\/\S+ Do/.test(match[1]))
      .map((match) => [...match[1].matchAll(/^([^\n]+) cm$/gm)].map((matrix) => matrix[1].trim().split(/\s+/).map(Number))),
    xobjects = page.node.Resources().lookup(PDFName.of("XObject")),
    refs = [...new Map(xobjects.entries().map(([, ref]) => [ref.toString(), ref])).values()],
    images = refs.map((ref) => {
      const stream = doc.context.lookup(ref, PDFRawStream);
      return {
        width: stream.dict.lookup(PDFName.of("Width")).asNumber(),
        height: stream.dict.lookup(PDFName.of("Height")).asNumber(),
        pixels: decodePDFRawStream(stream).decode(),
      };
    });
  return { content, placements, images };
}
function close(actual, expected, label) {
  assert.equal(actual.length, expected.length, label);
  actual.forEach((number, index) => assert.ok(Math.abs(number - expected[index]) < 1e-7, `${label}, term ${index}: ${number} != ${expected[index]}`));
}
function assertTunedFront(front) {
  assert.equal(front.placements.length, 10);
  // The exported ocean's own rotation is already baked into its raster; it
  // must be drawn axis-aligned in its fractional enclosing bounds exactly once.
  const [translation, turn, scale] = front.placements[0];
  close(translation, [1, 0, 0, 1, measuredBackdrop.x * 0.24, 792 - (measuredBackdrop.y + measuredBackdrop.height) * 0.24], "backdrop translation");
  close(turn, [1, 0, 0, 1, 0, 0], "no second backdrop rotation");
  close(scale, [measuredBackdrop.width * 0.24, 0, 0, measuredBackdrop.height * 0.24, 0, 0], "backdrop size");
  const cos = Math.cos(rotation * Math.PI / 180), sin = Math.sin(rotation * Math.PI / 180);
  for (const [index, x, y] of measuredSlots) {
    const [translation, turn, scale] = front.placements[index + 1];
    close(translation, [1, 0, 0, 1, (x - sin * height) * 0.24, 792 - (y + cos * height) * 0.24], `slot ${index + 1} bottom-left`);
    close(turn, [cos, -sin, sin, cos, 0, 0], `slot ${index + 1} rotation`);
    close(scale, [width * 0.24, 0, 0, height * 0.24, 0, 0], `slot ${index + 1} size`);
    // Applying the PDF transform to the image's upper-left must recover the
    // independent Figma origin, including the drift down the bottom row.
    close([translation[4] + turn[2] * scale[3], translation[5] + turn[3] * scale[3]], [x * 0.24, 792 - y * 0.24], `slot ${index + 1} Figma origin`);
  }
  assert.doesNotMatch(front.content, /\b(?:BT|Tj|TJ|re|S|f)\b/);
  assert.equal(front.images.length, 10);
  assert.deepEqual([front.images[0].width, front.images[0].height], [2439, 3239]);
  assert.deepEqual([...front.images[0].pixels.slice(0, 3)], water);
  front.images.slice(1).forEach((image, index) => assert.deepEqual([...image.pixels.slice(0, 3)], colors[index]));
}
async function temporary(action) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "searealm-tuned-render-"));
  try { return await action(dir); }
  finally {
    assert.ok(path.resolve(dir).startsWith(path.join(os.tmpdir(), "searealm-tuned-render-")));
    await rm(dir, { recursive: true, force: true });
  }
}

test("v4 booster fronts preserve the tuned Figma rotation and first/bottom-row origins", () => temporary(async (dir) => {
  const jobs = await renderJob(await fixture(dir));
  assertTunedFront(await inspect(jobs.find((job) => job.side === "fronts").file));
}));

test("v4 rear PDF embeds the complete water-and-logo page once without cropping or reimposition", () => temporary(async (dir) => {
  const args = await fixture(dir), jobs = await renderJob(args),
    rear = await inspect(jobs.find((job) => job.side === "backs").file);
  assert.equal(rear.placements.length, 1);
  close(rear.placements[0][0], [1, 0, 0, 1, 0, 0], "full-page rear origin");
  close(rear.placements[0][1], [1, 0, 0, 1, 0, 0], "no extra rear rotation");
  close(rear.placements[0][2], [612, 0, 0, 792, 0, 0], "full Letter page");
  assert.equal(rear.images.length, 1);
  assert.deepEqual([rear.images[0].width, rear.images[0].height], [2550, 3300]);
  const expected = PNG.sync.read(await readFile(args.assetFiles["standard-back-sheet"])),
    actual = rear.images[0].pixels;
  assert.equal(actual.length, expected.width * expected.height * 3);
  for (const [x, y] of [[0, 0], [2549, 0], [0, 3299], [2549, 3299], [1000, 2000], ...fixedPositions.map((p) => [p.x + 220, p.y + 470])]) {
    const pixel = y * expected.width + x;
    assert.deepEqual([...actual.slice(pixel * 3, pixel * 3 + 3)], [...expected.data.slice(pixel * 4, pixel * 4 + 3)], `rear pixel ${x},${y}`);
  }
  assert.doesNotMatch(rear.content, /\b(?:BT|Tj|TJ|re|S|f)\b/);
}));

test("v4 fixed-sheet crops use the same tuned rotation and reading order as boosters", () => temporary(async (dir) => {
  const jobs = await renderJob(await fixture(dir, { fixed: true })),
    front = await inspect(jobs.find((job) => job.side === "fronts").file);
  assertTunedFront(front);
  for (const image of front.images.slice(1)) assert.deepEqual([image.width, image.height], [720, 1008]);
}));

test("missing, wrong-source, tampered and corrupt v4 background assets stop before any PDF", () => temporary(async (dir) => {
  const base = await fixture(dir), id = "standard-back-sheet";
  const cases = [
    ["missing", (release) => { delete release.assets[id]; }, null, /background|backdrop/i],
    ["wrong-source", (release) => { release.assets[id].nodeId = "3758:338124"; }, null, /background|backdrop/i],
    ["wrong-size", (release) => { release.assets[id].height = 3299; }, null, /background|backdrop|dimensions/i],
    ["tampered", () => {}, Buffer.from("not the saved PNG"), /checksum/i],
    ["corrupt", (release) => {
      release.assets[id].sha256 = sha256(Buffer.from("not a PNG"));
      release.assets[id].path = `manufacturing/sha256/${release.assets[id].sha256}.png`;
    }, Buffer.from("not a PNG"), /PNG|buffer|stream|signature/i],
  ];
  for (const [name, mutate, bytes, message] of cases) {
    const release = structuredClone(base.release), assetFiles = { ...base.assetFiles }, outputDir = path.join(dir, `output-${name}`);
    mutate(release);
    if (bytes) {
      assetFiles[id] = path.join(dir, `${name}.png`);
      await writeFile(assetFiles[id], bytes);
    }
    await assert.rejects(renderJob({ ...base, release, assetFiles, outputDir }), message, name);
    assert.deepEqual(await readdir(outputDir).catch((error) => error.code === "ENOENT" ? [] : Promise.reject(error)), [], name);
  }
}));
