import { preflightPrintAssets } from './printPlan.mjs';
import { fixedSheetAssets } from './recipes.mjs';
import { fixedSheetOutputPositions } from './sourceGeometry.mjs';
import { stockSheetLabel } from './stockSheetLabel.mjs';
import { CUTTER_LAYOUT_V2, CUTTER_LAYOUT_V3, hasPrintBackgrounds, isCutterLayout } from './backdrops.mjs';

// This describes saved page composition, never a new draw or print request.
// Asset bytes are served separately behind staff authentication for this sheet.
export function buildPagePreview(manifest, release, sheetId, side) {
  if (!['fronts', 'backs'].includes(side)) throw new Error('Choose a front or back page.');
  const check = preflightPrintAssets(manifest, release);
  if (!check.ready) throw new Error('The saved page artwork is unavailable.');
  const sheet = manifest.sheets.find(item => item.sheetId === sheetId);
  if (!sheet || !sheet.fronts?.assetId || fixedSheetAssets(sheet.productId).length < 2)
    throw new Error('Choose a saved page from a multi-page product.');
  if (!isCutterLayout(manifest.layout.version))
    throw new Error('This older print layout does not support page previews. Open its workshop job to reprint it.');
  const layers = [], version = manifest.layout.version;
  const add = (assetId, position, crop) => layers.push({ assetId,
    position: { x: position.x, y: position.y, width: position.width, height: position.height, rotation: position.rotation ?? 0 },
    ...(crop ? { crop } : {}) });
  if (hasPrintBackgrounds(version)) {
    const background = side === 'fronts' ? manifest.layout.background : sheet.backs.template.background;
    add(background.assetId, background);
  }
  if (side === 'fronts') {
    const asset = release.assets[sheet.fronts.assetId];
    const sources = asset.positions.toSorted((a, b) => Math.abs(a.y - b.y) < 1 ? a.x - b.x : a.y - b.y);
    const positions = fixedSheetOutputPositions(asset, manifest.layout) ?? manifest.layout.positions;
    for (const [index, source] of sources.entries()) {
      const x = Math.round(source.x), y = Math.round(source.y);
      add(sheet.fronts.assetId, positions[index], {
        x, y, width: Math.round(source.x + source.width) - x,
        height: Math.round(source.y + source.height) - y,
      });
    }
  } else if ([CUTTER_LAYOUT_V2, CUTTER_LAYOUT_V3].includes(version)) {
    for (const position of sheet.backs.template.positions)
      add(sheet.backs.assetId, position, { x: 150, y: 75, width: 750, height: 1050 });
  }
  const requiredAssetIds = [...new Set(layers.map(layer => layer.assetId))];
  if (!layers.length) throw new Error('The saved page has no printable artwork.');
  for (const layer of layers) {
    const asset = release.assets[layer.assetId], p = layer.position, crop = layer.crop;
    if (!asset || ![p.x, p.y, p.width, p.height, p.rotation].every(Number.isFinite) || p.width <= 0 || p.height <= 0 ||
        (crop && (![crop.x, crop.y, crop.width, crop.height].every(Number.isSafeInteger) || crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > asset.width || crop.y + crop.height > asset.height)))
      throw new Error('The saved page has invalid image placement.');
  }
  return { sheetId, side, releaseId: release.releaseId, templateVersion: version,
    width: 2550, height: 3300, requiredAssetIds,
    assets: Object.fromEntries(requiredAssetIds.map(id => [id, {
      sha256: release.assets[id].sha256, width: release.assets[id].width, height: release.assets[id].height,
    }])), layers, stockLabel: stockSheetLabel(manifest, release, sheetId, side) };
}
