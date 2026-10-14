import {
  BOOSTER_POLICY,
  contentHash,
  generateBooster,
  normalizeBoosterSet,
  validateBoosterPool,
} from "./boosters.mjs";
import {
  BOOSTER_PRODUCTS as PRODUCTS,
  FIXED_PRODUCTS,
  fixedSheetAssets,
} from "./recipes.mjs";
import { validFixedSheetPositions } from "./sourceGeometry.mjs";
import {
  CUTTER_LAYOUT_V2,
  CUTTER_LAYOUT_V3,
  PRINT_BACKGROUNDS,
  backgroundSide,
  isCutterLayout,
  validateBackground,
  validateBackgroundAsset,
} from "./backdrops.mjs";

const cutterWidth = 738.59521484375,
  cutterHeight = 1034.0333251953125;
const cutterPositions = (xs, ys) => Object.freeze(
  ys.flatMap((y) => xs.map((x) => Object.freeze({
    x, y, width: cutterWidth, height: cutterHeight,
  }))),
);

// Measured from the owner's die-cut templates on 2026-10-13. Geometry is saved
// inside each immutable manifest; old manifests retain their original layout.
export const LEGACY_PRINT_LAYOUT = Object.freeze({
  version: CUTTER_LAYOUT_V2,
  fileKey: "xeol2YE0jCE0N5vAD6tjzx",
  nodeId: "4099:61637",
  name: "print-test-die-cut-front-epson",
  width: 2550,
  height: 3300,
  dpi: 300,
  columns: 3,
  rows: 3,
  cardWidth: cutterWidth,
  cardHeight: cutterHeight,
  left: 164.702392578125,
  top: 61.316650390625,
  positions: cutterPositions(
    [164.702392578125, 944.702392578125, 1724.702392578125],
    [61.316650390625, 1117.9832763671875, 2174.64990234375],
  ),
});

export const PRINTER_ROUTES = Object.freeze({
  fronts: "ET-8550 Series(Network)",
  backs: "Canon MF750C II Series UFR II",
});

// This older frame contains the actual card-back artwork. The new cutting
// template contains only placeholders and must never replace the art source.
export const BACK_ART_SOURCE = Object.freeze({
  fileKey: "xeol2YE0jCE0N5vAD6tjzx",
  nodeId: "3758:338124",
  name: "card-back-sea-realm-laser-print",
  width: 2550,
  height: 3300,
  crop: Object.freeze({ x: 150, y: 75, width: 750, height: 1050 }),
});

export const LEGACY_BACK_TEMPLATE = Object.freeze({
  fileKey: LEGACY_PRINT_LAYOUT.fileKey,
  nodeId: "4099:61666",
  name: "print-test-die-cut-rear-canon",
  width: 2550,
  height: 3300,
  positions: cutterPositions(
    [85.702392578125, 865.702392578125, 1645.702392578125],
    [79.316650390625, 1135.9832763671875, 2192.64990234375],
  ),
});

export const PRINT_LAYOUT = Object.freeze({
  ...LEGACY_PRINT_LAYOUT,
  version: CUTTER_LAYOUT_V3,
  background: PRINT_BACKGROUNDS.fronts,
});

export const BACK_TEMPLATE = Object.freeze({
  ...LEGACY_BACK_TEMPLATE,
  background: PRINT_BACKGROUNDS.backs,
});

