import { isCutterLayout } from './backdrops.mjs';
import { fixedSheetOutputPositions } from './sourceGeometry.mjs';

const PAGE_WIDTH = 2550, PAGE_HEIGHT = 3300;
const EDGE_INSET = 64, CLEARANCE = 16, FONT_SIZE = 36;
const BAND_TOP = 1100, BAND_BOTTOM = 2200;
const finiteRect = (rect) => rect && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(rect[key])) &&
  rect.width > 0 && rect.height > 0;
const insidePage = rect => finiteRect(rect) && rect.x >= 0 && rect.y >= 0 &&
  rect.x + rect.width <= PAGE_WIDTH && rect.y + rect.height <= PAGE_HEIGHT;

// Match Figma/Canvas clockwise rotation around the unrotated top-left origin.
function transformedBounds(rect) {
  if (!finiteRect(rect) || !Number.isFinite(rect.rotation ?? 0)) return null;
  const angle = (rect.rotation ?? 0) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const points = [[0, 0], [rect.width, 0], [0, rect.height], [rect.width, rect.height]]
    .map(([x, y]) => ({ x: rect.x + x * cos - y * sin, y: rect.y + x * sin + y * cos }));
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  return { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y };
}
const overlaps = (a, b) => a.x < b.x + b.width + CLEARANCE && a.x + a.width + CLEARANCE > b.x &&
  a.y < b.y + b.height + CLEARANCE && a.y + a.height + CLEARANCE > b.y;

// A caller may request several consecutive vertical labels in one verified
// margin. Text never changes page count, image placement, or saved job contents.
export function placeSheetMarginText(manifest, release, sheetId, side, entries,
  { bandTop = BAND_TOP, bandBottom = BAND_BOTTOM, gap = 40 } = {}) {
  if (!['fronts', 'backs'].includes(side) || !isCutterLayout(manifest?.layout?.version)) return [];
  const sheet = manifest.sheets?.find(item => item.sheetId === sheetId), layout = manifest.layout;
  if (!sheet || sheet.kind === 'flyer' || !Array.isArray(entries) || !entries.length ||
      !Number.isFinite(bandTop) || !Number.isFinite(bandBottom) || !Number.isFinite(gap) || gap < 0 ||
      bandTop < 0 || bandBottom > PAGE_HEIGHT || bandTop >= bandBottom ||
      entries.some(entry => typeof entry.text !== 'string' || !/^[\x20-\x7e]{1,100}$/.test(entry.text) ||
        !Number.isFinite(entry.fontSize) || entry.fontSize < 30 || entry.fontSize > FONT_SIZE)) return [];
  if (layout.width !== PAGE_WIDTH || layout.height !== PAGE_HEIGHT) return [];
  const template = side === 'fronts' ? layout : sheet.backs?.template ?? manifest.backTemplate;
  // Old layouts with no saved grid cannot prove that the template marks leave
  // this margin free. Do not invent an offset for those historical pages.
  const grid = side === 'fronts' ? layout.grid : manifest.kind === 'holo-replenishment'
    ? (manifest.backTemplate?.grid ?? release?.printTemplates?.holoBacks?.grid ?? release?.printTemplates?.backs?.grid)
    : release?.printTemplates?.backs?.grid;
  if (!insidePage(grid) || (grid.rotation ?? 0) !== 0) return [];
  let positions;
  if (side === 'fronts' && sheet.fronts?.assetId) {
    const asset = release?.assets?.[sheet.fronts.assetId];
    if (!asset) return [];
    try { positions = fixedSheetOutputPositions(asset, layout) ?? layout.positions; }
    catch { return []; }
  } else if (side === 'fronts') {
    positions = sheet.slots?.map(slot => ({ ...slot,
      width: slot.width ?? layout.cardWidth, height: slot.height ?? layout.cardHeight }));
  } else positions = template?.positions;
  if (!Array.isArray(positions) || !positions.length) return [];
  const cards = positions.map(transformedBounds);
  if (cards.some(rect => !insidePage(rect))) return [];
  const protectedBounds = [grid, ...cards];
  const left = Math.min(...protectedBounds.map(rect => rect.x));
  const right = Math.max(...protectedBounds.map(rect => rect.x + rect.width));
  const margins = [
    { margin: 'left', start: EDGE_INSET, end: left - CLEARANCE },
    { margin: 'right', start: right + CLEARANCE, end: PAGE_WIDTH - EDGE_INSET },
  ].sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const totalHeight = entries.reduce((height, entry) => height + entry.text.length * entry.fontSize * 0.6, 0) +
    gap * (entries.length - 1);
  if (totalHeight > bandBottom - bandTop) return [];
  for (const margin of margins) {
    if (entries.some(entry => margin.end - margin.start < entry.fontSize)) continue;
    let y = (bandTop + bandBottom - totalHeight) / 2;
    const labels = entries.map(entry => {
      const height = entry.text.length * entry.fontSize * 0.6;
      const bounds = { x: (margin.start + margin.end - entry.fontSize) / 2,
        y, width: entry.fontSize, height };
      y += height + gap;
      return { ...entry, font: 'Courier-Bold', rotation: -90,
        x: bounds.x + entry.fontSize * 0.8, y: bounds.y + height, bounds, margin: margin.margin };
    });
    if (labels.some(label => !insidePage(label.bounds) || protectedBounds.some(rect => overlaps(label.bounds, rect)))) continue;
    return labels;
  }
  return [];
}

/** First stock sheet only, preserving the full pinned order number. */
export function stockSheetLabel(manifest, release, sheetId, side) {
  if (manifest?.jobKind !== 'stock' || manifest.sheets?.[0]?.sheetId !== sheetId) return null;
  const text = manifest.order?.orderNumber;
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(text)) return null;
  return placeSheetMarginText(manifest, release, sheetId, side, [{ text, fontSize: FONT_SIZE }])[0] ?? null;
}
