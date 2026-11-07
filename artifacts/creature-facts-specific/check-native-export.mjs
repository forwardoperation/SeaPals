import fs from 'node:fs/promises';
const u="https://www.figma.com/api/mcp/asset/c8aea5b4-727d-4c94-b43a-52ec615e5ad5.png";
const r=await fetch(u);if(!r.ok)throw Error(r.status);await fs.writeFile('artifacts/creature-facts-specific/krill-download.png',Buffer.from(await r.arrayBuffer()));
