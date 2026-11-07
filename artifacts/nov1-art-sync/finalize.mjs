import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const dir = 'artifacts/nov1-art-sync';
const manifestPath = 'src/data/gallery-images.json';
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const rows = JSON.parse(await fs.readFile(`${dir}/figma-cards.json`, 'utf8'));
if (rows.length !== 25) throw new Error('Expected Day Octopus and all 24 Apex/Filter Feeders');
await fs.mkdir(`${dir}/before`, {recursive:true});
try { await fs.copyFile(manifestPath, `${dir}/manifest-before.json`, fs.constants.COPYFILE_EXCL); }
catch (error) { if(error.code !== 'EEXIST') throw error; }
const now = new Date().toISOString();
const updates = [];
for (const row of rows) {
  const entry = manifest.cards.find(c => c.cardId === row.cardId);
  if (!entry || entry.nodeId !== row.nodeId) throw new Error(`Unexpected source: ${row.cardId}`);
  const bytes = await fs.readFile(`${dir}/previews/${row.cardId}.png`);
  const meta = await sharp(bytes).metadata();
  if (meta.format !== 'png' || meta.width !== 375 || meta.height !== 525) throw new Error(`Invalid preview: ${row.cardId}`);
  const destination = path.join('public', entry.src);
  try { await fs.copyFile(destination, `${dir}/before/${row.cardId}.png`, fs.constants.COPYFILE_EXCL); }
  catch (error) { if(error.code !== 'EEXIST') throw error; }
  const contentHash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);
  updates.push({cardId:row.cardId,beforeHash:entry.contentHash,contentHash,wasPrerelease:entry.prerelease,
    prerelease:row.texts.some(t => /prerelease/i.test(t.text)),nodeId:row.nodeId});
  await fs.writeFile(destination, bytes);
  Object.assign(entry, {name: row.cardId === 'octopus' ? 'Day Octopus' : entry.name,
    sourceName: row.name, sourceWidth:row.width, sourceHeight:row.height,
    width:meta.width,height:meta.height,contentHash,exportedAt:now,
    exportMethod:'figma-mcp',sourceStatus:'figma-export',prerelease:row.texts.some(t => /prerelease/i.test(t.text))});
  delete entry.reviewedPreviewNodeId;
}
manifest.exportedAt = now;
await fs.writeFile(manifestPath, JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(`${dir}/updated-images.json`,JSON.stringify(updates,null,2)+'\n');
console.log(`Updated ${updates.length} previews; newly complete: ${updates.filter(u=>u.wasPrerelease&&!u.prerelease).map(u=>u.cardId).join(', ')}`);
