import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPrintingCatalog} from './boosters.mjs';
import {PRINT_LAYOUT,BACK_TEMPLATE,HOLO_PRINT_LAYOUT,HOLO_BACK_TEMPLATE,V4_PRINT_LAYOUT,V4_BACK_TEMPLATE,resolvePrintTemplates,createManufacturingManifest,preflightPrintAssets} from './printPlan.mjs';
import {backgroundsForLayout} from './backdrops.mjs';
import {validateRelease,requireOrderArtwork} from './integration.mjs';
const read=async n=>JSON.parse(await readFile(new URL(`../../data/${n}`,import.meta.url),'utf8'));
const catalog=buildPrintingCatalog(await read('gallery-set-list.json'),await read('gallery-images.json'));
const request={orderId:'v5-test',orderNumber:'V5-TEST',items:[{productId:'reef-dive-pack',quantity:1}]};
const template=()=>structuredClone({version:PRINT_LAYOUT.version,fronts:PRINT_LAYOUT,backs:BACK_TEMPLATE,holoFronts:HOLO_PRINT_LAYOUT,holoBacks:HOLO_BACK_TEMPLATE});
const asset=(nodeId,width,height)=>({nodeId,width,height,sha256:'a'.repeat(64),path:`manufacturing/sha256/${'a'.repeat(64)}.png`});
function releaseFixture(){return {releaseId:'v5-test',figmaVersion:'pinned',catalog,printTemplates:template(),assets:{...Object.fromEntries(catalog.map(c=>[c.printingId,asset('card',750,1050)])),...Object.fromEntries(Object.values(backgroundsForLayout(PRINT_LAYOUT.version)).map(b=>[b.assetId,asset(b.nodeId,2550,3300)]))}};}
const manifest=t=>createManufacturingManifest({request,catalog,artworkRelease:'v5-test',printTemplates:t,randomIndex:()=>0});
test('V5 requires the exact four template identities before drawing any cards',()=>{
 const valid=template();assert.equal(valid.version,'figma-cutter-nine-up-v5');assert.doesNotThrow(()=>resolvePrintTemplates(valid));
 for(const side of ['fronts','backs','holoFronts','holoBacks'])for(const mutate of [t=>delete t[side],t=>t[side].positions[0].x+=1,t=>t[side].background.nodeId='wrong']){
  const t=template();mutate(t);let draws=0;assert.throws(()=>createManufacturingManifest({request,catalog,artworkRelease:'v5-test',printTemplates:t,randomIndex:()=>{draws++;return 0;}}));assert.equal(draws,0);
 }
});
test('V5 ordinary packs retain finished holo pulls and use ordinary backgrounds',()=>{
 const release=releaseFixture();assert.doesNotThrow(()=>validateRelease(release));assert.doesNotThrow(()=>requireOrderArtwork(request.items,release));
 const saved=manifest(release.printTemplates);assert.equal(saved.holoHandling,'pull-finished');assert.equal(saved.sheets[0].slots[8].pullFinishedHolo.printingId,saved.packs[0].cards[8].printingId);assert.equal(saved.layout.nodeId,'4290:38532');assert.equal(saved.sheets[0].backs.template.nodeId,'4244:451219');assert.ok(saved.sheets[0].slots.every(s=>s.rotation===0));assert.equal(preflightPrintAssets(saved,release).ready,true);
});
test('V5 keeps ordinary and holo offsets separate and preserves V4 saved jobs',()=>{
 const v5=resolvePrintTemplates(template());assert.equal(v5.layout.positions[0].x-v5.holoLayout.positions[0].x,55);assert.equal(v5.holoBackTemplate.positions[0].x-v5.backTemplate.positions[0].x,45);
 const old={version:'figma-cutter-nine-up-v4',fronts:V4_PRINT_LAYOUT,backs:V4_BACK_TEMPLATE};const saved=manifest(old);assert.equal(saved.layout.positions[0].rotation,0.35000001238844786);assert.equal(saved.layout.positions[0].x,153.89588928222656);assert.equal(saved.sheets[0].backs.template.positions[0].y,79.31329345703125);
 assert.equal(preflightPrintAssets(saved,releaseFixture()).ready,false);
});
test('V5 release rejects missing, mixed, or public holo template assets',()=>{
 for(const side of ['holoFronts','holoBacks'])for(const mutate of [(r,id)=>delete r.assets[id],(r,id)=>r.assets[id].nodeId='wrong',(r,id)=>r.assets[id].path='https://example.test/public.png']){
  const r=releaseFixture(),id=r.printTemplates[side].background.assetId;mutate(r,id);assert.throws(()=>validateRelease(r));assert.throws(()=>requireOrderArtwork(request.items,r));
 }
 const old=releaseFixture();old.printTemplates={version:'figma-cutter-nine-up-v4',fronts:V4_PRINT_LAYOUT,backs:V4_BACK_TEMPLATE};old.assets['print-template-front-background']=asset('4116:234587',2439,3239);assert.throws(()=>validateRelease(old),/matching versioned asset identity/);
});
