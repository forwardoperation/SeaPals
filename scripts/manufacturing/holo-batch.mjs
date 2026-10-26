import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { argumentsMap } from "./orders.mjs";
import { createHoloBatch, parseHoloSelections } from "../../src/lib/manufacturing/holoBatch.mjs";
import { renderHoloBatch } from "./render.mjs";

const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
};

// This command only reads private artwork and writes a new local PDF batch.
// It cannot submit a printer job, mutate product inventory, or contact a buyer.
export async function generateHoloBatch({ releaseFile, cards, outputDir }) {
  const file = await realpath(path.resolve(releaseFile)), releaseDir = path.dirname(file),
    root = path.resolve(releaseDir, "../..");
  if (path.basename(file) !== "release.json" || path.basename(path.dirname(releaseDir)) !== "releases" ||
      path.basename(root) !== "manufacturing" || path.basename(path.dirname(root)) !== ".private")
    throw new Error("Use a release.json inside .private/manufacturing/releases/<release-id>.");
  const privateRoot = await realpath(root), output = path.resolve(outputDir);
  if (!inside(privateRoot, output) || output === privateRoot)
    throw new Error("Save the holo batch inside the release workspace's .private/manufacturing directory.");
  // Follow the nearest existing ancestor before creating folders, so a junction
  // cannot redirect print masters into a public directory.
  let ancestor = path.dirname(output);
  while (true) {
    try {
      if (!inside(privateRoot, await realpath(ancestor))) throw new Error("The output path resolves outside private manufacturing storage.");
      break;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
  const release = JSON.parse(await readFile(file, "utf8")),
    batch = createHoloBatch({ release, selections: parseHoloSelections(cards) }),
    assetFiles = Object.fromEntries(Object.keys(batch.assets).map((id) => [id, path.join(releaseDir, `${release.assets[id].sha256}.png`)]));
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(output); // A fresh directory prevents overwriting an earlier batch.
  if (!inside(privateRoot, await realpath(output))) throw new Error("The output directory is outside private manufacturing storage.");
  const files = await renderHoloBatch({ batch, release, assetFiles, outputDir: output });
  const manifestPath = path.join(output, "batch.json");
  await writeFile(manifestPath, `${JSON.stringify({ batch, files }, null, 2)}\n`, { flag: "wx", mode: 0o600, flush: true });
  return { kind: batch.kind, batchHash: batch.batchHash, quantity: batch.quantity,
    frontSheets: batch.sheets.length, backSheets: batch.sheets.length, manifestPath, files,
    printingRequested: false, inventoryAdded: false };
}

async function main() {
  const options = argumentsMap(process.argv.slice(2));
  if (!options.release || !options.cards || !options["output-dir"] ||
      Object.keys(options).some((key) => !["release", "cards", "output-dir"].includes(key)))
    throw new Error("Use --release <private release.json> --cards reef-101:9,deep-070:9 --output-dir <new private batch directory>.");
  console.log(JSON.stringify(await generateHoloBatch({ releaseFile: options.release, cards: options.cards, outputDir: options["output-dir"] }), null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
