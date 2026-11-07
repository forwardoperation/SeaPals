import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {createJiti} from 'jiti';
const root=process.cwd(),dir=path.join(root,'artifacts/creature-facts');
const jiti=createJiti(path.join(root,'package.json'),{alias:{'@':path.join(root,'src')}});
const {encyclopediaCreatures,encyclopediaSlugByCardId,encyclopediaCreatureBySlug}=await jiti.import(path.join(root,'src/data/encyclopedia/index.js'));
const facts=JSON.parse(await fs.readFile('src/data/creature-facts.json','utf8'));
const corrections=JSON.parse(await fs.readFile(path.join(dir,'corrections.json'),'utf8'));
const taxonomy=JSON.parse(await fs.readFile(path.join(dir,'taxonomy-evidence.json'),'utf8')).results;
const entries=corrections.map(c=>{
 const profile=encyclopediaCreatureBySlug[encyclopediaSlugByCardId[c.cardId]] ?? encyclopediaCreatures.find(p=>p.name===c.name || p.aliases.includes(c.name)) ?? (c.cardId==='emperor-angelfish' ? {scientificName:'Pomacanthus imperator',sourceUrls:['https://www.fishbase.se/summary/Pomacanthus-imperator.html']} : null);
 const tax=taxonomy.find(t=>t.name===profile?.scientificName);
 const taxUrls=(tax?.records??[]).filter(t=>t.family===c.family).map(t=>t.url);
 return {cardId:c.cardId,name:c.name,family:c.family,scientificName:profile?.scientificName,sources:[...new Set([...taxUrls,...(profile?.sourceUrls??[])])],before:c.before.facts.map(f=>f.text).filter(t=>t!=='Defense'),after:c.row,description:c.description,changed:c.changed};
});
await fs.writeFile(path.join(dir,'reviewed-facts-with-sources.json'),JSON.stringify(entries,null,2)+'\n');
const specialSources={
 'megamouth-shark':['https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0242196'],
 'colossal-squid':['https://www.tepapa.govt.nz/digital-museum/explore-digital-museum/colossal-squid/colossal-squid-te-papa/how-big-colossal-squid-on'],
 'sailfish':['https://www.mbl.ku.dk/JFSteffensen/Publications/BiolOpen_2016_MBSS.pdf']
};
let report='# Creature fact review — 5 October 2026\n\nReviewed the five creature pages in the SeaRealm Figma file (136 card designs, including school stages), plus the legacy Southern Flounder gallery preview. Coral, habitat, and support cards are separate categories and were not part of this review.\n\nThe first natural-history field is now the taxonomic family. Broad cards spanning several families use **Family varies**, rather than an invented species identification. Taxonomy follows the current World Register of Marine Species; notable updates include Galeocerdonidae for tiger sharks, Epinephelidae for groupers, Inachoididae for arrow crabs, and Labridae/Scarinae for parrotfish.\n\nSizes are rounded reference values, not a uniform series of maximum records. Width, shell, bell, spine, arm, and tentacle labels distinguish measurements that were previously all labeled length. **Unknown** replaces weights that could not be reliably established in this review. **Varies** is used for broad groups and changing schools. The numerical sizes and masses formerly assigned to whole schools were not treated as measured facts.\n\nDescriptions were checked against the species sources linked below, with taxonomy responses and source snapshots retained in artifacts/creature-facts. The main corrections include the copied 65-foot Blue Sea Dragon and Market Squid sizes; Arctic versus Southern Ocean for Colossal Squid; Indo-Pacific cleaner wrasses and cleaner shrimp; Spanish Hogfish size; megamouth light reflection rather than bioluminescence; and unsupported top-speed claims.\n\nThe six older layouts received a fourth fact column. Southern Flounder had no remaining editable source, so its existing preview was preserved in a new Figma frame with an editable family label. Game rules, costs, dice, and collector information were preserved. The website text uses src/data/creature-facts.json so it stays consistent with the card descriptions.\n\n## Sources and reviewed fields\n\n| Card | Family | Measurements and range | Sources |\n| --- | --- | --- | --- |\n';
for(const e of entries){const links=[...(specialSources[e.cardId]??[]),...e.sources].slice(0,3);report+='| '+e.name.replaceAll('|','/')+' | '+e.family+' | '+e.after.slice(1).join('; ')+' | '+links.map((u,i)=>'[Source '+(i+1)+']('+u+')').join(' · ')+' |\n';}
report+='\nSouthern Flounder: **Paralichthyidae**. Its legacy 26-inch / 7-pound reference measurements and Atlantic range were retained.\n';
await fs.writeFile('docs/creature-fact-review.md',report);
const manifest=JSON.parse(await fs.readFile('src/data/gallery-images.json','utf8'));
const ids=['blue-sea-dragon','colossal-squid','market-squid','green-sea-turtle','leather-starfish','giant-triton','octopus','oysters','giant-clam'];
const layers=[];for(let i=0;i<ids.length;i++){const e=manifest.cards.find(e=>e.cardId===ids[i]);const input=await sharp(path.join('public',e.src)).resize(375,525).png().toBuffer();layers.push({input,left:(i%3)*375,top:Math.floor(i/3)*525});}
await sharp({create:{width:1125,height:1575,channels:4,background:'white'}}).composite(layers).png().toFile(path.join(dir,'layout-review.png'));
console.log(JSON.stringify({reviewed:entries.length,changed:entries.filter(x=>x.changed).length,profiles:encyclopediaCreatures.length,missingSources:entries.filter(x=>!x.sources.length).map(x=>x.cardId)}));
