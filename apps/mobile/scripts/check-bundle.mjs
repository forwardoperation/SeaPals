import { readFile, stat, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(appRoot, "dist");
const config = JSON.parse(await readFile(path.join(appRoot, "capacitor.config.json"), "utf8"));
assert.equal(config.webDir, "dist");
assert.ok(!config.server?.url, "Release builds must bundle the game instead of loading a website.");
const html = await readFile(path.join(dist, "index.html"), "utf8");
assert.ok(!/<(?:script|link)[^>]+(?:src|href)=["']https?:/i.test(html), "App boot must not need a CDN.");
assert.match(html, /connect-src 'self'/);
const manifest = JSON.parse(await readFile(path.join(dist, "offline-assets.json"), "utf8"));
const manifestPaths = new Set(manifest.map((asset) => asset.path));
let totalBytes = 0;
for (const asset of manifest) {
  const size = (await stat(path.join(dist, asset.path.slice(1)))).size;
  assert.equal(size, asset.bytes, `Wrong asset length: ${asset.path}`);
  totalBytes += size;
}
const jiti = createJiti(import.meta.url);
const { allCards, getCardImage } = await jiti.import("../../../src/data/cards/index.js");
for (const card of allCards) {
  const image = getCardImage(card).split("?")[0];
  assert.ok(manifestPaths.has(image), `Card art is missing from the offline bundle: ${card.id} (${image})`);
}
for (const filename of await readdir(path.join(dist, "assets"))) {
  if (!filename.endsWith(".js")) continue;
  const code = await readFile(path.join(dist, "assets", filename), "utf8");
  assert.ok(!/googletagmanager\.com|google-analytics\.com|SUPABASE_SERVICE_ROLE_KEY/.test(code), `Website analytics or server secrets entered ${filename}`);
}
console.log(`Offline bundle verified: ${allCards.length} cards, ${manifest.length} assets, ${(totalBytes / 1024 / 1024).toFixed(1)} MiB of bundled artwork.`);
