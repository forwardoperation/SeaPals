import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { fixedArtworkSources, LEGACY_CONDITION_SOURCES } from './recipes.mjs';
import { conditionOutputMapping, validFixedSheetOutputPositions, fixedSheetOutputPositions } from './sourceGeometry.mjs';
import { normalizeFixedSheetExport } from '../../../scripts/manufacturing/sync-figma.mjs';

const read = async name => JSON.parse(await readFile(new URL('./test-fixtures/' + name, import.meta.url)));
const current = await read('conditions-source-geometry-2026-11-05.json');
const legacy = await read('conditions-source-geometry-2026-10-29.json');
const sources = fixedArtworkSources().filter(s => s.outputProfile);
const raw = new PNG({ width: 2216, height: 3088 });
for (const [index, rgba] of [[0,[31,77,121,233]],[2215,[112,19,204,127]],[2216 * 3087,[12,89,54,255]],[2216 * 3088 - 1,[224,76,19,177]]]) raw.data.set(rgba,index * 4);
const bytes = PNG.sync.write(raw);
const normalized = new Map(sources.map(source => [source.id, normalizeFixedSheetExport(bytes,current.documents[source.nodeId],source)]));

test('Conditions source mapping uses current originals and leaves all source pixels unscaled', () => {
  assert.deepEqual(sources.map(s => [s.id,s.nodeId,s.exportNodeId]), [
    ['sheet-conditions-1','2366:320222','2366:320223'],
    ['sheet-conditions-2','2366:320233','2366:320234'],
  ]);
  for (const source of sources) {
    const before = structuredClone(current.documents[source.nodeId]);
    const result = normalized.get(source.id), png = PNG.sync.read(result.bytes,{checkCRC:true});
    assert.deepEqual([png.width,png.height],[2550,3300]);
    for (let y = 0; y < raw.height; y++) assert.deepEqual(
      png.data.subarray(((y+106)*2550+167)*4,((y+106)*2550+167+2216)*4),
      raw.data.subarray(y*2216*4,(y+1)*2216*4), 'Every native source pixel is copied, not resampled');
    assert.equal(png.data[3],0,'Letter padding stays transparent');
    assert.equal(result.positions.length,9);
    assert.ok(result.positions.every(p=>p.width===720&&p.height===1008));
    assert.equal(result.sourceGeometry.mode,'mapped-grid-letter');
    assert.equal(result.sourceGeometry.exportNodeId,source.exportNodeId);
    assert.deepEqual(result.sourceGeometry.sourceBounds,{x:167,y:106,width:2216,height:3088});
    assert.deepEqual(result.sourceGeometry.cropTranslation,{x:0,y:0});
    assert.equal(validFixedSheetOutputPositions({nodeId:source.nodeId,...result},source.id),true);
    assert.deepEqual(current.documents[source.nodeId],before);
  }
});

test('Both new Conditions outputs exactly match legacy calibrated placement for V8 fronts and backs', () => {
  for (const source of sources) {
    const oldSource = LEGACY_CONDITION_SOURCES.find(s=>s.id===source.id);
    const old = {nodeId:oldSource.nodeId,...normalizeFixedSheetExport(PNG.sync.write(new PNG({width:2330,height:3170})),legacy.documents[oldSource.nodeId],oldSource)};
    const fresh = {nodeId:source.nodeId,...normalized.get(source.id)};
    assert.equal(validFixedSheetOutputPositions(old,source.id),true,'Saved legacy Conditions remain valid');
    assert.deepEqual(fresh.outputPositions,old.outputPositions);
    for (const grid of [{x:70,y:62.84000015258789},{x:131.400390625,y:85.83999633789062}])
      assert.deepEqual(fixedSheetOutputPositions(fresh,{version:'figma-cutter-nine-up-v8',grid}),
        fixedSheetOutputPositions(old,{version:'figma-cutter-nine-up-v8',grid}));
    assert.deepEqual(fixedSheetOutputPositions(fresh,{version:'figma-cutter-nine-up-v7'}),old.outputPositions);
  }
});

test('V9 translates both Conditions mappings with the new shared grids without changing insets or pixels', () => {
  for (const source of sources) {
    const fresh = { nodeId: source.nodeId, ...normalized.get(source.id) };
    const before = JSON.stringify(fresh.outputPositions);
    for (const [oldX, newX, y] of [[70,85,62.84000015258789],[131.400390625,146.39999389648438,85.83999633789062]]) {
      const old = fixedSheetOutputPositions(fresh,{version:'figma-cutter-nine-up-v8',grid:{x:oldX,y}});
      const current = fixedSheetOutputPositions(fresh,{version:'figma-cutter-nine-up-v9',grid:{x:newX,y}});
      for (let i=0;i<9;i++) {
        assert.ok(Math.abs(current[i].x-old[i].x-(newX-oldX))<1e-10);
        assert.deepEqual({...current[i],x:old[i].x},old[i]);
      }
    }
    assert.equal(JSON.stringify(fresh.outputPositions),before);
  }
});

