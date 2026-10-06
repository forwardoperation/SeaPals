import {
  mkdir,
  readFile,
  writeFile,
  rename,
  rmdir,
  stat,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  buildPrintingCatalog,
  contentHash,
} from "../../src/lib/manufacturing/boosters.mjs";
import {
  assertRequestMatchesManifest,
  createManufacturingManifest,
  validateOrderRequest,
  verifyManifest,
} from "../../src/lib/manufacturing/printPlan.mjs";
import {
  applyManufacturingEvent,
  createManufacturingState,
  workflowReadiness,
} from "../../src/lib/manufacturing/workflow.mjs";

export const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const PRIVATE_ROOT = path.join(REPO_ROOT, ".private", "manufacturing");

export async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}
export async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
export async function atomicJson(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
    flush: true,
  });
  await rename(temporary, file);
}

export async function withOrderLock(root, orderId, action) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(orderId ?? ""))
    throw new Error("Invalid order ID.");
  const directory = path.join(root, "orders", orderId);
  await mkdir(directory, { recursive: true });
  const lock = path.join(directory, ".lock");
  try {
    await mkdir(lock);
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        "Order is locked. If a previous process crashed, inspect its print state before removing the lock.",
      );
    throw error;
  }
  try {
    return await action(directory);
  } finally {
    await rmdir(lock);
  }
}

export async function saveOrder({
  root = PRIVATE_ROOT,
  request,
  catalog,
  artworkRelease,
  randomIndex,
}) {
  const normalized = validateOrderRequest(request);
  return withOrderLock(root, normalized.orderId, async (directory) => {
    const file = path.join(directory, "order.json");
    if (await exists(file)) {
      const saved = await readJson(file);
      assertRequestMatchesManifest(normalized, saved.manifest);
      return { ...saved, reused: true, directory };
    }
    const manifest = createManufacturingManifest({
      request: normalized,
      catalog,
      artworkRelease,
      randomIndex,
    });
    const saved = { manifest, state: createManufacturingState(manifest) };
    await atomicJson(file, saved);
    return { ...saved, reused: false, directory };
  });
}

export async function updateOrder({ root = PRIVATE_ROOT, orderId, event }) {
  return withOrderLock(root, orderId, async (directory) => {
    const file = path.join(directory, "order.json");
    const saved = await readJson(file);
    verifyManifest(saved.manifest);
    const state = applyManufacturingEvent(saved.state, saved.manifest, event);
    if (state !== saved.state) await atomicJson(file, { ...saved, state });
    return { ...saved, state, directory };
  });
}

export function argumentsMap(args) {
  const result = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (
      !/^--[a-z-]+$/.test(key) ||
      index + 1 >= args.length ||
      args[index + 1].startsWith("--")
    )
      throw new Error("Arguments must be --name value pairs.");
    result[key.slice(2)] = args[++index];
  }
  return result;
}

function summary(saved) {
  return {
    orderId: saved.manifest.order.orderId,
    manifestHash: saved.manifest.manifestHash,
    reused: saved.reused ?? true,
    directory: saved.directory,
    packs: saved.manifest.packs.length,
    frontSheets: saved.manifest.sheets.length,
    backSheets: saved.manifest.sheets.length,
    holoStickers: saved.manifest.holoChecklist.length,
    prereleaseCards: saved.manifest.packs
      .flatMap((pack) => pack.cards)
      .filter((card) => card.prerelease).length,
    revision: saved.state.revision,
    ...workflowReadiness(saved.state),
  };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const options = argumentsMap(args);
  if (command === "create") {
    const request = await readJson(options.request);
    const [sets, gallery] = await Promise.all([
      readJson(path.join(REPO_ROOT, "src/data/gallery-set-list.json")),
      readJson(path.join(REPO_ROOT, "src/data/gallery-images.json")),
    ]);
    const saved = await saveOrder({
      request,
      catalog: buildPrintingCatalog(sets, gallery),
      artworkRelease: options.release,
    });
    console.log(JSON.stringify(summary(saved), null, 2));
  } else if (command === "status") {
    const id = options["order-id"];
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id ?? ""))
      throw new Error("Invalid order ID.");
    const directory = path.join(PRIVATE_ROOT, "orders", id);
    const saved = await readJson(path.join(directory, "order.json"));
    verifyManifest(saved.manifest);
    console.log(
      JSON.stringify(
        {
          ...summary({ ...saved, directory }),
          sheets: saved.state.sheets,
          holoChecklist: saved.manifest.holoChecklist.map((item) => ({
            ...item,
            done: saved.state.holos[item.id],
          })),
        },
        null,
        2,
      ),
    );
  } else if (command === "event") {
    const event = await readJson(options.event);
    const saved = await updateOrder({ orderId: options["order-id"], event });
    console.log(JSON.stringify(summary(saved), null, 2));
  } else if (command === "audit") {
    const [sets, gallery] = await Promise.all([
      readJson(path.join(REPO_ROOT, "src/data/gallery-set-list.json")),
      readJson(path.join(REPO_ROOT, "src/data/gallery-images.json")),
    ]);
    const catalog = buildPrintingCatalog(sets, gallery);
    console.log(
      JSON.stringify(
        {
          catalogHash: contentHash(catalog),
          printings: catalog.length,
          prereleaseAllowed: true,
          sets: Object.fromEntries(
            ["reef", "ocean", "deep"].map((set) => [
              set,
              Object.fromEntries(
                ["Common", "Uncommon", "Rare", "Holo Rare"].map((rarity) => [
                  rarity,
                  catalog.filter(
                    (card) => card.set === set && card.rarity === rarity,
                  ).length,
                ]),
              ),
            ]),
          ),
        },
        null,
        2,
      ),
    );
  } else
    throw new Error(
      "Use create --request file.json --release release-id, status --order-id id, event --order-id id --event file.json, or audit.",
    );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
