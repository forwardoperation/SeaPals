import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { PNG } from 'pngjs';
import { buildPrintingCatalog, contentHash } from './boosters.mjs';
import { PRINT_LAYOUT, BACK_TEMPLATE, HOLO_PRINT_LAYOUT, HOLO_BACK_TEMPLATE, V6_PRINT_LAYOUT, V6_BACK_TEMPLATE, V6_HOLO_PRINT_LAYOUT, V6_HOLO_BACK_TEMPLATE, createManufacturingManifest } from './printPlan.mjs';
import { createHoloBatch } from './holoBatch.mjs';
import { sha256, validateRelease } from './integration.mjs';
import { renderJob, renderHoloBatch } from '../../../scripts/manufacturing/render.mjs';

const read = async name => JSON.parse(await readFile(new URL(`../../data/${name}`, import.meta.url), 'utf8'));
const catalog = buildPrintingCatalog(await read('gallery-set-list.json'), await read('gallery-images.json'));
const holo = catalog.find(card => card.set === 'reef' && card.rarity === 'Holo Rare');
const templates = { version: PRINT_LAYOUT.version, fronts: PRINT_LAYOUT, backs: BACK_TEMPLATE, holoFronts: HOLO_PRINT_LAYOUT, holoBacks: HOLO_BACK_TEMPLATE };
const oldTemplates = { version: V6_PRINT_LAYOUT.version, fronts: V6_PRINT_LAYOUT, backs: V6_BACK_TEMPLATE, holoFronts: V6_HOLO_PRINT_LAYOUT, holoBacks: V6_HOLO_BACK_TEMPLATE };
const cardWidth = 738.59521484375, cardHeight = 1034.0333251953125;
const positionsAt = x => Array.from({ length: 9 }, (_, i) => ({
  x: x + (i % 3) * (2330 / 3) + (2330 / 3 - cardWidth) / 2,
  y: 65.6435546875 + Math.floor(i / 3) * (3170 / 3) + (3170 / 3 - cardHeight) / 2,
  width: cardWidth, height: cardHeight,
}));
const sourcePositions = [106, 1114, 2122].flatMap(y => [167, 887, 1607].map(x => ({ x, y, width: 720, height: 1008 })));
const colors = Array.from({ length: 9 }, (_, i) => [30 + i * 20, 180 - i * 10, 60 + i * 8]);
const identity = [1, 0, 0, 1, 0, 0];
let root, assets, assetFiles, release, rearPixels, holoRearPixels;

