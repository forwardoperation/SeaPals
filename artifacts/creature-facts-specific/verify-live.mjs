import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const dir='artifacts/creature-facts-specific',base='https://searealm.com';
const changed=JSON.parse(await fs.readFile(`${dir}/updated-images.json`,'utf8'));
const pages=[['/gallery',null],['/encyclopedia/octopus','Hapalochlaena lunulata'],['/encyclopedia/mantis-shrimp','Odontodactylus scyllarus'],['/encyclopedia/cleaner-shrimp','~2.2g'],['/encyclopedia/krill-bloom','Euphausia superba'],['/encyclopedia/brittlestar','~3g']];
const results={pages:[],images:[],scripts:[]};let gallery='';
for(const [route,expected] of pages){const r=await fetch(base+route,{signal:AbortSignal.timeout(60000)}),html=await r.text();if(!r.ok||expected&&!html.includes(expected))throw Error(`${route}: ${r.status}, missing ${expected}`);results.pages.push({route,status:r.status,expected});if(route==='/gallery')gallery=html;}
const scripts=[...new Set([...gallery.matchAll(/<script[^>]+src="([^"]+\.js(?:\?[^"]*)?)"/g)].map(m=>m[1].replaceAll('&amp;','&')))];
let js='';for(const src of scripts){const r=await fetch(new URL(src,base),{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Script '+r.status);js+=await r.text();results.scripts.push({src,status:r.status});}
for(const expected of ['Hapalochlaena lunulata','Odontodactylus scyllarus','Alosidae','~2.2g'])if(!js.includes(expected)&&!gallery.includes(expected))throw Error('Gallery bundle missing '+expected);
for(let i=0;i<changed.length;i+=6)await Promise.all(changed.slice(i,i+6).map(async e=>{const r=await fetch(base+encodeURI(e.src)+'?v='+e.contentHash,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(e.cardId+' HTTP '+r.status);const b=Buffer.from(await r.arrayBuffer()),hash=crypto.createHash('sha256').update(b).digest('hex').slice(0,12);if(hash!==e.contentHash)throw Error(e.cardId+' stale image '+hash);results.images.push({cardId:e.cardId,status:r.status,contentHash:hash});}));
results.verifiedAt=new Date().toISOString();results.galleryHashReferences=changed.filter(x=>gallery.includes(x.contentHash)||js.includes(x.contentHash)).length;
await fs.writeFile(`${dir}/live-verification.json`,JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({pages:results.pages.length,scripts:results.scripts.length,images:results.images.length,galleryHashReferences:results.galleryHashReferences}));
