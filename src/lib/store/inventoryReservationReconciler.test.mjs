import assert from "node:assert/strict";
import test from "node:test";

import {
  reconcileOverdueInventoryReservations,
  STORE_INVENTORY_RECONCILIATION_BATCH_LIMIT,
  STORE_INVENTORY_RECONCILIATION_LEASE_SECONDS,
  STORE_INVENTORY_RECONCILIATION_RETRY_SECONDS,
} from "./inventoryReservationReconciler.mjs";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_ORDER_ID = "22222222-2222-4222-8222-222222222222";
const CLAIM_TOKEN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECOND_CLAIM_TOKEN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SESSION_ID = "cs_test_inventory_reconciliation";
const ENVIRONMENT = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-with-enough-entropy",
  STRIPE_SECRET_KEY: "rk_test_reconciliation_key",
});

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function checkoutSession({
  orderId = ORDER_ID,
  sessionId = SESSION_ID,
  status = "expired",
  paymentStatus = "unpaid",
  livemode = false,
} = {}) {
  return {
    object: "checkout.session",
    id: sessionId,
    mode: "payment",
    status,
    payment_status: paymentStatus,
    livemode,
    client_reference_id: orderId,
    metadata: {
      order_id: orderId,
      order_number: "SP-TEST-1",
      inventory_reservation: "v1",
      production_option_id: "standard-production",
      production_option_name: "Standard production",
      production_max_business_days: "5",
      production_cents: "0",
      fulfillment_method: "shipping",
      fulfillment_option_id: "standard",
      fulfillment_option_name: "Standard Shipping & Handling",
    },
    currency: "usd",
    amount_subtotal: 2200,
    amount_total: 3300,
    total_details: { amount_shipping: 1000, amount_tax: 100 },
    shipping_cost: { shipping_rate: "shr_test_standard" },
    customer_details: { email: "buyer@example.com", name: "Test Buyer" },
    collected_information: {
      shipping_details: {
        name: "Test Buyer",
        address: {
          line1: "1 Test Street",
          city: "Testville",
          state: "PA",
          postal_code: "19000",
          country: "US",
        },
      },
    },
    payment_intent:
      paymentStatus === "paid"
        ? {
            id: "pi_test_reconciliation",
            latest_charge: {
              id: "ch_test_reconciliation",
              receipt_url: "https://pay.stripe.com/receipts/test",
              receipt_number: "TEST-1",
            },
          }
        : null,
  };
}

function createStoreFetch({
  orderIds = [ORDER_ID],
  checkoutSessionIds = new Map([[ORDER_ID, SESSION_ID]]),
  paymentLivemode = false,
} = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const name = parsed.pathname.split("/").at(-1);
    const body = JSON.parse(options.body || "{}");
    calls.push({ name, body, options });

    if (name === "list_overdue_store_inventory_reservations") {
      return jsonResponse(orderIds.map((orderId) => ({ order_id: orderId })));
    }
    if (name === "claim_overdue_store_inventory_reservation") {
      return jsonResponse([
        {
          claim_status: "claimed",
          order_id: body.p_order_id,
          checkout_session_id: checkoutSessionIds.get(body.p_order_id) ?? null,
          payment_livemode: paymentLivemode,
        },
      ]);
    }
    if (
      [
        "release_store_inventory_reconciliation_claim",
        "complete_store_inventory_reconciliation_claim",
        "process_store_payment_event",
      ].includes(name)
    ) {
      return jsonResponse(true);
    }
    throw new Error(`Unexpected request: ${parsed.pathname}`);
  };
  return { calls, fetchImpl };
}

function options(overrides = {}) {
  return {
    environment: ENVIRONMENT,
    nowMilliseconds: Date.parse("2026-08-15T20:00:00.000Z"),
    randomUUID: () => CLAIM_TOKEN,
    ...overrides,
  };
}

