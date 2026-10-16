import assert from "node:assert/strict";
import test from "node:test";
import {
  STORE_PREORDER_CAMPAIGN,
  getStorePreorderCampaign,
  getStorePreorderConfirmation,
  getStorePreorderFulfillmentLabel,
  orderContainsStorePreorders,
} from "../../data/store/preorders.js";
import { quoteCart } from "./cart.mjs";
import { buildStoreOrderReservationArguments } from "./inventory.mjs";
import { fulfillmentDueDateForOrder } from "./fulfillmentDueReminder.mjs";
import { createStripeCheckoutSession } from "./stripe.mjs";

const preorderProduct = {
  id: "starter-kit",
  sku: "SP-KIT-STARTER",
  name: "Starter Kit",
  category: "starter-kits",
  preorder: true,
  checkoutDescription: "Two-player Starter Kit.",
  available: true,
  priceCents: 4400,
  shippingWeightOunces: 16,
};

test("Christmas guarantee ends strictly before December 11 in Eastern Time", () => {
  assert.equal(getStorePreorderCampaign("2026-12-11T04:59:59.999Z").guaranteeOpen, true);
  assert.equal(getStorePreorderCampaign("2026-12-11T05:00:00.000Z").guaranteeOpen, false);
  assert.equal(getStorePreorderCampaign("2026-12-12T12:00:00.000Z").christmasUpcoming, true);
  assert.equal(getStorePreorderCampaign("2026-12-25T05:00:00.000Z").christmasUpcoming, false);
  assert.doesNotMatch(getStorePreorderCampaign("2027-10-16").message, /guaranteed|Christmas/);
  assert.doesNotMatch(getStorePreorderFulfillmentLabel("2027-10-16"), /Christmas/);
  assert.equal(getStorePreorderCampaign("invalid").guaranteeOpen, false);
  assert.equal(getStorePreorderCampaign(null).guaranteeOpen, false);
});

test("preorder quotes preserve totals and typed snapshots and reject rush production", () => {
  const quote = quoteCart([{ productId: "starter-kit", quantity: 1 }], [preorderProduct], {
    now: new Date("2026-10-16T12:00:00Z"),
  });
  assert.equal(quote.containsPreorders, true);
  assert.equal(quote.productionCents, 0);
  assert.equal(quote.productionOptionId, "standard-production");
  assert.equal(quote.subtotalCents, 4400);
  assert.equal(quote.totalCents, 5400);
  assert.equal(quote.preorderCampaign.guaranteeOpen, true);

  const snapshot = buildStoreOrderReservationArguments({ quote });
  assert.equal(snapshot.p_items[0].product_name, "Starter Kit");
  assert.equal(snapshot.p_items[0].fulfillment_type, "preorder");
  assert.equal(snapshot.p_items[0].preorder_campaign_id, "christmas-2026");
  assert.equal(snapshot.p_items[0].preorder_cutoff_at, STORE_PREORDER_CAMPAIGN.orderBefore);
  assert.equal(snapshot.p_items[0].preorder_delivery_by, "2026-12-24");
  assert.equal(snapshot.p_items[0].preorder_fulfillment_date, "2026-12-11");
  assert.equal(orderContainsStorePreorders({ store_order_items: snapshot.p_items }), true);
  assert.equal(fulfillmentDueDateForOrder({
    production_option_id: "standard-production",
    production_max_business_days: 5,
    paid_at: "2026-10-16T12:00:00Z",
    store_order_items: snapshot.p_items,
  }), null);

  assert.throws(() => quoteCart([{ productId: "starter-kit", quantity: 1 }], [preorderProduct], {
    productionOption: { id: "expedited-production" },
  }), (error) => error.code === "preorder_expedited_unavailable");

  const divePack = {
    ...preorderProduct,
    id: "oceanic-dive-pack",
    category: "dive-packs",
    preorder: false,
    priceCents: 1000,
    shippingWeightOunces: 1,
  };
  assert.throws(() => quoteCart([
    { productId: "starter-kit", quantity: 1, preorder: false },
    { productId: "oceanic-dive-pack", quantity: 1 },
  ], [preorderProduct, divePack], {
    productionOption: { id: "expedited-production" },
  }), (error) => error.code === "preorder_expedited_unavailable");
  assert.equal(quoteCart([{ productId: "oceanic-dive-pack", quantity: 1 }], [divePack], {
    productionOption: { id: "expedited-production" },
  }).productionCents, 1000);
  assert.throws(() => quoteCart([{ productId: "starter-kit", quantity: 1 }], [{ ...preorderProduct, available: false }]),
    (error) => error.code === "unavailable_product");
});

