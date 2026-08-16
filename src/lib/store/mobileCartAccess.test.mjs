import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  RULES_CHAT_PLACEMENTS,
  shouldRenderRulesChat,
} from "../../components/rules/rulesChatPresentation.mjs";
import {
  isCartSummaryAheadOfViewport,
  shouldShowMobileCartDock,
} from "./mobileCartAccess.mjs";

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
  assert.match(storefront, /shouldShowMobileCartDock\(\{/);
  assert.match(storefront, /lg:hidden/);
});

test("the mobile cart dock avoids duplicate and obstructive presentation", () => {
  assert.match(storefront, /new IntersectionObserver/);
  assert.match(
    storefront,
    /setIsCartSummaryAhead\(isCartSummaryAheadOfViewport\(entry\)\)/
  );
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

test("the mobile cart dock returns when the shopper scrolls back above the cart", () => {
  const dockState = (entry) =>
    shouldShowMobileCartDock({
      checkoutEnabled: true,
      cartReady: true,
      cartCount: 1,
      isCartSummaryAhead: isCartSummaryAheadOfViewport(entry),
    });

  assert.deepEqual(
    [
      dockState({
        isIntersecting: false,
        boundingClientRect: { top: 900 },
        rootBounds: { top: 0, bottom: 800 },
      }),
      dockState({
        isIntersecting: true,
        boundingClientRect: { top: 650 },
        rootBounds: { top: 0, bottom: 800 },
      }),
      dockState({
        isIntersecting: false,
        boundingClientRect: { top: -200 },
        rootBounds: { top: 0, bottom: 800 },
      }),
      dockState({
        isIntersecting: false,
        boundingClientRect: { top: 799.5 },
        rootBounds: { top: 0, bottom: 800 },
      }),
    ],
    [true, false, false, true]
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
