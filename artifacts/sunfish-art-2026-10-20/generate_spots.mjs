import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Native vector texture: organic marks are batched by colour/opacity.
// Geometry is sampled inside the existing silhouette, so no masks are needed.
const dir = path.dirname(fileURLToPath(import.meta.url));
const original = JSON.parse(fs.readFileSync(path.join(dir, 'original-geometry.json')));
const silhouette = [...original.body.paths[0].data.matchAll(/[ML] ([\d.]+) ([\d.]+)/g)]
  .map(m => [Number(m[1]), Number(m[2])]);
let seed = 20261020;
const rand = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
const between = (a, b) => a + rand() * (b - a);
const n = v => Number(v.toFixed(2));
const xy = p => `${n(p[0])} ${n(p[1])}`;
const inside = (x, y) => {
  let yes = false;
  for (let i = 0, j = silhouette.length - 1; i < silhouette.length; j = i++) {
    const [xi, yi] = silhouette[i], [xj, yj] = silhouette[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) yes = !yes;
  }
  return yes;
};
const ellipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
const clear = (x, y, r) => {
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    if (!inside(x + Math.cos(a) * (r + 8), y + Math.sin(a) * (r + 8))) return false;
  }
  // Leave the pectoral fin, gill, eye and mouth readable.
  return !ellipse(x, y, 492, 620, 88, 80) &&
    !ellipse(x, y, 574, 606, 31, 51) &&
    !ellipse(x, y, 706, 586, 48, 43) &&
    !ellipse(x, y, 800, 646, 27, 63);
};
const shape = (cx, cy, rx, ry, ring = false) => {
  const rotation = between(-1.2, 1.2);
  const count = 6;
  const radii = Array.from({length: count}, () => between(.32, 1.5));
  const points = scale => radii.map((r, i) => {
    const a = i * Math.PI * 2 / count;
    const x = Math.cos(a) * rx * r * scale, y = Math.sin(a) * ry * r * scale;
    return [cx + x * Math.cos(rotation) - y * Math.sin(rotation), cy + x * Math.sin(rotation) + y * Math.cos(rotation)];
  });
  const smooth = pts => {
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let d = `M ${xy(mid(pts.at(-1), pts[0]))} `;
    for (let i = 0; i < pts.length; i++) d += `Q ${xy(pts[i])} ${xy(mid(pts[i], pts[(i + 1) % pts.length]))} `;
    return d + 'Z ';
  };
  return smooth(points(1)) + (ring ? smooth(points(between(.42, .65))) : '');
};
const layers = [
  { name: 'Skin · diffuse pale mottling', color: '#9ab6c3', opacity: .10, d: '', count: 0 },
  { name: 'Skin · irregular pale flecks', color: '#bed2da', opacity: .29, d: '', count: 0 },
  { name: 'Skin · small light freckles', color: '#dae5e8', opacity: .34, d: '', count: 0 },
  { name: 'Skin · broken ring spots', color: '#bdd2db', opacity: .36, d: '', count: 0 },
  { name: 'Skin · lower flank dark mottles', color: '#2d4b5b', opacity: .16, d: '', count: 0 },
  { name: 'Skin · fin freckles', color: '#b6cbd3', opacity: .20, d: '', count: 0 },
];
function fill(layer, count, bounds, radius, accept, ring = false) {
  for (let attempts = 0; layers[layer].count < count && attempts < 30000; attempts++) {
    const x = between(bounds[0], bounds[2]), y = between(bounds[1], bounds[3]);
    const r = between(...radius);
    const patch = .57 + .23 * Math.sin(x * .041 + y * .016) * Math.cos(y * .029);
    if (rand() > patch || !clear(x, y, r * 1.5) || !accept(x, y)) continue;
    const ry = r * between(.55, 1.8);
    layers[layer].d += shape(x, y, r, ry, ring);
    layers[layer].count++;
  }
}
fill(0, 76, [40, 365, 780, 915], [3.5, 8.5], (x, y) => y < 820 && (x < 270 || y < 510 || y > 720));
fill(1, 212, [70, 365, 790, 905], [1.6, 5.5], () => true);
fill(2, 145, [110, 365, 770, 850], [.7, 2.1], () => true);
fill(3, 38, [180, 475, 650, 830], [3.2, 6.7], (x, y) => x < 450 || y < 560, true);
fill(4, 108, [115, 650, 780, 905], [1.8, 6.8], (x, y) => x < 600 || y > 730);
fill(5, 82, [165, 35, 370, 1230], [1.0, 3.8], (x, y) => y < 355 || y > 940);
for (const l of layers) l.d = l.d.trim();
fs.writeFileSync(path.join(dir, 'sunfish-spots.json'), JSON.stringify({width:817.5,height:1267,layers}, null, 2));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="817.5" height="1267" viewBox="0 0 817.5 1267"><title>Sunfish pale flecks and ring spots</title>${layers.map(l => `<path id="${l.name}" fill="${l.color}" opacity="${l.opacity}" fill-rule="evenodd" d="${l.d}"/>`).join('')}</svg>`;
fs.writeFileSync(path.join(dir, 'sunfish-spots.svg'), svg);
console.log(JSON.stringify({marks:layers.reduce((a, l) => a + l.count, 0), paths:layers.length, bytes:Buffer.byteLength(svg), layers:layers.map(({name,count}) => ({name,count}))}));