test("confirmation determines Christmas eligibility from payment time, including sessions opened before the cutoff", () => {
  const session = {
    metadata: { preorder_campaign_id: "christmas-2026", preorder_campaign_year: "2026" },
    payment_status: "paid",
    payment_intent: { latest_charge: { created: Date.parse("2026-12-11T04:59:00Z") / 1000 } },
  };
  const paymentRecord = (paidAt) => ({
    payment_status: "paid", paid_at: paidAt, fulfillment_type: "preorder",
    preorder_campaign_id: "christmas-2026", preorder_delivery_guaranteed: true,
  });
  assert.match(getStorePreorderConfirmation(session, paymentRecord("2026-12-11T04:59:59Z")), /guaranteed/);
  assert.doesNotMatch(getStorePreorderConfirmation(session, paymentRecord("2026-12-11T05:00:00Z")), /guaranteed/);
  assert.doesNotMatch(getStorePreorderConfirmation(session), /guaranteed/);
  assert.doesNotMatch(getStorePreorderConfirmation({ ...session, payment_status: "unpaid" }, paymentRecord("2026-12-11T04:59:59Z")), /guaranteed/);
  assert.equal(getStorePreorderConfirmation({}), null);
});

test("hosted checkout labels preorder fulfillment and omits ordinary short delivery estimates", async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  let form;
  process.env.STRIPE_SECRET_KEY = "sk_test_preorders";
  globalThis.fetch = async (_url, options) => {
    form = new URLSearchParams(options.body);
    return new Response(JSON.stringify({ id: "cs_test_preorders", url: "https://checkout.stripe.com/test" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const quote = quoteCart([{ productId: "starter-kit", quantity: 1 }], [preorderProduct]);
    await createStripeCheckoutSession({
      order: {
        id: "00000000-0000-4000-8000-000000000001",
        orderNumber: "SP-PREORDER",
        inventoryReservationExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      quote,
      configuration: {
        currency: "usd",
        allowPromotionCodes: false,
        automaticTaxEnabled: false,
        paymentMethodConfiguration: "pmc_test_synchronous",
        collectPhone: false,
        allowedCountries: ["US"],
      },
      returnOrigin: "https://searealm.com",
    });
    assert.equal(form.get("metadata[preorder_campaign_year]"), "2026");
    assert.equal(form.get("metadata[preorder_campaign_id]"), "christmas-2026");
    assert.equal(form.get("metadata[fulfillment_type]"), "preorder");
    assert.equal(form.get("line_items[0][price_data][product_data][metadata][fulfillment_type]"), "preorder");
    assert.equal(form.get("payment_intent_data[metadata][preorder_order_before]"), "2026-12-11T05:00:00.000Z");
    assert.match(form.get("line_items[0][price_data][product_data][name]"), /\(pre-order\)/);
    assert.match(form.get("custom_text[submit][message]"), /ship together/);
    assert.equal(form.get("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]"), null);
    assert.equal(form.get("line_items[1][price_data][unit_amount]"), null);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalSecret;
  }
});


test("client preorder flags and schedules cannot change a server catalog snapshot", () => {
  const divePack = {
    ...preorderProduct, id: "oceanic-dive-pack", sku: "SP-DIVE-OCEANIC",
    category: "dive-packs", preorder: false, priceCents: 1000, shippingWeightOunces: 1,
  };
  const quote = quoteCart([
    { productId: "starter-kit", quantity: 1, preorder: false, fulfillmentType: "regular", preorderDeliveryBy: "2026-10-20" },
    { productId: "oceanic-dive-pack", quantity: 1, preorder: true, fulfillmentType: "preorder" },
  ], [preorderProduct, divePack]);
  assert.equal(quote.fulfillmentType, "mixed");
  assert.equal(quote.items[0].fulfillmentType, "preorder");
  assert.equal(quote.items[0].preorderDeliveryBy, "2026-12-24");
  assert.equal(quote.items[1].fulfillmentType, "regular");
  assert.equal(quote.items[1].preorderCampaignId, null);
  assert.equal(quote.totalQuantity, 2);
  assert.equal(quote.subtotalCents, 5400);
});

test("historical ordinary orders retain regular fulfillment even for today's preorder SKUs", () => {
  const order = {
    fulfillment_type: "regular", production_option_id: "standard-production",
    production_max_business_days: 5, paid_at: "2026-10-16T12:00:00Z",
    store_order_items: [{ product_id: "starter-kit", product_name: "Starter Kit", fulfillment_type: "regular" }],
  };
  assert.equal(orderContainsStorePreorders(order), false);
  assert.equal(fulfillmentDueDateForOrder(order), "2026-10-23");
  assert.equal(getStorePreorderConfirmation({ payment_status: "paid" }, order), null);
});

test("paid guaranteed preorders and mixed orders use the stored holiday reminder target", () => {
  for (const type of ["preorder", "mixed"]) {
    const order = {
      fulfillment_type: type, preorder_campaign_id: "christmas-2026",
      preorder_fulfillment_date: "2026-12-11", preorder_delivery_guaranteed: true,
      production_option_id: "standard-production", production_max_business_days: 5,
      paid_at: "2026-10-16T12:00:00Z",
    };
    assert.equal(fulfillmentDueDateForOrder(order), "2026-12-11");
    assert.equal(fulfillmentDueDateForOrder({ ...order, preorder_delivery_guaranteed: false }), null);
    assert.equal(fulfillmentDueDateForOrder({ ...order, preorder_delivery_guaranteed: null }), null);
  }
});
