export const CUTTER_LAYOUT_V2 = "figma-cutter-nine-up-v2";
export const CUTTER_LAYOUT_V3 = "figma-cutter-nine-up-v3";
export const CUTTER_LAYOUT_V4 = "figma-cutter-nine-up-v4";
export const CUTTER_LAYOUT_V5 = "figma-cutter-nine-up-v5";
export const CUTTER_LAYOUT_V6 = "figma-cutter-nine-up-v6";

// Only these two backdrop layers are printable. Their parent frames also
// contain alignment guides and numbered placeholders, which must stay out.
export const PRINT_BACKGROUNDS_V3 = Object.freeze({
  fronts: Object.freeze({
    assetId: "print-template-front-background",
    nodeId: "4116:234587",
    x: 36,
    y: 20,
    width: 2467,
    height: 3240,
  }),
  backs: Object.freeze({
    assetId: "print-template-back-background",
    nodeId: "4116:234589",
    x: 36,
    y: 20,
    width: 2467,
    height: 3240,
  }),
});

// October 19 printer tuning is a separate immutable layout. The Canon source
// now includes its water and logos as one native Letter-page PNG.
export const PRINT_BACKGROUNDS_V4 = Object.freeze({
  fronts: Object.freeze({
    assetId: "print-template-front-background",
    nodeId: "4116:234587",
    x: 82.17547827214003,
    y: 19.641708374023438,
    width: 2438.649044044316,
    height: 3238.7165909940377,
    assetWidth: 2439,
    assetHeight: 3239,
  }),
  backs: Object.freeze({
    assetId: "standard-back-sheet",
    nodeId: "4244:451219",
    x: 0,
    y: 0,
    width: 2550,
    height: 3300,
  }),
});

// October 26 uses separate calibrated templates for ordinary cards and holo
// replenishment. Fronts export only the page backdrop; rears export their whole
// page so its saved water and logo placement are reproduced exactly.
export const PRINT_BACKGROUNDS_V5 = Object.freeze({
  fronts: Object.freeze({
    assetId: "print-template-front-background",
    nodeId: "4317:7887",
    x: 0, y: 0, width: 2550, height: 3300,
  }),
  backs: Object.freeze({
    assetId: "standard-back-sheet",
    nodeId: "4244:451219",
    x: 0, y: 0, width: 2550, height: 3300,
  }),
  holoFronts: Object.freeze({
    assetId: "print-template-holo-front-background",
    nodeId: "4317:8435",
    x: 0, y: 0, width: 2550, height: 3300,
  }),
  holoBacks: Object.freeze({
    assetId: "holographic-back-sheet",
    nodeId: "4311:139076",
    x: 0, y: 0, width: 2550, height: 3300,
  }),
});

export const PRINT_BACKGROUNDS = PRINT_BACKGROUNDS_V5;
const NO_BACKGROUNDS = Object.freeze({});
export const backgroundsForLayout = (version) =>
  [CUTTER_LAYOUT_V5, CUTTER_LAYOUT_V6].includes(version) ? PRINT_BACKGROUNDS_V5
    : version === CUTTER_LAYOUT_V4 ? PRINT_BACKGROUNDS_V4
      : version === CUTTER_LAYOUT_V3 ? PRINT_BACKGROUNDS_V3 : NO_BACKGROUNDS;
export const hasPrintBackgrounds = (version) =>
  version === CUTTER_LAYOUT_V3 || version === CUTTER_LAYOUT_V4 || version === CUTTER_LAYOUT_V5 || version === CUTTER_LAYOUT_V6;

export const isCutterLayout = (version) =>
  version === CUTTER_LAYOUT_V2 || hasPrintBackgrounds(version);

// standard-back-sheet was ordinary card-back artwork in V2/V3. It becomes a
// page backdrop only when its matching V4/V5/V6 layout explicitly selects it.
const RESERVED_BACKGROUNDS = Object.freeze([
  ...Object.entries(PRINT_BACKGROUNDS_V3),
  ...Object.entries(PRINT_BACKGROUNDS_V5).filter(([, background]) =>
    background.assetId !== "standard-back-sheet"),
]);
export function backgroundSide(assetId, version = CUTTER_LAYOUT_V3) {
  const backgrounds = backgroundsForLayout(version);
  return Object.keys(backgrounds).find((side) => backgrounds[side].assetId === assetId)
    // Recognize every reserved backdrop ID even without its matching layout,
    // so orphaned or mixed-version background assets cannot pass as cards.
    ?? RESERVED_BACKGROUNDS.find(([, background]) => background.assetId === assetId)?.[0];
}

export function validateBackground(reference, side, version = CUTTER_LAYOUT_V3) {
  const expected = backgroundsForLayout(version)[side];
  if (
    !expected ||
    !reference ||
    Object.entries(expected).some(([key, value]) => reference[key] !== value)
  )
    throw new Error(`The ${side} background must use its saved backdrop layer and page bounds.`);
  return reference;
}

export function validateBackgroundAsset(asset, side, version = CUTTER_LAYOUT_V3) {
  const expected = backgroundsForLayout(version)[side];
  if (
    !expected ||
    !asset ||
    asset.nodeId !== expected.nodeId ||
    asset.width !== (expected.assetWidth ?? expected.width) ||
    asset.height !== (expected.assetHeight ?? expected.height) ||
    !/^[a-f0-9]{64}$/.test(asset.sha256 ?? "") ||
    asset.path !== `manufacturing/sha256/${asset.sha256}.png`
  )
    throw new Error(`The ${side} background is missing or has incorrect private source, dimensions, or checksum.`);
  return asset;
}
