import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { PDFDocument, PDFName, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { buildPrintingCatalog, contentHash } from './boosters.mjs';
import { PRINT_LAYOUT, BACK_TEMPLATE, V7_PRINT_LAYOUT, V7_BACK_TEMPLATE, V7_HOLO_PRINT_LAYOUT, V7_HOLO_BACK_TEMPLATE, createManufacturingManifest } from './printPlan.mjs';
import { backgroundsForLayout } from './backdrops.mjs';
import { fixedSheetAssets, fixedArtworkSources } from './recipes.mjs';
import { sha256, validateRelease } from './integration.mjs';
import { buildPagePreview } from './pagePreview.mjs';
import { renderJob } from '../../../scripts/manufacturing/render.mjs';
import { normalizeFixedSheetExport } from '../../../scripts/manufacturing/sync-figma.mjs';

const read = async name => JSON.parse(await readFile(new URL(`../../data/${name}`, import.meta.url)));
const catalog = buildPrintingCatalog(await read('gallery-set-list.json'), await read('gallery-images.json'));
const conditionGeometry = JSON.parse(await readFile(new URL('./test-fixtures/conditions-source-geometry-2026-11-05.json', import.meta.url)));
const sourcePositions = [106.2, 1114.2, 2122.2].flatMap(y => [167.4, 887.4, 1607.4].map(x => ({ x, y, width: 720.4, height: 1008.56 })));
const layouts = {
  v8: { version: PRINT_LAYOUT.version, fronts: PRINT_LAYOUT, backs: BACK_TEMPLATE },
  v7: { version: V7_PRINT_LAYOUT.version, fronts: V7_PRINT_LAYOUT, backs: V7_BACK_TEMPLATE, holoFronts: V7_HOLO_PRINT_LAYOUT, holoBacks: V7_HOLO_BACK_TEMPLATE },
};
let directory, releases, assetFiles;

function png(width, height, color) {
  const image = new PNG({ width, height }); image.data.fill(Buffer.from([...color, 255])); return image;
}
before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'searealm-page-preview-'));
  assetFiles = {}; releases = {};
  async function save(image, nodeId, metadata = {}) {
    const bytes = PNG.sync.write(image), hash = sha256(bytes), file = path.join(directory, hash + '.png');
    await writeFile(file, bytes);
    return { file, asset: { nodeId, sha256: hash, path: `manufacturing/sha256/${hash}.png`, width: image.width, height: image.height, ...metadata } };
  }
  const front = png(2550, 3300, [16, 91, 152]);
  // Independent column colors expose crop coordinate/order mistakes in PDF pixels.
  for (let y = 0; y < front.height; y++) for (let x = 0; x < front.width; x++) {
    const i = (y * front.width + x) * 4; front.data[i] = x % 251; front.data[i + 1] = y % 251;
  }
  const fixed = await save(front, 'fixture-fixed', { positions: sourcePositions.toReversed() });
  const conditions = {};
  for (const source of fixedArtworkSources().filter(item => item.outputProfile)) {
    const normalized = normalizeFixedSheetExport(PNG.sync.write(png(2216, 3088, [73, 141, 52])), conditionGeometry.documents[source.nodeId], source);
    const { bytes, ...metadata } = normalized;
    conditions[source.id] = await save(PNG.sync.read(bytes), source.nodeId, metadata);
  }
  for (const [name, printTemplates] of Object.entries(layouts)) {
    const assets = {}, files = {};
    for (const id of fixedSheetAssets('coral-garden')) { assets[id] = structuredClone(fixed.asset); files[id] = fixed.file; }
    for (const [id, saved] of Object.entries(conditions)) { assets[id] = structuredClone(saved.asset); files[id] = saved.file; }
    for (const [side, backdrop] of Object.entries(backgroundsForLayout(printTemplates.version))) {
      const saved = await save(png(2550, 3300, side.toLowerCase().includes('back') ? [23, 54, 92] : [19, 102, 160]), backdrop.nodeId);
      assets[backdrop.assetId] = saved.asset; files[backdrop.assetId] = saved.file;
    }
    releases[name] = validateRelease({ releaseId: `preview-${name}`, figmaVersion: 'fixture', catalog, printTemplates, assets });
    assetFiles[name] = files;
  }
});
after(async () => {
  if (!directory) return;
  const resolved = path.resolve(directory), base = path.resolve(os.tmpdir()) + path.sep;
  assert.ok(resolved.startsWith(base) && path.basename(resolved).startsWith('searealm-page-preview-'));
  await rm(resolved, { recursive: true, force: true });
});
function manifest(version = 'v8', productId = 'coral-garden', quantity = 1) {
  const release = releases[version];
  return createManufacturingManifest({ request: { orderId: 'preview-order', orderNumber: 'PREVIEW-ORDER', items: [{ productId, quantity }] },
    catalog, artworkRelease: release.releaseId, printTemplates: release.printTemplates, jobKind: 'stock', now: '2026-11-02T12:00:00.000Z' });
}
function oneSheet(saved, index = 0) {
  const { manifestHash, ...body } = saved; body.sheets = [body.sheets[index]]; return { ...body, manifestHash: contentHash(body) };
}

