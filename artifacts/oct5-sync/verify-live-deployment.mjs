import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const origin = "https://searealm.com";
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const request = (src) => fetch(new URL(src, origin), {
  signal: AbortSignal.timeout(30000),
  headers: { "Cache-Control": "no-cache" },
});
const routes = ["/", "/decks", "/store", "/simulator", "/adventure", "/gallery", "/set-list", "/encyclopedia/owlfish", "/encyclopedia/oceanic-manta-ray"];
const pages = await Promise.all(routes.map(async (route) => {
  const response = await request(route);
  assert.equal(response.status, 200, `${route}: HTTP ${response.status}`);
  return { route, status: response.status, url: response.url, html: await response.text() };
}));
const pageByRoute = new Map(pages.map((page) => [page.route, page]));
for (const route of ["/decks", "/store"]) {
  const html = pageByRoute.get(route).html;
  assert.ok(html.includes("Pairs of Owlfish"), `${route}: revised Darkness Shroud description`);
  assert.ok(html.includes("Three Mahi-Mahi"), `${route}: revised Open Ocean description`);
}
assert.ok(pageByRoute.get("/adventure").html.includes("Reefbound"));
assert.ok(pageByRoute.get("/encyclopedia/oceanic-manta-ray").html.includes("Mobula birostris"));

const assetRoutes = ["/simulator", "/adventure"];
const scriptPaths = [...new Set(assetRoutes.flatMap((route) =>
  [...pageByRoute.get(route).html.matchAll(/<script[^>]+src="([^"]+)"/g)]
    .map((match) => match[1]).filter((src) => src.startsWith("/_next/"))
))];
const assets = await Promise.all(scriptPaths.map(async (src) => {
  const response = await request(src);
  assert.equal(response.status, 200, src);
  const live = Buffer.from(await response.arrayBuffer());
  const local = await fs.readFile(path.join(".open-next/assets", src.replace(/^\//, "")));
  assert.equal(hash(live), hash(local), `${src}: deployed JavaScript matches this build`);
  return { src, sha256: hash(live), text: live.toString("utf8") };
}));
const code = assets.map((asset) => asset.text).join("\n");
assert.ok(code.includes("oceanic-manta-ray"), "The playable Oceanic Manta Ray is in the live catalog");
assert.ok(code.includes("Pairs of Owlfish"), "Live game bundles contain the updated deck manifest");

const manifest = JSON.parse(await fs.readFile("src/data/gallery-images.json", "utf8"));
const setList = JSON.parse(await fs.readFile("src/data/gallery-set-list.json", "utf8"));
const publishedIds = new Set(setList.sets.flatMap((set) => set.cards.map((card) => card.cardId)));
const changes = JSON.parse(await fs.readFile("artifacts/oct5-sync/updated-images.json", "utf8"));
const images = await Promise.all(changes.map(async ({ cardId, after }) => {
  const entry = manifest.cards.find((card) => card.cardId === cardId);
  assert.equal(entry.contentHash, after);
  const src = `${entry.src}?v=${entry.contentHash}`;
  const response = await request(src);
  assert.equal(response.status, 200, cardId);
  const live = Buffer.from(await response.arrayBuffer());
  const local = await fs.readFile(path.join("public", entry.src));
  assert.equal(hash(live), hash(local), `${cardId}: live artwork matches Figma export`);
  if (publishedIds.has(cardId)) {
    assert.ok(pageByRoute.get("/gallery").html.includes(after), `${cardId}: gallery uses new image version`);
    assert.ok(code.includes(after), `${cardId}: games use new image version`);
  }
  return { cardId, src, sha256: hash(live), status: response.status };
}));

const rows = [...pageByRoute.get("/set-list").html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map((match) => match[0]);
const rarities = [
  { cardId: "capt-dani", number: "54/102", rarity: "Rare" },
  { cardId: "spearfishing", number: "85/102", rarity: "Uncommon" },
  { cardId: "robotic-survey", number: "88/102", rarity: "Uncommon" },
  { cardId: "poison-heal", number: "90/102", rarity: "Uncommon" },
  { cardId: "bluefin-tuna", number: "14/64", rarity: "Rare" },
];
for (const { cardId, number, rarity } of rarities) {
  const row = rows.find((html) => html.includes(`href="/gallery#card-${cardId}"`) && html.replace(/<!--[\s\S]*?-->/g, "").includes(number));
  assert.ok(row, `${cardId}: live numbered printing ${number}`);
  assert.ok(row.includes(`</span>${rarity}</span>`), `${cardId}: live rarity ${rarity}`);
}

const report = {
  verifiedAt: new Date().toISOString(), origin,
  pages: pages.map(({ html, ...page }) => page),
  matchingGameAssets: assets.map(({ text, ...asset }) => asset),
  verifiedImages: images,
  verifiedRarities: rarities,
};
await fs.writeFile("artifacts/oct5-sync/live-deployment-verification.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ verifiedAt: report.verifiedAt, pages: pages.length, matchingGameAssets: assets.length, verifiedImages: images.length, verifiedRarities: rarities }, null, 2));
