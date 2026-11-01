import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PRINT_LAYOUT, BACK_TEMPLATE } from './printPlan.mjs';
import { checkCutterTemplates, validateCutterTemplate } from '../../../scripts/manufacturing/sync-figma.mjs';

const fixture = JSON.parse(await readFile(new URL('../../../scripts/manufacturing/fixtures/grid-template-nov1.json', import.meta.url), 'utf8'));
const front = { ...PRINT_LAYOUT, version: PRINT_LAYOUT.version }, back = { ...BACK_TEMPLATE, version: PRINT_LAYOUT.version };
const documentFor = template => structuredClone(fixture.documents[template.nodeId]);

test('V8 native REST fixture reproduces the one shared front and rear grid', () => {
  assert.equal(fixture.version, '2416862841488484439');
  for (const template of [front, back])
    assert.deepEqual(validateCutterTemplate(documentFor(template), template), template.positions);
  assert.deepEqual(front.grid, { nodeId: '4311:139561', x: 70, y: 62.84000015258789, width: 2330, height: 3170,
    columns: 3, rows: 3, cardWidth: 738.59521484375, cardHeight: 1034.0333251953125 });
  assert.equal(back.grid.x, 131.400390625);
  assert.equal(front.background.nodeId, front.nodeId);
  assert.equal(back.background.nodeId, back.nodeId);
});

test('V8 snapshot validation requests exactly the shared pair with native transforms', async () => {
  let calls = 0;
  await checkCutterTemplates(async route => {
    calls++;
    const url = new URL(route, 'https://api.figma.com/v1/');
    assert.equal(url.searchParams.get('version'), fixture.version);
    assert.equal(url.searchParams.get('geometry'), 'paths');
    assert.equal(url.searchParams.get('ids'), [front.nodeId, back.nodeId].join(','));
    return { version: fixture.version, lastModified: fixture.lastModified,
      nodes: Object.fromEntries([front, back].map(template => [template.nodeId, { document: documentFor(template) }])) };
  }, { fileKey: front.fileKey, templates: { version: front.version, fronts: front, backs: back } }, fixture.version);
  assert.equal(calls, 1);
});

const frontChanges = [
  ['renamed frame', node => { node.name = 'outdated-template'; }],
  ['transparent paper', node => { node.fills = []; }],
  ['moved grid', node => { node.children[1].relativeTransform[1][2] += 1; }],
  ['rotated grid', node => { node.children[1].relativeTransform[0][1] = 0.01; }],
  ['added card placeholder', node => { node.children[1].children.push({ id: 'extra', type: 'RECTANGLE' }); }],
  ['unequal grid', node => { node.children[1].gridColumnsSizing = '1fr 2fr 1fr'; }],
  ['hidden water', node => { node.children[0].children[1].visible = false; }],
  ['moved water', node => { node.children[0].children[1].relativeTransform[0][2] += 1; }],
  ['solid water cover', node => { node.children[0].children[1].fills.push(structuredClone(node.fills[0])); }],
  ['restored old guide', node => { node.children[0].children[0].fills[0].visible = true; }],
  ['restored old separator', node => { node.children[0].children[2].visible = true; }],
  ['added holo-only label', node => { node.children[0].children.push({ id: 'label', type: 'TEXT', characters: 'HOLOGRAPHIC ONLY' }); }],
];
for (const [label, change] of frontChanges) test('V8 rejects front ' + label, () => {
  const node = documentFor(front); change(node);
  assert.throws(() => validateCutterTemplate(node, front), /Cutter template/);
});

const rearChanges = [
  ['hidden top bar', node => { node.children[2].visible = false; }],
  ['moved top bar', node => { node.children[2].relativeTransform[1][2] += 1; }],
  ['thicker top bar', node => { node.children[2].size.y += 1; }],
  ['white top bar', node => { node.children[2].fills = structuredClone(node.fills); }],
  ['missing staple marker', node => { node.children[0].children.pop(); }],
  ['moved staple marker', node => { node.children[0].children[1].relativeTransform[1][2] += 1; }],
  ['changed staple text', node => { node.children[0].children[1].children[1].characters = 'HOLOGRAPHIC ONLY'; }],
  ['changed staple rotation', node => { node.children[0].children[1].children[1].relativeTransform[0][0] = 1; }],
  ['solid staple border', node => { node.children[0].children[1].children[0].strokeDashes = []; }],
  ['restored old bar', node => { node.children[0].children[0].visible = true; }],
  ['moved grid', node => { node.children[1].relativeTransform[0][2] -= 1; }],
  ['missing card', node => { node.children[1].children.pop(); }],
  ['moved card', node => { node.children[1].children[0].relativeTransform[1][2] += 1; }],
  ['unclipped card', node => { node.children[1].children[0].clipsContent = false; }],
  ['changed card border', node => { node.children[1].children[0].strokeWeight += 1; }],
  ['hidden card water', node => { node.children[1].children[0].children[0].children[0].visible = false; }],
  ['removed water image', node => { node.children[1].children[0].children[0].children[0].fills.pop(); }],
  ['moved logo', node => { node.children[1].children[0].children[1].relativeTransform[1][2] += 1; }],
  ['hidden logo', node => { node.children[1].children[0].children[1].visible = false; }],
  ['missing logo text', node => { node.children[1].children[0].children[1].children[0].characters = ''; }],
];
for (const [label, change] of rearChanges) test('V8 rejects rear ' + label, () => {
  const node = documentFor(back); change(node);
  assert.throws(() => validateCutterTemplate(node, back), /Cutter template/);
});
