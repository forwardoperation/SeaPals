import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as layouts from './printPlan.mjs';
import { V10_PRINT_LAYOUT as PRINT_LAYOUT, V10_BACK_TEMPLATE as BACK_TEMPLATE, V9_PRINT_LAYOUT, V9_BACK_TEMPLATE, resolvePrintTemplates, createManufacturingManifest, preflightPrintAssets, verifyManifest } from './printPlan.mjs';
import { CUTTER_LAYOUT_V9, CUTTER_LAYOUT_V10, backgroundsForLayout } from './backdrops.mjs';
import { contentHash, buildPrintingCatalog } from './boosters.mjs';
import { validateRelease } from './integration.mjs';
import { createHoloBatch, verifyHoloBatch } from './holoBatch.mjs';
import { buildSourceMap, checkCutterTemplates, validateCutterTemplate } from '../../../scripts/manufacturing/sync-figma.mjs';

const read = async relative => JSON.parse(await readFile(new URL(relative,import.meta.url),'utf8'));
const fixture = await read('../../../scripts/manufacturing/fixtures/grid-template-nov13.json');
const pinned = await read('./test-fixtures/layout-hashes-through-v9.json');
const templates = { version:CUTTER_LAYOUT_V10, fronts:PRINT_LAYOUT, backs:BACK_TEMPLATE };
const front={...PRINT_LAYOUT,version:CUTTER_LAYOUT_V10},back={...BACK_TEMPLATE,version:CUTTER_LAYOUT_V10};
const documentFor = template => structuredClone(fixture.documents[template.nodeId]);
const setList=await read('../../data/gallery-set-list.json'),gallery=await read('../../data/gallery-images.json'),holoSources=await read('../../../scripts/manufacturing/figma-holo-sources.json');
const catalog=buildPrintingCatalog(setList,gallery);
const mockAsset=(nodeId,width=2550,height=3300)=>({nodeId,width,height,sha256:'b'.repeat(64),path:'manufacturing/sha256/'+'b'.repeat(64)+'.png'});
const releaseFor=selected=>validateRelease({releaseId:'v10-alignment-test',figmaVersion:'fixture',catalog,printTemplates:selected,assets:{
 ...Object.fromEntries(catalog.map(c=>[c.printingId,mockAsset('card',750,1050)])),
 ...Object.fromEntries(Object.values(backgroundsForLayout(selected.version)).map(b=>[b.assetId,mockAsset(b.nodeId)])),
}});
const manifestFor=(release,randomIndex=()=>0)=>createManufacturingManifest({request:{orderId:'v10-test-order',orderNumber:'V10-TEST',items:[{productId:'reef-dive-pack',quantity:1}]},catalog,artworkRelease:release.releaseId,printTemplates:release.printTemplates,randomIndex,jobKind:'stock',now:'2026-11-13T14:00:00.000Z'});

test('V10 preserves every historical layout hash and pins measured rectangles without cell-center rounding',()=>{
 for(const [name,hash]of Object.entries(pinned))assert.equal(contentHash(layouts[name]),hash,name);
 assert.equal(front.grid.x,55);assert.equal(front.grid.y,87.83999633789062);assert.equal(front.grid.width,2330);
 assert.equal(back.grid.x,158);assert.equal(back.grid.y,86);assert.equal(back.grid.width,2310);
 assert.equal(front.cardWidth,738.5999755859375);assert.equal(front.cardHeight,1034.4000244140625);
 assert.notEqual(front.positions[0].height,V9_PRINT_LAYOUT.positions[0].height);
 for(const t of[front,back]){
   const grid=documentFor(t).children[1];const observed=grid.children.map(n=>({x:grid.relativeTransform[0][2]+n.relativeTransform[0][2],y:grid.relativeTransform[1][2]+n.relativeTransform[1][2],width:n.size.x,height:n.size.y,rotation:0}));
   assert.deepEqual(t.positions,observed);assert.equal(t.positions.length,9);
 }
 const result=resolvePrintTemplates(templates);assert.deepEqual(result.holoLayout,result.layout);assert.deepEqual(result.holoBackTemplate,result.backTemplate);
});

