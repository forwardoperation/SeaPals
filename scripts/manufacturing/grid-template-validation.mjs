import { CUTTER_LAYOUT_V5, CUTTER_LAYOUT_V6 } from "../../src/lib/manufacturing/backdrops.mjs";

// V5/V6/V7 use empty centered front grids and native, complete Canon rear pages.
// Its validation is deliberately separate from V4's rotated guide rectangles.
const visible = (nodes = []) => nodes.filter(node => node.visible !== false);
const close = (a, b, tolerance = 0.01) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
const identity = [[1, 0], [0, 1]];
const sources = {
  '4290:38532': { component: '4317:7886', background: '4317:7887', water: '4317:7876', waterX: 134, v6WaterX: 139, legacyWaterX: 119 },
  '4311:139557': { component: '4317:8434', background: '4317:8435', water: '4317:8422', waterX: 86, v6WaterX: 71, legacyWaterX: 71, holo: true },
  '4244:451219': { rear: true },
  '4311:139076': { rear: true, holo: true, component: '4317:8408', background: '4317:8409' },
};
export const isGridTemplate = template => Boolean(sources[template?.nodeId]) && Boolean(template.grid);
function clean(node, invalid, label, allowStrokes = false) {
  if (!node || node.visible === false || (node.opacity ?? 1) !== 1 || node.isMask === true ||
      !['NORMAL', 'PASS_THROUGH'].includes(node.blendMode ?? 'NORMAL') ||
      visible(node.effects).length || (!allowStrokes && visible(node.strokes).length))
    invalid(`${label} has hidden, translucent, masked, stroked, or effect-altered artwork`);
}
function translation(node, invalid, label, x, y) {
  const matrix = node?.relativeTransform;
  if (!Array.isArray(matrix) || matrix.length !== 2 || matrix.some(row => !Array.isArray(row) || row.length !== 3 || !row.every(Number.isFinite)))
    invalid(`${label} needs native transforms from geometry=paths`);
  if (identity.some((row, i) => row.some((value, j) => !close(matrix[i][j], value, 0.000001))))
    invalid(`${label} cannot be rotated, scaled, mirrored, or sheared`);
  if ((x !== undefined && !close(matrix[0][2], x)) || (y !== undefined && !close(matrix[1][2], y)))
    invalid(`${label} moved from its saved position`);
  return { x: matrix[0][2], y: matrix[1][2] };
}
function whitePaint(paint) {
  return paint?.type === 'SOLID' && (paint.opacity ?? 1) === 1 &&
    (paint.blendMode ?? 'NORMAL') === 'NORMAL' && (paint.color?.a ?? 1) === 1 &&
    ['r', 'g', 'b'].every(key => paint.color?.[key] === 1);
}
function dimensions(node, width, height, invalid, label) {
  if (!close(node.size?.x, width) || !close(node.size?.y, height)) invalid(`${label} has incorrect native dimensions`);
}
function checkBackground(node, saved, invalid) {
  clean(node, invalid, 'background');
  if (node.id !== saved.background || node.type !== 'INSTANCE' || node.componentId !== saved.component || node.clipsContent !== true)
    invalid('the saved full-page background instance is required');
  dimensions(node, 2550, 3300, invalid, 'background');
  translation(node, invalid, 'background', 0, 0);
  if (visible(node.fills).length) invalid('the background instance must not add an opaque covering fill');
  if (!saved.rear) {
    const water = node.children?.find(child => child.id === `I${node.id};${saved.water}`);
    clean(water, invalid, 'ocean background');
    const paints = visible(water.fills);
    if (water.type !== 'RECTANGLE' || paints.length !== 1 || paints[0].type !== 'IMAGE' ||
        (paints[0].opacity ?? 1) !== 1 || (paints[0].blendMode ?? 'NORMAL') !== 'NORMAL')
      invalid('the ocean background must retain its visible image');
    translation(water, invalid, 'ocean background', saved.waterX, 64);
    dimensions(water, 2337, 3182, invalid, 'ocean background');
  }
  const labels = visible(node.children).filter(child => child.type === 'TEXT' && child.characters === 'HOLOGRAPHIC ONLY');
  if (labels.length !== (saved.holo ? 1 : 0)) invalid('the holographic page label is missing or belongs to the wrong template');
}
export function validateGridTemplate(document, template) {
  const invalid = detail => { throw new Error(`Cutter template ${template.name}: ${detail}. Review the Figma template and saved print geometry before syncing; the active artwork release is unchanged.`); };
  const saved = sources[template.nodeId], expected = template.grid;
  if (!saved || !expected || !document || document.type !== 'FRAME' || document.id !== template.nodeId || document.name !== template.name)
    invalid('the expected template frame is missing or renamed');
  clean(document, invalid, 'page');
  dimensions(document, 2550, 3300, invalid, 'page');
  translation(document, invalid, 'page');
  const bounds = document.absoluteBoundingBox;
  if (!bounds || !close(bounds.width, 2550) || !close(bounds.height, 3300) || document.clipsContent !== true)
    invalid('the page must be clipped to 2550 x 3300 pixels');
  const fills = visible(document.fills);
  if (fills.length !== 1 || !whitePaint(fills[0])) invalid('the page needs its opaque white paper fill');
  const children = visible(document.children), grid = children.at(-1);
  if (children.length !== (saved.background ? 2 : 1) || grid?.type !== 'FRAME' || grid.name !== 'card_backs' || grid.id !== expected.nodeId)
    invalid('the saved card_backs grid and background layers are required');
  if (saved.background) checkBackground(children[0], { ...saved,
    waterX: template.version === CUTTER_LAYOUT_V5 ? saved.legacyWaterX
      : template.version === CUTTER_LAYOUT_V6 ? saved.v6WaterX : saved.waterX,
  }, invalid);
  clean(grid, invalid, 'card grid');
  if (visible(grid.fills).length || grid.clipsContent !== true) invalid('the card grid must stay transparent and clipped');
  dimensions(grid, expected.width, expected.height, invalid, 'card grid');
  const gridOrigin = translation(grid, invalid, 'card grid', expected.x, expected.y);
  if (grid.layoutMode !== 'GRID' || grid.gridRowCount !== 3 || grid.gridColumnCount !== 3 ||
      grid.gridRowGap !== 0 || grid.gridColumnGap !== 0 ||
      ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'].some(key => (grid[key] ?? 0) !== 0) ||
      ['gridColumnsSizing', 'gridRowsSizing'].some(key => grid[key]?.replaceAll(' ', '') !== 'repeat(3,minmax(0,1fr))'))
    invalid('the grid must contain three equal rows and columns without gaps or padding');
  let positions;
  if (!saved.rear) {
    if (visible(grid.children).length) invalid('the front grid must be empty; guides and cards must not enter its background export');
    // Center native card dimensions in each of the nine equal cells, exactly
    // as the visible rear instances are centered in the corresponding grid.
    const cellWidth = expected.width / 3, cellHeight = expected.height / 3;
    positions = Array.from({ length: 9 }, (_, i) => ({
      x: gridOrigin.x + (i % 3) * cellWidth + (cellWidth - expected.cardWidth) / 2,
      y: gridOrigin.y + Math.floor(i / 3) * cellHeight + (cellHeight - expected.cardHeight) / 2,
      width: expected.cardWidth, height: expected.cardHeight, rotation: 0,
    }));
  } else {
    const cards = visible(grid.children);
    if (cards.length !== 9) invalid('the rear grid needs exactly nine visible card backs');
    positions = cards.map(card => {
      clean(card, invalid, 'rear card', true);
      if (card.type !== 'INSTANCE' || card.name !== 'sea-realm-background' || card.componentId !== '540:2527' || visible(card.fills).length)
        invalid('the rear card must use its saved Sea Realm background instance');
      const border = visible(card.strokes);
      if (border.length !== 1 || !whitePaint(border[0]) || !close(card.strokeWeight, 59.08799743652344) || card.strokeAlign !== 'INSIDE')
        invalid('the rear card white border changed');
      const art = visible(card.children);
      if (art.length !== 2 || art[0].type !== 'INSTANCE' || art[0].name !== 'card-back' || art[1].type !== 'INSTANCE' || art[1].name !== 'searealm-tcg-logo')
        invalid('the rear card needs both its water artwork and white logo');
      const point = translation(card, invalid, 'rear card');
      dimensions(card, expected.cardWidth, expected.cardHeight, invalid, 'rear card');
      return { x: gridOrigin.x + point.x, y: gridOrigin.y + point.y, width: card.size.x, height: card.size.y, rotation: 0 };
    }).sort((a, b) => Math.abs(a.y - b.y) < 0.01 ? a.x - b.x : a.y - b.y);
  }
  if (template.positions?.length !== 9 || positions.some((position, index) =>
    ['x', 'y', 'width', 'height', 'rotation'].some(key => !close(position[key], template.positions[index][key], key === 'rotation' ? 0.000001 : 0.01))))
    invalid('the card positions differ from the saved geometry');
  return positions;
}
