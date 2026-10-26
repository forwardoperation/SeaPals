import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { PNG } from "pngjs";
import { buildPrintingCatalog, contentHash } from "./boosters.mjs";
import {
  PRINT_LAYOUT, V5_PRINT_LAYOUT, BACK_TEMPLATE, HOLO_PRINT_LAYOUT,
  V5_HOLO_PRINT_LAYOUT, HOLO_BACK_TEMPLATE, createManufacturingManifest,
  preflightPrintAssets,
} from "./printPlan.mjs";
import { sha256, validateRelease } from "./integration.mjs";
import { renderJob } from "../../../scripts/manufacturing/render.mjs";

const read = async name => JSON.parse(await readFile(new URL(`../../data/${name}`, import.meta.url), "utf8"));
const catalog = buildPrintingCatalog(await read("gallery-set-list.json"), await read("gallery-images.json"));
// Independent Figma measurements: only the ordinary front origin moved.
const cardWidth = 738.59521484375, cardHeight = 1034.0333251953125;
const positionsAt = x => Array.from({ length: 9 }, (_, index) => ({
  x: x + (index % 3) * (2330 / 3) + (2330 / 3 - cardWidth) / 2,
  y: 65.6435546875 + Math.floor(index / 3) * (3170 / 3) + (3170 / 3 - cardHeight) / 2,
  width: cardWidth, height: cardHeight,
}));
const colors = Array.from({ length: 9 }, (_, i) => [25 + i * 20, 180 - i * 12, 45 + i * 9]);
const sourcePositions = [106, 1114, 2122].flatMap(y =>
  [167, 887, 1607].map(x => ({ x, y, width: 720, height: 1008 })));
const identity = [1, 0, 0, 1, 0, 0];
let root, commonAssets, commonFiles, rearPixels, oldFront, newFront;

