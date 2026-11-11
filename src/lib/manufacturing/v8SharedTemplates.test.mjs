import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {PNG} from 'pngjs';
import {PDFDocument,PDFName,PDFArray,PDFRawStream,decodePDFRawStream} from 'pdf-lib';
import {buildPrintingCatalog} from './boosters.mjs';
import {V8_PRINT_LAYOUT as PRINT_LAYOUT,V8_BACK_TEMPLATE as BACK_TEMPLATE,V8_HOLO_PRINT_LAYOUT as HOLO_PRINT_LAYOUT,V8_HOLO_BACK_TEMPLATE as HOLO_BACK_TEMPLATE,V7_PRINT_LAYOUT,V7_BACK_TEMPLATE,V7_HOLO_PRINT_LAYOUT,V7_HOLO_BACK_TEMPLATE,resolvePrintTemplates,createManufacturingManifest,preflightPrintAssets,verifyManifest} from './printPlan.mjs';
import {backgroundsForLayout} from './backdrops.mjs';
import {validateRelease,sha256} from './integration.mjs';
import {createHoloBatch,verifyHoloBatch} from './holoBatch.mjs';
import {renderJob,renderHoloBatch} from '../../../scripts/manufacturing/render.mjs';

const read=async name=>JSON.parse(await readFile(new URL(`../../data/${name}`,import.meta.url),'utf8'));
const catalog=buildPrintingCatalog(await read('gallery-set-list.json'),await read('gallery-images.json'));
const shared=()=>structuredClone({version:PRINT_LAYOUT.version,fronts:PRINT_LAYOUT,backs:BACK_TEMPLATE});
const old=()=>structuredClone({version:V7_PRINT_LAYOUT.version,fronts:V7_PRINT_LAYOUT,backs:V7_BACK_TEMPLATE,holoFronts:V7_HOLO_PRINT_LAYOUT,holoBacks:V7_HOLO_BACK_TEMPLATE});
const mockAsset=(nodeId,width=2550,height=3300)=>({nodeId,width,height,sha256:'b'.repeat(64),path:`manufacturing/sha256/${'b'.repeat(64)}.png`});
const releaseFor=(templates=shared())=>validateRelease({releaseId:'shared-template-test',figmaVersion:'fixture',catalog,printTemplates:templates,assets:{...Object.fromEntries(catalog.map(c=>[c.printingId,mockAsset('card',750,1050)])),...Object.fromEntries(Object.values(backgroundsForLayout(templates.version)).map(b=>[b.assetId,mockAsset(b.nodeId)]))}});
const manifestFor=(release,randomIndex=()=>0)=>createManufacturingManifest({request:{orderId:'shared-template-order',orderNumber:'SHARED-TEMPLATE',items:[{productId:'reef-dive-pack',quantity:1}]},catalog,artworkRelease:release.releaseId,printTemplates:release.printTemplates,randomIndex,jobKind:'stock',now:'2026-11-01T12:00:00.000Z'});
const holo=catalog.find(c=>c.set==='reef'&&c.rarity==='Holo Rare');

test('V8 uses one pair for standard and holo at the measured November 1 grid origins',()=>{
 const result=resolvePrintTemplates(shared());
 assert.equal(PRINT_LAYOUT.version,'figma-cutter-nine-up-v8');
 assert.equal(PRINT_LAYOUT.nodeId,'4311:139557');assert.equal(PRINT_LAYOUT.name,'die-cut-front-epson-template');
 assert.equal(PRINT_LAYOUT.grid.x,70);assert.equal(PRINT_LAYOUT.grid.y,62.84000015258789);
 assert.equal(BACK_TEMPLATE.nodeId,'4311:139076');assert.equal(BACK_TEMPLATE.grid.x,131.400390625);
 assert.deepEqual(result.holoLayout,result.layout);assert.deepEqual(result.holoBackTemplate,result.backTemplate);
 assert.deepEqual(HOLO_PRINT_LAYOUT,PRINT_LAYOUT);assert.deepEqual(HOLO_BACK_TEMPLATE,BACK_TEMPLATE);
 assert.deepEqual(Object.keys(backgroundsForLayout(PRINT_LAYOUT.version)).sort(),['backs','fronts']);
 for(const side of ['holoFronts','holoBacks']){const duplicate=shared();duplicate[side]=side==='holoFronts'?PRINT_LAYOUT:BACK_TEMPLATE;assert.throws(()=>resolvePrintTemplates(duplicate),/cannot contain separate holo/);}
 const batch=createHoloBatch({release:releaseFor(),selections:[{printingId:holo.printingId,quantity:10}]});
 assert.deepEqual(batch.layout,result.layout);assert.deepEqual(batch.backTemplate,result.backTemplate);
 assert.deepEqual(batch.sheets.map(s=>s.slots.length),[9,1]);assert.equal(verifyHoloBatch(batch,releaseFor()).batchHash,batch.batchHash);
 assert.ok(!Object.keys(batch.assets).some(id=>id.includes('holo-front')||id==='holographic-back-sheet'));
});

test('V8 keeps dive-pack holo pull instructions and rejects old geometry before drawing',()=>{
 const release=releaseFor(),manifest=manifestFor(release),saved=JSON.stringify(manifest);
 assert.equal(manifest.holoHandling,'pull-finished');assert.ok(manifest.sheets[0].slots[8].pullFinishedHolo);
 assert.equal(manifest.sheets[0].slots[8].x,PRINT_LAYOUT.positions[8].x);
 assert.equal(preflightPrintAssets(manifest,release).ready,true);verifyManifest(manifest);assert.equal(JSON.stringify(manifest),saved);
 for(const side of ['fronts','backs']){
  const bad=shared();bad[side]=old()[side];let draws=0;
  assert.throws(()=>manifestFor({...release,printTemplates:bad},()=>{draws++;return 0;}),/geometry|template/);assert.equal(draws,0);
 }
 const orphan=structuredClone(release);orphan.assets['holographic-back-sheet']=mockAsset('4311:139076');
 assert.throws(()=>validateRelease(orphan),/matching versioned asset identity/);
});

