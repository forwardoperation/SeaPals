import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const root=process.cwd(),dir=path.join(root,'artifacts/creature-facts');
const entries=JSON.parse(await fs.readFile(path.join(dir,'exports.json'),'utf8'));
await fs.mkdir(path.join(dir,'original-previews'),{recursive:true});
const results=[];
for(let start=0;start<entries.length;start+=8)await Promise.all(entries.slice(start,start+8).map(async x=>{
 const target=path.resolve(root,'public',x.src.replace(/^\//,''));
 if(!target.startsWith(path.join(root,'public')+path.sep))throw Error('Unsafe target');
 const backup=path.join(dir,'original-previews',x.cardId+'.png');
 try{await fs.copyFile(target,backup,fs.constants.COPYFILE_EXCL)}catch(e){if(e.code!=='EEXIST')throw e;}
 const response=await fetch(x.url,{signal:AbortSignal.timeout(90000)});if(!response.ok)throw Error(x.cardId+' HTTP '+response.status);
 const input=Buffer.from(await response.arrayBuffer());
 const meta=await sharp(input).metadata();
 const output=meta.width===x.width&&meta.height===x.height?input:await sharp(input).resize(x.width,x.height,{fit:'fill'}).png().toBuffer();
 const temporary=path.join(dir,x.cardId+'.download.png');
 await fs.writeFile(temporary,output);
 await fs.copyFile(temporary,target);
 const contentHash=crypto.createHash('sha256').update(output).digest('hex').slice(0,12);
 results.push({cardId:x.cardId,nodeId:x.nodeId,src:x.src,width:x.width,height:x.height,sourceWidth:meta.width,sourceHeight:meta.height,contentHash});
}));
await fs.writeFile(path.join(dir,'downloaded-'+process.argv[2]+'.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({downloaded:results.length,exportSizes:[...new Set(results.map(x=>x.sourceWidth+'x'+x.sourceHeight))]}));
