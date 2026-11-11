import { CUTTER_LAYOUT_V9 } from './backdrops.mjs';
import { placeSheetMarginText, stockSheetLabel } from './stockSheetLabel.mjs';

const deckNames = Object.freeze({
  'coral-garden': 'Coral Garden', 'blue-water': 'Drop Off', conditions: 'Conditions',
  'darkness-shroud': 'Darkness Shroud', 'open-ocean-hunt': 'Open Ocean',
  'murky-water': 'Murky Water', 'stinging-fortress': 'Stinging Fortress', disruption: 'Disruption',
});
const setNames = Object.freeze({ reef: 'Reef', deep: 'Deep', ocean: 'Oceanic', oceanic: 'Oceanic' });

// Read identities from saved sheets, not current product recipes or fresh draws.
// Fixed-page numbering belongs to the component deck even inside a Starter Kit.
export function sheetIdentityText(manifest, sheetId) {
  const sheet = manifest?.sheets?.find(item => item.sheetId === sheetId);
  if (!sheet || sheet.kind === 'flyer') return null;
  if (manifest.kind === 'holo-replenishment') {
    const items = new Map((manifest.items ?? []).map(item => [item.printingId, item]));
    const sets = [...new Set((sheet.slots ?? []).map(slot => setNames[items.get(slot.printingId)?.set]))];
    if (!sets.length || sets.some(name => !name)) return null;
    return `${sets.join(' + ')} holos | Page ${manifest.sheets.indexOf(sheet) + 1} of ${manifest.sheets.length}`;
  }
  const fixed = /^sheet-(.+)-(\d+)$/.exec(sheet.fronts?.assetId ?? '');
  if (fixed && deckNames[fixed[1]]) {
    const page = Number(fixed[2]);
    // The saved component's highest page preserves its historical length, even
    // if a later recipe changes.
    const componentPages = manifest.sheets.map(item => /^sheet-(.+)-(\d+)$/.exec(item.fronts?.assetId ?? ''))
      .filter(match => match?.[1] === fixed[1]).map(match => Number(match[2]));
    const total = Math.max(...componentPages);
    if (!Number.isSafeInteger(page) || page < 1 || page > total) return null;
    const copies = manifest.sheets.filter(item => item.productId === sheet.productId)
      .map(item => item.unit).filter(Number.isSafeInteger);
    const copy = copies.some(unit => unit > 1) && Number.isSafeInteger(sheet.unit) ? ` | Copy ${sheet.unit}` : '';
    return `${deckNames[fixed[1]]} | Page ${page} of ${total}${copy}`;
  }
  if (!sheet.fronts?.assetId && setNames[sheet.set]) {
    const peers = manifest.sheets.filter(item => !item.fronts?.assetId && setNames[item.set] === setNames[sheet.set]);
    return `${setNames[sheet.set]} Dive Pack | Page ${peers.indexOf(sheet) + 1} of ${peers.length}`;
  }
  return null;
}

/** Native 300-DPI margin text shared by saved PDF rendering and browser preview. */
export function sheetMarginLabels(manifest, release, sheetId, side) {
  const identity = sheetIdentityText(manifest, sheetId);
  const stock = stockSheetLabel(manifest, release, sheetId, side);
  if (!identity) return stock ? [{ ...stock, kind: 'stock' }] : [];
  const entries = [
    ...(stock ? [{ kind: 'stock', text: stock.text, fontSize: 36 }] : []),
    { kind: 'identity', text: identity, fontSize: stock ? 32 : 36 },
  ];
  // V9's source was reviewed with staple marks at y468..699 and y2646..2877.
  // Only this version may use the larger middle band. Earlier saved templates
  // keep their previously audited band and stock number if both labels won't fit.
  const options = manifest.layout?.version === CUTTER_LAYOUT_V9
    ? { bandTop: 800, bandBottom: 2500, gap: 40 } : undefined;
  const labels = placeSheetMarginText(manifest, release, sheetId, side, entries, options);
  if (labels.length) return labels;
  return stock ? [{ ...stock, kind: 'stock' }] : [];
}
