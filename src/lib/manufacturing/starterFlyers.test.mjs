import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { PNG } from 'pngjs';
import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { contentHash } from './boosters.mjs';
import { FLYER_RECIPE_VERSION, FLYER_SOURCES, productPrintAssets, fixedSheetAssets } from './recipes.mjs';
import { isFlyerSheet, printSidesForSheet } from './sheetKinds.mjs';
import { PRINT_LAYOUT, BACK_TEMPLATE, createManufacturingManifest, verifyManifest, preflightPrintAssets } from './printPlan.mjs';
import { createManufacturingState, applyManufacturingEvent, workflowReadiness } from './workflow.mjs';
import { normalizedEvent, sha256 } from './integration.mjs';
import { stockSheetLabel } from './stockSheetLabel.mjs';
import { renderJob } from '../../../scripts/manufacturing/render.mjs';
import { runJob } from '../../../scripts/manufacturing/agent.mjs';
import { saveOrder } from '../../../scripts/manufacturing/orders.mjs';

const templates = { version: PRINT_LAYOUT.version, fronts: PRINT_LAYOUT, backs: BACK_TEMPLATE };
const request = quantity => ({ orderId: 'starter-flyers', orderNumber: 'STOCK-0123456789ABCDEF0123456789ABCDEF',
  items: [{ productId: 'starter-kit', quantity }] });
const make = (quantity = 1, options = {}) => createManufacturingManifest({ request: request(quantity),
  catalog: [], artworkRelease: 'starter-flyer-test', printTemplates: templates,
  jobKind: 'stock', flyerVersion: FLYER_RECIPE_VERSION, ...options });
const rehash = manifest => { const { manifestHash, ...body } = manifest; return { ...body, manifestHash: contentHash(body) }; };
const flyerOnly = () => { const m = make(); return rehash({ ...m, sheets: m.sheets.filter(isFlyerSheet), accessoryChecklist: [] }); };
const event = (state, type, fields = {}, role = 'operator') => normalizedEvent({ id: randomUUID(), type, expectedRevision: state.revision, ...fields }, role);
function apply(state, manifest, type, fields = {}, role = 'operator') { return applyManufacturingEvent(state, manifest, event(state, type, fields, role)); }

test('one flyer of each type per produced Starter Kit: three kits yield54 Epson and48 Canon pages', () => {
  const manifest = make(3), flyers = manifest.sheets.filter(isFlyerSheet);
  assert.equal(manifest.sheets.length, 54);
  assert.equal(flyers.length, 6);
  assert.equal(manifest.sheets.flatMap(printSidesForSheet).filter(side => side === 'fronts').length, 54);
  assert.equal(manifest.sheets.flatMap(printSidesForSheet).filter(side => side === 'backs').length, 48);
  assert.equal(fixedSheetAssets('starter-kit').length, 16);
  assert.equal(productPrintAssets('starter-kit', FLYER_RECIPE_VERSION).length, 18);
  assert.equal(productPrintAssets('coral-garden', FLYER_RECIPE_VERSION).length, 7);
  for (let unit = 1; unit <= 3; unit++) {
    assert.deepEqual(flyers.filter(sheet => sheet.unit === unit).map(sheet => sheet.fronts.assetId), FLYER_SOURCES.map(source => source.id));
    const unitPages = manifest.sheets.filter(sheet => sheet.unit === unit);
    assert.deepEqual(unitPages.slice(-2).map(sheet => sheet.kind), ['flyer', 'flyer']);
    for (const sheet of unitPages.slice(-2)) { assert.equal(sheet.backs, undefined); assert.equal(sheet.fronts.copies, 1); }
  }
  const partial = make(3, { jobKind: 'order', inventoryPlan: [{ productId: 'starter-kit', quantity: 3, fromStock: 2, toMake: 1 }] });
  assert.equal(partial.sheets.length, 18); assert.equal(partial.sheets.filter(isFlyerSheet).length, 2);
  const inStock = make(3, { jobKind: 'order', inventoryPlan: [{ productId: 'starter-kit', quantity: 3, fromStock: 3, toMake: 0 }] });
  assert.equal(inStock.sheets.length, 0);
});