function filled(width, height, color) {
  const image = new PNG({ width, height });
  image.data.fill(Buffer.from([...color, 255]));
  return image;
}
function paint(image, { x, y, width, height }, color) {
  for (let row = y; row < y + height; row++)
    image.data.fill(Buffer.from([...color, 255]), (row * image.width + x) * 4, (row * image.width + x + width) * 4);
  return image;
}
function rgbBytes(image) {
  const bytes = Buffer.alloc(image.width * image.height * 3);
  for (let i = 0; i < image.width * image.height; i++) image.data.copy(bytes, i * 3, i * 4, i * 4 + 3);
  return bytes;
}
async function savePng(image, nodeId, extra = {}) {
  const bytes = PNG.sync.write(image), hash = sha256(bytes), file = path.join(root, `${hash}.png`);
  await writeFile(file, bytes);
  return { file, asset: { path: `manufacturing/sha256/${hash}.png`, sha256: hash, width: image.width, height: image.height, nodeId, ...extra } };
}
function templates(version) {
  const old = version === "v5";
  return { version: old ? V5_PRINT_LAYOUT.version : PRINT_LAYOUT.version,
    fronts: old ? V5_PRINT_LAYOUT : PRINT_LAYOUT, backs: BACK_TEMPLATE,
    holoFronts: old ? V5_HOLO_PRINT_LAYOUT : HOLO_PRINT_LAYOUT, holoBacks: HOLO_BACK_TEMPLATE };
}
function makeManifest(version, fixed = false) {
  const releaseId = `grid-${version}`, printTemplates = templates(version);
  const manifest = createManufacturingManifest({
    request: { orderId: `grid-${version}-${fixed ? "fixed" : "booster"}`, orderNumber: `GRID-${version.toUpperCase()}`, items: [{ productId: "reef-dive-pack", quantity: 1 }] },
    catalog, artworkRelease: releaseId, printTemplates,
    randomIndex: max => max === 10000 ? 9999 : 0,
    now: "2026-10-26T18:41:52.000Z",
  });
  if (!fixed) return manifest;
  // A single fixed-sheet fixture isolates the nine-card crop/render path.
  const { manifestHash, ...body } = manifest;
  body.order = { ...body.order, items: [{ productId: "coral-garden", quantity: 1 }] };
  body.requestHash = contentHash(body.order); body.packs = []; body.holoChecklist = [];
  body.sheets = [{ sheetId: "FIXED-001", productId: "coral-garden", unit: 1,
    fronts: { assetId: "sheet-grid-fixture" },
    backs: { assetId: "standard-back-sheet", template: structuredClone(BACK_TEMPLATE) }, slots: [] }];
  return { ...body, manifestHash: contentHash(body) };
}
function fixture(version, fixed = false) {
  const front = version === "v5" ? oldFront : newFront;
  const assets = { ...commonAssets, "print-template-front-background": front.asset };
  const assetFiles = { ...commonFiles, "print-template-front-background": front.file };
  const manifest = makeManifest(version, fixed);
  const release = validateRelease({ releaseId: manifest.artworkRelease, figmaVersion: `fixture-${version}`, catalog, printTemplates: templates(version), assets });
  return { manifest, release, assetFiles, outputDir: path.join(root, `${version}-${fixed ? "fixed" : "booster"}`), siteOrigin: "https://searealm.com" };
}

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "searealm-grid-v6-"));
  commonAssets = {}; commonFiles = {};
  async function add(id, image, nodeId, extra) {
    const saved = await savePng(image, nodeId, extra);
    commonAssets[id] = saved.asset; commonFiles[id] = saved.file;
  }
  const rear = filled(2550, 3300, [18, 90, 160]);
  paint(rear, { x: 0, y: 0, width: 1, height: 3300 }, [245, 20, 30]);
  paint(rear, { x: 2549, y: 0, width: 1, height: 3300 }, [25, 30, 245]);
  paint(rear, { x: 200, y: 250, width: 110, height: 80 }, [255, 255, 255]);
  rearPixels = rgbBytes(rear);
  await add("standard-back-sheet", rear, BACK_TEMPLATE.background.nodeId);
  // Unused holo assets are still required by the versioned-release preflight.
  await add("holographic-back-sheet", rear, HOLO_BACK_TEMPLATE.background.nodeId);
  await add("print-template-holo-front-background", rear, HOLO_PRINT_LAYOUT.background.nodeId);
  for (const [version, waterX] of [["v5", 119], ["v6", 139]]) {
    const front = paint(filled(2550, 3300, [255, 255, 255]), { x: waterX, y: 64, width: 2337, height: 3182 }, [17, 99, 151]);
    const saved = await savePng(front, PRINT_LAYOUT.background.nodeId);
    if (version === "v5") oldFront = saved; else newFront = saved;
  }
  const sheet = filled(2550, 3300, [255, 0, 255]);
  sourcePositions.forEach((position, index) => paint(sheet, position, colors[index]));
  await add("sheet-grid-fixture", sheet, "fixture-page", { positions: sourcePositions.toReversed() });
  const cards = makeManifest("v5").packs[0].cards;
  for (const [index, card] of cards.entries()) await add(card.printingId, filled(750, 1050, colors[index]), "fixture-card");
});
after(async () => {
  if (!root) return;
  assert.ok(path.resolve(root).startsWith(path.join(os.tmpdir(), "searealm-grid-v6-")));
  await rm(root, { recursive: true, force: true });
});

