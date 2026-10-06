import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPrintingCatalog } from "../../src/lib/manufacturing/boosters.mjs";
import { fixedArtworkSources } from "../../src/lib/manufacturing/recipes.mjs";
import { BACK_TEMPLATE } from "../../src/lib/manufacturing/printPlan.mjs";
import {
  pngDimensions,
  sha256,
  assetKey,
  validateRelease,
} from "../../src/lib/manufacturing/integration.mjs";
import { PRIVATE_ROOT, REPO_ROOT, atomicJson } from "./orders.mjs";

export function buildSourceMap(
  setList,
  gallery,
  holoVerification,
  overrides = {},
) {
  // Verified by collector number in the Figma file; gallery naming differs.
  overrides = { "reef-068": "193:27", "reef-095": "92:310", ...overrides };
  const catalog = buildPrintingCatalog(setList, gallery),
    previews = new Map(gallery.cards.map((c) => [c.cardId, c]));
  const holos = new Map(
    holoVerification.sets
      .flatMap((s) => s.cards)
      .map((c) => {
        const match = /^holo-(reef|deep|ocean|oceanic)-(\d+)-/.exec(c.name);
        return [
          match
            ? `${match[1] === "oceanic" ? "ocean" : match[1]}-${match[2]}`
            : "",
          c.id,
        ];
      }),
  );
  const sources = catalog.map((c) => ({
    id: c.printingId,
    cardId: c.cardId,
    kind: "card",
    nodeId:
      overrides[c.printingId] ??
      (c.requiresHoloSticker
        ? holos.get(c.printingId)
        : previews.get(c.cardId)?.nodeId) ??
      null,
    expectedNumber: `${c.collectorNumber}/${c.setTotal}`,
  }));
  sources.push(
    { id: "standard-back-sheet", kind: "back", nodeId: BACK_TEMPLATE.nodeId },
    ...fixedArtworkSources(),
  );
  return {
    fileKey: gallery.fileKey,
    catalog,
    sources,
    missing: sources
      .filter((s) => !s.nodeId)
      .map((s) => ({ id: s.id, cardId: s.cardId })),
  };
}
export function sheetPositions(document) {
  const grid = document.children?.find((n) => n.name === "card_backs");
  if (!grid || !document.absoluteBoundingBox)
    throw new Error("The fixed sheet needs its Figma card_backs grid.");
  const positions = (grid.children ?? [])
    .filter((c) => c.visible !== false && c.absoluteBoundingBox)
    .map((c) => {
      const b = c.absoluteBoundingBox,
        origin = document.absoluteBoundingBox;
      return {
        x: b.x - origin.x,
        y: b.y - origin.y,
        width: b.width,
        height: b.height,
      };
    });
  if (
    positions.length !== 9 ||
    positions.some(
      (p) =>
        Math.abs(p.width - 720) > 1 ||
        Math.abs(p.height - 1008) > 1 ||
        p.x < 0 ||
        p.y < 0 ||
        p.x + p.width > 2550 ||
        p.y + p.height > 3300,
    )
  )
    throw new Error(
      "The fixed sheet is not a supported nine-card Letter layout. Review its Figma frames.",
    );
  return positions;
}
function texts(node, found = []) {
  if (node.type === "TEXT" && typeof node.characters === "string")
    found.push(node.characters.trim());
  for (const child of node.children ?? []) texts(child, found);
  return found;
}
async function main() {
  const args = process.argv.slice(2),
    value = (flag) =>
      args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
  const read = async (relative) =>
    JSON.parse(await readFile(path.join(REPO_ROOT, relative), "utf8"));
  const overrides = value("--overrides")
    ? JSON.parse(await readFile(value("--overrides"), "utf8"))
    : {};
  const source = buildSourceMap(
    await read("src/data/gallery-set-list.json"),
    await read("src/data/gallery-images.json"),
    await read("scripts/manufacturing/figma-holo-sources.json"),
    overrides,
  );
  await mkdir(PRIVATE_ROOT, { recursive: true });
  await atomicJson(path.join(PRIVATE_ROOT, "source-map.json"), source);
  if (args.includes("--check")) {
    console.log(
      JSON.stringify(
        {
          mapped: source.sources.length - source.missing.length,
          total: source.sources.length,
          missing: source.missing,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (source.missing.length && !args.includes("--allow-incomplete"))
    throw new Error(
      `Map ${source.missing.length} missing Figma nodes first. See .private/manufacturing/source-map.json; use --overrides. No cards were removed from the pool. --allow-incomplete can publish available artwork; orders needing incomplete sets will be held before a draw.`,
    );
  if (!process.env.FIGMA_ACCESS_TOKEN)
    throw new Error("Set FIGMA_ACCESS_TOKEN locally with file read access.");
  const retryFile=path.join(PRIVATE_ROOT,"figma-retry.json");
  try {
    const retry=JSON.parse(await readFile(retryFile,"utf8"));
    if(Date.parse(retry.notBefore)>Date.now()) {
      console.log(`Figma requested a pause until ${retry.notBefore}. The active release is unchanged.`);
      return;
    }
  } catch(error) { if(error.code!=="ENOENT")throw error; }
  async function figma(route) {
    const response = await fetch(`https://api.figma.com/v1/${route}`, {
      headers: { "X-Figma-Token": process.env.FIGMA_ACCESS_TOKEN },
      signal: AbortSignal.timeout(90_000),
      redirect: "error",
    });
    if(response.status===429) {
      const raw=response.headers.get("retry-after")??"60";
      let notBefore=/^\d+$/.test(raw)?Date.now()+Number(raw)*1000:Date.parse(raw);
      if(!Number.isFinite(notBefore)||notBefore<=Date.now())notBefore=Date.now()+60_000;
      await atomicJson(retryFile,{notBefore:new Date(notBefore).toISOString()});
    }
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? `Figma rate limited the sync. Retry after ${response.headers.get("retry-after") ?? "the indicated interval"}; the active release is unchanged.`
          : `Figma request failed (${response.status}).`,
      );
    return response.json();
  }
  // Pin the file version once. Every node read and image export uses this version.
  const head = await figma(`files/${source.fileKey}?depth=1`),
    version = value("--version") ?? head.version;
  if (!version) throw new Error("Figma did not return a version.");
  const sourceHash = sha256(Buffer.from(JSON.stringify(source)));
  if (args.includes("--if-changed")) {
    try {
      const previous = JSON.parse(
        await readFile(path.join(PRIVATE_ROOT, "last-published.json"), "utf8"),
      );
      if (previous.version === version && previous.sourceHash === sourceHash) {
        console.log("Figma version and print source mappings are unchanged.");
        return;
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const releaseId =
    value("--release") ?? `figma-${version}-${sourceHash.slice(0, 8)}`;
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(releaseId))
    throw new Error("Invalid release ID.");
  const dir = path.join(PRIVATE_ROOT, "releases", releaseId);
  await mkdir(dir, { recursive: true });
  const release = {
    schemaVersion: 1,
    releaseId,
    figmaFileKey: source.fileKey,
    figmaVersion: version,
    catalog: source.catalog,
    missing: source.missing,
    assets: {},
  };
  const files = {};
  // Resume completed exports after a rate limit or network interruption. Never
  // combine nodes from different versions or mappings into one release.
  const progressFile = path.join(dir, "progress.json");
  try {
    const progress = JSON.parse(await readFile(progressFile, "utf8"));
    if (progress.version === version && progress.sourceHash === sourceHash) {
      for (const [id, asset] of Object.entries(progress.assets)) {
        if (!/^[a-f0-9]{64}$/.test(asset.sha256)) continue;
        const file = path.join(dir, `${asset.sha256}.png`);
        try {
          if (sha256(await readFile(file)) === asset.sha256) {
            release.assets[id] = asset;
            files[id] = file;
          }
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const mapped = source.sources.filter(
    (s) => s.nodeId && !release.assets[s.id],
  );
  for (let offset = 0; offset < mapped.length; offset += 10) {
    const batch = mapped.slice(offset, offset + 10),
      ids = [...new Set(batch.map((s) => s.nodeId))].join(",");
    const nodes = await figma(
      `files/${source.fileKey}/nodes?ids=${encodeURIComponent(ids)}&version=${encodeURIComponent(version)}`,
    );
    const images = await figma(
      `images/${source.fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=1&version=${encodeURIComponent(version)}`,
    );
    for (const item of batch) {
      const node = nodes.nodes?.[item.nodeId]?.document,
        url = images.images?.[item.nodeId];
      if (!node || !url)
        throw new Error(`Missing Figma export for ${item.id}.`);
      if (
        item.kind === "card" &&
        !texts(node).some((t) => t.replaceAll(" ", "") === item.expectedNumber)
      )
        throw new Error(
          `Collector number mismatch on ${item.id}. Correct the source mapping; do not reroll.`,
        );
      const parsed = new URL(url);
      if (parsed.protocol !== "https:")
        throw new Error("Invalid Figma export URL.");
      // These temporary Figma URLs are never stored in the release or published.
      const response = await fetch(parsed, {
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) throw new Error(`Could not download ${item.id}.`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 30_000_000)
        throw new Error("Figma export is too large.");
      const hash = sha256(bytes),
        dimensions = pngDimensions(bytes),
        file = path.join(dir, `${hash}.png`);
      await writeFile(file, bytes, { flush: true });
      files[item.id] = file;
      release.assets[item.id] = {
        path: assetKey({ sha256: hash }),
        sha256: hash,
        ...dimensions,
        nodeId: item.nodeId,
        ...(item.kind === "sheet" ? { positions: sheetPositions(node) } : {}),
      };
      await atomicJson(progressFile, {
        version,
        sourceHash,
        assets: release.assets,
      });
    }
    console.log(
      `Exported ${Object.keys(release.assets).length} / ${source.sources.length - source.missing.length} private assets.`,
    );
  }
  release.assets = Object.fromEntries(
    Object.entries(release.assets).sort(([a], [b]) => a.localeCompare(b)),
  );
  validateRelease(release);
  const manifestFile = path.join(dir, "release.json");
  // An existing release ID may never be silently replaced.
  try {
    const existing = JSON.parse(await readFile(manifestFile, "utf8"));
    if (JSON.stringify(existing) !== JSON.stringify(release))
      throw new Error(
        "Release ID already has different contents. Choose a new release ID.",
      );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await atomicJson(manifestFile, release);
  if (args.includes("--publish")) {
    if (!process.env.STORE_ADMIN_TOKEN)
      throw new Error("Set STORE_ADMIN_TOKEN locally to publish.");
    const base = new URL(value("--site") ?? "https://searealm.com");
    if (base.protocol !== "https:")
      throw new Error("Publishing requires HTTPS.");
    const endpoint = new URL("/api/admin/manufacturing", base.origin);
    for (const file of new Set(Object.values(files))) {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "x-admin-token": process.env.STORE_ADMIN_TOKEN,
          "Content-Type": "image/png",
        },
        body: await readFile(file),
        redirect: "error",
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok)
        throw new Error(
          "Private artwork upload failed. The previous release remains active.",
        );
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-admin-token": process.env.STORE_ADMIN_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "publish", release }),
      redirect: "error",
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok)
      throw new Error(
        "Release publication failed. The previous release remains active.",
      );
    await atomicJson(path.join(PRIVATE_ROOT, "last-published.json"), {
      version,
      releaseId,
      sourceHash,
    });
    console.log(
      `Published ${releaseId}. Existing orders keep their pinned release.`,
    );
  } else console.log(`Private release saved: ${manifestFile}`);
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
