import assert from "node:assert/strict";
import test from "node:test";

import { drainFulfillmentDueNotifications } from "./fulfillmentDueNotificationDrain.mjs";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_ORDER_ID = "22222222-2222-4222-8222-222222222222";
const DUE_DATE = "2026-08-24";
const NOW = new Date("2026-08-22T15:30:00.000Z");
const ENVIRONMENT = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-with-enough-entropy",
  STORE_ORDER_NOTIFICATION_ENABLED: "true",
  STORE_FULFILLMENT_DUE_NOTIFICATION_ENABLED: "true",
  STORE_ORDER_NOTIFICATION_EMAIL: "maker@seapalstcg.com",
  EMAIL_FROM: "SeaPals <maker@seapalstcg.com>",
  RESEND_API_KEY: "re_test_notification_key",
  SITE_URL: "https://seapalstcg.com",
});

function orderFixture(id = ORDER_ID, overrides = {}) {
  return {
    id,
    order_number: id === ORDER_ID ? "SP-1001" : "SP-1002",
    created_at: "2026-08-18T18:00:00.000Z",
    updated_at: "2026-08-22T14:00:00.000Z",
    paid_at: "2026-08-17T18:01:00.000Z",
    customer_email: "buyer@example.com",
    customer_name: "Test Buyer",
    shipping_address: {
      name: "Test Buyer",
      address: {
        line1: "1 Ocean Way",
        city: "Elverson",
        state: "PA",
        postal_code: "19520",
        country: "US",
      },
    },
    currency: "usd",
    subtotal_cents: 2200,
    production_option_id: "standard-production",
    production_option_name: "Standard production",
    production_max_business_days: 5,
    production_cents: 0,
    production_due_date: null,
    fulfillment_method: "shipping",
    fulfillment_option_id: "ground-shipping",
    fulfillment_option_name: "Ground shipping",
    pickup_location: null,
    shipping_cents: 500,
    tax_cents: 162,
    total_cents: 2862,
    payment_status: "paid",
    fulfillment_status: "packing",
    tracking_number: null,
    tracking_url: null,
    internal_notes: null,
    payment_livemode: true,
    store_order_items: [
      {
        sku: "SP-DECK-BLUE-V01",
        product_name: "Blue Water Deck",
        unit_amount_cents: 2200,
        quantity: 1,
        line_total_cents: 2200,
      },
    ],
    ...overrides,
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("the due-reminder drainer prepares, revalidates, sends, and completes a notification", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url: parsed, options, body });

    if (
      parsed.pathname.endsWith(
        "/prepare_store_fulfillment_due_notifications"
      )
    ) {
      return jsonResponse([{ order_id: ORDER_ID, due_date: DUE_DATE }]);
    }
    if (parsed.pathname.endsWith("/claim_store_order_notification")) {
      return jsonResponse("claimed");
    }
    if (parsed.pathname === "/rest/v1/store_orders") {
      return jsonResponse([orderFixture()]);
    }
    if (parsed.hostname === "api.resend.com") {
      return jsonResponse({ id: "email_due_123" });
    }
    if (parsed.pathname.endsWith("/complete_store_order_notification")) {
      return jsonResponse(true);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const summary = await drainFulfillmentDueNotifications({
    environment: ENVIRONMENT,
    fetchImpl,
    now: NOW,
  });

  assert.deepEqual(summary, {
    queued: 1,
    delivered: 1,
    alreadySent: 0,
    busy: 0,
    stale: 0,
    failed: 0,
  });
  assert.deepEqual(
    calls.map(({ url }) => `${url.hostname}${url.pathname}`),
    [
      "example.supabase.co/rest/v1/rpc/prepare_store_fulfillment_due_notifications",
      "example.supabase.co/rest/v1/rpc/claim_store_order_notification",
      "example.supabase.co/rest/v1/store_orders",
      "api.resend.com/emails",
      "example.supabase.co/rest/v1/rpc/complete_store_order_notification",
    ]
  );
  assert.deepEqual(calls[0].body, {
    p_limit: 25,
    p_now: "2026-08-22T15:30:00.000Z",
  });
  assert.equal(
    calls[1].body.p_notification_type,
    "merchant_fulfillment_due"
  );
  assert.match(calls[2].url.searchParams.get("select"), /production_due_date/);
  assert.match(calls[2].url.searchParams.get("select"), /fulfillment_status/);
  assert.doesNotMatch(
    calls[2].url.searchParams.get("select"),
    /customer_email|customer_name|shipping_address|internal_notes|store_order_items/
  );
  assert.equal(
    calls[4].body.p_notification_type,
    "merchant_fulfillment_due"
  );
  assert.equal(calls[4].body.p_provider_message_id, "email_due_123");
});

