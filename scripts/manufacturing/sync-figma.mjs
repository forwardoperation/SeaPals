import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { buildPrintingCatalog } from "../../src/lib/manufacturing/boosters.mjs";
import {
  BOOSTER_PRODUCTS,
  FIXED_PRODUCTS,
  fixedArtworkSources,
  fixedSheetLabel,
  fixedSheetAssets,
} from "../../src/lib/manufacturing/recipes.mjs";
import {
  BACK_ART_SOURCE,
  BACK_TEMPLATE,
  PRINT_LAYOUT,
  HOLO_PRINT_LAYOUT,
  HOLO_BACK_TEMPLATE,
} from "../../src/lib/manufacturing/printPlan.mjs";
import {
  pngDimensions,
  sha256,
  assetKey,
  validateRelease,
} from "../../src/lib/manufacturing/integration.mjs";
import { PRIVATE_ROOT, REPO_ROOT, atomicJson } from "./orders.mjs";
import { validFixedSheetPositions } from "../../src/lib/manufacturing/sourceGeometry.mjs";
import { validateTunedTemplate } from "./tuned-template-validation.mjs";
import { isGridTemplate, validateGridTemplate } from "./grid-template-validation.mjs";

const currentTemplates = [PRINT_LAYOUT, BACK_TEMPLATE, HOLO_PRINT_LAYOUT, HOLO_BACK_TEMPLATE];

