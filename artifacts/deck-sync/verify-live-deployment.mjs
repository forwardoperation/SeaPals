import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const origin = "https://searealm.com";
const pages = ["/", "/decks", "/store", "/simulator", "/adventure"];
const results = await Promise.all(pages.map(async (route) => {
  const response = await fetch(new URL(route, origin), { signal: AbortSignal.timeout(30000), headers: { "Cache-Control": "no-cache" } });
  const html = await response.text();
  if (response.status !== 200) throw new Error(`${route}: HTTP ${response.status}`);
  if (route === "/decks" && !["Drop Off", "Stinging Fortress", "Disruption", "Longhorn Cowfish", "Nurse Shark", "Box Jellyfish"].every((text) => html.includes(text))) throw new Error("The live deck guide is missing revised deck/card content.");
  if (route === "/store" && !html.includes("Drop Off")) throw new Error("The store is missing Drop Off.");
  if (route === "/adventure" && !html.includes("Reefbound")) throw new Error("The Reefbound page did not render.");
  return { route, status: response.status, finalUrl: response.url, html };
}));

const simulator = results.find((result) => result.route === "/simulator");
const scripts = [...new Set([...simulator.html.matchAll(/<script[^>]+src="([^\"]+)"/g)].map((match) => match[1]).filter((src) => src.startsWith("/_next/")))];
const assets = await Promise.all(scripts.map(async (src) => {
  const response = await fetch(new URL(src, origin), { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${src}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const localPath = path.join(".open-next/assets", src.replace(/^\//, ""));
  const local = await fs.readFile(localPath);
  const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
  if (hash(bytes) !== hash(local)) throw new Error(`The live script differs from this deployment: ${src}`);
  return { src, sha256: hash(bytes), text: bytes.toString("utf8") };
}));
const code = assets.map((asset) => asset.text).join("\n");
const abilityMarkers = ["abilityStun", "stunCreature", "neurotoxicDefense", "forcedTargetInstanceId", "aideBlockedUntilRound", "opportunist"];
for (const marker of abilityMarkers) if (!code.includes(marker)) throw new Error(`New simulator logic is absent from the live scripts: ${marker}`);

const report = {
  verifiedAt: new Date().toISOString(), origin,
  pages: results.map(({ html, ...result }) => result),
  matchingSimulatorAssets: assets.map(({ text, ...asset }) => asset),
  verifiedAbilityMarkers: abilityMarkers,
};
await fs.writeFile("artifacts/deck-sync/live-deployment-verification.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, matchingSimulatorAssets: assets.length }, null, 2));
