import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const origin = 'https://searealm.com';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
async function request(src) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(new URL(src, origin), {
        signal: AbortSignal.timeout(30000),
        headers: {'Cache-Control': 'no-cache'},
      });
      if (response.status >= 500 && attempt < 2) continue;
      assert.equal(response.status, 200, `${src}: HTTP ${response.status}`);
      return response;
    } catch (error) { lastError = error; }
  }
  throw lastError;
}
async function mapLimit(values, limit, fn) {
  const results = new Array(values.length);
  let next = 0;
  await Promise.all(Array.from({length: Math.min(limit, values.length)}, async () => {
    while (next < values.length) {
      const index = next++;
      results[index] = await fn(values[index], index);
    }
  }));
  return results;
}

const routes = ['/', '/gallery', '/encyclopedia/cleaner-shrimp', '/encyclopedia/nudibranch', '/encyclopedia/vampire-squid'];
const pages = await mapLimit(routes, 4, async route => {
  const response = await request(route);
  return {route, status: response.status, url: response.url, html: await response.text()};
});
const byRoute = new Map(pages.map(page => [page.route, page]));
assert.ok(byRoute.get('/encyclopedia/cleaner-shrimp').html.includes('Lysmata amboinensis'));
assert.ok(byRoute.get('/encyclopedia/nudibranch').html.includes('Chromodoris magnifica'));
assert.ok(byRoute.get('/encyclopedia/vampire-squid').html.includes('Total length up to about 12 in'));
const gallery = byRoute.get('/gallery').html;
const scriptPaths = [...new Set([...gallery.matchAll(/<script[^>]+src="([^"]+)"/g)]
  .map(match => match[1]).filter(src => src.startsWith('/_next/')))];
assert.ok(scriptPaths.length > 0, 'Gallery JavaScript assets are present');
const assets = await mapLimit(scriptPaths, 6, async src => {
  const response = await request(src);
  const live = Buffer.from(await response.arrayBuffer());
  const local = await fs.readFile(path.join('.open-next/assets', decodeURIComponent(new URL(src, origin).pathname).replace(/^\//, '')));
  assert.equal(hash(live), hash(local), `${src}: deployed JavaScript matches this build`);
  return {src, sha256: hash(live), text: live.toString('utf8')};
});
const code = assets.map(asset => asset.text).join('\n');
for (const text of ['Galeocerdonidae', 'Family varies', 'The heaviest known squid lives in the cold Southern Ocean.', 'Family']) {
  assert.ok(code.includes(text), `Reviewed creature text in live gallery: ${text}`);
}

const manifest = JSON.parse(await fs.readFile('src/data/gallery-images.json', 'utf8'));
const setList = JSON.parse(await fs.readFile('src/data/gallery-set-list.json', 'utf8'));
const publishedIds = new Set(setList.sets.flatMap(set => set.cards.map(card => card.cardId)));
const changes = JSON.parse(await fs.readFile('artifacts/creature-facts/updated-images.json', 'utf8'));
assert.equal(changes.length, 124);
const images = await mapLimit(changes, 6, async ({cardId, contentHash}) => {
  const entry = manifest.cards.find(card => card.cardId === cardId);
  assert.equal(entry.contentHash, contentHash, cardId);
  const src = `${entry.src}?v=${contentHash}`;
  const response = await request(src);
  const live = Buffer.from(await response.arrayBuffer());
  const local = await fs.readFile(path.join('public', entry.src));
  assert.equal(hash(live), hash(local), `${cardId}: live image matches reviewed export`);
  if (publishedIds.has(cardId)) {
    assert.ok(gallery.includes(contentHash), `${cardId}: gallery uses corrected image version`);
    assert.ok(code.includes(contentHash), `${cardId}: gallery bundle uses corrected image version`);
  }
  return {cardId, src, sha256: hash(live), status: response.status};
});
const report = {
  verifiedAt: new Date().toISOString(), origin,
  pages: pages.map(({html, ...page}) => page),
  matchingGalleryAssets: assets.map(({text, ...asset}) => asset),
  verifiedImages: images,
};
await fs.writeFile('artifacts/creature-facts/live-deployment-verification.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({verifiedAt: report.verifiedAt, pages: pages.length, matchingGalleryAssets: assets.length, verifiedImages: images.length}, null, 2));
