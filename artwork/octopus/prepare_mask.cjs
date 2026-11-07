const fs = require('node:fs');
const sharp = require('sharp');
const root = __dirname;
const outline = fs.readFileSync(root + '/body-outline.svg', 'utf8');
const d = outline.match(/<path d="([^"]+)"/)[1];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1164" height="902" viewBox="0 0 1164 902"><path d="${d}" fill="white"/></svg>`;
fs.writeFileSync(root + '/silhouette-mask.svg', svg);
sharp(Buffer.from(svg)).png().toFile(root + '/silhouette-mask.png');