// Resolve from the release pinned to the job. An omitted template retains the
// original v2 behavior for old callers and releases, even after v3 is active.
export function resolvePrintTemplates(templates) {
  if (templates === undefined)
    return {
      layout: structuredClone(LEGACY_PRINT_LAYOUT),
      backTemplate: structuredClone(LEGACY_BACK_TEMPLATE),
    };
  if (!isCutterLayout(templates?.version))
    throw new Error("Unsupported versioned print templates.");
  for (const [side, expected] of [
    ["fronts", LEGACY_PRINT_LAYOUT],
    ["backs", LEGACY_BACK_TEMPLATE],
  ]) {
    const saved = templates[side];
    if (
      !saved ||
      ["fileKey", "nodeId", "name", "width", "height"].some(
        (key) => saved[key] !== expected[key],
      ) ||
      !Array.isArray(saved.positions) ||
      saved.positions.length !== 9 ||
      saved.positions.some((position, index) =>
        ["x", "y", "width", "height"].some((key) =>
          !Number.isFinite(position?.[key]) ||
          Math.abs(position[key] - expected.positions[index][key]) > 0.01,
        ),
      )
    )
      throw new Error(`The saved ${side} print template has incorrect identity or card geometry.`);
    if (templates.version === CUTTER_LAYOUT_V3)
      validateBackground(saved.background, side);
    else if (saved.background !== undefined)
      throw new Error("Legacy print templates cannot contain a background.");
  }
  const reference = (saved) => ({
    fileKey: saved.fileKey,
    nodeId: saved.nodeId,
    name: saved.name,
    width: saved.width,
    height: saved.height,
    positions: structuredClone(saved.positions),
    ...(saved.background ? { background: { ...saved.background } } : {}),
  });
  return {
    layout: {
      ...structuredClone(LEGACY_PRINT_LAYOUT),
      ...reference(templates.fronts),
      version: templates.version,
    },
    backTemplate: reference(templates.backs),
  };
}

export function validateOrderRequest(request) {
  if (
    !request ||
    typeof request.orderId !== "string" ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(request.orderId)
  )
    throw new Error("A safe, nonempty orderId is required.");
  if (
    typeof request.orderNumber !== "string" ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(request.orderNumber)
  )
    throw new Error("A safe orderNumber is required.");
  if (
    !Array.isArray(request.items) ||
    !request.items.length ||
    request.items.length > 100
  )
    throw new Error("At least one order item is required.");
  const items = new Map();
  for (const item of request.items) {
    if (
      !Object.hasOwn(PRODUCTS, item.productId) &&
      !Object.hasOwn(FIXED_PRODUCTS, item.productId)
    )
      throw new Error(
        `No manufacturing recipe for ${item.productId}. The entire order is held.`,
      );
    if (
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 100
    )
      throw new Error("Item quantity must be between 1 and 100.");
    items.set(item.productId, (items.get(item.productId) ?? 0) + item.quantity);
  }
  const normalized = [...items]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([productId, quantity]) => ({ productId, quantity }));
  if (normalized.reduce((sum, item) => sum + item.quantity, 0) > 100)
    throw new Error("At most 100 packs per production manifest.");
  return {
    orderId: request.orderId,
    orderNumber: request.orderNumber,
    items: normalized,
  };
}

