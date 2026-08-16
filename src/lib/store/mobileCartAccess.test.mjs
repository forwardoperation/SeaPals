import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  RULES_CHAT_PLACEMENTS,
  shouldRenderRulesChat,
} from "../../components/rules/rulesChatPresentation.mjs";

const storefront = await readFile(
  new URL("../../app/store/Storefront.jsx", import.meta.url),
  "utf8"
);

test("mobile shoppers can reach a non-empty cart in one tap", () => {
  assert.match(storefront, /const cartSummaryRef = useRef\(null\)/);
  assert.match(storefront, /id="store-cart-summary"/);
  assert.match(storefront, /ref=\{cartSummaryRef\}/);
  assert.match(storefront, /tabIndex=\{-1\}/);
  assert.match(storefront, /aria-controls="store-cart-summary"/);
  assert.match(storefront, /onClick=\{viewCart\}/);
  assert.match(storefront, />View cart</);
  assert.match(storefront, /cartCount > 0 &&\s*isCartSummaryAhead/);
  assert.match(storefront, /lg:hidden/);
});

test("the mobile cart dock avoids duplicate and obstructive presentation", () => {
  assert.match(storefront, /new IntersectionObserver/);
  assert.match(
    storefront,
    /entry\.boundingClientRect\.top\s*>=\s*viewportBottom/
  );
  assert.match(storefront, /!entry\.isIntersecting/);
  assert.match(storefront, /observer\.disconnect\(\)/);
  assert.match(storefront, /safe-area-inset-bottom/);
  assert.match(storefront, /safe-area-inset-left/);
  assert.match(storefront, /safe-area-inset-right/);
  assert.match(storefront, /pb-\[calc\(7rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(storefront, /aria-hidden="true"[\s\S]{0,300}\{cartCount\}/);
  assert.equal(
    shouldRenderRulesChat("/store", RULES_CHAT_PLACEMENTS.SITE),
    false,
    "Ask Finn must not overlap the fixed mobile cart dock"
  );
});

test("cart navigation respects reduced-motion preferences and moves focus", () => {
  assert.match(storefront, /\(prefers-reduced-motion: reduce\)/);
  assert.match(
    storefront,
    /behavior: prefersReducedMotion \? "auto" : "smooth"/
  );
  assert.match(storefront, /cartSummary\.focus\(\{ preventScroll: true \}\)/);
  assert.match(storefront, /focus-visible:ring-4/);
});
