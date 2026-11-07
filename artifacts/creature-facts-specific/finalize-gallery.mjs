import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const dir='artifacts/creature-facts-specific';
const rows=JSON.parse(await fs.readFile(`${dir}/reviewed-evidence.json`,'utf8'));
const manifest=JSON.parse(await fs.readFile('src/data/gallery-images.json','utf8'));
const beforeManifest=JSON.parse(await fs.readFile(`${dir}/manifest-before.json`,'utf8'));
const exports=JSON.parse(await fs.readFile(`${dir}/exports.json`,'utf8'));
const previewPath=id=>`${dir}/${exports.find(x=>x.cardId===id).preserved?'preserved':'previews'}/${id}.png`;
const changes=[];
for(const [cardId] of rows){
 const entry=manifest.cards.find(x=>x.cardId===cardId);if(!entry)throw Error(cardId);
 const bytes=await fs.readFile(previewPath(cardId)),m=await sharp(bytes).metadata();
 if(m.width!==375||m.height!==525)throw Error('Invalid preview size '+cardId);
 const hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);
 changes.push({cardId,src:entry.src,before:beforeManifest.cards.find(x=>x.cardId===cardId).contentHash,contentHash:hash});
 for(let attempt=0;;attempt++){
  try{await fs.copyFile(previewPath(cardId),path.join('public',entry.src));break}
  catch(error){if(attempt>=4)throw error;await new Promise(resolve=>setTimeout(resolve,500))}
 }
 entry.contentHash=hash;
 const exported=exports.find(x=>x.cardId===cardId);
 Object.assign(entry,{width:m.width,height:m.height,reviewedPreviewNodeId:exported.nodeId,exportedAt:new Date().toISOString()});
}
manifest.exportedAt=new Date().toISOString();
await fs.writeFile('src/data/gallery-images.json',JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(`${dir}/updated-images.json`,JSON.stringify(changes,null,2)+'\n');
const ids=['brittlestar','longhorn-cowfish','frogfish','krill-bloom-stage2','sardine-ball-base','herring-ball-stage2'];
const layers=await Promise.all(ids.map(async(id,i)=>({input:await fs.readFile(previewPath(id)),left:(i%3)*375,top:Math.floor(i/3)*525})));
await sharp({create:{width:1125,height:1050,channels:4,background:'white'}}).composite(layers).png().toFile(`${dir}/final-layout-review.png`);
console.log(JSON.stringify({updated:changes.length,differentHashes:changes.filter(x=>x.before!==x.contentHash).length}));