test('preview reveals only assets needed by the selected saved side, including repeated deck copies', () => {
  const saved = manifest('v8', 'coral-garden', 2), before = JSON.stringify(saved);
  const sheet = saved.sheets[8], front = buildPagePreview(saved, releases.v8, sheet.sheetId, 'fronts');
  assert.equal(sheet.unit, 2); assert.equal(sheet.fronts.assetId, 'sheet-coral-garden-2');
  assert.deepEqual(front.requiredAssetIds, ['print-template-front-background', 'sheet-coral-garden-2']);
  assert.deepEqual(Object.keys(front.assets), front.requiredAssetIds);
  assert.ok(!JSON.stringify(front).includes('manufacturing/sha256/'), 'Preview contains no storage path or public URL');
  assert.ok(!front.requiredAssetIds.includes('sheet-coral-garden-1'));
  assert.equal(front.layers.length, 10);
  assert.deepEqual(front.layers[1].crop, { x: 167, y: 106, width: 721, height: 1009 }, 'Round both crop edges, not just its size');
  const back = buildPagePreview(saved, releases.v8, sheet.sheetId, 'backs');
  assert.deepEqual(back.requiredAssetIds, ['standard-back-sheet']); assert.equal(back.layers.length, 1);
  assert.deepEqual(back.layers[0].position, { x: 0, y: 0, width: 2550, height: 3300, rotation: 0 });
  assert.equal(JSON.stringify(saved), before, 'Reading a preview cannot mutate the immutable job');
});

test('preview rejects another sheet, ticket side, altered manifest and mismatched private release', () => {
  const saved = manifest(), id = saved.sheets[0].sheetId;
  assert.throws(() => buildPagePreview(saved, releases.v8, 'another-order-sheet', 'fronts'), /saved page/);
  assert.throws(() => buildPagePreview(saved, releases.v8, id, 'ticket'), /front or back/);
  assert.throws(() => buildPagePreview(saved, releases.v7, id, 'fronts'), /release does not match/);
  const changed = structuredClone(saved); changed.sheets[0].fronts.assetId = 'sheet-coral-garden-7';
  assert.throws(() => buildPagePreview(changed, releases.v8, id, 'fronts'), /manifest has changed/);
  const missing = structuredClone(releases.v8); delete missing.assets['sheet-coral-garden-1'];
  assert.throws(() => buildPagePreview(saved, missing, id, 'fronts'), /unavailable/);
});

