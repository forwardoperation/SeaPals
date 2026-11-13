import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { PDFDocument, PDFName, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { sheetIdentityText, sheetMarginLabels } from './sheetMarginLabels.mjs';
import { PRINT_LAYOUT, BACK_TEMPLATE, V8_PRINT_LAYOUT, V8_BACK_TEMPLATE, V9_PRINT_LAYOUT, V9_BACK_TEMPLATE, V10_PRINT_LAYOUT, V10_BACK_TEMPLATE, createManufacturingManifest } from './printPlan.mjs';
import { createHoloBatch } from './holoBatch.mjs';
import { fixedSheetAssets, FLYER_RECIPE_VERSION } from './recipes.mjs';
import { conditionOutputMapping } from './sourceGeometry.mjs';
import { buildPrintingCatalog, contentHash } from './boosters.mjs';
import { renderJob, renderHoloBatch } from '../../../scripts/manufacturing/render.mjs';
import { sha256 } from './integration.mjs';

const read = async name => JSON.parse(await readFile(new URL(`../../data/${name}`, import.meta.url)));
const catalog = buildPrintingCatalog(await read('gallery-set-list.json'), await read('gallery-images.json'));
const stockNumber = 'STOCK-0123456789ABCDEF0123456789ABCDEF';
const templates = { version: PRINT_LAYOUT.version, fronts: PRINT_LAYOUT, backs: BACK_TEMPLATE };
function fixture(items, jobKind = 'stock', printTemplates = templates, flyerVersion) {
  const manifest = createManufacturingManifest({ request: { orderId: 'label-test', orderNumber: stockNumber, items },
    catalog, artworkRelease: 'margin-label-test', printTemplates, flyerVersion, jobKind, randomIndex: n => n === 10000 ? 9999 : 0 });
  const assets = Object.fromEntries(manifest.sheets.filter(sheet => sheet.fronts.assetId).map(sheet => [sheet.fronts.assetId, {}]));
  return { manifest, release: { printTemplates, assets } };
}
const separated = (a, b, clearance = 0) => a.x + a.width + clearance <= b.x || b.x + b.width + clearance <= a.x ||
  a.y + a.height + clearance <= b.y || b.y + b.height + clearance <= a.y;

test('Starter Kit pages identify their component deck and copy; flyers have no labels', () => {
  const { manifest, release } = fixture([{ productId: 'starter-kit', quantity: 2 }], 'stock', templates, FLYER_RECIPE_VERSION);
  const before = JSON.stringify({ manifest, release });
  for (const sheet of manifest.sheets) {
    const text = sheetIdentityText(manifest, sheet.sheetId);
    if (sheet.kind === 'flyer') {
      assert.equal(text, null);
      assert.deepEqual(sheetMarginLabels(manifest, release, sheet.sheetId, 'fronts'), []);
      continue;
    }
    const assetId = sheet.fronts.assetId, page = Number(assetId.split('-').at(-1));
    const name = assetId.includes('coral-garden') ? 'Coral Garden' : assetId.includes('blue-water') ? 'Drop Off' : 'Conditions';
    assert.equal(text, `${name} | Page ${page} of ${name === 'Conditions' ? 2 : 7} | Copy ${sheet.unit}`);
    for (const side of ['fronts', 'backs']) {
      const labels = sheetMarginLabels(manifest, release, sheet.sheetId, side);
      assert.equal(labels.filter(label => label.kind === 'identity').length, 1);
      assert.equal(labels.filter(label => label.kind === 'stock').length, sheet === manifest.sheets[0] ? 1 : 0);
    }
  }
  assert.equal(JSON.stringify({ manifest, release }), before);
});

test('V9, V10 and V11 labels clear actual card bounds, water and both front/rear staple positions', () => {
  for (const printTemplates of [
    { version: V9_PRINT_LAYOUT.version, fronts: V9_PRINT_LAYOUT, backs: V9_BACK_TEMPLATE },
    { version: V10_PRINT_LAYOUT.version, fronts: V10_PRINT_LAYOUT, backs: V10_BACK_TEMPLATE }, templates,
  ]) {
  const { manifest, release } = fixture([
    { productId: 'stinging-fortress', quantity: 2 }, { productId: 'conditions-deck', quantity: 1 },
  ], 'stock', printTemplates);
  for (const id of fixedSheetAssets('conditions-deck')) {
    const mapping = conditionOutputMapping(id);
    release.assets[id] = { outputPositions: mapping.outputPositions,
      sourceGeometry: { mode: 'mapped-grid-letter', outputReferenceBounds: mapping.outputReferenceBounds } };
  }
  for (const sheet of manifest.sheets) for (const side of ['fronts', 'backs']) {
    const labels = sheetMarginLabels(manifest, release, sheet.sheetId, side);
    assert.ok(labels.length);
    for (const label of labels) {
      assert.ok(label.fontSize >= 32);
      assert.ok(label.bounds.y >= 800 && label.bounds.y + label.bounds.height <= 2500);
      assert.ok(label.bounds.x >= 64 && label.bounds.x + label.bounds.width <= 2486);
      assert.equal(label.margin, side === 'fronts' ? 'right' : 'left');
      const grid = side === 'fronts' ? manifest.layout.grid : release.printTemplates.backs.grid;
      assert.ok(separated(label.bounds, grid, 16));
      const rightStaples = ['figma-cutter-nine-up-v10', 'figma-cutter-nine-up-v11'].includes(printTemplates.version);
      if (side === 'fronts') assert.ok(label.bounds.x > (rightStaples ? 2390 : 2420), 'outside the water background');
      if (side === 'backs' || rightStaples) for (const y of [468, 2646])
        assert.ok(separated(label.bounds, { x: side === 'fronts' ? 2436 : 25, y, width: 78, height: 231 }, 16));
      for (const card of side === 'fronts' ? manifest.layout.positions : sheet.backs.template.positions)
        assert.ok(separated(label.bounds, card, 16));
    }
    if (labels.length === 2) {
      assert.equal(labels[0].text, stockNumber);
      assert.ok(separated(labels[0].bounds, labels[1].bounds, 40));
    }
  }
  }
});

test('saved V9 first-stock labels retain their exact earlier placement', () => {
  const printTemplates = { version: V9_PRINT_LAYOUT.version, fronts: V9_PRINT_LAYOUT, backs: V9_BACK_TEMPLATE };
  const { manifest, release } = fixture([{ productId: 'reef-dive-pack', quantity: 1 }], 'stock', printTemplates);
  for (const [side, stockX, identityX] of [['fronts', 2440.5, 2442.5], ['backs', 79.19999694824219, 81.19999694824219]]) {
    const labels = sheetMarginLabels(manifest, release, manifest.sheets[0].sheetId, side);
    assert.deepEqual(labels.map(label => label.text), [stockNumber, 'Reef Dive Pack | Page 1 of 1']);
    assert.deepEqual(labels.map(label => label.bounds), [
      { x: stockX, y: 950.8, width: 36, height: 820.8 },
      { x: identityX, y: 1811.6, width: 32, height: 537.6 },
    ]);
  }
});

test('the V11 ten-pixel artwork shift preserves every V10 page and stock label exactly', () => {
  const oldTemplates = { version: V10_PRINT_LAYOUT.version, fronts: V10_PRINT_LAYOUT, backs: V10_BACK_TEMPLATE };
  const items = [{ productId: 'reef-dive-pack', quantity: 2 }, { productId: 'starter-kit', quantity: 2 }];
  const before = fixture(items, 'stock', oldTemplates), after = fixture(items);
  assert.equal(after.manifest.layout.grid.y, before.manifest.layout.grid.y - 10);
  for (const sheet of before.manifest.sheets) for (const side of ['fronts', 'backs'])
    assert.deepEqual(sheetMarginLabels(after.manifest, after.release, sheet.sheetId, side),
      sheetMarginLabels(before.manifest, before.release, sheet.sheetId, side));
});

test('customer booster sheets identify Reef, Deep and Oceanic independently with stable matching back labels', () => {
  const { manifest, release } = fixture(['reef', 'deep', 'oceanic'].map(set => ({ productId: `${set}-dive-pack`, quantity: 2 })), 'order');
  for (const name of ['Reef', 'Deep', 'Oceanic']) {
    const sheets = manifest.sheets.filter(sheet => sheetIdentityText(manifest, sheet.sheetId).startsWith(name));
    assert.equal(sheets.length, 2);
    sheets.forEach((sheet, index) => {
      const expected = `${name} Dive Pack | Page ${index + 1} of 2`;
      assert.equal(sheetIdentityText(manifest, sheet.sheetId), expected);
      for (const side of ['fronts', 'backs']) assert.deepEqual(sheetMarginLabels(manifest, release, sheet.sheetId, side).map(label => label.text), [expected]);
    });
  }
});

test('unsafe geometry, unsupported sheets and flyers fail closed; saved V8 stock labels retain their audited band', () => {
  const oldTemplates = { version: V8_PRINT_LAYOUT.version, fronts: V8_PRINT_LAYOUT, backs: V8_BACK_TEMPLATE };
  const old = fixture([{ productId: 'reef-dive-pack', quantity: 2 }], 'stock', oldTemplates);
  const first = old.manifest.sheets[0];
  for (const side of ['fronts', 'backs']) {
    const labels = sheetMarginLabels(old.manifest, old.release, first.sheetId, side);
    assert.equal(labels.length, 1); assert.equal(labels[0].text, stockNumber);
    assert.ok(labels[0].bounds.y >= 1100 && labels[0].bounds.y + labels[0].bounds.height <= 2200);
  }
  const f = fixture([{ productId: 'reef-dive-pack', quantity: 1 }]);
  f.manifest.layout.grid = { x: 0, y: 0, width: 2550, height: 3300 };
  assert.deepEqual(sheetMarginLabels(f.manifest, f.release, f.manifest.sheets[0].sheetId, 'fronts'), []);
  assert.deepEqual(sheetMarginLabels(f.manifest, f.release, 'missing', 'fronts'), []);
  assert.deepEqual(sheetMarginLabels(f.manifest, f.release, f.manifest.sheets[0].sheetId, 'ticket'), []);
});

async function pdfContent(file) {
  const doc = await PDFDocument.load(await readFile(file)), page = doc.getPage(0);
  assert.equal(doc.getPageCount(), 1); assert.deepEqual(page.getSize(), { width: 612, height: 792 });
  const raw = page.node.lookup(PDFName.of('Contents'));
  return (raw instanceof PDFArray ? raw.asArray() : [raw]).map(ref => Buffer.from(decodePDFRawStream(doc.context.lookup(ref, PDFRawStream)).decode()).toString()).join('\n');
}
test('PDF output labels every side, retains full stock number, and labels separate mixed-set holo batches', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'searealm-margin-label-'));
  try {
    const f = fixture([{ productId: 'reef-dive-pack', quantity: 2 }]);
    const release = { ...f.release, releaseId: 'margin-label-test', figmaVersion: 'fixture', catalog }, assetFiles = {};
    for (const [width, height, ids] of [
      [750, 1050, catalog.map(card => card.printingId)],
      [2550, 3300, ['print-template-front-background', 'standard-back-sheet']],
    ]) {
      const image = new PNG({ width, height }); image.data.fill(255);
      const bytes = PNG.sync.write(image), hash = sha256(bytes), file = path.join(directory, hash + '.png');
      await writeFile(file, bytes);
      for (const id of ids) {
        release.assets[id] = { width, height, sha256: hash, path: `manufacturing/sha256/${hash}.png`,
          ...(['print-template-front-background', 'standard-back-sheet'].includes(id) ? { nodeId: id === 'standard-back-sheet' ? BACK_TEMPLATE.background.nodeId : PRINT_LAYOUT.background.nodeId } : {}) };
        assetFiles[id] = file;
      }
    }
    const before = JSON.stringify(f.manifest);
    const jobs = await renderJob({ manifest: f.manifest, release, assetFiles, outputDir: path.join(directory, 'stock'), siteOrigin: 'https://searealm.com' });
    assert.equal(jobs.length, 4);
    for (const job of jobs) {
      const content = await pdfContent(job.file), labels = sheetMarginLabels(f.manifest, release, job.sheetId, job.side);
      for (const label of labels) assert.ok(content.includes(`<${Buffer.from(label.text).toString('hex').toUpperCase()}>`));
      assert.equal(labels.some(label => label.text === stockNumber), job.sheetId === f.manifest.sheets[0].sheetId);
    }
    assert.equal(JSON.stringify(f.manifest), before);
    const selections = ['reef', 'deep', 'ocean'].map(set => ({ printingId: catalog.find(card => card.set === set && card.rarity === 'Holo Rare').printingId, quantity: 1 }));
    const batch = createHoloBatch({ release, selections }), hash = contentHash(batch);
    const holoJobs = await renderHoloBatch({ batch, release, assetFiles, outputDir: path.join(directory, 'holos') });
    assert.equal(holoJobs.length, 2);
    assert.equal(sheetIdentityText(batch, batch.sheets[0].sheetId), 'Reef + Deep + Oceanic holos | Page 1 of 1');
    for (const job of holoJobs) {
      const labels = sheetMarginLabels(batch, release, job.sheetId, job.side), content = await pdfContent(job.file);
      assert.equal(labels.length, 1);
      assert.ok(content.includes(`<${Buffer.from(labels[0].text).toString('hex').toUpperCase()}>`));
    }
    assert.equal(contentHash(batch), hash);
  } finally {
    assert.ok(path.resolve(directory).startsWith(path.join(os.tmpdir(), 'searealm-margin-label-')));
    await rm(directory, { recursive: true, force: true });
  }
});
