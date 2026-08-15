import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMerchantPurchaseEmail,
  deliverMerchantPurchaseNotification,
  merchantPurchaseIdempotencyKey,
  sendMerchantPurchaseEmail,
} from "./merchantOrderEmail.mjs";

const ORDER_ID = "00000000-0000-4000-8000-000000000001";

function paidOrder(overrides = {}) {
  return {
    id: ORDER_ID,
    order_number: "SP-260814-REEF01",
    paid_at: "2026-08-14T16:00:00.000Z",
    customer_email: "buyer@example.com",
    customer_name: "Alex <script>alert(1)</script>",
    shipping_address: {
      name: "Alex Example",
      phone: "555-0100",
      address: {
        line1: "123 Reef Road",
        line2: "Apt 2",
        city: "Reading",
        state: "PA",
        postal_code: "19601",
        country: "US",
      },
    },
    currency: "usd",
    subtotal_cents: 5600,
    production_option_id: "standard-production",
    production_option_name: "Standard production",
    production_max_business_days: 5,
    production_cents: 0,
    production_due_date: null,
    fulfillment_method: "shipping",
    fulfillment_option_id: "priority",
    fulfillment_option_name: "Priority Shipping & Handling",
    pickup_location: null,
    shipping_cents: 1500,
    tax_cents: 426,
    total_cents: 7526,
    payment_livemode: true,
    store_order_items: [
      {
        sku: "SP-RP-TOK-V1",
        product_name: "Reef Point Tokens",
        unit_amount_cents: 1200,
        quantity: 1,
        line_total_cents: 1200,
      },
      {
        sku: "SP-DECK-BW-V1",
        product_name: "Blue Water Deck",
        unit_amount_cents: 2200,
        quantity: 2,
        line_total_cents: 4400,
      },
    ],
    ...overrides,
  };
}

const configuredEnvironment = {
  STORE_ORDER_NOTIFICATION_ENABLED: "true",
  STORE_ORDER_NOTIFICATION_EMAIL: "maker@seapalstcg.com",
  RESEND_API_KEY: "test-provider-secret",
  EMAIL_FROM: "SeaPals Orders <orders@seapalstcg.com>",
  SITE_URL: "https://seapalstcg.com",
};

test("merchant email lists every quantity, total, production choice, shipping detail, and private admin link", () => {
  const email = buildMerchantPurchaseEmail(paidOrder(), configuredEnvironment);

  assert.equal(
    email.subject,
    "New SeaPals order SP-260814-REEF01 — $75.26"
  );
  assert.match(
    email.text,
    /2 × Blue Water Deck \(SP-DECK-BW-V1\) — \$22\.00 each — \$44\.00/
  );
  assert.match(
    email.text,
    /1 × Reef Point Tokens \(SP-RP-TOK-V1\) — \$12\.00 each — \$12\.00/
  );
  assert.match(
    email.text,
    /Production: Standard production — \$0\.00 — up to 5 business days/
  );
  assert.match(
    email.text,
    /Fulfillment: Priority Shipping & Handling — \$15\.00/
  );
  assert.match(email.text, /Ship to[\s\S]*123 Reef Road[\s\S]*Reading PA 19601/);
  assert.match(email.text, /Products: \$56\.00/);
  assert.match(email.text, /Shipping & handling: \$15\.00/);
  assert.match(email.text, /Tax: \$4\.26/);
  assert.match(email.text, /Total paid: \$75\.26/);
  assert.match(
    email.text,
    /https:\/\/seapalstcg\.com\/admin\/orders\?order=00000000-0000-4000-8000-000000000001/
  );
  assert.doesNotMatch(email.html, /<script>alert\(1\)<\/script>/);
  assert.match(email.html, /Alex &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("rush scheduled-pickup email is explicit that the owner must arrange a time after the build", () => {
  const email = buildMerchantPurchaseEmail(
    paidOrder({
      subtotal_cents: 5600,
      production_option_id: "expedited-production",
      production_option_name: "Expedited production",
      production_max_business_days: 1,
      production_cents: 1000,
      production_due_date: "2026-08-17",
      fulfillment_method: "pickup",
      fulfillment_option_id: "pickup-elverson-pa",
      fulfillment_option_name: "Scheduled pickup — Elverson, PA",
      pickup_location: "Elverson, PA",
      shipping_address: {},
      shipping_cents: 0,
      tax_cents: 396,
      total_cents: 6996,
      payment_livemode: false,
    }),
    configuredEnvironment
  );

  assert.match(email.subject, /^\[TEST\] \[RUSH\] New SeaPals order/);
  assert.match(
    email.text,
    /Production: Expedited production — \$10\.00 — 1 business day — due Aug 17, 2026/
  );
  assert.match(
    email.text,
    /Fulfillment: Scheduled pickup — Elverson, PA — free; arrange a pickup time with the customer after the order is ready/
  );
  assert.match(email.text, /Scheduled pickup: \$0\.00/);
  assert.doesNotMatch(email.text, /Ship to/);
});

test("Resend request uses the stable order idempotency key and customer reply-to without putting the API key in the body", async () => {
  let request;
  const result = await sendMerchantPurchaseEmail({
    order: paidOrder(),
    environment: configuredEnvironment,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "email_merchant_123" }),
      };
    },
  });

  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(
    request.options.headers["Idempotency-Key"],
    merchantPurchaseIdempotencyKey(ORDER_ID)
  );
  assert.equal(
    request.options.headers.Authorization,
    "Bearer test-provider-secret"
  );
  const body = JSON.parse(request.options.body);
  assert.equal(body.to, "maker@seapalstcg.com");
  assert.equal(body.reply_to, "buyer@example.com");
  assert.doesNotMatch(request.options.body, /test-provider-secret/);
  assert.equal(result.providerMessageId, "email_merchant_123");
});

