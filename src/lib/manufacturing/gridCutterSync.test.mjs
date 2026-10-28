import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCutterTemplate, checkCutterTemplates } from '../../../scripts/manufacturing/sync-figma.mjs';
import { V5_PRINT_LAYOUT as PRINT_LAYOUT, V5_BACK_TEMPLATE as BACK_TEMPLATE, V5_HOLO_PRINT_LAYOUT as HOLO_PRINT_LAYOUT, V5_HOLO_BACK_TEMPLATE as HOLO_BACK_TEMPLATE, V6_PRINT_LAYOUT as CURRENT_PRINT_LAYOUT, V6_HOLO_PRINT_LAYOUT as CURRENT_HOLO_PRINT_LAYOUT } from './printPlan.mjs';

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


const shiftedFixture = JSON.parse(await readFile(new URL('../../../scripts/manufacturing/fixtures/grid-template-oct26-shifted.json', import.meta.url)));
const currentTemplates = [CURRENT_PRINT_LAYOUT, BACK_TEMPLATE, CURRENT_HOLO_PRINT_LAYOUT, HOLO_BACK_TEMPLATE];
const shiftedNode = template => structuredClone(shiftedFixture.documents[template.nodeId]);

test('V6 matches the later Figma front shift while the other three templates remain unchanged', () => {
  assert.equal(CURRENT_PRINT_LAYOUT.version, 'figma-cutter-nine-up-v6');
  assert.equal(shiftedFixture.version, '2414752317081305228');
  assert.equal(grid(shiftedNode(CURRENT_PRINT_LAYOUT)).relativeTransform[0][2], 150);
  assert.equal(shiftedNode(CURRENT_PRINT_LAYOUT).children[0].children[0].relativeTransform[0][2], 139);
  for (const [index, current] of currentTemplates.entries()) {
    const measured = validateCutterTemplate(shiftedNode(current), current);
    assert.deepEqual(measured, current.positions);
    measured.forEach((position, slot) => {
      assert.ok(Math.abs(position.x - templates[index].positions[slot].x - (index === 0 ? 15 : 0)) < 0.000001);
      for (const key of ['y', 'width', 'height', 'rotation']) assert.equal(position[key], templates[index].positions[slot][key]);
    });
  }
  assert.throws(() => validateCutterTemplate(shiftedNode(CURRENT_PRINT_LAYOUT), PRINT_LAYOUT), /ocean background|card grid/);
  assert.throws(() => validateCutterTemplate(nodeFor(PRINT_LAYOUT), CURRENT_PRINT_LAYOUT), /ocean background|card grid/);
  for (const restoreOld of [
    n => { grid(n).relativeTransform[0][2] = 135; },
    n => { n.children[0].children[0].relativeTransform[0][2] = 119; },
  ]) {
    const changed = shiftedNode(CURRENT_PRINT_LAYOUT); restoreOld(changed);
    assert.throws(() => validateCutterTemplate(changed, CURRENT_PRINT_LAYOUT), /moved from its saved position/);
  }
});

test('V6 sync validates all four template exports against the shifted pinned snapshot', async () => {
  const source = { fileKey: CURRENT_PRINT_LAYOUT.fileKey, templates: {
    version: CURRENT_PRINT_LAYOUT.version, fronts: CURRENT_PRINT_LAYOUT, backs: BACK_TEMPLATE,
    holoFronts: CURRENT_HOLO_PRINT_LAYOUT, holoBacks: HOLO_BACK_TEMPLATE,
  } };
  await checkCutterTemplates(async route => {
    const url = new URL(`https://api.figma.com/v1/${route}`);
    assert.equal(url.searchParams.get('version'), shiftedFixture.version);
    assert.equal(url.searchParams.get('geometry'), 'paths');
    assert.equal(url.searchParams.get('ids'), currentTemplates.map(t => t.nodeId).join(','));
    return { nodes: Object.fromEntries(currentTemplates.map(t => [t.nodeId, { document: shiftedNode(t) }])) };
  }, source, shiftedFixture.version);
});
