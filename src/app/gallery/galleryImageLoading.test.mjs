import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const galleryPage = readFileSync(new URL("./page.jsx", import.meta.url), "utf8");

test("gallery card grids lazy-load every image", () => {
  const typeSection = galleryPage.slice(
    galleryPage.indexOf("function TypeSection"),
    galleryPage.indexOf("function ZoneSection")
  );

  assert.match(typeSection, /<Image[\s\S]*?loading="lazy"/);
  assert.doesNotMatch(typeSection, /loading=[{]?[^\n]*eager/);
  assert.doesNotMatch(typeSection, /images\.map\(\(image, index\)/);
});