function image(width, height, color) {
  const result = new PNG({ width, height });
  if (color) result.data.fill(Buffer.from([...color, 255]));
  return result;
}
function paint(target, x, y, width, height, color) {
  for (let row = y; row < y + height; row++) target.data.fill(Buffer.from([...color, 255]), (row * target.width + x) * 4, (row * target.width + x + width) * 4);
}
function rgbBytes(png) {
  const bytes = Buffer.alloc(png.width * png.height * 3);
  for (let i = 0; i < png.width * png.height; i++) png.data.copy(bytes, i * 3, i * 4, i * 4 + 3);
  return bytes;
}
async function add(id, png, nodeId, extra = {}) {
  const bytes = PNG.sync.write(png), hash = sha256(bytes), file = path.join(root, `${hash}.png`);
  await writeFile(file, bytes);
  assets[id] = { nodeId, width: png.width, height: png.height, sha256: hash, path: `manufacturing/sha256/${hash}.png`, ...extra };
  assetFiles[id] = file;
}
function manifest(fixed = false) {
  const created = createManufacturingManifest({ request: { orderId: `v7-${fixed ? 'fixed' : 'booster'}`, orderNumber: 'V7-LOCAL-TEST', items: [{ productId: 'reef-dive-pack', quantity: 1 }] },
    catalog, artworkRelease: 'v7-render-test', printTemplates: templates, randomIndex: max => max === 10000 ? 9999 : 0, now: '2026-10-28T12:00:00.000Z' });
  if (!fixed) return created;
  const { manifestHash, ...body } = created;
  body.order = { ...body.order, items: [{ productId: 'coral-garden', quantity: 1 }] };
  body.requestHash = contentHash(body.order); body.packs = []; body.holoChecklist = [];
  body.sheets = [{ sheetId: 'FIXED-001', productId: 'coral-garden', unit: 1, fronts: { assetId: 'sheet-v7-fixture' },
    backs: { assetId: 'standard-back-sheet', template: structuredClone(BACK_TEMPLATE) }, slots: [] }];
  return { ...body, manifestHash: contentHash(body) };
}

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'searealm-v7-render-')); assets = {}; assetFiles = {};
  for (const [template, waterX] of [[PRINT_LAYOUT, 134], [HOLO_PRINT_LAYOUT, 86]]) {
    const front = image(2550, 3300, [255, 255, 255]); paint(front, waterX, 64, 2337, 3182, [17, 99, 151]);
    await add(template.background.assetId, front, template.background.nodeId);
  }
  for (const [template, gridX, baseColor] of [[BACK_TEMPLATE, 65, [23, 98, 170]], [HOLO_BACK_TEMPLATE, 110, [35, 70, 160]]]) {
    const rear = image(2550, 3300, baseColor);
    // Distinct edge and alignment markers are already baked into each native
    // rear PNG; the renderer must not crop, mirror, or apply the grid twice.
    paint(rear, 0, 0, 1, 3300, [250, 10, 20]); paint(rear, 2549, 0, 1, 3300, [20, 10, 250]);
    paint(rear, gridX + 19, 97, 10, 10, [255, 255, 255]);
    if (gridX === 65) rearPixels = rgbBytes(rear); else holoRearPixels = rgbBytes(rear);
    await add(template.background.assetId, rear, template.background.nodeId);
  }
  const ordinary = manifest();
  for (const [i, card] of ordinary.packs[0].cards.entries()) await add(card.printingId, image(750, 1050, colors[i]), 'fixture-card');
  await add(holo.printingId, image(750, 1050, [220, 20, 110]), 'fixture-holo');
  const sheet = image(2550, 3300);
  for (const [i, p] of sourcePositions.entries()) paint(sheet, p.x + 2, p.y + 2, p.width - 4, p.height - 4, colors[i]);
  await add('sheet-v7-fixture', sheet, 'fixture-fixed', { positions: sourcePositions.toReversed() });
  release = validateRelease({ releaseId: 'v7-render-test', figmaVersion: 'fixture-v7', catalog, printTemplates: templates, assets });
});
after(async () => {
  if (!root) return;
  assert.ok(path.resolve(root).startsWith(path.join(os.tmpdir(), 'searealm-v7-render-')));
  await rm(root, { recursive: true, force: true });
});

async function inspect(file) {
  const doc = await PDFDocument.load(await readFile(file)); assert.equal(doc.getPageCount(), 1);
  const page = doc.getPage(0); assert.deepEqual(page.getSize(), { width: 612, height: 792 });
  const raw = page.node.lookup(PDFName.of('Contents')), streams = raw instanceof PDFArray ? raw.asArray() : [raw];
  const content = streams.map(ref => Buffer.from(decodePDFRawStream(doc.context.lookup(ref, PDFRawStream)).decode()).toString()).join('\n');
  const placements = [...content.matchAll(/\bq\s+([\s\S]*?)\s+Q\b/g)].filter(match => /\/\S+ Do/.test(match[1]))
    .map(match => [...match[1].matchAll(/^([^\n]+) cm$/gm)].map(matrix => matrix[1].trim().split(/\s+/).map(Number)));
  const images = page.node.Resources().lookup(PDFName.of('XObject')).entries().map(([, ref]) => {
    const stream = doc.context.lookup(ref, PDFRawStream); assert.equal(stream.dict.get(PDFName.of('Subtype')), PDFName.of('Image'));
    const maskRef = stream.dict.get(PDFName.of('SMask'));
    return { width: stream.dict.lookup(PDFName.of('Width')).asNumber(), height: stream.dict.lookup(PDFName.of('Height')).asNumber(),
      pixels: Buffer.from(decodePDFRawStream(stream).decode()), mask: maskRef ? Buffer.from(decodePDFRawStream(doc.context.lookup(maskRef, PDFRawStream)).decode()) : null };
  });
  return { placements, images };
}
function close(actual, expected, label) {
  assert.equal(actual.length, expected.length, label);
  actual.forEach((n, i) => assert.ok(Math.abs(n - expected[i]) < 1e-7, `${label}: term ${i}`));
}
function placement(actual, p, label) {
  assert.equal(actual.length, 4, label);
  close(actual[0], [1, 0, 0, 1, p.x * .24, 792 - (p.y + p.height) * .24], `${label} translation`);
  close(actual[1], identity, `${label} rotation`);
  close(actual[2], [p.width * .24, 0, 0, p.height * .24, 0, 0], `${label} scale`);
  close(actual[3], identity, `${label} skew`);
}
function rear(output, pixels) {
  assert.equal(output.placements.length, 1); assert.equal(output.images.length, 1);
  placement(output.placements[0], { x: 0, y: 0, width: 2550, height: 3300 }, 'one native Canon page');
  assert.deepEqual([output.images[0].width, output.images[0].height], [2550, 3300]);
  assert.ok(output.images[0].pixels.equals(pixels), 'Native shifted logos, water, and border pixels must survive unchanged');
}

