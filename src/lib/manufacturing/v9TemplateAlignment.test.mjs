import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { V9_PRINT_LAYOUT as PRINT_LAYOUT, V9_BACK_TEMPLATE as BACK_TEMPLATE, V8_PRINT_LAYOUT, V8_BACK_TEMPLATE, resolvePrintTemplates, createManufacturingManifest, preflightPrintAssets, verifyManifest } from './printPlan.mjs';
import { CUTTER_LAYOUT_V8, CUTTER_LAYOUT_V9, backgroundsForLayout } from './backdrops.mjs';
import { contentHash, buildPrintingCatalog } from './boosters.mjs';
import { validateRelease } from './integration.mjs';
import { createHoloBatch, verifyHoloBatch } from './holoBatch.mjs';
import { checkCutterTemplates, validateCutterTemplate } from '../../../scripts/manufacturing/sync-figma.mjs';

const fixture = JSON.parse(await readFile(new URL('../../../scripts/manufacturing/fixtures/grid-template-nov11.json', import.meta.url), 'utf8'));
const templates = { version: CUTTER_LAYOUT_V9, fronts: PRINT_LAYOUT, backs: BACK_TEMPLATE };
const front = { ...PRINT_LAYOUT, version: CUTTER_LAYOUT_V9 }, back = { ...BACK_TEMPLATE, version: CUTTER_LAYOUT_V9 };
const documentFor = template => structuredClone(fixture.documents[template.nodeId]);
const data = async name => JSON.parse(await readFile(new URL('../../data/' + name, import.meta.url), 'utf8'));
const setList = await data('gallery-set-list.json'), gallery = await data('gallery-images.json');
const catalog = buildPrintingCatalog(setList,gallery);
const mockAsset = (nodeId,width=2550,height=3300) => ({nodeId,width,height,sha256:'b'.repeat(64),path:'manufacturing/sha256/'+'b'.repeat(64)+'.png'});
const releaseFor = selected => validateRelease({releaseId:'v9-alignment-test',figmaVersion:'fixture',catalog,printTemplates:selected,assets:{
 ...Object.fromEntries(catalog.map(c=>[c.printingId,mockAsset('card',750,1050)])),
 ...Object.fromEntries(Object.values(backgroundsForLayout(selected.version)).map(b=>[b.assetId,mockAsset(b.nodeId)])),
}});
const manifestFor = (release, randomIndex=()=>0) => createManufacturingManifest({request:{orderId:'v9-test-order',orderNumber:'V9-TEST',items:[{productId:'reef-dive-pack',quantity:1}]},catalog,artworkRelease:release.releaseId,printTemplates:release.printTemplates,randomIndex,jobKind:'stock',now:'2026-11-11T12:00:00.000Z'});

test('V9 records the November 11 shared grids and retains immutable V8 template hashes', () => {
 assert.equal(contentHash(V8_PRINT_LAYOUT),'c3ccf7fbc7681cb2c26033a42f25399d7ca9269e0494d6bdfc0844d2074f9391');
 assert.equal(contentHash(V8_BACK_TEMPLATE),'2885389f50431d0d06f72966696e83c1e787e08c3a72d3f0dfdeceabd0ec31f5');
 assert.equal(PRINT_LAYOUT.grid.x,85); assert.equal(PRINT_LAYOUT.grid.y,62.84000015258789);
 assert.equal(BACK_TEMPLATE.grid.x,146.39999389648438); assert.equal(BACK_TEMPLATE.grid.y,85.83999633789062);
 for (const [fresh,old,delta] of [[PRINT_LAYOUT,V8_PRINT_LAYOUT,15],[BACK_TEMPLATE,V8_BACK_TEMPLATE,14.999603271484375]]) {
   for (let i=0;i<9;i++) { const expected={...old.positions[i],x:old.positions[i].x+delta}; assert.deepEqual(fresh.positions[i],expected); }
 }
 const resolved=resolvePrintTemplates(templates);
 assert.deepEqual(resolved.holoLayout,resolved.layout); assert.deepEqual(resolved.holoBackTemplate,resolved.backTemplate);
});

