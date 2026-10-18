/**
 * Reproducible tabletop photograph layout made only from original product art.
 * Run from any directory: node scripts/render-homepage-tabletop.mjs
 *
 * Product faces are resized with contain, never cropped, recolored, stretched,
 * or masked. Only the oak background uses cover. Shadows are separate layers
 * derived from the original alpha channels. The top player rotates as a whole.
 */
import assert from "node:assert/strict";
import { access, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

export const layout = {
  canvas: { width: 1800, height: 2700 },
  player: { width: 1520, height: 1302 },
  mat: { left: 0, top: 0, width: 1520, height: 1040, aspect: [19, 13] },
  card: { width: 180, height: 252 },
  resize: { fit: "contain", kernel: "lanczos3", fastShrinkOnLoad: false, background: transparent },
  sources: {
    coralGarden: {
      path: "scripts/assets/homepage-tabletop/coral-garden.webp",
      expected: { width: 5700, height: 3900 },
      kind: "mat",
    },
    dropOff: {
      path: "scripts/assets/homepage-tabletop/drop-off.webp",
      expected: { width: 5472, height: 3744 },
      kind: "mat",
    },
    cardBack: {
      path: "scripts/assets/homepage-tabletop/card-back.webp",
      expected: { width: 738, height: 1034 },
      kind: "card",
    },
    oak: { path: "scripts/assets/homepage-tabletop/oak-table.webp", kind: "background" },
    elkhorn: {
      path: "public/images/cards/coral/Reef/elkhorn-base.png",
      expected: { width: 375, height: 525 },
      kind: "card",
    },
    frenchAngelfish: {
      path: "public/images/cards/fish/Reef/french-angelfish.png",
      expected: { width: 375, height: 525 },
      kind: "card",
    },
    cleanerShrimp: {
      path: "public/images/cards/invertebrates/Reef/Cleaner Shrimp.png",
      expected: { width: 375, height: 525 },
      kind: "card",
    },
  },
  faces: [
    { source: "elkhorn", center: [0.23, 0.441] },
    { source: "elkhorn", center: [0.78, 0.441] },
    { source: "frenchAngelfish", center: [0.23, 0.155] },
    { source: "cleanerShrimp", center: [0.78, 0.732] },
  ],
  decks: [{ centerX: 0.626, top: 1050 }, { centerX: 0.879, top: 1050 }],
  paperLayers: [
    { offsetX: 4, offsetY: -6, color: "#eceee8" },
    { offsetX: 2, offsetY: -3, color: "#f8f7f0" },
  ],
  shadows: {
    card: { padding: 16, sigma: 4, opacity: 0.19, offsetX: 0, offsetY: 4 },
    player: { padding: 16, sigma: 5, opacity: 0.22, offsetX: 0, offsetY: 4 },
  },
  players: [
    { mat: "dropOff", left: 140, top: 24, rotation: 180 },
    { mat: "coralGarden", left: 140, top: 1374, rotation: 0 },
  ],
  output: "public/images/promo/searealm-tabletop-exact.webp",
  encoding: { lossless: true, effort: 6, alphaQuality: 100 },
};

export function faceRect(face) {
  return {
    left: Math.round(face.center[0] * layout.mat.width - layout.card.width / 2),
    top: Math.round(face.center[1] * layout.mat.height - layout.card.height / 2),
    ...layout.card,
  };
}

export function deckRect(deck) {
  return {
    left: Math.round(deck.centerX * layout.mat.width - layout.card.width / 2),
    top: deck.top,
    ...layout.card,
  };
}

/** Map an upright player rectangle to its final canvas bounds for pixel checks. */
export function toCanvasRect(player, rect) {
  assert.ok(player.rotation === 0 || player.rotation === 180);
  return {
    left: player.left + (player.rotation === 180
      ? layout.player.width - rect.left - rect.width : rect.left),
    top: player.top + (player.rotation === 180
      ? layout.player.height - rect.top - rect.height : rect.top),
    width: rect.width,
    height: rect.height,
    rotation: player.rotation,
  };
}

function resolveRepositoryPath(relativePath) {
  assert.ok(!path.isAbsolute(relativePath), "Asset paths must be repository-relative.");
  const resolved = path.resolve(repositoryRoot, relativePath);
  const relative = path.relative(repositoryRoot, resolved);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    "Asset paths must remain inside the repository.");
  return resolved;
}

function emptyCanvas(width, height) {
  return sharp({ create: { width, height, channels: 4, background: transparent } });
}

function assertInside(rect, bounds, label) {
  assert.ok(rect.left >= 0 && rect.top >= 0 &&
    rect.left + rect.width <= bounds.width && rect.top + rect.height <= bounds.height,
  `${label} must fit completely inside its layer.`);
}

async function resizeProduct(input, size) {
  return sharp(input).resize(size.width, size.height, layout.resize).png().toBuffer();
}

async function alphaShadow(input, settings) {
  // Materialize the source alpha before any shadow work. Keeping this separate
  // avoids Sharp reordering extractChannel after its blur/extension operations.
  const { data: sourceAlpha, info: sourceInfo } = await sharp(input)
    .ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  assert.equal(sourceInfo.channels, 1, "Shadow mask must contain only alpha.");
  const width = sourceInfo.width + settings.padding * 2;
  const height = sourceInfo.height + settings.padding * 2;
  const paddedAlpha = Buffer.alloc(width * height);
  for (let row = 0; row < sourceInfo.height; row += 1) {
    sourceAlpha.copy(paddedAlpha, (row + settings.padding) * width + settings.padding,
      row * sourceInfo.width, (row + 1) * sourceInfo.width);
  }
  const { data: blurredAlpha, info } = await sharp(paddedAlpha, {
    raw: { width, height, channels: 1 },
  }).blur(settings.sigma).toColourspace("b-w").raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 1);
  // Set RGBA explicitly: black RGB and only the blurred mask in alpha. The
  // padding remains transparent; no shadow operation touches product RGB.
  const rgba = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < blurredAlpha.length; pixel += 1) {
    rgba[pixel * 4 + 3] = Math.round(blurredAlpha[pixel] * settings.opacity);
  }
  const buffer = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { buffer, width, height };
}