test("notifications require the explicit launch gate", async () => {
  await assert.rejects(
    sendMerchantPurchaseEmail({
      order: paidOrder(),
      environment: { ...configuredEnvironment, STORE_ORDER_NOTIFICATION_ENABLED: "false" },
      fetchImpl: async () => {
        throw new Error("must not send");
      },
    }),
    (error) => error.code === "merchant_email_not_enabled"
  );
});

test("provider failures expose only a safe retry code and never provider response contents", async () => {
  let responseBodyRead = false;
  await assert.rejects(
    sendMerchantPurchaseEmail({
      order: paidOrder(),
      environment: configuredEnvironment,
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        text: async () => {
          responseBodyRead = true;
          return "buyer@example.com private provider response";
        },
      }),
    }),
    (error) =>
      error.code === "resend_http_503" &&
      !error.message.includes("buyer@example.com")
  );
  assert.equal(responseBodyRead, false);
});

test("outbox orchestration claims, sends, and marks one notification complete", async () => {
  const calls = [];
  const result = await deliverMerchantPurchaseNotification({
    orderId: ORDER_ID,
    claimToken: "10000000-0000-4000-8000-000000000001",
    environment: configuredEnvironment,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: "email_accepted" }),
    }),
    claim: async (details) => {
      calls.push(["claim", details]);
      return "claimed";
    },
    loadOrder: async (details) => {
      calls.push(["load", details]);
      return paidOrder();
    },
    complete: async (details) => {
      calls.push(["complete", details]);
      return true;
    },
    release: async (details) => calls.push(["release", details]),
  });

  assert.deepEqual(result, { status: "sent", delivered: true });
  assert.deepEqual(
    calls.map(([name]) => name),
    ["claim", "load", "complete"]
  );
  assert.equal(calls[2][1].providerMessageId, "email_accepted");
});

test("an already-sent outbox row does not send again", async () => {
  let fetchCount = 0;
  const result = await deliverMerchantPurchaseNotification({
    orderId: ORDER_ID,
    environment: configuredEnvironment,
    fetchImpl: async () => {
      fetchCount += 1;
      throw new Error("must not send");
    },
    claim: async () => "sent",
    loadOrder: async () => paidOrder(),
    complete: async () => true,
    release: async () => true,
  });

  assert.deepEqual(result, { status: "sent", delivered: false });
  assert.equal(fetchCount, 0);
});

test("a failed email releases its lease for the next Stripe webhook retry", async () => {
  const releases = [];
  await assert.rejects(
    deliverMerchantPurchaseNotification({
      orderId: ORDER_ID,
      claimToken: "10000000-0000-4000-8000-000000000001",
      environment: configuredEnvironment,
      fetchImpl: async () => ({ ok: false, status: 429 }),
      claim: async () => "claimed",
      loadOrder: async () => paidOrder(),
      complete: async () => true,
      release: async (details) => {
        releases.push(details);
        return true;
      },
    }),
    (error) => error.code === "resend_http_429"
  );
  assert.equal(releases.length, 1);
  assert.equal(releases[0].failureCode, "resend_http_429");
});

test("a concurrent claim stays retryable and does not send a duplicate", async () => {
  let fetchCount = 0;
  await assert.rejects(
    deliverMerchantPurchaseNotification({
      orderId: ORDER_ID,
      environment: configuredEnvironment,
      fetchImpl: async () => {
        fetchCount += 1;
      },
      claim: async () => "busy",
      loadOrder: async () => paidOrder(),
      complete: async () => true,
      release: async () => true,
    }),
    (error) => error.code === "merchant_notification_busy"
  );
  assert.equal(fetchCount, 0);
});
