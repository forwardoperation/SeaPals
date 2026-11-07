import fs from 'node:fs/promises';
import path from 'node:path';
import {createJiti} from 'jiti';
const jiti=createJiti(path.resolve('package.json'),{moduleCache:false});
const edits=JSON.parse(await fs.readFile('artifacts/creature-facts/encyclopedia-corrections.json','utf8'));
for(const e of edits){
 let source=await fs.readFile(e.file,'utf8');
 const loaded=await jiti.import(path.resolve(e.file));
 const original=loaded[e.exportName].find(x=>x.name===e.name);if(!original)throw Error(e.name);
 const anchor='    name: '+JSON.stringify(e.name)+',';
 const location=source.indexOf(anchor);if(location<0)throw Error('Missing anchor '+e.name);
 const start=source.lastIndexOf('  {',location),end=source.indexOf('\n  },',location)+5;
 if(start<0||end<location)throw Error('Invalid entry bounds');
 const replacement=JSON.stringify({...original,...e.changes},null,2).split('\n').map(x=>'  '+x).join('\n')+',';
 source=source.slice(0,start)+replacement+source.slice(end);
 await fs.writeFile(e.file,source);
 console.log('Updated '+e.name);
}
