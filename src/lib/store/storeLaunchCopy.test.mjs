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

test("public launch copy advertises the seven decks and Accessories Kit", () => {
  assert.match(
    storefrontSource,
    /Seven ready-to-play SeaPals decks and the Accessories Kit, built\s+to order for your next reef\./
  );
  assert.match(
    storePageSource,
    /Shop seven made-to-order SeaPals ready-to-play decks and the Accessories Kit/
  );
  assert.match(
    storePageSource,
    /Preview seven made-to-order SeaPals ready-to-play decks and the Accessories Kit/
  );
  assert.doesNotMatch(
    storePageSource,
    /Shop made-to-order SeaPals starter kits/
  );
});
