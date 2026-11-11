import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { PDFDocument, PDFName, PDFArray, PDFRawStream, StandardFonts, decodePDFRawStream } from 'pdf-lib';
import { PNG } from 'pngjs';
import { stockSheetLabel } from './stockSheetLabel.mjs';
import { buildPrintingCatalog } from './boosters.mjs';
import { V8_PRINT_LAYOUT as PRINT_LAYOUT, V8_BACK_TEMPLATE as BACK_TEMPLATE, V7_PRINT_LAYOUT, V7_BACK_TEMPLATE, V4_PRINT_LAYOUT,
  createManufacturingManifest, verifyManifest } from './printPlan.mjs';
import { conditionOutputMapping, fixedSheetOutputPositions } from './sourceGeometry.mjs';
import { sha256 } from './integration.mjs';
import { renderJob } from '../../../scripts/manufacturing/render.mjs';

const stockNumber = 'STOCK-0123456789ABCDEF0123456789ABCDEF';
const fixture = () => {
  const manifest = { jobKind: 'stock', order: { orderNumber: stockNumber }, layout: structuredClone(PRINT_LAYOUT),
    sheets: [{ sheetId: 'first', fronts: {}, backs: { template: structuredClone(BACK_TEMPLATE) },
      slots: structuredClone(PRINT_LAYOUT.positions) },
    { sheetId: 'second', fronts: {}, backs: { template: structuredClone(BACK_TEMPLATE) } }] };
  return { manifest, release: { printTemplates: { backs: structuredClone(BACK_TEMPLATE) }, assets: {} } };
};
const separated = (a, b, clearance = 0) => a.x + a.width + clearance <= b.x || b.x + b.width + clearance <= a.x ||
  a.y + a.height + clearance <= b.y || b.y + b.height + clearance <= a.y;

test('full pinned stock number fits the verified white side margins on the first matching sheet pair', async () => {
  const { manifest, release } = fixture(), before = JSON.stringify({ manifest, release });
  const document = await PDFDocument.create(), font = await document.embedFont(StandardFonts.CourierBold);
  for (const [side, margin, safe] of [
    ['fronts', 'right', { x: 2420, y: 1100, width: 50, height: 1100 }],
    ['backs', 'left', { x: 60, y: 1100, width: 50, height: 1100 }],
  ]) {
    const label = stockSheetLabel(manifest, release, 'first', side);
    assert.equal(label.text, stockNumber); assert.equal(label.margin, margin);
    assert.equal(label.font, 'Courier-Bold'); assert.equal(label.fontSize, 36); assert.equal(label.rotation, -90);
    assert.equal(label.bounds.height, font.widthOfTextAtSize(stockNumber, 36));
    assert.ok(label.bounds.x >= safe.x && label.bounds.x + label.bounds.width <= safe.x + safe.width);
    assert.ok(label.bounds.y >= safe.y && label.bounds.y + label.bounds.height <= safe.y + safe.height);
    const grid = side === 'fronts' ? manifest.layout.grid : release.printTemplates.backs.grid;
    assert.ok(separated(label.bounds, grid, 16));
    for (const card of side === 'fronts' ? manifest.sheets[0].slots : manifest.sheets[0].backs.template.positions)
      assert.ok(separated(label.bounds, card, 16));
    assert.equal(stockSheetLabel(manifest, release, 'second', side), null);
  }
  assert.equal(JSON.stringify({ manifest, release }), before);
});

test('customer jobs, absent sheets, invalid text, unsupported layouts and unsafe long numbers get no label', () => {
  const { manifest, release } = fixture();
  for (const bad of [
    { ...manifest, jobKind: 'order' }, { ...manifest, jobKind: undefined },
    { ...manifest, sheets: [] }, { ...manifest, order: { orderNumber: '' } },
    { ...manifest, order: { orderNumber: 'STOCK-UNSAFE\nTEXT' } },
    { ...manifest, order: { orderNumber: 'A'.repeat(80) } },
    { ...manifest, layout: { ...manifest.layout, version: 'unreviewed' } },
    { ...manifest, layout: { ...manifest.layout, width: 612 } },
  ]) assert.equal(stockSheetLabel(bad, release, 'first', 'fronts'), null);
  assert.equal(stockSheetLabel(manifest, release, 'first', 'ticket'), null);
  assert.equal(stockSheetLabel(manifest, release, 'unknown', 'fronts'), null);
  assert.equal(stockSheetLabel({ ...manifest, layout: V4_PRINT_LAYOUT }, release, 'first', 'fronts'), null);
});

test('pinned historical grids retain their geometry and select their own safe side', () => {
  const { manifest, release } = fixture();
  manifest.layout = structuredClone(V7_PRINT_LAYOUT);
  manifest.sheets[0].slots = structuredClone(V7_PRINT_LAYOUT.positions);
  manifest.sheets[0].backs.template = structuredClone(V7_BACK_TEMPLATE);
  release.printTemplates.backs = structuredClone(V7_BACK_TEMPLATE);
  const before = JSON.stringify({ manifest, release });
  assert.equal(stockSheetLabel(manifest, release, 'first', 'fronts').margin, 'left');
  assert.equal(stockSheetLabel(manifest, release, 'first', 'backs').margin, 'right');
  assert.equal(JSON.stringify({ manifest, release }), before);
  delete release.printTemplates.backs.grid;
  assert.equal(stockSheetLabel(manifest, release, 'first', 'backs'), null);
});