for (const fixed of [false, true]) test(`V7 ${fixed ? 'fixed transparent crops' : 'booster fronts'} use the measured Epson position and one complete shifted Canon rear`, async () => {
  const saved = manifest(fixed), before = JSON.stringify(saved);
  const jobs = await renderJob({ manifest: saved, release, assetFiles, outputDir: path.join(root, fixed ? 'fixed' : 'booster'), siteOrigin: 'https://searealm.com' });
  const front = await inspect(jobs.find(job => job.side === 'fronts').file);
  rear(await inspect(jobs.find(job => job.side === 'backs').file), rearPixels);
  assert.equal(front.placements.length, 10); assert.equal(front.images.length, 10);
  placement(front.placements[0], { x: 0, y: 0, width: 2550, height: 3300 }, 'unshifted native page backdrop');
  const backdrop = front.images[0].pixels, waterAt = (64 * 2550 + 134) * 3;
  assert.deepEqual([...backdrop.subarray(waterAt - 3, waterAt)], [255, 255, 255]);
  assert.deepEqual([...backdrop.subarray(waterAt, waterAt + 3)], [17, 99, 151]);
  for (const [i, p] of positionsAt(145).entries()) {
    placement(front.placements[i + 1], p, `ordinary slot ${i + 1}`);
    const card = front.images[i + 1];
    assert.deepEqual([card.width, card.height], fixed ? [720, 1008] : [750, 1050]);
    const center = (Math.floor(card.height / 2) * card.width + Math.floor(card.width / 2)) * 3;
    assert.deepEqual([...card.pixels.subarray(center, center + 3)], colors[i]);
    if (fixed) {
      assert.ok(card.mask, 'The cut-out card must retain transparency over the water');
      assert.equal(card.mask[0], 0); assert.equal(card.mask[2 * 720 + 2], 255);
    }
  }
  assert.equal(JSON.stringify(saved), before, 'Rendering does not rewrite the saved manifest');
});

test('V7 holo replenishment uses its independent moved front grid and native rear, including a partial last sheet', async () => {
  const batch = createHoloBatch({ release, selections: [{ printingId: holo.printingId, quantity: 10 }] }), before = JSON.stringify(batch);
  const jobs = await renderHoloBatch({ batch, release, assetFiles, outputDir: path.join(root, 'holo') });
  assert.equal(jobs.length, 4);
  for (const [sheetIndex, frontJob] of jobs.filter(job => job.side === 'fronts').entries()) {
    const front = await inspect(frontJob.file), count = sheetIndex === 0 ? 9 : 1;
    assert.equal(front.placements.length, count + 1);
    placement(front.placements[0], { x: 0, y: 0, width: 2550, height: 3300 }, 'holo native page backdrop');
    const waterAt = (64 * 2550 + 86) * 3;
    assert.deepEqual([...front.images[0].pixels.subarray(waterAt - 3, waterAt)], [255, 255, 255]);
    assert.deepEqual([...front.images[0].pixels.subarray(waterAt, waterAt + 3)], [17, 99, 151]);
    for (let i = 0; i < count; i++) placement(front.placements[i + 1], positionsAt(95)[i], `holo slot ${i + 1}`);
  }
  for (const back of jobs.filter(job => job.side === 'backs')) rear(await inspect(back.file), holoRearPixels);
  assert.equal(JSON.stringify(batch), before);
});

test('A V7 job rejects an older release geometry before creating any PDF', async () => {
  const outputDir = path.join(root, 'mixed-rejected');
  await assert.rejects(renderJob({ manifest: manifest(), release: { ...release, printTemplates: oldTemplates }, assetFiles, outputDir, siteOrigin: 'https://searealm.com' }), /matching.*templates|matching versioned/);
  await assert.rejects(readdir(outputDir), { code: 'ENOENT' });
});
