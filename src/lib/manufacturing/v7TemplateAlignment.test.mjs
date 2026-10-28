import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPrintingCatalog } from './boosters.mjs';
import {
  PRINT_LAYOUT, BACK_TEMPLATE, HOLO_PRINT_LAYOUT, HOLO_BACK_TEMPLATE,
  V5_PRINT_LAYOUT, V5_BACK_TEMPLATE, V5_HOLO_PRINT_LAYOUT, V5_HOLO_BACK_TEMPLATE,
  V6_PRINT_LAYOUT, V6_BACK_TEMPLATE, V6_HOLO_PRINT_LAYOUT, V6_HOLO_BACK_TEMPLATE,
  resolvePrintTemplates, createManufacturingManifest, preflightPrintAssets, verifyManifest,
} from './printPlan.mjs';
import { validateRelease } from './integration.mjs';
import { createHoloBatch, verifyHoloBatch } from './holoBatch.mjs';
import { validateCutterTemplate, checkCutterTemplates } from '../../../scripts/manufacturing/sync-figma.mjs';

const read = async name => JSON.parse(await readFile(new URL(`../../data/${name}`, import.meta.url), 'utf8'));
const catalog = buildPrintingCatalog(await read('gallery-set-list.json'), await read('gallery-images.json'));
const fixture = JSON.parse(await readFile(new URL('../../../scripts/manufacturing/fixtures/grid-template-oct28.json', import.meta.url), 'utf8'));
const sides = ['fronts', 'backs', 'holoFronts', 'holoBacks'];
const templates = version => {
  const values = version === 5 ? [V5_PRINT_LAYOUT, V5_BACK_TEMPLATE, V5_HOLO_PRINT_LAYOUT, V5_HOLO_BACK_TEMPLATE]
    : version === 6 ? [V6_PRINT_LAYOUT, V6_BACK_TEMPLATE, V6_HOLO_PRINT_LAYOUT, V6_HOLO_BACK_TEMPLATE]
      : [PRINT_LAYOUT, BACK_TEMPLATE, HOLO_PRINT_LAYOUT, HOLO_BACK_TEMPLATE];
  return structuredClone({ version: `figma-cutter-nine-up-v${version}`, ...Object.fromEntries(sides.map((side, index) => [side, values[index]])) });
};
const asset = (nodeId, width, height) => ({ nodeId, width, height, sha256: 'b'.repeat(64), path: `manufacturing/sha256/${'b'.repeat(64)}.png` });
function releaseFor(version) {
  const printTemplates = templates(version);
  return validateRelease({ releaseId: `alignment-v${version}`, figmaVersion: `fixture-v${version}`, catalog, printTemplates,
    assets: { ...Object.fromEntries(catalog.map(card => [card.printingId, asset('fixture-card', 750, 1050)])),
      ...Object.fromEntries(sides.map(side => {
        const background = printTemplates[side].background;
        return [background.assetId, asset(background.nodeId, 2550, 3300)];
      })) } });
}
function manifestFor(release) {
  return createManufacturingManifest({ request: { orderId: 'saved-alignment-order', orderNumber: 'ALIGNMENT-TEST', items: [{ productId: 'reef-dive-pack', quantity: 1 }] },
    catalog, artworkRelease: release.releaseId, printTemplates: release.printTemplates, randomIndex: () => 0, now: '2026-10-28T12:00:00.000Z' });
}
const nodeFor = side => structuredClone(fixture.documents[templates(7)[side].nodeId]);
const grid = node => node.children.find(child => child.name === 'card_backs');

test('V7 matches the recorded October 28 geometry for all four independent templates', () => {
  const current = templates(7), expectedX = { fronts: 145, backs: 65, holoFronts: 95, holoBacks: 110 };
  assert.equal(PRINT_LAYOUT.version, 'figma-cutter-nine-up-v7');
  assert.equal(HOLO_PRINT_LAYOUT.version, 'figma-cutter-nine-up-v7');
  for (const side of sides) {
    const document = nodeFor(side);
    assert.equal(grid(document).relativeTransform[0][2], expectedX[side]);
    assert.equal(current[side].grid.x, expectedX[side]);
    assert.deepEqual(validateCutterTemplate(document, current[side]), current[side].positions);
  }
  assert.ok(Math.abs(current.fronts.positions[0].x - 164.03572591145834) < 1e-7);
  assert.ok(Math.abs(current.holoFronts.positions[0].x - 114.03572591145834) < 1e-7);
  assert.equal(current.backs.positions[0].x, 84.03335571289062);
  assert.equal(current.holoBacks.positions[0].x, 129.03335571289062);
});

