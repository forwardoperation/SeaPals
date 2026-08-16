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

test("public launch copy advertises the Starter Kit, seven decks, and Accessories Kit", () => {
  assert.match(
    storefrontSource,
    /The two-player Starter Kit, seven ready-to-play SeaPals decks,\s+and the Accessories Kit, built to order for your next reef\./
  );
  assert.match(
    storePageSource,
    /Shop the made-to-order SeaPals Starter Kit, seven ready-to-play decks, and the Accessories Kit/
  );
  assert.match(
    storePageSource,
    /Preview the made-to-order SeaPals Starter Kit, seven ready-to-play decks, and the Accessories Kit/
  );
  assert.match(
    homePageSource,
    /Shop the Starter Kit, individual decks, and the Accessories\s+Kit in one place\./
  );
});