export function createManufacturingManifest({
  request,
  catalog,
  artworkRelease,
  printTemplates,
  policy = BOOSTER_POLICY,
  randomIndex,
  now = new Date().toISOString(),
  inventoryPlan,
  jobKind = "order",
}) {
  const order = validateOrderRequest(request);
  const { layout, backTemplate } = resolvePrintTemplates(printTemplates);
  if (!["order", "stock"].includes(jobKind))
    throw new Error("Unknown job kind.");
  const productionItems = productionItemsForPlan(order.items, inventoryPlan);
  if (jobKind === "stock" && inventoryPlan)
    throw new Error("Stock builds cannot consume finished stock.");
  if (
    typeof artworkRelease !== "string" ||
    !/^[A-Za-z0-9._-]{1,100}$/.test(artworkRelease)
  )
    throw new Error("An explicit artwork release is required.");
  for (const item of productionItems.filter((item) => PRODUCTS[item.productId]))
    validateBoosterPool(catalog, PRODUCTS[item.productId], policy);
  const packs = [];
  for (const item of productionItems) {
    if (!PRODUCTS[item.productId]) continue;
    for (let index = 0; index < item.quantity; index++) {
      const packId = `${order.orderNumber}-${String(packs.length + 1).padStart(3, "0")}`;
      packs.push(
        generateBooster({
          catalog,
          set: PRODUCTS[item.productId],
          packId,
          policy,
          randomIndex,
        }),
      );
    }
  }
  const sheets = packs.map((pack) => ({
    sheetId: pack.packId,
    packId: pack.packId,
    set: normalizeBoosterSet(pack.set),
    fronts: {
      printerRole: "fronts",
      printerName: PRINTER_ROUTES.fronts,
      side: "fronts",
      copies: 1,
      paper: "thin-photo-paper",
      assetIds: pack.cards.map((card) => card.printingId),
    },
    backs: {
      printerRole: "backs",
      printerName: PRINTER_ROUTES.backs,
      side: "backs",
      copies: 1,
      paper: "separate-backing-sheet",
      assetId: "standard-back-sheet",
      template: structuredClone(backTemplate),
    },
    slots: pack.cards.map((card) => ({
      printingId: card.printingId,
      slot: card.slot,
      ...layout.positions[card.slot - 1],
    })),
  }));
  const accessoryChecklist = [];
  for (const item of productionItems.filter(
    (item) => FIXED_PRODUCTS[item.productId],
  )) {
    for (let unit = 1; unit <= item.quantity; unit++) {
      for (const [index, assetId] of fixedSheetAssets(
        item.productId,
      ).entries()) {
        sheets.push({
          sheetId: `${order.orderNumber}-${item.productId}-${unit}-${index + 1}`,
          productId: item.productId,
          unit,
          fronts: {
            printerRole: "fronts",
            printerName: PRINTER_ROUTES.fronts,
            copies: 1,
            paper: "thin-photo-paper",
            assetId,
          },
          backs: {
            printerRole: "backs",
            printerName: PRINTER_ROUTES.backs,
            copies: 1,
            paper: "separate-backing-sheet",
            assetId: "standard-back-sheet",
            template: structuredClone(backTemplate),
          },
          slots: [],
        });
      }
    }
    for (const accessory of FIXED_PRODUCTS[item.productId].accessories)
      accessoryChecklist.push({
        ...accessory,
        id: `${item.productId}-${accessory.id}`,
        quantity: accessory.quantity * item.quantity,
      });
  }
  if (sheets.length > 500)
    throw new Error(
      "This order exceeds the 500-sheet production limit. Review it manually.",
    );
  const body = {
    schemaVersion: 1,
    ...(inventoryPlan ? { inventoryPlan } : {}),
    ...(jobKind === "stock" ? { jobKind } : {}),
    createdAt: now,
    requestHash: contentHash(order),
    order,
    catalogHash: contentHash(catalog),
    artworkRelease,
    policy: { ...policy },
    layout,
    assembly: "separate-sheets-glued-together",
    physicalPrintVerified: false,
    packs,
    sheets,
    accessoryChecklist,
    workTicket: { printerRole: "ticket", printerName: PRINTER_ROUTES.backs },
    holoChecklist: packs.flatMap((pack) =>
      pack.cards
        .filter((card) => card.requiresHoloSticker)
        .map((card) => ({
          id: `${pack.packId}:${card.slot}`,
          packId: pack.packId,
          sheetId: pack.packId,
          printingId: card.printingId,
          name: card.name,
          slot: card.slot,
          row: card.row,
          column: card.column,
          instruction: "Manually apply the holo sticker and confirm.",
        })),
    ),
  };
  return { ...body, manifestHash: contentHash(body) };
}

