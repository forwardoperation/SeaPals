import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const dir='artifacts/creature-facts',manifest=JSON.parse(await fs.readFile('src/data/gallery-images.json','utf8'));
for(const file of (await fs.readdir(dir)).filter(x=>x.endsWith('.export.b64'))){
 const id=file.replace('.export.b64',''),entry=manifest.cards.find(x=>x.cardId===id);if(!entry)throw Error(id);
 const bytes=Buffer.from((await fs.readFile(path.join(dir,file),'utf8')).trim(),'base64');
 const target=path.join('public',entry.src),backup=path.join(dir,'original-previews',id+'.png');
 try{await fs.copyFile(target,backup,fs.constants.COPYFILE_EXCL)}catch(e){if(e.code!=='EEXIST')throw e;}
 const meta=await sharp(bytes).metadata();
 const data=meta.width===entry.width&&meta.height===entry.height?bytes:await sharp(bytes).resize(entry.width,entry.height).png().toBuffer();
 const stage=path.join(dir,id+'.inline.png');await fs.writeFile(stage,data);
 for(let n=0;;n++){try{await fs.copyFile(stage,target);break;}catch(e){if(n>=4)throw e;await new Promise(r=>setTimeout(r,500));}}
 console.log(id+' '+entry.width+'x'+entry.height);
}