test('Conditions use their actual calibrated output positions; unsafe or rotated card extents prevent overlap', () => {
  const { manifest, release } = fixture(), mapping = conditionOutputMapping('sheet-conditions-1');
  manifest.sheets[0].fronts.assetId = 'sheet-conditions-1';
  release.assets['sheet-conditions-1'] = { outputPositions: mapping.outputPositions,
    sourceGeometry: { mode: 'mapped-grid-letter', outputReferenceBounds: mapping.outputReferenceBounds } };
  const label = stockSheetLabel(manifest, release, 'first', 'fronts');
  assert.equal(label.margin, 'right');
  for (const position of fixedSheetOutputPositions(release.assets['sheet-conditions-1'], manifest.layout))
    assert.ok(separated(label.bounds, position, 16));
  release.assets['sheet-conditions-1'].outputPositions = [{ x: 2500, y: 1200, width: 40, height: 100 }];
  assert.equal(stockSheetLabel(manifest, release, 'first', 'fronts'), null);
  delete manifest.sheets[0].fronts.assetId;
  manifest.sheets[0].slots.push({ x: 2400, y: 1150, width: 100, height: 100, rotation: 45 });
  assert.equal(stockSheetLabel(manifest, release, 'first', 'fronts'), null);
  manifest.sheets[0].slots[9].rotation = NaN;
  assert.equal(stockSheetLabel(manifest, release, 'first', 'fronts'), null);
  delete manifest.layout.grid;
  assert.equal(stockSheetLabel(manifest, release, 'first', 'fronts'), null);
});

async function inspect(file) {
  const document = await PDFDocument.load(await readFile(file)), page = document.getPage(0);
  assert.equal(document.getPageCount(), 1); assert.deepEqual(page.getSize(), { width: 612, height: 792 });
  const raw = page.node.lookup(PDFName.of('Contents')), streams = raw instanceof PDFArray ? raw.asArray() : [raw];
  const content = streams.map(ref => Buffer.from(decodePDFRawStream(document.context.lookup(ref, PDFRawStream)).decode()).toString()).join('\n');
  const imageOperators = [...content.matchAll(/\bq\s+([\s\S]*?)\s+Q\b/g)].filter(match => /\/\S+ Do/.test(match[1]))
    .map(match => match[1]);
  return { content, imageOperators };
}

test('PDF stock labels add no pages or tickets and leave image placement and saved contents unchanged', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'searealm-stock-label-'));
  try {
    const read = async name => JSON.parse(await readFile(new URL(`../../data/${name}`, import.meta.url), 'utf8'));
    const catalog = buildPrintingCatalog(await read('gallery-set-list.json'), await read('gallery-images.json'));
    const templates = { version: PRINT_LAYOUT.version, fronts: PRINT_LAYOUT, backs: BACK_TEMPLATE };
    const release = { releaseId: 'label-test', catalog, printTemplates: templates, assets: {} }, assetFiles = {};
    const add = async (width, height) => {
      const png = new PNG({ width, height }); png.data.fill(255);
      const bytes = PNG.sync.write(png), hash = sha256(bytes), file = path.join(directory, `${hash}.png`);
      await writeFile(file, bytes);
      return { file, asset: { width, height, sha256: hash, path: `manufacturing/sha256/${hash}.png` } };
    };
    const card = await add(750, 1050), sheet = await add(2550, 3300);
    for (const item of catalog) { release.assets[item.printingId] = card.asset; assetFiles[item.printingId] = card.file; }
    for (const template of [PRINT_LAYOUT, BACK_TEMPLATE]) {
      release.assets[template.background.assetId] = { ...sheet.asset, nodeId: template.background.nodeId };
      assetFiles[template.background.assetId] = sheet.file;
    }
    const options = { request: { orderId: 'stock-label-test', orderNumber: stockNumber,
      items: [{ productId: 'reef-dive-pack', quantity: 2 }] }, catalog,
      artworkRelease: release.releaseId, printTemplates: templates, randomIndex: n => n === 10000 ? 9999 : 0 };
    const manifest = createManufacturingManifest({ ...options, jobKind: 'stock' });
    const saved = JSON.stringify(manifest), common = { release, assetFiles, siteOrigin: 'https://searealm.com' };
    const jobs = await renderJob({ ...common, manifest, outputDir: path.join(directory, 'stock') });
    assert.equal(jobs.length, 4); assert.ok(jobs.every(job => job.side !== 'ticket'));
    const customer = createManufacturingManifest(options);
    const customerJobs = await renderJob({ ...common, manifest: customer, outputDir: path.join(directory, 'customer') });
    assert.equal(customerJobs.length, 5);
    const hex = Buffer.from(stockNumber).toString('hex').toUpperCase();
    for (const job of jobs) {
      const printed = await inspect(job.file), expected = await inspect(customerJobs.find(other => other.sheetId === job.sheetId && other.side === job.side).file);
      assert.deepEqual(printed.imageOperators, expected.imageOperators);
      assert.equal(printed.content.includes(`<${hex}>`), job.sheetId === manifest.sheets[0].sheetId);
      assert.equal(expected.content.includes(`<${hex}>`), false);
    }
    assert.equal(JSON.stringify(manifest), saved); verifyManifest(manifest);
    const replayed = await renderJob({ ...common, manifest: JSON.parse(saved), outputDir: path.join(directory, 'stock') });
    assert.equal(replayed.length, 4);
    assert.ok((await inspect(replayed[0].file)).content.includes(`<${hex}>`));
    assert.ok(!(await inspect(replayed[2].file)).content.includes(`<${hex}>`));
  } finally {
    assert.ok(path.resolve(directory).startsWith(path.join(os.tmpdir(), 'searealm-stock-label-')));
    await rm(directory, { recursive: true, force: true });
  }
});
