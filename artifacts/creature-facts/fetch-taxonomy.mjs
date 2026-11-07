import fs from 'node:fs/promises';
const names = JSON.parse(await fs.readFile(new URL('./taxonomy-names.json', import.meta.url), 'utf8'));
const results = [];
let next = 0;
async function worker() {
  while (next < names.length) {
    const name = names[next++];
    try {
      const response = await fetch('https://www.marinespecies.org/rest/AphiaRecordsByName/' + encodeURIComponent(name) + '?like=false&marine_only=true', {signal: AbortSignal.timeout(30000)});
      const records = response.status === 204 ? [] : await response.json();
      results.push({name, records});
    } catch (error) { results.push({name, error: error.message}); }
  }
}
await Promise.all(Array.from({length: 4}, worker));
await fs.writeFile(new URL('./taxonomy-evidence.json', import.meta.url), JSON.stringify({checkedAt: new Date().toISOString(), authority:'World Register of Marine Species', results},null,2)+'\n');
console.log(JSON.stringify(results.map(({name,records,error})=>({name,error,matches:records?.map(r=>({taxon:r.scientificname,family:r.family,rank:r.rank,status:r.status,url:r.url}))})),null,2));
