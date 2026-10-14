import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPrintingCatalog } from "../../src/lib/manufacturing/boosters.mjs";
import { fixedArtworkSources } from "../../src/lib/manufacturing/recipes.mjs";
import {
  BACK_ART_SOURCE,
  BACK_TEMPLATE,
  PRINT_LAYOUT,
} from "../../src/lib/manufacturing/printPlan.mjs";
import {
  pngDimensions,
  sha256,
  assetKey,
  validateRelease,
} from "../../src/lib/manufacturing/integration.mjs";
import { PRIVATE_ROOT, REPO_ROOT, atomicJson } from "./orders.mjs";
import { validFixedSheetPositions } from "../../src/lib/manufacturing/sourceGeometry.mjs";

export function buildSourceMap(
  setList,
  gallery,
  holoVerification,
  overrides = {},
) {
  // Verified by collector number in Figma; gallery names or artwork versions can differ.
  overrides = {
    "reef-017": "4129:195183", // Great White standard component, 17/102; the gallery uses full art 2/102.
    "reef-068": "193:27",
    "reef-095": "92:310",
    ...overrides,
  };
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
    // The cutter template contains numbered placeholders, not card artwork.
    { id: "standard-back-sheet", kind: "back", nodeId: BACK_ART_SOURCE.nodeId },
    ...fixedArtworkSources(),
    ...[PRINT_LAYOUT, BACK_TEMPLATE].map((template) => ({
      id: template.background.assetId,
      kind: "backdrop",
      nodeId: template.background.nodeId,
    })),
  );
  const reference = (template) => ({
    fileKey: template.fileKey,
    nodeId: template.nodeId,
    name: template.name,
    width: template.width,
    height: template.height,
    positions: template.positions,
    background: template.background,
  });
  return {
    fileKey: gallery.fileKey,
    catalog,
    sources,
    // Geometry participates in the source hash, so changing a cutter template
    // invalidates the unchanged-version shortcut and any partial export cache.
    templates: {
      version: PRINT_LAYOUT.version,
      fronts: reference(PRINT_LAYOUT),
      backs: reference(BACK_TEMPLATE),
    },
    missing: sources
      .filter((s) => !s.nodeId)
      .map((s) => ({ id: s.id, cardId: s.cardId })),
  };
}

// This approved list describes unfinished artwork, not a general fallback for
// missing exports. A mapped printing always stays eligible and must validate.
export function applyUnfinishedArtworkPolicy(source, policy) {
  const catalog = new Map(source.catalog.map((card) => [card.printingId, card]));
  const cardSources = new Map(
    source.sources.filter((item) => item.kind === "card").map((item) => [item.id, item]),
  );
  if (
    policy?.schemaVersion !== 1 ||
    typeof policy.reason !== "string" ||
    !policy.reason.trim() ||
    policy.reason.length > 500 ||
    !Array.isArray(policy.printingIds) ||
    new Set(policy.printingIds).size !== policy.printingIds.length ||
    policy.printingIds.some(
      (id) =>
        typeof id !== "string" ||
        !/^(reef|deep|ocean)-\d{3}$/.test(id) ||
        !catalog.has(id) ||
        !cardSources.has(id),
    )
  )
    throw new Error("Invalid approved unfinished-artwork policy. Review its printing IDs and reason.");
  const approved = new Set(policy.printingIds);
  const excludedUnfinished = source.sources
    .filter((item) => item.kind === "card" && !item.nodeId && approved.has(item.id))
    .map((item) => ({
      printingId: item.id,
      cardId: catalog.get(item.id).cardId,
      name: catalog.get(item.id).name,
      reason: policy.reason.trim(),
    }));
  const excluded = new Set(excludedUnfinished.map((item) => item.printingId));
  const sources = source.sources.filter((item) => !excluded.has(item.id));
  return {
    ...source,
    catalog: source.catalog.filter((card) => !excluded.has(card.printingId)),
    sources,
    missing: sources
      .filter((item) => !item.nodeId)
      .map((item) => ({ id: item.id, cardId: item.cardId })),
    excludedUnfinished,
  };
}