test('absent capability preserves older recipes, saved contents and local order replay', async t => {
  const old = make(1, { flyerVersion: undefined });
  assert.equal(old.flyerVersion, undefined); assert.equal(old.sheets.length, 16);
  const before = JSON.stringify(old); verifyManifest(old); assert.equal(JSON.stringify(old), before);
  assert.throws(() => make(1, { flyerVersion: 'future-flyers' }), /flyer recipe/);
  const root = await mkdtemp(path.join(os.tmpdir(), 'searealm-flyer-order-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const args = { root, request: request(1), catalog: [], artworkRelease: 'starter-flyer-test', printTemplates: templates };
  const first = await saveOrder(args), repeated = await saveOrder({ ...args, flyerVersion: FLYER_RECIPE_VERSION });
  assert.equal(repeated.reused, true); assert.deepEqual(repeated.manifest, first.manifest);
  assert.equal(repeated.manifest.sheets.length, 16);
});

test('malformed one-sided sheets and omitted required inserts fail saved-manifest validation', () => {
  for (const mutate of [
    m => { m.sheets.pop(); },
    m => { m.sheets.at(-1).backs = { assetId: 'standard-back-sheet' }; },
    m => { m.sheets.at(-1).fronts.copies = 2; },
    m => { m.sheets.at(-1).fronts.printerRole = 'backs'; },
    m => { m.sheets.at(-1).fronts.assetId = 'flyer-unknown'; },
    m => { m.sheets.at(-1).kind = 'unknown'; },
    m => { m.sheets.at(-1).unit = 2; },
    m => { delete m.flyerVersion; },
  ]) { const m = structuredClone(make()); mutate(m); assert.throws(() => verifyManifest(rehash(m)), /flyer pages/); }
});

test('flyers require only front submission, reject backs/glue/cut, and reprint without assembly states', () => {
  const manifest = flyerOnly(), flyer = manifest.sheets[0];
  let state = createManufacturingState(manifest);
  assert.deepEqual(state.sheets[flyer.sheetId], { kind: 'flyer', fronts: 'queued', backs: 'not_required' });
  assert.equal(workflowReadiness(state).canQualityCheck, false);
  for (const type of ['submission_started', 'reprint', 'confirm_printed'])
    assert.throws(() => apply(state, manifest, type, { sheetId: flyer.sheetId, side: 'backs', reason: 'test' }, type === 'submission_started' ? 'agent' : 'operator'), /no requested print side/);
  for (const type of ['glued', 'cut']) assert.throws(() => apply(state, manifest, type, { sheetId: flyer.sheetId }), /do not require/);
  for (const sheet of manifest.sheets) {
    const target = { sheetId: sheet.sheetId, side: 'fronts' };
    state = apply(state, manifest, 'submission_started', target, 'agent');
    assert.equal(workflowReadiness(state).allPrinted, false);
    state = apply(state, manifest, 'submission_succeeded', target, 'agent');
  }
  assert.equal(workflowReadiness(state).canQualityCheck, true);
  state = apply(state, manifest, 'quality_checked'); state = apply(state, manifest, 'packed');
  const targets = [{ sheetId: flyer.sheetId, side: 'fronts' }];
  assert.throws(() => apply(state, manifest, 'reprint', { ...targets[0], productId: 'starter-kit', targets: [{ ...targets[0], side: 'backs' }], reason: 'blank' }), /selected page|submitted page/);
  state = apply(state, manifest, 'reprint', { ...targets[0], productId: 'starter-kit', targets, reason: 'blank flyer' });
  assert.equal(state.sheets[flyer.sheetId].fronts, 'queued'); assert.equal(state.sheets[flyer.sheetId].backs, 'not_required');
  assert.equal(state.sheets[flyer.sheetId].glued, undefined); assert.equal(state.sheets[flyer.sheetId].cut, undefined);
  assert.equal(state.qualityChecked, false); assert.equal(state.packed, false);
  assert.equal(workflowReadiness(state).canQualityCheck, false);
});

test('flyer submission does not bypass unfinished card pairs or accessories', () => {
  const manifest = make(); let state = createManufacturingState(manifest);
  for (const sheet of manifest.sheets) for (const side of printSidesForSheet(sheet)) {
    state = apply(state, manifest, 'submission_started', { sheetId: sheet.sheetId, side }, 'agent');
    state = apply(state, manifest, 'submission_succeeded', { sheetId: sheet.sheetId, side }, 'agent');
  }
  assert.equal(workflowReadiness(state).allPrinted, true); assert.equal(workflowReadiness(state).allGlued, false);
  for (const sheet of manifest.sheets.filter(sheet => !isFlyerSheet(sheet))) {
    state = apply(state, manifest, 'glued', { sheetId: sheet.sheetId }); state = apply(state, manifest, 'cut', { sheetId: sheet.sheetId });
  }
  assert.equal(workflowReadiness(state).canQualityCheck, false);
  for (const accessory of manifest.accessoryChecklist) state = apply(state, manifest, 'accessory_picked', { accessoryId: accessory.id });
  assert.equal(workflowReadiness(state).canQualityCheck, true);
});

async function artworkFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'searealm-flyer-render-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const manifest = flyerOnly(), png = new PNG({ width: 2550, height: 3300 });
  png.data.fill(Buffer.from([31, 97, 158, 255]));
  const bytes = PNG.sync.write(png), hash = sha256(bytes), file = path.join(root, `${hash}.png`);
  await writeFile(file, bytes);
  const release = { releaseId: manifest.artworkRelease, flyerVersion: FLYER_RECIPE_VERSION, printTemplates: templates,
    assets: Object.fromEntries(FLYER_SOURCES.map(source => [source.id, { kind: 'flyer', nodeId: source.nodeId,
      width: 2550, height: 3300, sha256: hash, path: `manufacturing/sha256/${hash}.png` }])) };
  return { root, manifest, release, assetFiles: Object.fromEntries(FLYER_SOURCES.map(source => [source.id, file])), bytes, file, hash };
}

test('flyer preflight requires exact private sources and nativeLetter but no backs or water assets', async t => {
  const f = await artworkFixture(t), result = preflightPrintAssets(f.manifest, f.release);
  assert.equal(result.ready, true); assert.deepEqual(result.requiredAssetIds, FLYER_SOURCES.map(source => source.id));
  for (const change of [{ kind: 'card' }, { nodeId: 'wrong' }, { width: 750 }, { height: 1050 }]) {
    const release = structuredClone(f.release); Object.assign(release.assets['flyer-how-to-play'], change);
    assert.equal(preflightPrintAssets(f.manifest, release).ready, false);
  }
  const old = { ...f.release }; delete old.flyerVersion;
  assert.equal(preflightPrintAssets(f.manifest, old).ready, false);
});

test('flyer PDFs embed the whole native image once with no cutter, background, label, Canon page or ticket', async t => {
  const f = await artworkFixture(t), before = JSON.stringify(f.manifest);
  const jobs = await renderJob({ ...f, outputDir: path.join(f.root, 'pdf'), siteOrigin: 'https://searealm.com' });
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every(job => job.side === 'fronts' && job.kind === 'flyer'));
  assert.equal(stockSheetLabel(f.manifest, f.release, f.manifest.sheets[0].sheetId, 'fronts'), null);
  for (const job of jobs) {
    const document = await PDFDocument.load(await readFile(job.file)), page = document.getPage(0);
    assert.equal(document.getPageCount(), 1); assert.deepEqual(page.getSize(), { width: 612, height: 792 });
    const entries = page.node.Resources().lookup(PDFName.of('XObject')).entries(); assert.equal(entries.length, 1);
    const image = document.context.lookup(entries[0][1], PDFRawStream);
    assert.equal(image.dict.lookup(PDFName.of('Width')).asNumber(), 2550);
    assert.equal(image.dict.lookup(PDFName.of('Height')).asNumber(), 3300);
    assert.ok(Buffer.from(decodePDFRawStream(image).decode()).equals(Buffer.alloc(2550 * 3300 * 3, Buffer.from([31, 97, 158]))));
  }
  assert.equal(JSON.stringify(f.manifest), before);
});

