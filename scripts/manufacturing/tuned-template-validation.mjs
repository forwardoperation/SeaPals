// V4 reads native dimensions and affine transforms, since axis-aligned bounds
// would enlarge the rotated Epson cards and lose the printer's skew correction.
const visible = (nodes = []) => nodes.filter((node) => node.visible !== false);
const close = (a, b, tolerance = 0.01) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
function multiply(a, b) {
  return [
    [a[0][0]*b[0][0]+a[0][1]*b[1][0], a[0][0]*b[0][1]+a[0][1]*b[1][1], a[0][0]*b[0][2]+a[0][1]*b[1][2]+a[0][2]],
    [a[1][0]*b[0][0]+a[1][1]*b[1][0], a[1][0]*b[0][1]+a[1][1]*b[1][1], a[1][0]*b[0][2]+a[1][1]*b[1][2]+a[1][2]],
  ];
}
function transform(node, invalid) {
  const m = node?.relativeTransform;
  if (!Array.isArray(m) || m.length !== 2 || m.some(row => !Array.isArray(row) || row.length !== 3 || !row.every(Number.isFinite)))
    invalid('native transforms are missing; read the pinned nodes with geometry=paths');
  const angle = Math.atan2(m[1][0], m[0][0]);
  if (!close(m[0][0], Math.cos(angle), 0.000001) || !close(m[1][1], Math.cos(angle), 0.000001) ||
      !close(m[1][0], Math.sin(angle), 0.000001) || !close(m[0][1], -Math.sin(angle), 0.000001))
    invalid('a template transform contains unsupported scaling, mirroring, or shear');
  return m;
}
function clean(node, invalid, label) {
  if (node.visible === false || (node.opacity ?? 1) !== 1 || node.isMask === true ||
      !['NORMAL', 'PASS_THROUGH'].includes(node.blendMode ?? 'NORMAL') ||
      visible(node.effects).length || visible(node.strokes).length)
    invalid(`${label} has hidden, translucent, stroked, or effect-altered artwork`);
}
export function validateTunedTemplate(document, template) {
  const invalid = detail => { throw new Error(`Cutter template ${template.name}: ${detail}. Review the Figma template and saved print geometry before syncing; the active artwork release is unchanged.`); };
  const rear = template.background?.assetId === 'standard-back-sheet';
  if (!document || document.type !== 'FRAME' || document.id !== template.nodeId || document.name !== template.name)
    invalid('the expected template frame is missing or renamed');
  clean(document, invalid, 'page');
  const origin = document.absoluteBoundingBox;
  if (!origin || ![origin.x, origin.y].every(Number.isFinite) || !close(origin.width,2550) || !close(origin.height,3300) ||
      !close(document.size?.x,2550) || !close(document.size?.y,3300)) invalid('the page must be 2550 × 3300 pixels');
  const pageMatrix = transform(document, invalid);
  if (!close(pageMatrix[0][0],1,0.000001) || !close(pageMatrix[1][0],0,0.000001)) invalid('the page itself must not be rotated');
  const fills = visible(document.fills);
  if (fills.length !== 1 || fills[0].type !== 'SOLID' || (fills[0].opacity ?? 1) !== 1 ||
      (fills[0].blendMode ?? 'NORMAL') !== 'NORMAL' || (fills[0].color?.a ?? 1) !== 1 ||
      ['r','g','b'].some(c => fills[0].color?.[c] !== 1)) invalid('the page needs its opaque white paper fill');
  const children = visible(document.children);
  const grid = children.find(n => n.type === 'FRAME' && n.name === 'card_backs');
  const backdrop = children[0];
  if (children.length !== 2 || children[1] !== grid) invalid('one ocean backdrop followed by one card_backs frame is required');
  clean(grid, invalid, 'card grid');
  if (visible(grid.fills).length) invalid('the card grid must remain transparent');
  const gm = transform(grid, invalid);
  if (!close(grid.size?.x,2330) || !close(grid.size?.y,3170)) invalid('the native grid size changed');
  const expectedBackdrop = rear
    ? {nodeId:'4244:451220',x:36,y:20,width:2417,height:3255}
    : template.background;
  clean(backdrop, invalid, 'ocean backdrop');
  const imageFills = visible(backdrop.fills);
  if (backdrop.id !== expectedBackdrop.nodeId || backdrop.type !== 'RECTANGLE' || backdrop.children?.length ||
      imageFills.length !== 1 || imageFills[0].type !== 'IMAGE' || (imageFills[0].opacity ?? 1) !== 1 ||
      (imageFills[0].blendMode ?? 'NORMAL') !== 'NORMAL') invalid('the ocean backdrop must be its saved image-only rectangle');
  const bm = transform(backdrop, invalid);
  const angle = Math.atan2(bm[1][0],bm[0][0])*180/Math.PI;
  if (!close(angle,template.positions?.[0]?.rotation,0.00001)) invalid('the ocean backdrop rotation changed');
  const bb = backdrop.absoluteBoundingBox;
  const bounds = bb && {x:bb.x-origin.x,y:bb.y-origin.y,width:bb.width,height:bb.height};
  if (!bounds || ['x','y','width','height'].some(k=>!close(bounds[k],expectedBackdrop[k]))) invalid('the ocean backdrop bounds differ from the saved template');
  const slots = visible(grid.children);
  if (slots.length !== 9 || slots.some(s=>s.type !== (rear?'INSTANCE':'GROUP'))) invalid('exactly nine visible card slots are required');
  const positions = slots.map(slot => {
    clean(slot, invalid, 'card slot');
    const sm = multiply(gm, transform(slot, invalid));
    let art = slot, matrix = sm;
    if (!rear) {
      const rectangles = visible(slot.children).filter(n=>n.type==='RECTANGLE');
      if (rectangles.length !== 1) invalid('each front guide must have one card rectangle');
      art = rectangles[0];
      matrix = multiply(sm, transform(art, invalid));
    } else {
      const logos = visible(slot.children);
      if (slot.componentId !== '540:2527' || visible(slot.fills).length || logos.length !== 1 ||
          logos[0].type !== 'INSTANCE' || logos[0].name !== 'searealm-tcg-logo') invalid('the rear must contain only the nine transparent logo instances');
      const checkLogo = n => {
        const effects = visible(n.effects);
        // The approved logo instance has Figma's subtle black drop shadow.
        if (effects.length && (n !== logos[0] || effects.length !== 1 ||
            effects[0].type !== 'DROP_SHADOW' || effects[0].blendMode !== 'NORMAL' ||
            !close(effects[0].radius,3.939199924468994) || !close(effects[0].offset?.x,0) ||
            !close(effects[0].offset?.y,3.939199924468994) || effects[0].color?.a !== 0.25 ||
            ['r','g','b'].some(c=>effects[0].color?.[c]!==0))) invalid('the rear logo shadow changed');
        clean({...n,effects:[]}, invalid, 'rear logo');
        if (visible(n.fills).some(f=>f.type !== 'SOLID' || (f.opacity??1)!==1 ||
            (f.blendMode??'NORMAL')!=='NORMAL' || (f.color?.a??1)!==1 || ['r','g','b'].some(c=>f.color?.[c]!==1)))
          invalid('the rear logos must remain white');
        // Boolean operands supply geometry; the resulting shape uses the
        // Boolean node's white fill, not the operand paint colors.
        if (n.type !== 'BOOLEAN_OPERATION')
          for (const child of visible(n.children)) checkLogo(child);
      };
      checkLogo(logos[0]);
    }
    return {x:matrix[0][2],y:matrix[1][2],width:art.size?.x,height:art.size?.y,rotation:Math.atan2(matrix[1][0],matrix[0][0])*180/Math.PI};
  }).sort((a,b)=>Math.abs(a.y-b.y)<20?a.x-b.x:a.y-b.y);
  if (template.positions?.length !== 9) invalid('the saved geometry is incomplete');
  for (const [i,p] of positions.entries()) {
    if (['x','y','width','height','rotation'].some(k=>!close(p[k],template.positions[i][k],k==='rotation'?0.00001:0.01)))
      invalid(`card ${Math.floor(i/3)+1}:${i%3+1} differs from the saved geometry`);
  }
  return positions;
}
