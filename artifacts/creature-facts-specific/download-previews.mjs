import fs from 'node:fs/promises';
import sharp from 'sharp';
const dir='artifacts/creature-facts-specific';
const exports=JSON.parse(await fs.readFile(`${dir}/exports.json`,'utf8'));
await fs.mkdir(`${dir}/previews`,{recursive:true});
await fs.mkdir(`${dir}/preserved`,{recursive:true});
for(let i=0;i<exports.length;i+=6)await Promise.all(exports.slice(i,i+6).map(async e=>{
 const file=`${dir}/${e.preserved?'preserved':'previews'}/${e.cardId}.png`;
 try{await fs.access(file);return}catch{}
 const r=await fetch(e.image_url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`${e.cardId}: HTTP ${r.status}`);
 const bytes=Buffer.from(await r.arrayBuffer()),meta=await sharp(bytes).metadata();
 if(meta.width!==375||meta.height!==525)throw Error('Unexpected dimensions '+e.cardId);
 await fs.writeFile(file,bytes);console.log(e.cardId);
}));
