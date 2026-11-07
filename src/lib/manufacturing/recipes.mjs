// Full Letter frames read from the production Figma file on 2026-10-05.
// These preserve the existing deck order and reference inserts.
export const DECK_FRAMES = {
  "coral-garden": [
    "4316:271759",
    "4316:271767",
    "4316:271774",
    "4316:271781",
    "4316:271788",
    "4316:271795",
    "4316:271802",
  ],
  "blue-water": [
    "2224:257783",
    "2224:312429",
    "2224:312942",
    "2224:312944",
    "2224:312946",
    "2224:312948",
    "2224:312950",
  ],
  "darkness-shroud": [
    "2298:446032",
    "2298:446827",
    "2298:449309",
    "2298:449311",
    "2298:449313",
    "2298:449315",
    "2298:449317",
  ],
  "open-ocean-hunt": [
    "2296:82569",
    "2296:82830",
    "2296:82832",
    "2296:82834",
    "2296:82836",
    "2296:82838",
    "2296:82840",
  ],
  "murky-water": [
    "2241:428141",
    "2241:430736",
    "2241:440007",
    "2241:450735",
    "2241:465888",
    "2241:481901",
    "2241:485700",
  ],
  "stinging-fortress": [
    "2363:239642",
    "2363:245048",
    "2363:249823",
    "2363:254617",
    "2363:259411",
    "2363:264205",
    "2363:268999",
  ],
  disruption: [
    "2404:529168",
    "2404:533963",
    "2404:533965",
    "2404:533967",
    "2404:533969",
    "2404:533971",
    "2404:533973",
  ],
};
// Coral Garden moved to the owner's nested cutter-layout sheets on October 28.
// Export only the named card grid so the source page's water and marks stay in Figma.
export const CORAL_GRID_FRAMES = ["4316:271763","4316:271771","4316:271778","4316:271785","4316:271792","4316:271799","4316:271806"];
// The current Conditions originals supply artwork; the reviewed output profile
// preserves the calibrated inset positions after the old cutter copies were removed.
export const CONDITION_FRAMES = ["2366:320222", "2366:320233"];
export const CONDITION_GRID_FRAMES = ["2366:320223", "2366:320234"];
export const LEGACY_CONDITION_SOURCES = Object.freeze([
  Object.freeze({ id: "sheet-conditions-1", kind: "sheet", nodeId: "4335:335039", exportNodeId: "4335:335041", preserveSourcePositions: true }),
  Object.freeze({ id: "sheet-conditions-2", kind: "sheet", nodeId: "4335:335350", exportNodeId: "4335:335352", preserveSourcePositions: true }),
]);
export const BOOSTER_PRODUCTS = Object.freeze({
  "reef-dive-pack": "reef",
  "deep-dive-pack": "deep",
  "oceanic-dive-pack": "ocean",
});
export const FIXED_PRODUCTS = {
  ...Object.fromEntries(
    Object.keys(DECK_FRAMES).map((id) => [
      id,
      { decks: [id], conditions: false, accessories: [] },
    ]),
  ),
  "starter-kit": {
    decks: ["coral-garden", "blue-water"],
    conditions: true,
    accessories: [
      {
        id: "dice",
        name: "7 dice: D4, D6, D8, D10, D12, D20, D100",
        quantity: 7,
      },
      { id: "tokens", name: "Reef Point tokens", quantity: 15 },
    ],
  },
  "accessory-set": {
    decks: [],
    conditions: true,
    accessories: [
      {
        id: "dice",
        name: "7 dice: D4, D6, D8, D10, D12, D20, D100",
        quantity: 7,
      },
      { id: "tokens", name: "Reef Point tokens", quantity: 15 },
    ],
  },
  "conditions-deck": { decks: [], conditions: true, accessories: [] },
  "dice-pack": {
    decks: [],
    conditions: false,
    accessories: [
      {
        id: "dice",
        name: "7 dice: D4, D6, D8, D10, D12, D20, D100",
        quantity: 7,
      },
    ],
  },
  "reef-point-tokens": {
    decks: [],
    conditions: false,
    accessories: [{ id: "tokens", name: "Reef Point tokens", quantity: 15 }],
  },
};
// These are full native Letter pages, not nine-card cutter sheets. Capability
// is pinned to each artwork release so older manifests retain their old recipe.
export const FLYER_RECIPE_VERSION = "starter-kit-flyers-v1";
export const FLYER_SOURCES = Object.freeze([
  Object.freeze({ id: "flyer-how-to-play", nodeId: "4556:17027", kind: "flyer", name: "How to play flyer", width: 2550, height: 3300 }),
  Object.freeze({ id: "flyer-store-promo", nodeId: "4561:85207", kind: "flyer", name: "Store promo flyer", width: 2550, height: 3300 }),
]);
export const isFlyerAsset = (assetId) => FLYER_SOURCES.some(source => source.id === assetId);
export const flyerDisplayLabel = (assetId) => FLYER_SOURCES.find(source => source.id === assetId)?.name ?? assetId;
export function validateFlyerVersion(version) {
  if (version !== undefined && version !== FLYER_RECIPE_VERSION)
    throw new Error("Unsupported Starter Kit flyer recipe.");
  return version === FLYER_RECIPE_VERSION;
}
export function productFlyerAssets(productId, version) {
  return validateFlyerVersion(version) && productId === "starter-kit" ? FLYER_SOURCES.map(source => source.id) : [];
}
export function productPrintAssets(productId, version) {
  return [...fixedSheetAssets(productId), ...productFlyerAssets(productId, version)];
}