async function inspect(file) {
  const doc = await PDFDocument.load(await readFile(file));
  assert.equal(doc.getPageCount(), 1);
  const page = doc.getPage(0); assert.deepEqual(page.getSize(), { width: 612, height: 792 });
  const raw = page.node.lookup(PDFName.of("Contents")), streams = raw instanceof PDFArray ? raw.asArray() : [raw];
  const content = streams.map(ref => Buffer.from(decodePDFRawStream(doc.context.lookup(ref, PDFRawStream)).decode()).toString()).join("\n");
  const placements = [...content.matchAll(/\bq\s+([\s\S]*?)\s+Q\b/g)].filter(match => /\/\S+ Do/.test(match[1]))
    .map(match => [...match[1].matchAll(/^([^\n]+) cm$/gm)].map(matrix => matrix[1].trim().split(/\s+/).map(Number)));
  const images = page.node.Resources().lookup(PDFName.of("XObject")).entries().map(([, ref]) => {
    const stream = doc.context.lookup(ref, PDFRawStream);
    assert.equal(stream.dict.get(PDFName.of("Subtype")), PDFName.of("Image"));
    const maskRef = stream.dict.get(PDFName.of("SMask")), mask = maskRef ? doc.context.lookup(maskRef, PDFRawStream) : null;
    return { width: stream.dict.lookup(PDFName.of("Width")).asNumber(), height: stream.dict.lookup(PDFName.of("Height")).asNumber(), pixels: Buffer.from(decodePDFRawStream(stream).decode()),
      mask: mask ? { width: mask.dict.lookup(PDFName.of("Width")).asNumber(), height: mask.dict.lookup(PDFName.of("Height")).asNumber(),
        colorSpace: mask.dict.get(PDFName.of("ColorSpace")), bits: mask.dict.lookup(PDFName.of("BitsPerComponent")).asNumber(),
        pixels: Buffer.from(decodePDFRawStream(mask).decode()) } : null };
  });
  return { content, placements, images };
}
function close(actual, expected, label) {
  assert.equal(actual.length, expected.length, label);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-7, `${label}: matrix term ${index}`));
}
function placement(actual, position, label) {
  assert.equal(actual.length, 4, label);
  close(actual[0], [1, 0, 0, 1, position.x * .24, 792 - (position.y + position.height) * .24], `${label} translation`);
  close(actual[1], identity, `${label} rotation`);
  close(actual[2], [position.width * .24, 0, 0, position.height * .24, 0, 0], `${label} scale`);
  close(actual[3], identity, `${label} skew`);
}
function assertFront(output, version, fixed) {
  assert.equal(output.placements.length, 10); assert.equal(output.images.length, 10);
  placement(output.placements[0], { x: 0, y: 0, width: 2550, height: 3300 }, "native full-page backdrop");
  const positions = positionsAt(version === "v5" ? 135 : 150);
  positions.forEach((position, index) => {
    placement(output.placements[index + 1], position, `card ${index + 1}`);
    assert.deepEqual([output.images[index + 1].width, output.images[index + 1].height], fixed ? [720, 1008] : [750, 1050]);
    assert.deepEqual([...output.images[index + 1].pixels.subarray(0, 3)], colors[index], "Native cards retain source reading order");
  });
  const waterX = version === "v5" ? 119 : 139, background = output.images[0];
  assert.deepEqual([background.width, background.height], [2550, 3300]);
  const pixelAt = x => [...background.pixels.subarray((64 * 2550 + x) * 3, (64 * 2550 + x) * 3 + 3)];
  assert.deepEqual(pixelAt(waterX - 1), [255, 255, 255]);
  assert.deepEqual(pixelAt(waterX), [17, 99, 151], "Water shift is baked into the native backdrop, not a second page translation");
}
function assertRear(output) {
  assert.equal(output.placements.length, 1); assert.equal(output.images.length, 1);
  placement(output.placements[0], { x: 0, y: 0, width: 2550, height: 3300 }, "native Canon page");
  assert.deepEqual([output.images[0].width, output.images[0].height], [2550, 3300]);
  assert.ok(output.images[0].pixels.equals(rearPixels), "Complete native rear pixels retain logo and edge locations");
}

