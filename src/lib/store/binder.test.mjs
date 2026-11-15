import assert from "node:assert/strict";
import test from "node:test";
import { storeProductDefinitions, storeLaunchProductIds } from "../../data/store/products.js";
import { storeShippingOptionDefinitions } from "../../data/store/shipping.js";
import { storeProductionOptionDefinitions } from "../../data/store/production.js";
import { quoteCart } from "./cart.mjs";
import { createStripeCheckoutSession } from "./stripe.mjs";

const binder = storeProductDefinitions.find((product) => product.id === "card-binder");
const products = storeProductDefinitions.map((product) => ({
  ...product, available: true, priceCents: product.defaultPriceCents,
}));
const items = [{ productId: "card-binder", quantity: 1 }];
const pickup = storeShippingOptionDefinitions.find((option) => option.fulfillmentMethod === "pickup");
const priority = storeShippingOptionDefinitions.find((option) => option.id === "priority");
const expedited = storeProductionOptionDefinitions.find((option) => option.expedited);

test("binder orders cost $40 each plus one $9.99 shipping charge, or free pickup", () => {
  assert.ok(storeLaunchProductIds.includes(binder.id));
  assert.equal(binder.inventoryTracked, false);
  for (const quantity of [1, 2, 8]) {
    for (const fulfillmentOption of [null, pickup]) {
      const quote = quoteCart([{ productId: binder.id, quantity }], products, { fulfillmentOption });
      assert.equal(quote.subtotalCents, 4000 * quantity);
      assert.equal(quote.shippingCents, fulfillmentOption ? 0 : 999);
      assert.equal(quote.totalCents, 4000 * quantity + (fulfillmentOption ? 0 : 999));
      assert.equal(quote.productionCents, 0);
      assert.equal(quote.productionOption.leadTimeWeeks, 5);
      assert.equal(quote.productionMaxBusinessDays, 25);
      assert.equal(quote.fulfillmentType, "regular");
    }
  }
});

test("binder fulfillment restrictions are enforced against direct checkout requests", () => {
  assert.throws(() => quoteCart(items, products, { fulfillmentOption: priority }), { code: "binder_expedited_shipping_unavailable" });
  assert.throws(() => quoteCart(items, products, { productionOption: expedited }), { code: "binder_expedited_production_unavailable" });
  for (const productId of ["starter-kit", "deep-dive-pack", "accessory-set"]) {
    assert.throws(() => quoteCart([...items, { productId, quantity: 1 }], products), { code: "binder_separate_order_required" });
  }
  const ordinary = quoteCart([{ productId: "deep-dive-pack", quantity: 1 }], products, { fulfillmentOption: priority, productionOption: expedited });
  assert.equal(ordinary.productionMaxBusinessDays, 1);
  assert.equal(ordinary.productionCents, 1000);
  assert.equal(ordinary.shippingCents, 1000);
});

test("Stripe receives binder totals, five-week timing, and no shorter delivery estimate", async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_binder";
  const forms = [];
  globalThis.fetch = async (_url, options) => {
    forms.push(new URLSearchParams(options.body));
    return Response.json({ id: "cs_test_binder", url: "https://checkout.stripe.com/test" });
  };
  try {
    for (const fulfillmentOption of [null, pickup]) {
      const quote = quoteCart(items, products, { fulfillmentOption });
      await createStripeCheckoutSession({
        order: { id: "00000000-0000-4000-8000-000000000001", orderNumber: "SP-BINDER", inventoryReservationExpiresAt: new Date(Date.now() + 3600000).toISOString() },
        quote,
        configuration: { currency: "usd", allowPromotionCodes: false, paymentMethodConfiguration: "pmc_test_sync", allowedCountries: ["US"], pickupTaxConfirmed: true, pickupTaxRateId: "txr_test_pickup" },
        returnOrigin: "https://searealm.com",
      });
    }
    for (const [index, form] of forms.entries()) {
      assert.equal(form.get("line_items[0][price_data][unit_amount]"), "4000");
      assert.equal(form.get("metadata[production_max_business_days]"), "25");
      assert.equal(form.get("metadata[production_lead_time_weeks]"), "5");
      assert.match(form.get("custom_text[submit][message]"), /5-week lead time/);
      assert.match(form.get("custom_text[submit][message]"), index ? /pickup is free/ : /\$9\.99 per order/);
      assert.equal([...form.keys()].some((key) => key.includes("delivery_estimate")), false);
      assert.equal(form.get("shipping_options[0][shipping_rate_data][fixed_amount][amount]"), index ? null : "999");
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalSecret;
  }
});
