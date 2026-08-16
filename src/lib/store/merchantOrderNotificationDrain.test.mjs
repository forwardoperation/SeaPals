import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { drainMerchantPurchaseNotifications } from "./merchantOrderNotificationDrain.mjs";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const ENVIRONMENT = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-with-enough-entropy",
  STORE_ORDER_NOTIFICATION_ENABLED: "true",
  STORE_ORDER_NOTIFICATION_EMAIL: "maker@seapalstcg.com",
  EMAIL_FROM: "SeaPals <maker@seapalstcg.com>",
  RESEND_API_KEY: "re_test_notification_key",
  SITE_URL: "https://seapalstcg.com",
});
const ORDER = Object.freeze({
  id: ORDER_ID,
  order_number: "SP-1001",
  paid_at: "2026-08-14T18:00:00.000Z",
  customer_email: "buyer@example.com",
  customer_name: "Test Buyer",
  shipping_address: null,
  currency: "usd",
  subtotal_cents: 2200,
  production_option_id: "standard-production",
  production_option_name: "Standard production",
  production_max_business_days: 5,
  production_cents: 0,
  production_due_date: "2026-08-21",
  fulfillment_method: "pickup",
  fulfillment_option_id: "pickup-elverson-pa",
  fulfillment_option_name: "Scheduled pickup — Elverson, PA",
  pickup_location: "Elverson, PA",
  shipping_cents: 0,
  tax_cents: 132,
  total_cents: 2332,
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
});

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("the scheduled drainer claims, sends, and completes each pending paid-order alert", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url: parsed, options, body });

    if (parsed.pathname.endsWith("/list_pending_store_order_notifications")) {
      return jsonResponse([{ order_id: ORDER_ID }]);
    }
    if (parsed.pathname.endsWith("/claim_store_order_notification")) {
      return jsonResponse("claimed");
    }
    if (parsed.pathname === "/rest/v1/store_orders") {
      return jsonResponse([ORDER]);
    }
    if (parsed.hostname === "api.resend.com") {
      return jsonResponse({ id: "email_123" });
    }
    if (parsed.pathname.endsWith("/complete_store_order_notification")) {
      return jsonResponse(true);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const summary = await drainMerchantPurchaseNotifications({
    environment: ENVIRONMENT,
    fetchImpl,
  });

  assert.deepEqual(summary, {
    queued: 1,
    delivered: 1,
    alreadySent: 0,
    busy: 0,
    failed: 0,
  });
  assert.deepEqual(
    calls.map(({ url }) => `${url.hostname}${url.pathname}`),
    [
      "example.supabase.co/rest/v1/rpc/list_pending_store_order_notifications",
      "example.supabase.co/rest/v1/rpc/claim_store_order_notification",
      "example.supabase.co/rest/v1/store_orders",
      "api.resend.com/emails",
      "example.supabase.co/rest/v1/rpc/complete_store_order_notification",
    ]
  );
  assert.equal(calls[0].body.p_limit, 25);
  assert.equal(calls[1].body.p_order_id, ORDER_ID);
  assert.equal(calls[3].options.headers["Idempotency-Key"],
    `seapals-merchant_purchase-${ORDER_ID}`);
  assert.equal(calls[4].body.p_provider_message_id, "email_123");
});

test("a webhook-held notification lease is skipped without sending a second email", async () => {
  let resendCalls = 0;
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/list_pending_store_order_notifications")) {
      return jsonResponse([{ order_id: ORDER_ID }]);
    }
    if (parsed.pathname.endsWith("/claim_store_order_notification")) {
      return jsonResponse("busy");
    }
    if (parsed.hostname === "api.resend.com") resendCalls += 1;
    throw new Error(`Unexpected request: ${url}`);
  };

  const summary = await drainMerchantPurchaseNotifications({
    environment: ENVIRONMENT,
    fetchImpl,
  });
  assert.equal(summary.busy, 1);
  assert.equal(summary.delivered, 0);
  assert.equal(resendCalls, 0);
});

test("delivery failures release the lease and fail the cron after the batch", async () => {
  const paths = [];
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    paths.push(parsed.pathname);
    if (parsed.pathname.endsWith("/list_pending_store_order_notifications")) {
      return jsonResponse([{ order_id: ORDER_ID }]);
    }
    if (parsed.pathname.endsWith("/claim_store_order_notification")) {
      return jsonResponse("claimed");
    }
    if (parsed.pathname === "/rest/v1/store_orders") {
      return jsonResponse([ORDER]);
    }
    if (parsed.hostname === "api.resend.com") {
      return jsonResponse({ error: "not exposed" }, 503);
    }
    if (parsed.pathname.endsWith("/release_store_order_notification")) {
      return jsonResponse(true);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  await assert.rejects(
    drainMerchantPurchaseNotifications({ environment: ENVIRONMENT, fetchImpl }),
    (error) => {
      assert.equal(error.code, "merchant_notification_drain_partial_failure");
      assert.equal(error.summary.failed, 1);
      return true;
    }
  );
  assert.equal(
    paths.at(-1),
    "/rest/v1/rpc/release_store_order_notification"
  );
});

test("invalid email configuration fails before reading the private queue", async () => {
  let calls = 0;
  await assert.rejects(
    drainMerchantPurchaseNotifications({
      environment: { ...ENVIRONMENT, RESEND_API_KEY: "" },
      fetchImpl: async () => {
        calls += 1;
        throw new Error("should not run");
      },
    }),
    (error) => error.code === "merchant_email_not_configured"
  );
  assert.equal(calls, 0);
});

test("the OpenNext custom worker retains fetch and adds the exact five-minute cron", () => {
  const worker = readFileSync(
    new URL("../../../custom-worker.mjs", import.meta.url),
    "utf8"
  );
  const wrangler = readFileSync(
    new URL("../../../wrangler.jsonc", import.meta.url),
    "utf8"
  );

  assert.match(worker, /import openNextWorker from "\.\/\.open-next\/worker\.js"/);
  assert.match(worker, /async fetch\(request, environment, context\)/);
  assert.match(
    worker,
    /return openNextWorker\.fetch\(request, environment, context\)/
  );
  assert.match(worker, /async scheduled\(controller, environment\)/);
  assert.match(worker, /drainMerchantPurchaseNotifications\(\{ environment \}\)/);
  assert.match(worker, /reconcileOverdueInventoryReservations\(\{ environment \}\)/);
  assert.match(worker, /Promise\.allSettled/);
  assert.match(worker, /DOQueueHandler/);
  assert.match(wrangler, /"main": "custom-worker\.mjs"/);
  assert.match(wrangler, /"crons": \["\*\/5 \* \* \* \*"\]/);
});
