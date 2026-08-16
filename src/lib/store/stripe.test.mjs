import assert from "node:assert/strict";
import test from "node:test";
import {
  assertStripeCheckoutConfiguration,
  computeStripeWebhookSignature,
  createStripeCheckoutSession,
  expireStripeCheckoutSession,
  parseStripeSignatureHeader,
  retrieveStripeCheckoutSession,
  retrieveStripePaymentOwnership,
  retrieveStripePaymentReceiptDetails,
  verifyStripeWebhookSignature,
} from "./stripe.mjs";

const payload = JSON.stringify({ id: "evt_test", type: "checkout.session.completed" });
const secret = "whsec_test_secret";
const timestamp = 1_800_000_000;

test("promotion codes fail closed until discounted totals are reconciled", async () => {
  let fetchCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCount += 1;
    throw new Error("Stripe must not be called");
  };

  try {
    assert.throws(
      () => assertStripeCheckoutConfiguration({ allowPromotionCodes: true }),
      (error) =>
        error?.code === "promotion_codes_not_supported" && error?.status === 503
    );

    await assert.rejects(
      createStripeCheckoutSession({
        order: {},
        quote: {},
        configuration: { allowPromotionCodes: true },
        siteUrl: "https://seapals.example",
      }),
      (error) =>
        error?.code === "promotion_codes_not_supported" && error?.status === 503
    );
    assert.equal(fetchCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkout fails closed without a Stripe-compatible inventory deadline", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    throw new Error("Stripe must not be called");
  };

  try {
    await assert.rejects(
      createStripeCheckoutSession({
        order: {
          id: "00000000-0000-4000-8000-000000000001",
          orderNumber: "SP-TEST",
        },
        quote: {},
        configuration: { allowPromotionCodes: false },
        siteUrl: "https://seapals.example",
      }),
      (error) =>
        error?.code === "inventory_reservation_deadline_invalid" &&
        error?.status === 503
    );
    assert.equal(fetchCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkout fails closed without a synchronous payment-method configuration", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    throw new Error("Stripe must not be called");
  };

  try {
    await assert.rejects(
      createStripeCheckoutSession({
        order: {
          id: "00000000-0000-4000-8000-000000000001",
          orderNumber: "SP-TEST",
          inventoryReservationExpiresAt: new Date(
            Date.now() + 60 * 60 * 1000
          ).toISOString(),
        },
        quote: { items: [] },
        configuration: {
          allowPromotionCodes: false,
          paymentMethodConfiguration: null,
        },
        siteUrl: "https://seapals.example",
      }),
      (error) => error?.code === "payment_method_configuration_required"
    );
    assert.equal(fetchCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("scheduled pickup fails closed without both owner confirmation and a Tax Rate ID", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    throw new Error("Stripe must not be called");
  };

  const order = {
    id: "00000000-0000-4000-8000-000000000099",
    orderNumber: "SP-PICKUP-TAX-GATE",
    inventoryReservationExpiresAt: new Date(
      Date.now() + 60 * 60 * 1000
    ).toISOString(),
  };
  const quote = {
    fulfillmentOption: {
      id: "pickup-elverson-pa",
      displayName: "Scheduled pickup — Elverson, PA",
      fulfillmentMethod: "pickup",
      pickupLocation: "Elverson, PA",
      amountCents: 0,
    },
    items: [],
  };
  const configuration = {
    allowPromotionCodes: false,
    paymentMethodConfiguration: "pmc_test_synchronous",
    pickupTaxRateId: "txr_test_elverson_pa",
  };

  try {
    await assert.rejects(
      createStripeCheckoutSession({
        order,
        quote,
        configuration,
        siteUrl: "https://seapals.example",
      }),
      (error) => error?.code === "pickup_tax_not_configured"
    );
    await assert.rejects(
      createStripeCheckoutSession({
        order,
        quote,
        configuration: {
          ...configuration,
          pickupTaxConfirmed: true,
          pickupTaxRateId: "not-a-tax-rate",
        },
        siteUrl: "https://seapals.example",
      }),
      (error) => error?.code === "pickup_tax_not_configured"
    );
    assert.equal(fetchCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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
      order: {
        id: "00000000-0000-4000-8000-000000000001",
        orderNumber: "SP-TEST",
        inventoryReservationExpiresAt: new Date(
          Date.now() + 60 * 60 * 1000
        ).toISOString(),
      },
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
        paymentMethodConfiguration: "pmc_test_synchronous",
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
    assert.ok(Number(form.get("expires_at")) > Math.floor(Date.now() / 1000));
    assert.equal(form.get("payment_method_types[0]"), null);
    assert.equal(form.get("automatic_tax[enabled]"), "true");
    assert.equal(form.get("line_items[0][tax_rates][0]"), null);
    assert.equal(form.get(`${prefix}[name]`), "SeaPals — SeaPals Card Binder");
    assert.equal(form.get(`${prefix}[tax_code]`), "txcd_99999999");
    assert.equal(form.get(`${prefix}[metadata][category]`), "storage");
    assert.equal(form.get("line_items[0][metadata][category]"), null);
    assert.equal(form.get("metadata[fulfillment_option_id]"), "standard");
    assert.equal(form.get("metadata[fulfillment_method]"), "shipping");
    assert.equal(
      form.get("metadata[production_option_id]"),
      "standard-production"
    );
    assert.equal(form.get("metadata[production_cents]"), "0");
    assert.equal(
      form.get("payment_intent_data[metadata][production_max_business_days]"),
      "5"
    );
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

test("checkout charges expedited production once and copies its signed snapshot", async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  let request = null;

  process.env.STRIPE_SECRET_KEY = "sk_test_storefront";
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return Response.json({
      id: "cs_test_expedited",
      url: "https://checkout.stripe.com/expedited",
    });
  };

  try {
    await createStripeCheckoutSession({
      order: {
        id: "00000000-0000-4000-8000-000000000021",
        orderNumber: "SP-EXPEDITED-TEST",
        inventoryReservationExpiresAt: new Date(
          Date.now() + 60 * 60 * 1000
        ).toISOString(),
      },
      quote: {
        productionOptionId: "expedited-production",
        productionOptionName: "Expedited production",
        productionMaxBusinessDays: 1,
        productionCents: 1000,
        shippingCents: 1000,
        fulfillmentOption: {
          id: "standard",
          displayName: "Standard Shipping & Handling",
          fulfillmentMethod: "shipping",
          pickupLocation: null,
          amountCents: 1000,
          deliveryEstimateMinDays: 2,
          deliveryEstimateMaxDays: 7,
        },
        items: [
          {
            productId: "starter-kit",
            sku: "SP-KIT-STARTER",
            category: "starter-kits",
            name: "Starter Kit",
            checkoutDescription: "SeaPals two-player Starter Kit.",
            unitAmountCents: 4400,
            quantity: 2,
            taxCode: "txcd_99999999",
          },
        ],
      },
      configuration: {
        currency: "usd",
        automaticTaxEnabled: true,
        shippingTaxCode: "txcd_92010001",
        productionTaxCode: "txcd_92010004",
        allowPromotionCodes: false,
        paymentMethodConfiguration: "pmc_test_synchronous",
        collectPhone: false,
        allowedCountries: ["US"],
      },
      siteUrl: "https://seapals.example",
    });

    const form = new URLSearchParams(request.options.body);
    const prefix = "line_items[1][price_data]";
    assert.equal(form.get("line_items[1][quantity]"), "1");
    assert.equal(form.get(`${prefix}[unit_amount]`), "1000");
    assert.equal(
      form.get(`${prefix}[product_data][name]`),
      "Expedited production"
    );
    assert.equal(
      form.get(`${prefix}[product_data][description]`),
      "Build and dispatch within 1 business day; carrier transit time not included."
    );
    assert.equal(
      form.get(`${prefix}[product_data][tax_code]`),
      "txcd_92010004"
    );
    assert.equal(form.get(`${prefix}[tax_behavior]`), "exclusive");
    assert.equal(
      form.get("metadata[production_option_id]"),
      "expedited-production"
    );
    assert.equal(form.get("metadata[production_option_name]"), "Expedited production");
    assert.equal(form.get("metadata[production_max_business_days]"), "1");
    assert.equal(form.get("metadata[production_cents]"), "1000");
    assert.equal(
      form.get(
        "shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]"
      ),
      "3"
    );
    assert.equal(
      form.get(
        "shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]"
      ),
      "8"
    );
    assert.equal(
      form.get("payment_intent_data[metadata][production_option_id]"),
      "expedited-production"
    );
    assert.equal(
      form.get("payment_intent_data[metadata][production_cents]"),
      "1000"
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalSecret;
  }
});

test("checkout sends an eight-item launch cart with Priority shipping", async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  let request = null;

  const items = Array.from({ length: 8 }, (_, index) => ({
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
        inventoryReservationExpiresAt: new Date(
          Date.now() + 60 * 60 * 1000
        ).toISOString(),
      },
      quote: {
        shippingCents: 1500,
        fulfillmentOption: {
          id: "priority",
          displayName: "Priority Shipping & Handling",
          fulfillmentMethod: "shipping",
          pickupLocation: null,
          amountCents: 1500,
          deliveryEstimateMinDays: 2,
          deliveryEstimateMaxDays: 3,
        },
        items,
      },
      configuration: {
        currency: "usd",
        automaticTaxEnabled: false,
        allowPromotionCodes: false,
        paymentMethodConfiguration: "pmc_test_synchronous",
        collectPhone: false,
        allowedCountries: ["US"],
      },
      siteUrl: "https://seapals.example",
    });

    const form = new URLSearchParams(request.options.body);
    assert.equal(form.get("automatic_tax[enabled]"), "false");
    assert.equal(form.get("payment_method_types[0]"), null);
    assert.equal(form.get("line_items[7][quantity]"), "1");
    assert.equal(form.get("line_items[8][quantity]"), null);
    assert.equal(
      form.get("shipping_options[0][shipping_rate_data][fixed_amount][amount]"),
      "1500"
    );
    assert.equal(
      form.get("shipping_options[0][shipping_rate_data][display_name]"),
      "Priority Shipping & Handling"
    );
    assert.equal(
      form.get(
        "shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]"
      ),
      "7"
    );
    assert.equal(
      form.get(
        "shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]"
      ),
      "8"
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
        inventoryReservationExpiresAt: new Date(
          Date.now() + 60 * 60 * 1000
        ).toISOString(),
      },
      quote: {
        productionOptionId: "expedited-production",
        productionOptionName: "Expedited production",
        productionMaxBusinessDays: 1,
        productionCents: 1000,
        shippingCents: 0,
        fulfillmentOption: {
          id: "pickup-elverson-pa",
          displayName: "Scheduled pickup — Elverson, PA",
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
        automaticTaxEnabled: true,
        allowPromotionCodes: false,
        paymentMethodConfiguration: "pmc_test_synchronous",
        pickupTaxConfirmed: true,
        pickupTaxRateId: "txr_test_elverson_pa",
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
    assert.equal(
      form.get("metadata[fulfillment_option_name]"),
      "Scheduled pickup — Elverson, PA"
    );
    assert.equal(form.get("metadata[pickup_location]"), "Elverson, PA");
    assert.equal(
      form.get("payment_intent_data[metadata][fulfillment_method]"),
      "pickup"
    );
    assert.equal(
      form.get("custom_text[submit][message]"),
      "Scheduled pickup in Elverson, PA is free. We will email after your order is built to arrange a pickup time."
    );
    assert.equal(form.get("automatic_tax[enabled]"), "false");
    assert.equal(
      form.get("line_items[0][tax_rates][0]"),
      "txr_test_elverson_pa"
    );
    assert.equal(
      form.get("line_items[1][tax_rates][0]"),
      "txr_test_elverson_pa"
    );
    assert.equal(
      form.get("line_items[0][price_data][product_data][tax_code]"),
      null
    );
    assert.equal(
      form.get("line_items[1][price_data][product_data][tax_code]"),
      null
    );
    assert.equal(
      form.get("shipping_address_collection[allowed_countries][0]"),
      null
    );
    assert.equal(
      form.get("shipping_options[0][shipping_rate_data][display_name]"),
      null
    );
    assert.equal(form.get("line_items[1][quantity]"), "1");
    assert.equal(
      form.get("line_items[1][price_data][product_data][description]"),
      "Build and mark ready for pickup within 1 business day."
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

test("payment ownership recovers order metadata through Charge and PaymentIntent", async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const requestedPaths = [];

  process.env.STRIPE_SECRET_KEY = "sk_test_storefront";
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    requestedPaths.push(path);
    if (path === "/v1/charges/ch_test_dispute") {
      return Response.json({
        id: "ch_test_dispute",
        payment_intent: "pi_test_dispute",
        metadata: {},
      });
    }
    if (path === "/v1/payment_intents/pi_test_dispute") {
      return Response.json({
        id: "pi_test_dispute",
        metadata: {
          order_id: "00000000-0000-4000-8000-000000000001",
          order_number: "SP-TEST",
        },
      });
    }
    return Response.json({ error: { message: "unexpected request" } }, { status: 404 });
  };

  try {
    assert.deepEqual(
      await retrieveStripePaymentOwnership({
        chargeId: "ch_test_dispute",
        paymentIntentId: null,
      }),
      {
        chargeId: "ch_test_dispute",
        paymentIntentId: "pi_test_dispute",
        orderId: "00000000-0000-4000-8000-000000000001",
        orderNumber: "SP-TEST",
      }
    );
    assert.deepEqual(requestedPaths, [
      "/v1/charges/ch_test_dispute",
      "/v1/payment_intents/pi_test_dispute",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalSecret;
  }
});

test("scheduled reconciliation passes its Worker secret explicitly and expires idempotently", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: new URL(url), options });
    return Response.json({
      object: "checkout.session",
      id: "cs_test_scheduled_reconciliation",
      status: options.method === "POST" ? "expired" : "open",
    });
  };

  try {
    await retrieveStripeCheckoutSession("cs_test_scheduled_reconciliation", {
      secretKey: "rk_test_worker_reconciliation",
    });
    await expireStripeCheckoutSession("cs_test_scheduled_reconciliation", {
      secretKey: "rk_test_worker_reconciliation",
      idempotencyKey:
        "seapals-reservation-expire-cs_test_scheduled_reconciliation",
    });

    assert.equal(requests.length, 2);
    assert.equal(
      requests[0].options.headers.Authorization,
      "Bearer rk_test_worker_reconciliation"
    );
    assert.deepEqual(requests[0].url.searchParams.getAll("expand[]"), [
      "payment_intent.latest_charge",
    ]);
    assert.equal(requests[1].options.method, "POST");
    assert.equal(
      requests[1].options.headers["Idempotency-Key"],
      "seapals-reservation-expire-cs_test_scheduled_reconciliation"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
