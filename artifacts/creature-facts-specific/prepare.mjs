import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {createJiti} from 'jiti';
const dir='artifacts/creature-facts-specific';
await fs.mkdir(dir,{recursive:true});
const facts=JSON.parse(await fs.readFile('src/data/creature-facts.json','utf8'));
const manifest=JSON.parse(await fs.readFile('src/data/gallery-images.json','utf8'));
const old=JSON.parse(await fs.readFile('artifacts/creature-facts/corrections.json','utf8'));
const holo=JSON.parse(await fs.readFile('artifacts/creature-facts/holo-corrections.json','utf8'));
const jiti=createJiti(path.resolve('package.json'),{alias:{'@':path.resolve('src')}});
const profiles=await jiti.import(path.resolve('src/data/encyclopedia/index.js'));
const targets=Object.entries(facts.cards).filter(([,f])=>Object.values(f).some(v=>/^(Unknown|Varies|Family varies)$/i.test(v))).map(([cardId,facts])=>{
 const profile=profiles.encyclopediaCreatureBySlug[profiles.encyclopediaSlugByCardId[cardId]];
 return {cardId,facts,original:old.find(c=>c.cardId===cardId),image:manifest.cards.find(c=>c.cardId===cardId),profile,holo:holo.filter(c=>c.cardId===cardId)};
});
for(const [name,data] of [['facts-before',facts],['manifest-before',manifest],['scope',targets]]){
 try{await fs.writeFile(`${dir}/${name}.json`,JSON.stringify(data,null,2)+'\n',{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
}
const ids=['chimera','anemone','mantis-shrimp','octopus','deep-cucumber','brittlestar','frogfish','fairy-parrotfish','halfbeak','needlefish','peacock-squid','krill-bloom-base'];
const layers=await Promise.all(ids.map(async(id,i)=>({input:await sharp(path.join('public',manifest.cards.find(c=>c.cardId===id).src)).resize(375,525).png().toBuffer(),left:(i%4)*375,top:Math.floor(i/4)*525})));
await sharp({create:{width:1500,height:1575,channels:4,background:'white'}}).composite(layers).png().toFile(`${dir}/identities.png`);
console.log(JSON.stringify(targets.map(t=>({cardId:t.cardId,node:t.original?.id,page:t.original?.pageId,scientificName:t.profile?.scientificName,name:t.profile?.name,sources:t.profile?.sourceUrls})),null,2));