test('V10 validates the full parent guides but exports only the native front background instance',()=>{
 assert.equal(fixture.version,'2421344107286948694');
 for(const t of[front,back])assert.deepEqual(validateCutterTemplate(documentFor(t),t),t.positions);
 const source=buildSourceMap(setList,gallery,holoSources);
 assert.equal(front.nodeId,'4311:139557');assert.equal(front.background.nodeId,'4317:8435');
 assert.equal(source.sources.find(s=>s.id==='print-template-front-background').nodeId,'4317:8435');
 assert.ok(!source.sources.some(s=>s.nodeId===front.nodeId),'White calibration rectangles never enter the export list');
 assert.deepEqual(fixture.documents['4317:8435'],documentFor(front).children[0]);
 assert.equal(back.background.nodeId,back.nodeId);
 const invalid=structuredClone(templates);invalid.fronts.background.nodeId=front.nodeId;
 assert.throws(()=>resolvePrintTemplates(invalid),/background/);
 const wrongAsset=releaseFor(templates);wrongAsset.assets['print-template-front-background'].nodeId=front.nodeId;
 assert.throws(()=>validateRelease(wrongAsset),/background|source|identity/);
});

test('V10 source validation pins the snapshot and reads parent guides before native exports',async()=>{
 let calls=0;await checkCutterTemplates(async route=>{calls++;const u=new URL(route,'https://api.figma.com/v1/');
 assert.equal(u.searchParams.get('geometry'),'paths');assert.equal(u.searchParams.get('version'),fixture.version);
 assert.equal(u.searchParams.get('ids'),[front.nodeId,back.nodeId].join(','));
 return {version:fixture.version,lastModified:fixture.lastModified,nodes:Object.fromEntries([front,back].map(t=>[t.nodeId,{document:documentFor(t)}]))};
 },{fileKey:front.fileKey,templates},fixture.version);assert.equal(calls,1);
 const shuffled=documentFor(front);shuffled.children[1].children.reverse();assert.deepEqual(validateCutterTemplate(shuffled,front),front.positions);
});


test('V10 accepts the fully empty front grid without changing its saved Figma-rounded positions',()=>{
 const node=documentFor(front),before=JSON.stringify(front);node.children[1].children=[];
 const output=validateCutterTemplate(node,front);
 assert.deepEqual(output,front.positions);assert.equal(JSON.stringify(front),before);
 assert.notEqual(output,front.positions);assert.notEqual(output[0],front.positions[0]);
 const grid=node.children[1],cw=grid.size.x/3,ch=grid.size.y/3;
 for(let i=0;i<9;i++){
   const x=grid.relativeTransform[0][2]+(i%3)*cw+(cw-front.grid.cardWidth)/2;
   const y=grid.relativeTransform[1][2]+Math.floor(i/3)*ch+(ch-front.grid.cardHeight)/2;
   assert.ok(Math.abs(output[i].x-x)<0.01);assert.ok(Math.abs(output[i].y-y)<0.01);
 }
 assert.notEqual(output[0].x,grid.relativeTransform[0][2]+(cw-front.grid.cardWidth)/2,'Keep observed Figma rounding');
});

test('V10 empty front validation rejects source drift and forged saved positions',()=>{
 for(const mutate of[
   (n,t)=>{t.positions[0].x+=1;},(n,t)=>{t.positions[8].y+=1;},
   (n,t)=>{t.positions[0].height+=1;},(n,t)=>{t.positions[0].rotation=0.01;},
   (n,t)=>{t.positions[0].x=NaN;},(n,t)=>{t.positions.pop();},
   (n,t)=>{t.grid.cardWidth+=1;t.positions.forEach(p=>p.width+=1);},
   n=>{n.children[1].relativeTransform[0][2]+=1;},n=>{n.children[1].size.x+=1;},
   n=>{n.children[1].gridColumnGap=1;},n=>{n.children[1].paddingLeft=1;},
   n=>{n.children[1].gridColumnsSizing='1fr 2fr 1fr';},
   n=>{n.children[0].children[1].relativeTransform[0][2]+=1;},
   n=>{n.children[0].children[4].visible=false;},
 ]){const node=documentFor(front),t=structuredClone(front);node.children[1].children=[];mutate(node,t);
   assert.throws(()=>validateCutterTemplate(node,t),/Cutter template/);}
});

test('V10 distinguishes an empty grid from hidden, incomplete, or unexpected guides',()=>{
 for(const mutate of[
   n=>{delete n.children[1].children;},
   n=>{n.children[1].children.forEach(c=>{c.visible=false;});},
   n=>{n.children[1].children=[{id:'unexpected',type:'RECTANGLE',visible:false}];},
   n=>{n.children[1].children.push({id:'unexpected',type:'RECTANGLE',visible:false});},
   n=>{n.children[1].children=[{id:'unexpected',type:'FRAME'}];},
   n=>{n.children[1].children.splice(0,8);},
 ]){const node=documentFor(front);mutate(node);assert.throws(()=>validateCutterTemplate(node,front),/Cutter template/);}
});

