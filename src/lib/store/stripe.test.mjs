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
        allowPromotionCodes: false,
        collectPhone: false,
        allowedCountries: ["US"],
      },
      siteUrl: "https://seapals.example",
    });

    const form = new URLSearchParams(request.options.body);
    const prefix = "line_items[0][price_data][product_data]";
    assert.equal(form.get(`${prefix}[name]`), "SeaPals — SeaPals Card Binder");
    assert.equal(form.get(`${prefix}[tax_code]`), "txcd_99999999");
    assert.equal(form.get(`${prefix}[metadata][category]`), "storage");
    assert.equal(form.get("line_items[0][metadata][category]"), null);
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
