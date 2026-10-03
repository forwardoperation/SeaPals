import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const IMAGE_ROOT = path.join(ROOT, "public", "images", "cards");

// A 750 x 1050 Figma card at 0.5x is 375 x 525. Allow one pixel
// for the few source frames whose bounds round up during export.
export const MAX_CARD_LONG_EDGE = 526;
export const MAX_CARD_SHORT_EDGE = 376;

export async function auditGalleryImages() {
  const manifest = JSON.parse(
    await readFile(path.join(ROOT, "src", "data", "gallery-images.json"), "utf8")
  );
  const files = await readdir(IMAGE_ROOT, { recursive: true });
  const images = new Map();

  for (const file of files) {
    assert.ok(!/\.(svg|pdf|psd|ai|tiff?)$/i.test(file), `Printable card source in public: ${file}`);
    if (!/\.(png|webp|jpe?g|gif|avif)$/i.test(file)) continue;
    const metadata = await sharp(path.join(IMAGE_ROOT, file)).metadata();
    assert.ok(
      Math.max(metadata.width, metadata.height) <= MAX_CARD_LONG_EDGE &&
        Math.min(metadata.width, metadata.height) <= MAX_CARD_SHORT_EDGE,
      `Oversized card preview: ${file} (${metadata.width} x ${metadata.height})`
    );
    images.set(`/images/cards/${file.replaceAll("\\", "/")}`, metadata);
  }

  const ids = new Set();
  const sources = new Set();
  for (const entry of manifest.cards) {
    assert.ok(!ids.has(entry.cardId), `Duplicate gallery card: ${entry.cardId}`);
    assert.ok(!sources.has(entry.src.toLowerCase()), `Duplicate gallery path: ${entry.src}`);
    ids.add(entry.cardId);
    sources.add(entry.src.toLowerCase());
    assert.match(entry.src, /^\/images\/cards\/[^?]+\.png$/);
    const metadata = images.get(entry.src);
    assert.ok(metadata, `Missing gallery preview: ${entry.src}`);
    assert.equal(metadata.format, "png", `Expected PNG: ${entry.src}`);
    assert.equal(metadata.width, entry.width, `Incorrect preview width: ${entry.src}`);
    assert.equal(metadata.height, entry.height, `Incorrect preview height: ${entry.src}`);
    const contentHash = createHash("sha256")
      .update(await readFile(path.join(ROOT, "public", entry.src)))
      .digest("hex")
      .slice(0, 12);
    assert.equal(entry.contentHash, contentHash, `Update the gallery cache version for changed artwork: ${entry.src}`);
    if (entry.nodeId) {
      assert.equal(manifest.exportScale, 0.5);
      assert.ok(entry.width <= Math.ceil(entry.sourceWidth * manifest.exportScale));
      assert.ok(entry.height <= Math.ceil(entry.sourceHeight * manifest.exportScale));
    }
  }

  const master = JSON.parse(
    await readFile(path.join(ROOT, "src", "data", "gallery-set-list.json"), "utf8")
  );
  const galleryIds = new Set();
  for (const set of master.sets) {
    const printingNumbers = [];
    for (const card of set.cards) {
      assert.ok(!galleryIds.has(card.cardId), `Duplicate master gallery card: ${card.cardId}`);
      galleryIds.add(card.cardId);
      printingNumbers.push(...card.printings.map((printing) => printing.number));
      const image = manifest.cards.find((entry) => entry.cardId === card.cardId);
      if (image) {
        assert.equal(typeof image.prerelease, "boolean", `Audit the Prerelease label: ${card.cardId}`);
      }
    }
    assert.deepEqual(
      printingNumbers.sort((a, b) => a - b),
      Array.from({ length: set.totalPrintings }, (_, index) => index + 1),
      `Missing or duplicate master set numbers in ${set.title}`
    );
  }

  return { galleryPreviews: manifest.cards.length, publicCardImages: images.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await auditGalleryImages();
  console.log(`Verified ${result.galleryPreviews} gallery previews and ${result.publicCardImages} public card images (maximum ${MAX_CARD_SHORT_EDGE} x ${MAX_CARD_LONG_EDGE}, either orientation).`);
}