test("a Stripe-confirmed expired Session releases an overdue reservation through the payment RPC", async () => {
  const store = createStoreFetch();
  let expireCalls = 0;
  const summary = await reconcileOverdueInventoryReservations(
    options({
      fetchImpl: store.fetchImpl,
      retrieveSession: async () => checkoutSession(),
      expireSession: async () => {
        expireCalls += 1;
      },
    })
  );

  assert.deepEqual(summary, {
    queued: 1,
    claimed: 1,
    committed: 0,
    released: 1,
    held: 0,
    busy: 0,
    skipped: 0,
    failed: 0,
  });
  assert.equal(expireCalls, 0);
  assert.deepEqual(
    store.calls.map(({ name }) => name),
    [
      "list_overdue_store_inventory_reservations",
      "claim_overdue_store_inventory_reservation",
      "process_store_payment_event",
      "complete_store_inventory_reconciliation_claim",
    ]
  );
  const processCall = store.calls.find(
    ({ name }) => name === "process_store_payment_event"
  );
  assert.equal(processCall.body.p_event_type, "checkout.session.expired");
  assert.equal(processCall.body.p_payment_status, "failed");
  assert.equal(processCall.body.p_order_id, ORDER_ID);
  assert.equal(processCall.body.p_checkout_session_id, SESSION_ID);
  assert.equal(
    processCall.body.p_provider_event_id,
    `seapals_inventory_reconcile_${SESSION_ID}_failed`
  );
});

test("a paid and complete Session commits inventory idempotently and preserves receipt references", async () => {
  const store = createStoreFetch();
  const summary = await reconcileOverdueInventoryReservations(
    options({
      fetchImpl: store.fetchImpl,
      retrieveSession: async () =>
        checkoutSession({ status: "complete", paymentStatus: "paid" }),
      expireSession: async () => assert.fail("paid Sessions must not expire"),
    })
  );

  assert.equal(summary.committed, 1);
  assert.equal(summary.released, 0);
  const processCall = store.calls.find(
    ({ name }) => name === "process_store_payment_event"
  );
  assert.equal(processCall.body.p_event_type, "checkout.session.completed");
  assert.equal(processCall.body.p_payment_status, "paid");
  assert.equal(processCall.body.p_payment_intent_id, "pi_test_reconciliation");
  assert.equal(processCall.body.p_charge_id, "ch_test_reconciliation");
  assert.equal(processCall.body.p_receipt_number, "TEST-1");
});

test("an open Session is explicitly expired and retrieved again before release", async () => {
  const store = createStoreFetch();
  const retrievedStatuses = ["open", "expired"];
  const operations = [];
  const summary = await reconcileOverdueInventoryReservations(
    options({
      fetchImpl: store.fetchImpl,
      retrieveSession: async () => {
        const status = retrievedStatuses.shift();
        operations.push(`retrieve:${status}`);
        return checkoutSession({ status });
      },
      expireSession: async (sessionId) => {
        operations.push(`expire:${sessionId}`);
        return checkoutSession({ status: "expired" });
      },
    })
  );

  assert.equal(summary.released, 1);
  assert.deepEqual(operations, [
    "retrieve:open",
    `expire:${SESSION_ID}`,
    "retrieve:expired",
  ]);
});

test("an unconfirmed expiration remains held and retryable without touching inventory", async () => {
  const store = createStoreFetch();
  let expirationRequested = false;
  const summary = await reconcileOverdueInventoryReservations(
    options({
      fetchImpl: store.fetchImpl,
      retrieveSession: async () => checkoutSession({ status: "open" }),
      expireSession: async () => {
        expirationRequested = true;
        return checkoutSession({ status: "expired" });
      },
    })
  );

  assert.equal(expirationRequested, true);
  assert.equal(summary.held, 1);
  assert.equal(summary.released, 0);
  assert.equal(
    store.calls.some(({ name }) => name === "process_store_payment_event"),
    false
  );
  const release = store.calls.find(
    ({ name }) => name === "release_store_inventory_reconciliation_claim"
  );
  assert.equal(
    release.body.p_failure_code,
    "inventory_reconciliation_expiration_unconfirmed"
  );
  assert.equal(
    release.body.p_retry_seconds,
    STORE_INVENTORY_RECONCILIATION_RETRY_SECONDS
  );
});