test("a claimed reminder that became ready is completed as stale without sending", async () => {
  let resendCalls = 0;
  let completeCalls = 0;
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    if (
      parsed.pathname.endsWith(
        "/prepare_store_fulfillment_due_notifications"
      )
    ) {
      return jsonResponse([{ order_id: ORDER_ID, due_date: DUE_DATE }]);
    }
    if (parsed.pathname.endsWith("/claim_store_order_notification")) {
      return jsonResponse("claimed");
    }
    if (parsed.pathname === "/rest/v1/store_orders") {
      return jsonResponse([
        orderFixture(ORDER_ID, { fulfillment_status: "awaiting_shipment" }),
      ]);
    }
    if (parsed.hostname === "api.resend.com") {
      resendCalls += 1;
      throw new Error("a stale reminder must not send");
    }
    if (parsed.pathname.endsWith("/complete_store_order_notification")) {
      completeCalls += 1;
      return jsonResponse(true);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const summary = await drainFulfillmentDueNotifications({
    environment: ENVIRONMENT,
    fetchImpl,
    now: NOW,
  });

  assert.equal(summary.stale, 1);
  assert.equal(summary.delivered, 0);
  assert.equal(resendCalls, 0);
  assert.equal(completeCalls, 1);
});

test("a busy lease is counted while the rest of the batch continues", async () => {
  let resendCalls = 0;
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const body = options.body ? JSON.parse(options.body) : null;
    if (
      parsed.pathname.endsWith(
        "/prepare_store_fulfillment_due_notifications"
      )
    ) {
      return jsonResponse([
        { order_id: ORDER_ID, due_date: DUE_DATE },
        { order_id: SECOND_ORDER_ID, due_date: DUE_DATE },
      ]);
    }
    if (parsed.pathname.endsWith("/claim_store_order_notification")) {
      return jsonResponse(body.p_order_id === ORDER_ID ? "busy" : "claimed");
    }
    if (parsed.pathname === "/rest/v1/store_orders") {
      const orderId = parsed.searchParams.get("id").slice(3);
      return jsonResponse([orderFixture(orderId)]);
    }
    if (parsed.hostname === "api.resend.com") {
      resendCalls += 1;
      return jsonResponse({ id: "email_second" });
    }
    if (parsed.pathname.endsWith("/complete_store_order_notification")) {
      return jsonResponse(true);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const summary = await drainFulfillmentDueNotifications({
    environment: ENVIRONMENT,
    fetchImpl,
    now: NOW,
  });

  assert.deepEqual(summary, {
    queued: 2,
    delivered: 1,
    alreadySent: 0,
    busy: 1,
    stale: 0,
    failed: 0,
  });
  assert.equal(resendCalls, 1);
});

test("delivery failures release their lease, continue the batch, and expose a safe summary", async () => {
  const paths = [];
  let resendCalls = 0;
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const body = options.body ? JSON.parse(options.body) : null;
    paths.push(parsed.pathname);
    if (
      parsed.pathname.endsWith(
        "/prepare_store_fulfillment_due_notifications"
      )
    ) {
      return jsonResponse([
        { order_id: ORDER_ID, due_date: DUE_DATE },
        { order_id: SECOND_ORDER_ID, due_date: DUE_DATE },
      ]);
    }
    if (parsed.pathname.endsWith("/claim_store_order_notification")) {
      return jsonResponse("claimed");
    }
    if (parsed.pathname === "/rest/v1/store_orders") {
      const orderId = parsed.searchParams.get("id").slice(3);
      return jsonResponse([orderFixture(orderId)]);
    }
    if (parsed.hostname === "api.resend.com") {
      resendCalls += 1;
      return resendCalls === 1
        ? jsonResponse({ error: "not exposed" }, 503)
        : jsonResponse({ id: "email_second" });
    }
    if (parsed.pathname.endsWith("/release_store_order_notification")) {
      assert.equal(
        body.p_notification_type,
        "merchant_fulfillment_due"
      );
      return jsonResponse(true);
    }
    if (parsed.pathname.endsWith("/complete_store_order_notification")) {
      return jsonResponse(true);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  await assert.rejects(
    drainFulfillmentDueNotifications({
      environment: ENVIRONMENT,
      fetchImpl,
      now: NOW,
    }),
    (error) => {
      assert.equal(
        error.code,
        "fulfillment_due_notification_drain_partial_failure"
      );
      assert.deepEqual(error.summary, {
        queued: 2,
        delivered: 1,
        alreadySent: 0,
        busy: 0,
        stale: 0,
        failed: 1,
      });
      assert.doesNotMatch(error.message, /503|not exposed|buyer@example/);
      return true;
    }
  );
  assert.ok(paths.includes("/rest/v1/rpc/release_store_order_notification"));
  assert.equal(resendCalls, 2);
});

test("a disabled reminder drain pauses cleanly before the private queue is read", async () => {
  let calls = 0;
  const summary = await drainFulfillmentDueNotifications({
    environment: {
      ...ENVIRONMENT,
      STORE_FULFILLMENT_DUE_NOTIFICATION_ENABLED: "false",
    },
    fetchImpl: async () => {
      calls += 1;
      throw new Error("should not run");
    },
    now: NOW,
  });
  assert.deepEqual(summary, {
    queued: 0,
    delivered: 0,
    alreadySent: 0,
    busy: 0,
    stale: 0,
    failed: 0,
    disabled: true,
  });
  assert.equal(calls, 0);
});

test("the drainer rejects invalid limits, clocks, and prepared rows", async () => {
  await assert.rejects(
    drainFulfillmentDueNotifications({
      environment: ENVIRONMENT,
      fetchImpl: async () => jsonResponse([]),
      limit: 51,
      now: NOW,
    }),
    (error) => error.code === "fulfillment_due_notification_limit_invalid"
  );

  await assert.rejects(
    drainFulfillmentDueNotifications({
      environment: ENVIRONMENT,
      fetchImpl: async () => jsonResponse([]),
      now: "not-a-date",
    }),
    (error) => error.code === "fulfillment_due_notification_now_invalid"
  );

  await assert.rejects(
    drainFulfillmentDueNotifications({
      environment: ENVIRONMENT,
      fetchImpl: async () =>
        jsonResponse([{ order_id: ORDER_ID, due_date: "2026-02-30" }]),
      now: NOW,
    }),
    (error) => error.code === "fulfillment_due_notification_prepare_invalid"
  );
});