export function buildSourceMap(
  setList,
  gallery,
  holoVerification,
  overrides = {},
) {
  // Verified by collector number in Figma; gallery names or artwork versions can differ.
  overrides = {
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
    // Each Canon asset is its complete native page, including all approved marks.
    { id: "standard-back-sheet", kind: "back", nodeId: BACK_ART_SOURCE.nodeId },
    ...fixedArtworkSources(),
    ...currentTemplates.filter(template => template.background.assetId !== "standard-back-sheet").map((template) => ({
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
    ...(template.grid ? { grid: template.grid } : {}),
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
      holoFronts: reference(HOLO_PRINT_LAYOUT),
      holoBacks: reference(HOLO_BACK_TEMPLATE),
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

function validateProducts(products) {
  if (
    !Array.isArray(products) || !products.length ||
    new Set(products).size !== products.length ||
    products.some((id) => typeof id !== "string" ||
      (!Object.hasOwn(BOOSTER_PRODUCTS, id) && !Object.hasOwn(FIXED_PRODUCTS, id)))
  ) throw new Error("--products must list unique known product IDs separated by commas.");
  return [...products].sort();
}

export function parseProducts(args) {
  const index = args.indexOf("--products");
  if (index === -1) return null;
  if (args.lastIndexOf("--products") !== index ||
      typeof args[index + 1] !== "string" || args[index + 1].startsWith("--"))
    throw new Error("--products must list unique known product IDs separated by commas.");
  return validateProducts(args[index + 1].split(",").map((id) => id.trim()));
}

export function selectProductArtwork(source, products = null) {
  if (products === null) return source;
  const selected = validateProducts(products), required = new Set();
  for (const productId of selected) {
    const set = BOOSTER_PRODUCTS[productId];
    if (set) {
      // Select the whole eligible pool, including every rare/holo outcome.
      for (const card of source.catalog.filter((card) => card.set === set))
        required.add(card.printingId);
    } else for (const id of fixedSheetAssets(productId)) required.add(id);
  }
  if (!required.size)
    throw new Error("The selected products have no printable artwork to export.");
  required.add("standard-back-sheet");
  for (const template of currentTemplates)
    required.add(template.background.assetId);
  const sources = source.sources.filter((item) => required.has(item.id));
  if (sources.length !== required.size)
    throw new Error("The selected products are missing required artwork source entries.");
  return {
    ...source,
    // Catalog stays complete: unsupported sets fail before drawing, rather than
    // acquiring a smaller pool. Scope also participates in the cache/release hash.
    exportScope: { products: selected },
    sources,
    missing: sources.filter((item) => !item.nodeId)
      .map((item) => ({ id: item.id, cardId: item.cardId })),
  };
}

export function validateCutterTemplate(document, template) {
  if (isGridTemplate(template)) return validateGridTemplate(document, template);
  if (template.positions?.some(position => position.rotation !== undefined))
    return validateTunedTemplate(document, template);
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
  const templates = [source.templates.fronts, source.templates.backs, source.templates.holoFronts, source.templates.holoBacks].filter(Boolean);
  if (!version) throw new Error("A pinned Figma version is required to check cutter templates.");
  if (templates.some((template) => template.fileKey !== source.fileKey))
    throw new Error("Cutter templates and print artwork must come from the same versioned Figma file.");
  const ids = templates.map((template) => template.nodeId).join(",");
  const response = await figma(
    `files/${source.fileKey}/nodes?ids=${encodeURIComponent(ids)}&geometry=paths&version=${encodeURIComponent(version)}`,
  );
  for (const template of templates)
    validateCutterTemplate(response.nodes?.[template.nodeId]?.document, { ...template, version: source.templates.version });
  return response;
}

function fixedSheetGridPath(document, source = fixedArtworkSources().find(item => item.nodeId === document?.id)) {
  const paths = [];
  function visit(node, parents) {
    if (!node || node.visible === false) return;
    const path = [...parents, node];
    if (node.name === "card_backs") { paths.push(path); return; }
    for (const child of node.children ?? []) visit(child, path);
  }
  visit(document, []);
  if (paths.length !== 1)
    throw new Error("The fixed sheet needs exactly one visible Figma card_backs grid.");
  const path = paths[0];
  if (source?.exportNodeId && path.at(-1).id !== source.exportNodeId)
    throw new Error("The fixed sheet's isolated export grid does not match its reviewed source mapping.");
  return path;
}

function checkedOmittedFrames(document, grid) {
  const source = fixedArtworkSources().find(item => item.nodeId === document.id), omitted = new Set(source?.omittedNodeIds ?? []);
  for (const node of grid.children ?? []) {
    if (!omitted.has(node.id)) continue;
    const paints = [...(node.fills ?? []), ...(node.background ?? [])];
    const empty = node.type === "FRAME" && Array.isArray(node.children) && node.children.length === 0 &&
      (node.strokes ?? []).length === 0 && (node.effects ?? []).length === 0 && !node.isMask &&
      paints.every(paint => paint.visible === false || paint.opacity === 0 ||
        paint.type === "SOLID" && (paint.color?.a === 0 ||
          [paint.color?.r, paint.color?.g, paint.color?.b].every(channel => channel === 1)));
    if (!empty)
      throw new Error(`The reviewed empty fixed-sheet frame ${node.id} now contains artwork or effects. Review its source mapping before syncing; no card may be silently omitted.`);
  }
  return omitted;
}

export function sheetPositions(document) {
  const grid = fixedSheetGridPath(document).at(-1), omitted = checkedOmittedFrames(document, grid);
  if (!document.absoluteBoundingBox)
    throw new Error("The fixed sheet needs its Figma Letter page bounds.");
  const positions = (grid.children ?? [])
    .filter((c) => c.visible !== false && c.absoluteBoundingBox && !omitted.has(c.id))
    .map((c) => {
      const b = c.absoluteBoundingBox, origin = document.absoluteBoundingBox;
      return { x: b.x - origin.x, y: b.y - origin.y, width: b.width, height: b.height };
    });
  if (!validFixedSheetPositions(positions, document.id))
    throw new Error("The fixed sheet is not a supported card-count or Letter layout. Review its Figma frames.");
  return positions;
}

const isFixedSheet = (item) => item.kind === "sheet";

export function validateFixedSheetBackgrounds(document, source) {
  const invalid = (detail) => {
    throw new Error(
      `Fixed sheet ${fixedSheetLabel(source.id)}: ${detail}. Visible exported ancestor fills flatten an opaque background into the card crops and cover the water. Remove or hide fills on the exported sheet/grid ancestors before syncing; the active artwork release is unchanged.`,
    );
  };
  if (!document || document.id !== source.nodeId || document.visible === false)
    invalid("the expected visible source sheet is missing");
  let path;
  try { path = fixedSheetGridPath(document, source); } catch (error) { invalid(error.message); }
  checkedOmittedFrames(document, path.at(-1));
  if (source.exportNodeId) {
    const reviewed = fixedArtworkSources().find(item => item.id === source.id);
    if (reviewed?.nodeId !== source.nodeId || reviewed?.exportNodeId !== source.exportNodeId)
      invalid("the isolated grid is not a reviewed fixed-sheet export");
    // Ancestors and siblings above this explicit export root never enter the PNG.
    path = [path.at(-1)];
  }
  if (!source.exportNodeId) {
    const cards = (path.at(-1).children ?? []).filter(card => card.visible !== false)
      .map(card => card.absoluteBoundingBox).filter(Boolean);
    const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x &&
      a.y < b.y + b.height && a.y + a.height > b.y;
    const checkSibling = (node) => {
      if (node.visible === false || node.opacity === 0) return;
      const paints = [...(node.fills ?? []), ...(node.background ?? []), ...(node.strokes ?? [])];
      if (paints.some(paint => paint.visible !== false && (paint.opacity ?? 1) > 0 &&
          (paint.type !== "SOLID" || (paint.color?.a ?? 1) > 0))) {
        const bounds = node.absoluteRenderBounds ?? node.absoluteBoundingBox;
        if (!bounds || !cards.length || cards.some(card => overlaps(bounds, card)))
          invalid(`visible non-card layer ${node.name || node.id || "unknown"} overlaps a source card crop or lacks verifiable bounds`);
      }
      for (const child of node.children ?? []) checkSibling(child);
    };
    for (let index = 0; index < path.length - 1; index++)
      for (const sibling of path[index].children ?? [])
        if (sibling !== path[index + 1]) checkSibling(sibling);
  }
  for (const parent of path) {
    const fills = [...(parent.fills ?? []), ...(parent.background ?? [])];
    if (fills.some((fill) => fill.visible !== false && (fill.opacity ?? 1) > 0 &&
      (fill.type !== "SOLID" || (fill.color?.a ?? 1) > 0)))
      invalid(`the ${parent === document ? "sheet" : parent.name || "ancestor"} has a visible fill`);
  }
}

export function normalizeFixedSheetExport(bytes, document, source) {
  validateFixedSheetBackgrounds(document, source);
  const sourcePositions = sheetPositions(document);
  if (!source.exportNodeId) return { bytes, positions: sourcePositions,
    ...(source.omittedNodeIds?.length ? { omittedNodeIds: [...source.omittedNodeIds] } : {}) };
  const grid = fixedSheetGridPath(document, source).at(-1), page = document.absoluteBoundingBox,
    bounds = grid.absoluteBoundingBox;
  if (!bounds || page.width !== 2550 || page.height !== 3300)
    throw new Error("The isolated grid needs verified Letter page and source bounds.");
  const sourceBounds = { x: bounds.x - page.x, y: bounds.y - page.y, width: bounds.width, height: bounds.height },
    padding = { x: Math.round(sourceBounds.x), y: Math.round(sourceBounds.y) };
  const raw = PNG.sync.read(bytes, { checkCRC: true });
  if (raw.width !== Math.round(bounds.width) || raw.height !== Math.round(bounds.height) ||
      padding.x < 0 || padding.y < 0 || padding.x + raw.width > 2550 || padding.y + raw.height > 3300)
    throw new Error("The isolated grid PNG must match its measured bounds and fit fully inside Letter.");
  if (sourcePositions.some(p => p.x < sourceBounds.x || p.y < sourceBounds.y ||
      p.x + p.width > sourceBounds.x + sourceBounds.width || p.y + p.height > sourceBounds.y + sourceBounds.height))
    throw new Error("The isolated export grid clips one or more measured source cards.");
  const cropTranslation = { x: padding.x - sourceBounds.x, y: padding.y - sourceBounds.y },
    positions = sourcePositions.map(p => ({ ...p, x: p.x + cropTranslation.x, y: p.y + cropTranslation.y }));
  if (!validFixedSheetPositions(positions, source.id))
    throw new Error("The padded fixed sheet has invalid card crop bounds.");
  const padded = new PNG({ width: 2550, height: 3300 });
  PNG.bitblt(raw, padded, 0, 0, raw.width, raw.height, padding.x, padding.y);
  return {
    bytes: PNG.sync.write(padded), positions,
    ...(source.preserveSourcePositions ? { outputPositions: structuredClone(sourcePositions) } : {}),
    sourceGeometry: { mode: "isolated-grid-letter", exportNodeId: source.exportNodeId,
      sourceBounds, padding, cropTranslation, sourcePositions },
  };
}

export async function checkFixedSheetBackgrounds(figma, source, version) {
  const sheets = (source.sources ?? []).filter(isFixedSheet);
  if (!sheets.length) return null;
  if (!version || sheets.some((item) => !item.nodeId))
    throw new Error("Fixed-sheet background checks require mapped sheets and a pinned Figma version.");
  const ids = sheets.map((item) => item.nodeId).join(",");
  const response = await figma(
    `files/${source.fileKey}/nodes?ids=${encodeURIComponent(ids)}&depth=4&version=${encodeURIComponent(version)}`,
  );
  for (const item of sheets)
    validateFixedSheetBackgrounds(response.nodes?.[item.nodeId]?.document, item);
  return response;
}

// Keep earlier private maintenance scripts compatible with the broader guard.
export const validateDropOffSheetBackgrounds = validateFixedSheetBackgrounds;
export const checkDropOffSheetBackgrounds = checkFixedSheetBackgrounds;

export function figmaImageRoutes(fileKey, batch, version) {
  // Fixed-sheet crops use coordinates relative to the complete Letter frame,
  // including transparent margins. Other assets retain their existing bounds.
  return [false, true].flatMap((absoluteBounds) => {
    const nodes = batch.filter((item) => isFixedSheet(item) === absoluteBounds);
    if (!nodes.length) return [];
    const ids = [...new Set(nodes.map((item) => item.exportNodeId ?? item.nodeId))].join(",");
    return [`images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=1&version=${encodeURIComponent(version)}${absoluteBounds ? "&use_absolute_bounds=true" : ""}`];
  });
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
// Figma can keep the current version ID while its contents change. Timestamp
// provenance prevents same-version edits from reusing an earlier export cache.
export function parseFigmaSnapshot(metadata, requestedVersion) {
  if (typeof requestedVersion !== "string" || !requestedVersion ||
      metadata?.version !== requestedVersion)
    throw new Error("Figma returned a different version than the requested source snapshot.");
  if (typeof metadata.lastModified !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(metadata.lastModified) ||
      !Number.isFinite(Date.parse(metadata.lastModified)))
    throw new Error("Figma did not return a valid lastModified snapshot marker.");
  return { version: requestedVersion, lastModified: metadata.lastModified };
}

export function sameFigmaSnapshot(left, right) {
  return typeof left?.version === "string" && Boolean(left.version) &&
    typeof left.lastModified === "string" && Boolean(left.lastModified) &&
    left.version === right?.version && left.lastModified === right?.lastModified;
}

export async function readFigmaSnapshot(figma, source, version) {
  const metadata = await figma(
    `files/${source.fileKey}?depth=1&version=${encodeURIComponent(version)}`,
  );
  const snapshot = parseFigmaSnapshot(metadata, version);
  // Always validate the actual templates, including before --if-changed exits.
  const templates = await checkCutterTemplates(figma, source, version);
  if (!sameFigmaSnapshot(snapshot, parseFigmaSnapshot(templates, version)))
    throw new Error("Figma changed while validating the source snapshot. The active release is unchanged; retry from a fresh snapshot.");
  // Check selected deck ancestors before unchanged/resume shortcuts and again
  // before publication, including when every PNG is already cached locally.
  const sheets = await checkFixedSheetBackgrounds(figma, source, version);
  if (sheets && !sameFigmaSnapshot(snapshot, parseFigmaSnapshot(sheets, version)))
    throw new Error("Figma changed while validating fixed-sheet backgrounds. The active release is unchanged; retry from a fresh snapshot.");
  return snapshot;
}

export function canReuseFigmaSnapshot(record, snapshot, sourceHash) {
  return (record?.version ?? record?.figmaVersion) === snapshot.version &&
    record?.sourceHash === sourceHash && sameFigmaSnapshot(record?.figmaSnapshot, snapshot);
}

export function assertFigmaCacheSnapshot(record, snapshot, sourceHash, label = "Artwork cache") {
  if (!canReuseFigmaSnapshot(record, snapshot, sourceHash))
    throw new Error(`${label} belongs to an unverified or different Figma snapshot. Choose a new --release ID; existing artwork and progress remain untouched.`);
}

export function snapshotReleaseId(snapshot, sourceHash) {
  const marker = sha256(Buffer.from(JSON.stringify(snapshot))).slice(0, 8);
  return `figma-${snapshot.version}-${sourceHash.slice(0, 8)}-${marker}`;
}

export async function withVerifiedFigmaSnapshot(figma, source, snapshot, operation) {
  const current = await readFigmaSnapshot(figma, source, snapshot.version);
  if (!sameFigmaSnapshot(snapshot, current))
    throw new Error("Figma changed during export. No release was written or published by this check; choose a new snapshot and release ID.");
  return operation();
}

async function main() {
  const args = process.argv.slice(2),
    value = (flag) =>
      args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
  // Validate before credentials, API requests, or any local export writes.
  const batchSize = parseBatchSize(args);
  const concurrency = parseConcurrency(args);
  const products = parseProducts(args);
  const read = async (relative) =>
    JSON.parse(await readFile(path.join(REPO_ROOT, relative), "utf8"));
  const overrides = value("--overrides")
    ? JSON.parse(await readFile(value("--overrides"), "utf8"))
    : {};
  const source = selectProductArtwork(applyUnfinishedArtworkPolicy(
    buildSourceMap(
      await read("src/data/gallery-set-list.json"),
      await read("src/data/gallery-images.json"),
      await read("scripts/manufacturing/figma-holo-sources.json"),
      overrides,
    ),
    await read("scripts/manufacturing/figma-unfinished-printings.json"),
  ), products);
  await mkdir(PRIVATE_ROOT, { recursive: true });
  await atomicJson(path.join(PRIVATE_ROOT, "source-map.json"), source);
  if (args.includes("--check")) {
    console.log(
      JSON.stringify(
        {
          mapped: source.sources.length - source.missing.length,
          total: source.sources.length,
          ...(source.exportScope ? { exportScope: source.exportScope } : {}),
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
  // An explicit version still needs timestamp provenance: the current Figma
  // version can change in place until it becomes a historical checkpoint.
  const version = value("--version") ?? (await figma(`files/${source.fileKey}?depth=1`)).version;
  if (!version) throw new Error("Figma did not return a version.");
  const sourceHash = sha256(Buffer.from(JSON.stringify(source)));
  const figmaSnapshot = await readFigmaSnapshot(figma, source, version);
  if (args.includes("--if-changed")) {
    try {
      const previous = JSON.parse(
        await readFile(path.join(PRIVATE_ROOT, "last-published.json"), "utf8"),
      );
      if (canReuseFigmaSnapshot(previous, figmaSnapshot, sourceHash)) {
        console.log("Figma snapshot and print source mappings are unchanged.");
        return;
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const releaseId =
    value("--release") ?? snapshotReleaseId(figmaSnapshot, sourceHash);
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(releaseId))
    throw new Error("Invalid release ID.");
  const dir = path.join(PRIVATE_ROOT, "releases", releaseId);
  await mkdir(dir, { recursive: true });
  const release = {
    schemaVersion: 1,
    releaseId,
    figmaFileKey: source.fileKey,
    figmaVersion: version,
    figmaSnapshot,
    sourceHash,
    printTemplates: source.templates,
    catalog: source.catalog,
    missing: source.missing,
    excludedUnfinished: source.excludedUnfinished,
    ...(source.exportScope ? { exportScope: source.exportScope } : {}),
    assets: {},
  };
  const manifestFile = path.join(dir, "release.json");
  // Refuse a legacy or conflicting explicit ID before changing its progress.
  try {
    const existing = JSON.parse(await readFile(manifestFile, "utf8"));
    assertFigmaCacheSnapshot(existing, figmaSnapshot, sourceHash, "Saved release");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const files = {};
  // Resume only exports from the same verified source snapshot. Old journals
  // without a timestamp cannot establish provenance and remain untouched.
  const progressFile = path.join(dir, "progress.json");
  try {
    const progress = JSON.parse(await readFile(progressFile, "utf8"));
    assertFigmaCacheSnapshot(progress, figmaSnapshot, sourceHash, "Saved progress");
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
    checkpoint: () => atomicJson(progressFile, { version, sourceHash, figmaSnapshot, assets: release.assets }),
    runBatch: async (batch, saveProgress, stopScheduling) => {
      const ids = [...new Set(batch.map((s) => s.nodeId))].join(",");
      const responses = await Promise.allSettled([
        figma(
          `files/${source.fileKey}/nodes?ids=${encodeURIComponent(ids)}&version=${encodeURIComponent(version)}`,
          stopScheduling,
        ),
        ...figmaImageRoutes(source.fileKey, batch, version).map((route) =>
          figma(route, stopScheduling)),
      ]);
      const failures = responses.filter((response) => response.status === "rejected");
      if (failures.length)
        throw new AggregateError(failures.map((response) => response.reason), failures.map((response) => response.reason.message).join(" "));
      const [nodes, ...imageResponses] = responses.map((response) => response.value);
      const images = Object.assign({}, ...imageResponses.map((response) => response.images));
      if (!sameFigmaSnapshot(figmaSnapshot, parseFigmaSnapshot(nodes, version))) {
        stopScheduling();
        throw new Error("Figma changed during an export batch. The active release is unchanged; choose a new snapshot and release ID.");
      }
      for (const item of batch) {
        const node = nodes.nodes?.[item.nodeId]?.document,
          url = images[item.exportNodeId ?? item.nodeId];
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
        const downloaded = Buffer.from(await response.arrayBuffer());
        if (downloaded.length > 30_000_000)
          throw new Error("Figma export is too large.");
        const normalized = item.kind === "sheet" ? normalizeFixedSheetExport(downloaded, node, item) : { bytes: downloaded };
        const bytes = normalized.bytes, hash = sha256(bytes),
          dimensions = pngDimensions(bytes),
          file = path.join(dir, `${hash}.png`);
        await writeFile(file, bytes, { flush: true });
        files[item.id] = file;
        release.assets[item.id] = {
          path: assetKey({ sha256: hash }),
          sha256: hash,
          ...dimensions,
          nodeId: item.nodeId,
          ...(item.kind === "sheet" ? { positions: normalized.positions,
            ...(normalized.sourceGeometry ? { sourceGeometry: normalized.sourceGeometry } : {}),
            ...(normalized.omittedNodeIds ? { omittedNodeIds: normalized.omittedNodeIds } : {}),
            ...(normalized.outputPositions ? { outputPositions: normalized.outputPositions } : {}) } : {}),
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
  await withVerifiedFigmaSnapshot(figma, source, figmaSnapshot, async () => {
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
  });
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
    const response = await withVerifiedFigmaSnapshot(figma, source, figmaSnapshot, () => fetch(endpoint, {
      method: "POST",
      headers: {
        "x-admin-token": process.env.STORE_ADMIN_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "publish", release }),
      redirect: "error",
      signal: AbortSignal.timeout(90_000),
    }));
    if (!response.ok)
      throw new Error(
        "Release publication failed. The previous release remains active.",
      );
    await atomicJson(path.join(PRIVATE_ROOT, "last-published.json"), {
      version,
      releaseId,
      sourceHash,
      figmaSnapshot,
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
