const fs = require('fs');
const zlib = require('zlib');
const [input, output] = process.argv.slice(2);
const svg = fs.readFileSync(input, 'utf8');
const root = svg.match(/<svg\b[^>]*>/)[0];
const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)?.[0] || '';
const groups = [...svg.matchAll(/<g\b[^>]*>/g)].map(m=>m[0]);
if(groups.length>1) throw new Error('Nested groups require explicit hierarchy handling');
const groupStart=groups.join(''), groupEnd='</g>'.repeat(groups.length);
const paths = [...svg.matchAll(/<path\b[\s\S]*?(?:\/>|<\/path>)/g)].map(m => m[0]);
const assemble = items => root + defs + groupStart + items.join('') + groupEnd + '</svg>';
const compress = items => zlib.deflateRawSync(assemble(items), {level: 9}).toString('base64');
const chunks=[];let batch=[];
for (const path of paths) {
  if (compress([path]).length>41000) throw new Error('One vector path exceeds compressed import budget: '+path.length);
  if (batch.length && (compress([...batch,path]).length>41000 || batch.length>=600)) {chunks.push({svgBytes:assemble(batch).length,paths:batch.length,data:compress(batch)});batch=[];}
  batch.push(path);
}
if(batch.length) chunks.push({svgBytes:assemble(batch).length,paths:batch.length,data:compress(batch)});
fs.writeFileSync(output,JSON.stringify({root,sourceBytes:svg.length,pathCount:paths.length,chunks}));
console.log(JSON.stringify({sourceBytes:svg.length,paths:paths.length,chunks:chunks.map(c=>({bytes:c.svgBytes,paths:c.paths,encoded:c.data.length}))}));
