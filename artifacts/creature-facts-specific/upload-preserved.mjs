import fs from 'node:fs/promises';
const dir='artifacts/creature-facts-specific';
const raw=JSON.parse(await fs.readFile(`${dir}/${process.argv[2]||'preserved-upload'}.json`,'utf8'));
const config=JSON.parse(raw.content[0].text);
const previews=JSON.parse(await fs.readFile(`${dir}/preserved-previews.json`,'utf8'));
const old=JSON.parse(await fs.readFile(`${dir}/old-preview-matches.json`,'utf8'));
const results=[];
for(let i=0;i<config.uploads.length;i+=5)await Promise.all(config.uploads.slice(i,i+5).map(async upload=>{
 const p=previews.find(x=>x.nodeId===upload.targetNodeId),file=old.find(x=>x.id===p.cardId).found;
 const bytes=await fs.readFile(file);
 const r=await fetch(upload.submitUrl,{method:'POST',headers:{'Content-Type':'image/png'},body:bytes,signal:AbortSignal.timeout(240000)});
 const data=await r.json();if(!r.ok)throw Error(`${p.cardId}: ${r.status}`);
 results.push({cardId:p.cardId,...data});console.log('Uploaded '+p.cardId);
}));
await fs.writeFile(`${dir}/${process.argv[2]||'preserved-upload'}-results.json`,JSON.stringify(results,null,2));
if(config.commitUrl){
 const r=await fetch(config.commitUrl,{method:'POST',signal:AbortSignal.timeout(240000)});const data=await r.json();
 await fs.writeFile(`${dir}/preserved-commit-result.json`,JSON.stringify(data,null,2));
 console.log('Batch commit HTTP '+r.status);if(!r.ok)throw Error('Commit failed');
}
