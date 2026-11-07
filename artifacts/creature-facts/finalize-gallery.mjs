import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const dir='artifacts/creature-facts',file='src/data/gallery-images.json';
const manifest=JSON.parse(await fs.readFile(file,'utf8'));
try{await fs.copyFile(file,path.join(dir,'gallery-manifest-before.json'),fs.constants.COPYFILE_EXCL)}catch(e){if(e.code!=='EEXIST')throw e;}
const changes=[];
for(const entry of manifest.cards){
 const bytes=await fs.readFile(path.join('public',entry.src));
 const contentHash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);
 if(contentHash!==entry.contentHash){changes.push({cardId:entry.cardId,src:entry.src,before:entry.contentHash,contentHash});entry.contentHash=contentHash;}
 if(entry.cardId==='flounder')Object.assign(entry,{nodeId:'4011:79142',sourcePageId:'4025:79142',sourcePage:'Gallery — reviewed previews',sourceName:'Southern Flounder — legacy gallery',sourceWidth:750,sourceHeight:1050,sourceStatus:'exported-legacy-fact-review'});
}
manifest.exportedAt=new Date().toISOString();
await fs.writeFile(file,JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(path.join(dir,'updated-images.json'),JSON.stringify(changes,null,2)+'\n');
const ids=['lionfish','blue-tang','frogfish','sea-urchin','flounder','herring-ball-stage2'];
const layers=[];for(let i=0;i<ids.length;i++){const e=manifest.cards.find(x=>x.cardId===ids[i]);layers.push({input:await sharp(path.join('public',e.src)).resize(375,525).png().toBuffer(),left:(i%3)*375,top:Math.floor(i/3)*525});}
await sharp({create:{width:1125,height:1050,channels:4,background:'white'}}).composite(layers).png().toFile(path.join(dir,'final-layout-review.png'));
console.log(JSON.stringify({updated:changes.length,unchanged:manifest.cards.length-changes.length}));
