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

test("public launch copy advertises only the seven enabled decks", () => {
  assert.match(
    storefrontSource,
    /Seven ready-to-play SeaPals decks, built to order for your next\s+reef\./
  );
  assert.match(
    storePageSource,
    /Shop seven made-to-order SeaPals ready-to-play decks/
  );
  assert.match(
    storePageSource,
    /Preview seven made-to-order SeaPals ready-to-play decks/
  );
  assert.doesNotMatch(
    storePageSource,
    /Shop made-to-order SeaPals starter kits/
  );
});