test('V10 Conditions follows the updated front grid while retaining reviewed native insets', () => {
  for (const source of sources) {
    const fresh = {nodeId:source.nodeId,...normalized.get(source.id)}, before = JSON.stringify(fresh.outputPositions);
    const previous = fixedSheetOutputPositions(fresh,{version:'figma-cutter-nine-up-v9',grid:{x:85,y:62.84000015258789}});
    const current = fixedSheetOutputPositions(fresh,{version:'figma-cutter-nine-up-v10',grid:{x:55,y:87.83999633789062}});
    for (let i=0;i<9;i++) {
      assert.ok(Math.abs(current[i].x-previous[i].x+30)<1e-10);
      assert.ok(Math.abs(current[i].y-previous[i].y-(87.83999633789062-62.84000015258789))<1e-10);
      assert.deepEqual({...current[i],x:previous[i].x,y:previous[i].y},previous[i]);
    }
    assert.equal(JSON.stringify(fresh.outputPositions),before);
  }
});

test('V11 Conditions moves exactly 10 pixels up without altering its reviewed insets', () => {
  for (const source of sources) {
    const asset = {nodeId:source.nodeId,...normalized.get(source.id)};
    const old = fixedSheetOutputPositions(asset,{version:'figma-cutter-nine-up-v10',grid:{x:55,y:87.83999633789062}});
    const current = fixedSheetOutputPositions(asset,{version:'figma-cutter-nine-up-v11',grid:{x:55,y:77.83999633789062}});
    assert.deepEqual(current,old.map(position=>({...position,y:position.y-10})));
  }
});

test('Pre-inset original Conditions releases retain their standard-layout reprint behavior', () => {
  assert.equal(current.historicFullSheetReleaseId,'decks-2415421149796541083-8661fb89145b');
  for (const [id,asset] of Object.entries(current.historicFullSheetAssets)) {
    assert.equal(asset.sourceGeometry,undefined);
    assert.equal(asset.outputPositions,undefined);
    assert.ok(['2366:320222','2366:320233'].includes(asset.nodeId));
    assert.equal(validFixedSheetOutputPositions(asset,id),true);
    assert.equal(fixedSheetOutputPositions(asset,{version:'figma-cutter-nine-up-v8',grid:{x:70,y:62.84000015258789}}),undefined,
      'The caller continues selecting the saved standard layout when no Conditions inset was recorded');
  }
});

test('New Conditions profile rejects forged identity, geometry, calibration, and cropped cards', () => {
  const mutations = [
    a=>{a.nodeId='4335:335039';},a=>{a.nodeId='unreviewed';},a=>{delete a.outputPositions;},
    a=>{a.sourceGeometry.mode='isolated-grid-letter';},a=>{delete a.sourceGeometry.outputProfile;},
    a=>{delete a.outputPositions;delete a.sourceGeometry.outputProfile;delete a.sourceGeometry.outputReferenceBounds;a.sourceGeometry.mode='isolated-grid-letter';},
    a=>{a.sourceGeometry.outputProfile='unknown';},a=>{a.sourceGeometry.exportNodeId='2366:320234';},
    a=>{a.sourceGeometry.sourceBounds.width=2330;},a=>{a.sourceGeometry.sourceBounds.x++;},
    a=>{a.sourceGeometry.padding.x++;},a=>{a.sourceGeometry.cropTranslation.y=0.1;},
    a=>{a.sourceGeometry.outputReferenceBounds.y++;},a=>{a.outputPositions[0].x+=0.0001;},
    a=>{a.outputPositions[0].width=720;},a=>{a.outputPositions[0].rotation=90;},
    a=>{a.positions[0].width=698.4;},a=>{a.positions[0].x++;},a=>{a.sourceGeometry.sourcePositions.pop();},
    a=>{a.sourceGeometry.sourcePositions[0].x=-1;},
    a=>{a.sourceGeometry.sourcePositions[1]={...a.sourceGeometry.sourcePositions[0]};a.positions[1]={...a.positions[0]};},
    a=>{[a.sourceGeometry.sourcePositions[0],a.sourceGeometry.sourcePositions[1]]=[a.sourceGeometry.sourcePositions[1],a.sourceGeometry.sourcePositions[0]];[a.positions[0],a.positions[1]]=[a.positions[1],a.positions[0]];},
  ];
  const source=sources[0], valid={nodeId:source.nodeId,...normalized.get(source.id)};
  for (const mutate of mutations) {const a=structuredClone(valid);mutate(a);assert.equal(validFixedSheetOutputPositions(a,source.id),false);}
  assert.equal(validFixedSheetOutputPositions(valid,'sheet-blue-water-1'),false);
  assert.equal(conditionOutputMapping('unreviewed'),null);
  const mapping=conditionOutputMapping(source.id);mapping.outputPositions[0].x++;
  assert.notDeepEqual(mapping,conditionOutputMapping(source.id),'Callers cannot alter the reviewed profile');
});

test('Importer rejects wrong source profile and changed actual grid bounds', () => {
  const source=sources[0], doc=current.documents[source.nodeId];
  for (const altered of [{...source,outputProfile:'unknown'},{...source,outputProfile:undefined},{...source,exportNodeId:'2366:320234'}])
    assert.throws(()=>normalizeFixedSheetExport(bytes,doc,altered),/reviewed|mapping/);
  const changed=structuredClone(doc);changed.children[0].absoluteBoundingBox.width++;
  assert.throws(()=>normalizeFixedSheetExport(bytes,changed,source),/PNG.*measured bounds/);
});
