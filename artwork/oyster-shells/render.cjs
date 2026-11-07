const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
  for (const name of ['rear-oyster', 'front-oyster']) {
    const svg = await fs.readFile(path.join(__dirname, `${name}.svg`), 'utf8');
    await sharp(Buffer.from(svg)).png().toFile(path.join(__dirname, `${name}-preview.png`));
    // Review-only softening equivalent to the intended texture group blur.
    // The delivered SVG deliberately contains no filter, avoiding raster import.
    const soft = svg.replace('<g id="Shell-color-contours"', '<g style="filter:blur(1.5px)" id="Shell-color-contours"');
    await sharp(Buffer.from(soft)).png().toFile(path.join(__dirname, `${name}-soft-preview.png`));
  }
  console.log('Rendered editable shell SVG previews.');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