const frontStaples=n=>n.children[0].children.filter(c=>c.type==='GROUP');
for(const [label,t,mutate]of[
 ['old front grid',front,n=>{n.children[1].relativeTransform[0][2]=85;}],
 ['old water position',front,n=>{n.children[0].children[1].relativeTransform[0][2]=83;}],
 ['old card dimensions',front,n=>{n.children[1].children[0].size.y=1034.0333251953125;}],
 ['missing rectangle',front,n=>{n.children[1].children.pop();}],
 ['duplicate rectangle identity',front,n=>{n.children[1].children[1].id=n.children[1].children[0].id;}],
 ['moved last rectangle',front,n=>{n.children[1].children[8].relativeTransform[0][2]+=1;}],
 ['rotated rectangle',front,n=>{n.children[1].children[0].relativeTransform[0][1]=0.01;}],
 ['unexpected card artwork',front,n=>{n.children[1].children[0].type='INSTANCE';}],
 ['painted retired guide',front,n=>{n.children[0].children[0].fills[0].visible=true;}],
 ['missing front staple',front,n=>{frontStaples(n)[0].visible=false;}],
 ['moved front staple',front,n=>{frontStaples(n)[0].relativeTransform[0][2]+=1;}],
 ['unrotated front staple',front,n=>{frontStaples(n)[0].relativeTransform[0][0]=1;}],
 ['changed staple text',front,n=>{frontStaples(n)[0].children[1].characters='OTHER';}],
 ['undashed staple box',front,n=>{frontStaples(n)[0].children[0].strokeDashes=[];}],
 ['old rear width',back,n=>{n.children[1].size.x=2330;}],
 ['old rear spacing',back,n=>{n.children[1].children[2].relativeTransform[0][2]=1572.36669921875;}],
 ['changed rear border',back,n=>{n.children[1].children[8].strokeWeight+=1;}],
 ['moved rear logo',back,n=>{n.children[1].children[8].children[1].relativeTransform[0][2]+=1;}],
 ['missing registration line',back,n=>{n.children.pop();}],
 ['moved registration line',back,n=>{n.children[3].relativeTransform[0][2]+=1;}],
 ['rotated registration line',back,n=>{n.children[3].relativeTransform[0][0]=1;}],
 ['changed registration stroke',back,n=>{n.children[3].strokeWeight=8;}],
 ['hidden rear top bar',back,n=>{n.children[2].visible=false;}],
])test('V10 rejects '+label,()=>{const n=documentFor(t);mutate(n);assert.throws(()=>validateCutterTemplate(n,t),/Cutter template/);});

test('V10 new pack and holo preparation uses measured geometry without changing saved V9 draws',()=>{
 const oldRelease=releaseFor({version:CUTTER_LAYOUT_V9,fronts:V9_PRINT_LAYOUT,backs:V9_BACK_TEMPLATE}),freshRelease=releaseFor(templates);
 const old=manifestFor(oldRelease),fresh=manifestFor(freshRelease),saved=JSON.stringify(old);
 assert.deepEqual(fresh.sheets[0].slots.map(s=>s.printingId),old.sheets[0].slots.map(s=>s.printingId));
 assert.equal(fresh.holoHandling,'pull-finished');assert.ok(fresh.sheets[0].slots[8].pullFinishedHolo);
 verifyManifest(old);assert.equal(preflightPrintAssets(old,oldRelease).ready,true);assert.equal(JSON.stringify(old),saved);
 assert.equal(preflightPrintAssets(fresh,freshRelease).ready,true);
 for(const side of['fronts','backs']){const bad=structuredClone(templates);bad[side]=oldRelease.printTemplates[side];let draws=0;assert.throws(()=>manifestFor({...freshRelease,printTemplates:bad},()=>{draws++;return 0;}),/geometry|template/);assert.equal(draws,0);}
 const holo=catalog.find(c=>c.set==='reef'&&c.rarity==='Holo Rare');for(const release of[oldRelease,freshRelease]){
 const batch=createHoloBatch({release,selections:[{printingId:holo.printingId,quantity:10}]});assert.deepEqual(batch.layout,release.printTemplates.fronts);assert.deepEqual(batch.backTemplate,resolvePrintTemplates(release.printTemplates).backTemplate);assert.deepEqual(batch.sheets.map(s=>s.slots.length),[9,1]);assert.equal(verifyHoloBatch(batch,release).batchHash,batch.batchHash);}
});
