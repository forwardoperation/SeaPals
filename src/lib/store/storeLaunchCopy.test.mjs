import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const storefrontSource = readFileSync(
  new URL("../../app/store/Storefront.jsx", import.meta.url),
  "utf8"
);
const storePageSource = readFileSync(
  new URL("../../app/store/page.jsx", import.meta.url),
  "utf8"
);
const homePageSource = readFileSync(
  new URL("../../app/page.jsx", import.meta.url),
  "utf8"
);

test("public launch copy advertises the Starter Kit, seven decks, three Dive Packs, and Accessories Kit", () => {
  assert.match(storefrontSource, />\s*Master the Sea\s*</);
  assert.doesNotMatch(storefrontSource, /Choose how your reef grows\./);
  assert.match(
    storefrontSource,
    /The two-player Starter Kit, seven ready-to-play SeaPals decks,\s+three set-specific Dive Packs, and the Accessories Kit, built\s+to order for your next reef\./
  );
  assert.match(
    storePageSource,
    /Shop the made-to-order SeaPals Starter Kit, seven ready-to-play decks, three set-specific Dive Packs, and the Accessories Kit/
  );
  assert.match(
    storePageSource,
    /Preview the made-to-order SeaPals Starter Kit, seven ready-to-play decks, three set-specific Dive Packs, and the Accessories Kit/
  );
  assert.match(
    homePageSource,
    /Shop the Starter Kit, individual decks, set-specific Dive\s+Packs, and the Accessories Kit in one place\./
  );
  assert.match(storefrontSource, /label: "Dive Packs"/);
  assert.doesNotMatch(
    [storefrontSource, storePageSource, homePageSource].join("\n"),
    /booster[ -]?packs?/i
  );
});