function shadowPlacement(shadow, rect, settings) {
  return {
    input: shadow.buffer,
    left: rect.left - settings.padding + settings.offsetX,
    top: rect.top - settings.padding + settings.offsetY,
  };
}

async function paperRectangle(color) {
  // The stack edge is separate paper behind the exact, unmasked card-back face.
  const { width, height } = layout.card;
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="${color}" stroke="#bcc2bd" stroke-width="1"/></svg>`))
    .png().toBuffer();
}

async function createPlayer(mat, images, shadows, papers) {
  const layers = [{ input: mat, left: 0, top: 0 }];
  for (const face of layout.faces) {
    const rect = faceRect(face);
    assertInside(rect, layout.mat, `${face.source} face`);
    const shadow = shadows[face.source];
    const placement = shadowPlacement(shadow, rect, layout.shadows.card);
    assertInside({ ...placement, width: shadow.width, height: shadow.height },
      layout.player, `${face.source} shadow`);
    layers.push(placement, { input: images[face.source], left: rect.left, top: rect.top });
  }
  for (const deck of layout.decks) {
    const rect = deckRect(deck);
    assertInside(rect, layout.player, "Card-back face");
    for (let index = 0; index < layout.paperLayers.length; index += 1) {
      const paper = layout.paperLayers[index];
      const position = { left: rect.left + paper.offsetX, top: rect.top + paper.offsetY };
      assertInside({ ...position, ...layout.card }, layout.player, "Paper stack");
      layers.push({ input: papers[index], ...position });
    }
    layers.push({ input: images.cardBack, left: rect.left, top: rect.top });
  }
  return emptyCanvas(layout.player.width, layout.player.height).composite(layers).png().toBuffer();
}

export async function renderHomepageTabletop() {
  assert.equal(layout.mat.width * 13, layout.mat.height * 19,
    "The destination mat must retain its 19:13 aspect ratio.");
  const sources = Object.fromEntries(await Promise.all(Object.entries(layout.sources)
    .map(async ([key, source]) => {
      const input = resolveRepositoryPath(source.path);
      await access(input);
      const [metadata, file] = await Promise.all([sharp(input).metadata(), stat(input)]);
      assert.ok(metadata.width > 0 && metadata.height > 0, `${source.path} must be an image.`);
      if (source.expected) {
        assert.equal(metadata.width, source.expected.width, `${source.path}: unexpected width.`);
        assert.equal(metadata.height, source.expected.height, `${source.path}: unexpected height.`);
      }
      if (source.kind === "mat") {
        assert.equal(metadata.width * 13, metadata.height * 19,
          `${source.path} must have the original 19:13 aspect ratio.`);
      }
      return [key, { input, path: source.path, width: metadata.width,
        height: metadata.height, bytes: file.size }];
    })));

  const images = Object.fromEntries(await Promise.all(Object.entries(layout.sources)
    .filter(([, source]) => source.kind !== "background")
    .map(async ([key, source]) => [key, await resizeProduct(sources[key].input,
      source.kind === "mat" ? layout.mat : layout.card)])));
  const shadows = Object.fromEntries(await Promise.all(
    [...new Set(layout.faces.map((face) => face.source))]
      .map(async (key) => [key, await alphaShadow(images[key], layout.shadows.card)])));
  const papers = await Promise.all(layout.paperLayers.map((paper) => paperRectangle(paper.color)));
  const layers = [];
  for (const player of layout.players) {
    assertInside({ ...player, ...layout.player }, layout.canvas, "Whole player layer");
    const upright = await createPlayer(images[player.mat], images, shadows, papers);
    const image = player.rotation === 180
      ? await sharp(upright).rotate(180).png().toBuffer() : upright;
    const shadow = await alphaShadow(image, layout.shadows.player);
    const placement = shadowPlacement(shadow, player, layout.shadows.player);
    assertInside({ ...placement, width: shadow.width, height: shadow.height },
      layout.canvas, "Whole player shadow");
    layers.push(placement, { input: image, left: player.left, top: player.top });
  }

  const output = resolveRepositoryPath(layout.output);
  await mkdir(path.dirname(output), { recursive: true });
  // Cover/crop is allowed only for the non-product oak background.
  const result = await sharp(sources.oak.input)
    .resize(layout.canvas.width, layout.canvas.height, { fit: "cover", position: "centre" })
    .composite(layers).webp(layout.encoding).toFile(output);
  assert.equal(result.width, layout.canvas.width);
  assert.equal(result.height, layout.canvas.height);
  const report = {
    sources: Object.fromEntries(Object.entries(sources).map(([key, { input: _input, ...source }]) => [key, source])),
    output: { path: layout.output, width: result.width, height: result.height,
      format: result.format, bytes: result.size, lossless: true },
    layout,
    canvasBounds: layout.players.map((player) => ({
      mat: toCanvasRect(player, layout.mat),
      faces: layout.faces.map((face) => ({ source: face.source, ...toCanvasRect(player, faceRect(face)) })),
      decks: layout.decks.map((deck) => toCanvasRect(player, deckRect(deck))),
    })),
  };
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await renderHomepageTabletop();
}
