import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getStorePreorderCampaign } from "../../data/store/preorders.js";

const storefrontSource = readFileSync(
  new URL("../../app/store/Storefront.jsx", import.meta.url),
  "utf8"
);
const storeHeroSource = readFileSync(
  new URL("../../app/store/StoreHero.jsx", import.meta.url),
  "utf8"
);
const productDetailsSource = readFileSync(
  new URL("../../app/store/ProductDetails.jsx", import.meta.url),
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

test("the shop hero uses the collection headline and metadata describes the products", () => {
  assert.match(storeHeroSource, /Collect all the Cards and Become a[\s\S]*Master of the Sea!/);
  assert.match(storefrontSource, /<StoreHero cards=\{heroCards\}/);
  assert.doesNotMatch(storeHeroSource, /SeaRealm shop|Checkout open|<p\b/);
  assert.doesNotMatch(storefrontSource, /Choose how your reef grows\./);
  assert.match(
    storePageSource,
    /Shop Oceanic, Reef, and Deep Dive Packs, game accessories, and Christmas pre-orders for the SeaRealm Starter Kit and expansion decks/
  );
  assert.match(
    storePageSource,
    /Preview Oceanic, Reef, and Deep Dive Packs, game accessories, and Christmas pre-orders for the SeaRealm Starter Kit and expansion decks/
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
  assert.doesNotMatch(
    [storefrontSource, storePageSource].join("\n"),
    /made-to-order SeaRealm Starter Kit|built to order for your next reef|Pelagic Rush|Coral Bloom|Abyssal Glow/
  );
});

test("the holiday banner gives the December 11 cutoff and Christmas delivery guarantee", () => {
  const campaign = getStorePreorderCampaign("2026-10-16T12:00:00.000Z");
  assert.equal(campaign.headline, "Pre-Order Today!");
  assert.match(
    campaign.message,
    /Starter Kits and Expansion Decks are pre-orders for Christmas 2026/
  );
  assert.match(
    campaign.message,
    /Orders placed before December 11, 2026 \(Eastern Time\) are guaranteed delivery before Christmas/
  );
  assert.match(storefrontSource, /preorderCampaign\.headline/);
  assert.match(storefrontSource, /preorderCampaign\.message/);
  assert.match(storefrontSource, /Starter Kits &amp; Expansion Decks/);
});

test("Dive Packs appear before the preorder products and preorder buttons identify the purchase", () => {
  const categoryOrder = storefrontSource.match(/const CATEGORY_ORDER = \[([\s\S]*?)\];/)?.[1];
  assert.ok(categoryOrder);
  assert.deepEqual(
    [...categoryOrder.matchAll(/"([^\"]+)"/g)].slice(0, 4).map((match) => match[1]),
    ["dive-packs", "starter-kits", "expansion-decks", "game-accessories"]
  );
  assert.match(storefrontSource, /"Pre-order"/);
  assert.match(storefrontSource, /"Add another pre-order"/);
});

test("the Starter Kit clearly explains the complete two-player setup and optional deck demos", () => {
  assert.match(
    storefrontSource,
    /One Starter Kit gives two players a ready-to-play deck each, plus the shared Conditions Deck/
  );
  assert.match(productDetailsSource, />\s*One kit supports two players\s*</);
  assert.match(productDetailsSource, /\{product\.playerSetupNote\}/);
  assert.match(productDetailsSource, /Preview the \{trialDecks\.length > 1 \? "decks" : "deck"\}/);
  assert.match(productDetailsSource, /product\.simulatorNote \|\|/);
  assert.match(
    productDetailsSource,
    /Preview \{retailName\} online/
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
    /Optional ready-to-play 60-card decks for different strategies\. The Starter Kit already includes Coral Garden and Drop Off\./
  );
});

test("compact product cards link photos and names to details while retaining concise deck previews", () => {
  const cardStart = storefrontSource.indexOf("{group.products.map(");
  const cardEnd = storefrontSource.indexOf("</article>", cardStart);
  assert.ok(cardStart >= 0 && cardEnd > cardStart);
  const cardSource = storefrontSource.slice(cardStart, cardEnd);

  assert.equal(
    cardSource.match(/href=\{getStoreProductPath\(product\.id\)\}/g)?.length,
    2
  );
  assert.match(cardSource, /href=\{getStoreProductPath\(product\.id\)\}[\s\S]*?<Image/);
  assert.match(cardSource, /<h4\b[\s\S]*?<Link href=\{getStoreProductPath\(product\.id\)\}[\s\S]*?\{product\.name\}/);
  assert.doesNotMatch(cardSource, /product\.(?:description|playerSetupNote|includedItems|details)\b/);
  assert.match(cardSource, /product\.trialDecks\?\.length/);
  assert.match(cardSource, /href=\{deck\.href\}/);
  assert.match(cardSource, /`Preview \$\{deckName\}` : "Preview deck"/);
  assert.match(productDetailsSource, /\{product\.description\}/);
  assert.match(productDetailsSource, /includedItems\.map/);
});
