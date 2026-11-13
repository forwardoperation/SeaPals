import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as layouts from './printPlan.mjs';
import { PRINT_LAYOUT, BACK_TEMPLATE, V10_PRINT_LAYOUT, V10_BACK_TEMPLATE, resolvePrintTemplates, createManufacturingManifest, preflightPrintAssets, verifyManifest } from './printPlan.mjs';
import { CUTTER_LAYOUT_V10, CUTTER_LAYOUT_V11, backgroundsForLayout } from './backdrops.mjs';
import { contentHash, buildPrintingCatalog } from './boosters.mjs';
import { validateRelease } from './integration.mjs';
import { createHoloBatch, verifyHoloBatch } from './holoBatch.mjs';
import { buildSourceMap, checkCutterTemplates, validateCutterTemplate } from '../../../scripts/manufacturing/sync-figma.mjs';
const read=async relative=>JSON.parse(await readFile(new URL(relative,import.meta.url),'utf8'));
const fixture=await read('../../../scripts/manufacturing/fixtures/grid-template-nov13-final.json');
const previous=await read('../../../scripts/manufacturing/fixtures/grid-template-nov13.json');
const pinned=await read('./test-fixtures/layout-hashes-through-v10.json');
const templates={version:CUTTER_LAYOUT_V11,fronts:PRINT_LAYOUT,backs:BACK_TEMPLATE};
const front={...PRINT_LAYOUT,version:CUTTER_LAYOUT_V11},back={...BACK_TEMPLATE,version:CUTTER_LAYOUT_V11};
const documentFor=t=>structuredClone(fixture.documents[t.nodeId]);
const setList=await read('../../data/gallery-set-list.json'),gallery=await read('../../data/gallery-images.json'),holos=await read('../../../scripts/manufacturing/figma-holo-sources.json'),catalog=buildPrintingCatalog(setList,gallery);
const mockAsset=(nodeId,width=2550,height=3300)=>({nodeId,width,height,sha256:'b'.repeat(64),path:'manufacturing/sha256/'+'b'.repeat(64)+'.png'});
const releaseFor=selected=>validateRelease({releaseId:'v11-test',figmaVersion:'fixture',catalog,printTemplates:selected,assets:{...Object.fromEntries(catalog.map(c=>[c.printingId,mockAsset('card',750,1050)])),...Object.fromEntries(Object.values(backgroundsForLayout(selected.version)).map(b=>[b.assetId,mockAsset(b.nodeId)]))}});
const manifestFor=(release,productId='reef-dive-pack',randomIndex=()=>0)=>createManufacturingManifest({request:{orderId:'v11-order',orderNumber:'V11-TEST',items:[{productId,quantity:1}]},catalog,artworkRelease:release.releaseId,printTemplates:release.printTemplates,randomIndex,jobKind:'stock',now:'2026-11-13T18:30:00.000Z'});

test('V11 translates only front Y by ten pixels while every historical layout hash remains pinned',()=>{
 for(const[name,hash]of Object.entries(pinned))assert.equal(contentHash(layouts[name]),hash,name);
 assert.deepEqual(PRINT_LAYOUT.positions,V10_PRINT_LAYOUT.positions.map(p=>({...p,y:p.y-10})));
 assert.deepEqual(PRINT_LAYOUT.grid,{...V10_PRINT_LAYOUT.grid,y:77.83999633789062});
 assert.equal(PRINT_LAYOUT.top,V10_PRINT_LAYOUT.top-10);assert.equal(PRINT_LAYOUT.left,V10_PRINT_LAYOUT.left);
 assert.equal(BACK_TEMPLATE,V10_BACK_TEMPLATE);assert.deepEqual(backgroundsForLayout(CUTTER_LAYOUT_V11),backgroundsForLayout(CUTTER_LAYOUT_V10));
 const result=resolvePrintTemplates(templates);assert.deepEqual(result.holoLayout,result.layout);assert.deepEqual(result.holoBackTemplate,result.backTemplate);
});

test('V11 full REST fixture validates the empty grid, moved water, and unchanged rear geometry',()=>{
 assert.equal(fixture.version,'2421423306561987610');
 for(const t of[front,back])assert.deepEqual(validateCutterTemplate(documentFor(t),t),t.positions);
 const source=buildSourceMap(setList,gallery,holos);assert.deepEqual(resolvePrintTemplates(source.templates),resolvePrintTemplates(templates));
 const node=documentFor(front);assert.deepEqual(node.children[1].children,[]);
 assert.equal(node.children[0].children[1].relativeTransform[1][2],66);
 assert.equal(node.children[1].relativeTransform[1][2],77.83999633789062);
 assert.deepEqual(fixture.documents['4317:8435'],node.children[0]);
 assert.equal(source.sources.find(s=>s.id==='print-template-front-background').nodeId,'4317:8435');
 assert.ok(!source.sources.some(s=>s.nodeId===front.nodeId));
 assert.deepEqual(validateCutterTemplate(documentFor(back),{...V10_BACK_TEMPLATE,version:CUTTER_LAYOUT_V10}),BACK_TEMPLATE.positions);
 assert.throws(()=>validateCutterTemplate(node,{...V10_PRINT_LAYOUT}),/Cutter template/);
});

