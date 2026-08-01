import assert from "node:assert/strict";
import test from "node:test";
import {
  computeStripeWebhookSignature,
  createStripeCheckoutSession,
  parseStripeSignatureHeader,
  retrieveStripePaymentReceiptDetails,
  verifyStripeWebhookSignature,
} from "./stripe.mjs";

const payload = JSON.stringify({ id: "evt_test", type: "checkout.session.completed" });
const secret = "whsec_test_secret";
const timestamp = 1_800_000_000;

test("parseStripeSignatureHeader keeps all v1 signatures", () => {
  const result = parseStripeSignatureHeader(
    "t=1800000000,v1=first,v0=legacy,v1=second"
  );
  assert.equal(result.timestamp, timestamp);
  assert.deepEqual(result.signatures, ["first", "second"]);
});

test("verifyStripeWebhookSignature accepts a valid current signature", async () => {
  const signature = await computeStripeWebhookSignature(
    payload,
    timestamp,
    secret
  );
  const verified = await verifyStripeWebhookSignature(
    payload,
    `t=${timestamp},v1=${signature}`,
    secret,
    { nowMilliseconds: timestamp * 1000 }
  );
  assert.equal(verified, true);
});

test("verifyStripeWebhookSignature rejects tampering and stale events", async () => {
  const signature = await computeStripeWebhookSignature(
    payload,
    timestamp,
    secret
  );
  const header = `t=${timestamp},v1=${signature}`;

  assert.equal(
    await verifyStripeWebhookSignature(`${payload} `, header, secret, {
      nowMilliseconds: timestamp * 1000,
    }),
    false
  );
  assert.equal(
    await verifyStripeWebhookSignature(payload, header, secret, {
      nowMilliseconds: (timestamp + 301) * 1000,
    }),
    false
  );
});

test("verifyStripeWebhookSignature accepts any matching v1 signature", async () => {
  const signature = await computeStripeWebhookSignature(
    payload,
    timestamp,
    secret
  );
  const verified = await verifyStripeWebhookSignature(
    payload,
    `t=${timestamp},v1=bad,v1=${signature}`,
    secret,
    { nowMilliseconds: timestamp * 1000 }
  );
  assert.equal(verified, true);
});