export function validateCutterTemplate(document, template) {
  const label = template.name ?? template.nodeId;
  const invalid = (detail) => {
    throw new Error(
      `Cutter template ${label}: ${detail}. Review the Figma template and saved print geometry before syncing; the active artwork release is unchanged.`,
    );
  };
  const origin = document?.absoluteBoundingBox;
  if (
    !document ||
    document.type !== "FRAME" ||
    document.visible === false ||
    document.id !== template.nodeId ||
    document.name !== template.name
  )
    invalid("the expected template frame is missing or renamed");
  if (
    !origin ||
    ![origin.x, origin.y, origin.width, origin.height].every(Number.isFinite) ||
    Math.abs(origin.width - 2550) > 0.01 ||
    Math.abs(origin.height - 3300) > 0.01
  )
    invalid("the page must be 2550 × 3300 pixels");
  const grids = (document.children ?? []).filter(
    (child) => child.type === "FRAME" && child.name === "card_backs" && child.visible !== false,
  );
  if (grids.length !== 1) invalid("one visible card_backs frame is required");
  if (template.background) {
    if (
      (document.opacity ?? 1) !== 1 || (document.rotation ?? 0) !== 0 ||
      !["NORMAL", "PASS_THROUGH"].includes(document.blendMode ?? "NORMAL") ||
      document.isMask === true ||
      (document.effects ?? []).some((effect) => effect.visible !== false)
    ) invalid("the ocean backdrop parent frame cannot alter its compositing or orientation");
    const expected = template.background;
    const background = (document.children ?? []).find((child) => child.id === expected.nodeId);
    const fills = background?.fills?.filter((fill) => fill.visible !== false);
    if (
      !background || background.type !== "RECTANGLE" || background.visible === false ||
      (background.opacity ?? 1) !== 1 || (background.rotation ?? 0) !== 0 ||
      !["NORMAL", "PASS_THROUGH"].includes(background.blendMode ?? "NORMAL") ||
      background.isMask === true ||
      (background.children?.length ?? 0) !== 0 ||
      (background.effects ?? []).some((effect) => effect.visible !== false) ||
      (background.strokes ?? []).some((stroke) => stroke.visible !== false) ||
      fills?.length !== 1 || fills[0].type !== "IMAGE" ||
      (fills[0].opacity ?? 1) !== 1 ||
      (fills[0].blendMode ?? "NORMAL") !== "NORMAL" ||
      document.children.indexOf(background) >= document.children.indexOf(grids[0])
    ) invalid("the ocean backdrop must be a visible image-only rectangle behind the card grid");
    const bounds = background.absoluteBoundingBox;
    const measured = bounds && {
      x: bounds.x - origin.x, y: bounds.y - origin.y,
      width: bounds.width, height: bounds.height,
    };
    if (!measured || ["x", "y", "width", "height"].some((field) =>
      !Number.isFinite(measured[field]) || !Number.isFinite(expected[field]) ||
      Math.abs(measured[field] - expected[field]) > 0.01) ||
      measured.x < 0 || measured.y < 0 || measured.width <= 0 || measured.height <= 0 ||
      measured.x + measured.width > origin.width || measured.y + measured.height > origin.height
    ) invalid("the ocean backdrop bounds differ from the saved template");
  }
  const slots = (grids[0].children ?? []).filter(
    (child) => child.type === "GROUP" && child.visible !== false,
  );
  if (slots.length !== 9) invalid("exactly nine visible card groups are required");
  const positions = slots.map((slot) => {
    const bounds = slot.absoluteBoundingBox;
    if (
      !bounds ||
      ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
      bounds.width <= 0 ||
      bounds.height <= 0
    )
      invalid("a card group has missing or invalid bounds");
    const position = {
      x: bounds.x - origin.x,
      y: bounds.y - origin.y,
      width: bounds.width,
      height: bounds.height,
    };
    if (
      position.x < 0 ||
      position.y < 0 ||
      position.x + position.width > origin.width ||
      position.y + position.height > origin.height
    )
      invalid("a card group extends outside the page");
    return position;
  }).sort((a, b) => Math.abs(a.y - b.y) < 0.01 ? a.x - b.x : a.y - b.y);
  if (!Array.isArray(template.positions) || template.positions.length !== 9)
    invalid("the saved template geometry is incomplete");
  for (const [index, position] of positions.entries()) {
    for (const field of ["x", "y", "width", "height"]) {
      if (
        !Number.isFinite(template.positions[index][field]) ||
        Math.abs(position[field] - template.positions[index][field]) > 0.01
      )
        invalid(`card ${Math.floor(index / 3) + 1}:${index % 3 + 1} ${field} differs from the saved geometry by more than 0.01 pixel`);
    }
  }
  return positions;
}

