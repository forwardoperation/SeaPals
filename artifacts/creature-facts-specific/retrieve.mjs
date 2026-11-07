import fs from 'node:fs/promises';
const dir='artifacts/creature-facts-specific';
const names=['Chimaera monstrosa','Radianthus magnifica','Odontodactylus scyllarus','Hapalochlaena lunulata','Crassostrea virginica','Enypniastes eximia','Ophiothrix fragilis','Taonius borealis','Scarus prasiognathos','Antennarius commerson','Hemiramphus brasiliensis','Tylosurus crocodilus','Euphausia superba','Sardinops sagax','Engraulis mordax','Menidia menidia','Clupea harengus'];
const records=[];
for(let i=0;i<names.length;i+=4) await Promise.all(names.slice(i,i+4).map(async name=>{
 const url='https://www.marinespecies.org/rest/AphiaRecordsByName/'+encodeURIComponent(name)+'?like=false&marine_only=true';
 const response=await fetch(url); if(!response.ok)throw Error(response.status+' '+name);
 const data=await response.json();const record=data.find(r=>r.scientificname.toLowerCase()===name.toLowerCase());
 if(!record)throw Error('No exact taxon '+name);
 records.push({name,url,record});
 console.log(name+' | '+record.family+' | '+record.valid_name);
}));
await fs.writeFile(dir+'/representative-taxonomy.json',JSON.stringify(records,null,2)+'\n');
const page=await fetch('https://pmc.ncbi.nlm.nih.gov/articles/PMC12542368/').then(r=>r.text());
await fs.writeFile(dir+'/oyster.html',page);
console.log(page.slice(page.indexOf('47.50')-600,page.indexOf('47.50')+2100).replace(/<[^>]+>/g,' '));
const xml=await fetch('https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0145134&type=manuscript').then(r=>r.text());
await fs.writeFile(dir+'/plos.xml',xml);
const table=xml.indexOf('<table-wrap id="pone.0145134.t002"');
console.log('NUDI TABLE:',xml.slice(table,table+7000).replace(/<[^>]+>/g,' '));

