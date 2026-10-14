export const CUTTER_LAYOUT_V2 = "figma-cutter-nine-up-v2";
export const CUTTER_LAYOUT_V3 = "figma-cutter-nine-up-v3";

// Only these two backdrop layers are printable. Their parent frames also
// contain alignment guides and numbered placeholders, which must stay out.
export const PRINT_BACKGROUNDS = Object.freeze({
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

export const isCutterLayout = (version) =>
  version === CUTTER_LAYOUT_V2 || version === CUTTER_LAYOUT_V3;

export function backgroundSide(assetId) {
  return Object.keys(PRINT_BACKGROUNDS).find(
    (side) => PRINT_BACKGROUNDS[side].assetId === assetId,
  );
}

export function validateBackground(reference, side) {
  const expected = PRINT_BACKGROUNDS[side];
  if (
    !expected ||
    !reference ||
    Object.entries(expected).some(([key, value]) => reference[key] !== value)
  )
    throw new Error(`The ${side} background must use its saved backdrop layer and page bounds.`);
  return reference;
}

export function validateBackgroundAsset(asset, side) {
  const expected = PRINT_BACKGROUNDS[side];
  if (
    !expected ||
    !asset ||
    asset.nodeId !== expected.nodeId ||
    asset.width !== expected.width ||
    asset.height !== expected.height ||
    !/^[a-f0-9]{64}$/.test(asset.sha256 ?? "") ||
    asset.path !== `manufacturing/sha256/${asset.sha256}.png`
  )
    throw new Error(`The ${side} background is missing or has incorrect private source, dimensions, or checksum.`);
  return asset;
}