export async function checkCutterTemplates(figma, source, version) {
  const templates = [source.templates.fronts, source.templates.backs];
  if (!version) throw new Error("A pinned Figma version is required to check cutter templates.");
  if (templates.some((template) => template.fileKey !== source.fileKey))
    throw new Error("Cutter templates and print artwork must come from the same versioned Figma file.");
  const ids = templates.map((template) => template.nodeId).join(",");
  const response = await figma(
    `files/${source.fileKey}/nodes?ids=${encodeURIComponent(ids)}&version=${encodeURIComponent(version)}`,
  );
  for (const template of templates)
    validateCutterTemplate(response.nodes?.[template.nodeId]?.document, template);
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
  if (!validFixedSheetPositions(positions, document.id))
    throw new Error(
      "The fixed sheet is not a supported card-count or Letter layout. Review its Figma frames.",
    );
  return positions;
}
function texts(node, found = []) {
  if (node.type === "TEXT" && typeof node.characters === "string")
    found.push(node.characters.trim());
  for (const child of node.children ?? []) texts(child, found);
  return found;
}
export function parseBatchSize(args) {
  const index = args.indexOf("--batch-size");
  if (index === -1) return 10;
  if (
    args.lastIndexOf("--batch-size") !== index ||
    !/^(?:[1-9]|10)$/.test(args[index + 1] ?? "")
  )
    throw new Error("--batch-size must be an integer from 1 to 10.");
  return Number(args[index + 1]);
}
export function parseConcurrency(args) {
  const index = args.indexOf("--concurrency");
  if (index === -1) return 1;
  if (args.lastIndexOf("--concurrency") !== index || !/^[1-3]$/.test(args[index + 1] ?? ""))
    throw new Error("--concurrency must be an integer from 1 to 3.");
  return Number(args[index + 1]);
}
export function isTransientExportError(error) {
  if ([401, 403, 429].includes(error?.status)) return false;
  if (error instanceof AggregateError)
    return error.errors.length > 0 && error.errors.every(isTransientExportError);
  return error?.transient === true || (error?.status >= 500 && error.status < 600) ||
    ["TimeoutError", "AbortError"].includes(error?.name) ||
    /^UND_ERR_(?:CONNECT|HEADERS|BODY)_TIMEOUT$/.test(error?.code ?? "") ||
    Boolean(error?.cause && error.cause !== error && isTransientExportError(error.cause));
}
export async function runExportBatches(batches, { concurrency = 1, runBatch, checkpoint = async () => {} }) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3)
    throw new Error("Export concurrency must be an integer from 1 to 3.");
  let next = 0, stopped = false, writes = Promise.resolve();
  const failures = [];
  const stopScheduling = () => { stopped = true; };
  const saveProgress = () => {
    const write = writes.then(() => checkpoint());
    writes = write.catch(() => {});
    return write;
  };
  const worker = async () => {
    while (!stopped && next < batches.length) {
      const batch = batches[next++];
      try { await runBatch(batch, saveProgress, stopScheduling); }
      catch (error) {
        failures.push(error);
        if (!isTransientExportError(error)) stopScheduling();
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, worker));
  await writes;
  if (failures.length) {
    const messages = (error) => error instanceof AggregateError && error.errors.length
      ? error.errors.flatMap(messages)
      : [String(error?.message ?? "Unknown export failure.")
        .replace(/\bhttps?:\/\/[^\s"'<>]+/gi, "[redacted URL]")];
    const details = [...new Set(failures.flatMap(messages))].join("; ");
    throw new AggregateError(failures, `${failures.length} export batch(es) failed. ${details} Completed assets are saved; no release was written or published by this run.`);
  }
}
async function main() {
  const args = process.argv.slice(2),
    value = (flag) =>
      args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
  // Validate before credentials, API requests, or any local export writes.
  const batchSize = parseBatchSize(args);
  const concurrency = parseConcurrency(args);
  const read = async (relative) =>
    JSON.parse(await readFile(path.join(REPO_ROOT, relative), "utf8"));
  const overrides = value("--overrides")
    ? JSON.parse(await readFile(value("--overrides"), "utf8"))
    : {};
  const source = applyUnfinishedArtworkPolicy(
    buildSourceMap(
      await read("src/data/gallery-set-list.json"),
      await read("src/data/gallery-images.json"),
      await read("scripts/manufacturing/figma-holo-sources.json"),
      overrides,
    ),
    await read("scripts/manufacturing/figma-unfinished-printings.json"),
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
          excludedUnfinished: source.excludedUnfinished,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (source.missing.length && !args.includes("--allow-incomplete"))
    throw new Error(
      `Map ${source.missing.length} missing Figma nodes first. See .private/manufacturing/source-map.json; use --overrides. These cards remain in the pool; only the explicitly approved unfinished printings can be excluded. --allow-incomplete can publish available artwork; orders needing incomplete sets will be held before a draw.`,
    );
  if (!process.env.FIGMA_ACCESS_TOKEN)
    throw new Error("Set FIGMA_ACCESS_TOKEN locally with file read access.");
  const retryFile=path.join(PRIVATE_ROOT,"figma-retry.json");
  let retryNotBefore = 0;
  let retryWrite = Promise.resolve();
  try {
    const retry=JSON.parse(await readFile(retryFile,"utf8"));
    if(Date.parse(retry.notBefore)>Date.now()) {
      console.log(`Figma requested a pause until ${retry.notBefore}. The active release is unchanged.`);
      return;
    }
  } catch(error) { if(error.code!=="ENOENT")throw error; }
  async function figma(route, stopScheduling = () => {}) {
    const imageExport = route.startsWith("images/");
    const endpoint = imageExport
      ? "image export"
      : route.includes("/nodes?") ? "node lookup" : "file metadata";
    const timeout = imageExport ? 300_000 : 90_000;
    let response;
    try {
      response = await fetch(`https://api.figma.com/v1/${route}`, {
        headers: { "X-Figma-Token": process.env.FIGMA_ACCESS_TOKEN },
        signal: AbortSignal.timeout(timeout),
        redirect: "error",
      });
    } catch (error) {
      const detail = isTransientExportError(error)
        ? `timed out after ${timeout / 1000} seconds`
        : "could not be completed";
      if (!isTransientExportError(error)) stopScheduling();
      throw new Error(`Figma ${endpoint} request ${detail}. Completed exports are saved; the active release is unchanged.`, { cause: error });
    }
    if ([401, 403, 429].includes(response.status)) stopScheduling();
    if(response.status===429) {
      const raw=response.headers.get("retry-after")??"60";
      let notBefore=/^\d+$/.test(raw)?Date.now()+Number(raw)*1000:Date.parse(raw);
      if(!Number.isFinite(notBefore)||notBefore<=Date.now())notBefore=Date.now()+60_000;
      retryNotBefore = Math.max(retryNotBefore, notBefore);
      // Concurrent node/image responses must preserve the longest pause and
      // serialize atomic writes to their shared retry journal.
      retryWrite = retryWrite.catch(() => {}).then(() =>
        atomicJson(retryFile, { notBefore: new Date(retryNotBefore).toISOString() }),
      );
      await retryWrite;
    }
    if (!response.ok) {
      const error = Object.assign(new Error(
        response.status === 429
          ? `Figma rate limited the ${endpoint} request. Retry after ${response.headers.get("retry-after") ?? "the indicated interval"}; the active release is unchanged.`
          : `Figma ${endpoint} request failed (${response.status}).`,
      ), { status: response.status });
      if (!isTransientExportError(error)) stopScheduling();
      throw error;
    }
    try {
      return await response.json();
    } catch (error) {
      if (!isTransientExportError(error)) stopScheduling();
      throw new Error(`Figma ${endpoint} returned an unreadable response. Completed exports are saved; the active release is unchanged.`, { cause: error });
    }
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
  // Read both guides at the exact version used for every artwork export. They
  // are checked as geometry only and are never exported as printable assets.
  await checkCutterTemplates(figma, source, version);
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
    printTemplates: source.templates,
    catalog: source.catalog,
    missing: source.missing,
    excludedUnfinished: source.excludedUnfinished,
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
  const batches = Array.from({ length: Math.ceil(mapped.length / batchSize) }, (_, index) =>
    mapped.slice(index * batchSize, (index + 1) * batchSize));
  await runExportBatches(batches, {
    concurrency,
    checkpoint: () => atomicJson(progressFile, { version, sourceHash, assets: release.assets }),
    runBatch: async (batch, saveProgress, stopScheduling) => {
      const ids = [...new Set(batch.map((s) => s.nodeId))].join(",");
      const responses = await Promise.allSettled([
        figma(
          `files/${source.fileKey}/nodes?ids=${encodeURIComponent(ids)}&version=${encodeURIComponent(version)}`,
          stopScheduling,
        ),
        figma(
          `images/${source.fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=1&version=${encodeURIComponent(version)}`,
          stopScheduling,
        ),
      ]);
      const failures = responses.filter((response) => response.status === "rejected");
      if (failures.length)
        throw new AggregateError(failures.map((response) => response.reason), failures.map((response) => response.reason.message).join(" "));
      const [nodes, images] = responses.map((response) => response.value);
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
        if (!response.ok) throw Object.assign(new Error(`Could not download ${item.id} (${response.status}).`), { status: response.status });
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
        await saveProgress();
      }
      console.log(
        `Exported ${Object.keys(release.assets).length} / ${source.sources.length - source.missing.length} private assets.`,
      );
    },
  });
  if (mapped.some((item) => !release.assets[item.id]))
    throw new Error("Required artwork is still missing. Completed assets are saved; no release was written or published by this run.");
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
