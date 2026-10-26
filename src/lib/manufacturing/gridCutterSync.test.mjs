import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCutterTemplate, checkCutterTemplates } from '../../../scripts/manufacturing/sync-figma.mjs';
import { PRINT_LAYOUT, BACK_TEMPLATE, HOLO_PRINT_LAYOUT, HOLO_BACK_TEMPLATE } from './printPlan.mjs';

// Recorded REST geometry contains no image references, artwork paths, or private
// export URLs. The empty grids intentionally test placement without card guides.
const fixture = JSON.parse(await readFile(new URL('../../../scripts/manufacturing/fixtures/grid-template-oct26.json', import.meta.url)));
const templates = [PRINT_LAYOUT, BACK_TEMPLATE, HOLO_PRINT_LAYOUT, HOLO_BACK_TEMPLATE];
const nodeFor = template => structuredClone(fixture.documents[template.nodeId]);
const grid = node => node.children.find(child => child.name === 'card_backs');

test('V5 ordinary and holographic templates preserve their independent grid offsets', () => {
  const measured = templates.map(template => validateCutterTemplate(nodeFor(template), template));
  assert.equal(measured[0][0].rotation, 0);
  assert.ok(Math.abs(measured[0][0].x - 154.03572591145834) < 0.0001);
  assert.ok(Math.abs(measured[0][0].y - 76.96022542317709) < 0.0001);
  assert.equal(measured[0][0].x - measured[2][0].x, 55);
  assert.equal(measured[3][0].x - measured[1][0].x, 45);
  assert.ok(Math.abs(measured[1][0].x - 99.03335571289062) < 0.0001);
  assert.ok(Math.abs(measured[1][0].y - 97.15328979492188) < 0.0001);
  for (let i = 0; i < templates.length; i++) assert.deepEqual(measured[i], templates[i].positions);
});

test('V5 grid shifts, rotation, scale, changed tracks, padding, and size block an export', () => {
  const changes = [
    n => { grid(n).relativeTransform[0][2] += 0.02; },
    n => { grid(n).relativeTransform[1][2] += 0.02; },
    n => { grid(n).relativeTransform[0][1] = 0.001; },
    n => { grid(n).relativeTransform[0][0] = 1.01; },
    n => { grid(n).gridRowsSizing = '1fr 2fr 1fr'; },
    n => { grid(n).gridColumnsSizing = 'repeat(2,minmax(0,1fr))'; },
    n => { grid(n).gridRowCount = 4; },
    n => { grid(n).gridColumnGap = 1; },
    n => { grid(n).paddingLeft = 2; },
    n => { grid(n).size.y += 0.02; },
    n => { grid(n).visible = false; },
    n => { delete grid(n).relativeTransform; },
    n => { n.size.x = 2549; },
    n => { n.relativeTransform[0][0] = -1; },
    n => { n.clipsContent = false; },
  ];
  for (const template of templates) for (const change of changes) {
    const node = nodeFor(template); change(node);
    assert.throws(() => validateCutterTemplate(node, template), /Cutter template/);
  }
});

test('V5 front backgrounds retain full-page exports and reject missing or altered ocean images', () => {
  const changes = [
    n => { n.children[0].visible = false; },
    n => { n.children[0].componentId = 'wrong-component'; },
    n => { n.children[0].relativeTransform[0][2] = 1; },
    n => { n.children[0].size.y = 3301; },
    n => { n.children[0].opacity = 0.5; },
    n => { n.children[0].clipsContent = false; },
    n => { n.children[0].children[0].visible = false; },
    n => { n.children[0].children[0].fills[0].type = 'SOLID'; },
    n => { n.children[0].children[0].relativeTransform[0][2] += 0.02; },
    n => { n.children[0].children[0].fills[0].opacity = 0.5; },
    n => { grid(n).children.push({ type: 'TEXT', characters: 'Guide 1:1' }); },
    n => { n.children.push({ type: 'TEXT', characters: 'Guide 1:1' }); },
  ];
  for (const template of [PRINT_LAYOUT, HOLO_PRINT_LAYOUT]) for (const change of changes) {
    const node = nodeFor(template); change(node);
    assert.throws(() => validateCutterTemplate(node, template), /Cutter template/);
  }
  const wrongLabel = nodeFor(HOLO_PRINT_LAYOUT);
  wrongLabel.children[0].children.find(child => child.type === 'TEXT').visible = false;
  assert.throws(() => validateCutterTemplate(wrongLabel, HOLO_PRINT_LAYOUT), /holographic page label/);
});

test('V5 rear pages require the new water artwork, visible logos, and white card borders', () => {
  const changes = [
    n => { grid(n).children[0].componentId = 'other-card'; },
    n => { grid(n).children[0].relativeTransform[0][2] += 0.02; },
    n => { grid(n).children[0].size.x += 1; },
    n => { grid(n).children[0].children[0].visible = false; },
    n => { grid(n).children[0].children[1].visible = false; },
    n => { grid(n).children[0].strokeWeight = 0; },
    n => { grid(n).children[0].strokes[0].color.b = 0; },
    n => { grid(n).children.pop(); },
    n => { grid(n).children[0].children.push({ type: 'TEXT', characters: 'Guide' }); },
  ];
  for (const template of [BACK_TEMPLATE, HOLO_BACK_TEMPLATE]) for (const change of changes) {
    const node = nodeFor(template); change(node);
    assert.throws(() => validateCutterTemplate(node, template), /Cutter template/);
  }
});

test('V5 validation requests all four templates at one pinned Figma snapshot', async () => {
  const source = { fileKey: PRINT_LAYOUT.fileKey, templates: {
    version: PRINT_LAYOUT.version, fronts: PRINT_LAYOUT, backs: BACK_TEMPLATE,
    holoFronts: HOLO_PRINT_LAYOUT, holoBacks: HOLO_BACK_TEMPLATE,
  } };
  await checkCutterTemplates(async route => {
    const url = new URL(`https://api.figma.com/v1/${route}`);
    assert.equal(url.searchParams.get('ids'), templates.map(t => t.nodeId).join(','));
    assert.equal(url.searchParams.get('version'), 'pinned-oct26');
    assert.equal(url.searchParams.get('geometry'), 'paths');
    return { nodes: Object.fromEntries(templates.map(t => [t.nodeId, { document: nodeFor(t) }])) };
  }, source, 'pinned-oct26');
});