test('V9 native REST capture validates full measured shared fronts and rear interiors', () => {
 assert.equal(fixture.version,'2420571525357308443');
 for(const template of [front,back]) assert.deepEqual(validateCutterTemplate(documentFor(template),template),template.positions);
 assert.equal(documentFor(front).children[0].children[1].relativeTransform[0][2],83);
 assert.ok(documentFor(back).children[1].children.every(card=>card.strokeWeight===59.08799743652344&&card.strokeAlign==='INSIDE'));
 assert.throws(()=>validateCutterTemplate(documentFor(front),{...V8_PRINT_LAYOUT}),/saved position|positions/);
 assert.throws(()=>validateCutterTemplate(documentFor(back),{...V8_BACK_TEMPLATE,version:CUTTER_LAYOUT_V8}),/saved position|positions/);
});

test('V9 source sync pins the snapshot and requests both native shared templates together', async () => {
 let calls=0;
 await checkCutterTemplates(async route=>{calls++;const url=new URL(route,'https://api.figma.com/v1/');
   assert.equal(url.searchParams.get('geometry'),'paths'); assert.equal(url.searchParams.get('version'),fixture.version);
   assert.equal(url.searchParams.get('ids'),[front.nodeId,back.nodeId].join(','));
   return {version:fixture.version,lastModified:fixture.lastModified,nodes:Object.fromEntries([front,back].map(t=>[t.nodeId,{document:documentFor(t)}]))};
 }, {fileKey:front.fileKey,templates},fixture.version);
 assert.equal(calls,1);
});

for (const [label,template,mutate] of [
 ['old front grid',front,n=>{n.children[1].relativeTransform[0][2]=70;}],
 ['old water position',front,n=>{n.children[0].children[1].relativeTransform[0][2]=68;}],
 ['painted front guide',front,n=>{n.children[0].children[0].fills[0].visible=true;}],
 ['old rear grid',back,n=>{n.children[1].relativeTransform[0][2]=131.400390625;}],
 ['changed rear border',back,n=>{n.children[1].children[8].strokeWeight+=1;}],
 ['moved rear water',back,n=>{n.children[1].children[8].children[0].relativeTransform[0][2]+=1;}],
 ['changed rear logo',back,n=>{n.children[1].children[8].children[1].size.x+=1;}],
 ['hidden rear top bar',back,n=>{n.children[2].visible=false;}],
]) test('V9 rejects '+label,()=>{const node=documentFor(template);mutate(node);assert.throws(()=>validateCutterTemplate(node,template),/Cutter template/);});

test('V9 moves new pack and holo batches while V8 saved manifests keep their exact geometry',()=>{
 const oldRelease=releaseFor({version:CUTTER_LAYOUT_V8,fronts:V8_PRINT_LAYOUT,backs:V8_BACK_TEMPLATE});
 const freshRelease=releaseFor(templates),old=manifestFor(oldRelease),fresh=manifestFor(freshRelease);
 assert.deepEqual(fresh.sheets[0].slots.map(s=>s.printingId),old.sheets[0].slots.map(s=>s.printingId));
 assert.equal(fresh.holoHandling,'pull-finished'); assert.ok(fresh.sheets[0].slots[8].pullFinishedHolo);
 const saved=JSON.stringify(old); verifyManifest(old); assert.equal(preflightPrintAssets(old,oldRelease).ready,true); assert.equal(JSON.stringify(old),saved);
 assert.equal(preflightPrintAssets(fresh,freshRelease).ready,true);
 for (const side of ['fronts','backs']) {const bad=structuredClone(templates);bad[side]=oldRelease.printTemplates[side];let draws=0;
   assert.throws(()=>manifestFor({...freshRelease,printTemplates:bad},()=>{draws++;return 0;}),/geometry|template/);assert.equal(draws,0);
 }
 const holo=catalog.find(c=>c.set==='reef'&&c.rarity==='Holo Rare');
 for (const release of [oldRelease,freshRelease]) {const batch=createHoloBatch({release,selections:[{printingId:holo.printingId,quantity:10}]});
   assert.deepEqual(batch.layout,release.printTemplates.fronts);assert.deepEqual(batch.backTemplate,resolvePrintTemplates(release.printTemplates).backTemplate);
   assert.deepEqual(batch.sheets.map(s=>s.slots.length),[9,1]); assert.equal(verifyHoloBatch(batch,release).batchHash,batch.batchHash);
 }
});
