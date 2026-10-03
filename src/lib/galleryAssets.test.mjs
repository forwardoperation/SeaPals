import assert from "node:assert/strict";
import test from "node:test";
import { auditGalleryImages } from "../../scripts/check-gallery-images.mjs";

test("gallery PNGs exist and every publicly served card remains preview-sized", async () => {
  const { galleryPreviews, publicCardImages } = await auditGalleryImages();
  assert.ok(galleryPreviews > 0);
  assert.ok(publicCardImages >= galleryPreviews);
});