export function fixedSheetAssets(productId) {
  const recipe = FIXED_PRODUCTS[productId];
  if (!recipe) return [];
  return [
    ...recipe.decks.flatMap((id) =>
      DECK_FRAMES[id].map((_, index) => `sheet-${id}-${index + 1}`),
    ),
    ...(recipe.conditions
      ? CONDITION_FRAMES.map((_, index) => `sheet-conditions-${index + 1}`)
      : []),
  ];
}
// Display names follow the current product name; saved manifests and private
// asset keys retain their original identity for reproducible reprints.
export function fixedSheetLabel(assetId) {
  if (isFlyerAsset(assetId)) return flyerDisplayLabel(assetId);
  const dropOff = /^sheet-blue-water-([1-7])$/.exec(assetId);
  return dropOff ? `sheets-drop-off-${dropOff[1]}` : assetId;
}
// Audited leaf rectangles added to the otherwise empty final slot on November 4.
// These exact page/node identities may be omitted only while they remain plain white.
export const EMPTY_FIXED_SHEET_RECTANGLES = Object.freeze({
  "sheet-coral-garden-7": Object.freeze(["4499:508122"]),
  "sheet-murky-water-7": Object.freeze(["4500:191319"]),
  "sheet-stinging-fortress-7": Object.freeze(["4500:301116"]),
});
// Historic childless frames retain their existing, separately validated rules.
const EMPTY_FIXED_SHEET_FRAMES = {
  "sheet-darkness-shroud-1": ["2893:234348"],
  "sheet-open-ocean-hunt-1": ["2779:45793"],
  ...EMPTY_FIXED_SHEET_RECTANGLES,
};
export function fixedArtworkSources() {
  return [
    ...Object.entries(DECK_FRAMES).flatMap(([id, nodes]) =>
      nodes.map((nodeId, index) => ({
        id: `sheet-${id}-${index + 1}`,
        nodeId,
        kind: "sheet",
        ...(EMPTY_FIXED_SHEET_FRAMES[`sheet-${id}-${index + 1}`] ?
          { omittedNodeIds: [...EMPTY_FIXED_SHEET_FRAMES[`sheet-${id}-${index + 1}`]] } : {}),
        ...(id === "coral-garden" ? { exportNodeId: CORAL_GRID_FRAMES[index] } : {}),
        ...(id === "blue-water" ? { displayName: `sheets-drop-off-${index + 1}` } : {}),
      })),
    ),
    ...CONDITION_FRAMES.map((nodeId, index) => ({
      id: `sheet-conditions-${index + 1}`,
      nodeId,
      kind: "sheet",
      exportNodeId: CONDITION_GRID_FRAMES[index],
      outputProfile: "conditions-original-grid-v1",
    })),
  ];
}
