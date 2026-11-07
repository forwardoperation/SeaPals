import fs from 'node:fs/promises';
import path from 'node:path';
import {createJiti} from 'jiti';
const dir='artifacts/creature-facts-specific';
const rows=JSON.parse(await fs.readFile(`${dir}/reviewed-evidence.json`,'utf8'));
const scope=JSON.parse(await fs.readFile(`${dir}/scope.json`,'utf8'));
const facts=JSON.parse(await fs.readFile('src/data/creature-facts.json','utf8'));
const specificNotes={
 'chimera':'Reference maximum size for the rabbitfish, a species of chimaera.',
 'frilled-shark':'Upper length and weight from a study of female sharks; the two values were not measured on the same individual.',
 'silky-shark':'Rounded published maximum weight.',
 'nurse-shark':'Rounded published maximum weight.',
 'sea-urchin':'Test means the hard body, excluding spines. Weight is a rounded study mean for adults with 2.4–3.1 in tests.',
 'anemone':'A typical disc width and the weight of a published 357 g specimen; these are separate reference measurements.',
 'arrow-crab':'Weight is the approximate mean of 247 crabs in a survey. The larger leg-span reference is not paired with that weight.',
 'mantis-shrimp':'Upper reference length and weight for the peacock mantis shrimp.',
 'leather-starfish':'Weight is a published population estimate; the span is an upper size reference, not a paired measurement.',
 'cleaner-shrimp':'Rounded mean length and whole weight of 336 shrimp in a study.',
 'giant-triton':'Rounded study means for shell length and live whole weight, including the shell.',
 'octopus':'Upper arm spread and weight references for the greater blue-ringed octopus.',
 'oysters':'Rounded mean shell length and whole weight of 3,653 eastern oysters; includes the shell.',
 'deep-cucumber':'Rounded mean length and wet body weight of 58 swimming sea cucumbers.',
 'brittlestar':'Disc width excludes the arms. Weight is a rounded estimate from a published wet-weight graph.',
 'vampire-squid':'A published estimate for experimental specimens; not a maximum weight.',
 'giant-isopod':'Rounded upper length and weight from an Exuma Sound sample.',
 'giant-tube-worm':'Length describes the tube; weight describes the living worm without its tube.',
 'peacock-squid':'Rounded mean mantle length and whole weight of two boreal glass squid. Mantle length excludes arms and tentacles.',
 'man-o-war':'Weight is a study mean for small colonies. The long tentacle reference describes larger colonies and is not paired with this weight.',
 'market-squid':'Length includes arms; weight is a published maximum.',
 'box-jellyfish':'Length describes bell width; weight is a published maximum.',
 'longhorn-cowfish':'Fork length ends at the fork in the tail. Weight is estimated from a published length–weight relationship.',
 'pacific-grenadier':'Rounded published maximum length and weight.',
 'halfbeak':'Rounded mean length and whole weight of 432 ballyhoo halfbeaks in a study.',
 'needlefish':'Rounded published maximum length and weight for the hound needlefish.'
};
const homes={
 'chimera':'Northeastern Atlantic and Mediterranean continental shelves and slopes, over muddy and rocky seabeds.',
 'anemone':'Exposed coral-reef surfaces in the tropical Indo-Pacific, often in bright light and moving water.',
 'mantis-shrimp':'Tropical Indo-Pacific reefs and nearby rubble, where peacock mantis shrimp shelter in burrows.',
 'octopus':'Shallow Indo-West Pacific reefs, tide pools, and rocky or coral rubble with hiding places.',
 'oysters':'Western Atlantic estuaries and coastal bays, where eastern oysters build reefs in salty and brackish water.',
 'deep-cucumber':'Deep ocean water and seafloors around the world; swimming sea cucumbers move between the bottom and nearby water.',
 'brittlestar':'Eastern Atlantic and Mediterranean rocky, gravelly, and shelly seafloors, where common brittle stars can form dense beds.',
 'giant-isopod':'Deep western Atlantic seafloors, including the Gulf of Mexico, Caribbean, and nearby continental slopes.',
 'peacock-squid':'Deep midwater of the North Pacific, including the Bering Sea.',
 'fairy-parrotfish':'Tropical Indo-Pacific coral reefs, where Singapore parrotfish graze hard surfaces.',
 'frogfish':'Tropical Indo-Pacific reefs, including sponge-covered rock and coral rubble.',
 'halfbeak':'Warm western Atlantic coastal water, including the Caribbean, where ballyhoo halfbeaks school near the surface.',
 'needlefish':'Tropical and subtropical seas around the world, near the surface over reefs and offshore water.',
 'krill-bloom-base':'Southern Ocean waters around Antarctica, including productive waters near seasonal sea ice.',
 'sardine-ball-base':'Northeastern Pacific coastal waters from western North America into the Gulf of California.',
 'anchovy-ball-base':'Northeastern Pacific coastal waters off western North America.',
};
const diets={
 'anemone':'Small fish and drifting animal prey caught by its tentacles; symbiotic algae also provide energy.',
 'mantis-shrimp':'Hard-shelled prey such as crabs, snails, and clams.',
 'octopus':'Small crabs and other crustaceans, subdued with venom.',
 'deep-cucumber':'Organic particles and small organisms gathered from seafloor sediment.',
 'brittlestar':'Suspended organic particles and plankton caught on its raised arms.',
 'halfbeak':'Seagrass fragments, algae, and small drifting animals.',
};
const profileEdits=new Map();
for(const [id,scientificName,representativeSpecies,changes,evidence,sourceUrls] of rows){
 const current=facts.cards[id];if(!current)throw Error('Unknown card '+id);
 let measurementNote=specificNotes[id];
 if(id.startsWith('krill-bloom'))measurementNote='Length and weight describe one Antarctic krill, rounded from published average ranges.';
 else if(/-(base|stage[12])$/.test(id))measurementNote='Length and estimated weight describe one fish. Weight is calculated from a published length–weight model.';
 else if(!measurementNote)measurementNote='Weight is an estimate from a published length–weight model at the listed length.';
 facts.cards[id]={...current,...changes,scientificName,...(representativeSpecies?{representativeSpecies}:{}),measurementNote};
 const s=scope.find(x=>x.cardId===id),name=s.profile.name;
 if(profileEdits.has(name))continue;
 const after=facts.cards[id];
 profileEdits.set(name,{id,name,scientificName,representativeSpecies,changes,after,sourceUrls,measurementNote});
}
facts.reviewedAt='2026-10-13';
for(const f of Object.values(facts.cards))if(f.weight==='Unknown')f.measurementNote='A reliable whole-body weight was not located in the reviewed species references. The length remains a separate, sourced measurement.';
facts.measurementNotes='Specific reference measurements for the named species. A tilde (~) marks an approximation, rounded sample mean, or supported model estimate. Length labels distinguish bodies, shells, discs, arms, and tubes. School-card measurements describe one animal. Values are not a uniform series of maxima; gallery notes explain each reference. Unknown is retained only where a defensible weight was not located.';
await fs.writeFile('src/data/creature-facts.json',JSON.stringify(facts,null,2)+'\n');
const jiti=createJiti(path.resolve('package.json'),{moduleCache:false});
let updatedProfiles=0;
for(const zone of ['reef','deep','oceanic','reefDeck']){
 const file=`src/data/encyclopedia/${zone==='reefDeck'?'reefDeckEntries':zone}.js`;
 let source=await fs.readFile(file,'utf8');
 try{await fs.writeFile(`${dir}/${zone}-before.js`,source,{flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e}
 const loaded=await jiti.import(path.resolve(file));
 for(const original of loaded[`${zone}EncyclopediaEntries`]){
  const edit=profileEdits.get(original.name);if(!edit)continue;
  const {id,after,representativeSpecies,scientificName,changes,sourceUrls,measurementNote}=edit;
  const value={...original,scientificName};
  if(representativeSpecies){
   value.aliases=[...new Set([...(original.aliases||[]),representativeSpecies])];
   value.intro=after.description+` This card represents the ${representativeSpecies.toLowerCase()}.`;
  }else if(changes.description)value.intro=changes.description;
  if(homes[id])value.home=homes[id];
  if(diets[id])value.diet=diets[id];
  value.size=`Card reference: ${after.lengthLabel.toLowerCase()} ${after.length}; weight ${after.weight.replace('lbs',' lb')}. ${measurementNote}`;
  if(id==='brittlestar')value.funFacts=['Brittle stars are echinoderm cousins of sea stars and sea urchins.','The common brittle star catches suspended food with its raised arms.','Its arms bend at many small joints.','It moves mainly by rowing its arms rather than walking on tube feet.'];
  if(id==='octopus'){
   value.tagline='A tiny reef hunter with brilliant blue warning rings.';
   value.superpower='Potent venom helps this small octopus subdue crustacean prey.';
   value.funFacts=['It has eight arms lined with suckers.','Its blue rings become conspicuous when it is threatened.','It shelters in crevices and discarded shells.','Its small size hides a dangerously venomous bite.'];
   value.lookFor='Look for a small yellowish octopus with vivid blue rings.';
  }
  if(id==='deep-cucumber'){
   value.superpower='A webbed swimming veil lifts it above the seafloor.';
   value.funFacts=['Its transparent body reveals its internal organs.','It gathers food particles from seafloor sediment.','It can swim away from the bottom.','It belongs to the sea-cucumber family Pelagothuriidae.'];
   value.lookFor='Look for a transparent cucumber-shaped body and a broad swimming veil.';
  }
  if(id==='peacock-squid'){
   value.tagline='A transparent squid drifting through North Pacific darkness.';
   value.lookFor='Look for a transparent body, large eyes, and small fins near the rear of the mantle.';
  }
  value.sourceUrls=[...new Set([...sourceUrls,...(original.sourceUrls||[])])].slice(0,3);
  const anchors=[`    name: ${JSON.stringify(original.name)},`,`    "name": ${JSON.stringify(original.name)},`];
  const location=anchors.map(a=>source.indexOf(a)).find(i=>i>=0);
  if(location===undefined)throw Error('Missing profile '+original.name);
  const start=source.lastIndexOf('  {',location),end=source.indexOf('\n  },',location)+5;
  if(start<0||end<location)throw Error('Invalid bounds '+original.name);
  const replacement=JSON.stringify(value,null,2).split('\n').map(line=>'  '+line).join('\n')+',';
  source=source.slice(0,start)+replacement+source.slice(end);updatedProfiles++;
 }
 await fs.writeFile(file,source);
}
await fs.writeFile(`${dir}/content-result.json`,JSON.stringify({cards:rows.length,profiles:updatedProfiles,unresolved:Object.entries(facts.cards).filter(([,v])=>v.weight==='Unknown').map(([id])=>id)},null,2)+'\n');
console.log(JSON.stringify({cards:rows.length,profiles:updatedProfiles}));
