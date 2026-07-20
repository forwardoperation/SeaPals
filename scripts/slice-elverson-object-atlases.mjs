import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUTPUT_DIRECTORY = path.join(
  ROOT,
  "public",
  "images",
  "adventure",
  "elverson-objects-v2",
);

const ATLASES = [
  {
    source: path.join(ROOT, "public", "images", "adventure", "elverson-buildings-atlas-v2.png"),
    names: [
      "blue-home",
      "tan-home",
      "green-home",
      "brick-school",
      "yellow-storefront",
      "green-awning-shop",
      "aquarium-workshop",
      "brick-civic-hall",
    ],
  },
  {
    source: path.join(ROOT, "public", "images", "adventure", "elverson-props-atlas-v2.png"),
    names: [
      "street-tree",
      "lamppost",
      "park-bench",
      "fountain",
      "hedge-planter",
      "barrels",
      "signpost",
      "flowering-shrub",
    ],
  },
];

const CELL_INSET = 8;

await mkdir(OUTPUT_DIRECTORY, { recursive: true });

for (const atlas of ATLASES) {
  const metadata = await sharp(atlas.source).metadata();
  if (metadata.width !== 1536 || metadata.height !== 1024) {
    throw new Error(`${path.basename(atlas.source)} must be the authored 1536x1024 4x2 atlas.`);
  }

  const cellWidth = metadata.width / 4;
  const cellHeight = metadata.height / 2;
  for (const [index, name] of atlas.names.entries()) {
    const left = (index % 4) * cellWidth;
    const top = Math.floor(index / 4) * cellHeight;
    const cell = await sharp(atlas.source)
      .extract({
        left: left + CELL_INSET,
        top: top + CELL_INSET,
        width: cellWidth - CELL_INSET * 2,
        height: cellHeight - CELL_INSET * 2,
      })
      .png()
      .toBuffer();
    await sharp(cell)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: 2,
        right: 2,
        bottom: 2,
        left: 2,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(path.join(OUTPUT_DIRECTORY, `${name}.png`));
  }
}
