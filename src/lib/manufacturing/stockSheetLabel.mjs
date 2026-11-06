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

/**
 * First stock sheet only; no changes to manifests or card geometry. Coordinates
 * are native 300-DPI pixels with top-left origin. x/y locate the alphabetic text
 * baseline; rotation is clockwise-positive, matching Canvas. Courier's advance
 * is exactly 0.6 em per character. The bounds conservatively reserve a full em.
 */
export function stockSheetLabel(manifest, release, sheetId, side) {
  if (manifest?.jobKind !== 'stock' || !['fronts', 'backs'].includes(side) ||
      !isCutterLayout(manifest.layout?.version) || manifest.sheets?.[0]?.sheetId !== sheetId)
    return null;
  const text = manifest.order?.orderNumber;
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(text)) return null;
  const sheet = manifest.sheets[0], layout = manifest.layout;
  if (layout.width !== PAGE_WIDTH || layout.height !== PAGE_HEIGHT) return null;
  const template = side === 'fronts' ? layout : sheet.backs?.template;
  // Old layouts with no saved grid cannot prove that the template marks leave
  // this margin free. Do not invent an offset for those historical pages.
  const grid = side === 'fronts' ? layout.grid : release?.printTemplates?.backs?.grid;
  if (!insidePage(grid) || (grid.rotation ?? 0) !== 0) return null;
  let positions;
  if (side === 'fronts' && sheet.fronts?.assetId) {
    const asset = release?.assets?.[sheet.fronts.assetId];
    if (!asset) return null;
    try { positions = fixedSheetOutputPositions(asset, layout) ?? layout.positions; }
    catch { return null; }
  } else if (side === 'fronts') {
    positions = sheet.slots?.map(slot => ({ ...slot,
      width: slot.width ?? layout.cardWidth, height: slot.height ?? layout.cardHeight }));
  } else positions = template?.positions;
  if (!Array.isArray(positions) || !positions.length) return null;
  const cards = positions.map(transformedBounds);
  if (cards.some(rect => !insidePage(rect))) return null;
  const protectedBounds = [grid, ...cards];
  const left = Math.min(...protectedBounds.map(rect => rect.x));
  const right = Math.max(...protectedBounds.map(rect => rect.x + rect.width));
  const margins = [
    { margin: 'left', start: EDGE_INSET, end: left - CLEARANCE },
    { margin: 'right', start: right + CLEARANCE, end: PAGE_WIDTH - EDGE_INSET },
  ].sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const textWidth = text.length * FONT_SIZE * 0.6;
  if (textWidth > BAND_BOTTOM - BAND_TOP) return null;
  for (const margin of margins) {
    if (margin.end - margin.start < FONT_SIZE) continue;
    const bounds = { x: (margin.start + margin.end - FONT_SIZE) / 2,
      y: (BAND_TOP + BAND_BOTTOM - textWidth) / 2, width: FONT_SIZE, height: textWidth };
    if (!insidePage(bounds) || protectedBounds.some(rect => overlaps(bounds, rect))) continue;
    return { text, font: 'Courier-Bold', fontSize: FONT_SIZE, rotation: -90,
      x: bounds.x + FONT_SIZE * 0.8, y: bounds.y + textWidth,
      bounds, margin: margin.margin };
  }
  return null;
}
