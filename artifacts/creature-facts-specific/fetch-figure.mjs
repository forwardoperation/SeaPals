import fs from 'node:fs/promises';
const url='https://ars.els-cdn.com/content/image/1-s2.0-S0022098112001785-gr2.jpg';
const r=await fetch(url,{signal:AbortSignal.timeout(20000)});const b=Buffer.from(await r.arrayBuffer());
console.log(r.status,r.headers.get('content-type'),b.length);
if(r.ok)await fs.writeFile('artifacts/creature-facts-specific/brittle-figure2.jpg',b);