test('V7 standard and dedicated holo geometry remains pinned after V8 becomes current',()=>{
 const release=releaseFor(old()),manifest=manifestFor(release),batch=createHoloBatch({release,selections:[{printingId:holo.printingId,quantity:9}]});
 const before=JSON.stringify({release,manifest,batch});
 assert.equal(manifest.layout.grid.x,145);assert.equal(manifest.layout.grid.y,65.6435546875);
 assert.equal(manifest.sheets[0].backs.template.positions[0].x,84.03335571289062);
 assert.equal(batch.layout.grid.x,95);assert.equal(batch.backTemplate.positions[0].x,129.03335571289062);
 assert.equal(preflightPrintAssets(manifest,release).ready,true);verifyManifest(manifest);verifyHoloBatch(batch,release);
 assert.equal(JSON.stringify({release,manifest,batch}),before);
});

async function inspect(file){
 const doc=await PDFDocument.load(await readFile(file));assert.equal(doc.getPageCount(),1);const p=doc.getPage(0);assert.deepEqual(p.getSize(),{width:612,height:792});
 const raw=p.node.lookup(PDFName.of('Contents')),streams=raw instanceof PDFArray?raw.asArray():[raw];
 const content=streams.map(ref=>Buffer.from(decodePDFRawStream(doc.context.lookup(ref,PDFRawStream)).decode()).toString()).join('\n');
 const placements=[...content.matchAll(/\bq\s+([\s\S]*?)\s+Q\b/g)].filter(m=>/\/\S+ Do/.test(m[1])).map(m=>[...m[1].matchAll(/^([^\n]+) cm$/gm)].map(v=>v[1].trim().split(/\s+/).map(Number)));
 const images=p.node.Resources().lookup(PDFName.of('XObject')).entries().map(([,ref])=>{const image=doc.context.lookup(ref,PDFRawStream);return {width:image.dict.lookup(PDFName.of('Width')).asNumber(),height:image.dict.lookup(PDFName.of('Height')).asNumber(),rgb:Buffer.from(decodePDFRawStream(image).decode())};});
 return {placements,images};
}
test('V8 renders both workflows with one native rear image and identical front placement',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'searealm-v8-shared-'));
 try{
  const release=releaseFor(),assetFiles={};
  const add=async(width,height,color,nodeId)=>{const png=new PNG({width,height});png.data.fill(Buffer.from([...color,255]));const bytes=PNG.sync.write(png),hash=sha256(bytes),file=path.join(root,`${hash}.png`);await writeFile(file,bytes);return {file,asset:{nodeId,width,height,sha256:hash,path:`manufacturing/sha256/${hash}.png`}};};
  const card=await add(750,1050,[21,110,184],'card');for(const c of catalog){release.assets[c.printingId]=card.asset;assetFiles[c.printingId]=card.file;}
  for(const [side,color]of [['fronts',[15,70,130]],['backs',[12,50,140]]]){const ref=release.printTemplates[side].background,a=await add(2550,3300,color,ref.nodeId);release.assets[ref.assetId]=a.asset;assetFiles[ref.assetId]=a.file;}
  const manifest=manifestFor(release,n=>n===10000?9999:0),batch=createHoloBatch({release,selections:[{printingId:holo.printingId,quantity:9}]});
  const ordinary=await renderJob({manifest,release,assetFiles,outputDir:path.join(root,'standard'),siteOrigin:'https://searealm.com'});
  const holographic=await renderHoloBatch({batch,release,assetFiles,outputDir:path.join(root,'holo')});
  assert.deepEqual(ordinary.map(j=>j.side).sort(),['backs','fronts']);
  const fronts=[];
  for(const jobs of [ordinary,holographic]){
   const front=await inspect(jobs.find(j=>j.side==='fronts').file),back=await inspect(jobs.find(j=>j.side==='backs').file);fronts.push(front);
   assert.equal(front.placements.length,10);assert.equal(back.placements.length,1);assert.equal(back.images.length,1);
   assert.deepEqual(back.placements[0],[[1,0,0,1,0,0],[1,0,0,1,0,0],[612,0,0,792,0,0],[1,0,0,1,0,0]]);
   assert.equal(back.images[0].width,2550);assert.equal(back.images[0].height,3300);
   assert.ok(back.images[0].rgb.equals(Buffer.alloc(2550*3300*3,Buffer.from([12,50,140]))),'Full native rear RGB must survive without legacy logo overlays');
  }
  assert.deepEqual(fronts[0].placements,fronts[1].placements);
  const first=fronts[0].placements[1][0];assert.ok(Math.abs(first[4]-PRINT_LAYOUT.positions[0].x*.24)<1e-7);assert.ok(Math.abs(first[5]-(792-(PRINT_LAYOUT.positions[0].y+PRINT_LAYOUT.positions[0].height)*.24))<1e-7);
  const invalid=path.join(root,'mismatch');await assert.rejects(renderJob({manifest,release:{...release,printTemplates:old()},assetFiles,outputDir:invalid,siteOrigin:'https://searealm.com'}),/matching.*templates|matching versioned/);await assert.rejects(readdir(invalid),{code:'ENOENT'});
 }finally{assert.ok(path.resolve(root).startsWith(path.join(os.tmpdir(),'searealm-v8-shared-')));await rm(root,{recursive:true,force:true});}
});