test('V11 source sync reads both parent templates at the pinned snapshot',async()=>{
 let calls=0;await checkCutterTemplates(async route=>{calls++;const u=new URL(route,'https://api.figma.com/v1/');
 assert.equal(u.searchParams.get('version'),fixture.version);assert.equal(u.searchParams.get('geometry'),'paths');assert.equal(u.searchParams.get('ids'),[front.nodeId,back.nodeId].join(','));
 return{version:fixture.version,lastModified:fixture.lastModified,nodes:Object.fromEntries([front,back].map(t=>[t.nodeId,{document:documentFor(t)}]))};
 },{fileKey:front.fileKey,templates},fixture.version);assert.equal(calls,1);
});

for(const[label,mutate]of[
 ['old grid Y',n=>{n.children[1].relativeTransform[1][2]+=10;}],
 ['old water Y',n=>{n.children[0].children[1].relativeTransform[1][2]+=10;}],
 ['changed grid size',n=>{n.children[1].size.y+=1;}],
 ['unequal tracks',n=>{n.children[1].gridRowsSizing='1fr 2fr 1fr';}],
 ['rotated grid',n=>{n.children[1].relativeTransform[1][0]=0.1;}],
 ['hidden unexpected guide',n=>{n.children[1].children=[{id:'unreviewed',type:'RECTANGLE',visible:false}];}],
 ['restored old nine guides',n=>{n.children[1].children=structuredClone(previous.documents[front.nodeId].children[1].children);}],
 ['missing child metadata',n=>{delete n.children[1].children;}],
 ['moved staple',n=>{n.children[0].children.find(c=>c.type==='GROUP').relativeTransform[1][2]+=1;}],
])test('V11 rejects '+label,()=>{const node=documentFor(front);mutate(node);assert.throws(()=>validateCutterTemplate(node,front),/Cutter template/);});

test('V11 independent center checks reject forged saved positions and dimensions',()=>{
 for(const mutate of[t=>{t.positions[0].y+=1;},t=>{t.positions[8].height+=1;},t=>{t.positions[0].x=NaN;},t=>{t.positions[0].rotation=1;},t=>{t.grid.cardHeight+=1;t.positions.forEach(p=>{p.height+=1;});}]){
 const t=structuredClone(front);mutate(t);assert.throws(()=>validateCutterTemplate(documentFor(front),t),/Cutter template/);}
});

test('V11 preserves saved draws and holo contents while new fronts use the translated coordinates',()=>{
 const oldRelease=releaseFor({version:CUTTER_LAYOUT_V10,fronts:V10_PRINT_LAYOUT,backs:V10_BACK_TEMPLATE}),freshRelease=releaseFor(templates);
 for(const productId of['reef-dive-pack','deep-dive-pack','oceanic-dive-pack']){
   const old=manifestFor(oldRelease,productId),fresh=manifestFor(freshRelease,productId),before=JSON.stringify(old);
   assert.deepEqual(fresh.sheets[0].slots.map(s=>s.printingId),old.sheets[0].slots.map(s=>s.printingId));
   assert.equal(preflightPrintAssets(fresh,freshRelease).ready,true);assert.equal(preflightPrintAssets(old,oldRelease).ready,true);verifyManifest(old);assert.equal(JSON.stringify(old),before);
   for(let i=0;i<9;i++)assert.equal(fresh.sheets[0].slots[i].y,old.sheets[0].slots[i].y-10);
 }
 const holo=catalog.find(c=>c.set==='reef'&&c.rarity==='Holo Rare');const batch=createHoloBatch({release:freshRelease,selections:[{printingId:holo.printingId,quantity:10}]});assert.deepEqual(batch.layout,PRINT_LAYOUT);assert.deepEqual(batch.backTemplate,resolvePrintTemplates(templates).backTemplate);assert.equal(verifyHoloBatch(batch,freshRelease).batchHash,batch.batchHash);
 const bad={...freshRelease,printTemplates:{...templates,fronts:V10_PRINT_LAYOUT}};let draws=0;assert.throws(()=>manifestFor(bad,'reef-dive-pack',()=>{draws++;return 0;}),/geometry|template/);assert.equal(draws,0);
});
