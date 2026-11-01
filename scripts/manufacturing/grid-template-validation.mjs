import { CUTTER_LAYOUT_V5, CUTTER_LAYOUT_V6, CUTTER_LAYOUT_V8 } from "../../src/lib/manufacturing/backdrops.mjs";

// V5 and later use empty centered front grids and native, complete Canon rear pages.
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
const sharedSources = {
  '4311:139557': { shared: true, component: '4317:8434', background: '4317:8435' },
  '4311:139076': { shared: true, rear: true, component: '4317:8408', background: '4317:8409' },
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
function blackPaint(paint) {
  return paint?.type === 'SOLID' && (paint.opacity ?? 1) === 1 &&
    (paint.blendMode ?? 'NORMAL') === 'NORMAL' && (paint.color?.a ?? 1) === 1 &&
    ['r', 'g', 'b'].every(key => paint.color?.[key] === 0);
}
function onePaint(node, predicate) {
  const paints = visible(node.fills);
  return paints.length === 1 && predicate(paints[0]);
}
function matrixMatches(node, expected) {
  const matrix = node?.relativeTransform;
  return Array.isArray(matrix) && matrix.length === 2 && matrix.every((row, i) =>
    Array.isArray(row) && row.length === 3 && row.every((value, j) => close(value, expected[i][j], 0.000001)));
}
function checkSharedBackground(node, saved, invalid) {
  clean(node, invalid, 'shared background');
  if (node.id !== saved.background || node.type !== 'INSTANCE' || node.componentId !== saved.component || node.clipsContent !== true)
    invalid('the shared full-page background instance is required');
  dimensions(node, 2550, 3300, invalid, 'shared background');
  translation(node, invalid, 'shared background', 0, 0);
  if (visible(node.fills).length) invalid('the shared background must not add an opaque covering fill');
  const children = visible(node.children);
  if (!saved.rear) {
    const [unusedBar, water] = children;
    if (children.length !== 2 || unusedBar?.id !== 'I4317:8435;4317:8421' || water?.id !== 'I4317:8435;4317:8422')
      invalid('the shared front must contain only its water and unpainted guide');
    clean(unusedBar, invalid, 'unpainted front guide');
    if (unusedBar.type !== 'RECTANGLE' || visible(unusedBar.fills).length)
      invalid('the retired front guide must remain unpainted');
    clean(water, invalid, 'shared ocean background');
    if (water.type !== 'RECTANGLE' || !onePaint(water, paint => paint.type === 'IMAGE' &&
        (paint.opacity ?? 1) === 1 && (paint.blendMode ?? 'NORMAL') === 'NORMAL' && paint.scaleMode === 'TILE'))
      invalid('the shared ocean background must retain its visible tiled image');
    translation(water, invalid, 'shared ocean background', 68, 61);
    dimensions(water, 2337, 3182, invalid, 'shared ocean background');
    return;
  }
  if (children.length !== 2) invalid('the shared rear background needs only its two staple markers');
  for (const [index, group] of children.entries()) {
    const suffix = index === 0 ? '4452:353766' : '4452:353769';
    clean(group, invalid, 'staple marker');
    if (group.type !== 'GROUP' || group.id !== 'I4317:8409;' + suffix || visible(group.fills).length || group.clipsContent !== false)
      invalid('the shared rear staple marker changed');
    dimensions(group, 78, 231, invalid, 'staple marker');
    translation(group, invalid, 'staple marker', 25, index === 0 ? 468 : 2646);
    const parts = visible(group.children), [box, label] = parts;
    if (parts.length !== 2 || box?.type !== 'RECTANGLE' || label?.type !== 'TEXT')
      invalid('the staple marker needs its dashed box and text');
    clean(box, invalid, 'staple box', true);
    dimensions(box, 78, 231, invalid, 'staple box');
    translation(box, invalid, 'staple box', 0, 0);
    const border = visible(box.strokes);
    if (visible(box.fills).length || border.length !== 1 || !blackPaint(border[0]) || box.strokeWeight !== 2 ||
        box.strokeAlign !== 'INSIDE' || JSON.stringify(box.strokeDashes) !== '[12,12]')
      invalid('the staple box must retain its black dashed border');
    clean(label, invalid, 'staple label');
    dimensions(label, 231, 46, invalid, 'staple label');
    if (label.characters !== 'STAPLE' || !onePaint(label, blackPaint) ||
        !matrixMatches(label, [[0, -1, 62], [1, 0, 0]]) || label.style?.fontSize !== 39 || label.style?.fontWeight !== 700)
      invalid('the rotated staple label changed');
  }
}
function checkSharedTopBar(node, invalid) {
  clean(node, invalid, 'rear top bar');
  if (node.id !== '4459:12836' || node.type !== 'RECTANGLE' || !onePaint(node, blackPaint))
    invalid('the shared rear needs its black top bar');
  translation(node, invalid, 'rear top bar', 107, 51);
  dimensions(node, 2326, 20, invalid, 'rear top bar');
}
function checkSharedCardArtwork(card, invalid) {
  if (card.clipsContent !== true) invalid('rear card artwork must remain clipped');
  const [waterFrame, logo] = visible(card.children);
  clean(waterFrame, invalid, 'rear water frame');
  if (waterFrame.componentId !== '3846:261608' || waterFrame.clipsContent !== true || visible(waterFrame.fills).length)
    invalid('the rear water frame must retain its transparent clipped instance');
  translation(waterFrame, invalid, 'rear water frame', -0.2999929189682007, -0.019990086555480957);
  dimensions(waterFrame, 738.5999755859375, 1034.0400390625, invalid, 'rear water frame');
  const waterParts = visible(waterFrame.children), water = waterParts[0];
  if (waterParts.length !== 3 || water?.type !== 'RECTANGLE' || !water.id.endsWith(';3846:260019') ||
      waterParts[1]?.name !== 'Group 93' || waterParts[2]?.name !== 'Group 104')
    invalid('the rear water artwork is incomplete');
  clean(water, invalid, 'rear water image');
  translation(water, invalid, 'rear water image', 0, -600.7279663085938);
  dimensions(water, 1802.1839599609375, 1802.1839599609375, invalid, 'rear water image');
  const paints = visible(water.fills);
  if (paints.length !== 2 || paints[1].type !== 'IMAGE' || paints[1].scaleMode !== 'TILE' ||
      (paints[1].opacity ?? 1) !== 1 || (paints[1].blendMode ?? 'NORMAL') !== 'NORMAL')
    invalid('the rear water image must remain visible above its base color');
  // This approved logo includes its native shadow; do not strip its styling.
  clean({ ...logo, effects: [] }, invalid, 'rear logo');
  if (logo.componentId !== '3105:577256' || visible(logo.fills).length || logo.clipsContent !== false)
    invalid('the rear logo must retain its transparent instance');
  translation(logo, invalid, 'rear logo', 26.837053298950195, 423.95709228515625);
  dimensions(logo, 683.4590454101562, 186.49937438964844, invalid, 'rear logo');
  const logoParts = visible(logo.children);
  if (logoParts.length !== 3 || logoParts[0]?.characters !== 'TRADING CARD GAME' ||
      logoParts[1]?.name !== 'Group 36' || logoParts[2]?.characters !== 'TM' ||
      !onePaint(logoParts[0], whitePaint) || !onePaint(logoParts[2], whitePaint))
    invalid('the rear white logo artwork is incomplete');
}
export function validateGridTemplate(document, template) {
  const invalid = detail => { throw new Error(`Cutter template ${template.name}: ${detail}. Review the Figma template and saved print geometry before syncing; the active artwork release is unchanged.`); };
  const saved = (template.version === CUTTER_LAYOUT_V8 ? sharedSources : sources)[template.nodeId], expected = template.grid;
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
  const children = visible(document.children), grid = saved.shared ? children[1] : children.at(-1);
  if (children.length !== (saved.shared && saved.rear ? 3 : saved.background ? 2 : 1) || grid?.type !== 'FRAME' || grid.name !== 'card_backs' || grid.id !== expected.nodeId)
    invalid('the saved card_backs grid and background layers are required');
  if (saved.shared) {
    checkSharedBackground(children[0], saved, invalid);
    if (saved.rear) checkSharedTopBar(children[2], invalid);
  } else if (saved.background) checkBackground(children[0], { ...saved,
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
      if (saved.shared) checkSharedCardArtwork(card, invalid);
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
