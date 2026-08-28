import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [headerSource, footerSource, homeSource] = await Promise.all([
  readFile(
    new URL("../../components/layout/Header.jsx", import.meta.url),
    "utf8"
  ),
  readFile(
    new URL("../../components/layout/SiteFooter.jsx", import.meta.url),
    "utf8"
  ),
  readFile(new URL("../../app/page.jsx", import.meta.url), "utf8"),
]);

test("the shared primary navigation exposes one active-aware Store tab", () => {
  assert.equal(headerSource.match(/href="\/store"/g)?.length, 1);
  assert.match(headerSource, />\s*Store\s*<\/Link>/);
  assert.match(
    headerSource,
    /aria-current=\{pathname\.startsWith\("\/store"\) \? "page" : undefined\}/
  );
});

test("the shared footer keeps shopping and deck trials within reach", () => {
  assert.match(footerSource, /href="\/store"/);
  assert.match(footerSource, />\s*Store\s*<\/Link>/);
  assert.match(footerSource, /href="\/simulator"/);
  assert.match(footerSource, />\s*Try a Deck\s*<\/Link>/);
});

test("the homepage provides a complete try-before-you-buy path", () => {
  assert.ok((homeSource.match(/href="\/store"/g)?.length ?? 0) >= 3);
  assert.match(homeSource, /Explore the Store/);
  assert.match(homeSource, /Try before you buy/);
  assert.match(homeSource, /href="\/decks"/);
  assert.match(homeSource, /href="\/instructions\/tutorial"/);
  assert.match(homeSource, /href="#signup"/);
  assert.match(homeSource, /final launch checks/);
  assert.doesNotMatch(homeSource, /sales tax license/i);
});

test("the homepage uses the canonical Gallery artwork for Coral Reef", () => {
  assert.match(homeSource, /\/images\/cards\/habitats\/coral-reef\.webp/);
  assert.doesNotMatch(homeSource, /\/images\/cards\/coral-reef\.png/);
});
