// Full Letter frames read from the production Figma file on 2026-10-05.
// These preserve the existing deck order and reference inserts.
export const DECK_FRAMES = {
  "coral-garden": [
    "2311:519240",
    "2311:519501",
    "2311:519503",
    "2311:519505",
    "2311:519507",
    "2311:519509",
    "2311:519511",
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
export const CONDITION_FRAMES = ["2366:320222", "2366:320233"];
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
export function fixedArtworkSources() {
  return [
    ...Object.entries(DECK_FRAMES).flatMap(([id, nodes]) =>
      nodes.map((nodeId, index) => ({
        id: `sheet-${id}-${index + 1}`,
        nodeId,
        kind: "sheet",
      })),
    ),
    ...CONDITION_FRAMES.map((nodeId, index) => ({
      id: `sheet-conditions-${index + 1}`,
      nodeId,
      kind: "sheet",
    })),
  ];
}
