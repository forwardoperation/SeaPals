import fs from 'node:fs/promises';
import path from 'node:path';
const dir='artifacts/creature-facts',config=JSON.parse(await fs.readFile(path.join(dir,'proxy-uploads.json'),'utf8'));
const results=await Promise.all(config.map(async c=>{
 const file=path.join('public',c.src),backup=path.join(dir,'original-previews',c.cardId+'.png');
 try{await fs.copyFile(file,backup,fs.constants.COPYFILE_EXCL)}catch(e){if(e.code!=='EEXIST')throw e;}
 const bytes=await fs.readFile(backup);
 const response=await fetch(c.submitUrl,{method:'POST',headers:{'Content-Type':'image/png'},body:bytes,signal:AbortSignal.timeout(240000)});
 if(!response.ok)throw Error(c.cardId+' upload '+response.status);
 const data=await response.json();return {cardId:c.cardId,...data};
}));
await fs.writeFile(path.join(dir,'proxy-upload-results.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(r=>({cardId:r.cardId,success:r.success,nodeId:r.placedOnNodeId}))));
