import fs from 'node:fs/promises';
const dir='artifacts/creature-facts-specific';
const rows=JSON.parse(await fs.readFile(`${dir}/reviewed-evidence.json`,'utf8'));
const facts=JSON.parse(await fs.readFile('src/data/creature-facts.json','utf8')).cards;
const scope=JSON.parse(await fs.readFile(`${dir}/scope.json`,'utf8'));
let report='# Specific creature facts — 13 October 2026\n\n';
report+='This follow-up replaces the broad-group “Varies” policy in the 5 October review. The user chose representative species matching the artwork and asked to retain weight, using supported estimates where available.\n\n';
report+='Updated 47 master card designs (37 creature profiles, including all 15 school stages), four affected holo printings, and two gallery export frames. Family remains the leftmost fact. Card titles, IDs, game rules, and illustrations are preserved. The gallery supplies the scientific name, representative species, and a short measurement note.\n\n';
report+='Measurements are specific reference values, not a uniform series of maximum records. A tilde (~) marks approximations, rounded sample means, or model estimates. Length labels identify the measured structure. School measurements describe one individual. Where maximum lengths and mean weights come from different samples, the gallery says so explicitly. Model-based fish weights are estimates, not newly measured records.\n\n';
report+='Representative identities were checked against WoRMS; the downloaded records are in artifacts/creature-facts-specific/representative-taxonomy.json. Pacific sardine uses the accepted family Alosidae.\n\n';
report+='## Remaining evidence gaps\n\n';
report+='Seven weights remain Unknown: Giant Phantom Jelly, Gulper Eel, Nudibranch (Chromodoris magnifica), Deep Sea Jelly (Atolla wyvillei), Dumbo Octopus, Blue Sea Dragon (Glaucus atlanticus), and Barrel Eye Fish (Macropinna microstoma). The review did not locate defensible whole-body weights for these entries. This is a limitation of the reviewed evidence; it does not imply that all seven animals are extraordinarily elusive. In particular, the magnificent chromodoris is not being described as elusive. Unrelated species weights, specimen shipping weights, and unsourced online guesses were not substituted.\n\n';
report+='## Reference measurements and sources\n\n| Card | Representative / scientific name | Family | Specific measurements | Evidence and sources |\n| --- | --- | --- | --- | --- |\n';
const seen=new Set();
for(const [id,sci,rep,,note,urls] of rows){
 const s=scope.find(x=>x.cardId===id),name=s.profile.name;
 if(seen.has(name))continue;seen.add(name);
 const f=facts[id],school=/(base|stage[12])$/.test(id)?' (all three stages)':'';
 report+=`| ${name}${school} | ${rep?rep+' — ':''}*${sci}* | ${f.family} | ${f.lengthLabel}: ${f.length}; weight: ${f.weight}; ${f.region} | ${note} ${urls.map((u,i)=>`[Source ${i+1}](${u})`).join(' · ')} |\n`;
}
report+='\nThe Ophiothrix fragilis weight was checked visually against the upper panel of Figure 2 in Blanchet-Aurigny et al. (2012); the correct rounded reference is approximately 3 g. The lower panel shows a different species and was not used.\n';
await fs.writeFile('docs/creature-fact-specificity-review.md',report);
console.log('Wrote review for '+seen.size+' profiles.');
