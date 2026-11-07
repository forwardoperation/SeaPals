import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';

const dir = 'artifacts/nov1-art-sync';
let manifest;
try { manifest = JSON.parse(await fs.readFile(`${dir}/manifest-before.json`, 'utf8')); }
catch { manifest = JSON.parse(await fs.readFile('src/data/gallery-images.json', 'utf8')); }
const entries = manifest.cards.filter(c => ['apex', 'filter-feeder'].includes(c.category) || c.cardId === 'octopus');
const results = [], layers = [];
for (const entry of entries) {
  const preview = `${dir}/previews/${entry.cardId}.png`;
  try { await fs.access(preview); } catch { continue; }
  let oldBytes;
  try { oldBytes = await fs.readFile(`${dir}/before/${entry.cardId}.png`); }
  catch { oldBytes = await fs.readFile(path.join('public', entry.src)); }
  const newBytes = await fs.readFile(preview);
  const oldRaw = await sharp(oldBytes).ensureAlpha().raw().toBuffer();
  const newRaw = await sharp(newBytes).ensureAlpha().raw().toBuffer();
  const meta = await sharp(newBytes).metadata();
  if (meta.width !== 375 || meta.height !== 525 || oldRaw.length !== newRaw.length) throw new Error(entry.cardId);
  let changed = 0, changedArt = 0;
  for (let i = 0; i < oldRaw.length; i += 4) {
    const delta = Math.max(...[0,1,2,3].map(c => Math.abs(oldRaw[i+c] - newRaw[i+c])));
    if (delta > 20) { changed++; const y = Math.floor(i / 4 / 375); if (y >= 60 && y < 240) changedArt++; }
  }
  results.push({cardId: entry.cardId, previousHash: entry.contentHash,
    contentHash: crypto.createHash('sha256').update(newBytes).digest('hex').slice(0,12),
    changedPercent: +(100 * changed / (375*525)).toFixed(2), artChangedPercent: +(100 * changedArt / (375*180)).toFixed(2)});
  const index = results.length - 1;
  const x = (index % 4) * 300, y = Math.floor(index / 4) * 232;
  const label = Buffer.from(`<svg width="300" height="22"><rect width="300" height="22" fill="white"/><text x="4" y="16" font-size="12">${entry.cardId} — before / current</text></svg>`);
  layers.push({input: label, left:x, top:y});
  layers.push({input: await sharp(oldBytes).resize(150,210).png().toBuffer(), left:x, top:y+22});
  layers.push({input: await sharp(newBytes).resize(150,210).png().toBuffer(), left:x+150, top:y+22});
}
await fs.writeFile(`${dir}/comparison.json`,JSON.stringify(results,null,2)+'\n');
await sharp({create:{width:1200,height:Math.ceil(results.length/4)*232,channels:4,background:'white'}}).composite(layers).png().toFile(`${dir}/comparison.png`);
console.log(JSON.stringify(results,null,2));