test("complete-unpaid, missing, and mismatched Sessions stay held", async (t) => {
  const cases = [
    {
      name: "complete unpaid",
      sessionId: SESSION_ID,
      retrieve: async () => checkoutSession({ status: "complete" }),
      code: "inventory_reconciliation_complete_unpaid",
    },
    {
      name: "missing Session reference",
      sessionId: null,
      retrieve: async () => assert.fail("a missing reference cannot be fetched"),
      code: "inventory_reconciliation_session_missing",
    },
    {
      name: "mismatched order metadata",
      sessionId: SESSION_ID,
      retrieve: async () => checkoutSession({ orderId: SECOND_ORDER_ID }),
      code: "inventory_reconciliation_session_mismatch",
    },
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const store = createStoreFetch({
        checkoutSessionIds: new Map([[ORDER_ID, scenario.sessionId]]),
      });
      const summary = await reconcileOverdueInventoryReservations(
        options({
          fetchImpl: store.fetchImpl,
          retrieveSession: scenario.retrieve,
          expireSession: async () => assert.fail("must not expire"),
        })
      );
      assert.equal(summary.held, 1);
      assert.equal(summary.committed + summary.released, 0);
      const release = store.calls.find(
        ({ name }) => name === "release_store_inventory_reconciliation_claim"
      );
      assert.equal(release.body.p_failure_code, scenario.code);
    });
  }
});

test("provider failures preserve the hold, release the lease, and fail the batch with safe counts", async () => {
  const store = createStoreFetch();
  await assert.rejects(
    reconcileOverdueInventoryReservations(
      options({
        fetchImpl: store.fetchImpl,
        retrieveSession: async () => {
          const error = new Error("provider details must not reach logs");
          error.code = "api_connection_error";
          throw error;
        },
        expireSession: async () => assert.fail("must not expire"),
      })
    ),
    (error) => {
      assert.equal(error.code, "api_connection_error");
      assert.deepEqual(error.summary, {
        queued: 1,
        claimed: 1,
        committed: 0,
        released: 0,
        held: 0,
        busy: 0,
        skipped: 0,
        failed: 1,
      });
      assert.doesNotMatch(error.message, /provider details/);
      return true;
    }
  );
  const release = store.calls.find(
    ({ name }) => name === "release_store_inventory_reconciliation_claim"
  );
  assert.equal(
    release.body.p_failure_code,
    "inventory_reconcile_api_connection_error"
  );
});

test("the bounded batch processes candidates sequentially", async () => {
  const sessionIds = new Map([
    [ORDER_ID, SESSION_ID],
    [SECOND_ORDER_ID, "cs_test_inventory_reconciliation_second"],
  ]);
  const store = createStoreFetch({
    orderIds: [ORDER_ID, SECOND_ORDER_ID],
    checkoutSessionIds: sessionIds,
  });
  const tokens = [CLAIM_TOKEN, SECOND_CLAIM_TOKEN];
  let inFlight = 0;
  let maximumInFlight = 0;

  const summary = await reconcileOverdueInventoryReservations(
    options({
      fetchImpl: store.fetchImpl,
      randomUUID: () => tokens.shift(),
      retrieveSession: async (sessionId) => {
        inFlight += 1;
        maximumInFlight = Math.max(maximumInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        const orderId =
          sessionId === SESSION_ID ? ORDER_ID : SECOND_ORDER_ID;
        return checkoutSession({ orderId, sessionId });
      },
      expireSession: async () => assert.fail("already expired"),
    })
  );

  assert.equal(summary.queued, 2);
  assert.equal(summary.released, 2);
  assert.equal(maximumInFlight, 1);
  assert.equal(
    store.calls[0].body.p_limit,
    STORE_INVENTORY_RECONCILIATION_BATCH_LIMIT
  );
  assert.equal(
    store.calls.find(
      ({ name }) => name === "claim_overdue_store_inventory_reservation"
    ).body.p_lease_seconds,
    STORE_INVENTORY_RECONCILIATION_LEASE_SECONDS
  );
});

test("configuration fails closed before private queue access", async () => {
  let storeCalls = 0;
  await assert.rejects(
    reconcileOverdueInventoryReservations({
      environment: { ...ENVIRONMENT, STRIPE_SECRET_KEY: "" },
      fetchImpl: async () => {
        storeCalls += 1;
        throw new Error("must not run");
      },
    }),
    (error) => error.code === "inventory_reconciliation_stripe_not_configured"
  );
  assert.equal(storeCalls, 0);
});