test('Conditions preview preserves native insets and moves only V8 to the shared grid', () => {
  const old = manifest('v7', 'conditions-deck'), current = manifest('v8', 'conditions-deck');
  for (let index = 0; index < 2; index++) {
    const v7 = buildPagePreview(old, releases.v7, old.sheets[index].sheetId, 'fronts');
    const v8 = buildPagePreview(current, releases.v8, current.sheets[index].sheetId, 'fronts');
    assert.deepEqual(v8.layers.map(layer => layer.crop), v7.layers.map(layer => layer.crop));
    const first = v7.layers[1].position;
    assert.equal(first.x, index === 0 ? 189.13330078125 : 189.1331787109375);
    assert.ok(Math.abs(first.y - 105.0966796875) < 1e-6);
    for (let slot = 1; slot <= 9; slot++) {
      const before = v7.layers[slot].position, after = v8.layers[slot].position;
      assert.ok(Math.abs(after.x - before.x + 80) < 1e-7);
      assert.ok(Math.abs(after.y - before.y + 2.8035545349121094) < 1e-7);
      assert.equal(after.width, 698.4000244140625); assert.equal(after.height, 977.760009765625);
    }
  }
});

async function inspect(file) {
  const doc = await PDFDocument.load(await readFile(file)), page = doc.getPage(0);
  assert.equal(doc.getPageCount(), 1); assert.deepEqual(page.getSize(), { width: 612, height: 792 });
  const contents = page.node.lookup(PDFName.of('Contents')), streams = contents instanceof PDFArray ? contents.asArray() : [contents];
  const text = streams.map(ref => Buffer.from(decodePDFRawStream(doc.context.lookup(ref, PDFRawStream)).decode()).toString()).join('\n');
  const transforms = [...text.matchAll(/\bq\s+([\s\S]*?)\s+Q\b/g)].filter(match => /\/\S+ Do/.test(match[1]))
    .map(match => [...match[1].matchAll(/^([^\n]+) cm$/gm)].map(item => item[1].trim().split(/\s+/).map(Number)));
  const images = page.node.Resources().lookup(PDFName.of('XObject')).entries().map(([, ref]) => doc.context.lookup(ref, PDFRawStream));
  return { transforms, images };
}
function equalNumbers(actual, expected) { assert.equal(actual.length, expected.length); actual.forEach((number, index) => assert.ok(Math.abs(number - expected[index]) < 1e-7)); }

test('browser preview positions and source crops match the actual saved printer PDF, with one native rear', async () => {
  const saved = oneSheet(manifest()), sheet = saved.sheets[0];
  const jobs = await renderJob({ manifest: saved, release: releases.v8, assetFiles: assetFiles.v8, outputDir: path.join(directory, 'pdf'), siteOrigin: 'https://example.test' });
  assert.deepEqual(jobs.map(job => job.side), ['fronts', 'backs']);
  for (const job of jobs) {
    const preview = buildPagePreview(saved, releases.v8, sheet.sheetId, job.side), pdf = await inspect(job.file);
    assert.equal(pdf.transforms.length, preview.layers.length); assert.equal(pdf.images.length, preview.layers.length);
    for (const [index, layer] of preview.layers.entries()) {
      const p = layer.position, transforms = pdf.transforms[index], image = pdf.images[index];
      equalNumbers(transforms[0], [1, 0, 0, 1, p.x * .24, 792 - (p.y + p.height) * .24]);
      equalNumbers(transforms[2], [p.width * .24, 0, 0, p.height * .24, 0, 0]);
      const original = PNG.sync.read(await readFile(assetFiles.v8[layer.assetId]));
      const crop = layer.crop ?? { x: 0, y: 0, width: original.width, height: original.height };
      assert.equal(image.dict.lookup(PDFName.of('Width')).asNumber(), crop.width);
      assert.equal(image.dict.lookup(PDFName.of('Height')).asNumber(), crop.height);
      const pixels = Buffer.from(decodePDFRawStream(image).decode());
      for (const [x, y] of [[0, 0], [crop.width - 1, 0], [0, crop.height - 1], [crop.width - 1, crop.height - 1]]) {
        const sourceIndex = ((crop.y + y) * original.width + crop.x + x) * 4, outputIndex = (y * crop.width + x) * 3;
        assert.deepEqual(pixels.subarray(outputIndex, outputIndex + 3), original.data.subarray(sourceIndex, sourceIndex + 3));
      }
    }
  }
});