test('V7 changes only the measured horizontal card origins, preserving V5 and V6 geometry', () => {
  const current = templates(7), previous = templates(6), original = templates(5);
  const expectedDelta = { fronts: -5, backs: -15, holoFronts: 15, holoBacks: -15 };
  assert.deepEqual(sides.map(side => previous[side].grid.x), [150, 80, 80, 125]);
  assert.deepEqual(sides.map(side => original[side].grid.x), [135, 80, 80, 125]);
  for (const side of sides) for (let index = 0; index < 9; index++) {
    const before = previous[side].positions[index], after = current[side].positions[index];
    assert.ok(Math.abs(after.x - before.x - expectedDelta[side]) < 1e-7, `${side} slot ${index + 1}`);
    for (const key of ['y', 'width', 'height', 'rotation']) assert.equal(after[key], before[key]);
  }
  for (const version of [5, 6, 7]) {
    const release = releaseFor(version), manifest = manifestFor(release), saved = JSON.stringify({ release, manifest });
    assert.equal(verifyManifest(manifest).manifestHash, manifest.manifestHash);
    assert.equal(preflightPrintAssets(manifest, release).ready, true);
    assert.equal(JSON.stringify({ release, manifest }), saved, 'Validation must not migrate saved jobs or releases');
    assert.equal(manifest.holoHandling, 'pull-finished');
    assert.ok(manifest.sheets[0].slots[8].pullFinishedHolo, 'Dive packs keep their finished-holo pull instruction');
  }
});

test('Every old/new mixed template side is rejected before a booster draw', () => {
  for (const previousVersion of [5, 6]) for (const side of sides) for (const [base, replacement] of [[7, previousVersion], [previousVersion, 7]]) {
    const mixed = templates(base); mixed[side] = templates(replacement)[side];
    assert.throws(() => resolvePrintTemplates(mixed), /geometry|template/);
    let draws = 0;
    assert.throws(() => createManufacturingManifest({ request: { orderId: 'mixed', orderNumber: 'MIXED', items: [{ productId: 'reef-dive-pack', quantity: 1 }] },
      catalog, artworkRelease: 'mixed', printTemplates: mixed, randomIndex: () => { draws++; return 0; } }));
    assert.equal(draws, 0, 'Reject changed geometry before randomization');
  }
  for (const previousVersion of [5, 6]) {
    const old = releaseFor(previousVersion), current = releaseFor(7);
    assert.equal(preflightPrintAssets(manifestFor(old), { ...current, releaseId: old.releaseId }).ready, false);
    assert.equal(preflightPrintAssets(manifestFor(current), { ...old, releaseId: current.releaseId }).ready, false);
  }
});

test('V7 holo batches use the moved holo grids while saved V5/V6 batches remain valid', () => {
  const holo = catalog.find(card => card.set === 'reef' && card.rarity === 'Holo Rare');
  for (const version of [5, 6, 7]) {
    const release = releaseFor(version), batch = createHoloBatch({ release, selections: [{ printingId: holo.printingId, quantity: 10 }] });
    const saved = JSON.stringify(batch);
    assert.equal(batch.layout.grid.x, version === 7 ? 95 : 80);
    assert.equal(batch.backTemplate.positions[0].x, (version === 7 ? 110 : 125) + 19.033355712890625);
    assert.deepEqual(batch.sheets.map(sheet => sheet.slots.length), [9, 1]);
    assert.equal(verifyHoloBatch(batch, release).batchHash, batch.batchHash);
    assert.equal(JSON.stringify(batch), saved);
    if (version !== 7) assert.throws(() => verifyHoloBatch(batch, { ...releaseFor(7), releaseId: release.releaseId }), /pinned artwork/);
  }
});

test('V7 source validation catches restored old offsets and altered native backdrop placement', () => {
  const current = templates(7), previous = templates(6);
  for (const side of sides) {
    const document = nodeFor(side); grid(document).relativeTransform[0][2] = previous[side].grid.x;
    assert.throws(() => validateCutterTemplate(document, current[side]), /moved from its saved position/);
  }
  for (const side of ['fronts', 'holoFronts']) {
    const document = nodeFor(side), background = document.children[0];
    background.relativeTransform[0][2] += 1;
    assert.throws(() => validateCutterTemplate(document, current[side]), /moved from its saved position/);
  }
});

test('V7 sync checks all four templates at the same recorded Figma snapshot', async () => {
  const current = templates(7);
  await checkCutterTemplates(async route => {
    const query = new URL(`https://api.figma.com/v1/${route}`).searchParams;
    assert.equal(query.get('version'), fixture.version);
    assert.equal(query.get('geometry'), 'paths');
    assert.equal(query.get('ids'), sides.map(side => current[side].nodeId).join(','));
    return { nodes: Object.fromEntries(sides.map(side => [current[side].nodeId, { document: nodeFor(side) }])) };
  }, { fileKey: PRINT_LAYOUT.fileKey, templates: current }, fixture.version);
});

test('Serialized V5/V6/V7 release references keep historical water offsets through the outer version', async () => {
  for (const [version, name] of [[5, 'grid-template-oct26.json'], [6, 'grid-template-oct26-shifted.json'], [7, 'grid-template-oct28.json']]) {
    const captured = JSON.parse(await readFile(new URL(`../../../scripts/manufacturing/fixtures/${name}`, import.meta.url), 'utf8'));
    const saved = templates(version);
    // The release stores the version once, outside its four template refs.
    for (const side of sides) delete saved[side].version;
    await checkCutterTemplates(async () => ({ nodes: Object.fromEntries(sides.map(side => [saved[side].nodeId, { document: captured.documents[saved[side].nodeId] }])) }),
      { fileKey: PRINT_LAYOUT.fileKey, templates: saved }, captured.version);
  }
});
