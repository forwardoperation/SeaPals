import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const before=JSON.parse(await fs.readFile('artifacts/creature-facts-specific/manifest-before.json','utf8'));
const rows=JSON.parse(await fs.readFile('artifacts/creature-facts-specific/reviewed-evidence.json','utf8'));
const list=[];
for(const [id] of rows){const expected=before.cards.find(x=>x.cardId===id);let found=null;
 for(const ext of ['inline','download']){const p=`artifacts/creature-facts/${id}.${ext}.png`;try{const b=await fs.readFile(p);const h=crypto.createHash('sha256').update(b).digest('hex').slice(0,12);if(h===expected.contentHash){found=p;break}}catch{}}
 list.push({id,found,expected:expected.contentHash});}
await fs.writeFile('artifacts/creature-facts-specific/old-preview-matches.json',JSON.stringify(list,null,2));
console.log(JSON.stringify({matching:list.filter(x=>x.found).length,missing:list.filter(x=>!x.found)},null,2));