export function productionItemsForPlan(items, plan) {
  if (plan == null) return items;
  if (!Array.isArray(plan) || plan.length !== items.length)
    throw new Error("The finished-stock allocation does not match this order.");
  const seen = new Set();
  for (const entry of plan) {
    const item = items.find((i) => i.productId === entry.productId);
    if (
      !item ||
      seen.has(entry.productId) ||
      entry.quantity !== item.quantity ||
      !Number.isSafeInteger(entry.fromStock) ||
      entry.fromStock < 0 ||
      !Number.isSafeInteger(entry.toMake) ||
      entry.toMake < 0 ||
      entry.fromStock + entry.toMake !== item.quantity
    )
      throw new Error("Invalid finished-stock allocation.");
    seen.add(entry.productId);
  }
  return items
    .map((item) => ({
      ...item,
      quantity: plan.find((p) => p.productId === item.productId).toMake,
    }))
    .filter((item) => item.quantity > 0);
}

export function verifyManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 1)
    throw new Error("Unsupported manufacturing manifest.");
  const { manifestHash, ...body } = manifest;
  if (!manifestHash || contentHash(body) !== manifestHash)
    throw new Error(
      "Manufacturing manifest has changed. Use its original saved copy.",
    );
  if (
    manifest.requestHash !== contentHash(validateOrderRequest(manifest.order))
  )
    throw new Error("Manifest order does not match its request hash.");
  return manifest;
}

export function assertRequestMatchesManifest(request, manifest) {
  verifyManifest(manifest);
  if (contentHash(validateOrderRequest(request)) !== manifest.requestHash)
    throw new Error(
      "This order already has different saved contents. Do not reroll it.",
    );
  return manifest;
}

// Refuse incomplete releases before rendering/submission. Do not filter missing
// artwork out of the random pool or substitute public previews.
export function preflightPrintAssets(manifest, release) {
  verifyManifest(manifest);
  if (release?.releaseId !== manifest.artworkRelease)
    throw new Error("Artwork release does not match the saved manifest.");
  const required = new Set(
    manifest.sheets.flatMap((sheet) => [
      ...(sheet.fronts.assetIds ?? [sheet.fronts.assetId]),
      sheet.backs.assetId,
    ]),
  );
  const errors = [];
  if (manifest.layout.version === CUTTER_LAYOUT_V3) {
    try {
      const templates = resolvePrintTemplates(release.printTemplates);
      if (templates.layout.version !== CUTTER_LAYOUT_V3)
        throw new Error("The saved background layout requires its matching versioned release templates.");
      validateBackground(manifest.layout.background, "fronts");
      for (const sheet of manifest.sheets)
        validateBackground(sheet.backs.template?.background, "backs");
    } catch (error) {
      errors.push(error.message);
    }
    if (manifest.sheets.length)
      for (const background of Object.values(PRINT_BACKGROUNDS))
        required.add(background.assetId);
  } else if (
    manifest.layout.background !== undefined ||
    manifest.sheets.some((sheet) => sheet.backs.template?.background !== undefined)
  ) {
    errors.push("Legacy print manifests cannot contain a background.");
  }
  for (const id of required) {
    const asset = release.assets?.[id];
    const side = backgroundSide(id);
    if (side) {
      try {
        validateBackgroundAsset(asset, side);
      } catch (error) {
        errors.push(error.message);
      }
      continue;
    }
    if (!asset?.path || !/^[a-f0-9]{64}$/.test(asset.sha256 ?? ""))
      errors.push(`${id}: missing private asset or checksum`);
    else if (
      id === "standard-back-sheet" || id.startsWith("sheet-")
        ? asset.width !== 2550 || asset.height !== 3300
        : asset.width < 720 ||
          asset.height < 1008 ||
          Math.abs(asset.width / asset.height - 5 / 7) > 0.003
    )
      errors.push(`${id}: incorrect dimensions or insufficient resolution`);
    if (
      isCutterLayout(manifest.layout.version) &&
      id.startsWith("sheet-") &&
      !validFixedSheetPositions(asset?.positions, id)
    ) errors.push(`${id}: valid source card positions are required for the cutting template`);
  }
  return {
    ready: errors.length === 0,
    errors,
    requiredAssetIds: [...required],
  };
}