test('agent submits only queued Epson flyer pages and a selective reprint never submits a back or another flyer', async t => {
  const f = await artworkFixture(t), before = JSON.stringify(f.manifest), printed = [];
  await mkdir(path.join(f.root, 'assets')); await writeFile(path.join(f.root, 'assets', `${f.hash}.png`), f.bytes);
  let state = createManufacturingState(f.manifest);
  const client = { download: () => assert.fail('Verified cached PNG should be reused'), async post(payload) {
    if (payload.action === 'event') state = applyManufacturingEvent(state, f.manifest, normalizedEvent(payload.event, "agent"));
    if (payload.action === 'block') assert.fail(payload.issue);
    return { state, phase: payload.action === 'settle' ? 'awaiting_operator' : 'active', renewed: true };
  } };
  const run = () => runJob({ job: { order_id: 'flyer-test', lease_token: 'test-lease', manifest: f.manifest, release: f.release, state },
    client, config: {}, root: f.root, siteOrigin: 'https://searealm.com', prepare: async () => {},
    render: async () => f.manifest.sheets.map(sheet => ({ sheetId: sheet.sheetId, side: 'fronts', kind: 'flyer', file: path.join(f.root, `${sheet.sheetId}.pdf`) })),
    print: async (_config, job) => printed.push(job) });
  await run(); assert.equal(printed.length, 2); assert.ok(printed.every(job => job.side === 'fronts'));
  state = apply(state, f.manifest, 'reprint', { sheetId: f.manifest.sheets[1].sheetId, side: 'fronts', reason: 'damaged flyer' });
  await run(); assert.equal(printed.length, 3); assert.equal(printed[2].sheetId, f.manifest.sheets[1].sheetId);
  assert.equal(JSON.stringify(f.manifest), before);
});
