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
const storeProductsSource = readFileSync(
  new URL("../../data/store/products.js", import.meta.url),
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
    /The two-player Starter Kit, plus optional ready-to-play SeaPals\s+decks, three set-specific Dive Packs, and the Accessories Kit,\s+built to order for your next reef\./
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

test("the Starter Kit clearly explains the complete two-player setup and optional deck demos", () => {
  assert.match(
    storefrontSource,
    /One Starter Kit gives two players a ready-to-play deck each, plus the shared Conditions Deck/
  );
  assert.match(storefrontSource, />\s*One kit supports two players\s*</);
  assert.match(storefrontSource, />\s*Optional online deck demos\s*</);
  assert.match(
    storefrontSource,
    /`Preview \$\{deck\.name\.replace\(\/\\s\+Deck\$\/i, ""\)\} online`/
  );
  assert.match(
    storeProductsSource,
    /One Starter Kit provides both decks needed for two players:[\s\S]*No second kit or extra deck is required; just bring a few small counters for damage or HP\./
  );
  assert.match(
    storeProductsSource,
    /Both physical decks are already included\.[\s\S]*optional links simply open either deck in our free simulator/
  );
  assert.match(
    storefrontSource,
    /Optional ready-to-play 60-card decks for different strategies\. The Starter Kit already includes Coral Garden and Blue Water\./
  );
});