for (const fixed of [false, true]) test(`V6 ${fixed ? "fixed nine-card sheets" : "ordinary boosters"} move only card origins by 15 pixels while saved V5 renders remain unchanged`, async () => {
  assert.equal(PRINT_LAYOUT.version, "figma-cutter-nine-up-v6");
  assert.equal(V5_PRINT_LAYOUT.version, "figma-cutter-nine-up-v5");
  const fronts = [];
  for (const version of ["v5", "v6"]) {
    const args = fixture(version, fixed), savedManifest = JSON.stringify(args.manifest), savedRelease = JSON.stringify(args.release);
    assert.equal(preflightPrintAssets(args.manifest, args.release).ready, true);
    const jobs = await renderJob(args);
    const front = await inspect(jobs.find(job => job.side === "fronts").file);
    const rear = await inspect(jobs.find(job => job.side === "backs").file);
    assertFront(front, version, fixed); assertRear(rear); fronts.push(front);
    assert.equal(JSON.stringify(args.manifest), savedManifest, "Rendering must not migrate a pinned manifest");
    assert.equal(JSON.stringify(args.release), savedRelease, "Rendering must not rewrite a pinned release");
  }
  for (let index = 1; index <= 9; index++) {
    const old = fronts[0].placements[index], current = fronts[1].placements[index];
    close(current[0], [...old[0].slice(0, 4), old[0][4] + 3.6, old[0][5]], "15px horizontal shift at 300dpi");
    assert.deepEqual(current.slice(1), old.slice(1), "Rotation, scale, and skew remain unchanged");
  }
});

test("V5 and V6 manifests reject the other release geometry before rendering any PDF", async () => {
  for (const version of ["v5", "v6"]) {
    const args = fixture(version), other = templates(version === "v5" ? "v6" : "v5");
    const mixed = { ...args.release, printTemplates: other };
    assert.equal(preflightPrintAssets(args.manifest, mixed).ready, false);
    const outputDir = path.join(root, `reject-${version}`);
    await assert.rejects(renderJob({ ...args, release: mixed, outputDir }), /matching versioned|matching.*templates/);
    await assert.rejects(readdir(outputDir), { code: "ENOENT" });
  }
});


test("fixed source crops preserve transparent and translucent edges as PDF soft masks over the ocean backdrop", async () => {
  const args = fixture("v6", true), source = new PNG({ width: 2550, height: 3300 });
  for (const [index, p] of sourcePositions.entries()) {
    paint(source, { x: p.x + 2, y: p.y + 2, width: p.width - 4, height: p.height - 4 }, colors[index]);
    // Include an antialiased edge pixel as well as completely transparent edges.
    source.data.set([...colors[index], 128], ((p.y + 1) * source.width + p.x + 1) * 4);
  }
  const saved = await savePng(source, "fixture-page", { positions: sourcePositions.toReversed() });
  args.release.assets["sheet-grid-fixture"] = saved.asset;
  args.assetFiles["sheet-grid-fixture"] = saved.file;
  args.outputDir = path.join(root, "v6-transparent-fixed");
  const jobs = await renderJob(args), front = await inspect(jobs.find(job => job.side === "fronts").file);
  assert.equal(front.images.length, 10); assert.equal(front.placements.length, 10);
  placement(front.placements[0], { x: 0, y: 0, width: 2550, height: 3300 }, "ocean below transparent crops");
  const expectedAlpha = Buffer.alloc(720 * 1008);
  for (let y = 2; y < 1006; y++) expectedAlpha.fill(255, y * 720 + 2, y * 720 + 718);
  expectedAlpha[721] = 128;
  for (const [index, position] of positionsAt(150).entries()) {
    const card = front.images[index + 1];
    placement(front.placements[index + 1], position, `transparent card ${index + 1}`);
    assert.deepEqual([card.width, card.height], [720, 1008]);
    assert.ok(card.mask, "A transparent crop must retain its PDF SMask instead of flattening against white");
    assert.deepEqual([card.mask.width, card.mask.height], [720, 1008]);
    assert.equal(card.mask.colorSpace, PDFName.of("DeviceGray")); assert.equal(card.mask.bits, 8);
    assert.ok(card.mask.pixels.equals(expectedAlpha), "All transparent, translucent, and opaque source alpha pixels survive cropping and embedding");
    const opaquePixel = (500 * 720 + 350) * 3;
    assert.deepEqual([...card.pixels.subarray(opaquePixel, opaquePixel + 3)], colors[index]);
    const backgroundPixel = (Math.floor(position.y) * 2550 + Math.floor(position.x)) * 3;
    assert.deepEqual([...front.images[0].pixels.subarray(backgroundPixel, backgroundPixel + 3)], [17, 99, 151],
      "The transparent card corner exposes the already-drawn ocean backdrop");
  }
});
