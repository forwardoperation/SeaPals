import fs from 'node:fs/promises';
const config=JSON.parse(await fs.readFile('artifacts/creature-facts/legacy-upload.json','utf8'));
const bytes=await fs.readFile('public/images/cards/fish/Reef/southern-flounder.png');
const result=await fetch(config.url,{method:'POST',headers:{'Content-Type':'image/png'},body:bytes});
if(!result.ok)throw Error('Figma upload failed '+result.status);
const data=await result.json();await fs.writeFile('artifacts/creature-facts/legacy-upload-result.json',JSON.stringify(data,null,2));
console.log(JSON.stringify(data));