test("checkout uses generic product labels and each item's tax code", async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  let request = null;

  process.env.STRIPE_SECRET_KEY = "sk_test_storefront";
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(
      JSON.stringify({ id: "cs_test_storefront", url: "https://checkout.stripe.com/test" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    await createStripeCheckoutSession({
      order: { id: "00000000-0000-4000-8000-000000000001", orderNumber: "SP-TEST" },
      quote: {
        shippingCents: 0,
        fulfillmentOption: {
          id: "standard",
          displayName: "Standard Shipping & Handling",
          fulfillmentMethod: "shipping",
          pickupLocation: null,
          amountCents: 0,
          deliveryEstimateMinDays: null,
          deliveryEstimateMaxDays: null,
        },
        items: [
          {
            productId: "card-binder",
            sku: "SP-MERCH-CARD-BINDER",
            category: "storage",
            name: "SeaPals Card Binder",
            checkoutDescription: "SeaPals card storage binder.",
            unitAmountCents: 2500,
            quantity: 1,
            taxCode: "txcd_99999999",
          },
        ],
      },
      configuration: {
        currency: "usd",
        automaticTaxEnabled: true,
        shippingTaxCode: "txcd_92010001",
        allowPromotionCodes: false,
        collectPhone: false,
        allowedCountries: ["US"],
      },
      siteUrl: "https://seapals.example",
    });

    const form = new URLSearchParams(request.options.body);
    const prefix = "line_items[0][price_data][product_data]";
    assert.equal(
      request.options.headers["Stripe-Version"],
      "2026-07-29.dahlia"
    );
    assert.equal(
      form.get("integration_identifier"),
      "seapals_store_web_kvqzrmta"
    );
    assert.equal(form.get("payment_method_types[0]"), null);
    assert.equal(form.get(`${prefix}[name]`), "SeaPals — SeaPals Card Binder");
    assert.equal(form.get(`${prefix}[tax_code]`), "txcd_99999999");
    assert.equal(form.get(`${prefix}[metadata][category]`), "storage");
    assert.equal(form.get("line_items[0][metadata][category]"), null);
    assert.equal(form.get("metadata[fulfillment_option_id]"), "standard");
    assert.equal(form.get("metadata[fulfillment_method]"), "shipping");
    assert.equal(
      form.get("shipping_options[0][shipping_rate_data][tax_code]"),
      "txcd_92010001"
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalSecret;
  }
});

test("checkout sends a twelve-line launch cart with Priority shipping", async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  let request = null;

  const items = Array.from({ length: 12 }, (_, index) => ({
    productId: `launch-product-${index + 1}`,
    sku: `SP-LAUNCH-${index + 1}`,
    category: index === 0 ? "starter-kits" : "game-accessories",
    name: `Launch Product ${index + 1}`,
    checkoutDescription: `Launch product ${index + 1}.`,
    unitAmountCents: 500 + index * 100,
    quantity: 1,
    taxCode: "txcd_99999999",
  }));

  process.env.STRIPE_SECRET_KEY = "sk_test_storefront";
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(
      JSON.stringify({
        id: "cs_test_launch_cart",
        url: "https://checkout.stripe.com/test",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    await createStripeCheckoutSession({
      order: {
        id: "00000000-0000-4000-8000-000000000011",
        orderNumber: "SP-LAUNCH-TEST",
      },
      quote: {
        shippingCents: 1250,
        fulfillmentOption: {
          id: "priority",
          displayName: "Priority Shipping & Handling",
          fulfillmentMethod: "shipping",
          pickupLocation: null,
          amountCents: 1250,
          deliveryEstimateMinDays: null,
          deliveryEstimateMaxDays: null,
        },
        items,
      },
      configuration: {
        currency: "usd",
        automaticTaxEnabled: false,
        allowPromotionCodes: false,
        collectPhone: false,
        allowedCountries: ["US"],
      },
      siteUrl: "https://seapals.example",
    });

    const form = new URLSearchParams(request.options.body);
    assert.equal(form.get("automatic_tax[enabled]"), "false");
    assert.equal(form.get("payment_method_types[0]"), null);
    assert.equal(form.get("line_items[11][quantity]"), "1");
    assert.equal(form.get("line_items[12][quantity]"), null);
    assert.equal(
      form.get("shipping_options[0][shipping_rate_data][fixed_amount][amount]"),
      "1250"
    );
    assert.equal(
      form.get("shipping_options[0][shipping_rate_data][display_name]"),
      "Priority Shipping & Handling"
    );
    assert.equal(
      form.get(
        "shipping_options[0][shipping_rate_data][metadata][fulfillment_option_id]"
      ),
      "priority"
    );
    assert.equal(
      form.get("shipping_address_collection[allowed_countries][0]"),
      "US"
    );
    assert.equal(form.get("metadata[fulfillment_option_id]"), "priority");
    assert.equal(
      form.get("shipping_options[0][shipping_rate_data][tax_code]"),
      null
    );

    for (let index = 0; index < items.length; index += 1) {
      const prefix = `line_items[${index}][price_data]`;
      assert.equal(
        form.get(`${prefix}[unit_amount]`),
        String(items[index].unitAmountCents)
      );
      assert.equal(form.get(`${prefix}[tax_behavior]`), null);
      assert.equal(form.get(`${prefix}[product_data][tax_code]`), null);
      assert.equal(
        form.get(`${prefix}[product_data][metadata][product_id]`),
        items[index].productId
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalSecret;
  }
});

test("checkout configures free Elverson pickup without a shipping address", async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  let request = null;

  process.env.STRIPE_SECRET_KEY = "sk_test_storefront";
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(
      JSON.stringify({
        id: "cs_test_pickup",
        url: "https://checkout.stripe.com/test",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    await createStripeCheckoutSession({
      order: {
        id: "00000000-0000-4000-8000-000000000012",
        orderNumber: "SP-PICKUP-TEST",
      },
      quote: {
        shippingCents: 0,
        fulfillmentOption: {
          id: "pickup-elverson-pa",
          displayName: "Local pickup — Elverson, PA",
          fulfillmentMethod: "pickup",
          pickupLocation: "Elverson, PA",
          amountCents: 0,
          deliveryEstimateMinDays: null,
          deliveryEstimateMaxDays: null,
        },
        items: [
          {
            productId: "starter-kit",
            sku: "SP-KIT-STARTER",
            category: "starter-kits",
            name: "Starter Kit",
            checkoutDescription: "SeaPals two-player Starter Kit.",
            unitAmountCents: 4400,
            quantity: 1,
            taxCode: "txcd_99999999",
          },
        ],
      },
      configuration: {
        currency: "usd",
        automaticTaxEnabled: false,
        allowPromotionCodes: false,
        collectPhone: false,
        allowedCountries: ["US"],
      },
      siteUrl: "https://seapals.example",
    });

    const form = new URLSearchParams(request.options.body);
    assert.equal(
      form.get("metadata[fulfillment_option_id]"),
      "pickup-elverson-pa"
    );
    assert.equal(form.get("metadata[fulfillment_method]"), "pickup");
    assert.equal(form.get("metadata[pickup_location]"), "Elverson, PA");
    assert.equal(
      form.get("payment_intent_data[metadata][fulfillment_method]"),
      "pickup"
    );
    assert.equal(
      form.get("custom_text[submit][message]"),
      "Local pickup in Elverson, PA. We will email when your order is ready."
    );
    assert.equal(
      form.get("shipping_address_collection[allowed_countries][0]"),
      null
    );
    assert.equal(
      form.get("shipping_options[0][shipping_rate_data][display_name]"),
      null
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalSecret;
  }
});

test("receipt details retain durable Stripe references", async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.STRIPE_SECRET_KEY;

  process.env.STRIPE_SECRET_KEY = "sk_test_storefront";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        id: "pi_test_receipt",
        latest_charge: {
          id: "ch_test_receipt",
          receipt_number: "1234-5678",
          receipt_url: "https://pay.stripe.com/receipts/test",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  try {
    assert.deepEqual(
      await retrieveStripePaymentReceiptDetails("pi_test_receipt"),
      {
        chargeId: "ch_test_receipt",
        receiptNumber: "1234-5678",
        receiptUrl: "https://pay.stripe.com/receipts/test",
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalSecret;
  }
});
