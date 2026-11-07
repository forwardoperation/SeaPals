const page = await figma.getNodeByIdAsync('4530:33125');
await figma.setCurrentPageAsync(page);
const payload = __VECTOR_PAYLOAD__;
const createdNodeIds = [];
const mutatedNodeIds = [];
const results = [];
const blurByName = {
  'warm-ridge-shadows': 7.5,
  'umber-recesses': 4.5,
  'brown-shell-markings': 1.5,
  'deep-grooves': 2.5,
  'raised-ridge-light': 6,
  'ivory-crest-highlights': 3,
  'lip-interior': 8,
  'lip-underside': 5,
  'lip-rim-light': 3,
};
for (const item of payload) {
  const original = await figma.getNodeByIdAsync(item.id);
  if (original.parent.type === 'GROUP' && original.parent.name === item.name) {
    results.push({ name: item.name, id: original.parent.id, status: 'already installed' });
    continue;
  }
  const parent = original.parent;
  const index = parent.children.indexOf(original);
  const x = original.x, y = original.y;
  const contour = original.clone();
  contour.name = item.name + '-clip';
  contour.vectorPaths = original.vectorPaths.map(p => ({ windingRule: 'NONZERO', data: p.data }));
  contour.cornerRadius = 200;
  contour.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  contour.strokes = [];
  contour.x = x; contour.y = y;
  const art = figma.createNodeFromSvg(item.svg);
  art.name = item.name + '-vector-fills';
  art.x = x; art.y = y;
  art.clipsContent = false;
  const descendants = art.findAll(() => true);
  createdNodeIds.push(contour.id, art.id, ...descendants.map(n => n.id));
  for (const n of descendants) {
    const radius = blurByName[n.name];
    if (radius !== undefined && 'effects' in n) {
      n.effects = [{ type: 'LAYER_BLUR', radius, visible: true, blurType: 'NORMAL' }];
    }
  }
  const clipped = figma.group([contour, art], parent, index);
  clipped.name = item.name + '-details';
  contour.isMask = true;
  contour.maskType = 'VECTOR';
  original.name = item.name + '-outline';
  const wrapper = figma.group([clipped, original], parent, index);
  wrapper.name = item.name;
  createdNodeIds.push(clipped.id, wrapper.id);
  mutatedNodeIds.push(original.id);
  const counts = {};
  const all = wrapper.findAll(() => true);
  const imageNodes = [];
  for (const n of all) {
    counts[n.type] = (counts[n.type] || 0) + 1;
    if ('fills' in n && Array.isArray(n.fills) && n.fills.some(f => f.type === 'IMAGE')) {
      imageNodes.push({ id: n.id, name: n.name, type: n.type, width: n.width, height: n.height });
    }
  }
  results.push({ name: wrapper.name, id: wrapper.id, bounds: { x: wrapper.x, y: wrapper.y, width: wrapper.width, height: wrapper.height }, descendantCount: all.length, counts, imageNodes, shadedGroups: descendants.filter(n => blurByName[n.name] !== undefined).map(n => ({id:n.id,name:n.name})) });
}
return { createdNodeIds, mutatedNodeIds, shells: results };
