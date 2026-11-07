import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const background = await readFile(new URL('./underwater-background.svg', import.meta.url), 'utf8');
const shadow = await readFile(new URL('./shark-cast-shadow.svg', import.meta.url), 'utf8');
const shadowDefs = shadow.match(/<defs>([\s\S]*?)<\/defs>/)[1];
const shadowShapes = shadow.match(/<g id="Shark-cast-shadow">[\s\S]*?<\/g>/)[0];
const composed = background
  .replace('</defs>', `${shadowDefs}</defs>`)
  .replace('</svg>', `${shadowShapes}</svg>`);

if (/<(?:image|filter|foreignObject|script|animate)\b/i.test(composed)) {
  throw new Error('Background must remain a static, filter-free vector asset.');
}

await writeFile(new URL('./bull-shark-background.svg', import.meta.url), composed);
await sharp(Buffer.from(composed))
  .png()
  .toFile(fileURLToPath(new URL('./bull-shark-background-preview.png', import.meta.url)));

const metrics = {
  bytes: Buffer.byteLength(composed),
  gzipBytes: gzipSync(composed).length,
  paintedElements: (composed.match(/<(?:path|rect|circle|ellipse|polygon|polyline|line)(?=[\s>])/g) || []).length,
  gradients: (composed.match(/<(?:linearGradient|radialGradient)\b/g) || []).length,
  dimensions: '1536 x 1024',
  embeddedImages: 0,
  filters: 0,
};
await writeFile(new URL('./asset-metrics.json', import.meta.url), JSON.stringify(metrics, null, 2) + '\n');
console.log(JSON.stringify(metrics));
